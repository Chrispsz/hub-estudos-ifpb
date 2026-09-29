(() => {
  // QA Task 71 — seed "erros de sempre" completos:
  // A = mat-001 só-simulado crônico (2 corridas, sem exercício) → RECORRENTE novo sinal
  // C = mat-002 camada (b): exercício pendente lapses=0 + perdida em 2 corridas → RECORRENTE novo sinal
  // B = mat-004 recaída clássica (lapses=1, sem corridas) → RECORRENTE regressão
  // D = mat-003 só-simulado única (1 corrida) → NÃO recorrente (honesto)
  const S = {
    m1: 'Dadas as matrizes A = [[1,2],[3,4]] e B = [[5,6],[7,8]], calcule A + B, 3A e A × B (confira antes se a multiplicação é possível).',
    m2: 'Construa a tabela verdade da proposição composta p ∧ (q → r). Quantas linhas têm? Identifique se é tautologia, contradição ou contingência.',
    m3: 'Verifique se os argumentos a seguir são válidos: "Todos os programadores são lógicos. Ana é programadora. Logo, Ana é lógica." Use regras de inferência.',
  };
  const q = (statement, status) => ({
    status,
    disciplineCode: 'TEC.1984',
    topic: statement === S.m1 ? 'Álgebra Matricial' : 'Lógica Matemática',
    difficulty: 'medio',
    statement,
  });
  const run = (id, date, qs) => ({
    id,
    date,
    total: qs.length,
    solved: 0,
    missed: qs.length,
    skipped: 0,
    durationSec: 300,
    filters: { discipline: 'TEC.1984' },
    questions: qs,
  });
  const raw = localStorage.getItem('hub-estudos-ifpb:v2');
  const data = raw ? JSON.parse(raw) : {};
  data.simuladoRuns = [
    run('qa71-run1', '2026-09-25T14:00:00.000Z', [q(S.m1, 'missed'), q(S.m2, 'missed')]),
    run('qa71-run2', '2026-09-26T15:00:00.000Z', [q(S.m1, 'missed'), q(S.m2, 'missed'), q(S.m3, 'missed')]),
  ];
  data.exerciseProgress = {
    'mat-002': { tried: true, solved: false, neededHelp: false, lastPracticedAt: '2026-09-24T10:00:00.000Z' },
    'mat-004': { tried: true, solved: false, neededHelp: false, lapses: 1, lastPracticedAt: '2026-09-26T09:00:00.000Z' },
  };
  localStorage.setItem('hub-estudos-ifpb:v2', JSON.stringify(data));
  return 'seeded: runs=2, exPending=2 (mat-002 sem lapses, mat-004 lapses=1)';
})();
