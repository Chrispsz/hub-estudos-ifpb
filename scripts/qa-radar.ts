// QA TEMPORÁRIO (Task 27) — o Radar de Provas provado por script.
// A casa prova funções puras com dados reais do acervo e apaga o arquivo.
import { defaultProgress, type StudyProgress } from '../src/lib/study-progress';
import { buildDayPlan } from '../src/lib/study-plan';
import {
  examRadarFor,
  examPressureFor,
  examPressureWhy,
  examBoostLevel,
} from '../src/lib/exam-radar';

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  const mark = cond ? '✓' : '✗ FALHOU';
  if (!cond) failures += 1;
  console.log(`${mark} ${name}${extra ? ` — ${extra}` : ''}`);
}

// Hoje REAL do sandbox: 13/10/2026 (Av1 de Matemática foi 01/10, LM 09/10,
// Prova 1 de Algoritmos 30/10 — o cenário que o dono descreveu).
const hoje = new Date(2026, 9, 13, 10, 0, 0);

// ----- Caso A: o radar espelha o semestre real -----
{
  const radar = examRadarFor(hoje);
  const mat = radar.find((e) => e.disciplineCode === 'TEC.1984')!;
  const lm = radar.find((e) => e.disciplineCode === 'TEC.1632')!;
  const alg = radar.find((e) => e.disciplineCode === 'TEC.1687')!;
  const rht = radar.find((e) => e.disciplineCode === 'TEC.0953')!;
  check('A1: Matemática Av1 = feita (01/10)', mat.status === 'feita' && mat.date === '2026-10-01');
  check('A2: LM Projeto = feita (09/10)', lm.status === 'feita' && lm.date === '2026-10-09');
  check(
    'A3: Algoritmos Prova 1 = agendada D-17',
    alg.status === 'agendada' && alg.daysLeft === 17,
    `D-${alg.daysLeft}`,
  );
  check('A4: RHT sem data = sem-data', rht.status === 'sem-data');
  check(
    'A5: ordem do radar — agendadas primeiro, sem-data por último',
    radar[0].status === 'agendada' && radar[radar.length - 1].status === 'sem-data',
  );
}

// ----- Caso B: a pressão e os níveis -----
{
  const p = examPressureFor('TEC.1687', hoje);
  check('B1: pressão Algoritmos = Prova 1, 17 dias', p?.name === 'Prova 1' && p?.daysLeft === 17);
  check('B2: Matemática sem pressão (prova feita)', examPressureFor('TEC.1984', hoje) === null);
  check('B3: níveis — D-17=1, D-6=2, D-2=3, null=0', examBoostLevel(17) === 1 && examBoostLevel(6) === 2 && examBoostLevel(2) === 3 && examBoostLevel(null) === 0);
  const why = examPressureWhy('TEC.1687', hoje);
  check('B4: why da fila cita a prova', !!why && why.includes('Algoritmos') && why.includes('Prova 1'), why ?? '—');
  check('B5: sem pressão = why null', examPressureWhy('TEC.0953', hoje) === null);
  check(
    'B6: frase de prazo — hoje/amanhã/D-2/dia dd/mm',
    examWhenPhraseSafe(0) === 'hoje' && examWhenPhraseSafe(1) === 'amanhã' && examWhenPhraseSafe(2) === 'em 2 dias' && examWhenPhraseSafe(40, '2026-11-25') === 'dia 25/11',
  );
}

import { examWhenPhrase } from '../src/lib/exam-radar';
function examWhenPhraseSafe(d: number, date?: string): string {
  return examWhenPhrase(d, date);
}

// ----- Caso C: a fila respeita a prova (D-2 → Algoritmos manda) -----
{
  function spBase(includeReviews?: boolean): StudyProgress {
    return {
      ...defaultProgress,
      preferences: { ...defaultProgress.preferences, ...(includeReviews === undefined ? {} : { includeReviews }) },
      pomodoroSessions: [
        // o dono andou seguindo RHT e Algoritmos — RHT vem "antes" no histórico
        { date: '2026-10-26', focusMinutes: 30, disciplineId: 'TEC.0953', startedAt: '2026-10-26T10:00:00', completedAt: '2026-10-26T10:30:00', mode: 'estudo' } as StudyProgress['pomodoroSessions'][number],
        { date: '2026-10-26', focusMinutes: 30, disciplineId: 'TEC.1687', startedAt: '2026-10-26T11:00:00', completedAt: '2026-10-26T11:30:00', mode: 'estudo' } as StudyProgress['pomodoroSessions'][number],
      ],
    };
  }
  const agoraProva = new Date(2026, 9, 27, 10, 0, 0); // D-3 da Prova 1 (30/10)
  const plan = buildDayPlan(spBase(), agoraProva, { maxBlocks: 8 });
  const primeiroProximo = plan.blocks.find((b) => b.kind === 'proximo' || b.kind === 'atrasado');
  check(
    'C1: D-3 — o 1º bloco de estudo é de Algoritmos',
    primeiroProximo?.disciplineCode === 'TEC.1687',
    `${primeiroProximo?.kind}:${primeiroProximo?.title}`,
  );
  check(
    'C2: bloco de prova carrega o selo D-3',
    primeiroProximo?.exam?.daysLeft === 3 && primeiroProximo?.exam?.name === 'Prova 1',
    `exam=${JSON.stringify(primeiroProximo?.exam)}`,
  );

  // Sem pressão (hoje real, prova a 17 dias): RHT sem data NÃO toma a frente
  // do Algoritmos na 1ª passada — boost 1 > boost 0
  const planHoje = buildDayPlan(spBase(), hoje, { maxBlocks: 8 });
  const primeiroHoje = planHoje.blocks.find((b) => b.kind === 'atrasado');
  check(
    'C3: D-17 — Algoritmos ainda assim vem antes na régua da prova',
    primeiroHoje?.disciplineCode === 'TEC.1687',
    `${primeiroHoje?.kind}:${primeiroHoje?.title}`,
  );
}

// ----- Caso D: revisão sob comando -----
{
  function spComRevisao(includeReviews?: boolean): StudyProgress {
    return {
      ...defaultProgress,
      preferences: { ...defaultProgress.preferences, ...(includeReviews === undefined ? {} : { includeReviews }) },
      materialReviews: {
        'mat-00-matrizes': { dueAt: '2026-10-12T08:00:00', stage: 1 } as StudyProgress['materialReviews'][string],
      },
      pomodoroSessions: [
        { date: '2026-10-12', focusMinutes: 30, disciplineId: 'TEC.1984', startedAt: '2026-10-12T10:00:00', completedAt: '2026-10-12T10:30:00', mode: 'estudo' } as StudyProgress['pomodoroSessions'][number],
      ],
    };
  }
  const comRevisao = buildDayPlan(spComRevisao(), hoje, { maxBlocks: 8 });
  check('D1: padrão (undefined) — revisão vencida entra na fila', comRevisao.blocks.some((b) => b.kind === 'revisao'));

  const semRevisao = buildDayPlan(spComRevisao(false), hoje, { maxBlocks: 8 });
  check('D2: desligada — revisão NÃO entra', !semRevisao.blocks.some((b) => b.kind === 'revisao'));
  check(
    'D3: desligada — os slots caem para atrasados/próximos (fila não esvazia)',
    semRevisao.blocks.filter((b) => b.kind === 'atrasado' || b.kind === 'proximo').length >= comRevisao.blocks.filter((b) => b.kind === 'atrasado' || b.kind === 'proximo').length,
  );

  const religada = buildDayPlan(spComRevisao(true), hoje, { maxBlocks: 8 });
  check('D4: religada — revisão volta', religada.blocks.some((b) => b.kind === 'revisao'));
}

console.log(failures === 0 ? '\nTODO VERDE ✓' : `\n${failures} FALHAS ✗`);
process.exit(failures === 0 ? 0 : 1);
