'use client';

// PrintLightboxDialog (t160) — o print que se lê de novo.
//
// Bolha e chip seguram o print pequeno (max-h-40/44 · miniatura 40px) —
// fórmula e enunciado pedem tamanho grande. Este diálogo mostra o MESMO
// data URL que já vive na memória (nada novo é salvo, nada é enviado —
// só visão). O clique na imagem alterna ajustada → real → 2× (t160 lib);
// Esc e o clique fora fecham; a largura de layout muda de verdade (nada
// de transform:scale — a rolagem precisa alcançar o canto direito).

import * as React from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  nextPrintZoom,
  PRINT_LIGHTBOX_ALT,
  PRINT_LIGHTBOX_HINT,
  PRINT_ZOOM_LABEL,
  scaledPrintWidth,
  type PrintZoom,
} from '@/lib/print-lightbox';

interface PrintLightboxDialogProps {
  /** O data URL do print (o MESMO que já existe na memória do chat/chip). */
  src: string | null;
  /** Controle do diálogo: fechar por fora (Esc, clique fora, X). */
  onOpenChange: (open: boolean) => void;
  /** Alt do print — herdado da superfície que abriu (padrão da casa). */
  alt?: string;
}

export function PrintLightboxDialog({ src, onOpenChange, alt = PRINT_LIGHTBOX_ALT }: PrintLightboxDialogProps) {
  const [zoom, setZoom] = React.useState<PrintZoom>('fit');
  const [natural, setNatural] = React.useState<{ width: number; height: number } | null>(null);

  // Cada print aberto começa ajustado e sem memória da imagem anterior.
  React.useEffect(() => {
    setZoom('fit');
    setNatural(null);
  }, [src]);

  const width = scaledPrintWidth(natural, zoom);

  return (
    <Dialog open={!!src} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl"
        aria-label={alt}
      >
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ZoomIn className="size-4 text-emerald-500" aria-hidden />
            {PRINT_ZOOM_LABEL[zoom]}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {PRINT_LIGHTBOX_HINT}
          </DialogDescription>
        </DialogHeader>
        <div
          data-testid="print-lightbox-viewport"
          className="max-h-[70vh] overflow-auto bg-slate-950/90 p-2"
        >
          {src && (
            <img
              src={src}
              alt={alt}
              data-testid="print-lightbox-image"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0) {
                  setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                }
              }}
              onClick={() => setZoom((z) => nextPrintZoom(z))}
              style={width ? { width: `${width}px`, maxWidth: 'none' } : undefined}
              className={cn(
                'mx-auto block cursor-zoom-in rounded-md',
                width ? 'h-auto' : 'max-h-[68vh] w-auto max-w-full object-contain',
              )}
            />
          )}
        </div>
        <div className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          {PRINT_LIGHTBOX_HINT}
        </div>
      </DialogContent>
    </Dialog>
  );
}
