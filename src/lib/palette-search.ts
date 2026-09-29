/**
 * PALETA — ENTRADAS DE BUSCA (173).
 *
 * A paleta (Ctrl+K) era a navegação universal do Hub, mas o ACOERVO de
 * exercícios — a matéria-prima do Praticar e da véspera — era invisível
 * para ela: "transposta" achava materiais, nunca a questão. Mesmo custo de
 * navegação, zero portas: a busca que não acha o conteúdo não é busca.
 *
 * Este lib é PURA (a doutrina da casa: sem DOM, sem storage, sem fetch):
 * ela só DESCREVE entradas — a fiação (grupos, onSelect, badges) mora no
 * command-palette.tsx. Pura = executável em contrato (t173) sem browser.
 *
 * Duas fontes:
 *  1. EXERCÍCIOS do acervo (exercise-extractor, 98) — enunciado confirmado,
 *     tópico, dificuldade e fonte. TODOS entram, inclusive os de gate fino
 *     fechado: o Praticar renderiza a trava com a explicação honesta — a
 *     paleta não esconde o que o Praticar mostra (esconder seria segunda
 *     verdade). O deep-link usa o MESMO mecanismo do apoio do dia
 *     (openPractice com exerciseIds — a 94/125): chega filtrado ao só o
 *     achado, com chip com X — filtro que não prende.
 *  2. CARTÕES do aluno (progress.flashcards) — o baralho que ELE criou.
 *     Só existe entrada quando existe cartão (grupo ausente = estado vazio
 *     honesto; a paleta não anuncia gaveta vazia).
 */

import { disciplines, type Discipline } from '@/data/course-data';
import type { Exercise } from './exercise-extractor';
import type { Flashcard } from './study-progress';

/** Comprimento máximo do preview do enunciado/frente no valor de busca. */
export const PALETTE_PREVIEW_MAX = 140;

/** Rótulos da dificuldade — a mesma vocabulário do Praticar. */
export const DIFFICULTY_LABEL: Record<Exercise['difficulty'], string> = {
  facil: 'fácil',
  medio: 'médio',
  dificil: 'difícil',
};

/** Palavras-chave da fonte — o aluno fala "prova", não "prova_real". */
export const SOURCE_LABEL: Record<Exercise['source'], string> = {
  lista_algoritmos: 'lista',
  prova_real: 'prova real',
  gerado_topico: 'gerado',
  ia_sugerido: 'sugerido pela IA',
  material_professor: 'material do professor',
};

function disciplineOf(code: string): Discipline | undefined {
  return disciplines.find((d) => d.code === code);
}

/**
 * Corta o texto para o preview: no MÁXIMO `max` chars, quebrando no último
 * espaço (palavra inteira — a metade de uma palavra não é busca, é ruído)
 * com reticência. Texto curto volta inteiro, sem corte cosmético.
 */
export function trimPreview(text: string, max = PALETTE_PREVIEW_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

export interface ExercisePaletteEntry {
  id: string;
  disciplineCode: string;
  disciplineName: string;
  disciplineShort: string;
  topic: string;
  /** Enunciado cortado para a linha do resultado. */
  preview: string;
  /** String de busca da cmdk — tópico + preview + dificuldade + fonte. */
  value: string;
  difficulty: Exercise['difficulty'];
  difficultyLabel: string;
  source: Exercise['source'];
  sourceLabel: string;
  /** Questão de prova real — merece o selo próprio na linha. */
  isProvaReal: boolean;
  /** Gate fino fechado (determinantes/sistemas) — a paleta mostra, o Praticar trava. */
  gated: boolean;
}

export function exercisePaletteEntry(ex: Exercise): ExercisePaletteEntry {
  const disc = disciplineOf(ex.disciplineCode);
  const preview = trimPreview(ex.statement);
  const difficultyLabel = DIFFICULTY_LABEL[ex.difficulty];
  const sourceLabel = SOURCE_LABEL[ex.source] ?? ex.source;
  return {
    id: ex.id,
    disciplineCode: ex.disciplineCode,
    disciplineName: disc?.name ?? ex.disciplineCode,
    disciplineShort: disc?.shortName ?? ex.disciplineCode,
    topic: ex.topic,
    preview,
    // A string inteira é minúscula por higiene — a cmdk já ignora caixa, e o
    // value vira chave de seleção única (id embutido evita colisão de
    // enunciados iguais entre provas).
    value: `questao exercicio ${disc?.name ?? ''} ${disc?.shortName ?? ''} ${ex.topic} ${difficultyLabel} ${sourceLabel} ${preview} ${ex.id}`.toLowerCase(),
    difficulty: ex.difficulty,
    difficultyLabel,
    source: ex.source,
    sourceLabel,
    isProvaReal: ex.source === 'prova_real',
    gated: typeof ex.requiresSubtopico === 'string' && ex.requiresSubtopico.length > 0,
  };
}

export function exercisePaletteEntries(all: Exercise[]): ExercisePaletteEntry[] {
  return all.map(exercisePaletteEntry);
}

export interface FlashcardPaletteEntry {
  id: string;
  disciplineCode: string;
  disciplineName: string;
  disciplineShort: string;
  front: string;
  /** Verso cortado — o aluno confere se é o cartão que procurava. */
  backPreview: string;
  value: string;
  box: number;
  /** Fora do prazo — o hint da linha fala "vencido". */
  overdue: boolean;
  lapses: number;
  lapsesLabel: string;
  /** Semeado do caderno (134) — a procedência mora na linha. */
  fromMistake: boolean;
}

export function flashcardPaletteEntry(card: Flashcard, nowMs: number): FlashcardPaletteEntry {
  const disc = disciplineOf(card.disciplineCode);
  const front = trimPreview(card.front, 90);
  const backPreview = trimPreview(card.back, 110);
  const overdue = new Date(card.dueAt).getTime() < nowMs;
  const lapsesLabel =
    card.lapses === 0 ? '' : card.lapses === 1 ? '1 lapso' : `${card.lapses} lapsos`;
  return {
    id: card.id,
    disciplineCode: card.disciplineCode,
    disciplineName: disc?.name ?? card.disciplineCode,
    disciplineShort: disc?.shortName ?? card.disciplineCode,
    front,
    backPreview,
    value: `cartao flashcard revisar ${disc?.name ?? ''} ${disc?.shortName ?? ''} ${front} ${backPreview}`.toLowerCase(),
    box: card.box,
    overdue,
    lapses: card.lapses,
    lapsesLabel,
    fromMistake: typeof card.fromMistake === 'string' && card.fromMistake.length > 0,
  };
}

export function flashcardPaletteEntries(
  all: Flashcard[],
  nowMs: number,
): FlashcardPaletteEntry[] {
  return all.map((c) => flashcardPaletteEntry(c, nowMs));
}

/**
 * O FILTRO DA BUSCA (173, relaxado na 179) — palavra inteira, não subsequência
 * solta, com a higiene da FRASE NATURAL.
 *
 * O filtro padrão da cmdk casa por SUBSEQUÊNCIA: as letras da busca têm que
 * aparecer EM ORDEM no valor — com enunciados longos, quase qualquer busca
 * casa com quase qualquer questão ("transposta" devolvia o tutor de
 * Português). A regra honesta é a do usuário: CADA palavra digitada tem que
 * aparecer (como sub-palavra) no resultado — "transposta" acha as questões
 * de transposta, e só elas.
 *
 * SEM ACENTO dos dois lados (NFD + faixa de combining marks): o aluno digita
 * "logica" e acha "Lógica"; digita "matriz" e acha "Matrizes". A busca que
 * exige acento é busca que falha no aperto da véspera.
 *
 * A LIÇÃO DA FRASE INTEIRA (179 — a dívida P2 da 173): o aluno digita a
 * frase como fala — "lista de matrizes bloco 1" — e o E-e DE PALAVRAS
 * engolia a busca inteira por causa de palavras de LIGAÇÃO: o "de" não
 * mora no título "Matrizes — Aula 01 (Lista)" e uma só palavra ausente
 * apagava TODOS os resultados ("Nada encontrado" para uma frase legítima).
 * A régua v2 separa o que é CONTEÚDO do que é LIGAÇÃO:
 *  - STOPWORDS (artigos, preposições, pronomes de busca): nunca BLOQUEIAM —
 *    um resultado não precisa conter "de" para ser a lista de matrizes;
 *  - palavras SIGNIFICATIVAS: e-e como antes (a precisão da 173 intacta
 *    para buscas curtas: "matriz inversa" exige as duas);
 *  - TOLERÂNCIA DE UM ERRO: a partir de 3 significativas, UMA pode faltar —
 *    "bloco" não mora no título, mas a frase tem 4 palavras de conteúdo e
 *    3 delas apontam para a MESMA lista; quem digitou 3+ pistas merece o
 *    melhor candidato, não o silêncio. Com 2 palavras continua estrito:
 *    a tolerância cedo é ruído disfarçado de generosidade.
 *  - SÓ stopword na busca ("de", "a o e"): nada de conteúdo foi pedido —
 *    cai no e-e bruto (o que digitou é o que exige).
 *
 * Retorna 0 (esconde) ou 1 (mostra) — o contrato da cmdk. Busca vazia = 1
 * (a paleta inteira, como sempre foi antes de digitar).
 */

/**
 * Palavras de ligação do português que NUNCA bloqueiam um resultado. Só
 * palavras minúsculas dobradas (a comparação é pós-fold) — "DE" em caixa
 * alta cai aqui junto, e "delivery" não (e-e é por PALAVRA, não substring).
 */
const PALETTE_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos',
  'a', 'o', 'as', 'os', 'e', 'ou', 'em', 'um', 'uma',
  'no', 'na', 'nos', 'nas', 'ao', 'aos', 'à', 'às',
  'para', 'por', 'com', 'sem', 'que', 'se',
  'qual', 'quais', 'onde', 'como', 'sobre', 'entre',
]);

/** A partir de quantas palavras significativas a tolerância de 1 erro liga. */
export const PALETTE_RELAX_MIN_WORDS = 3;

export function paletteWordFilter(value: string, search: string): number {
  const query = foldAccents(search).toLowerCase().trim();
  if (query.length === 0) return 1;
  const haystack = foldAccents(value).toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const significant = words.filter((w) => !PALETTE_STOPWORDS.has(w));
  // Só ligação na busca: o e-e bruto manda (o usuário pediu exatamente isso).
  if (significant.length === 0) {
    return words.every((w) => haystack.includes(w)) ? 1 : 0;
  }
  const misses = significant.filter((w) => !haystack.includes(w)).length;
  const allowed = significant.length >= PALETTE_RELAX_MIN_WORDS ? 1 : 0;
  return misses <= allowed ? 1 : 0;
}

function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* -------------------------------------------------------------------------
 * CONCEITOS NOS RESUMOS (174) — a busca que LÊ o conteúdo dos resumos IA.
 *
 * A paleta achava o TÍTULO do material, nunca o que ele explica: na véspera,
 * "onde eu li transposta?" não tinha resposta. O índice
 * (src/data/conceitos-index.json, gerado por scripts/gen-conceitos-index.mjs
 * a partir dos resumos) carrega a camada de conceitos — a de maior valor por
 * byte — com summaryFile como CHAVE DE JUNÇÃO para course-data.materials
 * (fonte única): conceito sem material par NÃO vira entrada (material-first:
 * sem a porta do resumo, a entrada não existe).
 * ----------------------------------------------------------------------- */

/** Linha do índice gerado (scripts/gen-conceitos-index.mjs). */
export interface ConceitoIndexEntry {
  conceito: string;
  explicacao: string;
  exemplo?: string;
  summaryFile: string;
  titulo: string;
}

export interface ConceitoPaletteEntry {
  /** conceito + summaryFile — dois conceitos homônimos em resumos distintos. */
  key: string;
  conceito: string;
  /** Explicação cortada para a linha de apoio do resultado. */
  explicacaoPreview: string;
  exemploPreview: string | null;
  /** String de busca da cmdk — conceito + explicação + exemplo + resumo. */
  value: string;
  summaryFile: string;
  materialTitle: string;
}

/** Comprimento da explicação no resultado da busca. */
export const CONCEITO_PREVIEW_MAX = 120;

export function conceitoPaletteEntry(c: ConceitoIndexEntry): ConceitoPaletteEntry {
  const conceito = c.conceito.trim();
  const explicacaoPreview = trimPreview(c.explicacao, CONCEITO_PREVIEW_MAX);
  const exemploPreview = c.exemplo ? trimPreview(c.exemplo, 110) : null;
  const titulo = c.titulo.trim();
  return {
    key: `${c.summaryFile}::${conceito}`,
    conceito,
    explicacaoPreview,
    exemploPreview,
    value: `conceito resumo ia ${titulo} ${conceito} ${explicacaoPreview} ${exemploPreview ?? ''}`.toLowerCase(),
    summaryFile: c.summaryFile,
    materialTitle: titulo || c.summaryFile,
  };
}

export function conceitoPaletteEntries(all: ConceitoIndexEntry[]): ConceitoPaletteEntry[] {
  return all.map(conceitoPaletteEntry);
}
