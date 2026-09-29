/**
 * Task 183 — A VÉSPERA DE VERDADE.
 *
 * A véspera chegou (30/09) e a casa tinha TRÊS vozes desalinhadas com o dia:
 *
 *  1. O CHIP DO LEITOR MENTIA EDUCADAMENTE (a fila P2 desde a t178): o recibo
 *     do print rápido ("pág. N no tutor · abrir") era estado LOCAL do diálogo
 *     — o anexo pendente podia ser enviado, descartado ou SUBSTITUÍDO por
 *     outra porta (print de tela, via de precisão, X do chip) e o leitor
 *     seguia acenando por um composer vazio ou alheio. O espelho do composer
 *     (chatImageLabel) agora viaja por PROP e a regra pura instantChipAlive
 *     decide a vida do chip: recibo que sobrevive à verdade é mentira.
 *
 *  2. A FOLHA TINHA FÓSSEIS DE DATA: "Véspera · 30/09" e "Prova 01/10/2026"
 *     eram literais na folha — a doutrina da fonte única (MATH_EXAM.date)
 *     já tinha nome e lei (t182: nenhuma data literal nova), mas o papel
 *     antigo escapava. E o PLANO/FLASHCARD também: "DIA DA PROVA — 01/10" e
 *     "(01/10)" viraram derivação de MATH_EXAM_DATE_SHORT. De quebra, a
 *     folha ganhou a linha que CONFESSA o dia (folhaDayLine): "Folha da
 *     véspera" no D-1, "Folha do dia" no D-0 — a mesma língua da porta.
 *
 *  3. O BANNER DE RECUPERAÇÃO NÃO RESPIRAVA (④): no D-1, o bloco âmbar
 *     enumerava as CINCO pendências que já não podem ser pagas — ruído em
 *     cima de um dia que pede calma. A véspera agora confessa a contagem no
 *     título e aponta a fila ("Plano de Recuperação") sem a lista: verdade
 *     completa, respiração nova.
 *
 * Contrato (`bun tests/test-t183-verspera-de-verdade.ts`):
 *  A. LIB REAL (execução): instantChipAlive com fiação/sem fiação, composer
 *     limpo/igual/trocado; folhaDayLine nos dias da casa; derivações
 *     (MATH_EXAM_DATE_SHORT, título do D-0, flashcard, véspera).
 *  B. FIAÇÃO: prop pendingAttachLabel no diálogo + espelho do StudyView;
 *     gate do render; folha com fmtDayBR(MATH_VESPERA_DATE) e a linha do dia;
 *     card com a véspera sem lista e o dia comum derivado.
 *  C. DOUTRINA: nenhum fóssil de data restante nas superfícies tocadas.
 *  D. REGRESSÕES: t178 (recibo/chip), t180 (porta do leitor), t182 (porta da
 *     folha), t181 (captura limpa) — nada tocado além do escopo.
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
console.log('A. libs puras (execução real — o chip e a folha decidem pela verdade)');
const door = await import('../src/lib/study-reader-door');
const mep = await import('../src/lib/math-exam-prep');

// A1. instantChipAlive — a vida do chip
const OWN = 'página 3 · Lista de Matrizes';
ok(door.instantChipAlive(true, OWN, OWN) === true, 'fiado + pendente IGUAL ao nosso → chip VIVO (é o nosso anexo, intacto)');
ok(door.instantChipAlive(true, null, OWN) === false, 'fiado + composer LIMPO → chip MORTO (o anexo foi consumido — enviar/descartar)');
ok(door.instantChipAlive(true, 'print de tela', OWN) === false, 'fiado + pendente OUTRO → chip MORTO (o composer agora guarda outro anexo)');
ok(door.instantChipAlive(false, null, OWN) === true, 'SEM fiação + composer limpo → chip VIVO (a forma da t178: o chip não morre por falta de espelho)');
ok(door.instantChipAlive(false, 'outro', OWN) === true, 'SEM fiação + pendente outro → chip VIVO (montagem sem espelho — Biblioteca: o diálogo morre na troca de aba)');
ok(door.instantChipAlive(true, OWN, null) === false, 'sem anexo PRÓPRIO → não há chip (nada nasceu no print rápido)');
ok(door.instantChipAlive(true, null, null) === false, 'nada próprio + composer limpo → nada de chip');
ok(door.instantChipAlive(false, undefined, OWN) === true, 'prop ausente (undefined) = sem fiação → forma antiga');
ok(door.instantChipAlive(true, undefined, OWN) === false, 'fiado + pendente undefined → tratado como limpo (o espelho não chegou)');

// A2. folhaDayLine — a folha lê o dia
ok(mep.folhaDayLine(1) !== null && mep.folhaDayLine(1)!.includes('Folha da véspera'), 'D-1 → a folha confessa "Folha da véspera"');
ok(mep.folhaDayLine(1)!.includes('amanhã'), 'D-1 → a linha diz que a prova é AMANHÃ');
ok(mep.folhaDayLine(0)!.includes('Folha do dia'), 'D-0 → a folha confessa "Folha do dia"');
ok(mep.folhaDayLine(0)!.includes('HOJE') && mep.folhaDayLine(0)!.includes('Boa prova'), 'D-0 → HOJE + a despedida honesta');
ok(mep.folhaDayLine(2) === null, 'D-2 → NENHUMA linha (a folha não inventa dia — o slot do simulado já fala)');
ok(mep.folhaDayLine(3) === null, 'D-3 → NENHUMA linha');
ok(mep.folhaDayLine(-1) === null, 'prova passada → NENHUMA linha (a folha não vira fantasma)');
ok(mep.folhaDayLine(1)!.includes('véspera') && !mep.folhaDayLine(1)!.includes('Folha de revisão'), 'a linha NÃO é genérica — a mesma língua da porta (t182)');

// A3. derivações — a fonte única manda
ok(mep.MATH_EXAM_DATE_SHORT === '01/10', 'MATH_EXAM_DATE_SHORT deriva de MATH_EXAM.date (dd/mm)');
ok(mep.MATH_VESPERA_DATE === '2026-09-30', 'MATH_VESPERA_DATE = prova − 1 (derivada, não literal)');
const d0 = mep.MATH_EXAM_PLAN.find((d) => d.offset === 0);
ok(d0?.titulo === `DIA DA PROVA — ${mep.MATH_EXAM_DATE_SHORT}`, 'o título do D-0 deriva (mudou a prova, muda junto)');
const flashcardNaoCai = mep.MATH_FLASHCARDS.find((c) => c.front.includes('NÃO cai'));
ok(!!flashcardNaoCai && flashcardNaoCai.front.includes(mep.MATH_EXAM_DATE_SHORT), 'o flashcard "NÃO cai" cita o dia DERIVADO');

// ---------------------------------------------------------------------------
// B. FIAÇÃO — o espelho do composer no diálogo; a folha com data derivada
// ---------------------------------------------------------------------------
console.log('B. fiação (o prop que ensina a verdade; a folha que deriva o dia)');
const dlg = src('src/components/hub/pdf-viewer-dialog.tsx');

ok(dlg.includes('pendingAttachLabel?: string | null;'), 'o diálogo recebe o ESPELHO do composer (prop opcional — undefined = sem fiação)');
ok(dlg.includes("import { instantChipAlive } from '@/lib/study-reader-door';"), 'a regra vem da LIB (a casa manda: lib pura + fiação)');
ok(dlg.includes('const chipWired = pendingAttachLabel !== undefined;'), 'undefined = SEM fiação (a forma da t178 fica); string|null = verdade viva');
ok(/!isSplit &&\s*\n\s*instantAttached !== null &&\s*\n\s*instantChipAlive\(chipWired, pendingAttachLabel \?\? null, instantAttached\.label\)/.test(dlg), 'o gate usa a REGRÁ PURA (modo cheio, anexo próprio, espelho honesto)');
ok(dlg.includes('{!isSplit && instantChip && ('), 'o RENDER obedece ao gate (o chip morre com a verdade, sem estado duplicado)');
ok(dlg.includes('pág. {instantChip.page} no tutor'), 'o corpo do chip lê o gate (não o estado cru)');
ok(dlg.includes('setInstantAttached(null);'), 'o "abrir" continua limpando o próprio recibo (t178)');
ok(/t183 — A VERDADE DO CHIP/.test(dlg), 'o diálogo se explica (o comentário confessa a doutrina)');

const sv = src('src/components/hub/study-view.tsx');
ok(/<PdfViewerDialog[\s\S]*?pendingAttachLabel=\{chatImageLabel\}/.test(sv), 'o StudyView passa a verdade do composer (chatImageLabel) ao leitor da t180');

// a folha: datas derivadas + a linha do dia
const folha = src('src/components/hub/folha-revisao-sheet.tsx');
ok(folha.includes('folhaDayLine') && folha.includes('daysUntilDate'), 'a folha importa a linha do dia e a régua da distância');
ok(folha.includes("data-testid=\"folha-day-line\""), 'a linha do dia tem testid (o E2E acha a confissão)');
ok(/todayKey \? folhaDayLine\(daysUntilDate\(MATH_EXAM\.date\)\) : null/.test(folha), 'a distância é pergunta do CLIENTE (só com todayKey montado — âncora local, lição 108)');
ok(folha.includes('fmtDayBR(MATH_VESPERA_DATE)'), 'o título da Véspera usa a data DERIVADA (fmtDayBR da constante)');
ok(folha.includes('fmtDayBR(MATH_EXAM.date)'), 'o cabeçalho "Prova ..." usa a data DERIVADA da fonte');
ok(folha.includes('MATH_EXAM_DATE_SHORT') || folha.includes('MATH_EXAM.date'), 'a folha cita o dia pela fonte única');

// o card: a véspera respira e o dia comum deriva
const card = src('src/components/hub/exam-prep-card.tsx');
ok(card.includes("import {\n  MATH_CHECKLIST,\n  MATH_DECK_FLAG,\n  MATH_EXAM,\n  MATH_EXAM_DATE_SHORT,"), 'o card importa a data curta derivada');
const vesperaBranch = card.slice(card.indexOf("todayMilestone?.kind === 'vespera'"), card.indexOf("todayMilestone?.kind === 'preparo'"));
ok(vesperaBranch.includes('revisão leve — folha e só as travadas'), 'a voz da véspera continua confessando a revisão leve');
ok(!vesperaBranch.includes('${pend}'), 'a véspera NÃO enumera mais as pendências (a contagem mora no título, a fila no card apontado)');
ok(vesperaBranch.includes('Plano de Recuperação') || vesperaBranch.includes('${fila}'), 'a fila continua APONTADA (a verdade completa, compacta)');
ok(card.includes('O conteúdo CONTINUA na prova (${MATH_EXAM_DATE_SHORT})'), 'o dia comum cita o prazo derivado (sem fóssil)');

// ---------------------------------------------------------------------------
// C. DOUTRINA — nenhum fóssil de data nas superfícies tocadas
// ---------------------------------------------------------------------------
console.log('C. doutrina (nenhuma data literal onde a derivação manda)');
ok(!folha.includes('Prova <strong className="tabular-nums">01/10/2026'), 'a folha não tem mais o fóssil "01/10/2026"');
ok(!folha.includes('Véspera · 30/09'), 'a folha não tem mais o fóssil "Véspera · 30/09"');
ok(!card.includes('na prova (01/10)'), 'o card não tem mais o fóssil "(01/10)"');
ok(!src('src/lib/math-exam-prep.ts').includes("titulo: 'DIA DA PROVA — 01/10'"), 'a lib não tem mais o título literal do D-0');
ok(!src('src/lib/math-exam-prep.ts').includes("'(01/10)?'"), 'a lib não tem mais o flashcard com data literal');
// os comentários podem citar datas (história); a CÓPIA não — o chec above mira strings de render.

// ---------------------------------------------------------------------------
// D. REGRESSÕES — nada tocado além do escopo
// ---------------------------------------------------------------------------
console.log('D. regressões (as rodadas anteriores seguem de pé)');
ok(mep.folhaDoorVisible(1) === true && mep.folhaDoorVisible(0) === true && mep.folhaDoorVisible(2) === false, 't182 — a porta da folha com os dias intactos');
ok(mep.folhaDoorLabel(1) === 'Folha da véspera' && mep.folhaDoorLabel(0) === 'Folha do dia', 't182 — os rótulos da porta intactos');
ok(typeof door.shouldAutoOpenReader === 'function' && door.shouldAutoOpenReader(1, true, true) === true, 't180 — a guarda do auto-abrir intacta');
ok(door.readerDoorVisible({ pdfPath: '/x.pdf', type: 'pdf' } as never) === true && door.readerDoorVisible({ pdfPath: null, type: 'pdf' } as never) === false, 't180 — a porta do leitor intacta');
ok(src('src/components/hub/folha-revisao-sheet.tsx').includes('MATH_RECITE_KEY'), 't178 — a folha continua lendo o recibo da recitação');
ok(src('src/lib/capture-clean.ts').includes('TIDY_TOTAL_MS'), 't181 — a captura limpa intacta (nada tocado)');
ok(dlg.includes('renderPdfPageToCanvas') && dlg.includes('downscaleCanvas'), 't175 — o print rápido intacto (render + downscale)');

console.log(`\n${pass} checks OK · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
