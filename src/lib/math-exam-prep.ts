// math-exam-prep.ts — FOCO: Prova de Matemática, 01/10/2026 (Av1)
//
// Tudo aqui é extraído dos MATERIAIS REAIS estudados em aula:
//   - mat-00-matrizes (slides aula 00) · mat-01-matrizes (lista)
//   - mat-logica-slides (47p) · mat-logica-lista (exercícios)
// Plano de 12 dias (D-12 → dia da prova) com tarefas que apontam para os
// materiais e para os exercícios material-first do acervo (mat-ex01..12).
// Quando o dono mudar a data em course-data.ts (evaluationPeriods), o plano
// continua válido: os dias são calculados por OFFSET até a prova.

export const MATH_EXAM = {
  disciplineCode: 'TEC.1984',
  disciplineName: 'Matemática Aplicada à Computação',
  evaluationName: 'Av1',
  date: '2026-10-01', // confirmado pelo dono — fonte da verdade em course-data
  programa: 'Álgebra Matricial (núcleo da Av1) + Lógica Matemática (revisão contínua)',
  notaPeso: 'Av1 = 33,3% da média final (escala 0-100, aprovação ≥ 70)',
  simuladoFilter: { discipline: 'TEC.1984', onlyMaterialFirst: true },
} as const;

export type PlanKind = 'estudo' | 'pratica' | 'simulado' | 'revisao' | 'prova';

export interface PlanTask {
  texto: string;
  materialId?: string; // abre na Biblioteca (openMethod)
  exercisePool?: string[]; // ids no Praticar
}

export interface PlanDay {
  offset: number; // dias antes da prova (0 = dia da prova)
  kind: PlanKind;
  titulo: string;
  minutos: number;
  tarefas: PlanTask[];
}

/** 12 dias de plano — offset -11..0 (começa hoje quando faltam 12). */
export const MATH_EXAM_PLAN: PlanDay[] = [
  {
    offset: 11,
    kind: 'estudo',
    titulo: 'Matrizes: conceituação e tipos',
    minutos: 60,
    tarefas: [
      { texto: 'Reler slides da Aula 00: ordem, aij, matrizes especiais (linha, coluna, quadrada, identidade, nula)', materialId: 'mat-00-matrizes' },
      { texto: 'Treinar notação com o exercício de conceituação (mat-ex01)', exercisePool: ['mat-ex01'] },
      { texto: 'Fechar o caderno e escrever de memória os 5 tipos de matriz', },
    ],
  },
  {
    offset: 10,
    kind: 'pratica',
    titulo: 'Operações: soma, escalar e produto',
    minutos: 75,
    tarefas: [
      { texto: 'Slides: regra da multiplicação (linhas × colunas) e quando NÃO é possível', materialId: 'mat-00-matrizes' },
      { texto: 'Lista da Aula 01: exercícios de soma e produto (7, 9 e 17)', materialId: 'mat-01-matrizes' },
      { texto: 'mat-ex02 (operações básicas) e mat-ex03 (AB × BA e não-comutatividade)', exercisePool: ['mat-ex02', 'mat-ex03'] },
    ],
  },
  {
    offset: 9,
    kind: 'estudo',
    titulo: 'Transposta, simétricas e antissimétricas',
    minutos: 50,
    tarefas: [
      { texto: 'Definição Aᵀij = Aji + teste de simetria (A = Aᵀ)', materialId: 'mat-00-matrizes' },
      { texto: 'Lista: exercícios da transposta e simetria (2b, 26a, 28 e 29)', materialId: 'mat-01-matrizes' },
      { texto: 'mat-ex04 (transposta + antissimétrica)', exercisePool: ['mat-ex04'] },
    ],
  },
  {
    offset: 8,
    kind: 'estudo',
    titulo: 'Determinantes e matriz inversa 2×2',
    minutos: 75,
    tarefas: [
      { texto: 'Fórmula det = ad − bc e inversa = adj(A)/det(A) — slides', materialId: 'mat-00-matrizes' },
      { texto: 'Fazer 5 determinantes de cabeça e conferir com calculadora', },
      { texto: 'mat-ex05 (det + inversa + verificação A·A⁻¹ = I)', exercisePool: ['mat-ex05'] },
    ],
  },
  {
    offset: 7,
    kind: 'pratica',
    titulo: 'Sistemas lineares via matrizes',
    minutos: 75,
    tarefas: [
      { texto: 'Lista: sistemas matriciais (exercícios 3, 4, 11 e 15)', materialId: 'mat-01-matrizes' },
      { texto: 'mat-ex06 (AX = B com X = A⁻¹B)', exercisePool: ['mat-ex06'] },
      { texto: 'Anotar no caderno os 3 passos: montar A e B → det → X = A⁻¹B', },
    ],
  },
  {
    offset: 6,
    kind: 'simulado',
    titulo: 'SIMULADO 1 — bloco de Matrizes',
    minutos: 45,
    tarefas: [
      { texto: 'Simulado Pro: 5 questões, disciplina Matemática, modo prova (30-45 min)', },
      { texto: 'Corrigir com as dicas e registrar "consegui/não consegui" em cada uma', },
      { texto: 'Refazer no papel as que deram errado, seguindo o resumo da Aula 00', materialId: 'mat-00-matrizes' },
    ],
  },
  {
    offset: 5,
    kind: 'estudo',
    titulo: 'Lógica: proposições e conectivos',
    minutos: 60,
    tarefas: [
      { texto: 'Slides de Lógica: proposição, valor lógico, conectivos (∧ ∨ → ↔)', materialId: 'mat-logica-slides' },
      { texto: 'mat-ex07 (classificar proposições) e mat-ex08 (negações)', exercisePool: ['mat-ex07', 'mat-ex08'] },
      { texto: 'Traduzir 3 frases do dia a dia para símbolos lógicos', },
    ],
  },
  {
    offset: 4,
    kind: 'pratica',
    titulo: 'Tabelas-verdade sem medo',
    minutos: 75,
    tarefas: [
      { texto: 'Slides: montar tabela passo a passo (2 variáveis = 4 linhas)', materialId: 'mat-logica-slides' },
      { texto: 'Lista de Lógica: 3 tabelas-verdade à mão', materialId: 'mat-logica-lista' },
      { texto: 'mat-ex09 ((p→q) ∧ (q→p)) e mat-ex10 (tautologia/contradição)', exercisePool: ['mat-ex09', 'mat-ex10'] },
    ],
  },
  {
    offset: 3,
    kind: 'pratica',
    titulo: 'Equivalências e argumentos (De Morgan, Modus Ponens)',
    minutos: 60,
    tarefas: [
      { texto: 'Slides: equivalências notáveis e regras de inferência', materialId: 'mat-logica-slides' },
      { texto: 'mat-ex11 (De Morgan por tabela) e mat-ex12 (validade de argumento)', exercisePool: ['mat-ex11', 'mat-ex12'] },
      { texto: 'Lista de Lógica: identificar premissas e conclusão em 2 argumentos', materialId: 'mat-logica-lista' },
    ],
  },
  {
    offset: 2,
    kind: 'revisao',
    titulo: 'Revisão integrada: fórmulas + erros comuns',
    minutos: 50,
    tarefas: [
      { texto: 'Reler os cards de fórmulas deste plano (abaixo) e recitar cada uma de memória', },
      { texto: 'Ler "erros comuns" dos resumos IA dos 4 materiais de Matemática', materialId: 'mat-01-matrizes' },
      { texto: 'Resolver novamente as questões marcadas como "não consegui" no Praticar', },
    ],
  },
  {
    offset: 1,
    kind: 'simulado',
    titulo: 'SIMULADO 2 — prova completa',
    minutos: 60,
    tarefas: [
      { texto: 'Simulado Pro: 10 questões de Matemática, 60 minutos, sem consultar nada antes de responder', },
      { texto: 'Meta: ≥ 70% (nota de aprovação). Abaixo disso → revisar o bloco com mais erros', },
      { texto: 'Revisar perguntas de autoavaliação dos resumos antes de dormir (leve)', materialId: 'mat-logica-lista' },
    ],
  },
  {
    offset: 0,
    kind: 'prova',
    titulo: 'DIA DA PROVA — 01/10',
    minutos: 20,
    tarefas: [
      { texto: 'Manhã: reler só os cards de fórmulas e a tabela-verdade da implicação (15 min, sem exercício novo)', },
      { texto: 'Levar: caneta, lápis, borracha, calculadora (se permitido) e água', },
      { texto: 'Na prova: ler o enunciado 2×, começar pelas questões fáceis, conferir det antes de inverter matriz', },
    ],
  },
];

export interface FormulaCard {
  grupo: 'Matrizes' | 'Lógica';
  titulo: string;
  corpo: string; // suporta \n
  fonte: string; // material de origem
}

/** Fórmulas-regras extraídas dos resumos IA dos materiais (formulas_regras). */
export const MATH_FORMULAS: FormulaCard[] = [
  { grupo: 'Matrizes', titulo: 'Ordem e elemento geral', corpo: 'A com m linhas × n colunas → ordem m×n.\nElemento aij = linha i, coluna j.', fonte: 'mat-00-matrizes' },
  { grupo: 'Matrizes', titulo: 'Soma e escalar', corpo: 'A + B: somar elemento a elemento (mesma ordem).\nkA: multiplicar TODOS os aij por k.', fonte: 'mat-00-matrizes' },
  { grupo: 'Matrizes', titulo: 'Multiplicação', corpo: 'A(m×n) · B(n×p) = C(m×p).\nSó existe se colunas de A = linhas de B.\ncij = Σ aik · bkj (linha i de A × coluna j de B).\nAB ≠ BA (não é comutativa!).', fonte: 'mat-00-matrizes' },
  { grupo: 'Matrizes', titulo: 'Transposta e simetria', corpo: 'Aᵀ: linhas viram colunas (Aᵀij = Aji).\nSimétrica: A = Aᵀ.\nAntissimétrica: Aᵀ = −A (diagonal toda zero).', fonte: 'mat-01-matrizes' },
  { grupo: 'Matrizes', titulo: 'Determinante 2×2', corpo: 'A = [[a, b], [c, d]]\ndet(A) = a·d − b·c', fonte: 'mat-00-matrizes' },
  { grupo: 'Matrizes', titulo: 'Inversa 2×2', corpo: 'A⁻¹ = (1/det(A)) · [[d, −b], [−c, a]]\ndet(A) = 0 ⇒ NÃO existe inversa.\nTeste: A · A⁻¹ = I.', fonte: 'mat-00-matrizes' },
  { grupo: 'Matrizes', titulo: 'Sistema linear', corpo: 'AX = B ⇒ X = A⁻¹B (quando det(A) ≠ 0).\nMonte A (coeficientes), X (incógnitas), B (resultados).', fonte: 'mat-01-matrizes' },
  { grupo: 'Lógica', titulo: 'Conectivos', corpo: '¬p (não) · p ∧ q (e) · p ∨ q (ou) · p → q (se…então) · p ↔ q (se e só se).', fonte: 'mat-logica-slides' },
  { grupo: 'Lógica', titulo: 'Tabela da implicação', corpo: 'p → q é F APENAS quando V → F.\n(V,V)=V (V,F)=F (F,V)=V (F,F)=V', fonte: 'mat-logica-slides' },
  { grupo: 'Lógica', titulo: 'Tautologia × Contradição', corpo: 'Tautologia: sempre V (ex.: p ∨ ¬p).\nContradição: sempre F (ex.: p ∧ ¬p).\nContingência: depende dos valores.', fonte: 'mat-logica-lista' },
  { grupo: 'Lógica', titulo: 'De Morgan', corpo: '¬(p ∧ q) ≡ ¬p ∨ ¬q\n¬(p ∨ q) ≡ ¬p ∧ ¬q\nNegou o E vira OU de negações!', fonte: 'mat-logica-slides' },
  { grupo: 'Lógica', titulo: 'Regras de argumento', corpo: 'Modus Ponens: p→q, p ⊢ q.\nModus Tollens: p→q, ¬q ⊢ ¬p.\nSilogismo: p→q, q→r ⊢ p→r.', fonte: 'mat-logica-lista' },
];

/** Checklist de domínio — marcado pelo aluno no card da prova. */
export const MATH_CHECKLIST: { grupo: string; itens: string[] }[] = [
  {
    grupo: 'Matrizes (núcleo da Av1)',
    itens: [
      'Identificar ordem e elementos aij',
      'Somar matrizes e multiplicar por escalar',
      'Multiplicar matrizes sabendo quando é possível',
      'Montar a transposta e testar simetria',
      'Calcular determinante 2×2',
      'Inverter matriz 2×2 e verificar com A·A⁻¹ = I',
      'Resolver sistema 2×2 via AX = B',
    ],
  },
  {
    grupo: 'Lógica (revisão contínua)',
    itens: [
      'Reconhecer proposições e valores lógicos',
      'Negar proposições simples e compostas',
      'Montar tabela-verdade de proposição composta',
      'Classificar tautologia/contradição/contingência',
      'Aplicar De Morgan',
      'Validar argumento com Modus Ponens/Tollens',
    ],
  },
];

/** Dia do plano para "faltam N dias" (N = daysUntilDate da prova). */
export function planDayFor(daysLeft: number): PlanDay | undefined {
  return MATH_EXAM_PLAN.find((d) => d.offset === daysLeft);
}
