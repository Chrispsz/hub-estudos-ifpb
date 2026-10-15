// Contexto real do Hub enviado ao tutor IA a cada pergunta.
// Centralizado aqui para que QUALQUER superfície do app (aba Estudar,
// diálogo de PDF, futuros painéis) envie exatamente os mesmos dados
// e o tutor responda sempre com precisão sobre professor, datas e progresso.

import {
  evaluationPeriods,
  getDisciplineByCode,
  materials as allMaterials,
} from '@/data/course-data';
import {
  currentWeekOfSemester,
  daysUntilDate,
  TOTAL_TEACHING_WEEKS,
  upcomingEvents,
} from '@/lib/semester';
import {
  MATH_EXAM,
  MATH_PLAN_KEY,
  MATH_SIMULADO_DATE,
  MATH_TRAVADAS_KEY,
  countTravadas,
  findMathSimuladoRunOficial,
  mathDrillFeedbackFor,
  normalizeTravadas,
  planDayFor,
  planDaysBehind,
  simuladoVerdictFor,
} from '@/lib/math-exam-prep';
import { flashcardsDueFor, type useStudyProgress } from '@/lib/study-progress';
import { getDisciplineTopics } from '@/lib/study-topics';
import { getExerciseStats } from '@/lib/exercise-extractor';
import { computeTriage } from '@/lib/study-triage';
import { escadaPosicao } from '@/lib/content-strategy';
import { suggestPractice, superficieLabel } from '@/lib/practice-methods';

/** Dados do app que o front envia ao /api/tutor (contrato do route.ts). */
export interface HubEvaluation {
  name: string;
  discipline: string;
  date?: string;
  week?: number;
  daysLeft: number;
  description?: string;
}

export interface HubEvent {
  name: string;
  date: string;
  daysLeft: number;
}

/**
 * Fila essencial do MOTOR (Task 219) — o app já decidiu o que priorizar hoje
 * (datas oficiais + tipo de avaliação + dívida de prática + escada de conteúdo
 * + método com evidência). O tutor alinha planos e respostas a esta fila.
 */
export interface HubPriority {
  disciplina: string;
  motivo: string;
  metodo?: string;
  superficie?: string;
  proximoPasso?: string;
}

export interface HubStudentStats {
  materialsDone: number;
  materialsTotal: number;
  topicsDone: number;
  topicsTotal: number;
  pomodoroMinutes: number;
  flashcardsDue: number;
  exercisesSolved: number;
  exercisesTotal: number;
}

/** Estado AO VIVO da semana da Av1 — o tutor sabia o PLANO (bloco estático
 *  do route), mas não o ESTADO: se o simulado aconteceu e como foi, onde o
 *  plano está hoje, o que ficou para trás. Dados derivados das MESMAS
 *  funções puras do card/kit (fonte única — lição 85/86). */
export interface HubExamWeek {
  provaDaysLeft: number;
  planoHoje: {
    titulo: string;
    kind: string;
    minutos: number;
    feitas: number;
    total: number;
  } | null;
  diasAtras: number;
  simuladoDaysLeft: number;
  simulado: {
    pct: number;
    meta: number;
    porTopico: { topico: string; solved: number; total: number; puladas: number }[];
    /** Bloco inteiro pulado quando existir — senão o pior respondido. */
    piorTopico?: string;
    /** Bloco INTEIRO sem tentativa (o tempo acabou nele / passou reto). */
    pulouTudo?: string | null;
    /** O RECIBO DO DRILL do foco (mode 'topico' mais recente do bloco):
     *  a revisão prometida aconteceu? Subiu? null = sem treino (nada inventado). */
    treinoDoFoco?: {
      quando: 'hoje' | 'ontem' | 'recente';
      solved: number;
      total: number;
      pct: number | null;
      melhorou: boolean | null;
    } | null;
  } | null;
  travadasCount: number;
}

export interface HubContext {
  today?: string;
  week?: number;
  totalWeeks?: number;
  professor?: string;
  professorTitle?: string;
  hours?: number;
  nextEvaluations?: HubEvaluation[];
  upcomingEvents?: HubEvent[];
  studentStats?: HubStudentStats;
  examWeek?: HubExamWeek;
  /** Fila essencial do motor — o "o quê" já decidido; o tutor cuida do "como". */
  prioridades?: HubPriority[];
}

type StudyProgressReturn = ReturnType<typeof useStudyProgress>;

/** Leitura defensiva de um mapa booleano no localStorage — lixo/SSR volta {}. */
function readLocalMap(key: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

/**
 * A fila essencial do motor (Task 219) — a MESMA triagem do TriageCard,
 * enriquecida com a escada de conteúdo e o método de prática. O tutor passa a
 * RESPONDER em sintonia com o que o app já decidiu: "o quê" vem daqui, o
 * "como" é onde a IA contribui. Falha silenciosa → undefined (nunca quebra o
 * pedido do tutor por causa da fila).
 */
function buildPriorities(sp: StudyProgressReturn): HubPriority[] | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    const triage = computeTriage({
      topicProgress: sp.progress.topicProgress,
      disciplineProgress: sp.progress.disciplineProgress,
      customEvaluations: sp.progress.customEvaluations,
      now: new Date(),
    });
    return triage.foco.slice(0, 3).map((e) => {
      const d = getDisciplineByCode(e.code);
      let metodo: string | undefined;
      let superficie: string | undefined;
      let proximoPasso: string | undefined;
      if (d) {
        const all = d.conteudoProgramatico.flatMap((u) => u.topicos);
        const feitos = all.filter((t) => sp.progress.topicProgress[e.code]?.[t] === true).length;
        const sug = suggestPractice({
          d,
          evalKind: e.eval?.kind,
          evalDaysLeft: e.eval?.daysLeft,
          debtDays: e.debtDays,
          topicosFeitos: feitos,
          topicosTotal: all.length,
          nuncaPraticou: !sp.progress.disciplineProgress[e.code]?.lastStudiedAt,
        });
        metodo = sug.method.nome;
        superficie = superficieLabel(sug.method.superficie);
        proximoPasso = sug.primeiroPasso;
      }
      const pos = d ? escadaPosicao(d, sp.progress.topicProgress[e.code] ?? {}) : null;
      return {
        disciplina: e.shortName,
        motivo: pos ? `${e.reasons[0]} · ${pos.frase}` : e.reasons[0],
        metodo,
        superficie,
        proximoPasso,
      };
    });
  } catch {
    return undefined;
  }
}

/** Monta o contexto completo do Hub — datas, professor, agenda e progresso do aluno. */
export function buildHubContext(
  disciplineCode: string,
  sp: StudyProgressReturn,
): HubContext {
  const disc = getDisciplineByCode(disciplineCode);
  const week = currentWeekOfSemester();
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // POLÍTICA ANTI-ESTIMATIVA: o tutor só recebe avaliações com DATA OFICIAL.
  // Sem data = o tutor deve dizer que a data ainda não foi divulgada.
  const nextEvaluations = [...evaluationPeriods]
    .filter((e) => !e.conditional && e.date)
    .map((e) => {
      const dName = getDisciplineByCode(e.disciplineCode)?.shortName ?? e.disciplineCode;
      const daysLeft = daysUntilDate(e.date as string);
      const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
        new Date(`${e.date}T12:00:00`),
      );
      return {
        name: e.evaluationName,
        discipline: dName,
        date,
        daysLeft: Number.isFinite(daysLeft) ? daysLeft : 999,
        description: e.description,
      };
    })
    .filter((e) => e.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3);

  const events = upcomingEvents(new Date(), 3).map((e) => ({
    name: e.title,
    date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
      new Date(`${e.date}T12:00:00`),
    ),
    daysLeft: e.daysLeft,
  }));

  const topics = getDisciplineTopics(disciplineCode, sp.progress.topicProgress);

  // SEMANA DA AV1 AO VIVO: só existe ATÉ o dia da prova (depois é ruído —
  // a recovery completa assume). Marcações do plano e travadas vêm do
  // localStorage (as mesmas chaves do card — MATH_PLAN_KEY/TRAVADAS_KEY);
  // o veredito do simulado vem da MESMA função que o kit usa (95).
  let examWeek: HubExamWeek | undefined;
  const provaDaysLeft = daysUntilDate(MATH_EXAM.date);
  if (provaDaysLeft >= 0 && typeof window !== 'undefined') {
    const plano = planDayFor(provaDaysLeft);
    const checked = readLocalMap(MATH_PLAN_KEY);
    const travadas = normalizeTravadas(readLocalMap(MATH_TRAVADAS_KEY));
    const run = findMathSimuladoRunOficial(sp.progress.simuladoRuns);
    const verdict = simuladoVerdictFor(run);
    examWeek = {
      provaDaysLeft,
      planoHoje: plano
        ? {
            titulo: plano.titulo,
            kind: plano.kind,
            minutos: plano.minutos,
            feitas: plano.tarefas.filter((_, i) => checked[`${plano.offset}-${i}`] === true).length,
            total: plano.tarefas.length,
          }
        : null,
      diasAtras: planDaysBehind(provaDaysLeft, checked, !!run).length,
      simuladoDaysLeft: daysUntilDate(MATH_SIMULADO_DATE),
      simulado: verdict
        ? {
            pct: verdict.pct,
            meta: verdict.meta,
            porTopico: verdict.porTopico.map((t) => ({
              topico: t.topic,
              solved: t.solved,
              total: t.total,
              puladas: t.skipped,
            })),
            // O foco que o tutor recomenda segue a MESMA precedência do kit:
            // bloco inteiro pulado (sem taxa para comparar) vence o pior
            // respondido — puladas também porTopico agora leva o sinal.
            piorTopico: verdict.pulouTudo?.topic ?? verdict.worst?.topic,
            pulouTudo: verdict.pulouTudo?.topic ?? null,
            // E O TUTOR SABE SE A REVISÃO CUMPRIU: o mesmo leitor do kit
            // (fonte única) acha o drill 'topico' do foco — o tutor reconhece
            // o progresso da noite anterior em vez de cobrar de novo.
            treinoDoFoco: (() => {
              const focoTopico = verdict.pulouTudo?.topic ?? verdict.worst?.topic;
              if (!focoTopico) return null;
              const focoPct = verdict.pulouTudo ? null : (verdict.worst?.pct ?? null);
              // A ordem do tempo manda (107): só drill DEPOIS do oficial é
              // 'a revisão cumprida' — antes do diagnóstico é preparo.
              const d = mathDrillFeedbackFor(
                sp.progress.simuladoRuns,
                focoTopico,
                focoPct,
                run?.date ?? null,
              );
              if (!d) return null;
              const dia = new Date(d.dateISO).toDateString();
              const quando =
                dia === new Date().toDateString()
                  ? ('hoje' as const)
                  : dia === new Date(Date.now() - 86_400_000).toDateString()
                    ? ('ontem' as const)
                    : ('recente' as const);
              return { quando, solved: d.solved, total: d.total, pct: d.pct, melhorou: d.melhorou };
            })(),
          }
        : null,
      travadasCount: countTravadas(travadas),
    };
  }

  return {
    today,
    week,
    totalWeeks: TOTAL_TEACHING_WEEKS,
    professor: disc?.professor,
    professorTitle: disc?.professorTitle,
    hours: disc?.chTotal,
    nextEvaluations,
    upcomingEvents: events,
    examWeek,
    prioridades: buildPriorities(sp),
    studentStats: {
      materialsDone: sp.progress.completedMaterials.length,
      materialsTotal: allMaterials.length,
      topicsDone: topics?.doneTopics ?? 0,
      topicsTotal: topics?.totalTopics ?? 0,
      pomodoroMinutes: sp.progress.pomodoroSessions.reduce((acc, s) => acc + s.focusMinutes, 0),
      // LEITNER VIVO (116): o contexto do tutor é montado NO MOMENTO do
      // pedido — o seletor puro com Date.now() garante que a IA ouça o
      // vencimento real do baralho, não o memo cacheado de renders passados.
      flashcardsDue: flashcardsDueFor(sp.allFlashcards, Date.now()).length,
      exercisesSolved: sp.totalExercisesSolved,
      exercisesTotal: getExerciseStats().total,
    },
  };
}
