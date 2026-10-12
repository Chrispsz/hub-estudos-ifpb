'use client';

// session-harmony-card.tsx — O CARD DA SESSÃO SINTONIZADA (Task 30).
//
// Quando o dono lança as horas do dia (check-in), este card assume a home no
// lugar do "Plano de hoje": a MESMA fila inteligente (study-plan.ts), agora
// casada com o orçamento — blocos que cabem, o último cortado se precisar, o
// FECHO garantido, o pomodoro encaixado (sync de 1 toque com Restaurar) e a
// barra viva enchendo pelo foco REAL do dia. Menos de 20 min? MODO MICRO:
// um bloco único e o streak fica guardado. Tudo re-flui na hora: mudou o
// orçamento (−30/+30/novo check-in), o plano recalcula sozinho (lib pura).
//
// A casa abre cada bloco com o MESMO gesto de 1 clique da frente 9/13
// (onOpenBlock → leitor split + tutor + foco governado); o FECHO abre o
// Praticar (erros → cartões) — o ritual final é conteúdo, não enfeite.

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  AlarmClock,
  BookOpen,
  Check,
  CheckCheck,
  History,
  ListChecks,
  Sparkles,
  Timer,
  Undo2,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { materials } from '@/data/course-data';
import { recallPdfPage } from '@/lib/pdf-position';
import { useStudyProgress } from '@/lib/study-progress';
import {
  buildSessionHarmony,
  restorePomodoroConfig,
  syncPomodoroToBudget,
  type HarmonyBlock,
} from '@/lib/session-harmony';
import { PLAN_KIND_LABEL, type PlanKind } from '@/lib/study-plan';
import { openPractice } from '@/lib/hub-events';
import { todayDateKey } from '@/lib/today-focus';
import { useNow } from './clock-widget';
import { cn } from '@/lib/utils';

/** O clique de um bloco: o dashboard injeta o MESMO gesto do plano (frente 13). */
export interface OpenableBlock {
  id: string;
  kind: string;
  materialId?: string;
  disciplineCode?: string;
}

interface Props {
  onOpenBlock: (b: OpenableBlock) => void;
}

/** A cara de cada tipo de bloco — a gramática de cor do plano + o fecho. */
const KIND_META: Record<PlanKind | 'fecho', { icon: LucideIcon; bg: string; text: string }> = {
  continuar: {
    icon: BookOpen,
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  revisao: {
    icon: History,
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
  },
  pratica: {
    icon: ListChecks,
    bg: 'bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-400',
  },
  atrasado: {
    icon: AlarmClock,
    bg: 'bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-400',
  },
  proximo: {
    icon: Sparkles,
    bg: 'bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-400',
  },
  fecho: {
    icon: CheckCheck,
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-700 dark:text-zinc-300',
  },
};

const STATE_META: Record<
  string,
  { label: string; cls: string; pulse?: boolean }
> = {
  pronta: {
    label: 'pronta para começar',
    cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  micro: {
    label: 'modo micro',
    cls: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  },
  'em-andamento': {
    label: 'em andamento',
    cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    pulse: true,
  },
  cumprida: {
    label: 'cumprida',
    cls: 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
  },
};

/** 90 → "1h30" · 60 → "1h" · 45 → "45min". */
function fmtH(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function SessionHarmonyCard({ onOpenBlock }: Props) {
  const sp = useStudyProgress();
  // O AGORA do card — tick de 30s basta (a barra vive do registro, não do segundo).
  const now = useNow(30_000);

  // A página de retomada REAL (memória do leitor, hub:pdf-pos) — a mesma
  // injeção do dashboard: a lib continua pura, a casa entrega o valor pronto.
  const pageOf = React.useCallback((materialId: string): number | null => {
    const m = materials.find((x) => x.id === materialId);
    return m ? recallPdfPage(materialId, m.pages) : null;
  }, []);

  const harmony = React.useMemo(
    () => (now ? buildSessionHarmony(sp.progress, now, { pageOf }) : null),
    [sp.progress, now, pageOf],
  );

  if (!now || !harmony || harmony.state === 'sem-sessao') return null;

  const { state, plannedMinutes, focusToday, remaining, blocks, doneCount, fit } = harmony;
  const dateKey = todayDateKey(now);
  const overMin = Math.max(0, focusToday - plannedMinutes);
  const pct = plannedMinutes > 0 ? Math.min(100, Math.round((focusToday / plannedMinutes) * 100)) : 0;

  const cfg = sp.progress.preferences.pomodoroConfig;
  const autoFitToday =
    sp.progress.preferences.autoFit?.dateKey === dateKey
      ? sp.progress.preferences.autoFit
      : null;

  // Re-orçar: muda o orçamento e RE-SINCRONIZA o pomodoro na mesma respiração
  // — é o "tudo se adapta" do dono em gesto único.
  const rebudget = (deltaMin: number) => {
    const next = Math.max(30, Math.min(360, plannedMinutes + deltaMin));
    sp.setAvailableHours(dateKey, next / 60);
    const newRemaining = Math.max(0, next - focusToday);
    syncPomodoroToBudget(sp, newRemaining, dateKey);
  };

  const stateMeta = STATE_META[state];
  const isMicro = state === 'micro';
  const done = state === 'cumprida';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card
        className={cn(
          'rounded-2xl p-5 sm:p-6',
          done && 'border-emerald-500/40 bg-emerald-500/[0.04]',
        )}
        data-t="sessao-card"
      >
        {/* ----- cabeçalho: a sessão, o orçamento, o estado ----- */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
              <Timer className="size-4 text-primary" aria-hidden />
              Sessão de hoje
              <span className="tabular-nums text-muted-foreground" aria-hidden>
                · {fmtH(plannedMinutes)}
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {done
                ? 'O foco de hoje cobriu o combinado. Falta só o fecho — e descansar.'
                : isMicro
                  ? 'Pouco tempo, sessão outra: um bloco único que guarda o dia.'
                  : `A fila da casa encaixada em ${fmtH(plannedMinutes)} — some da lista conforme você cumpre.`}
            </p>
          </div>
          {stateMeta && (
            <Badge
              variant="outline"
              aria-label={`Estado da sessão: ${stateMeta.label}`}
              className={cn('shrink-0', stateMeta.cls, stateMeta.pulse && 'animate-pulse')}
            >
              {stateMeta.label}
            </Badge>
          )}
        </div>

        {/* ----- a barra viva: foco REAL vs orçamento ----- */}
        <div className="mt-4">
          <div
            role="progressbar"
            aria-label="Progresso da sessão: minutos de foco registrados contra o combinado"
            aria-valuemin={0}
            aria-valuemax={plannedMinutes}
            aria-valuenow={Math.min(focusToday, plannedMinutes)}
            aria-valuetext={`${fmtH(focusToday)} de ${fmtH(plannedMinutes)} de foco`}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            data-t="sessao-barra"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                done ? 'bg-emerald-500' : 'bg-emerald-500/80',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-muted-foreground" data-t="sessao-conta">
            <span className="font-medium text-foreground">
              {fmtH(focusToday)} de {fmtH(plannedMinutes)} de foco
            </span>
            {done ? (
              overMin > 0 ? (
                <span className="text-amber-700 dark:text-amber-400">+{fmtH(overMin)} além do combinado</span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400">combinado cumprido</span>
              )
            ) : (
              <span>· restam {fmtH(remaining)}</span>
            )}
            {doneCount > 0 && <span>· {doneCount} bloco(s) concluído(s)</span>}
          </p>
        </div>

        {/* ----- MODO MICRO — confessado, sem culpa ----- */}
        {isMicro && (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-sm text-violet-800 dark:text-violet-300"
            data-t="sessao-micro"
          >
            <Zap className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Menos de 20 minutos não viram sessão cortada: viram uma sessão inteira menor.
              Um bloco só, e o streak de hoje fica guardado — melhor 15 min reais do que 2h prometidos.
            </p>
          </div>
        )}

        {/* ----- CUMPRIDA — o espelho do dia + o amanhã ----- */}
        {done && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2.5 text-sm" data-t="sessao-cumprida">
            <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              {focusToday} min de foco hoje
              {doneCount > 0 ? ` · ${doneCount} bloco(s) concluído(s)` : ''} — o que ficou, a fila guarda.
            </p>
            {harmony.nextHint && (
              <p className="mt-1 text-muted-foreground">
                Amanhã, comece por: <span className="font-medium text-foreground">{harmony.nextHint.title}</span>{' '}
                — {harmony.nextHint.why}
              </p>
            )}
          </div>
        )}

        {/* ----- o encaixe do pomodoro — a matemática contada em humano ----- */}
        {fit && !done && (
          <div
            className="mt-3 flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            data-t="sessao-fit"
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Pomodoro:</span> {fit.suggestion}
            </p>
            {autoFitToday ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Check className="size-3.5" aria-hidden />
                  sincronizado ({cfg.focus}min)
                </span>
                <button
                  type="button"
                  onClick={() => restorePomodoroConfig(sp, dateKey)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Restaurar o foco original de ${autoFitToday.saved.focus} minutos`}
                >
                  <Undo2 className="size-3" aria-hidden /> restaurar
                </button>
              </div>
            ) : fit.needsSync ? (
              <button
                type="button"
                onClick={() => syncPomodoroToBudget(sp, remaining, dateKey)}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-t="sessao-sync"
                aria-label={`Sincronizar o pomodoro com a sessão: foco passa de ${cfg.focus} para ${fit.focusMin} minutos`}
              >
                <Timer className="size-3.5" aria-hidden />
                Sincronizar ({cfg.focus} → {fit.focusMin}min)
              </button>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="size-3.5" aria-hidden /> o foco de {cfg.focus}min já encaixa
              </span>
            )}
          </div>
        )}

        {/* ----- os blocos da sessão ----- */}
        {blocks.length > 0 && (
          <ul className="mt-3" data-testid="sessao-blocos">
            {blocks.map((b) => {
              const meta = KIND_META[b.kind];
              const Icon = meta.icon;
              const clickable = b.kind !== 'fecho' ? !b.done : true;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (b.kind === 'fecho') {
                        // O ritual final: erros → cartões (o Praticar abre na fila).
                        openPractice({ mode: 'flashcards' });
                        return;
                      }
                      if (!b.done) onOpenBlock(b);
                    }}
                    data-t={`sessao-${b.id}`}
                    data-testid={`plano-bloco-${b.kind}`}
                    aria-label={`${PLAN_KIND_LABEL[b.kind as PlanKind] ?? 'Fecho'}: ${b.title} — ${b.done ? (b.doneWhy ?? 'concluído') : b.why} (≈${fmtH(b.minutes)})${b.kind !== 'fecho' && !b.done ? '. Clique para abrir com o tutor ao lado' : ''}`}
                    className={cn(
                      'group flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      clickable && 'hover:bg-muted/60',
                      b.done && 'opacity-55',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-xl',
                        meta.bg,
                        meta.text,
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span
                          className={cn(
                            'shrink-0 text-[10.5px] font-semibold uppercase tracking-wide',
                            meta.text,
                          )}
                        >
                          {b.kind === 'fecho' ? 'Fecho' : PLAN_KIND_LABEL[b.kind as PlanKind]}
                        </span>
                        <span
                          className={cn(
                            'truncate text-[14px] font-medium leading-snug',
                            b.done && 'line-through decoration-border',
                          )}
                        >
                          {b.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] leading-snug text-muted-foreground">
                        {b.done ? (b.doneWhy ?? 'concluído') : b.why}
                      </span>
                    </span>
                    {b.done ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" aria-hidden>
                        <Check className="size-3.5" />
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {b.trimmed ? `~${fmtH(b.minutes)}` : fmtH(b.minutes)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* ----- re-fluxo: o orçamento muda, tudo re-encaixa na hora ----- */}
        {!done && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3" data-t="sessao-reflow">
            <span className="text-xs text-muted-foreground">
              O tempo mudou? O plano inteiro re-encaixa na hora.
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => rebudget(-30)}
                disabled={plannedMinutes <= 30}
                className="rounded-full border border-border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors hover:border-foreground/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                aria-label="Reduzir a sessão em 30 minutos"
              >
                −30min
              </button>
              <button
                type="button"
                onClick={() => rebudget(30)}
                disabled={plannedMinutes >= 360}
                className="rounded-full border border-border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors hover:border-foreground/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                aria-label="Estender a sessão em 30 minutos"
              >
                +30min
              </button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
