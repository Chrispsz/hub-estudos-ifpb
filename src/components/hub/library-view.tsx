'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  FileText,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { disciplines, materials, type Discipline } from '@/data/course-data';
import { getColorClasses, priorityClasses } from '@/lib/discipline-colors';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { DisciplinesView } from './disciplines-view';
import { MaterialsList } from './materials-list';

type CategoryFilter = 'todos' | Discipline['category'];

// Contagens estáticas (dados imutáveis) calculadas uma única vez.
const PDF_COUNT = materials.filter((m) => m.pdfPath).length;
const SUMMARY_COUNT = materials.filter((m) => m.summaryFile).length;

const CATEGORY_COUNTS: Record<CategoryFilter, number> = {
  todos: disciplines.length,
  exata: disciplines.filter((d) => d.category === 'exata').length,
  tecnica: disciplines.filter((d) => d.category === 'tecnica').length,
  humanas: disciplines.filter((d) => d.category === 'humanas').length,
  linguagens: disciplines.filter((d) => d.category === 'linguagens').length,
};

// Cores escritas literalmente para o Tailwind detectar no scan de conteúdo.
const FILTERS: {
  value: CategoryFilter;
  label: string;
  activeClasses: string;
}[] = [
  {
    value: 'todos',
    label: 'Todos',
    activeClasses: 'border-foreground bg-foreground text-background',
  },
  {
    value: 'exata',
    label: 'Exata',
    activeClasses: 'border-rose-500/50 bg-rose-500/15 text-rose-300',
  },
  {
    value: 'tecnica',
    label: 'Técnica',
    activeClasses: 'border-violet-500/50 bg-violet-500/15 text-violet-300',
  },
  {
    value: 'humanas',
    label: 'Humanas',
    activeClasses: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
  },
  {
    value: 'linguagens',
    label: 'Linguagens',
    activeClasses: 'border-teal-500/50 bg-teal-500/15 text-teal-300',
  },
];

const PRIORITY_LABEL: Record<Discipline['prioridade'], string> = {
  alta: 'Prioridade alta',
  media: 'Prioridade média',
  baixa: 'Prioridade baixa',
};

// Dados imutáveis — contagem de materiais por disciplina calculada uma única vez.
const MATERIAL_COUNT_BY_CODE = new Map(
  disciplines.map((d) => [
    d.code,
    materials.filter((m) => m.disciplineCode === d.code).length,
  ]),
);

// Badges do cabeçalho com variantes dark: coerentes com lib/discipline-colors.
const STAT_BADGES = {
  disciplinas: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  pdfs: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-300',
  resumos: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300',
} as const;

export function LibraryView() {
  const [tab, setTab] = React.useState<string>('disciplinas');
  const [filtro, setFiltro] = React.useState<CategoryFilter>('todos');

  const filteredDisciplines = React.useMemo(
    () =>
      filtro === 'todos'
        ? []
        : disciplines.filter((d) => d.category === filtro),
    [filtro],
  );

  // Card filtrado clicado → volta para a visão completa (aba Disciplinas, filtro Todos).
  const verVisaoCompleta = React.useCallback(() => {
    setFiltro('todos');
    setTab('disciplinas');
  }, []);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Biblioteca */}
      <header className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Biblioteca</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Disciplinas, materiais e resumos gerados por IA — 2º período ADS
            2026.2
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Resumo da biblioteca">
          <Badge variant="outline" className={`gap-1.5 ${STAT_BADGES.disciplinas}`}>
            <BookOpen className="size-3.5" aria-hidden="true" />
            {disciplines.length} disciplinas
          </Badge>
          <Badge variant="outline" className={`gap-1.5 ${STAT_BADGES.pdfs}`}>
            <FileText className="size-3.5" aria-hidden="true" />
            {PDF_COUNT} PDFs
          </Badge>
          <Badge variant="outline" className={`gap-1.5 ${STAT_BADGES.resumos}`}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            {SUMMARY_COUNT} resumos IA
          </Badge>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1.5 sm:inline-grid sm:w-auto">
          <TabsTrigger value="disciplinas" className="gap-1.5 rounded-lg text-xs sm:px-4">
            <BookOpen className="size-3.5" aria-hidden="true" />
            Disciplinas
          </TabsTrigger>
          <TabsTrigger value="resumos" className="gap-1.5 rounded-lg text-xs sm:px-4">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Resumos IA
            <Badge variant="outline" className="border-border px-1.5 text-[10px]">
              {SUMMARY_COUNT}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Aba Disciplinas: filtro rápido por categoria + visão completa */}
        <TabsContent value="disciplinas" className="outline-none">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="space-y-4"
          >
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Filtrar disciplinas por categoria"
            >
              <span className="text-xs font-medium text-muted-foreground">
                Categoria:
              </span>
              {FILTERS.map((f) => {
                const ativo = filtro === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setFiltro(f.value)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 ${
                      ativo
                        ? f.activeClasses
                        : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                    }`}
                  >
                    {f.label}
                    <span className="text-[10px] opacity-70">
                      {CATEGORY_COUNTS[f.value]}
                    </span>
                  </button>
                );
              })}
            </div>

            <motion.div
              key={filtro}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {filtro === 'todos' ? (
                <DisciplinesView />
              ) : filteredDisciplines.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 text-center">
                  <BookOpen className="size-8 text-muted-foreground/60" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma disciplina nesta categoria.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {filteredDisciplines.length}{' '}
                    {filteredDisciplines.length === 1
                      ? 'disciplina encontrada'
                      : 'disciplinas encontradas'}
                    {' — '}clique em um card para abrir a visão completa com
                    ementa, conteúdo e materiais.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredDisciplines.map((d) => (
                      <FilteredDisciplineCard
                        key={d.code}
                        discipline={d}
                        materialsCount={MATERIAL_COUNT_BY_CODE.get(d.code) ?? 0}
                        onClick={verVisaoCompleta}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* Aba Resumos IA */}
        <TabsContent value="resumos" className="outline-none">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <MaterialsList />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Card simplificado exibido quando um filtro de categoria está ativo.
 * Informativo + clicável: leva o usuário de volta à visão completa
 * (filtro "Todos") onde estão os detalhes de cada disciplina.
 * Memoizado: os dados são imutáveis e o handler é estável.
 */
const FilteredDisciplineCard = React.memo(function FilteredDisciplineCard({
  discipline,
  materialsCount,
  onClick,
}: {
  discipline: Discipline;
  materialsCount: number;
  onClick: () => void;
}) {
  const color = getColorClasses(discipline.color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`Ver ${discipline.name} na visão completa da biblioteca`}
        className={`flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${color.ring}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-lg ${color.bgSoft} ${color.text}`}
            aria-hidden="true"
          >
            <DisciplineIcon name={discipline.icon} className="size-5" />
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] ${priorityClasses[discipline.prioridade]}`}
          >
            {PRIORITY_LABEL[discipline.prioridade]}
          </Badge>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{discipline.shortName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {discipline.name}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="size-3.5" aria-hidden="true" />
            {discipline.professor}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {discipline.chTotal} h
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" aria-hidden="true" />
            {materialsCount} {materialsCount === 1 ? 'material' : 'materiais'}
          </span>
        </div>
      </button>
    </motion.div>
  );
});
