'use client';

// SPRINT REVIEW — a semana fecha no domingo 20:30 (bloco da rotina).
// Minutos por dia, acerto real por matéria, erros abertos, backlog convertido,
// issues fechadas e a próxima prova no radar.

import * as React from 'react';
import { useAttempts, useBacklog, useExams, useMetaValue, useQuests, useSessions, useSubjects, useUnits } from '@/lib/v2/use-v2';
import { buildSprintWeek } from '@/lib/v2/sprint';
import { Chip, Empty, PageHead, Stat } from './ui';

export function TabSprint() {
  const subjects = useSubjects();
  const units = useUnits();
  const sessions = useSessions();
  const attempts = useAttempts();
  const backlog = useBacklog();
  const quests = useQuests();
  const exams = useExams();
  const seedAtRaw = useMetaValue('migration:lastRunAt');
  const seedAt = seedAtRaw ? Date.parse(seedAtRaw) : null;

  // computação direta — o Compiler do React prefere memória automática aqui
  const week = buildSprintWeek(subjects, units, sessions, attempts, backlog, quests, exams, {
    seedAt,
  });

  const maxMin = Math.max(60, ...week.days.map((d) => d.minutes));

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Sprint Review"
        title={`Semana de ${week.mondayKey}`}
        desc="Segunda → domingo. O domingo às 20:30 o plano se reorganiza olhando estes números — não a sensação."
        right={
          <>
            <Chip tone="emerald">{Math.round(week.totalMinutes / 60)}h estudadas</Chip>
            <Chip tone="violet">+{week.totalXp} XP</Chip>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="sessões" value={week.sessionsCount} hint="commits da semana" />
        <Stat
          label="acerto real"
          value={week.attempts.tried ? `${Math.round(week.attempts.acc * 100)}%` : '—'}
          hint={`${week.attempts.correct}/${week.attempts.tried} sem consulta`}
        />
        <Stat label="erros abertos" value={week.errorsOpened} hint="entram no code review" />
        <Stat label="conversões" value={week.backlogConverted} hint="backlog → prática" />
      </div>

      {/* barras por dia */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          minutos por dia (piso 60)
        </p>
        <div className="flex h-28 items-end gap-1.5 sm:gap-2">
          {week.days.map((d) => (
            <div key={d.dateKey} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="font-mono text-[9px] tabular-nums text-zinc-500">{d.minutes || ''}</span>
              <div
                className={`w-full rounded-t ${
                  d.isFuture
                    ? 'bg-zinc-800/40'
                    : d.minutes >= 60
                      ? 'bg-emerald-500'
                      : d.minutes > 0
                        ? 'bg-amber-500/70'
                        : 'bg-zinc-800'
                }`}
                style={{ height: `${d.isFuture ? 4 : Math.max(3, (100 * d.minutes) / maxMin)}%` }}
                title={`${d.dateKey}: ${d.minutes} min`}
              />
              <span className={`font-mono text-[10px] ${d.isToday ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* por matéria */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">por matéria</p>
        {week.bySubject.every((s) => s.minutes === 0 && s.tried === 0) ? (
          <Empty>semana virgem ainda — o primeiro commit de estudo preenche</Empty>
        ) : (
          <div className="space-y-1.5">
            {week.bySubject.map((s) => (
              <div key={s.subjectId} className="flex flex-wrap items-center gap-2">
                <span className="w-24 truncate font-mono text-[11px] text-zinc-300">{s.shortName}</span>
                <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-violet-500"
                    style={{ width: `${Math.min(100, (100 * s.minutes) / Math.max(60, week.totalMinutes))}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] tabular-nums text-zinc-500">{s.minutes}min</span>
                <span className="w-14 text-right font-mono text-[10px] tabular-nums text-zinc-400">
                  {s.tried ? `${Math.round(s.acc * 100)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <p className="font-mono text-[11px] text-zinc-400">
          issues fechadas: <span className="text-zinc-100">{week.questsDone}</span>
        </p>
        {week.nextExam && (
          <Chip tone={week.nextExam.daysUntil <= 7 ? 'rose' : 'amber'}>
            próxima prova: {week.nextExam.name} · {week.nextExam.daysUntil}d
          </Chip>
        )}
      </div>
    </div>
  );
}
