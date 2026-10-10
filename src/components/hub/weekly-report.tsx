'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BookOpenCheck,
  CalendarCheck,
  CalendarClock,
  CircleCheck,
  Clock3,
  Hourglass,
  ImageDown,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  CalendarRange,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStudyProgress, type PomodoroSession } from '@/lib/study-progress';
import { openTutor } from '@/lib/hub-events';
import {
  MATH_EXAM,
  MATH_META,
  weeklyReportExamBriefFor,
  type WeeklyReportExamBrief,
} from '@/lib/math-exam-prep';
import { daysUntilDate } from '@/lib/semester';
import {
  buildWeeklyQuestion,
  weekDisciplineShares,
  type WeekSummary,
} from '@/lib/weekly-coach';
import { getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';

const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * STRIP DO DIA-MARCO no relatório — a MESMA gramática sólida do cronograma
 * (fonte visual única da 99): âmbar p/ marco pendente, emerald quando o
 * registro chegou (registro vence relógio, lição 85/86), rose na prova.
 * Chip D-N tabular ancora o FUTURO (os rótulos do card olham para trás) e o
 * pulso vive só no ensaio que ainda não aconteceu (a calma vence quando o
 * registro chegou — gramática da 93).
 */
const STRIP_SOLID: Record<'amber' | 'rose' | 'emerald', string> = {
  amber:
    'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30 dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-900',
  rose: 'border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-600/30 dark:border-rose-500 dark:bg-rose-500',
  emerald:
    'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/30 dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-900',
};

function WeeklyExamStrip({ brief, daysLeft }: { brief: WeeklyReportExamBrief; daysLeft: number }) {
  const family = brief.kind === 'prova' ? 'rose' : brief.feito ? 'emerald' : 'amber';
  const icon =
    brief.kind === 'prova' ? (
      <CalendarCheck className="size-3.5 shrink-0" />
    ) : brief.kind === 'vespera' ? (
      <BookOpenCheck className="size-3.5 shrink-0" />
    ) : brief.feito ? (
      <CircleCheck className="size-3.5 shrink-0" />
    ) : (
      <CalendarClock className="size-3.5 shrink-0 animate-pulse" />
    );
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
        STRIP_SOLID[family],
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold leading-tight">
          {brief.titulo}
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
            D-{daysLeft}
          </span>
          {brief.feito && brief.pct !== null && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
              {brief.pct}% · meta {MATH_META}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs leading-snug opacity-90">{brief.linha}</p>
      </div>
    </motion.div>
  );
}

/** Chave yyyy-mm-dd (UTC) — mesmo padrão de PomodoroSession.date. */
function utcKey(offsetDaysAgo: number): string {
  return new Date(Date.now() - offsetDaysAgo * DAY_MS).toISOString().slice(0, 10);
}

/** Intervalo legível "11 set – 17 set". */
function formatRange(fromDaysAgo: number, toDaysAgo: number): string {
  const fmt = (key: string) => {
    const [, m, d] = key.split('-');
    return `${Number(d)} ${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m) - 1]}`;
  };
  return `${fmt(utcKey(fromDaysAgo))} – ${fmt(utcKey(toDaysAgo))}`;
}

interface WeekMetrics {
  minutes: number;
  sessions: number;
  activeDays: number;
  avgSessionMin: number;
  bestDayLabel: string | null;
  bestDayMinutes: number;
}

function computeWeek(sessions: PomodoroSession[], fromDaysAgo: number, toDaysAgo: number): WeekMetrics {
  const keys = new Set<string>();
  for (let i = fromDaysAgo; i <= toDaysAgo; i++) keys.add(utcKey(i));

  let minutes = 0;
  let sessionsCount = 0;
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    if (!keys.has(s.date)) continue;
    minutes += s.focusMinutes;
    sessionsCount += 1;
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.focusMinutes);
  }

  let bestKey: string | null = null;
  let bestMinutes = 0;
  for (const [key, mins] of byDate) {
    if (mins > bestMinutes) {
      bestMinutes = mins;
      bestKey = key;
    }
  }

  return {
    minutes,
    sessions: sessionsCount,
    activeDays: byDate.size,
    avgSessionMin: sessionsCount === 0 ? 0 : Math.round(minutes / sessionsCount),
    bestDayLabel: bestKey
      ? WEEKDAY_LABELS[new Date(`${bestKey}T12:00:00Z`).getUTCDay()]
      : null,
    bestDayMinutes: bestMinutes,
  };
}

type Trend = 'up' | 'down' | 'flat';

function trendBadge(current: number, previous: number, suffix?: string): { trend: Trend; text: string } {
  if (previous === 0 && current > 0) {
    return { trend: 'up', text: 'novo' };
  }
  let trend: Trend = 'flat';
  let pct = 0;
  if (previous > 0) {
    pct = Math.round(((current - previous) / previous) * 100);
    if (pct > 2) trend = 'up';
    else if (pct < -2) trend = 'down';
    else trend = 'flat';
  }
  const text =
    trend === 'flat'
      ? 'estável'
      : `${pct > 0 ? '+' : ''}${pct}%${suffix ? ` ${suffix}` : ''}`;
  return { trend, text };
}

function TrendPill({ trend, text }: { trend: Trend; text: string }) {
  const styles = {
    up: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
    down: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
    flat: 'border-border bg-muted/50 text-muted-foreground',
  } as const;
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <Badge variant="outline" className={cn('gap-1 border text-[10px] font-semibold', styles[trend])}>
      <Icon className="size-3" aria-hidden="true" />
      {text}
    </Badge>
  );
}

interface MetricDef {
  icon: React.ComponentType<{ className?: string }>;
  iconClasses: string;
  label: string;
  current: string;
  trend: Trend;
  trendText: string;
}

export function WeeklyReport() {
  const sp = useStudyProgress();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = React.useState(false);

  /** Exporta o card do relatório como imagem PNG (compartilhar/ guardar). */
  const exportPng = React.useCallback(async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor || '#000000',
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset && node.dataset.noExport === 'true'),
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `relatorio-semanal-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast.success('Relatório exportado em PNG!');
    } catch {
      toast.error('Não foi possível exportar o PNG — tente novamente.');
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // Janelas: últimos 7 dias (0–6) vs 7 dias anteriores (7–13)
  const thisWeek = React.useMemo(
    () => computeWeek(sp.progress.pomodoroSessions, 0, 6),
    [sp.progress.pomodoroSessions],
  ) as WeekSummary;
  const lastWeek = React.useMemo(
    () => computeWeek(sp.progress.pomodoroSessions, 7, 13),
    [sp.progress.pomodoroSessions],
  ) as WeekSummary;

  // Rótulos do período (mesma âncora temporal das janelas acima)
  const rangeLabels = React.useMemo(
    () => ({ current: formatRange(6, 0), previous: formatRange(13, 7) }),
    [sp.progress.pomodoroSessions],
  );

  // ----- Coach semanal (IA): dados reais da semana → pergunta ao tutor -----
  const shares = React.useMemo(
    () => weekDisciplineShares(sp.progress.pomodoroSessions),
    [sp.progress.pomodoroSessions],
  );
  const totalSharedMin = React.useMemo(
    () => shares.reduce((acc, s) => acc + s.minutes, 0),
    [shares],
  );
  const topDisciplineCode = shares[0]?.disciplineCode;

  const askCoach = React.useCallback(() => {
    const question = buildWeeklyQuestion({
      thisWeek,
      lastWeek,
      rangeCurrent: rangeLabels.current,
      rangePrevious: rangeLabels.previous,
      sessions: sp.progress.pomodoroSessions,
      simuladoRuns: sp.progress.simuladoRuns ?? [],
    });
    openTutor({
      disciplineCode: topDisciplineCode,
      question,
    });
  }, [thisWeek, lastWeek, rangeLabels, sp.progress.pomodoroSessions, sp.progress.simuladoRuns, topDisciplineCode]);

  const hasData = thisWeek.sessions > 0 || lastWeek.sessions > 0;

  // MARCO DO DIA — render-time (lição 79): o relógio é lido NO render, o run
  // entra pelo storage event (mesmo re-render). Nos 3 dias da reta final o
  // relatório cede a voz: a faixa substitui a mensagem de ritmo — 'agende um
  // bloco' no dia da prova era a pressão que a 99 matou no cronograma.
  const examDaysLeft = daysUntilDate(MATH_EXAM.date);
  const examBrief = weeklyReportExamBriefFor(examDaysLeft, sp.progress.simuladoRuns);

  const trends = React.useMemo(
    () => ({
      mins: trendBadge(thisWeek.minutes, lastWeek.minutes, 'min'),
      sessions: trendBadge(thisWeek.sessions, lastWeek.sessions),
      days: trendBadge(thisWeek.activeDays, lastWeek.activeDays, 'dias'),
      avg: trendBadge(thisWeek.avgSessionMin, lastWeek.avgSessionMin, 'min'),
    }),
    [thisWeek, lastWeek],
  );

  const metrics = React.useMemo<MetricDef[]>(
    () => [
      {
        icon: Clock3,
        iconClasses: 'bg-emerald-500/15 text-emerald-500',
        label: 'Minutos de foco',
        current: String(thisWeek.minutes),
        trend: trends.mins.trend,
        trendText: trends.mins.text,
      },
      {
        icon: Activity,
        iconClasses: 'bg-teal-500/15 text-teal-500',
        label: 'Sessões concluídas',
        current: String(thisWeek.sessions),
        trend: trends.sessions.trend,
        trendText: trends.sessions.text,
      },
      {
        icon: CalendarCheck,
        iconClasses: 'bg-violet-500/15 text-violet-500',
        label: 'Dias ativos',
        current: String(thisWeek.activeDays),
        trend: trends.days.trend,
        trendText: trends.days.text,
      },
      {
        icon: Hourglass,
        iconClasses: 'bg-amber-500/15 text-amber-500',
        label: 'Média por sessão',
        current: `${thisWeek.avgSessionMin} min`,
        trend: trends.avg.trend,
        trendText: trends.avg.text,
      },
    ],
    [thisWeek, trends],
  );

  // Mensagem motivacional — SUPRIMIDA no dia-macro (a faixa é a mensagem;
  // nenhuma meta de ritmo no dia do ensaio, da véspera ou da prova).
  const message = examBrief
    ? null
    : !hasData
      ? 'Complete um Pomodoro na aba Estudar para ver seu relatório aqui.'
      : thisWeek.minutes > lastWeek.minutes
        ? 'Você está evoluindo em relação à semana passada. Continue assim! 🚀'
        : thisWeek.minutes === lastWeek.minutes && thisWeek.minutes > 0
          ? 'Ritmo estável — que tal adicionar mais uma sessão esta semana?'
          : 'Hora de retomar o ritmo: agende um bloco no cronograma de hoje.';

  return (
    <Card
      ref={cardRef}
      className="rounded-xl border-l-4 border-l-teal-500 bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="size-4 text-teal-500" aria-hidden="true" />
          Relatório semanal
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {rangeLabels.current} <span className="mx-0.5">vs</span> {rangeLabels.previous}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-teal-500/10 hover:text-teal-300"
            onClick={exportPng}
            disabled={exporting || !hasData}
            data-no-export="true"
            aria-label="Exportar relatório semanal como imagem PNG"
            title={hasData ? 'Baixar este relatório como PNG' : 'Sem dados para exportar ainda'}
          >
            {exporting ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <ImageDown className="size-3" aria-hidden="true" />
            )}
            PNG
          </Button>
        </div>
      </div>

      {/* DIA-MARCO DA AV1 — a analítica também sabe a semana (janela da 88/99) */}
      {examBrief && <WeeklyExamStrip brief={examBrief} daysLeft={examDaysLeft} />}

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.05 }}
            className="rounded-lg border border-border/60 bg-muted/20 p-3"
          >
            <div className="flex items-center justify-between gap-1">
              <span className={cn('grid size-7 place-items-center rounded-md', m.iconClasses)}>
                <m.icon className="size-3.5" aria-hidden="true" />
              </span>
              <TrendPill trend={m.trend} text={m.trendText} />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums leading-none">{m.current}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{m.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Onde o tempo foi — distribuição por disciplina (dados reais da semana) */}
      {shares.length > 0 && totalSharedMin > 0 ? (
        <div className="mt-3" data-no-export="true">
          <div
            className="flex h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Distribuição do foco da semana por disciplina: ${shares
              .slice(0, 4)
              .map((s) => `${getDisciplineByCode(s.disciplineCode)?.shortName || s.disciplineCode} ${s.minutes} min`)
              .join(', ')}`}
          >
            {shares.map((s, i) => {
              const disc = getDisciplineByCode(s.disciplineCode);
              const color = getColorClasses(disc?.color ?? 'slate');
              const pct = (s.minutes / totalSharedMin) * 100;
              return (
                <motion.div
                  key={s.disciplineCode}
                  className={cn('h-full first:rounded-l-full last:rounded-r-full', color.bgSolid)}
                  style={{ width: `${pct}%` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  title={`${disc?.shortName || s.disciplineCode}: ${s.minutes} min`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {shares.slice(0, 4).map((s) => {
              const disc = getDisciplineByCode(s.disciplineCode);
              const color = getColorClasses(disc?.color ?? 'slate');
              return (
                <span key={s.disciplineCode} className="flex items-center gap-1">
                  <span className={cn('size-1.5 rounded-full', color.dot)} aria-hidden />
                  {disc?.shortName || s.disciplineCode}
                  <span className="tabular-nums">{s.minutes}min</span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Rodapé do relatório — só existe quando tem o que dizer; no dia-macro
          sem registro a faixa já é a mensagem inteira (linha some, sem stray). */}
      {(message || hasData || (thisWeek.bestDayLabel != null && thisWeek.bestDayMinutes > 0)) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {thisWeek.bestDayLabel != null && thisWeek.bestDayMinutes > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-400">
              🏆 Melhor dia: <strong className="font-semibold">{thisWeek.bestDayLabel}</strong> (
              {thisWeek.bestDayMinutes} min)
            </span>
          ) : null}
          {message && <p className="text-muted-foreground">{message}</p>}
        {/* Coach semanal — âmbar (família análise: evolução/debriefing/caderno) */}
        {hasData ? (
          <Button
            size="sm"
            variant="outline"
            onClick={askCoach}
            data-no-export="true"
            className="ml-auto h-7 gap-1.5 border-amber-300/70 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-800 transition-all hover:bg-amber-100 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-1 active:scale-95 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
            aria-label="Enviar os números da semana para a IA analisar como coach"
            title="A IA lê a semana inteira (foco, distribuição, simulados, dias até a prova) e responde com leitura honesta + plano de 7 dias"
          >
            <Sparkles className="size-3" aria-hidden="true" />
            Analisar minha semana com IA
          </Button>
        ) : null}
        </div>
      )}
    </Card>
  );
}
