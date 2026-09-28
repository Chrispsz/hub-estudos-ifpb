'use client';

// Painel rápido do Tutor IA — embutido em diálogos (ex.: visualizador de PDF)
// para tirar dúvidas sobre o material aberto SEM sair do contexto.
// Envia os mesmos dados do Hub (professor, datas, progresso) que o chat da aba Estudar.

import * as React from 'react';
import { toast } from 'sonner';

import { Bot, Camera, Copy, CornerDownLeft, ImagePlus, Lightbulb, Loader2, Sparkles, Target, Trash2, TriangleAlert, User, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { buildHubContext } from '@/lib/tutor-context';
import { downscaleImageFile, imageFromClipboard } from '@/lib/tutor-image';
import { looksFragmentedPaste, normalizePdfPaste } from '@/lib/paste-cleanup';
import {
  useScreenCapture,
} from '@/lib/screen-capture';
import { CaptureCropDialog } from './capture-crop-dialog';
import { streamTutorAnswer, TutorStreamError } from '@/lib/tutor-stream';
import { buildQuizPrompt } from '@/lib/tutor-quiz';
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
  onExternalImageConsumed?: () => void;
  /** Aviso de resposta: a 1ª parte da resposta chegou — o diálogo marca o
   * ponto não lido na aba Tutor quando o aluno está vendo o PDF no mobile. */
  onAssistantReply?: () => void;
  className?: string;
}

export function TutorQuickPanel({
  discipline,
  disciplineCode,
  materialTitle,
  materialId,
  suggestions,
  materialType,
  showHeader,
  externalImage,
  onExternalImageConsumed,
  onAssistantReply,
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
  /** Resposta em streaming (painel efêmero — não persiste no banco). */
  const [streamText, setStreamText] = React.useState<string | null>(null);
  /** Print/foto anexado à próxima mensagem (data URL reduzido no navegador). */
  const [pendingImage, setPendingImage] = React.useState<string | null>(null);
  /** Captura de tela em recorte (o frame bruto vive aqui até o diálogo fechar). */
  const [captureCanvas, setCaptureCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const { capturing, startCapture } = useScreenCapture(
    React.useCallback((canvas: HTMLCanvasElement) => {
      setCaptureCanvas(canvas);
      setCaptureOpen(true);
    }, []),
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  /** Modo dica: tutor socrático — pistas antes da solução completa. */
  const [hintMode, setHintMode] = React.useState(false);

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
   * entra no MESMO pendingImage dos prints — vida efêmera igual. */
  React.useEffect(() => {
    if (externalImage) {
      setPendingImage(externalImage);
      onExternalImageConsumed?.();
    }
  }, [externalImage, onExternalImageConsumed]);

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

  /** Anexa print/foto da questão — reduzido antes de virar data URL. */
  const attachImage = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Só dá para anexar imagem (print/foto).');
      return;
    }
    try {
      setPendingImage(await downscaleImageFile(file));
    } catch {
      toast.error('Não consegui processar a imagem. Tente outra.');
    }
  };

  /** CAPTURAR A TELA (28/09): pega o frame, abre o recorte, anexa e some —
   * nada vai para a pasta de prints do aluno; os tracks da transmissão
   * param no ato (lib/screen-capture — o hook cuida do seletor que não
   * é cancelável: 2º clique solta a UI). */

  async function ask(question: string, image: string | null = null) {
    const q = question.trim();
    if ((!q && !image) || loading) return;
    setInput('');
    setPendingImage(null);
    notifiedRef.current = false;
    // Memória da conversa: últimas 12 mensagens sem bolhas de erro — o tutor
    // continua o raciocínio anterior em vez de responder algo desconexo.
    const history = messages
      .filter((m) => !m.content.startsWith('⚠️'))
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

  /** Copia o texto completo de uma resposta do tutor (pra colar no caderno). */
  const copyAnswer = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('Resposta copiada.'))
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

        {messages.map((m) => (
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
                    <img
                      src={m.image}
                      alt="Print anexado à dúvida"
                      className="mt-2 max-h-40 rounded-lg"
                    />
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
                    {m.time && <span className="text-[10px] text-muted-foreground/60">{m.time}</span>}
                    {m.model && (
                      <span className="text-[10px] text-muted-foreground/60">via {m.model}</span>
                    )}
                    {!m.error && (
                      <button
                        type="button"
                        onClick={() => copyAnswer(m.content)}
                        aria-label="Copiar resposta"
                        title="Copiar resposta"
                        className="flex items-center gap-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground"
                      >
                        <Copy className="size-3" />
                        copiar
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
            <img
              src={pendingImage}
              alt="Prévia do print anexado"
              className="size-10 rounded-md object-cover"
            />
            <span className="min-w-0 flex-1 text-xs text-muted-foreground">
              print anexado — o tutor lê a imagem antes de responder
            </span>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
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
            onClick={() => void startCapture()}
            disabled={loading}
            aria-pressed={capturing}
            aria-label="Capturar a tela e recortar para o tutor"
            title={
              capturing
                ? 'Escolhendo a tela… clique de novo para soltar'
                : 'Capturar a tela — recorte a questão e anexe (nada é salvo no seu computador)'
            }
          >
            <Camera className={cn('size-4', capturing && 'animate-pulse')} />
          </Button>
          <textarea
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
                void attachImage(f);
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

      {/* Recorte da captura de tela — anexa no MESMO pendingImage dos prints. */}
      <CaptureCropDialog
        canvas={captureCanvas}
        open={captureOpen}
        onOpenChange={(v) => {
          setCaptureOpen(v);
          if (!v) setCaptureCanvas(null); // auto-apagar: o frame bruto some com o diálogo
        }}
        onAttach={setPendingImage}
        onRetry={() => void startCapture()}
      />
    </div>
  );
}
