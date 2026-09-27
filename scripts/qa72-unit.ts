/**
 * QA 72 — unit: dedupe/recorrência das linhas SEM PAR NO ACERVO.
 * Rodar: bun scripts/qa72-unit.ts
 *
 * Cenários:
 *  A. enunciado sem par em 2 corridas → 1 linha, mergedSimulado.count=2, RECORRENTE
 *  B. entrada SEM enunciado em 2 corridas → 2 linhas honestas (NÃO mescla), não-recorrente
 *  C. enunciado sem par em 1 corrida só → 1 linha, sem badge, não-recorrente
 *  D. chave estável: mesma chave nas 2 corridas (marcação "revisado" sobrevive)
 *  E. buildNotebookQuestion: [RECORRENTE] com "perdi em 2 simulados"; linha sem
 *     enunciado declarada honestamente ("NÃO tente reconstruir")
 *  F. buildItemQuestion noStatement: reformulada (ensina o tópico, não reensina a questão)
 *  G. regressão: dedupe do acervo (exercício pendente + simulado) continua 1 linha
 */
import { collectMistakes, isRecorrenteMistake, buildNotebookQuestion, buildItemQuestion, type MistakeItem } from '../src/lib/mistake-notebook';
import { exercises } from '../src/lib/exercise-extractor';
import type { StudyProgress, SimuladoRun } from '../src/lib/study-progress';

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${label}`);
  }
}

const S_NOPAIR = 'Questão autoral sem par no acervo: dado o conjunto A = {1,2,3}, determine a partição de A em dois subconjuntos disjuntos com soma igual. (enunciado antigo, removido do acervo depois da corrida)';
const S_NOPAIR_2 = 'Outra questão antiga sem par: classifique a proposição "se chove então levo guarda-chuva" quanto à contrapositiva.';

function run(id: string, date: string, questions: SimuladoRun['questions']): SimuladoRun {
  return {
    id,
    date,
    total: questions?.length ?? 0,
    solved: 0,
    missed: (questions ?? []).filter((q) => q.status === 'missed').length,
    skipped: (questions ?? []).filter((q) => q.status === 'skipped').length,
    durationSec: 300,
    questions,
  };
}

const base: StudyProgress = {
  materials: {},
  exerciseProgress: {},
  flashcards: [],
  simuladoRuns: [],
  focusSessions: [],
  notebookRevised: {},
} as unknown as StudyProgress;

// ---------- A + B + C ----------
const progress: StudyProgress = {
  ...base,
  simuladoRuns: [
    run('r1', '2026-09-25T10:00:00.000Z', [
      { status: 'missed', disciplineCode: 'mat', topic: 'Matrizes', statement: S_NOPAIR },
      { status: 'skipped', disciplineCode: 'mat', topic: 'Matrizes' }, // sem enunciado (corrida antiga)
    ]),
    run('r2', '2026-09-26T10:00:00.000Z', [
      { status: 'missed', disciplineCode: 'mat', topic: 'Matrizes', statement: S_NOPAIR },
      { status: 'missed', disciplineCode: 'mat', topic: 'Lógica', statement: S_NOPAIR_2 },
      { status: 'skipped', disciplineCode: 'mat', topic: 'Lógica' }, // sem enunciado (2ª corrida)
    ]),
  ],
} as StudyProgress;

const items = collectMistakes(progress);

console.log('A) sem par COM enunciado em 2 corridas → 1 linha mesclada e recorrente');
const merged = items.filter((it) => it.title.includes('partição de A'));
ok(merged.length === 1, `1 linha só (não 2 duplicadas): ${merged.length}`);
const m = merged[0] as MistakeItem;
ok(m.key.startsWith('simx:'), `chave estável simx: → ${m.key.slice(0, 14)}…`);
ok(m.mergedSimulado?.count === 2, `mergedSimulado.count = 2: ${m.mergedSimulado?.count}`);
ok(m.mergedSimulado?.missed === true, 'missed=true (uma das corridas errou)');
ok(isRecorrenteMistake(m), 'isRecorrenteMistake = true (crônico entre corridas)');
ok((m.note ?? '').includes('e em mais 1 simulado'), `nota conta o histórico: "${m.note}"`);
ok(m.when === '2026-09-26T10:00:00.000Z', `when = corrida mais recente: ${m.when}`);

console.log('B) sem enunciado gravado em 2 corridas → 2 linhas honestas, SEM mesclar');
const noStmt = items.filter((it) => it.noStatement);
ok(noStmt.length === 2, `2 linhas separadas (não fundidas): ${noStmt.length}`);
ok(noStmt.every((it) => !isRecorrenteMistake(it)), 'nenhuma vira recorrente por duplicação');
ok(noStmt.every((it) => !it.mergedSimulado), 'nenhuma ganha badge de fusão');

console.log('C) sem par em 1 corrida só → linha simples, não-recorrente');
const single = items.find((it) => it.title.includes('guarda-chuva'));
ok(!!single && !single.mergedSimulado, 'sem badge de fusão (count=1 não anuncia)');
ok(!!single && !isRecorrenteMistake(single as MistakeItem), 'não-recorrente');

console.log('D) chave estável entre corridas (revisado sobrevive)');
const r1Only: StudyProgress = {
  ...base,
  simuladoRuns: [run('r1', '2026-09-25T10:00:00.000Z', [{ status: 'missed', disciplineCode: 'mat', topic: 'Matrizes', statement: S_NOPAIR }])],
} as StudyProgress;
const k1 = collectMistakes(progress).find((it) => it.title.includes('partição de A'))?.key;
const k2 = collectMistakes(r1Only).find((it) => it.title.includes('partição de A'))?.key;
ok(k1 === k2, `mesma chave nas duas leituras: ${k1?.slice(0, 14)}…`);

console.log('E) IA: análise do caderno honesta');
const q = buildNotebookQuestion(items);
ok(!!q, 'pergunta montada');
ok((q ?? '').includes('[RECORRENTE — perdi em 2 simulados diferentes'), '[RECORRENTE] cita "perdi em 2 simulados diferentes"');
ok((q ?? '').includes('NÃO tente reconstruir a questão'), 'linha sem enunciado pede que a IA não invente conteúdo');
ok((q ?? '').includes('4 de simulados'), 'contagem de simulados no cabeçalho (mesclada + simples + 2 vagas)');

console.log('F) IA: chip individual reformulado p/ registro sem enunciado');
const chipQ = buildItemQuestion(noStmt[0] as MistakeItem);
ok(chipQ.includes('não gravou o enunciado'), 'declara a lacuna');
ok(chipQ.includes('Não tenta adivinhar qual era a questão'), 'proíbe adivinhação');
ok(chipQ.includes('me dá uma questão parecida'), 'propõe questão análoga do tópico');

console.log('G) regressão: dedupe do acervo continua intacto');
const ex0 = exercises[0];
const paired: StudyProgress = {
  ...base,
  exerciseProgress: {
    [ex0.id]: { tried: true, solved: false, marked: false, neededHelp: false, lapses: 0, lastPracticedAt: '2026-09-26T12:00:00.000Z' },
  },
  simuladoRuns: [run('r9', '2026-09-26T09:00:00.000Z', [
    { status: 'missed', disciplineCode: ex0.disciplineCode, topic: ex0.topic, statement: ex0.statement.slice(0, 160) },
  ])],
} as StudyProgress;
const pairedItems = collectMistakes(paired).filter((it) => it.kind === 'exercicio');
ok(pairedItems.length === 1, `exercício pendente + simulado = 1 linha: ${pairedItems.length}`);
ok(pairedItems[0]?.mergedSimulado?.count === 1, `fusão registrada (count 1, badge suave): ${pairedItems[0]?.mergedSimulado?.count}`);

console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
