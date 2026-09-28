'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  BookCheck,
  BrainCircuit,
  CalendarClock,
  ClipboardCheck,
  Dumbbell,
  Flame,
  Layers,
  Lock,
  Medal,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudyProgress } from '@/lib/study-progress';
import {
  findMathSimuladoRunOficial,
  mathDrillFeedbackFor,
  simuladoVerdictFor,
} from '@/lib/math-exam-prep';
import { cn } from '@/lib/utils';

/**
 * Snapshot dos indicadores — os 9 de ROTINA (pomodoro/streak/materiais/
 * flashcards) + os 3 da SEMANA DA AV1, derivados dos runs do Praticar pela
 * MESMA fonte única do kit (findMathSimuladoRunOficial → simuladoVerdictFor
 * → mathDrillFeedbackFor): a conquista é RECIBO, não promessa — só existe
 * quando o registro existe (lição 85/86: registro vence relógio).
 */
interface AchievementSnapshot {
  totalSessions: number;
  minutesToday: number;
  streak: number;
  topicsDone: number;
  materialsDone: number;
  exercisesTried: number;
  exercisesSolved: number;
  flashcardsTotal: number;
  flashcardReviews: number;
  /** O ensaio oficial da Av1 tem run registrado (mode 'prova', dia 29/09). */
  simuladoFeito: boolean;
  /** A promessa do plano cumprida: o bloco fraco do ensaio virou revisão
   *  DEPOIS do diagnóstico e o treino tem taxa real (pulada não conta). */
  promessaCumprida: boolean;
  /** A meta da Av1 batida no ensaio (≥ MATH_META, a régua da fonte única). */
  metaAv1Batida: boolean;
}

interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Classes quando desbloqueada (tons emerald/teal/amber/violet/rose — sem azul). */
  unlockedClasses: string;
  isUnlocked: (s: AchievementSnapshot) => boolean;
}

const ROUTINE_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-session',
    label: 'Primeiro passo',
    description: 'Conclua 1 sessão de foco',
    icon: Timer,
    unlockedClasses: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_18px_-6px_rgba(16,185,129,0.5)]',
    isUnlocked: (s) => s.totalSessions >= 1,
  },
  {
    id: 'ten-sessions',
    label: 'Ritmo constante',
    description: 'Conclua 10 sessões de foco',
    icon: Medal,
    unlockedClasses: 'border-teal-500/40 bg-teal-500/10 text-teal-400 shadow-[0_0_18px_-6px_rgba(20,184,166,0.5)]',
    isUnlocked: (s) => s.totalSessions >= 10,
  },
  {
    id: 'marathon',
    label: 'Maratonista',
    description: 'Estude 120 min em um único dia',
    icon: Trophy,
    unlockedClasses: 'border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_18px_-6px_rgba(245,158,11,0.5)]',
    isUnlocked: (s) => s.minutesToday >= 120,
  },
  {
    id: 'streak-3',
    label: 'Pegando fogo',
    description: 'Mantenha streak de 3 dias',
    icon: Flame,
    unlockedClasses: 'border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-[0_0_18px_-6px_rgba(244,63,94,0.5)]',
    isUnlocked: (s) => s.streak >= 3,
  },
  {
    id: 'topics-10',
    label: 'Construtor',
    description: 'Conclua 10 tópicos no checklist',
    icon: BookCheck,
    unlockedClasses: 'border-violet-500/40 bg-violet-500/10 text-violet-400 shadow-[0_0_18px_-6px_rgba(139,92,246,0.5)]',
    isUnlocked: (s) => s.topicsDone >= 10,
  },
  {
    id: 'reader-5',
    label: 'Leitor dedicado',
    description: 'Conclua 5 materiais da biblioteca',
    icon: BookCheck,
    unlockedClasses: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_18px_-6px_rgba(16,185,129,0.5)]',
    isUnlocked: (s) => s.materialsDone >= 5,
  },
  {
    id: 'practice-10',
    label: 'Mão na massa',
    description: 'Tente 10 exercícios',
    icon: Dumbbell,
    unlockedClasses: 'border-teal-500/40 bg-teal-500/10 text-teal-400 shadow-[0_0_18px_-6px_rgba(20,184,166,0.5)]',
    isUnlocked: (s) => s.exercisesTried >= 10,
  },
  {
    id: 'solver-5',
    label: 'Solucionador',
    description: 'Resolva 5 exercícios',
    icon: Award,
    unlockedClasses: 'border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_18px_-6px_rgba(245,158,11,0.5)]',
    isUnlocked: (s) => s.exercisesSolved >= 5,
  },
  {
    id: 'cards-10',
    label: 'Memorista',
    description: 'Crie 10 flashcards',
    icon: Layers,
    unlockedClasses: 'border-violet-500/40 bg-violet-500/10 text-violet-400 shadow-[0_0_18px_-6px_rgba(139,92,246,0.5)]',
    isUnlocked: (s) => s.flashcardsTotal >= 10,
  },
  {
    id: 'reviews-25',
    label: 'Revisor implacável',
    description: 'Faça 25 revisões de flashcards',
    icon: BrainCircuit,
    unlockedClasses: 'border-teal-500/40 bg-teal-500/10 text-teal-400 shadow-[0_0_18px_-6px_rgba(20,184,166,0.5)]',
    isUnlocked: (s) => s.flashcardReviews >= 25,
  },
];

/**
 * AS CONQUISTAS DA SEMANA — a reta final tinha um sistema de recompensa
 * CEGO: as 10 conquistas mediam a ROTINA (foco, streak, materiais) e as
 * três ações que decidem a nota — rodar o ensaio, treinar o bloco fraco,
 * bater a meta — não rendiam NADA. Agora rendem, com a honestidade da
 * casa: desbloqueio DERIVADO do registro (nada persistido, nada inventado)
 * e a ordem do tempo da 107 embutida (treino antes do ensaio é preparo,
 * não revisão cumprida — mathDrillFeedbackFor já nega).
 */
const EXAM_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ensaio-real',
    label: 'Ensaio real',
    description: 'Rode o simulado oficial da Av1',
    icon: ClipboardCheck,
    unlockedClasses: 'border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_18px_-6px_rgba(245,158,11,0.5)]',
    isUnlocked: (s) => s.simuladoFeito,
  },
  {
    id: 'promessa-cumprida',
    label: 'A revisão de amanhã',
    description: 'Depois do ensaio, treine o bloco fraco',
    icon: TrendingUp,
    unlockedClasses: 'border-violet-500/40 bg-violet-500/10 text-violet-400 shadow-[0_0_18px_-6px_rgba(139,92,246,0.5)]',
    isUnlocked: (s) => s.promessaCumprida,
  },
  {
    id: 'meta-av1',
    label: 'Meta da Av1',
    description: 'Bata 70% no ensaio oficial',
    icon: Target,
    unlockedClasses: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_18px_-6px_rgba(16,185,129,0.5)]',
    isUnlocked: (s) => s.metaAv1Batida,
  },
];

const ALL_ACHIEVEMENTS = [...ROUTINE_ACHIEVEMENTS, ...EXAM_ACHIEVEMENTS];

function AchievementCardTile({ a, unlocked, index }: { a: Achievement; unlocked: boolean; index: number }) {
  const Icon = a.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04 }}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors duration-300',
        unlocked
          ? a.unlockedClasses
          : 'border-border/60 bg-muted/20 text-muted-foreground/70',
      )}
      title={unlocked ? `${a.label} — desbloqueada!` : `${a.description} (bloqueada)`}
    >
      {unlocked ? (
        <Icon className="size-5" aria-hidden="true" />
      ) : (
        <Lock className="size-4 opacity-50" aria-hidden="true" />
      )}
      <span className="text-xs font-semibold leading-tight">{a.label}</span>
      <span className="text-[10px] leading-tight opacity-80">{a.description}</span>
    </motion.div>
  );
}

export function AchievementsCard() {
  const sp = useStudyProgress();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // A fonte única da semana: os runs que o Praticar registra (o MESMO array
  // que o kit, a fila e o histórico leem — zero segunda fonte, zero hook novo).
  const runs = sp.progress.simuladoRuns;
  const oficial = React.useMemo(() => findMathSimuladoRunOficial(runs), [runs]);
  const verdict = React.useMemo(() => simuladoVerdictFor(oficial), [oficial]);
  // O foco que decide: pular o bloco INTEIRO é diagnóstico mais grave que a
  // menor taxa (105) — a MESMA composição do kit e do tutor.
  const foco = React.useMemo(() => (verdict ? (verdict.pulouTudo ?? verdict.worst) : null), [verdict]);
  // A ordem do tempo manda (107): só drill DEPOIS do oficial qualifica como
  // 'a revisão de amanhã' — preparo antes do diagnóstico não cumpre promessa.
  const feedback = React.useMemo(
    () => (oficial && foco ? mathDrillFeedbackFor(runs, foco.topic, foco.pct, oficial.date) : null),
    [oficial, foco, runs],
  );

  // Snapshot dos indicadores — memoizado para não recriar objeto a cada render
  const snapshot = React.useMemo(
    () => ({
      totalSessions: sp.progress.pomodoroSessions.length,
      minutesToday: sp.minutesToday,
      streak: sp.studyStreak,
      topicsDone: sp.totalTopicsCompleted,
      materialsDone: sp.progress.completedMaterials.length,
      exercisesTried: sp.totalExercisesTried,
      exercisesSolved: sp.totalExercisesSolved,
      flashcardsTotal: sp.allFlashcards.length,
      flashcardReviews: sp.flashcardStats.reviewsDone,
      // A semana da Av1: recibo DERIVADO — a conquista existe quando o
      // registro existe (a taxa do treino conta só sobre RESPONDIDOS).
      simuladoFeito: oficial !== undefined,
      promessaCumprida: feedback !== null && feedback.pct !== null,
      metaAv1Batida: verdict?.metaBatida === true,
    }),
    [
      sp.progress.pomodoroSessions,
      sp.minutesToday,
      sp.studyStreak,
      sp.totalTopicsCompleted,
      sp.progress.completedMaterials,
      sp.totalExercisesTried,
      sp.totalExercisesSolved,
      sp.allFlashcards,
      sp.flashcardStats,
      oficial,
      verdict,
      feedback,
    ],
  );

  const unlockedCount = React.useMemo(
    () => (mounted ? ALL_ACHIEVEMENTS.filter((a) => a.isUnlocked(snapshot)).length : 0),
    [mounted, snapshot],
  );
  const pct = Math.round((unlockedCount / ALL_ACHIEVEMENTS.length) * 100);
  const examUnlocked = mounted
    ? EXAM_ACHIEVEMENTS.filter((a) => a.isUnlocked(snapshot)).length
    : 0;

  return (
    <Card className="rounded-xl border-l-4 border-l-amber-500 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Award className="size-4 text-amber-500" aria-hidden="true" />
          Conquistas
        </h2>
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-500"
        >
          {unlockedCount}/{ALL_ACHIEVEMENTS.length} desbloqueadas
        </Badge>
      </div>

      {/* Barra de progresso das conquistas */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ROUTINE_ACHIEVEMENTS.map((a, i) => (
          <AchievementCardTile
            key={a.id}
            a={a}
            index={i}
            unlocked={mounted && a.isUnlocked(snapshot)}
          />
        ))}
      </div>

      {/* A SEMANA DA AV1 — as três ações que decidem a nota, na própria fileira
          (3 colunas = fileira cheia). O divisor é a gramática da casa: rótulo
          pequeno + fio, o relógio da família da espera SEM pulso. */}
      <div className="mt-5 flex items-center gap-2" aria-hidden="true">
        <CalendarClock className="size-3 text-amber-500/80" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Semana da Av1
        </span>
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {examUnlocked}/3
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {EXAM_ACHIEVEMENTS.map((a, i) => (
          <AchievementCardTile
            key={a.id}
            a={a}
            index={i}
            unlocked={mounted && a.isUnlocked(snapshot)}
          />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {unlockedCount === 0
          ? 'Complete sua primeira sessão de foco para começar a desbloquear.'
          : unlockedCount < ALL_ACHIEVEMENTS.length
            ? 'Continue estudando para desbloquear as próximas!'
            : 'Incrível! Você desbloqueou todas as conquistas. 👑'}
      </p>
    </Card>
  );
}
