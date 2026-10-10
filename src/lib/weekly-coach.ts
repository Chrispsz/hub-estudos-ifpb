/**
 * COACH SEMANAL — monta a análise da semana de estudos para o tutor IA.
 *
 * Última superfície de progresso a falar com a IA (mapa 42→48: resumo,
 * exercícios, simulado, histórico, flashcards, Modo Revisão, caderno,
 * Me testa — e agora o RELATÓRIO SEMANAL). Os números saem dos dados REAIS
 * dos Pomodoros e dos simulados gravados — nada inventado.
 *
 * A IA recebe: volume/consistência da semana vs anterior, onde o tempo foi
 * (distribuição por disciplina), quantos simulados rodaram e quantos dias
 * faltam para a Av1 — e devolve leitura honesta + ajustes + plano de 7 dias.
 */

import { getDisciplineByCode } from '@/data/course-data';
import { MATH_EXAM } from './math-exam-prep';
import type { PomodoroSession, SimuladoRun } from './study-progress';
import { capQuestion } from './tutor-stream';

export interface WeekSummary {
  minutes: number;
  sessions: number;
  activeDays: number;
  avgSessionMin: number;
  bestDayLabel: string | null;
  bestDayMinutes: number;
}

export interface DisciplineShare {
  disciplineCode: string;
  minutes: number;
}

export interface WeeklyCoachInput {
  thisWeek: WeekSummary;
  lastWeek: WeekSummary;
  rangeCurrent: string;
  rangePrevious: string;
  /** Todas as sessões — a função filtra a semana corrente (0–6 dias atrás). */
  sessions: PomodoroSession[];
  simuladoRuns: SimuladoRun[];
  now?: Date;
}

const DAY_MS = 86_400_000;

/** Minutos por disciplina na semana corrente (0–6 dias atrás, UTC). */
export function weekDisciplineShares(
  sessions: PomodoroSession[],
  now = new Date(),
): DisciplineShare[] {
  const keys = new Set<string>();
  for (let i = 0; i <= 6; i++) {
    keys.add(new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10));
  }
  const byDisc = new Map<string, number>();
  for (const s of sessions) {
    if (!keys.has(s.date)) continue;
    const code = s.disciplineId || '—';
    byDisc.set(code, (byDisc.get(code) ?? 0) + s.focusMinutes);
  }
  return [...byDisc.entries()]
    .map(([disciplineCode, minutes]) => ({ disciplineCode, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

function discShort(code: string): string {
  return getDisciplineByCode(code)?.shortName || code;
}

function trendWord(current: number, previous: number): string {
  if (previous === 0 && current > 0) return 'semana nova de estudo';
  if (previous === 0) return 'ainda sem dados';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 2) return `+${pct}% vs semana anterior`;
  if (pct < -2) return `${pct}% vs semana anterior`;
  return 'estável vs semana anterior';
}

/** Dias até a Av1 (data 00:00 local do dia da prova). */
export function daysUntilExam(now = new Date()): number {
  const [y, m, d] = MATH_EXAM.date.split('-').map(Number);
  const exam = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((exam.getTime() - today.getTime()) / DAY_MS);
}

/**
 * Pergunta de coach semanal. Capped por capQuestion (nunca dá 400).
 */
export function buildWeeklyQuestion(input: WeeklyCoachInput): string {
  const { thisWeek, lastWeek, rangeCurrent, rangePrevious, sessions, simuladoRuns, now = new Date() } =
    input;

  const shares = weekDisciplineShares(sessions, now);
  const shareLine =
    shares.length > 0
      ? shares
          .slice(0, 4)
          .map((s) => `${discShort(s.disciplineCode)} ${s.minutes} min`)
          .join(' · ')
      : 'sem sessões com disciplina marcada';

  // Simulados da semana (data ISO dentro dos últimos 7 dias)
  const weekAgoIso = new Date(now.getTime() - 6 * DAY_MS).toISOString();
  const runsThisWeek = simuladoRuns
    .filter((r) => r.date >= weekAgoIso)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastRun = runsThisWeek[0];
  const simuladoLine =
    runsThisWeek.length > 0
      ? `${runsThisWeek.length} ${runsThisWeek.length === 1 ? 'simulado' : 'simulados'} esta semana${
          lastRun
            ? ` (último: ${lastRun.total > 0 ? Math.round((lastRun.solved / lastRun.total) * 100) : 0}% em ${lastRun.date.slice(8, 10)}/${lastRun.date.slice(5, 7)})`
            : ''
        }`
      : 'nenhum simulado esta semana';

  const dExam = daysUntilExam(now);
  const examLine =
    dExam > 0
      ? `faltam ${dExam} ${dExam === 1 ? 'dia' : 'dias'} para a Av1 de ${MATH_EXAM.disciplineName}`
      : dExam === 0
        ? 'a Av1 é HOJE'
        : 'a Av1 já aconteceu';

  return capQuestion(
    [
      `Meu relatório semanal do Hub (${rangeCurrent}, comparado com ${rangePrevious}):`,
      `- Foco total: ${thisWeek.minutes} min (${trendWord(thisWeek.minutes, lastWeek.minutes)})`,
      `- Sessões: ${thisWeek.sessions} · dias ativos: ${thisWeek.activeDays}/7 · média por sessão: ${thisWeek.avgSessionMin} min`,
      thisWeek.bestDayLabel && thisWeek.bestDayMinutes > 0
        ? `- Melhor dia: ${thisWeek.bestDayLabel} (${thisWeek.bestDayMinutes} min)`
        : '',
      `- Onde o tempo foi: ${shareLine}`,
      `- Simulados: ${simuladoLine}`,
      '',
      `Contexto: ${examLine} (prova em ${MATH_EXAM.date.slice(8, 10)}/${MATH_EXAM.date.slice(5, 7)}).`,
      '',
      'Na resposta, como coach de estudos: (1) leitura HONESTA da semana — consistência × volume, e o que os números REALMENTE dizem (sem elogio vazio), (2) o que ajustar AGORA considerando a prova, (3) plano concreto de sessões para os próximos 7 dias, dizendo em quais disciplinas o tempo está bem gasto e onde falta — citando materiais do Hub.',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}
