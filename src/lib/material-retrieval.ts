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
const EXCERPTS_BUDGET = 4200;
const CHUNK_SIZE = 1400;
const MAX_CHUNKS = 4;

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

/**
 * NÚMERO DA QUESTÃO citado na pergunta (28/09 — dor do dono: "a IA erra em
 * matemática"; parte do erro era o retrieval que não achava o ENUNCIADO da
 * questão pedida: "questão 3", "exercicio 12", "q3", "item 5"). Detecta o
 * número e sobe MUITO o chunk que o contém como cabeçalho de enunciado
 * ("3-", "3)", "Questão 3") — a lista é a matéria-prima da Av1.
 * Retorna null quando a pergunta não cita número.
 */
export function questionNumberHint(question: string): number | null {
  const m = normalize(question).match(
    /\b(?:questao|exercicio|q|item)\s*n?[oº°ª]?\s*(\d{1,2})\b/,
  );
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 99 ? n : null;
}

/** O chunk é o ENUNCIADO da questão N? (numeração literal das listas do curso)
 *  Tolerante à decoração de markdown da transcrição por visão (**9-**, >2-) —
 *  o `**` antes do número enganava o `(^|\n)\s*` e a questão desaparecia
 *  do retrieval EXATAMENTE na lista que o aluno estava fazendo. */
function chunkHasQuestionNumber(chunk: string, n: number): boolean {
  const c = normalize(chunk);
  const heads = [
    new RegExp(`(^|\\n)[*_>#\\s]*${n}\\s*[-).:]`), // "3-" "3)" "3." no início de linha
    new RegExp(`(^|\\n)[*_>#\\s]*questao\\s*${n}\\b`),
    new RegExp(`(^|\\n)[*_>#\\s]*exercicio\\s*${n}\\b`),
  ];
  return heads.some((re) => re.test(c));
}

// ---------- chunks ----------
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
 * NENHUM MATERIAL SELECIONADO ≠ NENHUM MATERIAL EXISTE (139 — dor do dono:
 * "a IA erra com frequência em matemática"). O aluno pergunta "qual é a matriz
 * D da questão 2?" com o chat limpo — sem este fallback o tutor ficava SEM
 * bloco de material nenhum e INVENTAVA a matriz. Aqui varremos os materiais da
 * disciplina (textos + resumos), pontuamos cada um pela MESMA métrica dos
 * trechos (keyword scoring + bônus de questão numerada) e devolvemos o melhor.
 * Limiar baixo de corte: match fraco devolve undefined (o tutor responde
 * honestamente do conhecimento geral em vez de ancorar no material errado).
 */
export async function findBestMaterialForQuestion(
  disciplineCode: string,
  question: string,
): Promise<Material | undefined> {
  const pool = materials.filter((m) => m.disciplineCode === disciplineCode);
  if (pool.length === 0) return undefined;
  const kws = keywordsOf(question);
  if (kws.length === 0) return undefined;
  const qNum = questionNumberHint(question);
  // NOME DE MATRIZ citado pelo aluno ("a matriz D da questão 2", "matriz B") —
  // sinal FORTE e barato: o material que contém essa matriz é o âncora certo,
  // e a teoria (que fala de A, B, M genéricos) para de vencer por volume de prosa.
  const namedMx = [
    ...new Set(
      [...question.matchAll(/\bmatr[ií]ze?s?\s+([A-Za-z])\b/g)].map((m) => normalize(m[1])),
    ),
  ];

  let best: { material: Material; score: number } | undefined;
  for (const m of pool) {
    // 1) texto do PDF — onde vivem os enunciados e os números
    const text = await readCached(textCache, TEXTS_DIR, `${m.id}.txt`);
    // 2) resumo IA — materiais só-resumo (web, vídeo) competem com desconto
    const rawSummary = m.summaryFile
      ? await readCached(summaryCache, SUMMARIES_DIR, m.summaryFile)
      : null;

    if (!text && !rawSummary) continue;

    // Por chunk: keywords + BÔNUS DE QUESTÃO NUMERADA com peso pela convenção
    // do curso — listas numeram enunciado com "N-" / "N)" (a pergunta do aluno
    // mira um ENUNCIADO); teoria usa "N. TÍTULO" (seção). O dash vence o ponto:
    // "questão 2" com o chat limpo tem que pousar na LISTA, não na seção 2 da
    // teoria (foi exatamente o empate sujo que inventou a matriz D da 139).
    const chunkScores: number[] = [];
    let hasEnunciado = false; // chunk com "N-"/"N)" — ENUNCIADO de lista
    if (text) {
      const chunks = chunkText(text);
      for (const c of chunks) {
        let s = scoreChunk(c, kws, normalize(c));
        // matriz NOMEADA: cada material que exibe "matriz D = [[…]]" ganha muito
        for (const x of namedMx) {
          const re = new RegExp(`matr[i]ze?s?\\s+${x}\\b`, 'g');
          const hits = (normalize(c).match(re) ?? []).length;
          if (hits) s += 150 * Math.min(hits, 2);
        }
        if (qNum !== null) {
          if (chunkHasQuestionNumber(c, qNum)) {
            // enunciado de LISTA: "N-"/"N)" seguido de letra (não é "2 - 3"
            // de subtração, não é "N. TÍTULO" de seção de teoria)
            const enunciado = new RegExp(
              `(^|\\n)[*_>#\\s]*${qNum}\\s*[-)]\\s*[^\\d\\s]`,
            ).test(normalize(c));
            s += enunciado ? 120 : 60;
            if (enunciado) hasEnunciado = true;
          }
        }
        chunkScores.push(s);
      }
    }
    let materialScore = 0;
    if (chunkScores.length) {
      chunkScores.sort((a, b) => b - a);
      // SOMA dos 2 melhores chunks: material que acerta o enunciado E o contexto
      // vizinho vale mais que um material com um único trecho sortudo.
      materialScore = chunkScores[0] + (chunkScores[1] ?? 0);
    }
    if (rawSummary) {
      const norm = normalize(rawSummary.slice(0, 8000));
      materialScore += scoreChunk(norm, kws, norm) / 4;
    }
    // TIER DO ENUNCIADO (a lição da matriz D inventada): quando o aluno cita
    // "questão N", o material que TEM o enunciado N- vale mais que QUALQUER
    // prosa — a teoria é densa em palavras e sempre pontua alto, mas ela NÃO
    // tem a questão. +400 domina qualquer soma de keywords sem apagar o ranking
    // entre dois materiais que ambos têm enunciado (aí decide o keyword score).
    if (hasEnunciado) materialScore += 400;

    if (!best || materialScore > best.score) best = { material: m, score: materialScore };
  }

  // Corte de lixo: abaixo disso a pergunta não aponta para material nenhum —
  // responder honestamente sem fonte é melhor que ancorar no material errado.
  const MIN_SCORE = 60;
  return best && best.score >= MIN_SCORE ? best.material : undefined;
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
    const qNum = questionNumberHint(question);
    const chunks = chunkText(text);
    const scores = chunks.map((c, i) => {
      let s = scoreChunk(c, kws, normalize(c)) + (i === 0 ? 4 : 0);
      // A QUESTÃO PEDIDA PRIMEIRO: o enunciado numerado vence qualquer
      // pontuação de keywords — errar a questão que o aluno citou é o pior erro.
      if (qNum !== null && chunkHasQuestionNumber(c, qNum)) s += 100;
      return s;
    });
    // top-N por relevância própria
    const ranked = scores
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s > 4)
      .sort((a, b) => b.s - a.s);
    // EXPANSÃO DE VIZINHOS: tabelas no PDF viram um "parágrafo" de linhas que é
    // fatiado em chunks sem keywords — mas o parágrafo que APRESENTA a tabela
    // pontua alto (ex.: "O Quadro 1 apresenta os pontos negativos... (35,90%)").
    // Puxar o vizinho imediato de cada trecho escolhido junta o contexto real.
    const chosen = new Set<number>();
    let used = 0;
    for (const { i } of ranked) {
      if (chosen.size >= MAX_CHUNKS || used >= EXCERPTS_BUDGET) break;
      for (const j of [i, i + 1, i - 1]) {
        if (j < 0 || j >= chunks.length || chosen.has(j)) continue;
        const len = chunks[j].length;
        if (used + len > EXCERPTS_BUDGET && chosen.size > 0) continue;
        chosen.add(j);
        used += len;
      }
      if (used >= EXCERPTS_BUDGET) break;
    }
    if (chosen.size) {
      const picked = [...chosen].sort((a, b) => a - b).map((i) => chunks[i]);
      // O RETRIEVAL SABE DAS PÁGINAS: os marcadores <!-- página N --> da
      // transcrição por visão viram rótulos legíveis — o tutor pode citar a
      // página exata da lista quando responder.
      const withPages = picked.join('\n\n[...]\n\n').replace(
        /<!-- página (\d+) -->/g,
        (_, n) => `[página ${n}]`,
      );
      parts.push(
        `== TRECHOS DO PDF ORIGINAL (mais relevantes à pergunta) ==\n${withPages}`,
      );
    }
  }

  if (parts.length === 0) return '';

  return [
    '',
    `=== MATERIAL ABERTO PELO ALUNO: "${material.title}" (${material.disciplineCode}) ===`,
    'Use este conteúdo como FONTE PRIMÁRIA: cite trechos, exemplos e números EXATAMENTE como aparecem. Não invente conteúdo além dele.',
    'REGRA CRÍTICA: o material acima tem DADOS CONCRETOS (números da amostra, percentuais, valores de tabela). Se o aluno pedir resultados/dados/números, cite NO MÍNIMO 3 valores EXATOS vindos daqui — resposta qualitativa sem números é reprovada.',
    ...parts,
    '=== FIM DO MATERIAL ===',
    '',
  ].join('\n');
}
