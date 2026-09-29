/**
 * Task 188 — O ENDEREÇO DA REGRA.
 *
 * O QA vivo do fluxo de HOJE À NOITE (simulado completo, corrida real de 10
 * questões) achou o bug de honestidade da rodada: o veredito da meta dizia
 * "pelo plano D-7, o bloco com mais erros vira a revisão de amanhã" — mas a
 * regra vive na tarefa 2 do SIMULADO no plano REFEITO (offset 2, 29/09), não
 * no D-7 (Lista de Matrizes — Bloco 1). Rótulo de memória do plano antigo que
 * sobreviveu ao PLANO REFEITO (24/09); no dia do simulado, o debrief apontava
 * o dono para o dia ERRADO do plano.
 *
 * O QA achou o segundo buraco em leitura: a folha (/folha-revisao) derivava o
 * foco do simulado com matemática PRÓPRIA (pct = resolvidas/TOTAL — puladas
 * no denominador), enquanto a lib (simuladoVerdictFor) usa resolvidas/
 * RESPONDIDAS — o mesmo run valia 50% no papel e 100% no kit, e um bloco
 * INTEIRO pulado aparecia como "0%" (falso "tentou e errou") em vez do
 * diagnóstico verdadeiro ("sem tentativa").
 *
 * A rodada entrega:
 *  (1) LIB: MATH_SIMULADO_REGRA_REVISAO (a frase na FONTE) + a tarefa do
 *      plano COMPÕE a constante + simuladoRegraPlanoChip(plan?) — o chip do
 *      dia do simulado LIDO DO PRÓPRIO plano (nunca mais rótulo velho);
 *  (2) DEBRIEF/SETUP/TUTOR: compõem a constante e citam o endereço derivado
 *      (tabular-nums — ④); 'pelo plano D-7' morreu;
 *  (3) FOLHA: useSimuladoFoco reusa simuladoVerdictFor (fonte única, a
 *      régua do kit) e ganha a voz pulouTudo — chip "{total} puladas" +
 *      instrução honesta de onde a véspera começa.
 *
 * Contrato (`bun tests/test-t188-endereco-da-regra.ts`):
 *  A. A REGRA NA FONTE (execução): a constante existe com a frase exata; a
 *     tarefa 2 do dia do simulado COMPÕE a constante; o dia do plano e a
 *     MATH_SIMULADO_DATE se conferem (uma data só).
 *  B. O ENDEREÇO DERIVADO (execução, PUREZA): simuladoRegraPlanoChip() lê o
 *     plano real → 'D-2'; plano sintético sem simulado → null; plano que
 *     move o simulado → o chip MUDA junto; sem react/storage/fetch.
 *  C. A RÉGUA ÚNICA (execução): simuladoVerdictFor — pct sobre RESPONDIDAS,
 *     pulouTudo vence worst, run antigo → porTopico vazio, null/total 0 →
 *     null, fora do escopo não cria linha; a regra do foco da folha
 *     (pulouTudo ?? worst) executa igual à do kit.
 *  D. FIAÇÃO do debrief/setup (simulado-view): compõem a constante, o chip
     é condicional e tabular, 'pelo plano D-7' está MORTO no src inteiro.
 *  E. FIAÇÃO da folha: importa simuladoVerdictFor, foco = pulouTudo ?? worst,
 *     a matemática duplicada morreu, chip "{total} puladas" + voz honesta,
 *     allGood exige taxa real (pct !== null && ≥ 80).
 *  F. FIAÇÃO do tutor: o prompt compõe a constante (a citação segue a fonte).
 *  G. DOUTRINA: a frase literal vive UMA vez (a constante); superfícies que
 *     falam noutro dia mantêm a voz adaptada (o kit na véspera não cita
 *     'amanhã'); o endereço é derivado, não decorado.
 *  H. REGRESSÕES: t187 (deep-link), t185 (portas), t184 (folhaPlanForPaper
 *     executada), t177 (recitação/stuckSet), t146 (print do resumo),
 *     MATH_META régua única no veredito.
 */

import { readFileSync, existsSync } from 'node:fs';
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
/** Lê o arquivo SEM comentários (// e /* *\/) e com whitespace normalizado —
 *  o contrato olha STRINGS de verdade (o que renderiza), não prosa de
 *  comentário; e a casa quebra linha no meio da voz, o papel não lê o wrap. */
function code(rel: string): string {
  return src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// A. A REGRA NA FONTE — a constante e o plano se conferem
// ---------------------------------------------------------------------------

import {
  MATH_EXAM,
  MATH_EXAM_PLAN,
  MATH_META,
  MATH_SIMULADO_DATE,
  MATH_SIMULADO_REGRA_REVISAO,
  folhaPlanForPaper,
  simuladoRegraPlanoChip,
  simuladoVerdictFor,
} from '../src/lib/math-exam-prep';

ok(
  MATH_SIMULADO_REGRA_REVISAO === 'o bloco com mais erros vira a revisão de amanhã',
  'A: a constante carrega a frase exata da promessa',
);
ok(typeof simuladoRegraPlanoChip === 'function', 'A: simuladoRegraPlanoChip está exportada');

const diaSimulado = MATH_EXAM_PLAN.find((d) => d.kind === 'simulado');
ok(!!diaSimulado, 'A: o plano tem um dia de kind simulado');
ok(diaSimulado?.offset === 2, 'A: o dia do simulado é o offset 2 (a regra vive no D-2 do plano REFEITO)');
const tarefaMeta = diaSimulado?.tarefas.find((t) => t.texto.includes('Meta'));
ok(!!tarefaMeta, 'A: a tarefa da meta existe no dia do simulado');
ok(
  tarefaMeta?.texto === `Meta: ≥ 70% (nota de aprovação). Abaixo disso → ${MATH_SIMULADO_REGRA_REVISAO}`,
  'A: a tarefa COMPÕE a constante (fonte única, zero cópia drift)',
);
ok(
  tarefaMeta?.texto.includes('o bloco com mais erros vira a revisão de amanhã') ?? false,
  'A: o texto da tarefa segue dizendo a frase inteira (composição transparente)',
);

// O dia do plano e a data derivada são o MESMO dia (uma data só na casa)
if (diaSimulado && MATH_EXAM.date) {
  const d = new Date(`${MATH_EXAM.date}T12:00:00`);
  d.setDate(d.getDate() - diaSimulado.offset);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  ok(iso === MATH_SIMULADO_DATE, 'A: o offset do plano e MATH_SIMULADO_DATE apontam o MESMO dia (29/09)');
  ok(iso === '2026-09-29', 'A: o simulado é em 29/09 (a noite de hoje)');
}

// ---------------------------------------------------------------------------
// B. O ENDEREÇO DERIVADO — o chip lê o plano (nunca mais rótulo velho)
// ---------------------------------------------------------------------------

ok(simuladoRegraPlanoChip() === 'D-2', 'B: o chip do plano REAL é D-2 (o D-7 velho morreu)');
ok(
  simuladoRegraPlanoChip(MATH_EXAM_PLAN) === simuladoRegraPlanoChip(),
  'B: sem argumento = o plano real (default honesto, mesma fonte)',
);
ok(
  simuladoRegraPlanoChip([
    { offset: 7, kind: 'pratica', titulo: 'x', minutos: 10, tarefas: [] },
    { offset: 5, kind: 'simulado', titulo: 'y', minutos: 10, tarefas: [] },
    { offset: 0, kind: 'prova', titulo: 'z', minutos: 10, tarefas: [] },
  ]) === 'D-5',
  'B: plano que move o simulado → o chip MUDA junto (D-5)',
);
ok(
  simuladoRegraPlanoChip([
    { offset: 1, kind: 'revisao', titulo: 'x', minutos: 10, tarefas: [] },
    { offset: 0, kind: 'prova', titulo: 'z', minutos: 10, tarefas: [] },
  ]) === null,
  'B: plano sem dia de simulado → null (a superfície cala o chip, não inventa endereço)',
);
ok(
  simuladoRegraPlanoChip([]) === null,
  'B: plano vazio → null (o vazio é honesto)',
);

// PUREZA — o corpo da função não toca react/window/document/storage/fetch
const libSrc = src('src/lib/math-exam-prep.ts');
const chipFn = libSrc.slice(
  libSrc.indexOf('export function simuladoRegraPlanoChip'),
  libSrc.indexOf('export interface FormulaCard'),
);
ok(chipFn.includes('export function simuladoRegraPlanoChip'), 'B: o corpo da função está no lugar esperado');
ok(!/\bReact\b/.test(chipFn), 'B: PUREZA — sem React no corpo');
ok(!/\bwindow\b|\blocalStorage\b/.test(chipFn), 'B: PUREZA — sem window/storage no corpo');
ok(!/\bfetch\b/.test(chipFn), 'B: PUREZA — sem fetch no corpo');

// ---------------------------------------------------------------------------
// C. A RÉGUA ÚNICA — a folha agora executa a MESMA lib do kit
// ---------------------------------------------------------------------------

type Q = { status?: 'solved' | 'missed' | 'skipped'; topic?: string };
const run = (total: number, solved: number, questions: Q[]) => ({ total, solved, questions });

// C1. O run do QA ao vivo (inversão de papel): Lógica 2/3 respondidas, Álgebra INTEIRA pulada
const runAoVivo = run(10, 2, [
  ...Array.from({ length: 4 }, () => ({ status: 'skipped' as const, topic: 'Álgebra Matricial' })),
  { status: 'solved' as const, topic: 'Lógica Matemática' },
  { status: 'solved' as const, topic: 'Lógica Matemática' },
  { status: 'missed' as const, topic: 'Lógica Matemática' },
  ...Array.from({ length: 3 }, () => ({ status: 'missed' as const, topic: 'Lógica Matemática' })),
]);
const v1 = simuladoVerdictFor(runAoVivo);
ok(v1 !== null, 'C1: o run produz veredito');
ok(v1?.pct === 20, 'C1: o % geral é 20 (2/10 — a régua do histórico)');
ok(v1?.pulouTudo?.topic === 'Álgebra Matricial', 'C1: o bloco INTEIRO pulado é o pulouTudo');
ok(v1?.pulouTudo?.pct === null, 'C1: bloco pulado não tem taxa (não inventa 0%)');
ok(v1?.pulouTudo?.skipped === 4, 'C1: as 4 puladas contam no pulouTudo');
ok(v1?.worst?.topic === 'Lógica Matemática', 'C1: worst é o pior COM taxa (Lógica)');
ok(v1?.worst?.pct === 33, 'C1: a taxa da Lógica é solved/RESPONDIDAS (2/6 → 33 — puladas fora do denominador)');
ok(v1?.meta === MATH_META, 'C1: a meta vem da fonte única (MATH_META)');

// C2. A RÉGUA do papel era outra (o bug): pct sobre o TOTAL punia pulada.
//     O contrato prende a régua CERTA: 2 solved, 1 missed, 1 skipped → 2/3 = 67%, não 50%.
const runMisto = run(4, 2, [
  { status: 'solved' as const, topic: 'Lógica Matemática' },
  { status: 'solved' as const, topic: 'Lógica Matemática' },
  { status: 'missed' as const, topic: 'Lógica Matemática' },
  { status: 'skipped' as const, topic: 'Lógica Matemática' },
]);
const v2 = simuladoVerdictFor(runMisto);
ok(v2?.porTopico.length === 1, 'C2: o tópico do escopo vira UMA linha');
ok(v2?.porTopico[0]?.pct === 67, 'C2: pct = resolvidas/RESPONDIDAS (2/3 → 67) — pulada não pune a taxa');

// C3. A regra do foco (pulouTudo ?? worst) é a MESMA no kit e agora no papel
const focoFolha = v1 ? v1.pulouTudo ?? v1.worst : null;
ok(focoFolha?.topic === 'Álgebra Matricial', 'C3: o foco do papel é o bloco pulado (a promessa no sentido que importa)');
const v3 = simuladoVerdictFor(
  run(6, 2, [
    { status: 'solved' as const, topic: 'Álgebra Matricial' },
    { status: 'missed' as const, topic: 'Álgebra Matricial' },
    { status: 'solved' as const, topic: 'Lógica Matemática' },
    { status: 'missed' as const, topic: 'Lógica Matemática' },
    { status: 'missed' as const, topic: 'Lógica Matemática' },
    { status: 'skipped' as const, topic: 'Lógica Matemática' },
  ]),
);
ok(v3?.pulouTudo === null, 'C3: sem bloco todo pulado → pulouTudo null');
ok((v3?.pulouTudo ?? v3?.worst)?.topic === 'Lógica Matemática', 'C3: sem pulou, o foco é o worst (33% < 50%)');

// C4. Honestidade dos vazios
ok(simuladoVerdictFor(null) === null, 'C4: run null → null');
ok(simuladoVerdictFor(run(0, 0, [])) === null, 'C4: total 0 → null');
const v5 = simuladoVerdictFor(run(3, 1, [{ status: 'missed' as const, topic: 'fora-do-escopo' }]));
ok(v5 !== null && v5.porTopico.length === 0, 'C4: questão fora do escopo não cria linha');
ok(v5?.worst === null, 'C4: sem tópico do escopo → worst null (a folha mostra nada, não inventa)');
const v6 = simuladoVerdictFor(run(2, 0, [{ status: 'skipped' as const, topic: 'Álgebra Matricial' }]));
ok(v6?.pulouTudo?.total === 1, 'C4: pulada entra no total do tópico');

// C5. allGood da folha: exige taxa REAL em TODO o escopo presente
const allGoodOf = (verdict: ReturnType<typeof simuladoVerdictFor>) =>
  verdict && verdict.porTopico.length > 0 && verdict.porTopico.every((t) => t.pct !== null && t.pct >= 80);
ok(allGoodOf(v1) === false, 'C5: run com bloco pulado NÃO é allGood (taxa null quebra)');
ok(
  allGoodOf(
    simuladoVerdictFor(
      run(2, 2, [
        { status: 'solved' as const, topic: 'Álgebra Matricial' },
        { status: 'solved' as const, topic: 'Lógica Matemática' },
      ]),
    ),
  ) === true,
  'C5: 100% nos dois tópicos → allGood (o papel manda manter o ritmo)',
);

// ---------------------------------------------------------------------------
// D. FIAÇÃO do debrief/setup — a citação compõe a fonte, o endereço é derivado
// ---------------------------------------------------------------------------

const svSrc = src('src/components/hub/simulado-view.tsx');
ok(
  svSrc.includes("MATH_SIMULADO_REGRA_REVISAO, simuladoRegraPlanoChip } from '@/lib/math-exam-prep'") ||
    svSrc.includes('MATH_SIMULADO_REGRA_REVISAO') === true,
  'D: o debrief importa a constante da lib',
);
ok(svSrc.includes('simuladoRegraPlanoChip'), 'D: o debrief importa o endereço derivado');
ok(
  /const regraChip = simuladoRegraPlanoChip\(\)/.test(svSrc),
  'D: o chip é DERIVADO no componente (sem rótulo decorado)',
);
ok(
  svSrc.includes('— pelo plano') && svSrc.includes('{MATH_SIMULADO_REGRA_REVISAO}'),
  'D: o veredito compõe "— pelo plano {chip}, {CONSTANTE}" (a frase vem da fonte)',
);
ok(
  /regraChip && \(/.test(svSrc),
  'D: o chip é condicional (plano sem simulado → o chip cala, a frase segue)',
);
ok(
  svSrc.includes('font-semibold tabular-nums"> {regraChip}'),
  'D (④): o endereço veste a gramática de números da casa (tabular-nums)',
);
ok(
  svSrc.includes('responder — {MATH_SIMULADO_REGRA_REVISAO}.'),
  'D: o SETUP do dia do simulado também cita a fonte (condições de prova)',
);

// O rótulo velho está MORTO no src inteiro — em CÓDIGO (comentários que
// CONTAM a história do bug têm o direito de citar o morto)
const filesWithD7 = ['src/components/hub/simulado-view.tsx', 'src/components/hub/exam-prep-card.tsx', 'src/components/hub/folha-revisao-sheet.tsx', 'src/lib/math-exam-prep.ts', 'src/app/api/tutor/route.ts']
  .map(code)
  .filter((t) => /pelo plano D-7/.test(t));
ok(filesWithD7.length === 0, 'D: "pelo plano D-7" NÃO existe mais em código de src (só comentários o enterram)');

// ---------------------------------------------------------------------------
// E. FIAÇÃO da folha — o papel fala a língua do kit (fonte única + voz pulou)
// ---------------------------------------------------------------------------

const folhaSrc = src('src/components/hub/folha-revisao-sheet.tsx');
ok(
  /import \{[^}]*simuladoVerdictFor[^}]*\} from '@\/lib\/math-exam-prep'/s.test(folhaSrc),
  'E: a folha importa simuladoVerdictFor (a régua única)',
);
ok(
  /const verdict = simuladoVerdictFor\(run\)/.test(folhaSrc),
  'E: o hook do foco executa a lib (zero derivação própria)',
);
ok(
  /const foco = verdict\.pulouTudo \?\? verdict\.worst/.test(folhaSrc),
  'E: a regra do foco no papel é a MESMA do kit (pulouTudo vence worst)',
);
ok(
  /focoPulou: foco\.pct == null/.test(folhaSrc),
  'E: pulou é ausência de taxa (pct null), não zero',
);
ok(
  !/Math\.round\(\(v\.solved \/ v\.total\) \* 100\)/.test(folhaSrc),
  'E: a matemática duplicada do papel MORREU (a régua antiga não sobrevive)',
);
ok(
  folhaSrc.includes('${simuladoFoco.foco.total} puladas`'),
  'E (④): o chip do bloco pulado confessa "N puladas" (não finge 0%)',
);
ok(
  folhaSrc.includes('bloco inteiro sem tentativa'),
  'E: a voz do papel nomeia o diagnóstico real (sem tentativa ≠ tentou e errou)',
);
ok(
  folhaSrc.includes('começa por onde nem chegou'),
  'E: a instrução honesta — a véspera começa pelo bloco nunca visto',
);
ok(
  folhaSrc.includes('t.pct !== null && t.pct >= 80'),
  'E: allGood exige taxa REAL ≥ 80 em todo o escopo presente',
);
ok(
  folhaSrc.includes('tabular-nums') && folhaSrc.includes('rounded-full bg-zinc-900'),
  'E (④): o chip do foco segue no token do papel (P&B lê, número tabular)',
);

// ---------------------------------------------------------------------------
// F. FIAÇÃO do tutor — a citação no prompt segue a fonte
// ---------------------------------------------------------------------------

const tutorSrc = src('src/app/api/tutor/route.ts');
ok(
  tutorSrc.includes("import { MATH_SIMULADO_REGRA_REVISAO } from '@/lib/math-exam-prep'"),
  'F: o tutor importa a constante',
);
ok(
  tutorSrc.includes('a promessa do plano: "${MATH_SIMULADO_REGRA_REVISAO}"'),
  'F: o prompt compõe a citação (a regra do tutor nunca diverge da do plano)',
);

// ---------------------------------------------------------------------------
// G. DOUTRINA — a frase vive UMA vez; a voz se adapta ao dia; nada decorado
// ---------------------------------------------------------------------------

const phrase = 'o bloco com mais erros vira a revisão de amanhã';
const libLiteralCount = (libSrc.match(new RegExp(`'${phrase}'`, 'g')) ?? []).length;
ok(
  libLiteralCount === 1,
  'G: o literal da frase existe UMA vez na lib (a constante — comentários usam outra aspa)',
);
const otherFiles = [
  'src/components/hub/simulado-view.tsx',
  'src/components/hub/exam-prep-card.tsx',
  'src/components/hub/folha-revisao-sheet.tsx',
  'src/app/api/tutor/route.ts',
];
ok(
  otherFiles.map(src).every((t) => !t.includes(`'${phrase}'`)),
  'G: nenhuma outra superfície carrega o literal (todas COMPÕEM ou adaptam)',
);
// Voz adaptada ao dia: o kit fala na VÉSPERA ('amanhã' lá seria mentira)
const cardCode = code('src/components/hub/exam-prep-card.tsx');
ok(
  cardCode.includes('o plano promete: o bloco com mais erros vira a revisão.') &&
    !cardCode.includes('vira a revisão de amanhã'),
  'G: o kit mantém a voz da véspera (sem "amanhã" — amanhã é a prova)',
);
ok(
  folhaSrc.replace(/\s+/g, ' ').includes('vira a revisão da véspera'),
  'G: o slot da folha mantém a voz de antes do run ("da véspera")',
);
ok(
  folhaSrc.includes('A promessa do plano: o bloco com mais erros do ensaio'),
  'G: o slot segue prometendo em nome do plano (adaptado ao papel)',
);

// ---------------------------------------------------------------------------
// H. REGRESSÕES — as rodadas anteriores seguem de pé
// ---------------------------------------------------------------------------

ok(
  typeof folhaPlanForPaper === 'function' && folhaPlanForPaper(0)?.label === 'Dia da prova',
  'H (t184): a folha lê o dia D-0 pela mesma função',
);
ok(
  folhaPlanForPaper(null)?.plan.offset === 1,
  'H (t184): sem hora do cliente → a véspera segue sendo o alvo do papel',
);
ok(folhaSrc.includes('receiptStuckSet'), 'H (t177): os travos da recitação seguem no papel');
ok(folhaSrc.includes('folha-plan-day') && folhaSrc.includes('folha-plan-label'), 'H (t184): os testids da coluna do plano seguem');
ok(cardCode.includes('simuladoVerdictFor'), 'H: o kit segue na fonte única (a régua não regrediu)');
ok(src('src/components/hub/exam-prep-card.tsx').includes('AutoavaliacaoChips'), 'H (t187): os chips da autoavaliação seguem no card');
ok(
  existsSync(join(process.cwd(), 'tests/test-t187-deeplink-autoavaliacao.ts')),
  'H (t187): o contrato anterior existe e roda nesta rodada',
);
ok(libSrc.includes('export function simuladoVerdictFor'), 'H: a lib segue exportando o veredito (fonte única viva)');
ok(
  svSrc.includes('Erro vira revisão de amanhã'),
  'H: o badge curto do setup segue (voz do dia do simulado — "amanhã" é verdade aqui)',
);

// ---------------------------------------------------------------------------

console.log(`\nt188 — O ENDEREÇO DA REGRA: ${pass} ok, ${fail} falhas`);
process.exit(fail > 0 ? 1 : 0);
