'use client';

// Painel rápido do Tutor IA — embutido em diálogos (ex.: visualizador de PDF)
// para tirar dúvidas sobre o material aberto SEM sair do contexto.
// Envia os mesmos dados do Hub (professor, datas, progresso) que o chat da aba Estudar.

import * as React from 'react';
import { Bot, CornerDownLeft, Loader2, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { buildHubContext } from '@/lib/tutor-context';
import { TutorMarkdown } from './tutor-markdown';

interface ChatMessage {
  /** Identificador estável para as chaves da lista (append-only). */
  id: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
}

interface TutorQuickPanelProps {
  discipline: string;
  disciplineCode?: string;
  /** Tópico/material aberto — o tutor conecta a resposta a ele. */
  materialTitle?: string;
  /** Perguntas prontas exibidas como chips antes da 1ª resposta. */
  suggestions?: string[];
  className?: string;
}

export function TutorQuickPanel({
  discipline,
  disciplineCode,
  materialTitle,
  suggestions,
  className,
}: TutorQuickPanelProps) {
  const sp = useStudyProgress();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const nextIdRef = React.useRef(0);

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

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    appendMessage({ role: 'user', content: q });
    setLoading(true);
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          discipline,
          topic: materialTitle ?? discipline,
          material: materialTitle,
          hubContext: buildHubContext(disciplineCode ?? '', sp),
        }),
      });
      const data = (await res.json()) as { answer?: string; model?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error ?? 'Falha ao consultar o tutor.');
      appendMessage({ role: 'assistant', content: data.answer, model: data.model });
    } catch (err) {
      appendMessage({
        role: 'assistant',
        content:
          err instanceof Error
            ? `⚠️ ${err.message}`
            : '⚠️ Não consegui responder agora. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  }

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
                  className="rounded-full border border-border bg-muted/60 px-3 py-2 text-xs transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-400 sm:py-1.5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
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
                'max-w-[88%] rounded-xl px-3 py-2',
                m.role === 'user'
                  ? 'whitespace-pre-wrap bg-emerald-600 text-white'
                  : 'bg-muted text-foreground',
              )}
            >
              {m.role === 'user' ? (
                <p className="text-sm">{m.content}</p>
              ) : (
                <>
                  <TutorMarkdown content={m.content} />
                  {m.model && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground/60">via {m.model}</p>
                  )}
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
      </div>

      <form
        className="flex gap-2 border-t p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Dúvida sobre ${materialTitle ?? discipline}?`}
          className="h-11 bg-background text-sm sm:h-9"
          maxLength={2000}
          aria-label="Pergunta ao tutor"
        />
        <Button
          type="submit"
          size="sm"
          className="h-11 shrink-0 sm:h-9"
          disabled={loading || !input.trim()}
        >
          Enviar <CornerDownLeft className="size-3.5" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
