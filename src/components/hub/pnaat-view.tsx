'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  FileText,
  Hourglass,
  PlayCircle,
  Target,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  pnaatInfo,
  pnaatTrails,
  type PnaatModule,
} from '@/data/course-data';
import { useStudyProgress } from '@/lib/study-progress';
import { cn } from '@/lib/utils';
import { PdfViewerDialog } from './pdf-viewer-dialog';
import { toast } from 'sonner';
import type { Material } from '@/data/course-data';

export function PnaatView() {
  const sp = useStudyProgress();
  const [pdfOpen, setPdfOpen] = React.useState(false);

  // Calcula progresso médio geral
  const stats = React.useMemo(() => {
    const allModules = pnaatTrails.flatMap((t) => t.modules);
    const total = allModules.length;
    let completed = 0;
    let inProgress = 0;
    let totalProgress = 0;
    let totalHours = 0;
    for (const m of allModules) {
      const p = sp.progress.pnaatProgress[m.id]?.progress ?? m.progress;
      totalProgress += p;
      totalHours += m.durationHours;
      if (p >= 100) completed += 1;
      else if (p > 0) inProgress += 1;
    }
    return {
      total,
      completed,
      inProgress,
      notStarted: total - completed - inProgress,
      avgProgress: total > 0 ? Math.round(totalProgress / total) : 0,
      totalHours,
      hoursCompleted: Math.round(
        (totalProgress / (total * 100)) * totalHours,
      ),
      hoursRemaining: 0, // calculado abaixo
    };
  }, [sp.progress.pnaatProgress]);

  // Calcula horas restantes e próximo módulo
  const { hoursRemaining, nextModule } = React.useMemo(() => {
    let hrs = 0;
    let next: { module: PnaatModule; trailTitle: string } | null = null;
    for (const t of pnaatTrails) {
      for (const m of t.modules) {
        const p = sp.progress.pnaatProgress[m.id]?.progress ?? m.progress;
        if (p < 100) {
          hrs += Math.round((1 - p / 100) * m.durationHours);
          if (!next) {
            next = { module: m, trailTitle: t.title };
          }
        }
      }
    }
    return { hoursRemaining: hrs, nextModule: next };
  }, [sp.progress.pnaatProgress]);

  const pnaatMaterial: Material = {
    id: 'pnaat-cursos',
    disciplineCode: 'PNAAT',
    title: 'PNAAT - Meus Cursos (PDF)',
    type: 'pdf',
    pdfPath: pnaatInfo.pdfPath,
    summaryFile: '',
    source: 'pnaat',
  };

  const allDone = stats.completed === stats.total && stats.total > 0;

  return (
    <div className="space-y-5">
      {/* Card de info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden rounded-2xl border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50 via-card to-amber-50 p-5 shadow-sm sm:p-6 dark:from-rose-950/40 dark:via-card dark:to-amber-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-700">
                <Cpu className="size-3" /> {pnaatInfo.nome}
              </Badge>
              <h2 className="mt-2 text-lg font-semibold leading-tight sm:text-xl">
                {pnaatInfo.tema}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pnaatInfo.instituicao} • Aluno: {pnaatInfo.usuario}
              </p>
              <p className="mt-2 text-sm text-foreground/85">
                {pnaatInfo.objetivo}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button asChild size="sm" variant="secondary" className="bg-rose-600 text-white hover:bg-rose-700">
                <a href={pnaatInfo.platformUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" /> Abrir plataforma
                </a>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPdfOpen(true)}>
                <FileText className="size-3.5" /> Abrir PDF PNAAT
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Concluídos"
          value={`${stats.completed}/${stats.total}`}
          color="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Em andamento"
          value={String(stats.inProgress)}
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          icon={<Clock className="size-4" />}
          label="Horas totais"
          value={`${stats.totalHours}h`}
          hint={`${stats.hoursCompleted}h concluídas`}
          color="bg-violet-50 text-violet-700"
        />
        <StatCard
          icon={<Target className="size-4" />}
          label="Progresso médio"
          value={`${stats.avgProgress}%`}
          color="bg-rose-50 text-rose-700"
        />
      </div>

      {/* Tempo restante estimado + Próximo módulo (V3) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="rounded-xl border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50 to-card p-4 shadow-sm dark:from-rose-950/40 dark:to-card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-700">
            <Hourglass className="size-4" /> Tempo restante estimado
          </h3>
          <p className="mt-2 text-3xl font-bold tabular-nums">{hoursRemaining}h</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Calculado com base no progresso atual de cada trilha.
            {hoursRemaining === 0 && ' 🎉 Você concluiu tudo!'}
          </p>
        </Card>

        <Card className="rounded-xl border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-card p-4 shadow-sm dark:from-amber-950/40 dark:to-card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <PlayCircle className="size-4" /> Próximo módulo
          </h3>
          {nextModule ? (
            <div className="mt-2">
              <p className="text-sm font-semibold leading-tight">
                {nextModule.module.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {nextModule.trailTitle} • {nextModule.module.professor} • {nextModule.module.durationHours}h
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2 h-7">
                <a href={pnaatInfo.platformUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3" /> Abrir plataforma FIT
                </a>
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Todos os módulos concluídos. Parabéns! 🎉
            </p>
          )}
        </Card>
      </div>

      {/* Mensagem motivacional */}
      {allDone && (
        <Card className="rounded-2xl border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-card to-teal-50 p-5 shadow-sm dark:from-emerald-950/40 dark:via-card dark:to-teal-950/40">
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Trophy className="size-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-emerald-800">
                Parabéns! Você concluiu todas as trilhas do PNAAT! 🎉
              </p>
              <p className="mt-0.5 text-sm text-emerald-700">
                Agora é aguardar o resultado da bolsa. Continue praticando!
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Trilhas (accordion) */}
      <Accordion
        type="multiple"
        defaultValue={[pnaatTrails[0]?.id]}
        className="w-full space-y-3"
      >
        {pnaatTrails.map((trail) => (
          <AccordionItem
            key={trail.id}
            value={trail.id}
            className="rounded-xl border border-border bg-card px-4 shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center gap-3 pr-2 text-left">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-700">
                  <Cpu className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{trail.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {trail.totalModules} módulos •{' '}
                    {trail.modules.reduce((acc, m) => acc + m.durationHours, 0)}h totais
                  </p>
                </div>
                <TrailProgressBadge trailId={trail.id} modules={trail.modules} />
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="grid gap-2 pb-2 pt-1">
                {trail.modules.map((m) => (
                  <ModuleCard key={m.id} module={m} />
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <PdfViewerDialog
        material={pdfOpen ? pnaatMaterial : null}
        open={pdfOpen}
        onOpenChange={setPdfOpen}
      />
    </div>
  );
}

function TrailProgressBadge({
  trailId,
  modules,
}: {
  trailId: string;
  modules: PnaatModule[];
}) {
  const sp = useStudyProgress();
  const avg = React.useMemo(() => {
    let sum = 0;
    for (const m of modules) {
      sum += sp.progress.pnaatProgress[m.id]?.progress ?? m.progress;
    }
    return modules.length > 0 ? Math.round(sum / modules.length) : 0;
  }, [sp.progress.pnaatProgress, modules]);

  const colorClass =
    avg >= 100
      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
      : avg > 0
        ? 'border-amber-200 bg-amber-100 text-amber-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <Badge variant="outline" className={cn('shrink-0 border text-[10px]', colorClass)}>
      {avg}%
    </Badge>
  );
}

function ModuleCard({ module }: { module: PnaatModule }) {
  const sp = useStudyProgress();
  const progress = sp.progress.pnaatProgress[module.id]?.progress ?? module.progress;

  const status =
    progress >= 100
      ? 'concluido'
      : progress > 0
        ? 'em_andamento'
        : 'nao_iniciado';

  const statusBadge = {
    concluido: (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700 text-[10px]">
        <CheckCircle2 className="size-2.5" /> Concluído
      </Badge>
    ),
    em_andamento: (
      <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-700 text-[10px]">
        Em andamento
      </Badge>
    ),
    nao_iniciado: (
      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 text-[10px]">
        Não iniciado
      </Badge>
    ),
  }[status];

  return (
    <li className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{module.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {module.professor} • {module.durationHours}h
          </p>
        </div>
        {statusBadge}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => {
            sp.updatePnaatProgress(module.id, parseInt(e.target.value, 10));
          }}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-rose-500"
          aria-label={`Progresso de ${module.title}`}
        />
        <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
          {progress}%
        </span>
        {progress > 0 && (
          <button
            onClick={() => {
              sp.updatePnaatProgress(module.id, 0);
              toast.info('Progresso resetado');
            }}
            className="text-[10px] text-muted-foreground hover:text-rose-600"
          >
            reset
          </button>
        )}
      </div>
    </li>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <Card className="rounded-xl bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={cn('grid size-8 place-items-center rounded-lg', color)}>
          {icon}
        </span>
        <Award className="size-4 text-muted-foreground/40" />
      </div>
      <p className="mt-3 text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium text-foreground/80">{label}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}
