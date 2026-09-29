'use client';

import * as React from 'react';
import { BookOpen, Dumbbell, FileText, Moon, Search, Sparkles, Sun, Download } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import type { TabKey } from './sidebar-nav';
import {
  disciplines,
  materials,
  type Discipline,
  type Material,
} from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { DisciplineDetailDialog } from './discipline-detail-dialog';
import { MaterialSummaryDialog } from './material-summary-dialog';
import { DownloadsDialog } from './downloads-dialog';
import { cn } from '@/lib/utils';
import { openTutor } from '@/lib/hub-events';

interface Props {
  onNavigate: (k: TabKey) => void;
}

/** Nome do evento global disparado pelo botão de busca do Header. */
export const OPEN_PALETTE_EVENT = 'hub:open-command-palette';

const PAGES: {
  value: TabKey;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}[] = [
  { value: 'library', label: 'Conteúdos (materiais e resumos)', icon: <BookOpen />, shortcut: '1' },
  { value: 'study', label: 'Tutor IA', icon: <Sparkles />, shortcut: '2' },
  { value: 'practice', label: 'Praticar', icon: <Dumbbell />, shortcut: '3' },
];

export function CommandPalette({ onNavigate }: Props) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Dialogs gerenciados pela paleta
  const [selectedDiscipline, setSelectedDiscipline] = React.useState<Discipline | null>(null);
  const [disciplineOpen, setDisciplineOpen] = React.useState(false);
  const [selectedMaterial, setSelectedMaterial] = React.useState<Material | null>(null);
  const [materialOpen, setMaterialOpen] = React.useState(false);
  const [downloadsOpen, setDownloadsOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Ctrl+K / Cmd+K abre a paleta; atalhos 1–3 trocam de aba fora de inputs
  React.useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Atalhos numéricos só quando a paleta está fechada e o foco não está em input
      if (open || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const idx = Number(e.key);
      if (idx >= 1 && idx <= PAGES.length) {
        const page = PAGES[idx - 1];
        if (page) onNavigate(page.value);
      }
    }

    function onOpenPalette() {
      setOpen(true);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenPalette);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenPalette);
    };
  }, [open, onNavigate]);

  function run(action: () => void) {
    setOpen(false);
    // pequeno delay para fechar o dialog da paleta antes de abrir outro
    setTimeout(action, 80);
  }

  function go(k: TabKey) {
    run(() => onNavigate(k));
  }

  function toggleTheme() {
    run(() => setTheme(theme === 'dark' ? 'light' : 'dark'));
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        className="[_[cmdk-group-heading]]:text-emerald-600 dark:[_[cmdk-group-heading]]:text-emerald-400"
      >
        <CommandInput placeholder="Buscar páginas, disciplinas, materiais e ações..." />
        <CommandList className="max-h-[min(60vh,420px)] [scrollbar-width:thin]">
          <CommandEmpty>
            <span className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <Search className="size-5 opacity-60" aria-hidden="true" />
              Nada encontrado. Tente outro termo.
            </span>
          </CommandEmpty>

          <CommandGroup heading="Ir para">
            {PAGES.map((p) => (
              <CommandItem
                key={p.value}
                value={`pagina ${p.label}`}
                onSelect={() => go(p.value)}
                className="gap-2.5"
              >
                <span className="text-emerald-600 dark:text-emerald-400 [&_svg]:size-4">
                  {p.icon}
                </span>
                <span>{p.label}</span>
                <CommandShortcut>{p.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {/* O tutor na navegação universal: cada disciplina vira uma porta
              direta do chat — a disciplina já chega selecionada e a memória
              da conversa é a certa. */}
          <CommandGroup heading="Tutor IA — tirar dúvida">
            <CommandItem
              value="tutor ia duvida perguntar chat inteligencia artificial abrir estudar"
              onSelect={() => run(() => openTutor())}
              className="gap-2.5"
            >
              <span className="shrink-0 text-amber-500 [&_svg]:size-4">
                <Sparkles aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate">Abrir o tutor IA</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  chat da disciplina atual — lê materiais e seu progresso
                </span>
              </span>
            </CommandItem>
            {disciplines.map((d) => {
              const color = getColorClasses(d.color);
              return (
                <CommandItem
                  key={d.code}
                  value={`tutor ia duvida ${d.name} ${d.shortName} ${d.professor} perguntar chat`}
                  onSelect={() =>
                    run(() => openTutor({ disciplineCode: d.code }))
                  }
                  className="gap-2.5"
                >
                  <span className={cn('shrink-0 [&_svg]:size-4', color.text)}>
                    <DisciplineIcon name={d.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">Tutor de {d.shortName}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      dúvidas de {d.name} com o contexto do Hub
                    </span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Disciplinas">
            {disciplines.map((d) => {
              const color = getColorClasses(d.color);
              return (
                <CommandItem
                  key={d.code}
                  value={`disciplina ${d.name} ${d.shortName} ${d.professor}`}
                  onSelect={() =>
                    run(() => {
                      setSelectedDiscipline(d);
                      setDisciplineOpen(true);
                    })
                  }
                  className="gap-2.5"
                >
                  <span className={cn('shrink-0 [&_svg]:size-4', color.text)}>
                    <DisciplineIcon name={d.icon} />
                  </span>
                  <span className="truncate">{d.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {d.chTotal}h
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Materiais e resumos">
            {materials.map((m) => (
              <CommandItem
                key={m.id}
                value={`material ${m.title} ${m.type}`}
                onSelect={() =>
                  run(() => {
                    setSelectedMaterial(m);
                    setMaterialOpen(true);
                  })
                }
                className="gap-2.5"
              >
                {m.summaryFile ? (
                  <Sparkles className="shrink-0 text-violet-500" />
                ) : (
                  <FileText className="shrink-0 text-teal-500" />
                )}
                <span className="truncate">{m.title}</span>
                {m.pdfPath && (
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    PDF
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Ações">
            <CommandItem
              value="acao downloads zip pdf resumos materiais"
              onSelect={() =>
                run(() => {
                  setDownloadsOpen(true);
                })
              }
              className="gap-2.5"
            >
              <Download className="shrink-0 text-amber-500" />
              <span>Downloads de materiais (ZIP)</span>
            </CommandItem>
            {mounted && (
              <CommandItem
                value="acao alternar tema claro escuro"
                onSelect={toggleTheme}
                className="gap-2.5"
              >
                {theme === 'dark' ? (
                  <Sun className="shrink-0 text-amber-400" />
                ) : (
                  <Moon className="shrink-0 text-violet-400" />
                )}
                <span>Alternar para tema {theme === 'dark' ? 'claro' : 'escuro'}</span>
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>

        {/* Rodapé com dicas de atalho */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">↑↓</kbd>
            navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">↵</kbd>
            abrir
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">1–3</kbd>
            trocar de aba
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">Esc</kbd>
            fechar
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Search className="size-3" /> Ctrl+K
          </span>
        </div>
      </CommandDialog>

      {/* Dialogs reutilizados (mesmos da Biblioteca) */}
      <DisciplineDetailDialog
        discipline={selectedDiscipline}
        open={disciplineOpen}
        onOpenChange={setDisciplineOpen}
      />
      <MaterialSummaryDialog
        material={selectedMaterial}
        open={materialOpen}
        onOpenChange={setMaterialOpen}
      />
      <DownloadsDialog open={downloadsOpen} onOpenChange={setDownloadsOpen} />
    </>
  );
}

/** Botão compacto de busca usado no Header. */
export function PaletteTriggerButton() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isMac =
    mounted && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      type="button"
      aria-label="Busca rápida (Ctrl+K)"
      title="Busca rápida (Ctrl+K)"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
      className={cn(
        'group inline-flex h-11 sm:h-8 items-center gap-2 rounded-full border border-border bg-muted/40',
        'px-2.5 text-xs text-muted-foreground transition-colors',
        'hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
      )}
    >
      <Search className="size-3.5" />
      <span className="hidden sm:inline">Buscar...</span>
      <kbd className="hidden rounded border border-border bg-background px-1 font-mono text-[10px] sm:inline">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
