'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { disciplines, materials, type Discipline } from '@/data/course-data';
import { useStudyProgress } from '@/lib/study-progress';
import { DisciplineCard } from './discipline-card';
import { DisciplineDetailDialog } from './discipline-detail-dialog';

export function DisciplinesView() {
  const sp = useStudyProgress();
  const [selected, setSelected] = React.useState<Discipline | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Disciplinas do 1º período</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {disciplines.length} disciplinas • {materials.length} materiais no total.
          Clique em um card para ver ementa, conteúdo, avaliação e materiais.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {disciplines.map((d, i) => {
          const mats = materials.filter((m) => m.disciplineCode === d.code);
          const completed = mats.filter((m) =>
            sp.progress.completedMaterials.includes(m.id),
          ).length;
          return (
            <motion.div
              key={d.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <DisciplineCard
                discipline={d}
                materialsCount={mats.length}
                completedCount={completed}
                onSelect={(dd) => {
                  setSelected(dd);
                  setOpen(true);
                }}
              />
            </motion.div>
          );
        })}
      </div>

      <DisciplineDetailDialog
        discipline={selected}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
