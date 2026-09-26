'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, GraduationCap, MapPin } from 'lucide-react';
import { disciplines, materials, type Discipline } from '@/data/course-data';
import { useStudyProgress } from '@/lib/study-progress';
import {
  ADS_CURRICULUM,
  COURSE_INFO,
  CURRENT_PERIOD,
  CURRENT_SEMESTER_LABEL,
  CURRICULUM_DISCIPLINES_COUNT,
  NUCLEUS_DOT_BG,
  nucleiInMatrix,
} from '@/lib/curriculum';
import { getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { DisciplineCard } from './discipline-card';
import { DisciplineDetailDialog } from './discipline-detail-dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Ponto colorido do núcleo da matriz (cor única na fonte: NUCLEUS_DOT_BG). */
function NucleusDot({ nucleus }: { nucleus: string }) {
  return (
    <span
      aria-hidden
      title={nucleus}
      className={cn(
        'size-2 shrink-0 rounded-full',
        NUCLEUS_DOT_BG[nucleus as keyof typeof NUCLEUS_DOT_BG] ?? 'bg-slate-400',
      )}
    />
  );
}

/** Coluna de um período da grade oficial (1º = atual com destaque). */
function PeriodColumn({ periodIndex }: { periodIndex: number }) {
  const p = ADS_CURRICULUM[periodIndex];
  const isCurrent = p.period === CURRENT_PERIOD;

  return (
    <Card
      className={cn(
        'flex flex-col rounded-xl p-3 shadow-sm',
        isCurrent
          ? 'border-emerald-500/40 bg-emerald-500/[0.04] ring-1 ring-emerald-500/30'
          : 'bg-muted/25',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <p
          className={cn(
            'text-xs font-semibold',
            isCurrent ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
          )}
        >
          {p.label}
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground">{p.ch}h</span>
      </div>

      {isCurrent && (
        <Badge
          variant="outline"
          className="mb-2 w-fit gap-1 border-emerald-300 bg-emerald-50 text-[9px] text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
        >
          <MapPin className="size-2.5" aria-hidden /> você está aqui • {CURRENT_SEMESTER_LABEL}
        </Badge>
      )}

      <ul className="space-y-1.5">
        {p.disciplines.map((d) => {
          const inHub = Boolean(d.hubCode && getDisciplineByCode(d.hubCode));
          const hubDisc = d.hubCode ? getDisciplineByCode(d.hubCode) : undefined;
          const color = hubDisc ? getColorClasses(hubDisc.color) : undefined;
          const prereqLabel = d.prereqs?.length
            ? `Pré-requisitos: ${d.prereqs.join(', ')}`
            : 'Sem pré-requisito';
          return (
            <li key={d.code} className="flex min-w-0 items-center gap-1.5">
              <NucleusDot nucleus={d.nucleus} />
              <span
                title={`${d.name} • ${d.nucleus} • ${d.ch}h • ${d.aulasSemanais} aulas/sem • ${prereqLabel}`}
                className={cn(
                  'min-w-0 flex-1 truncate text-[11px] leading-tight',
                  isCurrent || inHub
                    ? 'text-foreground'
                    : 'text-muted-foreground/80',
                  color && 'font-medium',
                )}
              >
                {d.shortName}
              </span>
              {inHub && (
                <span
                  title={`Ativa no Hub (${hubDisc?.shortName}) — materiais, exercícios e tutor disponíveis`}
                  className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                  aria-label="No Hub"
                />
              )}
              <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/70">
                {d.ch}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function DisciplinesView() {
  const sp = useStudyProgress();
  const [selected, setSelected] = React.useState<Discipline | null>(null);
  const [open, setOpen] = React.useState(false);
  const [curriculumOpen, setCurriculumOpen] = React.useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">
          Disciplinas do {CURRENT_PERIOD}º período
        </h2>
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

      {/* Grade curricular oficial — 6 períodos da matriz do curso */}
      <section aria-labelledby="grade-curricular-titulo">
        <button
          type="button"
          onClick={() => setCurriculumOpen((v) => !v)}
          aria-expanded={curriculumOpen}
          className="flex w-full items-center gap-2 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <GraduationCap className="size-5 text-emerald-500" aria-hidden />
          <h3 id="grade-curricular-titulo" className="text-base font-semibold">
            Grade curricular do curso
          </h3>
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
          >
            {COURSE_INFO.periodsCount} períodos • {CURRICULUM_DISCIPLINES_COUNT} disciplinas •{' '}
            {COURSE_INFO.chTotal}h
          </Badge>
          <span className="sr-only">
            {curriculumOpen ? 'Recolher grade' : 'Expandir grade'}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'ml-auto size-4 text-muted-foreground transition-transform',
              curriculumOpen && 'rotate-180',
            )}
          />
        </button>

        <p className="mt-1 text-xs text-muted-foreground">
          Matriz oficial do curso {COURSE_INFO.name} ({COURSE_INFO.level},{' '}
          {COURSE_INFO.campus}). Ponto colorido = núcleo da matriz; ponto verde =
          disciplina com conteúdo ativo no Hub. Passe o mouse para CH, aulas/semana e
          pré-requisitos.
        </p>

        {/* Legenda dos núcleos — mesmas cores dos pontos da grade */}
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"
          aria-label="Legenda dos núcleos da matriz"
        >
          {nucleiInMatrix().map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <span aria-hidden className={cn('size-1.5 rounded-full', NUCLEUS_DOT_BG[n])} />
              {n}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
            ativa no Hub
          </span>
        </div>

        {curriculumOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          >
            {ADS_CURRICULUM.map((p, i) => (
              <PeriodColumn key={p.period} periodIndex={i} />
            ))}
          </motion.div>
        )}
      </section>

      <DisciplineDetailDialog
        discipline={selected}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
