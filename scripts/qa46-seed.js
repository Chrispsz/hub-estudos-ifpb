// QA Task 46 — semeia dados de erro no perfil QA do DEV e devolve o script de limpeza.
// Uso: colar o objeto SEEDED no console via agent-browser eval.
// Baseado no padrão das rodadas 43/44 (mesma chave 'hub-estudos-ifpb:v2').

const raw = localStorage.getItem('hub-estudos-ifpb:v2');
const state = raw ? JSON.parse(raw) : {};
const p = state.state || state;

// 1 corrida nova com detalhes: 2 missed + 1 skipped (Matemática) e 1 missed (Algoritmos)
p.simuladoRuns = [
  {
    id: 'qa46-run-1',
    date: '2026-09-26T22:30:00.000Z',
    total: 5,
    solved: 2,
    missed: 3,
    skipped: 0,
    durationSec: 740,
    filters: { discipline: 'TEC.1984' },
    questions: [
      {
        status: 'solved',
        disciplineCode: 'TEC.1984',
        topic: 'Matrizes',
        difficulty: 'facil',
        statement: 'Dada a matriz A = [[1,2],[3,4]], calcule a matriz transposta de A.',
      },
      {
        status: 'missed',
        disciplineCode: 'TEC.1984',
        topic: 'Matrizes',
        difficulty: 'medio',
        statement:
          'Sejam A = [[1,2],[3,4]] e B = [[0,1],[1,0]]. Calcule o produto A·B e verifique se A·B = B·A.',
      },
      {
        status: 'missed',
        disciplineCode: 'TEC.1984',
        topic: 'Lógica',
        difficulty: 'medio',
        statement:
          'Construa a tabela-verdade da proposição (p → q) ∧ (q → p) e classifique como tautologia, contradição ou contingência.',
      },
      {
        status: 'missed',
        disciplineCode: 'TEC.1984',
        topic: 'Lógica',
        difficulty: 'dificil',
        statement:
          'Use as Leis de De Morgan para negar a proposição "se eu estudo, então passo e fico satisfeito".',
      },
      {
        status: 'skipped',
        disciplineCode: 'TEC.1687',
        topic: 'Repetição',
        difficulty: 'medio',
        statement: 'Escreva um programa em C que leia 10 números e imprima o maior e o menor.',
      },
    ],
  },
];

// 2 exercícios tentados e não resolvidos (reais do acervo)
p.exerciseProgress = Object.assign({}, p.exerciseProgress, {
  'prov-av1-q1': {
    tried: true,
    solved: false,
    neededHelp: true,
    lastPracticedAt: '2026-09-26T23:10:00.000Z',
  },
  'alg-001': {
    tried: true,
    solved: false,
    neededHelp: false,
    lastPracticedAt: '2026-09-25T20:00:00.000Z',
  },
});

// 2 flashcards com lapsos em caixa frágil (Matemática — baralho da Av1)
p.flashcards = [
  {
    id: 'qa46-fc-1',
    disciplineCode: 'TEC.1984',
    front: 'Quando uma matriz é simétrica?',
    back: 'Quando A = Aᵀ (a transposta é igual à própria matriz).',
    source: 'ia',
    createdAt: '2026-09-25T18:00:00.000Z',
    box: 0,
    dueAt: '2026-09-27T02:00:00.000Z',
    reviews: 3,
    lapses: 2,
    lastReviewedAt: '2026-09-26T21:00:00.000Z',
  },
  {
    id: 'qa46-fc-2',
    disciplineCode: 'TEC.1984',
    front: 'O que é um Modus Tollens?',
    back: 'De (p → q) e ¬q, conclui-se ¬p.',
    source: 'ia',
    createdAt: '2026-09-25T18:05:00.000Z',
    box: 1,
    dueAt: '2026-09-28T02:00:00.000Z',
    reviews: 2,
    lapses: 1,
    lastReviewedAt: '2026-09-26T21:05:00.000Z',
  },
];

if (state.state) state.state = p;
localStorage.setItem('hub-estudos-ifpb:v2', JSON.stringify(state));
`seeded: runs=${p.simuladoRuns.length} ex=${Object.keys(p.exerciseProgress).length} fc=${p.flashcards.length}`;
