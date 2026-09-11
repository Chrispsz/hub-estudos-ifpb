'use client';

import * as React from 'react';
import { Download, GraduationCap, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClockWidget } from './clock-widget';
import { DownloadsDialog } from './downloads-dialog';
import { PaletteTriggerButton } from './command-palette';
import { getNextEvaluation } from '@/lib/semester';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [nextEval, setNextEval] = React.useState<ReturnType<typeof getNextEvaluation>>(null);
  const [downloadsOpen, setDownloadsOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setNextEval(getNextEvaluation());
    const id = setInterval(() => setNextEval(getNextEvaluation()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-3 px-6 py-2.5 pl-16 lg:pl-6">
        <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shrink-0">
          <GraduationCap className="size-4.5" />
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm font-semibold leading-tight tracking-tight truncate">
            Hub de Estudos IFPB
          </h1>
          <span className="text-[11px] text-muted-foreground truncate">
            2º Período • ADS 2026.2
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:gap-3 shrink-0">
          <PaletteTriggerButton />
          {nextEval && (
            <Badge
              variant="outline"
              className="hidden border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 lg:inline-flex"
            >
              {nextEval.daysLeft}d → {nextEval.name} ({nextEval.disciplineShort})
            </Badge>
          )}
          <ClockWidget variant="header" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Downloads e backup"
            title="Downloads e backup"
            className="shrink-0 rounded-full"
            onClick={() => setDownloadsOpen(true)}
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Alternar tema"
            title="Alternar tema"
            className="shrink-0 rounded-full"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {mounted && theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>

      <DownloadsDialog open={downloadsOpen} onOpenChange={setDownloadsOpen} />
    </header>
  );
}
