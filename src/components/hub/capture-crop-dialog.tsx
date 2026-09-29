'use client';

// CaptureCropDialog — o segundo passo da captura de tela que se auto-anexa ao
// Tutor e se auto-apaga (pedido do dono, 28/09). O frame bruto chega aqui em
// resolução NATIVA; o aluno arrasta um retângulo sobre a questão e SÓ o recorte
// segue (recorte = mais pixels úteis por byte = leitura melhor na IA do que um
// print de tela inteira). A nota no rodapé cumpre a promessa em voz alta: nada
// é salvo no computador — a captura vive só na conversa e some ao enviar.

import * as React from 'react';
import { Crop, Expand, RefreshCw, ScanText, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { downscaleCanvas } from '@/lib/tutor-image';
import { cn } from '@/lib/utils';

interface Props {
  /** Frame bruto da captura (canvas em resolução nativa — dono é o pai). */
  canvas: HTMLCanvasElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recorte pronto (JPEG 1400px, mesma régua dos prints) — vai para o anexo. */
  onAttach: (dataUrl: string) => void;
  /** Capturar de novo (o aluno errou o momento da tela). */
  onRetry: () => void;
}

/** Retângulo de seleção em coordenadas NORMALIZADAS (0..1 do preview). */
interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function CaptureCropDialog({ canvas, open, onOpenChange, onAttach, onRetry }: Props) {
  /** Prévia (data URL leve só para EXIBIÇÃO — o recorte usa os pixels originais). */
  const previewUrl = React.useMemo(() => {
    if (!canvas || !canvas.width) return null;
    try {
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch {
      return null;
    }
  }, [canvas, open]);

  const boxRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const draggingRef = React.useRef(false);

  // Nova captura = seleção zerada.
  React.useEffect(() => {
    if (open) setRect(null);
  }, [open, previewUrl]);

  const normFromEvent = (e: React.PointerEvent): { x: number; y: number } => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: clamp01((e.clientX - box.left) / box.width),
      y: clamp01((e.clientY - box.top) / box.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = normFromEvent(e);
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setRect({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const p = normFromEvent(e);
    setRect((r) => (r ? { ...r, x2: p.x, y2: p.y } : r));
  };

  const onPointerUp = () => {
    draggingRef.current = false;
    // Clique sem arrasto (menos de ~8px na tela) não é seleção — limpa.
    setRect((r) => {
      if (!r || !boxRef.current) return null;
      const box = boxRef.current.getBoundingClientRect();
      const w = Math.abs(r.x2 - r.x1) * box.width;
      const h = Math.abs(r.y2 - r.y1) * box.height;
      return w < 8 || h < 8 ? null : r;
    });
  };

  /** Recorta os pixels ORIGINAIS e entrega o JPEG na régua dos prints. */
  const attach = (whole: boolean) => {
    if (!canvas) return;
    let out: HTMLCanvasElement = canvas;
    if (!whole && rect && boxRef.current) {
      const box = boxRef.current.getBoundingClientRect();
      const rx1 = Math.min(rect.x1, rect.x2);
      const rx2 = Math.max(rect.x1, rect.x2);
      const ry1 = Math.min(rect.y1, rect.y2);
      const ry2 = Math.max(rect.y1, rect.y2);
      const sx = Math.round(rx1 * canvas.width);
      const sy = Math.round(ry1 * canvas.height);
      const sw = Math.max(1, Math.round((rx2 - rx1) * canvas.width));
      const sh = Math.max(1, Math.round((ry2 - ry1) * canvas.height));
      out = document.createElement('canvas');
      out.width = sw;
      out.height = sh;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    }
    try {
      onAttach(downscaleCanvas(out));
      onOpenChange(false);
    } catch {
      // downscale falhou — mantém o diálogo aberto; o aluno pode tentar de novo
    }
  };

  const sel = rect
    ? {
        left: `${Math.min(rect.x1, rect.x2) * 100}%`,
        top: `${Math.min(rect.y1, rect.y2) * 100}%`,
        width: `${Math.abs(rect.x2 - rect.x1) * 100}%`,
        height: `${Math.abs(rect.y2 - rect.y1) * 100}%`,
      }
    : null;

  const selPixels =
    rect && canvas
      ? {
          w: Math.max(1, Math.round(Math.abs(rect.x2 - rect.x1) * canvas.width)),
          h: Math.max(1, Math.round(Math.abs(rect.y2 - rect.y1) * canvas.height)),
        }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4 pr-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanText className="size-4 text-emerald-500" aria-hidden />
            Recortar a questão para o tutor
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Arraste sobre a parte que você quer perguntar — só o recorte vai para a IA, com
            toda a resolução da sua tela.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          {previewUrl ? (
            <div
              ref={boxRef}
              className="relative max-h-[52vh] touch-none select-none overflow-hidden rounded-lg border border-border/60 bg-muted"
            >
              {/* A prévia NÃO recebe interação — a camada de seleção fica por cima */}
              <img
                src={previewUrl}
                alt="Tela capturada — arraste para selecionar a questão"
                className="block max-h-[52vh] w-auto max-w-full pointer-events-none"
                draggable={false}
              />
              <div
                aria-hidden
                className="absolute inset-0 cursor-crosshair"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {sel && (
                  <div
                    data-testid="capture-selection"
                    className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-400/10"
                    style={{ ...sel, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="grid h-40 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Captura indisponível — tente capturar de novo.
            </div>
          )}

          <div className="mt-3 flex min-h-5 items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Crop className="size-3.5" aria-hidden />
              {selPixels ? (
                <>
                  recorte:{' '}
                  <span className="tabular-nums text-foreground">
                    {selPixels.w} × {selPixels.h} px
                  </span>
                </>
              ) : (
                'nada selecionado — anexa a tela inteira'
              )}
            </span>
            <button
              type="button"
              onClick={() => setRect(null)}
              className="hidden rounded px-1.5 py-0.5 transition-colors hover:text-foreground sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              limpar seleção
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 p-3">
          <Button
            size="sm"
            className="h-9 flex-1 bg-emerald-600 text-white hover:bg-emerald-700 sm:flex-none"
            onClick={() => attach(false)}
            disabled={!rect || !previewUrl}
            aria-label="Anexar o recorte selecionado ao tutor"
          >
            <Crop className="size-4" aria-hidden /> Anexar recorte
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => attach(true)}
            disabled={!previewUrl}
            aria-label="Anexar a tela inteira ao tutor"
          >
            <Expand className="size-3.5" aria-hidden /> Tela inteira
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-muted-foreground hover:text-foreground"
            onClick={onRetry}
            aria-label="Capturar a tela de novo"
          >
            <RefreshCw className="size-3.5" aria-hidden /> De novo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="Descartar a captura"
          >
            <X className="size-3.5" aria-hidden /> Cancelar
          </Button>
        </div>

        {/* A PROMESSA em voz alta: auto-anexo e auto-apagado (o medo do dono era
            a pasta de prints suja — a captura nunca vira arquivo). */}
        <p
          className={cn(
            'border-t px-4 py-2 text-[11px] leading-relaxed text-muted-foreground',
            'bg-amber-500/5 text-amber-700/80 dark:text-amber-400/70',
          )}
        >
          A captura não é salva no seu computador: ela entra direto na conversa e desaparece
          quando a mensagem é enviada (ou se você cancelar).
        </p>
      </DialogContent>
    </Dialog>
  );
}
