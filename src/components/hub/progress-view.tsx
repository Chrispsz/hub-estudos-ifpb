'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Flame,
  BarChart3,
  BookCheck,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  Timer,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudyProgress, type PomodoroSession } from '@/lib/study-progress';
import { materials, getDisciplineByCode } from '@/data/course-data';
import { cn } from '@/lib/utils';
import { GradeCalculator } from './grade-calculator';
import { SemesterProjection } from './semester-projection';
import { WeeklyReport } from './weekly-report';
import { AchievementsCard } from './achievements-card';
import { StudyHeatmap } from './study-heatmap';
import { SimuladoHistory } from './simulado-history';

// ----- Paleta dos gráficos (tema AMOLED — sem azul/índigo) -----
const EMERALD = '#10b981';
const TEAL = '#14b8a6';

// O projeto usa CSS vars em oklch cru (globals.css) — em style inline usa-se
// var(--token) diretamente, SEM wrapper hsl() (hsl(oklch(...)) seria inválido).
const tooltipContentStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--card-foreground)',
} as const;
const tooltipLabelStyle = { color: 'var(--muted-foreground)' } as const;
const tooltipItemStyle = { color: 'var(--card-foreground)' } as const;
const axisTickStyle = { fill: 'var(--muted-foreground)', fontSize: 11 } as const;

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface DisciplineFocusPoint {
  name: string; // rótulo curto p/ eixo X
  fullName: string; // shortName completo p/ tooltip
  minutes: number;
  sessions: number;
}

interface DailyFocusPoint {
  key: string; // yyyy-mm-dd (UTC, mesmo padrão das sessões)
  label: string; // Dom..Sáb
  full: string; // "Sex, 14/06"
  minutes: number;
}

/** Encurta nomes longos de disciplina para o eixo X. */
function shortenName(name: string): string {
  if (name === 'Linguagens de Marcação') return 'L. Marcação';
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

/** Agrega focusMinutes por dia nos últimos 7 dias (0 quando não houver sessão). */
function buildLast7Days(sessions: PomodoroSession[]): DailyFocusPoint[] {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.focusMinutes);
  }
  const out: DailyFocusPoint[] = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const label = WEEKDAY_LABELS[d.getUTCDay()];
    out.push({
      key,
      label,
      full: `${label}, ${key.slice(8, 10)}/${key.slice(5, 7)}`,
      minutes: byDate.get(key) ?? 0,
    });
  }
  return out;
}

interface StatCardDef {
  icon: LucideIcon;
  iconClasses: string;
  label: string;
  value: string;
  sub: string;
}

export function ProgressView() {
  const sp = useStudyProgress();

  const completedMaterials = sp.progress.completedMaterials.length;
  const totalMaterials = materials.length;
  const materialsPct =
    totalMaterials > 0
      ? Math.min(100, Math.round((completedMaterials / totalMaterials) * 100))
      : 0;

  // Gráfico de barras: minutos de foco por disciplina (ordenado, maior primeiro)
  const focusByDiscipline = React.useMemo<DisciplineFocusPoint[]>(() => {
    return sp.byDiscipline
      .map((d) => {
        const disc = getDisciplineByCode(d.disciplineCode);
        const fullName = disc?.shortName ?? d.disciplineCode;
        return {
          name: shortenName(fullName),
          fullName,
          minutes: d.minutes,
          sessions: d.sessions,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [sp.byDiscipline]);

  // Gráfico de área: foco nos últimos 7 dias (sempre 7 pontos, 0 se vazio)
  const dailyFocus = React.useMemo(
    () => buildLast7Days(sp.progress.pomodoroSessions),
    [sp.progress.pomodoroSessions],
  );

  const hasAnySession = sp.progress.pomodoroSessions.length > 0;
  const hasFocusLast7d = dailyFocus.some((d) => d.minutes > 0);

  const stats: StatCardDef[] = [
    {
      icon: Timer,
      iconClasses: 'bg-emerald-500/15 text-emerald-500',
      label: 'Foco hoje',
      value: `${sp.minutesToday} min`,
      sub: `${sp.sessionsToday.length} ${sp.sessionsToday.length === 1 ? 'sessão' : 'sessões'} • meta ${sp.dailyGoalProgress}%`,
    },
    {
      icon: CalendarClock,
      iconClasses: 'bg-teal-500/15 text-teal-500',
      label: 'Últimos 7 dias',
      value: `${sp.minutesLast7d} min`,
      sub: `${sp.sessionsLast7d.length} ${sp.sessionsLast7d.length === 1 ? 'sessão' : 'sessões'}`,
    },
    {
      icon: CheckCircle2,
      iconClasses: 'bg-violet-500/15 text-violet-500',
      label: 'Tópicos concluídos',
      value: `${sp.totalTopicsCompleted}`,
      sub: 'marcados no checklist',
    },
    {
      icon: Dumbbell,
      iconClasses: 'bg-amber-500/15 text-amber-500',
      label: 'Exercícios resolvidos',
      value: `${sp.totalExercisesSolved}/${sp.totalExercisesTried}`,
      sub: 'resolvidos / tentados',
    },
    {
      icon: Flame,
      iconClasses: 'bg-rose-500/15 text-rose-500',
      label: 'Streak',
      value: `${sp.studyStreak} ${sp.studyStreak === 1 ? 'dia' : 'dias'}`,
      sub: sp.studyStreak > 0 ? 'dias seguidos estudando 🔥' : 'comece hoje!',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Meu progresso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estatísticas de estudo, metas e calculadora de médias
        </p>
      </header>

      {/* Cards de estatísticas */}
      <section aria-label="Estatísticas de estudo">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <Card className="h-full rounded-xl bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-lg',
                      stat.iconClasses,
                    )}
                  >
                    <stat.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span
                    className="size-2 rounded-full bg-current opacity-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-3 text-2xl font-bold leading-none tabular-nums tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs font-medium text-foreground/80">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Progresso geral de materiais (full-width) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.2 }}
        >
          <Card className="mt-4 rounded-xl bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500">
                  <BookCheck className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {completedMaterials}/{totalMaterials} materiais concluídos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Progresso geral da biblioteca de estudos
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold tabular-nums text-emerald-500">
                {materialsPct}%
              </span>
            </div>
            <Progress
              value={materialsPct}
              aria-label={`Progresso de materiais: ${materialsPct}%`}
              className="mt-3 h-2 [&>div]:bg-emerald-500"
            />
          </Card>
        </motion.div>
      </section>

      {/* Relatório semanal (esta semana vs anterior) */}
      <section aria-label="Relatório semanal">
        <WeeklyReport />
      </section>

      {/* Mapa de consistência (estilo GitHub) */}
      <section aria-label="Mapa de consistência de estudos">
        <StudyHeatmap sessions={sp.progress.pomodoroSessions} dailyGoal={sp.progress.preferences.dailyGoal} />
      </section>

      {/* Histórico de simulados (evolução das notas) */}
      <section aria-label="Histórico de simulados">
        <SimuladoHistory />
      </section>

      {/* Conquistas (gamificação) */}
      <section aria-label="Conquistas">
        <AchievementsCard />
      </section>

      {/* Gráficos */}
      <section aria-label="Gráficos de foco" className="grid gap-4 lg:grid-cols-2">
        {/* Minutos de foco por disciplina */}
        <Card className="rounded-xl bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="size-4 text-emerald-500" aria-hidden="true" />
            Minutos de foco por disciplina
          </h2>
          {hasAnySession && focusByDiscipline.length > 0 ? (
            <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={focusByDiscipline} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                    interval={0}
                    height={30}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    cursor={{ fill: 'var(--accent)', opacity: 0.35 }}
                    formatter={(value) => [`${value} min`, 'Foco']}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as DisciplineFocusPoint | undefined;
                      if (!p) return String(_);
                      const unit = p.sessions === 1 ? 'sessão' : 'sessões';
                      return `${p.fullName} • ${p.sessions} ${unit}`;
                    }}
                  />
                  <Bar
                    dataKey="minutes"
                    fill={EMERALD}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart
              icon={BarChart3}
              message="Nenhuma sessão registrada ainda — comece um Pomodoro na aba Estudar"
            />
          )}
        </Card>

        {/* Foco nos últimos 7 dias */}
        <Card className="rounded-xl bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-teal-500" aria-hidden="true" />
            Foco nos últimos 7 dias
          </h2>
          {hasFocusLast7d ? (
            <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyFocus} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="focusAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAL} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                    interval={0}
                    height={30}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    cursor={{ stroke: 'var(--border)' }}
                    formatter={(value) => [`${value} min`, 'Foco']}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as DailyFocusPoint | undefined;
                      return p?.full ?? String(_);
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    name="Foco"
                    stroke={TEAL}
                    strokeWidth={2}
                    fill="url(#focusAreaFill)"
                    dot={{ r: 2.5, fill: TEAL, strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart
              icon={CalendarClock}
              message="Sem foco registrado nos últimos 7 dias — retome o ritmo com um Pomodoro hoje"
            />
          )}
        </Card>
      </section>

      {/* Ferramentas mescladas: calculadora de médias + projeção do semestre */}
      <section aria-label="Ferramentas de acompanhamento">
        <Tabs defaultValue="calculadora">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="calculadora" className="gap-1.5 px-3 py-1.5">
              <Calculator className="size-4" aria-hidden="true" />
              Calculadora de médias
            </TabsTrigger>
            <TabsTrigger value="projecao" className="gap-1.5 px-3 py-1.5">
              <TrendingUp className="size-4" aria-hidden="true" />
              Projeção do semestre
            </TabsTrigger>
          </TabsList>
          <TabsContent value="calculadora" className="mt-4">
            <GradeCalculator />
          </TabsContent>
          <TabsContent value="projecao" className="mt-4">
            <SemesterProjection />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function EmptyChart({
  icon: Icon,
  message,
}: {
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className="mt-4 flex h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 text-center">
      <Icon className="size-6 text-muted-foreground/60" aria-hidden="true" />
      <p className="max-w-xs text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
