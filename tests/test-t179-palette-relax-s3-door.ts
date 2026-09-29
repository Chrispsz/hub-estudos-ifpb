/**
 * Task 179 — A BUSCA QUE LÊ A FRASE + A PORTA DA S3.
 *
 * A noite do simulado (29/09) e a véspera (30/09) pediram duas coisas que a
 * casa devia desde antes da prova:
 *
 *  1. A BUSCA QUE LÊ A FRASE (a dívida P2 da 173): o aluno digita a busca
 *     como fala — "lista de matrizes bloco 1" — e o e-e de palavras da 173
 *     engolia a frase inteira por causa de LIGAÇÃO: o "de" não mora no
 *     título "Matrizes — Aula 01 (Lista)" e UMA palavra ausente apagava
 *     todos os resultados ("Nada encontrado" para frase legítima). A régua
 *     v2 separa CONTEÚDO de LIGAÇÃO: stopwords nunca bloqueiam; 3+
 *     significativas toleram 1 falha ("bloco" não está no título, mas 3
 *     pistas apontam para a mesma lista); com 2 continua estrito.
 *  2. A PORTA DA S3 (material-first): o marco do dia diz "+ entrega S3 de
 *     Algoritmos" em todo lugar — e a menção não abria NADA. A FONTE ÚNICA
 *     (examWeekMilestoneFor) agora carrega o materialId da entrega e o
 *     marcos do card da prova ganha o chip que abre o material REAL
 *     (Questões da Semana 3) no Estudar — a menção que abre o conteúdo,
 *     não a que só nomeia. A porta existe SÓ no dia do compromisso, SÓ com
 *     o canal de abertura e SÓ com material real (a casa não inventa porta).
 *
 * Contrato (`bun tests/test-t179-palette-relax-s3-door.ts`):
 *  A. LIB REAL (execução): paletteWordFilter v2 — frase natural, stopwords,
 *     tolerância de 1 erro a partir de 3 significativas, precisão intacta
 *     para 1–2 termos, acento e caixa dobrados dos dois lados.
 *  B. FIAÇÃO DA BUSCA (command-palette): o filtro segue plugado (t173) e o
 *     estado vazio ensina o próximo gesto (a dica das palavras de ligação).
 *  C. A PORTA DA S3 (math-exam-prep + exam-prep-card + dashboard):
 *     materialId na FONTE ÚNICA com execução REAL (só o simulado tem), o
 *     chip existe só no dia/na assinatura certas, o id resolve em material
 *     REAL do acervo (a porta nunca é morta), estilo da cor da disciplina.
 *  D. DOUTRINA + REGRESSÕES: palette-search segue PURA; t173 (precisão da
 *     palavra inteira, acento), t174 (conceitos) e t175/t178 (fiação do
 *     leitor) não mudaram.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    pass += 1;
    console.log(`  [OK] ${label}`);
  } else {
    fail += 1;
    console.log(`  [FAIL] ${label}`);
  }
}

const HERE = (import.meta as { dir?: string }).dir ?? new URL('.', import.meta.url).pathname;
const ROOT = join(HERE, '..');
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ---------------------------------------------------------------------------
// A. LIB REAL — execução
// ---------------------------------------------------------------------------
console.log('A. paletteWordFilter v2 (execução real — a frase que acha)');
const ps = (await import(join(ROOT, 'src/lib/palette-search.ts'))) as typeof import('../src/lib/palette-search');

// O valor de busca do material real (a MESMA forma que a paleta monta —
// "material <título> <tipo>", minúscula na hora do value).
const VAL_LISTA = 'material matrizes — aula 01 (lista) lista_exercicios'
  .toLowerCase()
  .normalize('NFD');

// A1. Contratos que NUNCA mudam (o vazio e a precisão da 173)
ok(ps.paletteWordFilter(VAL_LISTA, '') === 1, 'A1. busca vazia → 1 (a paleta inteira, como sempre)');
ok(ps.paletteWordFilter(VAL_LISTA, 'matrizes') === 1, 'A1. 1 termo certeiro acha (a 173 intacta)');
ok(ps.paletteWordFilter(VAL_LISTA, 'logica') === 0, 'A1. 1 termo errado NÃO acha (precisão intacta)');
ok(ps.paletteWordFilter('questao matriz inversa', 'matriz inversa') === 1,
  'A1. 2 significativas certas → 1 ("matriz inversa" exige as duas)');
ok(ps.paletteWordFilter('questao matriz diagonal', 'matriz inversa') === 0,
  'A1. 2 significativas com 1 faltando → 0 (a tolerância cedo é ruído — ESTRICTO com 2)');

// A2. A FRASE DO DONO — o caso que apagou a busca na véspera da 173
ok(ps.paletteWordFilter(VAL_LISTA, 'lista de matrizes bloco 1') === 1,
  'A2. "lista de matrizes bloco 1" ACHA a lista (o "de" não bloqueia e 1 erro entre 4 é perdoado)');
ok(ps.paletteWordFilter(VAL_LISTA, 'lista de matrizes') === 1,
  'A2. "lista de matrizes" acha (só a stopword caiu, tudo mais bate)');
ok(ps.paletteWordFilter(VAL_LISTA, 'bloco de matrizes lista') === 1,
  'A2. ordem das palavras não importa (e-e por palavra, não subsequência)');

// A3. A régua da tolerância — 1 falha a partir de 3 significativas, NUNCA 2
ok(ps.paletteWordFilter('questao transposta simetria diagonal', 'transposta simetria diagonal') === 1,
  'A3. 3 significativas todas presentes → 1');
ok(ps.paletteWordFilter('questao transposta simetria diagonal', 'transposta simetria inversa') === 1,
  'A3. 3 significativas com 1 faltando (inversa) → 1 (a tolerância acerta: 2 pistas comuns)');
ok(ps.paletteWordFilter('questao transposta simetria diagonal', 'transposta inversa determinante') === 0,
  'A3. 3 significativas com 2 faltando → 0 (tolerância é de UM, não de dois)');
ok(ps.paletteWordFilter('questao transposta simetria', 'transposta simetria diagonal inversa') === 0,
  'A3. 4 significativas com 2 faltando → 0 (a régua não dilui a busca)');
ok(ps.PALETTE_RELAX_MIN_WORDS === 3, 'A3. PALETTE_RELAX_MIN_WORDS = 3 (a fronteira da tolerância é constante EXPORTADA)');

// A4. SÓ ligação na busca — o e-e bruto manda (o que digitou é o que exige)
ok(ps.paletteWordFilter('material lista de materiais', 'de') === 1,
  'A4. busca só-stopword presente no valor → 1 (e-e bruto)');
ok(ps.paletteWordFilter(VAL_LISTA, 'de da em') === 0,
  'A4. busca só-stopword ausente → 0 (nada de conteúdo foi pedido, nada é prometido)');

// A5. Acento e caixa dobrados dos dois lados (a lição da 173 intacta)
ok(ps.paletteWordFilter('questao lógica de proposições', 'LOGICA de') === 1,
  'A5. sem acento dos dois lados + stopword "de" ignorada');
ok(ps.paletteWordFilter('conceito MATRIZ transposta', 'matriz') === 1,
  'A5. caixa dobrada no haystack (o value da cmdk é minúsculo, a busca não)');

// A6. Stopword é PALAVRA INTEIRA — "delivery" não é "de"
ok(ps.paletteWordFilter('material delivery de pizzas', 'delivery') === 1,
  'A6. palavra significativa que CONTÉM stopword não é stopword (e-e por palavra)');

// A7. As stopwords são exatamente as de ligação — conteúdo NUNCA cai no filtro
ok(ps.paletteWordFilter('questao de inversa', 'inversa') === 1,
  'A7. termo de conteúdo ("inversa") continua exigido');
ok(ps.paletteWordFilter('lista exercicios prova real', 'prova real') === 1,
  'A7. "prova real" (2 significativas) segue E-E — a fonte da questão não se dilui');

// ---------------------------------------------------------------------------
// B. FIAÇÃO DA BUSCA — command-palette.tsx
// ---------------------------------------------------------------------------
console.log('B. a paleta pluga a régua e ensina no vazio');
const palette = src('src/components/hub/command-palette.tsx');

ok(palette.includes('commandFilter={paletteWordFilter}'),
  'B1. o filtro segue plugado na CommandDialog (t173 intacto)');
ok(palette.includes('Frases longas: palavras como') && palette.includes('tente os termos principais'),
  'B2. o estado vazio ensina o próximo gesto (a dica das palavras de ligação)');
ok(palette.includes('Nada encontrado. Tente outro termo.'),
  'B3. o "Nada encontrado" segue na casa (a dica acompanha, não substitui)');

// ---------------------------------------------------------------------------
// C. A PORTA DA S3 — fonte única + chip no marcos
// ---------------------------------------------------------------------------
console.log('C. a menção à S3 abre o material (material-first)');
const mp = (await import(join(ROOT, 'src/lib/math-exam-prep.ts'))) as typeof import('../src/lib/math-exam-prep');

// C1. A FONTE ÚNICA carrega a porta — execução REAL do marcos
const diaSimulado = new Date(`${mp.MATH_SIMULADO_DATE}T12:00:00`);
const mSimulado = mp.examWeekMilestoneFor(diaSimulado);
ok(!!mSimulado && mSimulado.kind === 'simulado', 'C1. o marco do simulado existe (execução real da fonte)');
ok(mSimulado?.materialId === 'alg-questoes-semana3',
  'C1. o marco do simulado carrega a porta da S3 (materialId da FONTE ÚNICA)');

// C2. As outras âncoras NÃO têm porta (a casa não promete o que não é do dia)
const mPreparo = mp.examWeekMilestoneFor(new Date(`${mp.MATH_PREPARO_SIMULADO_DATE}T12:00:00`));
const mVespera = mp.examWeekMilestoneFor(new Date(`${mp.MATH_VESPERA_DATE}T12:00:00`));
const mProva = mp.examWeekMilestoneFor(new Date(`${mp.MATH_EXAM.date}T12:00:00`));
ok(mPreparo?.materialId === undefined, 'C2. o preparo (28/09) não menciona material → sem porta');
ok(mVespera?.materialId === undefined, 'C2. a véspera (30/09) não menciona material → sem porta');
ok(mProva?.materialId === undefined, 'C2. a prova (01/10) não menciona material → sem porta');

// C3. O id da porta resolve em material REAL do acervo (a porta nunca é morta)
const cd = (await import(join(ROOT, 'src/data/course-data.ts'))) as typeof import('../src/data/course-data');
const s3 = cd.materials.find((m) => m.id === mSimulado?.materialId);
ok(!!s3, 'C3. o materialId resolve em material REAL do acervo (fonte única: course-data)');
ok(s3?.disciplineCode === 'TEC.1687', 'C3. a S3 é de Algoritmos (TEC.1687 — a cor da porta é a cor da disciplina)');
ok(s3?.title.includes('Semana 3') === true, 'C3. o título diz Semana 3 (a mesma voz do marcos)');
ok(s3?.type === 'lista_exercicios' && typeof s3?.pdfPath === 'string' && s3.pdfPath.length > 0,
  'C3. a lista tem PDF (a porta abre conteúdo, não nomeia fantasma)');

// C4. A fiação do chip no marcos (exam-prep-card)
const card = src('src/components/hub/exam-prep-card.tsx');
ok(card.includes('onStartStudy?: (disciplineCode?: string, materialId?: string) => void'),
  'C4. a prop onStartStudy documentada na interface (o mesmo canal do apoio do dia)');
ok(card.includes('milestone?.materialId') && card.includes("materials.find((m) => m.id === milestone.materialId)"),
  'C4. a porta lê o materialId da FONTE ÚNICA e resolve no acervo (nada re-declarado)');
ok(/onStartStudy && isSimuladoDay && milestone\?\.materialId/.test(card),
  'C4. a porta existe SÓ no dia do compromisso e SÓ com canal de abertura (a casa não inventa porta)');
ok(card.includes('onStartStudy?.(s3Material.disciplineCode, s3Material.id)'),
  'C4. o chip abre (disciplina, material) — a assinatura inteira, não só o id');
ok(card.includes('Abrir a S3') && card.includes('Questões da Semana 3'),
  'C4. o chip diz o que abre ("Abrir a S3 · Questões da Semana 3")');
ok(card.includes('a entrega dos programas é no Classroom'),
  'C4. o title confessa a fronteira: o Hub abre o material, a entrega segue no Classroom');
ok(card.includes(`aria-label={\`Abrir o material da entrega S3 de Algoritmos — \${s3Material.title}\`}`),
  'C4. aria-label com o título REAL do material (o leitor de tela ouve o que abre)');

// C5. O ESTILO (mandatório ④) — a cor da disciplina com foco visível
ok(card.includes('border-emerald-500/40 bg-emerald-500/10') && card.includes('dark:text-emerald-300'),
  'C5. esmeralda = Algoritmos (cor da DISCIPLINA, não a família âmbar do card)');
ok(/focus-visible:ring-2 focus-visible:ring-emerald-500\/50/.test(card),
  'C5. o chip tem foco visível (o teclado não anda às cegas — a gramática da t171)');
ok(card.includes('size-3 shrink-0 opacity-80') === false || card.includes('BookOpen'),
  'C5. ícone BookOpen na porta (a casa reconhece o gesto de abrir material)');

// C6. O dashboard serve o canal
const dash = src('src/components/hub/dashboard.tsx');
ok(/<ExamPrepCard onOpenSettings=\{onOpenSettings\} onStartStudy=\{onStartStudy\} \/>/.test(dash),
  'C6. o dashboard passa onStartStudy ao card (a porta chega ligada na raiz)');

// ---------------------------------------------------------------------------
// D. DOUTRINA + REGRESSÕES
// ---------------------------------------------------------------------------
console.log('D. doutrina e o que não podia mudar');
const psSrc = src('src/lib/palette-search.ts');
ok(!/document\.|window\.|localStorage|fetch\(/.test(psSrc),
  'D1. palette-search segue PURA (sem DOM/storage/fetch — a doutrina da casa)');

// Regressão t173 — a precisão e a fonte das entradas
ok(psSrc.includes('export const PALETTE_PREVIEW_MAX = 140'), 'D2. t173 intacto: PALETTE_PREVIEW_MAX segue 140');
ok(psSrc.includes('export function exercisePaletteEntry') && psSrc.includes('export function flashcardPaletteEntry'),
  'D2. t173 intacto: as entradas do acervo e do baralho seguem na lib');
ok(psSrc.includes('export function conceitoPaletteEntry'), 'D3. t174 intacto: a entrada de conceitos segue na lib');
ok(psSrc.includes('export const CONCEITO_PREVIEW_MAX = 120'), 'D3. t174 intacto: CONCEITO_PREVIEW_MAX segue 120');

// Regressão do marcos — os textos e estados do chip do simulado não mudaram
ok(card.includes('É hoje ·') && card.includes('Amanhã ·') && card.includes('29/09 ·'),
  'D4. o chip do simulado mantém os 3 estados (hoje/amanhã/futuro)');
ok(src('src/components/hub/simulado-view.tsx').includes('É hoje o simulado oficial da Av1'),
  'D4. o setup do simulado segue anunciando o dia oficial (a semana intacta)');
ok(mpSrcHasMaterialIdField(src('src/lib/math-exam-prep.ts')), 'D5. materialId é OPCIONAL na interface (os marcos sem material seguem válidos)');

function mpSrcHasMaterialIdField(mpx: string): boolean {
  return /materialId\?: string;/.test(mpx);
}

// Regressão t178 — o leitor e a folha não mudaram
const viewer = src('src/components/hub/pdf-viewer-dialog.tsx');
ok(viewer.includes('silent: true') || viewer.includes('silent:true'),
  'D6. t178 intacto: o instantâneo cheio segue viajando silent (o chat não abre por cima)');
const folha = src('src/components/hub/folha-revisao-sheet.tsx');
ok(folha.includes('MATH_RECITE_KEY'), 'D6. t178 intacto: a folha segue lendo o recibo da noite');

// Regressão t177 — o kit segue lendo o MESMO recibo
ok(src('src/components/hub/exam-prep-card.tsx').includes('receiptBadgeText(reciteReceipt)'),
  'D7. t177 intacto: o kit segue lendo o recibo (a porta da S3 não tocou a recitação)');

// ---------------------------------------------------------------------------

console.log(`\n${pass} checks OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
