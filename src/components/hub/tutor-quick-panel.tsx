'use client';

// Painel rápido do Tutor IA — embutido em diálogos (ex.: visualizador de PDF)
// para tirar dúvidas sobre o material aberto SEM sair do contexto.
// Envia os mesmos dados do Hub (professor, datas, progresso) que o chat da aba Estudar.

import * as React from 'react';
import { toast } from 'sonner';
import { Bot, Copy, CornerDownLeft, ImagePlus, Lightbulb, Loader2, Sparkles, Square, User, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { buildHubContext } from '@/lib/tutor-context';
import { downscaleImageFile, imageFromClipboard } from '@/lib/tutor-image';
import { streamTutorAnswer, TutorStreamError } from '@/lib/tutor-stream';
import { useTutorSpeech } from '@/lib/tutor-speech';
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
}

/** Hora local curta (HH:MM) para carimbar mensagens do chat. */
const hhmm = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

interface TutorQuickPanelProps {
  discipline: string;
  disciplineCode?: string;
  /** Tópico/material aberto — o tutor conecta a resposta a ele. */
  materialTitle?: string;
  /** id do material no course-data — liga o retrieval (resumo + trechos do PDF). */
  materialId?: string;
  /** Perguntas prontas exibidas como chips antes da 1ª resposta. */
  suggestions?: string[];
  className?: string;
}

export function TutorQuickPanel({
  discipline,
  disciplineCode,
  materialTitle,
  materialId,
  suggestions,
  className,
}: TutorQuickPanelProps) {
  const sp = useStudyProgress();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  /** Resposta em streaming (painel efêmero — não persiste no banco). */
  const [streamText, setStreamText] = React.useState<string | null>(null);
  /** Print/foto anexado à próxima mensagem (data URL reduzido no navegador). */
  const [pendingImage, setPendingImage] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const nextIdRef = React.useRef(0);
  /** Modo dica: tutor socrático — pistas antes da solução completa. */
  const [hintMode, setHintMode] = React.useState(false);
  /** Ouvir resposta — TTS nativo do navegador. */
  const { speakingId, toggle: toggleSpeech, supported: ttsSupported } = useTutorSpeech();

  // Anexa mensagem com id único — chaves estáveis na lista de conversa.
  const appendMessage = React.useCallback((msg: Omit<ChatMessage, 'id'>) => {
    const id = nextIdRef.current++;
    setMessages((m) => [...m, { ...msg, id }]);
  }, []);

  const defaultSuggestions = React.useMemo(
    () => [
      materialTitle ? `Resuma o material "${materialTitle}"` : 'Resuma o tópico atual',
      'Quais pontos costumam cair na prova?',
      'Dê um exemplo prático',
    ],
    [materialTitle],
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

  async function ask(question: string, image: string | null = null) {
    const q = question.trim();
    if ((!q && !image) || loading) return;
    setInput('');
    setPendingImage(null);
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
        },
      );
      appendMessage({ role: 'assistant', content: result.answer, model: result.model, time: hhmm() });
    } catch (err) {
      const partial = err instanceof TutorStreamError ? err.partial : '';
      if (partial.trim()) {
        appendMessage({ role: 'assistant', content: partial, time: hhmm() });
      } else {
        appendMessage({
          role: 'assistant',
          content:
            err instanceof Error
              ? `⚠️ ${err.message}`
              : '⚠️ Não consegui responder agora. Tente novamente.',
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
                  : 'rounded-tl-sm border border-border/60 bg-muted text-foreground',
              )}
            >
              {m.role === 'user' ? (
                <>
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
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
                  <TutorMarkdown content={m.content} />
                  <div className="mt-1.5 flex items-center gap-2">
                    {m.time && <span className="text-[10px] text-muted-foreground/60">{m.time}</span>}
                    {m.model && (
                      <span className="text-[10px] text-muted-foreground/60">via {m.model}</span>
                    )}
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
                    {ttsSupported && m.content.length > 80 && (
                      <button
                        type="button"
                        onClick={() => toggleSpeech(m.id, m.content)}
                        aria-label={speakingId === m.id ? 'Parar leitura' : 'Ouvir resposta'}
                        title={speakingId === m.id ? 'Parar leitura' : 'Ouvir resposta em voz alta'}
                        className={cn(
                          'flex items-center gap-1 text-[10px] transition-colors',
                          speakingId === m.id
                            ? 'text-emerald-500'
                            : 'text-muted-foreground/60 hover:text-foreground',
                        )}
                      >
                        {speakingId === m.id ? <Square className="size-3" /> : <Volume2 className="size-3" />}
                        {speakingId === m.id ? 'parar' : 'ouvir'}
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
              <TutorMarkdown content={streamText} />
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
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const f = imageFromClipboard(e);
              if (f) {
                e.preventDefault();
                void attachImage(f);
              }
            }}
            placeholder={`Dúvida sobre ${materialTitle ?? discipline}? (cole um print)`}
            className="h-11 bg-background text-sm sm:h-9"
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
    </div>
  );
}
