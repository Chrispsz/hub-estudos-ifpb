// material-retrieval — dá ao Tutor IA acesso ao CONTEÚDO REAL dos materiais.
//
// Duas camadas, ambas com cache em memória por instância do servidor:
//  1. Resumo IA do material (public/data/ai-summaries/*.summary.json) — visão estruturada
//  2. Trechos do texto extraído do PDF (public/data/material-texts/<id>.txt) —
//     escolhidos por relevância de palavras-chave da pergunta (retrieval leve, sem embeddings)
//
// Economia: o bloco injetado no prompt fica em ~3-5KB — cabe fácil no contexto
// e mantém o custo/latência dos modelos free sob controle.

import { promises as fs } from 'fs';
import path from 'path';
import { materials } from '@/data/course-data';
import type { Material } from '@/data/course-data';

const SUMMARIES_DIR = 'public/data/ai-summaries';
const TEXTS_DIR = 'public/data/material-texts';

/** Orçamentos de tamanho (chars) — protege a latência dos modelos free. */
const SUMMARY_BUDGET = 2600;
const EXCERPTS_BUDGET = 3200;
const CHUNK_SIZE = 1400;
const MAX_CHUNKS = 3;

// ---------- caches ----------
const summaryCache = new Map<string, string>();
const textCache = new Map<string, string>();

// ---------- normalização PT-BR ----------
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos
}

const STOPWORDS = new Set([
  'a', 'o', 'e', 'as', 'os', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'no', 'na',
  'nos', 'nas', 'em', 'por', 'para', 'com', 'sem', 'que', 'qual', 'quais', 'quando',
  'onde', 'como', 'me', 'meu', 'minha', 'voce', 'vc', 'ele', 'ela', 'isso', 'isto',
  'ser', 'sou', 'e', 'eh', 'ao', 'aos', 'se', 'sua', 'seu', 'sobre', 'the', 'of',
  'mais', 'muito', 'pode', 'faz', 'fazer', 'tem', 'sao', 'foi', 'vai', 'dou', 'diga',
  'explique', 'explica', 'fale', 'quero', 'preciso', 'saber', 'entenda', 'exemplo',
]);

/** Palavras-chave da pergunta (normalizadas, sem stopwords). */
export function keywordsOf(question: string): string[] {
  const words = normalize(question)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  // dedup preservando ordem
  return [...new Set(words)];
}

// ---------- chunks ----------
interface Chunk {
  text: string;
  score: number;
}

function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let cur = '';
  for (const p of paragraphs) {
    // parágrafo maior que o chunk vira chunk próprio (cortado)
    if (p.length > CHUNK_SIZE) {
      if (cur) {
        chunks.push(cur.trim());
        cur = '';
      }
      for (let i = 0; i < p.length; i += CHUNK_SIZE) chunks.push(p.slice(i, i + CHUNK_SIZE));
      continue;
    }
    if (cur.length + p.length + 2 > CHUNK_SIZE) {
      chunks.push(cur.trim());
      cur = p;
    } else {
      cur += (cur ? '\n\n' : '') + p;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function scoreChunk(chunk: string, kws: string[], chunkNorm: string): number {
  if (kws.length === 0) return 0;
  let score = 0;
  let found = 0;
  for (const kw of kws) {
    let idx = chunkNorm.indexOf(kw);
    if (idx === -1) continue;
    found++;
    let hits = 0;
    while (idx !== -1 && hits < 4) {
      hits++;
      idx = chunkNorm.indexOf(kw, idx + kw.length);
    }
    // keywords longas valem mais (mais específicas)
    score += hits * Math.min(kw.length, 10);
  }
  // cobertura: chunk que menciona MAIS keywords da pergunta sobe muito
  score += (found / kws.length) * 40;
  return score;
}

// ---------- leitura com cache ----------
async function readCached(cache: Map<string, string>, relDir: string, file: string): Promise<string | null> {
  if (cache.has(file)) return cache.get(file) ?? null;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), relDir, file), 'utf8');
    cache.set(file, raw);
    return raw;
  } catch {
    cache.set(file, '');
    return null;
  }
}

// ---------- resumo IA compacto ----------
interface SummaryConcept {
  conceito?: string;
  explicacao?: string;
  exemplo?: string;
}
interface SummaryJson {
  titulo?: string;
  conceitos_chave?: SummaryConcept[];
  pontos_importantes?: string[];
  erros_comuns?: string[];
  formulas_regras?: string[];
  [k: string]: unknown;
}

function compactSummary(json: SummaryJson): string {
  const out: string[] = [];
  if (json.titulo) out.push(`Título: ${json.titulo}`);

  if (Array.isArray(json.conceitos_chave) && json.conceitos_chave.length) {
    const lines = json.conceitos_chave
      .slice(0, 10)
      .map((c) => {
        const exp = (c.explicacao ?? '').trim();
        return `- ${c.conceito ?? '?'}: ${exp}`;
      })
      .filter((l) => !l.endsWith('?'));
    if (lines.length) out.push(`Conceitos-chave:\n${lines.join('\n')}`);
  }

  const list = (v: unknown, label: string, max: number) => {
    if (Array.isArray(v) && v.length) {
      out.push(`${label}:\n${v.slice(0, max).map((x) => `- ${String(x)}`).join('\n')}`);
    }
  };
  list(json.pontos_importantes, 'Pontos importantes', 6);
  list(json.formulas_regras, 'Fórmulas/regras', 6);
  list(json.erros_comuns, 'Erros comuns dos alunos', 5);

  return out.join('\n\n').slice(0, SUMMARY_BUDGET);
}

// ---------- API principal ----------

/** Procura o material por id; fallback: título exato/parcial (client antigo). */
export function findMaterial(idOrTitle?: string): Material | undefined {
  if (!idOrTitle) return undefined;
  const t = idOrTitle.trim().toLowerCase();
  return (
    materials.find((m) => m.id === idOrTitle) ??
    materials.find((m) => m.title.toLowerCase() === t) ??
    materials.find((m) => m.title.toLowerCase().includes(t) && t.length >= 6)
  );
}

/**
 * Monta o bloco "CONTEÚDO DO MATERIAL" para o prompt do tutor.
 * Retorna '' quando o material não tem nada útil (sem summary, sem texto).
 */
export async function buildMaterialBlock(material: Material, question: string): Promise<string> {
  const parts: string[] = [];

  // 1) resumo IA estruturado
  if (material.summaryFile) {
    const raw = await readCached(summaryCache, SUMMARIES_DIR, material.summaryFile);
    if (raw) {
      try {
        const compact = compactSummary(JSON.parse(raw) as SummaryJson);
        if (compact) parts.push(`== RESUMO ESTRUTURADO DO MATERIAL ==\n${compact}`);
      } catch {
        // JSON inválido — ignora sem quebrar o tutor
      }
    }
  }

  // 2) trechos do texto real do PDF, mais relevantes à pergunta
  const text = await readCached(textCache, TEXTS_DIR, `${material.id}.txt`);
  if (text) {
    const kws = keywordsOf(question);
    const chunks = chunkText(text);
    const scored: Chunk[] = chunks.map((c, i) => ({
      text: c,
      score: scoreChunk(c, kws, normalize(c)) + (i === 0 ? 4 : 0), // intro leve
    }));
    scored.sort((a, b) => b.score - a.score);
    const picked: string[] = [];
    let used = 0;
    for (const c of scored) {
      if (picked.length >= MAX_CHUNKS || used >= EXCERPTS_BUDGET) break;
      if (c.score <= 4 && picked.length > 0) break; // só relevância real após o 1º
      picked.push(c.text);
      used += c.text.length;
    }
    if (picked.length) {
      parts.push(
        `== TRECHOS DO PDF ORIGINAL (mais relevantes à pergunta) ==\n${picked.join('\n\n[...]\n\n')}`,
      );
    }
  }

  if (parts.length === 0) return '';

  return [
    '',
    `=== MATERIAL ABERTO PELO ALUNO: "${material.title}" (${material.disciplineCode}) ===`,
    'Use este conteúdo como FONTE PRIMÁRIA: cite trechos, exemplos e números EXATAMENTE como aparecem. Não invente conteúdo além dele.',
    ...parts,
    '=== FIM DO MATERIAL ===',
    '',
  ].join('\n');
}
