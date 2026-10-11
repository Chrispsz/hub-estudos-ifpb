'use client';

import * as React from 'react';
import { Cpu, ExternalLink, Check, CircleCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudyProgress, PNAAT_DEFAULT_DAYS, type StudyProgress } from '@/lib/study-progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// PNAAT — Programa Nacional de Aprendizado Acelerado em Tecnologia (pesquisa
// 2026: residência IoT/Edge AI; Intensivo Maker bolsa R$1.800/mês, Residência
// em empresas até R$3.600). As trilhas (Python, Eletrônica, Sistemas
// Embarcados) vivem na plataforma FIT — OUTRO site. O papel do hub aqui é um
// só: LEMBRAR de estudar e registrar o dia cumprido. Nada de replicar curso.

const FIT_URL = 'https://fit-tecnologia.org.br/ava/local/customcourses/index.php';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** ISO → chave local yyyy-mm-dd (sem fuso sanfona). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/** Estado do lembrete no momento `now` — puro, testável. */
export function pnaatReminderView(
  state: StudyProgress['pnaatReminder'],
  now: Date,
): { show: boolean; overdue: boolean; daysAgoSinceSession: number | null; dayLabels: string } {
  const days = state.days?.length ? state.days : [...PNAAT_DEFAULT_DAYS];
  const isReminderDay = days.includes(now.getDay());

  const lastKey = state.lastSessionAt ? dayKey(new Date(state.lastSessionAt)) : null;
  const todayKey = dayKey(now);
  const doneToday = lastKey === todayKey;

  let daysAgoSinceSession: number | null = null;
  if (lastKey) {
    const last = new Date(`${lastKey}T00:00:00`);
    const today = new Date(`${todayKey}T00:00:00`);
    daysAgoSinceSession = Math.round((today.getTime() - last.getTime()) / 86_400_000);
  }

  // Regra do compromisso: lembra no dia combinado; se faz ≥7 dias sem sessão,
  // lembra em QUALQUER dia (o prazo da trilha não espera o dia certo).
  const overdue = !doneToday && daysAgoSinceSession !== null && daysAgoSinceSession >= 7;
  const show = !doneToday && (isReminderDay || overdue);

  const sorted = [...days].sort((a, b) => a - b);
  return {
    show,
    overdue,
    daysAgoSinceSession,
    dayLabels: sorted.map((d) => DAY_LABELS[d] ?? '?').join(' · '),
  };
}

export function PnaatReminderCard() {
  const sp = useStudyProgress();
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  const view = React.useMemo(
    () => (now ? pnaatReminderView(sp.progress.pnaatReminder, now) : null),
    [now, sp.progress.pnaatReminder],
  );

  if (!now || !view?.show) return null;

  const sessionsDone = sp.progress.pnaatReminder.lastSessionAt ? 'registrada' : null;

  const markDone = () => {
    sp.markPnaatSession();
    toast.success('PNAAT registrado para hoje 💪', {
      description: 'Próximo lembrete: ' + nextDayLabel(sp.progress.pnaatReminder.days),
      duration: 5000,
    });
  };

  return (
    <Card
      className="rounded-2xl border-violet-500/30 bg-gradient-to-br from-violet-50 to-card p-5 sm:p-6 dark:border-violet-500/20 dark:from-violet-950/25 dark:to-card"
      data-t="pnaat-reminder"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300" aria-hidden>
            <Cpu className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">
              PNAAT — dia de trilha
              {view.overdue && view.daysAgoSinceSession !== null && (
                <span className="ml-2 align-middle text-xs font-medium text-amber-600 dark:text-amber-400">
                  faz {view.daysAgoSinceSession === 1 ? '1 dia' : `${view.daysAgoSinceSession} dias`} sem sessão
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Lembrete de estudo: a trilha <b className="font-medium text-foreground">Fundamentos em IoT &amp; Edge AI</b> roda na
              plataforma FIT — site externo, fora do hub. Toque, estude lá, volte e marque.
              <span className="mt-1 block text-xs">
                Dias combinados: {view.dayLabels} · sessão {sessionsDone === 'registrada' ? 'anterior registrada ✓' : 'ainda sem registro'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <Button
            asChild
            className="h-10 flex-1 bg-violet-600 text-white hover:bg-violet-700 sm:flex-none"
            aria-label="Abrir plataforma FIT do PNAAT (site externo)"
          >
            <a href={FIT_URL} target="_blank" rel="noopener noreferrer">
              Abrir FIT <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
          <Button
            variant="outline"
            className="h-10 flex-1 border-violet-500/40 sm:flex-none"
            onClick={markDone}
            aria-label="Registrar que estudou PNAAT hoje"
          >
            <Check className="size-3.5" aria-hidden /> Estudei hoje
          </Button>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-none text-muted-foreground/70">
        <CircleCheck className={cn('size-3 shrink-0')} aria-hidden />
        Bolsa do programa: Intensivo Maker R$1.800/mês · Residência em empresa até R$3.600 — a trilha é o primeiro passo.
      </p>
    </Card>
  );
}

/** Rótulo do próximo dia de lembrete (para o toast pós-marcação). */
function nextDayLabel(days: number[]): string {
  const ds = days.length ? [...days].sort((a, b) => a - b) : [...PNAAT_DEFAULT_DAYS];
  const today = new Date().getDay();
  const next = ds.find((d) => d > today) ?? ds[0];
  const delta = (next - today + 7) % 7 || 7;
  return delta === 1 ? 'amanhã' : `em ${delta} dias (${DAY_LABELS[next]})`;
}
