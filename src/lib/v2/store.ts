// Store v2 — IndexedDB (Dexie). Fase 1 (Alicerce).
// Instância única e PREGUIÇOSA: nada de IndexedDB no servidor/SSR —
// getDb() só é chamado dentro do cliente (painel ?v2, Fase 2+).

import Dexie, { type Table } from 'dexie';
import type {
  Attempt,
  BacklogItem,
  DeckCard,
  Exam,
  LegacySnapshot,
  MetaEntry,
  PracticeUnit,
  Quest,
  RoutineConfig,
  StudySession,
  Subject,
  Topic,
} from './domain';

export const DB_NAME = 'hub-projeto-principal';
export const DB_VERSION = 1;

export class HubV2Db extends Dexie {
  subjects!: Table<Subject, string>;
  topics!: Table<Topic, string>;
  units!: Table<PracticeUnit, string>;
  cards!: Table<DeckCard, string>;
  backlog!: Table<BacklogItem, string>;
  exams!: Table<Exam, string>;
  attempts!: Table<Attempt, string>;
  sessions!: Table<StudySession, string>;
  routine!: Table<RoutineConfig, string>;
  quests!: Table<Quest, string>;
  meta!: Table<MetaEntry, string>;
  legacySnapshots!: Table<LegacySnapshot, string>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      // índices mínimos por consulta; id é a chave primária (upsert natural)
      subjects: 'id',
      topics: 'id, subjectId',
      units: 'id, subjectId, topicId',
      cards: 'id, subjectId',
      backlog: 'id, subjectId, status',
      exams: 'id, subjectId, date',
      attempts: 'id, unitId, at',
      sessions: 'id, dateKey, kind',
      routine: 'id',
      quests: 'id, status, kind',
      meta: 'key',
      legacySnapshots: 'id',
    });
  }
}

let _db: HubV2Db | null = null;

/** Instância única (client-side only). */
export function getDb(): HubV2Db {
  if (!_db) _db = new HubV2Db();
  return _db;
}

/** Contagens por tabela — a prova de idempotência da migração. */
export async function tableCounts(): Promise<Record<string, number>> {
  const db = getDb();
  const names = db.tables.map((t) => t.name);
  const counts: Record<string, number> = {};
  for (const n of names) {
    counts[n] = await db.table(n).count();
  }
  return counts;
}
