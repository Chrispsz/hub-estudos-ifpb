/**
 * Montagem das perguntas de debriefing do Simulado Pro para o tutor IA.
 *
 * Usado em DOIS lugares:
 *  - simulado-view: resultado fresco (dados ao vivo, pergunta montada na hora);
 *  - simulado-history: tentativas antigas gravadas no histórico (SimuladoRun).
 *
 * Assim o debriefing deixa de existir só no momento pós-prova: qualquer
 * tentativa do histórico (ou a evolução entre elas) pode ser analisada pela IA.
 */

import { getDisciplineByCode } from '@/data/course-data';
import type { RunQuestionDetail, SimuladoRun } from '@/lib/study-progress';
import { normalizeMode, type AttemptMode } from '@/lib/simulado-resume';
import { capQuestion } from '@/lib/tutor-stream';
import {
  MATH_SIMULADO_DATE,
  findMathSimuladoRunOficial,
  topicRowsFor,
} from '@/lib/math-exam-prep';

export function fmtClockSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

function difficultyLabel(d?: string): string {
  return d === 'facil' ? 'Fácil' : d === 'medio' ? 'Médio' : d === 'dificil' ? 'Difícil' : '—';
}

function discShort(code?: string): string {
  return (code && getDisciplineByCode(code)?.shortName) || code || '—';
}

/**
 * ONDE O TEMPO FOI (t192) — o resumo de pacing de uma tentativa.
 *
 * A Av1 real tem relógio: saber que a q3 comeu 18 dos 60 minutos muda a
 * estratégia da prova (pular e voltar). A função lê os tempos por questão
 * (segundos) e devolve o que o strip do debrief e a IA precisam:
 *  - totalSec: a soma do tempo que passou EM questões (a pausa não entra —
 *    o cronômetro congela fechado);
 *  - slowestIdx: a questão mais lenta (0-based; −1 quando nada foi medido);
 *  - measured: existe ao menos uma questão com tempo > 0 (runs antigos,
 *    pré-t192, não têm o campo — e a superfície CALA: sem registro não há
 *    linha, regra 88).
 *
 * PURA e honesta com lixo: undefined/null/NaN/negativo viram 0 — um tempo
 * corrompido nunca inventa um "mais lento" falso. Empate no máximo fica com
 * a PRIMEIRA (a mais antiga — a que travou primeiro merece o olhar).
 */
export interface PacingSummary {
  totalSec: number;
  slowestIdx: number;
  measured: boolean;
}

export function pacingFor(times: ReadonlyArray<number | null | undefined>): PacingSummary {
  const safe = times.map((t) =>
    typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : 0,
  );
  const totalSec = safe.reduce((acc, t) => acc + t, 0);
  let slowestIdx = -1;
  let slowest = 0;
  safe.forEach((t, i) => {
    if (t > slowest) {
      slowest = t;
      slowestIdx = i;
    }
  });
  return { totalSec, slowestIdx, measured: totalSec > 0 };
}

/**
 * O run é o SIMULADO OFICIAL da Av1 (o ensaio real do dia marcado, prova de
 * Matemática)? MESMOS critérios do findMathSimuladoRunOficial — fonte única,
 * sem critério paralelo para divergir. Serve para o debrief declarar a
 * NATUREZA do ensaio: a IA analisa uma prova oficial (stake real, meta de
 * aprovação) diferente de um treino (repetição).
 */
export function isSimuladoRunOficial(run: SimuladoRun): boolean {
  return findMathSimuladoRunOficial([run])?.id === run.id;
}

/**
 * Hoje é o dia do simulado oficial? (usado na rodada FRESCA — o run acabou de
 * terminar e pode ainda não estar no histórico que a função acima lê.)
 */
export function isSimuladoDayToday(): boolean {
  return (
    new Date().toDateString() ===
    new Date(`${MATH_SIMULADO_DATE}T12:00:00`).toDateString()
  );
}

/**
 * Debriefing detalhado a partir dos detalhes por questão (rodada ao vivo ou
 * tentativa do histórico que gravou `questions`). Compacta: status, disciplina,
 * tópico, dificuldade e enunciado truncado — e pede análise de professor.
 *
 * `isOficial` declara que ESTE foi o simulado oficial da Av1 (ensaio real):
 * a abertura muda de tom — a IA sabe que há meta de aprovação e prova real
 * chegando, e prioriza o plano para os dias que faltam.
 */
export function buildDebriefFromDetails(input: {
  mode?: AttemptMode;
  pct: number;
  elapsedSec: number;
  details: RunQuestionDetail[];
  isOficial?: boolean;
}): string {
  const { pct, elapsedSec, details, isOficial } = input;
  const mode = normalizeMode(input.mode);
  // A abertura declara a NATUREZA — a IA analisa um treino como treino
  // (feedback de repetição) e não como prova (simulação de exam day).
  // O ENSAIO OFICIAL merece abertura própria: stake real, meta de aprovação,
  // e o plano serve à prova que vem — não à repetição.
  const abertura =
    mode === 'treino'
      ? 'Acabei de terminar um TREINO no Hub (drill do Caderno de Erros — repetição dos meus erros, não prova). Analisa como um professor faria na correção e monta um plano de revisão CURTO e organizado.'
      : mode === 'topico'
        ? 'Acabei de terminar um treino CURTO de um único tópico no Hub (replay de tópico, não prova completa). Analisa como um professor faria na correção e monta um plano de revisão CURTO e organizado.'
        : isOficial
          ? 'Acabei de terminar o SIMULADO OFICIAL da Av1 no Hub — o ensaio REAL da prova de Matemática, com meta de aprovação (≥ 70). Analisa meu desempenho como um professor faria na correção de um ensaio oficial e monta o plano de revisão CURTO e organizado para os dias que faltam até a prova.'
          : 'Acabei de terminar um simulado no Hub. Analisa meu desempenho como um professor faria na correção e monta um plano de revisão CURTO e organizado.';
  // O PACING na linha (t192): corridas novas gravam timeSec; antigas não —
  // a linha velha permanece idêntica (compatibilidade silenciosa, sem
  // "— 00:00" inventado para quem não mediu).
  const lines = details.map((q, i) => {
    const status =
      q.status === 'solved' ? 'CONSEGUI' : q.status === 'missed' ? 'NÃO CONSEGUI' : 'PULADA';
    const tempo =
      typeof q.timeSec === 'number' && Number.isFinite(q.timeSec) && q.timeSec > 0
        ? ` · ${fmtClockSec(Math.round(q.timeSec))}`
        : '';
    return `- Q${i + 1} [${discShort(q.disciplineCode)} · ${q.topic || '—'} · ${difficultyLabel(q.difficulty)}] ${status}${tempo} — ${(q.statement || '').slice(0, 110)}`;
  });
  // O pedido de ritmo SÓ nasce quando há tempo medido — pedir análise de
  // pacing sobre dados que não existem seria ensaiar adivinhação.
  const temPacing = details.some(
    (q) => typeof q.timeSec === 'number' && Number.isFinite(q.timeSec) && q.timeSec > 0,
  );
  const pedidos = temPacing
    ? 'Na resposta: (1) o padrão dos meus erros (tópicos recorrentes? dificuldade? descuido?), (2) a ordem certa de revisão, (3) um exercício de treino por tópico fraco e (4) o RITMO — alguma questão comeu tempo demais para uma prova cronometrada (onde eu deveria ter pulado e voltado depois)?'
    : 'Na resposta: (1) o padrão dos meus erros (tópicos recorrentes? dificuldade? descuido?), (2) a ordem certa de revisão e (3) um exercício de treino por tópico fraco.';
  return capQuestion(
    [
      abertura,
      `Aproveitamento: ${pct}% · tempo total: ${fmtClockSec(elapsedSec)}.`,
      'Resultado por questão:',
      ...lines,
      '',
      pedidos,
    ].join('\n'),
  );
}

/**
 * Debriefing de uma tentativa DO HISTÓRICO. Com detalhes por questão, é tão
 * completo quanto o debriefing ao vivo; sem (tentativas antigas, pré-detail),
 * trabalha com os agregados gravados — honesto sobre o que sabe.
 */
export function buildRunDebriefQuestion(run: SimuladoRun): string {
  const mode = normalizeMode(run.mode);
  // O oficial se declara SOZINHO (critério único do math-exam-prep): o dono
  // clica o Sparkles de qualquer linha — se a linha é o ensaio da Av1, a IA
  // precisa saber com o que está lidando sem ninguém lembrar de avisar.
  const oficial = isSimuladoRunOficial(run);
  if (run.questions && run.questions.length > 0) {
    const pergunta = buildDebriefFromDetails({
      mode,
      pct: run.total > 0 ? Math.round((run.solved / run.total) * 100) : 0,
      elapsedSec: run.durationSec,
      details: run.questions,
      isOficial: oficial,
    });
    // O SINO CONFESSA (t192): a tentativa que o relógio encerrou diz isso à
    // IA — "acabou o tempo" e "desisti" são diagnósticos DIFERENTES (o
    // primeiro pede estratégia de pacing, o segundo pede conteúdo).
    return run.endedByClock
      ? `${pergunta}\n\nObservação: a prova foi encerrada PELO RELÓGIO (00:00) — o que ficou em branco ficou em branco. Considere isso no diagnóstico de ritmo.`
      : pergunta;
  }
  const natureza =
    mode === 'treino'
      ? 'um TREINO (drill do caderno)'
      : mode === 'topico'
        ? 'um treino de tópico'
        : oficial
          ? 'o SIMULADO OFICIAL da Av1 (o ensaio real da prova de Matemática, com meta de aprovação)'
          : 'um simulado';
  const partes = [
    `aproveitamento ${run.total > 0 ? Math.round((run.solved / run.total) * 100) : 0}%`,
    `${run.solved}/${run.total} resolvidas`,
    `${run.missed} que não consegui`,
    `${run.skipped} puladas`,
    `tempo ${fmtClockSec(run.durationSec)}`,
    ...(run.endedByClock ? ['encerrada PELO RELÓGIO (00:00)'] : []),
  ];
  const filtros: string[] = [];
  if (run.filters?.discipline) filtros.push(discShort(run.filters.discipline));
  if (run.filters?.difficulty) filtros.push(run.filters.difficulty);
  return [
    `Este registro é de ${natureza} feito em ${fmtDate(run.date)} (antes de o Hub gravar os detalhes por questão), então só tenho os totais: ${partes.join(' · ')}${filtros.length ? ` · filtros: ${filtros.join(', ')}` : ''}.`,
    '',
    'Como professor, me diz: o que esses números indicam sobre minhas dificuldades, e qual plano de revisão CURTO você sugere a partir daqui? Se precisar, me sugira um novo simulado focado no ponto fraco provável.',
  ].join('\n');
}

/**
 * Tendência POR TÓPICO entre tentativas (a série do histórico deixa de ser
 * só uma nota geral): agrega as questões de cada SimuladoRun que gravou
 * `questions`, por disciplina::tópico, e devolve a sequência cronológica de
 * aproveitamento de cada tópico — quem sobe, quem desce, quem está estagnado.
 *
 * A RÉGUA É A ÚNICA DA CASA (t190): a agregação por tentativa vem de
 * topicRowsFor (math-exam-prep) — taxa sobre RESPONDIDAS, puladas contadas
 * à parte, bloco inteiro pulado → pct null. A versão antiga desta função
 * dividia solved/TOTAL e era a ÚLTIMA régua velha viva: vestia o bloco
 * nunca tentado com o "0%" do tentou-e-errou nos chips "foco da prova" da
 * home, na média do score de prontidão e na série que a IA do tutor lê.
 *
 * Regras:
 *  - `runs` chega na ordem de gravação (mais recente PRIMEIRO) — aqui vira
 *    cronologia interna (reversa), então cada série é antiga → recente;
 *  - tentativas sem detalhes por questão (antigas) simplesmente não contribuem;
 *  - first/last/delta são null quando a tentativa correspondente NÃO tem taxa
 *    (bloco inteiro pulado — nunca inventa número);
 *  - pior tópico ATUAL primeiro (o foco de revisão) — a MESMA regra da casa:
 *    pulou-tudo vem ANTES de qualquer taxa (key −1, doutrina t189), depois a
 *    menor taxa, tie-break: mais tentativas.
 */
export interface TopicTrendPoint {
  /** null = o tópico inteiro pulado NAQUELA tentativa (sem taxa honesta). */
  pct: number | null;
  date: string;
}

export interface TopicTrend {
  disciplineCode: string;
  topic: string;
  /** Aproveitamento por tentativa em que o tópico apareceu (antiga → recente). */
  series: TopicTrendPoint[];
  /** Taxa da 1ª tentativa; null = a 1ª tentativa pulou o bloco inteiro. */
  first: number | null;
  /** Taxa da ÚLTIMA tentativa; null = a última pulou o bloco inteiro — é o
   *  diagnóstico mais grave e a superfície que decide o foco trata null como
   *  "pulou tudo" (nunca "0%"). */
  last: number | null;
  /** last − first em pontos percentuais; null quando não há taxas dos dois
   *  lados para comparar (1 tentativa, ou pulado numa das pontas). */
  delta: number | null;
}

export function computeTopicTrends(runs: SimuladoRun[]): TopicTrend[] {
  const chrono = [...runs].reverse().filter((r) => r.questions && r.questions.length > 0);
  const m = new Map<string, { disciplineCode: string; topic: string; series: TopicTrendPoint[] }>();
  for (const r of chrono) {
    // A AGREGAÇÃO por tentativa vem da FONTE ÚNICA (t189/t190): topicRowsFor —
    // taxa sobre respondidas, pulada sem taxa. Uma corrida pode repetir
    // tópico; topicRowsFor já agrupa por disciplina::tópico dentro dela.
    for (const row of topicRowsFor(r.questions!)) {
      if (row.topic === '—') continue;
      const key = `${row.disciplineCode}::${row.topic}`;
      const cur = m.get(key) ?? { disciplineCode: row.disciplineCode, topic: row.topic, series: [] };
      cur.series.push({ pct: row.pct, date: r.date });
      m.set(key, cur);
    }
  }
  return [...m.values()]
    .map((t) => {
      const first = t.series[0]?.pct ?? null;
      const last = t.series[t.series.length - 1]?.pct ?? null;
      const delta =
        t.series.length >= 2 && first !== null && last !== null ? last - first : null;
      return { ...t, first, last, delta };
    })
    .sort(
      (a, b) =>
        (a.last === null ? -1 : a.last) - (b.last === null ? -1 : b.last) ||
        b.series.length - a.series.length,
    );
}

/**
 * Análise de EVOLUÇÃO: envia a série de tentativas (mais antigas → recentes)
 * para o tutor ler a tendência e apontar o foco da próxima semana — pensado
 * para a véspera de prova (Av1). Inclui a TENDÊNCIA POR TÓPICO quando as
 * tentativas gravaram detalhes por questão.
 */
export function buildTrendQuestion(runs: SimuladoRun[]): string {
  // ATENÇÃO à ordem de gravação: runs[0] é a tentativa MAIS RECENTE —
  // pegamos as 12 mais recentes e revertemos para cronologia real.
  const recentes = [...runs].slice(0, 12).reverse();
  const serie = recentes.map((r) => {
    const pct = r.total > 0 ? Math.round((r.solved / r.total) * 100) : 0;
    const disc = r.filters?.discipline
      ? discShort(r.filters.discipline)
      : (r.questions && [...new Set(r.questions.map((q) => discShort(q.disciplineCode)).filter((d) => d !== '—'))].slice(0, 2).join('+')) || 'geral';
    // O ensaio OFICIAL se marca na série: a IA lê a tendência sabendo qual
    // linha é a simulação de exam day (a referência que importa) — e não
    // mais um treino entre treinos.
    const marca = isSimuladoRunOficial(r) ? ' · ENSAIO OFICIAL da Av1' : '';
    return `- ${fmtDate(r.date)}: ${pct}% (${r.solved}/${r.total}) · ${disc} · ${fmtClockSec(r.durationSec)}${marca}`;
  });

  // Tendência por tópico (só tentativas com detalhes por questão contribuem).
  // A série fala a língua do pulado (t190): tentativa com bloco inteiro pulado
  // aparece como "pulou" — nunca "0%", a IA não pode ler um erro que não houve.
  const trends = computeTopicTrends(runs).slice(0, 6);
  const topicLines = trends.map((t) => {
    const seq = t.series.map((p) => (p.pct === null ? 'pulou' : `${p.pct}%`)).join(' → ');
    const delta =
      t.delta !== null
        ? ` (Δ ${t.delta >= 0 ? '+' : ''}${t.delta}pp)`
        : t.last === null
          ? t.series.length >= 2
            ? ' (última: bloco pulado — sem taxa)'
            : ' (bloco pulado — sem taxa)'
          : ' (1ª tentativa)';
    return `- ${discShort(t.disciplineCode)} · ${t.topic}: ${seq}${delta}`;
  });

  const blocks = [
    `Essa é a minha série de simulados no Hub (${Math.min(runs.length, 12)} tentativas${runs.length > 12 ? ', das 12 mais recentes' : ''}, da mais antiga para a mais recente). Analisa minha EVOLUÇÃO como um coach de estudos:`,
    ...serie,
  ];
  if (topicLines.length > 0) {
    blocks.push(
      '',
      'Aproveitamento POR TÓPICO entre tentativas (ordem cronológica; Δ = variação em pontos percentuais):',
      ...topicLines,
    );
  }
  blocks.push(
    '',
    'Na resposta: (1) a tendência geral (estou melhorando, estagnado ou piorando — e o que isso sugere?), (2) a tendência POR TÓPICO — quem sobe, quem desce, quem estagnou — e se o tópico em pior situação é o mais importante para a próxima prova, e (3) um plano curto para os próximos dias priorizando o que mais me faria subir a nota. Seja direto e honesto, sem elogio vazio.',
  );
  return capQuestion(blocks.join('\n'));
}
