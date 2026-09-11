// semester.ts — FONTE ÚNICA DE VERDADE do calendário acadêmico
// IFPB Campus Cajazeiras • Cursos Superiores • Semestre 2026.2
//
// Fonte oficial: "Calendário Acadêmico Cursos Superiores e Subsequentes 2026"
// (ifpb.edu.br/campus/cajazeiras/ensino/calendario-academico) — verificado em 10/09/2026.
//
// ⚠️ NÃO duplicar SEMESTER_START em outros arquivos. Importe daqui.

import {
  evaluationPeriods,
  getDisciplineByCode,
  type EvaluationPeriod,
} from '@/data/course-data';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** 24/08/2026 (segunda) — Início do Semestre Letivo 2026.2 (oficial). */
export const SEMESTER_START = new Date(2026, 7, 24);

/** 18/12/2026 — último dia letivo de 2026; pausa começa após. */
export const SEMESTER_PAUSE_START = new Date(2026, 11, 18);

/** 18/01/2027 (segunda) — Reinício do Semestre Letivo 2026.2. */
export const SEMESTER_PAUSE_END = new Date(2027, 0, 18);

/** 30/01/2027 — Encerramento do semestre 2026.2 (fim das aulas). */
export const SEMESTER_END = new Date(2027, 0, 30);

/** 03-04/02/2027 — Provas finais 2026.2. */
export const FINAL_EXAM_START = new Date(2027, 1, 3);
export const FINAL_EXAM_END = new Date(2027, 1, 4);

/**
 * Semanas de ensino: 17 semanas (24/08 → 18/12) + pausa (18/12 → 17/01)
 * + 2 semanas (18/01 → 30/01) = 19 semanas letivas ≈ 100 dias efetivos.
 */
export const TOTAL_TEACHING_WEEKS = 19;
/** Nº da última semana de ensino de 2026 (antes da pausa). */
const LAST_WEEK_2026 = 17;

/**
 * Converte 'YYYY-MM-DD' em Date local à meia-noite.
 * Convenção única do módulo: todas as datas ISO do calendário são interpretadas
 * como datas LOCAIS (sem fuso UTC) para bater com `startOfDay`.
 */
function parseISODateLocal(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00`);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Data (início da semana) correspondente a uma semana letiva, considerando a pausa. */
export function weekStartDate(week: number): Date {
  if (week <= LAST_WEEK_2026) {
    return new Date(SEMESTER_START.getTime() + (week - 1) * WEEK_MS);
  }
  // Semanas do reinício (18/01/2027 em diante)
  return new Date(SEMESTER_PAUSE_END.getTime() + (week - LAST_WEEK_2026 - 1) * WEEK_MS);
}

/**
 * Semana atual do semestre, IGNORANDO a pausa de dezembro/janeiro.
 * - Antes de 24/08/2026 → 0 (pré-semestre)
 * - Durante a pausa → continua na semana 17 (não avança)
 * - Depois de 30/01/2027 → 0 (semestre encerrado)
 */
export function currentWeekOfSemester(now: Date = new Date()): number {
  const t = startOfDay(now).getTime();
  const start = startOfDay(SEMESTER_START).getTime();
  const pauseStart = startOfDay(SEMESTER_PAUSE_START).getTime();
  const pauseEnd = startOfDay(SEMESTER_PAUSE_END).getTime();
  const end = startOfDay(SEMESTER_END).getTime();

  if (t < start || t > end) return 0;

  // Semanas antes do reinício: contagem simples até a pausa
  if (t <= pauseStart) {
    return Math.min(LAST_WEEK_2026, Math.floor((t - start) / WEEK_MS) + 1);
  }
  if (t < pauseEnd) return LAST_WEEK_2026; // em pausa: congela na última semana
  return Math.min(
    TOTAL_TEACHING_WEEKS,
    LAST_WEEK_2026 + Math.floor((t - pauseEnd) / WEEK_MS) + 1,
  );
}

/**
 * @deprecated LEGADO — deriva prazo a partir de SEMANA estimada, o que contraria
 * a política ANTI-ESTIMATIVA do app (urgência só com data oficial em `date`).
 * Mantido apenas por compatibilidade de exports; NÃO usar em código novo —
 * use `daysUntilDate` com a data oficial.
 */
export function daysUntilEvaluation(estimatedWeek: number, now: Date = new Date()): number {
  const target = startOfDay(weekStartDate(estimatedWeek)).getTime();
  const t = startOfDay(now).getTime();
  return Math.ceil((target - t) / DAY_MS);
}

/** Dias até uma data ISO 'YYYY-MM-DD' (pode ser negativo = já passou). */
export function daysUntilDate(dateIso: string, now: Date = new Date()): number {
  const target = startOfDay(parseISODateLocal(dateIso)).getTime();
  return Math.ceil((target - startOfDay(now).getTime()) / DAY_MS);
}

/** Fração do semestre decorrida (0-100%) com base nas semanas letivas. */
export function semesterProgressPct(now: Date = new Date()): number {
  const week = currentWeekOfSemester(now);
  if (week <= 0) return 0;
  return Math.min(100, Math.round((week / TOTAL_TEACHING_WEEKS) * 100));
}

// ---------------------------------------------------------------------------
// Eventos oficiais do calendário 2026.2 (Cajazeiras) — usados no dashboard
// ---------------------------------------------------------------------------

export interface AcademicEvent {
  date: string; // 'YYYY-MM-DD'
  endDate?: string; // evento em vários dias
  title: string;
  description?: string;
  kind:
    | 'feriado'   // sem aulas
    | 'letivo'    // sábado letivo / reinício
    | 'prazo'     // deadline acadêmico
    | 'evento'    // semana acadêmica, colação de grau
    | 'pausa'     // recesso
    | 'provas';   // provas finais
}

export const ACADEMIC_EVENTS: AcademicEvent[] = [
  { date: '2026-08-24', endDate: '2026-08-28', title: 'Ajustes de matrícula 2026.2', kind: 'prazo' },
  { date: '2026-08-31', title: 'Colação de grau 2026.1', kind: 'evento' },
  {
    date: '2026-09-15',
    title: 'Feriado municipal — Padroeira de Cajazeiras',
    description: 'Sem aulas nesta terça-feira.',
    kind: 'feriado',
  },
  {
    date: '2026-09-19',
    title: 'Sábado letivo (ref. terça)',
    description: 'Sábado com aulas no horário de terça-feira.',
    kind: 'letivo',
  },
  {
    date: '2026-10-07',
    title: 'Prazo final: trancamento 2026.2 (veteranos)',
    description: 'Pedido deve ser feito no SUAP até esta data.',
    kind: 'prazo',
  },
  {
    date: '2026-10-10',
    title: 'Sábado letivo (ref. segunda)',
    description: 'Sábado com aulas no horário de segunda-feira.',
    kind: 'letivo',
  },
  {
    date: '2026-10-19',
    endDate: '2026-10-24',
    title: 'Semana de Ciência, Tecnologia, Arte e Cultura',
    description: 'Atividades culturais e científicas no campus.',
    kind: 'evento',
  },
  {
    date: '2026-10-26',
    title: 'Sábado letivo (ref. quarta)',
    description: 'Sábado com aulas no horário de quarta-feira.',
    kind: 'letivo',
  },
  {
    date: '2026-12-18',
    title: 'Último dia letivo de 2026',
    description: 'Pausa do semestre 2026.2 começa após esta data.',
    kind: 'pausa',
  },
  { date: '2026-12-30', title: 'Término do ano letivo 2026', kind: 'pausa' },
  { date: '2027-01-18', title: 'Reinício do semestre 2026.2', description: 'Volta às aulas após a pausa.', kind: 'letivo' },
  { date: '2027-01-23', title: 'Sábado letivo (ref. sexta)', kind: 'letivo' },
  { date: '2027-01-30', title: 'Encerramento das aulas 2026.2', kind: 'prazo' },
  { date: '2027-02-03', endDate: '2027-02-04', title: 'Provas finais 2026.2', kind: 'provas' },
  { date: '2027-02-03', title: 'Colação de grau 2026.2', kind: 'evento' },
  { date: '2027-02-13', title: 'Publicação dos resultados finais 2026.2', kind: 'prazo' },
];

/** Próximos eventos a partir de hoje (ordenados), incluindo eventos em curso. */
export function upcomingEvents(now: Date = new Date(), limit = 4): (AcademicEvent & { daysLeft: number; ongoing: boolean })[] {
  const today = startOfDay(now).getTime();
  const result: (AcademicEvent & { daysLeft: number; ongoing: boolean })[] = [];

  for (const ev of ACADEMIC_EVENTS) {
    const start = parseISODateLocal(ev.date).getTime();
    const end = ev.endDate ? parseISODateLocal(ev.endDate).getTime() : start;
    if (end < today) continue; // já passou
    const ongoing = today >= start && today <= end;
    result.push({ ...ev, daysLeft: Math.ceil((start - today) / DAY_MS), ongoing });
  }

  result.sort((a, b) => a.daysLeft - b.daysLeft);
  return result.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Próxima avaliação — compartilhado por header, dashboard e crons
// ---------------------------------------------------------------------------

export interface NextEvaluation {
  daysLeft: number;
  name: string;
  description: string;
  disciplineCode: string;
  disciplineShort: string;
}

/**
 * Próxima avaliação COM DATA OFICIAL do semestre. Sem estimativas:
 * se nenhuma data oficial está à frente, retorna null (nada é inventado).
 */
export function getNextEvaluation(now: Date = new Date()): NextEvaluation | null {
  const week = currentWeekOfSemester(now);
  if (week <= 0) return null;

  // Type predicate elimina o cast `as string`: só entra avaliação com data oficial.
  const pick = evaluationPeriods
    .filter((e): e is EvaluationPeriod & { date: string } => !e.conditional && !!e.date)
    .map((e) => ({ e, days: daysUntilDate(e.date, now) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  if (!pick) return null;

  const disc = getDisciplineByCode(pick.e.disciplineCode);
  return {
    daysLeft: pick.days,
    name: pick.e.evaluationName,
    description: pick.e.description,
    disciplineCode: pick.e.disciplineCode,
    disciplineShort: disc?.shortName ?? pick.e.disciplineCode,
  };
}
