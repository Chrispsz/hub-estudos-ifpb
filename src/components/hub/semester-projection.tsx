'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  Flag,
  Layers,
  Lightbulb,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  disciplines,
  evaluationPeriods,
  getDisciplineByCode,
} from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { examWeekMilestoneFor, type ExamWeekMilestone } from '@/lib/math-exam-prep';
import { cn } from '@/lib/utils';
import { currentWeekOfSemester, daysUntilDate, weekStartDate } from '@/lib/semester';
import { getAllDisciplinesTopics } from '@/lib/study-topics';
import {
  activityBadgeFor,
  disciplineActivityFor,
} from '@/lib/discipline-activity';
import { useStudyProgress } from '@/lib/study-progress';

/** Rótulo de data curto da semana (ex.: "21-27/09"). */
function weekDateRange(week: number): string {
  const start = weekStartDate(week);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)}`;
}

/** Rótulo curto do marco (a família do mapa da 110: preparo/ensaio/véspera = amber, prova = rose). */
function milestoneChipLabel(kind: ExamWeekMilestone['kind']): string {
  switch (kind) {
    case 'preparo':
      return 'preparo';
    case 'simulado':
      return 'ensaio';
    case 'vespera':
      return 'véspera';
    case 'prova':
      return 'prova';
  }
}

export function SemesterProjection() {
  const sp = useStudyProgress();
  const [currentWeek, setCurrentWeek] = React.useState(10); // default 10 (evita hydration mismatch)
  React.useEffect(() => {
    setCurrentWeek(currentWeekOfSemester());
  }, []);

  // Próximas 6 semanas (se semana atual = 0 — pré/fim de semestre — mostra as 6 primeiras)
  // Só avaliações com DATA OFICIAL aparecem na projeção (política anti-estimativa).
  // Os MARCOS da semana da Av1 (preparo/ensaio/véspera/prova) vêm da FONTE ÚNICA
  // (examWeekMilestoneFor — a mesma voz da Agenda e do mapa da 110): o simulado
  // não é avaliação oficial, então a semana do ensaio era invisível aqui.
  const { weeks, criticalWeeks } = React.useMemo(() => {
    const base = currentWeek > 0 ? currentWeek : 1;
    const nextWeeks = Array.from({ length: 6 }, (_, i) => {
      const week = base + i;
      const evals = evaluationPeriods.filter((e) => e.date && e.estimatedWeek === week);
      // Marcos da Av1 dentro dos 7 dias da semana (dia LOCAL — a fonte compara
      // o dia local e weekStartDate já devolve dias locais; sem conversão).
      const weekStart = weekStartDate(week);
      const milestones: ExamWeekMilestone[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart.getTime() + d * 24 * 60 * 60 * 1000);
        const m = examWeekMilestoneFor(day);
        if (m) milestones.push(m);
      }
      return { week, evals, milestones };
    });
    return {
      weeks: nextWeeks,
      criticalWeeks: nextWeeks.filter((w) => w.evals.length >= 2).map((w) => w.week),
    };
  }, [currentWeek]);

  // Agregação de tópicos por disciplina — computada UMA vez e reaproveitada
  // pelas sugestões e pelo resumo de progresso.
  const topicSummaries = React.useMemo(
    () => getAllDisciplinesTopics(sp.progress.topicProgress),
    [sp.progress.topicProgress],
  );
  // O PROGRESSO QUE SE REGISTRA SOZINHO (117): a prévia lê a MESMA fonte do
  // painel (discipline-activity) — a barra por disciplina passa a medir o
  // ACOMPANHAMENTO DO DADO (material-first) e o selo nunca diz 'atrasada':
  // em dia / em estudo / sem registro. Os checkboxes manuais seguem visíveis
  // como contagem N/M (marcados por você) — honestos sobre a própria natureza.
  const activityByCode = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof disciplineActivityFor>>();
    for (const d of disciplines) {
      map.set(d.code, disciplineActivityFor(d.code, sp.progress));
    }
    return map;
  }, [sp.progress]);

  // A PRÓXIMA AVALIAÇÃO DATADA de cada disciplina (fonte única: course-data) —
  // o gate da reta final: a 7 dias da prova da PRÓPRIA disciplina, sugerir
  // 'reserve 3 semanas' para começar um tópico novo contradiz o kit da véspera.
  const nextEvalDaysByCode = React.useMemo(() => {
    const map = new Map<string, { name: string; days: number }>();
    const today = new Date();
    for (const e of evaluationPeriods) {
      if (!e.date) continue;
      const target = new Date(`${e.date}T12:00:00`);
      const days = Math.ceil(
        (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() -
          new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
          (24 * 60 * 60 * 1000),
      );
      if (days < 0) continue; // já passou — não é a prova que o aluno encara
      const prev = map.get(e.disciplineCode);
      if (!prev || days < prev.days) {
        map.set(e.disciplineCode, { name: e.evaluationName, days });
      }
    }
    return map;
  }, []);

  // Sugestões de "comece agora"
  const startNowSuggestions = React.useMemo(() => {
    const suggestions: {
      discipline: ReturnType<typeof getDisciplineByCode>;
      topic: string;
      reason: string;
      examDays?: number;
      examName?: string;
    }[] = [];

    // Para Matemática - Funções (precisa de 3 semanas)
    const mat = topicSummaries.find((s) => s.discipline.code === 'TEC.1984');
    if (mat) {
      const funcoesUnit = mat.units.find((u) => u.name.includes('Funções'));
      if (funcoesUnit && !funcoesUnit.done) {
        // A RETA FINAL MANDA: a 7 dias da Av1, 'reserve 3 semanas' contradiz o
        // kit (sem conteúdo novo) — a sugestão vira aliada da semana.
        const nextEval = nextEvalDaysByCode.get('TEC.1984');
        const gated = nextEval !== undefined && nextEval.days <= 7;
        suggestions.push({
          discipline: mat.discipline,
          topic: 'Funções',
          reason: gated
            ? `${nextEval.name} ${nextEval.days === 0 ? 'é hoje' : `em ${nextEval.days} ${nextEval.days === 1 ? 'dia' : 'dias'}`} — sem conteúdo novo agora; Funções volta depois da prova.`
            : 'Tópico complexo, reserve 3 semanas para dominar.',
          examDays: gated ? nextEval.days : undefined,
          examName: gated ? nextEval.name : undefined,
        });
      }
    }
    // Para Algoritmos - Vetores/Matrizes
    const alg = topicSummaries.find((s) => s.discipline.code === 'TEC.1687');
    if (alg) {
      const vetoresUnit = alg.units.find((u) => u.name.toLowerCase().includes('vetores'));
      if (vetoresUnit && !vetoresUnit.done) {
        suggestions.push({
          discipline: alg.discipline,
          topic: 'Vetores e matrizes',
          reason: 'Base para a Prova 3 (peso 33%). Comece cedo.',
        });
      }
    }
    // Para LM - CSS (precisa de prática)
    const lm = topicSummaries.find((s) => s.discipline.code === 'TEC.1632');
    if (lm) {
      const cssUnit = lm.units.find((u) => u.name.toLowerCase().includes('css'));
      if (cssUnit && !cssUnit.done) {
        suggestions.push({
          discipline: lm.discipline,
          topic: 'CSS (Flexbox/Grid)',
          reason: 'Necessário para o A2 (peso 45%). Pratique muito.',
        });
      }
    }
    return suggestions.slice(0, 3);
  }, [topicSummaries, nextEvalDaysByCode]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Layers className="size-5 text-emerald-500" /> Prévia do semestre
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentWeek > 0 ? (
            <>
              Semana atual: <strong>{currentWeek}</strong> de 19. Próximas 6 semanas com avaliações e sugestões.
            </>
          ) : (
            <>Fora do período letivo (24/08/2026 – 30/01/2027). Próximas 6 semanas do próximo ciclo.</>
          )}
        </p>
      </div>

      {/* Timeline visual */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {weeks.map((w, i) => {
          const isCurrent = i === 0;
          const isCritical = criticalWeeks.includes(w.week);
          return (
            <motion.div
              key={w.week}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <Card
                className={cn(
                  'flex h-full min-h-44 flex-col rounded-xl bg-card p-3 shadow-sm',
                  isCurrent && 'ring-2 ring-emerald-500/40',
                  isCritical && 'border-l-4 border-l-rose-500',
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sem {w.week}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">{weekDateRange(w.week)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isCurrent && (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        agora
                      </Badge>
                    )}
                    {isCritical && (
                      <Badge
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-rose-700 text-[9px] dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400"
                      >
                        <AlertTriangle className="size-2.5" /> crítica
                      </Badge>
                    )}
                  </div>
                </div>
                {w.evals.length === 0 ? (
                  <p className="flex-1 text-xs text-muted-foreground">
                    Sem avaliações. Boa semana para revisar e adiantar conteúdo.
                  </p>
                ) : (
                  <ul className="flex-1 space-y-1.5">
                    {w.evals.map((e, j) => {
                      const disc = getDisciplineByCode(e.disciplineCode);
                      const color = getColorClasses(disc?.color ?? 'slate');
                      const days = e.date ? daysUntilDate(e.date) : -1;
                      return (
                        <li
                          key={j}
                          className={cn(
                            'rounded-md border-l-4 p-2',
                            color.border,
                            color.bgSoft,
                          )}
                        >
                          <p className={cn('text-[11px] font-semibold leading-tight', color.text)}>
                            {disc?.shortName ?? e.disciplineCode}
                          </p>
                          <p className="text-xs font-medium leading-snug">{e.evaluationName}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {/* A semana chegou: 'esta semana' virava mentira nos
                                dois lados — o dia 0 É hoje, e o passado não é
                                'esta semana' (a data passada diz o que é). */}
                            {days > 0
                              ? `Em ${days} dias`
                              : days === 0
                                ? 'é hoje!'
                                : days < 0
                                  ? 'data passada'
                                  : 'esta semana'}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {/* Os marcos da semana da Av1 (fonte única, a voz do mapa da 110):
                    o ensaio não é avaliação oficial — sem esta linha, a semana
                    do simulado era invisível na prévia. */}
                {w.milestones.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border/40 pt-2">
                    <CalendarClock className="size-3 shrink-0 text-amber-500/80" aria-hidden="true" />
                    {w.milestones.map((m) => {
                      const isProva = m.kind === 'prova';
                      return (
                        <span
                          key={m.kind}
                          className={cn(
                            'rounded border px-1 py-0.5 text-[9px] leading-none tabular-nums',
                            isProva
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                          )}
                          title={`${m.titulo} — ${m.detalhe}`}
                        >
                          {milestoneChipLabel(m.kind)} {m.date.slice(8, 10)}
                        </span>
                      );
                    })}
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Semanas críticas */}
      {criticalWeeks.length > 0 && (
        <Card className="rounded-xl border-l-4 border-l-rose-500 bg-rose-50 p-4 shadow-sm dark:bg-rose-950/30">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
            <AlertTriangle className="size-4" /> Semanas críticas
          </h3>
          <p className="mt-1 text-xs text-rose-900 dark:text-rose-300">
            {criticalWeeks.length > 1
              ? `As semanas ${criticalWeeks.join(', ')} têm 2+ avaliações.`
              : `A semana ${criticalWeeks[0]} tem 2+ avaliações.`}
            {' '}Adiante conteúdo e revise com antecedência.
          </p>
        </Card>
      )}

      {/* Sugestões "comece agora" */}
      {startNowSuggestions.length > 0 && (
        <Card className="rounded-xl bg-card p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4 text-amber-500" /> Comece agora (tópicos complexos)
          </h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {startNowSuggestions.map((s, i) => {
              const color = getColorClasses(s.discipline?.color ?? 'slate');
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-md border-l-4 p-3',
                    color.border,
                    // A reta final em vista: a tinta da espera (amber) — a
                    // sugestão virou aliada da semana, não competidora do kit.
                    s.examDays !== undefined ? 'bg-amber-500/10' : 'bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-md',
                        color.bgSoft,
                        color.text,
                      )}
                    >
                      <DisciplineIcon name={s.discipline?.icon ?? 'BookOpen'} className="size-3.5" />
                    </span>
                    <p className={cn('text-xs font-semibold', color.text)}>
                      {s.discipline?.shortName}
                    </p>
                    {s.examDays !== undefined && (
                      <Badge
                        variant="outline"
                        className="ml-auto border-amber-500/30 bg-amber-500/10 text-[9px] tabular-nums text-amber-600 dark:text-amber-400"
                      >
                        reta final
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{s.topic}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.reason}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Resumo geral de progresso por disciplina */}
      <Card className="rounded-xl bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Flag className="size-4 text-emerald-500" /> Progresso por disciplina (PPC)
        </h3>
        <div className="space-y-2">
          {topicSummaries.map((s) => {
            const color = getColorClasses(s.discipline.color);
            // FONTE ÚNICA (117): a mesma atividade real do painel — barra mede
            // acompanhamento do dado; sem material registrado, sem régua (a
            // barra some em vez de exibir 0%).
            const act = activityByCode.get(s.discipline.code) ?? null;
            const badge = act ? activityBadgeFor(act) : null;
            return (
              <div
                key={s.discipline.code}
                data-activity-row={s.discipline.code}
                className="flex items-center gap-3 text-xs"
              >
                <span className={cn('size-2.5 shrink-0 rounded-full', color.dot)} />
                <span className="w-32 shrink-0 truncate font-medium">
                  {s.discipline.shortName}
                </span>
                {act?.pctAcompanha != null ? (
                  <div
                    className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={act.pctAcompanha}
                    aria-label={`Acompanha ${act.pctAcompanha}% do conteúdo dado em aula`}
                  >
                    <div
                      className={cn('h-full rounded-full transition-all', color.bgSolid)}
                      style={{ width: `${act.pctAcompanha}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-2 flex-1" />
                )}
                <span
                  className="w-20 shrink-0 text-right text-muted-foreground"
                  title="Tópicos marcados por você na aba Estudo (o resto o Hub registra sozinho)"
                >
                  {s.doneTopics}/{s.totalTopics}
                </span>
                {badge && (
                  <Badge
                    variant="outline"
                    title={badge.title}
                    className={cn(
                      'shrink-0 border text-[9px]',
                      badge.tone === 'dia' &&
                        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400',
                      badge.tone === 'estudo' &&
                        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400',
                      badge.tone === 'registro' &&
                        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-400',
                    )}
                  >
                    {s.isComplete ? '✓' : badge.label}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
