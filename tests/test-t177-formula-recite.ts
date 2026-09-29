/**
 * Task 177 — A RECITAÇÃO QUE VÊ O TRAVO.
 *
 * A linha do kit prometia ("se travar numa, é só ela que você relê antes de
 * dormir") — mas o diálogo de fórmulas só mostrava a lista: não sabia DIZER
 * em qual o dono travou. A rodada fecha a promessa: recitação na tela do kit
 * (paridade com a folha), travo marcado como DADO, e RECIBO diário que o kit
 * lê ("recitou hoje · N travaram").
 *
 * Contrato (`bun tests/test-t177-formula-recite.ts`):
 *  A. LIB PURA (execução real): isRecitable/recitableFormulas/recitableCount
 *     (a PÓS-PROVA sem math NÃO é recitável), reciteProgress (teto, vazio,
 *     mentira no mapa), toggleStuck (cópia defensiva, toggle idempotente),
 *     stuckTitles (ORDEM DA FONTE, não da marcação), stuckCount,
 *     localDateKey (fuso local, zero-pad), normalizeReciteReceipt (lixo →
 *     null, nunca recibo inventado), receiptIsToday (dia virou é outro dia),
 *     buildReceipt (total da FONTE, stuck na ordem), sameReceipt (guarda de
 *     regravação), receiptBadgeText (a voz do badge).
 *  B. FIAÇÃO DO DIÁLOGO (exam-prep-card): toggle com aria-pressed + title
 *     honesto da fronteira (recarregar recomeça), contador da FONTE
 *     (RECITE_TOTAL via recitableCount), caixa oculta = botão de reveal com
 *     aria-label por fórmula, travo DEPOIS de revelar (nunca antes), resumo
 *     "antes de dormir" com os travos NOMEADOS, solo-travadas como filtro da
 *     RODADA, recibo gravado no storage do COMPONENTE (lib pura sem storage).
 *  C. FIAÇÃO DO KIT (VesperaKit): badge só com recibo de HOJE (receiptIsToday),
 *     emerald = zero travado, amber = travou (número real atrás), subNode
 *     com os títulos na voz da linha, props descem do pai.
 *  D. DOUTRINA: helpers puras sem DOM/storage/fetch; a chave vive na lib
 *     (família v1 do exame), a fiação no componente; regressões t169/t175
 *     (o diálogo de precisão e o print rápido não mudaram) + t176 (pill).
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
console.log('A. formula-recite (execução real)');
const fr = (await import(join(ROOT, 'src/lib/formula-recite.ts'))) as typeof import('../src/lib/formula-recite');
const mp = (await import(join(ROOT, 'src/lib/math-exam-prep.ts'))) as typeof import('../src/lib/math-exam-prep');

// A1. Recitável = caixa com math[] real (a PÓS-PROVA é aviso, não conteúdo)
const posProva = mp.MATH_FORMULAS.find((f) => f.titulo.startsWith('PÓS-PROVA'));
ok(!!posProva, 'fonte: a caixa PÓS-PROVA existe (o aviso dos tópicos 1.3/1.4)');
ok(posProva != null && !Array.isArray(posProva.math), 'PÓS-PROVA não tem math — nada a recitar');
ok(posProva != null && !fr.isRecitable(posProva), 'isRecitable: PÓS-PROVA fica FORA da rodada');
const comMath = mp.MATH_FORMULAS.find((f) => Array.isArray(f.math) && f.math.length > 0);
ok(comMath != null && fr.isRecitable(comMath), 'isRecitable: caixa com math é recitável');

ok(fr.recitableCount(mp.MATH_FORMULAS) === mp.MATH_FORMULAS.filter((f) => fr.isRecitable(f)).length,
  'recitableCount bate com o filtro da fonte (contador = botões, lição 105)');
ok(fr.recitableCount([]) === 0, 'fonte vazia: zero recitáveis (sem invenção)');
ok(fr.recitableFormulas(mp.MATH_FORMULAS).every((f) => fr.isRecitable(f)),
  'recitableFormulas só devolve recitáveis, na ordem da fonte');

// A2. Progresso da rodada
ok(fr.reciteProgress({}, 11).revealedCount === 0 && fr.reciteProgress({}, 11).hiddenCount === 11,
  'rodada aberta: 0 reveladas, todas ocultas');
ok(fr.reciteProgress({ a: true, b: true }, 11).revealedCount === 2,
  'reveladas contadas do mapa');
ok(fr.reciteProgress({ a: true, b: true, c: true, d: false }, 11).revealedCount === 3,
  'false no mapa não conta (só Boolean verdadeiro)');
ok(fr.reciteProgress({ a: true }, 11).allRevealed === false, 'parcial: rodada não está completa');
ok(fr.reciteProgress({ a: true, b: true, c: true, d: true, e: true }, 5).allRevealed === true,
  'completa: allRevealed');
ok(fr.reciteProgress({ a: true, b: true, c: true }, 2).allRevealed === true &&
  fr.reciteProgress({ a: true, b: true, c: true }, 2).hiddenCount === 0,
  'excedente do mapa: completo, nunca negativo (clamp do Math.max)');
ok(fr.reciteProgress({ a: true }, 0).allRevealed === false,
  'total 0: rodada vazia NÃO é "completa" (não existe recibo de rodada que não existiu)');

// A3. Travo — cópia defensiva e toggle
const s0 = { 'Transposta e simetria': true } as Record<string, boolean>;
const s1 = fr.toggleStuck(s0, 'Conectivos');
ok(s1['Conectivos'] === true && s1['Transposta e simetria'] === true, 'toggleStuck: marca preservando os outros');
ok(s0['Conectivos'] === undefined, 'toggleStuck: o mapa ANTERIOR não é mutado (cópia defensiva, t176)');
const s2 = fr.toggleStuck(s1, 'Conectivos');
ok(s2['Conectivos'] === undefined && s2['Transposta e simetria'] === true, 'toggleStuck: desmarca sem tocar nos demais');
ok(fr.toggleStuck({}, 'x')['x'] === true && Object.keys(fr.toggleStuck(fr.toggleStuck({}, 'x'), 'x')).length === 0,
  'toggleStuck: idempotente em par');

// A4. stuckTitles — ORDEM DA FONTE, não da marcação
const fonte = mp.MATH_FORMULAS;
const ordemFonte = fonte.map((f) => f.titulo);
ok(fr.stuckTitles({ 'Conectivos': true, 'Ordem e elemento geral': true }, fonte)[0] === 'Ordem e elemento geral',
  'stuckTitles: ordem da FONTE (Matrizes antes de Lógica, marcação fora de ordem)');
ok(fr.stuckTitles({ 'Inexistente': true }, fonte).length === 0,
  'stuckTitles: título fora da fonte não entra (defesa)');
ok(fr.stuckTitles({}, fonte).length === 0, 'stuckTitles: vazio honesto');
ok(fr.stuckCount({ a: true, b: true, c: false }) === 2, 'stuckCount: só verdadeiros');
ok(fr.stuckCount({}) === 0, 'stuckCount: zero honesto');

// A5. localDateKey — fuso local, zero-pad
const jan = fr.localDateKey(new Date(2026, 0, 5, 23, 59));
ok(jan === '2026-01-05', 'localDateKey: mês e dia com zero-pad (2026-01-05)');
const dez = fr.localDateKey(new Date(2026, 11, 31));
ok(dez === '2026-12-31', 'localDateKey: dezembro padRight (2026-12-31)');
const d = new Date(2026, 8, 29, 21, 30);
ok(fr.localDateKey(d) === '2026-09-29', 'localDateKey: usa getters LOCAIS (fuso do navegador do aluno)');

// A6. normalizeReciteReceipt — defesa de leitura, nunca recibo inventado
ok(fr.normalizeReciteReceipt(null) === null, 'normalize: null → null');
ok(fr.normalizeReciteReceipt('lixo') === null, 'normalize: string → null');
ok(fr.normalizeReciteReceipt([1, 2]) === null, 'normalize: array → null');
ok(fr.normalizeReciteReceipt({}) === null, 'normalize: objeto vazio → null');
ok(fr.normalizeReciteReceipt({ v: 2, date: '2026-09-29', total: 11, stuck: [] }) === null,
  'normalize: versão desconhecida → null');
ok(fr.normalizeReciteReceipt({ v: 1, date: '29/09/2026', total: 11, stuck: [] }) === null,
  'normalize: data fora do formato ISO local → null');
ok(fr.normalizeReciteReceipt({ v: 1, date: '2026-09-29', total: 0, stuck: [] }) === null,
  'normalize: total 0 → null (rodada vazia não ganha recibo)');
ok(fr.normalizeReciteReceipt({ v: 1, date: '2026-09-29', total: -3, stuck: [] }) === null,
  'normalize: total negativo → null');
ok(fr.normalizeReciteReceipt({ v: 1, date: '2026-09-29', total: 11, stuck: 'a' }) === null,
  'normalize: stuck não-array → null');
ok(fr.normalizeReciteReceipt({ v: 1, date: '2026-09-29', total: 11, stuck: [1, 2] }) === null,
  'normalize: stuck com não-strings → null');
const bom = { v: 1 as const, date: '2026-09-29', total: 11, stuck: ['Conectivos'] };
ok(fr.normalizeReciteReceipt(bom)?.stuck[0] === 'Conectivos', 'normalize: recibo íntegro passa');

// A7. receiptIsToday — dia virou é outro dia
ok(fr.receiptIsToday(bom, '2026-09-29') === true, 'receiptIsToday: mesmo dia');
ok(fr.receiptIsToday(bom, '2026-09-30') === false, 'receiptIsToday: dia virou → recibo velho');
ok(fr.receiptIsToday(null, '2026-09-29') === false, 'receiptIsToday: sem recibo → falso');
ok(fr.receiptIsToday(bom, '') === false, 'receiptIsToday: chave vazia (pré-mount) → falso (sem badge mentiroso)');

// A8. buildReceipt — total da FONTE, stuck na ordem
const rec = fr.buildReceipt('2026-09-29', 11, { 'Conectivos': true, 'Ordem e elemento geral': true }, fonte);
ok(rec.total === 11, 'buildReceipt: total da FONTE (o mapa não é fonte de total)');
ok(rec.stuck[0] === 'Ordem e elemento geral' && rec.stuck.length === 2,
  'buildReceipt: stuck reordenado para a ordem da fonte');
ok(rec.v === 1 && rec.date === '2026-09-29', 'buildReceipt: forma do recibo (v, date)');

// A9. sameReceipt — guarda de regravação
ok(fr.sameReceipt(rec, fr.buildReceipt('2026-09-29', 11, { 'Ordem e elemento geral': true, 'Conectivos': true }, fonte)) === true,
  'sameReceipt: mesma verdade em ordem de marcação diferente → IGUAIS (ordem da fonte manda)');
ok(fr.sameReceipt(rec, { ...rec, total: 12 }) === false, 'sameReceipt: total diferente → diferentes');
ok(fr.sameReceipt(rec, { ...rec, date: '2026-09-30' }) === false, 'sameReceipt: dia diferente → diferentes');
ok(fr.sameReceipt(rec, { ...rec, stuck: ['Outra'] }) === false, 'sameReceipt: stuck diferente → diferentes');
ok(fr.sameReceipt(null, rec) === false, 'sameReceipt: sem recibo anterior → diferentes (grava)');

// A10. receiptBadgeText — a voz do badge
ok(fr.receiptBadgeText({ ...rec, stuck: [] }) === 'recitou hoje', 'badge: zero travado → "recitou hoje"');
ok(fr.receiptBadgeText({ ...rec, stuck: ['A'] }) === 'recitou hoje · 1 travou', 'badge: 1 travou (singular)');
ok(fr.receiptBadgeText({ ...rec, stuck: ['A', 'B'] }) === 'recitou hoje · 2 travaram', 'badge: 2 travaram (plural)');

// A11. MATH_RECITE_KEY na família v1 do exame
ok(fr.MATH_RECITE_KEY === 'hub:math-exam:v1:recite', 'chave: família v1 do exame (checklist/travadas/plan/deck)');
ok(fr.MATH_RECITE_KEY !== mp.MATH_PLAN_KEY && fr.MATH_RECITE_KEY !== mp.MATH_TRAVADAS_KEY,
  'chave: NÃO colide com as irmãs do exame');

// ---------------------------------------------------------------------------
// B. FIAÇÃO DO DIÁLOGO — exam-prep-card
// ---------------------------------------------------------------------------
console.log('B. Fiação do diálogo (exam-prep-card)');
const card = src('src/components/hub/exam-prep-card.tsx');

ok(card.includes("import {") && card.includes("} from '@/lib/formula-recite';"),
  'o componente importa a lib da recitação (a regra mora na lib, não em cópia)');
ok(card.includes('const RECITE_TOTAL = recitableCount(MATH_FORMULAS);'),
  'a régua da rodada é a FONTE (recitableCount), nunca conta otimista');
ok(card.includes('aria-pressed={reciteOn}') && card.includes('onClick={toggleReciteMode}'),
  'toggle da rodada: botão real com aria-pressed');
ok(card.includes('recarregar a página recomeça a rodada'),
  'o title do toggle CONFESSA a fronteira (estado de tela, o contrato da folha)');
ok(card.includes('Oculta as ${RECITE_TOTAL} fórmulas'),
  'o title do toggle diz QUANTAS caixas a rodada esconde (número da fonte)');
ok(card.includes('Recite o conteúdo — toque para conferir'),
  'a caixa oculta fala o gesto (mesma voz da folha)');
ok(card.includes("aria-label={`Conferir a fórmula: ${f.titulo}`}"),
  'reveal com aria-label POR FÓRMULA (o leitor de tela sabe qual confere)');
ok(/reciteOn && recitable && !hidden/.test(card),
  'o travo só existe DEPOIS de revelar (nunca com a caixa oculta — recitar é de cabeça)');
ok(card.includes('setReciteStuck((prev) => toggleStuck(prev, f.titulo))'),
  'o travo marca via lib (cópia defensiva na fiação)');
ok(card.includes('aria-pressed={isStuck}'), 'o botão do travo é toggle honesto (aria-pressed)');
ok(card.includes('travei nesta') && card.includes('travei? marcar'),
  'a voz do travo: marcado e por marcar');
ok(card.includes('para reler antes de dormir'),
  'o resumo da rodada completa nomeia a promessa da linha do kit');
ok(card.includes('{reciteStuckList.map((t) => (') && card.includes("key={t}"),
  'os travos ficam NOMEADOS em chips (ordem da fonte, key estável)');
ok(card.includes('Rodada completa — zero travado hoje. Pode dormir.'),
  'zero travado também tem voz (a calma do kit, não só a cobrança)');
ok(/if \(reciteOn && reciteSolo && reciteStuckN > 0 && !isStuck\) return null;/.test(card),
  'solo-travadas é LITERAL (só as travadas ficam — a PÓS-PROVA não-recitável também sai)');
ok(card.includes('onClick={() => setReciteSolo(true)}') &&
  card.includes('reler só as travadas'),
  'o solo tem ENTRADA nomeada (o reler dirigido da promessa — ida e volta)');
ok(card.includes('title="Mostra só as caixas marcadas com travei — o reler dirigido da promessa"'),
  'a entrada do solo confessa o que faz (title honesto)');
ok(card.includes('voltar à rodada inteira'),
  'o solo tem saída de volta (filtro, não armadilha)');
ok(card.includes('onClick={() => setReciteSolo(false)}'), 'a saída do solo é um handler real');
ok(card.includes('reciteProgress(reciteRevealed, RECITE_TOTAL).allRevealed'),
  'o recibo nasce só com a rodada COMPLETA (progresso da lib, não conta solta)');
ok(card.includes('buildReceipt(reciteTodayKey, RECITE_TOTAL, reciteStuck, MATH_FORMULAS)'),
  'o recibo é construído pela lib (total da fonte, stuck na ordem)');
ok(card.includes('if (sameReceipt(reciteReceipt, receipt)) return;'),
  'guarda de regravação: o mesmo recibo não volta ao storage a cada render');
ok(card.includes("window.localStorage.setItem(MATH_RECITE_KEY, JSON.stringify(receipt))"),
  'o storage do recibo mora no COMPONENTE (lib pura sem storage — doutrina)');
ok(/try \{\s*\n\s*window\.localStorage\.setItem\(MATH_RECITE_KEY/.test(card),
  'a gravação do recibo é tolerante (try/catch — quota não derruba a rodada)');
ok(card.includes("JSON.parse(window.localStorage.getItem(MATH_RECITE_KEY) ?? 'null')") &&
  card.includes('normalizeReciteReceipt('),
  'a leitura do recibo passa pela defesa (lixo → null, nunca inventado)');
ok(card.includes("setReciteRevealed({});") && card.includes("setReciteStuck({});") && card.includes("setReciteSolo(false);"),
  'desligou = próxima rodada do zero (MESMA semântica da folha)');
ok(card.includes('isRecitable(f)'), 'a grade decide recitável pela lib');
ok(/const hidden = reciteOn && recitable && reciteRevealed\[f\.titulo\] !== true;/.test(card),
  'só a RODADA esconde caixa (recitação desligada, a grade é sempre completa)');
ok(card.includes("reciteStuck[f.titulo] === true"), 'o travo lê do mapa por título (a MESMA chave do Card)');

// ---------------------------------------------------------------------------
// C. FIAÇÃO DO KIT — VesperaKit
// ---------------------------------------------------------------------------
console.log('C. Fiação do kit (VesperaKit)');
ok(card.includes('reciteReceipt={reciteReceipt}') && card.includes('reciteTodayKey={reciteTodayKey}'),
  'o pai desce recibo + chave de hoje para o kit');
ok(card.includes('reciteReceipt: ReciteReceipt | null;') && card.includes('reciteTodayKey: string;'),
  'o contrato do kit declara o recibo (tipo da lib, não shape solto)');
ok(/receiptIsToday\(reciteReceipt, reciteTodayKey\)/.test(card),
  'o badge só existe com recibo DE HOJE (dia virou, a linha volta a convidar)');
ok(card.includes('text: receiptBadgeText(reciteReceipt),'),
  'a voz do badge é a LIB (fonte única, não string solta no componente)');
ok(card.includes("'Recitou hoje — ficou para reler: '"),
  'o subNode do recibo confessa os travos pelo nome');
ok(card.includes('Recitou hoje — zero travado. A noite cumpriu o que a linha promete.'),
  'o subNode do zero fecha a promessa com calma');
ok(card.includes("reciteReceipt.stuck.join(' · ')"),
  'os travos viajam juntos na linha (ordem da fonte, separador da casa)');
ok(/reciteReceipt\.stuck\.length === 0\s*\n\s*\?\s*'border-emerald-500\/40/.test(card),
  'zero travado = emerald (a família do acerto)');
ok(/'border-amber-500\/50 bg-amber-500\/10 tabular-nums text-amber-700/.test(card),
  'travou = amber com número real atrás (nunca urgência inventada)');

// ---------------------------------------------------------------------------
// D. DOUTRINA + ESTILO (④) + regressões
// ---------------------------------------------------------------------------
console.log('D. Doutrina, estilo e regressões');
const lib = src('src/lib/formula-recite.ts');
ok(!/fetch\(|document\.|window\.|localStorage\./.test(lib),
  'doutrina: a lib é pura — sem DOM/storage/fetch (executável em teste; o storage vive no componente)');
ok(lib.includes("import { MATH_FORMULAS, type FormulaCard } from './math-exam-prep';"),
  'a lib bebe da FONTE (MATH_FORMULAS) — sem segunda derivação da lista');

// Estilo (④): a gramatura da casa
ok(card.includes('rounded-full border px-2.5 py-1 text-[10px]'),
  '④ o toggle usa a gramática chip do cabeçalho (mesma altura do link da folha)');
ok(/border-indigo-400\/50 bg-indigo-500\/10 text-indigo-600/.test(card),
  '④ rodada ativa = indigo (a CALMA do kit da véspera, não urgência)');
ok(card.includes('tabular-nums'),
  '④ contagens tabulares (a gramática numérica da casa)');
ok(/border-rose-500\/40 bg-rose-500\/10/.test(card),
  '④ travo = rose (a família do travado: travadas, erros)');
ok(/border-l-2 border-l-rose-500\/70/.test(card),
  '④ a caixa travada ganha acento à esquerda (o mesmo gesto do recibo do drill)');
ok(/border border-dashed border-rose-500\/40/.test(card),
  '④ caixa oculta = tracejada (o mesmo "aqui falta algo" da folha e da pulada)');
ok(card.includes('transition-colors') && card.includes('active:scale-[0.99]'),
  '④ micro-feedback do toque (transição e escala da casa)');
ok(card.includes('focus-visible:ring-2'), '④ foco visível no teclado');
ok(lib.includes("join('\\u0000')"), 'sameReceipt: separador nulo (título colado não vira igualdade falsa)');

// Regressões t169/t175: o diálogo de precisão e o print rápido intocados
ok(card.includes("scrollIntoView({ block: 'start', behavior: 'smooth' })"),
  'regressão t169: o deep-link do kit (abrir rolado na seção) segue de pé');
ok(src('src/lib/pdf-print.ts').includes('export function instantPrintPage'),
  'regressão t175: a via rápida do print segue na lib');
ok(src('src/components/hub/tutor-quick-panel.tsx').includes('pdf-print'),
  'regressão t175: o painel continua consumindo a lib do print');
// Regressão t176: o rascunho do composer não foi tocado
ok(src('src/lib/composer-draft.ts').includes('MAX_COMPOSER_DRAFTS'),
  'regressão t176: o rascunho que sobrevive segue de pé');
// Regressão folha: a folha continua com a recitação DELA (paridade, não dependência)
ok(src('src/components/hub/folha-revisao-sheet.tsx').includes('MODO RECITAÇÃO'),
  'regressão folha: o modo recitação da folha segue intacto (duas superfícies, uma voz)');

// ---------------------------------------------------------------------------
console.log(`\n${pass} checks OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
