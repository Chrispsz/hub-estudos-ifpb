/**
 * Task 193 — O REPLAY DO TEMPO (o histórico ganha a lupa questão a questão).
 *
 * O pacing do t192 só existia no debrief FRESCO: a tentativa de ontem voltava
 * a ser um número seco (10% · 12min) e a pergunta "onde o tempo foi?" morria
 * quando o diálogo fechava. A rodada entrega:
 *  (1) LIB PURA (simulado-debrief): runQuestionsOf (detalhes do run ou null —
 *      corrida antiga não tem o que mostrar, regra 88), timeSecsOfRun (os
 *      tempos por questão; null quando nada foi medido — nunca inventa zeros)
 *      e pacingChipTitle (a confissão do chip — FONTE ÚNICA agora compartilhada
 *      pelo strip FRESCO e pelo strip do HISTÓRICO; duas superfícies, uma voz).
 *  (2) O REPLAY NO HISTÓRICO (simulado-history): botão de replay por tentativa
 *      com detalhes (chevron, hover-reveal, aria-expanded/pressed, uma aberta
 *      por vez) e o RunReplayPanel — o strip com a gramática do t192 + a linha
 *      por questão (dot, Qn, status, tópico, enunciado truncado, tempo 'MM:SS'
 *      ou '—'). Corrida antiga sem detalhes nem mostra o botão.
 *  (3) O STRIP FRESCO (simulado-view) passa a ler o title da FONTE ÚNICA —
 *      nenhuma confissão de pacing duplicada no código.
 *
 * Contrato (`bun tests/test-t193-replay-do-tempo.ts`):
 *  A. A LIB (execução real): gates honestos, pureza, título único.
 *  B. O REPLAY NO HISTÓRICO: botão com gate, painel com strip, linha por
 *     questão, '—' honesto, uma aberta por vez.
 *  C. A FONTE ÚNICA: o strip fresco usa pacingChipTitle (sem title inline).
 *  D. DOUTRINA: regra 88 (sem registro não há linha), nada de zero inventado,
 *     a régua do footer (≥ 3s) compartilhada.
 *  E. REGRESSÕES: t192 (pacing/captura/sino), t191 (prova real), t190 (foco
 *     do pulado), t189 (tabela régua única).
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
  fmtClockSec,
  pacingChipTitle,
  pacingFor,
  runQuestionsOf,
  timeSecsOfRun,
} from '../src/lib/simulado-debrief';
import type { RunQuestionDetail, SimuladoRun } from '../src/lib/study-progress';

// ---------------------------------------------------------------------------

console.log('A. A LIB DO REPLAY (execução real)');

function makeRun(questions?: RunQuestionDetail[], extras: Partial<SimuladoRun> = {}): SimuladoRun {
  return {
    id: 'run-193',
    date: '2026-09-29T23:20:00.000Z',
    mode: 'prova',
    total: questions?.length ?? 0,
    solved: questions?.filter((q) => q.status === 'solved').length ?? 0,
    missed: questions?.filter((q) => q.status === 'missed').length ?? 0,
    skipped: questions?.filter((q) => q.status === 'skipped').length ?? 0,
    durationSec: 77,
    questions,
    ...extras,
  };
}

// A1 — run COM detalhes devolve os detalhes; o botão tem o que mostrar
const detalhes: RunQuestionDetail[] = [
  { status: 'solved', topic: 'Álgebra Matricial', statement: 'Dada A = [[1,2],[2,5]]…', timeSec: 21 },
  { status: 'missed', topic: 'Lógica Matemática', statement: 'Tabela verdade…', timeSec: 41 },
  { status: 'skipped', topic: 'Lógica Matemática', statement: 'Negativa de ∀x…', timeSec: 16 },
];
const runNovo = makeRun(detalhes);
ok(runQuestionsOf(runNovo) === runNovo.questions, 'A1: runQuestionsOf devolve o array do run (mesma referência)');
ok(runQuestionsOf(runNovo)!.length === 3, 'A1: três questões no replay');

// A2 — run ANTIGO (pré-detail) → null: sem registro não há linha (regra 88)
const runAntigo: SimuladoRun = makeRun(undefined);
ok(runQuestionsOf(runAntigo) === null, 'A2: corrida sem detalhes → null (regra 88)');
ok(runQuestionsOf(makeRun([])) === null, 'A2: array vazio também é null (não há o que mostrar)');

// A3 — timeSecsOfRun: tempos medidos → o array inteiro (zeros incluídos, honestos)
const tempos = timeSecsOfRun(runNovo);
ok(tempos !== null && tempos.length === 3, 'A3: tempos do run saem na ordem das questões');
ok(tempos?.join(',') === '21,41,16', 'A3: os tempos são os gravados (21,41,16)');

// A4 — run com detalhes mas SEM tempo (pré-t192) → null: o strip cala
const runSemTempo = makeRun([
  { status: 'solved', topic: 'Álgebra Matricial' },
  { status: 'missed', topic: 'Lógica' },
]);
ok(timeSecsOfRun(runSemTempo) === null, 'A4: detalhes sem timeSec → null (nada foi medido)');
ok(timeSecsOfRun(runAntigo) === null, 'A4: run antigo → null (nem detalhes há)');

// A5 — zeros REAIS não escondem o strip: uma questão medida basta
const runUmTempo = makeRun([
  { status: 'solved', timeSec: 30 },
  { status: 'skipped' },
  { status: 'skipped' },
]);
const temposUm = timeSecsOfRun(runUmTempo);
ok(temposUm !== null && temposUm[0] === 30 && temposUm[1] === 0, 'A5: zero real (pulada) permanece no array — é dado, não invenção');

// A6 — PUREZA: runQuestionsOf e timeSecsOfRun não mutam o run
const runPuro = makeRun(detalhes.map((q) => ({ ...q })));
const antes = JSON.stringify(runPuro);
timeSecsOfRun(runPuro);
runQuestionsOf(runPuro);
ok(JSON.stringify(runPuro) === antes, 'A6: nenhuma função muta o run');

// A7 — lixo no timeSec não engana: undefined vira 0 e o strip decide pelo measured
const runLixo = makeRun([
  { status: 'solved', timeSec: undefined },
  { status: 'missed', timeSec: 12 },
]);
const temposLixo = timeSecsOfRun(runLixo);
ok(temposLixo !== null && temposLixo[0] === 0 && temposLixo[1] === 12, 'A7: timeSec ausente → 0; o medido vale');
ok(pacingFor(temposLixo!).slowestIdx === 1, 'A7: o único tempo válido é o mais lento');

// ---------------------------------------------------------------------------

console.log('B. O TITLE ÚNICO DO CHIP (a confissão que não pode divergir)');

// B1 — a mais lenta confessa o relógio (e o tópico)
const tSlow = pacingChipTitle({ idx: 2, secs: 41, totalSec: 78, slowestIdx: 2, topic: 'Lógica Matemática', solved: false });
ok(tSlow.includes('Q3 foi a que mais comeu o relógio'), 'B1: a lenta veste a confissão');
ok(tSlow.includes('00:41 de 01:18'), 'B1: o tempo e o total no relógio mm:ss');
ok(tSlow.includes('Lógica Matemática'), 'B1: o tópico confessa de onde foi');

// B2 — a lenta PULADA é a revisão de amanhã (a confissão dupla)
const tPulada = pacingChipTitle({ idx: 0, secs: 300, totalSec: 315, slowestIdx: 0, topic: 'Álgebra', solved: null });
ok(tPulada.includes('e ficou sem resposta: é ELA a revisão de amanhã'), 'B2: pulada + lenta = a confissão dupla');

// B3 — a lenta RESOLVIDA não confessa revisão (a história é outra: custo, não buraco)
const tResolvida = pacingChipTitle({ idx: 0, secs: 300, totalSec: 315, slowestIdx: 0, topic: 'Álgebra', solved: true });
ok(!tResolvida.includes('revisão de amanhã'), 'B3: resolvida lenta não vira revisão');

// B4 — chip comum: tempo + tópico, sem drama
const tComum = pacingChipTitle({ idx: 0, secs: 21, totalSec: 78, slowestIdx: 2, topic: 'Álgebra Matricial' });
ok(tComum === 'Q1: 00:21 na tela · Álgebra Matricial', 'B4: o chip comum é só o relato');

// B5 — tópico ausente → '—' (nunca undefined na tela)
ok(pacingChipTitle({ idx: 0, secs: 5, totalSec: 9, slowestIdx: -1 }).includes('· —'), 'B5: sem tópico, o traço honesto');

// B6 — formatting: fmtClockSec é a régua do relógio (mesma do t192)
ok(fmtClockSec(1080) === '18:00' && fmtClockSec(0) === '00:00', 'B6: mm:ss com zero à esquerda');

// ---------------------------------------------------------------------------

console.log('C. O REPLAY NO HISTÓRICO (fiação)');

const hist = code('src/components/hub/simulado-history.tsx');

// C1 — o botão existe com o gate honesto (corrida antiga nem o mostra)
ok(hist.includes('runQuestionsOf(r)'), 'C1: o botão lê o gate da LIB (runQuestionsOf)');
ok(hist.includes('aria-expanded') && hist.includes('aria-pressed'), 'C1: aria-expanded + aria-pressed no toggle');
ok(hist.includes('ChevronUp') && hist.includes('ChevronDown'), 'C1: o chevron declara o estado aberto/fechado');

// C2 — UMA aberta por vez: o estado é replayId único e o toggle troca
ok(hist.includes('replayId'), 'C2: um replayId único — abrir outra fecha a anterior');
ok(hist.includes("setReplayId(replayOpen ? null : r.id)"), 'C2: o clique alterna abrir/fechar');

// C3 — o painel com a gramática do strip
ok(hist.includes('RunReplayPanel'), 'C3: o painel de replay existe');
ok(hist.includes('Onde o tempo foi'), 'C3: o strip do pacing no replay');
ok(hist.includes('pacingChipTitle'), 'C3: o title dos chips vem da FONTE ÚNICA');
ok(hist.includes('timeSecsOfRun(run)'), 'C3: os tempos vêm da lib (nunca do JSX)');

// C4 — a linha por questão: dot, status, tópico, enunciado, tempo
ok(hist.includes("s === 'solved' ? 'consegui' : s === 'missed' ? 'não consegui' : 'pulada'"), 'C4: o status na voz da casa');
ok(hist.includes('statusDot(q.status)'), 'C4: o dot do desfecho na linha');
ok(hist.includes("q.timeSec > 0"), 'C4: o tempo só aparece quando medido');
ok(hist.includes(": '—'}"), 'C4: sem registro → o traço honesto (nunca 00:00 falso)');

// C5 — o footer do strip compara com a MESMA régua (≥ 3s)
ok(hist.includes('run.durationSec - pacing.totalSec >= 3'), 'C5: a diferença fora das questões só confessa quando real');
ok(hist.includes('no relógio (a diferença ficou fora das questões)'), 'C5: a mesma voz do debrief fresco');

// C6 — a nota honesta do rodapé (a pausa não entra)
ok(hist.includes('a pausa não entra (o cronômetro congela)'), 'C6: a doutrina da pausa confessada no papel');

// C7 — acessibilidade: labels com a data da tentativa
ok(hist.includes("o replay questão a questão da tentativa de"), 'C7: aria-label nomeia a tentativa pela data');

// ---------------------------------------------------------------------------

console.log('D. A FONTE ÚNICA (o strip fresco assina o mesmo título)');

const view = code('src/components/hub/simulado-view.tsx');
ok(view.includes('pacingChipTitle'), 'D: o strip FRESCO usa a fonte única');
ok(!view.includes('foi a que mais comeu o relógio'), 'D: nenhuma confissão duplicada no view (só na lib)');
ok(!hist.includes('foi a que mais comeu o relógio'), 'D: nenhuma confissão duplicada no histórico (só na lib)');
ok(src('src/lib/simulado-debrief.ts').includes('foi a que mais comeu o relógio'), 'D: a confissão mora na LIB');

// ---------------------------------------------------------------------------

console.log('E. DOUTRINA');

// E1 — a lib continua pura: sem window/localStorage/fetch
const lib = src('src/lib/simulado-debrief.ts');
ok(!lib.includes('window.') && !lib.includes('localStorage') && !lib.includes('fetch('), 'E1: a lib do replay é pura (sem browser)');

// E2 — os campos opcionais não viraram obrigatórios (compat silenciosa)
ok(lib.includes('timeSec?: number') === false, 'E2: o tipo mora no study-progress (fonte única dos tipos)');
const tipos = src('src/lib/study-progress.ts');
ok(tipos.includes('timeSec?: number'), 'E2: RunQuestionDetail.timeSec segue opcional (run antigo não quebra)');
ok(tipos.includes('endedByClock?: boolean'), 'E2: SimuladoRun.endedByClock segue opcional');

// E3 — nada de zero inventado na linha por questão do histórico
ok(!hist.includes("'00:00'"), 'E3: o histórico nunca escreve um zero à mão');

// ---------------------------------------------------------------------------

console.log('F. REGRESSÕES');

// t192 — o pacing continua de pé no view (captura, sino, strip)
ok(view.includes('closeInFlightForRecord'), 'F (t192): a captura do trecho final segue de pé');
ok(view.includes('endedByClock'), 'F (t192): o sino segue confessando');
ok(view.includes('Onde o tempo foi'), 'F (t192): o strip fresco segue de pé');
ok(view.includes('qShownAtRef'), 'F (t192): o espelho do tempo segue capturando');

// t191 — o debrief da prova real segue lendo a autoavaliação
ok(
  code('src/components/hub/exam-prep-card.tsx').includes('MATH_PROVA_REAL_KEY'),
  'F (t191): o card pós-prova segue na chave da prova real',
);
ok(
  code('src/components/hub/recovery-card.tsx').includes('provaRealConfessionFor'),
  'F (t191): a recuperação segue confessando o travei',
);

// t190 — o foco segue falando a língua do pulado (pulouTudo antes da taxa)
ok(
  src('src/lib/math-exam-prep.ts').includes('pulouTudo ?? worst') ||
    src('src/lib/math-exam-prep.ts').includes('pulouTudo'),
  'F (t190): o foco do kit/folha segue a regra do pulado',
);

// t189 — a tabela do debrief segue na fonte única da agregação (topicRowsFor)
ok(
  view.includes('topicRowsFor') && view.includes('sortWorstFirst'),
  'F (t189): a tabela segue lendo a agregação única',
);

// o formato do run gravado não mudou — o replay lê, nunca escreve
ok(
  tipos.includes('questions?: RunQuestionDetail[]'),
  'F: SimuladoRun.questions segue opcional e o replay é só leitura',
);

// ---------------------------------------------------------------------------

console.log(`\nt193 — O REPLAY DO TEMPO: ${pass} ok, ${fail} falhas`);
process.exit(fail > 0 ? 1 : 0);
