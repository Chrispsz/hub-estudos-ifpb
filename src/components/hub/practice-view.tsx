'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Dumbbell,
  Layers,
  Lightbulb,
  RotateCcw,
  Target,
  Trophy,
  CheckCircle2,
  HandHeart,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  disciplines,
  getDisciplineByCode,
} from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { FlashcardsView } from '@/components/hub/flashcards-view';
import {
  exercises,
  getExercisesByDiscipline,
  getExerciseStats,
  type Exercise,
} from '@/lib/exercise-extractor';
import { SimuladoView } from '@/components/hub/simulado-view';

const difficultyColor: Record<Exercise['difficulty'], string> = {
  facil: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400',
  medio: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400',
  dificil: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400',
};

const difficultyLabel: Record<Exercise['difficulty'], string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
};

const sourceLabel: Record<Exercise['source'], string> = {
  lista_algoritmos: 'Lista Algoritmos',
  prova_real: 'Prova Real',
  gerado_topico: 'Por Tópico',
  ia_sugerido: 'IA',
};

type PracticeMode = 'exercicios' | 'flashcards';

// Estático (depende só do acervo fixo) — computado UMA vez por módulo, não por render.
const EXERCISE_STATS = getExerciseStats();

export function PracticeView() {
  const sp = useStudyProgress();
  const [mode, setMode] = React.useState<PracticeMode>('exercicios');
  const dueCount = sp.flashcardStats.due;

  return (
    <Tabs
      value={mode}
      onValueChange={(v) => setMode(v as PracticeMode)}
      className="space-y-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Dumbbell className="size-5 text-emerald-500" /> Praticar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exercícios das listas e provas, mais flashcards de revisão espaçada.
          </p>
        </div>
        <TabsList className="grid w-full grid-cols-2 sm:w-80">
          <TabsTrigger value="exercicios" className="gap-1.5">
            <Dumbbell className="size-3.5" /> Exercícios
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="gap-1.5">
            <Layers className="size-3.5" /> Flashcards
            {dueCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-500"
              >
                {dueCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="exercicios" className="mt-0">
        <ExercisesPanel />
      </TabsContent>
      <TabsContent value="flashcards" className="mt-0">
        <FlashcardsView />
      </TabsContent>
    </Tabs>
  );
}

function ExercisesPanel() {
  const sp = useStudyProgress();
  const [filterDiscipline, setFilterDiscipline] = React.useState<string>('all');
  const [filterTopic, setFilterTopic] = React.useState<string>('all');
  const [simuladoOpen, setSimuladoOpen] = React.useState(false);

  const filteredExercises = React.useMemo(() => {
    let list = exercises;
    if (filterDiscipline !== 'all') {
      list = list.filter((e) => e.disciplineCode === filterDiscipline);
    }
    if (filterTopic !== 'all') {
      list = list.filter((e) => e.topic === filterTopic);
    }
    return list;
  }, [filterDiscipline, filterTopic]);

  // Tópicos disponíveis com base na disciplina selecionada
  const availableTopics = React.useMemo(() => {
    if (filterDiscipline === 'all') return Array.from(new Set(exercises.map((e) => e.topic))).sort();
    return Array.from(new Set(getExercisesByDiscipline(filterDiscipline).map((e) => e.topic))).sort();
  }, [filterDiscipline]);

  const stats = EXERCISE_STATS;
  const totalTried = sp.totalExercisesTried;
  const totalSolved = sp.totalExercisesSolved;
  const totalNeededHelp = React.useMemo(
    () => Object.values(sp.progress.exerciseProgress).filter((e) => e.neededHelp).length,
    [sp.progress.exerciseProgress],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {stats.total} exercícios disponíveis. Marque como tentou, resolveu ou precisou de ajuda.
        </p>
        <Button
          size="sm"
          onClick={() => setSimuladoOpen(true)}
          className="group gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/25 transition-all hover:shadow-emerald-600/40 hover:shadow-xl"
        >
          <Target className="size-3.5 transition-transform group-hover:scale-110" /> Simulado Pro
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          icon={<BarChart3 className="size-4" />}
          label="Tentados"
          value={`${totalTried}/${stats.total}`}
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          barColor="bg-emerald-500"
          progress={stats.total > 0 ? (totalTried / stats.total) * 100 : 0}
        />
        <StatCard
          icon={<Trophy className="size-4" />}
          label="Resolvidos"
          value={String(totalSolved)}
          color="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          barColor="bg-amber-500"
          progress={totalTried > 0 ? (totalSolved / totalTried) * 100 : 0}
        />
        <StatCard
          icon={<HandHeart className="size-4" />}
          label="Precisei de ajuda"
          value={String(totalNeededHelp)}
          color="bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
          barColor="bg-rose-500"
          progress={totalTried > 0 ? (totalNeededHelp / totalTried) * 100 : 0}
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Progresso geral"
          value={`${stats.total > 0 ? Math.round((totalSolved / stats.total) * 100) : 0}%`}
          color="bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"
          barColor="bg-violet-500"
          progress={stats.total > 0 ? (totalSolved / stats.total) * 100 : 0}
        />
      </div>

      {/* Filtros */}
      <Card className="rounded-xl p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium">Disciplina</Label>
            <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {disciplines.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium">Tópico</Label>
            <Select value={filterTopic} onValueChange={setFilterTopic}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableTopics.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {filteredExercises.length} exercício(s)
          </div>
        </div>
      </Card>

      {/* Lista de exercícios */}
      <div className="space-y-2">
        {filteredExercises.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 rounded-xl bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <RotateCcw className="size-6 text-muted-foreground/50" aria-hidden />
            Nenhum exercício com esses filtros. Ajuste a seleção acima.
          </Card>
        ) : (
          filteredExercises.map((ex, i) => (
            <ExerciseCard key={ex.id} exercise={ex} index={i} />
          ))
        )}
      </div>

      {/* Simulado Pro (prova com cronômetro) */}
      <SimuladoView open={simuladoOpen} onOpenChange={setSimuladoOpen} />
    </div>
  );
}

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const sp = useStudyProgress();
  const progress = sp.progress.exerciseProgress[exercise.id];
  const disc = getDisciplineByCode(exercise.disciplineCode);
  const color = getColorClasses(disc?.color ?? 'slate');

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.3) }}
    >
      <Card
        className={cn(
          'rounded-xl bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md',
          progress?.solved && 'border-l-4 border-l-emerald-500',
        )}
      >
        <div className="flex flex-wrap items-start gap-2">
          <Badge
            variant="outline"
            className={cn('border text-[10px]', color.badge)}
          >
            {disc?.shortName ?? exercise.disciplineCode}
          </Badge>
          <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
            {exercise.topic}
          </Badge>
          <Badge variant="outline" className={cn('border text-[10px]', difficultyColor[exercise.difficulty])}>
            {difficultyLabel[exercise.difficulty]}
          </Badge>
          <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
            {sourceLabel[exercise.source]}
          </Badge>
          {progress?.solved && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="size-2.5" /> Resolvido
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{exercise.statement}</p>
        {exercise.hint && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
            <Lightbulb className="mt-0.5 size-3 shrink-0" /> {exercise.hint}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={!!progress?.tried}
              onCheckedChange={(v) => {
                sp.updateExerciseProgress(exercise.id, { tried: !!v });
                if (v) toast.success('Marcado como tentado!');
              }}
            />
            <span className="text-muted-foreground">Tentei fazer</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={!!progress?.solved}
              onCheckedChange={(v) => {
                sp.updateExerciseProgress(exercise.id, { solved: !!v });
                if (v) toast.success('Marcado como resolvido! 🎉');
              }}
            />
            <span className="text-muted-foreground">Consegui resolver</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={!!progress?.neededHelp}
              onCheckedChange={(v) => {
                sp.updateExerciseProgress(exercise.id, { neededHelp: !!v });
              }}
            />
            <span className="text-muted-foreground">Precisei de ajuda</span>
          </label>
          {progress && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-11 text-xs text-muted-foreground sm:h-7"
              onClick={() => {
                sp.resetExerciseProgress(exercise.id);
                toast.info('Progresso resetado');
              }}
            >
              <RotateCcw className="size-3" /> Reset
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  barColor = 'bg-emerald-500',
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  barColor?: string;
  progress?: number;
}) {
  return (
    <Card className="group rounded-xl bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span
        className={cn(
          'grid size-8 place-items-center rounded-lg transition-transform group-hover:scale-110',
          color,
        )}
      >
        {icon}
      </span>
      <p className="mt-3 text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium text-foreground/80">{label}</p>
      {progress != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${Math.min(100, Math.round(progress))}%` }}
          />
        </div>
      )}
    </Card>
  );
}
