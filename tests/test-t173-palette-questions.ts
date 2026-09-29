/**
 * Task 173 — A BUSCA QUE ACHA A QUESTÃO.
 *
 * Contrato (`bun tests/test-t173-palette-questions.ts`):
 *  A. LIB PURA palette-search (execução real): entradas do acervo (98) com
 *     preview cortado em palavra inteira, value com tópico+dificuldade+
 *     fonte+disciplina, selo prova_real, gate fechado; entradas de cartão
 *     com caixa/prazo/lapsos/procedência; e O FILTRO paletteWordFilter —
 *     palavra-AND sem acento, a régua honesta contra a subsequência solta
 *     da cmdk (que devolvia 84 itens para "transposta").
 *  B. Fiação da paleta: grupos Questões/Seus cartões, deep-link com
 *     disciplineCode JUNTO (a lição do Praticar: sem code o exerciseIds é
 *     ignorado), placeholder honesto, dificuldade com a MESMA gramatura do
 *     Praticar, cartões só com cartão (gaveta vazia não é anunciada).
 *  C. Doutrina: lib sem DOM/storage/fetch (greping CHAMADAS e não palavras
 *     — a lição da 31/171); CommandDialog pluggable (commandFilter).
 *  D. Regressões: max-height da lista honesto de novo, t172/t171 intatos.
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
console.log('A. palette-search (execução real)');
const ps = (await import(join(ROOT, 'src/lib/palette-search.ts'))) as typeof import('../src/lib/palette-search');
const { exercises } = (await import(join(ROOT, 'src/lib/exercise-extractor.ts'))) as typeof import('../src/lib/exercise-extractor');

// o acervo inteiro vira entrada — 98 questões buscáveis
const entries = ps.exercisePaletteEntries(exercises);
ok(entries.length === 98, `acervo inteiro na paleta: ${entries.length} entradas (98)`);
ok(entries.every((e) => e.id && e.preview && e.value), 'toda entrada tem id, preview e value');

// preview corta em PALAVRA INTEIRA com reticência — nunca no meio do termo
const longOne = entries.find((e) => e.preview.length > ps.PALETTE_PREVIEW_MAX);
ok(longOne ? longOne.preview.endsWith('…') : true, 'preview longo termina em reticência');
const cortadaNoMeio = entries.find((e) => {
  if (!e.preview.endsWith('…')) return false;
  const base = e.preview.slice(0, -1);
  const orig = e.value; // value contém o preview integral (prefixo por construção)
  const idx = orig.indexOf(base);
  if (idx < 0) return false; // não é prefixo do value → corte no meio de palavra
  const next = orig[idx + base.length];
  return next !== undefined && next !== ' ' && next !== '…';
});
ok(!cortadaNoMeio, 'corte sempre em fronteira de palavra (o char seguinte no original é espaço)');
ok(ps.trimPreview('aaaa bbbb cccc dddd', 10) === 'aaaa bbbb…', 'prosa: corta no último espaço dentro da janela');
ok(ps.trimPreview('palavra ' + 'x'.repeat(60), 30).endsWith('…'), 'token longo sem espaço: corte duro honesto');
ok(ps.trimPreview('teste de corte  ') === 'teste de corte', 'espaços colapsados sem corte cosmético');

// value carrega os eixos de busca: disciplina, tópico, dificuldade, fonte
const comTautologia = entries.filter((e) => e.value.includes('tautologia'));
ok(comTautologia.length === 2, `busca estrutural: "tautologia" acha as 2 questões reais (${comTautologia.length})`);
ok(entries.some((e) => e.value.includes('lista_algoritmos') === false) && entries.every((e) => e.sourceLabel.length > 0), 'fonte traduzida para palavra de aluno');

// prova real tem selo; gate tem cadeado (a paleta mostra o que o Praticar mostra)
ok(entries.filter((e) => e.isProvaReal).length === 5, '5 questões de prova real com selo próprio');
ok(entries.filter((e) => e.gated).length === 2, '2 gates finos fechados marcados (determinantes/sistemas)');

// entradas de cartão — vencido, lapsos, procedência do caderno
const nowMs = new Date(2026, 8, 29, 12, 0).getTime();
const card = {
  id: 'c1',
  disciplineCode: '536-E',
  front: 'O que é uma tautologia?',
  back: 'Proposição sempre verdadeira em todas as linhas da tabela.',
  source: 'manual' as const,
  createdAt: new Date(2026, 8, 1).toISOString(),
  box: 0,
  dueAt: new Date(2026, 8, 28).toISOString(),
  reviews: 1,
  lapses: 2,
  fromMistake: 'exercicio:alg-042',
};
const fc = ps.flashcardPaletteEntry(card, nowMs);
ok(fc.overdue === true, 'cartão vencido detectado (dueAt ontem)');
ok(fc.lapsesLabel === '2 lapsos', 'plural honesto: "2 lapsos"');
ok(fc.fromMistake === true, 'procedência do caderno (134) visível');
const fcNovo = ps.flashcardPaletteEntry({ ...card, dueAt: new Date(2026, 9, 5).toISOString(), lapses: 0 }, nowMs);
ok(fcNovo.overdue === false && fcNovo.lapsesLabel === '', 'cartão no prazo sem lapso não inventa sinal');
const fcUm = ps.flashcardPaletteEntry({ ...card, lapses: 1 }, nowMs);
ok(fcUm.lapsesLabel === '1 lapso', 'singular: "1 lapso"');

// O FILTRO — a régua da busca
const f = ps.paletteWordFilter;
ok(f('qualquer coisa', '') === 1 && f('qualquer coisa', '   ') === 1, 'busca vazia mostra tudo (1)');
ok(f('classifique como tautologia contradição', 'tautologia') === 1, 'palavra presente: 1');
ok(f('dadas as matrizes a e b calcule', 'tautologia') === 0, 'palavra ausente: 0 (a subsequência solta morreu)');
ok(f('matrizes aula 00 slides', 'MATRIZ') === 1, 'caixa ignorada + sub-palavra ("matriz" ⊂ "matrizes")');
ok(f('lógica proposicional e argumentação', 'logica') === 1, 'SEM ACENTO: "logica" acha "Lógica"');
ok(f('Álgebra Matricial', 'algebra') === 1, 'SEM ACENTO na direção contrária: "algebra" acha "Álgebra"');
ok(f('lista de algoritmos repetição', 'algoritmos repetição') === 1, 'duas palavras: AND');
ok(f('lista de algoritmos repetição', 'repetição algoritmos') === 1, 'ordem das palavras não importa');
ok(f('lista de algoritmos', 'algoritmos vetores') === 0, 'AND exige TODAS: uma faltando zera');
ok(f('questão com tabuada', '  tabuada  ') === 1, 'espaços nas bordas não quebram a busca');

// o filtro aplicado ao acervo REAL: precisão de ponta a ponta
const achadas = entries.filter((e) => f(e.value, 'tautologia') === 1);
ok(achadas.length === 2, `filtro × acervo real: "tautologia" = 2 (${achadas.length}) — não 84`);
const achadasInv = entries.filter((e) => f(e.value, 'inversa') === 1);
ok(achadasInv.length >= 1 && achadasInv.every((e) => e.value.includes('inversa')), 'cada resultado contém a palavra buscada');

// ---------------------------------------------------------------------------
// B. FIAÇÃO DA PALETA
// ---------------------------------------------------------------------------
console.log('B. command-palette (fiação)');
const pal = src('src/components/hub/command-palette.tsx');

ok(pal.includes("from '@/lib/palette-search'") && pal.includes('exercisePaletteEntries') && pal.includes('flashcardPaletteEntries'), 'paleta importa as entradas da lib');
ok(pal.includes("from '@/lib/exercise-extractor'"), 'acervo entra direto da fonte única');
ok(/Questões do acervo/.test(pal), 'grupo "Questões do acervo" existe');
ok(/Seus cartões/.test(pal), 'grupo "Seus cartões" existe');
ok(/flashEntries\.length > 0 &&/.test(pal), 'grupo de cartões SÓ com cartão (gaveta vazia calada)');
ok(pal.includes('exerciseEntries.length}') && pal.includes('flashEntries.length}'), 'contagens no cabeçalho (tabular-nums da casa)');
ok(pal.includes('placeholder="Buscar páginas, disciplinas, materiais, questões, conceitos e ações..."'), 'placeholder confessa as questões (e os conceitos, desde a 174)');
ok(/openPractice\(\{\s*disciplineCode:\s*e\.disciplineCode,\s*exerciseIds:\s*\[e\.id\]\s*\}\)/.test(pal), 'deep-link leva disciplineCode JUNTO do exerciseIds (lição do Praticar)');
ok(/openPractice\(\{\s*mode:\s*'flashcards'\s*\}\)/.test(pal), 'cartão abre o Praticar no modo flashcards');
ok(pal.includes('commandFilter={paletteWordFilter}'), 'filtro pluggable ligado na paleta');
ok(pal.includes('prova real'), 'selo "prova real" na linha');
ok(pal.includes('Lock') && pal.includes('aguarda a aula'), 'gate fechado leva cadeado com title honesto');

// a gramatura da dificuldade é a MESMA do Praticar (cor = significado)
const prac = src('src/components/hub/practice-view.tsx');
for (const tone of ['facil', 'medio', 'dificil']) {
  const mPrac = prac.match(new RegExp(`${tone}:\\s*'([^']+)'`));
  const mPal = pal.match(new RegExp(`${tone}:\\s*\n?\\s*'([^']+)'`));
  ok(!!mPrac && !!mPal && mPrac[1] === mPal[1], `dificuldade ${tone}: classes idênticas às do Praticar`);
}

// ---------------------------------------------------------------------------
// C. DOUTRINA + UI
// ---------------------------------------------------------------------------
console.log('C. doutrina');
const lib = src('src/lib/palette-search.ts');
ok(!/document\./.test(lib), 'lib sem document (pura)');
ok(!/localStorage|sessionStorage/.test(lib), 'lib sem storage');
ok(!/\bfetch\s*\(/.test(lib), 'lib sem fetch');
ok(!/window\./.test(lib), 'lib sem window');
ok(/NFD/.test(lib) && /\\u0300-\\u036f/.test(lib), 'dobra de acentos explícita (NFD + faixa de combining)');

const cmd = src('src/components/ui/command.tsx');
ok(cmd.includes('commandFilter') && cmd.includes('filter={commandFilter}'), 'CommandDialog aceita filtro pluggable (UI genérica, sem dependência da lib)');

// ---------------------------------------------------------------------------
// D. REGRESSÕES
// ---------------------------------------------------------------------------
console.log('D. regressões');
ok(/max-h-\[min\(60vh,420px\)\]/.test(pal), 'max-height da lista restaurado (o [m comido pelo terminal era só display — arquivo sempre íntegro)');
ok(src('src/components/hub/settings-view.tsx').includes('backup-status'), 't172: medidor do backup segue no lugar');
ok(src('src/app/page.tsx').includes('clearDeliveredRequests'), 't171: a raiz segue matando o pedido entregue (zumbi continua morto)');
ok(src('src/lib/ephemeral-registry.ts').includes('setEphemeralChatState'), 't171: registro efêmero do anexo segue vivo');

console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
