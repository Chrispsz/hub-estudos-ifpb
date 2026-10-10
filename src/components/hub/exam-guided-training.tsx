'use client';

// t196 — TREINO GUIADO EM TELA CHEIA (a morte da janela flutuante).
//
// O dono fechou o diagnóstico da t178 em uma frase: "janela flutuante ficou
// horrível · aproveitamento de tela muito ruim · tá ficando minúsculo". Ele
// tem razão — um Dialog max-w-5xl flutuando sobre a home desperdiça a
// resolução (painéis de ~470px) e texto de 11px não é material de estudo.
//
// AGORA: uma SALA DE ESTUDO que ocupa o viewport inteiro (fixed inset-0),
// como a tela dividida PDF+Tutor que ele ama — só que com a questão no lugar
// do PDF:
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ 🎓 Treino guiado · 1/6 dominadas    [Q1][Q3][Q4][Q2][Q5][Q6] ✕│
//   ├──────────────────────────────┬───────────────────────────────┤
//   │ QUESTÃO (46%, scroll)        │ TUTOR (resto, altura cheia)   │
//   │ enunciado 15px, receita 13px │ o mesmo painel do split PDF   │
//   ├──────────────────────────────┴───────────────────────────────┤
//   │ mobile: abas [ Questão | Tutor ] — cada uma ocupa a tela TODA │
//   └──────────────────────────────────────────────────────────────┘
//
// Sem Dialog, sem máscara, sem dorso de diálogo. Esc fecha. Reusa: o MESMO
// TutorQuickPanel do split, o MESMO storage de dominadas do Treino Espelhado
// (hub:espelho:dominadas:v1) e a MESMA fonte única (PROVA_BLUEPRINT).

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  KeyRound,
  ListOrdered,
  MessageSquareText,
  Quote,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PROVA_BLUEPRINT,
  type ExamBlueprintQ,
  type MirrorQuestion,
} from '@/lib/prof-audio-map';
import { TutorQuickPanel } from './tutor-quick-panel';
import { MathText } from './math-text';

const MATH_CODE = 'TEC.1984';
/** MESMA chave do exam-mirror-card — o progresso é um só. */
const STORAGE_KEY = 'hub:espelho:dominadas:v1';

/** Chips de acompanhamento dentro do treino (antes da 1ª resposta do fio). */
const TRAINING_SUGGESTIONS = [
  'Vou resolver no papel e te mando — confere passo a passo',
  'Me dê uma variação NO MESMO formato para eu resolver agora',
  'Qual o erro clássico que derruba esse tipo de questão?',
];

/** Prompt de treino: enunciado do espelho + pedido de método (tutorPrompt). */
function buildTrainingPrompt(q: ExamBlueprintQ): string {
  const esp = q.mirrors.find((m) => m.role === 'espelho');
  return [
    `Treino guiado — Questão ${q.n} da Av1 de Matemática: ${q.title}.`,
    esp
      ? `Vou resolver este espelho exato da prova (${esp.list} ${esp.qRef}): "${esp.statement}"`
      : '',
    q.tutorPrompt,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Gabarito relâmpago de UM espelho, dobrável (só abre quando conferiu). */
function EspelhoCard({ m }: { m: MirrorQuestion }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[11px]">
          {m.list} · {m.qRef}
        </Badge>
        <Badge className="bg-emerald-600 text-[11px] text-white">espelho exato</Badge>
      </div>
      {/* O enunciado é O CONTEÚDO — 15px, respirado, de livro. */}
      <MathText text={m.statement} className="mt-2.5 block text-[15px] leading-relaxed" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-[13px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        <KeyRound className="size-3.5" aria-hidden />
        {open ? 'Esconder gabarito' : 'Ver gabarito relâmpago'}
        <ChevronDown
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-[13px] leading-relaxed text-emerald-800 dark:text-emerald-300">
          <MathText text={m.key ?? ''} />
        </p>
      )}
    </div>
  );
}

export function ExamGuidedTraining({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  /** Questão atual (índice no blueprint). */
  const [cur, setCur] = React.useState(0);
  /** Dominadas — mesmo storage do Treino Espelhado. */
  const [done, setDone] = React.useState<number[]>([]);
  /** Receita de prova e variações nascem fechadas (o foco é resolver). */
  const [recipeOpen, setRecipeOpen] = React.useState(false);
  const [irmaosOpen, setIrmaosOpen] = React.useState(false);
  /** Pergunta pré-preenchida no composer do tutor ao trocar de questão. */
  const [tutorQuestion, setTutorQuestion] = React.useState<string | null>(null);
  /** No mobile, a sala tem 2 ambientes de tela cheia: Questão | Tutor. */
  const [mobileTab, setMobileTab] = React.useState<'questao' | 'tutor'>('questao');

  const q = PROVA_BLUEPRINT[cur];
  const espelhos = q.mirrors.filter((m) => m.role === 'espelho');
  const irmaos = q.mirrors.filter((m) => m.role === 'irmao');

  // Carrega as dominadas (e pousa na 1ª questão ainda não dominada) —
  // sempre que a sala ABRE, não no mount (o estado pode ter mudado fora).
  React.useEffect(() => {
    if (!open) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const arr = parsed.filter((x): x is number => typeof x === 'number');
      setDone(arr);
      setCur((c) => {
        const firstTodo = PROVA_BLUEPRINT.findIndex((b) => !arr.includes(b.n));
        return firstTodo > 0 ? firstTodo : c;
      });
    } catch {
      /* localStorage indisponível — segue sem persistir */
    }
    setMobileTab('questao');
  }, [open]);

  // A sala em tela cheia congela o fundo (sem scroll fantasma atrás) e
  // Esc fecha — o mesmo contrato de teclado de um dialog, sem ser um.
  React.useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  // Ao trocar de questão, o tutor recebe o treino pronto no composer
  // (o aluno revisa e envia — o mesmo contrato do externalQuestion da t158).
  React.useEffect(() => {
    setTutorQuestion(buildTrainingPrompt(PROVA_BLUEPRINT[cur]));
  }, [cur]);

  const toggleDone = (n: number) => {
    setDone((prev) => {
      const next = prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* idem */
      }
      return next;
    });
  };

  const ordemLabel = [...PROVA_BLUEPRINT]
    .sort((a, b) => a.orderPosition - b.orderPosition)
    .map((b) => `Q${b.n}`)
    .join(' → ');

  const go = (i: number) => {
    setCur(Math.min(PROVA_BLUEPRINT.length - 1, Math.max(0, i)));
  };

  // Chips Q1–Q6 — o seletor que vive no header (desktop) e na faixa própria
  // (mobile). Mesma pílula nos dois: forma UMA só, estilo UM só.
  const chips = PROVA_BLUEPRINT.map((b, i) => {
    const isCur = i === cur;
    const isDone = done.includes(b.n);
    return (
      <button
        key={b.n}
        type="button"
        onClick={() => go(i)}
        aria-current={isCur ? 'true' : undefined}
        aria-label={`Ir para a questão ${b.n}${isDone ? ' (dominada)' : ''}`}
        title={b.title}
        className={cn(
          'inline-flex h-9 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors',
          isCur
            ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
            : isDone
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400'
              : 'border-border bg-card text-muted-foreground hover:bg-muted',
        )}
      >
        {isDone && <Check className="size-3.5" aria-hidden />}
        Q{b.n}
      </button>
    );
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="guided-training-room"
          role="dialog"
          aria-modal="true"
          aria-label="Treino guiado — as questões do professor com o tutor ao lado"
          data-t="guided-training"
          className="fixed inset-0 z-[60] flex flex-col bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          {/* ── Cabeçalho da sala (h-14, uma linha, sem ruído) ── */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/70 px-3 backdrop-blur sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <GraduationCap className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold">Treino guiado</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {done.length}/{PROVA_BLUEPRINT.length} dominadas · resolva no papel →
                  gabarito → dúvida na hora
                </p>
              </div>
            </div>

            {/* Seletor Q1–Q6 (desktop) — centro do header, sempre à mão */}
            <nav
              className="mx-auto hidden items-center gap-1.5 md:flex"
              aria-label="Selecionar questão"
            >
              {chips}
            </nav>

            <div className="ml-auto flex shrink-0 items-center md:ml-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                aria-label="Fechar treino guiado (Esc)"
                className="size-10 rounded-lg"
                autoFocus
              >
                <X className="size-5" aria-hidden />
              </Button>
            </div>
          </header>

          {/* Faixa de chips no mobile (o header fica limpo; o seletor rola) */}
          <div
            className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b px-3 py-2 md:hidden"
            role="toolbar"
            aria-label="Selecionar questão"
          >
            {chips}
          </div>

          {/* ── Corpo da sala: questão | tutor, ALTURA CHEIA dos dois lados ── */}
          <div className="flex min-h-0 flex-1">
            {/* QUESTÃO — 46% no desktop (mín. legível), tela cheia no mobile */}
            <div
              className={cn(
                'min-h-0 min-w-0 flex-1 overflow-y-auto lg:w-[46%] lg:max-w-[780px] lg:flex-none lg:border-r',
                mobileTab !== 'questao' && 'hidden lg:block',
              )}
            >
              <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
                {/* Ordem perfeita — a única informação de contexto que importa */}
                <p className="flex items-start gap-2 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-xs leading-relaxed text-violet-800 dark:text-violet-300">
                  <ListOrdered className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    Ordem perfeita da prova: <strong>{ordemLabel}</strong> · bônus Q6 por
                    último.
                  </span>
                </p>

                <div>
                  <h3 className="text-lg font-bold leading-snug">{q.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Clock3 className="size-3" aria-hidden /> {q.minutes} min
                    </Badge>
                    {q.bonus ? (
                      <Badge className="bg-amber-500 text-xs text-white">+20 bônus</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">{q.points} pts</Badge>
                    )}
                    <Badge variant="outline" className="gap-1 text-xs">
                      <ListOrdered className="size-3" aria-hidden /> {q.orderPosition}º na
                      ordem
                    </Badge>
                  </div>
                </div>

                {/* O que o professor disse */}
                <blockquote className="rounded-xl border-l-2 border-violet-500/60 bg-violet-500/5 px-3.5 py-2.5">
                  <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    <Quote className="size-3" aria-hidden /> O que o professor disse no
                    áudio
                  </span>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">
                    &ldquo;{q.profQuote}&rdquo;
                  </span>
                </blockquote>

                {/* Espelhos exatos — resolva aqui */}
                <section aria-label="Questão espelho da prova" className="space-y-3">
                  {espelhos.map((m) => (
                    <EspelhoCard key={m.qRef} m={m} />
                  ))}
                </section>

                {/* Receita de prova (nasce fechada) */}
                <div className="rounded-xl border bg-card">
                  <button
                    type="button"
                    onClick={() => setRecipeOpen((v) => !v)}
                    aria-expanded={recipeOpen}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <ListOrdered className="size-4" aria-hidden />
                    Receita de prova — {espelhos.length > 0 ? 'passos mecânicos' : 'passos'}
                    <ChevronDown
                      className={cn(
                        'ml-auto size-4 transition-transform',
                        recipeOpen && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                  {recipeOpen && (
                    <ol className="list-decimal space-y-2 border-t px-8 py-3 text-[13px] leading-relaxed text-muted-foreground">
                      {q.recipe.map((step, i) => (
                        <li key={i}>
                          <MathText text={step} />
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* Variações (irmãos) — nasce fechado */}
                {irmaos.length > 0 && (
                  <div className="rounded-xl border bg-card">
                    <button
                      type="button"
                      onClick={() => setIrmaosOpen((v) => !v)}
                      aria-expanded={irmaosOpen}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      Variações para treinar mais ({irmaos.length})
                      <ChevronDown
                        className={cn(
                          'ml-auto size-4 transition-transform',
                          irmaosOpen && 'rotate-180',
                        )}
                        aria-hidden
                      />
                    </button>
                    {irmaosOpen && (
                      <div className="space-y-3 border-t px-4 py-3">
                        {irmaos.map((m) => (
                          <div key={m.qRef}>
                            <Badge variant="outline" className="text-[11px]">
                              {m.list} · {m.qRef}
                            </Badge>
                            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                              <MathText text={m.statement} />
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Ações: dominada + navegação */}
                <div className="flex flex-wrap items-center gap-2 pb-2 pt-1">
                  <Button
                    onClick={() => toggleDone(q.n)}
                    aria-pressed={done.includes(q.n)}
                    className={cn(
                      'h-10 flex-1 sm:flex-none',
                      done.includes(q.n)
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'border-emerald-500/40 bg-transparent text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400',
                    )}
                    variant={done.includes(q.n) ? 'default' : 'outline'}
                  >
                    <Check className="size-4" aria-hidden />
                    {done.includes(q.n) ? 'Dominada ✓' : 'Marcar como dominada'}
                  </Button>
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10"
                      disabled={cur === 0}
                      onClick={() => go(cur - 1)}
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10"
                      disabled={cur === PROVA_BLUEPRINT.length - 1}
                      onClick={() => go(cur + 1)}
                    >
                      Próxima
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* TUTOR — o painel amado do split PDF+Tutor, agora com a tela TODA.
                No mobile vira ambiente próprio (aba), nunca um retângulo esmagado. */}
            <div
              className={cn(
                'min-h-0 min-w-0 flex-1 flex flex-col bg-muted/30 lg:flex',
                mobileTab !== 'tutor' && 'hidden lg:flex',
              )}
            >
              <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3 lg:p-4">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                  <TutorQuickPanel
                    className="min-h-0 flex-1"
                    discipline={`Treino guiado — Questão ${q.n}`}
                    disciplineCode={MATH_CODE}
                    materialId={q.tutorMaterialId}
                    materialTitle={q.mirrors[0]?.list ?? 'Listas da prova'}
                    showHeader
                    suggestions={TRAINING_SUGGESTIONS}
                    externalQuestion={tutorQuestion}
                    onExternalQuestionConsumed={() => setTutorQuestion(null)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Abas do mobile: cada ambiente em TELA CHEIA (fim do 520px) ── */}
          <div className="shrink-0 border-t bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
            <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setMobileTab('questao')}
                aria-pressed={mobileTab === 'questao'}
                className={cn(
                  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
                  mobileTab === 'questao'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ListOrdered className="size-4" aria-hidden />
                Questão
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('tutor')}
                aria-pressed={mobileTab === 'tutor'}
                className={cn(
                  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
                  mobileTab === 'tutor'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <MessageSquareText className="size-4" aria-hidden />
                Tutor
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
