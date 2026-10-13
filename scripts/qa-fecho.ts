// QA TEMPORÁRIO (Task 206) — o Fecho Interativo provado por script.
// A casa prova funções puras com dados reais do acervo e apaga o arquivo.
import {
  defaultProgress,
  type StudyProgress,
} from '../src/lib/study-progress';
import { buildSessionHarmony } from '../src/lib/session-harmony';
import { todayDateKey } from '../src/lib/today-focus';
import { exercises } from '../src/lib/exercise-extractor';

const now = new Date();
const dateKey = todayDateKey(now);
const yesterdayKey = todayDateKey(new Date(now.getTime() - 86_400_000));

function base(): StudyProgress {
  return {
    ...defaultProgress,
    dailyHours: { [dateKey]: 1.5 },
  };
}

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  const mark = cond ? '✓' : '✗ FALHOU';
  if (!cond) failures += 1;
  console.log(`${mark} ${name}${extra ? ` — ${extra}` : ''}`);
}

// ----- Caso A: sessão fresca — fecho honesto, sugestão da própria fila -----
{
  const h = buildSessionHarmony(base(), now);
  const fechoBlock = h.blocks.find((b) => b.kind === 'fecho');
  check('A1: estado pronta com orçamento 1h30', h.state === 'pronta');
  check('A2: fecho presente na fila', !!fechoBlock);
  check('A3: sem erros, sem listas, passo não gravado', h.fecho.pendingErrors === 0 && h.fecho.lists.length === 0 && !h.fecho.stepRecorded);
  check('A4: sugestão nasce da fila (materialId real)', !!h.fecho.suggestion && !!h.fecho.suggestion.materialId, h.fecho.suggestion?.text);
  check('A5: bloco do fecho não nasce feito', !!fechoBlock && !fechoBlock.done);
}

// ----- Caso B: erro em aberto — o 1º gesto conta de verdade -----
{
  const ex = exercises.find((e) => !!e.hint && !!e.statement) ?? exercises[0];
  const sp = base();
  sp.exerciseProgress = {
    [ex.id]: {
      tried: true,
      solved: false,
      neededHelp: false,
      lastPracticedAt: new Date(now.getTime() - 3_600_000).toISOString(),
      lapses: 1,
    },
  };
  const h = buildSessionHarmony(sp, now);
  check('B1: erro em aberto vira contagem no fecho', h.fecho.pendingErrors >= 1, `ex=${ex.id}, contagem=${h.fecho.pendingErrors}`);
}

// ----- Caso C: checklist aberta em material da sessão — as listas de hoje -----
{
  const sp = base();
  const matId = 'alg-questoes-semana4';
  sp.materialChecklists = {
    [matId]: {
      items: [
        { id: 'q1', text: 'Q1', done: true },
        { id: 'q2', text: 'Q2', done: false },
        { id: 'q3', text: 'Q3', done: false },
      ],
    },
  };
  const h = buildSessionHarmony(sp, now);
  const inSession = h.blocks.some((b) => b.materialId === matId);
  const listed = h.fecho.lists.find((l) => l.materialId === matId);
  check('C1: material com checklist entrou na sessão', inSession);
  check('C2: lista aparece no fecho com 2/3 restantes', !!listed && listed.remaining === 2 && listed.total === 3, listed ? `${listed.title}` : 'ausente');
}

// ----- Caso D: passo gravado HOJE — o fecho nasce feito -----
{
  const sp = base();
  sp.tomorrowStep = { setOn: dateKey, text: 'Questões da Semana 4 (Classroom)', materialId: 'alg-questoes-semana4' };
  const h = buildSessionHarmony(sp, now);
  const fechoBlock = h.blocks.find((b) => b.kind === 'fecho');
  check('D1: stepRecorded=true', h.fecho.stepRecorded);
  check('D2: bloco do fecho marca feito com o porquê', !!fechoBlock && fechoBlock.done && !!fechoBlock.doneWhy && fechoBlock.doneWhy.includes('gravado'), fechoBlock?.doneWhy);
  check('D3: doneCount conta o fecho', h.doneCount >= 1);
}

// ----- Caso E: passo STALE (gravado ontem) — o fecho segue aberto -----
{
  const sp = base();
  sp.tomorrowStep = { setOn: yesterdayKey, text: 'passo de ontem' };
  const h = buildSessionHarmony(sp, now);
  const fechoBlock = h.blocks.find((b) => b.kind === 'fecho');
  check('E1: passo stale não marca o fecho de hoje', !h.fecho.stepRecorded && !!fechoBlock && !fechoBlock.done);
}

// ----- Caso F: sessão CUMPRIDA — o fecho é o que resta, sugestão pende da fila -----
{
  const sp = base();
  sp.pomodoroSessions = [
    { date: dateKey, focusMinutes: 95, disciplineId: 'TEC.1687', completedAt: new Date().toISOString() },
  ] as StudyProgress['pomodoroSessions'];
  const h = buildSessionHarmony(sp, now);
  check('F1: estado cumprida', h.state === 'cumprida');
  check('F2: fit null quando cumprida', h.fit === null);
  check('F3: sugestão do fecho = bloco pendente com material', !!h.fecho.suggestion?.materialId, h.fecho.suggestion?.text);
  check('F4: nextHint aponta o amanhã', !!h.nextHint?.title, h.nextHint?.title);
}

// ----- Caso G: modo micro — fecho relâmpago também se torna gravável -----
{
  const sp = base();
  sp.dailyHours = { [dateKey]: 0.25 }; // 15 min < MICRO_THRESHOLD
  const h = buildSessionHarmony(sp, now);
  check('G1: estado micro', h.state === 'micro');
  const hasFecho = h.blocks.some((b) => b.kind === 'fecho');
  check('G2: micro com bloco da fila não adiciona fecho separado', h.blocks.length === 1 ? !hasFecho : hasFecho);
}

console.log(failures === 0 ? '\nTODOS OS CASOS PASSARAM' : `\n${failures} CASO(S) FALHARAM`);
process.exit(failures === 0 ? 0 : 1);
