/**
 * Task 175 — O PRINT QUE NASCE DO PDF (+ o overlay que sai da foto).
 *
 * Contrato (`bun tests/test-t175-pdf-print.ts`):
 *  A. LIB PURA (execução real): shortMaterialTitle é a regra do título curto
 *     (travessão E hífen), pagePrintLabel é a voz do chip ("página N ·
 *     título"), instantPrintPage é a página HONESTA (só salto despachado;
 *     sem salto = a 1ª que o leitor mostra; fora do teto clampada).
 *  B. RENDER (a parte impura): pdf.js dinâmico, worker do public, destroy no
 *     finally (o print instantâneo não deixa doc vivo), nitidez 2×.
 *  C. Fiação do painel (tutor-quick-panel): o PRIMEIRO botão é o instantâneo
 *     (um clique, sem seletor), o recorte de precisão segue ao lado, a tela
     * livre CONTINUA (o dono pediu para manter), divisor da gramatura, e o
 *     "De novo" fecha o overlay ANTES de recapturar (a reclamação do dono).
 *  D. Fiação do visualizador (pdf-viewer-dialog): Print rápido na barra,
 *     tubo certo por modo (painel ao lado em dividido; openTutor no cheio).
 *  E. Fonte única + doutrina: o diálogo de precisão usa shortMaterialTitle
 *     (a regra mora na lib, não em cópia); helpers puras sem DOM/storage.
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
// A. LIB PURA — execução real
// ---------------------------------------------------------------------------
console.log('A. pdf-print (execução real)');
const pp = (await import(join(ROOT, 'src/lib/pdf-print.ts'))) as typeof import('../src/lib/pdf-print');

ok(pp.shortMaterialTitle('Lista de Matrizes — Bloco 1 (Q1–16)') === 'Lista de Matrizes', 'travessão: título curto é a parte anterior');
ok(pp.shortMaterialTitle('Plano de Disciplina - Matemática') === 'Plano de Disciplina', 'hífen simples: MESMA regra');
ok(pp.shortMaterialTitle('Resumo') === 'Resumo', 'sem separador: o título inteiro');
ok(pp.shortMaterialTitle('  Lista — Bloco  ') === 'Lista', 'bordas aparadas');
ok(pp.pagePrintLabel(3, 'Lista de Matrizes — Bloco 1') === 'página 3 · Lista de Matrizes', 'rótulo de procedência na voz do chip (t163)');

ok(pp.instantPrintPage(null) === 1 && pp.instantPrintPage(undefined) === 1, 'sem salto despachado: a 1ª que o leitor mostra (não é chute, é o default honesto)');
ok(pp.instantPrintPage(7) === 7, 'salto conhecido: é ELE que sai na foto');
ok(pp.instantPrintPage(99, 47) === 47, 'fora do teto: clampado (doutrina do salto da t157)');
ok(pp.instantPrintPage(0) === 1 && pp.instantPrintPage(-3) === 1 && pp.instantPrintPage(Number.NaN) === 1, 'lixo numérico cai no default, não na exceção');
ok(pp.instantPrintPage(7, 47) === 7, 'dentro do teto: intacto');

// ---------------------------------------------------------------------------
// B. RENDER — a parte impura, fiação verificada
// ---------------------------------------------------------------------------
console.log('B. render pdf.js (fiação)');
const lib = src('src/lib/pdf-print.ts');
ok(/await import\('pdfjs-dist'\)/.test(lib), 'pdf.js por dynamic import (o bundle do painel não paga)');
ok(/workerSrc = '\/pdf\.worker\.min\.mjs'/.test(lib), 'worker do public (a mesma régua do diálogo de precisão)');
ok(/finally\s*\{/.test(lib) && /task\.destroy\?\.\(\)/.test(lib), 'destroy no finally: o print não deixa doc vivo');
ok(/pixelRatio = 2/.test(lib), 'nitidez 2× — o OCR da visão lê os números pequenos');
ok(/targetWidth = 620/.test(lib), 'largura-alvo do preview (a coluna do diálogo)');
ok(/Math\.min\(n, doc\.numPages\)/.test(lib), 'página clampada ao arquivo REAL (doc.numPages)');

// ---------------------------------------------------------------------------
// C. PAINEL DO TUTOR — fiação
// ---------------------------------------------------------------------------
console.log('C. tutor-quick-panel (fiação)');
const panel = src('src/components/hub/tutor-quick-panel.tsx');
ok(/data-testid="instant-pdf-print"/.test(panel), 'botão instantâneo existe e é testável');
ok(/instantPdfPrint/.test(panel) && /renderPdfPageToCanvas\(material\.pdfPath, page\)/.test(panel), 'o clique renderiza a página do PDF aberto');
ok(/downscaleCanvas\(canvas\)/.test(panel) && /pagePrintLabel\(page, material\.title\)/.test(panel), 'régua de 1400px + rótulo de procedência');
ok(/onPdfCaptureAttach\(image, label\)/.test(panel) && /setPendingImage\(image\)/.test(panel), 'tubo certo: painel ao lado OU composer próprio');
ok(/if \(!material\?\.pdfPath \|\| instantPrinting\) return;/.test(panel), 'guarda: segundo clique no render é recusado');
ok(/aria-busy=\{instantPrinting\}/.test(panel) && /animate-spin/.test(panel), 'spinner honesto + aria-busy');
ok(/onClick=\{\(\) => setPdfCaptureOpen\(true\)\}/.test(panel), 'a via de PRECISÃO (recorte t152) segue alcançável');
ok(/startCapture\(\)/.test(panel), 'a captura de TELA livre continua de pé (o dono pediu para manter)');
ok(/h-6 w-px shrink-0 bg-border/.test(panel), 'divisor da gramatura: print de DENTRO ≠ print de FORA');
ok(/Capturar a TELA \(qualquer coisa fora do PDF\)/.test(panel), 'título do camera confessa o papel que sobrou para ele');
// o overlay que sai da foto
ok(/onRetry=\{\(\) => \{/.test(panel) && /setCaptureOpen\(false\);\s*\n\s*setCaptureCanvas\(null\);\s*\n\s*void startCapture\(\);/.test(panel), '"De novo" fecha o overlay ANTES de recapturar (o frame novo não nasce com o recorte assado)');
ok(/setInstantPrinting\(false\);\s*\n\s*\}\s*\n\s*\}, \[material, instantPrinting, pdfCurrentPage, onPdfCaptureAttach\]\)/.test(panel), 'finally solta o botão (falha não deixa spinner eterno)');

// ---------------------------------------------------------------------------
// D. VISUALIZADOR — Print rápido na barra
// ---------------------------------------------------------------------------
console.log('D. pdf-viewer-dialog (fiação)');
const viewer = src('src/components/hub/pdf-viewer-dialog.tsx');
ok(/data-testid="quick-print-page"/.test(viewer), 'Print rápido existe na barra (os dois modos)');
ok(/const page = instantPrintPage\(jumpPage, material\.pages\);/.test(viewer), 'a página é a do ÚLTIMO SALTO (a honesta)');
ok(/if \(isSplit\) \{\s*\n\s*handleCaptureAttach\(image, label\);/.test(viewer), 'dividido: o anexo nasce no painel AO LADO');
ok(/openTutor\(\{\s*\n\s*image,\s*\n\s*imageLabel: label,/.test(viewer), 'modo cheio: o anexo abre o chat principal (sem painel por perto)');
ok(/if \(!material\?\.pdfPath \|\| instantPrinting\) return;/.test(viewer), 'guarda do segundo clique na barra');
ok(/instantPrinting \? \(\s*<Loader2 className="size-3\.5 animate-spin" \/>/.test(viewer), 'spinner na barra durante o render');
ok(/Print rápido/.test(viewer), 'nome confessado: é o caminho veloz');
ok(/disabled=\{instantPrinting\}/.test(viewer), 'botão se desliga enquanto renderiza');

// ---------------------------------------------------------------------------
// E. FONTE ÚNICA + OVERLAYS + DOUTRINA
// ---------------------------------------------------------------------------
console.log('E. fonte única + overlays + doutrina');
const precision = src('src/components/hub/pdf-page-capture-dialog.tsx');
ok(/shortMaterialTitle\(material\.title\)/.test(precision) && !/title\.split\(' — '\)/.test(precision), 'diálogo de precisão usa a LIB (a regra não mora em cópia)');
const study = src('src/components/hub/study-view.tsx');
ok(/onRetry=\{\(\) => \{/.test(study) && /setCaptureOpen\(false\);\s*\n\s*setCaptureCanvas\(null\);\s*\n\s*void startCapture\(\);/.test(study), 'chat principal: o MESMO De novo sem overlay');
const crop = src('src/components/hub/capture-crop-dialog.tsx');
ok(/Fecha o recorte, descarta este frame/.test(crop), 'o title do "De novo" confessa o descarte');
const sc = src('src/lib/screen-capture.ts');
// t181: a régua v2 (160px/440ms) foi SUPERADA pela v3 da lib pura
// capture-clean (240px + 3 iguais seguidas + piso 700ms) — a mesma
// promessa (o fade não escapa), forma mais sensível. O pin segue na
// FIAÇÃO: a execução usa as CONSTANTES da lib (não números soltos).
ok(/const cw = SETTLE_SAMPLE_PX;/.test(sc), 'assentamento mais sensível (240px da régua v3 da lib — o fade não escapa)');
ok(/setTimeout\(r, settleDelayMs\(i\)\)/.test(sc) && /sampleIndex === 0 \? SETTLE_MIN_MS : SETTLE_STEP_MS/.test(src('src/lib/capture-clean.ts')), 'piso/passo vêm da lib (a primeira amostra espera mais — folga para a morte do seletor)');
ok(/from '@\/lib\/capture-clean'/.test(sc), 'a régua mora na LIB PURA (t181) — decisão executada, não copiada');
ok(/Math\.round\(\(cw \* video\.videoHeight\)\/ Math\.max\(1, video\.videoWidth\)\) /.test(sc.replace(/\s+/g, ' ')) || /cw \* video\.videoHeight/.test(sc), 'proporção calculada do PRÓPRIO cw (sem 96 órfão)');

// doutrina: a parte pura da lib não toca em nada do mundo real
ok(!/localStorage|sessionStorage/.test(lib) && !/\bfetch\s*\(/.test(lib), 'lib sem storage/fetch');
const purePart = lib.slice(0, lib.indexOf('// ===== PARTE DE NAVEGADOR'));
ok(!/document\./.test(purePart) && !/window\./.test(purePart), 'helpers puras sem DOM (só o render toca canvas)');

// regressões
ok(panel.includes('initialPage={pdfCurrentPage ?? undefined}'), 't169: pré-seleção da página aberta segue no diálogo de precisão');
ok(precision.includes('presetHint') && precision.includes('onAttach'), 't163/t169: procedência e tubo do diálogo de precisão intactos');
ok(viewer.includes('openCaptureAt(jumpPage ?? undefined, jumpPage ? CAPTURE_HINT_JUMP : undefined)'), 't169: print de página da barra segue pré-selecionado');

console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
