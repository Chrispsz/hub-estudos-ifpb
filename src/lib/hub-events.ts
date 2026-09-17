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
