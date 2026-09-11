// Helper para tópicos de disciplina + progresso (V3)
// Cria checkboxes inteligentes a partir do conteúdo programático.

import { disciplines, type Discipline } from '@/data/course-data';
import type { TopicProgress } from './study-progress';

export interface TopicWithStatus {
  name: string;
  done: boolean;
}

export interface UnitWithStatus {
  name: string;
  topics: TopicWithStatus[];
  done: boolean; // todos os tópicos concluídos
  progress: number; // 0-100
}

export interface DisciplineTopicsSummary {
  discipline: Discipline;
  units: UnitWithStatus[];
  totalTopics: number;
  doneTopics: number;
  progress: number; // 0-100
  isComplete: boolean;
  nextTopic: string | null; // primeiro tópico não concluído
  pendingUnits: number;
}

export function getDisciplineTopics(
  code: string,
  topicProgress: TopicProgress,
): DisciplineTopicsSummary | null {
  const discipline = disciplines.find((d) => d.code === code);
  if (!discipline) return null;

  const done = topicProgress[code] ?? {};
  const units: UnitWithStatus[] = discipline.conteudoProgramatico.map((u) => {
    const topicsWithStatus: TopicWithStatus[] = u.topicos.map((t) => ({
      name: t,
      done: !!done[t],
    }));
    const doneCount = topicsWithStatus.filter((t) => t.done).length;
    const allDone = doneCount === topicsWithStatus.length && topicsWithStatus.length > 0;
    return {
      name: u.unidade,
      topics: topicsWithStatus,
      done: allDone,
      progress:
        topicsWithStatus.length === 0
          ? 0
          : Math.round((doneCount / topicsWithStatus.length) * 100),
    };
  });

  const totalTopics = units.reduce((acc, u) => acc + u.topics.length, 0);
  const doneTopics = units.reduce(
    (acc, u) => acc + u.topics.filter((t) => t.done).length,
    0,
  );
  const progress = totalTopics === 0 ? 0 : Math.round((doneTopics / totalTopics) * 100);
  const pendingUnits = units.filter((u) => !u.done).length;

  const nextTopic =
    units
      .flatMap((u) => u.topics)
      .find((t) => !t.done)?.name ?? null;

  return {
    discipline,
    units,
    totalTopics,
    doneTopics,
    progress,
    isComplete: doneTopics === totalTopics && totalTopics > 0,
    nextTopic,
    pendingUnits,
  };
}

/**
 * Lista todas as disciplinas com resumo de tópicos.
 */
export function getAllDisciplinesTopics(
  topicProgress: TopicProgress,
): DisciplineTopicsSummary[] {
  return disciplines
    .map((d) => getDisciplineTopics(d.code, topicProgress))
    .filter((s): s is DisciplineTopicsSummary => s !== null);
}

/**
 * Conta tópicos concluídos no total (todas as disciplinas).
 */
export function countTotalTopicsDone(topicProgress: TopicProgress): number {
  let total = 0;
  for (const code of Object.keys(topicProgress)) {
    const done = topicProgress[code];
    for (const v of Object.values(done)) {
      if (v) total += 1;
    }
  }
  return total;
}

/**
 * Conta tópicos totais (todas as disciplinas).
 */
export function countTotalTopicsAll(): number {
  return disciplines.reduce(
    (acc, d) => acc + d.conteudoProgramatico.reduce((a, u) => a + u.topicos.length, 0),
    0,
  );
}

/**
 * Conta disciplinas "em dia" — definido como progresso >= 50%.
 */
export function countDisciplinesOnTrack(topicProgress: TopicProgress): number {
  const summaries = getAllDisciplinesTopics(topicProgress);
  return summaries.filter((s) => s.progress >= 50).length;
}

/**
 * Lista todos os tópicos (nomes) de uma disciplina — útil para markAll.
 */
export function listAllTopicsOfDiscipline(code: string): string[] {
  const d = disciplines.find((x) => x.code === code);
  if (!d) return [];
  return d.conteudoProgramatico.flatMap((u) => u.topicos);
}
