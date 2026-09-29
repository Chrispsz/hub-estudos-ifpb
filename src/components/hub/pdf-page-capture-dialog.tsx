'use client';

// capture-crop-dialog + screen-capture (da 138) cobrem a captura LIVRE da tela.
// Este diálogo cobre o caso de maior precisão: o MATERIAL PDF aberto no Hub.
// O iframe nativo não expõe a página atual nem deixa-se fotografar — mas o
// arquivo é nosso: pdf.js renderiza a página EXATA em alta resolução (2×) e o
// jpeg entra DIRETO no chat do tutor via openTutor({ image }) — sem seletor de
// tela, sem recorte manual, sem arquivo no disco (o canvas morre com o diálogo).
//
// t152 (pedido do dono com print): a página inteira nem sempre é a pergunta —
// numa LISTA de 35 questões ele quer UMA questão. O recorte da captura de tela
// (138) agora mora AQUI TAMBÉM: arrasta sobre a PRÉVIA renderizada e só o
// recorte segue — recortado dos pixels ORIGINAIS do render 2× (a resolução da
// tela deixa de ser o teto; o PDF manda na nitidez).

import * as React from 'react';
import { Camera, Check, Crop, Expand, Loader2, ScanText, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { downscaleCanvas } from '@/lib/tutor-image';
import { openTutor } from '@/lib/hub-events';
import { clampPdfPage } from '@/lib/pdf-search';
import type { Material } from '@/data/course-data';

interface Props {
  material: Material;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Destino do print: quando fornecido (modo tela dividida), a página entra
   * no painel do tutor que está AO LADO do PDF — sem abrir o chat principal
   * por cima. Sem o prop, mantém o comportamento histórico (openTutor →
   * chat da aba Estudar). t163: leva TAMBÉM o rótulo de procedência — o
   * diálogo é quem SABE a página e o material onde o print nasceu.
   */
  onAttach?: (image: string, label: string) => void;
  /**
   * Página pedida pela BUSCA do PDF (t157): o diálogo abre JÁ parado nela,
   * sem re-folhear as miniaturas. Vale UMA vez por abertura — o visualizador
   * zera o prop ao fechar, então abrir pela BARRA depois não herda página
   * velha. t169: a BARRA também pré-seleciona — a página ABERTA (último
   * salto despachado) entra por aqui; o aluno que está lendo a página N
   * printa a página N sem re-folhear nada.
   */
  initialPage?: number;
  /**
   * t169 — Procedência da pré-seleção: de ONDE a página veio ("página do seu
   * último salto", "página do trecho buscado"). A prévia confessa a origem
   * enquanto EXATAMENTE ela está vista — escolheu outra página, o rótulo
   * cala (nenhuma mentira na casa). Morre junto com o diálogo.
   */
  presetHint?: string;
}

/** Estado de carregamento do documento/página — a UI mostra o que acontece. */
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Retângulo de seleção em coordenadas NORMALIZADAS (0..1 da prévia). */
interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function PdfPageCaptureDialog({ material, open, onOpenChange, onAttach, initialPage, presetHint }: Props) {
  const [state, setState] = React.useState<LoadState>('idle');
  const [pageCount, setPageCount] = React.useState(0);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const [attached, setAttached] = React.useState(false);
  /** Recorte arrastado sobre a prévia (t152) — null = página inteira. */
  const [rect, setRect] = React.useState<Rect | null>(null);
  const draggingRef = React.useRef(false);
  const cropBoxRef = React.useRef<HTMLDivElement>(null);
  /** Espelho de selected para os listeners de teclado lerem o valor vivo. */
  const selectedRef = React.useState({ current: null as number | null })[0];
  /** t157: a página inicial pedida pela busca já foi aplicada nesta abertura? */
  const presetRef = React.useRef(false);
  /** t169: a página que a pré-seleção escolheu — o rótulo de procedência
   * só vive enquanto ELA está na prévia (escolheu outra, o rótulo cala). */
  const [presetPage, setPresetPage] = React.useState<number | null>(null);

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
      selectedRef.current = null;
      setAttached(false);
      setRect(null);
      setPresetPage(null); // t169: a procedência morre junto com o diálogo
      presetRef.current = false; // t157: nova abertura pode receber nova página inicial
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
    if (!doc) return;
    setRendering(true);
    try {
      renderTaskRef.current?.cancel?.();
      const page = await doc.getPage(n);
      // LIÇÃO t152 (pega AO VIVO no E2E): o canvas NÃO existia no 1º pick —
      // ele monta junto com o estado `selected`, DEPOIS do handler. Ler o ref
      // ANTES do await devolvia null e a prévia morria em branco (300×150).
      // Re-ler DEPOIS do await: o React 18 descarga o clique de forma
      // síncrona, então quando o pdf.js volta o canvas já está no DOM.
      const canvas = previewRef.current;
      if (!canvas) return;
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
    selectedRef.current = n;
    setAttached(false);
    setRect(null); // o recorte pertence à página onde nasceu — trocou, morreu
    void renderPreview(n);
    // a miniatura escolhida segue o teclado (folhear com ←/→ sem caçar o scroll)
    const thumb = thumbsRef.current?.querySelector<HTMLCanvasElement>(
      `canvas[data-page="${n}"]`,
    );
    thumb?.scrollIntoView({ block: 'nearest' });
  };

  // t157 — O MAPA APONTA A PÁGINA: quando a busca (pdf-search-dialog) acha o
  // trecho e o dono clica em "print", este diálogo abre JÁ parado na página
  // do trecho — achar, saltar e printar são o mesmo gesto. Uma vez por
  // abertura (presetRef): sem isso o pick re-dispararia a cada render.
  React.useEffect(() => {
    if (!open || state !== 'ready' || presetRef.current) return;
    const p = clampPdfPage(Number(initialPage ?? 0), pageCount);
    if (!p) return;
    presetRef.current = true;
    setPresetPage(p); // t169: a procedência sabe de quem é a página vista
    pick(p);
  }, [open, state, pageCount, initialPage]);

  // NAVEGAÇÃO POR TECLADO (140): ←/→ folheiam a lista com o teclado — a mão
  // esquerda vira a página, a direita pergunta. Vive só com o diálogo aberto.
  React.useEffect(() => {
    if (!open || state !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const cur = selectedRef.current ?? 0;
      const next = Math.min(pageCount, Math.max(1, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      if (next !== cur) pick(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, state, pageCount]);

  // ===== Recorte sobre a prévia (mesma gramática do capture-crop-dialog):
  // coordenadas NORMALIZADAS no display, pixels recortados dos ORIGINAIS 2×.
  const normFromEvent = (e: React.PointerEvent): { x: number; y: number } => {
    const box = cropBoxRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: clamp01((e.clientX - box.left) / box.width),
      y: clamp01((e.clientY - box.top) / box.height),
    };
  };

  const onCropPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = normFromEvent(e);
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sem capture — o move direto continua servindo */
    }
    setRect({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };

  const onCropPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const p = normFromEvent(e);
    setRect((r) => (r ? { ...r, x2: p.x, y2: p.y } : r));
  };

  const onCropPointerUp = () => {
    draggingRef.current = false;
    // Clique sem arrasto não é seleção — a página inteira segue sendo o 1-clic.
    setRect((r) => {
      if (!r || !cropBoxRef.current) return null;
      const box = cropBoxRef.current.getBoundingClientRect();
      const w = Math.abs(r.x2 - r.x1) * box.width;
      const h = Math.abs(r.y2 - r.y1) * box.height;
      return w < 8 || h < 8 ? null : r;
    });
  };

  /** Anexa ao tutor: canvas → JPEG 1400px (a mesma régua dos prints) → chat. */
  const attach = (whole: boolean) => {
    const canvas = previewRef.current;
    if (!canvas || !canvas.width || selected === null) return;
    try {
      let out: HTMLCanvasElement = canvas;
      if (!whole && rect && cropBoxRef.current) {
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
      const image = downscaleCanvas(out);
      // Procedência do print (t163): o chip do tutor diz ONDE ele nasceu.
      // O título curto é a parte antes do primeiro travessão OU hífen do
      // título ("Lista de Matrizes — Bloco 1 (Q1–16)" → "Lista de Matrizes";
      // "Plano de Disciplina - Matemática" → "Plano de Disciplina").
      const shortTitle = material.title.split(' — ')[0].split(' - ')[0];
      const label = whole
        ? `página ${selected} · ${shortTitle}`
        : `recorte da página ${selected} · ${shortTitle}`;
      if (onAttach) {
        // Modo dividido: o painel do tutor mora AO LADO — o anexo nem sai
        // do diálogo (o print já nasce do lado de quem vai ler).
        onAttach(image, label);
      } else {
        openTutor({
          image,
          imageLabel: label,
          disciplineCode: material.disciplineCode,
          materialId: material.id,
        });
      }
      setAttached(true);
      toast.success(
        whole
          ? `Página ${selected} anexada ao tutor — nada foi salvo no seu computador.`
          : `Recorte da página ${selected} anexado ao tutor — nada foi salvo no seu computador.`,
      );
      onOpenChange(false); // fecha: o print some daqui junto com o diálogo
    } catch {
      toast.error('Não consegui converter a página. Tente de novo.');
    }
  };

  // t169 — ENTER ANEXA O QUE ESTÁ NA PRÉVIA: com a página vista (e nada
  // renderizando), Enter é o anexo — o gesto de quem já está com a mão no
  // teclado folheando (←/→) e não quer caçar o botão. O Enter NATIVO dos
  // botões/campos continua sendo deles: o foco em button/input/textarea/
  // select/contentEditable não é roubado (mesma régua do teclado da t166).
  // Efeito SEM deps: o listener renasce a cada render com o closure VIVO
  // (rect/rendering/attached frescos — nenhum espelho para manter).
  React.useEffect(() => {
    if (!open || state !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('button, input, textarea, select, [contenteditable="true"]')) return;
      if (selected === null || rendering || attached) return;
      e.preventDefault();
      attach(!rect); // recorte visto → anexa o recorte; página inteira → anexa ela
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sel = rect
    ? {
        left: `${Math.min(rect.x1, rect.x2) * 100}%`,
        top: `${Math.min(rect.y1, rect.y2) * 100}%`,
        width: `${Math.abs(rect.x2 - rect.x1) * 100}%`,
        height: `${Math.abs(rect.y2 - rect.y1) * 100}%`,
      }
    : null;

  const selPixels =
    rect && previewRef.current
      ? {
          w: Math.max(1, Math.round(Math.abs(rect.x2 - rect.x1) * previewRef.current.width)),
          h: Math.max(1, Math.round(Math.abs(rect.y2 - rect.y1) * previewRef.current.height)),
        }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-4 pr-10">
          <DialogTitle className="flex items-center gap-2 text-base leading-tight">
            <Camera className="size-4 shrink-0 text-emerald-500" aria-hidden />
            Print de página — {material.title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Escolha a página, arraste para recortar só a questão (ou anexe a página
            inteira) — a imagem vai direto para a conversa e some com o envio.{" "}
            <span className="text-emerald-500">Nada é salvo no seu computador.</span>
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
                  <div
                    ref={cropBoxRef}
                    className="relative touch-none select-none"
                  >
                    <canvas
                      ref={previewRef}
                      className="block max-w-full rounded-md bg-white shadow-md"
                      aria-label={`Prévia da página ${selected}`}
                    />
                    {/* Camada de recorte POR CIMA do canvas — a prévia não
                        recebe interação, o arrasto é todo desta camada. */}
                    <div
                      aria-hidden={rect ? undefined : true}
                      aria-label={rect ? 'Recorte selecionado na página' : undefined}
                      className="absolute inset-0 cursor-crosshair rounded-md"
                      onPointerDown={onCropPointerDown}
                      onPointerMove={onCropPointerMove}
                      onPointerUp={onCropPointerUp}
                      onPointerCancel={onCropPointerUp}
                    >
                      {sel && (
                        <div
                          data-testid="pdf-capture-selection"
                          className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-400/10"
                          style={{ ...sel, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                        />
                      )}
                    </div>
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
                      Página <span className="font-medium tabular-nums text-foreground">{selected}</span> de{" "}
                      <span className="tabular-nums">{pageCount}</span>
                      {/* t169 — procedência da pré-seleção: o rótulo só vive
                          enquanto a página pré-escolhida está NA prévia. */}
                      {presetHint && presetPage !== null && selected === presetPage && (
                        <span className="ml-1.5 hidden font-medium text-emerald-600 sm:inline dark:text-emerald-400">
                          · {presetHint}
                        </span>
                      )}
                      {selPixels ? (
                        <>
                          {" · "}recorte:{" "}
                          <span className="tabular-nums text-foreground">
                            {selPixels.w} × {selPixels.h} px
                          </span>
                        </>
                      ) : (
                        <> · qualidade 2× para a IA ler os números</>
                      )}
                    </>
                  )}
                </p>
                <p className="hidden text-xs text-muted-foreground/80 lg:block">
                  Enter anexa o que está na prévia
                </p>
                {rect && (
                  <button
                    type="button"
                    onClick={() => setRect(null)}
                    className="hidden rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                  >
                    limpar seleção
                  </button>
                )}
                {rect && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => attach(true)}
                    disabled={rendering || attached}
                    aria-label="Anexar a página inteira ao tutor"
                  >
                    <Expand className="size-3.5" aria-hidden /> Página inteira
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => attach(!rect)}
                  disabled={selected === null || rendering || attached}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  aria-label={rect ? 'Anexar o recorte selecionado ao tutor' : 'Anexar página ao tutor'}
                >
                  {attached ? (
                    <>
                      <Check className="size-3.5" /> Anexada
                    </>
                  ) : rect ? (
                    <>
                      <Crop className="size-3.5" /> Anexar recorte
                    </>
                  ) : (
                    <>
                      <ScanText className="size-3.5" /> Anexar ao tutor
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
