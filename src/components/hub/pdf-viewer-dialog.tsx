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
  BookMarked,
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
  Search,
  X,
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
import { openTutor } from '@/lib/hub-events';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { pdfJumpSrc, clampPdfPage } from '@/lib/pdf-search';
import { rememberPdfPage, recallPdfPage } from '@/lib/pdf-position';
import { TutorQuickPanel } from './tutor-quick-panel';
import { PdfPageCaptureDialog } from './pdf-page-capture-dialog';
import { PdfSearchDialog } from './pdf-search-dialog';

interface Props {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * t162 — página pedida por um convite ACEITO FORA do diálogo (o botão
   * "continuar" do cartão na lista): abre JÁ saltado para ela, sem oferecer
   * a pill de retomada nesta abertura (o clique JÁ disse "continuar"). O
   * prop morre ao fechar — quem chama zera no onOpenChange.
   */
  initialPage?: number;
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

export function PdfViewerDialog({ material, open, onOpenChange, initialPage }: Props) {
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
  /** Busca no PDF (157): o MAPA — achar o trecho antes de folhear. */
  const [searchOpen, setSearchOpen] = React.useState(false);
  /** Página do salto (157): src do iframe com #page=N — o leitor NATIVO entende. */
  const [jumpPage, setJumpPage] = React.useState<number | null>(null);
  /** Campo "ir para página" — número cru enquanto o dono digita. */
  const [jumpInput, setJumpInput] = React.useState('');
  /** Página pedida pela BUSCA ao print de página (o prop morre ao fechar). */
  const [captureInitialPage, setCaptureInitialPage] = React.useState<number | undefined>(undefined);
  /** Pergunta pedida pela BUSCA ao painel AO LADO (t158 — morre ao consumir). */
  const [panelQuestion, setPanelQuestion] = React.useState<string | null>(null);
  /** Convite de retomada (t161): a página do ÚLTIMO SALTO conhecido — morre
   * ao fechar, ao aceitar e ao dispensar (efêmero, como tudo neste diálogo). */
  const [resumePage, setResumePage] = React.useState<number | null>(null);
  /** t162 — a abertura veio de um convite aceito lá fora: a pill NÃO oferece
   * o que o clique já pediu. Morre no fechar junto com o resto. */
  const [resumeSuppressed, setResumeSuppressed] = React.useState(false);

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
  // mobile, salto e busca). Modo e largura PERMANECEM — é a preferência do
  // dono. A conversa agora vive no cache de sessão (tutor-thread-cache) —
  // morre só no reload.
  React.useEffect(() => {
    if (!open) {
      setMobileTab('material');
      setUnseen(0);
      setPanelImage(null);
      setSearchOpen(false);
      setJumpPage(null);
      setJumpInput('');
      setCaptureInitialPage(undefined);
      setPanelQuestion(null);
      setResumePage(null);
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
  /**
   * O PDF é BUSCÁVEL/SALTÁVEL (t157): arquivo real de PDF — imagem, página
   * web e exemplo .html não têm texto pdf.js para indexar nem página para
   * saltar (o gate do print de página ganhou a imagem e o html).
   */
  const pdfSearchable =
    !!material?.pdfPath && material.type !== 'web_page' && !isImage && !isHtmlFile;

  // ===== O MAPA DO PDF (157) — achar, saltar e printar são o mesmo gesto.
  // O salto fala o ÚNICO idioma que o leitor nativo entende: #page=N no src
  // do iframe. Re-saltar para a MESMA página recomeça o src (o leitor não
  // avisaria nada se o src não mudasse).
  const doJump = React.useCallback(
    (n: number) => {
      if (!material?.pdfPath) return;
      const max = material.pages;
      const p = clampPdfPage(n, max);
      if (!p) {
        toast.error('Digite um número de página (1 ou mais).');
        return;
      }
      if (max && max >= 1 && n > max) {
        toast.info(`Este PDF tem ${max} páginas — abrindo a ${p}.`);
      }
      // t161 — O LEITOR LEMBRA: o salto despachado é a posição mais honesta
      // que o Hub conhece (o leitor nativo não reporta rolagem ao pai).
      rememberPdfPage(material.id, p, max);
      setJumpPage((cur) => {
        if (cur === p) {
          requestAnimationFrame(() => setJumpPage(p)); // mesmo destino: força o salto de novo
          return null;
        }
        return p;
      });
    },
    [material],
  );

  /** Print vindo da BUSCA: fecha o mapa, abre a captura já parada na página. */
  const openCaptureAt = React.useCallback((page?: number) => {
    setCaptureInitialPage(page);
    setCaptureOpen(true);
  }, []);

  /** Pergunta vinda da BUSCA no MODO DIVIDIDO (t158): o texto entra no campo
   * do painel AO LADO — no mobile a aba Tutor abre sozinha (a pergunta está
   * lá). t159: a PÁGINA do trecho entra no MESMO painel pelo tubo do print
   * (externalImage) — chip removível, a mão do aluno continua sendo a única
   * que envia. Sem o painel ao lado, o mapa usa openTutor (chat principal). */
  const handleQuestionAttach = React.useCallback((question: string, image?: string) => {
    setPanelQuestion(question);
    if (image) setPanelImage(image);
    if (window.innerWidth < 1024) setMobileTab('tutor');
  }, []);
  const askMainChat = React.useCallback(
    (question: string, image?: string) => {
      if (!material) return;
      openTutor({
        question,
        image,
        disciplineCode: material.disciplineCode,
        materialId: material.id,
      });
    },
    [material],
  );

  /** src do iframe — caminho puro, ou com o #page=N do salto. */
  const iframeSrc = pdfJumpSrc(material?.pdfPath ?? '', jumpPage);

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

  // ===== O LEITOR LEMBRA (t161) + O CONVITE ACEITO LÁ FORA (t162): ao abrir
  // um PDF buscável, o Hub lê a posição do último salto e oferece o CONVITE
  // de retomada — nunca um auto-salto escondido. EXCEÇÃO honesta: quando a
  // abertura veio do botão "continuar" do cartão (initialPage), o clique JÁ
  // declarou a intenção — o diálogo abre saltado e a pill cala. Material sem
  // busca/página ou diálogo fechado: tudo morre (efêmero como sempre).
  React.useEffect(() => {
    if (!open) {
      setResumePage(null);
      setResumeSuppressed(false);
      return;
    }
    if (material && pdfSearchable) {
      const ip = clampPdfPage(initialPage ?? null, material.pages);
      if (ip && ip > 1) {
        setResumeSuppressed(true);
        setResumePage(null);
        doJump(ip);
        return;
      }
    }
    setResumeSuppressed(false);
    setResumePage(material && pdfSearchable ? recallPdfPage(material.id, material.pages) : null);
  }, [open, material, pdfSearchable, initialPage, doJump]);

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
          {pdfSearchable && (
            <>
              {/* t157 — BUSCAR NO PDF: a agulha em TODAS as páginas sem
                  folhear; achar → ir (salta) → print (captura já parada). */}
              <Button
                size="sm"
                variant="outline"
                className={touchBtn}
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar texto no PDF"
                title="Buscar em todas as páginas do PDF — ignora acentos e pontuação (logica acha Lógica)"
              >
                <Search className="size-3.5" /> Buscar no PDF
              </Button>
              {/* t157 — IR PARA PÁGINA: o único idioma de salto do leitor
                  nativo é #page=N; o campo é pequeno e o Enter despacha. */}
              <div
                role="group"
                aria-label="Ir para página"
                className={cn(
                  'flex items-stretch overflow-hidden rounded-md border border-input bg-transparent',
                  'focus-within:ring-2 focus-within:ring-emerald-500/50',
                )}
              >
                <input
                  type="number"
                  min={1}
                  max={material.pages ?? undefined}
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      doJump(Number(jumpInput));
                    }
                  }}
                  placeholder="pág."
                  aria-label="Número da página para saltar"
                  className={cn(
                    'w-14 bg-transparent px-2 text-xs tabular-nums outline-none',
                    'placeholder:text-muted-foreground/60',
                    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                  )}
                />
                <button
                  type="button"
                  onClick={() => doJump(Number(jumpInput))}
                  className="border-l border-input px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                  title="Saltar o visualizador para a página"
                >
                  ir
                </button>
              </div>
            </>
          )}
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
                'relative flex min-h-0 min-w-0 flex-col bg-muted',
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
                  src={iframeSrc}
                  title={material.title}
                  className="min-h-0 w-full flex-1 bg-muted"
                />
              )}

              {/* t161 — O CONVITE DE RETOMADA: pill flutuante sobre o PDF,
                  centrada no rodapé (onde a leitura acontece, longe da barra
                  do leitor nativo). pointer-events-none no casulo: rolar e
                  ler NUNCA é bloqueado; só a pill captura o clique. */}
              {pdfSearchable && !resumeSuppressed && resumePage !== null && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
                  <div
                    data-testid="pdf-resume-pill"
                    className="pointer-events-auto flex animate-msg-in items-center gap-1 rounded-full border border-emerald-500/40 bg-background/95 py-1 pl-3 pr-1 shadow-lg backdrop-blur"
                  >
                    <BookMarked className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <button
                      type="button"
                      onClick={() => {
                        doJump(resumePage);
                        setResumePage(null); // aceito = o convite cumpriu o papel
                      }}
                      className="rounded-full px-1.5 py-0.5 text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-emerald-300 dark:hover:text-emerald-200"
                      title={`O Hub lembra do seu último salto nesta leitura — voltar à página ${resumePage}`}
                      data-testid="pdf-resume-jump"
                    >
                      Continuar da página {resumePage}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumePage(null)}
                      aria-label="Dispensar o convite de retomada"
                      title="Dispensar — a leitura recomeça da página 1 desta sessão"
                      className="mr-0.5 grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      data-testid="pdf-resume-dismiss"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </div>
                </div>
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
                materialType={material.type}
                material={material}
                showHeader={isSplit}
                externalImage={panelImage}
                onExternalImageConsumed={consumePanelImage}
                externalQuestion={panelQuestion}
                onExternalQuestionConsumed={() => setPanelQuestion(null)}
                onAssistantReply={handleAssistantReply}
                onPdfCaptureAttach={handleCaptureAttach}
                className="min-h-0 flex-1"
              />
            </div>
          </div>
        </div>

        {/* Print de página (139): pdf.js renderiza a página EXATA em 2× e o jpeg
            entra direto no chat do tutor — sem seletor de tela, sem recorte,
            sem arquivo no disco (o canvas morre com o diálogo). No modo
            dividido o anexo vai para o painel AO LADO (onAttach). t157: a
            BUSCA pede a página inicial (initialPage) — achar → print é 1 gesto. */}
        <PdfPageCaptureDialog
          material={material}
          open={captureOpen}
          onOpenChange={(o) => {
            setCaptureOpen(o);
            if (!o) setCaptureInitialPage(undefined); // a próxima abertura não herda página velha
          }}
          onAttach={isSplit ? handleCaptureAttach : undefined}
          initialPage={captureInitialPage}
        />

        {/* t157 — O MAPA DO PDF: busca em todas as páginas (pdf.js), com salto
            (#page=N no leitor nativo) e ponte direta para o print de página.
            t158: "Perguntar" completa a cadeia — no dividido a pergunta nasce
            no campo do painel AO LADO; fora dele, vai ao chat principal.
            t159: a pergunta leva a PÁGINA do trecho junto (imagem + texto no
            MESMO tubo — painel ou openTutor; o chip morre no envio). */}
        <PdfSearchDialog
          material={material}
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onJump={doJump}
          onPrint={openCaptureAt}
          onAsk={isSplit ? handleQuestionAttach : askMainChat}
        />
      </DialogContent>
    </Dialog>
  );
}
