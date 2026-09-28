'use client';

// capture-crop-dialog + screen-capture (da 138) cobrem a captura LIVRE da tela.
// Este diálogo cobre o caso de maior precisão: o MATERIAL PDF aberto no Hub.
// O iframe nativo não expõe a página atual nem deixa-se fotografar — mas o
// arquivo é nosso: pdf.js renderiza a página EXATA em alta resolução (2×) e o
// jpeg entra DIRETO no chat do tutor via openTutor({ image }) — sem seletor de
// tela, sem recorte manual, sem arquivo no disco (o canvas morre com o diálogo).

import * as React from 'react';
import { Camera, Check, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { downscaleCanvas } from '@/lib/tutor-image';
import { openTutor } from '@/lib/hub-events';
import type { Material } from '@/data/course-data';

interface Props {
  material: Material;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Estado de carregamento do documento/página — a UI mostra o que acontece. */
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function PdfPageCaptureDialog({ material, open, onOpenChange }: Props) {
  const [state, setState] = React.useState<LoadState>('idle');
  const [pageCount, setPageCount] = React.useState(0);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const [attached, setAttached] = React.useState(false);

  const thumbsRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  /** Documento pdf.js vivo apenas enquanto o diálogo está aberto. */
  const docRef = React.useRef<any>(null);
  /** loadingTask — o destroy() do v6 vive AQUI (derruba doc + worker juntos). */
  const taskRef = React.useRef<any>(null);
  /** Render em curso — cancelar o render anterior evita corrida de canvas. */
  const renderTaskRef = React.useRef<any>(null);

  /** Fecha o doc pdf.js e limpa o canvas — o print "se auto-apaga" aqui. */
  const cleanup = React.useCallback(() => {
    try {
      renderTaskRef.current?.cancel?.();
    } catch {
      /* render já morto */
    }
    renderTaskRef.current = null;
    try {
      void taskRef.current?.destroy?.();
    } catch {
      /* doc já morto */
    }
    taskRef.current = null;
    docRef.current = null;
    const pv = previewRef.current;
    if (pv) {
      pv.width = 0;
      pv.height = 0;
    }
  }, []);

  React.useEffect(() => {
    if (!open) {
      cleanup();
      setState('idle');
      setPageCount(0);
      setSelected(null);
      setAttached(false);
      return;
    }
    let alive = true;
    (async () => {
      setState('loading');
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const task = pdfjs.getDocument({ url: material.pdfPath ?? '' });
        const doc = await task.promise;
        if (!alive) {
          void task.destroy();
          return;
        }
        taskRef.current = task;
        docRef.current = doc;
        setPageCount(doc.numPages);
        setState('ready');
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, material.pdfPath]);

  /** Renderiza uma miniatura dentro do node <canvas> dado. */
  const renderThumb = React.useCallback(async (n: number, canvas: HTMLCanvasElement) => {
    const doc = docRef.current;
    if (!doc) return;
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    // Largura fixa de miniatura (~132px) — altura proporcional, nitidez 2×
    const scale = (132 / base.width) * 2;
    const viewport = page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
  }, []);

  /** Página grande no preview — 2× de nitidez para o OCR da IA ler tudo. */
  const renderPreview = React.useCallback(async (n: number) => {
    const doc = docRef.current;
    const canvas = previewRef.current;
    if (!doc || !canvas) return;
    setRendering(true);
    try {
      renderTaskRef.current?.cancel?.();
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = (620 / base.width) * 2; // coluna do preview ~620px, nitidez 2×
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const task = page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      // RenderingCancelledException é fluxo normal ao trocar rápido de página
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('cancel')) throw err;
    } finally {
      setRendering(false);
    }
  }, []);

  // Miniaturas: uma renderização por página, em sequência (PDFs do acervo têm
  // ≤ 47 páginas; render pequeno custa ~30ms cada — a fila cabe no instante).
  React.useEffect(() => {
    if (state !== 'ready' || !open) return;
    const host = thumbsRef.current;
    if (!host) return;
    let alive = true;
    const nodes = Array.from(host.querySelectorAll<HTMLCanvasElement>('canvas[data-page]'));
    void (async () => {
      for (const node of nodes) {
        if (!alive) return;
        const n = Number(node.dataset.page);
        try {
          await renderThumb(n, node);
          node.dataset.done = '1';
        } catch {
          node.dataset.done = 'error';
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [state, open, renderThumb]);

  const pick = (n: number) => {
    setSelected(n);
    setAttached(false);
    void renderPreview(n);
  };

  /** Anexa ao tutor: canvas → JPEG 1400px (a mesma régua dos prints) → chat. */
  const attach = () => {
    const canvas = previewRef.current;
    if (!canvas || !canvas.width || selected === null) return;
    try {
      const image = downscaleCanvas(canvas);
      openTutor({
        image,
        disciplineCode: material.disciplineCode,
        materialId: material.id,
      });
      setAttached(true);
      toast.success(
        `Página ${selected} anexada ao tutor — nada foi salvo no seu computador.`,
      );
      onOpenChange(false); // fecha: o print some daqui junto com o diálogo
    } catch {
      toast.error('Não consegui converter a página. Tente de novo.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-4 pr-10">
          <DialogTitle className="flex items-center gap-2 text-base leading-tight">
            <Camera className="size-4 shrink-0 text-emerald-500" aria-hidden />
            Print de página — {material.title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Escolha a página e anexe ao tutor — a imagem vai direto para a conversa e
            some com o envio. <span className="text-emerald-500">Nada é salvo no seu computador.</span>
          </DialogDescription>
        </DialogHeader>

        {state === 'loading' && (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-emerald-500" aria-hidden />
            Abrindo o PDF…
          </div>
        )}
        {state === 'error' && (
          <div className="flex h-56 flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
            <X className="size-5 text-rose-500" aria-hidden />
            Não consegui abrir o PDF. Feche e tente de novo — ou use o anexo de print (Ctrl+V).
          </div>
        )}

        {state === 'ready' && (
          <div className="flex min-h-0 flex-1">
            {/* Trilho de miniaturas — a página é escolhida DE VISÃO, sem decoreba de número */}
            <div
              ref={thumbsRef}
              className="w-[168px] shrink-0 overflow-y-auto border-r bg-muted/40 p-2"
              role="listbox"
              aria-label="Páginas do PDF"
            >
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="option"
                  aria-selected={selected === n}
                  onClick={() => pick(n)}
                  className={cn(
                    'group mb-2 block w-full rounded-md border-2 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
                    selected === n
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-transparent hover:border-emerald-500/40',
                  )}
                >
                  <canvas
                    data-page={n}
                    className="w-full rounded-sm bg-white shadow-sm"
                    aria-label={`Página ${n}`}
                  />
                  <span className="mt-0.5 block text-center text-[10px] tabular-nums text-muted-foreground">
                    {n}
                  </span>
                </button>
              ))}
            </div>

            {/* Preview grande + ação */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-muted/30 p-3">
                {selected === null ? (
                  <div className="flex h-56 flex-col items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
                    <Camera className="size-5 text-emerald-500/60" aria-hidden />
                    Clique numa página à esquerda
                  </div>
                ) : (
                  <div className="relative">
                    <canvas
                      ref={previewRef}
                      className="max-w-full rounded-md bg-white shadow-md"
                      aria-label={`Prévia da página ${selected}`}
                    />
                    {rendering && (
                      <div className="absolute inset-0 grid place-items-center rounded-md bg-background/60">
                        <Loader2 className="size-6 animate-spin text-emerald-500" aria-hidden />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 border-t p-3">
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {selected !== null && (
                    <>
                      Página <span className="font-medium tabular-nums text-foreground">{selected}</span> de{' '}
                      <span className="tabular-nums">{pageCount}</span> · qualidade 2× para a IA ler os números
                    </>
                  )}
                </p>
                <Button
                  size="sm"
                  onClick={attach}
                  disabled={selected === null || rendering || attached}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  aria-label="Anexar página ao tutor"
                >
                  {attached ? (
                    <>
                      <Check className="size-3.5" /> Anexada
                    </>
                  ) : (
                    <>
                      <Camera className="size-3.5" /> Anexar ao tutor
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
