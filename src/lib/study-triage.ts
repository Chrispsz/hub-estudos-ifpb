// study-triage.ts — MOTOR DE PRIORIDADE v2 (Task 219, pedido do dono 15/10/2026:
// "o algoritmo deve ser inteligente conforme os materiais, matérias, períodos,
// peso das matérias, matérias práticas etc — guiando durante TODO o curso;
// eu não quero plano de recuperação, eu quero algoritmo inteligente").
//
// O QUE MUDOU NA INTELIGÊNCIA (tudo GERAL — nada específico da fase atual):
//   1. TIPO DE AVALIAÇÃO importa: prova = pico de urgência; trabalho = cadência
//      sustentada (projeto evolui por blocos, não véspera); atividade = meio.
//      O tipo vem do NOME/DESCRIÇÃO do registro oficial (keyword) — zero migração.
//   2. DÍVIDA DE PRÁTICA: cada disciplina tem perfilPratica (dado do CURSO em
//      course-data) → cadência-alvo (pratica 2d / mista 3d / teoria 7d). Ficar
//      além da cadência gera dívida que PESA na fila — "prática constante"
//      vira engenharia, não conselho.
//   3. TRIAGEM HONESTA (foco / manter / em espera): quando o essencial passa da
//      capacidade, a casa ESTACIONA explicitamente o que está em dia e sem
//      prazo — com motivo e com regra de volta (prova entra no radar D-21, nota
//      feita abre vaga, ou o dono manda retomar). Estacionado ≠ apagado: FSRS
//      e radar continuam vigiando por conta própria.
//
// Lib PURA: recebe `now` + estados e devolve retrato — nada lê storage aqui
// (mesma doutrina do exam-radar). Os chamadores injetam customEvaluations.

import {
  disciplines,
  evaluationPeriods,
  getDisciplineByCode,
  type Discipline,
} from '@/data/course-data';
import type { CustomEvaluation } from './study-progress';
import { currentWeekOfSemester } from './semester';

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Tipos de avaliação — derivados do registro oficial (nome + descrição)
// ---------------------------------------------------------------------------

export type EvalKind = 'prova' | 'trabalho' | 'atividade';

/** 'Prova 1' → prova · 'Atividade…'/'Seminário' → atividade · 'Trabalho/Projeto/Entrega' → trabalho. */
export function evalKindOf(name: string, description = ''): EvalKind {
  const t = `${name} ${description}`.toLowerCase();
  // atividade/seminário ANTES de trabalho — 'seminário de apresentação' não é projeto
  if (/atividade|semin/.test(t)) return 'atividade';
  if (/trabalho|projeto|entrega|sprint/.test(t)) return 'trabalho';
  return 'prova';
}

// ---------------------------------------------------------------------------
// Dívida de prática — cadência-alvo por perfil do CURSO
// ---------------------------------------------------------------------------

/** Dias entre sessões de prática para a disciplina "bater em dia". */
export function practiceCadenceOf(d: Discipline): number {
  if (d.perfilPratica === 'pratica') return 2;
  if (d.perfilPratica === 'mista') return 3;
  return 7;
}

/**
 * Dívida de prática (dias além da cadência):
 *  • nunca estudou E semestre já anda (semana ≥3) → dívida PROFUNDA (2× cadência)
 *    — semanas no curso sem nunca praticar uma matéria prática é exatamente o
 *    buraco que o motor existe para tapar;
 *  • estudou → dias desde a última sessão − cadência (≥0);
 *  • semana <3 do semestre → 0 (ninguém está em dívida no aquecimento).
 */
export function practiceDebtDays(
  d: Discipline,
  lastStudiedAt: string | undefined,
  now: Date,
): number {
  if (currentWeekOfSemester(now) < 3) return 0;
  const cadence = practiceCadenceOf(d);
  if (!lastStudiedAt) return cadence * 2;
  const last = new Date(lastStudiedAt).getTime();
  if (Number.isNaN(last)) return cadence * 2;
  const days = Math.floor((now.getTime() - last) / DAY);
  return Math.max(0, days - cadence);
}

// ---------------------------------------------------------------------------
// Avaliações da disciplina — oficiais + customizadas, com tipo e prazo
// ---------------------------------------------------------------------------

export interface DiscEval {
  name: string;
  kind: EvalKind;
  /** 'YYYY-MM-DD' oficial — OU undefined (trabalho em aberto, anti-estimativa). */
  date?: string;
  /** Dias até a avaliação (date presente e futura). */
  daysLeft?: number;
}

/** Todas as avaliações À FRENTE da disciplina (oficiais datadas + customizações). */
export function evalsFor(
  code: string,
  customEvaluations: CustomEvaluation[] | undefined,
  now: Date,
): DiscEval[] {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const official = evaluationPeriods
    .filter((e) => e.disciplineCode === code && !e.conditional)
    .map((e) => {
      // kind explícito do registro vence (dado do professor/dono); keyword é o
      // fallback — a A2 de LM (trabalho em aberto) é a moradora do campo.
      const kind: EvalKind = e.kind ?? evalKindOf(e.evaluationName, e.description);
      if (!e.date) return { name: e.evaluationName, kind } as DiscEval;
      const t = new Date(`${e.date}T00:00:00`).getTime();
      const daysLeft = Math.round((t - todayStart) / DAY);
      return { name: e.evaluationName, kind, date: e.date, daysLeft } as DiscEval;
    });

  const custom = (customEvaluations ?? [])
    .filter((c) => c.disciplineCode === code)
    .map((c) => {
      const kind = evalKindOf(c.name, c.description);
      if (!c.date) return { name: c.name, kind } as DiscEval;
      const t = new Date(`${c.date}T00:00:00`).getTime();
      const daysLeft = Math.round((t - todayStart) / DAY);
      return { name: c.name, kind, date: c.date, daysLeft } as DiscEval;
    });

  return [...official, ...custom].filter((e) => e.daysLeft === undefined || e.daysLeft >= 0);
}

// ---------------------------------------------------------------------------
// Fator de urgência por tipo — a tabela que substitui o boost único antigo
// ---------------------------------------------------------------------------

/** Multiplicador de urgência (1 = neutro). Trabalho é MARATONA, prova é PICO. */
export function urgencyFactor(eval_: DiscEval | undefined): number {
  if (!eval_) return 1;
  if (eval_.daysLeft === undefined) {
    // Em aberto: SÓ trabalho ganha cadência (projeto anunciado precisa evoluir);
    // prova/atividade sem data oficial NÃO pressionam — anti-estimativa da casa.
    return eval_.kind === 'trabalho' ? 1.4 : 1;
  }
  const d = eval_.daysLeft;
  switch (eval_.kind) {
    case 'prova':
      if (d <= 3) return 4;
      if (d <= 7) return 2.5;
      if (d <= 14) return 1.8;
      if (d <= 21) return 1.3;
      return 1;
    case 'trabalho':
      if (d <= 3) return 3;
      if (d <= 7) return 2.2;
      if (d <= 21) return 1.5; // sustentado: projeto evolui TODA semana, não na véspera
      return 1.1;
    case 'atividade':
      if (d <= 3) return 3;
      if (d <= 7) return 2.2;
      if (d <= 14) return 1.5;
      if (d <= 21) return 1.2;
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Triagem — foco / manter / em espera
// ---------------------------------------------------------------------------

export type TriageBucket = 'foco' | 'manter' | 'espera';

export interface TriageEntry {
  code: string;
  shortName: string;
  perfilPratica: Discipline['perfilPratica'];
  bucket: TriageBucket;
  /** Score bruto (maior = mais urgente) — ordem dentro do balde. */
  score: number;
  /** Motivos curtos e humanos — a casa sempre explica o porquê. */
  reasons: string[];
  /** A avaliação que pressiona (a mais urgente à frente). */
  eval?: DiscEval;
  /** Dívida de prática em dias (0 = em dia). */
  debtDays: number;
  /** Cadência-alvo do perfil (para exibir "meta: 1 prática a cada Nd"). */
  cadence: number;
}

export interface TriageInput {
  topicProgress: { [code: string]: { [topic: string]: boolean } };
  disciplineProgress?: {
    [code: string]: { studiedMinutes: number; lastStudiedAt?: string };
  };
  customEvaluations?: CustomEvaluation[];
  now: Date;
}

export interface Triage {
  foco: TriageEntry[];
  manter: TriageEntry[];
  espera: TriageEntry[];
  /** A matéria que manda agora (foco[0]) — para o dashboard falar uma frase. */
  headline?: TriageEntry;
}

/** Máximo que a cabeça segura por vez — acima disso, o resto estaciona. */
export const FOCO_MAX = 3;

/**
 * A triagem completa do curso (todas as disciplinas com tópicos pendentes).
 * Regras (gerais, valem do 1º ao 6º período):
 *   • PRECISA DE ATENÇÃO: avaliação datada ≤14d OU trabalho em aberto OU
 *     dívida de prática > cadência.
 *   • FOCO = as 3 maiores pontuações entre as que precisam (se existirem).
 *   • Se o foco encheu (3), o resto que NÃO tem pressão (sem avaliação ≤21d
 *     e em dia com a prática) ESTACIONA com motivo — "deixar para trás" vira
 *     decisão explícita, reversível e vigiada, não culpa invisível.
 *   • Sem pressão suficiente para encher o foco → ninguém estaciona (calma).
 */
export function computeTriage(input: TriageInput): Triage {
  const { topicProgress, disciplineProgress, customEvaluations, now } = input;
  const prog = disciplineProgress ?? {};
  const entries: TriageEntry[] = [];

  // CH total — mesma base do smart-schedule (proporcionalidade honesta).
  const TOTAL_CH = disciplines.reduce((acc, d) => acc + d.chTotal, 0) || 1;

  for (const d of disciplines) {
    const all = d.conteudoProgramatico.flatMap((u) => u.topicos);
    const done = topicProgress[d.code] ?? {};
    const pend = all.filter((t) => !done[t]).length;
    if (pend === 0) continue; // disciplina fechada não disputa fila

    const debt = practiceDebtDays(d, prog[d.code]?.lastStudiedAt, now);
    const cadence = practiceCadenceOf(d);
    const evals = evalsFor(d.code, customEvaluations, now);
    const pressing = evals
      .slice()
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))[0];

    const reasons: string[] = [];
    if (pressing?.daysLeft !== undefined) {
      const when =
        pressing.daysLeft === 0 ? 'hoje' : pressing.daysLeft === 1 ? 'amanhã' : `em ${pressing.daysLeft} dias`;
      reasons.push(
        `${pressing.kind === 'prova' ? 'prova' : pressing.kind} ${when}` +
          (pressing.kind === 'trabalho' ? ' — avançar projeto' : ''),
      );
    } else if (pressing && pressing.daysLeft === undefined) {
      reasons.push(
        pressing.kind === 'trabalho'
          ? 'trabalho em aberto — cadência de projeto até a data sair'
          : 'sem data oficial — aguarda o professor publicar',
      );
    }
    if (debt > 0) {
      reasons.push(
        debt >= cadence
          ? `${debt}d sem prática (meta: 1 a cada ${cadence}d)`
          : `${debt}d além da meta de prática`,
      );
    }
    if (!prog[d.code]?.lastStudiedAt && currentWeekOfSemester(now) >= 3) {
      reasons.push('nunca praticou neste semestre');
    }
    if (reasons.length === 0) reasons.push('em dia — manutenção leve');

    // Score: CH × prioridade × pendência × urgência × dívida (a mesma
    // linguagem do cronograma — um número só, razões por cima).
    const priorMult = d.prioridade === 'alta' ? 1.2 : d.prioridade === 'media' ? 1.0 : 0.85;
    const debtMult = d.perfilPratica === 'teoria' ? 1 : 1 + Math.min(0.5, debt * 0.08);
    const score =
      (d.chTotal / TOTAL_CH) * priorMult * (1 + Math.min(0.3, pend * 0.02)) *
      urgencyFactor(pressing) * debtMult;

    entries.push({
      code: d.code,
      shortName: d.shortName,
      perfilPratica: d.perfilPratica,
      bucket: 'manter',
      score,
      reasons,
      eval: pressing,
      debtDays: debt,
      cadence,
    });
  }

  entries.sort((a, b) => b.score - a.score);

  // Quem PRECISA de atenção agora (regra geral acima) — "em aberto" só é
  // pressão para TRABALHO (projeto anunciado evolui em cadência); prova e
  // atividade sem data oficial aguardam o professor (anti-estimativa).
  const needsAttention = entries.filter(
    (e) =>
      e.debtDays > e.cadence ||
      (e.eval !== undefined &&
        (e.eval.daysLeft !== undefined
          ? e.eval.daysLeft <= 14
          : e.eval.kind === 'trabalho')),
  );

  // ASSENTO GARANTIDO D-7 (régua da casa): avaliação em ≤7 dias entra no foco
  // ANTES de qualquer score — dívida de prática nunca vence a prova iminente.
  const imminent = needsAttention
    .filter((e) => e.eval?.daysLeft !== undefined && e.eval.daysLeft <= 7)
    .sort((a, b) => (a.eval?.daysLeft ?? 999) - (b.eval?.daysLeft ?? 999));
  const imminentCodes = new Set(imminent.map((e) => e.code));
  const rest = needsAttention
    .filter((e) => !imminentCodes.has(e.code))
    .sort((a, b) => b.score - a.score);

  const foco = [...imminent, ...rest].slice(0, FOCO_MAX);
  const focoCodes = new Set(foco.map((e) => e.code));
  for (const e of foco) e.bucket = 'foco';

  let espera: TriageEntry[] = [];
  if (foco.length === FOCO_MAX) {
    // Capacidade esticada: estaciona quem está SEM pressão — sem prazo ≤21d
    // e em dia com a prática. O radar continua vigiando por eles.
    espera = entries.filter(
      (e) =>
        !focoCodes.has(e.code) &&
        (e.eval === undefined ||
          (e.eval.daysLeft !== undefined && e.eval.daysLeft > 21)) &&
        e.debtDays <= e.cadence,
    );
  }

  const esperaCodes = new Set(espera.map((e) => e.code));
  const manter = entries.filter((e) => !focoCodes.has(e.code) && !esperaCodes.has(e.code));

  return { foco, manter, espera, headline: foco[0] ?? manter[0] };
}

/** Frase única da casa — o que manda hoje (para o dashboard falar 1 linha). */
export function triageHeadlinePhrase(t: Triage): string | null {
  const h = t.headline;
  if (!h) return null;
  const firstReason = h.reasons[0];
  return `${h.shortName}: ${firstReason}`;
}
