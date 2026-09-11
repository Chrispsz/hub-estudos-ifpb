'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Flame } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { PomodoroSession } from '@/lib/study-progress';
import { cn } from '@/lib/utils';

const DAY_MS = 86_400_000;
const WEEKS = 18; // ~4 meses de histórico visível

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Chave yyyy-mm-dd (UTC) — mesmo padrão de PomodoroSession.date. */
function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface HeatCell {
  key: string;
  date: Date;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/** Classe de cor da célula — escala esmeralda sobre AMOLED, sem azul. */
function levelClass(level: HeatCell['level']): string {
  switch (level) {
    case 0:
      return 'bg-muted/40';
    case 1:
      return 'bg-emerald-500/25';
    case 2:
      return 'bg-emerald-500/45';
    case 3:
      return 'bg-emerald-500/70';
    case 4:
      return 'bg-emerald-500 shadow-[0_0_6px_-1px_rgba(16,185,129,0.8)]';
  }
}

export function StudyHeatmap({
  sessions,
  dailyGoal,
}: {
  sessions: PomodoroSession[];
  dailyGoal: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Mapa date → minutos de foco
  const minutesByDate = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      map.set(s.date, (map.get(s.date) ?? 0) + s.focusMinutes);
    }
    return map;
  }, [sessions]);

  // Grade: WEEKS colunas de semanas terminando na semana atual (Dom..Sáb)
  const { columns, monthLabels } = React.useMemo(() => {
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    // Fim da semana corrente (próximo sábado, inclusive hoje)
    const daysUntilSaturday = 6 - todayUtc.getUTCDay();
    const gridEnd = new Date(todayUtc.getTime() + daysUntilSaturday * DAY_MS);
    const gridStart = new Date(gridEnd.getTime() - (WEEKS * 7 - 1) * DAY_MS);

    const cols: HeatCell[][] = [];
    const labels: Array<{ col: number; label: string }> = [];
    let lastMonth = -1;

    for (let w = 0; w < WEEKS; w++) {
      const col: HeatCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(gridStart.getTime() + (w * 7 + d) * DAY_MS);
        const key = utcKey(date);
        const mins = minutesByDate.get(key) ?? 0;
        const future = date.getTime() > todayUtc.getTime();
        // Nível: meta diária define a escala (50% da meta = nível 2)
        let level: HeatCell['level'] = 0;
        if (mins > 0) level = 1;
        if (dailyGoal > 0 && mins >= dailyGoal * 0.5) level = 2;
        if (dailyGoal > 0 && mins >= dailyGoal) level = 3;
        if (dailyGoal > 0 && mins >= dailyGoal * 1.75) level = 4;
        col.push({ key, date, minutes: mins, level, future });
      }
      // Rótulo do mês na 1ª coluna da semana que contém dia 1..7
      const firstCell = col[0];
      const m = firstCell.date.getUTCMonth();
      if (m !== lastMonth) {
        labels.push({ col: w, label: MONTH_SHORT[m] });
        lastMonth = m;
      }
      cols.push(col);
    }
    return { columns: cols, monthLabels: labels };
  }, [minutesByDate, dailyGoal]);

  // Estatísticas do período exibido
  const periodStats = React.useMemo(() => {
    const cells = columns.flat().filter((c) => !c.future);
    const totalMin = cells.reduce((acc, c) => acc + c.minutes, 0);
    const activeDays = cells.filter((c) => c.minutes > 0).length;
    // Melhor sequência dentro da janela
    let best = 0;
    let run = 0;
    for (const c of cells) {
      if (c.minutes > 0) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
    return { totalMin, activeDays, best };
  }, [columns]);

  const fmtTotal =
    periodStats.totalMin >= 60
      ? `${Math.floor(periodStats.totalMin / 60)}h${periodStats.totalMin % 60 > 0 ? ` ${periodStats.totalMin % 60}min` : ''}`
      : `${periodStats.totalMin} min`;

  return (
    <Card className="rounded-xl bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-emerald-500" aria-hidden="true" />
          Mapa de consistência
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 tabular-nums">
            {fmtTotal} nos últimos {WEEKS} semanas
          </span>
          {periodStats.best > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
              <Flame className="size-3" aria-hidden="true" /> melhor sequência:{' '}
              {periodStats.best} {periodStats.best === 1 ? 'dia' : 'dias'}
            </span>
          )}
        </div>
      </div>

      {!mounted ? (
        <div className="mt-4 h-32 animate-pulse rounded-lg bg-muted/30" aria-hidden="true" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 overflow-x-auto pb-1"
        >
          <div className="min-w-max">
            {/* Rótulos dos meses */}
            <div className="ml-9 mb-1 flex gap-[3px]">
              {columns.map((_, w) => {
                const label = monthLabels.find((m) => m.col === w);
                return (
                  <div
                    key={w}
                    className="w-3 text-[9px] capitalize text-muted-foreground"
                    aria-hidden="true"
                  >
                    {label ? label.label : ''}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-[3px]">
              {/* Rótulos dos dias da semana (Seg/Qua/Sex) */}
              <div
                className="mr-0.5 flex w-8 flex-col gap-[3px] text-right text-[9px] text-muted-foreground"
                aria-hidden="true"
              >
                {WEEKDAY_SHORT.map((d, i) => (
                  <div key={d} className="flex h-3 items-center justify-end leading-none">
                    {i % 2 === 1 ? d : ''}
                  </div>
                ))}
              </div>

              {/* Grade de semanas */}
              <div role="img" aria-label={`Mapa de consistência: ${fmtTotal} de foco em ${periodStats.activeDays} dias ativos nos últimos ${WEEKS} semanas`}>
                {columns.map((col, w) => (
                  <div key={w} className="mr-[3px] inline-flex flex-col gap-[3px] align-top">
                    {col.map((cell) => {
                      if (cell.future) {
                        return (
                          <div
                            key={cell.key}
                            className="size-3 rounded-[3px] border border-dashed border-border/40 bg-transparent"
                          />
                        );
                      }
                      const dateLabel = `${WEEKDAY_SHORT[cell.date.getUTCDay()]}, ${String(cell.date.getUTCDate()).padStart(2, '0')} ${MONTH_SHORT[cell.date.getUTCMonth()]}`;
                      const minLabel =
                        cell.minutes === 0
                          ? 'sem foco registrado'
                          : `${cell.minutes} min de foco`;
                      return (
                        <div
                          key={cell.key}
                          className={cn(
                            'size-3 rounded-[3px] transition-transform duration-100 hover:scale-125 hover:ring-1 hover:ring-emerald-400/60',
                            levelClass(cell.level),
                          )}
                          title={`${dateLabel} • ${minLabel}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legenda */}
            <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
              <span>Menos</span>
              {([0, 1, 2, 3, 4] as const).map((l) => (
                <div key={l} className={cn('size-3 rounded-[3px]', levelClass(l))} />
              ))}
              <span>Mais</span>
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  );
}
