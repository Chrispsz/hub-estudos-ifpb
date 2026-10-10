// pdf-print — O PRINT QUE NASCE DO PDF (t175).
//
// O dono pediu: "o print deveria ser do pdf quando estou com um aberto, já
// pra evitar muitos recortes... ficar escolhendo aba, tela, fazendo recorte
// e etc" — sem perder a captura de tela livre para o que NÃO é o conteúdo.
// A via rápida ficou com UM clique: o painel do tutor renderiza a página
// ABERTA do PDF (pdf.js, nitidez 2×) e anexa direto — sem seletor do
// navegador, sem recorte, sem arquivo no disco (o canvas morre no envio).
//
// Este módulo guarda o QUE É PURA (rótulos, página honesta do print) e o
// QUE É DE NAVEGADOR (o render). As helpers puras não tocam em DOM, storage
// nem fetch — executáveis em teste; o render é a única parte impura e
// consome pdf.js igual ao diálogo de precisão (pdf-page-capture-dialog).

import { clampPdfPage } from './pdf-search';

// ===== PARTE PURA (sem DOM/storage/fetch) =====

/**
 * O título curto do material: a parte antes do primeiro travessão OU hífen
 * ("Lista de Matrizes — Bloco 1 (Q1–16)" → "Lista de Matrizes";
 * "Plano de Disciplina - Matemática" → "Plano de Disciplina"). A MESMA regra
 * que o diálogo de precisão usa no rótulo — fonte única, dois lugares, uma
 * verdade.
 */
export function shortMaterialTitle(title: string): string {
  return title.split(' — ')[0].split(' - ')[0].trim();
}

/**
 * O rótulo de procedência do print de página — o chip do tutor diz ONDE o
 * print nasceu ("página 3 · Lista de Matrizes"), a mesma voz do diálogo
 * de precisão (t163).
 */
export function pagePrintLabel(page: number, title: string): string {
  return `página ${page} · ${shortMaterialTitle(title)}`;
}

/**
 * A página que o print instantâneo usa — a HONESTA: só a página que o leitor
 * DESPACHOU (o último salto conhecido, prop pdfCurrentPage). Sem salto, o
 * leitor nativo abre na 1ª página — então 1 é a página vista, não um chute.
 * A memória de leitura (t161) NÃO entra de propósito: o convite de retomada
 * pode estar na tela sem ter sido aceito — printar a lembrança seria printar
 * página que não está na frente dos olhos. Fora do teto (PDF substituído por
 * versão menor): clampado, a doutrina do salto da t157.
 */
export function instantPrintPage(
  currentPage: number | null | undefined,
  maxPages?: number,
): number {
  const p = clampPdfPage(currentPage, maxPages);
  return p ?? 1;
}

// ===== PARTE DE NAVEGADOR (impura — pdf.js + canvas) =====

/**
 * Renderiza UMA página do PDF em canvas, na nitidez do diálogo de precisão:
 * largura-alvo × 2 (o OCR da visão lê números pequenos de lista). Abre o
 * documento, renderiza e DESTROI tudo na hora — o print instantâneo não
 * mantém doc vivo (o PDF volta do cache HTTP no próximo clique).
 */
export async function renderPdfPageToCanvas(
  pdfPath: string,
  page: number,
  targetWidth = 620,
  pixelRatio = 2,
): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const task = pdfjs.getDocument({ url: pdfPath });
  try {
    const doc = await task.promise;
    const n = instantPrintPage(page);
    const pdfPage = await doc.getPage(Math.min(n, doc.numPages));
    const base = pdfPage.getViewport({ scale: 1 });
    const scale = (targetWidth / base.width) * pixelRatio;
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await pdfPage.render({
      canvas,
      canvasContext: canvas.getContext('2d')!,
      viewport,
    }).promise;
    return canvas;
  } finally {
    try {
      void task.destroy?.();
    } catch {
      /* doc já morto */
    }
  }
}
