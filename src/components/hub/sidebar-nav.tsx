'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, GraduationCap, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useFocusMode } from '@/lib/focus-mode';

/** Abas que ficam em "Mais" quando o Modo Foco está ligado. */
const SECONDARY_TABS: TabKey[] = ['method', 'schedule', 'progress'];

export type TabKey =
  | 'dashboard'
  | 'study'
  | 'library'
  | 'practice'
  | 'method'
  | 'schedule'
  | 'progress'
  | 'settings';

export interface NavItem {
  value: TabKey;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: string;
}

interface SidebarNavProps {
  active: TabKey;
  onChange: (k: TabKey) => void;
  items: NavItem[];
  overallProgress?: number;
  totalCompleted?: number;
  totalMaterials?: number;
}

export function SidebarNav({
  active,
  onChange,
  items,
  overallProgress,
  totalCompleted,
  totalMaterials,
}: SidebarNavProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [focusMode] = useFocusMode();
  // "Mais" abre sozinho se a aba ativa for uma das escondidas — nunca some
  // a aba em que a pessoa está de propósito.
  const [moreOpen, setMoreOpen] = React.useState(false);

  const primary = focusMode
    ? items.filter((it) => !SECONDARY_TABS.includes(it.value))
    : items;
  const secondary = focusMode ? items.filter((it) => SECONDARY_TABS.includes(it.value)) : [];
  const activeHidden = secondary.some((it) => it.value === active);

  React.useEffect(() => {
    if (activeHidden) setMoreOpen(true);
  }, [activeHidden]);

  function handleSelect(k: TabKey) {
    onChange(k);
    setMobileOpen(false);
  }

  const renderNavItem = (it: NavItem) => (
    <button
      key={it.value}
      onClick={() => handleSelect(it.value)}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[0.98]',
        'hover:bg-muted/60',
        active === it.value
          ? 'bg-muted text-foreground shadow-sm'
          : 'text-muted-foreground',
      )}
      aria-current={active === it.value ? 'page' : undefined}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-md transition-colors',
          active === it.value
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        {it.icon}
      </span>
      <span className="flex-1 text-left">{it.label}</span>
      {it.badge != null && it.badge > 0 && (
        <Badge
          variant="outline"
          className={cn(
            'h-5 min-w-5 shrink-0 justify-center border px-1.5 text-[10px]',
            it.badgeColor ?? 'border-border text-muted-foreground',
          )}
        >
          {it.badge}
        </Badge>
      )}
    </button>
  );

  const NavList = (
    <nav className="flex flex-col gap-1" aria-label="Navegação principal">
      {primary.map(renderNavItem)}

      {/* Modo Foco: abas de apoio agrupadas em "Mais" — 1 toque traz de volta. */}
      {focusMode && secondary.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/60',
              activeHidden ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-md transition-colors',
                activeHidden
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'text-muted-foreground group-hover:text-foreground',
              )}
            >
              <ChevronDown
                className={cn('size-4 transition-transform duration-200', moreOpen && 'rotate-180')}
                aria-hidden
              />
            </span>
            <span className="flex-1 text-left">Mais</span>
            {!moreOpen && (
              <span className="flex items-center gap-1">
                {secondary.map((it) =>
                  it.badge != null && it.badge > 0 ? (
                    <span
                      key={it.value}
                      className="size-1.5 rounded-full bg-amber-500"
                      aria-label={`${it.label}: ${it.badge} pendências`}
                    />
                  ) : null,
                )}
              </span>
            )}
          </button>
          <AnimatePresence initial={false}>
            {moreOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="ml-4 flex flex-col gap-1 border-l border-border/70 pl-2">
                  {secondary.map(renderNavItem)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </nav>
  );

  const SidebarFooter = (
    <div className="mt-auto space-y-3 border-t border-border p-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-4 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-medium">Progresso geral</span>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso geral de materiais concluídos"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={overallProgress ?? 0}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
          style={{ width: `${overallProgress ?? 0}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {totalCompleted ?? 0} de {totalMaterials ?? 0} materiais concluídos
      </p>
    </div>
  );

  return (
    <>
      {/* Mobile: hamburger */}
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Abrir menu"
              className="fixed left-3 top-3 z-50 size-11 rounded-lg sm:size-9"
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="size-5 text-emerald-600 dark:text-emerald-400" />
                Hub de Estudos
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 [scrollbar-width:thin]">
              {NavList}
            </div>
            {SidebarFooter}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-card/40 min-h-screen sticky top-0">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
            <GraduationCap className="size-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">Hub de Estudos</p>
            <p className="text-[11px] text-muted-foreground truncate">IFPB ADS • Turma 2026.2</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 [scrollbar-width:thin]">
          {NavList}
        </div>
        {SidebarFooter}
      </aside>
    </>
  );
}
