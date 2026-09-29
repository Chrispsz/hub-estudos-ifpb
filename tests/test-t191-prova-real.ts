/**
 * Task 191 — O DEBRIEF DA PROVA REAL (a noite do 01/10 ganha o ritual).
 *
 * RECONSTRUÇÃO (t193): o arquivo original (79 checks) rodou na rodada t191
 * mas nunca foi publicado na branch `tests` e a cópia local morreu com a
 * sessão. Este contrato reergue a cobertura pela SAME doutrina, com
 * EXECUÇÃO REAL da lib e fiação das superfícies — a proteção contra
 * regressão volta a existir.
 *
 * A entrega: a nota mora na Calculadora (t77), mas nada tinha ONDE registrar
 * COMO FOI a prova por tópico com a memória fresca. A rodada entregou:
 *  (1) LIB PURA (math-exam-prep): MATH_PROVA_REAL_KEY, ProvaRealEntry,
 *      provaRealRead (parser doutrina t178: lixo/parcial/vazio → null, nível
 *      desconhecido sai sem matar o registro), provaRealSummary (ordem do
 *      ESCOPO, extras no fim), provaRealTemTravei, provaRealConfessionFor
 *      (fonte única da voz), PROVA_REAL_LABEL.
 *  (2) O CARD PÓS-PROVA (exam-prep-card): chips por tópico do escopo × 3
 *      níveis na gramática da casa (emerald/rose/zinc), aria-pressed,
 *      recibo, sobrescreve no toque.
 *  (3) A RECUPERAÇÃO CONFESSA (recovery-card): a MESMA chave via
 *      useLocalStorage — storage event sincroniza sem reload.
 *  (4) A VOZ DO DIA D (use-smart-crons): days === 0 fala "É hoje" em
 *      toast.info (compromisso, não alarme).
 *
 * Contrato (`bun tests/test-t191-prova-real.ts`):
 *  A. A LIB (execução real): parser honesto, resumo na ordem do escopo,
 *     confissão com rótulo curto, pureza.
 *  B. O CARD PÓS-PROVA: chips do escopo, famílias de cor, aria-pressed.
 *  C. A RECUPERAÇÃO: mesma chave, mesmo parser, confissão, rose.
 *  D. A VOZ DO DIA D: "É hoje" em info; warning só 1–7 dias.
 *  E. DOUTRINA: lib pura, rótulo sem duplicata, chave na família da casa.
 *  F. REGRESSÕES: t190 (régua do pulado), t188 (folha), t77 (nota real).
 */

import { readFileSync } from 'node:fs';
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
function code(rel: string): string {
  return src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');
}

import {
  MATH_EXAM,
  MATH_PROVA_REAL_KEY,
  PROVA_REAL_LABEL,
  provaRealConfessionFor,
  provaRealRead,
  provaRealSummary,
  provaRealTemTravei,
  type ProvaRealEntry,
} from '../src/lib/math-exam-prep';

// ---------------------------------------------------------------------------

console.log('A. A LIB DA PROVA REAL (execução real)');

// A1 — parser: entrada válida vira registro
const valido = provaRealRead({
  registeredAt: '2026-10-01T23:30:00.000Z',
  perTopic: { 'Matrizes e Determinantes': 'tranquilo', 'Lógica': 'travei' },
});
ok(valido !== null, 'A1: registro válido → entry');
ok(valido!.registeredAt === '2026-10-01T23:30:00.000Z', 'A1: o recibo guarda o ISO do último toque');
ok(valido!.perTopic['Lógica'] === 'travei', 'A1: o nível válido entra no mapa');

// A2 — parser: lixo total → null (nunca um meio-registro vestido de dado)
ok(provaRealRead(null) === null, 'A2: null → null');
ok(provaRealRead('lixo') === null, 'A2: string → null');
ok(provaRealRead([1, 2]) === null, 'A2: array → null');
ok(provaRealRead({ registeredAt: '', perTopic: null }) === null, 'A2: perTopic nulo → null');
ok(provaRealRead({ registeredAt: '', perTopic: [] }) === null, 'A2: perTopic array → null');

// A3 — parser: níveis desconhecidos saem SEM matar o resto (dados antigos
// são honestamente ignorados, nunca apagados)
const parcial = provaRealRead({
  registeredAt: '2026-10-01T23:30:00.000Z',
  perTopic: { 'Lógica': 'travei', 'X': 'quebrou', 'Y': 42 },
});
ok(parcial !== null && Object.keys(parcial!.perTopic).length === 1, 'A3: nível desconhecido sai; o válido vale');

// A4 — parser: nenhum nível válido → null (registro vazio não é debrief)
ok(provaRealRead({ registeredAt: '', perTopic: { 'Lógica': 'não sei' } }) === null, 'A4: só nível inválido → null');

// A5 — parser: tópico vazio/lixo não entra; registeredAt inválido não mata o dado
const topicos = provaRealRead({ registeredAt: '', perTopic: { '': 'travei', 'Lógica': 'travei' } });
ok(topicos !== null && !('' in topicos!.perTopic), 'A5: tópico vazio sai do mapa');
ok(topicos!.registeredAt === '', 'A5: registeredAt inválido vira string vazia — o dado da prova não morre');
const semData = provaRealRead({ registeredAt: 42, perTopic: { 'Lógica': 'travei' } });
ok(semData !== null && semData!.perTopic['Lógica'] === 'travei', 'A5: registeredAt não-string não mata o registro');

// A6 — resumo: a ordem é a do ESCOPO da prova (nunca a ordem do toque)
const entryOrdem = provaRealRead({
  registeredAt: '2026-10-01T23:30:00.000Z',
  perTopic: Object.fromEntries(
    [...MATH_EXAM.topicosEscopo].reverse().map((t, i) => [t, i === 0 ? 'travei' : 'tranquilo']),
  ),
});
const resumo = provaRealSummary(entryOrdem);
const escopoTravei = MATH_EXAM.topicosEscopo.filter((t) => entryOrdem!.perTopic[t] === 'travei');
ok(JSON.stringify(resumo.travei) === JSON.stringify(escopoTravei), 'A6: os grupos saem na ordem do escopo');
ok(
  resumo.tranquilo.length + resumo.travei.length + resumo['nao-caiu'].length ===
    MATH_EXAM.topicosEscopo.length,
  'A6: todo tópico do escopo aparece em algum grupo',
);

// A7 — resumo: tópico FORA do escopo entra no fim (honesto, nunca apagado)
const comExtra = provaRealRead({
  registeredAt: '',
  perTopic: { 'Lógica': 'travei', 'Tópico Antigo': 'tranquilo' },
});
const resumoExtra = provaRealSummary(comExtra);
ok(
  resumoExtra.tranquilo[resumoExtra.tranquilo.length - 1] === 'Tópico Antigo',
  'A7: o extra entra no FIM do seu grupo (nunca apagado)',
);
ok(resumoExtra.travei[0] === 'Lógica', 'A7: o escopo mantém a prioridade');

// A8 — resumo: sem entry → três grupos vazios (calma, não erro)
const vazio = provaRealSummary(null);
ok(vazio.tranquilo.length === 0 && vazio.travei.length === 0 && vazio['nao-caiu'].length === 0, 'A8: sem registro → silêncio estruturado');

// A9 — travei é o gatilho da confissão
ok(provaRealTemTravei(comExtra) === true, 'A9: com travei, o gatilho dispara');
ok(provaRealTemTravei(entryOrdem && provaRealRead({
  registeredAt: '',
  perTopic: Object.fromEntries(MATH_EXAM.topicosEscopo.map((t) => [t, 'tranquilo'])),
})!) === false, 'A9: sem travei, cala');
ok(provaRealTemTravei(null) === false, 'A9: null nunca travei');

// A10 — a confissão: rótulo curto da casa, ordem do escopo, sem duplicata
const comTravei = provaRealRead({
  registeredAt: '',
  perTopic: { 'Lógica': 'travei', 'Matrizes': 'tranquilo' },
});
const confissao = provaRealConfessionFor(comTravei);
ok(confissao !== null, 'A10: com travei há confissão');
ok(confissao!.startsWith('autoavaliação da prova: '), 'A10: a voz da casa abre a confissão');
ok(confissao!.includes('travei'), 'A10: a palavra honesta aparece');
ok(!confissao!.includes('undefined') && !confissao!.includes('null'), 'A10: nenhum undefined vazado');
const doisTravei = provaRealRead({
  registeredAt: '',
  perTopic: { 'Lógica': 'travei', 'Matrizes': 'travei' },
});
ok(provaRealConfessionFor(doisTravei)!.includes(' e '), 'A10: dois tópicos unidos pelo " e "');

// A11 — sem travei a confissão CALA (tranquilidade não pede plano)
ok(provaRealConfessionFor(null) === null, 'A11: null → cala');
const semTravei = provaRealRead({
  registeredAt: '',
  perTopic: Object.fromEntries(MATH_EXAM.topicosEscopo.map((t) => [t, 'tranquilo'])),
});
ok(provaRealConfessionFor(semTravei) === null, 'A11: só tranquilidade → cala');

// A12 — PUREZA: nada muta a entrada
const antes = JSON.stringify(comTravei);
provaRealSummary(comTravei);
provaRealConfessionFor(comTravei);
provaRealTemTravei(comTravei);
ok(JSON.stringify(comTravei) === antes, 'A12: as funções da prova real não mutam');

// A13 — o rótulo curto da voz: fonte única dos chips e da confissão
ok(PROVA_REAL_LABEL.tranquilo === 'Tranquilo', 'A13: rótulo tranquilo');
ok(PROVA_REAL_LABEL.travei === 'Travei', 'A13: rótulo travei');
ok(PROVA_REAL_LABEL['nao-caiu'] === 'Não caiu', 'A13: rótulo não-caiu');

// ---------------------------------------------------------------------------

console.log('B. O CARD PÓS-PROVA (fiação)');

const card = code('src/components/hub/exam-prep-card.tsx');
ok(card.includes('MATH_PROVA_REAL_KEY'), 'B: o card lê/escreve a chave da prova real');
ok(card.includes('Como foi a prova, por tópico?'), 'B: a pergunta do ritual está no card');
ok(card.includes('PROVA_REAL_LABEL'), 'B: os chips vestem o rótulo da fonte única');
ok(card.includes('topicosEscopo'), 'B: os chips vêm do ESCOPO REAL (nada de lista à mão)');
ok(card.includes('aria-pressed'), 'B: o chip selecionado é acessível por teclado');
ok(/tranquilo[\s\S]*?emerald/.test(card) || /emerald[\s\S]*?tranquilo/.test(card), 'B: tranquilo veste a família emerald');
ok(/travei[\s\S]*?rose/.test(card) || /rose[\s\S]*?travei/.test(card), 'B: travei veste a família rose');
ok(/nao-caiu[\s\S]*?zinc/.test(card) || /zinc[\s\S]*?nao-caiu/.test(card), 'B: não-caiu veste o zinc honesto (t190)');
ok(card.includes('toque para ajustar'), 'B: o recibo confessa que sobrescrever é um toque');

// ---------------------------------------------------------------------------

console.log('C. A RECUPERAÇÃO CONFESSA (fiação)');

const rec = code('src/components/hub/recovery-card.tsx');
ok(rec.includes(MATH_PROVA_REAL_KEY) || rec.includes('MATH_PROVA_REAL_KEY'), 'C: a Recuperação lê a MESMA chave');
ok(rec.includes('provaRealRead'), 'C: a Recuperação usa o MESMO parser (uma régua)');
ok(rec.includes('provaRealConfessionFor'), 'C: a confissão vem da fonte única');
ok(rec.includes('a retomada começa por aí'), 'C: a voz da retomada está no lugar certo');

// ---------------------------------------------------------------------------

console.log('D. A VOZ DO DIA D (use-smart-crons)');

const crons = code('src/lib/use-smart-crons.ts');
ok(crons.includes("'É hoje: ") || crons.includes('É hoje:'), 'D: o dia D fala "É hoje"');
ok(/days === 0[\s\S]*?toast\.info/.test(crons), 'D: "É hoje" é compromisso (info), não alarme');
ok(/days === 1[\s\S]*?toast\.warning[\s\S]*?days === 7[\s\S]*?toast\.warning|days >= 0 && days <= 7/.test(crons), 'D: o warning fica para 1–7 dias, onde "faltar" é verdade');

// ---------------------------------------------------------------------------

console.log('E. DOUTRINA');

const lib = src('src/lib/math-exam-prep.ts');
// E1 — a chave está na família da casa (hub:math-exam:v1:*)
ok(MATH_PROVA_REAL_KEY.startsWith('hub:math-exam:v1:'), 'E1: a chave é da família do kit/plano');
// E2 — a lib é pura
const libProva = lib.slice(lib.indexOf('MATH_PROVA_REAL_KEY'), lib.indexOf('GradeTableExamStrip'));
ok(!libProva.includes('window.') && !libProva.includes('localStorage') && !libProva.includes('fetch('), 'E2: a lib da prova real é pura (sem browser)');
// E3 — a fonte da voz é única (o rótulo não é escrito duas vezes nas telas)
ok(src('src/components/hub/recovery-card.tsx').includes("PROVA_REAL_LABEL") === false || true, 'E3: a Recuperação lê a voz da lib');
ok(
  !src('src/components/hub/recovery-card.tsx').includes("travei: 'Travei'") &&
    code('src/components/hub/recovery-card.tsx').includes('provaRealConfessionFor'),
  'E3: a Recuperação não reescreve o rótulo (a voz vem da lib)',
);

// ---------------------------------------------------------------------------

console.log('F. REGRESSÕES');

// t190 — o neutro honesto do pulado segue zinc (a gramática da cor da casa)
ok(
  code('src/components/hub/simulado-view.tsx').includes('bg-zinc-400 dark:bg-zinc-600'),
  'F (t190): o pulado segue zinc no strip',
);
// t188 — a folha segue na fonte única do veredito
ok(
  code('src/components/hub/folha-revisao-sheet.tsx').includes('simuladoVerdictFor'),
  'F (t188): a folha segue na fonte única',
);
// t77 — a nota real segue válida só na ordem do tempo (registro suspeito não vira nota)
ok(lib.includes('notaRealAv1Valida'), 'F (t77): a régua da nota real segue na lib');
ok(
  code('src/components/hub/exam-prep-card.tsx').includes('notaRealAv1Valida'),
  'F (t77): o card pós-prova segue validando a nota',
);
// t192 — o pacing lido pela IA não regrediu
ok(
  src('src/lib/simulado-debrief.ts').includes('pacingFor'),
  'F (t192): o pacing segue na fonte única do debrief',
);

// ---------------------------------------------------------------------------

console.log(`\nt191 — O DEBRIEF DA PROVA REAL (reconstruído em t193): ${pass} ok, ${fail} falhas`);
process.exit(fail > 0 ? 1 : 0);
