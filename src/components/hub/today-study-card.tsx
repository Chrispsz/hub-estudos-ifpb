'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  CalendarCheck,
  Clock4,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { todayDayOfWeek, getDayLabel } from './clock-widget';
import {
  generateSmartSchedule,
  getDaySummary,
  formatTime,
} from '@/lib/smart-schedule';
import { getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';

/** Blocos especiais do cronograma que não pertencem a uma disciplina. */
const SPECIAL_BLOCK_CODES = new Set(['revisao', 'descanso']);

interface Props {
  onStartStudy?: (disciplineCode?: string, materialId?: string) => void;
  onOpenSettings?: () => void;
}

function formatHours(min: number): string {
  if (min <= 0) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function TodayStudyCard({ onStartStudy, onOpenSettings }: Props) {
  const sp = useStudyProgress();
  const [today, setToday] = React.useState<number>(1); // default Seg (evita hydration mismatch)
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setToday(todayDayOfWeek());
    setMounted(true);
  }, []);

  // Gera blocos automáticos (cronograma rotativo v2.0)
  const autoBlocks = React.useMemo(
    () =>
      generateSmartSchedule({
        preferences: sp.progress.studyPreferences,
        topicProgress: sp.progress.topicProgress,
        disciplineProgress: sp.progress.disciplineProgress,
      }),
    [sp.progress.studyPreferences, sp.progress.topicProgress, sp.progress.disciplineProgress],
  );

  const todaySummary = React.useMemo(
    () => getDaySummary(autoBlocks, today, sp.progress.scheduleBlocksDone),
    [autoBlocks, today, sp.progress.scheduleBlocksDone],
  );

  const dayPref = sp.progress.studyPreferences.days[today];
  const isDayOff = !dayPref?.enabled || todaySummary.total === 0;

  // Primeiro bloco pendente (sugestão de estudo)
  const firstPendingBlock = todaySummary.pending[0];
  const firstDisc = firstPendingBlock
    ? getDisciplineByCode(firstPendingBlock.disciplineCode)
    : null;

  // Blocos de hoje (evita refiltrar o cronograma a cada render)
  const todayBlocks = React.useMemo(
    () => autoBlocks.filter((b) => b.day === today),
    [autoBlocks, today],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden rounded-2xl border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-card to-teal-50 p-5 shadow-sm sm:p-6 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/40">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <CalendarCheck className="size-3.5" /> O que estudar hoje
            </p>
            <h3 className="mt-1 text-lg font-semibold sm:text-xl">
              {mounted ? getDayLabel(today) : '—'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
              {todaySummary.done}/{todaySummary.total} blocos
            </Badge>
            {onOpenSettings && (
              <Button size="sm" variant="ghost" onClick={onOpenSettings} className="h-8 text-xs">
                <Settings2 className="size-3.5" /> Horários
              </Button>
            )}
          </div>
        </div>

        {isDayOff ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Dia de descanso! Use para revisar ou adiantar conteúdo. 🌱
            </p>
            {onStartStudy && (
              <Button
                onClick={() => onStartStudy()}
                variant="outline"
                className="bg-card text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
              >
                <Play className="size-3.5" /> Estudar algo livre
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Botão grande: Iniciar estudo de hoje */}
            {firstPendingBlock && onStartStudy && (
              <Button
                onClick={() => onStartStudy(firstDisc?.code, undefined)}
                size="lg"
                className={cn(
                  'mb-3 h-12 w-full text-base font-semibold shadow-md',
                  'bg-emerald-600 text-white hover:bg-emerald-700',
                )}
              >
                <Play className="size-4" /> Iniciar estudo de hoje
                {firstDisc && (
                  <span className="ml-1 text-emerald-50">• {firstDisc.shortName}</span>
                )}
              </Button>
            )}

            {/* Progresso do dia */}
            <div className="mb-3 rounded-md border border-emerald-200 bg-card/70 p-3 dark:border-emerald-900/70">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-emerald-800 dark:text-emerald-300">Progresso do dia</span>
                <span className="text-muted-foreground">
                  {formatHours(todaySummary.minutesDone)} de {formatHours(todaySummary.minutes)} estudadas
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${todaySummary.total > 0 ? Math.round((todaySummary.done / todaySummary.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Lista de blocos do dia (compacta) */}
            <ul className="grid gap-2 sm:grid-cols-2">
              {todayBlocks.slice(0, 4).map((b) => {
                const isSpecial = SPECIAL_BLOCK_CODES.has(b.disciplineCode);
                const disc = isSpecial ? null : getDisciplineByCode(b.disciplineCode);
                const color = getColorClasses(disc?.color ?? 'slate');
                const done = sp.progress.scheduleBlocksDone.includes(b.id);
                return (
                  <li
                    key={b.id}
                    className={cn(
                      'rounded-md border-l-4 p-2',
                      color.border,
                      color.bgSoft,
                      done && 'opacity-60',
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-1 font-mono font-medium">
                        <Clock4 className="size-3" />
                        {formatTime(b.startHour, b.startMinute)}
                      </span>
                      {done && <Sparkles className="size-3 text-emerald-600" />}
                    </div>
                    <p className={cn('mt-0.5 text-xs font-semibold', color.text)}>
                      {disc?.shortName ?? (b.isReview ? 'Revisão' : '—')}
                    </p>
                    <p className="text-[10px] leading-snug text-foreground/70 line-clamp-1">{b.title}</p>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {todaySummary.total - todaySummary.done} bloco(s) pendente(s) •
                {' '}{todaySummary.minutes - todaySummary.minutesDone} min restantes
              </span>
              {todaySummary.done > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <RotateCcw className="size-3" /> Continue assim!
                </span>
              )}
            </div>
          </>
        )}

        {!mounted && (
          <p className="mt-2 text-[11px] text-muted-foreground">Carregando horários...</p>
        )}
      </Card>
    </motion.div>
  );
}
