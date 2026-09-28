'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  BookCheck,
  BrainCircuit,
  Dumbbell,
  Flame,
  Layers,
  Lock,
  Medal,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudyProgress } from '@/lib/study-progress';
import { cn } from '@/lib/utils';

interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Classes quando desbloqueada (tons emerald/teal/amber/violet/rose — sem azul). */
  unlockedClasses: string;
  isUnlocked: (s: {
    totalSessions: number;
    minutesToday: number;
    streak: number;
    topicsDone: number;
    materialsDone: number;
    exercisesTried: number;
    exercisesSolved: number;
    flashcardsTotal: number;
    flashcardReviews: number;
  }) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
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

export function AchievementsCard() {
  const sp = useStudyProgress();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

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
    ],
  );

  const unlockedCount = React.useMemo(
    () => (mounted ? ACHIEVEMENTS.filter((a) => a.isUnlocked(snapshot)).length : 0),
    [mounted, snapshot],
  );
  const pct = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);

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
          {unlockedCount}/{ACHIEVEMENTS.length} desbloqueadas
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
        {ACHIEVEMENTS.map((a, i) => {
          const unlocked = mounted && a.isUnlocked(snapshot);
          const Icon = a.icon;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.04 }}
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
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {unlockedCount === 0
          ? 'Complete sua primeira sessão de foco para começar a desbloquear.'
          : unlockedCount < ACHIEVEMENTS.length
            ? 'Continue estudando para desbloquear as próximas!'
            : 'Incrível! Você desbloqueou todas as conquistas. 👑'}
      </p>
    </Card>
  );
}
