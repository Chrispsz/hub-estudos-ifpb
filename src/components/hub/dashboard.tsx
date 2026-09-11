'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Flame,
  Lightbulb,
  Sparkles,
  ChevronRight,
  CalendarCheck,
  Layers,
  Sun,
  Target,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  course,
  disciplines,
  materials,
  evaluationPeriods,
  getDisciplineByCode,
} from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { countDisciplinesOnTrack, countTotalTopicsDone } from '@/lib/study-topics';
import { DisciplineDetailDialog } from './discipline-detail-dialog';
import { MaterialSummaryDialog } from './material-summary-dialog';
import type { Discipline, Material } from '@/data/course-data';
import { studyStrategy } from '@/data/course-data';
import { TodayStudyCard } from './today-study-card';
import { SemesterProjection } from './semester-projection';
import {
  daysUntilDate,
  currentWeekOfSemester,
  semesterProgressPct,
  upcomingEvents,
  getNextEvaluation as getNextEvaluationShared,
} from '@/lib/semester';

interface Props {
  onStartStudy?: (disciplineCode?: string, materialId?: string) => void;
  onOpenSchedule?: () => void;
  onOpenLibrary?: () => void;
  onOpenPractice?: () => void;
}

export function Dashboard({ onStartStudy, onOpenSchedule, onOpenLibrary, onOpenPractice }: Props) {
  const sp = useStudyProgress();
  const [selected, setSelected] = React.useState<Discipline | null>(null);
  const [open, setOpen] = React.useState(false);
  const [recentMaterial, setRecentMaterial] = React.useState<Material | null>(null);
  const [recentOpen, setRecentOpen] = React.useState(false);

  // Próximas 3 avaliações (só no cliente — APENAS datas oficiais; sem estimativas)
  const [upcoming, setUpcoming] = React.useState<typeof evaluationPeriods>([]);
  React.useEffect(() => {
    const now = new Date();
    setUpcoming(
      [...evaluationPeriods]
        .filter((e) => !e.conditional && e.date)
        .filter((e) => daysUntilDate(e.date as string, now) >= 0)
        .sort((a, b) => daysUntilDate(a.date as string, now) - daysUntilDate(b.date as string, now))
        .slice(0, 3),
    );
  }, []);

  // Próxima avaliação em destaque (só no cliente)
  const [nextEval, setNextEval] = React.useState<ReturnType<typeof getNextEvaluationShared>>(null);
  React.useEffect(() => {
    setNextEval(getNextEvaluationShared());
    const id = setInterval(() => setNextEval(getNextEvaluationShared()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Recentes
  const recentMaterials = React.useMemo(() => {
    return sp.progress.recentMaterials
      .slice(0, 3)
      .map((r) => materials.find((m) => m.id === r.id))
      .filter((m): m is Material => !!m);
  }, [sp.progress.recentMaterials]);

  // Dica do dia rotativa (baseada no dia do mês - determinística por dia)
  const dailyTip = React.useMemo(() => {
    const all = disciplines.flatMap((d) =>
      d.dicasEstudo.map((t) => ({ disc: d, tip: t })),
    );
    const idx = new Date().getDate() % all.length;
    return all[idx];
  }, []);

  function openDiscipline(d: Discipline) {
    setSelected(d);
    setOpen(true);
  }

  // KPIs V3 adicionais
  const totalTopicsDone = countTotalTopicsDone(sp.progress.topicProgress);
  const disciplinesOnTrack = countDisciplinesOnTrack(sp.progress.topicProgress);

  return (
    <div className="space-y-6">
      {/* Hero card com saudação + progresso do semestre + próxima avaliação */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden rounded-2xl border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-card to-teal-50 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/40 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Olá! Bons estudos
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">
                {course.nomeCurto} • {course.semestreAtual}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {course.instituicao} — Campus {course.campus}
              </p>
              {nextEval && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm dark:border-amber-900 dark:bg-amber-950/60">
                  <CalendarCheck className="size-4 text-amber-600" />
                  <span className="text-amber-900">
                    <span className="font-semibold">Faltam {nextEval.daysLeft} dias</span>{' '}
                    para {nextEval.name} — {nextEval.disciplineShort}
                  </span>
                </div>
              )}
            </div>
            <SemesterMiniStats />
          </div>
        </Card>
      </motion.section>

      {/* "O que estudar hoje" (card central V3) */}
      <TodayStudyCard
        onStartStudy={onStartStudy}
        onOpenSettings={onOpenSchedule}
      />

      {/* Chamada de revisão espaçada — só aparece quando há flashcards vencidos */}
      {sp.flashcardStats.due > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card className="flex flex-row flex-wrap items-center gap-3 rounded-xl border-l-4 border-l-teal-500 bg-card p-4 shadow-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Layers className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Revisão espaçada — {sp.flashcardStats.due}{' '}
                {sp.flashcardStats.due === 1 ? 'cartão esperando' : 'cartões esperando'}
              </p>
              <p className="text-xs text-muted-foreground">
                Revisar hoje fixa o conteúdo na memória de longa duração.
              </p>
            </div>
            <Button
              size="sm"
              onClick={onOpenPractice}
              className="bg-teal-600 text-white hover:bg-teal-700"
              aria-label={`Abrir revisão de ${sp.flashcardStats.due} flashcards`}
            >
              Revisar agora <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </Card>
        </motion.section>
      )}

      {/* KPIs (4 + 2 novos) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-7">
        <KpiCard
          label="Disciplinas"
          value={disciplines.length}
          icon={<BookOpen className="size-4" />}
          color="emerald"
        />
        <KpiCard
          label="Materiais"
          value={materials.length}
          icon={<FileText className="size-4" />}
          color="orange"
        />
        <KpiCard
          label="Pomodoros hoje"
          value={sp.sessionsToday.length}
          icon={<Flame className="size-4" />}
          color="rose"
          hint={`Meta: ${sp.progress.preferences.dailyGoal}`}
        />
        <KpiCard
          label="Minutos hoje"
          value={sp.minutesToday}
          icon={<Clock3 className="size-4" />}
          color="violet"
        />
        <KpiCard
          label="Tópicos concluídos"
          value={totalTopicsDone}
          icon={<CheckCircle2 className="size-4" />}
          color="teal"
          hint="do total do PPC"
        />
        <KpiCard
          label="Disciplinas em dia"
          value={disciplinesOnTrack}
          icon={<Layers className="size-4" />}
          color="amber"
          hint="progresso ≥ 50%"
        />
        <KpiCard
          label="Streak"
          value={sp.studyStreak}
          pulse={sp.studyStreak > 0}
          icon={<Zap className="size-4" />}
          color="amber"
          hint={sp.studyStreak > 0 ? (sp.studyStreak === 1 ? 'dia seguido' : 'dias seguidos 🔥') : 'estude hoje!'}
        />
      </section>

      {/* Próximas 3 avaliações (com countdown real + status) */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4 text-amber-500" /> Próximas avaliações (datas oficiais)
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {upcoming.length === 0 ? (
            <Card className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground sm:col-span-3">
              Nenhuma data oficial à frente. As avaliações entram aqui assim que os professores divulgarem.
            </Card>
          ) : (
            upcoming.map((e, i) => {
              const disc = getDisciplineByCode(e.disciplineCode);
              const color = getColorClasses(disc?.color ?? 'slate');
              const now = new Date();
              const daysLeft = e.date ? daysUntilDate(e.date, now) : -1;
              // Status: em dia (progresso PPC ≥ 50%) ou atrasada
              const discTopics = sp.progress.topicProgress[e.disciplineCode] ?? {};
              const allTopics = disc?.conteudoProgramatico.flatMap((u) => u.topicos) ?? [];
              const doneTopics = allTopics.filter((t) => discTopics[t]).length;
              const pct = allTopics.length === 0 ? 0 : Math.round((doneTopics / allTopics.length) * 100);
              const onTrack = pct >= 50;
              return (
                <Card
                  key={i}
                  className={cn(
                    'rounded-xl border-l-4 bg-card p-3 shadow-sm',
                    color.border,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-md',
                        color.bgSoft,
                        color.text,
                      )}
                    >
                      <DisciplineIcon name={disc?.icon ?? 'BookOpen'} className="size-3.5" />
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('ml-auto border text-[11px]', color.badge)}
                    >
                      {daysLeft > 0 ? `${daysLeft}d` : 'hoje'}
                    </Badge>
                  </div>
                  <p className={cn('mt-2 text-[11px] font-medium uppercase tracking-wide', color.text)}>
                    {disc?.shortName} •{' '}
                    {e.date
                      ? new Date(`${e.date}T12:00:00`).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })
                      : 'A definir'}
                  </p>
                  <p className="text-sm font-semibold leading-tight">{e.evaluationName}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {e.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', color.bgSolid)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 border text-[9px]',
                        onTrack
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300',
                      )}
                    >
                      {onTrack ? 'em dia' : 'atrasada'}
                    </Badge>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Prévia do semestre (V3) */}
      <SemesterProjection />

      {/* Acesso rápido às disciplinas (scroll horizontal) */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <BookOpen className="size-4 text-emerald-500" /> Acesso rápido
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {disciplines.map((d) => {
            const color = getColorClasses(d.color);
            return (
              <button
                key={d.code}
                onClick={() => openDiscipline(d)}
                className="min-w-[200px] shrink-0 text-left"
              >
                <Card
                  className={cn(
                    'flex-row items-center gap-3 rounded-lg border-l-4 bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
                    color.border,
                  )}
                >
                  <div
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-md',
                      color.bgSoft,
                      color.text,
                    )}
                  >
                    <DisciplineIcon name={d.icon} className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.shortName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.chTotal}h • {d.professor.split(' ')[0]}
                    </p>
                  </div>
                  <ChevronRight className={cn('size-4 shrink-0', color.text)} />
                </Card>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recentes + dica do dia */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <CalendarCheck className="size-4 text-teal-500" /> Agenda acadêmica oficial
          </h3>
          <AcademicAgenda />
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-teal-500" /> Recentes
          </h3>
          {recentMaterials.length === 0 ? (
            <Card className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
              Nenhum material acessado ainda. Explore a aba &quot;Resumos IA&quot; ou &quot;Disciplinas&quot;.
            </Card>
          ) : (
            <div className="space-y-2">
              {recentMaterials.map((m) => {
                const disc = getDisciplineByCode(m.disciplineCode);
                const color = getColorClasses(disc?.color ?? 'slate');
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setRecentMaterial(m);
                      setRecentOpen(true);
                    }}
                    className="block w-full text-left"
                  >
                    <Card
                      className={cn(
                        'rounded-lg border-l-4 bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
                        color.border,
                      )}
                    >
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className={cn('mt-0.5 text-[11px]', color.text)}>
                        {disc?.shortName} • {new Date(
                          sp.progress.recentMaterials.find((r) => r.id === m.id)?.accessedAt ?? Date.now(),
                        ).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </p>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Target className="size-4 text-emerald-500" /> Estratégia de estudo
          </h3>
          <Card className="rounded-xl border-l-4 border-l-emerald-500 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{studyStrategy.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{studyStrategy.description}</p>
              </div>
              <Badge variant="outline" className="shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                80/20
              </Badge>
            </div>
            <ul className="mt-3 grid gap-1.5 text-xs text-foreground/80 sm:grid-cols-2">
              {studyStrategy.rules.slice(0, 6).map((rule, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" aria-hidden />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {studyStrategy.rules.length - 6} regras completas na aba Estudar e no material do curso.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Lightbulb className="size-4 text-amber-500" /> Dica do dia
          </h3>
          {dailyTip && (
            <Card className="rounded-xl border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 via-card to-orange-50 p-4 shadow-sm dark:from-amber-950/40 dark:via-card dark:to-orange-950/30">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                  )}
                >
                  <Lightbulb className="size-4" />
                </div>
                <div>
                  <p className={cn('text-xs font-semibold text-amber-700 dark:text-amber-300')}>
                    {dailyTip.disc.shortName}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground/85">{dailyTip.tip}</p>
                </div>
              </div>
            </Card>
          )}
        </section>
      </div>

      <DisciplineDetailDialog
        discipline={selected}
        open={open}
        onOpenChange={setOpen}
      />
      <MaterialSummaryDialog
        material={recentMaterial}
        open={recentOpen}
        onOpenChange={setRecentOpen}
      />
    </div>
  );
}

/** Mini-stats do semestre no hero — substitui o relógio duplicado. */
function SemesterMiniStats() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const week = mounted ? currentWeekOfSemester() : 0;
  const pct = mounted ? semesterProgressPct() : 0;

  return (
    <div className="w-full shrink-0 rounded-xl border border-border bg-card/80 p-4 sm:w-56">
      <p className="text-xs font-medium text-muted-foreground">
        Calendário oficial 2026.2
      </p>
      <p className="mt-1 text-2xl font-bold leading-none tabular-nums">
        {week > 0 ? `Semana ${week}` : '—'}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {mounted
          ? `24/08/2026 → 30/01/2027 • ~${pct}% concluído`
          : '24/08/2026 → 30/01/2027'}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const EVENT_STYLES: Record<
  string,
  { badge: string; icon: React.ReactNode }
> = {
  feriado: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300',
    icon: <Sun className="size-3.5" />,
  },
  letivo: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
    icon: <CheckCircle2 className="size-3.5" />,
  },
  prazo: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
    icon: <Target className="size-3.5" />,
  },
  evento: {
    badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300',
    icon: <Sparkles className="size-3.5" />,
  },
  pausa: {
    badge: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300',
    icon: <CalendarCheck className="size-3.5" />,
  },
  provas: {
    badge: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300',
    icon: <CalendarCheck className="size-3.5" />,
  },
};

/** Agenda acadêmica real (fonte: calendário oficial IFPB Cajazeiras 2026). */
function AcademicAgenda() {
  const [events, setEvents] = React.useState<ReturnType<typeof upcomingEvents>>([]);
  React.useEffect(() => {
    setEvents(upcomingEvents(new Date(), 4));
  }, []);

  if (events.length === 0) {
    return (
      <Card className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
        Nenhum evento acadêmico próximo. Confira o calendário oficial do campus.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((ev) => {
        const style = EVENT_STYLES[ev.kind] ?? EVENT_STYLES.evento;
        const d = new Date(`${ev.date}T12:00:00`);
        const dayLabel = d.getDate().toString().padStart(2, '0');
        const monthLabel = d
          .toLocaleDateString('pt-BR', { month: 'short' })
          .replace('.', '')
          .toUpperCase();
        return (
          <Card
            key={`${ev.date}-${ev.title}`}
            className={cn(
              'flex-row items-center gap-3 rounded-xl border p-3 shadow-sm',
              ev.ongoing && 'ring-2 ring-emerald-500/40',
            )}
          >
            <div className="grid w-12 shrink-0 place-items-center rounded-lg bg-muted/60 py-1.5">
              <span className="text-sm font-bold leading-none">{dayLabel}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{monthLabel}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ev.title}</p>
              {ev.description && (
                <p className="truncate text-[11px] text-muted-foreground">{ev.description}</p>
              )}
            </div>
            <Badge variant="outline" className={cn('shrink-0 border text-[10px]', style.badge)}>
              {ev.ongoing ? 'agora' : ev.daysLeft === 0 ? 'hoje' : `em ${ev.daysLeft}d`}
            </Badge>
          </Card>
        );
      })}
      <p className="px-1 text-[11px] text-muted-foreground">
        Fonte: Calendário Acadêmico IFPB Cajazeiras 2026 — inclui feriados, sábados letivos e a pausa 18/12 → 18/01.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
  hint,
  pulse = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'emerald' | 'orange' | 'rose' | 'violet' | 'teal' | 'amber';
  hint?: string;
  pulse?: boolean;
}) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-950', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-950', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  };
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="rounded-xl bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/5">
        <div className="flex items-center justify-between">
          <span className={cn('grid size-8 place-items-center rounded-lg', c.bg, c.text)}>
            {icon}
          </span>
          <span className={cn('size-2 rounded-full', c.dot, pulse && 'animate-pulse')} />
        </div>
        <p className="mt-3 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs font-medium text-foreground/80">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </Card>
    </motion.div>
  );
}
