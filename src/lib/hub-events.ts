/**
 * Eventos globais do Hub (padrão CustomEvent — evita prop drilling entre
 * componentes distantes, igual ao OPEN_PALETTE_EVENT do command-palette).
 */

export const OPEN_METHOD_EVENT = 'hub:open-method';

export interface OpenMethodDetail {
  /** Código da disciplina para pré-selecionar na sessão guiada. */
  disciplineCode?: string;
  /** id do material (course-data) para abrir na sessão. */
  materialId?: string;
  /** Tema inicial da sessão (pré-preenche o campo "Tema"). */
  topic?: string;
}

/** Dispara a abertura da aba Método com a sessão pré-configurada. */
export function openMethod(detail: OpenMethodDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenMethodDetail>(OPEN_METHOD_EVENT, { detail }));
}

export const OPEN_SIMULADO_EVENT = 'hub:open-simulado';

export interface OpenSimuladoDetail {
  /** Código da disciplina para pré-selecionar. */
  disciplineCode?: string;
  /** Presets especiais (ex.: 'math_exam' = prova de Matemática 01/10). */
  preset?: 'math_exam';
}

/** Dispara a troca para a aba Praticar com o Simulado Pro já configurado. */
export function openSimulado(detail: OpenSimuladoDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenSimuladoDetail>(OPEN_SIMULADO_EVENT, { detail }));
}

export const OPEN_PRACTICE_EVENT = 'hub:open-practice';

export interface OpenPracticeDetail {
  /** Disciplina para pré-filtrar a lista de exercícios. */
  disciplineCode?: string;
}

/** Dispara a troca para a aba Praticar com o filtro de disciplina aplicado. */
export function openPractice(detail: OpenPracticeDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenPracticeDetail>(OPEN_PRACTICE_EVENT, { detail }));
}
