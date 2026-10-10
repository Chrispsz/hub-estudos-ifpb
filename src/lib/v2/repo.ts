// REPO — única porta de ESCRITA no núcleo novo (Fase 2+).
// Toda regra com guard-rail mora aqui: XP, cap de conversão 5/dia,
// XP de revisão-do-dia 1×/dia, Vagabond 0 XP, véspera bloqueia jogo.
// Os componentes só falam com a repo — nunca com o Dexie cru.

import type {
  Attempt,
  AttemptResult,
  DeckCard,
  ErrorCategory,
  PracticeUnit,
  Quest,
  StudySession,
} from './domain';
import { getDb } from './store';
import { advanceFsrs, fsrsNew } from './fsrs';
import { dateKeyOf } from './planner';
import { XP_RULES, xpForAttempt, xpForSession } from './xp';

/** id curto e único (tentativas/sessões/quests — não precisam ser naturais). */
export function nid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function metaGet(key: string): Promise<string | null> {
  const row = await getDb().meta.get(key);
  return row?.value ?? null;
}

async function metaPut(key: string, value: string): Promise<void> {
  await getDb().meta.put({ key, value });
}

// ---------- tentativas (a fonte única de histórico) ----------

export interface AnswerInput {
  unit: PracticeUnit;
  result: AttemptResult;
  /** Obrigatório quando result === 'wrong': 1 frase + categoria. */
  error?: { reason: string; category: ErrorCategory };
  noLookup: boolean;
  sessionId?: string;
}

/** Grava a tentativa real e avança o FSRS da unidade. Devolve o XP ganho. */
export async function answerUnit(input: AnswerInput): Promise<{ xp: number; attemptId: string }> {
  const db = getDb();
  const now = Date.now();
  if (input.result === 'wrong' && !input.error?.reason?.trim()) {
    throw new Error('Errei pede 1 frase do porquê — anote rápido, seu eu do futuro agradece.');
  }
  const attempt: Attempt = {
    id: nid('at'),
    unitId: input.unit.id,
    at: now,
    result: input.result,
    noLookup: input.noLookup,
    sessionId: input.sessionId,
    error: input.result === 'wrong' ? input.error : undefined,
  };
  // FSRS: errei = Again · acertei = Good · não tentei = não avança (fila continua)
  const nextFsrs =
    input.result === 'correct'
      ? advanceFsrs(input.unit.fsrs, 3, now)
      : input.result === 'wrong'
        ? advanceFsrs(input.unit.fsrs, 1, now)
        : (input.unit.fsrs ?? fsrsNew(now));
  const xp = xpForAttempt(input.result);
  await db.transaction('rw', db.units, db.attempts, async () => {
    await db.units.put({ ...input.unit, fsrs: nextFsrs });
    await db.attempts.put(attempt);
  });
  return { xp, attemptId: attempt.id };
}

/** Flashcard: acertei=Good · fácil=Easy · errei=Again · não tentei = pula. */
export async function answerCard(
  card: DeckCard,
  grade: 1 | 3 | 4 | null,
): Promise<void> {
  if (grade === null) return; // pulado — volta pro fim da fila de hoje (sem avanço)
  const db = getDb();
  const next = advanceFsrs(card.fsrs, grade, Date.now());
  await db.cards.put({ ...card, fsrs: next });
}

// ---------- sessões (o commit de estudo; sobrevive a reload) ----------

export interface StartSessionInput {
  kind: StudySession['kind'];
  blockId?: string;
  topics?: string[];
  disciplineId?: string;
  vagabond?: boolean;
}

export async function startSession(input: StartSessionInput): Promise<string> {
  const db = getDb();
  const id = nid('sess');
  const row: StudySession = {
    id,
    kind: input.kind,
    startedAt: Date.now(),
    endedAt: 0,
    dateKey: dateKeyOf(),
    disciplineId: input.disciplineId ?? '',
    focusMinutes: 0,
    xpAwarded: 0,
    blockId: input.blockId,
    topics: input.topics,
    vagabond: input.vagabond,
  };
  await db.sessions.put(row);
  return id;
}

/** Fecha a sessão (ou devolve a aberta se já fechada). XP com guard-rail ≥15min. */
export async function endSession(id: string): Promise<StudySession | null> {
  const db = getDb();
  const s = await db.sessions.get(id);
  if (!s || s.endedAt > 0) return s ?? null;
  const endedAt = Date.now();
  const focusMinutes = Math.max(0, Math.round((endedAt - s.startedAt) / 60_000));
  const closed: StudySession = {
    ...s,
    endedAt,
    focusMinutes,
    xpAwarded: xpForSession({ ...s, focusMinutes }),
  };
  await db.sessions.put(closed);
  return closed;
}

export async function abandonSession(id: string): Promise<void> {
  // honesto: descartar zera o XP e marca 1 min — o registro fica, o XP não
  const db = getDb();
  const s = await db.sessions.get(id);
  if (!s || s.endedAt > 0) return;
  await db.sessions.put({ ...s, endedAt: Date.now(), focusMinutes: 0, xpAwarded: 0 });
}

// ---------- revisão do dia (XP 1×/dia) ----------

export async function markReviewDayComplete(dateKey: string): Promise<{ awarded: boolean }> {
  const key = `xp:reviewday:${dateKey}`;
  if (await metaGet(key)) return { awarded: false };
  await metaPut(key, new Date().toISOString());
  return { awarded: true };
}

export async function reviewDayDone(dateKey: string): Promise<boolean> {
  return !!(await metaGet(`xp:reviewday:${dateKey}`));
}

// ---------- backlog (conversão assistida — cap 5/dia) ----------

export const BACKLOG_DAILY_CAP = 5;

export async function conversionsToday(dateKey: string): Promise<number> {
  const raw = await metaGet(`backlog:converted:${dateKey}`);
  return raw ? Number(raw) || 0 : 0;
}

export interface ConvertUnitPlan {
  mode: 'unit';
  prompt: string;
  answer?: string;
  type: 'question' | 'kata';
}
export interface ConvertReadingPlan {
  mode: 'reading';
  title: string;
  materialId?: string;
}
export type ConvertPlan = ConvertUnitPlan | ConvertReadingPlan | { mode: 'wont' };

export async function convertBacklogItem(
  itemId: string,
  plan: ConvertPlan,
  subjectId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const db = getDb();
  const item = await db.backlog.get(itemId);
  if (!item) return { ok: false, reason: 'item inexistente' };
  if (item.status !== 'open') return { ok: false, reason: 'item já processado' };
  const dateKey = dateKeyOf();

  if (plan.mode === 'wont') {
    await db.backlog.put({ ...item, status: 'wont' });
    return { ok: true };
  }

  const done = await conversionsToday(dateKey);
  if (done >= BACKLOG_DAILY_CAP) {
    return { ok: false, reason: `cap de ${BACKLOG_DAILY_CAP} conversões/dia atingido — amanhã tem mais` };
  }

  const now = Date.now();
  await db.transaction('rw', db.backlog, db.units, db.quests, db.meta, async () => {
    if (plan.mode === 'unit') {
      const unit: PracticeUnit = {
        id: nid('unit'),
        subjectId,
        topicId: null, // conversão nasce solta; Trilha pode adotar depois
        type: plan.type,
        prompt: plan.prompt,
        answer: plan.answer,
        difficulty: 2,
        source: 'backlog',
        linkedMaterials: item.sourceRef.materialId ? [item.sourceRef.materialId] : [],
        createdAt: now,
        fsrs: fsrsNew(now),
      };
      await db.units.put(unit);
      await db.backlog.put({
        ...item,
        status: 'converted',
        convertedUnitIds: [...item.convertedUnitIds, unit.id],
      });
    } else {
      const quest: Quest = {
        id: nid('q'),
        title: plan.title,
        kind: 'once',
        status: 'open',
        xp: 0,
        createdAt: now,
        flavor: 'leitura',
        materialId: plan.materialId ?? item.sourceRef.materialId,
      };
      await db.quests.put(quest);
      await db.backlog.put({ ...item, status: 'converted', convertedUnitIds: [] });
    }
    await metaPut(`backlog:converted:${dateKey}`, String(done + 1));
  });
  return { ok: true };
}

// ---------- quests ----------

export async function upsertQuest(q: Quest): Promise<void> {
  await getDb().quests.put(q);
}

export async function completeQuest(id: string, patch?: Partial<Quest>): Promise<void> {
  const db = getDb();
  const q = await db.quests.get(id);
  if (!q) return;
  await db.quests.put({ ...q, ...patch, status: 'done', doneAt: Date.now() });
}

export async function deleteQuest(id: string): Promise<void> {
  await getDb().quests.delete(id);
}

// ---------- rotina (override do dia + registro de dia de jogo) ----------

export async function setTemplateOverride(dateKey: string, templateId: string | null): Promise<void> {
  const key = `rotina:override:${dateKey}`;
  if (templateId === null) await getDb().meta.delete(key);
  else await metaPut(key, templateId);
}

export async function getTemplateOverride(dateKey: string): Promise<string | null> {
  return metaGet(`rotina:override:${dateKey}`);
}

export async function registerGameDay(weekKey: string, dateKey: string): Promise<number> {
  const key = `rotina:gamedays:${weekKey}`;
  const raw = await metaGet(key);
  const map = raw ? (JSON.parse(raw) as Record<string, true>) : {};
  if (map[dateKey]) {
    // já contava — idempotente
    return Object.keys(map).length;
  }
  map[dateKey] = true;
  await metaPut(key, JSON.stringify(map));
  return Object.keys(map).length;
}

export async function gameDaysOfWeek(weekKey: string): Promise<string[]> {
  const raw = await metaGet(`rotina:gamedays:${weekKey}`);
  return raw ? Object.keys(JSON.parse(raw) as Record<string, true>) : [];
}

// ---------- meta genérico (recuperação, etc.) ----------

export async function getMeta(key: string): Promise<string | null> {
  return metaGet(key);
}

export async function setMeta(key: string, value: string): Promise<void> {
  await metaPut(key, value);
}

export async function deleteMeta(key: string): Promise<void> {
  await getDb().meta.delete(key);
}

// ---------- marca "conteúdo da semana" (o boost cirúrgico do plano) ----------

/** Marca/desmarca (1 toque). true = ficou marcado. A marca vale 9 dias. */
export async function toggleFocusMark(
  kind: 'topico' | 'material',
  id: string,
  dateKey: string,
): Promise<boolean> {
  const key = `semana:${kind}:${id}`;
  if (await metaGet(key)) {
    await deleteMeta(key);
    return false;
  }
  await metaPut(key, dateKey);
  return true;
}
