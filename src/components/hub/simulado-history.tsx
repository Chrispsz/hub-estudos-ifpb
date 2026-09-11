'use client';

// Histórico de simulados — evolução das notas ao longo do semestre.
// Alimentado pelo Simulado Pro (cada tentativa finalizada grava um SimuladoRun).

import * as React from 'react';
import { motion } from 'framer-motion';
import { Award, History, Target, TrendingUp, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useStudyProgress, type SimuladoRun } from '@/lib/study-progress';

function runPct(r: SimuladoRun): number {
  return r.total > 0 ? Math.round((r.solved / r.total) * 100) : 0;
}

function pctTone(pct: number): string {
  if (pct >= 80) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (pct >= 60) return 'border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400';
  if (pct >= 40) return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400';
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}min`;
}

export function SimuladoHistory() {
  const sp = useStudyProgress();
  const runs = sp.progress.simuladoRuns ?? [];

  const stats = React.useMemo(() => {
    if (runs.length === 0) return null;
    const pcts = runs.map(runPct);
    return {
      best: Math.max(...pcts),
      avg: Math.round(pcts.reduce((a, b) => a + b, 0) / runs.length),
      count: runs.length,
    };
  }, [runs]);

  const chartRuns = runs.slice(0, 8).reverse(); // mais antigo → mais novo

  return (
    <Card className="rounded-xl bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500">
            <History className="size-4" />
          </span>
          Histórico de simulados
        </h3>
        {stats && (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Trophy className="size-2.5" /> melhor {stats.best}%
            </Badge>
            <Badge variant="outline" className="border-teal-500/40 bg-teal-500/10 text-[10px] text-teal-600 dark:text-teal-400">
              <TrendingUp className="size-2.5" /> média {stats.avg}%
            </Badge>
          </div>
        )}
      </div>

      {!stats ? (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          Nenhum simulado ainda. Rode o <strong className="text-emerald-500">Simulado Pro</strong> na aba
          Praticar — cada tentativa aparece aqui para acompanhar sua evolução. 🎯
        </p>
      ) : (
        <>
          {/* Mini gráfico de evolução (últimas 8 tentativas) */}
          <div className="mt-4 flex items-end justify-start gap-2 sm:justify-between" aria-hidden>
            {chartRuns.map((r, i) => {
              const pct = runPct(r);
              return (
                <div key={r.id} className="flex max-w-[56px] flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{pct}%</span>
                  <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-muted/50">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(6, pct)}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                      className={cn(
                        'w-full rounded-md',
                        pct >= 80
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                          : pct >= 60
                            ? 'bg-gradient-to-t from-teal-600 to-teal-400'
                            : pct >= 40
                              ? 'bg-gradient-to-t from-amber-600 to-amber-400'
                              : 'bg-gradient-to-t from-rose-600 to-rose-400',
                      )}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground/70">{fmtDate(r.date)}</span>
                </div>
              );
            })}
          </div>

          {/* Últimas tentativas */}
          <div className="mt-4 space-y-1.5">
            {runs.slice(0, 5).map((r) => {
              const pct = runPct(r);
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs transition-colors hover:border-emerald-500/30"
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-md font-bold text-[10px]',
                      pct >= 80
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : pct >= 60
                          ? 'bg-teal-500/15 text-teal-500'
                          : pct >= 40
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-rose-500/15 text-rose-500',
                    )}
                  >
                    {pct >= 80 ? <Award className="size-3" /> : `${pct}`}
                  </span>
                  <span className="font-medium">
                    {r.solved}/{r.total} resolvidas
                  </span>
                  <Badge variant="outline" className={cn('border text-[10px]', pctTone(pct))}>
                    {pct}%
                  </Badge>
                  <span className="text-muted-foreground">
                    {fmtDate(r.date)} · {fmtDur(r.durationSec)}
                  </span>
                  {r.filters?.difficulty && (
                    <Badge variant="outline" className="border-border text-[10px] capitalize text-muted-foreground">
                      {r.filters.difficulty}
                    </Badge>
                  )}
                  {r.filters?.discipline && (
                    <span className="text-[10px] text-muted-foreground/70">
                      {getDiscShort(r.filters.discipline)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Target className="size-3 shrink-0 text-emerald-500" />
            {stats.count} simulado(s) registrado(s) · cada tentativa do Simulado Pro grava automaticamente aqui.
          </p>
        </>
      )}
    </Card>
  );
}

function getDiscShort(code: string): string {
  // import direto geraria ciclo desnecessário aqui — usa o map simples do course-data via import normal
  // (mantido local para o card ficar autossuficiente)
  const map: Record<string, string> = {
    'TEC.1687': 'Algoritmos',
    'TEC.1632': 'Ling. Marcação',
    'TEC.1984': 'Matemática',
    '53647': 'Fundamentos',
    'TEC.0953': 'RHT',
    'ING.001': 'Inglês',
    'PORT.001': 'Português',
  };
  return map[code] ?? code;
}
