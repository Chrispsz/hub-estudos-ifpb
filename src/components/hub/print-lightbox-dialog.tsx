'use client';

// PrintLightboxDialog (t160 · t166) — o print que se lê de novo.
//
// Bolha e chip seguram o print pequeno (max-h-40/44 · miniatura 40px) —
// fórmula e enunciado pedem tamanho grande. Este diálogo mostra o MESMO
// data URL que já vive na memória (nada novo é salvo, nada é enviado —
// só visão).
//
// t166 — O PRINT QUE SE DEIXA LER: o zoom deixou de ser um segredo de
// clique. Cabeçalho com controles explícitos (− · % · + · Ajustar), o
// clique na imagem continua alternando, o teclado (+/−/0) serve a mesma
// régua, e no zoom alto o ARRASTO navega (threshold na lib — abaixo dele
// é clique). O degrau 3× existe para os recortes pequenos. E o título diz
// de ONDE o print veio quando a superfície que abriu sabe o rótulo (t163).
// A largura de layout muda de verdade (nada de transform:scale — a
// rolagem precisa alcançar o canto direito).

import * as React from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Minus, Plus, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatPrintDimensions,
  isPrintPanGesture,
  nextPrintZoom,
  PRINT_LIGHTBOX_ALT,
  PRINT_LIGHTBOX_FALLBACK_TITLE,
  PRINT_LIGHTBOX_HINT,
  PRINT_PAN_THRESHOLD_PX,
  PRINT_ZOOM_LABEL,
  printZoomKeyTo,
  printZoomPercent,
  scaledPrintWidth,
  zoomIn,
  zoomOut,
  type PrintZoom,
} from '@/lib/print-lightbox';

interface PrintLightboxDialogProps {
  /** O data URL do print (o MESMO que já existe na memória do chat/chip). */
  src: string | null;
  /** Controle do diálogo: fechar por fora (Esc, clique fora, X). */
  onOpenChange: (open: boolean) => void;
  /**
   * O rótulo de procedência (t163) quando a superfície que abriu o SABE
   * (chip pendente: "página 2 · Plano de Disciplina"). Bolha enviada não
   * carrega rótulo — o título cai no fallback honesto.
   */
  label?: string | null;
  /** Alt do print — herdado da superfície que abriu (padrão da casa). */
  alt?: string;
}

export function PrintLightboxDialog({ src, onOpenChange, label, alt = PRINT_LIGHTBOX_ALT }: PrintLightboxDialogProps) {
  const [zoom, setZoom] = React.useState<PrintZoom>('fit');
  const [natural, setNatural] = React.useState<{ width: number; height: number } | null>(null);
  const [panning, setPanning] = React.useState(false);

  // Cada print aberto começa ajustado e sem memória da imagem anterior.
  React.useEffect(() => {
    setZoom('fit');
    setNatural(null);
    setPanning(false);
  }, [src]);

  const width = scaledPrintWidth(natural, zoom);
  const percent = printZoomPercent(natural, zoom);
  const dimensions = formatPrintDimensions(natural);

  // ===== O teclado da mesma régua: +/= aproximam, −/_ afastam, 0 ajusta.
  // (Esc continua sendo do Radix — o diálogo não compete com a lib.)
  React.useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const intent = printZoomKeyTo(e.key);
      if (!intent) return;
      e.preventDefault();
      if (intent === 'in') setZoom((z) => zoomIn(z));
      else if (intent === 'out') setZoom((z) => zoomOut(z));
      else setZoom('fit');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src]);

  // ===== ARRASTAR PARA NAVEGAR (mouse — o toque rola nativo): abaixo do
  // limiar é clique (a imagem alterna o zoom como sempre); passou do limiar,
  // o gesto vira scroll do viewport e o próximo clique é silenciado.
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const panRef = React.useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClickRef = React.useRef(false);

  const onPanPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const vp = viewportRef.current;
    if (!vp) return;
    panRef.current = { x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sem capture — o move direto continua servindo */
    }
  };

  const onPanPointerMove = (e: React.PointerEvent) => {
    const p = panRef.current;
    const vp = viewportRef.current;
    if (!p || !vp) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && !isPrintPanGesture(dx, dy, PRINT_PAN_THRESHOLD_PX)) return;
    p.moved = true;
    setPanning(true);
    vp.scrollLeft = p.left - dx;
    vp.scrollTop = p.top - dy;
  };

  const onPanPointerUp = () => {
    if (panRef.current?.moved) suppressClickRef.current = true;
    panRef.current = null;
    setPanning(false);
  };

  const onImageClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setZoom((z) => nextPrintZoom(z));
  };

  const zoomBtn =
    'grid size-7 place-items-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-emerald-500/50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border/60 disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:hover:text-emerald-400';

  return (
    <Dialog open={!!src} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl"
        aria-label={alt}
      >
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex min-w-0 items-center gap-2 text-sm">
              <ZoomIn className="size-4 shrink-0 text-emerald-500" aria-hidden />
              <span className="truncate" data-testid="print-lightbox-title">
                {label || PRINT_LIGHTBOX_FALLBACK_TITLE}
              </span>
            </DialogTitle>
            {/* Os controles da mesma régua do clique — o zoom nunca mais é
                um segredo descoberto por acidente. */}
            <div className="flex shrink-0 items-center gap-1" data-testid="print-lightbox-controls">
              <button
                type="button"
                data-testid="print-lightbox-zoom-out"
                aria-label="Afastar o zoom"
                title="Afastar (tecla −)"
                className={zoomBtn}
                onClick={() => setZoom((z) => zoomOut(z))}
                disabled={zoom === 'fit'}
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                data-testid="print-lightbox-zoom-pct"
                aria-label={`Zoom atual: ${PRINT_ZOOM_LABEL[zoom]}. Clique para alternar`}
                title="Alternar o zoom (o mesmo gesto do clique na imagem)"
                className="w-14 rounded-md px-1 py-1 text-center text-xs font-medium tabular-nums text-emerald-600 transition-colors hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-emerald-400"
                onClick={() => setZoom((z) => nextPrintZoom(z))}
              >
                {percent !== null ? `${percent}%` : PRINT_ZOOM_LABEL[zoom]}
              </button>
              <button
                type="button"
                data-testid="print-lightbox-zoom-in"
                aria-label="Aproximar o zoom"
                title="Aproximar (tecla +)"
                className={zoomBtn}
                onClick={() => setZoom((z) => zoomIn(z))}
                disabled={zoom === '3x'}
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
              {zoom !== 'fit' && (
                <button
                  type="button"
                  data-testid="print-lightbox-zoom-fit"
                  aria-label="Voltar ao tamanho ajustado à tela"
                  title="Ajustar à tela (tecla 0)"
                  className="ml-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  onClick={() => setZoom('fit')}
                >
                  Ajustar
                </button>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {PRINT_LIGHTBOX_HINT}
          </DialogDescription>
        </DialogHeader>
        <div
          ref={viewportRef}
          data-testid="print-lightbox-viewport"
          className={cn(
            'max-h-[70vh] touch-auto select-none overflow-auto bg-slate-950/90 p-2',
            panning ? 'cursor-grabbing' : 'cursor-grab',
          )}
          onPointerDown={onPanPointerDown}
          onPointerMove={onPanPointerMove}
          onPointerUp={onPanPointerUp}
          onPointerCancel={onPanPointerUp}
        >
          {src && (
            <img
              src={src}
              alt={alt}
              data-testid="print-lightbox-image"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0) {
                  setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                }
              }}
              onClick={onImageClick}
              style={width ? { width: `${width}px`, maxWidth: 'none' } : undefined}
              className={cn(
                'mx-auto block rounded-md',
                panning ? 'cursor-grabbing' : 'cursor-zoom-in',
                width ? 'h-auto' : 'max-h-[68vh] w-auto max-w-full object-contain',
              )}
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          <span data-testid="print-lightbox-dimensions" className="tabular-nums">
            {dimensions ?? ' '}
          </span>
          <span>Nada é salvo nem enviado — só visão.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
