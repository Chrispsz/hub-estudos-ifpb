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

  // Tópicos do escopo REAL da Av1 (os mesmos do preset do Simulado da Av1) —
  // o "foco da prova" no card usa a tendência real das tentativas RECORTADA
  // por estes tópicos para apontar onde revisar (pior primeiro).
  topicosEscopo: ['Álgebra Matricial', 'Lógica Matemática'],
} as const;

/**
 * META DA AV1 — nota de aprovação (≥ 70 na escala 0-100). Fonte única do
 * número: notaPeso acima. Aparece no veredito do resultado do simulado,
 * nas linhas de meta dos gráficos do Histórico e no score de prontidão —
 * um número só, para nunca divergir entre telas.
 */
export const MATH_META = 70;

/**
 * DATA DO SIMULADO OFICIAL — o dia offset 2 do plano (29/09), derivado da
 * data da prova para nunca divergir: mudou a prova, muda o simulado junto.
 * O marco "é hoje" do card da prova usa esta data (render-time — sem
 * interval nem estado, reage a mock de relógio no mesmo frame).
 */
export const MATH_SIMULADO_DATE = (() => {
  const d = new Date(`${MATH_EXAM.date}T12:00:00`);
  d.setDate(d.getDate() - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
})();

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
      { texto: 'Refazer SOMENTE as questões que travaram nas duas listas — o Hub guarda as travadas marcadas (na folha impressa elas vêm listadas)', },
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
  /** Linhas em LaTeX (KaTeX) — renderizadas como matemática de verdade no card. */
  math?: string[];
  fonte: string; // material de origem
}

/** Fórmulas-regras extraídas dos resumos IA dos materiais (formulas_regras).
 *  math[] em LaTeX (KaTeX) — o card renderiza como matemática de verdade. */
export const MATH_FORMULAS: FormulaCard[] = [
  {
    grupo: 'Matrizes', titulo: 'Ordem e elemento geral',
    corpo: 'A com m linhas × n colunas → ordem m×n.\nElemento aij = linha i, coluna j.',
    math: ['A_{m \\times n},\\quad a_{ij} = \\text{linha } i,\\ \\text{coluna } j'],
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'Soma e escalar',
    corpo: 'A + B: somar elemento a elemento (mesma ordem).\nkA: multiplicar TODOS os aij por k.',
    math: ['(A+B)_{ij} = a_{ij} + b_{ij},\\quad (kA)_{ij} = k \\cdot a_{ij}'],
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'Multiplicação',
    corpo: 'Só existe se colunas de A = linhas de B — linha i de A × coluna j de B.\nAB ≠ BA (não é comutativa!).',
    math: ['A_{m \\times n} \\cdot B_{n \\times p} = C_{m \\times p}', 'c_{ij} = \\sum_{k=1}^{n} a_{ik} \\cdot b_{kj},\\quad AB \\neq BA'],
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'Transposta e simetria',
    corpo: 'Aᵀ: linhas viram colunas.\nAntissimétrica: diagonal toda zero.',
    math: ['(A^T)_{ij} = a_{ji}', 'A = A^T \\;\\text{(simétrica)},\\quad A^T = -A \\;\\text{(antissimétrica)}'],
    fonte: 'mat-01-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'Inversa 2×2 (com det por dentro)',
    corpo: 'Determinantes como TÓPICO não caem — a fórmula abaixo é a única ferramenta necessária.\ndet(A) = 0 ⇒ NÃO existe inversa. SEMPRE confira A·A⁻¹ = I.',
    math: ['A^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix},\\quad A \\cdot A^{-1} = I'],
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'PÓS-PROVA: determinantes e sistemas',
    corpo: 'Determinantes (3×3/Sarrus) e Sistemas Lineares (AX = B) são os tópicos 1.3 e 1.4 — o professor ainda NÃO deu (confirmado 24/09): não caem na Av1.',
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Lógica', titulo: 'Conectivos',
    corpo: 'não · e · ou · se…então · se e só se.',
    math: ['\\neg p,\\quad p \\land q,\\quad p \\lor q,\\quad p \\rightarrow q,\\quad p \\leftrightarrow q'],
    fonte: 'mat-logica-slides',
  },
  {
    grupo: 'Lógica', titulo: 'Tabela da implicação',
    corpo: '(V,V)=V · (V,F)=F · (F,V)=V · (F,F)=V',
    math: ['p \\rightarrow q \\;\\text{é F APENAS quando } V \\rightarrow F'],
    fonte: 'mat-logica-slides',
  },
  {
    grupo: 'Lógica', titulo: 'Tautologia × Contradição',
    corpo: 'Tautologia: sempre V. Contradição: sempre F. Contingência: depende dos valores.',
    math: ['p \\lor \\neg p \\;\\text{(tautologia)},\\quad p \\land \\neg p \\;\\text{(contradição)}'],
    fonte: 'mat-logica-lista',
  },
  {
    grupo: 'Lógica', titulo: 'De Morgan',
    corpo: 'Negou o E vira OU de negações!',
    math: ['\\neg(p \\land q) \\equiv \\neg p \\lor \\neg q', '\\neg(p \\lor q) \\equiv \\neg p \\land \\neg q'],
    fonte: 'mat-logica-slides',
  },
  {
    grupo: 'Lógica', titulo: 'Regras de argumento',
    corpo: 'As três regras que validam argumentos — caem no formato "premissas → conclusão".',
    math: ['\\text{Ponens: } p \\rightarrow q,\\ p \\vdash q', '\\text{Tollens: } p \\rightarrow q,\\ \\neg q \\vdash \\neg p', '\\text{Silogismo: } p \\rightarrow q,\\ q \\rightarrow r \\vdash p \\rightarrow r'],
    fonte: 'mat-logica-lista',
  },
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

/**
 * Janela do KIT DA VÉSPERA: o bloco calmo do card da prova só existe quando
 * falta pouco — do DIA DO SIMULADO (D-2, 29/09: à noite o dono já começa a
 * transição) até o DIA DA PROVA (D-0). Antes disso o plano das listas manda;
 * mostrar o kit cedo seria ruído, não calma.
 */
export function isVesperaWindow(daysLeft: number): boolean {
  return daysLeft >= 0 && daysLeft <= 2;
}

/** Dia do plano para "faltam N dias" (N = daysUntilDate da prova). */
export function planDayFor(daysLeft: number): PlanDay | undefined {
  return MATH_EXAM_PLAN.find((d) => d.offset === daysLeft);
}

/**
 * Offset do dia do SIMULADO no plano — fonte única derivada do PRÓPRIO plano
 * (mesma filosofia do MATH_SIMULADO_DATE): mudou o plano, muda o offset junto.
 */
export const MATH_SIMULADO_OFFSET =
  MATH_EXAM_PLAN.find((d) => d.kind === 'simulado')?.offset ?? 2;

/**
 * Um dia do plano está FEITO quando todas as suas tarefas estão marcadas.
 * (A mesma conta que a linha do tempo usa — extraída para o banner e o
 * diálogo do plano completo não divergirem da timeline.)
 */
export function planDayChecked(
  d: PlanDay,
  checked: Record<string, boolean>,
): boolean {
  return d.tarefas.every((_, i) => checked[`${d.offset}-${i}`] === true);
}

/**
 * Dias do plano que ficaram PARA TRÁS — só os PENDENTES de verdade.
 * O antigo missedPlanDays contava TODO dia passado: com o plano em curso,
 * o card acusava dias cumpridos ("SIMULADO — prova completa ficou para
 * trás" na véspera, mesmo com a prova feita no Hub). Um dia passado deixa
 * de ser pendente quando: (a) todas as tarefas estão marcadas, OU (b) é o
 * dia do simulado e a prova de Matemática do dia oficial já existe no
 * histórico — o run é o registro verdadeiro; as checkboxes são opcional.
 */
export function planDaysBehind(
  daysLeft: number,
  checked: Record<string, boolean>,
  simuladoFeitoNoDiaOficial: boolean,
): PlanDay[] {
  if (daysLeft >= MATH_EXAM_PLAN.length) return [];
  return MATH_EXAM_PLAN.filter(
    (d) =>
      d.offset > daysLeft &&
      d.offset > 0 &&
      !planDayChecked(d, checked) &&
      !(d.kind === 'simulado' && simuladoFeitoNoDiaOficial),
  );
}

// ---------- Baralho da Av1 (flashcards Leitner) ----------

/**
 * Baralho pronto da Av1 — 1 toque adiciona ao sistema Leitner do Praticar
 * (aba Flashcards). Frente = pergunta curta; verso = fórmula em LaTeX
 * (renderizada com KaTeX pelo verso do cartão) + regra em português.
 * Conteúdo 1:1 com MATH_FORMULAS e os materiais reais da disciplina.
 */
export const MATH_FLASHCARDS: { front: string; back: string }[] = [
  {
    front: 'Como se lê a ordem de uma matriz e o que é o elemento aij?',
    back: 'Ordem **m × n** = linhas × colunas.\n$A_{m \\times n}$ — o elemento $a_{ij}$ está na **linha $i$, coluna $j$**.',
  },
  {
    front: 'Como somar matrizes e multiplicar por escalar?',
    back: 'Soma: elemento a elemento, **só existe se as ordens forem iguais**.\n$(A+B)_{ij} = a_{ij} + b_{ij}$\nEscalar: multiplica TODOS os elementos: $(kA)_{ij} = k \\cdot a_{ij}$.',
  },
  {
    front: 'Quando o produto A·B existe e como calculo cada elemento?',
    back: 'Só existe se **colunas de A = linhas de B**: $A_{m \\times n} \\cdot B_{n \\times p} = C_{m \\times p}$\n$c_{ij} = \\sum_{k=1}^{n} a_{ik} \\cdot b_{kj}$ (linha $i$ de $A$ × coluna $j$ de $B$).\n**AB ≠ BA** — produto de matrizes NÃO é comutativo!',
  },
  {
    front: 'Como montar a transposta de A?',
    back: 'Linhas viram colunas: $(A^T)_{ij} = a_{ji}$\nA 1ª linha de $A$ vira a 1ª coluna de $A^T$.',
  },
  {
    front: 'O que é matriz simétrica? E antissimétrica?',
    back: 'Simétrica: $A = A^T$ (espelho na diagonal).\nAntissimétrica: $A^T = -A$ ⇒ a **diagonal é toda zero**.',
  },
  {
    front: 'Fórmula da inversa de uma matriz 2×2?',
    back: '$A^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$\ntrocando $a \\leftrightarrow d$ e invertendo o sinal de $b$ e $c$.',
  },
  {
    front: 'Quando uma matriz NÃO tem inversa? Como conferir a inversa?',
    back: 'Se $ad - bc = 0$ ⇒ **não existe** inversa.\nSEMPRE confira: $A \\cdot A^{-1} = I$ (multiplicar tem que dar identidade).',
  },
  {
    front: 'O que é proposição? Quais frases NÃO são proposições?',
    back: 'Frase declarativa com valor lógico único: só **V ou F**.\nNão são: sentenças abertas ($x + 3 = 5$), imperativas ("Estude!"), interrogativas e paradoxos ("esta frase é falsa").',
  },
  {
    front: 'Tabela da implicação p → q — quando é falsa?',
    back: '$p \\rightarrow q$ é **F APENAS quando V → F**.\n$(V,V)=V \\; (V,F)=F \\; (F,V)=V \\; (F,F)=V$',
  },
  {
    front: 'Quantas linhas tem a tabela-verdade de uma proposição com n variáveis?',
    back: '$2^n$ linhas.\n2 variáveis → 4 linhas; 3 variáveis → 8 linhas.',
  },
  {
    front: 'Tautologia, contradição e contingência — definição e exemplo?',
    back: 'Tautologia: sempre V — $p \\lor \\neg p$.\nContradição: sempre F — $p \\land \\neg p$.\nContingência: depende dos valores — $p \\rightarrow q$.',
  },
  {
    front: 'Quais são as equivalências de De Morgan?',
    back: '$\\neg(p \\land q) \\equiv \\neg p \\lor \\neg q$\n$\\neg(p \\lor q) \\equiv \\neg p \\land \\neg q$\nNegou o E vira OU de negações (e vice-versa)!',
  },
  {
    front: 'Modus Ponens, Modus Tollens e Silogismo — os esquemas?',
    back: 'Ponens: $p \\rightarrow q,\\; p \\vdash q$\nTollens: $p \\rightarrow q,\\; \\neg q \\vdash \\neg p$\nSilogismo: $p \\rightarrow q,\\; q \\rightarrow r \\vdash p \\rightarrow r$',
  },
  {
    front: 'O que NÃO cai na Av1 de Matemática (01/10)?',
    back: 'Determinantes como TÓPICO (1.3) e Sistemas Lineares (1.4) — o professor ainda não deu (confirmado 24/09).\nO $ad - bc$ aparece só por dentro da fórmula da inversa 2×2.',
  },
];

/** Chave no localStorage que marca que o baralho da Av1 já foi adicionado. */
export const MATH_DECK_FLAG = 'hub:math-exam:v1:deck-added';

/**
 * KIT DO DIA DA PROVA — o que levar. Fonte única usada pelo Kit da Véspera
 * (card do Painel) e pela Folha de Revisão (/folha-revisao): um lugar só,
 * para nunca divergirem.
 */
export const MATH_EXAM_KIT: { emoji: string; label: string }[] = [
  { emoji: '✒️', label: 'caneta' },
  { emoji: '✏️', label: 'lápis' },
  { emoji: '🧽', label: 'borracha' },
  { emoji: '🧮', label: 'calculadora (se permitida)' },
  { emoji: '💧', label: 'água' },
];

// ---------- Travadas das listas impressas ----------

/**
 * As DUAS listas impressas que o dono resolve no papel (ordem definida no
 * plano de 24/09: 1º Matrizes em 3 blocos, 2º Lógica em 2 partes). O Hub
 * mantém o ESPELHO DIGITAL das marcas de caneta: o aluno marca aqui as
 * questões que travaram, e a véspera (Kit da Véspera + Folha de Revisão)
 * usa o registro para dizer EXATAMENTE o que refazer — sem "marquei a
 * caneta e perdi a folha".
 */
export const MATH_LISTAS: {
  id: 'matrizes' | 'logica';
  nome: string;
  total: number;
  fonte: string; // materialId da lista na Biblioteca
  resumo: string;
}[] = [
  {
    id: 'matrizes',
    nome: 'Lista de Matrizes',
    total: 35,
    fonte: 'mat-01-matrizes',
    resumo: '35 questões · blocos Q1–16, Q17–30 e Q31–35 no plano',
  },
  {
    id: 'logica',
    nome: 'Lista de Lógica',
    total: 18,
    fonte: 'mat-logica-lista',
    resumo: '18 questões · partes Q1–12 e Q13–18 no plano',
  },
];

/** Chave do espelho no localStorage: {"matrizes-7": true, "logica-4": true, ...}. */
export const MATH_TRAVADAS_KEY = 'hub:math-exam:v1:travadas';

/** Defesa de leitura: lixo/corrompido/parcial volta como objeto limpo. */
export function normalizeTravadas(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true) out[k] = true;
  }
  return out;
}

/** Total de travadas (soma das duas listas). */
export function countTravadas(travadas: Record<string, boolean>): number {
  return Object.values(travadas).filter(Boolean).length;
}

/**
 * "Matrizes Q7, Q12 · Lógica Q4" — formato ÚNICO usado pelo Kit da Véspera
 * e pela Folha de Revisão, para as duas superfícies nunca divergirem.
 * Sem travadas → string vazia (a superfície decide o estado vazio honesto).
 */
export function formatTravadas(travadas: Record<string, boolean>): string {
  return MATH_LISTAS.map((lista) => {
    const qs: number[] = [];
    for (let q = 1; q <= lista.total; q++) {
      if (travadas[`${lista.id}-${q}`]) qs.push(q);
    }
    if (qs.length === 0) return null;
    const nomeCurto = lista.nome.replace('Lista de ', '');
    return `${nomeCurto} Q${qs.join(', Q')}`;
  })
    .filter((p): p is string => p !== null)
    .join(' · ');
}
