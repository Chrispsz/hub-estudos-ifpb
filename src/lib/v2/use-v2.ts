// HOOKS — Dexie reativa (dexie-react-hooks). Tudo client-side.
// O núcleo é IndexedDB: cada write dispara re-render nos hooks vivos.

import { useLiveQuery } from 'dexie-react-hooks';
import type {
  Attempt,
  BacklogItem,
  DeckCard,
  Exam,
  PracticeUnit,
  Quest,
  RoutineConfig,
  StudySession,
  Subject,
  Topic,
} from './domain';
import { getDb, tableCounts } from './store';

export function useCounts() {
  return useLiveQuery(async () => tableCounts(), [], null);
}

export function useSubjects() {
  return useLiveQuery(() => getDb().subjects.toArray(), [], [] as Subject[]);
}

export function useTopics() {
  return useLiveQuery(() => getDb().topics.toArray(), [], [] as Topic[]);
}

export function useUnits() {
  return useLiveQuery(() => getDb().units.toArray(), [], [] as PracticeUnit[]);
}

export function useAttempts() {
  return useLiveQuery(
    () => getDb().attempts.orderBy('at').reverse().limit(2000).toArray(),
    [],
    [] as Attempt[],
  );
}

export function useCards() {
  return useLiveQuery(() => getDb().cards.toArray(), [], [] as DeckCard[]);
}

export function useBacklog() {
  return useLiveQuery(() => getDb().backlog.toArray(), [], [] as BacklogItem[]);
}

export function useExams() {
  return useLiveQuery(() => getDb().exams.toArray(), [], [] as Exam[]);
}

export function useRoutine() {
  return useLiveQuery(() => getDb().routine.get('default'), [], null as RoutineConfig | null);
}

export function useQuests() {
  // quests só indexa id/status/kind — orderBy('createdAt') derrubaria o Dexie;
  // sort em memória (o volume do dono é pequeno e sempre vai ser)
  return useLiveQuery(
    async () => (await getDb().quests.toArray()).sort((a, b) => b.createdAt - a.createdAt),
    [],
    [] as Quest[],
  );
}

export function useSessions() {
  return useLiveQuery(() => getDb().sessions.toArray(), [], [] as StudySession[]);
}

/** Sessão aberta (endedAt === 0) — o timer vivo que sobrevive a reload. */
export function useActiveSession() {
  return useLiveQuery(
    async () => {
      const all = await getDb().sessions.toArray();
      return all.filter((s) => s.endedAt === 0).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
    },
    [],
    null as StudySession | null,
  );
}

/** Meta reativa (overrides de rotina, marcas do dia). */
export function useMetaValue(key: string) {
  return useLiveQuery(async () => (await getDb().meta.get(key))?.value ?? null, [key], null);
}

/**
 * Marcas "conteúdo da semana" (Edição Definitiva) — reativas, map prontos
 * para o plano cirúrgico e para os chips das listas.
 */
export function useFocusMarks(): { topics: Record<string, string>; materials: Record<string, string> } {
  return useLiveQuery(
    async () => {
      const rows = await getDb().meta.toArray();
      const out = { topics: {} as Record<string, string>, materials: {} as Record<string, string> };
      for (const r of rows) {
        if (r.key.startsWith('semana:topico:')) out.topics[r.key.slice(14)] = r.value;
        else if (r.key.startsWith('semana:material:')) out.materials[r.key.slice(16)] = r.value;
      }
      return out;
    },
    [],
    { topics: {}, materials: {} },
  );
}
