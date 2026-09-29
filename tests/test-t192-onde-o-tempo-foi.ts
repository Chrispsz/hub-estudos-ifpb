/**
 * Task 192 — ONDE O TEMPO FOI (o pacing vira intel da prova real).
 *
 * A Av1 real tem relógio. O run gravava só o status por questão e o elapsed
 * total — se a q3 comeu 18 dos 60 minutos, NINGUÉM ficava sabendo. A rodada
 * entrega:
 *  (1) LIB PURA (simulado-debrief): pacingFor (total/slowest/measured; lixo
 *      → 0; empate no máximo → a primeira; não muta a entrada);
 *      buildDebriefFromDetails ganha o tempo na linha por questão (só quando
 *      timeSec > 0 — corrida antiga permanece idêntica) e o pedido "(4) o
 *      RITMO" quando há tempo medido; buildRunDebriefQuestion confessa o sino
 *      ("encerrada PELO RELÓGIO") nos dois caminhos (detalhes e agregados).
 *  (2) CAPTURA (simulado-view): timeByQ (state + espelho ref síncrono) +
 *      qShownAtRef; o cleanup do efeito [idx, phase, open] fecha o trecho na
      questão que SAI da tela (ordem do React: cleanups primeiro — o
      saveInProgress já nasce com o trecho fechado); peekMergedTimes alimenta
      a persistência a cada segundo; closeInFlightForRecord fecha a última
      questão (inclusive a que estava na tela quando o sino tocou);
      resetPacing em start/startMistakes/onRetryMissed; retomada restaura o
      timeByQ do save (length guard — save antigo recomeça do zero).
 *  (3) O SINO CONFESSA: finish(byClock) gravado em SimuladoRun.endedByClock;
 *      o debrief fresco veste a confissão (amber, AlarmClock); o histórico
 *      ganha o chip "pelo relógio".
 *  (4) O STRIP "Onde o tempo foi" (ResultsScreen): chip por questão com o
 *      dot do desfecho (emerald/rose/zinc — tempo × resultado na mesma
 *      linha), a mais lenta em amber com a confissão no hover; footer com
 *      "nas questões" vs "no relógio"; measured gate (run antigo cala —
 *      regra 88); a IA lê timeSec no "Analisar com IA".
 *
 * Contrato (`bun tests/test-t192-onde-o-tempo-foi.ts`):
 *  A. A LIB (execução real): pacingFor honesto com lixo, empate, pureza.
 *  B. O PROMPT DA IA: tempo na linha, linha antiga intacta, pedido (4) só
 *     com pacing, sino confessado nos dois caminhos do histórico.
 *  C. A CAPTURA: efeito com cleanup, espelho ref, peek/close, resetPacing,
 *     retomada com guard, persistência com timeByQ mesclado.
 *  D. O SINO: finish(true) no tempo esgotado, endedByClock no run, confissão
 *     no ResultsScreen, chip no histórico.
 *  E. O STRIP: measured gate, dot do desfecho, amber no slowest, footer.
 *  F. DOUTRINA: compatibilidade (campos opcionais), a régua única.
 *  G. REGRESSÕES: t191, t190, t189, t188, t185.
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
/** Lê o arquivo SEM comentários e com whitespace normalizado — o contrato
 *  olha STRINGS de verdade (o que renderiza), não prosa de comentário. */
function code(rel: string): string {
  return src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');
}

import {
  buildDebriefFromDetails,
  buildRunDebriefQuestion,
  fmtClockSec,
  pacingFor,
} from '../src/lib/simulado-debrief';
import type { RunQuestionDetail, SimuladoRun } from '../src/lib/study-progress';

// ---------------------------------------------------------------------------

console.log('A. A LIB DO PACING (execução real)');

// A1 — a soma honesta e o mais lento
const base = [12, 300, 45, 0, 61.7];
const resumo = pacingFor(base);
ok(resumo.totalSec === 12 + 300 + 45 + 0 + 61.7, 'A1: totalSec é a soma dos trechos');
ok(resumo.slowestIdx === 1, 'A1: slowestIdx aponta a questão que mais comeu o relógio');
ok(resumo.measured === true, 'A1: com tempo medido, measured é true');

// A2 — empate no máximo fica com a PRIMEIRA (a que travou primeiro)
const empate = pacingFor([10, 30, 5, 30]);
ok(empate.slowestIdx === 1, 'A2: empate no máximo → a primeira (não a última)');

// A3 — lixo → 0 (o tempo corrompido nunca inventa um "mais lento" falso)
const lixo = pacingFor([undefined, null, NaN, -5, Infinity, 7]);
ok(lixo.totalSec === 7, 'A3: undefined/null/NaN/negativo/Infinity viram 0; o válido vale');
ok(lixo.slowestIdx === 5 && lixo.measured === true, 'A3: o único tempo válido é o mais lento');

// A4 — nada medido → measured false e slowest −1 (runs antigos calam)
const vazio = pacingFor([0, 0, 0]);
ok(vazio.measured === false && vazio.slowestIdx === -1 && vazio.totalSec === 0, 'A4: tudo zero → sem pacing');
ok(pacingFor([]).measured === false, 'A4: array vazio → sem pacing');
ok(pacingFor([undefined, null]).measured === false, 'A4: só lixo → sem pacing');

// A5 — PUREZA: a entrada não é mutada
const entrada = [5, 999, undefined];
pacingFor(entrada);
ok(entrada.length === 3 && entrada[1] === 999 && entrada[2] === undefined, 'A5: pacingFor não muta a entrada');

// ---------------------------------------------------------------------------

console.log('B. O PROMPT DA IA COM PACING');

const detalhes: RunQuestionDetail[] = [
  { status: 'missed', topic: 'Álgebra Matricial', timeSec: 1080, statement: 'Dada A = [[1,2],[2,5]]…' },
  { status: 'skipped', topic: 'Lógica Matemática', timeSec: 45, statement: 'Considere p → q…' },
  { status: 'solved', topic: 'Lógica Matemática', statement: 'Negativa de ∀x…' },
];

// B1 — a linha ganha o tempo quando timeSec > 0 (arredondado, mm:ss)
const comPacing = buildDebriefFromDetails({ mode: 'prova', pct: 33, elapsedSec: 1180, details: detalhes });
ok(
  comPacing.includes('NÃO CONSEGUI · 18:00 — Dada A'),
  'B1: a linha da q1 carrega 18:00 antes do enunciado',
);
ok(
  comPacing.includes('PULADA · 00:45'),
  'B2: pulada com 45s também confessa (a que travou e não virou resposta)',
);

// B2 — corrida antiga (sem timeSec) permanece IDÊNTICA (sem "· 00:00" inventado)
const antigos: RunQuestionDetail[] = [
  { status: 'solved', topic: 'Álgebra Matricial', statement: 'Dada A…' },
];
const semPacing = buildDebriefFromDetails({ mode: 'prova', pct: 100, elapsedSec: 300, details: antigos });
ok(!semPacing.includes('· 00:00'), 'B2: linha antiga sem timeSec NÃO inventa 00:00');
ok(semPacing.includes('CONSEGUI — Dada A…'), 'B2: a forma velha da linha permanece');

// B3 — o pedido (4) o RITMO só nasce com tempo medido
ok(comPacing.includes('RITMO'), 'B3: com pacing, a IA é pedida sobre o ritmo');
ok(
  comPacing.includes('onde eu deveria ter pulado e voltado depois'),
  'B3: o pedido nomeia a estratégia (pular e voltar)',
);
ok(!semPacing.includes('RITMO'), 'B3: sem pacing, o pedido continua com os 3 de sempre');
ok(
  semPacing.includes('(1) o padrão dos meus erros') && semPacing.includes('(3) um exercício de treino'),
  'B3: os pedidos originais permanecem no prompt sem pacing',
);

// B4 — o sino confessado no caminho COM detalhes
const runDetalhado: SimuladoRun = {
  id: 'r1',
  date: '2026-09-29T22:00:00-03:00',
  mode: 'prova',
  total: 3,
  solved: 1,
  missed: 1,
  skipped: 1,
  durationSec: 1180,
  questions: detalhes,
};
const debriefSino = buildRunDebriefQuestion({ ...runDetalhado, endedByClock: true });
ok(debriefSino.includes('PELO RELÓGIO'), 'B4: endedByClock true → a IA lê a confissão do sino');
ok(
  debriefSino.includes('Considere isso no diagnóstico de ritmo'),
  'B4: a confissão pede o diagnóstico de ritmo certo',
);
ok(
  !buildRunDebriefQuestion(runDetalhado).includes('PELO RELÓGIO'),
  'B4: sem endedByClock, a observação não existe (terminou antes = silêncio)',
);

// B5 — o sino confessado no caminho de AGREGADOS (run antigo com o campo)
const runVelho: SimuladoRun = {
  id: 'r2',
  date: '2026-08-01T10:00:00-03:00',
  total: 5,
  solved: 2,
  missed: 2,
  skipped: 1,
  durationSec: 600,
  endedByClock: true,
};
const agregadoSino = buildRunDebriefQuestion(runVelho);
ok(
  agregadoSino.includes('encerrada PELO RELÓGIO (00:00)') && agregadoSino.includes('tempo 10:00'),
  'B5: agregados também confessam o sino junto do tempo',
);

// ---------------------------------------------------------------------------

console.log('C. A CAPTURA NO RUN (simulado-view)');

const view = code('src/components/hub/simulado-view.tsx');

// C1 — o espelho síncrono (a verdade para persistir) e o state (a tela)
ok(view.includes('timeByQRef = React.useRef<number[]>([])'), 'C1: o espelho ref existe');
ok(view.includes("const [timeByQ, setTimeByQ] = React.useState<number[]>([])"), 'C1: o state da tela existe');
ok(view.includes('qShownAtRef = React.useRef<number | null>(null)'), 'C1: o instante da questão na tela é ref');

// C2 — os três gestos: addTimeTo (ref+state), peekMergedTimes (leitura pura),
// closeInFlightForRecord (fecha o trecho), resetPacing (corrida nova)
ok(view.includes('function addTimeTo'), 'C2: addTimeTo escreve ref+state juntos');
ok(
  view.includes('function peekMergedTimes') && view.includes('return timeByQRef.current'),
  'C2: peekMergedTimes lê o espelho + o trecho em curso',
);
ok(
  view.includes('function closeInFlightForRecord') && view.includes('qShownAtRef.current = null'),
  'C2: closeInFlightForRecord fecha o trecho e zera o relógio da tela',
);
ok(view.includes('function resetPacing'), 'C2: resetPacing zera a corrida nova');

// C3 — o efeito de pacing com cleanup na troca/pausa/fim
ok(
  view.includes('if (qShownAtRef.current == null) qShownAtRef.current = Date.now();'),
  'C3: o efeito marca o instante em que a questão ficou na tela',
);
ok(
  /return \(\) => \{[\s\S]*?addTimeTo\(idx, seg\);[\s\S]*?\};\s*\}, \[idx, phase, open\]\)/.test(view),
  'C3: o cleanup acumula o trecho na questão que ESTAVA visível (deps idx/phase/open)',
);

// C4 — a persistência carrega o pacing MESCLADO (a pausa/X/F5 não perdem trecho)
ok(
  view.includes('timeByQ: peekMergedTimes()'),
  'C4: o saveInProgress grava o tempo mesclado com o trecho em curso',
);

// C5 — o registro fecha a última questão ANTES de gravar
ok(
  view.includes('const times = closeInFlightForRecord();') &&
    view.includes('recordRun(times, byClock);'),
  'C5: o finish fecha o trecho em curso antes do recordRun',
);

// C6 — corridas novas começam do zero (start, treino de erros, refazer erradas)
ok(
  view.includes('resetPacing(picked.length)') &&
    view.includes('resetPacing(mistakeExercises.length)') &&
    view.includes('resetPacing(missed.length)'),
  'C6: start/startMistakes/onRetryMissed zeram o pacing',
);

// C7 — a retomada restaura o pacing do save com GUARD de comprimento
ok(
  view.includes('saved.timeByQ.length === qs.length'),
  'C7: a retomada só restaura pacing com comprimento alinhado',
);
ok(
  view.includes('new Array(qs.length).fill(0)'),
  'C7: save antigo/corrompido recomeça do zero (nunca inventa tempo)',
);

// C8 — o reset da abertura limpa o pacing (nada vaza entre aberturas)
ok(
  /setTimeByQ\(\[\]\).*?timeByQRef\.current = \[\]/.test(view) ||
    view.includes('timeByQRef.current = [];'),
  'C8: a abertura zera o espelho e o state',
);

// ---------------------------------------------------------------------------

console.log('D. O SINO CONFESSA');

// D1 — o tempo esgotado encerra COM a marca
ok(
  view.includes('finish(true);') && view.includes('expiredToast'),
  'D1: o efeito de tempo esgotado chama finish(true)',
);

// D2 — o run gravado carrega endedByClock (ausente = terminou antes)
ok(
  view.includes('endedByClock: byClock || undefined'),
  'D2: recordRun grava endedByClock (undefined quando terminou antes)',
);

// D3 — o recordRun lê (times, byClock) e grava timeSec por questão
ok(
  view.includes('function recordRun(times: number[], byClock: boolean)') &&
    view.includes('timeSec: Math.max(0, Math.round(times[i] ?? 0))'),
  'D3: o detalhe do run carrega timeSec arredondado e nunca negativo',
);

// D4 — o debrief fresco confessa o sino (amber + AlarmClock + voz da casa)
ok(
  view.includes('{endedByClock && (') && view.includes('pelo relógio'),
  'D4: o ResultsScreen confessa o encerramento pelo relógio',
);
ok(
  /endedByClock && \([\s\S]*?AlarmClock[\s\S]*?Encerrada/.test(view),
  'D4: a confissão veste o AlarmClock e a voz "Encerrada pelo relógio"',
);

// D5 — o run guardado no estado confessa na tela (props do ResultsScreen)
ok(
  view.includes('endedByClock={endedByClock}') && view.includes('timeByQ={timeByQ}'),
  'D5: o ResultsScreen recebe o pacing e a marca do sino',
);
ok(
  view.includes('const [endedByClock, setEndedByClock] = React.useState(false)'),
  'D5: a marca do sino é estado (sobrevive do efeito à tela)',
);

// D5b — O PITFALL DO EVENTO (pego no E2E): onConfirm NÃO pode ir nu no
// onClick — o MouseEvent chegaria como `byClock` (truthy) e TODO Encerrar
// manual confessaria um sino que não tocou. A casa exige arrow explícita.
ok(
  /onClick=\{\(\) => onConfirm\(\)\}/.test(view),
  'D5b: "Encerrar e ver resultado" chama onConfirm() SEM argumento (o evento nunca vira byClock)',
);
ok(
  view.includes('function finish(byClock = false)') &&
    view.includes('setEndedByClock(byClock);'),
  'D5b: o finish declara a marca do sino no estado (a tela confessa o que o run gravou)',
);

// D6 — o histórico ganha o chip "pelo relógio"
const hist = code('src/components/hub/simulado-history.tsx');
ok(
  hist.includes('{r.endedByClock && (') && hist.includes('pelo relógio'),
  'D6: o histórico mostra o chip "pelo relógio" na tentativa do sino',
);

// ---------------------------------------------------------------------------

console.log('E. O STRIP "Onde o tempo foi" (ResultsScreen)');

// E1 — o gate honesto: sem tempo medido, o strip CALA (regra 88)
ok(
  view.includes('{pacing.measured && (') && view.includes('Onde o tempo foi'),
  'E1: o strip só nasce com pacing medido (run antigo cala)',
);
ok(
  view.includes('const pacing = pacingFor(timeByQ);'),
  'E1: o resumo vem da FUNÇÃO PURA da casa (mesma régua da IA)',
);

// E2 — o dot do desfecho: tempo × resultado na mesma linha
ok(
  /bg-emerald-500[\s\S]*?bg-rose-500[\s\S]*?bg-zinc-400/.test(view),
  'E2: o dot segue a gramática da casa (emerald/rose/zinc)',
);

// E3 — a mais lenta veste amber com a confissão no hover
ok(
  view.includes('isSlowest') && view.includes('foi a que mais comeu o relógio'),
  'E3: a questão mais lenta é nomeada no title',
);
ok(
  /isSlowest[\s\S]*?border-amber-500\/50/.test(view),
  'E3: a mais lenta veste amber (a atenção da casa)',
);

// E4 — a pulada que comeu o relógio tem confissão própria no hover
ok(
  view.includes('ficou sem resposta: é ELA a revisão de amanhã'),
  'E4: pulada lenta → a confissão aponta a revisão de amanhã',
);

// E5 — o footer confessa as duas medidas quando divergem
ok(
  view.includes('nas questões') && view.includes('no relógio (a diferença ficou fora das questões)'),
  'E5: "nas questões" vs "no relógio" — a pausa/revisão aparecem na conta',
);
ok(
  view.includes('elapsed - pacing.totalSec >= 3'),
  'E5: a segunda medida só existe quando a diferença é real (>= 3s)',
);

// E6 — a IA lê o pacing no "Analisar com IA"
ok(
  view.includes('timeSec: stripSecs[i] ?? 0'),
  'E6: o "Analisar com IA" envia o tempo por questão',
);

// ---------------------------------------------------------------------------

console.log('F. DOUTRINA (compatibilidade e régua única)');

// F1 — os campos novos são OPCIONAIS (runs e saves antigos não quebram)
const libSp = code('src/lib/study-progress.ts');
ok(
  libSp.includes('timeSec?: number') &&
    libSp.includes('endedByClock?: boolean'),
  'F1: timeSec e endedByClock são opcionais no SimuladoRun/RunQuestionDetail',
);
const libResume = code('src/lib/simulado-resume.ts');
ok(libResume.includes('timeByQ?: number[]'), 'F1: timeByQ é opcional no InProgressRun');

// F2 — a régua é ÚNICA: o pacingFor vive na lib (nada de soma manual no view)
ok(
  !view.includes('reduce((acc, t) => acc + t'),
  'F2: o componente não soma tempo na mão — a régua mora na lib',
);
ok(
  code('src/lib/simulado-debrief.ts').includes('export function pacingFor'),
  'F2: pacingFor é exportado da lib (fonte única do strip e da IA)',
);

// F3 — o prompt da IA continua limitado (capQuestion) mesmo com o pacing
ok(
  code('src/lib/simulado-debrief.ts').includes('return capQuestion('),
  'F3: o prompt com pacing passa pelo capQuestion (a pergunta continua compacta)',
);

// F4 — o sino no buildDebriefFromDetails caminho direto: o prompt ao vivo
// (ResultsScreen) usa buildDebriefFromDetails, e o sino ao vivo é a UI —
// nenhum texto de sino duplicado dentro do prompt ao vivo.
ok(
  !code('src/lib/simulado-debrief.ts').split('export function buildRunDebriefQuestion')[0].includes('PELO RELÓGIO'),
  'F4: o prompt AO VIVO não confessa o sino (a UI confessa) — a observação é só do histórico',
);

// ---------------------------------------------------------------------------

console.log('G. REGRESSÕES');

// t191 — o debrief da prova real segue de pé.
ok(
  code('src/lib/math-exam-prep.ts').includes('MATH_PROVA_REAL_KEY') &&
    code('src/components/hub/exam-prep-card.tsx').includes('Como foi a prova, por tópico?'),
  'G (t191): o ritual pós-prova segue de pé',
);
// t190 — a voz do pulado segue na home/histórico.
ok(
  code('src/components/hub/exam-prep-card.tsx').includes('pulou tudo'),
  'G (t190): a voz do pulado segue na home',
);
// t189 — a tabela segue na régua única.
ok(
  code('src/components/hub/simulado-view.tsx').includes('topicRowsFor') &&
    code('src/components/hub/simulado-view.tsx').includes('sortWorstFirst'),
  'G (t189): a tabela do debrief segue na régua única (topicRowsFor + sortWorstFirst)',
);
// t188 — a folha segue na fonte única.
ok(
  code('src/components/hub/folha-revisao-sheet.tsx').includes('simuladoVerdictFor'),
  'G (t188): a folha segue na fonte única (simuladoVerdictFor)',
);
// t185 — as portas do Estudar seguem de pé.
ok(
  code('src/components/hub/study-view.tsx').includes('readerDoorVisible'),
  'G (t185): a porta do leitor segue de pé',
);
// t62 — a pausa continua salvando (o crash-proof não regrediu).
ok(
  view.includes('saveInProgress({') && view.includes("const KEY = 'hub-estudos-ifpb:simulado-inprogress'") === false,
  'G (t62): a persistência da pausa segue no view',
);
// fmtClockSec segue exportado (o strip e a IA compartilham a mesma régua de relógio)
ok(fmtClockSec(1080) === '18:00' && fmtClockSec(45) === '00:45', 'G: fmtClockSec formata mm:ss com zero à esquerda');

// ---------------------------------------------------------------------------

console.log(`\nt192 — ONDE O TEMPO FOI: ${pass} ok, ${fail} falhas`);
process.exit(fail > 0 ? 1 : 0);
