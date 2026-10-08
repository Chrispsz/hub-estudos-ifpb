// NÚCLEO "O Projeto Principal" (v2) — Fase 1 (Alicerce)
// Domínio: semestre → matéria → tópico → UNIDADE DE PRÁTICA (questão | kata | quadro).
//
// Regras do contrato:
//  - TODO id é natural/determinístico → upsert por id = migração IDEMPOTENTE
//    (rodar 2× não duplica nada).
//  - Nada é fabricado: histórico real só nasce de tentativas novas; o estado
//    antigo entra como `priorStats` (semeia FSRS/domínio, nunca vira tentativa falsa).
//  - Nada se perde: o estado legado inteiro é snapshotado antes de qualquer escrita.

export type UnitType = 'question' | 'kata' | 'board';
export type AttemptResult = 'correct' | 'wrong' | 'skipped';
export type ErrorCategory = 'conceito' | 'deslize' | 'tempo';
export type SessionKind =
  | 'pomodoro'
  | 'foco-guiado'
  | 'revisao'
  | 'conversao'
  | 'projeto'
  | 'pnaat'
  | 'quadro'
  | 'vagabond';
export type BacklogStatus = 'open' | 'converted' | 'wont';
export type ExamStatus = 'awaiting' | 'registered';
export type ExamKind = 'prova' | 'entrega';
export type DayTemplateId =
  | 'normal-weekday'
  | 'game-day'
  | 'next-after-game'
  | 'saturday'
  | 'sunday';

/** Estado de cartão FSRS serializável (espelho do Card do ts-fsrs). */
export interface FsrsState {
  stability: number;
  difficulty: number;
  due: number; // epoch ms
  lastReview: number | null;
  state: 'new' | 'learning' | 'review' | 'relearning';
  reps: number;
  lapses: number;
  learning_steps: number;
}

/** Estatísticas legadas (localStorage v2) — semeiam FSRS/domínio, não são histórico. */
export interface PriorStats {
  tried: number;
  solved: number;
  lapses: number;
  marked: boolean;
  lastPracticedAt: string | null;
}

// ---------- Matéria / Tópico ----------

export interface Subject {
  id: string; // código IFPB (ex.: 'TEC.1984')
  name: string;
  shortName: string;
  chTotal: number;
  chWeekly: number;
  professor: string;
  category: 'exata' | 'tecnica' | 'humanas' | 'linguagens';
  color: string;
  priority: 'alta' | 'media' | 'baixa';
}

export interface Topic {
  id: string; // `${subjectId}::${slug}` — determinístico
  subjectId: string;
  name: string; // rótulo da unidade do PPC (ex.: 'Unidade 2: Desvios condicionais')
  subtopics: string[];
  prereqIds: string[]; // grafo de pré-requisitos (semente: cadeia linear do PPC)
  order: number;
}

// ---------- Unidade de prática ----------

export interface PracticeUnit {
  id: string; // `unit:${exerciseId}` — determinístico
  subjectId: string;
  topicId: string | null;
  type: UnitType;
  prompt: string; // enunciado
  answer?: string; // resposta/solução (quando existir)
  hint?: string;
  difficulty: 1 | 2 | 3;
  source: string; // 'prova_real' | 'lista_algoritmos' | 'gerado_topico' | 'manual' | ...
  linkedMaterials: string[];
  /** Estado antigo vindo do legado — semeia FSRS/domínio. Nunca vira tentativa falsa. */
  priorStats?: PriorStats;
  fsrs?: FsrsState;
  createdAt: number;
}

/** Tentativa real — a ÚNICA fonte de histórico/XP/acerto sem consulta. */
export interface Attempt {
  id: string; // cuid
  unitId: string;
  at: number; // epoch ms
  result: AttemptResult;
  /** Acerto SEM consulta — a ciência da casa. */
  noLookup: boolean;
  sessionId?: string;
  /** Obrigatório quando result === 'wrong': 1 frase do porquê + categoria. */
  error?: { reason: string; category: ErrorCategory };
}

// ---------- Cartões (flashcards) ----------

export interface DeckCard {
  id: string; // `card:${id legado}` ou `card:hash(front|back)`
  subjectId: string;
  front: string;
  back: string;
  source: 'manual' | 'ia';
  fromMistake?: string;
  /** Estatísticas legadas do Leitner (caixa 0–5). */
  priorStats?: { box: number; reviews: number; lapses: number };
  fsrs: FsrsState;
  createdAt: number;
}

// ---------- Backlog (material cru aguardando conversão) ----------

export interface BacklogItem {
  id: string; // `bk:${materialId}` — determinístico
  subjectId: string;
  title: string;
  kind: string; // tipo do material legado (slides, lista_exercicios, video...)
  sourceRef: {
    materialId?: string;
    pdfPath?: string;
    externalUrl?: string;
    summaryFile?: string;
  };
  suggestedType: UnitType;
  status: BacklogStatus;
  convertedUnitIds: string[];
  createdAt: number;
}

// ---------- Prova (deploy) ----------

export interface Exam {
  id: string; // `exam:${subjectId}:${slug(name)}`
  subjectId: string;
  name: string;
  kind: ExamKind;
  date: string; // 'YYYY-MM-DD'
  weight?: number; // %
  scope?: string;
  status: ExamStatus;
  score?: number;
  max?: number;
  registeredAt?: number;
}

// ---------- Sessão (commit de estudo) ----------

export interface StudySession {
  id: string; // determinístico para dados migrados
  kind: SessionKind;
  startedAt: number;
  endedAt: number;
  dateKey: string; // 'yyyy-mm-dd' local
  disciplineId: string;
  materialId?: string;
  focusMinutes: number;
  /** XP só com guard-rail: sessão ≥ 15 min. Calculado na escrita. */
  xpAwarded: number;
}

// ---------- Rotina (grade semanal fixa — o app nunca viola) ----------

export type RoutineBlockKind =
  | 'estudo-pesado'
  | 'estudo-revisao'
  | 'pnaat'
  | 'flashcards'
  | 'descanso-protegido'
  | 'refeicao'
  | 'pessoal'
  | 'livre'
  | 'jogo'
  | 'projeto'
  | 'sprint-review'
  | 'soneca'
  | 'ocupado';

export interface RoutineBlock {
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  label: string;
  kind: RoutineBlockKind;
  /** Bloco intocável (descanso protegido, PNAAT). O agendamento nunca invade. */
  protected?: boolean;
}

export interface RoutineTemplate {
  id: DayTemplateId;
  label: string;
  blocks: RoutineBlock[];
}

export interface RoutineConfig {
  id: 'default';
  /** Templates de tipo de dia (normal / jogo / pós-jogo / sábado / domingo). */
  templates: RoutineTemplate[];
  /** dia da semana (0=dom) → template padrão */
  weekMap: Record<number, DayTemplateId>;
  gameDaysMaxPerWeek: number; // máx 3×/semana
  preExamLockDays: number; // véspera de prova bloqueia jogo
  updatedAt: number;
}

// ---------- Quests (issues) ----------

export interface Quest {
  id: string;
  title: string;
  kind: 'daily' | 'weekly' | 'once';
  status: 'open' | 'done' | 'missed';
  dueDate?: string;
  xp: number;
  createdAt: number;
  doneAt?: number;
}

// ---------- Metadados e legado ----------

export interface MetaEntry {
  key: string; // ex.: 'migration:lastRunAt'
  value: string;
}

export interface LegacySnapshot {
  id: 'legacy:latest';
  capturedAt: number;
  keys: string[]; // chaves capturadas
  bytes: number; // tamanho total
  raw: Record<string, string>; // chave → valor bruto (zero perda)
}

/** Nome canônico das tabelas (backup/import usam). */
export const V2_TABLES = [
  'subjects',
  'topics',
  'units',
  'cards',
  'backlog',
  'exams',
  'attempts',
  'sessions',
  'routine',
  'quests',
  'meta',
  'legacySnapshots',
] as const;

export type V2TableName = (typeof V2_TABLES)[number];

/** Slug determinístico (ids naturais). */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}
