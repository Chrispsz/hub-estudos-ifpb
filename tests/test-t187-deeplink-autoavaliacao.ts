/**
 * Task 187 — O DEEP-LINK DA AUTOAVALIAÇÃO.
 *
 * A fila P2 congelada desde a t178 ("deep-link da autoavaliação") descongela
 * AGORA porque a fundação da t186 existe: as perguntas de autoavaliação dos
 * 4 resumos de Matemática são REAIS. O que faltava era a porta fechar o
 * gesto: a tarefa 3 da VÉSPERA (offset 1 de MATH_EXAM_PLAN) falava em
 * QUATRO materiais mas a porta antiga (materialId solteiro) abria UM na
 * Biblioteca — o dono ainda teria que achar a porta do resumo e rolar um
 * resumo longo até as perguntas. Na noite da véspera (30/09), cada clique
 * extra é atrito que a tarefa não pede.
 *
 * A rodada entrega:
 *  (1) LIB: PlanTask.autoavaliacao?: {id, label}[] + MATH_AUTOAVALIACAO_TAREFA
 *      (os 4 resumos reais) + autoavaliacaoAnswered (contagem PURA — o MESMO
 *      mapa que o diálogo usa, zero segunda fonte de verdade);
 *  (2) DIÁLOGO: focusSection='autoavaliacao' — o MaterialSummaryDialog rola
 *      até a seção das perguntas (âncora resumo-autoavaliacao) e a acende
 *      por um instante (o farol apaga sozinho — estado de TELA);
 *  (3) CARD: chips por material nos DOIS renders de tarefas (card do dia +
 *      plano completo) com contagem viva de respondidas; o Kit da véspera
 *      abre o diálogo DE PÉ (não mais a Biblioteca).
 *
 * ④ a família esmeralda das portas (t185) e do acerto (t186): chip com
 * respondidas veste mais tinta, focus-visible ring acende o chip inteiro.
 *
 * Contrato (`bun tests/test-t187-deeplink-autoavaliacao.ts`):
 *  A. PLANO REAL (execução): a tarefa 3 da VÉSPERA tem autoavaliacao com
 *     EXATAMENTE os 4 ids reais, labels únicas, e o materialId solteiro
 *     morreu (a porta certa substitui a porta vaga).
 *  B. DADOS REAIS: os 4 ids existem em course-data; cada resumo tem 8
 *     perguntas não-vazias (a porta aponta para conteúdo, não para promessa).
 *  C. LIB REAL (execução): autoavaliacaoAnswered — mapa vazio/ausente/lixo →
 *     0; só true conta; byId bate com o total; ids fora do mapa → 0; PURA.
 *  D. FIAÇÃO do diálogo: prop focusSection (default null), âncora, farol
 *     com limpeza de timer, sectionLit no SummaryBody, transition do acender.
 *  E. FIAÇÃO do card: AutoavaliacaoChips nos DOIS renders, preventDefault
 *     (chips vivem dentro de label), contagem do MESMO mapa, Kit abre o
 *     diálogo de pé, diálogo montado com focusSection, ④ esmeralda + ring.
 *  F. DOUTRINA: UM só componente de chips (regra duplicada é dívida), a
 *     porta nova é OPCIONAL (Biblioteca/Estudar não mudam de hábito), a
 *     promessa do texto ("4 materiais") e a entrega se conferem.
 *  G. REGRESSÕES: t186 (normalização + rodapé honesto do diálogo), t185
 *     (as portas do Estudar), t184 (folhaPlanForPaper), t183
 *     (instantChipAlive), t180 (leitor), t177 (recitação).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}
function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

// ---------------------------------------------------------------------------
// A. PLANO REAL — a tarefa 3 da VÉSPERA com porta de verdade
// ---------------------------------------------------------------------------

import {
  MATH_EXAM_PLAN,
  MATH_AUTOAVALIACAO_TAREFA,
  autoavaliacaoAnswered,
  folhaPlanForPaper,
} from '../src/lib/math-exam-prep';

const vespera = MATH_EXAM_PLAN.find((d) => d.offset === 1);
ok(!!vespera, 'A: o dia da VÉSPERA (offset 1) existe no plano');
const tarefa3 = vespera?.tarefas[2];
ok(!!tarefa3, 'A: a tarefa 3 da véspera existe');
ok(!!tarefa3?.texto.includes('autoavaliação'), "A: a tarefa 3 fala em 'autoavaliação'");
ok(!!tarefa3?.texto.includes('4 materiais'), "A: a tarefa 3 promete '4 materiais'");
ok(Array.isArray(tarefa3?.autoavaliacao), 'A: a tarefa 3 tem o campo autoavaliacao (a porta)');
ok(tarefa3?.autoavaliacao?.length === 4, 'A: a porta aponta para EXATAMENTE 4 resumos');
ok(tarefa3?.materialId === undefined, 'A: o materialId solteiro morreu (a porta certa substitui a porta vaga)');
ok(tarefa3?.exercisePool === undefined, 'A: a tarefa 3 não promete exercício de apoio (não é treino)');

const IDS_TAREFA = tarefa3?.autoavaliacao?.map((l) => l.id) ?? [];
ok(
  JSON.stringify(IDS_TAREFA) ===
    JSON.stringify(['mat-00-matrizes', 'mat-01-matrizes', 'mat-logica-lista', 'mat-logica-slides']),
  'A: os ids da tarefa são os 4 resumos de Matemática do escopo',
);
const labels = tarefa3?.autoavaliacao?.map((l) => l.label) ?? [];
ok(new Set(labels).size === 4, 'A: as labels dos chips são únicas');
ok(labels.every((l) => l.trim().length > 0), 'A: nenhuma label vazia');
ok(
  JSON.stringify(MATH_AUTOAVALIACAO_TAREFA.map((l) => l.id)) === JSON.stringify(IDS_TAREFA),
  'A: MATH_AUTOAVALIACAO_TAREFA é a MESMA lista da tarefa (fonte única)',
);
// Nenhum OUTRO dia do plano usa o campo — a porta nasceu para a tarefa que promete
const outrosComCampo = MATH_EXAM_PLAN.flatMap((d) =>
  d.tarefas.filter((t) => t.autoavaliacao).map((t) => `${d.offset}: ${t.texto.slice(0, 30)}`),
).filter((s) => !s.startsWith('1:'));
ok(outrosComCampo.length === 0, `A: nenhum outro dia usa autoavaliacao (veio ${outrosComCampo.join(', ')})`);

// ---------------------------------------------------------------------------
// B. DADOS REAIS — a porta aponta para conteúdo real
// ---------------------------------------------------------------------------

import { materials } from '../src/data/course-data';

for (const id of IDS_TAREFA) {
  const m = materials.find((x) => x.id === id);
  ok(!!m, `B: ${id} existe no acervo (course-data)`);
  ok(!!m?.summaryFile, `B: ${id} tem summaryFile (o resumo é a porta)`);
  const p = join('public/data/ai-summaries', m?.summaryFile ?? '');
  ok(existsSync(join(process.cwd(), p)), `B: o resumo de ${id} existe no disco`);
  if (existsSync(join(process.cwd(), p))) {
    const d = JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'));
    const perg = d['perguntas_autoavaliacao'];
    ok(
      Array.isArray(perg) && perg.length === 8,
      `B: ${id} tem 8 perguntas de autoavaliação (fundação da t186)`,
    );
    ok(
      Array.isArray(perg) && perg.every((q: unknown) => typeof q === 'string' && q.trim().length > 0),
      `B: ${id} — toda pergunta é texto real`,
    );
  }
}

// ---------------------------------------------------------------------------
// C. LIB REAL — autoavaliacaoAnswered executada
// ---------------------------------------------------------------------------

const ids = ['a', 'b'];
ok(autoavaliacaoAnswered(undefined, ids).answered === 0, 'C: mapa ausente → 0');
ok(autoavaliacaoAnswered(null, ids).answered === 0, 'C: mapa null → 0');
ok(autoavaliacaoAnswered({}, ids).answered === 0, 'C: mapa vazio → 0');
ok(autoavaliacaoAnswered({ a: {}, b: { 0: false, 1: false } }, ids).answered === 0, 'C: só false → 0');
ok(autoavaliacaoAnswered({ a: { 0: true, 3: true }, b: { 1: true } }, ids).answered === 3, 'C: true conta (3)');
const det = autoavaliacaoAnswered({ a: { 0: true, 3: true }, b: { 1: true } }, ids);
ok(det.byId['a'] === 2 && det.byId['b'] === 1, 'C: byId bate com o total (2 + 1 = 3)');
ok(autoavaliacaoAnswered({ a: 'lixo' as never, b: null as never }, ids).answered === 0, 'C: lixo no valor → 0');
ok(autoavaliacaoAnswered({ a: { 0: 1, 1: 'sim' } as never }, ids).answered === 0, 'C: não-boolean → 0 (a contagem não inventa respondida)');
ok(autoavaliacaoAnswered({ c: { 0: true } }, ids).answered === 0, 'C: id fora da lista pedida → 0');
ok(autoavaliacaoAnswered(undefined, []).answered === 0, 'C: sem ids → 0');
ok(
  autoavaliacaoAnswered({ a: { 0: true } }, ids).byId['b'] === 0,
  'C: material sem checks aparece no byId com 0',
);

// A lib é PURA: math-exam-prep.ts não importa react/DOM/storage/fetch
const libSrc = src('src/lib/math-exam-prep.ts');
ok(!/from ['"]react['"]/.test(libSrc), 'C: a lib do plano não importa react (pura)');
ok(!/window\.|document\./.test(libSrc), 'C: a lib do plano não toca em window/document');
ok(!/localStorage\s*\.\s*(get|set|remove)Item/.test(libSrc), 'C: a lib do plano não lê nem escreve storage (só declara chaves para o cliente)');
ok(!libSrc.includes('fetch('), 'C: a lib do plano não faz fetch');

// ---------------------------------------------------------------------------
// D. FIAÇÃO DO DIÁLOGO — focusSection, âncora e farol
// ---------------------------------------------------------------------------

const dlgSrc = src('src/components/hub/material-summary-dialog.tsx');
ok(dlgSrc.includes("focusSection?: 'autoavaliacao' | null"), 'D: a prop focusSection existe (tipo fechado)');
ok(dlgSrc.includes('focusSection = null'), 'D: o default é null (Biblioteca/Estudar não mudam de hábito)');
ok(dlgSrc.includes("getElementById('resumo-autoavaliacao')"), 'D: o farol rola até a âncora resumo-autoavaliacao');
ok(dlgSrc.includes('id="resumo-autoavaliacao"'), 'D: a seção das perguntas TEM a âncora');
ok(dlgSrc.includes('scrollIntoView({ block: \'start\', behavior: \'smooth\' })'), 'D: a rolagem é suave até o início da seção');
ok(dlgSrc.includes('sectionLit'), 'D: o estado do farol existe');
ok(dlgSrc.includes('setSectionLit(false), 2400'), 'D: o farol apaga sozinho (2.4s — estado de TELA)');
ok(dlgSrc.includes('window.clearTimeout(settle)'), 'D: o timer da rolagem é limpo (sem farol fantasma)');
ok(dlgSrc.includes('sectionLit={sectionLit}'), 'D: o farol chega ao SummaryBody');
ok(dlgSrc.includes('sectionLit?: boolean'), 'D: o SummaryBody declara o farol');
ok(dlgSrc.includes("highlight && 'ring-2 ring-emerald-500/50"), 'D: ④ o acender veste o esmeralda da casa');
ok(dlgSrc.includes('transition-all duration-700'), 'D: ④ o apagar é transição, não susto');
ok(dlgSrc.includes('scroll-mt-3'), 'D: ④ a âncora respira do topo (scroll-margin)');
ok(dlgSrc.includes("focusSection !== 'autoavaliacao' || loading || !summary"), 'D: o farol só acende com conteúdo na mão');
ok(dlgSrc.includes('material?.id]'), 'D: trocar de material re-ancora (a epoch da abertura)');

// ---------------------------------------------------------------------------
// E. FIAÇÃO DO CARD — chips nos dois renders + Kit de pé + diálogo montado
// ---------------------------------------------------------------------------

const cardSrc = src('src/components/hub/exam-prep-card.tsx');
ok(cardSrc.includes("import { MaterialSummaryDialog } from './material-summary-dialog';"), 'E: o card importa o MESMO diálogo da casa');
ok(cardSrc.includes('function AutoavaliacaoChips('), 'E: o componente de chips existe');
ok((cardSrc.match(/<AutoavaliacaoChips/g) ?? []).length === 2, 'E: os chips vivem nos DOIS renders (card do dia + plano completo)');
ok(cardSrc.includes('links={t.autoavaliacao}'), 'E: os chips leem o campo da tarefa');
ok(cardSrc.includes('e.preventDefault(); // dentro de <label>'), 'E: o clique do chip não vira toggle da tarefa (preventDefault confessado)');
ok(cardSrc.includes('autoavaliacaoAnswered(sp.progress.autoavaliacaoChecks'), 'E: a contagem vem do MESMO mapa que o diálogo usa');
ok(cardSrc.includes('MATH_AUTOAVALIACAO_TAREFA.map((l) => l.id)'), 'E: a contagem pede os ids da FONTE (sem lista paralela)');
ok(cardSrc.includes('materials.find((x) => x.id === id)'), 'E: o chip resolve o material no acervo antes de abrir');
ok(cardSrc.includes('if (!m) return; // a casa não abre resumo de material que não existe'), 'E: material inexistente não abre diálogo (a casa não promete o que não tem)');
ok(cardSrc.includes("onOpenSelfAssessment={() => autoOpenFor('mat-01-matrizes')}"), 'E: o Kit abre o diálogo DE PÉ (não mais a Biblioteca)');
ok(!cardSrc.includes("openMethod({ disciplineCode: MATH_EXAM.disciplineCode, materialId: 'mat-01-matrizes' })"), 'E: a porta vaga do Kit morreu');
ok(cardSrc.includes('focusSection="autoavaliacao"'), 'E: o diálogo montado pelo card pede a seção das perguntas');
ok(cardSrc.includes('material={autoMaterial}'), 'E: o diálogo recebe o material do chip');
ok(cardSrc.includes('import { materials, type Material }'), 'E: o tipo Material vem do acervo (sem inventar forma)');

// ④ a família esmeralda do chip
ok(cardSrc.includes('focus-visible:ring-emerald-500/40'), 'E: ④ o teclado acende o chip inteiro (focus-visible ring)');
ok(cardSrc.includes("'border-emerald-500/40 bg-emerald-500/10 text-emerald-700"), 'E: ④ a família das portas (t185) no chip sem resposta');
ok(cardSrc.includes("'border-emerald-500/50 bg-emerald-500/15 text-emerald-700"), 'E: ④ quem já respondeu veste mais tinta (estado de acerto)');
ok(cardSrc.includes("'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"), 'E: ④ o chip segue a gramática dos chips da casa (título/porte)');
ok(cardSrc.includes("<CircleHelp className=\"size-2.5\" aria-hidden />"), 'E: ④ o ícone é o da seção no diálogo (CircleHelp — cor = conteúdo)');
ok(cardSrc.includes('respondida'), 'E: ④ o title confessa a contagem ("respondida(s) até agora")');
ok(cardSrc.includes('{answered > 0 && ('), 'E: ④ a contagem é condicional');
ok(cardSrc.includes('<span className="tabular-nums font-semibold">· {answered}</span>'), 'E: ④ a contagem é tabular-nums (o número alinha com o plano)');
ok(cardSrc.includes('aria-hidden'), 'E: ④ os ícones decorativos são aria-hidden (o nome vai no texto)');

// ---------------------------------------------------------------------------
// F. DOUTRINA — fonte única e portas opcionais
// ---------------------------------------------------------------------------

ok((cardSrc.match(/function AutoavaliacaoChips\(/g) ?? []).length === 1, 'F: UM só componente de chips (regra duplicada é dívida certa — lição t175)');
const svSrc = src('src/components/hub/study-view.tsx');
ok(!svSrc.includes('focusSection'), 'F: o Estudar não pede seção (a porta da t185 abre no topo, como sempre)');
const mlSrc = src('src/components/hub/materials-list.tsx');
ok(!mlSrc.includes('focusSection'), 'F: a Biblioteca não pede seção (o hábito da casa intacto)');
ok(!tarefa3?.texto.includes('mat-01-matrizes'), 'F: o texto da tarefa não depende de id (a lista de resumos é a entrega)');
ok(
  tarefa3?.texto.includes('resumos IA dos 4 materiais de Matemática') === true &&
    IDS_TAREFA.length === 4,
  'F: a promessa do texto e a entrega da porta se conferem (4 = 4)',
);
ok(
  typeof folhaPlanForPaper(1) === 'object' &&
    folhaPlanForPaper(1)?.plan.tarefas[2]?.autoavaliacao?.length === 4,
  'F: a folha do papel lê o MESMO plano (os chips não mudam o texto impresso)',
);

// ---------------------------------------------------------------------------
// G. REGRESSÕES — nada do que já estava de pé tombou
// ---------------------------------------------------------------------------

ok(dlgSrc.includes('normalizeAiSummary'), 'G (t186): a normalização na porta de entrada segue de pé');
ok(dlgSrc.includes('perguntas respondidas'), 'G (t186): o rodapé honesto segue contando');
ok(dlgSrc.includes("totalQuestions > 0 ? 'justify-between' : 'justify-end'"), 'G (t186): o contador só existe com pergunta (o Recarregar fora do guard)');
ok(dlgSrc.includes('Print para o tutor'), 'G (t146): o print do resumo segue no diálogo');
ok(dlgSrc.includes("checks[i]"), 'G (t186): a vestimenta lê o check da pergunta');
ok(dlgSrc.includes("'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"), 'G (t186): ④ o acerto da pergunta respondida segue vestido');
ok(svSrc.includes('<MaterialSummaryDialog'), 'G (t185): a porta do resumo no Estudar segue abrindo ESTE diálogo');
const pvSrc = src('src/components/hub/pdf-viewer-dialog.tsx');
ok(pvSrc.includes('instantChipAlive'), 'G (t183): a vida do chip do leitor segue da lib (a fiação vive no leitor)');
ok(cardSrc.includes('folhaPlanForPaper') || libSrc.includes('function folhaPlanForPaper'), 'G (t184): a folha lê o dia pela mesma função');
ok(libSrc.includes('export function folhaPlanForPaper'), 'G (t184): folhaPlanForPaper segue exportada da fonte');
ok(cardSrc.includes("MATH_RECITE_KEY"), 'G (t177): a recitação segue no card');
ok(existsSync(join(process.cwd(), 'src/components/hub/pdf-viewer-dialog.tsx')), 'G (t180): o leitor segue no lugar');

// ---------------------------------------------------------------------------

console.log(`\nt187 — O DEEP-LINK DA AUTOAVALIAÇÃO: ${pass} ok, ${fail} falhas`);
process.exit(fail > 0 ? 1 : 0);
