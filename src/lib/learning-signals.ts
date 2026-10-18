// learning-signals.ts — O ALGORITMO QUE APRENDE (pedido do dono, 17/10/2026:
// "ter um acompanhamento para treinar o próprio algoritmo… moldável com base
// na facilidade e aprendizado REAL nas resoluções… rastreado a atividade com o
// material, tutor, pomodoro, questões… de forma suave e SEMI-AUTOMÁTICA,
// respeitando a hierarquia de prioridades e o efeito escadinha").
//
// A ideia central: a casa já registra o que o aluno FAZ (questões tentadas/
// resolvidas, com/sem ajuda, tempo por questão, tutor acionado). Este módulo
// transforma esse uso diário em SINAIS que alimentam o motor:
//
//   · FACILIDADE por disciplina (0–1) — derivada de três evidências reais:
//       acerto sem ajuda (peso maior), velocidade vs o esperado pela
//       dificuldade da questão, e independência (quanto menos ajuda, melhor).
//     Nada é perguntado ao aluno: tudo nasce das caixinhas que ele JÁ marca
//     ("Tentei/Resolvi/Ajuda") e do tempo que o próprio fluxo cronometra.
//   · NÍVEL honesto: 'puxada' (reforço sobe na fila) · 'solida' (no trilho) ·
//     'fluida' (a fila respira — nada de superestudar o que já saiu) ·
//     'sem-dado' (base pequena NÃO vira julgamento).
//   · LEITURA do algoritmo em 1 linha — "como a casa te lê hoje" sem painel
//     de KPIs (lição t180).
//   · QUESTÕES MAIS DEMORADAS + uso do tutor — a matéria-prima do MOMENTO DE
//     REVISÃO da semana (onde o estudo foi produtivo, onde travou, onde o
//     tutor entrou).
//
// Doutrina da casa: lib PURA (nada lê storage); evidência antes de rótulo;
// sem-dado nunca vira número; o algoritmo EXPLICA o ajuste em pt-BR.

import { disciplines, type Discipline } from '@/data/course-data';
import { exercises } from './exercise-extractor';
import { localDateKey, type ExerciseProgressEntry, type PomodoroSession, type StudyProgress } from './study-progress';

// ---------- Configuração honesta dos pisos ----------

/** Base mínima para julgar: 1–2 questões são sorte, não prova (mastery.ts). */
const MIN_TRIED = 3;
/** Questões com tempo conhecido para a velocidade entrar na conta. */
const MIN_TIMED = 2;
/** Tempo esperado por questão (segundos) pela dificuldade do acervo. */
const EXPECTED_SEC: Record<'facil' | 'medio' | 'dificil', number> = {
  facil: 180,
  medio: 360,
  dificil: 720,
};

export type FacilityLevel = 'puxada' | 'solida' | 'fluida' | 'sem-dado';

export interface DisciplineSignal {
  code: string;
  shortName: string;
  name: string;
  color: string;
  /** Questões do acervo tentadas (com registro de prática). */
  tried: number;
  /** Resolvidas SEM ajuda — a prova do recall. */
  solvedNoHelp: number;
  /** Resolvidas com ajuda (precisei de ajuda marcado). */
  solvedWithHelp: number;
  /** Questões com tempo cronometrado conhecido. */
  timed: number;
  /** Mediana do tempo por questão (segundos) — null se sem base. */
  medianTimeSec: number | null;
  /** Facilidade 0–1 — null quando a base ainda é pequena (sem julgamento). */
  facility: number | null;
  level: FacilityLevel;
  /** A frase da casa — 1 linha, pt-BR, sem KPI. */
  frase: string;
  /** Uso do tutor (mesclado pelo chamador a partir de /api/tutor/signals). */
  tutorLast7d?: number;
  tutorTotal?: number;
  /** Mix do tutor na semana (Task 227) — via withTutorUsage. */
  orientacao7d?: number;
  resposta7d?: number;
}

// ---------- Leitura do progresso ----------

interface QRecord {
  /** O id da questão (na prática é ex.id — o campo antigo virou opcional). */
  code?: string;
  difficulty: 'facil' | 'medio' | 'dificil';
  statement: string;
  topic: string;
  unit?: string;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * A facilidade de UMA disciplina a partir do registro real. Retornos:
 * facility null (sem-dado), ou 0–1 com nível e frase.
 */
function signalFor(
  d: Discipline,
  recs: { ex: QRecord; ep: ExerciseProgressEntry }[],
): DisciplineSignal {
  const tried = recs.filter((r) => r.ep.tried || r.ep.solved);
  const solvedNoHelp = tried.filter((r) => r.ep.solved && !r.ep.neededHelp).length;
  const solvedWithHelp = tried.filter((r) => r.ep.solved && r.ep.neededHelp).length;
  const timedRecs = tried.filter((r) => (r.ep.timeSpentSec ?? 0) > 0);

  const base: DisciplineSignal = {
    code: d.code,
    shortName: d.shortName,
    name: d.name,
    color: d.color,
    tried: tried.length,
    solvedNoHelp,
    solvedWithHelp,
    timed: timedRecs.length,
    medianTimeSec: timedRecs.length > 0 ? Math.round(median(timedRecs.map((r) => r.ep.timeSpentSec!))) : null,
    facility: null,
    level: 'sem-dado',
    frase: 'sem questões suficientes para julgar — resolva mais algumas e a casa lê',
  };

  if (tried.length < MIN_TRIED) return base;

  const successRate = solvedNoHelp / tried.length;
  const helpRate = (tried.length - solvedNoHelp - tried.filter((r) => !r.ep.solved).length) / tried.length;
  const independence = Math.max(0, 1 - helpRate);

  // Velocidade: mediana do tempo real vs o esperado pela dificuldade das
  // questões tentadas — resolver rápido é evidência de facilidade; 1.5× o
  // esperado já conta como travada. Neutra (0.5) quando o tempo é desconhecido.
  let speedScore = 0.5;
  if (timedRecs.length >= MIN_TIMED) {
    const ratios = timedRecs.map((r) => r.ep.timeSpentSec! / (EXPECTED_SEC[r.ex.difficulty] ?? 360));
    const r = median(ratios);
    speedScore = Math.max(0, Math.min(1, 1.5 - r));
  }

  const facility =
    0.45 * successRate + 0.30 * speedScore + 0.25 * independence;

  if (facility < 0.4) {
    const minutos = base.medianTimeSec ? ` · ~${Math.round(base.medianTimeSec / 60)}min por questão` : '';
    return {
      ...base,
      facility,
      level: 'puxada',
      frase: `resolução puxada (${Math.round(successRate * 100)}% de cabeça${minutos}) — a casa reforça antes de avançar`,
    };
  }
  if (facility > 0.75) {
    return {
      ...base,
      facility,
      level: 'fluida',
      frase: `questões saindo de cabeça (${Math.round(successRate * 100)}% sem ajuda) — a fila respira aqui e acelera onde precisa`,
    };
  }
  return {
    ...base,
    facility,
    level: 'solida',
    frase: `no trilho (${Math.round(successRate * 100)}% de cabeça) — continue no ritmo`,
  };
}

/**
 * Os sinais de TODAS as disciplinas (só as com alguma prática entram — a casa
 * não enche a tela de "sem-dado"). Ordenadas: puxadas primeiro (elas pedem
 * atenção), depois fluidas (feedback bom), sólidas, sem-dado.
 */
export function disciplineSignalsOf(progress: StudyProgress): DisciplineSignal[] {
  const byCode = new Map<string, { ex: QRecord; ep: ExerciseProgressEntry }[]>();
  for (const ex of exercises) {
    const ep = progress.exerciseProgress?.[ex.id];
    if (!ep || (!ep.tried && !ep.solved)) continue;
    const list = byCode.get(ex.disciplineCode) ?? [];
    list.push({ ex, ep });
    byCode.set(ex.disciplineCode, list);
  }

  const signals: DisciplineSignal[] = [];
  for (const d of disciplines) {
    const recs = byCode.get(d.code);
    if (!recs || recs.length === 0) continue;
    signals.push(signalFor(d, recs));
  }

  const order: Record<FacilityLevel, number> = { puxada: 0, fluida: 1, solida: 2, 'sem-dado': 3 };
  return signals.sort((a, b) => order[a.level] - order[b.level]);
}

/** Mapa {código → facilidade} — a moeda que o motor de prioridade consome. */
export function facilityMapOf(progress: StudyProgress): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of disciplineSignalsOf(progress)) {
    if (s.facility !== null) map[s.code] = s.facility;
  }
  return map;
}

/** Multiplicador de score a partir da facilidade — puxada PESA MAIS (reforço
 *  sobe), fluida respira (não superestuda o que já saiu). Neutro sem dado. */
export function facilityMultiplierOf(facility: number | undefined): number {
  if (facility === undefined) return 1;
  if (facility < 0.4) return 1.12;
  if (facility > 0.75) return 0.92;
  return 1;
}

/** Razão humana do ajuste — entra nos motivos da triagem/cronograma. */
export function facilityReasonOf(facility: number | undefined): string | null {
  if (facility === undefined) return null;
  if (facility < 0.4) return 'dificuldade real nas questões — reforço antes de avançar';
  if (facility > 0.75) return 'fluidez nas questões — pode acelerar';
  return null;
}

/** Nível a partir da facilidade crua (para quem só tem o número). */
export function facilityLevelOf(facility: number | undefined): FacilityLevel {
  if (facility === undefined) return 'sem-dado';
  if (facility < 0.4) return 'puxada';
  if (facility > 0.75) return 'fluida';
  return 'solida';
}

/** TEMPO HONESTO (Task 226): 25s ≠ "1min" — abaixo de 90s fala em segundos
 *  (arredondado de 5 em 5); acima disso, minutos. A voz da casa para tempo
 *  de questão — usada no Praticar, no painel e no relatório semanal. */
export function formatQuestionTime(sec: number): string {
  if (sec < 90) return `${Math.max(1, Math.round(sec / 5) * 5)}s`;
  return `${Math.round(sec / 60)}min`;
}

// ---------- Uso do tutor (mesclado do servidor) ----------

/** O que /api/tutor/signals devolve por disciplina. */
export interface TutorUsageEntry {
  code: string;
  last7d: number;
  total: number;
  lastUsedAt: string | null;
  /** Pedidos de caminho/entendimento na semana (uso saudável — Task 227). */
  orientacao7d?: number;
  /** Pedidos de entrega pronta na semana (sinal de dependência — Task 227). */
  resposta7d?: number;
}

/** Junta o uso do tutor (servidor) nos sinais locais — mutação local do array novo. */
export function withTutorUsage(
  signals: DisciplineSignal[],
  usage: TutorUsageEntry[] | null | undefined,
): DisciplineSignal[] {
  if (!usage || usage.length === 0) return signals;
  const byCode = new Map(usage.map((u) => [u.code, u]));
  return signals.map((s) => {
    const u = byCode.get(s.code);
    if (!u) return s;
    return {
      ...s,
      tutorLast7d: u.last7d,
      tutorTotal: u.total,
      orientacao7d: u.orientacao7d,
      resposta7d: u.resposta7d,
    };
  });
}

// ---------- A LEITURA DO ALGORITMO (1 linha suave na home) ----------

export interface AlgorithmReadout {
  /** A frase única — null quando nada tem dados ainda (sem ruído). */
  frase: string | null;
  /** O que o algoritmo FEZ com isso (ajustes na fila — 0–2 linhas). */
  ajustes: string[];
  chips: { code: string; shortName: string; level: FacilityLevel; title: string }[];
}

/** "Como o algoritmo te lê" — a casa explica o que os sinais mudaram. */
export function algorithmReadoutOf(
  signals: DisciplineSignal[],
): AlgorithmReadout {
  const chips = signals.map((s) => ({
    code: s.code,
    shortName: s.shortName,
    level: s.level,
    title: s.frase,
  }));
  const ajustes: string[] = [];
  for (const s of signals) {
    if (s.level === 'puxada') {
      const tutor = s.tutorLast7d ? ` e o tutor entrou ${s.tutorLast7d}× na semana` : '';
      ajustes.push(`reforço de ${s.shortName} subiu na fila (questões puxadas${tutor})`);
    } else if (s.level === 'fluida') {
      ajustes.push(`${s.shortName} respira — o peso do dia vai para onde trava`);
    }
  }
  const puxadas = signals.filter((s) => s.level === 'puxada');
  const fluidas = signals.filter((s) => s.level === 'fluida');
  let frase: string | null = null;
  if (puxadas.length > 0) {
    frase = `dificuldade real detectada em ${puxadas.map((s) => s.shortName).join(', ')} — o algoritmo reforça a base antes de avançar a escada`;
  } else if (fluidas.length > 0) {
    frase = `${fluidas.map((s) => s.shortName).join(', ')} com questões de cabeça — a fila libera espaço para o que ainda trava`;
  } else if (signals.length > 0) {
    frase = 'prática registrada — continue marcando suas questões e a leitura fica mais fina';
  }
  return { frase, ajustes: ajustes.slice(0, 2), chips };
}

// ---------- MOMENTO DE REVISÃO (a semana sob o microscópio) ----------

export interface SlowQuestion {
  exerciseId: string;
  disciplineCode: string;
  disciplineShort: string;
  topic: string;
  snippet: string;
  /** Tempo cronometrado na questão (segundos) — só entra quem tem tempo. */
  timeSec: number;
  solved: boolean;
  neededHelp: boolean;
}

/**
 * As questões mais demoradas com tempo conhecido — o "onde pegou mais demora"
 * do momento de revisão. Só questões realmente cronometradas entram.
 */
export function topSlowQuestions(progress: StudyProgress, limit = 5): SlowQuestion[] {
  const rows: SlowQuestion[] = [];
  for (const ex of exercises) {
    const ep = progress.exerciseProgress?.[ex.id];
    const t = ep?.timeSpentSec ?? 0;
    if (!ep || t <= 0) continue;
    const d = disciplines.find((x) => x.code === ex.disciplineCode);
    rows.push({
      exerciseId: ex.id,
      disciplineCode: ex.disciplineCode,
      disciplineShort: d?.shortName ?? ex.disciplineCode,
      topic: ex.topic,
      snippet: ex.statement.length > 90 ? `${ex.statement.slice(0, 90)}…` : ex.statement,
      timeSec: t,
      solved: !!ep.solved,
      neededHelp: !!ep.neededHelp,
    });
  }
  return rows.sort((a, b) => b.timeSec - a.timeSec).slice(0, limit);
}

/**
 * O RESUMO DO MOMENTO DE REVISÃO: onde o tempo foi bom, onde travou, onde o
 * tutor entrou — e o que o algoritmo ajustou para a semana que vem. Frases
 * prontas em pt-BR, prontas para o card semanal (e para o coach IA).
 */
export interface WeekSignalsReview {
  /** Questões mais demoradas (já formatadas em minutos). */
  slow: SlowQuestion[];
  /** Disciplinas onde o tutor entrou na semana (≥1 pergunta). */
  tutorHeavy: { shortName: string; last7d: number; frase: string }[];
  /** Facilidade por disciplina com dados. */
  signals: DisciplineSignal[];
  /** O que o algoritmo ajustou — linhas humanas. */
  ajustes: string[];
  /** null quando a semana não tem nada registrado (sem ruído). */
  frase: string | null;
}

export function weekSignalsReviewOf(
  progress: StudyProgress,
  tutorUsage: TutorUsageEntry[] | null | undefined,
): WeekSignalsReview {
  const signals = withTutorUsage(disciplineSignalsOf(progress), tutorUsage);
  const slow = topSlowQuestions(progress);
  const tutorHeavy = (tutorUsage ?? [])
    .filter((u) => u.last7d > 0)
    .sort((a, b) => b.last7d - a.last7d)
    .slice(0, 3)
    .map((u) => {
      const d = disciplines.find((x) => x.code === u.code);
      const short = d?.shortName ?? u.code;
      // O MIX é o sinal (M11: "o uso do tutor seja para orientação ou
      // resposta"): predominância de pedido de resposta pronta = dependência
      // a exorcizar com base; predominância de orientação = uso saudável.
      const resp = u.resposta7d ?? 0;
      const orient = u.orientacao7d ?? 0;
      const mix =
        u.last7d >= 2 && resp >= 2 && resp > orient
          ? `${resp} ${resp === 1 ? 'pediu' : 'pediram'} resposta pronta — a casa reforça a base em vez de entregar o gabarito`
          : u.last7d >= 4
            ? 'assunto que pede reforço de base'
            : 'orientação saudável, sem dependência';
      return {
        shortName: short,
        last7d: u.last7d,
        frase: `o tutor entrou ${u.last7d} ${u.last7d === 1 ? 'vez' : 'vezes'} em ${short} na semana — ${mix}`,
      };
    });

  const readout = algorithmReadoutOf(signals);
  const questionCount = slow.length;
  const frase =
    questionCount > 0 || tutorHeavy.length > 0 || readout.frase
      ? [
          questionCount > 0
            ? `${questionCount} ${questionCount === 1 ? 'questão demorou' : 'questões demoraram'} mais na semana — elas viram candidatas a revisão`
            : null,
          tutorHeavy.length > 0 ? tutorHeavy[0].frase : null,
        ]
          .filter(Boolean)
          .join(' · ') || null
      : null;

  return {
    slow,
    tutorHeavy,
    signals,
    ajustes: readout.ajustes,
    frase,
  };
}

// ---------- A SEMANA PELOS 4 CANAIS (o "como um todo" do dono, M11) ----------

export interface WeekChannels {
  /** Minutos de foco Pomodoro nos últimos 7 dias (fonte oficial da casa). */
  focoMin: number;
  /** Minutos de leitura REAL (heartbeat do leitor) nos últimos 7 dias. */
  leituraMin: number;
  /** Disciplina com mais leitura na semana — null se ninguém leu nada. */
  leituraTop: { shortName: string; minutes: number } | null;
  /** Questões praticadas/resolvidas/com-ajuda nos últimos 7 dias. */
  questoes: { tried: number; solved: number; withHelp: number };
  /** Uso do tutor na semana com o mix orientação/resposta (null = sem dado). */
  tutor: { total: number; orientacao: number; resposta: number } | null;
}

/**
 * A FOTOGRAFIA DA SEMANA — os 4 canais da telemetria somados ("de forma
 * individual e como um todo"): Pomodoro (foco), material (leitura real),
 * questões (prática) e tutor (ajuda, com o mix orientação/resposta).
 * Janelas idênticas às do relatório semanal (0–6 dias atrás, fuso LOCAL).
 */
export function weekChannelsOf(
  progress: StudyProgress,
  tutorUsage: TutorUsageEntry[] | null | undefined,
  pomodoroSessions?: PomodoroSession[],
): WeekChannels {
  const dayKeys = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.add(localDateKey(d));
  }
  const sinceIso = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // FOCO — Pomodoro concluído (mesma janela de datas do computeWeek).
  const sessions = pomodoroSessions ?? progress.pomodoroSessions ?? [];
  const focoMin = sessions
    .filter((s) => dayKeys.has(s.date))
    .reduce((a, s) => a + s.focusMinutes, 0);

  // LEITURA — o heartbeat do leitor agregado por disciplina.
  const byDisc = new Map<string, number>();
  let leituraMin = 0;
  for (const e of progress.readingLog ?? []) {
    if (!dayKeys.has(e.date)) continue;
    leituraMin += e.minutes;
    byDisc.set(e.disciplineCode, (byDisc.get(e.disciplineCode) ?? 0) + e.minutes);
  }
  let leituraTop: WeekChannels['leituraTop'] = null;
  for (const [code, minutes] of byDisc) {
    if (minutes < 0.5) continue; // 30s de leitura já é evidência (mesmo piso do valor arredondado)
    if (!leituraTop || minutes > leituraTop.minutes) {
      const d = disciplines.find((x) => x.code === code);
      leituraTop = { shortName: d?.shortName ?? code, minutes: Math.round(minutes) };
    }
  }

  // QUESTÕES — praticadas na semana (lastPracticedAt é o registro real).
  let tried = 0;
  let solved = 0;
  let withHelp = 0;
  for (const ep of Object.values(progress.exerciseProgress ?? {})) {
    if (!ep || !ep.lastPracticedAt || ep.lastPracticedAt < sinceIso) continue;
    if (!ep.tried && !ep.solved) continue;
    tried += 1;
    if (ep.solved) {
      solved += 1;
      if (ep.neededHelp) withHelp += 1;
    }
  }

  // TUTOR — soma dos sinais do servidor com o mix por tipo de pedido.
  const usage = tutorUsage ?? [];
  const total = usage.reduce((a, u) => a + u.last7d, 0);
  const orientacao = usage.reduce((a, u) => a + (u.orientacao7d ?? 0), 0);
  const resposta = usage.reduce((a, u) => a + (u.resposta7d ?? 0), 0);
  const tutor = total > 0 ? { total, orientacao, resposta } : null;

  return { focoMin, leituraMin, leituraTop, questoes: { tried, solved, withHelp }, tutor };
}
