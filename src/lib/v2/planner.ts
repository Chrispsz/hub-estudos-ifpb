// PLANNER — o algoritmo do MODO RECUPERAÇÃO (Fase 2).
//
// Puro: entra com arrays do núcleo, sai com sugestões explicáveis.
// Nada de Dexie aqui — a repo (repo.ts) busca os dados e o board pinta.
//
// A doutrina do dono:
//   Ritmo  (~60% do esforço) = conteúdo ATUAL, dívida zero — nunca deixar a
//            matéria do semestre ficar para trás enquanto se cava a fundação.
//   Fundação (~40%) = o PRÓXIMO DEGRAU de cada matéria: tópico cujos pré-reqs
//            já são estáveis, ponderado por importância × defasagem ×
//            dependentes futuros. Sempre 1 frase de PORQUÊ por sugestão.
//   Deploy (prova/entrega) reorganiza o plano 3 semanas antes; véspera
//            bloqueia jogo e foca tudo na prova.
//
// Domínio (0–100) = acerto REAL ponderado por recência (0.7^idade), semeado
// honestamente pelo priorStats do legado (nunca histórico falso).
// Estável = últimas 5 com ≥80% de acerto OU FSRS alto (stability ≥ 10d).

import type {
  Attempt,
  BacklogItem,
  DeckCard,
  Exam,
  PracticeUnit,
  RoutineBlock,
  RoutineTemplate,
  Subject,
  Topic,
} from './domain';

// ---------- datas (sempre LOCAL, o dono vive em America/Sao_Paulo) ----------

export function dateKeyOf(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Segunda-feira da semana (dateKey local). */
export function mondayKeyOf(d: Date = new Date()): string {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (c.getDay() + 6) % 7; // 0 = segunda
  c.setDate(c.getDate() - dow);
  return dateKeyOf(c);
}

export function daysBetweenKeys(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.round((db - da) / 86_400_000);
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function blockIdOf(b: RoutineBlock): string {
  return `${b.start}-${b.end}`;
}

export function blockStatus(b: RoutineBlock, now: Date = new Date()): 'passado' | 'agora' | 'futuro' {
  const t = now.getHours() * 60 + now.getMinutes();
  const s = minutesOf(b.start);
  const e = minutesOf(b.end);
  if (t < s) return 'futuro';
  if (t >= e) return 'passado';
  return 'agora';
}

// ---------- domínio por tópico (acerto real, recência, sem consulta) ----------

export interface UnitStats {
  unitId: string;
  domain: number | null; // 0–100 (null = nunca tocado)
  seeded: boolean; // true = veio do priorStats do legado (estimativa honesta)
  realTries: number;
  last5Acc: number | null; // 0–1 nas últimas 5 reais
  stability: number; // FSRS
  dueAt: number | null;
}

export interface TopicStats {
  topicId: string;
  domain: number; // 0–100 (média das unidades tocadas)
  stable: boolean;
  seededOnly: boolean; // nenhum attempt real — só semente do legado
  realTries: number;
  dueCount: number;
  lastTouchedAt: number | null;
  units: UnitStats[];
}

const RECENCY = 0.7;

export function unitStatsOf(unit: PracticeUnit, attempts: Attempt[]): UnitStats {
  const mine = attempts
    .filter((a) => a.unitId === unit.id && a.result !== 'skipped')
    .sort((x, y) => y.at - x.at);
  let domain: number | null = null;
  let seeded = false;
  let last5Acc: number | null = null;
  if (mine.length > 0) {
    let num = 0;
    let den = 0;
    let i = 0;
    for (const a of mine) {
      const w = Math.pow(RECENCY, i);
      num += (a.result === 'correct' ? 1 : 0) * w;
      den += w;
      i += 1;
    }
    domain = Math.round((100 * num) / den);
    const last5 = mine.slice(0, 5);
    const corrects = last5.filter((a) => a.result === 'correct').length;
    last5Acc = corrects / last5.length;
  } else if (unit.priorStats && unit.priorStats.tried > 0) {
    domain = Math.round((100 * unit.priorStats.solved) / unit.priorStats.tried);
    seeded = true;
  }
  return {
    unitId: unit.id,
    domain,
    seeded,
    realTries: mine.length,
    last5Acc,
    stability: unit.fsrs?.stability ?? 0,
    dueAt: unit.fsrs?.due ?? null,
  };
}

export function topicStatsOf(
  topic: Topic,
  units: PracticeUnit[],
  attempts: Attempt[],
  now = Date.now(),
): TopicStats {
  const stats = units
    .filter((u) => u.topicId === topic.id)
    .map((u) => unitStatsOf(u, attempts));
  const touched = stats.filter((s) => s.domain !== null);
  let domain = 0;
  if (touched.length > 0) {
    // peso: unidades mais praticadas contam mais (mínimo 1)
    const wsum = touched.reduce((acc, s) => acc + Math.max(s.realTries, 1), 0);
    domain = Math.round(
      touched.reduce((acc, s) => acc + (s.domain ?? 0) * Math.max(s.realTries, 1), 0) / wsum,
    );
  }
  // estável: ≥80% nas últimas 5 reais OU FSRS alto (média de estabilidade ≥ 10d)
  const recent = touched.filter((s) => s.last5Acc !== null);
  const accGate = recent.some((s) => (s.last5Acc ?? 0) >= 0.8 && s.realTries >= 3);
  const fsrsGate =
    touched.length > 0 &&
    touched.every((s) => s.stability >= 10) &&
    domain >= 80;
  const dueCount = stats.filter((s) => s.dueAt !== null && s.dueAt <= now).length;
  const lastTouchedAt = attempts
    .filter((a) => units.some((u) => u.id === a.unitId && u.topicId === topic.id))
    .reduce((max, a) => Math.max(max, a.at), 0);
  return {
    topicId: topic.id,
    domain,
    stable: touched.length > 0 && (accGate || fsrsGate),
    seededOnly: recent.length === 0 && touched.length > 0,
    realTries: touched.reduce((acc, s) => acc + s.realTries, 0),
    dueCount,
    lastTouchedAt: lastTouchedAt || null,
    units: stats,
  };
}

// ---------- contexto do dia ----------

export interface PlannerCtx {
  now: number;
  dateKey: string;
  subjects: Subject[];
  topics: Topic[];
  units: PracticeUnit[];
  attempts: Attempt[];
  cards: DeckCard[];
  exams: Exam[];
  backlog: BacklogItem[];
  template: RoutineTemplate;
}

export interface ExamProximity {
  exam: Exam | null;
  daysUntil: number; // negativo = já passou
  eve: boolean; // véspera (≤ preExamLockDays)
  window: boolean; // dentro das 3 semanas
}

export function examProximityOf(ctx: PlannerCtx, lockDays = 1): ExamProximity {
  let best: Exam | null = null;
  let bestDays = Number.POSITIVE_INFINITY;
  for (const e of ctx.exams) {
    if (e.status === 'registered') continue;
    const days = daysBetweenKeys(ctx.dateKey, e.date);
    if (days >= 0 && days < bestDays) {
      bestDays = days;
      best = e;
    }
  }
  const daysUntil = Number.isFinite(bestDays) ? bestDays : -1;
  return {
    exam: best,
    daysUntil,
    eve: daysUntil >= 0 && daysUntil <= lockDays,
    window: daysUntil >= 0 && daysUntil <= 21,
  };
}

const PRIORITY_W: Record<Subject['priority'], number> = { alta: 1.2, media: 1, baixa: 0.8 };

// ---------- sugestões ----------

export type SuggestionKind = 'ritmo' | 'fundacao' | 'revisao' | 'flashcards' | 'projeto' | 'sprint';

export interface Suggestion {
  key: string;
  kind: SuggestionKind;
  subjectId?: string;
  topicId?: string;
  unitIds: string[];
  title: string;
  why: string; // A frase do porquê — 1 linha, sempre honesta
  estMin: number;
}

function subjectById(ctx: PlannerCtx, id: string): Subject | undefined {
  return ctx.subjects.find((s) => s.id === id);
}

/** Última tentativa real na matéria (dias). Infinity = nunca tocada. */
function daysSinceSubject(ctx: PlannerCtx, subjectId: string): number {
  const unitIds = new Set(ctx.units.filter((u) => u.subjectId === subjectId).map((u) => u.id));
  let last = 0;
  for (const a of ctx.attempts) {
    if (unitIds.has(a.unitId)) last = Math.max(last, a.at);
  }
  if (!last) return Number.POSITIVE_INFINITY;
  return Math.floor((ctx.now - last) / 86_400_000);
}

/** Tópicos à frente na cadeia do PPC — dependentes futuros ganham peso. */
function dependentsOf(topics: Topic[], topic: Topic): number {
  return topics.filter((t) => t.subjectId === topic.subjectId && t.order > topic.order).length;
}

function unitsOfTopic(ctx: PlannerCtx, topicId: string): PracticeUnit[] {
  return ctx.units.filter((u) => u.topicId === topicId);
}

/**
 * RITMO — conteúdo atual, dívida zero. Escolhe 2–3 tópicos de MATÉRIAS
 * DIFERENTES (interleaving), priorizando prova próxima > mais esquecida.
 */
export function pickRitmo(ctx: PlannerCtx, n = 3): Suggestion[] {
  const exam = examProximityOf(ctx);
  const scored = ctx.subjects.map((s) => {
    const stale = daysSinceSubject(ctx, s.id);
    let score = PRIORITY_W[s.priority] ?? 1;
    let whyExam = '';
    if (exam.exam && exam.exam.subjectId === s.id && exam.window) {
      score *= exam.eve ? 3 : 2;
      whyExam = exam.eve
        ? ` · véspera de ${exam.exam.name} (${exam.daysUntil}d)`
        : ` · ${exam.exam.name} em ${exam.daysUntil}d — peso dobrado`;
    }
    if (stale === Number.POSITIVE_INFINITY) {
      score *= 1.3;
      whyExam += ' · sem toque nenhum ainda';
    } else if (stale >= 7) {
      score *= 1.25;
      whyExam += ` · sem toque há ${stale}d (dívida do Ritmo)`;
    }
    return { subject: s, score, whyExam };
  });
  scored.sort((a, b) => b.score - a.score);

  const out: Suggestion[] = [];
  const usedTopics = new Set<string>();
  for (const { subject, whyExam } of scored) {
    if (out.length >= n) break;
    // Ritmo é PRÁTICA: tópicos sem unidade não entram (o Trilha mostra o porquê)
    const tStats = ctx.topics
      .filter((t) => t.subjectId === subject.id && unitsOfTopic(ctx, t.id).length > 0)
      .map((t) => topicStatsOf(t, unitsOfTopic(ctx, t.id), ctx.attempts, ctx.now))
      .filter((st) => {
        const t = ctx.topics.find((x) => x.id === st.topicId);
        return t && !usedTopics.has(t.id);
      })
      .sort((a, b) => {
        const ta = ctx.topics.find((x) => x.id === a.topicId)!;
        const tb = ctx.topics.find((x) => x.id === b.topicId)!;
        // Ritmo: o tópico "de agora" = primeiro não-estável da cadeia
        if (a.stable !== b.stable) return a.stable ? 1 : -1;
        return ta.order - tb.order;
      });
    const pick = tStats[0];
    const topic = pick ? ctx.topics.find((t) => t.id === pick.topicId) : undefined;
    if (!pick || !topic) continue;
    usedTopics.add(topic.id);
    const units = unitsOfTopic(ctx, topic.id)
      .sort((a, b) => (a.priorStats?.tried ? 1 : 0) - (b.priorStats?.tried ? 1 : 0))
      .slice(0, 3);
    const why =
      `Próximo da cadeia de ${subject.shortName}: domínio ${pick.domain}%` +
      (pick.seededOnly ? ' (semeado pelo legado — primeira rodada real)' : '') +
      whyExam;
    out.push({
      key: `ritmo:${topic.id}`,
      kind: 'ritmo',
      subjectId: subject.id,
      topicId: topic.id,
      unitIds: units.map((u) => u.id),
      title: `${subject.shortName} · ${topic.name}`,
      why,
      estMin: 30,
    });
  }
  return out;
}

/**
 * FUNDAÇÃO — o próximo degrau: primeiro tópico não-estável cujos PRÉ-REQS
 * já são estáveis. Peso = importância × dependentes futuros × defasagem.
 */
export function pickFundacao(ctx: PlannerCtx, n = 2): Suggestion[] {
  const statsByTopic = new Map<string, TopicStats>();
  for (const t of ctx.topics) {
    statsByTopic.set(t.id, topicStatsOf(t, unitsOfTopic(ctx, t.id), ctx.attempts, ctx.now));
  }
  type Candidate = Suggestion & { _score: number };
  const candidates: Candidate[] = [];
  for (const subject of ctx.subjects) {
    const chain = ctx.topics
      .filter((t) => t.subjectId === subject.id)
      .sort((a, b) => a.order - b.order);
    const next = chain.find((t) => {
      const st = statsByTopic.get(t.id);
      if (!st || st.stable) return false;
      const prereqsOk = t.prereqIds.every((pid) => statsByTopic.get(pid)?.stable);
      return prereqsOk;
    });
    if (!next) continue;
    const st = statsByTopic.get(next.id)!;
    const dependents = dependentsOf(ctx.topics, next);
    const gapDays =
      st.lastTouchedAt === null
        ? 14
        : Math.min(30, Math.floor((ctx.now - st.lastTouchedAt) / 86_400_000));
    const score =
      (PRIORITY_W[subject.priority] ?? 1) *
      (1 + dependents * 0.15) *
      (1 + gapDays / 30) *
      (1 + (100 - st.domain) / 100);
    const prereqNames = next.prereqIds
      .map((pid) => ctx.topics.find((t) => t.id === pid)?.name)
      .filter(Boolean)
      .slice(0, 1);
    const why =
      `Degrau de ${subject.shortName}: ${dependents} tópico(s) à frente dependem dele` +
      (prereqNames[0] ? ` · pré-req "${prereqNames[0]}" já estável` : ' · sem pré-req') +
      ` · domínio ${st.domain}%`;
    const units = unitsOfTopic(ctx, next.id)
      .sort((a, b) => (a.priorStats?.tried ? 1 : 0) - (b.priorStats?.tried ? 1 : 0))
      .slice(0, 2);
    candidates.push({
      key: `fundacao:${next.id}`,
      kind: 'fundacao',
      subjectId: subject.id,
      topicId: next.id,
      unitIds: units.map((u) => u.id),
      title: `${subject.shortName} · ${next.name}`,
      why,
      estMin: 25,
      _score: score,
    });
  }
  return candidates
    .sort((a, b) => b._score - a._score)
    .slice(0, n)
    .map(({ _score: _ignored, ...s }) => s);
}

/** FILA FSRS — unidades vencidas (mais atrasadas primeiro). */
export function pickRevisao(ctx: PlannerCtx, n = 10): Suggestion {
  const due = ctx.units
    .filter((u) => u.fsrs && u.fsrs.due <= ctx.now && u.topicId)
    .sort((a, b) => (a.fsrs!.due ?? 0) - (b.fsrs!.due ?? 0))
    .slice(0, n);
  const overdueDays = due.length
    ? Math.max(0, Math.floor((ctx.now - Math.min(...due.map((u) => u.fsrs!.due))) / 86_400_000))
    : 0;
  return {
    key: 'revisao:fila',
    kind: 'revisao',
    unitIds: due.map((u) => u.id),
    title: `Fila FSRS — ${due.length} unidade(s) vencida(s)`,
    why: due.length
      ? `a mais atrasada vence há ${overdueDays}d — dose mínima de fundação`
      : 'fila zerada — o esforço de hoje já virou estabilidade',
    estMin: Math.min(45, due.length * 3),
  };
}

/** Flashcards vencidos (bloco 20:30). */
export function flashcardsDue(ctx: PlannerCtx): DeckCard[] {
  return ctx.cards
    .filter((c) => c.fsrs.due <= ctx.now)
    .sort((a, b) => a.fsrs.due - b.fsrs.due);
}

/** Sugestões de um bloco de estudo do dia. */
export function suggestForBlock(block: RoutineBlock, ctx: PlannerCtx): Suggestion[] {
  switch (block.kind) {
    case 'estudo-pesado': {
      const ritmo = pickRitmo(ctx, 2);
      const fund = pickFundacao(ctx, 1);
      const seen = new Set(ritmo.map((s) => s.topicId));
      return [...ritmo, ...fund.filter((f) => !seen.has(f.topicId))];
    }
    case 'estudo-revisao': {
      const fila = pickRevisao(ctx, 8);
      const fund = pickFundacao(ctx, 1);
      return [fila, ...fund];
    }
    case 'pnaat':
      return pickRitmo(ctx, 2);
    case 'flashcards': {
      const due = flashcardsDue(ctx);
      return [
        {
          key: 'flashcards:fila',
          kind: 'flashcards',
          unitIds: [],
          title: `Flashcards do dia — ${due.length} vencido(s)`,
          why: due.length
            ? 'repetição espaçada na dose do dia — 30min, sem dívida'
            : 'fila zerada — bloco livre hoje',
          estMin: 30,
        },
      ];
    }
    case 'projeto': {
      return [
        {
          key: 'projeto:slot',
          kind: 'projeto',
          unitIds: [],
          title: 'Slot de Projeto real',
          why: 'sábado é do projeto — o slot vive na aba Quests',
          estMin: 240,
        },
      ];
    }
    case 'sprint-review':
      return [
        {
          key: 'sprint:review',
          kind: 'sprint',
          unitIds: [],
          title: 'Sprint Review da semana',
          why: 'domingo 20:30 — a semana vira relatório e o plano se reorganiza',
          estMin: 60,
        },
      ];
    default:
      return [];
  }
}

/** Status do Modo Recuperação — saída honesta: Ritmo sem dívida + Fundação alcança o semestre anterior. */
export function recoveryStatus(ctx: PlannerCtx): {
  active: boolean;
  ritmoDebt: number; // matérias sem toque ≥ 7d
  fundacaoProgress: number; // % de tópicos estáveis
  exitReady: boolean;
} {
  const stats = ctx.topics.map((t) => topicStatsOf(t, unitsOfTopic(ctx, t.id), ctx.attempts, ctx.now));
  const ritmoDebt = ctx.subjects.filter((s) => daysSinceSubject(ctx, s.id) >= 7).length;
  const stableCount = stats.filter((s) => s.stable).length;
  const fundacaoProgress = stats.length ? Math.round((100 * stableCount) / stats.length) : 0;
  const exitReady = ritmoDebt === 0 && fundacaoProgress >= 60;
  return { active: !exitReady, ritmoDebt, fundacaoProgress, exitReady };
}
