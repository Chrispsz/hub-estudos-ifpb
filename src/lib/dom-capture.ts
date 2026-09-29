// dom-capture — captura de um ELEMENTO da página para o Tutor IA.
//
// A terceira via da captura (139 = página exata do PDF; 138 = tela livre com
// recorte): superfícies DOM do próprio Hub — a lista de assuntos do diálogo da
// disciplina, o resumo IA — viram imagem e entram DIRETO no chat, sem o aluno
// tirar print do sistema operacional. Nada toca o disco: o data URL vive só no
// estado do chat e some com o envio (a mesma vida dos prints colados).
//
// html-to-image clona o nó e inlinha os estilos computados — oklch do Tailwind
// v4 é desenhado pelo próprio navegador, sem lib de cores. pixelRatio 2 preserva
// texto pequeno (o OCR da visão lê melhor); depois o JPEG passa pela MESMA
// régua dos prints (1400px) para o payload seguir enxuto.

import { toPng } from 'html-to-image';
import { downscaleDataUrl } from '@/lib/tutor-image';

export async function captureElementToDataUrl(el: HTMLElement): Promise<string> {
  const png = await toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    // elementos marcados com data-capture-skip saem da foto (controles que não
    // fazem sentido na conversa com o tutor — ex.: o próprio botão de capturar)
    filter: (node) =>
      !(node instanceof HTMLElement && node.dataset?.captureSkip === 'true'),
  });
  return downscaleDataUrl(png);
}
