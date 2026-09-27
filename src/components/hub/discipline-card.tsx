'use client';

import { motion } from 'framer-motion';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Discipline } from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { getColorClasses, priorityClasses } from '@/lib/discipline-colors';
import type { DisciplineExamBrief } from '@/lib/math-exam-prep';
import { cn } from '@/lib/utils';

interface Props {
  discipline: Discipline;
  materialsCount: number;
  completedCount: number;
  onSelect: (d: Discipline) => void;
  /** Semana da Av1 (fonte única: disciplineExamBriefFor) — só a disciplina
   *  da prova recebe; null/undefined = chip ausente (silêncio honesto). */
  examChip?: DisciplineExamBrief | null;
}

export function DisciplineCard({
  discipline,
  materialsCount,
  completedCount,
  onSelect,
  examChip,
}: Props) {
  const color = getColorClasses(discipline.color);
  const progress = materialsCount > 0 ? Math.round((completedCount / materialsCount) * 100) : 0;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(discipline)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
      className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Card
        className={cn(
          'group relative overflow-hidden rounded-xl border border-l-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
          color.border,
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-lg',
              color.bgSoft,
              color.text,
            )}
          >
            <DisciplineIcon name={discipline.icon} className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {discipline.shortName}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {discipline.chTotal}h • {discipline.chWeekly}h/sem
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn('shrink-0 border text-[10px] capitalize', priorityClasses[discipline.prioridade])}
          >
            {discipline.prioridade}
          </Badge>
        </div>

        {/* Chip da semana da Av1 — só na disciplina da prova, dentro da janela.
            Gramática de cor da casa: pulso SÓ nos é-hoje (ensaio/prova),
            amber estático nos dias de semana; rose reservado à prova. */}
        {examChip && (
          <div
            role="status"
            aria-label={`Av1 da disciplina: ${examChip.chip}`}
            className={cn(
              'mt-3 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium',
              examChip.kind === 'prova'
                ? 'border-rose-500/50 bg-rose-500/[0.07] text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/[0.08] dark:text-rose-400'
                : 'border-amber-500/40 bg-amber-500/[0.06] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/[0.08] dark:text-amber-400',
            )}
          >
            {examChip.kind === 'prova' || examChip.kind === 'simulado' ? (
              <span aria-hidden className="relative flex size-1.5 shrink-0">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                    examChip.kind === 'prova' ? 'bg-rose-500' : 'bg-amber-500',
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex size-1.5 rounded-full',
                    examChip.kind === 'prova' ? 'bg-rose-500' : 'bg-amber-500',
                  )}
                />
              </span>
            ) : (
              <CalendarClock aria-hidden className="size-3 shrink-0" />
            )}
            <span className="tabular-nums">{examChip.chip}</span>
          </div>
        )}

        {/* Barra de progresso fina */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', color.bgSolid)}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
            {completedCount}/{materialsCount}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {materialsCount} materiais
          </span>
          <span className={cn('inline-flex items-center gap-1 font-medium', color.text)}>
            Ver detalhes
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Card>
    </motion.button>
  );
}
