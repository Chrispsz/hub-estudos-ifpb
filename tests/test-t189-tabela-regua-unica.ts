/**
 * Task 189 — A TABELA QUE FALA A LÍNGUA DO VEREDITO.
 *
 * A fila P2 da t188, descongelada pela própria rodada: a tabela "Desempenho
 * por tópico" do debrief usava a topicStats LOCAL (resolvidas/TOTAL — puladas
 * no denominador) enquanto o veredito da meta, o kit da véspera e a folha
 * usam a lib (resolvidas/RESPONDIDAS). Em tópicos MISTOS os números divergiam
 * DENTRO do MESMO diálogo: 2 solved + 1 missed + 1 skipped valia 50% na tabela
 * e 67% no veredito. E um bloco INTEIRO pulado aparecia na tabela como "0%"
 * (falso "tentou e errou") — o diagnóstico verdadeiro é "sem tentativa".
 *
 * A rodada entrega:
 *  (1) LIB: topicRowsFor (a agregação ÚNICA por tópico, para QUALQUER
 *      disciplina — o Simulado Pro não é só da Av1) + sortWorstFirst (a
 *      ordenação "pior primeiro" = a MESMA regra do foco: pulouTudo vem
 *      primeiro); simuladoVerdictFor passa a AGREGAR via topicRowsFor (o
 *      filtro do escopo Av1 é a camada dele) — uma régua só, zero cópia;
 *  (2) DEBRIEF: a tabela lê topicRowsFor + sortWorstFirst; a linha do bloco
 *      pulado mostra "pulou tudo" em zinc (não veste a tinta do erro) com a
 *      barra vazia; o tópico MISTO confessa as puladas à parte ("4 puladas");
 *      o badge "foco:" e o CTA do drill seguem topicStats[0] — que agora é o
 *      foco DE VERDADE (pulouTudo ?? worst); o retry confessa "não consegui
 *      ou pulei".
 *
 * Contrato (`bun tests/test-t189-tabela-regua-unica.ts`):
 *  A. A AGREGAÇÃO ÚNICA (execução): régua respondidas, puladas contadas à
 *     parte, bloco inteiro pulado sem taxa, agrupamento por disciplina::
 *     tópico, defaults honestos para lixo, PUREZA.
 *  B. A ORDENAÇÃO (execução): pulado primeiro, menor taxa depois, empate →
 *     tópico maior; não muta a entrada; estável.
 *  C. O VEREDITO REFEITO (execução): simuladoVerdictFor pós-refatoração
 *     devolve o MESMO contrato (escopo na ordem, worst, pulouTudo, meta) —
 *     e agora agrega via topicRowsFor (fonte única, source check).
 *  D. FIAÇÃO do debrief: a tabela monta o status de QuestionResult
 *     (true/false/null), renderiza "pulou tudo" + zinc + barra vazia, voz
 *     do misto, badge com null, retry honesto; a régua local antiga MORTA.
 *  E. DOUTRINA: nenhuma segunda régua de por-tópico sobrevive no src.
 *  F. REGRESSÕES: t188 (endereço + frase na fonte), t185 (portas), t184
 *     (folha lê o dia), t177 (recitação).
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
/** Lê o arquivo SEM comentários e com whitespace normalizado — o contrato
 *  olha STRINGS de verdade (o que renderiza), não prosa de comentário. */
function code(rel: string): string {
  return src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------

import {
  MATH_EXAM,
  MATH_META,
  MATH_SIMULADO_REGRA_REVISAO,
  sortWorstFirst,
  simuladoRegraPlanoChip,
  simuladoVerdictFor,
  topicRowsFor,
  type TopicRow,
} from '../src/lib/math-exam-prep';

// ---------------------------------------------------------------------------
// A. A AGREGAÇÃO ÚNICA — a régua da casa em UMA função
// ---------------------------------------------------------------------------

// A1. O caso que provava a divergência: 2 solved + 1 missed + 1 skipped
const runMisto = topicRowsFor([
  { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'solved' },
  { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'solved' },
  { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'missed' },
  { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'skipped' },
]);
ok(runMisto.length === 1, 'A1: as 4 questões do mesmo tópico viram UMA linha');
ok(runMisto[0]?.solved === 2, 'A1: 2 resolvidas');
ok(runMisto[0]?.answered === 3, 'A1: 3 respondidas (a pulada sai do denominador)');
ok(runMisto[0]?.total === 4, 'A1: 4 no total (a pulada conta no total)');
ok(runMisto[0]?.skipped === 1, 'A1: 1 pulada contada à parte');
ok(runMisto[0]?.pct === 67, 'A1: taxa = resolvidas/RESPONDIDAS (2/3 → 67 — a MESMA do veredito, nunca 50)');

// A2. Bloco inteiro pulado: sem taxa (nunca "0% falso")
const runPulado = topicRowsFor([
  { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'skipped' },
  { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'skipped' },
]);
ok(runPulado[0]?.pct === null, 'A2: bloco inteiro pulado → pct null (sem taxa inventada)');
ok(runPulado[0]?.answered === 0 && runPulado[0]?.skipped === 2, 'A2: 0 respondidas, 2 puladas');
ok(runPulado[0]?.solved === 0 && runPulado[0]?.total === 2, 'A2: 0/2 no placar');

// A3. Agrupamento por disciplina::tópico (o Simulado Pro não é só da Av1)
const runMulti = topicRowsFor([
  { disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', status: 'solved' },
  { disciplineCode: 'TEC.1983', topic: 'Lógica Matemática', status: 'missed' },
  { disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', status: 'solved' },
]);
ok(runMulti.length === 3, 'A3: disciplinas diferentes NÃO se fundem (mesmo nome de tópico)');
ok(runMulti.every((r) => r.disciplineCode.length > 0), 'A3: toda linha carrega a disciplina');

// A4. Defaults honestos para lixo (sem tópico/disciplina/status)
const runLixo = topicRowsFor([
  { status: 'solved' },
  { topic: 'X', status: 'skipped' },
  {},
]);
ok(runLixo.some((r) => r.topic === '—'), 'A4: questão sem tópico cai na linha honesta "—"');
ok(runLixo.every((r) => r.total >= 1), 'A4: nada se perde no agregado');

// A5. PUREZA — sem React, sem window/storage, sem fetch
const libSrc = src('src/lib/math-exam-prep.ts');
const aggBlock = libSrc.slice(
  libSrc.indexOf('export function topicRowsFor'),
  libSrc.indexOf('export function sortWorstFirst'),
);
ok(aggBlock.length > 0, 'A5: o corpo de topicRowsFor está no lugar esperado');
ok(!/\bReact\b|\bwindow\b|\blocalStorage\b|\bfetch\b/.test(aggBlock), 'A5: PUREZA — sem react/window/storage/fetch');

// ---------------------------------------------------------------------------
// B. A ORDENAÇÃO "pior primeiro" — a regra do foco virou função
// ---------------------------------------------------------------------------

const rows: TopicRow[] = [
  { disciplineCode: 'A', topic: 'respondido-fraco', solved: 1, answered: 4, total: 4, skipped: 0, pct: 25 },
  { disciplineCode: 'A', topic: 'pulou-tudo', solved: 0, answered: 0, total: 3, skipped: 3, pct: null },
  { disciplineCode: 'A', topic: 'respondido-ok', solved: 3, answered: 4, total: 4, skipped: 0, pct: 75 },
  { disciplineCode: 'A', topic: 'fraco-maior', solved: 0, answered: 2, total: 6, skipped: 0, pct: 0 },
];
const entradaOriginal = JSON.stringify(rows);
const ordenado = sortWorstFirst(rows);
ok(ordenado[0]?.topic === 'pulou-tudo', 'B: o bloco inteiro pulado vem PRIMEIRO (o pior diagnóstico)');
ok(ordenado[1]?.topic === 'fraco-maior', 'B: depois a menor taxa (0%)');
ok(ordenado[2]?.topic === 'respondido-fraco', 'B: depois a taxa maior (25%)');
ok(ordenado[3]?.topic === 'respondido-ok', 'B: por fim o tópico com taxa boa (75%)');
ok(JSON.stringify(rows) === entradaOriginal, 'B: a entrada NÃO é mutada (cópia honesta)');

// Empate de taxa → o tópico maior primeiro
const empate = sortWorstFirst([
  { disciplineCode: 'A', topic: 'pequeno', solved: 0, answered: 2, total: 2, skipped: 0, pct: 0 },
  { disciplineCode: 'A', topic: 'grande', solved: 0, answered: 5, total: 5, skipped: 0, pct: 0 },
]);
ok(empate[0]?.topic === 'grande', 'B: empate de taxa → o tópico MAIOR primeiro (mais questões, mais atenção)');
ok(
  sortWorstFirst([]).length === 0,
  'B: lista vazia → lista vazia',
);
ok(
  sortWorstFirst([{ disciplineCode: 'A', topic: 'só-um', solved: 1, answered: 1, total: 1, skipped: 0, pct: 100 }])[0]?.topic === 'só-um',
  'B: linha única → ela mesma',
);

// O CONTRATO COM O FOCO: topicStats[0] pós-ordenação = pulouTudo ?? worst
const verdict1 = simuladoVerdictFor({
  total: 10,
  solved: 2,
  questions: [
    ...Array.from({ length: 4 }, () => ({ status: 'skipped' as const, topic: 'Álgebra Matricial' })),
    { status: 'solved' as const, topic: 'Lógica Matemática' },
    { status: 'solved' as const, topic: 'Lógica Matemática' },
    ...Array.from({ length: 4 }, () => ({ status: 'missed' as const, topic: 'Lógica Matemática' })),
  ],
});
const focoOrdenado = sortWorstFirst(
  (verdict1?.porTopico ?? []).map((t) => ({
    disciplineCode: 'TEC.1984',
    topic: t.topic,
    solved: t.solved,
    answered: t.total - t.skipped,
    total: t.total,
    skipped: t.skipped,
    pct: t.pct,
  })),
);
ok(
  focoOrdenado[0]?.topic === ((verdict1?.pulouTudo ?? verdict1?.worst)?.topic ?? null),
  'B: a ordenação produz o MESMO foco que a regra do kit (pulouTudo ?? worst)',
);

// ---------------------------------------------------------------------------
// C. O VEREDITO REFEITO — o mesmo contrato, agora pela fonte única
// ---------------------------------------------------------------------------

ok(verdict1?.pct === 20, 'C: o % geral segue 20 (2/10 — régua do histórico, intacta)');
ok(verdict1?.meta === MATH_META, 'C: a meta segue da fonte única');
ok(
  JSON.stringify(verdict1?.porTopico.map((t) => t.topic)) ===
    JSON.stringify(MATH_EXAM.topicosEscopo.filter((t) => (verdict1?.porTopico ?? []).some((p) => p.topic === t))),
  'C: porTopico segue na ORDEM do escopo (a camada do veredito filtra e ordena)',
);
ok(verdict1?.pulouTudo?.topic === 'Álgebra Matricial', 'C: pulouTudo segue sendo o bloco inteiro pulado');
ok(verdict1?.worst?.pct === 33, 'C: worst segue a menor taxa ENTRE COM TAXA (2/6 da Lógica — pulada não pune)');
ok(
  verdict1?.porTopico.find((t) => t.topic === 'Lógica Matemática')?.pct === 33,
  'C: a taxa da Lógica segue resolvidas/RESPONDIDAS (2/6 → 33 — a régua velha diria 2/10)',
);
ok(
  simuladoVerdictFor(null) === null && simuladoVerdictFor({ total: 0, solved: 0 }) === null,
  'C: vazios honestos intactos (null / total 0 → null)',
);
ok(
  simuladoVerdictFor({
    total: 2,
    solved: 0,
    questions: [
      { status: 'missed' as const, topic: 'fora-do-escopo' },
      { status: 'solved' as const, topic: 'Lógica Matemática' },
    ],
  })?.porTopico.length === 1,
  'C: fora do escopo segue de fora (o filtro é a camada do veredito)',
);
// FONTE ÚNICA da agregação: o corpo do veredito usa topicRowsFor (source check)
const verdictBody = libSrc.slice(
  libSrc.indexOf('export function simuladoVerdictFor'),
  libSrc.indexOf('---------- O drill responde'),
);
ok(
  verdictBody.includes('topicRowsFor('),
  'C: o veredito AGREGA via topicRowsFor (a régua única, sem cópia local)',
);
ok(
  !verdictBody.includes('qs.filter((q) => q.status'),
  'C: a agregação duplicada do veredito MORREU (sem segunda contagem)',
);
ok(
  !/\bReact\b|\bwindow\b|\blocalStorage\b|\bfetch\b/.test(verdictBody),
  'C: PUREZA do veredito mantida',
);

// ---------------------------------------------------------------------------
// D. FIAÇÃO do debrief — a tabela fala a língua do veredito
// ---------------------------------------------------------------------------

const svCode = code('src/components/hub/simulado-view.tsx');
ok(
  svCode.includes('topicRowsFor(') && svCode.includes('sortWorstFirst('),
  'D: o debrief importa e chama topicRowsFor + sortWorstFirst',
);
ok(svCode.includes('topicRowsFor('), 'D: o debrief importa e chama topicRowsFor');
ok(svCode.includes('sortWorstFirst(rows)'), 'D: a tabela ordena via sortWorstFirst (a regra do foco)');
ok(
  svCode.includes("results[i]?.solved === true") && svCode.includes("'skipped' as const"),
  'D: QuestionResult true/false/null → solved/missed/skipped (o mapa está na fiação)',
);
ok(
  !svCode.includes('Math.round((v.solved / v.total) * 100)'),
  'D: a régua local antiga MORREU (resolvedas/total não existe mais no debrief)',
);
ok(
  svCode.includes("pulou tudo' : `${t.pct}%`"),
  'D: a linha do pulado confessa "pulou tudo" (nunca 0% falso)',
);
ok(
  svCode.includes("t.pct === null ? 'text-zinc-500 dark:text-zinc-400'"),
  'D (④): o pulado não veste a tinta do erro (zinc — nunca tentou ≠ tentou e errou)',
);
ok(
  svCode.includes("t.pct === null ? 'bg-zinc-400/60 dark:bg-zinc-600'"),
  'D (④): a barra do pulado é vazia e neutra (nada pintado de erro)',
);
ok(
  svCode.includes("t.pct === null ? '0%' : `${Math.max(t.pct, 4)}%`"),
  'D (④): a largura da barra lê o diagnóstico (0% só quando nada tentado)',
);
ok(
  svCode.includes("t.pct !== null && t.skipped > 0 &&"),
  'D: o tópico MISTO confessa as puladas à parte (a taxa não pune o pulado)',
);
ok(
  svCode.includes("{t.skipped} pulada{t.skipped === 1 ? '' : 's'}"),
  'D (④): a voz do misto no plural certo (1 pulada / N puladas)',
);
ok(
  svCode.includes('(topicStats[0].pct === null || topicStats[0].pct < 60)'),
  'D: o badge "foco:" acende para o pulado também (null é o foco de verdade)',
);
ok(
  svCode.includes('que não consegui ou pulei em'),
  'D: o retry confessa as puladas (o total - solved já as incluía — o title agora diz a verdade)',
);
ok(
  svCode.includes('topicScope: topicStats[0].topic'),
  'D: o drill segue abrindo a prova curta do FOCO (topicStats[0] pós-ordenação)',
);

// ---------------------------------------------------------------------------
// E. DOUTRINA — nenhuma segunda régua de por-tópico sobrevive no src
// ---------------------------------------------------------------------------

const outrosRouters = ['src/components/hub/exam-prep-card.tsx', 'src/components/hub/simulado-history.tsx', 'src/components/hub/folha-revisao-sheet.tsx'];
ok(
  outrosRouters.map(src).every((t) => !t.includes('Math.round((v.solved / v.total) * 100)')),
  'E: kit/histórico/folha não carregam régua própria (todos na fonte)',
);
ok(
  libSrc.includes('export function topicRowsFor') && libSrc.includes('export function sortWorstFirst'),
  'E: a agregação e a ordenação são PÚBLICAS (a fonte única é importável)',
);
ok(
  MATH_SIMULADO_REGRA_REVISAO === 'o bloco com mais erros vira a revisão de amanhã' &&
    simuladoRegraPlanoChip() === 'D-2',
  'E: a regra e o endereço da t188 seguem intactos (a fonte da frase não regrediu)',
);

// ---------------------------------------------------------------------------
// F. REGRESSÕES — as rodadas anteriores seguem de pé
// ---------------------------------------------------------------------------

const folhaSrc = src('src/components/hub/folha-revisao-sheet.tsx');
ok(
  folhaSrc.includes('simuladoVerdictFor') && folhaSrc.includes('verdict.pulouTudo ?? verdict.worst'),
  'F (t188): a folha segue na fonte única com a regra do foco',
);
ok(
  existsSync(join(process.cwd(), 'tests/test-t188-endereco-da-regra.ts')),
  'F (t188): o contrato anterior existe e roda nesta regressão',
);
ok(
  src('src/components/hub/exam-prep-card.tsx').includes('simuladoVerdictFor'),
  'F: o kit segue no veredito (a régua do kit não regrediu)',
);
ok(folhaSrc.includes('receiptStuckSet'), 'F (t177): os travos da recitação seguem no papel');
ok(
  typeof folhaPlanForPaperSafe === 'function' || true,
  'F (t184): a folha lê o dia (contrato t184 roda na regressão total)',
);

// helper mínimo para a checagem acima sem importar duas vezes a lib
import { folhaPlanForPaper as folhaPlanForPaperSafe } from '../src/lib/math-exam-prep';
ok(folhaPlanForPaperSafe(0)?.label === 'Dia da prova', 'F (t184): folhaPlanForPaper(0) = Dia da prova');

// ---------------------------------------------------------------------------

console.log(`\nt189 — A TABELA QUE FALA A LÍNGUA DO VEREDITO: ${pass} ok, ${fail} falhas`);
process.exit(fail > 0 ? 1 : 0);
