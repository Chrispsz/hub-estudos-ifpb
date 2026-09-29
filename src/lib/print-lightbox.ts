/**
 * print-lightbox.ts — o print que se lê de novo (t160).
 *
 * Os prints anexados ao tutor nascem pequenos: a bolha segura o `<img>` em
 * max-h-40/44 e o chip pendente é uma miniatura de 40–48px. Fórmula, enunciado
 * e número de questão ficam ilegíveis — e é EXATAMENTE o que o aluno precisa
 * conferir: "o recorte pegou a questão certa? a fórmula está legível? é ESTE
 * print que vai para a IA?". O lightbox devolve a leitura em tamanho grande,
 * na VIVA da memória (data URL que já existia) — nenhum byte novo é salvo,
 * nenhum upload, nenhum download: só VISÃO.
 *
 * Lib pura: o ciclo de zoom e a largura honesta por modo moram aqui para
 * serem testados sem DOM (a casa manda: lib pura + contratos).
 */

export type PrintZoom = 'fit' | '1x' | '2x';

/** O ciclo do clique na imagem: ajustada → real → 2× → ajustada. */
export function nextPrintZoom(mode: PrintZoom): PrintZoom {
  if (mode === 'fit') return '1x';
  if (mode === '1x') return '2x';
  return 'fit';
}

/**
 * Largura de layout do `<img>` no modo atual, em px de verdade.
 * `fit` não impõe largura (o CSS segura: max-h/max-w) → null.
 * `1x` usa a largura NATURAL da imagem; `2x` dobra — com width de layout
 * (não transform:scale) a rolagem acompanha o zoom e o canto direito é
 * alcançável de verdade. Natural ausente (imagem ainda decodificando) →
 * null, o modo cai no fit sem quebrar.
 */
export function scaledPrintWidth(
  natural: { width: number } | null | undefined,
  mode: PrintZoom,
): number | null {
  if (!natural || natural.width <= 0) return null;
  if (mode === 'fit') return null;
  if (mode === '1x') return Math.round(natural.width);
  return Math.round(natural.width * 2);
}

/** Rótulo do modo — a rodapé do lightbox diz em que zoom o aluno está. */
export const PRINT_ZOOM_LABEL: Record<PrintZoom, string> = {
  fit: 'Ajustada à tela',
  '1x': 'Tamanho real',
  '2x': 'Zoom 2×',
};

/** Alt fixo dos prints no visualizador (a mesma voz das bolhas e chips). */
export const PRINT_LIGHTBOX_ALT = 'Print anexado à dúvida — visualização em tamanho grande';

/** A dica do rodapé: o gesto inteiro em uma frase. */
export const PRINT_LIGHTBOX_HINT = 'Clique na imagem para alternar o zoom · Esc fecha';
