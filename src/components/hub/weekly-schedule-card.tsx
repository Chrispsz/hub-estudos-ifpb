'use client';

import * as React from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  weeklySchedule,
  nextClassFrom,
  slotTimeOf,
  getDisciplineByCode,
  type WeeklyClassDay,
  type WeeklyClassSlot,
} from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';

// WeeklyScheduleCard — A GRADE OFICIAL DE AULAS no dashboard (Task 216,
// pedido do dono: "você não puxou os horários? horarios.ifpb.edu.br/cajazeiras
// nesse site tem perfeitamente de todos os períodos").
//
// A casa agora sabe QUANDO cada aula acontece: a semana real da turma
// (P1 ADS, manhã, salas oficiais), HOJE destacado, a PRÓXIMA AULA apontada —
// e é daqui que saem datas como a da atividade escrita da RHT (quarta,
// M3–M5, S19), anunciada "para a próxima aula".
//
// Render-time puro (lição do radar): o relógio só existe depois do mount —
// SSR e 1º render dividem o neutro, nada de hidratação brigando.

interface MergedBlock {
  start: string;
  end: string;
  label: string;
  room: string;
  color: string;
  short: string;
  slots: string[];
  isNext: boolean;
}

/** Mescla slots consecutivos da mesma disciplina num bloco (ex.: RHT M3–M5). */
function dayBlocks(day: WeeklyClassDay, now: Date): MergedBlock[] {
  const next = nextClassFrom(now);
  const blocks: MergedBlock[] = [];
  for (const s of day.slots) {
    const t = slotTimeOf(s.slot);
    if (!t) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.label === s.label && last.room === s.room) {
      last.end = t.end;
      last.slots.push(s.slot);
    } else {
      const disc = s.disciplineCode ? getDisciplineByCode(s.disciplineCode) : undefined;
      blocks.push({
        start: t.start,
        end: t.end,
        label: s.label,
        room: s.room,
        color: disc?.color ?? 'slate',
        short: disc?.shortName ?? s.label,
        slots: [s.slot],
        isNext: false,
      });
    }
  }
  // A próxima aula ganha a marcação (só existe se for desta coluna).
  if (next) {
    const b = blocks.find((x) => x.label === next.label && x.start === next.slot.start);
    if (b) b.isNext = true;
  }
  return blocks;
}

export function WeeklyScheduleCard() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);

  if (!now) return null;

  const todayDow = now.getDay();
  const next = nextClassFrom(now);

  const quando = next
    ? next.daysLeft === 0
      ? 'hoje'
      : next.daysLeft === 1
        ? 'amanhã'
        : `${next.dowLabel} ${String(next.at.getDate()).padStart(2, '0')}/${String(next.at.getMonth() + 1).padStart(2, '0')}`
    : null;

  return (
    <Card className="rounded-2xl p-5 sm:p-6" data-t="grade-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          Grade de aulas
        </h2>
        <span className="text-xs text-muted-foreground" data-t="grade-turma">
          {weeklySchedule.turma} · {weeklySchedule.turno} · 2026.2
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        A semana real do campus — quando cada aula acontece, com sala oficial.
      </p>

      {next && quando && (
        <p
          className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          data-t="proxima-aula"
        >
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span>
            Próxima aula: <strong className="font-semibold">{quando}</strong>,{' '}
            {next.label} às {next.slot.start}{' '}
            <span className="inline-flex items-center gap-0.5 text-amber-700/80 dark:text-amber-300/80">
              <MapPin className="size-3" aria-hidden /> {next.room}
            </span>
          </span>
        </p>
      )}

      <div className="mt-4 overflow-x-auto pb-1" data-t="grade-semana">
        <div className="grid min-w-[660px] grid-cols-5 gap-2">
          {weeklySchedule.dias.map((day) => {
            const isToday = day.dow === todayDow;
            const blocks = dayBlocks(day, now);
            const labelCurto = day.label.slice(0, 3);
            return (
              <div
                key={day.dow}
                className={cn(
                  'rounded-xl p-2',
                  isToday
                    ? 'bg-amber-50 ring-1 ring-amber-500/40 dark:bg-amber-500/10 dark:ring-amber-500/30'
                    : 'bg-muted/40',
                )}
                data-t={isToday ? 'grade-hoje' : undefined}
              >
                <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5">
                  <span
                    className={cn(
                      'text-xs font-semibold capitalize',
                      isToday ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
                    )}
                  >
                    {labelCurto}
                  </span>
                  {isToday ? (
                    <span className="rounded-full bg-amber-500 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">
                      hoje
                    </span>
                  ) : (
                    <span className="size-0" />
                  )}
                </div>
                <div className="space-y-1.5">
                  {blocks.map((b, i) => {
                    const c = getColorClasses(b.color);
                    return (
                      <div
                        key={`${b.label}-${b.start}`}
                        className={cn(
                          'rounded-lg border-l-2 px-1.5 py-1',
                          c.border,
                          c.bgSoft,
                          b.isNext &&
                            'ring-1 ring-amber-500/60 dark:ring-amber-400/50',
                        )}
                        data-t={b.isNext ? 'aula-proxima' : undefined}
                      >
                        <p
                          className={cn(
                            'truncate text-[11px] font-semibold leading-tight',
                            c.text,
                          )}
                          title={`${b.label} · ${b.start}–${b.end} · ${b.room}`}
                        >
                          {b.label}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
                          <span className="tabular-nums">
                            {b.start}–{b.end}
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="size-2.5 shrink-0" aria-hidden />
                            {b.room}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                  {blocks.length === 0 && (
                    <p className="px-0.5 py-2 text-[11px] text-muted-foreground/60">
                      sem aula
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground/80">
        Fonte:{' '}
        <a
          href={`https://${weeklySchedule.fonte}/`}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {weeklySchedule.fonte}
        </a>{' '}
        · conferida em {weeklySchedule.conferidaEm.split('-').reverse().join('/')} · intervalo{' '}
        {weeklySchedule.intervalo}
      </p>
    </Card>
  );
}
