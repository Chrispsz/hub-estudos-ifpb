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
import {
  SETTLE_MAX_SAMPLES,
  SETTLE_SAMPLE_PX,
  TIDY_SECONDS,
  TIDY_TOTAL_MS,
  nextSettleStreak,
  settleDelayMs,
  settleDone,
  tidySecondsLeft,
  type CapturePhase,
} from '@/lib/capture-clean';

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

// ===== Assentamento (t181): a JANELA DE ARRUMAÇÃO + a RÉGUA v3 moram na
// lib PURA capture-clean.ts — tempos, trilho de igualdades e o teto da
// superfície viva são DECISÃO (contrato t181); aqui é só a execução.

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
 * Espera a superfície capturada ASSENTAR antes de congelar o frame — a RÉGUA
 * v3 (t181): o aviso de arrumação já morreu (a janela garantida da lib), a
 * primeira amostra espera o PISO da régua (700ms — o seletor morre com folga
 * DEPOIS do aviso também), e o frame só congela quando TRÊS amostras seguidas
 * são idênticas em comparação de 240px. A reclamação do dono (t152 → 181): o
 * fade quase imperceptível do seletor enganava a régua de 2 — um diálogo
 * branco sumindo sobre conteúdo branco muda pouquíssimos pixels; 3 seguidas
 * em amostra maior cobram 280ms de silêncio VISUAL de verdade. Teto ~2.3s:
 * conteúdo vivo (vídeo/animação) não prende a captura — colhe o último.
 * Leitura de pixels indisponível (canvas taint etc.) = o piso da régua cobre.
 */
async function settleScreenSurface(video: HTMLVideoElement): Promise<void> {
  let sampled = false;
  try {
    // t181: 240px de comparação (a v2 usava 160) — o fade que enganava a
    // régua antiga deixa rastro na amostra maior.
    const cw = SETTLE_SAMPLE_PX;
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
    let streak = 0;
    for (let i = 0; i < SETTLE_MAX_SAMPLES; i++) {
      await new Promise<void>((r) => setTimeout(r, settleDelayMs(i)));
      cctx.drawImage(video, 0, 0, cw, ch);
      const cur = new Uint32Array(cctx.getImageData(0, 0, cw, ch).data.buffer);
      if (prev) {
        // t181: o trilho de igualdades é DECISÃO da lib pura — 3 seguidas
        // declaram o assentamento; UMA diferença zera o trilho inteiro.
        streak = nextSettleStreak(framesEqual(prev, cur), streak);
        if (settleDone(streak)) return; // silêncio visual provado
      }
      prev = cur;
      sampled = true;
    }
  } catch {
    // Sem leitura de pixels: o piso da régua (a janela de arrumação + 700ms)
    // cobre o caso — o seletor morreu com folga garantida.
    if (!sampled) {
      await new Promise<void>((r) => setTimeout(r, settleDelayMs(0)));
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
 *
 * t181 — O AVISO DE ARRUMAÇÃO: a janela garantida da captura limpa passa
 * AQUI — `tidying` é a fase 'tidy' (o banner sobe: "a captura acontece
 * sozinha") e `tidySeconds` é a contagem honesta para o chip tabular. O
 * banner é renderizado pelo composable (CaptureTidyBanner) — a lib não
 * conhece DOM.
 */
export function useScreenCapture(onCanvas: (canvas: HTMLCanvasElement) => void) {
  const [capturing, setCapturing] = React.useState(false);
  /** t181: fase 'tidy' ativa — o banner de arrumação está de pé. */
  const [tidying, setTidying] = React.useState(false);
  /** t181: segundos que faltam no aviso (chip tabular do banner). */
  const [tidySeconds, setTidySeconds] = React.useState<number | null>(null);
  /** t181: o relógio do aviso — a contagem é HONESTA (tiquetaca real, não
   * número congelado) e morre no desistir, no fim e na desmontagem. */
  const tidyStartRef = React.useRef<number | null>(null);
  const tidyTickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTidyTick = React.useCallback(() => {
    if (tidyTickRef.current) {
      clearInterval(tidyTickRef.current);
      tidyTickRef.current = null;
    }
    tidyStartRef.current = null;
  }, []);
  // A desmontagem da superfície não deixa o relógio do aviso vivo para trás.
  React.useEffect(() => stopTidyTick, [stopTidyTick]);
  const attemptRef = React.useRef(0);

  const startCapture = React.useCallback(async () => {
    if (capturing) {
      // DESISTIR: solta a UI; a promessa pendente vira no-op pelo attemptRef.
      attemptRef.current++;
      setCapturing(false);
      setTidying(false);
      setTidySeconds(null);
      stopTidyTick();
      toast.info('Captura liberada — clique de novo para tentar outra vez.');
      return;
    }
    setCapturing(true);
    const attempt = ++attemptRef.current;
    try {
      const canvas = await captureScreenFrame((phase) => {
        if (attempt !== attemptRef.current) return; // desistiu enquanto isso
        if (phase === 'tidy') {
          setTidying(true);
          tidyStartRef.current = Date.now();
          setTidySeconds(TIDY_SECONDS);
          // A contagem do banner tiquetaca de verdade (250ms de passo — o
          // salto visível é de 1 em 1 segundo, o teto da lib manda).
          if (tidyTickRef.current) clearInterval(tidyTickRef.current);
          tidyTickRef.current = setInterval(() => {
            if (tidyStartRef.current !== null) {
              setTidySeconds(tidySecondsLeft(Date.now() - tidyStartRef.current));
            }
          }, 250);
        } else {
          setTidying(false);
          setTidySeconds(null);
          stopTidyTick();
        }
      });
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
      if (attempt === attemptRef.current) {
        setCapturing(false);
        setTidying(false);
        setTidySeconds(null);
        stopTidyTick();
      }
    }
  }, [capturing, onCanvas, stopTidyTick]);

  return { capturing, tidying, tidySeconds, startCapture };
}

/**
 * Pede a tela ao navegador, captura UM frame em resolução NATIVA e encerra
 * a transmissão na hora (o indicador de compartilhamento apaga sozinho).
 * Retorna o canvas bruto — o recorte acontece sobre ele sem perder pixels.
 *
 * t181 — `onPhase` anuncia as fases da captura limpa: 'tidy' (a janela de
 * arrumação começou — o banner sobe na superfície do dono) e 'settle' (o
 * banner JÁ morreu, a régua v3 começa). O callback é opcional: sem ele a
 * captura acontece igual — o aviso é guia, não dependência.
 */
export async function captureScreenFrame(
  onPhase?: (phase: CapturePhase) => void,
): Promise<HTMLCanvasElement> {
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

    // A JANELA DE ARRUMAÇÃO (t181, o pedido do dono com print): o seletor
    // morre DEPOIS que o stream começa — e o fade lento já enganou a régua
    // uma vez. Em vez de apostar, o aviso sobe (fase 'tidy') e a captura
    // ESPERA os 2s garantidos da lib: o seletor tem 4× o tempo antigo para
    // morrer de verdade, o dono fecha o que não deve sair na foto, e a
    // superfície PROVA mudança (o aviso entra e sai — nada congela antes).
    onPhase?.('tidy');
    await new Promise<void>((r) => setTimeout(r, TIDY_TOTAL_MS));
    // O aviso JÁ saiu da superfície (fase 'settle') — o frame final não pode
    // carregá-lo; a régua v3 só começa depois que a casa está limpa.
    onPhase?.('settle');
    // Um 1º draw aquece o decode; o frame VERDADEIRO é colhido quando a
    // superfície PROVA silêncio visual (settleScreenSurface: 3 seguidas).
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
