// QA Task 71 — buildNotebookQuestion/isRecorrenteMistake unit check (sem API)
import { collectMistakes, isRecorrenteMistake, buildNotebookQuestion } from '../src/lib/mistake-notebook';
import type { StudyProgress } from '../src/lib/study-progress';

const S1 = 'Dadas as matrizes A = [[1,2],[3,4]] e B = [[5,6],[7,8]], calcule A + B, 3A e A × B (confira antes se a multiplicação é possível).';
const S2 = 'Construa a tabela verdade da proposição composta p ∧ (q → r). Quantas linhas têm? Identifique se é tautologia, contradição ou contingência.';

const progress = {
  simuladoRuns: [
    { id: 'r1', date: '2026-09-25T14:00:00.000Z', total: 2, solved: 0, missed: 2, skipped: 0, durationSec: 300, questions: [
      { status: 'missed', disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', difficulty: 'medio', statement: S1 },
      { status: 'missed', disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', difficulty: 'medio', statement: S2 },
    ]},
    { id: 'r2', date: '2026-09-26T15:00:00.000Z', total: 2, solved: 0, missed: 2, skipped: 0, durationSec: 300, questions: [
      { status: 'missed', disciplineCode: 'TEC.1984', topic: 'Álgebra Matricial', difficulty: 'medio', statement: S1 },
      { status: 'missed', disciplineCode: 'TEC.1984', topic: 'Lógica Matemática', difficulty: 'medio', statement: S2 },
    ]},
  ],
  exerciseProgress: {
    'mat-001': { tried: false, solved: false, neededHelp: false, lastPracticedAt: '2026-09-24T10:00:00.000Z' },
    'mat-002': { tried: true, solved: false, neededHelp: false, lastPracticedAt: '2026-09-24T10:00:00.000Z' },
  },
} as unknown as StudyProgress;

const items = collectMistakes(progress);
const simOnly = items.find((i) => i.key === 'sim:mat-001');
const checks = [
  ['sim-only crônico existe (1 linha, não 2)', items.filter((i) => i.title.includes('Dadas as matrizes')).length === 1],
  ['sim-only é RECORRENTE (novo sinal)', !!simOnly && isRecorrenteMistake(simOnly)],
  ['merged exercício é RECORRENTE', (() => { const m = items.find((i) => i.kind === 'exercicio' && i.title.includes('Construa')); return !!m && isRecorrenteMistake(m); })()],
  ['IA cita "perdi em 2 simulados"', (() => { const q = buildNotebookQuestion(items) ?? ''; return q.includes('perdi em 2 simulados diferentes'); })()],
  ['IA cabeçalho ATENÇÃO recorrentes', (buildNotebookQuestion(items) ?? '').includes('RECORRENTES')],
];
let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) fail += 1;
}
process.exit(fail);
