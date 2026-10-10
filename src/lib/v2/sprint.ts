// SPRINT REVIEW — agregação semanal (segunda → domingo). Puro.
// A semana do dono fecha no domingo 20:30 (bloco sprint-review da rotina).

import type {
  Attempt,
  BacklogItem,
  Exam,
  PracticeUnit,
  Quest,
  StudySession,
  Subject,
} from './domain';
import { mondayKeyOf, dateKeyOf } from './planner';
import { accuracyOf, minutesByDate, totalXp } from './xp';

export interface DayBar {
  dateKey: string;
  label: string; // 'seg', 'ter'…
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
}

const DOW_LABEL = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export interface SprintWeek {
  mondayKey: string;
  days: DayBar[];
  totalMinutes: number;
  totalXp: number;
  sessionsCount: number;
  attempts: { correct: number; wrong: number; tried: number; acc: number };
  bySubject: {
    subjectId: string;
    shortName: string;
    minutes: number;
    correct: number;
    tried: number;
    acc: number;
  }[];
  errorsOpened: number;
  backlogConverted: number;
  questsDone: number;
  nextExam: { name: string; date: string; daysUntil: number } | null;
}

export function buildSprintWeek(
  subjects: Subject[],
  units: PracticeUnit[],
  sessions: StudySession[],
  attempts: Attempt[],
  backlog: BacklogItem[],
  quests: Quest[],
  exams: Exam[],
  opts?: { now?: number; seedAt?: number | null },
): SprintWeek {
  const now = opts?.now ?? Date.now();
  // conversões nascidas na SEMENTE da migração não são conversões da semana
  const seedAt = opts?.seedAt ?? null;
  const todayKey = dateKeyOf(new Date(now));
  const mondayKey = mondayKeyOf(new Date(now));

  // dias seg→dom
  const days: DayBar[] = [];
  const mins = minutesByDate(sessions);
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${mondayKey}T00:00:00`);
    d.setDate(d.getDate() + i);
    const key = dateKeyOf(d);
    days.push({
      dateKey: key,
      label: DOW_LABEL[d.getDay()],
      minutes: mins.get(key) ?? 0,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    });
  }

  const weekStart = new Date(`${mondayKey}T00:00:00`).getTime();
  const weekEnd = weekStart + 7 * 86_400_000;

  const weekSessions = sessions.filter((s) => s.startedAt >= weekStart && s.startedAt < weekEnd);
  const weekAttempts = attempts.filter((a) => a.at >= weekStart && a.at < weekEnd);
  const acc = accuracyOf(weekAttempts);

  // tentativa → unidade → matéria
  const unitSubject = new Map<string, string>();
  for (const u of units) unitSubject.set(u.id, u.subjectId);

  const bySubject = subjects
    .map((s) => {
      const minutes = weekSessions
        .filter((x) => (x.disciplineId || '') === s.id)
        .reduce((a, x) => a + x.focusMinutes, 0);
      const sub = accuracyOf(
        weekAttempts.filter((a) => unitSubject.get(a.unitId) === s.id),
      );
      return {
        subjectId: s.id,
        shortName: s.shortName,
        minutes,
        correct: sub.correct,
        tried: sub.tried,
        acc: sub.acc,
      };
    })
    .sort((x, y) => y.minutes - x.minutes || y.tried - x.tried);

  const errorsOpened = weekAttempts.filter((a) => a.result === 'wrong').length;
  const backlogConverted = backlog.filter(
    (b) =>
      b.status === 'converted' &&
      b.createdAt >= weekStart &&
      b.createdAt < weekEnd &&
      (seedAt === null || b.createdAt > seedAt),
  ).length;
  const questsDone = quests.filter(
    (q) => q.doneAt && q.doneAt >= weekStart && q.doneAt < weekEnd,
  ).length;

  let nextExam: SprintWeek['nextExam'] = null;
  for (const e of exams) {
    if (e.status === 'registered') continue;
    const days = Math.round(
      (new Date(`${e.date}T00:00:00`).getTime() - new Date(`${todayKey}T00:00:00`).getTime()) /
        86_400_000,
    );
    if (days >= 0 && (!nextExam || days < nextExam.daysUntil)) {
      nextExam = { name: e.name, date: e.date, daysUntil: days };
    }
  }

  return {
    mondayKey,
    days,
    totalMinutes: days.reduce((a, d) => a + d.minutes, 0),
    totalXp: totalXp(weekSessions, weekAttempts),
    sessionsCount: weekSessions.length,
    attempts: {
      correct: acc.correct,
      wrong: acc.tried - acc.correct,
      tried: acc.tried,
      acc: acc.acc,
    },
    bySubject,
    errorsOpened,
    backlogConverted,
    questsDone,
    nextExam,
  };
}
