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
  ChevronDown,
  CircleAlert,
  Dumbbell,
  History,
  ListChecks,
  PenLine,
  Play,
  Sparkles,
  Timer,
  Undo2,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { materials } from '@/data/course-data';
import { recallPdfPage } from '@/lib/pdf-position';
import { useStudyProgress } from '@/lib/study-progress';
import {
  buildSessionHarmony,
  restorePomodoroConfig,
  syncPomodoroToBudget,
  type FechoList,
  type HarmonyBlock,
  type SessionHarmony,
} from '@/lib/session-harmony';
import type { StudyProgressHook } from '@/lib/study-progress';
import { PLAN_KIND_LABEL, type PlanKind } from '@/lib/study-plan';
import { useErrorReviewTasks } from '@/lib/error-review-feed';
import { Switch } from '@/components/ui/switch';
import { openPractice } from '@/lib/hub-events';
import { todayDateKey } from '@/lib/today-focus';
import { useNow } from './clock-widget';
import { useStudyFocus } from '@/lib/pomodoro-engine';
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
  erro: {
    icon: CircleAlert,
    bg: 'bg-orange-500/10',
    text: 'text-orange-700 dark:text-orange-400',
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
  reforco: {
    // REFORÇO DE BASE (Task 226): dificuldade real medida nas questões —
    // a família do "praticar com intenção" (violeta, como a prática).
    icon: Dumbbell,
    bg: 'bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-400',
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

// ---------- O PAINEL DO FECHO (banco de ideias #6 — Fecho Interativo) ----------
//
// O fim de sessão deixa de ser uma frase e vira três gestos reais, na ordem
// do ritual: (1) erros do dia → cartões em 1 toque; (2) as listas de hoje
// com o que falta; (3) o 1º passo de amanhã gravado de verdade — a home do
// dia seguinte abre nele. Gravar o passo É fechar a sessão.

function FechoPanel({
  harmony,
  dateKey,
  sp,
  onOpenMaterial,
}: {
  harmony: SessionHarmony;
  dateKey: string;
  sp: StudyProgressHook;
  onOpenMaterial: (list: FechoList) => void;
}) {
  const { fecho } = harmony;
  const [draft, setDraft] = React.useState('');

  const recordStep = (text: string, materialId?: string) => {
    const t = text.trim();
    if (!t) return;
    sp.setTomorrowStep({ setOn: dateKey, text: t, materialId });
    setDraft('');
    toast.success('1º passo de amanhã gravado — a home abre nele.', {
      description: t,
    });
  };

  const recorded = sp.progress.tomorrowStep?.setOn === dateKey ? sp.progress.tomorrowStep : null;
  const quiet = fecho.pendingErrors === 0 && fecho.lists.length === 0;

  return (
    <div
      className="mt-1 space-y-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-3"
      data-t="fecho-painel"
    >
      {/* (1) erros → cartões — o semeio da casa, contado ao vivo */}
      {fecho.pendingErrors > 0 && (
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          data-t="fecho-erros"
        >
          <p className="text-sm leading-snug text-muted-foreground">
            <PenLine className="mr-1.5 inline size-3.5 text-rose-600 dark:text-rose-400" aria-hidden />
            <span className="font-medium text-foreground">{fecho.pendingErrors}</span>{' '}
            {fecho.pendingErrors === 1 ? 'erro em aberto' : 'erros em aberto'} — virar cartão é
            fechar a ferida em vez de reler a mágoa.
          </p>
          <button
            type="button"
            onClick={() => openPractice({ mode: 'flashcards' })}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-rose-400"
            aria-label={`Abrir o Praticar para virar ${fecho.pendingErrors} erros em cartões`}
          >
            Virar cartões
          </button>
        </div>
      )}

      {/* (2) as listas de hoje — o que falta, com o leitor a 1 clique */}
      {fecho.lists.length > 0 && (
        <div data-t="fecho-listas">
          <p className="text-sm text-muted-foreground">
            <ListChecks className="mr-1.5 inline size-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
            Listas de hoje com caixinhas em aberto:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {fecho.lists.map((l) => (
              <button
                key={l.materialId}
                type="button"
                onClick={() => onOpenMaterial(l)}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-violet-300"
                aria-label={`Abrir ${l.title} — faltam ${l.remaining} de ${l.total} no checklist`}
              >
                <span className="max-w-56 truncate">{l.title}</span>
                <span className="tabular-nums opacity-80">
                  · faltam {l.remaining}/{l.total}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* (3) o 1º passo de amanhã — gravado de verdade, a home abre nele */}
      {fecho.stepRecorded && recorded ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between" data-t="fecho-passo-gravado">
          <p className="text-sm leading-snug">
            <Check className="mr-1.5 inline size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="font-medium">{recorded.text}</span>{' '}
            <span className="text-muted-foreground">— gravado. A home de amanhã abre nele.</span>
          </p>
          <button
            type="button"
            onClick={() => {
              sp.setTomorrowStep(null);
              toast('Passo limpo — escolha outro ou deixe a fila decidir.');
            }}
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-full px-2 py-1 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Limpar o 1º passo de amanhã gravado"
          >
            <Undo2 className="size-3" aria-hidden /> regravar
          </button>
        </div>
      ) : (
        <div data-t="fecho-passo">
          <p className="text-sm text-muted-foreground">
            <Sparkles className="mr-1.5 inline size-3.5 text-primary" aria-hidden />
            O 1º passo de amanhã — a home abre nele:
          </p>
          <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-center">
            {fecho.suggestion && (
              <button
                type="button"
                onClick={() => recordStep(fecho.suggestion!.text, fecho.suggestion!.materialId)}
                className="inline-flex max-w-full items-center gap-1 self-start rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Gravar como 1º passo de amanhã: ${fecho.suggestion.text}`}
                data-t="fecho-passo-sugestao"
              >
                <span className="max-w-56 truncate">{fecho.suggestion.text}</span>
                <span className="opacity-70">· 1 toque grava</span>
              </button>
            )}
            <div className="flex w-full min-w-0 items-center gap-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') recordStep(draft);
                }}
                placeholder="ou escreva o seu…"
                aria-label="Escrever o 1º passo de amanhã"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                data-t="fecho-passo-input"
              />
              <button
                type="button"
                onClick={() => recordStep(draft)}
                disabled={!draft.trim()}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                aria-label="Gravar o 1º passo de amanhã"
                data-t="fecho-passo-gravar"
              >
                Gravar
              </button>
            </div>
          </div>
        </div>
      )}

      {quiet && fecho.stepRecorded && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" data-t="fecho-completo">
          <Check className="mr-1.5 inline size-4" aria-hidden />
          Sessão fechada por inteiro — nada ficou para trás. Bom descanso.
        </p>
      )}
    </div>
  );
}

export function SessionHarmonyCard({ onOpenBlock }: Props) {
  const sp = useStudyProgress();
  // O AGORA do card — tick de 30s basta (a barra vive do registro, não do segundo).
  const now = useNow(30_000);
  // CICLO DO ERRO (pauta nº 1): a MESMA ponte do plano — os erros do Code
  // Review entram na fila da sessão, o dominado sai sozinho.
  const errorReviews = useErrorReviewTasks();
  // TASK 234 — O FOCO AO VIVO (o mesmo motor global da casa): com o Pomodoro
  // rodando, o botão vira "Voltar ao material" e a dica conta onde o relógio
  // está — o card nunca mente que o foco ainda "vai começar".
  const focusApi = useStudyFocus();
  const focusLive = focusApi?.live ?? null;
  const focusRunning = !!focusLive?.running;

  // A página de retomada REAL (memória do leitor, hub:pdf-pos) — a mesma
  // injeção do dashboard: a lib continua pura, a casa entrega o valor pronto.
  const pageOf = React.useCallback((materialId: string): number | null => {
    const m = materials.find((x) => x.id === materialId);
    return m ? recallPdfPage(materialId, m.pages) : null;
  }, []);

  const harmony = React.useMemo(
    () =>
      now
        ? buildSessionHarmony(sp.progress, now, {
            pageOf,
            errorReviews,
            focusDiscipline: now ? sp.progress.dailyFocusDiscipline?.[todayDateKey(now)] ?? undefined : undefined,
          })
        : null,
    [sp.progress, now, pageOf, errorReviews],
  );

  // O FECHO INTERATIVO: o painel abre por vontade própria (1º clique) — e
  // quando a sessão cumpre com o passo ainda em aberto, a casa abre nele
  // sozinha: o fecho é o que resta do dia. (Estado ANTES do early return —
  // a ordem dos hooks é contrato.)
  const [fechoToggle, setFechoToggle] = React.useState<boolean | null>(null);

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

  // TASK 234 — O GESTO DE COMEÇO: um botão que sabe o próximo bloco, para o
  // dono nunca mais perguntar "como inicio?". O primeiro pendente (fora o
  // fecho) É o agora — abrir aqui dispara o foco (material + tutor + Pomodoro
  // contando) e estudar conclui o bloco sozinho (foco real ≥1min = feito).
  const nextPending = blocks.find((b) => b.kind !== 'fecho' && !b.done) ?? null;
  const pronta = state === 'pronta' || state === 'micro';

  const fechoExpanded = fechoToggle ?? (done && !harmony.fecho.stepRecorded);

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
          <span className="flex shrink-0 items-center gap-3">
            {stateMeta && (
              <Badge
                variant="outline"
                aria-label={`Estado da sessão: ${stateMeta.label}`}
                className={cn('shrink-0', stateMeta.cls, stateMeta.pulse && 'animate-pulse')}
              >
                {stateMeta.label}
              </Badge>
            )}
            {/* REVISÃO SOB COMANDO (Task 27): o mesmo gesto do plano — a fila da
                sessão é a MESMA inteligência, o comando vale nas duas casas. */}
            <label
              htmlFor="toggle-revisao-sessao"
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Switch
                id="toggle-revisao-sessao"
                checked={sp.progress.preferences?.includeReviews !== false}
                onCheckedChange={(v) => sp.updatePreferences({ includeReviews: v })}
                aria-label="Incluir revisão de assuntos antigos na sessão"
                data-t="toggle-revisao"
              />
              revisar antigos
            </label>
          </span>
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

        {/* ----- O GESTO DE COMEÇO (Task 234): UM botão que sabe o próximo —
            e a linha que ensina o relógio: o foco só corre quando o bloco
            abre; estudou, conclui sozinho. Nada para marcar à mão. ----- */}
        {!done && nextPending && (
          <div className="mt-3" data-t="sessao-cta">
            <Button
              type="button"
              onClick={() => onOpenBlock(nextPending)}
              className="h-11 w-full gap-2 sm:h-10"
              aria-label={focusRunning ? `Voltar ao material: ${nextPending.title}` : pronta ? `Começar agora por: ${nextPending.title}` : `Continuar: ${nextPending.title}`}
              data-t="sessao-comecar"
            >
              <Play className="size-4 shrink-0" aria-hidden />
              <span className="shrink-0 font-semibold">{focusRunning ? 'Voltar ao material' : pronta ? 'Começar agora' : 'Continuar'}</span>
              <span className="min-w-0 truncate opacity-90">· {nextPending.title}</span>
            </Button>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground" data-t="sessao-cta-dica">
              {focusRunning
                ? 'O foco já está correndo no chip do topo da página — volte aqui quando quiser, a fila anota tudo e conclui sozinha.'
                : pronta
                  ? 'Um toque abre o material com o tutor e o foco já começa a contar. Estudou? O bloco conclui sozinho — nada para marcar à mão.'
                  : 'O foco corre no chip do topo da página — volte quando quiser, a fila anota tudo.'}
            </p>
          </div>
        )}

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
              const isFecho = b.kind === 'fecho';
              const clickable = !isFecho ? !b.done : true;
              // TASK 234 — A HIERARQUIA QUE FALTAVA: o 1º pendente é "Agora"
              // (com destaque); os demais "Próximo" da fila viram "Na fila" —
              // nunca mais dois "Próximo" disputando o clique.
              const isCurrent = !b.done && b.id === nextPending?.id;
              const kindLabel = isFecho
                ? 'Fecho'
                : isCurrent
                  ? 'Agora'
                  : b.kind === 'proximo'
                    ? 'Na fila'
                    : PLAN_KIND_LABEL[b.kind as PlanKind];
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isFecho) {
                        // O ritual final virou PAINEL: três gestos reais —
                        // erros → cartões, listas de hoje, 1º passo de amanhã.
                        setFechoToggle(!fechoExpanded);
                        return;
                      }
                      if (!b.done) onOpenBlock(b);
                    }}
                    data-t={`sessao-${b.id}`}
                    data-testid={`plano-bloco-${b.kind}`}
                    aria-label={`${kindLabel}: ${b.title} — ${b.done ? (b.doneWhy ?? 'concluído') : b.why} (≈${fmtH(b.minutes)})${!isFecho && !b.done ? (b.kind === 'erro' ? '. Clique para abrir o re-teste da questão no Praticar' : '. Clique para abrir com o tutor ao lado') : isFecho ? '. Clique para abrir o painel do fecho' : ''}`}
                    aria-expanded={isFecho ? fechoExpanded : undefined}
                    className={cn(
                      'group flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      clickable && 'hover:bg-muted/60',
                      b.done && 'opacity-55',
                      isCurrent && 'bg-primary/[0.05] ring-1 ring-primary/20',
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
                            isCurrent ? 'text-primary' : meta.text,
                          )}
                        >
                          {kindLabel}
                        </span>
                        {!isFecho && b.exam && (
                          <span
                            className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                            aria-label={`Prova de ${b.exam.name} em ${b.exam.daysLeft} dias`}
                          >
                            D-{b.exam.daysLeft}
                          </span>
                        )}
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
                    ) : isFecho ? (
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform',
                          fechoExpanded && 'rotate-180',
                        )}
                        aria-hidden
                      />
                    ) : isCurrent ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary" aria-hidden data-t="sessao-agora-play">
                        <Play className="size-3" />
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {b.trimmed ? `~${fmtH(b.minutes)}` : fmtH(b.minutes)}
                      </span>
                    )}
                  </button>
                  {isFecho && fechoExpanded && (
                    <FechoPanel
                      harmony={harmony}
                      dateKey={dateKey}
                      sp={sp}
                      onOpenMaterial={(l) =>
                        onOpenBlock({
                          id: l.materialId,
                          kind: 'continuar',
                          materialId: l.materialId,
                          disciplineCode: l.disciplineCode,
                        })
                      }
                    />
                  )}
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
