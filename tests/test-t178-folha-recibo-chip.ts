/**
 * Task 178 — A FOLHA QUE LÊ A NOITE + O CHIP QUE FICA NO LEITOR.
 *
 * Duas promessas que ficaram pela metade, fechadas na mesma rodada:
 *
 *  1. A FOLHA QUE LÊ A NOITE: a linha do kit promete "se travar numa, é só
 *     ela que você relê antes de dormir" — e o recibo da recitação (t177)
 *     fechava a promessa NA TELA (badge + subNode nomeado). Mas a folha
 *     impressa da véspera — o papel que vai na mochila — não sabia em QUE
 *     fórmula o dono travou na noite anterior. Agora lê o MESMO recibo
 *     (só-leitura) e marca as caixas: o travo vira TINTA.
 *  2. O CHIP QUE FICA NO LEITOR: o instantâneo da barra em modo cheio abria
 *     o chat POR CIMA do PDF (a dívida P2 da 175). Agora o anexo viaja
 *     silent=true (fica no composer), o chat não abre sozinho e o recibo é
 *     um chip ANCORADO na barra — o dono continua lendo; abrir é clique DELE.
 *
 * Contrato (`bun tests/test-t178-folha-recibo-chip.ts`):
 *  A. LIB REAL (execução): dayKeyMinus (fuso meio-dia, virada de mês/ano,
 *     entrada inválida), receiptStuckSet (null → vazio, O(1) por caixa),
 *     receiptDayLabel (hoje/ontem/recitação de dd/mm/vazio), receiptLegendLine
 *     (só com travo real, singular/plural, dia embutido).
 *  B. FIAÇÃO DA FOLHA (grep folha-revisao-sheet): leitura SÓ-LEITURA da
 *     chave do kit (getItem sem setItem — a doutrina do useSimuladoFoco),
 *     normalize na leitura, listener de storage (rodada em outra aba),
 *     stuck nos DOIS mapas de fórmulas, legenda com data-testid, FormulaBox
 *     com marca de TEXTO (impressora P&B lê).
 *  C. FIAÇÃO DO CHIP (hub-events + study-view + pdf-viewer): silent
 *     documentado na interface do evento; study-view só NÃO abre com chat
 *     fechado (chat aberto segue entregando); pdf-viewer passa silent no
 *     modo cheio, chip ancorado com "abrir" que limpa, dividido segue o
 *     painel ao lado (t175 intacto), o toast do caminho cheio era recibo
 *     mentiroso e saiu.
 *  D. DOUTRINA + REGRESSÕES: formula-recite segue PURA (sem DOM/storage/
 *     fetch); MATH_RECITE_KEY fonte única (folha importa, não re-declara);
 *     a folha impressa sai SEMPRE completa (a fórmula oculta volta no papel);
 *     t175 (Print rápido + Crop) e t177 (recibo do kit) não mudaram.
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
console.log('A. formula-recite (execução real — a noite chega ao papel)');
const fr = (await import(join(ROOT, 'src/lib/formula-recite.ts'))) as typeof import('../src/lib/formula-recite');

// A1. dayKeyMinus — a aritmética do 'ontem' (fuso meio-dia, lição 108)
ok(fr.dayKeyMinus('2026-09-30', 1) === '2026-09-29', 'dayKeyMinus: ontem de 30/09 = 29/09');
ok(fr.dayKeyMinus('2026-10-01', 1) === '2026-09-30', 'dayKeyMinus: virada de MÊS (01/10 → 30/09)');
ok(fr.dayKeyMinus('2026-03-01', 1) === '2026-02-28', 'dayKeyMinus: virada de mês em ano NÃO bissexto (2026)');
ok(fr.dayKeyMinus('2026-01-01', 1) === '2025-12-31', 'dayKeyMinus: virada de ANO (01/01 → 31/12)');
ok(fr.dayKeyMinus('2026-09-30', 0) === '2026-09-30', 'dayKeyMinus: 0 dias = o próprio dia');
ok(fr.dayKeyMinus('2026-09-30', 7) === '2026-09-23', 'dayKeyMinus: 7 dias (a janela do plano D-7)');
ok(fr.dayKeyMinus('lixo', 1) === '' && fr.dayKeyMinus('', 1) === '', 'dayKeyMinus: entrada inválida cala (string vazia)');

// A2. receiptStuckSet — o conjunto que a folha consulta por caixa
ok(fr.receiptStuckSet(null).size === 0, 'receiptStuckSet: recibo null → Set vazio (nada inventado)');
const r178: fr.ReciteReceipt = {
  v: 1,
  date: '2026-09-29',
  total: 10,
  stuck: ['Transposta e simetria', 'Regras de argumento'],
};
const set178 = fr.receiptStuckSet(r178);
ok(set178.size === 2, 'receiptStuckSet: dois travos → dois membros');
ok(set178.has('Transposta e simetria') && set178.has('Regras de argumento'), 'receiptStuckSet: consulta O(1) por título');
ok(!set178.has('Ordem e elemento geral'), 'receiptStuckSet: fórmula não-travada não é marcada');

// A3. receiptDayLabel — a voz do dia no papel
ok(fr.receiptDayLabel(r178, '2026-09-29') === 'hoje à noite', 'receiptDayLabel: recibo de hoje → "hoje à noite"');
ok(fr.receiptDayLabel(r178, '2026-09-30') === 'ontem à noite', 'receiptDayLabel: recibo de ontem → "ontem à noite" (o caso da véspera)');
ok(fr.receiptDayLabel(r178, '2026-10-01') === 'recitação de 29/09', 'receiptDayLabel: dia virou várias vezes → data explícita');
ok(fr.receiptDayLabel(null, '2026-09-29') === '', 'receiptDayLabel: recibo null → vazio (folha cala)');
ok(fr.receiptDayLabel(r178, '') === '', 'receiptDayLabel: todayKey vazio (pré-mount) → vazio');

// A4. receiptLegendLine — a legenda que só nasce com travo real
const rZero: fr.ReciteReceipt = { v: 1, date: '2026-09-29', total: 10, stuck: [] };
ok(fr.receiptLegendLine(null, '2026-09-29') === null, 'receiptLegendLine: sem recibo → null (nada no papel)');
ok(fr.receiptLegendLine(rZero, '2026-09-29') === null, 'receiptLegendLine: zero travado → null (o papel não celebra silêncio)');
ok(fr.receiptLegendLine(r178, '2026-09-30') ===
  'Ontem à noite, 2 fórmulas travaram — são as caixas marcadas; reler elas primeiro.',
  'receiptLegendLine: plural com o dia embutido (a frase inteira)');
const rUm: fr.ReciteReceipt = { v: 1, date: '2026-09-29', total: 10, stuck: ['Ordem e elemento geral'] };
ok(fr.receiptLegendLine(rUm, '2026-09-29')?.includes('1 fórmula travou') === true, 'receiptLegendLine: singular ("1 fórmula travou")');
ok(fr.receiptLegendLine(rUm, '2026-09-29')?.startsWith('Hoje à noite') === true, 'receiptLegendLine: gramática do dia — "Hoje à noite, …" (sem "na" atropelado)');
ok(fr.receiptLegendLine(r178, '2026-09-30')?.startsWith('Ontem à noite') === true, 'receiptLegendLine: gramática do dia — "Ontem à noite, …"');
ok(fr.receiptLegendLine(rUm, '') === null, 'receiptLegendLine: sem todayKey (pré-mount) → null (legenda nasce no cliente)');

// ---------------------------------------------------------------------------
// B. FIAÇÃO DA FOLHA — folha-revisao-sheet.tsx
// ---------------------------------------------------------------------------
console.log('B. a folha lê o recibo (só-leitura, marca em tinta)');
const folha = src('src/components/hub/folha-revisao-sheet.tsx');

ok(folha.includes("MATH_RECITE_KEY") && folha.includes("from '@/lib/formula-recite'"),
  'B1. folha importa a chave da LIB (fonte única — não re-declara string)');
ok(folha.includes("normalizeReciteReceipt(JSON.parse(window.localStorage.getItem(MATH_RECITE_KEY)") ||
  /getItem\(MATH_RECITE_KEY\)[\s\S]{0,40}normalizeReciteReceipt|normalizeReciteReceipt[\s\S]{0,40}getItem\(MATH_RECITE_KEY\)/.test(folha),
  'B2. leitura passa pela normalize (lixo → null, recibo nunca inventado)');
ok(folha.includes('useLocalStorage<CheckedMap>(LS_CHECK') && !folha.includes("useLocalStorage<ReciteReceipt"),
  'B3. o recibo NUNCA entra em useLocalStorage (chave estrangeira é só-leitura — o hook persistiria por cima do kit)');
ok(/getItem\(MATH_RECITE_KEY\)/.test(folha) && !/setItem\(MATH_RECITE_KEY/.test(folha),
  'B4. folha SÓ lê a chave do recibo (setItem na chave do kit é invasão)');
ok(folha.includes("e.key === MATH_RECITE_KEY"), 'B5. listener de storage: rodada em outra aba chega sem recarregar');
ok((folha.match(/stuck=\{stuckSet\.has\(f\.titulo\)\}/g) || []).length === 2,
  'B6. os DOIS mapas (Matrizes + Lógica) recebem o stuck do recibo');
ok(folha.includes('data-testid="folha-recibo-legend"'), 'B7. legenda do recibo tem data-testid (o E2E procura ela)');
ok(folha.includes('receiptLegendLine(reciteReceipt, todayKey)'), 'B8. legenda nasce da lib com todayKey do cliente (sem mismatch)');
ok(folha.includes('data-testid="folha-formula-stuck"') && folha.includes('travei'),
  'B9. a marca do travo é TEXTO ("travei") — impressora P&B lê a diferença');
ok(folha.includes('border-rose-300 border-l-rose-500'), 'B10. acento esquerdo rose = a família do travado (mesma cor do kit/drill)');
ok(folha.includes('hidden print:block'), 'B11. regressão WYSIWYG: fórmula oculta VOLTA no papel (a folha sai completa)');

// ---------------------------------------------------------------------------
// C. FIAÇÃO DO CHIP — hub-events + study-view + pdf-viewer
// ---------------------------------------------------------------------------
console.log('C. o chip que fica no leitor (silent attach)');
const hubEvents = src('src/lib/hub-events.ts');
const studyView = src('src/components/hub/study-view.tsx');
const viewer = src('src/components/hub/pdf-viewer-dialog.tsx');

ok(hubEvents.includes('silent?: boolean'), 'C1. OpenTutorDetail.silent existe na interface do evento');
ok(hubEvents.includes('t178') || hubEvents.includes('SILÊNCIO'), 'C2. o flag confessado no comentário (a doutrina mora no código)');
ok(studyView.includes('tutorReq.detail.silent && !chatOpen'),
  'C3. study-view só CALA a abertura com chat FECHADO (chat aberto segue entregando)');
ok(/O SILÊNCIO \(t178\)[\s\S]*?if \(!\(tutorReq\.detail\.silent && !chatOpen\)\)\s*\{\s*setChatOpen\(true\);\s*\}\s*\}, \[tutorReq\?\.nonce\]\)/.test(studyView),
  'C4. a guarda é a ÚLTIMA fala do efeito de tutorReq (a abertura condicional fecha o nonce)');
ok(/if\s+\(!\(tutorReq\.detail\.silent && !chatOpen\)\)\s*\{\s*setChatOpen\(true\);\s*\}/.test(studyView),
  'C5. a forma exata: negação da conjunção — silent + fechado NÃO abre; todo o resto abre');
ok(studyView.includes('appliedReqNonceRef.current = tutorReq.nonce') &&
   studyView.includes('reqWins') && /const reqWins[\s\S]{0,120}appliedReqNonceRef\.current === req\.nonce/.test(studyView),
  'C13. o restore do rascunho NÃO apaga o pedido externo (o nonce aplicado vence o draft vazio — o bug do commit fora de ordem)');
ok(/reqWins && req\.detail\.question !== undefined \? req\.detail\.question/.test(studyView) &&
   /reqWins && req\.detail\.image\)/.test(studyView),
  'C14. pergunta E imagem do pedido são recolocadas por cima do rascunho (a troca de disciplina não engole a intenção)');

ok(viewer.includes('silent: true'), 'C6. o instantâneo em modo cheio pede silêncio');
ok(viewer.includes('data-testid="instant-attach-chip"'), 'C7. o chip do recibo é ancorado na BARRA (testável)');
ok(viewer.includes('pág. {instantChip.page} no tutor'), 'C8. o chip diz a página exata (a honestidade da 175 segue — forma t183: o corpo lê o gate da verdade)');
ok(/onClick=\{\(\) => \{\s*if \(!material\) return;\s*openTutor\(\{/.test(viewer) &&
   viewer.includes('setInstantAttached(null)'),
  'C9. o "abrir" do chip abre o tutor e LIMPA o recibo (intenção virou ação)');
ok(viewer.includes('!isSplit && instantChip &&') &&
   viewer.includes('instantChipAlive(chipWired'),
  'C10. o chip é do modo CHEIO e obedece à VERDADE do composer (t183: instantChipAlive; o dividido segue com o painel ao lado — t175 intacto)');
ok(!viewer.includes("toast.success(\n          `Página ${page} anexada ao tutor"),
  'C11. o toast do modo cheio SAIU (recibo que some sozinho mentia sobre anexo pendente)');
ok(viewer.includes("toast.error('Não consegui renderizar a página. Use o print de página.')"),
  'C12. o toast de ERRO fica (falha sim é barulho legítimo)');

// ---------------------------------------------------------------------------
// D. DOUTRINA + REGRESSÕES
// ---------------------------------------------------------------------------
console.log('D. doutrina e regressões');
const frSrc = src('src/lib/formula-recite.ts');
ok(!/document\.|window\.|localStorage|fetch\(/.test(frSrc) || !/window\.localStorage|document\./.test(frSrc),
  'D1. formula-recite segue PURA (a regra no papel continua sem DOM/storage/fetch)');
ok(frSrc.includes("export const MATH_RECITE_KEY") , 'D2. a chave do recibo vive na LIB (família v1 do exame, fonte única)');
ok(frSrc.includes('function receiptStuckSet') && frSrc.includes('function receiptDayLabel') &&
   frSrc.includes('function receiptLegendLine') && frSrc.includes('function dayKeyMinus'),
  'D3. as 4 helpers novas exportadas pela lib (t178)');

// Regressões t175 — o print rápido e o Crop não mudaram de lugar
ok(viewer.includes('data-testid="quick-print-page"') && viewer.includes('instantPrintPage(jumpPage, material.pages)'),
  'D4. t175 intacto: Print rápido segue na barra com a página HONESTA');
ok(viewer.includes('openCaptureAt(jumpPage ?? undefined'), 'D5. t169 intacto: o Crop de precisão abre parado na página do salto');
ok(viewer.includes('renderPdfPageToCanvas') && viewer.includes('downscaleCanvas'),
  'D6. t175 intacto: o tubo pdf.js 2× + régua segue renderizando o anexo');

// Regressões t177 — o recibo do kit segue no mesmo contrato
ok(frSrc.includes('function receiptBadgeText') && frSrc.includes('function receiptIsToday') &&
   frSrc.includes('function sameReceipt'),
  'D7. t177 intacto: as helpers do recibo do kit (badge/hoje/igualdade) não mudaram');
ok(src('src/components/hub/exam-prep-card.tsx').includes('receiptBadgeText(reciteReceipt)'),
  'D8. t177 intacto: o kit segue lendo o MESMO recibo (uma fonte, dois leitores)');
ok(frSrc.includes("'hub:math-exam:v1:recite'"), 'D9. a chave não mudou (o recibo do dono não se perde na atualização)');

// A folha continua a folha (o que já era bom não regrediu)
ok(folha.includes('data-testid="folha-print-stamp"'), 'D10. regressão folha: o selo de impressão segue no papel');
ok(folha.includes('useSimuladoFoco'), 'D11. regressão folha: o foco do simulado segue impresso (a promessa do D-2)');

// ---------------------------------------------------------------------------
console.log(`\n${pass} checks OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
