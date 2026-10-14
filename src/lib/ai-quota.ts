// ai-quota — PAINEL DE COMBUSTÍVEL (Task 218, server-only)
//
// A resposta da casa para "a key vai ficar sem interrupções?": em vez de
// esperar o 429 acontecer, o roteador do tutor LÊ os limites reais da key
// (painel "Limites de taxa por modelo" do AI Studio — a tabela que o dono
// conferiu no próprio painel em 14/10/2026) + o uso que a casa registrou
// hoje, e PULA o modelo que já queimou o RPD ANTES da chamada falhar.
//
//   premium (20/dia cada): 3.8 → 3.7 → 3.6 → 3 → 2.5   ≈ 100 req "cara" por dia
//   trabalhador (500/dia):  3.5-lite → 3.1-lite        ≈ 1000 req por dia
//   e se TODOS sumirem: OpenRouter → Z.ai → SDK local (cadeia de sempre)
//
// Tudo aqui é OTIMIZAÇÃO: qualquer falha de leitura/gravação é silenciosa —
// a cadeia do tutor nunca morre por causa do contador.

import 'server-only';
import { db } from '@/lib/db';

/** Fuso do dono — o dia local decide quando o contador zera. */
const TZ = 'America/Sao_Paulo';

/** Limites RPD (requisições/dia) conferidos no painel do dono, 14/10/2026. */
export const QUOTA_SOURCE = 'Painel “Limites de taxa por modelo” do AI Studio (conferido pelo dono em 14/10/2026)';

export interface ModelQuota {
  /** RPD = máximo de requisições por dia (o limite que realmente aperta). */
  rpd: number;
  /** Classe do modelo na cadeia: premium responde melhor; trabalhador tem folga. */
  tier: 'premium' | 'workhorse';
}

/**
 * Tabela dos limites do painel do dono (14/10/2026):
 *   Gemini 3.8 Flash      5 RPM · 250K TPM · 20 RPD   ← Flash mais capaz da key
 *   Gemini 3.7/3.6 Flash  5 RPM · 250K TPM · 20 RPD
 *   Gemini 3 Flash        5 RPM · 250K TPM · 20 RPD
 *   Gemini 2.5 Flash      5 RPM · 250K TPM · 20 RPD
 *   Gemini 2.5 Flash-Lite 10 RPM · 250K TPM · 20 RPD
 *   Gemini 3.5 Flash-Lite 15 RPM · 250K TPM · 500 RPD ← o trabalhador
 *   Gemini 3.1 Flash-Lite 15 RPM · 250K TPM · 500 RPD
 * Pro (2.5/3.1), Nano Banana Pro, Veo, Lyria, Deep Research Pro = 0/0 no tier
 * desta key — fora da API (o Plus de estudante alimenta os APPS, não a API).
 */
export const GEMINI_QUOTAS: Record<string, ModelQuota> = {
  'gemini-3.8-flash': { rpd: 20, tier: 'premium' },
  'gemini-3.7-flash': { rpd: 20, tier: 'premium' },
  'gemini-3.6-flash': { rpd: 20, tier: 'premium' },
  'gemini-3-flash': { rpd: 20, tier: 'premium' },
  'gemini-2.5-flash': { rpd: 20, tier: 'premium' },
  'gemini-2.5-flash-lite': { rpd: 20, tier: 'workhorse' },
  'gemini-3.5-flash-lite': { rpd: 500, tier: 'workhorse' },
  'gemini-3.1-flash-lite': { rpd: 500, tier: 'workhorse' },
};

/**
 * Aliases vivos → id concreto de quota (o painel do AI Studio expõe o id real;
 * o "-latest" segue a versão — hoje flash-latest = 3.8, flash-lite-latest = 3.5-lite).
 * Erro aqui é inofensivo: só muda qual balde de quota marcamos.
 */
export const ALIAS_QUOTA_KEY: Record<string, string> = {
  'gemini-flash-latest': 'gemini-3.8-flash',
  'gemini-flash-lite-latest': 'gemini-3.5-flash-lite',
};

/** Modelo pede quota de qual balde? id fixo = ele mesmo; alias = o balde mapeado. */
export function quotaKeyOf(model: string): string {
  return ALIAS_QUOTA_KEY[model] ?? model;
}

/** "2026-10-14" no fuso do dono — chave do ledger diário. */
export function dayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now); // en-CA = AAAA-MM-DD
}

/** Erro de quota do Google (429 / RESOURCE_EXHAUSTED)? — detectado no texto. */
export function isQuotaError(message: string): boolean {
  return /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message);
}

/** Uso registrado hoje para um balde (null = nunca usou hoje). */
async function usageToday(quotaKey: string): Promise<{ count: number; exhausted: boolean } | null> {
  try {
    const row = await db.aiUsage.findUnique({
      where: { model_day: { model: quotaKey, day: dayKey() } },
      select: { count: true, exhausted: true },
    });
    return row ?? null;
  } catch {
    return null; // banco indisponível → tratamos como "sem histórico" (cadeia segue)
  }
}

/** Restam requisições neste balde hoje? (sem quota conhecida = sempre sim) */
async function hasFuel(model: string): Promise<boolean> {
  const q = GEMINI_QUOTAS[quotaKeyOf(model)];
  if (!q) return true; // modelo fora da tabela: não adianta adivinhar — deixa tentar
  const u = await usageToday(quotaKeyOf(model));
  if (!u) return true;
  return !u.exhausted && u.count < q.rpd;
}

/**
 * Reordena NADA — só remove da lista os modelos que já queimaram o RPD hoje.
 * O primeiro com combustível responde; quem tem 500/dia cobre o dia inteiro.
 */
export async function pickWithFuel<T extends string>(models: readonly T[]): Promise<T[]> {
  const keep: T[] = [];
  for (const m of models) {
    if (await hasFuel(m)) keep.push(m);
  }
  return keep;
}

/** Soma 1 requisição no balde do modelo (chamar DEPOIS de uma resposta OK). */
export async function recordAiUse(model: string): Promise<void> {
  const key = quotaKeyOf(model);
  const day = dayKey();
  try {
    await db.aiUsage.upsert({
      where: { model_day: { model: key, day } },
      update: { count: { increment: 1 } },
      create: { model: key, day, count: 1 },
    });
  } catch {
    // contador é otimização — nunca derruba a resposta
  }
}

/** 429 visto no balde hoje → casa exausta até o dia virar (o roteador pula). */
export async function markExhaustedToday(model: string): Promise<void> {
  const key = quotaKeyOf(model);
  const day = dayKey();
  const q = GEMINI_QUOTAS[key];
  try {
    await db.aiUsage.upsert({
      where: { model_day: { model: key, day } },
      update: { exhausted: true, ...(q ? { count: q.rpd } : {}) }, // satura o mostrador
      create: { model: key, day, count: 0, exhausted: true },
    });
  } catch {
    // idem
  }
}

// ---------------------------------------------------------------------------
// Painel para a UI (Configurações → Tutor IA → Combustível de hoje)
// ---------------------------------------------------------------------------

export interface FuelRow {
  /** id na cadeia (pode ser alias) — o que o roteador realmente tenta. */
  id: string;
  /** Balde de quota (id concreto). */
  quotaKey: string;
  /** Nome legível (o prettyModelName da rota cuida dos labels; aqui genérico). */
  tier: 'premium' | 'workhorse' | 'desconhecido';
  /** RPD do painel do dono (null = fora da tabela, sem limite conhecido). */
  limit: number | null;
  /** Requisições que a casa registra hoje neste balde. */
  used: number;
  /** 429 visto hoje? */
  exhausted: boolean;
}

/** Painel do combustível dos modelos da cadeia (na ordem em que são tentados). */
export async function fuelPanel(models: readonly string[]): Promise<FuelRow[]> {
  const rows: FuelRow[] = [];
  const seen = new Set<string>();
  for (const id of models) {
    const quotaKey = quotaKeyOf(id);
    if (seen.has(quotaKey)) continue;
    seen.add(quotaKey);
    const q = GEMINI_QUOTAS[quotaKey] ?? null;
    const u = await usageToday(quotaKey);
    rows.push({
      id,
      quotaKey,
      tier: q ? q.tier : 'desconhecido',
      limit: q ? q.rpd : null,
      used: u?.count ?? 0,
      exhausted: u?.exhausted ?? false,
    });
  }
  return rows;
}
