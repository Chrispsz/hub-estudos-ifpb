'use client';

// t178 — TREINO GUIADO: as questões que o professor ditou no áudio, UMA POR
// VEZ, com o tutor AO LADO na mesma tela. Resposta direta ao dono ("como faço
// as questões que o professor falou em sala com o tutor?").
//
//   Resolva no papel → confira o gabarito relâmpago → tire a dúvida na hora
//   (o tutor já recebe o enunciado do espelho preenchido no composer e conhece
//   a estrutura inteira da prova via examIntelForTutor — t177).
//
// Reusa: PROVA_BLUEPRINT (fonte única), o MESMO storage de "dominadas" do
// Treino Espelhado (hub:espelho:dominadas:v1 — marcar aqui aparece lá) e o
// TutorQuickPanel embutido (mesma experiência amada do split PDF+Tutor).

import * as React from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  KeyRound,
  ListOrdered,
  Quote,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {m.list} · {m.qRef}
        </Badge>
        <Badge className="bg-emerald-600 text-[10px] text-white">espelho exato</Badge>
      </div>
      <MathText text={m.statement} className="mt-2 block text-[13px] leading-relaxed" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        <KeyRound className="size-3" aria-hidden />
        {open ? 'Esconder gabarito' : 'Ver gabarito relâmpago'}
        <ChevronDown
          className={cn('size-3 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <p className="mt-1.5 rounded-md bg-emerald-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
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

  const q = PROVA_BLUEPRINT[cur];
  const espelhos = q.mirrors.filter((m) => m.role === 'espelho');
  const irmaos = q.mirrors.filter((m) => m.role === 'irmao');

  // Carrega as dominadas (e pousa na 1ª questão ainda não dominada).
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const arr = parsed.filter((x): x is number => typeof x === 'number');
      setDone(arr);
      const firstTodo = PROVA_BLUEPRINT.findIndex((b) => !arr.includes(b.n));
      if (firstTodo > 0) setCur(firstTodo);
    } catch {
      /* localStorage indisponível — segue sem persistir */
    }
  }, []);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-t="guided-training"
        className="flex h-[92dvh] max-w-5xl flex-col gap-0 overflow-hidden rounded-xl p-0 sm:h-[88dvh]"
      >
        {/* Cabeçalho: título + progresso + seletor de questão */}
        <div className="shrink-0 border-b px-4 pb-3 pt-4 sm:px-5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base leading-tight">
              <GraduationCap className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
              Treino guiado — as questões do professor
              <Badge className="bg-violet-600 text-white shadow-sm">
                {done.length}/{PROVA_BLUEPRINT.length} dominadas
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Resolva no papel → confira o gabarito → tire a dúvida com o tutor ao lado (ele
              conhece a prova inteira). Ordem perfeita da prova: {ordemLabel} · bônus Q6 por último.
            </DialogDescription>
          </DialogHeader>

          {/* Seletor Q1–Q6 */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {PROVA_BLUEPRINT.map((b, i) => {
              const isCur = i === cur;
              const isDone = done.includes(b.n);
              return (
                <button
                  key={b.n}
                  type="button"
                  onClick={() => setCur(i)}
                  aria-current={isCur ? 'true' : undefined}
                  aria-label={`Ir para a questão ${b.n}${isDone ? ' (dominada)' : ''}`}
                  title={b.title}
                  className={cn(
                    'inline-flex h-8 min-w-9 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors',
                    isCur
                      ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                      : isDone
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {isDone && <Check className="size-3" aria-hidden />}
                  Q{b.n}
                </button>
              );
            })}
            <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
              {done.length}/{PROVA_BLUEPRINT.length} dominadas
            </span>
          </div>
        </div>

        {/* Corpo: questão (esquerda) + tutor (direita) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* — Lado da questão — */}
          <div className="min-w-0 shrink-0 space-y-3 p-4 sm:px-5 lg:w-[46%] lg:overflow-y-auto lg:border-r">
            <div>
              <h4 className="text-sm font-bold leading-snug">{q.title}</h4>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Clock3 className="size-3" aria-hidden /> {q.minutes} min
                </Badge>
                {q.bonus ? (
                  <Badge className="bg-amber-500 text-[10px] text-white">+20 bônus</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">{q.points} pts</Badge>
                )}
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <ListOrdered className="size-3" aria-hidden /> {q.orderPosition}º na ordem
                </Badge>
              </div>
            </div>

            {/* O que o professor disse */}
            <blockquote className="rounded-lg border-l-2 border-violet-500/60 bg-violet-500/5 px-3 py-2">
              <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                <Quote className="size-3" aria-hidden /> O que o professor disse no áudio
              </span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                &ldquo;{q.profQuote}&rdquo;
              </span>
            </blockquote>

            {/* Espelhos exatos — resolva aqui */}
            <div className="space-y-2">
              {espelhos.map((m) => (
                <EspelhoCard key={m.qRef} m={m} />
              ))}
            </div>

            {/* Receita de prova (nasce fechada) */}
            <div className="rounded-xl border bg-card">
              <button
                type="button"
                onClick={() => setRecipeOpen((v) => !v)}
                aria-expanded={recipeOpen}
                className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <ListOrdered className="size-3.5" aria-hidden />
                Receita de prova — {espelhos.length > 0 ? 'passos mecânicos' : 'passos'}
                <ChevronDown
                  className={cn('ml-auto size-3.5 transition-transform', recipeOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>
              {recipeOpen && (
                <ol className="list-decimal space-y-1.5 border-t px-6 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
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
                  className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  Variações para treinar mais ({irmaos.length})
                  <ChevronDown
                    className={cn('ml-auto size-3.5 transition-transform', irmaosOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                {irmaosOpen && (
                  <div className="space-y-2 border-t px-3 py-2.5">
                    {irmaos.map((m) => (
                      <div key={m.qRef}>
                        <Badge variant="outline" className="text-[10px]">
                          {m.list} · {m.qRef}
                        </Badge>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          <MathText text={m.statement} />
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ações: dominada + navegação */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => toggleDone(q.n)}
                aria-pressed={done.includes(q.n)}
                className={cn(
                  'h-9',
                  done.includes(q.n)
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border-emerald-500/40 bg-transparent text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400',
                )}
                variant={done.includes(q.n) ? 'default' : 'outline'}
              >
                <Check className="size-4" aria-hidden />
                {done.includes(q.n) ? 'Dominada ✓' : 'Marcar como dominada'}
              </Button>
              <div className="ml-auto flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={cur === 0}
                  onClick={() => setCur((c) => Math.max(0, c - 1))}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={cur === PROVA_BLUEPRINT.length - 1}
                  onClick={() => setCur((c) => Math.min(PROVA_BLUEPRINT.length - 1, c + 1))}
                >
                  Próxima
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>

          {/* — Lado do tutor (a experiência amada, embutida) —
              max-lg:shrink-0: no mobile o wrapper tem altura FIXA (520px);
              sem isso o flex esmaga o painel (overflow-hidden zera o min-height
              automático do item → painel com 2px). */}
          <div className="flex min-h-0 flex-1 flex-col p-2 max-lg:shrink-0 sm:p-3">
            <div className="flex h-[520px] max-lg:shrink-0 flex-col overflow-hidden rounded-lg border bg-card lg:h-auto lg:flex-1 lg:border-0">
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
      </DialogContent>
    </Dialog>
  );
}
