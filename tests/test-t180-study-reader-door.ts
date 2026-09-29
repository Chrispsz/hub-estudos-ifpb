/**
 * Task 180 — A PORTA QUE ABRE DE VERDADE.
 *
 * O achado da rodada (E2E ao vivo): a porta da S3 (t179) prometia "Abrir a
 * S3 · Questões da Semana 3" mas entregava SELEÇÃO — o material aparecia no
 * combobox do Pomodoro e nada abria. Pior: a aba Estudar NÃO tinha gesto
 * nenhum para ler o material selecionado — o "Material: {título}" sob o
 * cronômetro era texto morto, e o leitor só existia na Biblioteca. O dono
 * que clicava a porta tinha que caçar o material de novo na Biblioteca.
 *
 * O que a rodada entrega:
 *  1. A LIB PURA (src/lib/study-reader-door.ts): visibilidade da porta
 *     (pdfPath real, sem web_page), rótulo honesto sobre a retomada
 *     ("Continuar da pág. N" só com página conhecida >1), title que confessa
 *     a fronteira (Hub abre o material, entrega no Classroom) e a GUARDA do
 *     auto-abrir (nonce > 0 + material + PDF — diálogo que volta sozinho é
 *     popup, não porta).
 *  2. O NONCE DA PORTA (page.tsx): goStudy COM material bumpa o nonce —
 *     cada clique de porta é um pedido de ABERTURA; porta sem material
 *     segue seleção silenciosa. O StudyView consome o nonce UMA vez (guarda
 *     de módulo sobrevive à remontagem da aba).
 *  3. O LEITOR NA ABA ESTUDAR (study-view.tsx): o MESMO PdfViewerDialog da
 *     Biblioteca (modo dividido, print instantâneo da t175, pill de
 *     retomada) — auto-aberto pela porta da S3, aberto pela porta manual
 *     sob o cronômetro (focus ring da t171, truncate + title honesto,
 *     esmeralda = conteúdo, ArrowUpRight = micro-gesto das portas irmãs).
 *     O markAccessed é do próprio diálogo — abrir por aqui conta atividade.
 *
 * Contrato (`bun tests/test-t180-study-reader-door.ts`):
 *  A. LIB REAL (execução): readerDoorVisible / readerDoorLabel /
 *     readerDoorTitle / shouldAutoOpenReader — com os casos da casa.
 *  B. FIAÇÃO (page.tsx): nonce bumpado só com material, prop passado ao
 *     StudyView, goStudy intacto para portas sem material.
 *  C. FIAÇÃO (study-view.tsx): guarda de módulo, auto-open consumindo o
 *     nonce UMA vez, porta manual com assinatura/estilo/aria exatos,
 *     PdfViewerDialog montado com o material corrente, convite morto ao
 *     fechar (t162), markAccessed de fora.
 *  D. DOUTRINA + REGRESSÕES: lib pura (sem DOM/storage/fetch), t179 (a porta
 *     da S3 continua na fonte única e no card da prova), t175 (o print de
 *     página continua no leitor), t152 (instantPrintPage honesto).
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
console.log('A. study-reader-door (execução real — a porta decide)');
const door = await import('../src/lib/study-reader-door');
type DoorMaterial = Parameters<typeof door.readerDoorVisible>[0] extends infer T
  ? T extends { pdfPath?: string; type: string } ? T : never
  : never;
const pdfMat = { id: 'alg-questoes-semana3', title: 'Questões da Semana 3 (Classroom, 23/09)', type: 'lista_exercicios', pdfPath: '/pdfs/alg-questoes-semana3.pdf', pages: 1 } as unknown as DoorMaterial;
const webMat = { id: 'x', title: 'Página', type: 'web_page', pdfPath: '/pdfs/x.pdf', pages: 1 } as unknown as DoorMaterial;
const noPdfMat = { id: 'y', title: 'Resumo', type: 'resumo' } as unknown as DoorMaterial;

ok(door.readerDoorVisible(pdfMat) === true, 'material com PDF → porta existe');
ok(door.readerDoorVisible(webMat) === false, 'web_page → porta NÃO existe (outra porta, outro gesto)');
ok(door.readerDoorVisible(noPdfMat) === false, 'sem pdfPath → sem porta (a casa não inventa)');
ok(door.readerDoorVisible(null) === false, 'null → sem porta (sem material selecionado)');
ok(door.readerDoorVisible(undefined) === false, 'undefined → sem porta');

ok(door.readerDoorLabel(null) === 'Abrir no leitor', 'sem página guardada → "Abrir no leitor"');
ok(door.readerDoorLabel(undefined) === 'Abrir no leitor', 'undefined → "Abrir no leitor"');
ok(door.readerDoorLabel(1) === 'Abrir no leitor', 'página 1 (nunca viu) → "Abrir no leitor" (não mente sobre retomada)');
ok(door.readerDoorLabel(0) === 'Abrir no leitor', 'página 0 (lixo) → "Abrir no leitor"');
ok(door.readerDoorLabel(4) === 'Continuar da pág. 4', 'página 4 → "Continuar da pág. 4" (a porta lê a memória)');

const titleSemMem = door.readerDoorTitle('Questões da Semana 3 (Classroom, 23/09)', null, 1);
ok(titleSemMem.includes('Questões da Semana 3'), 'title nomeia o material');
ok(titleSemMem.includes('abre na primeira'), 'title confessa "sem página guardada — abre na primeira"');
ok(titleSemMem.includes('Classroom'), 'title confessa a fronteira (procedência Classroom → entrega no Classroom — t179)');
ok(titleSemMem.includes('UM clique'), 'title aponta o print de 1 clique (t175 vive no leitor que abre)');
ok(titleSemMem.includes('nada é salvo'), 'title confessa a privacidade (nada no disco)');
ok(door.readerDoorTitle('Lista de Matrizes — Bloco 1', null, 1).includes('Classroom') === false, 'material do acervo NÃO ganha a fronteira do Classroom (a frase é DADO, não chute)');
const titleComMem = door.readerDoorTitle('Lista de Matrizes — Bloco 1', 4, 16);
ok(titleComMem.includes('continuar da pág. 4 de 16'), 'title com memória diz de onde volta ("pág. 4 de 16")');
ok(titleComMem.includes('último lugar'), 'title confessa a fonte da página (o último lugar onde você esteve)');

ok(door.shouldAutoOpenReader(0, true, true) === false, 'nonce 0 (nenhuma porta clicada) → NÃO auto-abre');
ok(door.shouldAutoOpenReader(null, true, true) === false, 'nonce null → NÃO auto-abre');
ok(door.shouldAutoOpenReader(undefined, true, true) === false, 'nonce undefined → NÃO auto-abre');
ok(door.shouldAutoOpenReader(3, false, true) === false, 'nonce ok mas sem material → NÃO auto-abre');
ok(door.shouldAutoOpenReader(3, true, false) === false, 'nonce ok mas sem PDF → NÃO auto-abre (a casa não inventa porta)');
ok(door.shouldAutoOpenReader(3, true, true) === true, 'nonce inédito + material + PDF → AUTO-ABRE (a promessa do chip cumprida)');
ok(door.shouldAutoOpenReader(1, true, true) === true, 'nonce 1 (primeiro clique da vida) → AUTO-ABRE');

// ---------------------------------------------------------------------------
// B. FIAÇÃO — page.tsx (o nonce da porta)
// ---------------------------------------------------------------------------
console.log('B. page.tsx — goStudy bumpa o nonce só com material');
const pageSrc = src('src/app/page.tsx');
ok(pageSrc.includes('const [studyNonce, setStudyNonce] = React.useState(0)'), 'estado do nonce da porta (0 = nenhuma porta clicada)');
ok(/if \(materialId\) setStudyNonce\(\(n\) => n \+ 1\);/.test(pageSrc), 'goStudy bumpa o nonce SOMENTE com materialId (porta sem material = seleção silenciosa)');
ok(pageSrc.includes('setActive(\'study\')'), 'goStudy segue levando ao Estudar');
ok(pageSrc.includes('initialOpenNonce={studyNonce}'), 'nonce passado ao StudyView como initialOpenNonce');
ok(pageSrc.includes('initialMaterial={studyMaterial}'), 'initialMaterial segue passado (a seleção do Pomodoro continua)');
// O chip da S3 (t179) continua ligado ao MESMO canal:
ok(pageSrc.includes('onStartStudy={goStudy}'), 'Dashboard segue com onStartStudy (o canal da porta S3 e do apoio do dia)');

// ---------------------------------------------------------------------------
// C. FIAÇÃO — study-view.tsx (a porta que abre)
// ---------------------------------------------------------------------------
console.log('C. study-view.tsx — guarda de módulo, auto-open, porta manual, leitor');
const svSrc = src('src/components/hub/study-view.tsx');
ok(svSrc.includes('initialOpenNonce?: number'), 'prop initialOpenNonce tipado');
ok(svSrc.includes('let lastReaderNonceConsumed = 0'), 'guarda de módulo do nonce (sobrevive à remontagem da aba — o MESMO clique não reabre)');
ok(svSrc.includes("initialOpenNonce <= lastReaderNonceConsumed"), 'nonce inédito é a condição (nonce menor/igual = já consumido)');
ok(svSrc.includes('shouldAutoOpenReader('), 'a GUARDA pura decide o auto-abrir (não é if solto no componente)');
ok(svSrc.includes("readerDoorVisible(selectedMaterial)"), 'auto-open exige porta visível (PDF real)');
ok(svSrc.includes('setReaderOpen(true)'), 'auto-open abre o leitor');
ok(/lastReaderNonceConsumed = initialOpenNonce;\s*\n\s*return;/.test(svSrc), 'porta sem par CONSUME o nonce (o clique aconteceu — não volta a abrir depois)');
ok(svSrc.includes("recallPdfPage(selectedMaterial!.id, selectedMaterial!.pages) ?? undefined"), 'auto-open respeita a memória de retomada (t161 — abrir onde parou)');
ok(svSrc.includes("from '@/lib/study-reader-door'"), 'a lib pura é a fonte das decisões');
ok(svSrc.includes("from './pdf-viewer-dialog'"), 'o leitor é O MESMO diálogo da Biblioteca (print t175 incluso)');
ok(svSrc.includes('data-testid="study-reader-door"'), 'a porta manual tem testid');
ok(svSrc.includes('readerDoorLabel(readerResumePage)'), 'rótulo da porta vem da lib (honesto sobre a retomada)');
ok(svSrc.includes('readerDoorTitle('), 'title da porta vem da lib (confessa fronteira + print)');
ok(svSrc.includes('aria-label={`Abrir ${selectedMaterial?.title} no leitor'), 'aria-label nomeia o material que abre');
ok(svSrc.includes('focus-visible:ring-2 focus-visible:ring-emerald-500/50'), 'focus ring da t171 (o teclado não anda às cegas)');
ok(svSrc.includes('border-emerald-500/40 bg-emerald-500/10'), 'esmeralda = conteúdo (a gramatura das portas de leitura: t175/t179)');
ok(svSrc.includes('hover:bg-emerald-500/20'), 'hover responde (o gesto tem eco)');
ok(svSrc.includes('group-hover:-translate-y-0.5 group-hover:translate-x-0.5'), 'ArrowUpRight com o micro-gesto das portas irmãs');
ok(svSrc.includes('max-w-[300px]') && svSrc.includes('truncate'), 'título longo não quebra o relógio (truncate + teto de largura)');
ok(svSrc.includes("live.phase === 'focus'") && svSrc.includes("(readerDoorVisible(selectedMaterial) || materialDoors.length > 0)"), 'a porta existe na fase FOCO e com material que tenha porta (t185 estendeu a linha ao resumo/vídeo/página — MESMA promessa: no break o gesto é levantar; sem porta, texto honesto)');
ok(svSrc.includes('setReaderInitialPage(readerResumePage ?? undefined)'), 'porta manual também retoma a página guardada');
ok(svSrc.includes('setReaderPosEpoch((e) => e + 1)'), 'fechar o leitor bumpa o epoch (a leitura muda a memória — t180)');
ok(/readerPosEpoch\]\)/.test(svSrc), 'a porta RELÊ a memória quando o epoch muda (rótulo nunca congelado no valor velho)');
ok(/<PdfViewerDialog\s*\n\s*material=\{readerMaterial\}/.test(svSrc), 'diálogo montado com o material CORRENTE (não um congelado)');
ok(svSrc.includes('setReaderInitialPage(undefined)'), 'convite morre ao fechar (t162 — a doutrina da Biblioteca intacta)');
ok(svSrc.includes('readerMaterial = selectedMaterial ?? null'), 'undefined vira null na fronteira do diálogo (tipagem honesta)');

// ---------------------------------------------------------------------------
// D. DOUTRINA + REGRESSÕES
// ---------------------------------------------------------------------------
console.log('D. doutrina + regressões (t152/t175/t179 intactos)');
const doorSrc = src('src/lib/study-reader-door.ts');
ok(!/localStorage|sessionStorage|document\.|fetch\(/.test(doorSrc), 'lib PURA: zero DOM/storage/fetch (executável em teste)');
ok(doorSrc.includes('import type { Material }'), 'tipagem do acervo (a porta conhece o Material real)');
ok(/a casa não inventa porta/i.test(doorSrc), 'a doutrina da casa está no texto da lib');

// t179 — a porta da S3 NÃO regrediu:
const prepSrc = src('src/lib/math-exam-prep.ts');
ok(prepSrc.includes("materialId: 'alg-questoes-semana3'"), 't179: materialId da S3 segue na FONTE ÚNICA');
const cardSrc = src('src/components/hub/exam-prep-card.tsx');
ok(cardSrc.includes('Abrir a S3'), 't179: o chip da S3 segue no card da prova');
ok(cardSrc.includes('onStartStudy'), 't179: o chip segue usando o canal goStudy (agora com abertura de verdade)');

// t175 — o print instantâneo segue no leitor (que agora também abre no Estudar):
const qpanelSrc = src('src/components/hub/tutor-quick-panel.tsx');
ok(qpanelSrc.includes('data-testid="instant-pdf-print"'), 't175: o print de 1 clique segue na barra do leitor');
ok(qpanelSrc.includes('instantPrintPage('), 't175: a página honesta segue na fonte');
const pdfPrintSrc = src('src/lib/pdf-print.ts');
ok(pdfPrintSrc.includes('export function instantPrintPage'), 't152/t175: instantPrintPage segue exportada (a página vista, não um chute)');

console.log(`\n${pass} checks passaram, ${fail} falharam.`);
process.exit(fail > 0 ? 1 : 0);
