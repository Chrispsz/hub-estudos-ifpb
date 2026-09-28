'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Discipline } from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { getColorClasses, priorityClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';

interface Props {
  discipline: Discipline;
  materialsCount: number;
  completedCount: number;
  onSelect: (d: Discipline) => void;
}

export function DisciplineCard({
  discipline,
  materialsCount,
  completedCount,
  onSelect,
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
