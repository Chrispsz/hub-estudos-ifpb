// qa75-unit.ts — Travadas das listas (espelho digital das marcas de papel)
// Rodar: bun scripts/qa75-unit.ts   (sem API, só a lib)

import {
  MATH_LISTAS,
  MATH_TRAVADAS_KEY,
  MATH_EXAM_PLAN,
  countTravadas,
  formatTravadas,
  normalizeTravadas,
} from '../src/lib/math-exam-prep';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

console.log('\n=== (A) MATH_LISTAS — as duas listas impressas do plano ===');
check('duas listas', MATH_LISTAS.length === 2);
check(
  'Matrizes 35Q com fonte real',
  MATH_LISTAS[0].id === 'matrizes' && MATH_LISTAS[0].total === 35 && MATH_LISTAS[0].fonte === 'mat-01-matrizes',
);
check(
  'Lógica 18Q com fonte real',
  MATH_LISTAS[1].id === 'logica' && MATH_LISTAS[1].total === 18 && MATH_LISTAS[1].fonte === 'mat-logica-lista',
);

console.log('\n=== (B) formatTravadas — formato único kit/folha ===');
const t1 = { 'matrizes-7': true, 'matrizes-12': true, 'logica-4': true };
check(
  'duas listas formatam com separador',
  formatTravadas(t1) === 'Matrizes Q7, Q12 · Lógica Q4',
  `recebido: "${formatTravadas(t1)}"`,
);
check('vazio → string vazia', formatTravadas({}) === '');
check(
  'uma lista só',
  formatTravadas({ 'logica-18': true }) === 'Lógica Q18',
  `recebido: "${formatTravadas({ 'logica-18': true })}"`,
);
check('false não conta', formatTravadas({ 'matrizes-1': true, 'matrizes-2': false }) === 'Matrizes Q1');
// ordenação por número, não por inserção
check(
  'ordenação numérica',
  formatTravadas({ 'matrizes-10': true, 'matrizes-2': true }) === 'Matrizes Q2, Q10',
);

console.log('\n=== (C) countTravadas + normalizeTravadas — defesa de leitura ===');
check('conta 3', countTravadas(t1) === 3);
check('conta ignora false', countTravadas({ a: true, b: false }) === 1);
check('normalize: null → {}', JSON.stringify(normalizeTravadas(null)) === '{}');
check('normalize: array → {}', JSON.stringify(normalizeTravadas([1, 2])) === '{}');
check('normalize: string → {}', JSON.stringify(normalizeTravadas('5')) === '{}');
check(
  'normalize: só true sobrevive',
  JSON.stringify(normalizeTravadas({ 'matrizes-3': true, 'matrizes-4': 'sim', 'logica-1': 1 })) ===
    '{"matrizes-3":true}',
);

console.log('\n=== (D) plano — véspera aponta para o registro do Hub ===');
const vespera = MATH_EXAM_PLAN.find((d) => d.offset === 1);
check(
  'tarefa da véspera menciona travadas do Hub',
  !!vespera?.tarefas.some((t) => t.texto.includes('travaram') && t.texto.includes('Hub')),
);
check(
  'dia de prática D-4 existe (hoje 27/09)',
  MATH_EXAM_PLAN.some((d) => d.offset === 4 && d.kind === 'pratica'),
);

console.log('\n=== (E) chave ===');
check('chave versionada', MATH_TRAVADAS_KEY === 'hub:math-exam:v1:travadas');

console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
