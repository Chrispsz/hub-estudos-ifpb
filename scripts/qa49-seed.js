// qa49-seed.js — semeia dados REAIS de prontidão no perfil QA (dev)
// simulado TEC.1984 60% · baralho 2/3 maduros · 1/6 exercícios · checklist 4/12 · plano 2/21
// Score esperado: 60×.30 + 17×.20 + 33×.20 + 67×.15 + 10×.15 ≈ 39 (atencao)
// Caderno pendente na Matemática: 2 (mat-ex04 + cartão com lapses)
const KEY = 'hub-estudos-ifpb:v2';
const p = JSON.parse(localStorage.getItem(KEY) || '{}');

p.simuladoRuns = [
  {
    id: 'qa49-r1',
    date: '2026-09-26T10:00:00.000Z',
    total: 10,
    solved: 6,
    missed: 3,
    skipped: 1,
    durationSec: 2400,
    filters: { discipline: 'TEC.1984', onlyMaterialFirst: true },
    questions: [],
  },
];

p.flashcards = [
  {
    id: 'qa49-fc1',
    disciplineCode: 'TEC.1984',
    front: 'Fórmula da inversa de uma matriz 2×2?',
    back: 'A^{-1} = 1/(ad-bc) · [[d,-b],[-c,a]]',
    source: 'manual',
    createdAt: '2026-09-25T12:00:00.000Z',
    box: 2,
    dueAt: '2026-09-30T12:00:00.000Z',
    reviews: 3,
    lapses: 0,
  },
  {
    id: 'qa49-fc2',
    disciplineCode: 'TEC.1984',
    front: 'Tabela da implicação p → q — quando é falsa?',
    back: 'F APENAS quando V → F',
    source: 'manual',
    createdAt: '2026-09-25T12:00:00.000Z',
    box: 0,
    dueAt: '2026-09-27T12:00:00.000Z',
    reviews: 2,
    lapses: 1,
  },
  {
    id: 'qa49-fc3',
    disciplineCode: 'TEC.1984',
    front: 'Quais são as equivalências de De Morgan?',
    back: '¬(p∧q) ≡ ¬p∨¬q · ¬(p∨q) ≡ ¬p∧¬q',
    source: 'manual',
    createdAt: '2026-09-25T12:00:00.000Z',
    box: 3,
    dueAt: '2026-10-02T12:00:00.000Z',
    reviews: 5,
    lapses: 0,
  },
];

p.exerciseProgress = {
  'mat-ex03': { tried: true, solved: true, neededHelp: false, lastPracticedAt: '2026-09-26T11:00:00.000Z' },
  'mat-ex04': { tried: true, solved: false, neededHelp: true, lastPracticedAt: '2026-09-26T11:30:00.000Z' },
};

p.notebookRevised = {};

localStorage.setItem(KEY, JSON.stringify(p));

// Plano D-7 (2/21) e Checklist (4/12 — só núcleo, grupo pós-prova não conta)
localStorage.setItem(
  'hub:math-exam:v1:plan',
  JSON.stringify({ '7-0': true, '7-1': true }),
);
localStorage.setItem(
  'hub:math-exam:v1:checklist',
  JSON.stringify({
    'Matrizes (núcleo da Av1)-0': true,
    'Matrizes (núcleo da Av1)-1': true,
    'Matrizes (núcleo da Av1)-2': true,
    'Matrizes (núcleo da Av1)-3': true,
  }),
);
'seeded: simulado 60% · baralho 2/3 · exercicios 1/6 · checklist 4/12 · plano 2/21 · pendentes 2';
