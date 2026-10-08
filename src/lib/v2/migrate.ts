// Migração v2 — Fase 1 (Alicerce). IDEMPOTENTE por construção:
//  1. SNAPSHOT do legado vem ANTES de qualquer escrita (zero perda).
//  2. Todo upsert usa id natural/determinístico → rodar 2× não duplica nada.
//  3. O estado antigo entra como priorStats (semeia FSRS) — nunca como
//     tentativa falsa. Histórico real nasce só de tentativas novas.
//
// Origens lidas (todas no navegador do dono): localStorage
//   hub-estudos-ifpb:v2 (megachave) + satélites hub:*

import type {
  ExerciseProgressEntry,
  Flashcard,
  FocusSessionLog,
  PomodoroSession,
  StudyProgress,
} from '@/lib/study-progress';
import { slug } from './domain';
import type {
  DeckCard,
  Exam,
  LegacySnapshot,
  PriorStats,
  StudySession,
} from './domain';
import { seedContent, type SeedCounts } from './content-seed';
import { fsrsFromLeitner, fsrsFromStats } from './fsrs';
import { getDb, tableCounts } from './store';

const V2_KEY = 'hub-estudos-ifpb:v2';

function isHubKey(k: string): boolean {
  return k.startsWith('hub-estudos-ifpb') || k.startsWith('hub:');
}

function safeParse(raw: string | null): Partial<StudyProgress> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return typeof v === 'object' && v !== null ? (v as Partial<StudyProgress>) : {};
  } catch {
    return {};
  }
}

// ---------- 1) snapshot do legado ----------

export function collectLegacyRaw(): { raw: Record<string, string>; bytes: number; keys: string[] } {
  const raw: Record<string, string> = {};
  let bytes = 0;
  if (typeof window === 'undefined') return { raw, bytes, keys: [] };
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !isHubKey(k)) continue;
    const v = window.localStorage.getItem(k) ?? '';
    raw[k] = v;
    bytes += k.length + v.length;
  }
  return { raw, bytes, keys: Object.keys(raw) };
}

/** Guarda o estado legado INTEIRO no IndexedDB antes de qualquer escrita. */
export async function snapshotLegacy(): Promise<LegacySnapshot> {
  const db = getDb();
  const { raw, bytes, keys } = collectLegacyRaw();
  const existing = await db.legacySnapshots.get('legacy:latest');
  const sameState =
    existing &&
    existing.bytes === bytes &&
    existing.keys.join('|') === keys.join('|');
  if (sameState && existing) return existing;
  const snap: LegacySnapshot = {
    id: 'legacy:latest',
    capturedAt: Date.now(),
    keys,
    bytes,
    raw,
  };
  await db.legacySnapshots.put(snap);
  return snap;
}

// ---------- 2) estado do usuário → núcleo ----------

export interface UserStateCounts {
  cards: number;
  sessions: number;
  unitsSeeded: number;
  examsRegistered: number;
}

function sessionIdSafe(s: string): string {
  return s.replace(/[^a-zA-Z0-9:_-]/g, '');
}

export async function importUserState(): Promise<UserStateCounts> {
  const db = getDb();
  const p = safeParse(window.localStorage.getItem(V2_KEY));
  const now = Date.now();
  let cards = 0;
  let sessions = 0;
  let unitsSeeded = 0;
  let examsRegistered = 0;

  // (a) flashcards Leitner → DeckCard com FSRS semeado (dueAt real preservado)
  const fcards: Flashcard[] = Array.isArray(p.flashcards) ? p.flashcards : [];
  const deckRows: DeckCard[] = fcards
    .filter((c) => c && typeof c.front === 'string' && typeof c.back === 'string')
    .map((c) => {
      const legacyDue = c.dueAt ? Date.parse(c.dueAt) : NaN;
      return {
        id: `card:${c.id}`,
        subjectId: c.disciplineCode ?? '',
        front: c.front,
        back: c.back,
        source: c.source === 'ia' ? 'ia' : 'manual',
        fromMistake: c.fromMistake,
        priorStats: { box: c.box ?? 0, reviews: c.reviews ?? 0, lapses: c.lapses ?? 0 },
        fsrs: fsrsFromLeitner(
          c.box ?? 0,
          c.lapses ?? 0,
          Number.isFinite(legacyDue) ? legacyDue : null,
          now,
        ),
        createdAt: Number.isFinite(Date.parse(c.createdAt)) ? Date.parse(c.createdAt) : now,
      };
    });
  if (deckRows.length) {
    await db.cards.bulkPut(deckRows);
    cards = deckRows.length;
  }

  // (b) pomodoro + sessões guiadas → StudySession (XP com guard-rail ≥15 min)
  const sessionRows: StudySession[] = [];
  const pomo: PomodoroSession[] = Array.isArray(p.pomodoroSessions)
    ? p.pomodoroSessions
    : [];
  for (const s of pomo) {
    if (!s?.startedAt || !s?.completedAt) continue;
    const start = Date.parse(s.startedAt);
    const end = Date.parse(s.completedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    sessionRows.push({
      id: sessionIdSafe(`sess:p:${s.date}:${s.startedAt}:${s.disciplineId ?? ''}`),
      kind: 'pomodoro',
      startedAt: start,
      endedAt: end,
      dateKey: s.date,
      disciplineId: s.disciplineId ?? '',
      materialId: s.materialId,
      focusMinutes: s.focusMinutes ?? 0,
      xpAwarded: (s.focusMinutes ?? 0) >= 15 ? 1 : 0,
    });
  }
  const focus: FocusSessionLog[] = Array.isArray(p.focusSessions) ? p.focusSessions : [];
  for (const f of focus) {
    if (!f?.id) continue;
    const start = Date.parse(f.startedAt);
    const end = Date.parse(f.endedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    sessionRows.push({
      id: sessionIdSafe(`sess:f:${f.id}`),
      kind: 'foco-guiado',
      startedAt: start,
      endedAt: end,
      dateKey: f.date,
      disciplineId: f.disciplineCode ?? '',
      focusMinutes: f.focusMinutes ?? 0,
      xpAwarded: (f.focusMinutes ?? 0) >= 15 ? 1 : 0,
    });
  }
  if (sessionRows.length) {
    await db.sessions.bulkPut(sessionRows);
    sessions = sessionRows.length;
  }

  // (c) exerciseProgress → priorStats + FSRS semeado nas unidades
  //     (booleans legados → 1/0; NUNCA viram tentativa falsa)
  const ep = (p.exerciseProgress ?? {}) as Record<string, ExerciseProgressEntry>;
  for (const [exId, st] of Object.entries(ep)) {
    if (!st || (!st.tried && !st.solved)) continue;
    const unit = await db.units.get(`unit:${exId}`);
    if (!unit) continue;
    const prior: PriorStats = {
      tried: st.tried ? 1 : 0,
      solved: st.solved ? 1 : 0,
      lapses: st.lapses ?? 0,
      marked: !!st.marked,
      lastPracticedAt: st.lastPracticedAt ?? null,
    };
    unit.priorStats = prior;
    unit.fsrs = fsrsFromStats(
      { tried: prior.tried, solved: prior.solved, lapses: prior.lapses },
      now,
    );
    await db.units.put(unit);
    unitsSeeded++;
  }

  // (d) realGrades → Exam registrado (ex.: 'TEC.1984-Av1' casa com exam:TEC.1984:av1)
  const rg = p.realGrades ?? {};
  for (const [key, entry] of Object.entries(rg)) {
    if (!entry || typeof entry.grade !== 'number') continue;
    const m = key.match(/^(.+)-([A-Za-z0-9]+)$/);
    const subjectId = m?.[1] ?? key;
    const name = m?.[2] ?? key;
    const id = `exam:${subjectId}:${slug(name)}`;
    const existing = await db.exams.get(id);
    const row: Exam = existing
      ? {
          ...existing,
          status: 'registered',
          score: entry.grade,
          max: existing.max ?? 100,
          registeredAt: Number.isFinite(Date.parse(entry.doneAt))
            ? Date.parse(entry.doneAt)
            : now,
        }
      : {
          id,
          subjectId,
          name,
          kind: 'prova',
          date: '',
          status: 'registered',
          score: entry.grade,
          max: 100,
          registeredAt: Number.isFinite(Date.parse(entry.doneAt))
            ? Date.parse(entry.doneAt)
            : now,
        };
    await db.exams.put(row);
    examsRegistered++;
  }

  return { cards, sessions, unitsSeeded, examsRegistered };
}

// ---------- 3) orquestrador ----------

export interface MigrationResult {
  counts: Record<string, number>;
  seed: SeedCounts;
  user: UserStateCounts;
  snapshot: { keys: number; bytes: number; capturedAt: number };
  ranAt: string;
}

export async function runMigration(): Promise<MigrationResult> {
  const snap = await snapshotLegacy();
  const seed = await seedContent();
  const user = await importUserState();
  const db = getDb();
  const ranAt = new Date().toISOString();
  await db.meta.put({ key: 'migration:lastRunAt', value: ranAt });
  const counts = await tableCounts();
  return {
    counts,
    seed,
    user,
    snapshot: { keys: snap.keys.length, bytes: snap.bytes, capturedAt: snap.capturedAt },
    ranAt,
  };
}
