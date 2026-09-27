'use client';

// Histórico de simulados — evolução das notas ao longo do semestre.
// Alimentado pelo Simulado Pro (cada tentativa finalizada grava um SimuladoRun).
// Tentativas são ANALISÁVEIS pela IA: chip por corrida (debriefing) e botão
// de evolução (série completa) — o histórico deixa de ser um gráfico morto.

import * as React from 'react';
import { motion } from 'framer-motion';
import { Award, Dumbbell, History, Minus, Play, Sparkles, Target, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useStudyProgress, type SimuladoRun } from '@/lib/study-progress';
import { normalizeMode } from '@/lib/simulado-resume';
import { buildRunDebriefQuestion, buildTrendQuestion, computeTopicTrends } from '@/lib/simulado-debrief';
import { openSimulado, openTutor } from '@/lib/hub-events';
import { MATH_EXAM, MATH_META } from '@/lib/math-exam-prep';

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

/** Cor sólida da barra por faixa de pct — mesma régua da tela de resultado. */
function trendBarTone(pct: number): string {
  if (pct >= 60) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

/** Acento lateral das tentativas — mesma régua dos badges (pctTone). */
function accentTone(pct: number): string {
  if (pct >= 80) return 'border-l-emerald-500';
  if (pct >= 60) return 'border-l-teal-500';
  if (pct >= 40) return 'border-l-amber-500';
  return 'border-l-rose-500';
}

/** O tópico pertence ao escopo REAL da Av1 (onde a meta de aprovação se aplica)? */
function isAv1Topic(disciplineCode: string, topic: string): boolean {
  return (
    disciplineCode === MATH_EXAM.disciplineCode &&
    (MATH_EXAM.topicosEscopo as readonly string[]).includes(topic)
  );
}

/** Disciplina "dono" da tentativa: a mais atingida pelos erros, senão o filtro usado. */
function runDisciplineCode(r: SimuladoRun): string | undefined {
  if (r.questions && r.questions.length > 0) {
    const byDisc = new Map<string, number>();
    for (const q of r.questions) {
      if (q.status === 'solved' || !q.disciplineCode) continue;
      byDisc.set(q.disciplineCode, (byDisc.get(q.disciplineCode) ?? 0) + 1);
    }
    const worst = [...byDisc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (worst) return worst;
  }
  return r.filters?.discipline;
}

/**
 * Rótulo de MODO da tentativa no histórico — só os EXCEPCIONAIS ganham badge:
 * prova é o default e fica sem rótulo (a ausência É o padrão, a linha respira);
 * treino (rose) e treino de tópico (sky) usam o MESMO código de cores do
 * diálogo (rodada 73) — a cor continua sendo o rótulo, em toda superfície.
 */
function runModeBadge(r: SimuladoRun) {
  const mode = normalizeMode(r.mode);
  if (mode === 'prova') return null;
  return mode === 'treino' ? (
    <Badge
      variant="outline"
      title="Treino do Caderno de Erros — repetição dos erros, não conta como simulado da prova"
      className="gap-0.5 border-rose-300/60 bg-rose-500/[0.07] px-1.5 text-[10px] font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400"
    >
      <Dumbbell className="size-2.5" aria-hidden /> Treino
    </Badge>
  ) : (
    <Badge
      variant="outline"
      title="Treino curto de um único tópico (replay) — não conta como simulado da prova"
      className="gap-0.5 border-sky-300/60 bg-sky-500/[0.07] px-1.5 text-[10px] font-semibold text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-400"
    >
      <Target className="size-2.5" aria-hidden /> Treino de tópico
    </Badge>
  );
}

// Estado vazio estável (mesma referência) — evita re-render do memo quando não há runs.
const NO_RUNS: SimuladoRun[] = [];

// Mapa local de nomes curtos (mantido autossuficiente, sem importar course-data aqui).
const DISC_SHORT: Record<string, string> = {
  'TEC.1687': 'Algoritmos',
  'TEC.1632': 'Ling. Marcação',
  'TEC.1984': 'Matemática',
  '53647': 'Fundamentos',
  'TEC.0953': 'RHT',
  'ING.001': 'Inglês',
  'PORT.001': 'Português',
};

function getDiscShort(code: string): string {
  return DISC_SHORT[code] ?? code;
}

/** Barra de distribuição da tentativa: emerald=consegui, rose=não consegui, muted=pulada. */
function DistributionBar({ r, className }: { r: SimuladoRun; className?: string }) {
  if (r.total === 0) return null;
  const seg = (n: number) => `${(n / r.total) * 100}%`;
  return (
    <span
      className={cn('flex h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted', className)}
      title={`${r.solved} consegui · ${r.missed} não consegui · ${r.skipped} puladas`}
      aria-hidden
    >
      <span className="h-full bg-emerald-500/80" style={{ width: seg(r.solved) }} />
      <span className="h-full bg-rose-500/80" style={{ width: seg(r.missed) }} />
      <span className="h-full bg-muted-foreground/30" style={{ width: seg(r.skipped) }} />
    </span>
  );
}

export function SimuladoHistory() {
  const sp = useStudyProgress();
  const runs = sp.progress.simuladoRuns ?? NO_RUNS;

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
  const bestChartPct = React.useMemo(
    () => (chartRuns.length > 0 ? Math.max(...chartRuns.map(runPct)) : 0),
    [chartRuns],
  );

  /** Tendência por tópico entre tentativas (só runs com detalhes por questão). */
  const topicTrends = React.useMemo(() => computeTopicTrends(runs), [runs]);
  const visibleTrends = topicTrends.slice(0, 6);

  /** Disciplina de contexto para a análise de evolução: a mais recorrente nas tentativas. */
  const trendDiscipline = React.useMemo(() => {
    const byDisc = new Map<string, number>();
    for (const r of runs) {
      const code = runDisciplineCode(r);
      if (!code) continue;
      byDisc.set(code, (byDisc.get(code) ?? 0) + 1);
    }
    return [...byDisc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [runs]);

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
          <div className="flex flex-wrap items-center gap-1.5">
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
        <div className="mt-4 flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-center">
          <History className="size-5 text-muted-foreground/50" aria-hidden />
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Nenhum simulado ainda. Rode o <strong className="text-emerald-500">Simulado Pro</strong> na aba
            Praticar — cada tentativa aparece aqui para acompanhar sua evolução. 🎯
          </p>
          <Button
            size="sm"
            onClick={() => openSimulado({ preset: 'math_exam' })}
            className="h-8 gap-1.5 bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700"
          >
            <Target className="size-3.5" /> Rodar Simulado da Av1 (escopo real)
          </Button>
        </div>
      ) : (
        <>
          {/* Mini gráfico de evolução (últimas 8 tentativas) — com a linha da meta */}
          <div className="mt-4 flex items-end justify-start gap-2 sm:justify-between" aria-hidden>
            {chartRuns.map((r, i) => {
              const pct = runPct(r);
              const isBest = pct === bestChartPct && bestChartPct > 0;
              return (
                <div
                  key={r.id}
                  title={`${fmtDate(r.date)} — ${pct}% (${r.solved}/${r.total}) · ${fmtDur(r.durationSec)}`}
                  className="flex max-w-[56px] flex-1 flex-col items-center gap-1 transition-transform hover:scale-[1.06]"
                >
                  {isBest ? (
                    <Trophy
                      className="size-3 text-amber-500"
                      aria-label={`Melhor tentativa: ${pct}%`}
                    />
                  ) : (
                    <span className="inline-block size-3" aria-hidden />
                  )}
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{pct}%</span>
                  <div
                    className={cn(
                      'relative flex h-16 w-full items-end overflow-hidden rounded-md bg-muted/50',
                      isBest && 'ring-1 ring-amber-500/50 ring-offset-1 ring-offset-background',
                    )}
                  >
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
                    {/* Linha da meta de aprovação — segmento em cada coluna, ao nível de 70% */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-amber-500/50"
                      style={{ bottom: `${MATH_META}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground/70">{fmtDate(r.date)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[9px] text-muted-foreground/70">
            <span aria-hidden className="inline-block w-5 border-t border-dashed border-amber-500/60" />
            meta de aprovação ({MATH_META}%)
          </p>

          {/* Tendência POR TÓPICO — quem sobe, quem desce entre tentativas (pior atual primeiro) */}
          {visibleTrends.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-muted/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <TrendingUp className="size-3.5 text-emerald-500" /> Tendência por tópico
                </p>
                {topicTrends[0].last < 60 && (
                  <Badge className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                    <Target className="mr-1 size-2.5" /> foco: {topicTrends[0].topic}
                  </Badge>
                )}
              </div>
              <div className="mt-2.5 space-y-2.5">
                {visibleTrends.map((t, i) => (
                  <div
                    key={`${t.disciplineCode}:${t.topic}`}
                    className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/60">
                          {getDiscShort(t.disciplineCode)}
                        </span>
                        <span className="min-w-0 truncate text-[11px] font-medium">{t.topic}</span>
                      </div>
                      {/* Micro-série: uma barrinha por tentativa em que o tópico apareceu.
                          Tópicos do escopo da Av1 ganham a linha da meta (≥ 70) —
                          o olho vê na hora quem está abaixo dela. */}
                      <div
                        className={cn(
                          'mt-1 flex h-7 items-end gap-[3px]',
                          isAv1Topic(t.disciplineCode, t.topic) && 'relative pr-6',
                        )}
                        aria-hidden
                      >
                        {t.series.map((p, j) => (
                          <motion.span
                            key={j}
                            title={`${fmtDate(p.date)} — ${p.pct}%`}
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(10, Math.round(p.pct * 0.28))}px` }}
                            transition={{ duration: 0.4, delay: 0.15 + i * 0.06 + j * 0.05, ease: 'easeOut' }}
                            className={cn(
                              'w-1.5 rounded-sm opacity-80 transition-opacity group-hover:opacity-100',
                              trendBarTone(p.pct),
                            )}
                          />
                        ))}
                        {isAv1Topic(t.disciplineCode, t.topic) && (
                          <span
                            className="pointer-events-none absolute inset-y-0 left-0 right-0 border-b border-dashed border-amber-500/50"
                            style={{ bottom: `${Math.max(10, Math.round(MATH_META * 0.28))}px` }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs font-bold tabular-nums">{t.last}%</span>
                      {/* Gap até a meta de aprovação da Av1 — só nos tópicos do escopo */}
                      {isAv1Topic(t.disciplineCode, t.topic) &&
                        (t.last >= MATH_META ? (
                          <span
                            title={`Meta de aprovação da Av1 (${MATH_META}%) batida — folga de ${t.last - MATH_META}pp`}
                            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px text-[9px] font-semibold text-emerald-600 dark:text-emerald-400"
                          >
                            meta ✓
                          </span>
                        ) : (
                          <span
                            title={`Faltam ${MATH_META - t.last}pp para a meta de aprovação da Av1 (${MATH_META}%)`}
                            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[9px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                          >
                            −{MATH_META - t.last} p/ meta
                          </span>
                        ))}
                      {t.series.length >= 2 ? (
                        t.delta > 0 ? (
                          <Badge
                            variant="outline"
                            title={`Subiu ${t.delta} ponto(s) percentual(is) da 1ª para a última tentativa`}
                            className="gap-0.5 border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400"
                          >
                            <TrendingUp className="size-2.5" /> +{t.delta}pp
                          </Badge>
                        ) : t.delta < 0 ? (
                          <Badge
                            variant="outline"
                            title={`Caiu ${Math.abs(t.delta)} ponto(s) percentual(is) da 1ª para a última tentativa`}
                            className="gap-0.5 border-rose-500/40 bg-rose-500/10 px-1.5 text-[10px] text-rose-600 dark:text-rose-400"
                          >
                            <TrendingDown className="size-2.5" /> {t.delta}pp
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            title="Mesma nota na 1ª e na última tentativa"
                            className="gap-0.5 border-border px-1.5 text-[10px] text-muted-foreground"
                          >
                            <Minus className="size-2.5" /> estável
                          </Badge>
                        )
                      ) : (
                        <Badge
                          variant="outline"
                          title="Este tópico apareceu em uma só tentativa com detalhes"
                          className="border-border px-1.5 text-[10px] text-muted-foreground"
                        >
                          1ª tentativa
                        </Badge>
                      )}
                      {/* Replay do tópico: prova curta com SÓ este tópico no sorteio.
                          Revela no hover e por teclado (padrão das micro-ações). */}
                      <button
                        type="button"
                        onClick={() =>
                          openSimulado({ disciplineCode: t.disciplineCode, topicScope: t.topic })
                        }
                        title={`Treinar só ${t.topic} no Simulado Pro (prova curta de 5 questões)`}
                        aria-label={`Treinar só ${t.topic} no Simulado Pro`}
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-700 opacity-0 transition-opacity hover:border-teal-300 hover:bg-teal-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 group-focus-within:opacity-100 group-hover:opacity-100 dark:border-teal-800/70 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900/50"
                      >
                        <Play className="size-3" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {topicTrends.length > visibleTrends.length && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  + {topicTrends.length - visibleTrends.length} outro(s) tópico(s) nas tentativas
                </p>
              )}
              <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                <Sparkles className="size-2.5 shrink-0" />
                Barras = aproveitamento em cada tentativa (antiga → recente); linha tracejada = meta de aprovação da Av1 (≥ {MATH_META}). A IA recebe esta série no botão abaixo.
              </p>
            </div>
          )}

          {/* Análise de EVOLUÇÃO — a série inteira (agora COM tópicos) para o tutor ler a tendência */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openTutor({
                disciplineCode: trendDiscipline,
                question: buildTrendQuestion(runs),
              })
            }
            aria-label="Enviar minha evolução de simulados para a IA analisar a tendência"
            className="mt-4 w-full border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
          >
            <Sparkles className="size-3.5" /> Analisar evolução com IA
          </Button>

          {/* Últimas tentativas */}
          <div className="mt-4 space-y-1.5">
            {runs.slice(0, 5).map((r) => {
              const pct = runPct(r);
              return (
                <div
                  key={r.id}
                  className={cn(
                    'group flex flex-wrap items-center gap-2 rounded-lg border border-border border-l-2 bg-muted/20 px-3 py-2 text-xs transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/[0.03]',
                    accentTone(pct),
                  )}
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
                  <span className="font-medium tabular-nums">
                    {r.solved}/{r.total} resolvidas
                  </span>
                  <DistributionBar r={r} />
                  <Badge variant="outline" className={cn('border text-[10px]', pctTone(pct))}>
                    {pct}%
                  </Badge>
                  {runModeBadge(r)}
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
                  <button
                    type="button"
                    onClick={() =>
                      openTutor({
                        disciplineCode: runDisciplineCode(r),
                        question: buildRunDebriefQuestion(r),
                      })
                    }
                    title={
                      r.questions && r.questions.length > 0
                        ? 'Perguntar à IA para analisar esta tentativa (debriefing completo, questão a questão)'
                        : 'Perguntar à IA para analisar esta tentativa (só totais — corrida antiga)'
                    }
                    aria-label={`Perguntar à IA para analisar a tentativa de ${fmtDate(r.date)}`}
                    className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-200"
                  >
                    <Sparkles className="size-3" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Target className="size-3 shrink-0 text-emerald-500" />
              {(() => {
                // Contagem HONESTA: treinos não viram "simulados" na fala —
                // a régua da meta se aplica às provas; treinos são repetição.
                const provas = runs.filter((r) => normalizeMode(r.mode) === 'prova').length;
                const treinos = runs.length - provas;
                return (
                  <>
                    {stats.count} tentativa(s): {provas} simulado(s)
                    {treinos > 0 ? ` · ${treinos} treino(s)` : ''} · cada tentativa do Simulado Pro grava automaticamente aqui.
                  </>
                );
              })()}
            </p>
            <p className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500/80" aria-hidden /> consegui
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-rose-500/80" aria-hidden /> não consegui
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-muted-foreground/30" aria-hidden /> puladas
              </span>
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
