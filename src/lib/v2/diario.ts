// DIÁRIO DE BORDO — o registro do dia da Edição Definitiva.
//
// Check-in de 1 toque (bateria) e check-out honesto (como foi). Sem nota,
// sem julgamento: é REGISTRO, não avaliação — alimenta o Sprint Review da
// semana com a voz do próprio aluno. Vive no meta do núcleo (sem schema novo).
//
// Regra do tom (pesquisa P9/P20): frases que aliviam e clareiam; nada que
// gere dívida, medo ou cobrança.

import { getDb } from './store';

export type Energy = 'baixa' | 'media' | 'alta';
export type DayMood = 'tranquilo' | 'puxado' | 'cansado' | 'otimo';

export interface DayCheckIn {
  energy: Energy;
  at: number;
}

export interface DayCheckOut {
  mood: DayMood;
  note?: string;
  at: number;
}

export const ENERGY_LABEL: Record<Energy, string> = {
  baixa: 'bateria baixa',
  media: 'bateria normal',
  alta: 'animado',
};

export const MOOD_LABEL: Record<DayMood, string> = {
  tranquilo: 'fluiu tranquilo',
  puxado: 'puxado, mas fui',
  cansado: 'cansado hoje',
  otimo: 'ótimo dia',
};

const inKey = (dateKey: string) => `diario:in:${dateKey}`;
const outKey = (dateKey: string) => `diario:out:${dateKey}`;

/** Check-in de 1 toque — "como está a bateria hoje?" */
export async function checkIn(dateKey: string, energy: Energy): Promise<void> {
  await getDb().meta.put({ key: inKey(dateKey), value: JSON.stringify({ energy, at: Date.now() } satisfies DayCheckIn) });
}

/** Check-out de ~10s — "como foi?" (opcional escrever nota). */
export async function checkOut(dateKey: string, mood: DayMood, note?: string): Promise<void> {
  await getDb().meta.put({
    key: outKey(dateKey),
    value: JSON.stringify({ mood, note: note?.trim() || undefined, at: Date.now() } satisfies DayCheckOut),
  });
}

export async function getCheckIn(dateKey: string): Promise<DayCheckIn | null> {
  const raw = await getDb().meta.get(inKey(dateKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw.value) as DayCheckIn;
  } catch {
    return null;
  }
}

export async function getCheckOut(dateKey: string): Promise<DayCheckOut | null> {
  const raw = await getDb().meta.get(outKey(dateKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw.value) as DayCheckOut;
  } catch {
    return null;
  }
}

/** Diário da semana (seg→dom) para o Sprint Review ler — [{dateKey, in, out}] */
export async function weekDiary(mondayKey: string, days = 7): Promise<Record<string, { in: DayCheckIn | null; out: DayCheckOut | null }>> {
  const out: Record<string, { in: DayCheckIn | null; out: DayCheckOut | null }> = {};
  const cursor = new Date(`${mondayKey}T00:00:00`);
  for (let i = 0; i < days; i += 1) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    out[key] = { in: await getCheckIn(key), out: await getCheckOut(key) };
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// ---------- Modo Dia Leve (o piso do hábito: 15 min e o dia conta) ----------

const lightKey = (dateKey: string) => `plano:leve:${dateKey}`;

export async function setLightDay(dateKey: string, on: boolean): Promise<void> {
  if (on) await getDb().meta.put({ key: lightKey(dateKey), value: '1' });
  else await getDb().meta.delete(lightKey(dateKey));
}
