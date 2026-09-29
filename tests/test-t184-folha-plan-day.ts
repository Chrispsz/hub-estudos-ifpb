/**
 * Task 184 — A FOLHA DO DIA DA PROVA (a coluna do plano lê o dia).
 *
 * A doutrina da t183 ("a folha lê o dia") chegou ao cabeçalho, mas a COLUNA
 * DO PLANO continuava cega: a folha sempre mostrou a VÉSPERA, mesmo impressa
 * NO DIA da prova — o papel da manhã falava das tarefas da noite anterior
 * ("recitar os cards", "refazer as travadas") enquanto o plano do DIA
 * ("Manhã: reler só os cards…", "Levar: caneta…", "Na prova: ler o enunciado
 * 2×…") nunca saía da tela. E a conduta na prova ("Na prova: leia o
 * enunciado 2×…") saía DOBRADA no papel do dia — no kit E no plano.
 *
 * Contrato (`bun tests/test-t184-folha-plan-day.ts`):
 *  A. LIB REAL (execução): folhaPlanForPaper nos dias da casa — D-0 vira o
 *     plano do dia (label "Dia da prova", data da prova, tarefas da manhã),
 *     D-1/D-2/D-7/negativo/null seguem a véspera (a folha nasce PARA a
 *     véspera; null = servidor, zero flash vazio no SSR).
 *  B. FIAÇÃO: a folha usa a lib (sem MATH_EXAM_PLAN/MATH_VESPERA_DATE
 *     diretos), o heading nasce de label+fmtDayBR(dateISO)+minutos, as
 *     tarefas do plan.tarefas, o hint do kit cala no D-0 (tinta dobrada),
 *     a seção confessa "Plano do dia", testids presentes, o peso do D-0 é
 *     BORDA (border-l-zinc-900 — impressora P&B lê).
 *  C. DOUTRINA: a lib vive DEPOIS do MATH_EXAM_PLAN (lição 183/TDZ), data
 *     nenhuma literal nova (fonte única MATH_EXAM/MATH_VESPERA_DATE).
 *  D. REGRESSÕES: t183 (folhaDayLine + fósseis), t182 (porta da folha),
 *     t178 (recibo só-leitura — a folha continua sem persistir).
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
console.log('A. folhaPlanForPaper (execução real — a coluna do plano decide pelo dia)');
const mep = await import('../src/lib/math-exam-prep');

const PROVA = mep.MATH_EXAM_PLAN.find((d) => d.offset === 0)!;
const VESPERA = mep.MATH_EXAM_PLAN.find((d) => d.offset === 1)!;

// A1. D-0 — o dia da prova tem plano PRÓPRIO no papel
const d0 = mep.folhaPlanForPaper(0);
ok(d0 !== null, 'D-0 → a folha TEM plano (não inventa, mas o dia da prova existe no MATH_EXAM_PLAN)');
ok(d0!.plan.offset === 0 && d0!.plan.kind === 'prova', 'D-0 → o plano é o do DIA DA PROVA (offset 0, kind prova)');
ok(d0!.label === 'Dia da prova', 'D-0 → o rótulo é "Dia da prova" (nunca "Véspera" no dia)');
ok(d0!.dateISO === mep.MATH_EXAM.date, 'D-0 → a data é a DA PROVA (fonte única, zero segunda derivação)');
ok(d0!.plan.minutos === PROVA.minutos && d0!.plan.tarefas.length === PROVA.tarefas.length, 'D-0 → minutos/tarefas vêm do próprio plano (nada inventado)');
ok(d0!.plan.tarefas.some((t) => t.texto.startsWith('Manhã: reler')), 'D-0 → o papel da manhã diz "Manhã: reler só os cards"');
ok(d0!.plan.tarefas.some((t) => t.texto.startsWith('Levar: caneta')), 'D-0 → o papel da manhã lembra o que levar');
ok(d0!.plan.tarefas.some((t) => t.texto.startsWith('Na prova: ler o enunciado')), 'D-0 → a conduta na prova está no plano');

// A2. D-1 e os outros dias — a véspera segue sendo o alvo do papel
for (const [days, tag] of [[1, 'D-1'], [2, 'D-2'], [7, 'D-7'], [-3, 'pós-prova'], [null, 'servidor (null)']] as const) {
  const p = mep.folhaPlanForPaper(days as number | null);
  ok(p !== null && p.plan.offset === 1 && p.plan.kind === 'revisao', `${tag} → a coluna segue a VÉSPERA (a forma original intacta)`);
  ok(p!.label === 'Véspera', `${tag} → o rótulo é "Véspera"`);
  ok(p!.dateISO === mep.MATH_VESPERA_DATE, `${tag} → a data é a da VÉSPERA (fonte única)`);
}
ok(mep.folhaPlanForPaper(1)!.plan.minutos === VESPERA.minutos, 'D-1 → minutos do plano da véspera (nada hardcoded)');
ok(mep.folhaPlanForPaper(1)!.plan.tarefas.length === VESPERA.tarefas.length, 'D-1 → as tarefas da véspera íntegras');

// A3. O D-0 NÃO É a véspera disfarçada
ok(d0!.plan.titulo !== VESPERA.titulo, 'D-0 → o título do plano NÃO é o da véspera (dois planos, duas vozes)');
ok(!d0!.plan.tarefas.some((t) => t.texto.includes('Refazer SOMENTE as questões')), 'D-0 → o papel da manhã não manda refazer listas (isso é da noite anterior)');

// ---------------------------------------------------------------------------
// B. FIAÇÃO — a folha lê a lib
// ---------------------------------------------------------------------------
console.log('B. fiação (a folha consulta a lib, o heading e o hint nascem do dia)');
const folha = src('src/components/hub/folha-revisao-sheet.tsx');

ok(folha.includes('folhaPlanForPaper'), 'a folha importa e usa folhaPlanForPaper');
ok(!/const vespera = MATH_EXAM_PLAN\.find/.test(folha), 'a coluna não caça o plano por conta própria (a fonte é a lib)');
ok(!folha.includes('MATH_EXAM_PLAN') , 'a folha não importa MATH_EXAM_PLAN (a lib é a única que o lê)');
ok(!folha.includes('MATH_VESPERA_DATE') , 'a folha não importa MATH_VESPERA_DATE (a data vem da lib)');

ok(/folhaPlanForPaper\(todayKey \? daysUntilDate\(MATH_EXAM\.date\) : null\)/.test(folha), 'o memo usa o MESMO contrato do dayLine: daysUntilDate no cliente, null no servidor');
ok(/isProvaDay = paperPlan\?\.plan\.offset === 0/.test(folha), 'isProvaDay deriva do PLANO (não de data solta)');

ok(folha.includes('data-testid="folha-plan-day"'), 'a coluna tem testid folha-plan-day');
ok(folha.includes('data-testid="folha-plan-label"'), 'o heading tem testid folha-plan-label');
ok(/\{paperPlan\.label\} · \{fmtDayBR\(paperPlan\.dateISO\)\}/.test(folha), 'o heading nasce de label + fmtDayBR(dateISO) — zero data literal');
ok(/\{paperPlan\.plan\.minutos\} min/.test(folha), 'o heading usa os minutos DO PLANO');
ok(/paperPlan\.plan\.tarefas\.map/.test(folha), 'as tarefas vêm do plan.tarefas (nada duplicado na mão)');

ok(/aria-label="Plano do dia e kit do dia da prova"/.test(folha), 'a seção confessa "Plano do dia" (não é só véspera)');
ok(!/aria-label="Véspera e kit do dia da prova"/.test(folha), 'o aria antigo ("Véspera e kit") saiu');

// B2. O peso do dia é BORDA (④) — impressora P&B lê
ok(/isProvaDay && 'border-l-4 border-l-zinc-900 pl-3'/.test(folha), '④ D-0 → a coluna ganha a régua escura (vocabulário do foco, marca de BORDA)');

// B3. O hint do kit cala no D-0 (a conduta já está no plano — tinta dobrada)
ok(/!\s*isProvaDay && \(/.test(folha), 'o hint "Na prova: leia o enunciado 2×" só existe FORA do D-0');
const hintBlock = folha.slice(folha.indexOf('Na prova: leia o enunciado 2×') - 220, folha.indexOf('Na prova: leia o enunciado 2×'));
ok(/isProvaDay/.test(hintBlock), 'o hint está guardado pela régua do dia (a conduta não sai dobrada no papel da manhã)');

// ---------------------------------------------------------------------------
// C. DOUTRINA — fonte única e o lugar certo da lib
// ---------------------------------------------------------------------------
console.log('C. doutrina (a lib depois do plano, zero data literal)');
const lib = src('src/lib/math-exam-prep.ts');
const planPos = lib.indexOf('export const MATH_EXAM_PLAN');
const fnPos = lib.indexOf('export function folhaPlanForPaper');
ok(fnPos > planPos, 'folhaPlanForPaper vive DEPOIS do MATH_EXAM_PLAN (lição 183/TDZ)');
ok(/label: offset === 0 \? 'Dia da prova' : 'Véspera'/.test(lib), 'o rótulo é decisão da LIB (uma verdade, a folha e o teste leem a mesma)');
ok(/dateISO: offset === 0 \? MATH_EXAM\.date : MATH_VESPERA_DATE/.test(lib), 'as datas vêm das constantes da casa (zero segunda derivação)');
ok(!/'0?1\/10'|'30\/09'/.test(lib.slice(fnPos, fnPos + 1200)), 'nenhuma data literal na lib nova');

// ---------------------------------------------------------------------------
// D. REGRESSÕES — nada tocado além do escopo
// ---------------------------------------------------------------------------
console.log('D. regressões (t183/t182/t178 — o que não é da coluna continua de pé)');

// D1. t183 — a linha do dia e os fósseis
const mepOk = (mep.folhaDayLine(1)?.includes('Folha da véspera') && mep.folhaDayLine(0)?.includes('Folha do dia')) === true;
ok(mepOk, 't183: folhaDayLine íntegra (D-1 e D-0 confessam o dia)');
ok(mep.folhaDayLine(2) === null && mep.folhaDayLine(-1) === null, 't183: a linha do dia não existe fora de D-1/D-0');
ok(!folha.includes('Véspera · 30/09'), 't183: sem o fóssil "Véspera · 30/09"');
ok(folha.includes('fmtDayBR(MATH_VESPERA_DATE)') === false && folha.includes("MATH_EXAM.date.slice(0, 4)"), 't183: o cabeçalho continua derivado (fmtDayBR(MATH_EXAM.date))');
ok(folha.includes('MATH_EXAM_DATE_SHORT'), 't183: o plano/flashcard continua derivado de MATH_EXAM_DATE_SHORT');

// D2. t182 — a porta da folha no card (dias, rótulos, fonte única da rota)
ok(mep.folhaDoorVisible(1) && mep.folhaDoorVisible(0) && !mep.folhaDoorVisible(2) && !mep.folhaDoorVisible(-1), 't182: a porta existe SÓ em D-1/D-0');
ok(mep.folhaDoorLabel(1) === 'Folha da véspera' && mep.folhaDoorLabel(0) === 'Folha do dia', 't182: os rótulos da porta íntegros');
ok(mep.FOLHA_REVISAO_PATH === '/folha-revisao', 't182: a rota da folha continua a fonte única');
ok(src('src/components/hub/exam-prep-card.tsx').includes('FOLHA_REVISAO_PATH'), 't182: o card continua abrindo pela fonte única');

// D3. t178 — o recibo da recitação é SÓ-LEITURA na folha
ok(folha.includes('MATH_RECITE_KEY') && folha.includes('receiptStuckSet') && folha.includes('receiptLegendLine'), 't178: a folha continua lendo o recibo (legenda + travo no papel)');
ok(!/setItem\(\s*MATH_RECITE_KEY/.test(folha), 't178: a folha NUNCA persiste por cima do recibo (só-leitura)');

// D4. A folha inteira sem regressão de forma
ok(folha.includes('print:break-before-page'), 'a quebra determinística de página (checklist na pág. 2) intacta');
ok(folha.includes('WYSIWYG') || folha.includes('papel'), 'o comentário-doutrina do papel segue no arquivo');

console.log(`\n${pass} checks OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
