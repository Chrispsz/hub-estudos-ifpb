'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  AlarmClock,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clock4,
  Cpu,
  Dumbbell,
  Flag,
  Flame,
  History,
  Layers,
  ListChecks,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { disciplines, getDisciplineByCode, materials } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { openTutor, openPractice } from '@/lib/hub-events';
import { buildDayPlan, PLAN_KIND_LABEL, type PlanKind } from '@/lib/study-plan';
import { recallPdfPage } from '@/lib/pdf-position';
import {
  examWeekMilestoneFor,
  findMathSimuladoRunOficial,
  MATH_META,
  type ExamWeekMilestone,
} from '@/lib/math-exam-prep';
import { buildRunDebriefQuestion } from '@/lib/simulado-debrief';
import { daysUntilDate, upcomingEvents } from '@/lib/semester';
import { ExamRadarCard } from './exam-radar-card';
import { WeeklyScheduleCard } from './weekly-schedule-card';
import { PnaatReminderCard } from './pnaat-reminder-card';
import {
  DAYS_OF_WEEK,
  currentWeekOfSemester,
  generateSmartSchedule,
  adaptTodayBlocksToNow,
  learnedRhythmFromHistory,
  todayStudiedMinutesByDiscipline,
  weekStudiedMinutesByDiscipline,
  type LearnedRhythm,
  type ScheduleDisciplineState,
  type SmartBlock,
} from '@/lib/smart-schedule';
import { facilityMapOf } from '@/lib/learning-signals';
import {
  useStudyProgress,
  type SimuladoRun,
} from '@/lib/study-progress';
import { cn } from '@/lib/utils';

// ---------- Constantes locais ----------

const FULL_DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// AMOLED-friendly: fundos translúcidos e textos claros por cor nominal da disciplina.
// (bgSoft/bgSolid de discipline-colors.ts são pensados para tema claro.)
const DARK_TINT: Record<string, string> = {
  emerald: 'bg-emerald-500/10',
  orange: 'bg-orange-500/10',
  rose: 'bg-rose-500/10',
  violet: 'bg-violet-500/10',
  amber: 'bg-amber-500/10',
  teal: 'bg-teal-500/10',
  cyan: 'bg-cyan-500/10',
  slate: 'bg-slate-500/10',
};

const DARK_TEXT: Record<string, string> = {
  emerald: 'text-emerald-300',
  orange: 'text-orange-300',
  rose: 'text-rose-300',
  violet: 'text-violet-300',
  amber: 'text-amber-300',
  teal: 'text-teal-300',
  cyan: 'text-cyan-300',
  slate: 'text-slate-300',
};

const SCROLLBAR =
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border';

// ---------- Helpers ----------

/** 50 → "50min", 90 → "1h30", 120 → "2h" */
function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

/** Próxima ocorrência real do dia da semana (0 se for hoje). */
function nextOccurrenceOfDay(day: number, from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  return d;
}

interface BlockVisual {
  label: string;
  colorName: string;
  icon: React.ReactNode;
}

/** Resolve nome/ícone/cor para códigos especiais ('revisao', 'pnaat') e disciplinas reais. */
function getBlockVisual(code: string): BlockVisual {
  if (code === 'revisao') {
    return { label: 'Revisão geral', colorName: 'teal', icon: <RotateCcw className="size-3 shrink-0" /> };
  }
  if (code === 'pnaat') {
    return { label: 'PNAAT', colorName: 'violet', icon: <Cpu className="size-3 shrink-0" /> };
  }
  const disc = getDisciplineByCode(code);
  if (disc) {
    return {
      label: disc.shortName,
      colorName: disc.color,
      icon: <DisciplineIcon name={disc.icon} className="size-3 shrink-0" />,
    };
  }
  return { label: code, colorName: 'slate', icon: <RotateCcw className="size-3 shrink-0" /> };
}

// ---------- Componente principal ----------

/** Área de toque >=44px em mobile sem inflar o botão visualmente (pseudo-elemento). */
const TOUCH_AREA = 'relative after:absolute after:-inset-2.5 after:content-[\'\']';

/** TASK 221 — a cara de cada tipo de bloco da FILA DE MATERIAIS (a fila que
 *  morava na home; mesma gramática de cor do antigo plano: continuar =
 *  esmeralda, revisão = âmbar, prática = violeta, erro = laranja, atrasado =
 *  rosa, próximo = teal, reforço = fúcsia — firmar o que a dificuldade real
 *  apontou, família da prática com tom próprio). */
const PLAN_KIND_META_FILA: Record<PlanKind, { icon: LucideIcon; bg: string; text: string }> = {
  continuar: { icon: BookOpen, bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400' },
  revisao: { icon: History, bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400' },
  pratica: { icon: ListChecks, bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400' },
  reforco: { icon: Dumbbell, bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-700 dark:text-fuchsia-400' },
  erro: { icon: CircleAlert, bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400' },
  atrasado: { icon: AlarmClock, bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-400' },
  proximo: { icon: Sparkles, bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-400' },
};

export function ScheduleView() {
  const sp = useStudyProgress();
  const prefs = sp.progress.studyPreferences;

  // `now` só depois da montagem — evita hydration mismatch com datas.
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  // disciplineProgress → ScheduleDisciplineState (mesma estrutura, tipagem explícita)
  const discProg = React.useMemo(() => {
    const out: Record<string, ScheduleDisciplineState> = {};
    for (const [code, v] of Object.entries(sp.progress.disciplineProgress ?? {})) {
      out[code] = { studiedMinutes: v.studiedMinutes, lastStudiedAt: v.lastStudiedAt };
    }
    return out;
  }, [sp.progress.disciplineProgress]);

  // A AGENDA OFICIAL vive aqui (áudio 18/10 — saiu da home): o calendário do
  // campus junto do planejamento que ele condiciona.
  const upcomingAgenda = React.useMemo(
    () => (now ? upcomingEvents(now, 5) : []),
    [now],
  );

  // Cronograma rotativo (puro) — regenerado só quando preferências/progresso/data mudam.
  // FACILIDADE REAL (Task 226): os sinais das questões treinam o motor —
  // puxada pesa mais, fluida respira (a MESMA régua da home).
  // O REAL MANDA (pedido do dono): o foco da semana desconta das metas e o
  // foco DE HOJE tira a matéria dos blocos restantes do mesmo dia — a MESMA
  // fonte que a home usa (1 motor, 1 verdade).
  const facility = React.useMemo(() => facilityMapOf(sp.progress), [sp.progress]);
  const weekStudied = React.useMemo(
    () => (now ? weekStudiedMinutesByDiscipline(sp.progress.pomodoroSessions ?? [], now) : {}),
    [now, sp.progress.pomodoroSessions],
  );
  const todayStudied = React.useMemo(
    () => (now ? todayStudiedMinutesByDiscipline(sp.progress.pomodoroSessions ?? [], now) : {}),
    [now, sp.progress.pomodoroSessions],
  );
  // A CAPACIDADE DA SEMANA É O USO (dono, 20/10/2026 — "sem esses sistemas de
  // turnos"): mediana de minutos reais por dia; dias habilitados, turnos e
  // relógios saíram da equação — a casa assume estudo todos os dias no
  // tamanho que a vida do dono permite, e se refaz com o que foi feito.
  const learnedCapacity = React.useMemo<LearnedRhythm | undefined>(
    () =>
      now
        ? learnedRhythmFromHistory(sp.progress.pomodoroSessions ?? [], sp.progress.dailyHours, now)
        : undefined,
    [now, sp.progress.pomodoroSessions, sp.progress.dailyHours],
  );
  const autoBlocks = React.useMemo(
    () =>
      now
        ? generateSmartSchedule({
            preferences: prefs,
            topicProgress: sp.progress.topicProgress,
            disciplineProgress: discProg,
            customEvaluations: sp.progress.customEvaluations,
            facility,
            weekStudiedMinutes: weekStudied,
            todayStudiedMinutes: todayStudied,
            sessionStarts: sp.progress.sessionStarts,
            learnedCapacity,
            now,
          })
        : [],
    [prefs, sp.progress.topicProgress, discProg, sp.progress.customEvaluations, sp.progress.sessionStarts, sp.progress.pomodoroSessions, facility, weekStudied, todayStudied, learnedCapacity, now],
  );

  const allBlocks = React.useMemo(
    () =>
      // M13 — HOJE fala o AGORA: os blocos de hoje re-ancoram no momento do
      // acesso (a MESMA âncora da home — 1 fonte do "quando"). A superfície
      // não mostra relógio: a fila começa quando o dono senta.
      now
        ? [
            ...adaptTodayBlocksToNow(
              autoBlocks.filter((b) => b.day === now.getDay()),
              now,
            ),
            ...autoBlocks.filter((b) => b.day !== now.getDay()),
          ].sort(
            (a, b) =>
              a.day - b.day ||
              a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
          )
        : [],
    [autoBlocks, now],
  );

  const blocksByDay = React.useMemo(() => {
    const m = new Map<number, SmartBlock[]>();
    for (const b of allBlocks) {
      const arr = m.get(b.day) ?? [];
      arr.push(b);
      m.set(b.day, arr);
    }
    return m;
  }, [allBlocks]);

  const weekStats = React.useMemo(() => {
    const totalMin = allBlocks.reduce((acc, b) => acc + b.durationMin, 0);
    const rotation = new Set(
      autoBlocks.filter((b) => b.disciplineCode !== 'revisao').map((b) => b.disciplineCode),
    );
    return { total: allBlocks.length, totalMin, rotation: rotation.size };
  }, [allBlocks, autoBlocks]);

  // TASK 221 — FILA DE MATERIAIS DE HOJE: o que abrir dentro de cada bloco do
  // cronograma (continuar → revisão 1·3·7·14·30 → ciclo do erro → atrasados →
  // próximos). A fila que morava na home mudou-se para cá — um plano só:
  // a SEMANA é o cronograma, o DIA é o cronograma de hoje, a FILA é o
  // conteúdo de cada bloco. Lib pura — recomputada pós-mount como tudo aqui.
  const dayPlan = React.useMemo(
    () =>
      now
        ? buildDayPlan(sp.progress, now, {
            pageOf: (id) => {
              const m = materials.find((x) => x.id === id);
              return m ? recallPdfPage(id, m.pages) : null;
            },
          })
        : null,
    [sp.progress, now],
  );

  // Run do simulado oficial (29/09) — MESMA fonte única do card/hero/histórico.
  // O strip do dia do simulado lê o REGISTRO: feito hoje ✓ vence o relógio.
  const simuladoRunOficial = React.useMemo(
    () => findMathSimuladoRunOficial(sp.progress.simuladoRuns),
    [sp.progress.simuladoRuns],
  );

  // Marcos da Av1 na janela da grade (os 7 próximos dias rolando) — estatística
  // do resumo e honestidade da semana: se a grade cobre o simulado/véspera/prova,
  // o resumo conta e o resumo fala.
  const weekMilestones = React.useMemo(() => {
    if (!now) return [] as { milestone: ExamWeekMilestone; days: number }[];
    const out: { milestone: ExamWeekMilestone; days: number }[] = [];
    for (let day = 0; day <= 6; day++) {
      const d = nextOccurrenceOfDay(day, now);
      const m = examWeekMilestoneFor(d);
      if (m) out.push({ milestone: m, days: daysUntilDate(m.date, now) });
    }
    return out;
  }, [now]);

  const today = now ? now.getDay() : -1;

  // A GRADE É OS PRÓXIMOS 7 DIAS COMEÇANDO EM HOJE (bug da ordem, 20/10/2026:
  // antes ela seguia o índice do dia da semana — Dom primeiro — e a data de
  // cada card é a PRÓXIMA ocorrência, então Dom/Seg da semana que vem nasiam
  // ANTES de hoje, com Ter 20 depois de Seg 26). Agora a janela roda com o
  // dono: Ter (Hoje) → Qua → … → Seg, sempre em ordem cronológica real.
  const rollingDays = React.useMemo(() => {
    if (now === null) return DAYS_OF_WEEK;
    const t = now.getDay();
    return [...DAYS_OF_WEEK.slice(t), ...DAYS_OF_WEEK.slice(0, t)];
  }, [now]);

  // O RITMO QUE A CASA MEDIU (somente leitura — nada de config): foco real
  // por período nos últimos 14 dias. É o que a grade semanal assume como
  // capacidade e o que o dono vê quando quiser conferir.
  const ritmo14 = React.useMemo(() => {
    if (!now) return null;
    const cutoff = now.getTime() - 14 * 86_400_000;
    const per = { manha: 0, tarde: 0, noite: 0 };
    for (const s of sp.progress.pomodoroSessions ?? []) {
      const t = new Date(s.completedAt).getTime();
      if (Number.isNaN(t) || t < cutoff || t > now.getTime() + 60_000) continue;
      const h = new Date(t).getHours();
      if (h < 12) per.manha += s.focusMinutes || 0;
      else if (h < 18) per.tarde += s.focusMinutes || 0;
      else per.noite += s.focusMinutes || 0;
    }
    return per;
  }, [now, sp.progress.pomodoroSessions]);

  return (
    <div className="space-y-4">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Cronograma inteligente</h2>
            {now && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              >
                <CalendarDays className="size-3" />
                Semana {currentWeekOfSemester(now)} do semestre
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Nada para configurar aqui: a semana se refaz sozinha com o que você estudou de verdade —
            matérias alternadas pela carga horária e pelos pesos do curso, sem repetir a mesma no
            mesmo dia. As horas você escolhe na home.
          </p>
        </div>
      </div>

      {/* ---------- Resumo da semana ---------- */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5">
          <ListChecks className="size-4 text-emerald-400" />
          <b>{weekStats.total}</b>&nbsp;blocos na semana
        </span>
        <span className="hidden h-4 w-px bg-border md:block" />
        <span className="flex items-center gap-1.5">
          <Clock4 className="size-4 text-teal-400" />
          <b>{fmtDuration(weekStats.totalMin)}</b>&nbsp;de estudo planejado
        </span>
        <span className="hidden h-4 w-px bg-border md:block" />
        <span className="flex items-center gap-1.5">
          <Layers className="size-4 text-amber-400" />
          <b>{weekStats.rotation}</b>&nbsp;disciplinas na rotação
        </span>
        {weekMilestones.length > 0 && (() => {
          // A COR É O SIGNIFICADO (a gramática da casa, a mesma do mapa/agenda/
          // fila): prova = rose, os outros marcos (preparo/simulado/véspera) =
          // amber. Até hoje a bandeira era rose SEMPRE — mesmo anunciando o
          // ensaio de amanhã, que é família espera, não família prova.
          const nearest = weekMilestones.reduce((a, b) => (a.days <= b.days ? a : b));
          const dias = nearest.days;
          const isProva = nearest.milestone.kind === 'prova';
          const nome =
            nearest.milestone.kind === 'simulado'
              ? 'simulado'
              : nearest.milestone.kind === 'preparo'
                ? 'preparo do simulado'
                : nearest.milestone.kind === 'vespera'
                  ? 'véspera'
                  : 'prova';
          return (
            <>
              <span className="hidden h-4 w-px bg-border md:block" />
              <span className="flex items-center gap-1.5">
                <Flag className={isProva ? 'size-4 text-rose-400' : 'size-4 text-amber-400'} />
                <b className="tabular-nums">{weekMilestones.length}</b>
                &nbsp;marco{weekMilestones.length > 1 ? 's' : ''} da Av1
                <span className="text-muted-foreground">
                  {' '}
                  — {nome}
                  {dias === 0 ? ' hoje' : dias === 1 ? ' amanhã' : ` em ${dias} dias`}
                </span>
              </span>
            </>
          );
        })()}
      </div>

      {/* ---------- Grid semanal ---------- */}
      {now === null ? (
        // Skeleton até a montagem (datas/blocos dependem do relógio local).
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {DAYS_OF_WEEK.map((d) => (
            <Card key={d.num} className="min-h-40 space-y-2 p-3">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {rollingDays.map((d, idx) => (
            <DayCard
              key={d.num}
              day={d}
              index={idx}
              now={now}
              today={today}
              blocks={blocksByDay.get(d.num) ?? []}
              doneIds={sp.progress.scheduleBlocksDone}
              onToggleDone={sp.toggleScheduleBlockDone}
              runOficial={simuladoRunOficial}
            />
          ))}
        </div>
      )}

      {/* ---------- Fila de materiais de hoje (Task 221) ---------- */}
      {dayPlan && dayPlan.blocks.length > 0 && (
        <Card className="rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className="text-base font-semibold leading-tight">Fila de materiais de hoje</h2>
            <label
              htmlFor="toggle-revisao-fila"
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Switch
                id="toggle-revisao-fila"
                checked={sp.progress.preferences?.includeReviews !== false}
                onCheckedChange={(v) => sp.updatePreferences({ includeReviews: v })}
                aria-label="Incluir revisão de assuntos antigos na fila"
                data-t="toggle-revisao"
              />
              revisar antigos
            </label>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            O que abrir dentro de cada bloco — recentes da aula primeiro, prova
            marcada pesa, seus erros registrados viram revisão. Clique para abrir
            o material com o tutor ao lado.
          </p>
          <ul className="mt-2">
            {dayPlan.blocks.map((b) => {
              const meta = PLAN_KIND_META_FILA[b.kind];
              const Icon = meta.icon;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (b.kind === 'pratica') {
                        openPractice({ mode: 'flashcards' });
                        return;
                      }
                      if (b.kind === 'erro') {
                        const exerciseId = b.errorUnitId?.startsWith('unit:')
                          ? b.errorUnitId.slice('unit:'.length)
                          : undefined;
                        openPractice({
                          disciplineCode: b.disciplineCode,
                          ...(exerciseId ? { exerciseIds: [exerciseId] } : {}),
                        });
                        return;
                      }
                      if (b.materialId) {
                        openTutor({
                          disciplineCode: b.disciplineCode,
                          materialId: b.materialId,
                        });
                      } else if (b.disciplineCode) {
                        openTutor({ disciplineCode: b.disciplineCode });
                      }
                    }}
                    data-t={`fila-${b.id}`}
                    data-testid={`plano-bloco-${b.kind}`}
                    aria-label={`${PLAN_KIND_LABEL[b.kind]}: ${b.title} — ${b.why}`}
                    className="group flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-xl',
                        meta.bg,
                        meta.text,
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span
                          className={cn(
                            'shrink-0 text-[10.5px] font-semibold uppercase tracking-wide',
                            meta.text,
                          )}
                        >
                          {PLAN_KIND_LABEL[b.kind]}
                        </span>
                        {b.exam && (
                          <span
                            className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                            aria-label={`Avaliação de ${b.exam.name} em ${b.exam.daysLeft} dias`}
                          >
                            D-{b.exam.daysLeft}
                          </span>
                        )}
                        <span className="truncate text-[14px] font-medium leading-snug">
                          {b.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] leading-snug text-muted-foreground">
                        {b.why}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {b.minutes}min
                    </span>
                    <ChevronDown
                      className="size-4 shrink-0 -rotate-90 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ---------- O RITMO QUE A CASA MEDIU (somente leitura) ---------- */}
      <LearnedRhythmCard ritmo={ritmo14} capacity={learnedCapacity} />

      {/* ---------- A CONTEXTO DA SEMANA (áudio 18/10 — a casa da semana): o
          radar de provas, a grade de aulas, o PNAAT e a agenda oficial saíram
          da HOME para cá. Task 231: a Fila essencial saiu DE VEZ — o dono:
          "remove isso e sujeiras assim"; o cronograma é a única fonte do
          "quando", e a fila do dia vive na home (1 card, sem parede). ---------- */}
      <ExamRadarCard />
      <WeeklyScheduleCard />
      <PnaatReminderCard />
      {now && upcomingAgenda.length > 0 && (
        <Card className="rounded-2xl p-5 sm:p-6" data-t="agenda-card">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-base font-semibold leading-tight">Agenda oficial</h2>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Próximos compromissos oficiais do calendário do campus.
          </p>
          <ul className="mt-3">
            {upcomingAgenda.map((ev, i) => (
              <li
                key={`${ev.date}-${ev.title}`}
                className={`flex items-center gap-3 py-2 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    ev.kind === 'provas'
                      ? 'bg-violet-500'
                      : ev.kind === 'prazo'
                        ? 'bg-amber-500'
                        : ev.kind === 'feriado'
                          ? 'bg-emerald-500'
                          : ev.kind === 'letivo'
                            ? 'bg-teal-500'
                            : 'bg-zinc-400'
                  }`}
                  aria-hidden
                />
                <span className="w-14 shrink-0 text-muted-foreground">
                  {ev.ongoing
                    ? 'em curso'
                    : ev.daysLeft === 0
                      ? 'hoje'
                      : ev.daysLeft === 1
                        ? 'amanhã'
                        : `${ev.date.slice(8, 10)}/${ev.date.slice(5, 7)}`}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{ev.title}</span>
                {ev.daysLeft >= 0 && ev.daysLeft <= 7 && !ev.ongoing && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ev.daysLeft === 0 ? 'hoje' : ev.daysLeft === 1 ? 'amanhã' : `em ${ev.daysLeft} dias`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ---------- Card de dia ----------

function DayCard({
  day,
  index,
  now,
  today,
  blocks,
  doneIds,
  onToggleDone,
  runOficial,
}: {
  day: { num: number; label: string };
  index: number;
  now: Date;
  today: number;
  blocks: SmartBlock[];
  doneIds: string[];
  onToggleDone: (id: string) => void;
  runOficial?: SimuladoRun;
}) {
  const isToday = day.num === today;
  const totalMin = React.useMemo(() => blocks.reduce((acc, b) => acc + b.durationMin, 0), [blocks]);
  // Set p/ lookup O(1) dos blocos concluídos (evita includes O(n) por bloco).
  const doneSet = React.useMemo(() => new Set(doneIds), [doneIds]);
  const d = nextOccurrenceOfDay(day.num, now);
  const dateLabel = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`;

  // MARCO DA AV1 neste dia — render-time (lição 79: reage a mock de relógio
  // no mesmo frame) e fonte única examWeekMilestoneFor. days<0 não deve
  // ocorrer (a grade é sempre a semana rolando), mas o strip ignora por segurança.
  const milestone = examWeekMilestoneFor(d);
  const milestoneDays = milestone ? daysUntilDate(milestone.date, now) : -1;
  const milestoneVisible = milestone !== null && milestoneDays >= 0;
  const doneSimulado =
    milestone?.kind === 'simulado' && milestoneDays === 0 && runOficial !== undefined;

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Card
        className={cn(
          'flex h-full min-h-40 flex-col rounded-xl bg-card p-3',
          isToday && 'ring-2 ring-emerald-500/50',
          // Dia de marco (que não é hoje) ganha anel da cor do marco:
          // âmbar p/ simulado e véspera, rose p/ prova — cor = família.
          !isToday &&
            milestoneVisible &&
            (milestone.kind === 'prova' ? 'ring-2 ring-rose-500/40' : 'ring-2 ring-amber-500/40'),
        )}
      >
        {/* Header do dia — compacto: "Seg" / "14 set • 2h30" */}
        <div className="mb-2 min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            {day.label}
            {isToday && (
              <Badge className="bg-emerald-500 px-1.5 py-0 text-[9px] text-black">Hoje</Badge>
            )}
          </h3>
          <p
            className={cn(
              'truncate text-[10px] capitalize text-muted-foreground',
              milestoneVisible &&
                (milestone.kind === 'prova'
                  ? 'font-semibold text-rose-600 dark:text-rose-300'
                  : 'font-semibold text-amber-600 dark:text-amber-300'),
            )}
          >
            {dateLabel}
            {blocks.length > 0 && (
              <span
                className={cn(
                  'text-emerald-600 dark:text-emerald-400',
                  milestoneVisible && 'font-normal text-muted-foreground dark:text-muted-foreground',
                )}
              >
                {' '}
                • {fmtDuration(totalMin)}
              </span>
            )}
          </p>
        </div>

        {/* MARCO DA SEMANA DA AV1 — strip acima dos blocos (a agenda fala a semana) */}
        {milestoneVisible && (
          <MilestoneStrip
            milestone={milestone}
            days={milestoneDays}
            doneSimulado={doneSimulado}
            runOficial={runOficial}
          />
        )}

        {blocks.length === 0 ? (
          isToday ? (
            // M13 — HOJE re-ancora no agora: coluna vazia no dia = os blocos
            // já passaram ou a fila vive no card da sessão (a home manda no
            // dia; a grade mostra a semana).
            <div className="flex flex-1 items-center justify-center py-4 text-center text-[11px] text-muted-foreground">
              O dia de hoje mora na home — a fila começa quando você sentar.
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center py-4 text-center text-[11px] text-muted-foreground">
              Dia livre — a semana se refaz com o que você estudar.
            </div>
          )
        ) : (
          <ul className={cn('max-h-80 flex-1 space-y-1.5 overflow-y-auto pr-0.5', SCROLLBAR)}>
            {blocks.map((b) => (
              <ScheduleBlockItem
                key={b.id}
                block={b}
                done={doneSet.has(b.id)}
                onToggleDone={() => onToggleDone(b.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}

// ---------- Strip do marco da semana da Av1 ----------

/**
 * Faixa do marco dentro do DayCard — a gramática visual do Hub:
 *  - futuro   = tinta translúcida da família + chip de contagem ('em 2 dias');
 *  - é hoje   = SÓLIDO com pulso (o tratamento do banner D-0 da 76 e dos
 *               chips da 85/86) — urgência tem som, feitos têm silêncio;
 *  - feito ✓  = SÓLIDO emerald sem pulso + % da meta (a gramática da 87/88),
 *               e o clique abre o tutor com o debrief do run real (a MESMA
 *               correção a 1 clique do chip do hero da 85).
 * Famílias: simulado/véspera = amber · prova = rose · feito = emerald.
 */
function MilestoneStrip({
  milestone,
  days,
  doneSimulado,
  runOficial,
}: {
  milestone: ExamWeekMilestone;
  days: number;
  doneSimulado: boolean;
  runOficial?: SimuladoRun;
}) {
  const isToday = days === 0;
  const pct =
    doneSimulado && runOficial && runOficial.total > 0
      ? Math.round((runOficial.solved / runOficial.total) * 100)
      : null;

  const icon =
    milestone.kind === 'prova' ? (
      <CalendarCheck className="size-3 shrink-0" />
    ) : milestone.kind === 'vespera' ? (
      <BookOpenCheck className="size-3 shrink-0" />
    ) : doneSimulado ? (
      <CircleCheck className="size-3 shrink-0" />
    ) : (
      <CalendarClock className={cn('size-3 shrink-0', isToday && !doneSimulado && 'animate-pulse')} />
    );

  const solid = isToday;
  const family =
    milestone.kind === 'prova'
      ? 'rose'
      : doneSimulado
        ? 'emerald'
        : 'amber';

  const stripCls = solid
    ? {
        amber:
          'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30 dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-900',
        rose: 'border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-600/30 dark:border-rose-500 dark:bg-rose-500',
        emerald: 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/30 dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-900',
      }[family]
    : {
        amber: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        rose: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
        emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      }[family];

  const chipCls = solid
    ? 'bg-white/20 text-current'
    : {
        amber: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        rose: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
        emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      }[family];

  const titulo = doneSimulado
    ? 'Simulado da Av1 feito ✓'
    : isToday
      ? `É hoje: ${milestone.titulo}`
      : milestone.titulo;

  const chipLabel = doneSimulado
    ? pct !== null
      ? `${pct}% · meta ${MATH_META}${pct >= MATH_META ? ' ✓' : ''}`
      : undefined
    : isToday
      ? milestone.kind === 'prova'
        ? 'Boa prova!'
        : undefined
      : `em ${days} dia${days === 1 ? '' : 's'}`;

  // Linha 2: chip + texto — futuro mostra o subtítulo (ou a dica), hoje mostra
  // a dica do dia, feito mostra o caminho da correção. title p/ hover revelar
  // o texto inteiro quando o card de 7 colunas trunca.
  const row2Text = doneSimulado
    ? 'pedir a correção no tutor — o ensaio vale ouro na véspera'
    : isToday
      ? milestone.detalhe
      : (milestone.subtitulo ?? milestone.detalhe);

  const body = (
    <div className={cn('rounded-lg border px-2 py-1.5', stripCls)}>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold leading-tight" title={titulo}>
          {titulo}
        </p>
      </div>
      {chipLabel && (
        <div className="mt-1">
          <span
            className={cn(
              'rounded border px-1 py-px text-[9px] font-semibold tabular-nums',
              chipCls,
            )}
          >
            {chipLabel}
          </span>
        </div>
      )}
      <p
        className={cn('truncate text-[10px] leading-tight opacity-80', chipLabel ? 'mt-1' : 'mt-0.5')}
        title={row2Text}
      >
        {row2Text}
      </p>
    </div>
  );

  // Feito hoje → o strip INTEIRO é o atalho da correção (mesma correção do hero).
  if (doneSimulado && runOficial) {
    return (
      <button
        type="button"
        onClick={() => openTutor({ question: buildRunDebriefQuestion(runOficial) })}
        aria-label={`Abrir o tutor com o debrief do simulado oficial — ${pct}% (${runOficial.solved}/${runOficial.total})`}
        className="block w-full text-left transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        title="Abrir o debrief no tutor"
      >
        {body}
      </button>
    );
  }
  return body;
}

// ---------- Bloco de estudo ----------

interface BadgeDef {
  cls: string;
  icon: React.ReactNode;
  label: string;
}

function ScheduleBlockItem({
  block,
  done,
  onToggleDone,
}: {
  block: SmartBlock;
  done: boolean;
  onToggleDone: () => void;
}) {
  const visual = getBlockVisual(block.disciplineCode);
  const color = getColorClasses(visual.colorName);
  const tint = DARK_TINT[visual.colorName] ?? 'bg-slate-500/10';
  const textCls = DARK_TEXT[visual.colorName] ?? 'text-slate-300';

  const badges: BadgeDef[] = [];
  if (block.intensive) {
    badges.push({
      cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      icon: <Flame className="size-2.5" />,
      label: 'Intensivo',
    });
  }
  if (block.stale) {
    badges.push({
      cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      icon: <History className="size-2.5" />,
      label: 'Retomada',
    });
  }
  if (block.isReview) {
    badges.push({
      cls: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
      icon: <RotateCcw className="size-2.5" />,
      label: 'Revisão',
    });
  }

  return (
    <li
      className={cn(
        'rounded-lg border-l-4 p-2 transition-colors',
        color.border,
        tint,
        done && 'opacity-60 ring-1 ring-emerald-500/40',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        {/* SEM RELÓGIO (dono, 20/10/2026): a posição do bloco na fila do dia
            é a ordem — "1º", "2º"… o relógio é o momento em que o dono senta. */}
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          {fmtDuration(block.durationMin)} de foco
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleDone}
            aria-label={done ? 'Desmarcar bloco como concluído' : 'Marcar bloco como concluído'}
            className={cn(
              'flex size-6 items-center justify-center rounded-full border transition-colors',
              done
                ? 'border-emerald-500 bg-emerald-500 text-black'
                : 'border-border text-muted-foreground hover:border-emerald-500/60 hover:text-emerald-400',
              TOUCH_AREA,
            )}
          >
            <Check className="size-3.5" />
          </button>
        </div>
      </div>

      <p
        className={cn(
          'mt-1 flex items-center gap-1 text-xs font-semibold',
          textCls,
          done && 'line-through',
        )}
      >
        {visual.icon}
        {visual.label}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
        {block.title}
      </p>

      {badges.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {badges.map((b) => (
            <Badge
              key={b.label}
              variant="outline"
              className={cn('gap-0.5 px-1 py-0 text-[9px]', b.cls)}
            >
              {b.icon}
              {b.label}
            </Badge>
          ))}
        </div>
      )}
    </li>
  );
}

// ---------- O ritmo que a casa mediu (somente leitura) ----------

/**
 * O FIM DO PAINEL DE PREFERÊNCIAS (dono, 20/10/2026: "sem esses sistemas de
 * turnos… deixa ainda mais limpo, menos coisa para mexer"). Nada de checkboxes
 * de dia, turnos, "6h no dia", disciplina fixada ou modo de rotação: o motor
 * assume a capacidade do uso real (mediana dos últimos 21 dias) e esta casa
 * só CONTA o que foi medido — manhã/tarde/noite dos últimos 14 dias. Se um
 * dia o dono quiser voltar a configurar, o histórico do git tem o painel.
 */
function LearnedRhythmCard({
  ritmo,
  capacity,
}: {
  ritmo: { manha: number; tarde: number; noite: number } | null;
  capacity: LearnedRhythm | undefined;
}) {
  const periodBits =
    ritmo === null
      ? []
      : [
          ritmo.manha >= 5 ? ['Manhã', ritmo.manha] : null,
          ritmo.tarde >= 5 ? ['Tarde', ritmo.tarde] : null,
          ritmo.noite >= 5 ? ['Noite', ritmo.noite] : null,
        ].filter(Boolean) as [string, number][];

  return (
    <Card className="rounded-2xl p-5 sm:p-6" data-t="ritmo-aprendido">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="text-base font-semibold leading-tight">Ritmo que a casa aprendeu</h2>
        {capacity && (
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary">
            dia típico ≈ {fmtDuration(capacity.minutesPerDay)}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Você não configura nada aqui. A casa registra quando você estuda e de quanto tempo você
        dispõe — a semana se refaz sozinha com o que foi estudado de verdade, sem repetir a mesma
        matéria no mesmo dia.
      </p>
      {periodBits.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {periodBits.map(([label, min]) => (
            <span
              key={label}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              {label} · {fmtDuration(min)} <span className="text-emerald-600/70 dark:text-emerald-400/70">em 14 dias</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground/80">
          Sem registros nos últimos 14 dias — conforme você estuda, os períodos aparecem aqui sozinhos.
        </p>
      )}
    </Card>
  );
}
