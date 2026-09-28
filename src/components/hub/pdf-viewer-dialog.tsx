'use client';

// Visualizador de material + TUTOR EM TELA DIVIDIDA (142, pedido direto do
// dono: "tirar dúvidas e ler enquanto dá para ver o PDF perfeitamente — um
// split screen, porque um abaixo do outro rouba espaço do outro").
//
// Dois modos:
//   • pdf   — só o material, altura cheia (ler sem distração).
//   • split — PDF de um lado, tutor do OUTRO (desktop: colunas com divisor
//             arrastável; mobile: abas de TELA CHEIA — 52vh/28vh empilhados
//             acabaram). A escolha e a largura da divisão ficam lembradas.
//
// O painel do tutor fica MONTADO nos dois modos (só muda a visibilidade):
// trocar de modo não apaga a conversa — e desde a t144 ela SOBREVIVE ao
// fechar do diálogo (cache de sessão por material, lib/tutor-thread-cache):
// reabrir o mesmo PDF reidrata o fio. O "Print de página" no modo dividido
// ancora o anexo no painel AO LADO (onAttach) em vez de abrir o chat
// principal por cima.

import * as React from 'react';
import {
  BotMessageSquare,
  Camera,
  CheckCircle2,
  ChevronsLeftRight,
  Circle,
  Download,
  ExternalLink,
  FileText,
  GripVertical,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Material, Discipline } from '@/data/course-data';
import { getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { downloadPdf } from '@/lib/download-utils';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { TutorQuickPanel } from './tutor-quick-panel';
import { PdfPageCaptureDialog } from './pdf-page-capture-dialog';

interface Props {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Botões de ação: alvo de toque ≥44px no mobile, compacto no desktop. */
const touchBtn = 'h-11 sm:h-8';

/** Preferência do modo dividida lembrada entre aberturas (dono decide uma vez). */
const SPLIT_KEY = 'hub:pdf-split';
const SPLIT_PCT_KEY = 'hub:pdf-split-pct';
/** Dica de arraste do divisor — uma vez na vida do navegador (descoberta). */
const SPLIT_HINT_KEY = 'hub:pdf-split-hint';
/** Limites do divisor — nem PDF minúsculo, nem chat de coluna apertada. */
const PCT_MIN = 30;
const PCT_MAX = 72;
const clampPct = (v: number) => Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(v)));

/** Rótulo legível do tipo exibido no cabeçalho do dialog. */
const TYPE_LABEL: Record<Material['type'], string> = {
  slides: 'Slides',
  lista_exercicios: 'Lista de exercícios',
  web_page: 'Página web',
  introducao: 'Introdução',
  ementa: 'Ementa',
  video: 'Vídeo',
  pdf: 'PDF',
  image: 'Imagem',
  calendar: 'Calendário',
  exemplo: 'Exemplo de código',
};

export function PdfViewerDialog({ material, open, onOpenChange }: Props) {
  const sp = useStudyProgress();
  /** Modo do workspace — 'split' é lembrado no localStorage (hidrata no mount). */
  const [mode, setMode] = React.useState<'pdf' | 'split'>('pdf');
  /** Largura do painel do MATERIAL em % (o tutor leva o resto). */
  const [splitPct, setSplitPct] = React.useState(58);
  /** Abas do mobile (< lg): o painel ocupa a tela INTEIRA, um por vez. */
  const [mobileTab, setMobileTab] = React.useState<'material' | 'tutor'>('material');
  /** Respostas não vistas — ponto na aba Tutor enquanto o aluno lê o PDF. */
  const [unseen, setUnseen] = React.useState(0);
  /** Print de página ancorado no painel AO LADO (modo dividido). */
  const [panelImage, setPanelImage] = React.useState<string | null>(null);
  /** Drag do divisor em curso (para o grip acender e o texto não selecionar). */
  const [dragging, setDragging] = React.useState(false);
  /** Dica de arraste (1ª vez no modo dividido — some ao interagir ou em 6s). */
  const [dragHint, setDragHint] = React.useState(false);
  /** Print de página (139): seletor pdf.js → página exata → tutor, sem arquivo. */
  const [captureOpen, setCaptureOpen] = React.useState(false);

  const rowRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef(false);

  // Preferências do dono (modo + largura) entram DEPOIS do mount — sem brigar
  // com a hidratação; a escolha de uma sessão vale para as próximas.
  React.useEffect(() => {
    try {
      if (localStorage.getItem(SPLIT_KEY) === '1') setMode('split');
      const p = Number(localStorage.getItem(SPLIT_PCT_KEY));
      if (p >= PCT_MIN && p <= PCT_MAX) setSplitPct(Math.round(p));
      if (localStorage.getItem(SPLIT_HINT_KEY) !== '1') setDragHint(true);
    } catch {
      /* storage indisponível — padrões servem */
    }
  }, []);

  /** A dica cumpriu o papel (interação ou tempo) — nunca mais na vida. */
  const dismissDragHint = React.useCallback(() => {
    setDragHint(false);
    try {
      localStorage.setItem(SPLIT_HINT_KEY, '1');
    } catch {
      /* sem storage — a dica só volta na próxima sessão */
    }
  }, []);

  // Ao fechar: o EFÊMERO morre (anexo pendente, ponto de resposta, aba do
  // mobile). Modo e largura PERMANECEM — é a preferência do dono. A conversa
  // agora vive no cache de sessão (tutor-thread-cache) — morre só no reload.
  React.useEffect(() => {
    if (!open) {
      setMobileTab('material');
      setUnseen(0);
      setPanelImage(null);
    }
  }, [open]);

  const remember = React.useCallback((m: 'pdf' | 'split', pct: number) => {
    try {
      localStorage.setItem(SPLIT_KEY, m === 'split' ? '1' : '0');
      localStorage.setItem(SPLIT_PCT_KEY, String(pct));
    } catch {
      /* storage indisponível — a preferência só não sobrevive à sessão */
    }
  }, []);

  const toggleSplit = () => {
    setMode((prev) => {
      const next = prev === 'split' ? 'pdf' : 'split';
      if (next === 'split') setMobileTab('material');
      remember(next, splitPct);
      return next;
    });
  };

  // ===== DIVISOR ARRASTÁVEL (desktop) — pointer events com capture: o drag
  // continua mesmo com o ponteiro saindo da trilha; ←/→ afina pelo teclado.
  // pctRef guarda o valor VIVO: o pointerup persiste o valor da ÚLTIMA
  // posição, não o da closure (drag rápido em um mesmo frame não mente).
  const pctRef = React.useRef(splitPct);

  const applyPct = React.useCallback(
    (v: number, persist: boolean) => {
      const next = clampPct(v);
      pctRef.current = next;
      setSplitPct(next);
      if (persist) remember(mode, next);
    },
    [mode, remember],
  );

  const onDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dismissDragHint();
    // capture: o drag segue mesmo com o ponteiro fora da trilha — mas nem
    // todo pointerId é capturável (leitor de tela/toque indireto): a régua
    // continua funcionando sem ele, só menos teimosa.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sem capture — o move direto na trilha continua servindo */
    }
    dragRef.current = true;
    setDragging(true);
  };
  const onDividerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    applyPct(((e.clientX - rect.left) / rect.width) * 100, false);
  };
  const onDividerPointerEnd = () => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setDragging(false);
    remember(mode, pctRef.current);
  };
  const onDividerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      dismissDragHint();
      applyPct(pctRef.current - 2, true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      dismissDragHint();
      applyPct(pctRef.current + 2, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      dismissDragHint();
      applyPct(PCT_MIN, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      dismissDragHint();
      applyPct(PCT_MAX, true);
    }
  };

  // ===== Anexo do print de página DENTRO do modo dividido: a imagem nasce
  // no painel ao lado (no mobile, a aba Tutor abre sozinha — o anexo está lá).
  const consumePanelImage = React.useCallback(() => setPanelImage(null), []);
  const handleCaptureAttach = React.useCallback((image: string) => {
    setPanelImage(image);
    if (window.innerWidth < 1024) setMobileTab('tutor');
  }, []);
  const handleAssistantReply = React.useCallback(() => setUnseen((u) => u + 1), []);
  const goToTutorTab = React.useCallback(() => {
    setMobileTab('tutor');
    setUnseen(0);
  }, []);

  const markAccessed = sp.markAccessed;
  const markCompleted = sp.markCompleted;
  const unmarkCompleted = sp.unmarkCompleted;
  const isCompleted = sp.progress.completedMaterials.includes(material?.id ?? '');
  const discipline: Discipline | undefined = material
    ? getDisciplineByCode(material.disciplineCode)
    : undefined;
  const color = getColorClasses(discipline?.color ?? 'slate');
  const isImage = material?.type === 'image';
  // Arquivos de exemplo (.html) não são PDF — rótulo do botão de download honesto.
  const isHtmlFile = material?.pdfPath?.endsWith('.html') ?? false;
  const isSplit = mode === 'split';

  // A dica se retira sozinha — mas o relógio é do DIVISOR, não do diálogo:
  // 6s de dividido aberto para ser vista sem virar ruído (alternar de modo
  // zera o contador; quem interage com a régua a aposenta na hora).
  React.useEffect(() => {
    if (!dragHint || !isSplit) return;
    const t = setTimeout(dismissDragHint, 6000);
    return () => clearTimeout(t);
  }, [dragHint, isSplit, dismissDragHint]);

  React.useEffect(() => {
    if (open && material) {
      markAccessed(material.id);
    }
  }, [open, material, markAccessed]);

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 p-0',
          isSplit
            ? // TELA DIVIDIDA: workspace quase inteiro — os dois lados ganham
              // espaço de verdade (a caixa de 4xl apertava os dois).
              'flex h-[94vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col sm:h-[92vh] sm:max-w-[calc(100vw-1.5rem)]'
            : 'max-w-4xl sm:max-w-4xl',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 border-b p-4 pr-12',
            color.bgSoft,
            color.borderAll,
          )}
        >
          <div
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-md bg-card shadow-sm',
              color.text,
            )}
          >
            {isImage ? <ImageIcon className="size-4.5" /> : <FileText className="size-4.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base leading-tight">
              {material.title}
            </DialogTitle>
            <DialogDescription className="mt-0.5 flex items-center gap-2 text-xs">
              <Badge variant="outline" className={cn('border', color.badge)}>
                {discipline?.shortName ?? material.disciplineCode}
              </Badge>
              {material.pages ? <span>{material.pages} páginas</span> : null}
              <span className="hidden sm:inline">{TYPE_LABEL[material.type]}</span>
            </DialogDescription>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b bg-muted/40 p-3">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className={touchBtn}
          >
            <a href={material.pdfPath} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" /> Abrir em nova aba
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={touchBtn}
            onClick={() => {
              if (!material.pdfPath) return;
              const filename = material.pdfPath.split('/').pop() ?? 'arquivo';
              downloadPdf(material.pdfPath, filename);
              toast.success('Download iniciado');
            }}
          >
            <Download className="size-3.5" />{' '}
            {isImage ? 'Baixar imagem' : isHtmlFile ? 'Baixar HTML' : 'Baixar PDF'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(touchBtn, 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300')}
            onClick={() => setCaptureOpen(true)}
            disabled={!material.pdfPath || material.type === 'web_page'}
            aria-label="Print de página para o tutor"
            title="Print de página — escolha a página e anexe ao tutor (nada é salvo no seu computador)"
          >
            <Camera className="size-3.5" /> Print de página
          </Button>
          <Button
            size="sm"
            variant={isSplit ? 'default' : 'outline'}
            className={cn(touchBtn, isSplit && 'bg-emerald-600 text-white hover:bg-emerald-700')}
            aria-pressed={isSplit}
            onClick={toggleSplit}
            title={
              isSplit
                ? 'Tela dividida ligada — material de um lado, tutor do outro (clique para voltar ao material cheio)'
                : 'Tela dividida — leia o material e converse com o tutor AO LADO, sem um roubar espaço do outro'
            }
          >
            <BotMessageSquare className="size-3.5" /> Tela dividida
          </Button>
          <Button
            size="sm"
            variant={isCompleted ? 'outline' : 'default'}
            className={cn(touchBtn, !isCompleted && 'bg-emerald-600 text-white hover:bg-emerald-700')}
            aria-pressed={isCompleted}
            onClick={() => {
              if (isCompleted) {
                unmarkCompleted(material.id, material.disciplineCode);
                toast.success('Marcado como não concluído');
              } else {
                markCompleted(material.id, material.disciplineCode);
                toast.success('Marcado como concluído!');
              }
            }}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden /> Concluído
              </>
            ) : (
              <>
                <Circle className="size-3.5" aria-hidden /> Marcar concluído
              </>
            )}
          </Button>
        </div>

        {/* ===== Corpo do workspace ===== */}
        <div className="flex min-h-0 flex-1 flex-col">
          {isSplit && (
            /* Abas do mobile: cada painel TELA CHEIA — o acabamento 52vh/28vh
               que roubava espaço dos dois lados acabou. O ponto emerald marca
               resposta chegando enquanto o aluno está no material. */
            <div
              role="tablist"
              aria-label="Alternar entre material e tutor"
              className="flex gap-1 border-b bg-muted/40 p-1.5 lg:hidden"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mobileTab === 'material'}
                onClick={() => setMobileTab('material')}
                className={cn(
                  'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
                  mobileTab === 'material'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <FileText className="size-3.5" aria-hidden /> Material
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileTab === 'tutor'}
                onClick={goToTutorTab}
                className={cn(
                  'relative inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
                  mobileTab === 'tutor'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <BotMessageSquare className="size-3.5" aria-hidden /> Tutor IA
                {mobileTab === 'material' && unseen > 0 && (
                  <span
                    aria-hidden
                    className="absolute right-2 top-1/2 size-2 -translate-y-1/2 animate-pulse rounded-full bg-emerald-500"
                  />
                )}
              </button>
            </div>
          )}

          <div
            ref={rowRef}
            className={cn(
              'flex min-h-0 flex-1',
              isSplit && 'flex-col lg:flex-row',
              dragging && 'cursor-col-resize select-none',
            )}
            style={isSplit ? ({ '--split-pct': `${splitPct}%` } as React.CSSProperties) : undefined}
          >
            {/* ===== Painel do material (sempre montado — o PDF não recarrega) ===== */}
            <div
              data-split-pane="material"
              className={cn(
                'flex min-h-0 min-w-0 flex-col bg-muted',
                isSplit
                  ? cn(
                      // mobile: tela cheia na própria aba · desktop: coluna com a % lembrada
                      mobileTab === 'material' ? 'flex-1' : 'hidden lg:flex',
                      'lg:w-[var(--split-pct)] lg:flex-none',
                    )
                  : 'h-[80vh] w-full',
              )}
            >
              {isImage ? (
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2">
                  <img
                    src={material.pdfPath}
                    alt={material.title}
                    className="max-h-full max-w-full rounded-md object-contain shadow-md"
                  />
                </div>
              ) : (
                <iframe
                  src={material.pdfPath}
                  title={material.title}
                  className="min-h-0 w-full flex-1 bg-muted"
                />
              )}
            </div>

            {/* ===== Divisor arrastável (desktop, só no modo dividido) ===== */}
            {isSplit && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionar os painéis de material e tutor"
                aria-valuemin={PCT_MIN}
                aria-valuemax={PCT_MAX}
                aria-valuenow={splitPct}
                /* Leitor de tela lê PARTES, não número cru: quem regula é
                   o dono — o par material/tutor é o que a régua manipula. */
                aria-valuetext={`Material ${splitPct}% · Tutor ${100 - splitPct}%`}
                tabIndex={0}
                onPointerDown={onDividerPointerDown}
                onPointerMove={onDividerPointerMove}
                onPointerUp={onDividerPointerEnd}
                onPointerCancel={onDividerPointerEnd}
                onKeyDown={onDividerKeyDown}
                onBlur={onDividerPointerEnd}
                style={{ touchAction: 'none' }}
                className={cn(
                  'group relative hidden w-1.5 shrink-0 cursor-col-resize border-x bg-border/50 transition-colors hover:bg-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60 lg:block',
                  dragging && 'bg-emerald-500/50',
                )}
              >
                <span className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
                  <GripVertical
                    className={cn(
                      'size-4 text-muted-foreground/40 transition-colors group-hover:text-emerald-500/70',
                      dragging && 'text-emerald-500',
                    )}
                    aria-hidden
                  />
                </span>

                {/* Leitura viva do drag: a partilha em % no ponto exato do
                    gesto — acaba com a adivinhação de "quanto já tenho de
                    cada lado"; some ao soltar (não é enfeite permanente). */}
                {dragging && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background px-2 py-1 text-[11px] font-medium tabular-nums text-foreground shadow-md"
                  >
                    Material {splitPct}% · Tutor {100 - splitPct}%
                  </span>
                )}

                {/* Primeira descoberta (t144): sem dica, um divisor de 6px
                    parece divisória de mesa. Mostra UMA vez; interação ou
                    6s a aposentam para sempre (SPLIT_HINT_KEY). */}
                {dragHint && !dragging && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-medium text-white shadow-lg animate-msg-in"
                  >
                    <ChevronsLeftRight className="size-3" /> arraste para ajustar
                  </span>
                )}
              </div>
            )}

            {/* ===== Painel do tutor (montado nos dois modos — trocar de modo
                    NÃO apaga a conversa; em 'pdf' ele só fica invisível) ===== */}
            <div
              data-split-pane="tutor"
              className={cn(
                'min-h-0 min-w-0 flex-col',
                isSplit
                  ? cn(
                      'border-t lg:border-l lg:border-t-0',
                      mobileTab === 'tutor' ? 'flex flex-1' : 'hidden lg:flex lg:flex-1',
                    )
                  : 'hidden',
              )}
            >
              <TutorQuickPanel
                discipline={discipline?.name ?? material.disciplineCode}
                disciplineCode={material.disciplineCode}
                materialTitle={material.title}
                materialId={material.id}
                showHeader={isSplit}
                externalImage={panelImage}
                onExternalImageConsumed={consumePanelImage}
                onAssistantReply={handleAssistantReply}
                className="min-h-0 flex-1"
              />
            </div>
          </div>
        </div>

        {/* Print de página (139): pdf.js renderiza a página EXATA em 2× e o jpeg
            entra direto no chat do tutor — sem seletor de tela, sem recorte,
            sem arquivo no disco (o canvas morre com o diálogo). No modo
            dividido o anexo vai para o painel AO LADO (onAttach). */}
        <PdfPageCaptureDialog
          material={material}
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          onAttach={isSplit ? handleCaptureAttach : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}
