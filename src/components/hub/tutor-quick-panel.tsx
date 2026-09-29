'use client';

// Painel rápido do Tutor IA — embutido em diálogos (ex.: visualizador de PDF)
// para tirar dúvidas sobre o material aberto SEM sair do contexto.
// Envia os mesmos dados do Hub (professor, datas, progresso) que o chat da aba Estudar.

import * as React from 'react';
import { toast } from 'sonner';

import { Bot, Camera, Check, Copy, CornerDownLeft, Download, FileScan, ImagePlus, Lightbulb, Loader2, RotateCcw, Sparkles, Target, Trash2, TriangleAlert, User, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { buildHubContext } from '@/lib/tutor-context';
import { downscaleImageFile, imageFromClipboard } from '@/lib/tutor-image';
import { looksFragmentedPaste, normalizePdfPaste } from '@/lib/paste-cleanup';
import {
  screenCaptureSupported,
  useScreenCapture,
} from '@/lib/screen-capture';
import { CaptureCropDialog } from './capture-crop-dialog';
import { PdfPageCaptureDialog } from './pdf-page-capture-dialog';
import { PrintLightboxDialog } from './print-lightbox-dialog';
import { streamTutorAnswer, TutorStreamError } from '@/lib/tutor-stream';
import { buildQuizPrompt } from '@/lib/tutor-quiz';
import { buildChatMarkdown, downloadTextFile } from '@/lib/tutor-chat-export';
import { resolveRetryTarget } from '@/lib/tutor-retry';
import {
  clearThread,
  loadThread,
  saveThread,
  threadKey,
} from '@/lib/tutor-thread-cache';
import type { Material } from '@/data/course-data';
import { UserBubbleContent } from './chat-code';
import { TutorMarkdown } from './tutor-markdown';

interface ChatMessage {
  /** Identificador estável para as chaves da lista (append-only). */
  id: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  /** Miniatura do print anexado (só na conversa viva — painel é efêmero). */
  image?: string;
  /** Hora local (HH:MM) — referência discreta na conversa. */
  time?: string;
  /** true → mensagem de erro (falha do provedor/sem key) — estilo rosa + sem ações. */
  error?: boolean;
}

/** Hora local curta (HH:MM) para carimbar mensagens do chat. */
const hhmm = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Sequência de ids do MÓDULO (t144): sobrevive à remontagem do painel — as
 * mensagens hidratadas do cache de sessão recebem ids frescos e as chaves da
 * lista continuam únicas sem efeito de sincronização ou ref extra.
 */
let messageIdSeq = 0;
const freshMessageId = () => ++messageIdSeq;

interface TutorQuickPanelProps {
  discipline: string;
  disciplineCode?: string;
  /** Tópico/material aberto — o tutor conecta a resposta a ele. */
  materialTitle?: string;
  /** id do material no course-data — liga o retrieval (resumo + trechos do PDF). */
  materialId?: string;
  /** Perguntas prontas exibidas como chips antes da 1ª resposta. */
  suggestions?: string[];
  /** Material aberto — quando é PDF, o painel ganha o print DE PÁGINA (t152):
   * pdf.js renderiza a página exata e o recorte acontece SOBRE o PDF, sem
   * seletor de tela — o pedido do dono: "o print deveria ser do pdf quando
   * estou com um aberto". */
  material?: Material;
  /** Tipo do material aberto — os chips de início MUDAM com ele: numa LISTA
   * o aluno não quer "resumir", quer começar a resolver (145). */
  materialType?: Material['type'];
  /** Cabeçalho próprio (título + limpar) — usado no modo tela dividida,
   * onde o painel tem coluna exclusiva e precisa se identificar. */
  showHeader?: boolean;
  /**
   * Imagem anexada por FORA (ex.: "Print de página" capturado no próprio
   * diálogo dividido): entra no mesmo pendingImage dos prints — o tutor
   * lê a página que está sendo vista SEM abrir o chat principal atrás.
   * O dono do estado chama onExternalImageConsumed para zerar a fonte.
   */
  externalImage?: string | null;
  /** Procedência do externalImage (t163): o chip diz de onde o print veio. */
  externalImageLabel?: string | null;
  onExternalImageConsumed?: () => void;
  /**
   * Pergunta nascida de FORA do painel (t158 — "Perguntar" na busca do PDF):
   * pré-preenche o CAMPO do composer (o aluno revisa e envia — a pergunta é
   * dele). O dono do estado chama onExternalQuestionConsumed para zerar a
   * fonte. Irmão do externalImage: o tubo é o mesmo, o que viaja é texto.
   */
  externalQuestion?: string | null;
  onExternalQuestionConsumed?: () => void;
  /** Aviso de resposta: a 1ª parte da resposta chegou — o diálogo marca o
   * ponto não lido na aba Tutor quando o aluno está vendo o PDF no mobile. */
  onAssistantReply?: () => void;
  /** Destino do print de página (t152): quando fornecido, o anexo passa pelo
   * MESMO tubo do externalImage (chip no composer + aba Tutor abre no mobile).
   * Sem o callback, o print fica no composer do próprio painel. t163: leva
   * também o rótulo de procedência fabricado pelo diálogo de captura. */
  onPdfCaptureAttach?: (image: string, label: string) => void;
  className?: string;
}

export function TutorQuickPanel({
  discipline,
  disciplineCode,
  materialTitle,
  materialId,
  suggestions,
  materialType,
  material,
  showHeader,
  externalImage,
  externalImageLabel,
  onExternalImageConsumed,
  externalQuestion,
  onExternalQuestionConsumed,
  onAssistantReply,
  onPdfCaptureAttach,
  className,
}: TutorQuickPanelProps) {
  const sp = useStudyProgress();
  // O FIO SOBREVIVE AO FECHAR (t144): a conversa fica em cache de SESSÃO
  // chaveado pelo material — fechar o diálogo e reabrir o MESMO PDF reidrata
  // o fio (a explicação longa com LaTeX não morre no X); outro material vê
  // só a conversa dele. Recarregou a página, recomeça (memória longa é a do
  // chat principal — aqui é produtividade de sessão, não persistência).
  const threadCacheKey = threadKey(materialId, disciplineCode, discipline);
  const [messages, setMessages] = React.useState<ChatMessage[]>(() =>
    loadThread(threadCacheKey).map((m) => ({ ...m, id: freshMessageId() })),
  );
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  /**
   * Resposta em streaming. VERDADE DO TUBO (descoberta na t149): o turno do
   * painel PASSA pelo mesmo POST /api/tutor e É salvo no histórico da
   * disciplina — a dúvida com material é estudo (t123) e reaparece no chat
   * principal. O que é efêmero é só o CACHE de reidratação do painel
   * (thread-cache de sessão); o banco guarda a memória longa da disciplina.
   */
  const [streamText, setStreamText] = React.useState<string | null>(null);
  /** Print/foto anexado à próxima mensagem (data URL reduzido no navegador). */
  const [pendingImage, setPendingImage] = React.useState<string | null>(null);
  /** Procedência do print pendente (t163): o chip diz ONDE ele nasceu —
   * "print de tela", "página 3 · Lista de Matrizes", "print colado"… Só
   * memória: morre junto com o anexo no envio (ou no X do chip). */
  const [pendingLabel, setPendingLabel] = React.useState<string | null>(null);
  // t160: o print que se lê de novo — bolha e chip abrem o lightbox (só visão).
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);
  /** Captura de tela em recorte (o frame bruto vive aqui até o diálogo fechar). */
  const [captureCanvas, setCaptureCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  /** Print de PÁGINA do PDF aberto (t152) — a via sem seletor de tela. */
  const [pdfCaptureOpen, setPdfCaptureOpen] = React.useState(false);
  const { capturing, startCapture } = useScreenCapture(
    React.useCallback((canvas: HTMLCanvasElement) => {
      setCaptureCanvas(canvas);
      setCaptureOpen(true);
    }, []),
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  /** t158: foco do composer quando a pergunta nasce na busca do PDF. */
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  /** Ref do input de CÂMERA (fallback mobile da captura — ver camFileRef). */
  const camFileRef = React.useRef<HTMLInputElement>(null);
  /** getDisplayMedia existe aqui? (SSR renderiza true; o effect corrige no
   * mount — 1º paint do cliente igual ao servidor, zero mismatch.) */
  const [screenOk, setScreenOk] = React.useState(true);
  React.useEffect(() => setScreenOk(screenCaptureSupported()), []);
  /** Modo dica: tutor socrático — pistas antes da solução completa. */
  const [hintMode, setHintMode] = React.useState(false);
  // t149: feedback visual do "copiar" — a resposta copiada vira ✓ copiado por 2s.
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  // Anexa mensagem com id único (sequência do módulo — sobrevive à remontagem).
  const appendMessage = React.useCallback((msg: Omit<ChatMessage, 'id'>) => {
    const id = freshMessageId();
    setMessages((m) => [...m, { ...msg, id }]);
  }, []);

  // Espelha a conversa viva no cache de sessão (sem bolhas de erro — o
  // tutor-thread-cache filtra; escrever é barato e idempotente).
  React.useEffect(() => {
    saveThread(threadCacheKey, messages);
  }, [messages, threadCacheKey]);

  /** Limpa a conversa efêmera do painel (o aluno recomeça a dúvida). */
  const clearConversation = () => {
    setMessages([]);
    setStreamText(null);
    notifiedRef.current = false;
    clearThread(threadCacheKey);
  };

  /** Anexo vindo de FORA do painel (print de página no modo dividido):
   * entra no MESMO pendingImage dos prints — vida efêmera igual. t163: o
   * rótulo de procedência vem junto (o pai sabe de onde o print veio). */
  React.useEffect(() => {
    if (externalImage) {
      setPendingImage(externalImage);
      setPendingLabel(externalImageLabel ?? 'print do material');
      onExternalImageConsumed?.();
    }
  }, [externalImage, externalImageLabel, onExternalImageConsumed]);

  /** Pergunta vinda de FORA (t158 — a busca do PDF): pré-preenche o campo,
   * traz o foco para o composer e morre na fonte. O aluno revisa e envia —
   * nada é despachado sem a mão dele (o campo é do dono). */
  React.useEffect(() => {
    if (externalQuestion) {
      setInput(externalQuestion);
      onExternalQuestionConsumed?.();
      textareaRef.current?.focus();
    }
  }, [externalQuestion, onExternalQuestionConsumed]);

  /** Notifica "resposta chegou" UMA vez por turno — o ponto da aba Tutor. */
  const notifiedRef = React.useRef(false);

  const defaultSuggestions = React.useMemo(
    () =>
      materialType === 'lista_exercicios'
        ? // Numa LISTA o 1º gesto real é começar a resolver — "resuma a lista"
          // não é pergunta que aluno faz; e o retrieval (139) ancora "questão
          // N" no material certo, então os chips funcionam de ponta a ponta.
          [
            materialTitle
              ? `Como eu começo a ${materialTitle}? Me dá a estratégia.`
              : 'Como eu começo esta lista? Me dá a estratégia.',
            'Me explica a questão 1 passo a passo',
            'Quais questões desta lista são parecidas com as da prova?',
          ]
        : [
            materialTitle ? `Resuma o material "${materialTitle}"` : 'Resuma o tópico atual',
            'Quais pontos costumam cair na prova?',
            'Dê um exemplo prático',
          ],
    [materialTitle, materialType],
  );
  const chips = suggestions ?? defaultSuggestions;
  const showChips = messages.length === 0 && !loading;

  /** Follow-ups de continuidade: seguir falando do material com 1 toque. */
  const followUps = React.useMemo(
    () => [
      { label: 'Explica de outro jeito', q: 'Explica de outro jeito, mais simples, com outro exemplo.' },
      { label: 'Exemplo do material', q: 'Me dá mais um exemplo tirado do próprio material.' },
      { label: 'Exercício parecido', q: 'Me dá um exercício parecido com isso para eu treinar.' },
    ],
    [],
  );

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, streamText]);

  /** Anexa print/foto da questão — reduzido antes de virar data URL. t163:
   * a origem vem junto — o chip do composer conta de onde o print nasceu. */
  const attachImage = async (file: File | null | undefined, label = 'imagem do arquivo') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Só dá para anexar imagem (print/foto).');
      return;
    }
    try {
      setPendingImage(await downscaleImageFile(file));
      setPendingLabel(label);
    } catch {
      toast.error('Não consegui processar a imagem. Tente outra.');
    }
  };

  /** CAPTURAR A TELA (28/09): pega o frame, abre o recorte, anexa e some —
   * nada vai para a pasta de prints do aluno; os tracks da transmissão
   * param no ato (lib/screen-capture — o hook cuida do seletor que não
   * é cancelável: 2º clique solta a UI). */

  async function ask(
    question: string,
    image: string | null = null,
    keepComposer = false,
  ) {
    const q = question.trim();
    if ((!q && !image) || loading) return;
    // t164: o retry ("tentar de novo") passa keepComposer=true — o rascunho
    // em digitação e o print pendente do AGORA sobrevivem; só o turno antigo
    // é reenviado. Envio normal: composer limpo como sempre.
    if (!keepComposer) {
      setInput('');
      setPendingImage(null);
      setPendingLabel(null);
    }
    notifiedRef.current = false;
    // Memória da conversa: últimas 12 mensagens sem bolhas de erro — o tutor
    // continua o raciocínio anterior em vez de responder algo desconexo.
    // t164: filtro pela FLAG `error` (o farejo do ⚠️ era morto — erros reais
    // nunca começaram com ⚠️; a falha vazava no histórico da IA).
    const history = messages
      .filter((m) => !m.error && !m.content.startsWith('⚠️'))
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));
    appendMessage({
      role: 'user',
      content: q || '📷 print anexado',
      image: image ?? undefined,
      time: hhmm(),
    });
    setLoading(true);
    setStreamText(null);
    try {
      const result = await streamTutorAnswer(
        {
          question: q,
          imageDataUrl: image ?? undefined,
          discipline,
          disciplineCode,
          topic: materialTitle ?? discipline,
          material: materialTitle,
          materialId,
          history,
          hintMode,
          hubContext: buildHubContext(disciplineCode ?? '', sp),
        },
        (_piece, full) => {
          setLoading(false);
          setStreamText(full);
          if (!notifiedRef.current && full.trim()) {
            notifiedRef.current = true;
            onAssistantReply?.();
          }
        },
      );
      appendMessage({ role: 'assistant', content: result.answer, model: result.model, time: hhmm() });
    } catch (err) {
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onAssistantReply?.();
      }
      const partial = err instanceof TutorStreamError ? err.partial : '';
      if (partial.trim()) {
        appendMessage({ role: 'assistant', content: partial, time: hhmm() });
      } else {
        appendMessage({
          role: 'assistant',
          content:
            err instanceof Error
              ? err.message
              : 'Não consegui responder agora. Tente novamente.',
          error: true,
        });
      }
    } finally {
      setLoading(false);
      setStreamText(null);
    }
  }

  /** Baixa a conversa do painel em .md (t149): o fio do painel é EFÊMERO —
   * morre no recarregar da página (t144) — e o download é a ÚNICA forma de
   * levar a explicação embora. Mesmo formato do chat principal (fonte única). */
  const exportPanelChat = () => {
    try {
      downloadTextFile(
        `tutor-painel-${(disciplineCode || discipline).toLowerCase()}-${new Date()
          .toISOString()
          .slice(0, 10)}.md`,
        buildChatMarkdown(
          `Conversa com o Tutor — ${materialTitle || discipline} (painel dividido)`,
          messages,
        ),
      );
      toast.success('Conversa do painel baixada — o painel não guarda histórico ao recarregar.');
    } catch {
      toast.error('Não consegui baixar a conversa agora.');
    }
  };

  /** Copia o texto completo de uma resposta do tutor (pra colar no caderno).
   * O botão responde na hora (✓ copiado, 2s) — o toast continua confirmando. */
  const copyAnswer = (text: string, id: number) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedId(id);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
        toast.success('Resposta copiada.');
      })
      .catch(() => toast.error('Não consegui copiar agora.'));
  };

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {showHeader && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
          <div className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Bot className="size-3.5" aria-hidden />
          </div>
          <p className="min-w-0 flex-1 truncate text-xs font-medium" aria-hidden>
            Tutor IA{materialTitle ? ` · ${materialTitle}` : ''}
          </p>
          <button
            type="button"
            onClick={exportPanelChat}
            disabled={messages.length === 0}
            aria-label="Baixar conversa do painel"
            title="Baixar conversa do painel em Markdown — o painel não guarda histórico ao recarregar"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <Download className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={clearConversation}
            disabled={loading || messages.length === 0}
            aria-label="Limpar conversa do painel"
            title="Limpar conversa do painel"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversa com o tutor"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 [scrollbar-width:thin]"
      >
        {showChips && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-emerald-400" />
              Pergunte ao tutor sobre este material — ele conhece o professor, as datas e seu progresso.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {/* Chip de INVERSÃO DE PAPEL: o tutor pergunta, o aluno responde. */}
              <button
                type="button"
                onClick={() =>
                  ask(
                    buildQuizPrompt({
                      disciplineName: discipline,
                      materialTitle,
                    }),
                  )
                }
                className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 bg-violet-500/10 px-3 py-2 text-xs text-violet-600 transition-all hover:bg-violet-500/20 hover:text-violet-700 active:scale-[0.97] dark:text-violet-300 dark:hover:text-violet-200 sm:py-1.5"
              >
                <Target className="size-3.5 text-violet-500" /> Me testa — recall ativo
              </button>
              {chips.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-border bg-muted/60 px-3 py-2 text-xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500 active:scale-[0.97] dark:hover:text-emerald-400 sm:py-1.5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={m.id}
            className={cn(
              'animate-msg-in flex gap-2',
              m.role === 'user' && 'flex-row-reverse',
            )}
          >
            <div
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full',
                m.role === 'user'
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {m.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
            </div>
            <div
              className={cn(
                'max-w-[88%] rounded-2xl px-3 py-2 shadow-sm',
                m.role === 'user'
                  ? 'whitespace-pre-wrap rounded-tr-sm bg-gradient-to-br from-emerald-600 to-teal-600 text-white'
                  : m.error
                    ? 'rounded-tl-sm border border-rose-500/30 bg-rose-500/5 text-foreground'
                    : 'rounded-tl-sm border border-border/60 bg-muted text-foreground',
              )}
            >
              {m.role === 'user' ? (
                <>
                  <div className="text-sm">
                    <UserBubbleContent content={m.content} />
                  </div>
                  {m.image && (
                    <button
                      type="button"
                      onClick={() => {
                        if (m.image) setLightboxSrc(m.image);
                      }}
                      aria-label="Ver o print em tamanho grande"
                      title="Ver o print em tamanho grande — o clique na imagem alterna o zoom"
                      className="group mt-2 block w-fit cursor-zoom-in overflow-hidden rounded-lg ring-offset-0 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 hover:ring-2 hover:ring-emerald-500/40"
                    >
                      <img
                        src={m.image}
                        alt="Print anexado à dúvida"
                        className="max-h-40 rounded-lg border border-white/20 transition-transform duration-150 group-hover:scale-[1.02]"
                      />
                    </button>
                  )}
                  {m.time && <p className="mt-1 text-right text-[10px] text-white/70">{m.time}</p>}
                </>
              ) : (
                <>
                  {m.error ? (
                    <div className="flex items-start gap-1.5">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ) : (
                    <TutorMarkdown content={m.content} enableCards disciplineCode={disciplineCode} />
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    {m.error && resolveRetryTarget(messages, idx) && (
                      // t164 — A SEGUNDA CHANCE: reenvia a pergunta do par
                      // falhado, com o print se ele ainda vive na conversa.
                      // Append-only: a tentativa falhada fica no fio.
                      <button
                        type="button"
                        onClick={() => {
                          const target = resolveRetryTarget(messages, idx);
                          if (target) void ask(target.content, target.image ?? null, true);
                        }}
                        disabled={loading}
                        aria-label="Tentar de novo — reenvia a pergunta que falhou"
                        title="Reenvia a sua última pergunta (com o print, se ele ainda está na conversa) — nada é apagado, a tentativa falhada continua no fio"
                        className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 transition-colors hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300"
                      >
                        <RotateCcw className="size-3" />
                        tentar de novo
                      </button>
                    )}
                    {m.time && <span className="text-[10px] text-muted-foreground/60">{m.time}</span>}
                    {m.model && (
                      <span className="text-[10px] text-muted-foreground/60">via {m.model}</span>
                    )}
                    {!m.error && (
                      <button
                        type="button"
                        onClick={() => copyAnswer(m.content, m.id)}
                        aria-label="Copiar resposta"
                        title="Copiar resposta"
                        className={cn(
                          'flex items-center gap-1 text-[10px] transition-colors',
                          copiedId === m.id
                            ? 'text-emerald-500 dark:text-emerald-400'
                            : 'text-muted-foreground/60 hover:text-foreground',
                        )}
                      >
                        {copiedId === m.id ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        {copiedId === m.id ? 'copiado' : 'copiar'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> O tutor está pensando…
          </div>
        )}

        {streamText !== null && (
          <div className="flex gap-2">
            <div className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-3.5" />
            </div>
            <div className="max-w-[88%] rounded-xl bg-muted px-3 py-2">
              <TutorMarkdown content={streamText} enableCards disciplineCode={disciplineCode} />
              <span
                className="mt-1 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-emerald-400 align-middle"
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {/* Continuidade: seguir no mesmo assunto com 1 toque. */}
        {!loading && streamText === null && messages.length > 0 &&
          messages[messages.length - 1]?.role === 'assistant' &&
          !messages[messages.length - 1]?.error &&
          !messages[messages.length - 1]?.content.startsWith('⚠️') && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                <Sparkles className="size-3 text-emerald-400" />
                Continuar nesse assunto?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {followUps.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => ask(f.q)}
                    className="rounded-full border border-border bg-muted/60 px-2.5 py-1.5 text-xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500 active:scale-[0.97] dark:hover:text-emerald-400"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
      </div>

      <form
        className="border-t p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input, pendingImage);
        }}
      >
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 pr-2">
            <button
              type="button"
              onClick={() => setLightboxSrc(pendingImage)}
              aria-label="Ver o print em tamanho grande"
              title="Conferir o print antes de enviar — o clique na imagem alterna o zoom"
              className="cursor-zoom-in overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 hover:ring-2 hover:ring-emerald-500/40"
            >
              <img
                src={pendingImage}
                alt="Prévia do print anexado"
                className="size-10 rounded-md object-cover"
              />
            </button>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {pendingLabel ?? 'print anexado'}
              </span>{' '}
              — o tutor lê a imagem antes de responder
            </span>
            <button
              type="button"
              onClick={() => {
                setPendingImage(null);
                setPendingLabel(null);
              }}
              aria-label="Remover imagem anexada"
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void attachImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {/* Câmera nativa — fallback do botão de captura sem getDisplayMedia
              (celular): a foto da questão entra no MESMO tubo (downscale →
              anexo → morre no envio). */}
          <input
            ref={camFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void attachImage(e.target.files?.[0], 'foto da câmera');
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'shrink-0 transition-colors',
              hintMode
                ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 hover:text-amber-400'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setHintMode((v) => !v)}
            disabled={loading}
            aria-pressed={hintMode}
            aria-label="Modo dica"
            title={
              hintMode
                ? 'Modo dica LIGADO — o tutor dá pistas antes da solução (clique p/ desligar)'
                : 'Modo dica — tutor dá pistas antes de resolver (bom pra treinar)'
            }
          >
            <Lightbulb className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            aria-label="Anexar print/foto da questão"
            title="Anexar print/foto — ou cole com Ctrl+V"
          >
            <ImagePlus className="size-4" />
          </Button>
          {material?.pdfPath && material.type !== 'web_page' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-emerald-600 transition-colors hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              onClick={() => setPdfCaptureOpen(true)}
              disabled={loading}
              aria-label="Print de página do PDF para o tutor"
              title="Print direto do PDF — escolha a página, recorte a questão se quiser e anexe. Sem escolher aba/tela, sem seletor do navegador (nada é salvo no seu computador)"
            >
              <FileScan className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'shrink-0 transition-colors',
              capturing
                ? 'text-emerald-500'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => {
              // Com getDisplayMedia → recorte ao vivo da tela. Sem (celular)
              // → CÂMERA NATIVA em vez do toast de erro repetido.
              if (screenOk) void startCapture();
              else camFileRef.current?.click();
            }}
            disabled={loading}
            aria-pressed={screenOk ? capturing : undefined}
            aria-label={
              screenOk
                ? 'Capturar a tela e recortar para o tutor'
                : 'Tirar foto da questão com a câmera e anexar ao tutor'
            }
            title={
              capturing
                ? 'Escolhendo a tela… clique de novo para soltar'
                : screenOk
                  ? 'Capturar a TELA (qualquer coisa fora do PDF) — recorte e anexe (nada é salvo no seu computador)'
                  : 'Sem captura de tela neste navegador — abre a câmera para fotografar a questão (nada é salvo no seu computador)'
            }
          >
            <Camera className={cn('size-4', capturing && 'animate-pulse')} />
          </Button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia · Shift+Enter quebra a linha (padrão do chat principal)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            onPaste={(e) => {
              const f = imageFromClipboard(e);
              if (f) {
                e.preventDefault();
                void attachImage(f, 'print colado');
                return;
              }
              // MESMA régua do chat principal (141): PDF colado rasgado é
              // remontado antes de entrar no campo — o painel rápido é onde
              // o aluno cola de volta do PDF aberto ao lado.
              const t = e.clipboardData.getData('text/plain');
              if (t && looksFragmentedPaste(t)) {
                e.preventDefault();
                const ta = e.currentTarget;
                const pos = ta.selectionStart ?? input.length;
                const end = ta.selectionEnd ?? pos;
                setInput(
                  (input.slice(0, pos) + normalizePdfPaste(t) + input.slice(end)).slice(0, 2000),
                );
                toast.info(
                  'Colagem de PDF organizada — as linhas quebradas foram unidas para a IA ler melhor.',
                );
              }
            }}
            rows={1}
            placeholder={`Dúvida sobre ${materialTitle ?? discipline}? (Shift+Enter quebra linha)`}
            className="max-h-32 min-h-[36px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/20 sm:py-1.5"
            maxLength={2000}
            aria-label="Pergunta ao tutor"
          />
          <Button
            type="submit"
            size="sm"
            className="h-11 shrink-0 sm:h-9"
            disabled={loading || (!input.trim() && !pendingImage)}
          >
            Enviar <CornerDownLeft className="size-3.5" aria-hidden />
          </Button>
        </div>
      </form>

      {/* t160: o print que se lê de novo — o MESMO data URL, só visão. */}
      <PrintLightboxDialog src={lightboxSrc} onOpenChange={(o) => !o && setLightboxSrc(null)} />

      {/* Recorte da captura de tela — anexa no MESMO pendingImage dos prints. */}
      <CaptureCropDialog
        canvas={captureCanvas}
        open={captureOpen}
        onOpenChange={(v) => {
          setCaptureOpen(v);
          if (!v) setCaptureCanvas(null); // auto-apagar: o frame bruto some com o diálogo
        }}
        onAttach={(image) => {
          setPendingImage(image);
          setPendingLabel('print de tela');
        }}
        onRetry={() => void startCapture()}
      />

      {/* Print de PÁGINA do material aberto (t152): a via SEM seletor de tela —
          pdf.js renderiza, o aluno recorta sobre o próprio PDF e o anexo entra
          no MESMO pendingImage (ou no tubo do diálogo via onPdfCaptureAttach,
          que também acende a aba Tutor no mobile). */}
      {material?.pdfPath && material.type !== 'web_page' && (
        <PdfPageCaptureDialog
          material={material}
          open={pdfCaptureOpen}
          onOpenChange={setPdfCaptureOpen}
          onAttach={(image, label) => {
            if (onPdfCaptureAttach) onPdfCaptureAttach(image, label);
            else {
              setPendingImage(image);
              setPendingLabel(label);
            }
          }}
        />
      )}
    </div>
  );
}
