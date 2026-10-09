/**
 * A RECITAÇÃO QUE VÊ O TRAVO (t177) — helpers PURAS da rodada de recitação
 * de fórmulas no diálogo do Kit da Véspera.
 *
 * A linha do kit sempre prometeu ("se travar numa, é só ela que você relê
 * antes de dormir") — mas o diálogo só mostrava a lista: ele não sabia DIZER
 * em qual fórmula o dono travou. A rodada de recitação fecha a promessa:
 *
 *  1. MODO RECITAÇÃO: as caixas com fórmula real nascem ocultas (o mesmo
 *     gesto da folha de revisão, agora na tela do kit) e o toque revela;
 *  2. "TRAVEI NESTA": revelada, a caixa pode ser marcada — o travo vira
 *     dado, não memória de caneta;
 *  3. RECIBO: rodada completa grava { date, total, stuck[] } no storage (a
 *     fiação do storage vive no COMPONENTE — aqui só forma e regra, a
 *     doutrina da casa para helpers executáveis em teste);
 *
 * Fronteiras honestas (a mesma gramática do composer-draft t176 e do espelho
 * de travadas): reveladas/travadas são estado de TELA (recarregou, a rodada
 * recomeça — confessado no title do toggle); o RECIBO é o que sobrevive, um
 * por dia (a última rodada completa do dia vence).
 *
 * Doutrina: SEM DOM/storage/fetch aqui — regra pura executável (a fiação
 * entra no contrato t177 greppando o componente).
 */

import { MATH_FORMULAS, type FormulaCard } from './math-exam-prep';

/** Chave no localStorage do recibo diário da recitação (família v1 do exame). */
export const MATH_RECITE_KEY = 'hub:math-exam:v1:recite';

/** Recibo da rodada completa — o que o Kit lê no dia seguinte. */
export interface ReciteReceipt {
  v: 1;
  /** 'YYYY-MM-DD' no fuso do ALUNO (a recitação é perguntada no navegador). */
  date: string;
  /** Total de caixas recitáveis da rodada — sempre da FONTE, nunca o mapa. */
  total: number;
  /** Títulos marcados "travei nesta" (na ordem da fonte, não da marcação). */
  stuck: string[];
}

/**
 * Recitável = caixa com fórmula real (math[] não vazio). A caixa 'PÓS-PROVA:
 * determinantes e sistemas' NÃO tem fórmula — nada a ocultar, nada a recitar:
 * ela permanece visível na rodada (é aviso, não conteúdo de prova).
 */
export function isRecitable(f: FormulaCard): boolean {
  return Array.isArray(f.math) && f.math.length > 0;
}

/** As recitáveis, na ordem da fonte (a ordem que o aluno recita). */
export function recitableFormulas(formulas: FormulaCard[]): FormulaCard[] {
  return formulas.filter(isRecitable);
}

/** Contagem da FONTE — o contador da tela tem que bater com os botões (lição 105). */
export function recitableCount(formulas: FormulaCard[]): number {
  return recitableFormulas(formulas).length;
}

/**
 * Progresso da rodada a partir do mapa de reveladas. total <= 0 → nada
 * recitável: allRevealed false (uma rodada vazia não é "completa" — não
 * existe recibo de rodada que não existiu).
 */
export function reciteProgress(
  revealed: Record<string, boolean>,
  total: number,
): { revealedCount: number; hiddenCount: number; allRevealed: boolean } {
  const revealedCount = Object.values(revealed).filter(Boolean).length;
  const hiddenCount = Math.max(0, total - revealedCount);
  return {
    revealedCount,
    hiddenCount,
    allRevealed: total > 0 && revealedCount >= total,
  };
}

/** Marca/desmarca o travo SEM mutar o mapa anterior (cópia defensiva, t176). */
export function toggleStuck(
  stuck: Record<string, boolean>,
  key: string,
): Record<string, boolean> {
  const next = { ...stuck };
  if (next[key]) delete next[key];
  else next[key] = true;
  return next;
}

/**
 * Títulos travados na ORDEM DA FONTE (Matrizes → Lógica, a ordem do acervo):
 * a linha "relê antes de dormir" não embaralha quando o dono marca fora de
 * ordem. Chave do mapa é o titulo (a MESMA chave do Card na grade).
 */
export function stuckTitles(
  stuck: Record<string, boolean>,
  formulas: FormulaCard[],
): string[] {
  return formulas.filter((f) => stuck[f.titulo] === true).map((f) => f.titulo);
}

/** Quantos travaram — a voz do badge do kit. */
export function stuckCount(stuck: Record<string, boolean>): number {
  return Object.values(stuck).filter(Boolean).length;
}

/** 'YYYY-MM-DD' com getters LOCAIS (a folha usa o mesmo contrato — a data é a do navegador do aluno, nunca a do servidor). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Defesa de leitura: lixo/corrompido/parcial volta null — recibo NUNCA é
 * inventado (o kit prefere não mostrar badge a mostrar badge mentiroso).
 */
export function normalizeReciteReceipt(raw: unknown): ReciteReceipt | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
  if (typeof r.total !== 'number' || !Number.isFinite(r.total) || r.total <= 0) return null;
  if (!Array.isArray(r.stuck) || r.stuck.some((s) => typeof s !== 'string')) return null;
  return { v: 1, date: r.date, total: r.total, stuck: r.stuck as string[] };
}

/** O recibo é DE HOJE? (chave local comparada com chave local — dia virou é outro dia). */
export function receiptIsToday(receipt: ReciteReceipt | null, todayKey: string): boolean {
  return !!receipt && !!todayKey && receipt.date === todayKey;
}

/**
 * Recibo da rodada completa. total sempre o da FONTE (o mapa de reveladas
 * não é fonte de total — é fonte de progresso); stuck na ordem da fonte.
 */
export function buildReceipt(
  date: string,
  total: number,
  stuck: Record<string, boolean>,
  formulas: FormulaCard[],
): ReciteReceipt {
  return { v: 1, date, total, stuck: stuckTitles(stuck, formulas) };
}

/**
 * Comparação estrutural de recibos — evita regravar o MESMO recibo a cada
 * re-render da rodada completa (o efeito roda em revealed+stuck; sem esta
 * guarda, o storage escreveria no mesmo tick repetidamente).
 */
export function sameReceipt(a: ReciteReceipt | null, b: ReciteReceipt): boolean {
  if (!a) return false;
  return a.date === b.date && a.total === b.total && a.stuck.join('\u0000') === b.stuck.join('\u0000');
}

/**
 * O TOTAL DE HOJE é o total real da rodada salva — se a FONTE crescer
 * (fórmula nova nos materiais) o recibo antigo continua honesto: ele diz o
 * total DAQUELE dia. O badge do kit não inventa "%" nem compara totais de
 * dias diferentes (recito 11 ontem, 12 hoje — dois recibos, duas verdades).
 */
export function receiptBadgeText(receipt: ReciteReceipt): string {
  const n = receipt.stuck.length;
  return n === 0 ? 'recitou hoje' : `recitou hoje · ${n} ${n === 1 ? 'travou' : 'travaram'}`;
}

// ---------------------------------------------------------------------------
// t178 — A FOLHA QUE LÊ A NOITE: o recibo chega ao papel.
//
// A promessa da linha do kit ("é só ela que você relê antes de dormir")
// fechava na TELA (badge + subNode nomeado) — mas a folha impressa da
// véspera, que é o papel que vai na mochila, não sabia em QUE fórmula o
// dono travou na noite anterior. Os helpers abaixo são a mesma regra pura
// da rodada, agora a serviço do papel: qual recibo, de que dia, quais
// caixas marcar. NADA aqui inventa recibo — folha sem dado é folha calma.
// ---------------------------------------------------------------------------

/**
 * Chave de dia deslocada — hoje menos N dias, no MESMO contrato da
 * localDateKey (getters locais; a data é a do navegador do aluno). O parse
 * é ancorado no MEIO-DIA local (lição 108 no papel): date-only parseado
 * direto é meia-noite UTC e, em fuso negativo, vira o dia ANTERIOR —
 * 'ontem' diria 'anteontem' à noite. Dia do mês nasce por SUBTRAÇÃO de
 * Date (atravessa mês e ano sem aritmética de string).
 */
export function dayKeyMinus(todayKey: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayKey)) return '';
  const anchor = new Date(`${todayKey}T12:00:00`);
  if (Number.isNaN(anchor.getTime())) return '';
  anchor.setDate(anchor.getDate() - days);
  return localDateKey(anchor);
}

/**
 * O CONJUNTO dos travos do recibo — Set para a folha marcar caixa a caixa
 * em O(1) (a folha não percorre o array por fórmula). Recibo null → Set
 * vazio: sem recibo, nenhuma caixa nasce marcada (nada inventado).
 */
export function receiptStuckSet(receipt: ReciteReceipt | null): Set<string> {
  return new Set(receipt?.stuck ?? []);
}

/**
 * A VOZ DO DIA NO PAPEL: o recibo diz quando a recitação aconteceu —
 * 'hoje à noite' (recibo de hoje: a rodada foi antes de imprimir),
 * 'ontem à noite' (o caso clássico da véspera: recitou, dormiu, imprime
 * de manhã) ou 'recitação de dd/mm' (o dia virou várias vezes — o papel
 * mostra a data e o leitor julga). Entrada inválida → '' (a folha cala;
 * sem legenda mentirosa).
 */
export function receiptDayLabel(receipt: ReciteReceipt | null, todayKey: string): string {
  if (!receipt || !todayKey) return '';
  if (receipt.date === todayKey) return 'hoje à noite';
  if (receipt.date === dayKeyMinus(todayKey, 1)) return 'ontem à noite';
  const d = new Date(`${receipt.date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `recitação de ${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(d)}`;
}

/**
 * A LEGENDA DA FOLHA — uma linha, a voz do recibo no papel. Só existe com
 * travo REAL nomeado: recibo sem travo não entra na folha (o papel não
 * celebra silêncio — ele aponta o que reler); recibo de lixo também não.
 * A PREPOSIÇÃO acompanha o dia (a gramática não é opcional): "Hoje à
 * noite, …" / "Ontem à noite, …" / "Na recitação de 29/09, …". A numeração
 * (N) é a contagem dos travos.
 */
export function receiptLegendLine(receipt: ReciteReceipt | null, todayKey: string): string | null {
  if (!receipt || receipt.stuck.length === 0) return null;
  const n = receipt.stuck.length;
  const conta = `${n} ${n === 1 ? 'fórmula travou' : 'fórmulas travaram'}`;
  const cauda = ' — são as caixas marcadas; reler elas primeiro.';
  if (todayKey && receipt.date === todayKey) {
    return `Hoje à noite, ${conta}${cauda}`;
  }
  if (todayKey && receipt.date === dayKeyMinus(todayKey, 1)) {
    return `Ontem à noite, ${conta}${cauda}`;
  }
  const dia = receiptDayLabel(receipt, todayKey);
  if (!dia) return null;
  return `Na ${dia}, ${conta}${cauda}`;
}
