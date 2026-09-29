/**
 * Task 181 — A CAPTURA QUE ARRUMA A CASA.
 *
 * O dono viu o overlay da própria captura dentro do print (t152 → 181): a
 * régua antiga podia declarar a tela "parada" no meio de um fade quase
 * imperceptível do seletor do navegador (um diálogo branco sumindo sobre
 * conteúdo branco muda pouquíssimos pixels na amostra) — o frame congelava
 * com o seletor ainda assado na imagem. E a via da t175 (print direto do
 * PDF) não existia no CHAT PRINCIPAL: o dono com material aberto no Estudar
 * ainda caçava o seletor de aba/tela.
 *
 * O que a rodada entrega:
 *  1. A LIB PURA (src/lib/capture-clean.ts): a JANELA DE ARRUMAÇÃO (2s
 *     garantidos entre o dono escolher a superfície e a régua começar — o
 *     seletor morre de verdade, o dono fecha o que não deve sair na foto, e
 *     a superfície PROVA mudança) + a RÉGUA v3 (3 amostras iguais seguidas
 *     em comparação de 240px — fade residual não passa mais).
 *  2. A FIAÇÃO IMPURA (screen-capture.ts): fases 'tidy'/'settle' anunciadas
 *     ao hook; o banner (CaptureTidyBanner) sobe e SAI da superfície antes
 *     do primeiro sample — o frame final não pode carregá-lo.
 *  3. O PRINT DE PÁGINA NO CHAT PRINCIPAL (study-view.tsx): a régua da t175
 *     (instantâneo 1-clique + via de precisão) agora mora TAMBÉM no chat da
 *     aba Estudar quando há material de PDF selecionado.
 *
 * Contrato (`bun tests/test-t181-capture-clean.ts`):
 *  A. LIB REAL (execução): tidySecondsLeft/tidyActive (janela honesta),
 *     nextSettleStreak/settleDone/settleExhausted/settleDelayMs (régua v3),
 *     constantes coerentes com a LIÇÃO (3 seguidas, 240px, 2s, teto vivo).
 *  B. FIAÇÃO (screen-capture.ts): import da lib pura, onPhase('tidy') antes
 *     da espera e onPhase('settle') depois (banner FORA do frame), régua v3
 *     executada (streak/done/delay/sample px), hook expõe tidying/tidySeconds
 *     e mata o relógio no desistir/fim; framesEqual intacto (t152).
 *  C. FIAÇÃO (banner): CaptureTidyBanner com role=status/aria-live, testid,
 *     pointer-events-none (nunca bloqueia clique — a captura é sozinha),
 *     esmeralda = família da captura, contagem tabular; montado nos DOIS
 *     compositores (study-view + tutor-quick-panel) com tidying/tidySeconds.
 *  D. FIAÇÃO (chat principal): instantâneo com testid/aria/title da lib,
 *     via de precisão (PdfPageCaptureDialog) com material corrente e anexo
 *     no MESMO chatImage, divisor antes da tela livre, esmeralda, instante
 *     honesto (instantPrintPage da memória de retomada), guarda de material.
 *  E. DOUTRINA: capture-clean sem DOM/storage/fetch (pura de verdade).
 *  F. REGRESSÕES: t175 (print de página segue no painel e na lib), t152
 *     (framesEqual inteiro de 32 bits), t180 (porta do leitor intacta).
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
console.log('A. capture-clean (execução real — a casa arruma com números)');
const cc = await import('../src/lib/capture-clean');

// A.1 — A JANELA DE ARRUMAÇÃO
ok(cc.TIDY_TOTAL_MS === 2000, 'janela de arrumação = 2000ms (4× o piso antigo de 440ms — o seletor morre de verdade)');
ok(cc.TIDY_SECONDS === 2, 'o aviso conta 2 segundos (teto honesto)');
ok(cc.TIDY_BANNER_LABEL.includes('sozinha'), 'o rótulo confessa que a captura acontece sozinha (nada de gesto)');
ok(cc.tidySecondsLeft(0) === 2, 'elapsed 0 → 2s restantes');
ok(cc.tidySecondsLeft(1) === 2, 'elapsed 1ms → ainda 2s (ceil)');
ok(cc.tidySecondsLeft(1000) === 1, 'elapsed 1000ms → 1s restante');
ok(cc.tidySecondsLeft(1999) === 1, 'elapsed 1999ms → ainda 1s (ceil honesto)');
ok(cc.tidySecondsLeft(2000) === 0, 'elapsed 2000ms → 0s (a janela morreu)');
ok(cc.tidySecondsLeft(5000) === 0, 'elapsed além da janela → 0 (nunca negativo)');
ok(cc.tidySecondsLeft(-100) === 2, 'elapsed negativo (fora de fase) → janela cheia');
ok(cc.tidyActive(0) === true, 'janela ativa no instante 0');
ok(cc.tidyActive(1999) === true, 'janela ativa até o último ms');
ok(cc.tidyActive(2000) === false, 'janela MORTA em 2000ms — a régua assume');
ok(cc.tidyActive(-1) === false, 'janela não nasce antes do tempo');

// A.2 — A RÉGUA v3
ok(cc.SETTLE_EQUAL_NEEDED === 3, 'régua v3 exige 3 amostras iguais seguidas (a v2 de 2 foi enganada pelo fade)');
ok(cc.SETTLE_SAMPLE_PX === 240, 'comparação a 240px (a v2 de 160 deixou o fade passar)');
ok(cc.SETTLE_MIN_MS === 700, 'piso pós-aviso = 700ms (folga EXTRA para a morte do seletor)');
ok(cc.SETTLE_STEP_MS === 140, 'passo entre amostras mantido (140ms — a régua da casa)');
ok(cc.SETTLE_MAX_SAMPLES === 12, 'teto 12 amostras (~2.3s — superfície viva não prende a captura)');
ok(cc.nextSettleStreak(true, 0) === 1, '1ª igualdade → trilho 1');
ok(cc.nextSettleStreak(true, 1) === 2, '2ª igualdade seguida → trilho 2');
ok(cc.nextSettleStreak(true, 2) === 3, '3ª igualdade seguida → trilho 3');
ok(cc.nextSettleStreak(false, 2) === 0, 'UMA diferença ZERA o trilho (silêncio visual é racha, não média)');
ok(cc.nextSettleStreak(true, 5) === 6, 'trilho cresce sem teto interno (o teto é o loop)');
ok(cc.settleDone(2) === false, 'trilho 2 NÃO basta (a lição do overlay)');
ok(cc.settleDone(3) === true, 'trilho 3 declara o assentamento');
ok(cc.settleDone(7) === true, 'trilho maior segue válido');
ok(cc.settleExhausted(11) === false, '11 amostras ainda não esgotaram a paciência');
ok(cc.settleExhausted(12) === true, '12 amostras → colhe o último frame (vídeo não congela)');
ok(cc.settleDelayMs(0) === cc.SETTLE_MIN_MS, 'a PRIMEIRA amostra espera o piso da régua');
ok(cc.settleDelayMs(1) === cc.SETTLE_STEP_MS, 'as seguintes seguem o passo');
ok(cc.settleDelayMs(11) === cc.SETTLE_STEP_MS, 'o passo não muda no fim');
ok(cc.CAPTURE_PHASES.length === 2 && cc.CAPTURE_PHASES[0] === 'tidy' && cc.CAPTURE_PHASES[1] === 'settle', 'fases: tidy ANTES de settle (o banner morre antes da régua)');

// A.3 — a janela e a régua CONTAM JUNTAS: tempo mínimo até o 1º frame elegível
const minToFrame = cc.TIDY_TOTAL_MS + cc.SETTLE_MIN_MS + cc.SETTLE_STEP_MS * (cc.SETTLE_EQUAL_NEEDED - 1);
ok(minToFrame >= 2800, `tempo mínimo até frame elegível ≈ ${minToFrame}ms — o seletor do seletor morto-vivo não sobrevive (a v2 congelava em ~580ms)`);

// ---------------------------------------------------------------------------
// B. FIAÇÃO — screen-capture.ts (a parte impura executa a decisão pura)
// ---------------------------------------------------------------------------
console.log('B. screen-capture (fiação impura executa a decisão pura)');
const sc = src('src/lib/screen-capture.ts');

ok(sc.includes("from '@/lib/capture-clean'"), 'a execução importa a DECISÃO da lib pura');
ok(/onPhase\?\.\('tidy'\)/.test(sc), "fase 'tidy' anunciada (o banner sobe NA SUPERFÍCIE do dono)");
ok(/onPhase\?\.\('settle'\)/.test(sc), "fase 'settle' anunciada (o banner JÁ saiu — o frame não o carrega)");
const tidyIdx = sc.indexOf("onPhase?.('tidy')");
const settleIdx = sc.indexOf("onPhase?.('settle')");
const firstDrawIdx = sc.indexOf('await settleScreenSurface(video)');
ok(tidyIdx !== -1 && settleIdx !== -1 && firstDrawIdx !== -1 && tidyIdx < settleIdx && settleIdx < firstDrawIdx, 'ORDEM: tidy → settle → régua (nenhum frame elegível com o aviso de pé)');
ok(sc.includes('setTimeout(r, TIDY_TOTAL_MS)'), 'a espera da janela usa a CONSTANTE da lib (não um número solto)');
ok(sc.includes('const cw = SETTLE_SAMPLE_PX'), 'a comparação usa os 240px da régua v3');
ok(sc.includes('streak = nextSettleStreak(framesEqual(prev, cur), streak)'), 'o trilho vem da lib pura (a execução não reinventa a decisão)');
ok(sc.includes('if (settleDone(streak)) return'), 'o assentamento é o settleDone da lib (3 seguidas)');
ok(sc.includes('setTimeout(r, settleDelayMs(i))'), 'o piso/passo vem de settleDelayMs (a primeira amostra espera mais)');
ok(sc.includes('setCapturing(false);\n        setTidying(false);\n        setTidySeconds(null);\n        stopTidyTick();'), 'o fim da captura mata banner E relógio (nenhum aviso zumbi)');
ok(sc.includes("toast.info('Captura liberada"), 'o 2º clique continua sendo DESISTIR (a escapadela do seletor, intacta)');
ok(/return \{ capturing, tidying, tidySeconds, startCapture \}/.test(sc), 'o hook expõe tidying/tidySeconds (a UI pinta o aviso sem conhecer timers)');
ok(sc.includes('tidySecondsLeft(Date.now() - tidyStartRef.current)'), 'a contagem é REAL (tiquet do relógio — número congelado é mentira)');
ok(sc.includes('React.useEffect(() => stopTidyTick, [stopTidyTick])'), 'a desmontagem da superfície mata o relógio do aviso');
ok(sc.includes('export function framesEqual'), 'framesEqual segue exportado (o contrato t152 vive)');

// execução real do framesEqual (regressão t152 embutida)
const { framesEqual } = await import('../src/lib/screen-capture');
const a = new Uint32Array([1, 2, 3]);
ok(framesEqual(a, new Uint32Array([1, 2, 3])) === true, 'framesEqual: iguais → true');
ok(framesEqual(a, new Uint32Array([1, 9, 3])) === false, 'framesEqual: UM pixel diferente → false (comparação inteira)');
ok(framesEqual(a, new Uint32Array([1, 2])) === false, 'framesEqual: tamanhos diferentes → false');

// ---------------------------------------------------------------------------
// C. FIAÇÃO — o banner (a moradia e a honestidade do aviso)
// ---------------------------------------------------------------------------
console.log('C. CaptureTidyBanner (o aviso que nunca bloqueia e nunca mente)');
const banner = src('src/components/hub/capture-tidy-banner.tsx');

ok(banner.includes("data-testid=\"capture-tidy-banner\""), 'testid do banner');
ok(banner.includes('role="status"') && banner.includes('aria-live="polite"'), 'role=status + aria-live polite (o leitor de tela ouve sem ser interrompido)');
ok(banner.includes('pointer-events-none'), 'pointer-events-none — bloquear clique seria mentir sobre "a captura acontece sozinha"');
ok(banner.includes('fixed left-1/2 top-3'), 'fixed no topo centro (o aviso não empurra conteúdo — ele só EXISTE)');
ok(banner.includes('z-[70]'), 'z-70: acima dos diálogos (o aviso vale sobre qualquer janela aberta)');
ok(banner.includes('border-emerald-500/40'), 'esmeralda = a família da CAPTURA (a gramatura cor=significado da casa)');
ok(banner.includes('tabular-nums'), 'contagem tabular-nums (o número não dança)');
ok(banner.includes('TIDY_BANNER_LABEL'), 'o rótulo vem da LIB (uma verdade, dois lugares)');
ok(banner.includes('if (!active) return null'), 'inativo = NENHUM nó no DOM (o banner morto não ocupa a superfície)');
ok(banner.includes('animate-in fade-in slide-in-from-top-2'), 'entrada animada (a mudança da superfície é PROVADA — o banner entra e sai)');
ok(banner.includes('animate-spin text-emerald-500'), 'spinner honesto (algo está acontecendo, e é da casa)');
ok(banner.includes("seconds === 1 ? '' : 's'"), 'plural honesto no aria-label da contagem');

ok(src('src/components/hub/study-view.tsx').includes('<CaptureTidyBanner active={tidying} seconds={tidySeconds} />'), 'o CHAT PRINCIPAL monta o banner com o estado do hook');
ok(src('src/components/hub/tutor-quick-panel.tsx').includes('<CaptureTidyBanner active={tidying} seconds={tidySeconds} />'), 'o PAINEL DIVIDIDO monta o banner com o estado do hook');

// ---------------------------------------------------------------------------
// D. FIAÇÃO — o print de página no CHAT PRINCIPAL (a t175 chega ao Estudar)
// ---------------------------------------------------------------------------
console.log('D. study-view (o print de página mora no chat principal)');
const sv = src('src/components/hub/study-view.tsx');

ok(sv.includes("from '@/lib/pdf-print'") && sv.includes('instantPrintPage') && sv.includes('renderPdfPageToCanvas') && sv.includes('pagePrintLabel'), 'o chat consome a MESMA lib do painel (uma verdade, dois lugares)');
ok(sv.includes("data-testid=\"chat-instant-pdf-print\""), 'testid do instantâneo no chat');
ok(sv.includes('aria-busy={chatInstantPrinting}'), 'aria-busy no render (o spinner é anunciado)');
ok(sv.includes('void instantChatPdfPrint()'), 'o clique chama o print instantâneo do chat');
ok(/Página \$\{page\} anexada ao tutor — nada foi salvo no seu computador\./.test(sv), 'o toast confessa a privacidade (a MESMA voz do painel)');
ok(sv.includes('setChatImage(image);\n      setChatImageLabel(label);'), 'o anexo entra no MESMO chatImage dos prints (um tubo só)');
ok(sv.includes("toast.error(\n        'Não consegui renderizar a página. Use a captura de tela ou cole com Ctrl+V.',\n      )"), 'a falha ensina a saída (captura de tela / Ctrl+V continuam de pé)');
ok(sv.includes('if (!selectedMaterial?.pdfPath || chatInstantPrinting) return;'), 'guarda dupla: sem PDF ou render em curso → nada acontece');
ok(sv.includes('instantPrintPage(readerResumePage, selectedMaterial.pages)'), 'a página do print é a HONESTA da lib (memória de retomada, clampada)');
ok(sv.includes('aria-label="Escolher página do PDF e recortar trecho para o tutor"'), 'a via de PRECISÃO existe no chat (o irmão lento da t152)');
ok(sv.includes('<PdfPageCaptureDialog') && sv.includes('open={chatPdfCaptureOpen}'), 'o MESMO diálogo de páginas da Biblioteca/painel montado no chat');
ok(sv.includes("initialPage={readerResumePage ?? undefined}") && sv.includes("presetHint={readerResumePage ? 'página do seu último salto' : undefined}"), 'pré-seleção honesta: a memória de leitura entra COM a procedência confessada (t169)');
ok(sv.includes('<div aria-hidden className="h-6 w-px shrink-0 bg-border" />'), 'o divisor separa o print do CONTEÚDO da tela LIVRE (a gramatura da t175)');
ok(sv.includes('hover:bg-emerald-500/10 hover:text-emerald-700'), 'esmeralda = print que nasce do conteúdo do Hub (a mesma gramatura dos irmãos)');
ok(/selectedMaterial && readerDoorVisible\(selectedMaterial\)/.test(sv), 'a porta do print existe SÓ com material de PDF real (a casa não inventa botão)');

// ---------------------------------------------------------------------------
// E. DOUTRINA — a lib pura não conhece o mundo
// ---------------------------------------------------------------------------
console.log('E. capture-clean (doutrina — pura de verdade)');
const ccSrc = src('src/lib/capture-clean.ts');
ok(!/^\s*import /m.test(ccSrc), 'capture-clean NÃO importa nada (pura de verdade)');
// (a checagem olha USO real — `fetch(`/`document.` — e não palavras soltas
// em comentários: a doutrina da lib é escrita, o uso é que é proibido)
ok(!/fetch\(|localStorage|sessionStorage|document\.|window\.|navigator\./.test(ccSrc), 'sem USO de DOM/storage/fetch no corpo da lib');
ok(!/import\s+\{?\s*(document|window)/.test(ccSrc) && !ccSrc.includes('document.'), 'sem document');
ok(!ccSrc.includes('window.'), 'sem window');
ok(!ccSrc.includes('localStorage'), 'sem storage');
ok(!ccSrc.includes('fetch('), 'sem fetch');
ok(!ccSrc.includes("'use client'"), 'sem cliente — lib pura não tem UI');

// ---------------------------------------------------------------------------
// F. REGRESSÕES — as rodadas anteriores intactas
// ---------------------------------------------------------------------------
console.log('F. Regressões (as rodadas anteriores intactas)');
const panel = src('src/components/hub/tutor-quick-panel.tsx');
ok(panel.includes('<CaptureTidyBanner'), 't181/painel: o aviso mora no painel dividido');
ok(panel.includes('const { capturing, tidying, tidySeconds, startCapture } = useScreenCapture('), 't181/painel: o hook NOVO (tidying/tidySeconds) é o mesmo canal');
ok(panel.includes('instantPdfPrint') && panel.includes('data-testid="instant-pdf-print"'), 't175: o instantâneo do PAINEL segue de pé (o chat não o substituiu, é irmão)');
ok(panel.includes("onRetry={() => {\n          setCaptureOpen(false);\n          setCaptureCanvas(null);\n          void startCapture();\n        }}"), 't175: o DE NOVO do painel segue fechando o recorte antes de capturar');
ok(sc.includes('cursor: '), 't152: o cursor segue na captura (o ponteiro ajuda a IA a entender o olhar)');
ok(sc.includes('stream.getTracks().forEach((t) => t.stop())'), 't152: o AUTO-APAGAR segue (a transmissão morre na hora)');
ok(sv.includes('<CaptureTidyBanner') && sv.includes('<CaptureCropDialog'), 't181/study-view: banner + recorte convivem no chat principal');
ok(src('src/lib/study-reader-door.ts').includes('export function shouldAutoOpenReader'), 't180: a porta do leitor segue na lib dela');

console.log(`\n${pass} checks OK · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
