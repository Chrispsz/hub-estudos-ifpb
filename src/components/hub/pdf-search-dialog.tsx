'use client';

// O MAPA DO PDF (t157) — buscar dentro do material sem folhear página a
// página. O leitor NATIVO (iframe) lê bem, mas não busca: este diálogo abre
// o MESMO arquivo com pdf.js, indexa o texto de TODAS as páginas e devolve
// trechos com a página de origem. "Ir" salta o visualizador para a página
// (#page=N) e "print" entrega a página já aberta no diálogo de captura
// (t152) — achar, saltar e printar são o MESMO gesto.
//
// A doutrina da busca é a do fio (t153/t154): "logica" acha "Lógica",
// "nao caem" acha "não, caem." — acentos e pontuação dobram, o trecho
// exibido é o texto ORIGINAL. E como tudo no tubo do tutor: o índice morre
// com o diálogo (doc pdf.js destruído, nada fica em disco).
//
// t159 — A PERGUNTA LEVA A PÁGINA: o "Perguntar" não manda mais SÓ o texto.
// O MESMO doc que indexa o texto renderiza a página do trecho em 2× (o mesmo
// tubo do print de página da t152) e a imagem entra no composer JUNTO com a
// pergunta — para a IA, símbolo de matemática desenhado vale mais que texto
// extraído (o ToUnicode cura palavras, não fórmulas). O chip é do aluno:
// remove-se com um X, e NADA é despachado sem a mão dele.

import * as React from 'react';
import {
  Camera,
  CornerDownLeft,
  FileSearch,
  Loader2,
  MessageCircleQuestion,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { downscaleCanvas } from '@/lib/tutor-image';
import {
  PDF_SEARCH_TOTAL,
  pdfPageText,
  pdfSnippetQuestion,
  pdfTotalOccurrences,
  searchPdfPages,
  type PdfSearchHit,
  type PdfTextItem,
} from '@/lib/pdf-search';
import type { Material } from '@/data/course-data';

interface Props {
  material: Material;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Salta o visualizador nativo para a página do trecho (#page=N). */
  onJump: (page: number) => void;
  /** Abre o print de página (t152) JÁ parado na página do trecho. */
  onPrint: (page: number) => void;
  /** Pergunta pronta sobre o trecho (t158) — destino decide o chamador
   * (painel AO LADO no dividido; chat principal via openTutor fora dele).
   * t159: a PÁGINA do trecho vem junto (JPEG 2×, o tubo do print) — se o
   * render falhar, a pergunta segue SÓ com o texto (degradação honesta). */
  onAsk: (question: string, image?: string) => void;
}

type Phase = 'indexing' | 'ready' | 'error';

export function PdfSearchDialog({ material, open, onOpenChange, onJump, onPrint, onAsk }: Props) {
  /** Fase da indexação — a UI conta o que acontece com o PDF. */
  const [phase, setPhase] = React.useState<Phase>('indexing');
  /** Progresso honesto: "lendo… página 12 de 47". */
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  /** O índice: texto de cada página (1 índice = 1 página). */
  const [texts, setTexts] = React.useState<string[]>([]);
  /** A agulha crua e a debounced (220ms — busca sem tremer a cada tecla). */
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  /** Página sendo preparada para o Perguntar (t159) — spinner no botão certo. */
  const [askingPage, setAskingPage] = React.useState<number | null>(null);

  /** Doc pdf.js vivo apenas enquanto o diálogo está aberto (padrão t139/t152). */
  const taskRef = React.useRef<any>(null);
  /** O doc JÁ PROMETIDO (t159): o mesmo que indexa renderiza a página do trecho. */
  const docRef = React.useRef<any>(null);
  /** Espelho de `open` para o ask assíncrono saber se o gesto ainda vale. */
  const openRef = React.useRef(open);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  const cleanup = React.useCallback(() => {
    try {
      void taskRef.current?.destroy?.();
    } catch {
      /* doc já morto */
    }
    taskRef.current = null;
    docRef.current = null;
  }, []);

  // ABERTURA: indexa o PDF inteiro (getPage + getTextContent por página, em
  // sequência) com progresso visível. Fechar no meio mata o loop (alive) e
  // destrói o doc — o índice não sobrevive ao diálogo.
  React.useEffect(() => {
    if (!open) {
      cleanup();
      setPhase('indexing');
      setProgress({ done: 0, total: 0 });
      setTexts([]);
      setQuery('');
      setDebounced('');
      setAskingPage(null); // preparação não sobrevive ao fechar
      return;
    }
    let alive = true;
    (async () => {
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
        docRef.current = doc; // t159: o render do Perguntar reusa este doc
        const total = doc.numPages;
        setProgress({ done: 0, total });
        const collected: string[] = [];
        for (let n = 1; n <= total; n++) {
          if (!alive) return; // fechou no meio — o destroy do cleanup encerra
          const page = await doc.getPage(n);
          const tc = await page.getTextContent();
          collected.push(pdfPageText(tc.items as PdfTextItem[]));
          if (alive) setProgress({ done: n, total });
        }
        if (!alive) return;
        setTexts(collected);
        setPhase('ready');
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, material.pdfPath, cleanup]);

  // Debounce da agulha — 220ms depois da última tecla.
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(t);
  }, [query]);

  /** Os hits — computados só com índice pronto e agulha não vazia. */
  const hits: PdfSearchHit[] = React.useMemo(
    () => (phase === 'ready' ? searchPdfPages(texts, debounced) : []),
    [phase, texts, debounced],
  );

  /**
   * t159 — A PÁGINA DO TRECHO EM PIXELS: render 2× do MESMO doc que indexou
   * o texto (canvas FORA do DOM — pdf.js só quer o contexto 2d), JPEG na
   * mesma régua dos prints (downscaleCanvas, teto 1400px). Falha devolve
   * null — o chamador manda a pergunta só com o texto e avisa a verdade.
   */
  const renderPageImage = React.useCallback(async (n: number): Promise<string | null> => {
    const doc = docRef.current;
    if (!doc) return null;
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = (620 / base.width) * 2; // a mesma régua da prévia do print (t152)
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return downscaleCanvas(canvas);
  }, []);

  /**
   * O ask completo (t159): prepara a página, monta a pergunta e entrega TUDO
   * ao destino (painel ao lado ou chat principal). Enquanto prepara, o botão
   * vira spinner — e os outros Perguntar descansam (um gesto por vez). Se o
   * diálogo fechar no meio, o gesto morre com ele (openRef).
   */
  const askWithPage = React.useCallback(
    async (h: PdfSearchHit) => {
      if (askingPage !== null) return;
      setAskingPage(h.page);
      let image: string | null = null;
      try {
        image = await renderPageImage(h.page);
      } catch {
        image = null; // render falhou — a degradação é declarada abaixo
      }
      if (!openRef.current) return; // fechou no meio — o gesto morreu com o diálogo
      setAskingPage(null);
      const question = pdfSnippetQuestion(
        material.title,
        h.page,
        h.segments.map((s) => s.text).join(''),
        image !== null,
      );
      if (!image) {
        toast.info('Não consegui anexar a página — a pergunta segue só com o texto.');
      }
      onAsk(question, image ?? undefined);
      onOpenChange(false);
    },
    [askingPage, renderPageImage, material.title, onAsk, onOpenChange],
  );

  /** Enter = correr para o 1º trecho (a busca do PDF também CAMINHA). */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hits.length > 0) {
      e.preventDefault();
      onJump(hits[0].page);
      onOpenChange(false);
    }
  };

  const q = debounced.trim();
  const pagesWithHits = new Set(hits.map((h) => h.page)).size;
  /** t159 — a conta do rodapé: todas as ocorrências das páginas com trecho. */
  const totalOccurrences = pdfTotalOccurrences(hits);
  /** No teto de exibição o número vira PISO (o + diz que há mais). */
  const hitsCapped = hits.length >= PDF_SEARCH_TOTAL;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b p-4 pr-10">
          <DialogTitle className="flex items-center gap-2 text-base leading-tight">
            <FileSearch className="size-4 shrink-0 text-emerald-500" aria-hidden />
            Buscar no PDF — {material.title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Acha o trecho em TODAS as páginas — ignora acentos e pontuação ("logica"
            acha "Lógica"). Ir salta o visualizador até a página; print abre a captura
            já parada nela; Perguntar leva o trecho e a página ao tutor prontos para
            revisar.{" "}
            <span className="text-emerald-500">Nada sai do seu navegador.</span>
          </DialogDescription>
        </DialogHeader>

        {/* A agulha — autofocus, Enter corre para o 1º trecho */}
        <div className="border-b p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar no material… (ex.: matriz inversa)"
              aria-label="Texto a buscar no PDF"
              className="h-11 pl-9 pr-16 text-sm sm:h-9"
              autoComplete="off"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
              <CornerDownLeft className="size-2.5" aria-hidden /> 1º trecho
            </kbd>
          </div>
        </div>

        {/* Corpo: indexação · erro · vazio · resultados */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {phase === 'indexing' && (
            <div className="flex h-52 flex-col items-center justify-center gap-3 px-8 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-emerald-500" aria-hidden />
              <span>
                Lendo o PDF… página {progress.done} de {progress.total || '…'}
              </span>
              {/* Barra de progresso real — o index é o custo único; a busca em si é instantânea */}
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Progresso da leitura do PDF"
                className="h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex h-52 flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
              <X className="size-5 text-rose-500" aria-hidden />
              Não consegui abrir o PDF para buscar. Feche e tente de novo — ou use o
              print de página direto na barra.
            </div>
          )}

          {phase === 'ready' && (
            <>
              {!q && (
                <div className="flex h-52 flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
                  <Search className="size-5 text-emerald-500/60" aria-hidden />
                  Material lido: {texts.length} página
                  {texts.length === 1 ? '' : 's'} indexadas. Digite para achar o trecho —
                  a busca ignora acentos e pontuação.
                </div>
              )}

              {q && hits.length === 0 && (
                <div className="flex h-52 flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
                  <SearchX className="size-5 text-muted-foreground/60" aria-hidden />
                  Nada encontrado por “{q}” em {texts.length} página
                  {texts.length === 1 ? '' : 's'}. A busca ignora acentos e pontuação —
                  tente outra forma da palavra.
                </div>
              )}

              {q && hits.length > 0 && (
                <ul role="list" aria-label="Trechos encontrados">
                  {hits.map((h, i) => (
                    <li
                      /* a agulha VIVE na chave: nova busca = novos nós = a
                         fila de trechos NASCE de novo (o stagger re-anima) */
                      key={`${q}-${h.page}-${i}`}
                      data-testid="pdf-search-hit"
                      className="group border-b last:border-b-0 animate-msg-in hover:bg-muted/50"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                        <Badge
                          variant="outline"
                          className="shrink-0 self-start border-emerald-500/40 bg-emerald-500/5 font-medium tabular-nums text-emerald-700 dark:text-emerald-400"
                          title={
                            h.count > 1
                              ? `${h.count} ocorrência${h.count === 1 ? '' : 's'} nesta página (mostrando os primeiros trechos)`
                              : `Página ${h.page}`
                          }
                        >
                          pág. {h.page}
                          {h.count > 1 && <span className="text-emerald-600/70 dark:text-emerald-400/70"> · {h.count}×</span>}
                        </Badge>
                        {/* Trecho ORIGINAL com o casamento aceso (doutrina t154) */}
                        <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/90">
                          {h.segments.map((seg, k) =>
                            seg.hit ? (
                              <mark
                                key={k}
                                className="rounded-sm bg-amber-300 px-0.5 text-emerald-950"
                              >
                                {seg.text}
                              </mark>
                            ) : (
                              <React.Fragment key={k}>{seg.text}</React.Fragment>
                            ),
                          )}
                        </p>
                        <div className="flex flex-wrap shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-emerald-500/40 px-2.5 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
                            onClick={() => {
                              onJump(h.page);
                              onOpenChange(false);
                            }}
                            title={`Saltar o visualizador para a página ${h.page}`}
                          >
                            Ir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => {
                              onPrint(h.page);
                              onOpenChange(false);
                            }}
                            title={`Abrir o print da página ${h.page} já recortável para o tutor`}
                          >
                            <Camera className="size-3" aria-hidden /> Print
                          </Button>
                          {/* t158 — A PERGUNTA QUE NASCE DO TRECHO: o último
                              gesto da cadeia (achar → saltar → printar →
                              PERGUNTAR). t159: a pergunta leva a PÁGINA junto
                              (chip removível no composer) — pré-preenchida, o
                              aluno revisa e envia; nada sai sem a mão dele. */}
                          <Button
                            size="sm"
                            className="h-8 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-70"
                            disabled={askingPage !== null}
                            onClick={() => void askWithPage(h)}
                            title={`Perguntar ao tutor sobre este trecho da página ${h.page} (a pergunta e a página entram no campo para você revisar e enviar)`}
                          >
                            {askingPage === h.page ? (
                              <Loader2 className="size-3 animate-spin" aria-hidden />
                            ) : (
                              <MessageCircleQuestion className="size-3" aria-hidden />
                            )}
                            {askingPage === h.page ? 'Preparando…' : 'Perguntar'}
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Rodapé: a conta honesta do que foi achado — t159 soma as
            ocorrências reais (count por página da t158); no teto, o número
            vira piso com "+" (o cap de exibição não mente). */}
        <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span
            className={cn('tabular-nums', phase !== 'ready' && 'opacity-60')}
            title={
              q && hits.length > 0
                ? `Ocorrências somadas de todas as páginas com trecho${hitsCapped ? ' — a lista para em 80 trechos, o total é maior' : ''}`
                : undefined
            }
          >
            {phase === 'ready'
              ? q
                ? hits.length > 0
                  ? (
                    <>
                      {hits.length} trecho{hits.length === 1 ? '' : 's'} em {pagesWithHits} página
                      {pagesWithHits === 1 ? '' : 's'} ·{' '}
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {hitsCapped ? '+' : ''}
                        {totalOccurrences} ocorrência{totalOccurrences === 1 ? '' : 's'}
                      </span>
                    </>
                  )
                  : '0 trechos'
                : `${texts.length} página${texts.length === 1 ? '' : 's'} indexadas`
              : 'indexando…'}
          </span>
          <span className="hidden sm:inline">Enter corre para o 1º trecho · Esc fecha</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
