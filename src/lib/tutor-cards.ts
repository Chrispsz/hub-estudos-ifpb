/**
 * DO ERRO AO CARTÃO — fecha o ciclo de aprendizagem do Hub: errar → IA
 * reensina → o tutor ESCREVE o cartão → 1 clique salva no baralho (Leitner).
 *
 * Duas peças:
 *  1. Sufixo de prompt (TUTOR_CARD_SUFFIX): pedido em pt-BR para a IA terminar
 *     a resposta com um cartão no formato fixo "FRENTE:/VERSO:" — rigor no
 *     formato é o que torna a detecção confiável sem inventar cards.
 *  2. Parser (parseTutorCards): lê a resposta QUALQUER mensagem do tutor e
 *     extrai pares FRENTE/VERSO completos (tolerante a **negrito**, numeração
 *     e acentuação) e, como fallback, blocos JSON [{front, back}] (o mesmo
 *     formato que o Método já usa em mode:'flashcards').
 *
 * Material-first: o cartão nasce do que a IA acabou de reensinar sobre UM erro
 * real do caderno — nada é gerado no vácuo. source:'ia' no baralho preserva a
 * origem (o aluno sabe que o cartão veio do tutor).
 */

import type { Flashcard } from './study-progress';

/** Pedido de cartão anexado ao fim de perguntas de reensino (caderno de erros). */
export const TUTOR_CARD_SUFFIX = [
  '',
  'E termina a resposta com UM cartão pronto para o meu baralho de revisão espaçada, exatamente neste formato (texto puro, sem markdown e sem JSON):',
  'CARTÃO DO BARALHO',
  'FRENTE: <pergunta curta e objetiva sobre exatamente o ponto que eu errei>',
  'VERSO: <resposta completa em 2–4 linhas, com o detalhe que me fez errar>',
].join('\n');

export interface TutorCard {
  front: string;
  back: string;
}

const FRONT_MAX = 300;
const BACK_MAX = 600;
/** Máximo de cartões por mensagem — defesa contra loop de geração infinita. */
const CARDS_PER_MESSAGE_MAX = 8;

/** Limpa a linha para detecção: remove markdown (**, `, #) e espaços. */
function stripMd(line: string): string {
  return line
    .replace(/[*`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFront(line: string): boolean {
  return /^frente\s*:/i.test(stripMd(line));
}

function isVerso(line: string): boolean {
  return /^verso\s*:/i.test(stripMd(line));
}

/** Cabeçalho opcional que DELIMITA um cartão ("CARTÃO 2", "Cartão do baralho"...). */
function isCardHeader(line: string): boolean {
  return /^cart(?:ão|ao)s?\s*(?:do\s*baralho)?\s*(?:\d+)?\s*:?\s*$/i.test(stripMd(line));
}

/** Extração de uma linha "RÓTULO: conteúdo" (mantém acentos do conteúdo). */
function labelValue(line: string): string {
  const m = /^(?:frente|verso)\s*:\s*(.+)$/i.exec(stripMd(line));
  return (m?.[1] ?? '').trim();
}

function clean(content: string, max: number): string {
  const t = content.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function isValidPair(c: TutorCard): boolean {
  // 4+ chars evita linhas vazias/placeholder; sem teto aqui (clean já limitou).
  return c.front.length >= 4 && c.back.length >= 4;
}

/**
 * Parser principal: varre linha a linha um bloco
 *   CARTÃO DO BARALHO
 *   FRENTE: ...
 *   VERSO: ...
 * O VERSO aceita 2–4 linhas (paradas por linha em branco, novo FRENTE/CARTÃO
 * ou fim da mensagem) — o que vem DEPOIS do cartão (prosa normal) não vira
 * parte do verso.
 */
export function parseTutorCards(content: string): TutorCard[] {
  if (!content) return [];
  const lines = content.split('\n');
  const cards: TutorCard[] = [];
  let front = '';
  let back: string[] = [];
  let phase: 'none' | 'front' | 'back' = 'none';

  const flush = () => {
    if (phase === 'back' && front) {
      const card = { front: clean(front, FRONT_MAX), back: clean(back.join(' '), BACK_MAX) };
      if (isValidPair(card)) cards.push(card);
    }
    front = '';
    back = [];
    phase = 'none';
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (isFront(line)) {
      flush();
      front = labelValue(line);
      phase = front ? 'front' : 'none';
    } else if (isVerso(line) && (phase === 'front' || phase === 'back')) {
      back = [labelValue(line)];
      phase = 'back';
    } else if (phase === 'front' && line.trim()) {
      // FRENTE de múltiplas linhas: junta na mesma pergunta.
      front += ' ' + stripMd(line);
      phase = front.trim() ? 'front' : 'none';
    } else if (phase === 'back') {
      if (!line.trim() || isCardHeader(line)) flush(); // parágrafo/novo cartão encerra o verso
      else back.push(stripMd(line));
    } else if (isCardHeader(line)) {
      flush();
    }
    if (cards.length >= CARDS_PER_MESSAGE_MAX) break;
  }
  flush();

  return cards;
}

/** Fallback: bloco JSON [{front, back}] — formato do mode:'flashcards' do Método. */
function parseCardsJSON(content: string): TutorCard[] | null {
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) return null;
    const cards = arr
      .map((c) => {
        const o = c as { front?: unknown; back?: unknown };
        const front = typeof o.front === 'string' ? o.front.trim() : '';
        const back = typeof o.back === 'string' ? o.back.trim() : '';
        return front && back
          ? { front: clean(front, FRONT_MAX), back: clean(back, BACK_MAX) }
          : null;
      })
      .filter((c): c is TutorCard => !!c);
    return cards.length ? cards.slice(0, CARDS_PER_MESSAGE_MAX) : null;
  } catch {
    return null;
  }
}

/**
 * API única usada pelo TutorMarkdown: extrai cartões de uma resposta do
 * tutor. Prioriza o formato FRENTE/VERSO; se a resposta veio em JSON (Método),
 * usa o fallback. Nunca inventa: só retorna pares completos.
 */
export function extractTutorCards(content: string): TutorCard[] {
  const parsed = parseTutorCards(content);
  if (parsed.length > 0) return parsed;
  return parseCardsJSON(content) ?? [];
}

/** Cartão IA pronto para o baralho — mesma forma do Método (source 'ia'). */
export function makeIaCard(disciplineCode: string, front: string, back: string): Omit<Flashcard, 'id'> {
  const now = new Date().toISOString();
  return {
    disciplineCode,
    front: front.slice(0, FRONT_MAX),
    back: back.slice(0, BACK_MAX),
    source: 'ia',
    createdAt: now,
    box: 0,
    dueAt: now,
    reviews: 0,
    lapses: 0,
  };
}
