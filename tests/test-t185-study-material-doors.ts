/**
 * Task 185 — AS PORTAS DO MATERIAL NA ABA ESTUDAR (resumo · vídeo · página).
 *
 * O achado da rodada: a porta do leitor (t180) devolveu o gesto ao material
 * com PDF — mas o acervo real tem 13 web_pages + 2 vídeos + 2 exemplos SEM
 * pdfPath, e para eles a linha "Material: {título}" sob o cronômetro era
 * TEXTO MORTO. E o resumo IA — que TODO material tem (50/50 summaryFile com
 * arquivo real) e carrega o "Print do resumo" da t146 dentro — também não
 * tinha porta no Estudar: printar o resumo do material do Pomodoro exigia
 * voltar à Biblioteca (a fila P2 "botões de print só para material com PDF"
 * perde este dente).
 *
 * A casa não inventa porta nova: os DIÁLOGOS já existem (VideoPlayerDialog
 * com embed honesto; MaterialSummaryDialog com a captura da t146) — a rodada
 * leva as PORTAS DELES para a linha do material, junto da porta do leitor.
 *
 * Contrato (`bun tests/test-t185-study-material-doors.ts`):
 *  A. LIB REAL (execução): materialDoorsFor com os MATERIAIS REAIS do
 *     course-data (mat-01-matrizes, alg-videoaulas, alg-monitoria-discord,
 *     alg-programas-c-autorais) + formas sintéticas defensivas; ordem da
 *     linha (primária primeiro, resumo por último); videoDoorTitle confessa
 *     a verdade do embed (true/false/null).
 *  B. FIAÇÃO: study-view importa a lib + os dois diálogos + parseVideoUrl;
 *     a linha tem testid, guarda da fase FOCO, âncora real para web
 *     (target _blank + rel noreferrer), handlers abrindo os diálogos;
 *     a porta do leitor segue com a fiação exata da t180.
 *  C. DOUTRINA: lib PURA (zero DOM/storage/fetch), zero parse de URL
 *     duplicado (a verdade do embed chega pronta), labels na voz da casa,
 *     a fronteira no title (a tinta confessa), a casa não inventa porta.
 *  D. REGRESSÕES: t180 (leitor + auto-open + aria/estilo exatos), t179
 *     (porta da S3), t146 (o print do resumo vive no diálogo), t183
 *     (instantChipAlive).
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
// A. LIB REAL — execução com os MATERIAIS REAIS do acervo
// ---------------------------------------------------------------------------
console.log('A. materialDoorsFor (execução real — a linha decide quem tem porta)');
const doors = await import('../src/lib/study-material-doors');
const { materials } = await import('../src/data/course-data');

const matrizes = materials.find((m: { id: string }) => m.id === 'mat-01-matrizes')!;
const videoaulas = materials.find((m: { id: string }) => m.id === 'alg-videoaulas')!;
const monitoria = materials.find((m: { id: string }) => m.id === 'alg-monitoria-discord')!;
const programas = materials.find((m: { id: string }) => m.id === 'alg-programas-c-autorais')!;

ok(!!matrizes && !!videoaulas && !!monitoria && !!programas, 'os quatro materiais reais existem no acervo (a prova não usa forma inventada)');

// A1. Material nenhum → nenhuma porta (a doutrina da t180 para as novas também)
ok(doors.materialDoorsFor(null).length === 0, 'material null → NENHUMA porta (a linha segue texto honesto)');
ok(doors.materialDoorsFor(undefined).length === 0, 'material undefined → NENHUMA porta');

// A2. Material com PDF → o resumo é a única porta DESTA lib (o leitor é da irmã t180)
const pdfDoors = doors.materialDoorsFor(matrizes);
ok(pdfDoors.length === 1 && pdfDoors[0].kind === 'summary', 'PDF real (Matrizes — Aula 01) → só a porta do RESUMO aqui (o leitor é decisão da study-reader-door)');
ok(pdfDoors[0].label === 'Abrir o resumo', 'o rótulo do resumo é "Abrir o resumo" (voz da casa, sem ponto final)');
ok(pdfDoors[0].href === null, 'o resumo é DIÁLOGO (href null — abre por botão, não é âncora)');
ok(pdfDoors[0].title.includes('Print do resumo inteiro') || pdfDoors[0].title.includes('print do resumo inteiro'), 'o title confessa que o print do resumo mora dentro (a t146 ganhou porta no Estudar)');
ok(pdfDoors[0].title.includes('nada é salvo no seu computador'), 'o title confessa a fronteira de privacidade (a voz da família de captura)');
ok(pdfDoors[0].ariaLabel.includes('Matrizes — Aula 01 (Lista)'), 'o aria-label nomeia o material que abre (a lição da t180)');

// A3. Vídeo real → a porta do vídeo primeiro (e o acervo MANDA: as videoaulas
// têm summaryFile vazio — a casa não inventa resumo que não existe)
const vidDoors = doors.materialDoorsFor(videoaulas, { videoCanEmbed: true });
ok(vidDoors.length === 1 && vidDoors[0].kind === 'video', 'vídeo real (Videoaulas, resumo vazio no acervo) → SÓ a porta do vídeo (nada de resumo inventado)');
ok(vidDoors[0].label === 'Abrir o vídeo', 'o rótulo do vídeo é "Abrir o vídeo"');
ok(vidDoors[0].href === null, 'o vídeo é DIÁLOGO (player do Hub, href null)');
ok(vidDoors[0].title.includes('sem sair da página'), 'com embed → o title confessa "sem sair da página"');
ok(vidDoors[0].ariaLabel.includes('Videoaulas (Google Drive)'), 'o aria-label do vídeo nomeia o material real');

// A3b. Vídeo COM resumo no acervo → a ordem da linha é [vídeo, resumo]
const videoComResumo = { ...videoaulas, summaryFile: 'alg-videoaulas.summary.json' } as typeof videoaulas;
const vidOrdem = doors.materialDoorsFor(videoComResumo, { videoCanEmbed: true });
ok(vidOrdem.length === 2 && vidOrdem[0].kind === 'video' && vidOrdem[1].kind === 'summary', 'vídeo com resumo → [vídeo, resumo] NA ORDEM (conteúdo primeiro, apoio depois)');

// A4. A verdade do embed é DADO no title (a lib não chuta)
const vidNoEmbed = doors.materialDoorsFor(videoaulas, { videoCanEmbed: false });
ok(vidNoEmbed[0].title.includes('Abrir conteúdo em nova aba'), 'sem embed → o title confessa o fallback do player (a fronteira na tinta)');
const vidUnknown = doors.materialDoorsFor(videoaulas);
ok(vidUnknown[0].title.includes('não pode ser embutido'), 'sem parse (defensivo) → o title fica genérico e honesto (nunca promete embed)');
ok(vidUnknown[0].title !== vidDoors[0].title && vidUnknown[0].title !== vidNoEmbed[0].title, 'três verdades de embed → três titles distintos (nada de tinta única)');

// A5. Web_page real → âncora REAL com o href do acervo
const webDoors = doors.materialDoorsFor(monitoria);
ok(webDoors.length === 2 && webDoors[0].kind === 'web' && webDoors[1].kind === 'summary', 'web_page real (Monitoria) → [página, resumo] NA ORDEM');
ok(webDoors[0].label === 'Abrir a página', 'o rótulo da página é "Abrir a página"');
ok(webDoors[0].href === monitoria.externalUrl, 'a âncora carrega o externalUrl REAL do acervo (zero URL inventada)');
ok(webDoors[0].title.includes('nova aba'), 'o title confessa a nova aba (a doutrina da t180: outra porta, outro gesto)');
ok(webDoors[0].title.includes('não entra no leitor'), 'o title confessa a fronteira (página externa não vira leitor do Hub)');

// A6. Exemplo sem PDF/URL → o resumo é a porta que sobra (e existe)
const exDoors = doors.materialDoorsFor(programas);
ok(exDoors.length === 1 && exDoors[0].kind === 'summary', 'exemplo real (Programas C) sem pdfPath/URL → a porta do RESUMO existe (nada de texto morto)');

// A7. Formas defensivas (a casa não inventa porta sem conteúdo atrás)
const videoSemUrl = { ...videoaulas, externalUrl: undefined } as typeof videoaulas;
ok(!doors.materialDoorsFor(videoSemUrl).some((d) => d.kind === 'video'), 'vídeo SEM externalUrl → sem porta de vídeo (defensivo; o resumo segue)');
const semResumo = { ...matrizes, summaryFile: '' } as unknown as typeof matrizes;
ok(!doors.materialDoorsFor(semResumo).some((d) => d.kind === 'summary'), 'material SEM summaryFile → sem porta de resumo (a casa não abre diálogo vazio)');

// ---------------------------------------------------------------------------
// B. FIAÇÃO — study-view monta a linha e os diálogos
// ---------------------------------------------------------------------------
console.log('B. study-view.tsx — a linha das portas e os diálogos irmãos');
const svSrc = src('src/components/hub/study-view.tsx');
ok(svSrc.includes("from '@/lib/study-material-doors'"), 'a lib pura é a fonte das decisões (zero porta decidida solta no componente)');
ok(svSrc.includes('materialDoorsFor('), 'o componente chama a lib');
ok(svSrc.includes("from './material-summary-dialog'"), 'o diálogo do resumo é O MESMO da Biblioteca (print da t146 incluso)');
ok(svSrc.includes("from './video-player-dialog'"), 'o player é O MESMO da Biblioteca (embed + fallback)');
ok(svSrc.includes('parseVideoUrl('), 'a verdade do embed vem do parseVideoUrl (a lib não duplica parse)');
ok(svSrc.includes('canEmbed'), 'o canEmbed do parse entra na decisão do title');
ok(svSrc.includes('const [summaryOpen, setSummaryOpen] = React.useState(false)'), 'estado do diálogo de resumo');
ok(svSrc.includes('const [videoOpen, setVideoOpen] = React.useState(false)'), 'estado do player de vídeo');
ok(svSrc.includes('data-testid="study-material-doors"'), 'a linha de portas tem testid');
ok(svSrc.includes('live.phase === \'focus\' &&'), 'a linha existe na fase FOCO (no break o gesto é levantar — a doutrina da t180 estendida)');
ok(svSrc.includes('(readerDoorVisible(selectedMaterial) || materialDoors.length > 0)'), 'a linha aparece com QUALQUER porta real (leitor OU as novas) — e some sem elas');
ok(svSrc.includes("data-testid={door.kind === 'video' ? 'study-video-door' : 'study-summary-door'}"), 'testids das portas de diálogo (vídeo/resumo)');
ok(svSrc.includes('data-testid="study-web-door"'), 'a porta de página tem testid');
ok(/<a\s*\n\s*key=\{door\.kind\}/.test(svSrc), 'a porta de página é ÂNCORA real (o gesto é do navegador)');
ok(svSrc.includes('target="_blank"') && svSrc.includes('rel="noreferrer"'), 'âncora honesta: nova aba + noreferrer (o padrão da casa para fora do Hub)');
ok(svSrc.includes("door.kind === 'video' ? setVideoOpen(true) : setSummaryOpen(true)"), 'os botões abrem os diálogos irmãos (nenhum gesto morto)');
ok(/<MaterialSummaryDialog\s*\n\s*material=\{selectedMaterial \?\? null\}/.test(svSrc), 'o diálogo do resumo montado com o material CORRENTE');
ok(/<VideoPlayerDialog\s*\n\s*material=\{selectedMaterial \?\? null\}/.test(svSrc), 'o player montado com o material CORRENTE');
ok(svSrc.includes('PlayCircle') && svSrc.includes('Sparkles') && svSrc.includes('BookOpen'), 'os ícones distinguem as portas (vídeo/resumo/leitor) — cor = família, ícone = gesto');
ok(svSrc.includes('PÁGINA EXTERNA é âncora REAL'), 'a âncora confessa a doutrina no comentário (a casa lê o porquê)');

// A fiação do EMBED é honesta: material sem URL não computa parse
ok(svSrc.includes('selectedMaterial?.externalUrl') && svSrc.includes('? parseVideoUrl(selectedMaterial.externalUrl).canEmbed'), 'sem externalUrl, o parse NEM roda (defensivo até na fiação)');

// ---------------------------------------------------------------------------
// C. DOUTRINA — a lib é pura, a voz é da casa, a fronteira vai na tinta
// ---------------------------------------------------------------------------
console.log('C. doutrina (lib pura, labels da casa, tinta confessiva)');
const libSrc = src('src/lib/study-material-doors.ts');
ok(!/localStorage|sessionStorage|document\.|fetch\(/.test(libSrc), 'lib PURA: zero DOM/storage/fetch (executável em teste)');
ok(!/from '\.\/video-player-dialog'/.test(libSrc) && !/parseVideoUrl\(/.test(libSrc), 'a lib NÃO importa nem chama parse de URL (a verdade do embed chega pronta — zero segunda derivação)');
ok(/a casa não inventa\s+porta/i.test(libSrc), 'a doutrina da casa está no texto da lib');
ok(/outra porta, outro gesto/i.test(libSrc), 'a fronteira da t180 citada (a página é gesto do navegador)');
ok(/Doutrina: SEM DOM\/storage\/fetch aqui/i.test(libSrc), 'a declaração de pureza está no cabeçalho');
ok(libSrc.includes("label: 'Abrir o resumo'"), 'rótulo do resumo na FONTE (o componente não inventa voz)');
ok(libSrc.includes("label: 'Abrir o vídeo'"), 'rótulo do vídeo na FONTE');
ok(libSrc.includes("label: 'Abrir a página'"), 'rótulo da página na FONTE');
ok(libSrc.includes('import type { Material }'), 'tipagem do acervo (a porta conhece o Material real)');

// ---------------------------------------------------------------------------
// D. REGRESSÕES — t180/t179/t146/t183 intactos
// ---------------------------------------------------------------------------
console.log('D. regressões (t180 leitor, t179 S3, t146 print do resumo, t183 chip)');
const rdSrc = src('src/lib/study-reader-door.ts');
ok(rdSrc.includes('export function readerDoorVisible'), 't180: a lib do leitor segue exportando a decisão');
ok(rdSrc.includes('material?.pdfPath && material.type !== \'web_page\''), 't180: a guarda do leitor intacta (PDF real; web_page é outra porta)');
const doorLib = await import('../src/lib/study-reader-door');
ok(doorLib.readerDoorVisible(matrizes) === true, 't180: PDF real → porta do leitor existe (na mesma linha da t185 agora)');
ok(doorLib.readerDoorVisible(monitoria) === false, 't180: web_page → SEM leitor (a porta dela é a âncora da t185)');
ok(doorLib.readerDoorVisible(videoaulas) === false, 't180: vídeo → SEM leitor (a porta dele é o player da t185)');
ok(doorLib.readerDoorLabel(null) === 'Abrir no leitor', 't180: rótulo sem retomada intacto');
ok(doorLib.shouldAutoOpenReader(1, true, true) === true && doorLib.shouldAutoOpenReader(0, true, true) === false, 't180: a guarda do auto-abrir intacta');

ok(svSrc.includes('data-testid="study-reader-door"'), 't180: a porta do leitor segue na linha (com testid)');
ok(svSrc.includes('aria-label={`Abrir ${selectedMaterial?.title} no leitor'), 't180: o aria-label do leitor segue nomeando o material');
ok(svSrc.includes('focus-visible:ring-2 focus-visible:ring-emerald-500/50'), 't171/t180: o focus ring segue em TODA a família (o teclado não anda às cegas)');
ok(svSrc.includes('border-emerald-500/40 bg-emerald-500/10'), 't180: esmeralda = conteúdo (a gramatura agora cobre as quatro portas)');
ok(svSrc.includes('max-w-[300px]') && svSrc.includes('truncate'), 't180: título longo não quebra o relógio (truncate + teto)');
ok(/<PdfViewerDialog\s*\n\s*material=\{readerMaterial\}/.test(svSrc), 't180: o leitor segue montado com o material corrente');
ok(svSrc.includes('setReaderPosEpoch((e) => e + 1)'), 't180: fechar o leitor bumpa o epoch (a memória de retomada viva)');

const cardSrc = src('src/components/hub/exam-prep-card.tsx');
ok(cardSrc.includes('Abrir a S3'), 't179: o chip da S3 segue no card da prova');

const msdSrc = src('src/components/hub/material-summary-dialog.tsx');
ok(msdSrc.includes('captureElementToDataUrl') && msdSrc.includes("'print do resumo'"), 't146: o print do resumo vive no diálogo — a porta da t185 dá acesso a ele no Estudar');

const srdSrc = src('src/lib/study-reader-door.ts');
ok(srdSrc.includes('export function instantChipAlive'), 't183: instantChipAlive segue na lib irmã (a vida do chip do print)');
const pvdSrc = src('src/components/hub/pdf-viewer-dialog.tsx');
ok(pvdSrc.includes('instantChipAlive'), 't183: a vida do chip decide no leitor (a lib irmã, intacta)');
ok(svSrc.includes('pendingAttachLabel={chatImageLabel}'), 't183: o espelho do composer segue viajando por PROP');

console.log(`\n${pass} checks passaram, ${fail} falharam.`);
process.exit(fail > 0 ? 1 : 0);
