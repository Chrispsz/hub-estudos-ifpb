/**
 * Task 190 — A ÚLTIMA RÉGUA VELHA (o foco da prova da home, a prontidão e a
 * tendência do tutor falam a língua do pulado).
 *
 * O QA vivo da rodada achou a QUARTA (e quinta) superfície com a régua velha:
 * computeTopicTrends (simulado-debrief) agregava solved/TOTAL — puladas no
 * denominador — e vestia o bloco NUNCA TENTADO com o "0%" do tentou-e-errou:
 *   (1) os chips "foco da prova" do card da prova (HOME) — o dono terminou o
 *       simulado e a home dizia "Álgebra Matricial 0%" para o bloco inteiro
 *       pulado (o diagnóstico verdadeiro é "pulou tudo");
 *   (2) o componente "simulado" do SCORE DE PRONTIDÃO — o bloco pulado entra
 *       como 0% na média e derruba o score como se fosse erro;
 *   (3) a pergunta de TENDÊNCIA do tutor — a série dizia "0%" para tentativa
 *       pulada, mentindo para a IA;
 *   (4) o histórico de simulados — "Tendência por tópico" com barra cheia de
 *       erro para tentativa sem tentativa.
 *
 * A rodada entrega:
 *  (1) LIB: computeTopicTrends agrega via topicRowsFor (a fonte única da
 *      t189) — série por tentativa com pct null para bloco inteiro pulado;
 *      first/last/delta honestos (null quando não há taxa dos dois lados);
 *      sort pulouTudo-primeiro (a MESMA regra do foco).
 *  (2) HOME: os chips confessam "pulou tudo" em zinc (nunca 0% falso), o
 *      delta só existe com taxas dos dois lados, allGood exige taxa real,
 *      o title confessa a série inteira.
 *  (3) PRONTIDÃO: média renormalizada sobre os tópicos COM taxa (a regra de
 *      honestidade dos componentes, agora por tópico); escopo inteiro sem
 *      taxa → última geral + confissão; prompt da IA honesto ("pulou tudo").
 *  (4) TUTOR: a série diz "pulou" — a IA não lê um erro que não houve.
 *  (5) HISTÓRICO: barra OCA zinc para tentativa pulada, "pulou tudo" no
 *      lugar do número, chip "sem taxa" no lugar do gap de meta, badge
 *      "sem Δ" quando não há taxas comparáveis.
 *
 * Contrato (`bun tests/test-t190-foco-lingua-do-pulado.ts`):
 *  A. A RÉGUA ÚNICA NA TENDÊNCIA (execução): série honesta, null no pulado,
 *     delta só com taxas dos dois lados, sort pulouTudo-primeiro, PUREZA.
 *  B. A PRONTIDÃO (execução): média renormalizada sobre comTaxa; escopo
 *     inteiro sem taxa → última geral + confissão; prompt com "pulou tudo".
 *  C. A FIAÇÃO DA HOME: chips com zinc + "pulou tudo" + delta guard + title
 *     da série + allGood com taxa real.
 *  D. A FIAÇÃO DO HISTÓRICO: barra oca, "pulou tudo", "sem taxa", "sem Δ".
 *  E. O TUTOR: a série com "pulou" (nunca 0%).
 *  F. DOUTRINA: nenhuma segunda régua sobrevive no src (a agregação da
 *     tendência É topicRowsFor).
 *  G. REGRESSÕES: t189 (tabela), t188 (endereço), t185 (portas), t146.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}
function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}
/** Lê o arquivo SEM comentários e com whitespace normalizado — o contrato
 *  olha STRINGS de verdade (o que renderiza), não prosa de comentário. */
function code(rel: string): string {
  return src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');
}

import { topicRowsFor, sortWorstFirst } from '../src/lib/math-exam-prep';
import { computeTopicTrends, buildTrendQuestion } from '../src/lib/simulado-debrief';
import { computeReadiness } from '../src/lib/exam-readiness';
import type { SimuladoRun } from '../src/lib/study-progress';

// ---------------------------------------------------------------------------

console.log('A. A RÉGUA ÚNICA NA TENDÊNCIA (execução real)');

// O run do QA da rodada (a forma real do E2E): Álgebra INTEIRO pulado,
// Lógica mista (2C + 1N + 4P → 67% sobre respondidas, não 29% sobre total).
const runHoje: SimuladoRun = {
  id: 'r190-hoje',
  date: '2026-09-29T21:00:00.000Z',
  mode: 'simulado',
  durationSec: 1817,
  total: 10,
  solved: 2,
  missed: 1,
  skipped: 7,
  filters: { discipline: 'TEC.1984', difficulty: 'medio' },
  questions: [
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'skipped' },
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'skipped' },
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'skipped' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'solved' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'solved' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'missed' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'skipped' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'skipped' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'skipped' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'skipped' },
  ],
} as unknown as SimuladoRun;

const trends = computeTopicTrends([runHoje]);
ok(trends.length === 2, 'A: dois tópicos na tendência');
const algebra = trends.find((t) => t.topic === 'Álgebra Matricial')!;
const logica = trends.find((t) => t.topic === 'Lógica Matemática')!;
ok(!!algebra && !!logica, 'A: Álgebra e Lógica presentes');
ok(algebra.series.length === 1 && algebra.series[0].pct === null, 'A: Álgebra inteiro pulado → série [null] (nunca 0)');
ok(algebra.last === null && algebra.first === null && algebra.delta === null, 'A: Álgebra last/first/delta null (sem taxa inventada)');
ok(logica.series[0].pct === 67, `A: Lógica 67% sobre respondidas (não 29%) — veio ${logica.series[0].pct}`);
ok(logica.last === 67 && logica.first === 67 && logica.delta === null, 'A: Lógica last 67, delta null (1 tentativa)');
ok(trends[0].topic === 'Álgebra Matricial', 'A: pulouTudo vem PRIMEIRO (a regra do foco)');
ok(trends[1].topic === 'Lógica Matemática', 'A: taxa depois do pulado');

// A MESMA régua do debrief: a tendência e a tabela do debrief AGREGAM IGUAL.
const rows = sortWorstFirst(topicRowsFor(runHoje.questions ?? []));
ok(rows[0].topic === 'Álgebra Matricial' && rows[0].pct === null, 'A: a agregação da tendência = topicRowsFor (mesma ordem)');
ok(rows[1].pct === 67, 'A: a taxa da tendência = a taxa da tabela (67)');

// Série cronológica com pulado numa das pontas: delta null (sem taxa dos dois lados).
const runOntem: SimuladoRun = {
  ...runHoje,
  id: 'r190-ontem',
  date: '2026-09-28T21:00:00.000Z',
  questions: [
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'solved' },
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'missed' },
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'solved' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'skipped' },
    { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'skipped' },
  ],
  total: 5,
  solved: 2,
  missed: 1,
  skipped: 2,
} as unknown as SimuladoRun;
// runs chega mais-recente-PRIMEIRO (ordem de gravação do acervo)
const trends2 = computeTopicTrends([runHoje, runOntem]);
const alg2 = trends2.find((t) => t.topic === 'Álgebra Matricial')!;
const log2 = trends2.find((t) => t.topic === 'Lógica Matemática')!;
ok(alg2.series.length === 2 && alg2.series[0].pct === 67 && alg2.series[1].pct === null, 'A: série cronológica antiga → recente (67 → pulou)');
ok(alg2.first === 67 && alg2.last === null && alg2.delta === null, 'A: last null (a ÚLTIMA pulou) — delta não inventa');
ok(log2.series.length === 2 && log2.series[0].pct === null && log2.series[1].pct === 67, 'A: Lógica 1ª pulou, última 67');
ok(log2.delta === null, 'A: delta null quando uma das pontas pulou (nunca número falso)');

// Duas tentativas com taxas nos dois lados → delta existe.
const run2taxas: SimuladoRun = {
  ...runOntem,
  questions: [
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'solved' },
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'missed' },
    { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'skipped' },
  ],
  total: 3,
  solved: 2,
  missed: 1,
  skipped: 1,
} as unknown as SimuladoRun;
const trends3 = computeTopicTrends([run2taxas, runOntem]);
const alg3 = trends3.find((t) => t.topic === 'Álgebra Matricial')!;
ok(alg3.first === 67 && alg3.last === 50 && alg3.delta === -17, `A: delta com taxas nos dois lados (67 → 50 = -17) — veio ${alg3.delta}`);
ok(trends3[0].topic === 'Lógica Matemática', 'A: ordem final — pulou-tudo (Lógica na 2ª) primeiro, depois taxa menor');

// Run antigo sem detalhes não contribui; run vazio/lixo → tendência vazia.
const antigo: SimuladoRun = { ...runHoje, id: 'r190-antigo', questions: undefined } as unknown as SimuladoRun;
ok(computeTopicTrends([antigo]).length === 0, 'A: run sem detalhes não contribui (honesto sobre o que sabe)');
ok(computeTopicTrends([]).length === 0, 'A: vazio → vazio');

// PUREZA: a função não toca em React/DOM/storage/fetch.
const trendsSnapshot = JSON.stringify(computeTopicTrends([runHoje, runOntem]));
computeTopicTrends([runHoje, runOntem]);
ok(JSON.stringify(computeTopicTrends([runHoje, runOntem])) === trendsSnapshot, 'A: PURA — mesma entrada, mesma saída');
ok(alg2.series.length === 2, 'A: não muta as entradas internas');

console.log('B. A PRONTIDÃO (execução real)');

// Progresso mínimo com o run de hoje: a média do componente "simulado" é
// renormalizada sobre os tópicos COM taxa (67) — o pulado NÃO entra como 0.
const progressoBase = {
  simuladoRuns: [runHoje],
  exerciseProgress: {},
  flashcards: [],
  notebookRevised: [],
} as unknown as Parameters<typeof computeReadiness>[0];

const readiness = computeReadiness(progressoBase, {}, {});
const compSim = readiness.components.find((c) => c.id === 'simulado')!;
ok(compSim.pct === 67, `B: média renormalizada sobre comTaxa (67, não (67+0)/2=33) — veio ${compSim.pct}`);
ok(
  (compSim.detail ?? '').includes('sem taxa (bloco pulado): Álgebra Matricial'),
  'B: o detail CONFESSA o bloco pulado',
);
ok(readiness.topicMastery !== undefined, 'B: topicMastery existe');
ok(readiness.topicMastery!.some((t) => t.topic === 'Álgebra Matricial' && t.pct === null), 'B: topicMastery com pct null para o pulado');
ok(readiness.topicMastery!.some((t) => t.topic === 'Lógica Matemática' && t.pct === 67), 'B: topicMastery com taxa real para o respondido');

// A pergunta da IA leva a voz honesta (a IA não pode ler um erro que não houve).
// buildReadinessQuestion é exportada — executa e olha a linha do domínio.
import { buildReadinessQuestion } from '../src/lib/exam-readiness';
const q = buildReadinessQuestion(2, readiness, 0);
ok(q.includes('pulou tudo (sem taxa na última tentativa'), 'B: prompt da IA diz "pulou tudo" para o bloco pulado');
ok(!q.includes('Álgebra Matricial: 0%'), 'B: o prompt NUNCA diz "Álgebra: 0%"');

// O prompt da tendência (buildTrendQuestion) também fala a língua do pulado.
const qTrend = buildTrendQuestion([runHoje]);
ok(qTrend.includes('Álgebra Matricial: pulou'), 'E: a série do tutor diz "pulou"');
ok(!qTrend.includes('Álgebra Matricial: 0%'), 'E: a série do tutor NUNCA diz 0% para o pulado');
ok(qTrend.includes('67%'), 'E: a taxa real (67) vai para a IA');

console.log('C. A FIAÇÃO DA HOME (chips "foco da prova")');

const cardCode = code('src/components/hub/exam-prep-card.tsx');
ok(cardCode.includes("pulouTudo ? 'text-zinc-500 dark:text-zinc-400'"), 'C: o % do chip veste zinc quando pulado (nunca a tinta do erro)');
ok(cardCode.includes("pulouTudo ? 'pulou tudo' : `${t.last}%`"), 'C: o chip confessa "pulou tudo" no lugar do número');
ok(
  cardCode.includes("allGood: trends.every((t) => t.last !== null && t.last >= 80)"),
  'C: allGood exige taxa REAL (null não é "em dia")',
);
ok(cardCode.includes('t.series.length >= 2 && t.delta !== null && t.delta !== 0'), 'C: a seta do delta só existe com taxas dos dois lados');
ok(cardCode.includes('serieTxt'), 'C: o title confessa a série inteira (evolução no hover)');
ok(cardCode.includes("'border-zinc-400/60 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300'"), 'C: o chip do foco pulado veste a família zinc do neutro honesto');
ok(!code('src/components/hub/exam-prep-card.tsx').includes('>{t.last}%'), 'C: nenhum render direto {t.last}% sem guarda (o 0% falso morreu — só o ternário honesto renderiza)');
ok(cardCode.includes("pulouTudo ? 'bloco inteiro pulado na última tentativa (sem taxa)'"), 'C: o title da prontidão confessa o pulado');

const readinessRows = code('src/components/hub/exam-prep-card.tsx').includes('masteryBarCls(t.pct!)');
ok(readinessRows, 'C: a barra do domínio só renderiza COM taxa (null → barra vazia)');
ok(cardCode.includes("pulouTudo ? 'w-auto text-zinc-500 dark:text-zinc-400'"), 'C: o texto "pulou tudo" da prontidão em zinc');

console.log('D. A FIAÇÃO DO HISTÓRICO (Tendência por tópico)');

const histCode = code('src/components/hub/simulado-history.tsx');
ok(histCode.includes("border border-dashed border-zinc-400/70 bg-transparent dark:border-zinc-500/70"), 'D: a barra OCA do pulado (contorno zinc, sem tinta de erro)');
ok(histCode.includes("p.pct === null ? 'pulou tudo (sem taxa)' : `${p.pct}%`"), 'D: o title da barra confessa o pulado');
ok(histCode.includes("t.last === null ? 'pulou tudo' : `${t.last}%`"), 'D: o número da linha confessa o pulado');
ok(histCode.includes('> sem taxa </span>'), 'D: o chip "sem taxa" substitui o gap de meta para o pulado');
ok(histCode.includes('t.last === null ? ('), 'D: o gap de meta tem guarda de null');
ok(histCode.includes("t.delta === null ? ("), 'D: o badge do delta tem guarda de null');
ok(histCode.includes('<Minus className="size-2.5" /> sem Δ'), 'D: o badge "sem Δ" existe para variação incomparável');
ok(histCode.includes('barra OCA = bloco inteiro pulado (sem taxa)'), 'D: a legenda ensina a barra oca');
ok(histCode.includes('(topicTrends[0].last === null || topicTrends[0].last < 60)'), 'D: o badge "foco:" acende para null também (o pulado É o foco)');

console.log('E. O TUTOR (série honesta)');

const debriefCode = code('src/lib/simulado-debrief.ts');
ok(debriefCode.includes("p.pct === null ? 'pulou' : `${p.pct}%`"), 'E: a série diz "pulou" (nunca 0% falso)');
ok(debriefCode.includes("' (última: bloco pulado — sem taxa)'"), 'E: o sufixo confessa a última pulada');
ok(debriefCode.includes("t.delta !== null"), 'E: o Δ do tutor só existe com taxas dos dois lados');

console.log('F. DOUTRINA (a fonte única vige)');

ok(
  code('src/lib/simulado-debrief.ts').includes('topicRowsFor(r.questions!)'),
  'F: a tendência AGREGA via topicRowsFor (uma régua só, zero cópia)',
);
ok(
  code('src/lib/simulado-debrief.ts').includes("from '@/lib/math-exam-prep'"),
  'F: o import da fonte única vive no módulo',
);
// Nenhuma segunda régua de tendência: o Math.round((rec.solved / rec.total))
// antigo morreu do arquivo (o veredito geral do run é outra superfície, com
// contrato próprio — a régua POR TÓPICO é única).
ok(
  !code('src/lib/simulado-debrief.ts').includes('rec.total += 1'),
  'F: a agregação manual antiga (solved/TOTAL) MORREU do módulo',
);
ok(
  code('src/lib/exam-readiness.ts').includes('comTaxa.reduce'),
  'F: a média da prontidão é renormalizada sobre os tópicos COM taxa',
);
ok(
  code('src/lib/exam-readiness.ts').includes('pulou tudo (sem taxa na última tentativa'),
  'F: o prompt da prontidão carrega a voz do pulado',
);
// Pureza da lib: nenhum import de React/DOM/storage na tendência.
const debriefSrc = src('src/lib/simulado-debrief.ts');
ok(!debriefSrc.includes('use client'), 'F: a lib permanece pura (sem React)');

console.log('G. REGRESSÕES');

// t189 — a tabela do debrief segue intacta (a régua não mudou lá).
const t189debrief = code('src/components/hub/simulado-view.tsx');
ok(t189debrief.includes("pulou tudo' : `${t.pct}%`"), 'G (t189): a tabela do debrief segue com a voz do pulado');
ok(t189debrief.includes("'bg-zinc-400/60 dark:bg-zinc-600'"), 'G (t189): a barra vazia do pulado segue no debrief');
// t188 — a folha segue na fonte única.
ok(
  code('src/components/hub/folha-revisao-sheet.tsx').includes('simuladoVerdictFor'),
  'G (t188): a folha segue na fonte única (simuladoVerdictFor)',
);
// t185 — as portas do Estudar seguem de pé.
ok(
  code('src/components/hub/study-view.tsx').includes('readerDoorVisible'),
  'G (t185): a porta do leitor segue de pé',
);
// t146 — o print do resumo segue no diálogo.
ok(
  code('src/components/hub/material-summary-dialog.tsx').includes('printResumo') ||
    code('src/components/hub/material-summary-dialog.tsx').includes('print'),
  'G (t146): o print do resumo segue no diálogo',
);

// ---------------------------------------------------------------------------

console.log(`\nt190 — A ÚLTIMA RÉGUA VELHA: ${pass} ok, ${fail} falhas`);
process.exit(fail > 0 ? 1 : 0);
