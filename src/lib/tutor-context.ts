// Contexto real do Hub enviado ao tutor IA a cada pergunta.
// Centralizado aqui para que QUALQUER superfície do app (aba Estudar,
// diálogo de PDF, futuros painéis) envie exatamente os mesmos dados
// e o tutor responda sempre com precisão sobre professor, datas e progresso.

import {
  evaluationPeriods,
  getDisciplineByCode,
  materials as allMaterials,
} from '@/data/course-data';
import {
  currentWeekOfSemester,
  daysUntilDate,
  TOTAL_TEACHING_WEEKS,
  upcomingEvents,
} from '@/lib/semester';
import type { useStudyProgress } from '@/lib/study-progress';
import { getDisciplineTopics } from '@/lib/study-topics';
import { getExerciseStats } from '@/lib/exercise-extractor';

/** Dados do app que o front envia ao /api/tutor (contrato do route.ts). */
export interface HubEvaluation {
  name: string;
  discipline: string;
  date?: string;
  week?: number;
  daysLeft: number;
  description?: string;
}

export interface HubEvent {
  name: string;
  date: string;
  daysLeft: number;
}

export interface HubStudentStats {
  materialsDone: number;
  materialsTotal: number;
  topicsDone: number;
  topicsTotal: number;
  pomodoroMinutes: number;
  flashcardsDue: number;
  exercisesSolved: number;
  exercisesTotal: number;
}

export interface HubContext {
  today?: string;
  week?: number;
  totalWeeks?: number;
  professor?: string;
  professorTitle?: string;
  hours?: number;
  nextEvaluations?: HubEvaluation[];
  upcomingEvents?: HubEvent[];
  studentStats?: HubStudentStats;
}

type StudyProgressReturn = ReturnType<typeof useStudyProgress>;

/** Monta o contexto completo do Hub — datas, professor, agenda e progresso do aluno. */
export function buildHubContext(
  disciplineCode: string,
  sp: StudyProgressReturn,
): HubContext {
  const disc = getDisciplineByCode(disciplineCode);
  const week = currentWeekOfSemester();
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // POLÍTICA ANTI-ESTIMATIVA: o tutor só recebe avaliações com DATA OFICIAL.
  // Sem data = o tutor deve dizer que a data ainda não foi divulgada.
  const nextEvaluations = [...evaluationPeriods]
    .filter((e) => !e.conditional && e.date)
    .map((e) => {
      const dName = getDisciplineByCode(e.disciplineCode)?.shortName ?? e.disciplineCode;
      const daysLeft = daysUntilDate(e.date as string);
      const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
        new Date(`${e.date}T12:00:00`),
      );
      return {
        name: e.evaluationName,
        discipline: dName,
        date,
        daysLeft: Number.isFinite(daysLeft) ? daysLeft : 999,
        description: e.description,
      };
    })
    .filter((e) => e.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3);

  const events = upcomingEvents(new Date(), 3).map((e) => ({
    name: e.title,
    date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
      new Date(`${e.date}T12:00:00`),
    ),
    daysLeft: e.daysLeft,
  }));

  const topics = getDisciplineTopics(disciplineCode, sp.progress.topicProgress);

  return {
    today,
    week,
    totalWeeks: TOTAL_TEACHING_WEEKS,
    professor: disc?.professor,
    professorTitle: disc?.professorTitle,
    hours: disc?.chTotal,
    nextEvaluations,
    upcomingEvents: events,
    studentStats: {
      materialsDone: sp.progress.completedMaterials.length,
      materialsTotal: allMaterials.length,
      topicsDone: topics?.doneTopics ?? 0,
      topicsTotal: topics?.totalTopics ?? 0,
      pomodoroMinutes: sp.progress.pomodoroSessions.reduce((acc, s) => acc + s.focusMinutes, 0),
      flashcardsDue: sp.flashcardStats.due,
      exercisesSolved: sp.totalExercisesSolved,
      exercisesTotal: getExerciseStats().total,
    },
  };
}
