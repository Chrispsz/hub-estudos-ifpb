// screen-capture — captura de tela DENTRO do site que se auto-anexa ao Tutor
// e se auto-apaga (pedido do dono, 28/09: "que se auto anexe e se auto apague,
// pois eu fazendo manualmente pelo sistema vai sujar minha pasta de prints").
//
// Como funciona: getDisplayMedia (a MESMA API do compartilhar-tela do Meet) →
// 1 frame → canvas em memória → os tracks param NO ATO → o recorte vira data
// URL no estado do chat → some quando a mensagem é enviada. NADA toca o disco:
// não existe arquivo na Pasta de Imagens, não existe download, não existe
// persistência — a única cópia é a bolha da conversa.

import * as React from 'react';
import { toast } from 'sonner';

/** Erros classificados da captura — a UI responde diferente a cada motivo. */
export type ScreenCaptureFail =
  | 'unsupported' // navegador sem getDisplayMedia (mobile Safari, Firefox antigo)
  | 'cancelled' // usuário fechou o seletor do navegador (Esc) — silencioso
  | 'failed'; // stream abriu mas morreu antes do frame

export class ScreenCaptureError extends Error {
  constructor(public reason: ScreenCaptureFail) {
    super(reason);
    this.name = 'ScreenCaptureError';
  }
}

/** true quando o navegador da sessão consegue capturar a tela. */
export function screenCaptureSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}

// ===== Assentamento medido (t163; a régua fixa da t152 cresceu) =====
const SETTLE_MIN_MS = 440; // a régua da t152 continua sendo o MÍNIMO (t175: +60ms de folga para a morte do seletor)
const SETTLE_STEP_MS = 140; // intervalo entre amostras de comparação
const SETTLE_MAX_SAMPLES = 8; // teto ~1.4s: superfície viva não prende a captura

/**
 * Duas amostras da superfície são IGUAIS? (comparação inteira de 32 bits —
 * um único pixel diferente já diz que a tela ainda se move).
 */
export function framesEqual(a: Uint32Array, b: Uint32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Espera a superfície capturada ASSENTAR antes de congelar o frame. O seletor
 * do navegador ("Choose what to share") morre DEPOIS que o stream começa —
 * nos primeiros frames ele ainda está assado na superfície capturada (a
 * reclamação do dono com print, t152). Em vez de confiar num tempo fixo,
 * amostra uma miniatura da transmissão a cada 140ms e devolve o controle
 * quando DUAS amostras seguidas são idênticas — a tela provou que parou de
 * mudar. Nunca antes de 380ms (a régua da t152); nunca depois de ~1.4s
 * (conteúdo vivo — vídeo/animação — não prende a captura: colhe o último).
 * Leitura de pixels indisponível (canvas taint etc.) = régua fixa cobre.
 */
async function settleScreenSurface(video: HTMLVideoElement): Promise<void> {
  let sampled = false;
  try {
    // t175: 160px de comparação (eram 96) — um seletor morrendo em fade deixa
    // de passar despercebido na miniatura: quanto maior a amostra, menor o
    // delta que ainda conta como "a tela está se movendo".
    const cw = 160;
    const ch = Math.max(
      1,
      Math.round((cw * video.videoHeight) / Math.max(1, video.videoWidth)),
    );
    const cmp = document.createElement('canvas');
    cmp.width = cw;
    cmp.height = ch;
    const cctx = cmp.getContext('2d', { willReadFrequently: true });
    if (!cctx) throw new Error('sem contexto de comparação');
    let prev: Uint32Array | null = null;
    for (let i = 0; i < SETTLE_MAX_SAMPLES; i++) {
      await new Promise<void>((r) =>
        setTimeout(r, i === 0 ? SETTLE_MIN_MS : SETTLE_STEP_MS),
      );
      cctx.drawImage(video, 0, 0, cw, ch);
      const cur = new Uint32Array(cctx.getImageData(0, 0, cw, ch).data.buffer);
      if (prev && framesEqual(prev, cur)) return; // parou de mudar — assentou
      prev = cur;
      sampled = true;
    }
  } catch {
    // Sem leitura de pixels: a régua fixa da t152 cobre o caso.
    if (!sampled) {
      await new Promise<void>((r) => setTimeout(r, SETTLE_MIN_MS));
    }
  }
}

/**
 * Hook compartilhado das duas superfícies do tutor (chat da aba Estudar +
 * painel rápido dos diálogos). Cuida do ciclo de vida da captura COM a
 * escapadela que o seletor nativo exige: getDisplayMedia NÃO é cancelável
 * via JS — se o seletor não aparece (automação, aba em segundo plano) a
 * promessa pode ficar pendente para sempre. O 2º clique no botão = desistir:
 * a UI se solta na hora e a tentativa pendente é descartada quando (se) voltar.
 */
export function useScreenCapture(onCanvas: (canvas: HTMLCanvasElement) => void) {
  const [capturing, setCapturing] = React.useState(false);
  const attemptRef = React.useRef(0);

  const startCapture = React.useCallback(async () => {
    if (capturing) {
      // DESISTIR: solta a UI; a promessa pendente vira no-op pelo attemptRef.
      attemptRef.current++;
      setCapturing(false);
      toast.info('Captura liberada — clique de novo para tentar outra vez.');
      return;
    }
    setCapturing(true);
    const attempt = ++attemptRef.current;
    try {
      const canvas = await captureScreenFrame();
      if (attempt !== attemptRef.current) return; // desistiu enquanto isso
      onCanvas(canvas);
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      if (err instanceof ScreenCaptureError) {
        if (err.reason === 'unsupported') {
          toast.error(
            screenCaptureSupported()
              ? 'Não consegui capturar agora. Use o anexo de print (Ctrl+V).'
              : 'Este navegador não suporta captura de tela — anexe o print (Ctrl+V).',
          );
        } else if (err.reason === 'cancelled') {
          toast.info('Captura cancelada.');
        } else {
          toast.error('Não consegui capturar a tela. Tente de novo.');
        }
      } else {
        toast.error('Não consegui capturar a tela. Tente de novo.');
      }
    } finally {
      if (attempt === attemptRef.current) setCapturing(false);
    }
  }, [capturing, onCanvas]);

  return { capturing, startCapture };
}

/**
 * Pede a tela ao navegador, captura UM frame em resolução NATIVA e encerra
 * a transmissão na hora (o indicador de compartilhamento apaga sozinho).
 * Retorna o canvas bruto — o recorte acontece sobre ele sem perder pixels.
 */
export async function captureScreenFrame(): Promise<HTMLCanvasElement> {
  if (!screenCaptureSupported()) throw new ScreenCaptureError('unsupported');

  let stream: MediaStream | null = null;
  try {
    // cursor: o ponteiro do aluno ajuda a IA a entender onde ele estava olhando
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
      // cursor existe na spec (e no Chrome) — o lib.dom já o tipa hoje
      cursor: 'always',
    } as DisplayMediaStreamOptions);
  } catch (err) {
    // NotAllowedError/AbortError = o aluno cancelou o seletor (não é bug)
    if (
      err instanceof DOMException &&
      (err.name === 'NotAllowedError' || err.name === 'AbortError')
    ) {
      throw new ScreenCaptureError('cancelled');
    }
    throw new ScreenCaptureError('failed');
  }

  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    // O frame só existe depois do primeiro pixel decodificado.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 8_000);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      if (video.readyState >= 2) return done();
      video.onloadedmetadata = () => {
        void video.play().then(done, () => reject(new Error('play')));
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('video'));
      };
    });
    // Dois RAFs garantem que o frame atual já está no buffer de apresentação.
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error('sem sinal de vídeo');

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponível');

    // Assentamento (t152 → t163, reclamação do dono com print): o SELETOR do
    // navegador morre DEPOIS que o stream começa — nos primeiros frames a
    // superfície capturada ainda carrega o próprio seletor ("Choose what to
    // share") congelado na imagem. Um 1º draw só aquece o decode; o frame
    // VERDADEIRO é colhido quando a superfície PROVA que parou de mudar
    // (settleScreenSurface: duas amostras seguidas idênticas, mínimo 380ms).
    ctx.drawImage(video, 0, 0, w, h);
    await settleScreenSurface(video);
    ctx.drawImage(video, 0, 0, w, h);
    return canvas;
  } catch {
    throw new ScreenCaptureError('failed');
  } finally {
    // O AUTO-APAGAR COMEÇA AQUI: a transmissão não fica aberta nem 1ms além
    // do necessário — sem tracks vivos, o navegador encerra o compartilhamento.
    stream.getTracks().forEach((t) => t.stop());
  }
}
