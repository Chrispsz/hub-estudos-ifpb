'use client';

import * as React from 'react';
import { GraduationCap, Moon, Play, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { PaletteTriggerButton } from './command-palette';
import { CURRENT_PERIOD_LABEL } from '@/lib/curriculum';
import { useStudyFocus, fmtSeconds } from '@/lib/pomodoro-engine';
import { cn } from '@/lib/utils';

/** A cor do chip acompanha a fase do motor (foco verde, pausas quentes). */
const PHASE_CHIP: Record<string, string> = {
  focus: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400',
  shortBreak:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400',
  longBreak:
    'border-teal-500/40 bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 dark:text-teal-400',
};

/** O FOCO É UMA CONDIÇÃO DA CASA (o pedido do dono, 10/10/2026): enquanto o
 *  timer corre — ou espera retomada — o chip vive no header de TODAS as abas.
 *  Um toque pausa/retoma; a fase e o tempo viajam com o estudante, em qualquer
 *  lugar da casa. Fora disso o header fica limpo (nada de cronômetro vazio). */
function FocusChip() {
  const focus = useStudyFocus();
  const live = focus?.live;
  if (!focus || !live) return null;

  const full = focus.durations[live.phase];
  const pausedMid =
    !live.running && live.phase === 'focus' && live.secondsLeft > 0 && live.secondsLeft < full;
  // Pausa concluída mas ainda não iniciada: o ciclo espera o estudante —
  // o chip fica de pé até ele decidir (o foco não desaparece no meio do fluxo).
  const breakWaiting = !live.running && live.phase !== 'focus' && live.secondsLeft > 0;
  if (!live.running && !pausedMid && !breakWaiting) return null;

  const isFocus = live.phase === 'focus';
  const label = isFocus ? 'Foco' : 'Pausa';
  const mmss = fmtSeconds(live.secondsLeft);
  const onClick = () => (live.running ? focus.pauseTimer() : focus.startTimer());
  const aria = live.running
    ? `${label} em curso, ${mmss} restantes — pausar`
    : `${label} em espera, ${mmss} restantes — retomar`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      title={aria}
      data-testid="header-focus-chip"
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        live.running ? PHASE_CHIP[live.phase] : 'border-border bg-muted text-muted-foreground hover:bg-accent',
      )}
    >
      {live.running ? (
        <span
          className={cn('size-1.5 shrink-0 rounded-full', isFocus ? 'animate-pulse bg-emerald-500' : 'bg-current opacity-80')}
          aria-hidden
        />
      ) : (
        <Play className="size-3 shrink-0" aria-hidden />
      )}
      <span className="hidden sm:inline">{label}</span>
      <span>{mmss}</span>
    </button>
  );
}

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-3 px-6 py-2.5 pl-16 lg:pl-6">
        {/* t196 — a marca vive UMA vez: no desktop a sidebar já a mostra
            (mesmo ícone, mesmo nome, mesmo período) — repetir aqui era o tipo
            de sujeira que o dono aponta. No mobile a sidebar é um sheet, então
            o header continua carregando a identidade. */}
        <div className="flex min-w-0 items-center gap-3 lg:hidden">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shrink-0">
            <GraduationCap className="size-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-semibold leading-tight tracking-tight truncate">
              Hub de Estudos IFPB
            </h1>
            <span className="text-[11px] text-muted-foreground truncate">
              {CURRENT_PERIOD_LABEL}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:gap-3 shrink-0">
          <FocusChip />
          <PaletteTriggerButton />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Alternar tema"
            title="Alternar tema"
            className="size-11 shrink-0 rounded-full sm:size-9"
            onClick={toggleTheme}
          >
            {mounted && theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
