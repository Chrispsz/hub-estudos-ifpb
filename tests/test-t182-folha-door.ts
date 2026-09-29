/**
 * Task 182 — A FOLHA NO DIA DELA.
 *
 * A folha de revisão (t115 → t178) é a ferramenta da VÉSPERA: imprimir A4,
 * refazer as travadas, reler o checklist. Mas o link dela morava SÓ no fundo
 * do diálogo da prova (seção das travadas) — na véspera, a superfície de
 * planejamento (o card na home) não tinha porta NENHUMA para o papel. E o
 * dia do compromisso já tinha uma doutrina na casa: a porta existe SÓ no
 * dia (t179, a porta da S3).
 *
 * O que a rodada entrega:
 *  1. A LIB (math-exam-prep.ts): folhaDoorVisible (SÓ D-1 e D-0 — porta fora
 *     do dia é ruído de véspera eterna), folhaDoorLabel (o rótulo diz PARA
 *     QUÊ a folha serve HOJE: "Folha da véspera" / "Folha do dia"),
 *     folhaDoorTitle (confessa a fronteira: o Hub abre, o gesto de imprimir
 *     é do dono) e FOLHA_REVISAO_PATH (fonte única da rota — porta do card,
 *     link do diálogo e paleta abrem o MESMO caminho).
 *  2. A PORTA NO CARD (exam-prep-card.tsx): chip esmeralda ao lado do chip
 *     da prova, SÓ no dia; âncora real (href/target/rel — folha é papel em
 *     potência, nova aba como a paleta já faz); Printer; focus ring (a
 *     lição da t171); o marcos row continua flex-wrap (mobile quebra linha).
 *  3. A GRAMATURA UNIFICADA (④): o link profundo do diálogo de travadas sai
 *     do zinc e vira esmeralda — a MESMA família de "print que nasce do
 *     conteúdo do Hub" (t178/t181); duas portas, uma cor, uma verdade.
 *
 * Contrato (`bun tests/test-t182-folha-door.ts`):
 *  A. LIB REAL (execução): a porta e os rótulos com os dias da casa.
 *  B. FIAÇÃO (exam-prep-card.tsx): âncora com href da FONTE ÚNICA, guard do
 *     dia, rótulo/title da LIB (não hardcoded), esmeralda + focus ring,
 *     posição ao lado do chip da prova, marcos intactos (t179).
 *  C. GRAMATURA (④): o link do diálogo na MESMA família esmeralda + focus
 *     ring; a rota da folha existe e aponta para a folha de verdade.
 *  D. DOUTRINA + REGRESSÕES: helpers derivados de MATH_EXAM (sem data
 *     duplicada), t179 (porta da S3 intacta), t181 (a captura segue limpa),
 *     t178 (a folha continua lendo o recibo — nada tocado).
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
console.log('A. math-exam-prep (execução real — a porta decide o dia)');
const mep = await import('../src/lib/math-exam-prep');

ok(mep.FOLHA_REVISAO_PATH === '/folha-revisao', 'a rota da fonte única é a folha de verdade');
ok(mep.folhaDoorVisible(1) === true, 'D-1 (véspera) → a porta EXISTE');
ok(mep.folhaDoorVisible(0) === true, 'D-0 (manhã da prova) → a porta EXISTE');
ok(mep.folhaDoorVisible(2) === false, 'D-2 (preparo/simulado) → NENHUMA porta (cada dia tem a sua — a S3 é do simulado, t179)');
ok(mep.folhaDoorVisible(3) === false, 'D-3 → sem porta (o dia da folha ainda não chegou)');
ok(mep.folhaDoorVisible(-1) === false, 'prova passou → sem porta (a porta não vira fantasma)');
ok(mep.folhaDoorLabel(1) === 'Folha da véspera', 'D-1 → "Folha da véspera" (o rótulo diz para quê HOJE)');
ok(mep.folhaDoorLabel(0) === 'Folha do dia', 'D-0 → "Folha do dia" (o kit da manhã, em papel)');
ok(mep.folhaDoorLabel(1).includes('véspera') && !mep.folhaDoorLabel(1).includes('de revisão'), 'o rótulo NÃO é genérico — porta que diz o dia');
ok(mep.folhaDoorTitle(1).includes('A4'), 'o title confessa o formato do papel (A4)');
ok(mep.folhaDoorTitle(1).includes('imprimir é seu'), 'o title confessa a fronteira: o gesto de imprimir é do dono');
ok(mep.folhaDoorTitle(1).includes('checklist sincronizado'), 'o title confessa a sincronia com o card (marcar aqui é marcar lá)');
ok(mep.folhaDoorTitle(1).includes('travadas'), 'o title confessa as travadas na tinta (a promessa da t178)');
ok(mep.folhaDoorTitle(0).includes('kit do dia'), 'D-0 → o title confessa o kit do dia da prova');

// ---------------------------------------------------------------------------
// B. FIAÇÃO — a porta no card da prova
// ---------------------------------------------------------------------------
console.log('B. exam-prep-card (a porta no dia dela)');
const card = src('src/components/hub/exam-prep-card.tsx');

ok(card.includes("data-testid=\"prova-folha-door\""), 'testid da porta da folha');
ok(card.includes('href={FOLHA_REVISAO_PATH}'), 'o href vem da FONTE ÚNICA (não uma string solta)');
ok(card.includes('target="_blank"\n                rel="noreferrer"') || /target="_blank"\s*\n\s*rel="noreferrer"/.test(card), 'nova aba + noreferrer (folha é papel em potência — a paleta já abre assim)');
ok(card.includes('{folhaDoorVisible(daysLeft) &&'), 'a guarda do dia é a FUNÇÃO da lib (não um daysLeft solto no JSX)');
ok(card.includes('aria-label={`Abrir a ${folhaDoorLabel(daysLeft)} de revisão para imprimir`}') , 'o aria-label vem do rótulo da lib');
ok(card.includes('title={folhaDoorTitle(daysLeft)}'), 'o title vem da lib (uma verdade, dois lugares)');
ok(card.includes('<Printer className="size-3" aria-hidden />'), 'Printer = o gesto que a porta promete (ícone honesto)');
ok(/border-emerald-500\/40 bg-emerald-500\/10/.test(card), 'esmeralda = a cor do PRINT do Hub (a gramatura t178/t181)');
ok(card.includes('focus-visible:ring-2 focus-visible:ring-emerald-500/50'), 'focus ring na porta (a lição da t171 — o teclado não anda às cegas)');
ok(/hover:border-emerald-500\/60 hover:bg-emerald-500\/20/.test(card), 'hover com a mesma família (a gramatura das portas irmãs)');
ok(card.includes('shrink-0 items-center gap-1.5 rounded-full'), 'chip na mesma forma dos irmãos do marcos (rounded-full, gap)');
ok(/\/\* t182 — A PORTA DA FOLHA[\s\S]*?folhaDoorVisible/.test(card), 'a porta nasce com o comentário que confessa a régua (a casa se explica)');
// posição: DEPOIS do chip da prova (o gradiente aponta para a prova, a folha segue o compromisso)
const provaChipIdx = card.indexOf('01/10 · <span className="font-semibold">Prova Av1</span>');
const folhaDoorIdx = card.indexOf('data-testid="prova-folha-door"');
ok(provaChipIdx !== -1 && folhaDoorIdx > provaChipIdx, 'a porta fica AO LADO do chip da prova (o compromisso primeiro, a ferramenta dele junto)');
// a copy dos estados da prova permanece (nenhum chip substituído)
ok(card.includes('É hoje · <span className="font-bold">Prova Av1</span>'), 'a copy do DIA intacta');
ok(card.includes('Amanhã · <span className="font-semibold">Prova Av1</span>'), 'a copy da VÉSPERA intacta');

// ---------------------------------------------------------------------------
// C. GRAMATURA (④) — uma cor para o gesto do papel
// ---------------------------------------------------------------------------
console.log('C. Gramatura (④ — duas portas, uma cor, uma verdade)');
ok(/href=\{FOLHA_REVISAO_PATH\}[\s\S]{0,600}border-emerald-500\/40 bg-emerald-500\/10/.test(card), 'o link do DIÁLOGO de travadas usa a MESMA família esmeralda');
ok(/href=\{FOLHA_REVISAO_PATH\}[\s\S]{0,600}focus-visible:ring-emerald-500\/50/.test(card), 'o link do diálogo ganhou o focus ring (a lição da t171 estendida ao papel)');
// (o GESTO da folha especificamente: o bloco do link no diálogo sem nenhum zinc —
// o zinc restante no card é de outras linhas legítimas, não da porta)
const dialogLinkBlock = card.slice(card.indexOf('href={FOLHA_REVISAO_PATH}', card.indexOf('dlg-travadas')));
ok(dialogLinkBlock.length > 0 && !dialogLinkBlock.slice(0, 600).includes('zinc'), 'o GESTO da folha não tem zinc (a gramatura da porta é única: esmeralda)');
ok(card.split('href={FOLHA_REVISAO_PATH}').length === 3, 'EXATAMENTE as duas portas do card usam a fonte única (porta + diálogo)');

// a rota da folha renderiza a folha de verdade (a porta não abre vazio)
const folhaPage = src('src/app/folha-revisao/page.tsx');
ok(folhaPage.includes('FolhaRevisaoSheet') || folhaPage.includes('folha-revisao-sheet'), 'a rota /folha-revisao renderiza a folha (a porta abre a casa certa)');

// ---------------------------------------------------------------------------
// D. DOUTRINA + REGRESSÕES
// ---------------------------------------------------------------------------
console.log('D. Doutrina + regressões (as rodadas anteriores intactas)');
const mepSrc = src('src/lib/math-exam-prep.ts');
ok(/derivar|derivada da data da prova/.test(mepSrc.split('// ---------- A PORTA DA FOLHA')[0]), 'a seção da porta herda a doutrina de derivação (nenhuma data nova duplicada)');
ok(!/2026-\d\d-\d\d/.test(mepSrc.split('// ---------- A PORTA DA FOLHA (t182) ----------')[1]?.split('// ---------- Marcos')[0] ?? ''), 'a porta NÃO introduz data literal (os dias vêm de daysLeft, que deriva de MATH_EXAM.date)');
ok(/folhaDoorVisible\(daysLeft\) && \(/.test(card), 'a guarda vive NO JSX (sem estado novo, sem effect — render-time como a casa)');

// t179 — a porta da S3 (irmã de material) segue inteira
ok(card.includes('milestone?.materialId') && card.includes('onStartStudy?.('), 't179: a porta da S3 segue no marcos (a folha é irmã, não substituta)');
ok(card.includes('Abrir a S3 ·'), 't179: a copy do chip da S3 intacta');
// t181 — a captura limpa segue de pé
ok(src('src/lib/capture-clean.ts').includes('TIDY_TOTAL_MS = 2000'), 't181: a janela de arrumação intacta');
ok(src('src/components/hub/capture-tidy-banner.tsx').includes('pointer-events-none'), 't181: o aviso nunca bloqueia (intacto)');
// t178 — a folha continua lendo o recibo (nada tocado na folha em si)
const folha = src('src/components/hub/folha-revisao-sheet.tsx');
ok(folha.includes('recite') || folha.includes('RECITE'), 't178: a folha segue lendo o recibo da recitação');
ok(src('src/lib/math-exam-prep.ts').includes('MATH_VESPERA_DATE'), 'a fonte das datas da semana segue única');

console.log(`\n${pass} checks OK · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
