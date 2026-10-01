'use client';

import * as React from 'react';
import { CalendarClock, CircleCheck, Download, GraduationCap, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClockWidget, useNow } from './clock-widget';
import { DownloadsDialog } from './downloads-dialog';
import { PaletteTriggerButton } from './command-palette';
import { daysUntilDate, getNextEvaluation } from '@/lib/semester';
import { CURRENT_PERIOD_LABEL } from '@/lib/curriculum';
import { cn } from '@/lib/utils';
import { MATH_SIMULADO_DATE, findMathSimuladoRunOficial } from '@/lib/math-exam-prep';
import { useStudyProgress } from '@/lib/study-progress';

export function Header({ activeTab }: { activeTab?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [downloadsOpen, setDownloadsOpen] = React.useState(false);
  // O badge persistente precisa conhecer o REGISTRO do simulado oficial —
  // senão na noite de terça (29/09) seguiria gritando "É hoje" com a prova
  // já feita (o mesmo vício que a rodada 80 matou nos marcos do card).
  const sp = useStudyProgress();
  // FONTE ÚNICA (85): o mesmo registro lido pelo hero e pelo card da prova.
  const runOficialHeader = React.useMemo(
    () => findMathSimuladoRunOficial(sp.progress.simuladoRuns),
    [sp.progress.simuladoRuns],
  );

  // O TICK ÚNICO (113/115): o badge do header lê o useNow (60s) — o
  // setInterval próprio saiu (mais um loop a menos no mundo); o contrato
  // null-até-mount continua o mesmo (o servidor não sabe a hora).
  const nowTick = useNow(60_000);
  const nextEval = React.useMemo(
    () => (nowTick ? getNextEvaluation(nowTick) : null),
    [nowTick],
  );
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
          <PaletteTriggerButton />
          {/* O hero do Dashboard já mostra a próxima avaliação — evita duplicar a informação */}
          {nextEval && activeTab !== 'dashboard' && (
            <>
              {/* SIMULADO (29/09) — o marco mais próximo também no badge
                  persistente (mesma janela do hero: nasce a 7 dias, sai no
                  dia seguinte). Estados honestos com a MESMA família visual
                  do hero/marcos: emerald "feito ✓" / âmbar sólido "É hoje" /
                  contorno "amanhã" / contorno "em N dias". Render-time
                  (lição da 79): reage a mock de relógio no mesmo frame. */}
              {(() => {
                const dias = daysUntilDate(MATH_SIMULADO_DATE);
                if (dias < 0 || dias > 7) return null;
                const feito = dias === 0 && !!runOficialHeader;
                if (feito) {
                  return (
                    <Badge
                      aria-label="Simulado da Av1 de hoje já foi feito"
                      title="O Simulado da Av1 de hoje já foi feito — a correção comentada está no painel"
                      className="hidden border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30 lg:inline-flex dark:border-emerald-500 dark:bg-emerald-500 dark:text-white"
                    >
                      <CircleCheck className="mr-1 size-3" aria-hidden />
                      Simulado feito ✓
                    </Badge>
                  );
                }
                return (
                  <Badge
                    aria-label={
                      dias === 0
                        ? 'Hoje é o dia do Simulado da Av1 e da entrega S3 de Algoritmos'
                        : dias === 1
                          ? 'Amanhã é o dia do Simulado da Av1'
                          : `Simulado da Av1 em ${dias} dias`
                    }
                    title={
                      dias === 0
                        ? 'Hoje: Simulado da Av1 + entrega S3 de Algoritmos'
                        : dias === 1
                          ? 'Amanhã: Simulado da Av1 + entrega S3 de Algoritmos'
                          : `Simulado da Av1 em ${dias} dias (ter., 29/09)`
                    }
                    className={
                      dias === 0
                        ? 'hidden border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30 lg:inline-flex dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-900'
                        : 'hidden border-amber-300/70 bg-amber-50 text-amber-800 lg:inline-flex dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-300'
                    }
                  >
                    <CalendarClock
                      className={cn('size-3 shrink-0', dias === 0 && 'animate-pulse')}
                      aria-hidden
                    />
                    <span className="ml-1">
                      {dias === 0 ? (
                        <>
                          <span className="font-bold">É hoje:</span> Simulado
                        </>
                      ) : dias === 1 ? (
                        'Simulado amanhã'
                      ) : (
                        `Simulado em ${dias}d`
                      )}
                    </span>
                  </Badge>
                );
              })()}
              <Badge
                variant="outline"
                className="hidden border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 lg:inline-flex"
              >
                {nextEval.daysLeft === 0 ? 'hoje' : `${nextEval.daysLeft}d`} → {nextEval.name}{' '}
                ({nextEval.disciplineShort})
              </Badge>
            </>
          )}
          <ClockWidget />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Downloads de materiais"
            title="Downloads de materiais"
            className="size-11 shrink-0 rounded-full sm:size-9"
            onClick={() => setDownloadsOpen(true)}
          >
            <Download className="size-4" />
          </Button>
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

      <DownloadsDialog open={downloadsOpen} onOpenChange={setDownloadsOpen} />
    </header>
  );
}
