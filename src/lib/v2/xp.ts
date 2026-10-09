// XP com GUARD-RAILS do dono — Fase 2.
// XP só nasce de trabalho real:
//   · sessão ≥ 15 min  → +5 (Modo Vagabond = 0, sempre)
//   · unidade respondida → acertei +2 · errei +1 (errar também é trabalho) · não tentei 0
//   · revisão do dia completa → +5 (uma vez por dia)
//   · conversão no backlog → +3 (máx 5/dia — o cap mora na repo)
// Nada mais dá XP. Quest completa não dá XP. Vagabond não dá XP nem streak.

import type { Attempt, StudySession } from './domain';

export const XP_RULES = {
  sessionMin: 5,
  sessionThresholdMin: 15,
  attemptCorrect: 2,
  attemptWrong: 1,
  attemptSkipped: 0,
  reviewDay: 5,
  convert: 3,
} as const;

export function xpForAttempt(result: Attempt['result']): number {
  if (result === 'correct') return XP_RULES.attemptCorrect;
  if (result === 'wrong') return XP_RULES.attemptWrong;
  return XP_RULES.attemptSkipped;
}

export function xpForSession(s: StudySession): number {
  if (s.vagabond) return 0;
  return s.focusMinutes >= XP_RULES.sessionThresholdMin ? XP_RULES.sessionMin : 0;
}

// ---------- ranks (XP + taxa de acerto REAL) ----------

export interface Rank {
  id: string;
  name: string;
  minXp: number;
  minAcc: number; // 0–1 — taxa de acerto real (sem consulta conta igual)
  desc: string;
}

export const RANKS: Rank[] = [
  { id: 'trainee', name: 'Trainee', minXp: 0, minAcc: 0, desc: 'começando do zero honesto' },
  { id: 'junior', name: 'Júnior', minXp: 300, minAcc: 0.6, desc: 'acerto real ≥ 60%' },
  { id: 'pleno', name: 'Pleno', minXp: 900, minAcc: 0.7, desc: 'acerto real ≥ 70%' },
  { id: 'senior', name: 'Sênior', minXp: 2000, minAcc: 0.8, desc: 'acerto real ≥ 80%' },
  { id: 'arquiteto', name: 'Arquiteto', minXp: 4000, minAcc: 0.85, desc: 'acerto real ≥ 85%' },
];

export interface RankState {
  rank: Rank;
  next: Rank | null;
  xpToNext: number;
  accToNext: number; // pontos percentuais que faltam (0 se já passa)
  progress: number; // 0–100 para o próximo
}

export function accuracyOf(attempts: Attempt[]): { acc: number; correct: number; tried: number } {
  const real = attempts.filter((a) => a.result !== 'skipped');
  const correct = real.filter((a) => a.result === 'correct').length;
  const tried = real.length;
  return { acc: tried ? correct / tried : 0, correct, tried };
}

export function rankFor(xp: number, attempts: Attempt[]): RankState {
  const { acc } = accuracyOf(attempts);
  const accPct = Math.round(acc * 100);
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    const r = RANKS[i];
    if (xp >= r.minXp && acc >= r.minAcc) idx = i;
  }
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  if (!next) {
    return { rank, next: null, xpToNext: 0, accToNext: 0, progress: 100 };
  }
  const xpToNext = Math.max(0, next.minXp - xp);
  const accToNext = Math.max(0, Math.round((next.minAcc - acc) * 100));
  // progresso = pior dos dois eixos (XP e acerto) — rank honesto
  const xpProg = next.minXp
    ? Math.min(100, Math.round((100 * (xp - rank.minXp)) / (next.minXp - rank.minXp)))
    : 100;
  const accProg = next.minAcc
    ? Math.min(100, Math.round((100 * (acc - rank.minAcc)) / (next.minAcc - rank.minAcc)))
    : 100;
  return { rank, next, xpToNext, accToNext, progress: Math.max(0, Math.min(xpProg, accProg)) };
}

// ---------- streak (piso 60 min/dia; Vagabond não conta) ----------

export function minutesByDate(sessions: StudySession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (s.vagabond) continue;
    map.set(s.dateKey, (map.get(s.dateKey) ?? 0) + s.focusMinutes);
  }
  return map;
}

export function streakOf(sessions: StudySession[], todayKey: string): {
  count: number;
  todayMinutes: number;
  floorOk: boolean; // hoje já fez os 60 min do piso
} {
  const map = minutesByDate(sessions);
  const todayMinutes = map.get(todayKey) ?? 0;
  let count = 0;
  const cursor = new Date(`${todayKey}T00:00:00`);
  // hoje ainda não fez o piso? o streak exibido começa em ontem (não mente)
  const start = todayMinutes >= 60 ? 0 : 1;
  cursor.setDate(cursor.getDate() - start);
  for (;;) {
    const key = dateKeyOfSafe(cursor);
    const mins = map.get(key) ?? 0;
    if (mins >= 60) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return { count, todayMinutes, floorOk: todayMinutes >= 60 };
}

function dateKeyOfSafe(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** XP total — soma o que foi efetivamente concedido nas sessões + tentativas. */
export function totalXp(sessions: StudySession[], attempts: Attempt[]): number {
  const fromSessions = sessions.reduce((acc, s) => acc + s.xpAwarded, 0);
  const fromAttempts = attempts.reduce((acc, a) => acc + xpForAttempt(a.result), 0);
  return fromSessions + fromAttempts;
}
