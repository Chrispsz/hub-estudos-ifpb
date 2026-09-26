'use client';

// ExamPrepCard — FOCO: Prova de Matemática (Av1, 01/10).
// Card do Painel com plano de 12 dias material-first, fórmulas essenciais,
// checklist de domínio e atalho para o Simulado da Prova. Persistência do
// progresso das tarefas em localStorage (sobrevive a reloads).

import * as React from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  AlarmClock,
  BookOpen,
  BookX,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Dumbbell,
  GraduationCap,
  Layers,
  ListChecks,
  Sigma,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { daysUntilDate } from '@/lib/semester';
import { openMethod, openProgress, openSimulado, openTutor } from '@/lib/hub-events';
import { buildQuizPrompt } from '@/lib/tutor-quiz';
import {
  buildReadinessQuestion,
  computeReadiness,
  type ReadinessComponentId,
  type ReadinessResult,
  type ReadinessTone,
} from '@/lib/exam-readiness';
import { useLocalStorage } from '@/lib/use-local-storage';
import { useStudyProgress } from '@/lib/study-progress';
import { collectMistakes, notebookStats, pendingMistakes } from '@/lib/mistake-notebook';
import { cn } from '@/lib/utils';
import { TutorMarkdown } from '@/components/hub/tutor-markdown';
import {
  MATH_CHECKLIST,
  MATH_DECK_FLAG,
  MATH_EXAM,
  MATH_EXAM_PLAN,
  MATH_FLASHCARDS,
  MATH_FORMULAS,
  missedPlanDays,
  planDayFor,
  type PlanDay,
  type PlanKind,
} from '@/lib/math-exam-prep';

const KIND_LABEL: Record<PlanKind, string> = {
  estudo: 'Estudo',
  pratica: 'Prática',
  simulado: 'Simulado',
  revisao: 'Revisão',
  prova: 'Prova',
};

const KIND_STYLE: Record<PlanKind, string> = {
  estudo: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  pratica: 'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  simulado: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  revisao: 'border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400',
  prova: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

type CheckedMap = Record<string, boolean>;
const LS_PLAN = 'hub:math-exam:v1:plan';
const LS_CHECK = 'hub:math-exam:v1:checklist';

/** Mapeia "faltam N dias" para o dia do plano (offset N = N dias antes da prova; 0 = prova). */
function planDayForDaysLeft(daysLeft: number): PlanDay | undefined {
  if (daysLeft < 0) return undefined;
  const offset = Math.min(Math.max(daysLeft, 0), MATH_EXAM_PLAN.length - 1);
  return planDayFor(offset) ?? MATH_EXAM_PLAN[Math.min(offset, MATH_EXAM_PLAN.length - 1)];
}

export function ExamPrepCard() {
  const daysLeft = daysUntilDate(MATH_EXAM.date);
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = useLocalStorage<CheckedMap>(LS_PLAN, {});
  const [checklist, setChecklist] = useLocalStorage<CheckedMap>(LS_CHECK, {});
  const sp = useStudyProgress();
  // Caderno de Erros: contagem ao vivo dos PENDENTES (revisados não disputam
  // atenção na véspera — o card mostra o que ainda pede trabalho).
  const mistakes = React.useMemo(() => collectMistakes(sp.progress), [sp.progress]);
  const mistakePending = React.useMemo(
    () => pendingMistakes(mistakes, sp.progress.notebookRevised).length,
    [mistakes, sp.progress.notebookRevised],
  );
  const mistakeRevised = mistakes.length - mistakePending;
  const mistakeStats = React.useMemo(() => notebookStats(mistakes), [mistakes]);
  // Score de prontidão: recalculado AO VIVO — marcar tarefa/checklist, revisar
  // cartão ou correr o simulado sobe o número na hora (sem reload).
  const readiness = React.useMemo(
    () => computeReadiness(sp.progress, checked, checklist),
    [sp.progress, checked, checklist],
  );
  // Baralho da Av1: flag no localStorage + dedupe por frente (à prova de flag perdida).
  const [deckAdded, setDeckAdded] = React.useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(MATH_DECK_FLAG) === '1',
  );

  /** 1 toque: todos os cartões da Av1 entram no sistema Leitner (Praticar → Flashcards). */
  function addAv1Deck() {
    const existing = new Set(sp.progress.flashcards.map((c) => c.front));
    const novas = MATH_FLASHCARDS.filter((c) => !existing.has(c.front));
    if (novas.length === 0) {
      setDeckAdded(true);
      window.localStorage.setItem(MATH_DECK_FLAG, '1');
      toast.info('O baralho da Av1 já está nos seus flashcards.');
      return;
    }
    const now = new Date().toISOString();
    sp.addFlashcards(
      novas.map((c) => ({
        disciplineCode: 'TEC.1984',
        front: c.front,
        back: c.back,
        source: 'manual' as const,
        createdAt: now,
        box: 0,
        dueAt: now, // vencidos já na criação — a revisão começa hoje
        reviews: 0,
        lapses: 0,
      })),
    );
    window.localStorage.setItem(MATH_DECK_FLAG, '1');
    setDeckAdded(true);
    toast.success(`${novas.length} cartões da Av1 adicionados — revise na aba Praticar → Flashcards.`);
  }

  // Prova passou → estado compacto, sem ruído.
  if (daysLeft < 0) {
    return (
      <Card className="rounded-xl border-rose-500/20 bg-gradient-to-r from-rose-500/5 to-transparent p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
            <CircleCheck className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Prova de Matemática (Av1) realizada</p>
            <p className="text-xs text-muted-foreground">
              Registre a nota na Calculadora quando sair o resultado. Boa sorte! 🍀
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const day = planDayForDaysLeft(daysLeft);
  const missed = missedPlanDays(daysLeft);
  const totalTasks = MATH_EXAM_PLAN.reduce((a, d) => a + d.tarefas.length, 0);
  const doneTasks = Object.values(checked).filter(Boolean).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const urgente = daysLeft <= 3;

  function toggleTask(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleCheck(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Linha do tempo dos 8 dias (offset 7 → 0): passado✓ verde, passado✗ âmbar,
  // hoje pulsando em rosa, futuro cinza e prova como bandeira.
  const todayOffset = Math.min(Math.max(daysLeft, 0), MATH_EXAM_PLAN.length - 1);
  const doneDay = (offset: number) =>
    MATH_EXAM_PLAN.filter((d) => d.offset === offset && d.offset !== 0).every((d) =>
      d.tarefas.every((_, i) => checked[`${offset}-${i}`]),
    );

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden rounded-xl border shadow-sm transition-all',
          urgente
            ? 'border-rose-500/40 shadow-rose-500/10'
            : 'border-rose-500/20 hover:border-rose-500/40',
        )}
      >
        {/* Cabeçalho com contagem */}
        <div className="flex flex-col gap-3 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/30">
              <Sigma className="size-5.5" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                Foco: Prova de Matemática (Av1)
                {urgente && (
                  <Badge className="border-0 bg-rose-500 text-white">urgente</Badge>
                )}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3" />
                {MATH_EXAM.programa}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5">
            <span
              className={cn(
                'text-2xl font-bold leading-none tabular-nums',
                urgente ? 'text-rose-500' : 'text-foreground',
              )}
            >
              {daysLeft === 0 ? 'HOJE' : `${daysLeft}d`}
            </span>
            <span className="text-[11px] text-muted-foreground">01/10 · faltam</span>
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium">
              <span aria-hidden className={cn('size-1.5 rounded-full', READINESS_DOT[readiness.tone])} />
              <span className="text-muted-foreground">prontidão</span>
              <span className={cn('tabular-nums', READINESS_TEXT[readiness.tone])}>
                {readiness.score === null ? '—' : `${readiness.score}%`}
              </span>
            </span>
          </div>
        </div>

        {/* MODO RECUPERAÇÃO: dias do plano que ficaram para trás */}
        {missed.length > 0 && (
          <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Modo recuperação: {missed.length} dia(s) do plano ficaram para trás
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700/80 dark:text-amber-300/80">
                  {missed.map((m) => m.titulo).join(' · ')}. O conteúdo CONTINUA na prova —
                  faça um catch-up condensado (≈90 min: slides da Aula 00 + 3 exercícios da
                  Lista 01) antes do dia de hoje. A fila certa está no card “Plano de
                  Recuperação”.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Linha do tempo: D-7 → prova — estado do plano num relance */}
        <div className="border-t px-4 py-3">
          <div className="flex items-end justify-between gap-1">
            {MATH_EXAM_PLAN.map((d) => {
              const past = d.offset > todayOffset;
              const today = d.offset === todayOffset;
              const prova = d.offset === 0;
              const complete = past && doneDay(d.offset);
              return (
                <div key={d.offset} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-5 place-items-center rounded-full border-2 text-[9px] font-bold tabular-nums transition-all',
                      prova && 'size-6 border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-600/30',
                      !prova && today && 'animate-pulse border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400',
                      !prova && !today && complete && 'border-emerald-500 bg-emerald-500 text-white',
                      !prova && !today && !complete && past && 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400',
                      !prova && !today && !past && 'border-border bg-muted text-muted-foreground/60',
                    )}
                  >
                    {complete ? '✓' : prova ? '🏁' : d.offset}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-medium tabular-nums',
                      today ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground/70',
                      prova && 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {prova ? 'prova' : `D-${d.offset}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dia de hoje do plano */}
        {day && (
          <div className="border-t px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('border text-[10px]', KIND_STYLE[day.kind])}>
                {KIND_LABEL[day.kind]}
              </Badge>
              <p className="text-sm font-medium">{day.titulo}</p>
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                <Timer className="size-3" /> {day.minutos} min
              </span>
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {day.tarefas.map((t, i) => {
                const key = `${day.offset}-${i}`;
                const done = !!checked[key];
                return (
                  <li key={key} className="flex items-start gap-2">
                    <Checkbox
                      id={`task-${key}`}
                      checked={done}
                      onCheckedChange={() => toggleTask(key)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`task-${key}`}
                      className={cn(
                        'min-w-0 flex-1 cursor-pointer text-xs leading-relaxed',
                        done ? 'text-muted-foreground line-through' : 'text-foreground/85',
                      )}
                    >
                      {t.texto}
                      {t.materialId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            openMethod({ materialId: t.materialId });
                          }}
                          className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
                        >
                          <BookOpen className="size-2.5" /> material
                        </button>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Progresso + ações */}
        <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Plano completo</span>
              <span className="tabular-nums">
                {doneTasks}/{totalTasks} tarefas
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => openSimulado({ preset: 'math_exam' })}
              className="group h-11 flex-1 gap-1.5 bg-rose-600 text-white shadow-md shadow-rose-600/25 hover:bg-rose-700 sm:h-8 sm:flex-none"
            >
              <Target className="size-3.5 transition-transform group-hover:scale-110" /> Simulado da Prova
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              className="h-11 flex-1 gap-1.5 sm:h-8 sm:flex-none"
              aria-label="Abrir plano completo da prova"
            >
              <ListChecks className="size-3.5" /> Plano completo
              <ChevronDown className="size-3" />
            </Button>
          </div>
        </div>

        {/* Treino de recall ativo: a IA PERGUNTA, o dono responde — véspera de prova. */}
        <button
          type="button"
          onClick={() =>
            openTutor({
              disciplineCode: MATH_EXAM.disciplineCode,
              question: buildQuizPrompt({
                disciplineName: 'Matemática',
                scope: MATH_EXAM.programa,
                count: 5,
              }),
            })
          }
          className="flex w-full items-center gap-2 border-t border-dashed border-violet-400/40 bg-violet-500/[0.04] px-4 py-2.5 text-left text-xs font-medium text-violet-700 transition-colors hover:bg-violet-500/10 dark:text-violet-300"
        >
          <Sparkles className="size-3.5 shrink-0 text-violet-500" />
          <span className="min-w-0 flex-1 truncate">
            Treino de véspera: a IA me testa no conteúdo da prova (recall ativo, 5 questões)
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">Estudar →</span>
        </button>
      </Card>

      {/* Dialog: plano completo + fórmulas + checklist */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl p-0">
          <div className="border-b bg-gradient-to-r from-rose-500/10 to-transparent px-6 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="size-5 text-rose-500" />
                Plano até a prova — Matemática (D-7 → 01/10)
              </DialogTitle>
              <DialogDescription>
                {MATH_EXAM.programa} · {MATH_EXAM.notaPeso}. Tudo extraído dos
                materiais reais da disciplina.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 py-4">
            {/* Score de prontidão — o número-norte da preparação (1º do diálogo) */}
            <ReadinessSection readiness={readiness} daysLeft={daysLeft} />

            {/* Dias */}
            <section aria-label="Cronograma dia a dia">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlarmClock className="size-3.5" /> Cronograma
              </h3>
              <ol className="mt-3 space-y-2.5">
                {MATH_EXAM_PLAN.map((d) => (
                  <li
                    key={d.offset}
                    className={cn(
                      'rounded-lg border p-3',
                      d.offset === Math.min(Math.max(daysLeft - 1, 0), MATH_EXAM_PLAN.length - 1)
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : 'border-border',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-border px-1.5 text-[10px] tabular-nums text-muted-foreground">
                        {d.offset === 0 ? '01/10' : `D-${d.offset}`}
                      </Badge>
                      <Badge variant="outline" className={cn('border text-[10px]', KIND_STYLE[d.kind])}>
                        {KIND_LABEL[d.kind]}
                      </Badge>
                      {missed.some((m) => m.offset === d.offset) && (
                        <Badge className="border-0 bg-amber-500 text-[9px] text-white">atrasado</Badge>
                      )}
                      <p className="min-w-0 flex-1 text-sm font-medium">{d.titulo}</p>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Timer className="size-3" /> {d.minutos}min
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {d.tarefas.map((t, i) => {
                        const key = `${d.offset}-${i}`;
                        const done = !!checked[key];
                        return (
                          <li key={key} className="flex items-start gap-2">
                            <Checkbox
                              id={`dlg-${key}`}
                              checked={done}
                              onCheckedChange={() => toggleTask(key)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`dlg-${key}`}
                              className={cn(
                                'min-w-0 flex-1 cursor-pointer text-xs leading-relaxed',
                                done ? 'text-muted-foreground line-through' : 'text-foreground/85',
                              )}
                            >
                              {t.texto}
                              {t.materialId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    openMethod({ materialId: t.materialId });
                                  }}
                                  className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                                >
                                  <BookOpen className="size-2.5" /> material
                                </button>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>

            {/* Fórmulas */}
            <section aria-label="Fórmulas essenciais">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5" /> Fórmulas essenciais (dos materiais)
              </h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {MATH_FORMULAS.map((f) => (
                  <Card
                    key={f.titulo}
                    className={cn(
                      'rounded-lg p-3',
                      f.grupo === 'Matrizes'
                        ? 'border-rose-500/20 bg-rose-500/[0.04]'
                        : 'border-sky-500/20 bg-sky-500/[0.04]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{f.titulo}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px]',
                          f.grupo === 'Matrizes'
                            ? 'border-rose-500/30 text-rose-600 dark:text-rose-400'
                            : 'border-sky-500/30 text-sky-600 dark:text-sky-400',
                        )}
                      >
                        {f.grupo}
                      </Badge>
                    </div>
                    {f.math && (
                      <div className="mt-1 rounded-md bg-background/60 px-2 py-1.5">
                        {f.math.map((line, i) => (
                          <TutorMarkdown key={i} content={`$$${line}$$`} className="text-xs [&_.katex-display]:my-1" />
                        ))}
                      </div>
                    )}
                    <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-foreground/70">
                      {f.corpo}
                    </p>
                  </Card>
                ))}
              </div>
            </section>

            {/* Baralho da Av1 (flashcards Leitner) */}
            <section aria-label="Baralho da Av1">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="size-3.5" /> Baralho da Av1 (revisão espaçada)
              </h3>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {MATH_FLASHCARDS.length} cartões prontos — Matrizes + Lógica, 1:1 com os materiais
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Entram no sistema Leitner (Praticar → Flashcards) já vencidos para começar hoje.
                    Errou um cartão? O botão verde no verso manda ele para o tutor.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={deckAdded ? 'ghost' : 'outline'}
                  onClick={addAv1Deck}
                  disabled={deckAdded}
                  className={cn(
                    'shrink-0 gap-1.5',
                    deckAdded
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'border-teal-500/40 bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 dark:text-teal-400',
                  )}
                >
                  {deckAdded ? (
                    <>
                      <CircleCheck className="size-3.5" /> no seu baralho
                    </>
                  ) : (
                    <>
                      <Layers className="size-3.5" /> Adicionar baralho
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* Caderno de Erros — diagnóstico agregado (aba Progresso) */}
            <section aria-label="Caderno de Erros">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <BookX className="size-3.5 text-rose-500" aria-hidden /> Caderno de Erros
                    {mistakePending > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                      >
                        {mistakePending} {mistakePending === 1 ? 'pendente' : 'pendentes'}
                      </Badge>
                    ) : mistakes.length > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        ✓ {mistakeRevised} {mistakeRevised === 1 ? 'erro revisado' : 'erros revisados'}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {mistakePending > 0
                      ? `Questões erradas nos simulados, exercícios não resolvidos e cartões errados estão no caderno${mistakeStats.topDisciplineCode === 'TEC.1984' ? ' — e tocam a prova de Matemática' : ''}. Com reensino pela IA: resolva cada erro e marque como revisado.`
                      : mistakes.length > 0
                        ? 'Tudo que você errou já foi revisado — caderno em dia para a prova. Se errar de novo, o item reabre sozinho.'
                        : 'Nenhum erro registrado ainda. Faça o simulado da prova — o que você errar vira caderno automaticamente, para a IA transformar em acerto.'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openProgress()}
                  className="shrink-0 gap-1.5 border-rose-500/40 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                  aria-label="Abrir o Caderno de Erros na aba Progresso"
                >
                  <BookX className="size-3.5" aria-hidden /> Ver caderno
                </Button>
              </div>
            </section>

            {/* Checklist de domínio */}
            <section aria-label="Checklist de domínio">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ListChecks className="size-3.5" /> Checklist: só vá para a prova marcando tudo
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {MATH_CHECKLIST.map((g) => (
                  <Card key={g.grupo} className="rounded-lg p-3">
                    <p className="text-xs font-semibold">{g.grupo}</p>
                    <ul className="mt-2 space-y-1.5">
                      {g.itens.map((item, i) => {
                        const key = `${g.grupo}-${i}`;
                        const done = !!checklist[key];
                        return (
                          <li key={key} className="flex items-start gap-2">
                            <Checkbox
                              id={`chk-${key}`}
                              checked={done}
                              onCheckedChange={() => toggleCheck(key)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`chk-${key}`}
                              className={cn(
                                'min-w-0 flex-1 cursor-pointer text-xs leading-relaxed',
                                done ? 'text-muted-foreground line-through' : 'text-foreground/85',
                              )}
                            >
                              {item}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Score de prontidão: gauge radial + evidências + coach ----------

const READINESS_DOT: Record<ReadinessTone, string> = {
  pronto: 'bg-emerald-500',
  quase: 'bg-amber-500',
  atencao: 'bg-rose-500',
};

const READINESS_TEXT: Record<ReadinessTone, string> = {
  pronto: 'text-emerald-600 dark:text-emerald-400',
  quase: 'text-amber-600 dark:text-amber-400',
  atencao: 'text-rose-600 dark:text-rose-400',
};

const READINESS_BADGE: Record<ReadinessTone, string> = {
  pronto: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  quase: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  atencao: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const READINESS_LABEL: Record<ReadinessTone, string> = {
  pronto: 'pronto para a prova',
  quase: 'quase lá',
  atencao: 'precisa de atenção',
};

/** Barras na MESMA gramática semântica dos badges de tipo do plano. */
const COMPONENT_BAR: Record<ReadinessComponentId, string> = {
  simulado: 'bg-amber-500',
  exercicios: 'bg-violet-500',
  checklist: 'bg-emerald-500',
  baralho: 'bg-teal-500',
  plano: 'bg-sky-500',
};

const COMPONENT_ICON_BG: Record<ReadinessComponentId, string> = {
  simulado: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  exercicios: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  checklist: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  baralho: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  plano: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

const COMPONENT_ICON: Record<ReadinessComponentId, React.ComponentType<{ className?: string }>> = {
  simulado: Timer,
  exercicios: Dumbbell,
  checklist: ListChecks,
  baralho: Layers,
  plano: AlarmClock,
};

const GAUGE_R = 52;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

function ReadinessSection({
  readiness,
  daysLeft,
}: {
  readiness: ReadinessResult;
  daysLeft: number;
}) {
  const score = readiness.score;

  // Contagem animada: o número sobe junto com o arco (mesma duração).
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${Math.round(v)}`);
  React.useEffect(() => {
    const controls = animate(mv, score ?? 0, { duration: 1.1, ease: 'easeOut' });
    return () => controls.stop();
  }, [score, mv]);

  return (
    <section aria-label="Score de prontidão da Av1">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Target className="size-3.5" /> Score de prontidão
      </h3>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Gauge radial — arco esmeralda→teal animado, tom do veredito fica no badge */}
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <svg
            viewBox="0 0 120 120"
            className="size-28"
            role="img"
            aria-label={
              score === null
                ? 'Score de prontidão ainda sem dados'
                : `Score de prontidão ${score} de 100 — ${READINESS_LABEL[readiness.tone]}`
            }
          >
            <defs>
              <linearGradient id="readiness-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={GAUGE_R} fill="none" strokeWidth="11" className="stroke-muted" />
            <motion.circle
              cx="60"
              cy="60"
              r={GAUGE_R}
              fill="none"
              strokeWidth="11"
              strokeLinecap="round"
              stroke="url(#readiness-grad)"
              strokeDasharray={GAUGE_C}
              initial={{ strokeDashoffset: GAUGE_C }}
              animate={{ strokeDashoffset: score === null ? GAUGE_C : GAUGE_C * (1 - score / 100) }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            {score === null ? (
              <span className="text-xl font-bold text-muted-foreground" aria-hidden>
                —
              </span>
            ) : (
              <p className="text-center leading-none" aria-hidden>
                <motion.span className="text-2xl font-bold tabular-nums">{rounded}</motion.span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </p>
            )}
          </div>
        </div>

        {/* Evidências: 1 barra por componente, na cor do seu tipo */}
        <div className="min-w-0 flex-1 space-y-2.5">
          {readiness.components.map((c, i) => {
            const Icon = COMPONENT_ICON[c.id];
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="flex items-center gap-2.5"
              >
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-md',
                    c.pct === null ? 'bg-muted text-muted-foreground/50' : COMPONENT_ICON_BG[c.id],
                  )}
                  aria-hidden
                >
                  <Icon className="size-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn('truncate text-xs font-medium', c.pct === null && 'text-muted-foreground')}>
                      {c.label}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 text-[10px] font-semibold tabular-nums',
                        c.pct === null ? 'font-normal text-muted-foreground/70' : READINESS_TEXT[readiness.tone],
                      )}
                    >
                      {c.pct === null ? 'sem dados' : `${c.pct}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    {c.pct === null ? (
                      <div className="h-full w-full rounded-full border border-dashed border-border/80" aria-hidden />
                    ) : (
                      <motion.div
                        className={cn('h-full rounded-full', COMPONENT_BAR[c.id])}
                        initial={{ width: 0 }}
                        animate={{ width: `${c.pct}%` }}
                        transition={{ duration: 0.7, delay: 0.25 + i * 0.06, ease: 'easeOut' }}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{c.detail}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {score !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={cn('border-0 text-[10px]', READINESS_BADGE[readiness.tone])}>
            {READINESS_LABEL[readiness.tone]}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            sobe ao vivo: marcar tarefas, revisar cartões e correr o simulado
          </span>
        </div>
      )}
      {readiness.pendentesMat > 0 && (
        <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
          Caderno de Erros: {readiness.pendentesMat} pendente(s) na Matemática — revisar sobe o score e limpa o caderno.
        </p>
      )}

      <Button
        variant="outline"
        className="mt-3 w-full border-amber-300 bg-amber-50 text-amber-800 transition-transform hover:bg-amber-100 active:scale-[0.99] dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
        onClick={() =>
          openTutor({
            disciplineCode: MATH_EXAM.disciplineCode,
            question: buildReadinessQuestion(daysLeft, readiness, readiness.pendentesMat),
          })
        }
        aria-label="Pedir ao tutor um plano para chegar pronto na prova"
      >
        <Sparkles className="size-3.5" aria-hidden />
        {score === null
          ? 'Por onde começo para ter score? (plano do tutor)'
          : 'Como chego 100% pronto até 01/10? (plano do tutor)'}
      </Button>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Score = média ponderada das evidências (simulado 30% · exercícios 20% · checklist 20% ·
        baralho 15% · plano 15%). Componente sem dado não entra na conta — o score não inventa
        prontidão.
      </p>
    </section>
  );
}
