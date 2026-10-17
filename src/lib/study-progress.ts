'use client';

import * as React from 'react';
import { useLocalStorage } from './use-local-storage';
import type { AttemptMode } from './simulado-resume';
import { materials } from '@/data/course-data';
import { examPressureFor } from './exam-radar';
import { exercises } from './exercise-extractor';

const STORAGE_KEY = 'hub-estudos-ifpb:v2';

/**
 * Chave pública do progresso para LEITURAS SÓ-LEITURA (ex.: Folha de Revisão
 * lendo simuladoRuns para imprimir o foco do simulado). NUNCA escreva nesta
 * chave fora do useStudyProgress — o objeto inteiro (runs, flashcards, notas,
 * caderno) vive aqui, e um write parcial destruiria o resto.
 */
export const STUDY_PROGRESS_KEY = STORAGE_KEY;

// ---------- Tipos ----------
export interface RecentMaterial {
  id: string;
  accessedAt: string; // ISO
}

export interface MaterialProgress {
  lastPage?: number;
  studiedMinutes?: number;
  completed?: boolean;
  lastAccessedAt?: string; // ISO
}

export interface DisciplineProgress {
  studiedMinutes: number;
  materialsCompleted: number;
  lastStudiedAt?: string;
}

export interface PomodoroSession {
  date: string; // yyyy-mm-dd
  startedAt: string;
  completedAt: string;
  disciplineId: string;
  materialId?: string;
  focusMinutes: number;
  mode: 'estudo' | 'revisao';
}

export interface PomodoroState {
  /** Estado vivo do timer — sobrevive a troca de aba e reload. */
  disciplineCode: string;
  materialId?: string;
  phase: 'focus' | 'shortBreak' | 'longBreak';
  cycleCount: number; // focos completados no ciclo atual
  secondsLeft: number;
  running: boolean;
  /** Epoch (ms) do fim da fase em execução — o relógio REAL. Com ele o timer
   *  continua correto em outra aba, no reload e na retomada automática. */
  endsAt?: number;
  runningSince?: string; // ISO — quando o tick atual começou
  updatedAt: string;     // ISO
  lastSessionSummary?: {
    focusMinutes: number;
    topicsDone: number;
    topicsTotal: number;
    nextPhase: 'shortBreak' | 'longBreak' | 'focus';
    completedAt: string; // ISO
  };
}

export interface CustomStudyBlock {
  id: string;
  day: number;
  startHour: number;
  startMinute: number;
  durationMin: number;
  disciplineCode: string;
  activity: string;
  title: string;
  createdAt: string;
}

export interface GradeNotes {
  [disciplineCode: string]: {
    [componentName: string]: number;
  };
}

export interface AutoavaliacaoChecks {
  [materialId: string]: {
    [questionIndex: number]: boolean;
  };
}

/**
 * A forma do config do pomodoro (Task 30 — extraída para a fonte da verdade;
 * o motor declara a mesma forma — estruturalmente idênticas, zero conflito).
 */
export type PomodoroConfig = {
  focus: number;
  shortBreak: number;
  longBreak: number;
  cyclesBeforeLong: number;
};

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  pomodoroConfig: PomodoroConfig;
  dailyGoal: number;
  silentMode: boolean;
  /** Notificação nativa do SO ao concluir fase do Pomodoro. */
  notifyPhaseEnd: boolean;
  /** Mostra o tempo restante no título da aba (ex.: "24:31 • Foco"). */
  tabTitleTimer: boolean;
  /** Pomodoro continua correndo quando a aba vai para segundo plano
   *  (relógio baseado em timestamp — sem drift, mesmo com a guia oculta).
   *  Padrão LIGADO: o dono pesquisa fora do Hub e o foco segue contando. */
  backgroundTimer: boolean;
  /**
   * Memória do encaixe da sessão (Task 30 — a Sessão Sintonizada): o config
   * do pomodoro ORIGINAL do dia, guardado quando o sync da sessão reescreve
   * o foco. `undefined` = nada a restaurar. O 1º sync do dia preserva o
   * config de ontem; o botão Restaurar devolve exatamente o que era.
   */
  autoFit?: { dateKey: string; saved: PomodoroConfig };
  /**
   * REVISÃO SOB COMANDO (Task 27 — pedido do dono: "poder ativar se quer
   * estudar/revisar assuntos antigos ou não — fica um cronograma mais
   * direcionado ao que o usuário quer"). `undefined`/true = o ciclo espaçado
   * 1·3·7·14·30 segue vivo na fila; `false` = a fila só tem conteúdo novo,
   * prática e prova — os slots da revisão caem para atrasados/próximos.
   */
  includeReviews?: boolean;
}

// ---------- Preferências do cronograma (v2.0) ----------
export interface DayAvailability {
  enabled: boolean;
  startHour: number;
  durationMin: number;
}

export interface StudyPreferences {
  days: { [day: number]: DayAvailability };
  maxBlocksPerDay: number;
  maxMinutesPerDay: number;
  autoReschedule: boolean;
  /** Usuário fixa disciplina num dia: { 1: 'TEC.1984' } = "Seg é Matemática" */
  fixedDisciplines: { [day: number]: string };
  /** Modo de rotação do cronograma inteligente */
  rotationMode: 'proportional' | 'fixed' | 'random';
}

export interface TopicProgress {
  [disciplineCode: string]: {
    [topicName: string]: boolean;
  };
}

export interface ExerciseProgressEntry {
  tried: boolean;
  solved: boolean;
  neededHelp: boolean;
  /** Questão marcada pelo aluno (⭐) — ex.: para revisar com o tutor ou antes da prova. */
  marked?: boolean;
  lastPracticedAt: string;
  /**
   * "Erros de sempre": quantas vezes o item VOLTOU ao Caderno de Erros depois
   * de já ter sido resolvido (ou já ter histórico de prática). 0/undefined =
   * erro de primeira viagem; ≥1 = recorrente — prioridade máxima na véspera.
   */
  lapses?: number;
}

export interface ExerciseProgress {
  [exerciseId: string]: ExerciseProgressEntry;
}

// ---------- Flashcards (revisão espaçada) ----------

/** Caixa Leitner: 0 = nova/errada … 5 = dominada. Intervalos em dias abaixo. */
export type FlashcardGrade = 'again' | 'hard' | 'good' | 'easy';

export interface Flashcard {
  id: string;
  disciplineCode: string;
  front: string;
  back: string;
  /** Origem: manual (usuário) ou ia (gerado pelo tutor). */
  source: 'manual' | 'ia';
  createdAt: string; // ISO
  box: number; // 0..5
  dueAt: string; // ISO — quando revisar de novo
  reviews: number;
  lapses: number;
  lastReviewedAt?: string; // ISO
  /**
   * A origem no caderno (134) — a chave do erro que semeou este cartão
   * (ex: 'ex:mat-ex01'). Campo OPCIONAL: cartões antigos não o têm (storage
   * tolerante, zero migração) e cartões manuais comuns nunca o têm. Uso:
   * dedupe honesto da semente — um erro já virou cartão não volta ao seletor
   * (criar o mesmo erro duas vezes seria spam no baralho, não revisão).
   */
  fromMistake?: string;
}

/** Intervalo (dias) por caixa — índice = box. Box 0 usa minutos (5 min). */
export const FLASHCARD_BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;

/**
 * A FORMA CANÔNICA de um cartão novo (135 — a criação mora na lib que
 * publica o tipo): antes era um helper privado do flashcards-view e a 134
 * precisou dele de novo no caderno — duas derivações do MESMO shape é a
 * receita do drift (a gramática da casa: zero segunda derivação). Caixa 0 +
 * dueAt = agora: o cartão novo entra disponível imediatamente para revisão.
 */
export function newCardFields(
  disciplineCode: string,
  front: string,
  back: string,
  source: 'manual' | 'ia',
): Omit<Flashcard, 'id'> {
  const nowIso = new Date().toISOString();
  return {
    disciplineCode,
    front,
    back,
    source,
    createdAt: nowIso,
    box: 0,
    dueAt: nowIso, // nova → disponível imediatamente para revisão
    reviews: 0,
    lapses: 0,
  };
}

/**
 * SELETOR PURO do Leitner — cartões vencidos (inclui novas — dueAt =
 * createdAt), mais atrasados primeiro. O relógio chega por PARÂMETRO
 * (lição 113/115: quem pede "agora" passa o agora): a derivação existe
 * UMA vez e as superfícies vivas (flashcards 30s, dashboard 60s) passam
 * o tick — o memo do hook mantém o comportamento cacheado para quem não
 * tem batida própria, sem segunda derivação no app.
 */
export function flashcardsDueFor(cards: Flashcard[], nowMs: number): Flashcard[] {
  return cards
    .filter((c) => new Date(c.dueAt).getTime() <= nowMs)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

/** SELETOR PURO do placar do baralho — mesma forma do flashcardStats do hook. */
export function flashcardStatsFor(cards: Flashcard[], nowMs: number) {
  const due = flashcardsDueFor(cards, nowMs);
  return {
    total: cards.length,
    due: due.length,
    learning: cards.filter((c) => c.box <= 1).length,
    mastered: cards.filter((c) => c.box >= 4).length,
    reviewsDone: cards.reduce((acc, c) => acc + c.reviews, 0),
    nextDueMs: cards.length
      ? Math.min(...cards.map((c) => new Date(c.dueAt).getTime())) - nowMs
      : null,
  };
}

/** Label curta do intervalo que a nota aplicaria (hint dos botões de revisão). */
export function flashcardNextIntervalLabel(box: number, grade: FlashcardGrade): string {
  const nextBox = flashcardNextBox(box, grade);
  if (nextBox === 0) return grade === 'hard' ? '10min' : '5min';
  const d = FLASHCARD_BOX_DAYS[nextBox];
  return d === 1 ? '1 dia' : `${d} dias`;
}

export function flashcardNextBox(box: number, grade: FlashcardGrade): number {
  if (grade === 'again') return 0;
  const step = grade === 'easy' ? 2 : grade === 'good' ? 1 : 0;
  return Math.min(5, box + step);
}

/** Rótulo amigável da caixa atual do cartão. */
export function flashcardBoxLabel(box: number): string {
  if (box <= 0) return 'Nova';
  if (box <= 1) return 'Aprendendo';
  if (box <= 3) return 'Revisando';
  return 'Dominada';
}

/**
 * Duração da sessão de revisão em m:ss (h:mm:ss acima de 1h) — mesmo
 * formato mm:ss que o simulado e o método já usam nas superfícies da casa.
 * Negativo (relógio do cliente voltou) devolve 0:00, nunca tempo negativo.
 */
export function formatFlashcardSessionDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * A AGENDA DA VOLTA (150) — a linha do debrief que diz para QUANDO cada
 * cartão revisado voltou ao baralho ("2 cartões já disponíveis · 3 amanhã ·
 * 1 em 7 dias"). Lê os dueAt REAIS pós-nota (a verdade do localStorage,
 * não a intenção da nota) e agrupa em segmentos ordenados pelo relógio.
 * Pura: relógio por parâmetro (lição 113/115). Null quando nada a dizer.
 */
export function flashcardReturnSummary(cards: Flashcard[], nowMs: number): string | null {
  if (cards.length === 0) return null;
  const buckets = new Map<string, { n: number; ms: number }>();
  for (const c of cards) {
    const due = new Date(c.dueAt).getTime();
    if (Number.isNaN(due)) continue;
    const diff = due - nowMs;
    // Os intervalos de revisão são dias EXATOS (0,1,3,7,14,30) e a leitura
    // no debrief acontece segundos depois da nota — tolerância de 5min
    // devolve o dia que a nota prometeu ("amanhã", não "em 23h").
    const day = Math.round(diff / 86_400_000);
    const dayDrift = Math.abs(diff - day * 86_400_000);
    let key: string;
    if (diff <= 0) key = 'já disponíveis';
    else if (day >= 1 && dayDrift <= 300_000) key = day === 1 ? 'amanhã' : `em ${day} dias`;
    else if (diff < 3_600_000) key = `em ${Math.max(1, Math.ceil(diff / 60_000))}min`;
    else key = `em ${Math.floor(diff / 3_600_000)}h`;
    const cur = buckets.get(key) ?? { n: 0, ms: diff };
    buckets.set(key, { n: cur.n + 1, ms: cur.ms });
  }
  const segs = [...buckets.entries()]
    .sort((a, b) => a[1].ms - b[1].ms)
    .map(([label, { n }]) => {
      const noun = `${n} ${n === 1 ? 'cartão' : 'cartões'}`;
      // Concordância do adjetivo no bucket vencido ("1 cartão já disponível",
      // "2 cartões já disponíveis") — os demais rótulos são advérbios de
      // tempo e não flexionam.
      if (label === 'já disponíveis')
        return `${noun} ${n === 1 ? 'já disponível' : 'já disponíveis'}`;
      return `${noun} ${label}`;
    });
  return segs.length > 0 ? segs.join(' · ') : null;
}

export interface RealGradeEntry {
  grade: number;
  doneAt: string;
  notes?: string;
}

export interface RealGrades {
  [evaluationKey: string]: RealGradeEntry;
}

export interface CustomEvaluation {
  id: string;
  disciplineCode: string;
  name: string;
  description: string;
  date: string; // ISO date
  weight: number;
  scale: 10 | 100;
}

/** Detalhe por questão de uma tentativa — permite debriefing IA de corridas antigas. */
export interface RunQuestionDetail {
  status: 'solved' | 'missed' | 'skipped';
  disciplineCode?: string;
  topic?: string;
  difficulty?: string;
  /** Enunciado truncado no momento da gravação (economia de localStorage). */
  statement?: string;
  /**
   * Segundos que a questão ficou na tela (t192 — "onde o tempo foi").
   * Opcional: corridas antigas não têm o campo e a IA lê sem ele;
   * pulada com tempo alto é a confissão de pacing mais valiosa
   * (a questão que travou e não virou resposta).
   */
  timeSec?: number;
}

export interface SimuladoRun {
  id: string;
  date: string; // ISO
  /** Natureza da tentativa (opcional p/ compat com runs antigos) — histórico e IA honestos. */
  mode?: AttemptMode;
  total: number;
  solved: number;
  missed: number;
  skipped: number;
  durationSec: number;
  filters?: { discipline?: string; difficulty?: string; durationMin?: number };
  /** Presente em tentativas novas; antigas têm só os agregados acima. */
  questions?: RunQuestionDetail[];
  /**
   * O relógio encerrou a prova (chegou a 00:00 — t192). Diferente de
   * "Encerrar" (escolha do aluno): o pacing da prova real depende de saber
   * que o tempo ACABOU, não que o aluno desistiu. Ausente = terminou antes.
   */
  endedByClock?: boolean;
}

// ---------- Protocolo HUB (sessão guiada + Kaizen) ----------

/** Registro de uma sessão guiada completa do Protocolo HUB. */
export interface FocusSessionLog {
  id: string;
  date: string; // yyyy-mm-dd
  startedAt: string; // ISO
  endedAt: string; // ISO
  disciplineCode: string;
  topic: string;
  focusMinutes: number;
  pretestQuestions: number;
  flashcardsReviewed: number;
  flashcardsCorrect: number;
  /** Nota 0-100 dada pelo tutor IA na técnica Feynman. */
  feynmanScore?: number;
  kaizenNote?: string;
}

/** Registro Kaizen (método japonês): 1 melhoria de 1% por sessão/dia. */
export interface KaizenEntry {
  id: string;
  date: string; // yyyy-mm-dd
  createdAt: string; // ISO
  text: string;
  disciplineCode?: string;
}

/**
 * Horas disponíveis do dia (check-in do dono, 10/10/2026 — "todo dia que logar
 * ele pode me perguntar quantas horas tenho"). Chave = yyyy-mm-dd LOCAL;
 * valor = horas decimais lançadas (1.5 = 1h30). Editável a qualquer momento;
 * o retrato reconcilia com o foco REAL (pomodoroSessions) — o plano não
 * mente nem quando a intenção e o relógio divergem.
 */
export interface DailyHours {
  [dateKey: string]: number;
}

// ---------- Checklist por material (frente 13 — pedido direto do dono:
// "adiciona check list nos PDF pra marcar como concluído") ----------

/** Um passo da checklist do material (ex.: "Ler páginas 1–10"). */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MaterialChecklist {
  items: ChecklistItem[];
}

// ---------- Revisão espaçada de MATERIAIS (frente 13 — "revisar os antigos
// com prática e técnica de memorização de dias") ----------

/**
 * Intervalos (dias) entre as voltas de revisão de um material — a mesma
 * doutrina Leitner dos flashcards aplicada ao acervo: 1 · 3 · 7 · 14 · 30.
 * O ciclo NASCE quando o material é concluído (markCompleted semeia a 1ª
 * volta para amanhã) e avança a cada revisão cumprida — o antigo nunca
 * apodrece: o sistema o traz de volta sozinho.
 */
export const MATERIAL_REVIEW_DAYS = [1, 3, 7, 14, 30] as const;

export interface MaterialReviewState {
  /** Índice do intervalo EM ESPERA em MATERIAL_REVIEW_DAYS (0 = a 1ª volta). */
  stage: number;
  /** Quando o ciclo nasceu (1ª conclusão do material). */
  startedAt: string; // ISO
  /** Última volta cumprida. */
  lastReviewedAt?: string; // ISO
  /** Quando a próxima revisão vence. */
  dueAt: string; // ISO
  /**
   * A volta foi ANTECIPADA pela prova (Task 220 — a natural cairia depois da
   * avaliação oficial da disciplina e foi puxada para D-2)? O porquê do plano
   * confessa ("antecipada pela prova") e some sozinho quando a volta cumpre.
   */
  pulledForExam?: boolean;
}

/**
 * A VOLTA QUE CHEGA ANTES DA PROVA (Task 220, pergunta do dono: "as técnicas
 * de memorização com o tempo estão aplicadas e adaptadas ao curso onde as
 * avaliações acontecem mais cedo?").
 *
 * O ciclo 1·3·7·14·30 é a cadência da memória; a prova NÃO espera o ciclo.
 * Quem concluir um material com prova próxima corre o risco de a volta
 * natural nascer DEPOIS do teste — o conteúdo revisado uma vez e nunca mais
 * antes de ser cobrado. A compressão manda a prova:
 *   · a volta natural cai ANTES da avaliação  → segue o degrau (nada muda);
 *   · a volta natural cairia DEPOIS (ou no dia) da avaliação → a revisão é
 *     antecipada para D-2 (clamp em hoje): a última volta calma antes de ser
 *     avaliado — D-1/D-0 são da véspera, não da primeira revisão.
 * No ciclo seguinte o degrau volta a valer sozinho (a compressão é por
 * agendamento, nunca um estado preso). Pura: relógio por parâmetro
 * (lição 113/115) — `nextEvalDaysLeft` vem de examPressureFor (data oficial,
 * doutrina anti-estimativa; null = sem prova à frente, ciclo integral).
 */
export function scheduleReviewDue(
  nowMs: number,
  stage: number,
  nextEvalDaysLeft: number | null,
): { dueAt: string; pulledForExam: boolean; intervalDays: number } {
  const intervalDays =
    MATERIAL_REVIEW_DAYS[Math.min(stage, MATERIAL_REVIEW_DAYS.length - 1)];
  const natural = nowMs + intervalDays * 86_400_000;
  if (nextEvalDaysLeft === null) {
    return { dueAt: new Date(natural).toISOString(), pulledForExam: false, intervalDays };
  }
  const examStartMs = nowMs + nextEvalDaysLeft * 86_400_000;
  // A prova chega depois da volta natural — o ciclo cuida, ninguém antecipa.
  if (natural < examStartMs) {
    return { dueAt: new Date(natural).toISOString(), pulledForExam: false, intervalDays };
  }
  // A prova venceria a volta: puxa para D-2 (nunca antes de hoje).
  const target = nowMs + Math.max(0, nextEvalDaysLeft - 2) * 86_400_000;
  const due = Math.min(natural, Math.max(nowMs, target));
  return { dueAt: new Date(due).toISOString(), pulledForExam: true, intervalDays };
}

// ---------- Lembrete PNAAT (plataforma externa — pedido do dono:
// "quero só ser lembrado de estudar mesmo já que vai ser em outra plataforma") ----------

/**
 * O PNAAT (Programa Nacional de Aprendizado Acelerado em Tecnologia) NÃO é
 * disciplina nem material do acervo: as trilhas vivem na plataforma FIT
 * (fit-tecnologia.org.br) e rendem bolsa (Intensivo Maker R$1.800/mês,
 * Residência em empresas até R$3.600). O hub não tenta reproduzir o curso —
 * só o COMPROMISSO: lembrar nos dias combinados e registrar que o dia cumpriu.
 */
export interface PnaatReminderState {
  /** ISO da última sessão marcada como "estudei hoje". */
  lastSessionAt?: string;
  /** Dias da semana que lembram (0=Dom..6=Sáb). Padrão: Ter e Qui. */
  days: number[];
}

/** Fallback do lembrete: Terça e Quinta — 2 toques por semana, sem sufoco. */
export const PNAAT_DEFAULT_DAYS = [2, 4] as const;

export interface StudyProgress {
  /** Caderno de Erros: chave do item → ISO em que foi marcado como revisado. */
  notebookRevised?: { [key: string]: string };
  recentMaterials: RecentMaterial[];
  completedMaterials: string[];
  materialProgress: { [materialId: string]: MaterialProgress };
  disciplineProgress: { [disciplineCode: string]: DisciplineProgress };
  pomodoroSessions: PomodoroSession[];
  pomodoroState: PomodoroState | null;
  studyBlocks: CustomStudyBlock[];
  scheduleBlocksDone: string[];
  gradeNotes: GradeNotes;
  autoavaliacaoChecks: AutoavaliacaoChecks;
  preferences: Preferences;
  studyPreferences: StudyPreferences;
  topicProgress: TopicProgress;
  exerciseProgress: ExerciseProgress;
  realGrades: RealGrades;
  customEvaluations: CustomEvaluation[];
  flashcards: Flashcard[];
  simuladoRuns: SimuladoRun[];
  focusSessions: FocusSessionLog[];
  kaizenEntries: KaizenEntry[];
  /** Horas disponíveis lançadas por dia (check-in diário, editável). */
  dailyHours?: DailyHours;
  /**
   * O LOG dos check-ins do dia (sessões partidas — dono 17/10/2026: "eu vou
   * iniciar e coloquei 2h e está de manhã, eu estudo as duas horas e finalizo
   * e fica tudo que fiz salvo; depois no mesmo dia a noite coloco 3 horas").
   * Cada lance fica registrado com hora — o dia conta a história real:
   * "2h de manhã · 3h à noite" — e a casa nunca perde a manhã quando a noite
   * chega com mais tempo.
   */
  dailyCheckins?: { [dateKey: string]: DailyCheckin[] };
  /**
   * O FOCO DO DIA (dono 17/10/2026: "possibilidade de escolher focar em
   * alguma matéria no dia"): disciplina escolhida por dateKey — a fila do
   * dia concentra nela (a véspera de prova ≤3d continua na frente) e o
   * porquê confessa o foco. Sem registro para o dia = fila normal.
   */
  dailyFocusDiscipline?: { [dateKey: string]: string };
  /**
   * O 1º passo de amanhã, gravado NO FECHO da sessão (banco de ideias #6).
   * `setOn` é o dateKey do dia em que foi gravado — a casa o mostra no dia
   * SEGUINTE ("você escolheu começar por...") e o consome no clique: o passo
   * vira ação, não adorno. Stale (setOn ≠ ontem) simplesmente não aparece.
   */
  tomorrowStep?: TomorrowStep;
  /** Checklist de passos por material (frente 13). */
  materialChecklists: { [materialId: string]: MaterialChecklist };
  /** Ciclo de revisão espaçada por material (frente 13). */
  materialReviews: { [materialId: string]: MaterialReviewState };
  /** Lembrete de estudo do PNAAT (plataforma FIT — externo ao acervo). */
  pnaatReminder: PnaatReminderState;
}

/** O 1º passo de amanhã — a promessa que o fecho grava e a casa cobra. */
export interface TomorrowStep {
  /** dateKey do dia em que o passo foi gravado (a sessão que o escolheu). */
  setOn: string;
  /** Material da fila (quando o passo aponta para um PDF/lista do acervo). */
  materialId?: string;
  /** O passo em texto — título do material ou frase livre do dono. */
  text: string;
}

/** Um lance de horas no check-in — sessões partidas contam a história do dia. */
export interface DailyCheckin {
  /** Epoch ms do lance — o registro do horário real. */
  at: number;
  /** Horas adicionadas neste lance (1.5 = 1h30). */
  hours: number;
}

const defaultDayAvailability: StudyPreferences['days'] = {
  0: { enabled: false, startHour: 9, durationMin: 0 },   // Dom: descanso
  1: { enabled: true, startHour: 19, durationMin: 180 }, // Seg
  2: { enabled: true, startHour: 19, durationMin: 180 }, // Ter
  3: { enabled: true, startHour: 19, durationMin: 180 }, // Qua
  4: { enabled: true, startHour: 19, durationMin: 180 }, // Qui
  5: { enabled: true, startHour: 19, durationMin: 180 }, // Sex
  6: { enabled: true, startHour: 9, durationMin: 240 },  // Sáb
};

export const defaultProgress: StudyProgress = {
  recentMaterials: [],
  completedMaterials: [],
  materialProgress: {},
  disciplineProgress: {},
  pomodoroSessions: [],
  pomodoroState: null,
  simuladoRuns: [],
  studyBlocks: [],
  scheduleBlocksDone: [],
  gradeNotes: {},
  autoavaliacaoChecks: {},
  preferences: {
    theme: 'system',
    pomodoroConfig: {
      focus: 25,
      shortBreak: 5,
      longBreak: 15,
      cyclesBeforeLong: 4,
    },
    dailyGoal: 4,
    silentMode: false,
    notifyPhaseEnd: false,
    tabTitleTimer: true,
    backgroundTimer: true,
  },
  studyPreferences: {
    days: defaultDayAvailability,
    maxBlocksPerDay: 4,
    maxMinutesPerDay: 180,
    autoReschedule: true,
    fixedDisciplines: {},
    rotationMode: 'proportional',
  },
  topicProgress: {},
  exerciseProgress: {},
  realGrades: {},
  customEvaluations: [],
  flashcards: [],
  focusSessions: [],
  kaizenEntries: [],
  notebookRevised: {},
  dailyHours: {},
  dailyCheckins: {},
  dailyFocusDiscipline: {},
  materialChecklists: {},
  materialReviews: {},
  pnaatReminder: { days: [...PNAAT_DEFAULT_DAYS] },
};

/**
 * Mescla um progresso importado/parcial com os defaults — tolerante a versões antigas.
 */
export function mergeWithDefaults(partial: Partial<StudyProgress> | null | unknown): StudyProgress {
  const p = (partial ?? {}) as Partial<StudyProgress>;
  return {
    ...defaultProgress,
    ...p,
    preferences: {
      ...defaultProgress.preferences,
      ...(p.preferences ?? {}),
      pomodoroConfig: {
        ...defaultProgress.preferences.pomodoroConfig,
        ...(p.preferences?.pomodoroConfig ?? {}),
      },
    },
    studyPreferences: {
      ...defaultProgress.studyPreferences,
      ...(p.studyPreferences ?? {}),
      days: { ...defaultProgress.studyPreferences.days, ...(p.studyPreferences?.days ?? {}) },
      fixedDisciplines: p.studyPreferences?.fixedDisciplines ?? {},
      rotationMode: p.studyPreferences?.rotationMode ?? 'proportional',
    },
    pomodoroState: p.pomodoroState ?? null,
    flashcards: Array.isArray(p.flashcards) ? p.flashcards : [],
    focusSessions: Array.isArray(p.focusSessions) ? p.focusSessions : [],
    kaizenEntries: Array.isArray(p.kaizenEntries) ? p.kaizenEntries : [],
    dailyHours: p.dailyHours ?? {},
    dailyCheckins: p.dailyCheckins ?? {},
    dailyFocusDiscipline: p.dailyFocusDiscipline ?? {},
    materialChecklists: p.materialChecklists ?? {},
    materialReviews: p.materialReviews ?? {},
    pnaatReminder: {
      ...defaultProgress.pnaatReminder,
      ...(p.pnaatReminder ?? {}),
      days: Array.isArray(p.pnaatReminder?.days)
        ? p.pnaatReminder.days
        : [...PNAAT_DEFAULT_DAYS],
    },
  };
}

/**
 * Exporta o progresso completo como string JSON (para download do usuário).
 */
export function exportProgressJSON(progress: StudyProgress): string {
  return JSON.stringify(
    {
      app: 'hub-estudos-ifpb',
      version: 2,
      exportedAt: new Date().toISOString(),
      progress,
    },
    null,
    2,
  );
}

/**
 * Importa progresso de JSON exportado (valida o mínimo e faz merge com defaults).
 * Retorna null se o arquivo não for válido.
 */
export function importProgressJSON(raw: string): StudyProgress | null {
  try {
    const parsed = JSON.parse(raw) as {
      app?: string;
      version?: number;
      progress?: Partial<StudyProgress>;
    };
    const candidate = parsed?.progress ?? parsed;
    if (!candidate || typeof candidate !== 'object') return null;
    if (!('topicProgress' in candidate) && !('completedMaterials' in candidate) && !('pomodoroSessions' in candidate)) {
      return null; // não parece um backup deste app
    }
    return mergeWithDefaults(candidate);
  } catch {
    return null;
  }
}

export type StudyProgressUpdate = (prev: StudyProgress) => StudyProgress;

/**
 * Hook central que gerencia TODO o progresso do usuário no localStorage.
 * Persistido na chave `hub-estudos-ifpb:v2` (compatível com dados antigos — merge automático).
 */
export function useStudyProgress() {
  const [progress, setProgress] = useLocalStorage<StudyProgress>(
    STORAGE_KEY,
    defaultProgress,
    // Normaliza no READ (mount + storage event): dados antigos, parciais ou
    // corrompidos chegam ao PRIMEIRO render completos. Antes, a migração só
    // rodava num useEffect pós-render — consumers que fazem Object.values/
    // .filter no render crashavam com campos ausentes (bug real do 49:
    // "Cannot convert undefined or null to object" em exerciseProgress).
    mergeWithDefaults,
  );

  // Migração silenciosa: garante campos novos (fixedDisciplines, pomodoroState,
  // flashcards, ...) em dados antigos. Depende de [progress] para rodar DEPOIS que
  // o useLocalStorage leu o localStorage (antes disso `progress` ainda é o default,
  // que já satisfaz a condição e o merge seria no-op). Após o merge a condição
  // vira falsa — converge sem loop. O useLocalStorage evita re-write se o conteúdo
  // serializado não mudar.
  React.useEffect(() => {
    if (
      progress.studyPreferences?.fixedDisciplines === undefined ||
      !Array.isArray(progress.flashcards) ||
      progress.preferences?.notifyPhaseEnd === undefined
    ) {
      setProgress((prev) => mergeWithDefaults(prev));
    }
  }, [progress, setProgress]);
  // NOTA: a persistência é garantida pelo useLocalStorage (salva em toda mudança
  // de estado). Não usamos interval de auto-save aqui porque múltiplas instâncias
  // do hook coexistem entre as abas — um interval com estado stale acabaria
  // sobrescrevendo writes de outras instâncias.

  // ----- Mutators -----

  const markAccessed = React.useCallback(
    (materialId: string) => {
      setProgress((prev) => {
        const nowIso = new Date().toISOString();
        const recent = [
          { id: materialId, accessedAt: nowIso },
          ...prev.recentMaterials.filter((m) => m.id !== materialId),
        ].slice(0, 10);
        // O FLUXO REAL REGISTRA (dono, 28/09): abrir um material É estudar a
        // disciplina — antes só markCompleted/addFocusSession tocavam o
        // lastStudiedAt e o aluno que aprende abrindo material aparecia como
        // 'estudo atrasado' em todo lugar. Fonte do código: course-data.
        const discCode = materials.find((m) => m.id === materialId)?.disciplineCode;
        const disc = discCode
          ? prev.disciplineProgress[discCode] ?? { studiedMinutes: 0, materialsCompleted: 0 }
          : null;
        return {
          ...prev,
          recentMaterials: recent,
          materialProgress: {
            ...prev.materialProgress,
            [materialId]: {
              ...(prev.materialProgress[materialId] ?? {}),
              lastAccessedAt: nowIso,
            },
          },
          ...(disc && discCode
            ? {
                disciplineProgress: {
                  ...prev.disciplineProgress,
                  [discCode]: { ...disc, lastStudiedAt: nowIso },
                },
              }
            : {}),
        };
      });
    },
    [setProgress],
  );

  const markCompleted = React.useCallback(
    (materialId: string, disciplineCode: string) => {
      setProgress((prev) => {
        const nowIso = new Date().toISOString();
        const wasCompleted = prev.completedMaterials.includes(materialId);
        const completed = wasCompleted
          ? prev.completedMaterials
          : [...prev.completedMaterials, materialId];
        const mat = prev.materialProgress[materialId] ?? {};
        const disc = prev.disciplineProgress[disciplineCode] ?? {
          studiedMinutes: 0,
          materialsCompleted: 0,
        };
        // FRENTE 13 — concluir um material SEMEIA o ciclo de revisão espaçada
        // (1·3·7·14·30): a 1ª volta vence amanhã. Só para material que se lê
        // no leitor (pdfPath) — ementa/calendário/página não voltam à fila;
        // e o ciclo em curso NUNCA reinicia (concluir de novo não zera o
        // agendamento — a revisão é um compromisso, não um placar).
        // TASK 220 — a prova que chega mais cedo comprime: se a 1ª volta
        // natural cairia depois da avaliação oficial da disciplina, ela nasce
        // em D-2 (a prova puxa a revisão — ninguém é avaliado sem revisitar).
        const matMeta = materials.find((m) => m.id === materialId);
        const reviews = { ...(prev.materialReviews ?? {}) };
        if (matMeta?.pdfPath && matMeta.type !== 'web_page' && !reviews[materialId]) {
          const evalP = examPressureFor(disciplineCode, new Date(nowIso));
          const sched = scheduleReviewDue(
            new Date(nowIso).getTime(),
            0,
            evalP ? evalP.daysLeft : null,
          );
          reviews[materialId] = {
            stage: 0,
            startedAt: nowIso,
            dueAt: sched.dueAt,
            ...(sched.pulledForExam ? { pulledForExam: true } : {}),
          };
        }
        return {
          ...prev,
          completedMaterials: completed,
          materialReviews: reviews,
          materialProgress: {
            ...prev.materialProgress,
            [materialId]: {
              ...mat,
              completed: true,
              lastAccessedAt: nowIso,
            },
          },
          disciplineProgress: {
            ...prev.disciplineProgress,
            [disciplineCode]: {
              ...disc,
              materialsCompleted: wasCompleted
                ? disc.materialsCompleted
                : disc.materialsCompleted + 1,
              lastStudiedAt: nowIso,
            },
          },
        };
      });
    },
    [setProgress],
  );

  const unmarkCompleted = React.useCallback(
    (materialId: string, disciplineCode: string) => {
      setProgress((prev) => {
        const wasCompleted = prev.completedMaterials.includes(materialId);
        const completed = prev.completedMaterials.filter((id) => id !== materialId);
        const mat = prev.materialProgress[materialId] ?? {};
        const disc = prev.disciplineProgress[disciplineCode] ?? {
          studiedMinutes: 0,
          materialsCompleted: 0,
        };
        return {
          ...prev,
          completedMaterials: completed,
          materialProgress: {
            ...prev.materialProgress,
            [materialId]: { ...mat, completed: false },
          },
          disciplineProgress: {
            ...prev.disciplineProgress,
            [disciplineCode]: {
              ...disc,
              materialsCompleted: wasCompleted
                ? Math.max(0, disc.materialsCompleted - 1)
                : disc.materialsCompleted,
            },
          },
        };
      });
    },
    [setProgress],
  );

  // ----- Checklist por material (frente 13) -----

  /** Substitui a checklist inteira (geradores: tópicos da aula / páginas). */
  const setChecklist = React.useCallback(
    (materialId: string, texts: string[]) => {
      setProgress((prev) => ({
        ...prev,
        materialChecklists: {
          ...(prev.materialChecklists ?? {}),
          [materialId]: {
            items: texts
              .filter((t) => t.trim().length > 0)
              .map((text, i) => ({
                id: `chk-${materialId}-${i}-${Math.random().toString(36).slice(2, 7)}`,
                text: text.trim().slice(0, 140),
                done: false,
              })),
          },
        },
      }));
    },
    [setProgress],
  );

  const addChecklistItem = React.useCallback(
    (materialId: string, text: string) => {
      const clean = text.trim();
      if (!clean) return;
      setProgress((prev) => {
        const cur = prev.materialChecklists?.[materialId] ?? { items: [] };
        return {
          ...prev,
          materialChecklists: {
            ...(prev.materialChecklists ?? {}),
            [materialId]: {
              items: [
                ...cur.items,
                {
                  id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  text: clean.slice(0, 140),
                  done: false,
                },
              ],
            },
          },
        };
      });
    },
    [setProgress],
  );

  const toggleChecklistItem = React.useCallback(
    (materialId: string, itemId: string) => {
      setProgress((prev) => {
        const cur = prev.materialChecklists?.[materialId];
        if (!cur) return prev;
        return {
          ...prev,
          materialChecklists: {
            ...(prev.materialChecklists ?? {}),
            [materialId]: {
              items: cur.items.map((it) =>
                it.id === itemId ? { ...it, done: !it.done } : it,
              ),
            },
          },
        };
      });
    },
    [setProgress],
  );

  const removeChecklistItem = React.useCallback(
    (materialId: string, itemId: string) => {
      setProgress((prev) => {
        const cur = prev.materialChecklists?.[materialId];
        if (!cur) return prev;
        return {
          ...prev,
          materialChecklists: {
            ...(prev.materialChecklists ?? {}),
            [materialId]: { items: cur.items.filter((it) => it.id !== itemId) },
          },
        };
      });
    },
    [setProgress],
  );

  // ----- Revisão espaçada de materiais (frente 13) -----

  /**
   * A volta de revisão foi cumprida — avança o ciclo (1·3·7·14·30). A
   * próxima vence MATERIAL_REVIEW_DAYS[stage+1] dias depois; no último
   * degrau o material permanece em revisão a cada 30 dias (nunca sai da
   * rotação — "sempre ter o que estudar", diretriz do dono).
   * TASK 220 — o reagendamento também OBEDECE À PROVA: se a volta seguinte
   * cairia depois da avaliação oficial da disciplina, ela é antecipada para
   * D-2. A compressão é por agendamento: cumprida a volta antecipada, o
   * degrau normal volta a valer sozinho.
   */
  const markMaterialReviewDone = React.useCallback(
    (materialId: string) => {
      setProgress((prev) => {
        const cur = prev.materialReviews?.[materialId];
        if (!cur) return prev;
        const nextIdx = Math.min(cur.stage + 1, MATERIAL_REVIEW_DAYS.length - 1);
        const matCode = materials.find((m) => m.id === materialId)?.disciplineCode;
        const evalP = matCode ? examPressureFor(matCode, new Date()) : null;
        const sched = scheduleReviewDue(
          Date.now(),
          nextIdx,
          evalP ? evalP.daysLeft : null,
        );
        return {
          ...prev,
          materialReviews: {
            ...(prev.materialReviews ?? {}),
            [materialId]: {
              ...cur,
              stage: nextIdx,
              lastReviewedAt: new Date().toISOString(),
              dueAt: sched.dueAt,
              ...(sched.pulledForExam ? { pulledForExam: true } : {}),
            },
          },
        };
      });
    },
    [setProgress],
  );

  // ----- Protocolo HUB (sessão guiada + Kaizen) -----

  const addFocusSession = React.useCallback(
    (session: Omit<FocusSessionLog, 'id' | 'date' | 'endedAt'>) => {
      setProgress((prev) => {
        const endedAt = new Date().toISOString();
        const date = endedAt.slice(0, 10);
        const full: FocusSessionLog = {
          ...session,
          id: `fs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date,
          endedAt,
        };
        const disc = prev.disciplineProgress[session.disciplineCode] ?? {
          studiedMinutes: 0,
          materialsCompleted: 0,
        };
        return {
          ...prev,
          focusSessions: [...(Array.isArray(prev.focusSessions) ? prev.focusSessions : []), full],
          disciplineProgress: {
            ...prev.disciplineProgress,
            [session.disciplineCode]: {
              ...disc,
              studiedMinutes: disc.studiedMinutes + session.focusMinutes,
              lastStudiedAt: endedAt,
            },
          },
        };
      });
    },
    [setProgress],
  );

  const addKaizenEntry = React.useCallback(
    (text: string, disciplineCode?: string) => {
      const clean = text.trim();
      if (!clean) return;
      const now = new Date();
      setProgress((prev) => ({
        ...prev,
        kaizenEntries: [
          ...(Array.isArray(prev.kaizenEntries) ? prev.kaizenEntries : []),
          {
            id: `kz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: now.toISOString().slice(0, 10),
            createdAt: now.toISOString(),
            text: clean.slice(0, 500),
            disciplineCode,
          },
        ],
      }));
    },
    [setProgress],
  );

  const removeKaizenEntry = React.useCallback(
    (id: string) => {
      setProgress((prev) => ({
        ...prev,
        kaizenEntries: (Array.isArray(prev.kaizenEntries) ? prev.kaizenEntries : []).filter(
          (k) => k.id !== id,
        ),
      }));
    },
    [setProgress],
  );

  // ----- Caderno de Erros (ciclo de resolução: errar → reensinar → marcar) -----

  /** Marca um item do caderno como revisado (fecha o ciclo daquele erro). */
  const markNotebookRevised = React.useCallback(
    (key: string) => {
      setProgress((prev) => ({
        ...prev,
        notebookRevised: { ...(prev.notebookRevised ?? {}), [key]: new Date().toISOString() },
      }));
    },
    [setProgress],
  );

  /** Reabre um item revisado (voltou a errar, ou marcou sem querer). */
  const unmarkNotebookRevised = React.useCallback(
    (key: string) => {
      setProgress((prev) => {
        if (!prev.notebookRevised || !(key in prev.notebookRevised)) return prev;
        const next = { ...prev.notebookRevised };
        delete next[key];
        return { ...prev, notebookRevised: next };
      });
    },
    [setProgress],
  );

  /**
   * Check-in de horas do dia (dono, 10/10/2026): "quantas horas tenho hoje" —
   * lançado com 1 toque, EDITÁVEL a qualquer momento (re-clicar substitui).
   * dateKey yyyy-mm-dd LOCAL — mesma gramática do pomodoroSessions.
   */
  const setAvailableHours = React.useCallback(
    (dateKey: string, hours: number) => {
      setProgress((prev) => {
        if (hours <= 0) {
          if (!prev.dailyHours || !(dateKey in prev.dailyHours)) return prev;
          const next = { ...prev.dailyHours };
          delete next[dateKey];
          return { ...prev, dailyHours: next };
        }
        return {
          ...prev,
          dailyHours: { ...(prev.dailyHours ?? {}), [dateKey]: hours },
        };
      });
    },
    [setProgress],
  );

  /**
   * SESSÕES PARTIDAS (dono, 17/10/2026 — "depois no mesmo dia a noite coloco
   * 3 horas e estudo, com registro de tudo"): ADICIONA horas ao orçamento do
   * dia em vez de substituir — a manhã não é perdida quando a noite chega
   * com mais tempo. Cada lance fica no dailyCheckins com o horário real,
   * e o total do dia é a soma honesta dos lances.
   */
  const addAvailableHours = React.useCallback(
    (dateKey: string, hours: number) => {
      setProgress((prev) => {
        if (hours <= 0) return prev;
        const current = prev.dailyHours?.[dateKey] ?? 0;
        const nextTotal = Math.min(10, Math.round((current + hours) * 60) / 60); // teto 10h/dia
        const log = [...(prev.dailyCheckins?.[dateKey] ?? []), { at: Date.now(), hours }];
        return {
          ...prev,
          dailyHours: { ...(prev.dailyHours ?? {}), [dateKey]: nextTotal },
          dailyCheckins: { ...(prev.dailyCheckins ?? {}), [dateKey]: log },
        };
      });
    },
    [setProgress],
  );

  /**
   * O FOCO DO DIA (dono, 17/10/2026 — "escolher focar em alguma matéria no
   * dia"): grava (ou limpa, code = null) a disciplina que concentra a fila.
   * Por DIA — amanhã a casa volta à fila normal, o foco não vira hábito
   * involuntário.
   */
  const setDayFocus = React.useCallback(
    (dateKey: string, code: string | null) => {
      setProgress((prev) => {
        const next = { ...(prev.dailyFocusDiscipline ?? {}) };
        if (code) next[dateKey] = code;
        else if (!(dateKey in next)) return prev;
        else delete next[dateKey];
        return { ...prev, dailyFocusDiscipline: next };
      });
    },
    [setProgress],
  );

  /** Grava (ou consome) o 1º passo de amanhã — o fecho que a casa cobra. */
  const setTomorrowStep = React.useCallback(
    (step: TomorrowStep | null) => {
      setProgress((prev) => {
        if (!step || !step.text.trim()) {
          if (!prev.tomorrowStep) return prev;
          const { tomorrowStep: _drop, ...rest } = prev;
          return rest;
        }
        return { ...prev, tomorrowStep: { ...step, text: step.text.trim() } };
      });
    },
    [setProgress],
  );

  const addPomodoroSession = React.useCallback(
    (session: Omit<PomodoroSession, 'date' | 'completedAt'>) => {
      setProgress((prev) => {
        const completedAt = new Date().toISOString();
        const date = completedAt.slice(0, 10);
        const fullSession: PomodoroSession = {
          ...session,
          date,
          completedAt,
        };
        const disc = prev.disciplineProgress[session.disciplineId] ?? {
          studiedMinutes: 0,
          materialsCompleted: 0,
        };
        return {
          ...prev,
          pomodoroSessions: [...prev.pomodoroSessions, fullSession],
          disciplineProgress: {
            ...prev.disciplineProgress,
            [session.disciplineId]: {
              ...disc,
              studiedMinutes: disc.studiedMinutes + session.focusMinutes,
              lastStudiedAt: completedAt,
            },
          },
        };
      });
    },
    [setProgress],
  );

  /** Salva o estado vivo do timer (continuidade entre abas/recarregamentos). */
  const updatePomodoroState = React.useCallback(
    (state: PomodoroState | null) => {
      setProgress((prev) => ({ ...prev, pomodoroState: state }));
    },
    [setProgress],
  );

  const addStudyBlock = React.useCallback(
    (block: Omit<CustomStudyBlock, 'id' | 'createdAt'>) => {
      setProgress((prev) => ({
        ...prev,
        studyBlocks: [
          ...prev.studyBlocks,
          {
            ...block,
            id: `block-${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [setProgress],
  );

  const removeStudyBlock = React.useCallback(
    (id: string) => {
      setProgress((prev) => ({
        ...prev,
        studyBlocks: prev.studyBlocks.filter((b) => b.id !== id),
      }));
    },
    [setProgress],
  );

  // PNAAT (plataforma FIT) — registra "estudei hoje" no lembrete. Idempotente
  // no mesmo dia (clicar 2x não cria 2 sessões) e acumula o total (o dono vê
  // o compromisso crescendo, não só a última data).
  const markPnaatSession = React.useCallback(() => {
    setProgress((prev) => {
      const today = new Date().toISOString();
      const last = prev.pnaatReminder.lastSessionAt;
      if (last && last.slice(0, 10) === today.slice(0, 10)) return prev;
      return {
        ...prev,
        pnaatReminder: { ...prev.pnaatReminder, lastSessionAt: today },
      };
    });
  }, [setProgress]);

  const toggleScheduleBlockDone = React.useCallback(
    (blockId: string) => {
      setProgress((prev) => {
        const done = prev.scheduleBlocksDone.includes(blockId);
        return {
          ...prev,
          scheduleBlocksDone: done
            ? prev.scheduleBlocksDone.filter((id) => id !== blockId)
            : [...prev.scheduleBlocksDone, blockId],
        };
      });
    },
    [setProgress],
  );

  const saveGradeNote = React.useCallback(
    (disciplineCode: string, componentName: string, value: number) => {
      setProgress((prev) => ({
        ...prev,
        gradeNotes: {
          ...prev.gradeNotes,
          [disciplineCode]: {
            ...(prev.gradeNotes[disciplineCode] ?? {}),
            [componentName]: value,
          },
        },
      }));
    },
    [setProgress],
  );

  const resetGradeNotes = React.useCallback(
    (disciplineCode: string) => {
      setProgress((prev) => {
        const next = { ...prev.gradeNotes };
        delete next[disciplineCode];
        return { ...prev, gradeNotes: next };
      });
    },
    [setProgress],
  );

  const toggleAutoavaliacao = React.useCallback(
    (materialId: string, questionIndex: number) => {
      setProgress((prev) => {
        const matChecks = prev.autoavaliacaoChecks[materialId] ?? {};
        return {
          ...prev,
          autoavaliacaoChecks: {
            ...prev.autoavaliacaoChecks,
            [materialId]: {
              ...matChecks,
              [questionIndex]: !matChecks[questionIndex],
            },
          },
        };
      });
    },
    [setProgress],
  );

  const updatePreferences = React.useCallback(
    (partial: Partial<Preferences>) => {
      setProgress((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          ...partial,
          pomodoroConfig: {
            ...prev.preferences.pomodoroConfig,
            ...(partial.pomodoroConfig ?? {}),
          },
        },
      }));
    },
    [setProgress],
  );

  const updateStudyPreferences = React.useCallback(
    (partial: Partial<StudyPreferences>) => {
      setProgress((prev) => ({
        ...prev,
        studyPreferences: { ...prev.studyPreferences, ...partial },
      }));
    },
    [setProgress],
  );

  const updateDayAvailability = React.useCallback(
    (day: number, partial: Partial<DayAvailability>) => {
      setProgress((prev) => ({
        ...prev,
        studyPreferences: {
          ...prev.studyPreferences,
          days: {
            ...prev.studyPreferences.days,
            [day]: {
              ...(prev.studyPreferences.days[day] ?? { enabled: false, startHour: 19, durationMin: 0 }),
              ...partial,
            },
          },
        },
      }));
    },
    [setProgress],
  );

  /** Fixa ("Seg = Matemática") ou deixa de fixar ('' ) uma disciplina num dia. */
  const updateFixedDiscipline = React.useCallback(
    (day: number, disciplineCode: string) => {
      setProgress((prev) => {
        const next = { ...prev.studyPreferences.fixedDisciplines };
        if (disciplineCode) next[day] = disciplineCode;
        else delete next[day];
        return {
          ...prev,
          studyPreferences: { ...prev.studyPreferences, fixedDisciplines: next },
        };
      });
    },
    [setProgress],
  );

  const toggleTopic = React.useCallback(
    (disciplineCode: string, topicName: string) => {
      setProgress((prev) => {
        const discTopics = prev.topicProgress[disciplineCode] ?? {};
        return {
          ...prev,
          topicProgress: {
            ...prev.topicProgress,
            [disciplineCode]: {
              ...discTopics,
              [topicName]: !discTopics[topicName],
            },
          },
        };
      });
    },
    [setProgress],
  );

  const addSimuladoRun = React.useCallback(
    (
      run: Omit<SimuladoRun, 'id' | 'date'>,
    ) => {
      setProgress((prev) => ({
        ...prev,
        simuladoRuns: [
          { ...run, id: `sim-${Date.now()}`, date: new Date().toISOString() },
          ...(prev.simuladoRuns ?? []),
        ].slice(0, 30), // guarda os 30 últimos
      }));
    },
    [setProgress],
  );

  const updateExerciseProgress = React.useCallback(
    (exerciseId: string, partial: Partial<ExerciseProgressEntry>) => {
      setProgress((prev) => {
        const cur = prev.exerciseProgress[exerciseId] ?? {
          tried: false,
          solved: false,
          neededHelp: false,
          lastPracticedAt: '',
        };
        const next = { ...cur, ...partial, lastPracticedAt: new Date().toISOString() };
        // Caderno de Erros: se o exercício voltou a ficar pendente (tentou e
        // não resolveu de novo), o item REABRE sozinho no caderno.
        const revised = { ...(prev.notebookRevised ?? {}) };
        if (next.tried && !next.solved) delete revised[`ex:${exerciseId}`];
        // "Erros de sempre": reentrada no caderno COM histórico de prática
        // anterior = o aluno já tinha virado este acerto e recaiu. Conta a
        // recaída (lapses) — é o item que merece prioridade na véspera.
        // 1ª marcação da vida (sem histórico) NÃO é recaída: lapses fica 0.
        const wasInCaderno = cur.neededHelp || (cur.tried && !cur.solved);
        const isInCaderno = next.neededHelp || (next.tried && !next.solved);
        const temHistorico = cur.tried || cur.solved || cur.neededHelp;
        if (!wasInCaderno && isInCaderno && temHistorico) {
          next.lapses = (cur.lapses ?? 0) + 1;
        }
        // RESOLVER TAMBÉM É ESTUDAR (dono, 28/09): praticar exercício toca o
        // lastStudiedAt da disciplina — o 'estudo atrasado' não pode cobrar
        // quem está resolvendo. Código da disciplina vem do próprio acervo.
        const discCode = exercises.find((e) => e.id === exerciseId)?.disciplineCode;
        const disc = discCode
          ? prev.disciplineProgress[discCode] ?? { studiedMinutes: 0, materialsCompleted: 0 }
          : null;
        return {
          ...prev,
          notebookRevised: revised,
          exerciseProgress: {
            ...prev.exerciseProgress,
            [exerciseId]: next,
          },
          ...(disc && discCode
            ? {
                disciplineProgress: {
                  ...prev.disciplineProgress,
                  [discCode]: { ...disc, lastStudiedAt: next.lastPracticedAt },
                },
              }
            : {}),
        };
      });
    },
    [setProgress],
  );

  const resetExerciseProgress = React.useCallback(
    (exerciseId: string) => {
      setProgress((prev) => {
        const next = { ...prev.exerciseProgress };
        delete next[exerciseId];
        return { ...prev, exerciseProgress: next };
      });
    },
    [setProgress],
  );

  const saveRealGrade = React.useCallback(
    (evaluationKey: string, grade: number, notes?: string) => {
      setProgress((prev) => ({
        ...prev,
        realGrades: {
          ...prev.realGrades,
          [evaluationKey]: {
            grade,
            doneAt: new Date().toISOString(),
            notes,
          },
        },
      }));
    },
    [setProgress],
  );

  const removeRealGrade = React.useCallback(
    (evaluationKey: string) => {
      setProgress((prev) => {
        const next = { ...prev.realGrades };
        delete next[evaluationKey];
        return { ...prev, realGrades: next };
      });
    },
    [setProgress],
  );

  const addCustomEvaluation = React.useCallback(
    (ev: Omit<CustomEvaluation, 'id'>) => {
      setProgress((prev) => ({
        ...prev,
        customEvaluations: [
          ...prev.customEvaluations,
          { ...ev, id: `cust-ev-${Date.now()}` },
        ],
      }));
    },
    [setProgress],
  );

  const removeCustomEvaluation = React.useCallback(
    (id: string) => {
      setProgress((prev) => ({
        ...prev,
        customEvaluations: prev.customEvaluations.filter((e) => e.id !== id),
      }));
    },
    [setProgress],
  );

  // ----- Flashcards (revisão espaçada) -----

  /** Adiciona um ou vários cartões de uma vez (manual ou importados da IA). */
  const addFlashcards = React.useCallback(
    (cards: Array<Omit<Flashcard, 'id'>>) => {
      if (cards.length === 0) return;
      setProgress((prev) => ({
        ...prev,
        flashcards: [
          ...(Array.isArray(prev.flashcards) ? prev.flashcards : []),
          ...cards.map((c, i) => ({
            ...c,
            id: `card-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          })),
        ],
      }));
    },
    [setProgress],
  );

  const removeFlashcard = React.useCallback(
    (id: string) => {
      setProgress((prev) => ({
        ...prev,
        flashcards: (Array.isArray(prev.flashcards) ? prev.flashcards : []).filter(
          (c) => c.id !== id,
        ),
      }));
    },
    [setProgress],
  );

  /** Aplica a nota da revisão e reagenda o cartão (Leitner: box 0..5).
   *  Se errou de novo ('again'), o item correspondente do Caderno de Erros
   *  REABRE sozinho — o caderno reflete o estado real, não a última marcação. */
  const gradeFlashcard = React.useCallback(
    (id: string, grade: FlashcardGrade) => {
      setProgress((prev) => {
        const revised = { ...(prev.notebookRevised ?? {}) };
        if (grade === 'again') delete revised[`fc:${id}`];
        return {
          ...prev,
          notebookRevised: revised,
          flashcards: (Array.isArray(prev.flashcards) ? prev.flashcards : []).map((c) => {
            if (c.id !== id) return c;
            const nextBox = flashcardNextBox(c.box, grade);
            const dueMs =
              nextBox === 0
                ? (grade === 'hard' ? 10 : 5) * 60_000
                : FLASHCARD_BOX_DAYS[nextBox] * 86_400_000;
            return {
              ...c,
              box: nextBox,
              dueAt: new Date(Date.now() + dueMs).toISOString(),
              reviews: c.reviews + 1,
              lapses: grade === 'again' ? c.lapses + 1 : c.lapses,
              lastReviewedAt: new Date().toISOString(),
            };
          }),
        };
      });
    },
    [setProgress],
  );

  // ----- Selectors -----

  const sessionsToday = React.useMemo(() => {
    // FUSO: compara com a data UTC gravada em cada sessão (convenção do módulo).
    const today = new Date().toISOString().slice(0, 10);
    return progress.pomodoroSessions.filter((s) => s.date === today);
  }, [progress.pomodoroSessions]);

  const minutesToday = React.useMemo(
    () => sessionsToday.reduce((acc, s) => acc + s.focusMinutes, 0),
    [sessionsToday],
  );

  const sessionsLast7d = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString();
    return progress.pomodoroSessions.filter((s) => s.completedAt >= cutoffStr);
  }, [progress.pomodoroSessions]);

  const minutesLast7d = React.useMemo(
    () => sessionsLast7d.reduce((acc, s) => acc + s.focusMinutes, 0),
    [sessionsLast7d],
  );

  const byDiscipline = React.useMemo(() => {
    const map = new Map<string, { sessions: number; minutes: number }>();
    for (const s of progress.pomodoroSessions) {
      const cur = map.get(s.disciplineId) ?? { sessions: 0, minutes: 0 };
      cur.sessions += 1;
      cur.minutes += s.focusMinutes;
      map.set(s.disciplineId, cur);
    }
    return Array.from(map.entries()).map(([disciplineCode, v]) => ({
      disciplineCode,
      ...v,
    }));
  }, [progress.pomodoroSessions]);

  const dailyGoalProgress = React.useMemo(() => {
    const goal = progress.preferences.dailyGoal || 1;
    return Math.min(100, Math.round((sessionsToday.length / goal) * 100));
  }, [sessionsToday.length, progress.preferences.dailyGoal]);

  const totalTopicsCompleted = React.useMemo(() => {
    let total = 0;
    for (const code of Object.keys(progress.topicProgress ?? {})) {
      for (const done of Object.values(progress.topicProgress[code] ?? {})) {
        if (done) total += 1;
      }
    }
    return total;
  }, [progress.topicProgress]);

  const totalExercisesTried = React.useMemo(() => {
    return Object.values(progress.exerciseProgress ?? {}).filter((e) => e.tried).length;
  }, [progress.exerciseProgress]);

  const totalExercisesSolved = React.useMemo(() => {
    return Object.values(progress.exerciseProgress ?? {}).filter((e) => e.solved).length;
  }, [progress.exerciseProgress]);

  /**
   * Streak: dias consecutivos com pelo menos 1 sessão de foco,
   * terminando hoje (ou ontem — streak "vivo" ainda não estudado hoje).
   * FUSO: `date` das sessões é gravada em UTC (toISOString().slice(0, 10)) —
   * o streak compara com a MESMA convenção (não com data local) para não
   * quebrar no fuso -3 (sessões entre 21h-23h59 BRT gravam no dia UTC seguinte).
   */
  const studyStreak = React.useMemo(() => {
    const days = new Set(progress.pomodoroSessions.map((s) => s.date));
    if (days.size === 0) return 0;
    const iso = (d: Date) => d.toISOString().slice(0, 10); // UTC — igual ao gravado
    const cursor = new Date();
    if (!days.has(iso(cursor))) {
      cursor.setDate(cursor.getDate() - 1); // ontem mantém o streak vivo
    }
    let streak = 0;
    while (days.has(iso(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [progress.pomodoroSessions]);

  // ----- Selectors de flashcards -----

  const allFlashcards = React.useMemo(
    () => (Array.isArray(progress.flashcards) ? progress.flashcards : []),
    [progress.flashcards],
  );

  /** Cartões vencidos (inclui novas — dueAt = createdAt), mais atrasados primeiro.
   * A derivação mora no seletor PURO flashcardsDueFor (o relógio por parâmetro);
   * o memo mantém o comportamento cacheado — superfícies vivas chamam o seletor
   * direto com o próprio tick (lição 113/115: uma fonte, várias cadências). */
  const flashcardsDue = React.useMemo(
    () => flashcardsDueFor(allFlashcards, Date.now()),
    [allFlashcards],
  );

  const flashcardStats = React.useMemo(
    () => flashcardStatsFor(allFlashcards, Date.now()),
    [allFlashcards],
  );

  // ----- Selectors do Protocolo HUB -----

  const allFocusSessions = React.useMemo(
    () => (Array.isArray(progress.focusSessions) ? progress.focusSessions : []),
    [progress.focusSessions],
  );

  /** Streak do Protocolo: dias consecutivos (até hoje) com ≥1 sessão guiada. */
  const methodStreak = React.useMemo(() => {
    const days = new Set(allFocusSessions.map((s) => s.date));
    if (days.size === 0) return 0;
    const today = new Date();
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let streak = 0;
    const cursor = new Date(today);
    if (!days.has(key(cursor))) {
      cursor.setDate(cursor.getDate() - 1); // permite streak vivo mesmo sem sessão hoje
    }
    while (days.has(key(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [allFocusSessions]);

  const methodStats = React.useMemo(() => {
    const now = Date.now();
    const today = now && new Date(now).toISOString().slice(0, 10);
    const weekAgo = now - 7 * 86_400_000;
    const scored = allFocusSessions.filter((s) => typeof s.feynmanScore === 'number');
    return {
      totalSessions: allFocusSessions.length,
      totalMinutes: allFocusSessions.reduce((acc, s) => acc + s.focusMinutes, 0),
      sessionsToday: allFocusSessions.filter((s) => s.date === today).length,
      weekSessions: allFocusSessions.filter(
        (s) => new Date(s.endedAt).getTime() >= weekAgo,
      ).length,
      avgFeynman: scored.length
        ? Math.round(
            scored.reduce((acc, s) => acc + (s.feynmanScore ?? 0), 0) / scored.length,
          )
        : null,
      bestFeynman: scored.length
        ? Math.max(...scored.map((s) => s.feynmanScore ?? 0))
        : null,
      kaizenCount: Array.isArray(progress.kaizenEntries) ? progress.kaizenEntries.length : 0,
    };
  }, [allFocusSessions, progress.kaizenEntries]);

  return React.useMemo(
    () => ({
      progress,
      setProgress,
      replaceProgress: (p: StudyProgress) => setProgress(() => p),
      // mutators
      markAccessed,
      markCompleted,
      unmarkCompleted,
      setChecklist,
      addChecklistItem,
      toggleChecklistItem,
      removeChecklistItem,
      markMaterialReviewDone,
      addPomodoroSession,
      updatePomodoroState,
      addStudyBlock,
      removeStudyBlock,
      markPnaatSession,
      toggleScheduleBlockDone,
      saveGradeNote,
      resetGradeNotes,
      toggleAutoavaliacao,
      updatePreferences,
      updateStudyPreferences,
      updateDayAvailability,
      updateFixedDiscipline,
      toggleTopic,
      updateExerciseProgress,
      resetExerciseProgress,
      addSimuladoRun,
      saveRealGrade,
      removeRealGrade,
      addCustomEvaluation,
      removeCustomEvaluation,
      addFlashcards,
      removeFlashcard,
      gradeFlashcard,
      addFocusSession,
      addKaizenEntry,
      removeKaizenEntry,
      markNotebookRevised,
      unmarkNotebookRevised,
      setAvailableHours,
      addAvailableHours,
      setDayFocus,
      setTomorrowStep,
      // selectors
      sessionsToday,
      minutesToday,
      sessionsLast7d,
      minutesLast7d,
      byDiscipline,
      dailyGoalProgress,
      totalTopicsCompleted,
      totalExercisesTried,
      totalExercisesSolved,
      studyStreak,
      allFlashcards,
      flashcardsDue,
      flashcardStats,
      allFocusSessions,
      methodStreak,
      methodStats,
    }),
    [
      progress,
      setProgress,
      markAccessed,
      markCompleted,
      unmarkCompleted,
      setChecklist,
      addChecklistItem,
      toggleChecklistItem,
      removeChecklistItem,
      markMaterialReviewDone,
      addPomodoroSession,
      updatePomodoroState,
      addStudyBlock,
      removeStudyBlock,
      markPnaatSession,
      toggleScheduleBlockDone,
      saveGradeNote,
      resetGradeNotes,
      toggleAutoavaliacao,
      updatePreferences,
      updateStudyPreferences,
      updateDayAvailability,
      updateFixedDiscipline,
      toggleTopic,
      updateExerciseProgress,
      resetExerciseProgress,
      addSimuladoRun,
      saveRealGrade,
      removeRealGrade,
      addCustomEvaluation,
      removeCustomEvaluation,
      addFlashcards,
      removeFlashcard,
      gradeFlashcard,
      addFocusSession,
      addKaizenEntry,
      removeKaizenEntry,
      markNotebookRevised,
      unmarkNotebookRevised,
      setAvailableHours,
      addAvailableHours,
      setDayFocus,
      setTomorrowStep,
      sessionsToday,
      minutesToday,
      sessionsLast7d,
      minutesLast7d,
      byDiscipline,
      dailyGoalProgress,
      totalTopicsCompleted,
      totalExercisesTried,
      totalExercisesSolved,
      studyStreak,
      allFlashcards,
      flashcardsDue,
      flashcardStats,
      allFocusSessions,
      methodStreak,
      methodStats,
    ],
  );
}

export type StudyProgressHook = ReturnType<typeof useStudyProgress>;
