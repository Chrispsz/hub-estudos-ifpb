// ai-settings — A CHAVE PERFEITA (Task 214-b, server-only)
//
// A chave do Gemini é DADO DO DONO: entra pela própria casa (Configurações →
// Inteligência da casa), mora na tabela Setting do banco do servidor, volta
// mascarada ao cliente (só o fim) e é removível. NUNCA vai para o código, o
// git ou o log — e este módulo nunca a devolve inteira.
//
// Precedência da cadeia do tutor:
//   chave:  SALVA (DB)  →  env (GEMINI_API_KEY / GOOGLE_AI_API_KEY)  →  null
//   modelo: preferência salva (DB)  →  env GEMINI_MODEL  →  aliases "-latest"
//
// Cache em memória com invalidação ao salvar/remover: o PRÓXIMO call do tutor
// já usa a chave nova (nada de rede extra por chamada, nada de estado velho).

import 'server-only';
import { db } from '@/lib/db';

/** Linhas da tabela Setting — nomes estáveis, valores nunca logados. */
const SETTING_GEMINI_KEY = 'gemini.api_key';
const SETTING_GEMINI_MODEL = 'gemini.model';

/** Aliases vivos do AI Studio: sobrevivem à troca de versão do Google. */
export const DEFAULT_GEMINI_ALIASES = ['gemini-flash-lite-latest', 'gemini-flash-latest'] as const;

/** Fonte da chave efetiva: 'db' (salva na casa) | 'env' (variável de ambiente) | null (nenhuma). */
export type GeminiKeySource = 'db' | 'env' | null;

export interface EffectiveGeminiConfig {
  /** Chave efetiva (DB vence env) — nunca logar, nunca devolver inteira ao cliente. */
  key: string | null;
  /** De onde veio a chave: 'db' | 'env' | null. */
  source: GeminiKeySource;
  /** Lista de modelos a tentar, em ordem: preferência salva → env → aliases padrão. */
  model: string[];
}

// ---------------------------------------------------------------------------
// Cache em memória (por processo) — invalidado por set/remove.
// ---------------------------------------------------------------------------
interface GeminiCache {
  loaded: boolean;
  key: string | null;
  model: string | null;
}
const cache: GeminiCache = { loaded: false, key: null, model: null };

function invalidateCache(): void {
  cache.loaded = false;
  cache.key = null;
  cache.model = null;
}

/** Lê a dupla chave+modelo da tabela Setting (uma ida só, cacheada). */
async function loadSaved(): Promise<{ key: string | null; model: string | null }> {
  if (cache.loaded) return { key: cache.key, model: cache.model };
  try {
    const rows = await db.setting.findMany({
      where: { key: { in: [SETTING_GEMINI_KEY, SETTING_GEMINI_MODEL] } },
      select: { key: true, value: true },
    });
    for (const row of rows) {
      if (row.key === SETTING_GEMINI_KEY && row.value) cache.key = row.value;
      if (row.key === SETTING_GEMINI_MODEL && row.value.trim()) cache.model = row.value.trim();
    }
    cache.loaded = true;
  } catch {
    // Banco indisponível (ex.: deploy sem DATABASE_URL): degrada para env —
    // a casa não morre por causa de preferência salva.
    cache.loaded = false;
  }
  return { key: cache.key, model: cache.model };
}

// ---------------------------------------------------------------------------
// Leitura da chave/modelo salvos
// ---------------------------------------------------------------------------

/** Chave do Gemini salva pelo dono na casa (ou null). NUNCA logar o retorno. */
export async function getSavedGeminiKey(): Promise<string | null> {
  return (await loadSaved()).key;
}

/** Preferência de modelo salva pelo dono (ou null → automático). */
export async function getSavedGeminiModel(): Promise<string | null> {
  return (await loadSaved()).model;
}

/** Chave da env (nomes aceitos hoje na casa), sem tocar no DB. */
function envGeminiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || null;
}

/**
 * Configuração EFETIVA do Gemini na casa — a fonte única usada pela cadeia do
 * tutor (POST, transcrição e probe). Chave: DB → env. Modelo: DB → env → aliases.
 */
export async function getEffectiveGeminiConfig(): Promise<EffectiveGeminiConfig> {
  const saved = await loadSaved();

  if (saved.key) {
    return { key: saved.key, source: 'db', model: savedModelList(saved.model) };
  }
  const envKey = envGeminiKey();
  if (envKey) {
    return { key: envKey, source: 'env', model: savedModelList(saved.model) };
  }
  return { key: null, source: null, model: savedModelList(saved.model) };
}

/** Lista de modelos efetiva: preferência salva vence; env GEMINI_MODEL depois; aliases por fim. */
function savedModelList(savedModel: string | null): string[] {
  if (savedModel) return [savedModel];
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  return [...DEFAULT_GEMINI_ALIASES];
}

// ---------------------------------------------------------------------------
// Escrita/remoção — sempre com invalidação de cache (o tutor usa a chave nova
// já na próxima chamada).
// ---------------------------------------------------------------------------

/** Upsert de uma linha Setting (uso interno — valores nunca logados). */
async function upsertSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Salva a chave do Gemini (dado do dono). Chame APENAS com formato validado. */
export async function setSavedGeminiKey(key: string): Promise<void> {
  await upsertSetting(SETTING_GEMINI_KEY, key);
  invalidateCache();
}

/** Salva a preferência de modelo (string livre, já trimada). Vazio/vírgula remove. */
export async function setSavedGeminiModel(model: string): Promise<void> {
  const clean = model.trim();
  if (!clean) {
    await clearSavedGeminiModel();
    return;
  }
  await upsertSetting(SETTING_GEMINI_MODEL, clean);
  invalidateCache();
}

/** Remove a chave salva (o dono pediu esquecer). Volta a valer a env, se existir. */
export async function clearSavedGeminiKey(): Promise<void> {
  try {
    await db.setting.deleteMany({ where: { key: SETTING_GEMINI_KEY } });
  } finally {
    invalidateCache();
  }
}

/** Remove a preferência de modelo (volta ao automático: DB nada → env → aliases). */
export async function clearSavedGeminiModel(): Promise<void> {
  try {
    await db.setting.deleteMany({ where: { key: SETTING_GEMINI_MODEL } });
  } finally {
    invalidateCache();
  }
}

// ---------------------------------------------------------------------------
// Máscara — a ÚNICA forma de chave que chega ao cliente.
// ---------------------------------------------------------------------------

/** "AIza…abcd" — começo fixo da marca + só o fim. Nunca a chave inteira. */
export function maskKey(key: string): string {
  const clean = key.trim();
  if (clean.length <= 8) return '…' + clean.slice(-2);
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

/**
 * Validação FROUXA do formato de chave Gemini (AI Studio): começa com "AIza"
 * e tem >= 30 caracteres. Serve para rejeitar erro de digitação grosseiro —
 * a prova real continua sendo o "Testar agora" (probe de verdade na API).
 */
export function isValidGeminiKeyFormat(key: string): boolean {
  const clean = key.trim();
  return clean.startsWith('AIza') && clean.length >= 30;
}
