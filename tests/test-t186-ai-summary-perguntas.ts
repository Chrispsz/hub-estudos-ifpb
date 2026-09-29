/**
 * Task 186 — AS PERGUNTAS QUE A TAREFA DA VÉSPERA PROMETIA.
 *
 * O achado da rodada: a tarefa 3 da VÉSPERA do plano (offset 1 de
 * MATH_EXAM_PLAN: "Perguntas de autoavaliação dos resumos IA dos 4 materiais
 * de Matemática (leve, antes de dormir)") era PROMESSA VAZIA — os 4 resumos
 * de Matemática não tinham o campo perguntas_autoavaliacao (o diálogo render
 * iza a seção só com length > 0; o rodapé confessava "0 / 0 perguntas
 * respondidas"). Pior: 13 resumos do acervo guardavam as perguntas sob a
 * chave ACCENTUADA "perguntas_autoavaliação" — o diálogo lê a canônica sem
 * acento: 60 perguntas escritas e INVISÍVEIS desde que os arquivos chegaram.
 *
 * A rodada conserta o DADO na fonte (scripts/fix-186-perguntas.py: troca
 * literal byte-safe nos 13 + 32 perguntas autorais nos 4 de Matemática,
 * cada uma ancorada no conteúdo real do resumo) e defende o FUTURO com uma
 * lib PURA de esquema na porta de entrada do diálogo (normalizeAiSummary —
 * resumo regenerado que volte a trazer o acento continua renderizando).
 *
 * ④ a pergunta RESPONDIDA veste a família do acerto (esmeralda, o verniz
 * das portas da t185) + focus-within ring (o teclado acende a linha inteira);
 * o rodapé fica HONESTO: contador só com M > 0, Recarregar fora do guard.
 *
 * Contrato (`bun tests/test-t186-ai-summary-perguntas.ts`):
 *  A. DADOS REAIS (execução sobre public/data/ai-summaries): 50 resumos
 *     parseiam; ZERO chaves acentuadas sobrevivem; os 4 de Matemática têm 8
 *     perguntas cada; os 13 consertados mantêm as contagens reais
 *     (60 resgatadas); toda pergunta é string não-vazia; sem duplicatas.
 *  B. LIB REAL (execução): normalizeAiSummary promove a acentuada → canônica
 *     (sem apagar a original), devolve o MESMO objeto quando a canônica já
 *     vive, não toca no que não tem nenhuma, devolve {} em não-objeto;
 *     perguntasCount lê canônica/accentuada/ausente/lixo.
 *  C. FIAÇÃO: o diálogo importa a lib e normaliza o JSON do fetch; o guard
 *     da seção (length > 0) segue de pé; o rodapé só conta com M > 0 e o
 *     Recarregar fica fora do guard; ④ esmeralda + focus-within na label.
 *  D. DOUTRINA: a lib é PURA (zero DOM/storage/fetch); a tarefa da véspera
 *     no plano (MATH_EXAM_PLAN) cita resumos IA e os 4 materiais citados
 *     agora TÊM as perguntas (a promessa e a entrega se conferem); a casa
 *     não apaga dado ao normalizar (a chave original permanece).
 *  E. REGRESSÕES: t146 (o print do resumo segue no diálogo), t185 (a porta
 *     do resumo no Estudar abre ESTE diálogo), t183 (instantChipAlive),
 *     t180 (o leitor segue inteiro).
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
// A. DADOS REAIS — o acervo inteiro, executado
// ---------------------------------------------------------------------------

const DIR = 'public/data/ai-summaries';
const CANONICA = 'perguntas_autoavaliacao';
const ACENTUADA = 'perguntas_autoavaliação';

const files = ['LM-ementa', 'RHT-ementa', 'alg-lista', 'alg-monitoria-discord',
  'alg-programas-c-autorais', 'alg-questoes-semana1', 'alg-questoes-semana2',
  'alg-questoes-semana3', 'alg-slides-geral', 'alg-tipos-operadores',
  'algoritmo-ementa', 'apresentacao-curso-2026', 'caest-apoio-estudante',
  'calendario', 'cronograma-ivs', 'fundamentos-ementa', 'ing-video-corpo-verbos',
  'ing-vocabulario', 'ingles-ementa', 'lm-00-introducao', 'lm-exemplo-formularios',
  'lm-gitbook-audio', 'lm-gitbook-formularios', 'lm-gitbook-hyperlinks',
  'lm-gitbook-imagens', 'lm-gitbook-metadados', 'lm-gitbook-urls',
  'lm-gitbook-video', 'lm-html-01-estrutura', 'lm-html-02-listas',
  'lm-html-03-hyperlinks', 'lm-html-04-midias', 'lm-html-06-formularios',
  'lm-html-07-metadados', 'lm-html-atributos', 'lm-html-introducao',
  'lm-html-listas', 'lm-html-tags', 'lm-html-titulos', 'loopis-empresa-junior',
  'mat-00-matrizes', 'mat-01-matrizes', 'mat-logica-lista', 'mat-logica-slides',
  'matematica-ementa', 'pnaat-parceiros-cajazeiras', 'prova-fund-av1',
  'regulamento-didatico', 'regulamento-disciplinar', 'rht-teletrabalho-serpro'];

const summaries = new Map<string, Record<string, unknown>>();
for (const f of files) {
  const p = join(DIR, `${f}.summary.json`);
  ok(existsSync(join(process.cwd(), p)), `A: ${f}.summary.json existe`);
  try {
    summaries.set(f, JSON.parse(readFileSync(join(process.cwd(), p), 'utf8')));
  } catch {
    ok(false, `A: ${f}.summary.json parseia`);
  }
}
ok(summaries.size === 50, `A: os 50 resumos parseiam (veio ${summaries.size})`);

// ZERO acento sobrevive no acervo — o bug que escondeu 60 perguntas morreu
const comAcento = files.filter((f) => ACENTUADA in (summaries.get(f) ?? {}));
ok(comAcento.length === 0, `A: nenhuma chave acentuada sobrevive (sobrou em: ${comAcento.join(', ')})`);

// Os 4 de Matemática — a promessa da VÉSPERA agora tem entrega
const MATEMATICA = ['mat-00-matrizes', 'mat-01-matrizes', 'mat-logica-lista', 'mat-logica-slides'];
for (const m of MATEMATICA) {
  const d = summaries.get(m) ?? {};
  const perg = d[CANONICA];
  ok(Array.isArray(perg) && perg.length === 8,
    `A: ${m} tem 8 perguntas de autoavaliação (veio ${Array.isArray(perg) ? perg.length : 'não-array'})`);
  if (Array.isArray(perg)) {
    ok(perg.every((p) => typeof p === 'string' && p.trim().length > 0),
      `A: ${m} — toda pergunta é texto real (nada vazio)`);
    ok(new Set(perg).size === perg.length, `A: ${m} — sem pergunta duplicada`);
  }
}

// As perguntas são ANCORADAS no conteúdo real (amostras que definem o núcleo
// da Av1: índices/linha×coluna, o caso falso da condicional, De Morgan, a
// conferência da inversa, precedência)
const mat00 = (summaries.get('mat-00-matrizes')?.[CANONICA] ?? []) as string[];
ok(mat00.some((p) => p.includes('a_{ij}')), 'A: mat-00 pergunta de índice (a_{ij} — linha × coluna)');
ok(mat00.some((p) => p.includes('AB)^t')), 'A: mat-00 pergunta da transposta do produto (a fórmula do resumo)');
const mat01 = (summaries.get('mat-01-matrizes')?.[CANONICA] ?? []) as string[];
ok(mat01.some((p) => /inversa/i.test(p) && /verifica/i.test(p) && p.includes('A⁻¹')),
  'A: mat-01 pergunta da conferência da inversa (o aluno escreve a igualdade A·A⁻¹ = I)');
ok(mat01.some((p) => p.toLowerCase().includes('simétrica')), 'A: mat-01 pergunta de simétrica/antissimétrica (Q26–29 da lista)');
const logLista = (summaries.get('mat-logica-lista')?.[CANONICA] ?? []) as string[];
ok(logLista.some((p) => p.includes('De Morgan')), 'A: mat-logica-lista pergunta de De Morgan (as leis do resumo)');
ok(logLista.some((p) => p.includes('p → q')), 'A: mat-logica-lista pergunta do único caso falso da condicional');
const logSlides = (summaries.get('mat-logica-slides')?.[CANONICA] ?? []) as string[];
ok(logSlides.some((p) => p.includes('precedência')), 'A: mat-logica-slides pergunta de precedência (∼, ∧, ∨, →, ↔)');
ok(logSlides.some((p) => p.includes('Terceiro Excluído')), 'A: mat-logica-slides pergunta dos princípios (Não Contradição / Terceiro Excluído)');

// Os 13 consertados mantêm as contagens REAIS (60 resgatadas — nada sumiu
// na troca literal)
const RESGATADAS: [string, number][] = [
  ['alg-lista', 5], ['alg-monitoria-discord', 2], ['alg-programas-c-autorais', 4],
  ['alg-questoes-semana1', 4], ['alg-questoes-semana2', 5], ['alg-questoes-semana3', 5],
  ['ing-video-corpo-verbos', 3], ['lm-exemplo-formularios', 3], ['lm-gitbook-formularios', 5],
  ['lm-gitbook-metadados', 6], ['lm-html-06-formularios', 6], ['lm-html-07-metadados', 7],
  ['rht-teletrabalho-serpro', 5],
];
let totalResgatadas = 0;
for (const [f, n] of RESGATADAS) {
  const perg = (summaries.get(f)?.[CANONICA] ?? []) as unknown[];
  ok(Array.isArray(perg) && perg.length === n,
    `A: ${f} mantém as ${n} perguntas sob a canônica`);
  totalResgatadas += perg.length;
}
ok(totalResgatadas === 60, `A: 60 perguntas resgatadas no total (veio ${totalResgatadas})`);
// e TODA pergunta do acervo é string não-vazia (o esquema de verdade)
let todosTextos = true;
for (const f of files) {
  const perg = summaries.get(f)?.[CANONICA];
  if (Array.isArray(perg) && !perg.every((p) => typeof p === 'string' && p.trim().length > 0)) {
    todosTextos = false;
    ok(false, `A: ${f} tem pergunta vazia/não-string`);
  }
}
ok(todosTextos, 'A: toda pergunta do acervo é texto real');

// ---------------------------------------------------------------------------
// B. LIB REAL — normalizeAiSummary + perguntasCount, executadas
// ---------------------------------------------------------------------------

const lib = await import('../src/lib/ai-summary-schema');

const cru = { titulo: 'X', [ACENTUADA]: ['q1', 'q2'] };
const norm = lib.normalizeAiSummary(cru);
ok(Array.isArray(norm[CANONICA]) && (norm[CANONICA] as string[]).length === 2,
  'B: normalizeAiSummary promove a acentuada à canônica');
ok(ACENTUADA in norm, 'B: normalizar NÃO apaga a chave original (a casa não destrói dado)');
const canonicaViva = { titulo: 'Y', [CANONICA]: ['q1'] };
ok(lib.normalizeAiSummary(canonicaViva) === canonicaViva,
  'B: canônica viva → o MESMO objeto (zero cópia no caminho comum)');
const semNada = { titulo: 'Z' };
ok(lib.normalizeAiSummary(semNada) === semNada,
  'B: sem perguntas nenhuma → objeto intacto (o guard do diálogo segue mandando)');
ok(JSON.stringify(lib.normalizeAiSummary(null)) === '{}' &&
   JSON.stringify(lib.normalizeAiSummary(undefined)) === '{}' &&
   JSON.stringify(lib.normalizeAiSummary('lixo' as never)) === '{}' &&
   JSON.stringify(lib.normalizeAiSummary([1, 2] as never)) === '{}',
  'B: null/undefined/string/array → {} (o fetch estranho não derruba o diálogo)');
ok(lib.perguntasCount(cru) === 2, 'B: perguntasCount lê a ACENTUADA crua');
ok(lib.perguntasCount(canonicaViva) === 1, 'B: perguntasCount lê a canônica');
ok(lib.perguntasCount(semNada) === 0 && lib.perguntasCount(null) === 0 &&
   lib.perguntasCount({ [ACENTUADA]: 'não-array' }) === 0 &&
   lib.perguntasCount({ [CANONICA]: 'texto' }) === 0,
  'B: perguntasCount → 0 em ausência/lixo (contador só existe com array)');
// o acervo inteiro passa pela lib sem divergir da leitura direta
let acervoConsistente = true;
for (const f of files) {
  const d = summaries.get(f) ?? {};
  if (lib.perguntasCount(d) !== ((d[CANONICA] as unknown[] | undefined)?.length ?? 0)) {
    acervoConsistente = false;
    ok(false, `B: perguntasCount divergiu para ${f}`);
  }
}
ok(acervoConsistente, 'B: perguntasCount confere com o acervo inteiro (pós-conserto)');

// ---------------------------------------------------------------------------
// C. FIAÇÃO — o diálogo normaliza na porta de entrada e o rodapé é honesto
// ---------------------------------------------------------------------------

const msd = src('src/components/hub/material-summary-dialog.tsx');
ok(msd.includes("from '@/lib/ai-summary-schema'") && msd.includes('normalizeAiSummary'),
  'C: o diálogo importa a lib do esquema');
ok(/normalizeAiSummary\(await res\.json\(\)\)/.test(msd),
  'C: o JSON do fetch passa pela normalização (a porta de entrada)');
ok(msd.includes('perguntas = summary.perguntas_autoavaliacao ?? []') &&
   msd.includes('perguntas.length > 0'),
  'C: o guard da seção (length > 0) segue de pé — seção só existe com pergunta');
ok(msd.includes('totalQuestions > 0 ? \'justify-between\' : \'justify-end\''),
  'C: o rodapé lê o dia: contador só com M > 0 (alinhamento muda junto)');
ok(/totalQuestions > 0 && \(/.test(msd) && msd.includes('perguntas respondidas'),
  'C: o contador "N / M perguntas respondidas" só renderiza com M > 0 (nada de "0 / 0")');
ok(/<Button size="sm" variant="ghost" onClick=\{onReload\}/.test(msd) &&
   !/totalQuestions > 0 && \(\s*\n\s*<Button[^>]*onReload/.test(msd),
  'C: o Recarregar fica FORA do guard (recarregar é gesto de sempre)');

// ④ o verniz do acerto: respondida veste esmeralda + o teclado acende a linha
ok(msd.includes("checks[i]\n                      ? 'border-emerald-500/40 bg-emerald-500/5"),
  '④: pergunta respondida veste a família do acerto (esmeralda, o verniz da t185)');
ok(msd.includes('focus-within:ring-2 focus-within:ring-emerald-500/40'),
  '④: focus-within ring — o teclado acende a linha inteira, não só o quadradinho');
ok(msd.includes("checks[i] && 'text-muted-foreground line-through'"),
  '④: o riscado do respondido segue (a marca antiga, agora com borda que confirma)');

// ---------------------------------------------------------------------------
// D. DOUTRINA — lib pura, promessa da véspera com entrega, dado intacto
// ---------------------------------------------------------------------------

const libSrc = src('src/lib/ai-summary-schema.ts');
ok(!/\bfrom\s+'(react|next)/.test(libSrc) && !libSrc.includes('document') &&
   !libSrc.includes('localStorage') && !libSrc.includes('fetch(') &&
   !libSrc.includes('window.'),
  'D: a lib é PURA — zero react/next/DOM/storage/fetch (executável em qualquer lugar)');
ok(libSrc.includes("export const PERGUNTAS_AUTOAVALIACAO_KEY = 'perguntas_autoavaliacao'"),
  'D: a chave canônica é CONSTANTES exportada (uma fonte da verdade, não string solta)');
ok(libSrc.includes('PERGUNTAS_AUTOAVALIACAO_KEY_ACENTUADA'),
  'D: a variante acentuada é NOMEADA na lib (o bug tem nome, não só conserto)');

// a promessa da véspera e a entrega se conferem — A MESMA tarefa do plano
const prep = src('src/lib/math-exam-prep.ts');
ok(/Perguntas de autoavaliação dos resumos IA/.test(prep) &&
   /leve, antes de dormir/.test(prep),
  'D: a tarefa 3 da VÉSPERA no plano promete as perguntas (a promessa existe)');
ok(/materialId: 'mat-01-matrizes'/.test(prep),
  'D: a tarefa aponta o material âncora (mat-01-matrizes)');
for (const m of MATEMATICA) {
  ok(((summaries.get(m)?.[CANONICA] as string[]) ?? []).length === 8,
    `D: a promessa tem entrega — ${m} agora responde pela tarefa da noite`);
}
// a porta que abre o resumo: a t185 manda o dono para ESTE diálogo
const doors = src('src/lib/study-material-doors.ts');
ok(doors.includes('summaryFile'), 'D: a porta do resumo (t185) existe na lib das portas');

// ---------------------------------------------------------------------------
// E. REGRESSÕES — as superfícies irmãs intactas
// ---------------------------------------------------------------------------

ok(msd.includes('captureElementToDataUrl') && msd.includes("'print do resumo'"),
  'E (t146): o print do resumo segue no diálogo — o corpo inteiro vai ao tutor');
ok(msd.includes('captureBodyRef') && msd.includes('imageLabel: \'print do resumo\''),
  'E (t146): a captura do resumo segue com o rótulo honesto');
const sv = src('src/components/hub/study-view.tsx');
ok(sv.includes('study-material-doors') || sv.includes('materialDoorsFor'),
  'E (t185): a linha de portas do Estudar segue de pé');
ok(sv.includes('MaterialSummaryDialog'), 'E (t185): o diálogo do resumo segue montado no Estudar');
const srd = src('src/lib/study-reader-door.ts');
ok(srd.includes('export function instantChipAlive'), 'E (t183): instantChipAlive segue na lib irmã');
ok(src('src/components/hub/pdf-viewer-dialog.tsx').includes('instantChipAlive'),
  'E (t183): a vida do chip segue decidindo no leitor');
ok(srd.includes('export function readerDoorVisible'), 'E (t180): a porta do leitor segue na casa');

console.log(`\n${pass} checks passaram, ${fail} falharam.`);
process.exit(fail > 0 ? 1 : 0);
