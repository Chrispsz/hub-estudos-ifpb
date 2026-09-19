'use client';

// ExamPrepCard — FOCO: Prova de Matemática (Av1, 01/10).
// Card do Painel com plano de 12 dias material-first, fórmulas essenciais,
// checklist de domínio e atalho para o Simulado da Prova. Persistência do
// progresso das tarefas em localStorage (sobrevive a reloads).

import * as React from 'react';
import {
  AlarmClock,
  BookOpen,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  GraduationCap,
  ListChecks,
  Sigma,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { daysUntilDate } from '@/lib/semester';
import { openMethod, openSimulado } from '@/lib/hub-events';
import { useLocalStorage } from '@/lib/use-local-storage';
import { cn } from '@/lib/utils';
import {
  MATH_CHECKLIST,
  MATH_EXAM,
  MATH_EXAM_PLAN,
  MATH_FORMULAS,
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

/** Mapeia "faltam N dias" para o dia do plano (começa hoje com 12 dias). */
function planDayForDaysLeft(daysLeft: number): PlanDay | undefined {
  if (daysLeft < 0) return undefined;
  const offset = Math.min(Math.max(daysLeft - 1, 0), MATH_EXAM_PLAN.length - 1);
  return planDayFor(offset) ?? MATH_EXAM_PLAN[Math.min(offset, MATH_EXAM_PLAN.length - 1)];
}

export function ExamPrepCard() {
  const daysLeft = daysUntilDate(MATH_EXAM.date);
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = useLocalStorage<CheckedMap>(LS_PLAN, {});
  const [checklist, setChecklist] = useLocalStorage<CheckedMap>(LS_CHECK, {});

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
      </Card>

      {/* Dialog: plano completo + fórmulas + checklist */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl p-0">
          <div className="border-b bg-gradient-to-r from-rose-500/10 to-transparent px-6 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="size-5 text-rose-500" />
                Plano de 12 dias — Prova de Matemática
              </DialogTitle>
              <DialogDescription>
                {MATH_EXAM.programa} · {MATH_EXAM.notaPeso}. Tudo extraído dos
                materiais reais da disciplina.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 py-4">
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
                  <Card key={f.titulo} className="rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{f.titulo}</p>
                      <Badge variant="outline" className="border-border text-[9px] text-muted-foreground">
                        {f.grupo}
                      </Badge>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-foreground/80">
                      {f.corpo}
                    </p>
                  </Card>
                ))}
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
