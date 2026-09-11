'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CalendarCheck,
  Clock3,
  Hourglass,
  ImageDown,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  CalendarRange,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStudyProgress, type PomodoroSession } from '@/lib/study-progress';
import { cn } from '@/lib/utils';

const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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

function trendBadge(current: number, previous: number, suffix?: string) {
  let trend: Trend = 'flat';
  let pct = 0;
  if (previous === 0 && current > 0) {
    return { trend: 'up' as Trend, text: 'novo', pct: null };
  }
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
  return { trend, text, pct };
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
  );
  const lastWeek = React.useMemo(
    () => computeWeek(sp.progress.pomodoroSessions, 7, 13),
    [sp.progress.pomodoroSessions],
  );

  const hasData = thisWeek.sessions > 0 || lastWeek.sessions > 0;

  const minsTrend = trendBadge(thisWeek.minutes, lastWeek.minutes, 'min');
  const sessionsTrend = trendBadge(thisWeek.sessions, lastWeek.sessions);
  const daysTrend = trendBadge(thisWeek.activeDays, lastWeek.activeDays, 'dias');
  const avgTrend = trendBadge(thisWeek.avgSessionMin, lastWeek.avgSessionMin, 'min');

  const metrics: MetricDef[] = [
    {
      icon: Clock3,
      iconClasses: 'bg-emerald-500/15 text-emerald-500',
      label: 'Minutos de foco',
      current: String(thisWeek.minutes),
      trend: minsTrend.trend,
      trendText: minsTrend.text,
    },
    {
      icon: Activity,
      iconClasses: 'bg-teal-500/15 text-teal-500',
      label: 'Sessões concluídas',
      current: String(thisWeek.sessions),
      trend: sessionsTrend.trend,
      trendText: sessionsTrend.text,
    },
    {
      icon: CalendarCheck,
      iconClasses: 'bg-violet-500/15 text-violet-500',
      label: 'Dias ativos',
      current: String(thisWeek.activeDays),
      trend: daysTrend.trend,
      trendText: daysTrend.text,
    },
    {
      icon: Hourglass,
      iconClasses: 'bg-amber-500/15 text-amber-500',
      label: 'Média por sessão',
      current: `${thisWeek.avgSessionMin} min`,
      trend: avgTrend.trend,
      trendText: avgTrend.text,
    },
  ];

  // Mensagem motivacional
  const message = !hasData
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
            {formatRange(6, 0)} <span className="mx-0.5">vs</span> {formatRange(13, 7)}
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

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {thisWeek.bestDayLabel && thisWeek.bestDayMinutes > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-400">
            🏆 Melhor dia: <strong className="font-semibold">{thisWeek.bestDayLabel}</strong> (
            {thisWeek.bestDayMinutes} min)
          </span>
        ) : null}
        <p className="text-muted-foreground">{message}</p>
      </div>
    </Card>
  );
}
