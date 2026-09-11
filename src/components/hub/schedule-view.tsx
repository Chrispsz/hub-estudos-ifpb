'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock4,
  Coffee,
  Cpu,
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
import { disciplines, getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { DisciplineIcon } from '@/lib/discipline-icons';
import {
  DAYS_OF_WEEK,
  currentWeekOfSemester,
  formatTime,
  generateSmartSchedule,
  type ScheduleDisciplineState,
  type SmartBlock,
} from '@/lib/smart-schedule';
import { useStudyProgress, type StudyPreferences, type StudyProgressHook } from '@/lib/study-progress';
import { cn } from '@/lib/utils';

// ---------- Constantes locais ----------

const FULL_DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const START_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i); // 0..23 (bloco manual)
const DAY_DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];
const MANUAL_DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180];
const MAX_MINUTES_OPTIONS = [60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];

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
    for (const [code, v] of Object.entries(sp.progress.disciplineProgress)) {
      out[code] = { studiedMinutes: v.studiedMinutes, lastStudiedAt: v.lastStudiedAt };
    }
    return out;
  }, [sp.progress.disciplineProgress]);

  // Cronograma rotativo (puro) — regenerado só quando preferências/progresso/data mudam.
  const autoBlocks = React.useMemo(
    () =>
      now
        ? generateSmartSchedule({
            preferences: prefs,
            topicProgress: sp.progress.topicProgress,
            disciplineProgress: discProg,
            now,
          })
        : [],
    [prefs, sp.progress.topicProgress, discProg, now],
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
      [...autoBlocks, ...manualBlocks].sort(
        (a, b) =>
          a.day - b.day ||
          a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
      ),
    [autoBlocks, manualBlocks],
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
              blocks={blocksByDay.get(d.num) ?? []}
              enabled={prefs.days[d.num]?.enabled ?? false}
              fixedCode={prefs.fixedDisciplines?.[d.num]}
              doneIds={sp.progress.scheduleBlocksDone}
              onToggleDone={sp.toggleScheduleBlockDone}
              onRemoveManual={handleRemoveManual}
            />
          ))}
        </div>
      )}

      {/* ---------- Painel de personalização ---------- */}
      <PreferencesPanel sp={sp} open={prefsOpen} onOpenChange={setPrefsOpen} />

      {/* ---------- Bloco manual ---------- */}
      <AddBlockDialog sp={sp} open={addOpen} onOpenChange={setAddOpen} />
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
  enabled,
  fixedCode,
  doneIds,
  onToggleDone,
  onRemoveManual,
}: {
  day: { num: number; label: string };
  index: number;
  now: Date;
  today: number;
  blocks: SmartBlock[];
  enabled: boolean;
  fixedCode?: string;
  doneIds: string[];
  onToggleDone: (id: string) => void;
  onRemoveManual: (id: string) => void;
}) {
  const isToday = day.num === today;
  const totalMin = React.useMemo(() => blocks.reduce((acc, b) => acc + b.durationMin, 0), [blocks]);
  // Set p/ lookup O(1) dos blocos concluídos (evita includes O(n) por bloco).
  const doneSet = React.useMemo(() => new Set(doneIds), [doneIds]);
  const d = nextOccurrenceOfDay(day.num, now);
  const dateLabel = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`;
  const fixedDisc = fixedCode ? getDisciplineByCode(fixedCode) : undefined;

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
          <p className="truncate text-[10px] capitalize text-muted-foreground">
            {dateLabel}
            {enabled && blocks.length > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {' '}
                • {fmtDuration(totalMin)}
              </span>
            )}
          </p>
        </div>

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
          <div className="flex flex-1 items-center justify-center py-4 text-center text-[11px] text-muted-foreground">
            Sem blocos gerados — ajuste a duração do dia ou os limites.
          </div>
        ) : (
          <ul className={cn('max-h-80 flex-1 space-y-1.5 overflow-y-auto pr-0.5', SCROLLBAR)}>
            {blocks.map((b) => (
              <ScheduleBlockItem
                key={b.id}
                block={b}
                done={doneSet.has(b.id)}
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
  onRemove,
}: {
  block: SmartBlock;
  done: boolean;
  onToggleDone: () => void;
  onRemove?: () => void;
}) {
  const visual = getBlockVisual(block.disciplineCode);
  const color = getColorClasses(visual.colorName);
  const tint = DARK_TINT[visual.colorName] ?? 'bg-slate-500/10';
  const textCls = DARK_TEXT[visual.colorName] ?? 'text-slate-300';
  const isManual = block.id.startsWith('manual-');

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
          {formatTime(block.startHour, block.startMinute)} • {fmtDuration(block.durationMin)}
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
            {/* Por dia */}
            <div className={cn('max-h-96 space-y-2 overflow-y-auto pr-1', SCROLLBAR)}>
              {DAYS_OF_WEEK.map((d) => {
                const day =
                  prefs.days[d.num] ?? { enabled: false, startHour: 19, durationMin: 0 };
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

                    <div className="flex items-center gap-1.5">
                      <Label className="text-[11px] text-muted-foreground">Início</Label>
                      <Select
                        value={String(day.startHour)}
                        onValueChange={(v) =>
                          sp.updateDayAvailability(d.num, { startHour: Number(v) })
                        }
                      >
                        <SelectTrigger
                          className="h-11 w-[74px] sm:h-8"
                          aria-label={`Hora de início de ${FULL_DAYS[d.num]}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {START_HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, '0')}h
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Label className="text-[11px] text-muted-foreground">Duração</Label>
                      <Select
                        value={String(day.durationMin)}
                        onValueChange={(v) =>
                          sp.updateDayAvailability(d.num, { durationMin: Number(v) })
                        }
                      >
                        <SelectTrigger
                          className="h-11 w-24 sm:h-8"
                          aria-label={`Duração de ${FULL_DAYS[d.num]}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_DURATIONS.map((min) => (
                            <SelectItem key={min} value={String(min)}>
                              {fmtDuration(min)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          <SelectItem value="none">Nenhum (rotação livre)</SelectItem>
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

            {/* Limites globais + dica */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Máx. blocos/dia</Label>
                <Select
                  value={String(prefs.maxBlocksPerDay)}
                  onValueChange={(v) => sp.updateStudyPreferences({ maxBlocksPerDay: Number(v) })}
                >
                  <SelectTrigger className="h-11 w-16 sm:h-8" aria-label="Máximo de blocos por dia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Máx. minutos/dia</Label>
                <Select
                  value={String(prefs.maxMinutesPerDay)}
                  onValueChange={(v) => sp.updateStudyPreferences({ maxMinutesPerDay: Number(v) })}
                >
                  <SelectTrigger className="h-11 w-24 sm:h-8" aria-label="Máximo de minutos por dia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAX_MINUTES_OPTIONS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {fmtDuration(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="w-full text-xs text-muted-foreground">
                Fixe uma disciplina num dia (ex.: Seg = Matemática) e o resto da semana continua
                rotacionando. Avaliações em ≤7 dias ganham prioridade automática.
              </p>
            </div>
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
      <DialogContent className="max-w-md">
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
