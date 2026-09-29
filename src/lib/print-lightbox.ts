/**
 * print-lightbox.ts — o print que se lê de novo (t160 · t166).
 *
 * Os prints anexados ao tutor nascem pequenos: a bolha segura o `<img>` em
 * max-h-40/44 e o chip pendente é uma miniatura de 40–48px. Fórmula, enunciado
 * e número de questão ficam ilegíveis — e é EXATAMENTE o que o aluno precisa
 * conferir: "o recorte pegou a questão certa? a fórmula está legível? é ESTE
 * print que vai para a IA?". O lightbox devolve a leitura em tamanho grande,
 * na VIVA da memória (data URL que já existia) — nenhum byte novo é salvo,
 * nenhum upload, nenhum download: só VISÃO.
 *
 * t166 — O PRINT QUE SE DEIXA LER: o ciclo de zoom deixou de ser um segredo
 * de clique — controles explícitos (− · % · + · Ajustar), teclado (+/−/0) e
 * o gesto de ARRASTAR para navegar no zoom alto. O degrau 3× nasce para os
 * recortes pequenos: um recorte de 400px num enunciado denso pede mais que
 * 2×. E o lightbox agora diz de ONDE o print veio (o rótulo de procedência
 * da t163 mora no título quando a superfície que abriu o sabe).
 *
 * Lib pura: o ciclo de zoom e a largura honesta por modo moram aqui para
 * serem testados sem DOM (a casa manda: lib pura + contratos).
 */

export type PrintZoom = 'fit' | '1x' | '2x' | '3x';

/** O ciclo do clique na imagem: ajustada → real → 2× → 3× → ajustada. */
export function nextPrintZoom(mode: PrintZoom): PrintZoom {
  if (mode === 'fit') return '1x';
  if (mode === '1x') return '2x';
  if (mode === '2x') return '3x';
  return 'fit';
}

/** O botão + (e a tecla +): um degrau por vez, com teto honesto no 3×. */
export function zoomIn(mode: PrintZoom): PrintZoom {
  if (mode === 'fit') return '1x';
  if (mode === '1x') return '2x';
  return '3x';
}

/** O botão − (e a tecla −): um degrau por vez, com chão honesto no fit. */
export function zoomOut(mode: PrintZoom): PrintZoom {
  if (mode === '3x') return '2x';
  if (mode === '2x') return '1x';
  return 'fit';
}

/**
 * Largura de layout do `<img>` no modo atual, em px de verdade.
 * `fit` não impõe largura (o CSS segura: max-h/max-w) → null.
 * `1x`/`2x`/`3x` usam a largura NATURAL multiplicada — com width de layout
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
  const factor = mode === '1x' ? 1 : mode === '2x' ? 2 : 3;
  return Math.round(natural.width * factor);
}

/**
 * A porcentagem de zoom que o controle do cabeçalho mostra.
 * `fit` depende do espaço da tela (o CSS decide) → null; os demais são a
 * própria escala sobre a natural (100/200/300). Natural ausente → null.
 */
export function printZoomPercent(
  natural: { width: number } | null | undefined,
  mode: PrintZoom,
): number | null {
  if (!natural || natural.width <= 0) return null;
  if (mode === 'fit') return null;
  if (mode === '1x') return 100;
  if (mode === '2x') return 200;
  return 300;
}

/** "1240 × 1753 px" — as dimensões reais do print, para o rodapé honesto. */
export function formatPrintDimensions(
  natural: { width: number; height: number } | null | undefined,
): string | null {
  if (!natural || natural.width <= 0 || natural.height <= 0) return null;
  return `${natural.width} × ${natural.height} px`;
}

/**
 * O teclado do lightbox (t166): +/= aproximam, −/_ afastam, 0 ajusta.
 * Qualquer outra tecla → null (o dialog ignora; Esc continua sendo do
 * próprio Radix).
 */
export function printZoomKeyTo(key: string): 'in' | 'out' | 'fit' | null {
  if (key === '+' || key === '=') return 'in';
  if (key === '-' || key === '_') return 'out';
  if (key === '0') return 'fit';
  return null;
}

/** O gesto de arrastar só vira navegação depois do limiar (px) — abaixo disso é clique. */
export const PRINT_PAN_THRESHOLD_PX = 5;

/**
 * O arrasto passou do limiar? dx/dy em px desde o pointerdown. Só um eixo
 * precisa passar — diagonais curtas contam, e o movimento puro vertical da
 * roda (sem botão) nem chega aqui.
 */
export function isPrintPanGesture(dx: number, dy: number, threshold = PRINT_PAN_THRESHOLD_PX): boolean {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (!Number.isFinite(adx) || !Number.isFinite(ady)) return false;
  return adx >= threshold || ady >= threshold;
}

/** Rótulo do modo — o controle do cabeçalho diz em que zoom o aluno está. */
export const PRINT_ZOOM_LABEL: Record<PrintZoom, string> = {
  fit: 'Ajustada à tela',
  '1x': 'Tamanho real',
  '2x': 'Zoom 2×',
  '3x': 'Zoom 3×',
};

/** Alt fixo dos prints no visualizador (a mesma voz das bolhas e chips). */
export const PRINT_LIGHTBOX_ALT = 'Print anexado à dúvida — visualização em tamanho grande';

/**
 * O título do lightbox quando a superfície que abriu NÃO sabe o rótulo de
 * procedência (a bolha enviada não carrega rótulo — doutrina t163: o rótulo
 * vive no chip pendente; mudar a bolha é schema da mensagem).
 */
export const PRINT_LIGHTBOX_FALLBACK_TITLE = 'Print anexado à dúvida';

/** A dica do diálogo: o gesto inteiro em uma frase (agora com os controles). */
export const PRINT_LIGHTBOX_HINT = 'Clique na imagem ou use − / + para alternar o zoom · arraste para navegar · Esc fecha';
