// math-exam-prep.ts — FOCO: Prova de Matemática, 01/10/2026 (Av1)
//
// Tudo aqui é extraído dos MATERIAIS REAIS estudados em aula:
//   - mat-00-matrizes (teoria Aula 00) · mat-01-matrizes (LISTA — 35 questões)
//   - mat-logica-slides (47p) · mat-logica-lista (LISTA — 18 questões)
// PLANO REFEITO (24/09, D-7, pedido do dono): o plano antigo (12 dias,
// centrado em ler teoria) ficou confuso e incluía DETERMINANTES — que NÃO
// caem. Agora é simples: FAZER AS LISTAS impressas que o dono tem, bloco a
// bloco (Matrizes em 3 blocos → Lógica em 2 partes → simulado D-2 → véspera),
// com a teoria só como apoio. Determinantes (1.3) e Sistemas Lineares (1.4)
// ficam PÓS-PROVA — o professor ainda não deu (confirmado pelo dono em 24/09).

export const MATH_EXAM = {
  disciplineCode: 'TEC.1984',
  disciplineName: 'Matemática Aplicada à Computação',
  evaluationName: 'Av1',
  date: '2026-10-01', // confirmado pelo dono — fonte da verdade em course-data
  // ESCOPO REAL confirmado pelo dono (24/09): a prova é focada no CONTEÚDO
  // dado em sala = Matrizes (até inversa — Q31–35 da lista) + Lógica.
  // NÃO ENTRAM: determinantes e sistemas lineares (ainda não dados).
  programa:
    'NÚCLEO: Matrizes — operações (soma, escalar, produto), transposta, simétrica/antissimétrica e matriz inversa (Q31–35 da lista) + Lógica — proposições, conectivos, tabelas-verdade, tautologias, equivalências e argumentos. NÃO CAEM: determinantes e sistemas lineares (ainda não dados — confirmado 24/09).',
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

/**
 * Plano D-7 (24/09 → 01/10) — UM DIA POR OFFSET, centrado em RESOLVER AS LISTAS.
 * offset = dias antes da prova (7 = hoje 24/09, 0 = dia da prova).
 * Ordem recomendada das listas impressas (as 3 folhas que o dono tem):
 *   1º Lista de Matrizes (35Q, em 3 blocos) → 2º Lista de Lógica (18Q, em 2 partes).
 * Determinantes e sistemas lineares NÃO caem — nada aqui depende deles.
 */
export const MATH_EXAM_PLAN: PlanDay[] = [
  {
    offset: 7, // 24/09 — HOJE
    kind: 'pratica',
    titulo: 'Lista de Matrizes — Bloco 1 (Q1–16)',
    minutos: 90,
    tarefas: [
      { texto: 'No papel impresso: Q1–8 (construir matrizes pela lei de formação e igualdade) — a teoria da Aula 00 fica ao lado SÓ para consultar', materialId: 'mat-01-matrizes' },
      { texto: 'Q9–16: soma, diferença, escalar e equações matriciais simples (ex.: X + A = B − C)', materialId: 'mat-01-matrizes' },
      { texto: 'Marcar com caneta as que travaram — viram prioridade no Bloco 3 (D-5)', },
    ],
  },
  {
    offset: 6, // 25/09
    kind: 'pratica',
    titulo: 'Lista de Matrizes — Bloco 2 (Q17–30)',
    minutos: 90,
    tarefas: [
      { texto: 'Q17–22: produtos (linha × coluna) e potências A², A³, Aⁿ — a ideia da Q19/Q20 vale ouro', materialId: 'mat-01-matrizes' },
      { texto: 'Q23–30: matrizes que comutam, transposta e simétrica/antissimétrica', materialId: 'mat-01-matrizes' },
      { texto: 'Apoio no Praticar: mat-ex03 (AB ≠ BA) e mat-ex04 (transposta + antissimétrica)', exercisePool: ['mat-ex03', 'mat-ex04'] },
    ],
  },
  {
    offset: 5, // 26/09
    kind: 'pratica',
    titulo: 'Lista de Matrizes — Bloco 3 (Q31–35: inversa) + revisão',
    minutos: 75,
    tarefas: [
      { texto: 'Q31–35: inversa — depois de inverter, SEMPRE confira A·A⁻¹ = I (a verificação pega quase todo erro)', materialId: 'mat-01-matrizes' },
      { texto: 'Refazer as marcadas no Bloco 1: tentar primeiro, consultar a teoria depois', materialId: 'mat-00-matrizes' },
      { texto: 'Determinantes como TÓPICO não caem — se usar a fórmula da inversa 2×2 (det = ad − bc por dentro), ela está nos cards abaixo', },
    ],
  },
  {
    offset: 4, // 27/09
    kind: 'pratica',
    titulo: 'Lista de Lógica — Parte 1 (Q1–12)',
    minutos: 90,
    tarefas: [
      { texto: 'Q1–7: proposições (V/F), tradução português ↔ símbolos e valores lógicos', materialId: 'mat-logica-lista' },
      { texto: 'Q8–10: tabelas-verdade e tautologia/contradição/contingência — monte TODAS as linhas', materialId: 'mat-logica-lista' },
      { texto: 'Q11–12: equivalências, negações e quantificadores (a Q12 usa ∀ e ∃ — negue com cuidado)', materialId: 'mat-logica-lista' },
      { texto: 'Apoio no Praticar: mat-ex07 (proposições) e mat-ex08 (negações)', exercisePool: ['mat-ex07', 'mat-ex08'] },
    ],
  },
  {
    offset: 3, // 28/09
    kind: 'pratica',
    titulo: 'Lista de Lógica — Parte 2 (Q13–18: argumentos)',
    minutos: 90,
    tarefas: [
      { texto: 'Q13–15: encadeamentos estilo múltipla escolha — exatamente o formato de prova', materialId: 'mat-logica-lista' },
      { texto: 'Q16–18: ilha dos cavalheiros/velhacos, OBMEP dos tamanduás e o caso do crime — raciocínio puro, com calma', materialId: 'mat-logica-lista' },
      { texto: 'Apoio no Praticar: mat-ex11 (De Morgan) e mat-ex12 (validade de argumento)', exercisePool: ['mat-ex11', 'mat-ex12'] },
    ],
  },
  {
    offset: 2, // 29/09
    kind: 'simulado',
    titulo: 'SIMULADO — prova completa',
    minutos: 75,
    tarefas: [
      { texto: 'Simulado Pro: 10 questões de Matemática, 60 min, sem consultar nada antes de responder', },
      { texto: 'Meta: ≥ 70% (nota de aprovação). Abaixo disso → o bloco com mais erros vira a revisão de amanhã', },
      { texto: 'Refazer no papel as que erraram, com o card de fórmulas fechado ao lado', },
    ],
  },
  {
    offset: 1, // 30/09
    kind: 'revisao',
    titulo: 'Véspera — revisão leve e erros',
    minutos: 50,
    tarefas: [
      { texto: 'Recitar os cards de fórmulas de memória (abaixo) — Matrizes primeiro, Lógica depois', },
      { texto: 'Refazer SOMENTE as questões marcadas como "não consegui" nas duas listas', },
      { texto: 'Perguntas de autoavaliação dos resumos IA dos 4 materiais de Matemática (leve, antes de dormir)', materialId: 'mat-01-matrizes' },
    ],
  },
  {
    offset: 0, // 01/10
    kind: 'prova',
    titulo: 'DIA DA PROVA — 01/10',
    minutos: 20,
    tarefas: [
      { texto: 'Manhã: reler só os cards de fórmulas e a tabela da implicação (15 min, sem exercício novo)', },
      { texto: 'Levar: caneta, lápis, borracha, calculadora (se permitido) e água', },
      { texto: 'Na prova: ler o enunciado 2×, começar pelas fáceis e conferir inversa com A·A⁻¹ = I', },
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
  { grupo: 'Matrizes', titulo: 'Inversa 2×2 (com det por dentro)', corpo: 'det(A) = a·d − b·c (só a ferramenta da inversa — determinantes como TÓPICO não caem)\nA⁻¹ = (1/det(A)) · [[d, −b], [−c, a]]\ndet(A) = 0 ⇒ NÃO existe inversa.\nTeste: A · A⁻¹ = I.', fonte: 'mat-00-matrizes' },
  { grupo: 'Matrizes', titulo: 'PÓS-PROVA: determinantes e sistemas', corpo: 'Determinantes (3×3/Sarrus) e Sistemas Lineares (AX = B) são os tópicos 1.3 e 1.4 — o professor ainda NÃO deu (confirmado 24/09): não caem na Av1.', fonte: 'mat-00-matrizes' },
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
      'Multiplicar matrizes sabendo quando é possível (AB ≠ BA)',
      'Montar a transposta e testar simetria/antissimetria',
      'Inverter matriz e verificar com A·A⁻¹ = I',
      'Resolver equações matriciais simples (X + A = B − C)',
    ],
  },
  {
    grupo: 'Pós-prova — NÃO cai na Av1',
    itens: [
      'Determinantes como tópico (2×2 aparece só por dentro da inversa)',
      'Sistemas lineares via AX = B (professor ainda não deu — confirmado 24/09)',
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

/**
 * Dias do plano que ficaram PARA TRÁS (modo recuperação).
 * O plano tem 8 dias (offset 7..0); se o aluno começar com menos dias,
 * os offsets acima de daysLeft são os dias pulados — catch-up condensado.
 */
export function missedPlanDays(daysLeft: number): PlanDay[] {
  if (daysLeft >= MATH_EXAM_PLAN.length) return [];
  return MATH_EXAM_PLAN.filter((d) => d.offset > daysLeft && d.offset > 0);
}
