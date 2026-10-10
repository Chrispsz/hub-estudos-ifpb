'use client';

// focus-duration-menu.tsx — A DURAÇÃO DO FOCO GOVERNÁVEL NO FLUXO (frente 10).
//
// O gap desta ronda: a ÚNICA UI de pomodoroConfig morava no SettingsView
// órfão (sem caminho nenhum na casa viva) — o motor honrava a configuração,
// mas ninguém podia mudá-la. O estudante que quer 50min de bloco profundo
// não tinha gesto.
//
// Onde mora: na linha de botões do companheiro (aba Tutor IA, card Sessão de
// estudo) — o mesmo lugar onde o foco vive. O trigger confessa o estado
// atual ("25 min"), o popover dá o caminho rápido (presets de foco) e o fino
// (pausas e ciclos), com a fronteira confessada: a fase em curso termina
// como está; as próximas seguem a nova duração (o motor alinha sozinho o
// ocioso sentado no cheio — pomodoro-engine, frente 10).
//
// Doutrina da casa: escreve pelo contrato único (sp.updatePreferences — a
// MESMA forma do SettingsView antigo, zero migração); a instância de sp é a
// do page.tsx (passada como prop — uma instância só no fluxo).

import * as React from 'react';
import { Timer } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { StudyProgressHook } from '@/lib/study-progress';

/** Presets de bloco de foco — os gestos de 1 toque (o fino fica embaixo). */
const FOCUS_PRESETS = [15, 25, 30, 45, 50, 60];

/** Um número do config: commit instantâneo com clamp (o padrão da casa). */
function DurationField({
  label,
  ariaLabel,
  value,
  min,
  max,
  step,
  fallback,
  onCommit,
}: {
  label: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  fallback: number;
  onCommit: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onCommit(Math.max(min, Math.min(max, Number(e.target.value) || fallback)))}
        className="h-8 w-16 text-center text-sm"
        aria-label={ariaLabel}
      />
    </label>
  );
}

export function FocusDurationMenu({ sp }: { sp: StudyProgressHook }) {
  const cfg = sp.progress.preferences.pomodoroConfig;
  const [open, setOpen] = React.useState(false);

  const setCfg = React.useCallback(
    (patch: Partial<typeof cfg>) => {
      sp.updatePreferences({ pomodoroConfig: { ...cfg, ...patch } });
    },
    [sp, cfg],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="tabular-nums"
          aria-label={`Ajustar a duração do foco e das pausas — foco atual de ${cfg.focus} minutos`}
          title="A duração do foco e das pausas"
        >
          <Timer className="size-4 opacity-80" aria-hidden />
          {cfg.focus} min
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3" data-testid="focus-duration-menu">
        <div>
          <p className="text-sm font-medium leading-tight">Duração do foco</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Toque num preset ou ajuste o fino. A fase em curso termina como está — as próximas
            seguem a nova duração.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets de minutos de foco">
          {FOCUS_PRESETS.map((m) => {
            const active = cfg.focus === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setCfg({ focus: m })}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2.5 border-t pt-3">
          <DurationField
            label="Foco (min)"
            ariaLabel="Minutos de foco"
            value={cfg.focus}
            min={5}
            max={90}
            step={5}
            fallback={25}
            onCommit={(focus) => setCfg({ focus })}
          />
          <DurationField
            label="Pausa curta (min)"
            ariaLabel="Minutos de pausa curta"
            value={cfg.shortBreak}
            min={1}
            max={30}
            fallback={5}
            onCommit={(shortBreak) => setCfg({ shortBreak })}
          />
          <DurationField
            label="Pausa longa (min)"
            ariaLabel="Minutos de pausa longa"
            value={cfg.longBreak}
            min={5}
            max={60}
            step={5}
            fallback={15}
            onCommit={(longBreak) => setCfg({ longBreak })}
          />
          <DurationField
            label="Focos até a pausa longa"
            ariaLabel="Ciclos antes da pausa longa"
            value={cfg.cyclesBeforeLong}
            min={2}
            max={8}
            fallback={4}
            onCommit={(cyclesBeforeLong) => setCfg({ cyclesBeforeLong })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
