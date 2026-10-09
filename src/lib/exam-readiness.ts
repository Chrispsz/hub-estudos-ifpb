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
  MATH_META,
} from './math-exam-prep';
import { computeTopicTrends } from './simulado-debrief';
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
  /**
   * Domínio ATUAL por tópico do escopo da prova (última tentativa de cada
   * tópico), quando as corridas gravam detalhe por questão. É o que o
   * componente "simulado" passa a usar como evidência — não só a última
   * nota geral. Undefined = sem detalhe por questão (fallback à nota geral).
   */
  topicMastery?: ReadinessTopicMastery[];
}

/** Distância até a meta de aprovação da Av1 (≥ 70): "faltam Xpp" ou "folga de Xpp". */
export function metaGapText(pct: number): string {
  return pct >= MATH_META
    ? `meta batida (+${pct - MATH_META}pp de folga)`
    : `faltam ${MATH_META - pct}pp para a meta ${MATH_META}`;
}

/** Um tópico do escopo da prova e o seu aproveitamento mais recente. */
export interface ReadinessTopicMastery {
  topic: string;
  /** Último aproveitamento do tópico (0–100); null = o bloco foi INTEIRO
   *  pulado na última tentativa — sem taxa (a régua única da casa: nunca
   *  "0% falso", o pulado não veste a tinta do erro). */
  pct: number | null;
  /** Variação em pp entre a 1ª e a última tentativa; null quando não há
   *  taxas dos dois lados para comparar (pulado numa das pontas). */
  delta: number | null;
  /** Quantas tentativas com detalhe alimentaram este tópico. */
  attempts: number;
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

  // 1) Simulado — a evidência em condições de prova. COM detalhe por questão,
  //    sobe de nível: usa o domínio ATUAL de cada tópico do escopo da prova
  //    (última tentativa de cada um — a média de onde você ESTÁ, não de uma
  //    única prova). Sem detalhe, cai para a última corrida (honesto sobre a
  //    origem no detail). Tópico do escopo sem evidência fica explícito.
  const mathRuns = (progress.simuladoRuns ?? []).filter(
    (r) => r.filters?.discipline === MATH_EXAM.disciplineCode,
  );
  const pool = mathRuns.length > 0 ? mathRuns : (progress.simuladoRuns ?? []);
  const scopeTrends = computeTopicTrends(progress.simuladoRuns ?? []).filter(
    (t) =>
      t.disciplineCode === MATH_EXAM.disciplineCode &&
      (MATH_EXAM.topicosEscopo as readonly string[]).includes(t.topic),
  );
  const topicMastery: ReadinessTopicMastery[] | undefined =
    scopeTrends.length > 0
      ? scopeTrends.map((t) => ({
          topic: t.topic,
          pct: t.last,
          delta: t.delta,
          attempts: t.series.length,
        }))
      : undefined;
  // A RÉGUA HONESTA POR TÓPICO (t190): tópico com bloco inteiro pulado na
  // última tentativa não tem taxa — e a regra de honestidade dos componentes
  // vige DENTRO do componente: a média do "simulado" é renormalizada sobre os
  // tópicos COM taxa (o pulado não entra como 0% fingindo que foi tentado).
  // Todo o escopo sem taxa → o componente volta à última geral, confessando
  // os blocos pulados no detail (o número geral é a nota da prova; a ausência
  // de taxa por tópico é confissão, não invenção).
  const comTaxa = (topicMastery ?? []).filter(
    (t): t is ReadinessTopicMastery & { pct: number } => t.pct !== null,
  );
  const semTaxa = (topicMastery ?? []).filter((t) => t.pct === null);
  if (pool.length > 0) {
    const last = [...pool].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];
    const pctRun = runPct(last.solved, last.total);
    if (topicMastery && comTaxa.length > 0) {
      // Média do domínio atual dos tópicos COM taxa (renormalizado — a mesma
      // regra de honestidade dos componentes, agora por tópico; o bloco
      // pulado é confissão à parte, não zero na média).
      const pct = Math.round(
        comTaxa.reduce((a, t) => a + t.pct, 0) / comTaxa.length,
      );
      const missing = (MATH_EXAM.topicosEscopo as readonly string[]).filter(
        (tp) => !topicMastery.some((t) => t.topic === tp),
      );
      const attempts = topicMastery.reduce((a, t) => a + t.attempts, 0);
      components.push({
        id: 'simulado',
        label: 'Simulado da prova',
        pct,
        detail: `domínio por tópico do escopo (${attempts} tentativas c/ detalhe) · última geral: ${pctRun}% · ${metaGapText(pct)}${missing.length > 0 ? ` · falta evidência: ${missing.join(', ')}` : ''}${semTaxa.length > 0 ? ` · sem taxa (bloco pulado): ${semTaxa.map((t) => t.topic).join(', ')}` : ''}`,
      });
    } else if (topicMastery && comTaxa.length === 0) {
      // O ESCOPO INTEIRO SEM TAXA: toda a última tentativa pulou os blocos —
      // a média por tópico não existe e a última geral assume, com a
      // confissão dos blocos no detail (nunca um 0% inventado por tópico).
      components.push({
        id: 'simulado',
        label: 'Simulado da prova',
        pct: pctRun,
        detail: `última geral: ${pctRun}% (${fmtDDMM(last.date)}) · ${metaGapText(pctRun)} · bloco(s) inteiro(s) pulado(s): ${semTaxa.map((t) => t.topic).join(', ')}`,
      });
    } else {
      components.push({
        id: 'simulado',
        label: 'Simulado da prova',
        pct: pctRun,
        detail: `${mathRuns.length > 0 ? 'última' : 'corrida geral'}: ${pctRun}% (${fmtDDMM(last.date)}) · ${metaGapText(pctRun)}`,
      });
    }
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
    topicMastery,
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
        '/100 (meta de aprovação da Av1: ≥ ' +
        MATH_META +
        ').'

  const linhas = result.components.map((c) => {
    const evidencia = c.pct === null ? c.detail : `${c.detail} → ${c.pct}%`;
    return `- ${c.label}: ${evidencia}`;
  });

  // Domínio por tópico do escopo — a IA enxerga ONDE está o foco real. A voz
  // do pulado é honesta (t190): bloco inteiro pulado é "pulou tudo", não "0%"
  // — a IA não pode montar um plano de revisão sobre um erro que não houve.
  const dominioBloco = result.topicMastery
    ? [
        '',
        'Domínio ATUAL por tópico do escopo da prova (última tentativa de cada tópico; Δ = variação entre 1ª e última):',
        ...result.topicMastery.map(
          (t) =>
            t.pct === null
              ? `- ${t.topic}: pulou tudo (sem taxa na última tentativa — o bloco inteiro foi pulado) em ${t.attempts} tentativa${t.attempts === 1 ? '' : 's'}`
              : `- ${t.topic}: ${t.pct}%${t.delta !== null ? ` (Δ ${t.delta >= 0 ? '+' : ''}${t.delta}pp` : ''} em ${t.attempts} tentativa${t.attempts === 1 ? '' : 's'}${t.delta !== null ? ')' : ''}`,
        ),
      ]
    : [];

  const cadernoLinha =
    pendentesMat > 0
      ? `- Caderno de Erros: ${pendentesMat} pendente(s) na Matemática (erros que ainda não revisei)`
      : '- Caderno de Erros: nada pendente na Matemática';

  const q = [
    head,
    'Evidências reais registradas pelo Hub:',
    ...linhas,
    ...dominioBloco,
    cadernoLinha,
    '',
    'Responda em 3 partes, como coach — direto, sem elogio vazio:',
    '1. O que MAIS pesa contra a minha prontidão agora e por quê (olhando os componentes acima' +
      (result.topicMastery ? ' e o domínio por tópico do escopo' : '') + ').',
    '2. Plano concreto de hoje até 01/10, dia a dia, citando as listas reais (Matrizes Q1–16, Q17–30, Q31–35; Lógica Q1–12, Q13–18) e materiais do Hub.',
    '3. O que NÃO estudar nesses dias (fora do escopo da prova) para não desperdiçar as horas restantes.',
  ].join('\n');

  return capQuestion(q);
}
