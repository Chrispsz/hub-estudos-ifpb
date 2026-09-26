/**
 * SCORE DE PRONTIDÃO DA AV1 — um número honesto (0–100) que junta as
 * 5 evidências REAIS de preparação que o Hub já registra. Nada inventado:
 * cada componente nasce de dados que o dono gerou (corridas de simulado,
 * checkboxes do plano/checklist, cartões do baralho, exercícios de apoio).
 *
 * Regra de honestidade: componente sem dado é EXCLUÍDO da média (os pesos
 * dos restantes são renormalizados) e aparece marcado "sem dados" na UI —
 * o score nunca inventa prontidão. Antes do primeiro dado, score = null.
 *
 * Pesos: simulado 30 · exercícios 20 · checklist 20 · baralho 15 · plano 15.
 * O simulado pesa mais porque é a única evidência em CONDIÇÕES DE PROVA.
 */

import { exercises } from './exercise-extractor';
import { collectMistakes, pendingMistakes } from './mistake-notebook';
import {
  MATH_CHECKLIST,
  MATH_EXAM,
  MATH_EXAM_PLAN,
} from './math-exam-prep';
import type { StudyProgress } from './study-progress';
import { capQuestion } from './tutor-stream';

// ---------- Tipos ----------

export type ReadinessComponentId =
  | 'simulado'
  | 'exercicios'
  | 'checklist'
  | 'baralho'
  | 'plano';

export interface ReadinessComponent {
  id: ReadinessComponentId;
  label: string;
  /** 0–100 quando há dados; null = sem dados (excluído do cálculo). */
  pct: number | null;
  /** Evidência em texto: "última: 60% (26/09)", "4/12 tópicos marcados"… */
  detail: string;
}

export type ReadinessTone = 'pronto' | 'quase' | 'atencao';

export interface ReadinessResult {
  /** Média ponderada dos componentes com dados (0–100); null = nada medido. */
  score: number | null;
  tone: ReadinessTone;
  components: ReadinessComponent[];
  /** Erros pendentes no caderno, só Matemática — contexto para a IA. */
  pendentesMat: number;
}

// ---------- Pesos e helpers ----------

const WEIGHTS: Record<ReadinessComponentId, number> = {
  simulado: 30,
  exercicios: 20,
  checklist: 20,
  baralho: 15,
  plano: 15,
};

/** Pool de apoio do plano D-7 — os exercícios que o próprio plano manda fazer. */
const EXAM_EXERCISE_POOL = [
  ...new Set(
    MATH_EXAM_PLAN.flatMap((d) => d.tarefas.flatMap((t) => t.exercisePool ?? [])),
  ),
].filter((id) => exercises.some((e) => e.id === id));

function fmtDDMM(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

function runPct(solved: number, total: number): number {
  return total > 0 ? Math.round((solved / total) * 100) : 0;
}

function toneFor(score: number): ReadinessTone {
  if (score >= 70) return 'pronto';
  if (score >= 40) return 'quase';
  return 'atencao';
}

// ---------- Cálculo ----------

export function computeReadiness(
  progress: StudyProgress,
  planChecked: Record<string, boolean>,
  checklistChecked: Record<string, boolean>,
): ReadinessResult {
  const components: ReadinessComponent[] = [];

  // 1) Simulado — a evidência em condições de prova. Prefere corridas da
  //    disciplina da prova; sem nenhuma, usa a última corrida geral (honesto:
  //    é a melhor evidência disponível, e o detail diz de onde vem).
  const mathRuns = (progress.simuladoRuns ?? []).filter(
    (r) => r.filters?.discipline === MATH_EXAM.disciplineCode,
  );
  const pool = mathRuns.length > 0 ? mathRuns : (progress.simuladoRuns ?? []);
  if (pool.length > 0) {
    const last = [...pool].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];
    const pct = runPct(last.solved, last.total);
    components.push({
      id: 'simulado',
      label: 'Simulado da prova',
      pct,
      detail: `${mathRuns.length > 0 ? 'última' : 'corrida geral'}: ${pct}% (${fmtDDMM(last.date)})`,
    });
  } else {
    components.push({
      id: 'simulado',
      label: 'Simulado da prova',
      pct: null,
      detail: 'sem dados — a evidência mais importante ainda não existe',
    });
  }

  // 2) Exercícios de apoio do plano (pool real do acervo, ids válidos).
  if (EXAM_EXERCISE_POOL.length > 0) {
    const solved = EXAM_EXERCISE_POOL.filter(
      (id) => progress.exerciseProgress[id]?.solved,
    ).length;
    components.push({
      id: 'exercicios',
      label: 'Exercícios de apoio',
      pct: Math.round((solved / EXAM_EXERCISE_POOL.length) * 100),
      detail: `${solved}/${EXAM_EXERCISE_POOL.length} resolvidos (apoio do plano)`,
    });
  } else {
    components.push({ id: 'exercicios', label: 'Exercícios de apoio', pct: null, detail: 'sem pool no plano' });
  }

  // 3) Checklist de domínio — só os grupos que CAEM na prova (o grupo
  //    "Pós-prova — NÃO cai" não conta: dominá-lo não é prontidão).
  const coreGroups = MATH_CHECKLIST.filter((g) => !g.grupo.includes('NÃO cai'));
  const totalItens = coreGroups.reduce((a, g) => a + g.itens.length, 0);
  const checkedItens = coreGroups.reduce(
    (a, g) => a + g.itens.filter((_, i) => checklistChecked[`${g.grupo}-${i}`]).length,
    0,
  );
  components.push({
    id: 'checklist',
    label: 'Checklist de domínio',
    pct: totalItens > 0 ? Math.round((checkedItens / totalItens) * 100) : null,
    detail: `${checkedItens}/${totalItens} tópicos marcados (fora do escopo não conta)`,
  });

  // 4) Baralho da Av1 — cartões "maduros" = caixa ≥ 2 no sistema Leitner.
  const deck = (progress.flashcards ?? []).filter(
    (c) => c.disciplineCode === MATH_EXAM.disciplineCode,
  );
  if (deck.length > 0) {
    const mature = deck.filter((c) => c.box >= 2).length;
    components.push({
      id: 'baralho',
      label: 'Baralho da Av1',
      pct: Math.round((mature / deck.length) * 100),
      detail: `${mature}/${deck.length} cartões maduros (caixa ≥ 2)`,
    });
  } else {
    components.push({
      id: 'baralho',
      label: 'Baralho da Av1',
      pct: null,
      detail: 'sem dados — o baralho ainda não foi adicionado',
    });
  }

  // 5) Plano D-7 — tarefas do dia a dia marcadas como feitas.
  const totalTasks = MATH_EXAM_PLAN.reduce((a, d) => a + d.tarefas.length, 0);
  const doneTasks = Object.values(planChecked).filter(Boolean).length;
  components.push({
    id: 'plano',
    label: 'Plano D-7',
    pct: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null,
    detail: `${doneTasks}/${totalTasks} tarefas do plano feitas`,
  });

  // Score = média ponderada só dos componentes COM dados (renormalizados).
  const withData = components.filter((c) => c.pct !== null) as (ReadinessComponent & { pct: number })[];
  const weightSum = withData.reduce((a, c) => a + WEIGHTS[c.id], 0);
  const score =
    weightSum > 0
      ? Math.round(withData.reduce((a, c) => a + c.pct * WEIGHTS[c.id], 0) / weightSum)
      : null;

  // Caderno de Erros: pendentes SÓ da disciplina da prova — erro antigo de
  // outra disciplina não reduz prontidão da Av1, mas conta como contexto.
  const pendentesMat = pendingMistakes(
    collectMistakes(progress),
    progress.notebookRevised,
  ).filter((m) => m.disciplineCode === MATH_EXAM.disciplineCode).length;

  return {
    score,
    tone: score === null ? 'atencao' : toneFor(score),
    components,
    pendentesMat,
  };
}

// ---------- Pergunta para a IA ----------

/**
 * Prompt do coach: score + evidências reais + 3 pedidos (o que pesa contra,
 * plano dia a dia com as listas reais, o que NÃO estudar). Capped por
 * capQuestion (nunca 400 — lição do 47).
 */
export function buildReadinessQuestion(
  daysLeft: number,
  result: ReadinessResult,
  pendentesMat: number,
): string {
  const head =
    result.score === null
      ? 'Faltam ' +
        daysLeft +
        ' dias para a Av1 de Matemática (prova 01/10). O Hub ainda NÃO tem dados suficientes para calcular meu score de prontidão.'
      : 'Faltam ' +
        daysLeft +
        ' dias para a Av1 de Matemática (prova 01/10). O Hub calculou meu SCORE DE PRONTIDÃO: ' +
        result.score +
        '/100.';

  const linhas = result.components.map((c) => {
    const evidencia = c.pct === null ? c.detail : `${c.detail} → ${c.pct}%`;
    return `- ${c.label}: ${evidencia}`;
  });

  const cadernoLinha =
    pendentesMat > 0
      ? `- Caderno de Erros: ${pendentesMat} pendente(s) na Matemática (erros que ainda não revisei)`
      : '- Caderno de Erros: nada pendente na Matemática';

  const q = [
    head,
    'Evidências reais registradas pelo Hub:',
    ...linhas,
    cadernoLinha,
    '',
    'Responda em 3 partes, como coach — direto, sem elogio vazio:',
    '1. O que MAIS pesa contra a minha prontidão agora e por quê (olhando os componentes acima).',
    '2. Plano concreto de hoje até 01/10, dia a dia, citando as listas reais (Matrizes Q1–16, Q17–30, Q31–35; Lógica Q1–12, Q13–18) e materiais do Hub.',
    '3. O que NÃO estudar nesses dias (fora do escopo da prova) para não desperdiçar as horas restantes.',
  ].join('\n');

  return capQuestion(q);
}
