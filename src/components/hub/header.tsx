'use client';

import * as React from 'react';
import { GraduationCap, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { PaletteTriggerButton } from './command-palette';
import { CURRENT_PERIOD_LABEL } from '@/lib/curriculum';

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
