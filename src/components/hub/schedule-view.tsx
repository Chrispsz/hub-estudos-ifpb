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
  Coffee,
  Cpu,
  Dumbbell,
  Flag,
  Flame,
  History,
  Layers,
  ListChecks,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  formatTime,
  generateSmartSchedule,
  adaptTodayBlocksToNow,
  todayStudiedMinutesByDiscipline,
  weekStudiedMinutesByDiscipline,
  type ScheduleDisciplineState,
  type SmartBlock,
} from '@/lib/smart-schedule';
import { facilityMapOf } from '@/lib/learning-signals';
import {
  useStudyProgress,
  TURNOS,
  TURNO_LABEL,
  turnoIsLearned,
  turnoOfHour,
  learnedStartForTurno,
  type SessionStart,
  type SimuladoRun,
  type StudyPreferences,
  type StudyProgressHook,
  type DayWindow,
} from '@/lib/study-progress';
import { cn } from '@/lib/utils';

// ---------- Constantes locais ----------

const FULL_DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** 18.5 → "18h30" — a hora aprendida formatada pra gente. */
function fmtLearnedHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i); // 0..23 (bloco manual)
const MANUAL_DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180];

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
  const [addOpen, setAddOpen] = React.useState(false);
  const [prefsOpen, setPrefsOpen] = React.useState(true);

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
            now,
          })
        : [],
    [prefs, sp.progress.topicProgress, discProg, sp.progress.customEvaluations, sp.progress.sessionStarts, sp.progress.pomodoroSessions, facility, weekStudied, todayStudied, now],
  );

  // Blocos manuais do usuário → SmartBlock com prefixo "manual-" no id.
  const manualBlocks = React.useMemo<SmartBlock[]>(
    () =>
      sp.progress.studyBlocks.map((b) => ({
        id: `manual-${b.id}`,
        day: b.day,
        startHour: b.startHour,
        startMinute: b.startMinute,
        durationMin: b.durationMin,
        disciplineCode: b.disciplineCode,
        title: b.title,
        activity: b.activity as SmartBlock['activity'],
        source: 'auto',
      })),
    [sp.progress.studyBlocks],
  );

  const allBlocks = React.useMemo(
    () =>
      // M13 — HOJE fala o AGORA: os blocos de hoje re-ancoram no momento do
      // acesso (a MESMA âncora da home — 1 fonte do "quando"); os blocos
      // manuais (a mão do dono) ficam na hora escolhida. A semana futura
      // mostra o ritmo APRENDIDO — e a tela só revela relógio que o uso ensinou.
      now
        ? [
            ...adaptTodayBlocksToNow(
              autoBlocks.filter((b) => b.day === now.getDay()),
              now,
            ),
            ...autoBlocks.filter((b) => b.day !== now.getDay()),
            ...manualBlocks,
          ].sort(
            (a, b) =>
              a.day - b.day ||
              a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
          )
        : [],
    [autoBlocks, manualBlocks, now],
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
  const enabledDaysCount = DAYS_OF_WEEK.filter((d) => prefs.days[d.num]?.enabled).length;

  const handleRemoveManual = React.useCallback(
    (fullId: string) => {
      sp.removeStudyBlock(fullId.replace(/^manual-/, ''));
      toast('Bloco manual removido do cronograma');
    },
    [sp],
  );

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
            Disciplinas alternadas proporcionalmente à carga horária — a mesma matéria não se
            repete todos os dias.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:shrink-0 lg:justify-end">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={prefs.rotationMode ?? 'proportional'}
            onValueChange={(v) => {
              if (!v) return;
              sp.updateStudyPreferences({
                rotationMode: v as StudyPreferences['rotationMode'],
              });
            }}
            aria-label="Modo de rotação das disciplinas"
            className="max-w-full flex-wrap"
          >
            <ToggleGroupItem
              value="proportional"
              title="Distribuição proporcional à carga horária (recomendado)"
              className="gap-1.5"
            >
              <Sparkles className="size-3 text-emerald-400" />
              Proporcional
              <span className="hidden text-[10px] font-normal text-emerald-400/70 2xl:inline">
                recomendado
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="fixed" title="Mesma fatia de tempo para todas as disciplinas">
              Igualitário
            </ToggleGroupItem>
            <ToggleGroupItem value="random" title="Proporcional com variação aleatória">
              Aleatório
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="size-3.5" /> Adicionar bloco manual
          </Button>
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
      ) : enabledDaysCount === 0 ? (
        <Card className="flex flex-col items-center gap-2 border-dashed p-8 text-center">
          <Coffee className="size-8 text-muted-foreground" />
          <p className="font-medium">Nenhum dia habilitado</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Ative pelo menos um dia nas preferências abaixo para o cronograma inteligente montar
            sua semana de estudos com rotação entre as disciplinas.
          </p>
          <Button size="sm" variant="outline" onClick={() => setPrefsOpen(true)}>
            <Settings2 className="size-3.5" /> Abrir preferências
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {DAYS_OF_WEEK.map((d, idx) => (
            <DayCard
              key={d.num}
              day={d}
              index={idx}
              now={now}
              today={today}
              starts={sp.progress.sessionStarts ?? []}
              blocks={blocksByDay.get(d.num) ?? []}
              enabled={prefs.days[d.num]?.enabled ?? false}
              fixedCode={prefs.fixedDisciplines?.[d.num]}
              doneIds={sp.progress.scheduleBlocksDone}
              onToggleDone={sp.toggleScheduleBlockDone}
              onRemoveManual={handleRemoveManual}
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

      {/* ---------- Painel de personalização ---------- */}
      <PreferencesPanel sp={sp} open={prefsOpen} onOpenChange={setPrefsOpen} />

      {/* ---------- Bloco manual ---------- */}
      <AddBlockDialog sp={sp} open={addOpen} onOpenChange={setAddOpen} />

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
  starts,
  blocks,
  enabled,
  fixedCode,
  doneIds,
  onToggleDone,
  onRemoveManual,
  runOficial,
}: {
  day: { num: number; label: string };
  index: number;
  now: Date;
  today: number;
  /** Inícios reais de sessão — a fonte da regra de exibição do relógio (M13). */
  starts: SessionStart[];
  blocks: SmartBlock[];
  enabled: boolean;
  fixedCode?: string;
  doneIds: string[];
  onToggleDone: (id: string) => void;
  onRemoveManual: (id: string) => void;
  runOficial?: SimuladoRun;
}) {
  const isToday = day.num === today;
  const totalMin = React.useMemo(() => blocks.reduce((acc, b) => acc + b.durationMin, 0), [blocks]);
  // Set p/ lookup O(1) dos blocos concluídos (evita includes O(n) por bloco).
  const doneSet = React.useMemo(() => new Set(doneIds), [doneIds]);
  const d = nextOccurrenceOfDay(day.num, now);
  const dateLabel = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`;
  const fixedDisc = fixedCode ? getDisciplineByCode(fixedCode) : undefined;

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
          !enabled && 'opacity-60',
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
            {enabled && blocks.length > 0 && (
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

        {/* Indicador de disciplina fixada */}
        {enabled && fixedDisc && (
          <p className="mb-1.5 inline-flex items-center gap-1 text-[10px] text-violet-300">
            <Pin className="size-2.5" /> {fixedDisc.shortName}
          </p>
        )}

        {!enabled ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 py-4 text-center">
            <Coffee className="size-5 text-muted-foreground/60" />
            <p className="text-sm font-medium text-muted-foreground">Descanso</p>
            <p className="text-[11px] text-muted-foreground/70">
              Dia livre — ative nas preferências
            </p>
          </div>
        ) : blocks.length === 0 ? (
          isToday ? (
            // M13 — HOJE re-ancora no agora: coluna vazia no dia = as janelas
            // já passaram (o agora despede o que não serve mais). A frase
            // não manda o dono "ajustar limites" — a semana absorve o resto.
            <div className="flex flex-1 items-center justify-center py-4 text-center text-[11px] text-muted-foreground">
              As janelas de hoje já passaram — o resto a semana absorve.
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center py-4 text-center text-[11px] text-muted-foreground">
              Sem blocos gerados — ajuste a duração do dia ou os limites.
            </div>
          )
        ) : (
          <ul className={cn('max-h-80 flex-1 space-y-1.5 overflow-y-auto pr-0.5', SCROLLBAR)}>
            {blocks.map((b) => (
              <ScheduleBlockItem
                key={b.id}
                block={b}
                done={doneSet.has(b.id)}
                isToday={isToday}
                starts={starts}
                onToggleDone={() => onToggleDone(b.id)}
                onRemove={
                  b.id.startsWith('manual-') ? () => onRemoveManual(b.id) : undefined
                }
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
  isToday,
  starts,
  onToggleDone,
  onRemove,
}: {
  block: SmartBlock;
  done: boolean;
  /** Bloco de hoje — re-ancorado no agora, o relógio é honesto por definição. */
  isToday: boolean;
  starts: SessionStart[];
  onToggleDone: () => void;
  onRemove?: () => void;
}) {
  const visual = getBlockVisual(block.disciplineCode);
  const color = getColorClasses(visual.colorName);
  const tint = DARK_TINT[visual.colorName] ?? 'bg-slate-500/10';
  const textCls = DARK_TEXT[visual.colorName] ?? 'text-slate-300';
  const isManual = block.id.startsWith('manual-');
  // M13 — O RELÓGIO SÓ APARECE QUANDO O USO O ENSINOU: hoje é ancorado no
  // agora (honesto por definição); manual é a mão do dono; dia futuro mostra
  // a hora só quando o turno do bloco já tem ≥3 inícios reais — senão, o
  // NOME do turno ("Tarde • 2h"), nunca o 08h/14h/19h que ninguém escolheu.
  const turno = turnoOfHour(Math.floor(block.startHour));
  const clockOk = isToday || isManual || turnoIsLearned(starts, turno);

  const badges: BadgeDef[] = [];
  if (block.fixed) {
    badges.push({
      cls: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
      icon: <Pin className="size-2.5" />,
      label: 'Fixado',
    });
  }
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
  if (isManual) {
    badges.push({
      cls: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
      icon: <Pencil className="size-2.5" />,
      label: 'Manual',
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
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <Clock4 className="size-3" />
          {clockOk
            ? `${formatTime(block.startHour, block.startMinute)} • ${fmtDuration(block.durationMin)}`
            : `${TURNO_LABEL[turno].toLowerCase()} • ${fmtDuration(block.durationMin)}`}
        </span>
        <div className="flex items-center gap-0.5">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remover bloco manual"
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300',
                TOUCH_AREA,
              )}
            >
              <Trash2 className="size-3" />
            </button>
          )}
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

// ---------- Painel de preferências ----------

function PreferencesPanel({
  sp,
  open,
  onOpenChange,
}: {
  sp: StudyProgressHook;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const prefs = sp.progress.studyPreferences;
  // HORÁRIOS QUE A CASA APRENDE (Task 231): mediana dos inícios REAIS por
  // turno — o dono nunca configura relógio; o site registra do check-in.
  const learnedTurnos = TURNOS.flatMap((t) => {
    const h = learnedStartForTurno(sp.progress.sessionStarts, t.id);
    return h === undefined ? [] : [{ label: t.label, h }];
  });

  return (
    <Card className="rounded-xl p-0">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 p-4 text-left"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Settings2 className="size-4 text-emerald-400" />
              Preferências do cronograma
            </span>
            <ChevronDown
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            {/* O RITMO SEM ORGULHO DE RELÓGIO (pedido do dono: "menos
                específicas… não algo setado e certo"): o painel não anuncia
                horário nenhum — você marca QUAIS dias e turnos existem, a
                casa aprende QUANDO você senta e refaz a semana com o estudo
                real, sem repetir matéria no mesmo dia. */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Clock4 className="size-4 text-emerald-400" aria-hidden />
                    Ritmo semanal
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Marque só quais dias e turnos existem — nada de relógio. Quando você senta, a casa registra a
                    hora real, soma as sessões e refaz a semana com o que você estudou de verdade, sem repetir
                    matéria no mesmo dia.
                  </p>
                  <p className="mt-1 text-xs text-foreground/80">
                    {learnedTurnos.length > 0
                      ? `Registrado do seu ritmo real: ${learnedTurnos
                          .map((x) => `${x.label.toLowerCase()} ~${fmtLearnedHour(x.h)}`)
                          .join(' · ')}. Continua se ajustando a cada sessão.`
                      : 'Conforme você estuda, o site registra seus horários reais e encaixa os blocos no seu momento — nada de relógio para configurar.'}
                  </p>
                </div>
                <Button
                  size="sm"
                  data-t="ritmo-aplicar"
                  onClick={() => {
                    sp.applyStudyRhythm();
                    toast.success('Ritmo aplicado — os dias nascem com as janelas padrão; os horários a casa aprende do seu uso.');
                  }}
                >
                  <Check className="size-4" aria-hidden />
                  Aplicar em todos os dias
                </Button>
              </div>
            </div>
            {/* Por dia — Task 231: chips de turno SEM relógio. O dono escolhe
                QUAIS turnos tem aula de estudo; QUANDO começa cada um, a casa
                aprende sozinha dos inícios reais (mediana por turno). */}
            <div className={cn('max-h-96 space-y-2 overflow-y-auto pr-1', SCROLLBAR)}>
              {DAYS_OF_WEEK.map((d) => {
                const day =
                  prefs.days[d.num] ?? { enabled: false, startHour: 19, durationMin: 0 };
                const windows = Array.isArray(day.windows) ? day.windows : [];
                const fixedCode = prefs.fixedDisciplines?.[d.num] ?? '';
                return (
                  <div
                    key={d.num}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card/60 p-2.5',
                      !day.enabled && 'opacity-60',
                    )}
                  >
                    <div className="flex w-24 shrink-0 items-center gap-2">
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(v) =>
                          // Ao ativar um dia sem duração definida, sugere 2h.
                          sp.updateDayAvailability(
                            d.num,
                            v ? { enabled: true, durationMin: day.durationMin || 120 } : { enabled: false },
                          )
                        }
                        aria-label={`Ativar estudos ${FULL_DAYS[d.num]}`}
                      />
                      <span className="text-sm font-medium">{FULL_DAYS[d.num]}</span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <Label className="text-[11px] text-muted-foreground">Turnos</Label>
                      {TURNOS.map((t) => {
                        const w = windows.find((x) => x.turno === t.id);
                        const toggle = () => {
                          const next: DayWindow[] = w
                            ? windows.filter((x) => x.turno !== t.id)
                            : [...windows, { turno: t.id, startHour: t.defaultStart, durationMin: 120 }];
                          next.sort((a, b) => a.startHour - b.startHour);
                          const total = next.reduce((acc, x) => acc + x.durationMin, 0);
                          sp.updateDayAvailability(d.num, {
                            windows: next,
                            durationMin: total,
                            ...(next.length > 0 ? { enabled: true } : {}),
                          });
                        };
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={toggle}
                            aria-pressed={!!w}
                            aria-label={`${w ? 'Remover' : 'Adicionar'} turno da ${t.label.toLowerCase()} ${FULL_DAYS[d.num].toLowerCase()}`}
                            data-t={`turno-${t.id}-${d.num}`}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              w
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'border-border text-muted-foreground hover:bg-muted/60',
                            )}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {windows.length > 0
                          ? `${fmtDuration(windows.reduce((acc, x) => acc + x.durationMin, 0))} no dia`
                          : 'sem estudo'}
                      </span>
                    </div>

                    <div className="flex min-w-44 flex-1 items-center gap-1.5">
                      <Label className="text-[11px] text-muted-foreground">Fixar</Label>
                      <Select
                        value={fixedCode || 'none'}
                        onValueChange={(v) =>
                          sp.updateFixedDiscipline(d.num, v === 'none' ? '' : v)
                        }
                      >
                        <SelectTrigger
                          className="h-11 sm:h-8"
                          aria-label={`Disciplina fixada em ${FULL_DAYS[d.num]}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {disciplines.map((disc) => (
                            <SelectItem key={disc.code} value={disc.code}>
                              {disc.shortName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dica — Task 231: os tetos globais saíram da superfície (os turnos
                mandam no dia e o motor guarda os padrões internos). */}
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Fixe uma disciplina num dia (ex.: Seg = Matemática) e o resto da semana continua
              rotacionando. Avaliações em ≤7 dias ganham prioridade automática.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ---------- Dialog de bloco manual ----------

function AddBlockDialog({
  sp,
  open,
  onOpenChange,
}: {
  sp: StudyProgressHook;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [day, setDay] = React.useState('1');
  const [startHour, setStartHour] = React.useState('19');
  const [startMinute, setStartMinute] = React.useState('0');
  const [duration, setDuration] = React.useState('60');
  const [discipline, setDiscipline] = React.useState(disciplines[0]?.code ?? 'revisao');
  const [title, setTitle] = React.useState('');

  function submit() {
    sp.addStudyBlock({
      day: Number(day),
      startHour: Number(startHour),
      startMinute: Number(startMinute),
      durationMin: Number(duration),
      disciplineCode: discipline,
      activity: 'estudo',
      title: title.trim() || 'Bloco manual de estudo',
    });
    toast.success('Bloco manual adicionado ao cronograma');
    setTitle('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar bloco manual</DialogTitle>
          <DialogDescription>
            Encaixe um estudo extra na semana. Ele aparece no grid com o selo &quot;Manual&quot; e
            pode ser removido quando quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Dia</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="h-11 sm:h-9" aria-label="Dia da semana do bloco">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((d) => (
                  <SelectItem key={d.num} value={String(d.num)}>
                    {FULL_DAYS[d.num]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Disciplina</Label>
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger className="h-11 sm:h-9" aria-label="Disciplina do bloco">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revisao">Revisão geral</SelectItem>
                <SelectItem value="pnaat">PNAAT</SelectItem>
                {disciplines.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Hora início</Label>
            <Select value={startHour} onValueChange={setStartHour}>
              <SelectTrigger className="h-11 sm:h-9" aria-label="Hora de início do bloco">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS_24.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}h
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Minuto</Label>
            <Select value={startMinute} onValueChange={setStartMinute}>
              <SelectTrigger className="h-11 sm:h-9" aria-label="Minuto de início do bloco">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['0', '15', '30', '45'].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Duração</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-11 sm:h-9" aria-label="Duração do bloco">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_DURATIONS.map((min) => (
                  <SelectItem key={min} value={String(min)}>
                    {fmtDuration(min)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Resolver lista de derivadas"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="size-3.5" /> Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
