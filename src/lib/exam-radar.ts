// exam-radar.ts — O RADAR DE PROVAS (Task 27, pedido do dono 13/10/2026:
// "só matemática fez prova, o restante vem ainda esse mês... dá pra priorizar
// as que vão trabalhar com prova — vamos deixar o estudo cada vez mais
// direcionado, inteligente, produtivo, eficiente").
//
// FONTE ÚNICA: evaluationPeriods (course-data) — a política anti-estimativa
// vale aqui: só DATA OFICIAL conta. O radar devolve, por disciplina, um dos
// três estados:
//   • FEITA     — a avaliação datada que já passou (Matemática Av1 01/10,
//                 LM Projeto 09/10): o ciclo fechou, não pressiona a fila;
//   • AGENDADA  — a data oficial à frente (Algoritmos Prova 1, 30/10) com o
//                 D-N honesto;
//   • SEM DATA  — nada publicado (RHT/Fundamentos/Inglês/Português):
//                 aparece como "a definir", nunca com prazo inventado.
//
// A PRESSÃO alimenta a fila do plano (study-plan.ts — a MESMA inteligência
// da Sessão Sintonizada): D-21 acende, D-7 pesa, D-3 manda. Lib PURA:
// recebe `now` e devolve retrato honesto — nada lê storage aqui.

import { evaluationPeriods, getDisciplineByCode, disciplines } from '@/data/course-data';

const DAY = 86_400_000;

export type ExamStatus = 'feita' | 'agendada' | 'sem-data';

export interface ExamRadarEntry {
  disciplineCode: string;
  disciplineShort: string;
  status: ExamStatus;
  /** A avaliação que define o estado (a última feita ou a próxima agendada). */
  name: string;
  /** 'YYYY-MM-DD' da avaliação oficial (quando existe — anti-estimativa). */
  date?: string;
  /** D-N (futuro) ou dias DESDE a feita (passado = negativo). */
  daysLeft: number;
}

/** Janela para a prova feita ainda "contar a história" no radar (30 dias). */
const DONE_WINDOW_DAYS = 30;

/**
 * O radar completo: as disciplinas do curso na ordem de pressão real —
 * agendadas primeiro (mais perto primeiro), depois feitas recentes,
 * depois as sem data. Puro no `now` (o chamador divide o mesmo `agora`).
 */
export function examRadarFor(now: Date): ExamRadarEntry[] {
  const nowMs = now.getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const entries: ExamRadarEntry[] = disciplines.map((d) => {
    const dated = evaluationPeriods
      .filter((e) => e.disciplineCode === d.code && !e.conditional && !!e.date)
      .map((e) => {
        const t = new Date(`${e.date}T00:00:00`).getTime();
        const daysLeft = Math.round((t - todayStart) / DAY);
        return { name: e.evaluationName, date: e.date as string, daysLeft, t };
      })
      .filter((x) => !Number.isNaN(x.t));

    const upcoming = dated
      .filter((x) => x.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)[0];
    if (upcoming) {
      return {
        disciplineCode: d.code,
        disciplineShort: d.shortName,
        status: 'agendada' as ExamStatus,
        name: upcoming.name,
        date: upcoming.date,
        daysLeft: upcoming.daysLeft,
      };
    }

    // A última feita — só recentemente feita "conta a história" no radar.
    const past = dated
      .filter((x) => x.daysLeft < 0)
      .sort((a, b) => b.t - a.t)[0];
    if (past && -past.daysLeft <= DONE_WINDOW_DAYS) {
      return {
        disciplineCode: d.code,
        disciplineShort: d.shortName,
        status: 'feita' as ExamStatus,
        name: past.name,
        date: past.date,
        daysLeft: past.daysLeft,
      };
    }

    return {
      disciplineCode: d.code,
      disciplineShort: d.shortName,
      status: 'sem-data' as ExamStatus,
      name: 'sem data oficial',
      daysLeft: Number.POSITIVE_INFINITY,
    };
  });

  const rank = (e: ExamRadarEntry): number =>
    e.status === 'agendada' ? e.daysLeft : e.status === 'feita' ? 10_000 + -e.daysLeft : 20_000;
  return entries.sort((a, b) => rank(a) - rank(b));
}

/**
 * A pressão de prova de UMA disciplina: a próxima avaliação datada à frente.
 * null = nenhuma data oficial à frente (nada é inventado — doutrina da casa).
 */
export function examPressureFor(
  code: string,
  now: Date,
): { name: string; daysLeft: number } | null {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const upcoming = evaluationPeriods
    .filter((e) => e.disciplineCode === code && !e.conditional && !!e.date)
    .map((e) => ({
      name: e.evaluationName,
      daysLeft: Math.round((new Date(`${e.date}T00:00:00`).getTime() - todayStart) / DAY),
    }))
    .filter((x) => x.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];
  return upcoming ?? null;
}

/**
 * O nível da pressão na fila (maior = manda mais):
 *   3 = D-3 ou menos (a prova é agora)
 *   2 = D-7 (a semana da prova)
 *   1 = D-21 (o mês da prova — "o restante vem ainda esse mês")
 *   0 = sem pressão (prova feita ou sem data)
 */
export function examBoostLevel(daysLeft: number | null): 0 | 1 | 2 | 3 {
  if (daysLeft === null) return 0;
  if (daysLeft <= 3) return 3;
  if (daysLeft <= 7) return 2;
  if (daysLeft <= 21) return 1;
  return 0;
}

/** Frase curta do prazo — "hoje" / "amanhã" / "em N dias" / "em dd/mm". */
export function examWhenPhrase(daysLeft: number, date?: string): string {
  if (daysLeft === 0) return 'hoje';
  if (daysLeft === 1) return 'amanhã';
  if (daysLeft <= 14) return `em ${daysLeft} dias`;
  return date ? `dia ${date.slice(8, 10)}/${date.slice(5, 7)}` : `em ${daysLeft} dias`;
}

/** O porquê da fila quando a prova pesa — null = sem pressão, frase nenhuma. */
export function examPressureWhy(code: string, now: Date): string | null {
  const p = examPressureFor(code, now);
  if (!p) return null;
  const level = examBoostLevel(p.daysLeft);
  if (level === 0) return null;
  const short = getDisciplineByCode(code)?.shortName ?? code;
  const when = examWhenPhrase(p.daysLeft);
  return level >= 2
    ? `prova de ${short} ${when} — ${p.name} vem primeiro`
    : `prova de ${short} ${when} (${p.name})`;
}
