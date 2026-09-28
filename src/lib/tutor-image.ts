// tutor-image — util compartilhado para anexar prints/fotos ao Tutor IA.
// A imagem é reduzida no próprio navegador (canvas) antes de virar data URL:
// mantém a legibilidade para o modelo de visão e o payload do POST enxuto
// (prints de 3-6 MB caem para ~150-400 KB sem perder texto).

const MAX_EDGE = 1400; // maior lado — suficiente para OCR de questão em folha/tela
const JPEG_QUALITY = 0.85;

/** Converte um File de imagem em data URL JPEG reduzido (max 1400px no maior lado). */
export function downscaleImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas indisponível'));
        ctx.drawImage(img, 0, 0, w, h);
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
