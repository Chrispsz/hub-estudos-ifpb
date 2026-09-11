// smart-schedule.ts v2.0 — Cronograma inteligente ROTATIVO
// Reescrita completa: distribuição rotativa proporcional à CH (deficit scheduling).
// Garante que NENHUMA disciplina aparece todos os dias e que a CH de cada uma
// é respeitada no agregado da semana.

import {
  disciplines,
  evaluationPeriods,
  getDisciplineByCode,
  type Discipline,
  type EvaluationPeriod,
} from '@/data/course-data';
import type { StudyPreferences, TopicProgress } from './study-progress';
// Fonte única do calendário — funções reexportadas p/ compatibilidade com os views.
import { currentWeekOfSemester, daysUntilDate } from './semester';

export { currentWeekOfSemester };

export const BLOCK_MINUTES = 50; // 1 bloco = 50min foco + 10min pausa
export const BREAK_MINUTES = 10;

export interface SmartBlock {
  id: string;
  day: number; // 0=Dom..6=Sáb
  startHour: number;
  startMinute: number;
  durationMin: number;
  disciplineCode: string;
  title: string;
  activity: 'estudo' | 'revisao' | 'projeto' | 'exercicios';
  isReview?: boolean;   // bloco de revisão geral (sábado)
  intensive?: boolean;  // priorizado por avaliação próxima
  fixed?: boolean;      // fixado manualmente pelo usuário ("Seg = Matemática")
  stale?: boolean;      // incluído por estar esquecido (≥5 dias sem estudo)
  rescheduled?: boolean;
  source: 'auto' | 'recommended';
}

export interface ScheduleDisciplineState {
  studiedMinutes: number;
  lastStudiedAt?: string; // ISO
}

export interface SmartScheduleInput {
  preferences: StudyPreferences;
  topicProgress: TopicProgress;
  disciplineProgress?: { [code: string]: ScheduleDisciplineState };
  now?: Date;
}

const STALE_DAYS = 5; // disciplina sem estudo há ≥5 dias entra no próximo dia

// ---------- Pesos ----------

/** CH total do curso — constante do módulo (evita reduce em cada chamada de chShare). */
const TOTAL_CH = disciplines.reduce((acc, d) => acc + d.chTotal, 0);

/** Fração da CH total — base da distribuição proporcional. */
function chShare(d: Discipline): number {
  return d.chTotal / (TOTAL_CH || 1);
}

/** Multiplicador de prioridade — ajuste fino sobre a CH (não domina a rotação). */
function priorityMultiplier(d: Discipline): number {
  if (d.prioridade === 'alta') return 1.2;
  if (d.prioridade === 'media') return 1.0;
  return 0.85;
}

function pendingTopics(code: string, topicProgress: TopicProgress): number {
  const disc = getDisciplineByCode(code);
  if (!disc) return 0;
  const all = disc.conteudoProgramatico.flatMap((u) => u.topicos);
  const done = topicProgress[code] ?? {};
  return all.filter((t) => !done[t]).length;
}

function isStale(code: string, state: ScheduleDisciplineState | undefined, now: Date): boolean {
  if (!state?.lastStudiedAt) {
    // Nunca estudou: só considera "esquecido" depois da 1ª semana do semestre
    return currentWeekOfSemester(now) > 1;
  }
  const last = new Date(state.lastStudiedAt).getTime();
  const days = (now.getTime() - last) / (24 * 60 * 60 * 1000);
  return days >= STALE_DAYS;
}

interface DiscWeight {
  code: string;
  weight: number;         // peso normalizado (soma = 1)
  evalBoostDays?: number; // dias restantes p/ avaliação mais próxima
}

/**
 * Pesos de distribuição: CH proporcional × prioridade × urgência de avaliação.
 * rotationMode:
 *  - 'proportional' → CH + prioridade (recomendado)
 *  - 'fixed'        → rotação igualitária (mesma fatia para todas)
 *  - 'random'       → proporcional com aleatoriedade (varia a cada geração)
 */
function computeWeights(
  mode: StudyPreferences['rotationMode'],
  topicProgress: TopicProgress,
  disciplineProgress: { [code: string]: ScheduleDisciplineState },
  now: Date,
): Map<string, DiscWeight> {
  const result = new Map<string, DiscWeight>();
  const raw = new Map<string, number>();

  for (const d of disciplines) {
    const pend = pendingTopics(d.code, topicProgress);
    if (pend === 0) {
      result.set(d.code, { code: d.code, weight: 0 });
      continue;
    }
    let w: number;
    if (mode === 'fixed') {
      w = 1; // igualitário
    } else {
      w = chShare(d) * priorityMultiplier(d);
      // Tópicos pendentes pesam um pouco (mais pendente → leve reforço)
      w *= 1 + Math.min(0.3, pend * 0.02);
    }
    // Avaliação com DATA OFICIAL próxima → urgência.
    // Política ANTI-ESTIMATIVA: sem `date` oficial não há boost de urgência.
    const upcoming = evaluationPeriods
      .filter((e): e is EvaluationPeriod & { date: string } => e.disciplineCode === d.code && !!e.date)
      .map((e) => daysUntilDate(e.date, now))
      .filter((days) => days >= 0)
      .sort((a, b) => a - b);
    if (upcoming.length > 0 && upcoming[0] <= 14) {
      const days = upcoming[0];
      if (days <= 3) w *= 4;
      else if (days <= 7) w *= 2.5;
      else w *= 1.5;
      result.set(d.code, { code: d.code, weight: w, evalBoostDays: days });
      continue;
    }
    // Esquecida (≥5 dias) → reforço moderado
    if (isStale(d.code, disciplineProgress[d.code], now)) w *= 1.4;
    raw.set(d.code, w);
  }

  // Normaliza (soma = 1)
  const sum = Array.from(raw.values()).reduce((a, b) => a + b, 0) || 1;
  for (const [code, w] of raw) {
    const prev = result.get(code);
    result.set(code, { code, weight: w / sum, evalBoostDays: prev?.evalBoostDays });
  }
  // Disciplinas concluídas ficam com peso 0
  for (const d of disciplines) {
    if (!result.has(d.code)) result.set(d.code, { code: d.code, weight: 0 });
  }
  return result;
}

// ---------- Geração ----------

/**
 * Gera o cronograma semanal rotativo v2.0.
 *
 * Regras (em ordem de precedência por dia):
 *  1. Disciplina FIXADA pelo usuário (`fixedDisciplines[day]`) → 1º bloco
 *  2. Sábado → bloco de "Revisão geral da semana" (se habilitado)
 *  3. Avaliação ≤7 dias → blocos intensivos dessa disciplina
 *  4. Disciplina esquecida (≥5 dias sem estudo) → incluída no próximo dia
 *  5. Demais vagas → deficit scheduling rotativo proporcional à CH
 *
 * Limites: maxBlocksPerDay (default 4), maxMinutesPerDay (default 180).
 * NUNCA aloca a mesma disciplina para todos os blocos do dia (máx. metade dos blocos).
 */
export function generateSmartSchedule(input: SmartScheduleInput): SmartBlock[] {
  const { preferences, topicProgress } = input;
  const disciplineProgress = input.disciplineProgress ?? {};
  const now = input.now ?? new Date();
  const mode = preferences.rotationMode ?? 'proportional';
  const weights = computeWeights(mode, topicProgress, disciplineProgress, now);

  // Capacidade planejada da semana (para calcular metas proporcionais)
  const dayCapacity = new Map<number, { blocks: number; minutes: number; startHour: number }>();
  let plannedTotal = 0;
  for (let day = 0; day <= 6; day++) {
    const pref = preferences.days[day];
    if (!pref?.enabled || pref.durationMin <= 0) continue;
    const blocks = Math.min(
      preferences.maxBlocksPerDay ?? 4,
      Math.max(1, Math.floor(pref.durationMin / (BLOCK_MINUTES + BREAK_MINUTES))),
    );
    const minutes = Math.min(preferences.maxMinutesPerDay ?? 180, pref.durationMin);
    dayCapacity.set(day, { blocks, minutes, startHour: pref.startHour });
    plannedTotal += Math.min(minutes, blocks * (BLOCK_MINUTES + BREAK_MINUTES));
  }
  if (plannedTotal === 0) return [];

  // Metas proporcionais (minutos alvo por disciplina na semana)
  const targetMin = new Map<string, number>();
  const allocatedMin = new Map<string, number>();
  for (const [code, dw] of weights) {
    targetMin.set(code, dw.weight * plannedTotal);
    allocatedMin.set(code, 0);
  }

  // Aleatoriedade (modo 'random'): jitter fixo por disciplina nesta geração
  const jitter = new Map<string, number>();
  if (mode === 'random') {
    for (const code of weights.keys()) jitter.set(code, Math.random() * 0.5 - 0.25);
  }

  // Disciplinas esquecidas na ordem do semestre (garantia de inclusão)
  const staleCodes = disciplines
    .filter((d) => isStale(d.code, disciplineProgress[d.code], now) && (weights.get(d.code)?.weight ?? 0) > 0)
    .map((d) => d.code);

  // Avaliações urgentes (≤7 dias) por disciplina
  const urgentEvalCodes = Array.from(weights.values())
    .filter((dw) => dw.evalBoostDays !== undefined && dw.evalBoostDays <= 7)
    .map((dw) => dw.code);

  const blocks: SmartBlock[] = [];
  const staleQueue = [...staleCodes];

  for (const [day, cap] of dayCapacity) {
    const todayCodes = new Set<string>();
    // Blocos por disciplina HOJE (exclui a revisão geral) — mantido incrementalmente
    // pelo push; substitui o re-filtro de `blocks` a cada vaga do deficit scheduling.
    const todayCount = new Map<string, number>();
    let cursorHour = cap.startHour;
    let cursorMinute = 0;
    let usedMinutes = 0;
    let usedBlocks = 0;
    const maxRepeat = Math.max(1, Math.ceil(cap.blocks / 2)); // nunca domina o dia

    function push(
      code: string,
      title: string,
      activity: SmartBlock['activity'],
      opts: Partial<Pick<SmartBlock, 'isReview' | 'intensive' | 'fixed' | 'stale'>> = {},
    ): boolean {
      if (usedBlocks >= cap.blocks) return false;
      if (usedMinutes + BLOCK_MINUTES > cap.minutes) return false;
      blocks.push({
        id: `auto-${day}-${code}-${usedBlocks}-${title.slice(0, 12)}`,
        day,
        startHour: cursorHour,
        startMinute: cursorMinute,
        durationMin: BLOCK_MINUTES,
        disciplineCode: code,
        title,
        activity,
        source: 'auto',
        ...opts,
      });
      todayCodes.add(code);
      if (code !== 'revisao') {
        todayCount.set(code, (todayCount.get(code) ?? 0) + 1);
      }
      usedMinutes += BLOCK_MINUTES + BREAK_MINUTES;
      cursorMinute += BLOCK_MINUTES + BREAK_MINUTES;
      while (cursorMinute >= 60) {
        cursorHour += 1;
        cursorMinute -= 60;
      }
      usedBlocks += 1;
      allocatedMin.set(code, (allocatedMin.get(code) ?? 0) + BLOCK_MINUTES);
      return true;
    }

    // 1. Fixada pelo usuário
    const fixedCode = preferences.fixedDisciplines?.[day];
    if (fixedCode && (weights.get(fixedCode)?.weight ?? 0) > 0) {
      const d = getDisciplineByCode(fixedCode);
      push(fixedCode, `${d?.shortName ?? fixedCode} — Estudo fixado por você`, 'estudo', { fixed: true });
    }

    // 2. Sábado: revisão geral
    if (day === 6) {
      push(
        'revisao',
        'Revisão geral da semana',
        'revisao',
        { isReview: true },
      );
    }

    // 3. Urgentes por avaliação (≤7 dias) — 1 bloco intensivo garantido por dia
    for (const code of urgentEvalCodes) {
      if (usedBlocks >= cap.blocks) break;
      const daysLeft = weights.get(code)?.evalBoostDays;
      const d = getDisciplineByCode(code);
      if (d && !todayCodes.has(code)) {
        push(
          code,
          `${d.shortName} — Revisão intensiva (avaliação em ${daysLeft}d)`,
          'revisao',
          { intensive: true },
        );
      }
    }

    // 4. Esquecidas (≥5 dias) — 1 por dia até esgotar a fila
    while (staleQueue.length > 0 && usedBlocks < cap.blocks) {
      const code = staleQueue.shift()!;
      if (todayCodes.has(code)) continue;
      const d = getDisciplineByCode(code);
      if (!d) continue;
      push(code, `${d.shortName} — Retomada (estudo atrasado)`, 'estudo', { stale: true });
      break; // no máximo 1 retomada por dia
    }

    // 5. Preenche o resto com deficit scheduling rotativo
    let guard = 0;
    while (usedBlocks < cap.blocks && guard < 20) {
      guard++;
      let best: string | null = null;
      let bestDeficit = -Infinity;
      for (const [code, dw] of weights) {
        if (dw.weight <= 0 || code === 'revisao') continue;
        const countToday = todayCount.get(code) ?? 0;
        if (countToday >= maxRepeat) continue; // anti-domínio: não vira "a mesma todos os dias"
        const behind =
          (targetMin.get(code) ?? 0) -
          (allocatedMin.get(code) ?? 0) +
          (jitter.get(code) ?? 0) * plannedTotal;
        if (behind > bestDeficit) {
          bestDeficit = behind;
          best = code;
        }
      }
      if (!best) break;
      const d = getDisciplineByCode(best);
      const remaining = todayCount.get(best) ?? 0;
      const title =
        remaining === 0
          ? `${d?.shortName ?? best} — Estudo de novos tópicos`
          : `${d?.shortName ?? best} — Exercícios/prática`;
      push(best, title, remaining === 0 ? 'estudo' : 'exercicios');
    }
  }

  return blocks;
}

// ---------- Utilitários (compat) ----------

export function findReschedulableBlocks(
  blocksDone: string[],
  previousBlocks: SmartBlock[],
): SmartBlock[] {
  const done = new Set(blocksDone); // Set evita includes() O(n) dentro do filtro
  return previousBlocks.filter((b) => !done.has(b.id));
}

export function getDaySummary(
  blocks: SmartBlock[],
  day: number,
  blocksDone: string[],
): { total: number; done: number; minutes: number; minutesDone: number; pending: SmartBlock[] } {
  const dayBlocks = blocks.filter((b) => b.day === day);
  const doneSet = new Set(blocksDone); // Set evita includes() O(n) repetido
  const doneBlocks = dayBlocks.filter((b) => doneSet.has(b.id));
  const minutes = dayBlocks.reduce((acc, b) => acc + b.durationMin, 0);
  const minutesDone = doneBlocks.reduce((acc, b) => acc + b.durationMin, 0);
  return {
    total: dayBlocks.length,
    done: doneBlocks.length,
    minutes,
    minutesDone,
    pending: dayBlocks.filter((b) => !doneSet.has(b.id)),
  };
}

export const DAYS_OF_WEEK = [
  { num: 0, label: 'Dom' },
  { num: 1, label: 'Seg' },
  { num: 2, label: 'Ter' },
  { num: 3, label: 'Qua' },
  { num: 4, label: 'Qui' },
  { num: 5, label: 'Sex' },
  { num: 6, label: 'Sáb' },
];

export function formatTime(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function blockKey(b: { day: number; startHour: number; startMinute: number }): string {
  return `${b.day}-${b.startHour.toString().padStart(2, '0')}:${b.startMinute.toString().padStart(2, '0')}`;
}
