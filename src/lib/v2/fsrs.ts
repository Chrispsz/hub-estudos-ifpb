// Wrapper ts-fsrs — Fase 1 (Alicerce).
// Duas portas de SEMEADURA honesta (nada de histórico falso):
//   1. fsrsFromLeitner — cartões legados (caixa 0–5 → estabilidade; dueAt real preservado)
//   2. fsrsFromStats   — unidades praticadas no legado (acurácia/lapses → estabilidade;
//                        due = agora: entra na fila de revisão, estado inicial marcado)
// E uma porta de avanço REAL (advanceFsrs) usada a partir da Fase 2.

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  State,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs';
import type { FsrsState } from './domain';

/** Intervalos do Leitner legado (study-progress FLASHCARD_BOX_DAYS) em dias. */
const LEITNER_BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;

let _engine: ReturnType<typeof fsrs> | null = null;
function engine() {
  if (!_engine) {
    _engine = fsrs(
      generatorParameters({ enable_fuzz: false, request_retention: 0.9 }),
    );
  }
  return _engine;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function toSerializable(card: {
  stability: number;
  difficulty: number;
  due: Date | number;
  last_review?: Date | null;
  state: State;
  reps: number;
  lapses: number;
  learning_steps?: number;
}): FsrsState {
  const dueMs = card.due instanceof Date ? card.due.getTime() : Number(card.due);
  const lastMs = card.last_review
    ? card.last_review instanceof Date
      ? card.last_review.getTime()
      : Number(card.last_review)
    : null;
  const stateName =
    card.state === State.New
      ? 'new'
      : card.state === State.Learning
        ? 'learning'
        : card.state === State.Review
          ? 'review'
          : 'relearning';
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: dueMs,
    lastReview: lastMs,
    state: stateName,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps ?? 0,
  };
}

/** Cartão totalmente novo (nunca tocado). */
export function fsrsNew(now: number = Date.now()): FsrsState {
  return toSerializable(createEmptyCard(new Date(now)));
}

/**
 * Semente 1 — cartão do Leitner legado.
 * caixa 0 → cartão novo · caixa ≥1 → estabilidade = intervalo da caixa (dias),
 * lapses entram na dificuldade. O dueAt REAL do legado é preservado.
 */
export function fsrsFromLeitner(
  box: number,
  lapses: number,
  legacyDueAt: number | null,
  now: number = Date.now(),
): FsrsState {
  if (!box || box <= 0) {
    const fresh = fsrsNew(now);
    // a data de vencimento real do legado manda (mesmo para cartão novo)
    if (legacyDueAt) fresh.due = legacyDueAt;
    return fresh;
  }
  const days = LEITNER_BOX_DAYS[Math.min(box, LEITNER_BOX_DAYS.length - 1)] ?? 1;
  const base = fsrsNew(now);
  return {
    ...base,
    stability: clamp(Math.max(days, 0.5), 0.5, 365),
    difficulty: clamp(4.5 + Math.min(lapses, 5) * 0.8, 1, 10),
    state: 'review',
    reps: 1,
    lapses: Math.max(0, lapses ?? 0),
    due: legacyDueAt ?? now,
  };
}

/**
 * Semente 2 — unidade praticada no legado (sem timestamps por tentativa).
 * acurácia alta + poucos lapses → mais estável; lapses → mais difícil.
 * due = agora: a unidade entra na fila de revisão (estado "semeado").
 */
export function fsrsFromStats(
  stats: { tried: number; solved: number; lapses?: number },
  now: number = Date.now(),
): FsrsState {
  if (!stats.tried || stats.tried <= 0) return fsrsNew(now);
  const accuracy = clamp(stats.solved / stats.tried, 0, 1);
  const lapses = Math.max(0, stats.lapses ?? 0);
  const base = fsrsNew(now);
  return {
    ...base,
    stability: clamp(1 + 8 * accuracy - 1.5 * Math.min(lapses, 6), 0.5, 180),
    difficulty: clamp(4.5 + 3 * (1 - accuracy) + lapses * 0.6, 1, 10),
    state: 'review',
    reps: 1,
    lapses,
    due: now,
    lastReview: now, // "semeado agora" — honesto: é quando a migração correu
  };
}

/**
 * Avanço REAL de um cartão/unidade com resposta do aluno (Fase 2+).
 * rating derivado dos botões grandes: Errei=Again(1) · Difícil=Hard(2) ·
 * Acertei=Good(3) · Acertei fácil=Easy(4).
 */
export function advanceFsrs(
  state: FsrsState | undefined,
  grade: Grade,
  now: number = Date.now(),
): FsrsState {
  const card = state
    ? {
        due: new Date(state.due),
        stability: state.stability,
        difficulty: state.difficulty,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: state.reps,
        lapses: state.lapses,
        learning_steps: state.learning_steps ?? 0,
        state:
          state.state === 'new'
            ? State.New
            : state.state === 'learning'
              ? State.Learning
              : state.state === 'review'
                ? State.Review
                : State.Relearning,
        last_review: state.lastReview ? new Date(state.lastReview) : undefined,
      }
    : createEmptyCard(new Date(now));
  const next: RecordLogItem = engine().next(card, new Date(now), grade);
  return toSerializable(next.card);
}
