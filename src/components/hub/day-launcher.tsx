'use client';

// day-launcher.tsx — O GESTO DE ABRIR O DIA (Mensagem 8 do dono: "eu clico
// para iniciar e ele inicia no cronograma conforme configurei e o algoritmo
// definiu com tudo organizado e pronto da forma mais inteligente possível").
//
// Três tempos, um clique:
//   PRONTO  — a fila de hoje já montada (cronograma inteligente OU sessão
//             sintonizada), cada bloco com hora, método e material; o
//             Pomodoro mostra o tamanho que vai nascer.
//   PILOTO  — o bloco atual com o timer vivo (o mesmo motor da casa), os
//             gestos do método e a fila; concluir aqui É concluir no
//             cronograma (mesmo estado, zero contabilidade duplicada).
//   FIM     — o dia cumprido, com o fecho apontado.
//
// O foco é o motor global (pomodoro-engine): sobrevive a troca de aba, faz
// tick por relógio de parede e registra a sessão sozinho. O lançador nunca
// duplica isso — só amarra e aponta.

import * as React from 'react';
import {
  ArrowRight,
  Check,
  CircleCheck,
  ListTodo,
  Pause,
  Play,
  Rocket,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  buildDayLaunchPlan,
  type DayLaunchPlan,
  type LaunchStep,
} from '@/lib/day-launch';
import {
  PHASE_META,
  fmtSeconds,
  useStudyFocus,
} from '@/lib/pomodoro-engine';
import { useLocalStorage } from '@/lib/use-local-storage';

interface DayLauncherProps {
  plan: DayLaunchPlan | null;
  /** Sessão sintonizada (check-in de horas) — muda a fonte da fila e o fecho. */
  sessionActive: boolean;
  /** Foco real registrado hoje (minutos) — a barra do piloto vive disso. */
  minutesToday: number;
  onStartStep: (step: LaunchStep) => void;
  onCompleteStep: (step: LaunchStep) => void;
}

/** O estado vivo do lançamento (persistido — fechar a aba não perde o piloto). */
interface LaunchActive {
  dayKey: string;
}

export function DayLauncherCard({
  plan,
  sessionActive,
  minutesToday,
  onStartStep,
  onCompleteStep,
}: DayLauncherProps) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = useLocalStorage<LaunchActive | null>('day-launch-v1', null);
  const focusApi = useStudyFocus();

  // dayKey local — o piloto morre à meia-noite (o dia novo monta de novo).
  const dayKey = React.useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }, []);
  const isActive = !!active && active.dayKey === dayKey;

  // O passo em pilotagem: o marcado que segue pendente, senão o 1º pendente.
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const current: LaunchStep | null = React.useMemo(() => {
    if (!plan) return null;
    const byId = currentId ? plan.steps.find((s) => s.id === currentId) : undefined;
    if (byId && !byId.done) return byId;
    return plan.steps[plan.firstPendingIndex] ?? null;
  }, [plan, currentId]);

  const allDone = !!plan && plan.steps.length > 0 && plan.pendingCount === 0;
  if (!plan || plan.steps.length === 0) return null;

  const start = (step: LaunchStep) => {
    setCurrentId(step.id);
    setActive({ dayKey });
    onStartStep(step);
  };

  const complete = (step: LaunchStep) => {
    onCompleteStep(step);
    if (step.completable) {
      toast(`Bloco concluído: ${step.short}`, {
        description: plan.pendingCount > 1 ? 'A fila do dia já mostra o próximo.' : 'Era o último do dia.',
      });
    }
    setCurrentId(null); // recai no 1º pendente restante
  };

  const fit = plan.fit;

  return (
    <>
      <div
        className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 sm:p-5"
        data-t="day-launch-card"
      >
        {allDone ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
              <CircleCheck className="size-5" aria-hidden />
              Dia cumprido — {plan.doneCount} {plan.doneCount === 1 ? 'bloco concluído' : 'blocos concluídos'}
              {minutesToday > 0 ? ` · ${minutesToday}min de foco` : ''}.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(true)}
              className="h-11 shrink-0 sm:h-9"
              aria-label="Ver o resumo do dia cumprido"
              data-t="day-launch-open"
            >
              Ver o dia
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] font-medium leading-snug">
                <Rocket className="mr-1.5 inline size-4.5 text-primary" aria-hidden />
                {isActive ? 'Seu dia está em andamento.' : 'Seu dia está pronto.'}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {plan.readiness}
                {current ? ` — começa por ${current.short}` : ''}
                {current?.method ? ` · ${current.method.name.toLowerCase()}` : ''}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setOpen(true)}
              className="h-11 shrink-0 gap-1.5 sm:h-10"
              aria-label={isActive ? 'Voltar ao piloto do dia' : 'Iniciar meu dia — abrir a fila pronta'}
              data-t="day-launch-open"
            >
              <Play className="size-4" aria-hidden />
              {isActive ? 'Continuar meu dia' : 'Iniciar meu dia'}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          {allDone ? (
            // ----- FIM: o dia cumprido, com o fecho apontado -----
            <div className="py-2 text-center sm:py-4">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CircleCheck className="size-6" aria-hidden />
              </div>
              <DialogHeader className="items-center space-y-1.5 sm:text-center">
                <DialogTitle className="text-lg">Dia cumprido.</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  {plan.doneCount} {plan.doneCount === 1 ? 'bloco concluído' : 'blocos concluídos'}
                  {minutesToday > 0 ? ` · ${minutesToday}min de foco registrados` : ''}.{' '}
                  {sessionActive
                    ? 'Registre o fecho no card da sessão: os erros do dia viram cartões e o 1º passo de amanhã fica gravado.'
                    : 'O foco de hoje já está no seu acompanhamento — o cronograma de amanhã se ajusta sozinho ao que você fez agora.'}
                </DialogDescription>
              </DialogHeader>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 h-11 w-full sm:h-10"
                data-t="day-launch-close-fim"
              >
                Fechar
              </Button>
            </div>
          ) : current ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Rocket className="size-5 text-primary" aria-hidden />
                  {plan.doneCount > 0 ? 'Próximo bloco pronto' : 'Seu dia está pronto.'}
                </DialogTitle>
                <DialogDescription>
                  {plan.readiness} — do cronograma inteligente, com o método de cada bloco.
                  {fit && !fit.single
                    ? ` Encaixe de hoje: pausas ~${Math.max(0, Math.round(fit.breakTotal / Math.max(1, fit.cycles)))}min · fecho ${fit.wrapMin}min — o Pomodoro se ajusta ao 1º bloco (o de sempre volta no Restaurar).`
                    : fit?.single
                      ? ' Foco único — o Pomodoro nasce do tamanho do bloco.'
                      : ''}
                </DialogDescription>
              </DialogHeader>

              {/* ----- O BLOCO ATUAL ----- */}
              <div
                className="rounded-xl border border-primary/25 bg-primary/[0.05] p-4"
                data-t="day-launch-current"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {current.time && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {current.time}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {current.short}
                  </span>
                  {current.intensive && (
                    <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 px-1.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                      prioridade hoje
                    </Badge>
                  )}
                  {current.stale && (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      retomada
                    </Badge>
                  )}
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {current.minutes}min
                  </span>
                </div>
                <p className="mt-1.5 text-[15px] font-medium leading-snug">{current.title}</p>
                {current.why && (
                  <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{current.why}</p>
                )}
                <p className="mt-2 text-[13px] font-semibold text-primary">{current.method.name}</p>
                <ol className="mt-1 space-y-1">
                  {current.method.steps.map((s, i) => (
                    <li key={s} className="flex gap-1.5 text-[13px] leading-snug text-muted-foreground">
                      <span className="font-semibold text-primary/70">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>

                {/* Timer vivo — o MESMO motor da casa (chip do header, agora aqui) */}
                {focusApi && <PilotTimer />}

                <div className="mt-3">
                  <Button
                    type="button"
                    onClick={() => start(current)}
                    className="h-11 w-full gap-1.5"
                    aria-label={`Iniciar bloco: ${current.title} — abre o material, o tutor e o foco`}
                    data-t="day-launch-start"
                  >
                    <Play className="size-4" aria-hidden />
                    {plan.steps[plan.firstPendingIndex]?.id === current.id
                      ? 'Começar o dia'
                      : `Iniciar este bloco`}
                  </Button>
                </div>
                {current.completable && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => complete(current)}
                    className="mt-2 h-11 w-full gap-1.5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 sm:h-9"
                    aria-label={`Concluir bloco: ${current.title}`}
                    data-t="day-launch-complete"
                  >
                    <Check className="size-4" aria-hidden />
                    Concluir bloco
                  </Button>
                )}
              </div>

              {/* ----- A FILA DO DIA ----- */}
              <div>
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                  <ListTodo className="size-4" aria-hidden />
                  Fila do dia ({plan.doneCount}/{plan.steps.length} concluídos
                  {minutesToday > 0 ? ` · ${minutesToday}min de foco hoje` : ''})
                </p>
                <ul className="mt-1.5 max-h-56 space-y-1 overflow-y-auto pr-1">
                  {plan.steps.map((s) => {
                    const isCurrent = s.id === current.id;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!s.done) setCurrentId(s.id);
                          }}
                          disabled={s.done}
                          aria-current={isCurrent ? 'step' : undefined}
                          aria-label={`${s.done ? 'Concluído' : 'Selecionar'}: ${s.title}`}
                          className={cn(
                            'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            s.done
                              ? 'text-muted-foreground/60'
                              : 'hover:bg-muted/60',
                            isCurrent && 'bg-primary/[0.07] ring-1 ring-primary/30',
                          )}
                        >
                          {s.time && (
                            <span className="shrink-0 font-mono text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                              {s.time}
                            </span>
                          )}
                          <span className={cn('w-0 min-w-0 flex-1 truncate', s.done && 'line-through')}>
                            {s.title}
                          </span>
                          {s.done ? (
                            <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          ) : (
                            <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                              {s.minutes}min
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** O timer vivo do piloto — espelha o chip do header, com controles. */
function PilotTimer() {
  const focusApi = useStudyFocus();
  if (!focusApi) return null;
  const { live } = focusApi;
  const meta = PHASE_META[live.phase];
  const isFocus = live.phase === 'focus';
  const idle = !live.running && live.phase === 'focus' && live.secondsLeft === focusApi.durations.focus;

  return (
    <div
      className={cn(
        'mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2',
        live.running
          ? meta.badge
          : 'border-border bg-background/60 text-muted-foreground',
      )}
      data-t="day-launch-timer"
    >
      <span
        className={cn('size-2 shrink-0 rounded-full', live.running ? meta.dot : 'bg-muted-foreground/40', live.running && 'animate-pulse')}
        aria-hidden
      />
      <span className="font-mono text-lg font-semibold tabular-nums leading-none">
        {fmtSeconds(live.secondsLeft)}
      </span>
      <span className="text-[12px] font-medium">
        {idle ? 'Foco pronto — nasce com o bloco' : meta.label}
      </span>
      <button
        type="button"
        onClick={() => (live.running ? focusApi.pauseTimer() : focusApi.startTimer())}
        className="ml-auto inline-flex size-9 items-center justify-center rounded-lg border border-current/20 transition-colors hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={live.running ? 'Pausar o foco' : 'Retomar o foco'}
        data-t="day-launch-timer-toggle"
      >
        {live.running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

// (o gesto de pular mora na fila clicável do piloto — sem atalho solto)
