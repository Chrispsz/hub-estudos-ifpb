'use client';

import * as React from 'react';
import { useLocalStorage } from './use-local-storage';

const STORAGE_KEY = 'hub-estudos-ifpb:v2';

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

export interface PnaatProgress {
  progress: number; // 0-100
  lastAccessedAt?: string;
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

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  pomodoroConfig: {
    focus: number;
    shortBreak: number;
    longBreak: number;
    cyclesBeforeLong: number;
  };
  dailyGoal: number;
  silentMode: boolean;
  /** Notificação nativa do SO ao concluir fase do Pomodoro. */
  notifyPhaseEnd: boolean;
  /** Mostra o tempo restante no título da aba (ex.: "24:31 • Foco"). */
  tabTitleTimer: boolean;
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
  lastPracticedAt: string;
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
}

/** Intervalo (dias) por caixa — índice = box. Box 0 usa minutos (5 min). */
export const FLASHCARD_BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;

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

export interface SimuladoRun {
  id: string;
  date: string; // ISO
  total: number;
  solved: number;
  missed: number;
  skipped: number;
  durationSec: number;
  filters?: { discipline?: string; difficulty?: string; durationMin?: number };
}

export interface StudyProgress {
  recentMaterials: RecentMaterial[];
  completedMaterials: string[];
  materialProgress: { [materialId: string]: MaterialProgress };
  disciplineProgress: { [disciplineCode: string]: DisciplineProgress };
  pnaatProgress: { [moduleId: string]: PnaatProgress };
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
  pnaatProgress: {},
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
  );

  // Migração silenciosa: garante campos novos (fixedDisciplines, pomodoroState, flashcards, ...)
  React.useEffect(() => {
    if (
      progress.studyPreferences?.fixedDisciplines === undefined ||
      !Array.isArray(progress.flashcards) ||
      progress.preferences?.notifyPhaseEnd === undefined
    ) {
      setProgress((prev) => mergeWithDefaults(prev));
    }
  }, []);
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
        };
      });
    },
    [setProgress],
  );

  const markCompleted = React.useCallback(
    (materialId: string, disciplineCode: string) => {
      setProgress((prev) => {
        const wasCompleted = prev.completedMaterials.includes(materialId);
        const completed = wasCompleted
          ? prev.completedMaterials
          : [...prev.completedMaterials, materialId];
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
            [materialId]: {
              ...mat,
              completed: true,
              lastAccessedAt: new Date().toISOString(),
            },
          },
          disciplineProgress: {
            ...prev.disciplineProgress,
            [disciplineCode]: {
              ...disc,
              materialsCompleted: wasCompleted
                ? disc.materialsCompleted
                : disc.materialsCompleted + 1,
              lastStudiedAt: new Date().toISOString(),
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

  const updatePnaatProgress = React.useCallback(
    (moduleId: string, value: number) => {
      setProgress((prev) => ({
        ...prev,
        pnaatProgress: {
          ...prev.pnaatProgress,
          [moduleId]: {
            progress: Math.max(0, Math.min(100, Math.round(value))),
            lastAccessedAt: new Date().toISOString(),
          },
        },
      }));
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
        return {
          ...prev,
          exerciseProgress: {
            ...prev.exerciseProgress,
            [exerciseId]: {
              ...cur,
              ...partial,
              lastPracticedAt: new Date().toISOString(),
            },
          },
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

  /** Aplica a nota da revisão e reagenda o cartão (Leitner: box 0..5). */
  const gradeFlashcard = React.useCallback(
    (id: string, grade: FlashcardGrade) => {
      setProgress((prev) => ({
        ...prev,
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
      }));
    },
    [setProgress],
  );

  // ----- Selectors -----

  const sessionsToday = React.useMemo(() => {
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
    for (const code of Object.keys(progress.topicProgress)) {
      for (const done of Object.values(progress.topicProgress[code])) {
        if (done) total += 1;
      }
    }
    return total;
  }, [progress.topicProgress]);

  const totalExercisesTried = React.useMemo(() => {
    return Object.values(progress.exerciseProgress).filter((e) => e.tried).length;
  }, [progress.exerciseProgress]);

  const totalExercisesSolved = React.useMemo(() => {
    return Object.values(progress.exerciseProgress).filter((e) => e.solved).length;
  }, [progress.exerciseProgress]);

  /**
   * Streak: dias consecutivos com pelo menos 1 sessão de foco,
   * terminando hoje (ou ontem — streak "vivo" ainda não estudado hoje).
   */
  const studyStreak = React.useMemo(() => {
    const days = new Set(progress.pomodoroSessions.map((s) => s.date));
    if (days.size === 0) return 0;
    const iso = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
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

  /** Cartões vencidos (inclui novas — dueAt = createdAt), mais atrasados primeiro. */
  const flashcardsDue = React.useMemo(() => {
    const now = Date.now();
    return allFlashcards
      .filter((c) => new Date(c.dueAt).getTime() <= now)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [allFlashcards]);

  const flashcardStats = React.useMemo(() => {
    const now = Date.now();
    return {
      total: allFlashcards.length,
      due: flashcardsDue.length,
      learning: allFlashcards.filter((c) => c.box <= 1).length,
      mastered: allFlashcards.filter((c) => c.box >= 4).length,
      reviewsDone: allFlashcards.reduce((acc, c) => acc + c.reviews, 0),
      nextDueMs: allFlashcards.length
        ? Math.min(...allFlashcards.map((c) => new Date(c.dueAt).getTime())) - now
        : null,
    };
  }, [allFlashcards, flashcardsDue]);

  return React.useMemo(
    () => ({
      progress,
      setProgress,
      replaceProgress: (p: StudyProgress) => setProgress(() => p),
      // mutators
      markAccessed,
      markCompleted,
      unmarkCompleted,
      addPomodoroSession,
      updatePomodoroState,
      updatePnaatProgress,
      addStudyBlock,
      removeStudyBlock,
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
    }),
    [
      progress,
      setProgress,
      markAccessed,
      markCompleted,
      unmarkCompleted,
      addPomodoroSession,
      updatePomodoroState,
      updatePnaatProgress,
      addStudyBlock,
      removeStudyBlock,
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
    ],
  );
}

export type StudyProgressHook = ReturnType<typeof useStudyProgress>;
