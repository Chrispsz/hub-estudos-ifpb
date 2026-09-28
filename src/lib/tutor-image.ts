// tutor-image — util compartilhado para anexar prints/fotos ao Tutor IA.
// A imagem é reduzida no próprio navegador (canvas) antes de virar data URL:
// mantém a legibilidade para o modelo de visão e o payload do POST enxuto
// (prints de 3-6 MB caem para ~150-400 KB sem perder texto).

/** Régua compartilhada: maior lado e qualidade JPEG — mesma dos prints anexados. */
const MAX_EDGE = 1400; // maior lado — suficiente para OCR de questão em folha/tela
const JPEG_QUALITY = 0.85;

/** Desenha qualquer fonte de pixels num canvas já reduzido (max MAX_EDGE). */
function scaledCanvas(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  ctx.drawImage(source, 0, 0, cw, ch);
  return canvas;
}

/** Converte um File de imagem em data URL JPEG reduzido (max 1400px no maior lado). */
export function downscaleImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = scaledCanvas(img, img.naturalWidth, img.naturalHeight);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('falha ao processar imagem'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('formato de imagem não suportado'));
    };
    img.src = url;
  });
}

/**
 * Converte um canvas (ex.: recorte da captura de tela) no MESMO formato que um
 * print anexado teria: JPEG reduzido a 1400px — a IA vê captura e arquivo com
 * qualidade idêntica e o payload do POST segue enxuto.
 */
export function downscaleCanvas(source: HTMLCanvasElement): string {
  if (!source.width || !source.height) throw new Error('canvas vazio');
  return scaledCanvas(source, source.width, source.height).toDataURL(
    'image/jpeg',
    JPEG_QUALITY,
  );
}

/** Extrai o primeiro arquivo de imagem de um evento de colar (Ctrl+V). */
export function imageFromClipboard(e: React.ClipboardEvent): File | null {
  const files = e.clipboardData?.files;
  if (!files) return null;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.type.startsWith('image/')) return f;
  }
  return null;
}
