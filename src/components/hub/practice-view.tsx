'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CalendarCheck,
  Camera,
  ChevronDown,
  Dumbbell,
  GraduationCap,
  Layers,
  Lightbulb,
  Loader2,
  MessageCircleQuestion,
  NotebookPen,
  Repeat2,
  RotateCcw,
  Star,
  Target,
  Trophy,
  X,
  Zap,
  CheckCircle2,
  HandHeart,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  materials as allMaterials,
} from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { flashcardsDueFor, useStudyProgress } from '@/lib/study-progress';
import { useLocalStorage } from '@/lib/use-local-storage';
import { getAlignmentStats, getExerciseStage } from '@/lib/curriculum-state';
import { simuladoMissedMap } from '@/lib/mistake-notebook';
import {
  findMathSimuladoRunOficial,
  practiceExamBriefFor,
  type PracticeExamBrief,
} from '@/lib/math-exam-prep';
import type { AttemptMode } from '@/lib/simulado-resume';
import { openSimulado, openTutor, type OpenSimuladoDetail } from '@/lib/hub-events';
import { captureElementToDataUrl } from '@/lib/dom-capture';
import type { OpenPracticeDetail } from '@/lib/hub-events';
import { FlashcardsView } from '@/components/hub/flashcards-view';
import {
  exercises,
  getExercisesByDiscipline,
  getExerciseStats,
  type Exercise,
} from '@/lib/exercise-extractor';
import { SimuladoView, type SimuladoConfig } from '@/components/hub/simulado-view';
import { ReviewModeDialog, buildReviewQueue } from '@/components/hub/review-mode-dialog';

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
  material_professor: 'Material do Prof.',
};

type PracticeMode = 'exercicios' | 'flashcards';

// Estático (depende só do acervo fixo) — computado UMA vez por módulo, não por render.
const EXERCISE_STATS = getExerciseStats();
// Alinhamento material-first (estado da turma) — acervo é estático, calcula 1×.
const ALIGN_STATS = getAlignmentStats();

export function PracticeView({
  simuladoReq,
  practiceReq,
}: {
  /** Pedido externo p/ abrir o Simulado pré-configurado (ex.: prova de Matemática). */
  simuladoReq?: { detail: OpenSimuladoDetail; nonce: number };
  /** Pedido externo p/ pré-filtrar a disciplina (Plano de Recuperação). */
  practiceReq?: { detail: OpenPracticeDetail; nonce: number };
} = {}) {
  const sp = useStudyProgress();
  const [mode, setMode] = React.useState<PracticeMode>('exercicios');

  // Pedido externo pode escolher a ABA inicial (kit da véspera → flashcards).
  React.useEffect(() => {
    if (practiceReq?.detail?.mode === 'flashcards') setMode('flashcards');
  }, [practiceReq?.nonce, practiceReq]);

  // LEITNER VIVO (116): render-time com o seletor puro — o badge da aba
  // flashcards refresca a cada re-render (troca de aba, retorno de run),
  // não fica preso ao memo cacheado do primeiro mount.
  const dueCount = flashcardsDueFor(sp.allFlashcards, Date.now()).length;

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
        <ExercisesPanel simuladoReq={simuladoReq} practiceReq={practiceReq} />
      </TabsContent>
      <TabsContent value="flashcards" className="mt-0">
        <FlashcardsView />
      </TabsContent>
    </Tabs>
  );
}

/**
 * PRESET DA AV1 (29/09 simulado · 01/10 prova) — escopo REAL da prova:
 * Álgebra Matricial (matrizes) + Lógica Matemática. Determinantes e Sistemas
 * Lineares NÃO entram (tópicos "—" do acervo ficam de fora do sorteio).
 */
const MATH_EXAM_PRESET = {
  discipline: 'TEC.1984',
  difficulty: 'all' as const,
  quantity: 10,
  durationMin: 60,
  aligned: true,
  topics: ['Álgebra Matricial', 'Lógica Matemática'],
};

/**
 * A GRAMÁTICA DE COR DO HUB na faixa da semana (mesma família do caderno da
 * 91 e dos flashcards da 90): sólido + pulso nos "é hoje" (âmbar simulado,
 * rose prova), emerald sólido no REGISTRO (sem pulso — feito é calmo) e tinta
 * translúcida na espera (véspera). Cor = significado, em toda superfície.
 */
const PRACTICE_EXAM_VISUAL: Record<
  PracticeExamBrief['kind'],
  {
    shell: string;
    text: string;
    sub: string;
    iconBox: string;
    icon: React.ReactNode;
    btn: string;
  }
> = {
  'simulado-hoje': {
    shell:
      'border-amber-500 bg-amber-500 shadow-md shadow-amber-500/30 dark:border-amber-400 dark:bg-amber-400',
    text: 'text-white dark:text-zinc-900',
    sub: 'text-white/90 dark:text-zinc-900/80',
    iconBox: 'bg-white/20 dark:bg-zinc-900/15',
    icon: <CalendarCheck className="size-4 animate-pulse" aria-hidden />,
    btn: 'bg-white text-amber-600 hover:bg-amber-50 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-zinc-800',
  },
  'simulado-feito': {
    shell: 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500',
    text: 'text-white dark:text-zinc-900',
    sub: 'text-white/90 dark:text-zinc-900/80',
    iconBox: 'bg-white/20 dark:bg-zinc-900/15',
    icon: <CheckCircle2 className="size-4" aria-hidden />,
    btn: 'bg-white text-emerald-600 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-zinc-800',
  },
  vespera: {
    shell:
      'border-amber-500/40 bg-amber-500/[0.07] dark:border-amber-400/40 dark:bg-amber-400/[0.06]',
    text: 'text-amber-600 dark:text-amber-300',
    sub: 'text-amber-700/80 dark:text-amber-300/75',
    iconBox: 'bg-amber-500/15 dark:bg-amber-400/15',
    icon: <Zap className="size-4" aria-hidden />,
    btn: 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-400 dark:text-zinc-900 dark:hover:bg-amber-300',
  },
  'prova-hoje': {
    shell:
      'border-rose-500 bg-rose-500 shadow-md shadow-rose-500/30 dark:border-rose-400 dark:bg-rose-400',
    text: 'text-white dark:text-zinc-900',
    sub: 'text-white/90 dark:text-zinc-900/80',
    iconBox: 'bg-white/20 dark:bg-zinc-900/15',
    icon: <GraduationCap className="size-4 animate-pulse" aria-hidden />,
    btn: 'bg-white text-rose-600 hover:bg-rose-50 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-zinc-800',
  },
};

/**
 * Faixa da semana da Av1 no TOPO da aba Exercícios — o palco aprende o dia
 * dele: no simulado anuncia e abre o run já configurado; com o run flipa
 * "feito ✓" e aponta a fila guiada desta mesma aba; na véspera promove a
 * revisão leve; na prova manda descansar. CTA opcional (brief.cta null = sem
 * botão — e o pai cala o CTA do "feito" quando a fila guiada está vazia).
 */
function PracticeExamStrip({
  brief,
  ctaLabel,
  onCta,
}: {
  brief: PracticeExamBrief;
  /** Rótulo final do CTA (o pai decide se existe — null esconde o botão). */
  ctaLabel: string | null;
  onCta?: () => void;
}) {
  const v = PRACTICE_EXAM_VISUAL[brief.kind];
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        v.shell,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
            v.iconBox,
          )}
        >
          {v.icon}
        </span>
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold leading-tight', v.text)}>{brief.titulo}</p>
          <p className={cn('mt-1 text-xs leading-snug', v.sub)}>{brief.chamada}</p>
        </div>
      </div>
      {ctaLabel && onCta ? (
        <Button
          size="sm"
          onClick={onCta}
          className={cn('shrink-0 gap-1.5 font-semibold', v.btn)}
          aria-label={ctaLabel}
        >
          <Target className="size-3.5" aria-hidden />
          <span className="tabular-nums">{ctaLabel}</span>
        </Button>
      ) : null}
    </div>
  );
}

function ExercisesPanel({
  simuladoReq,
  practiceReq,
}: {
  simuladoReq?: { detail: OpenSimuladoDetail; nonce: number };
  practiceReq?: { detail: OpenPracticeDetail; nonce: number };
} = {}) {
  const sp = useStudyProgress();
  const [filterDiscipline, setFilterDiscipline] = React.useState<string>('all');
  const [filterTopic, setFilterTopic] = React.useState<string>('all');
  /** Conjunto material-first (ex.: a folha da S3 → as 8 questões que saíram
   *  dela): só as questões ligadas ao material ficam na lista. 'all' = off. */
  const [filterMaterial, setFilterMaterial] = React.useState<string>('all');
  /** Apoio do plano (ex.: o dia D-4 → mat-ex07 + mat-ex08): só os exercícios
   *  EXATOS da tarefa ficam na lista. [] = off (a gramática da 94: o filtro
   *  nunca prende — X devolve a lista completa). */
  const [filterExercises, setFilterExercises] = React.useState<string[]>([]);
  /** Só questões MARCADAS (⭐) — revisão focada antes da prova. */
  const [onlyMarked, setOnlyMarked] = React.useState(false);
  const [simuladoOpen, setSimuladoOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  /** Foco vindo do Caderno de Erros: filtra disciplina + tópico e rola até a lista. */
  const focarErros = (code: string, topic: string) => {
    setFilterDiscipline(code);
    setFilterTopic(topic);
    requestAnimationFrame(() =>
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  // Pré-filtro de disciplina (+ tópico opcional + conjunto material-first +
  // apoio do plano) vindo de fora (ex.: card Plano de Recuperação; foco por
  // tópico pós-simulado; folha da S3 → as 8 questões; apoio do dia → os
  // exercícios EXATOS). Pedido SEM conjunto/apoio limpa os anteriores (a
  // abertura manual sempre limpa — lição do vazamento da 82).
  React.useEffect(() => {
    const req = practiceReq?.detail;
    const code = req?.disciplineCode;
    if (code && getDisciplineByCode(code)) {
      setFilterDiscipline(code);
      setFilterTopic(req.topic ?? 'all');
      setFilterMaterial(req.linkedMaterial ?? 'all');
      setFilterExercises(req.exerciseIds ?? []);
    }
  }, [practiceReq?.nonce, practiceReq]);
  // PADRÃO MATERIAL-FIRST: por padrão só aparece o que já foi dado em sala.
  // Persistido — o aluno escolhe se quer se adiantar.
  const [onlyAligned, setOnlyAligned] = useLocalStorage<boolean>('hub:praticar:soEmSala', true);
  // Pré-config do simulado (preset da prova vindo do card do Painel).
  const [simuladoInitialConfig, setSimuladoInitialConfig] = React.useState<
    Partial<SimuladoConfig> | undefined
  >(undefined);
  // Natureza da tentativa do pedido externo (drill de tópico = 'topico';
  // preset da prova e aberturas comuns = 'prova'). Idem config: reiniciada
  // a cada evento, para não vazar no próximo pedido.
  const [simuladoInitialMode, setSimuladoInitialMode] = React.useState<AttemptMode>('prova');
  // Modo Revisão: fila guiada de ★ marcadas + Caderno de Erros.
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const reviewCount = React.useMemo(
    () => buildReviewQueue(sp.progress).length,
    [sp.progress],
  );

  // Pedido externo → abre já configurado. IMPORTANTE: TODA abertura por evento
  // resolve o initialConfig AQUI (inclusive "sem config" → undefined), senão o
  // preset de um pedido anterior vazava para o pedido novo (bug real: clicar no
  // marco da Av1 e depois abrir pelo botão/Caderno aplicava o preset velho).
  React.useEffect(() => {
    if (!simuladoReq || simuladoReq.nonce === 0) return;
    const d = simuladoReq.detail;
    if (d.preset === 'math_exam') {
      setSimuladoInitialMode('prova');
      setSimuladoInitialConfig(MATH_EXAM_PRESET);
    } else if (d.topicScope) {
      // Drill de 1 tópico (ex.: replay do pior tópico da tendência no Histórico):
      // prova curta, no ritmo da turma, cronômetro leve — ajustável no setup.
      setSimuladoInitialMode('topico');
      setSimuladoInitialConfig({
        discipline: d.disciplineCode ?? 'all',
        difficulty: 'all',
        quantity: 5,
        durationMin: 15,
        aligned: true,
        topics: [d.topicScope],
      });
    } else if (d.disciplineCode && getDisciplineByCode(d.disciplineCode)) {
      setSimuladoInitialMode('prova');
      setSimuladoInitialConfig({ discipline: d.disciplineCode });
    } else {
      setSimuladoInitialMode('prova');
      setSimuladoInitialConfig(undefined);
    }
    setSimuladoOpen(true);
  }, [simuladoReq?.nonce]);

  const filteredExercises = React.useMemo(() => {
    let list = exercises;
    if (filterDiscipline !== 'all') {
      list = list.filter((e) => e.disciplineCode === filterDiscipline);
    }
    if (filterTopic !== 'all') {
      list = list.filter((e) => e.topic === filterTopic);
    }
    if (filterMaterial !== 'all') {
      list = list.filter((e) => (e.linkedMaterials ?? []).includes(filterMaterial));
    }
    if (filterExercises.length > 0) {
      list = list.filter((e) => filterExercises.includes(e.id));
    }
    if (onlyAligned) {
      list = list.filter((e) => getExerciseStage(e) === 'em_sala');
    }
    if (onlyMarked) {
      list = list.filter((e) => sp.progress.exerciseProgress[e.id]?.marked);
    }
    return list;
  }, [
    filterDiscipline,
    filterTopic,
    filterMaterial,
    filterExercises,
    onlyAligned,
    onlyMarked,
    sp.progress.exerciseProgress,
  ]);

  const markedCount = React.useMemo(
    () =>
      Object.values(sp.progress.exerciseProgress ?? {}).filter((e) => e.marked).length,
    [sp.progress.exerciseProgress],
  );

  // Tópicos disponíveis com base na disciplina selecionada
  const availableTopics = React.useMemo(() => {
    if (filterDiscipline === 'all') return Array.from(new Set(exercises.map((e) => e.topic))).sort();
    return Array.from(new Set(getExercisesByDiscipline(filterDiscipline).map((e) => e.topic))).sort();
  }, [filterDiscipline]);

  const stats = EXERCISE_STATS;
  const totalTried = sp.totalExercisesTried;
  const totalSolved = sp.totalExercisesSolved;
  const totalNeededHelp = React.useMemo(
    () => Object.values(sp.progress.exerciseProgress ?? {}).filter((e) => e.neededHelp).length,
    [sp.progress.exerciseProgress],
  );

  // Semana da Av1 no TOPO da aba — RENDER-TIME no corpo do componente (lição
  // 79: sem memo nem interval, reage a mock de relógio no próximo render e a
  // StorageEvent quando o run é registrado). O run oficial vem da FONTE
  // ÚNICA findMathSimuladoRunOficial (85/86/88/89/90/91) — o REGISTRO vence
  // o relógio. reviewCount já é a fila guiada real (★ + caderno) — o CTA do
  // "feito"/véspera só existe com fila real (fila vazia = botão cala).
  const simuladoRunOficial = findMathSimuladoRunOficial(sp.progress.simuladoRuns);
  const examBrief = practiceExamBriefFor(
    new Date(),
    reviewCount,
    simuladoRunOficial
      ? { solved: simuladoRunOficial.solved, total: simuladoRunOficial.total }
      : null,
  );
  const examOnCta =
    examBrief?.kind === 'simulado-hoje'
      ? () => openSimulado({ preset: 'math_exam' })
      : examBrief?.kind === 'simulado-feito' || examBrief?.kind === 'vespera'
        ? () => setReviewOpen(true)
        : undefined;
  const examCtaLabel =
    examBrief?.cta == null
      ? null
      : examBrief.kind === 'simulado-hoje'
        ? examBrief.cta
        : reviewCount > 0
          ? `${examBrief.cta} (${reviewCount})`
          : null;

  return (
    <div className="space-y-4">
      {/* Semana da Av1 no topo — o palco abre o dia (fora da janela: null). */}
      {examBrief ? (
        <PracticeExamStrip brief={examBrief} ctaLabel={examCtaLabel} onCta={examOnCta} />
      ) : null}

      {/* Banner material-first: estado da turma */}
      <Card className="rounded-xl border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent p-3.5 shadow-sm">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              No ritmo da turma
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                {ALIGN_STATS.emSala} em sala
              </Badge>
              <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                {ALIGN_STATS.adiantado} futuros
              </Badge>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              O acervo se alinha automaticamente aos materiais reais enviados:
              exercícios de tópicos ainda não dados em aula ficam de fora até a
              aula acontecer (padrão material-first).
            </p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={!onlyAligned}
              onCheckedChange={(v) => setOnlyAligned(!v)}
              aria-label="Mostrar conteúdos futuros"
            />
            Mostrar futuros
          </label>
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredExercises.length} de {ALIGN_STATS.total} exercícios no filtro atual. Marque como tentou, resolveu ou precisou de ajuda.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReviewOpen(true)}
            title="Revisão guiada: suas ★ marcadas + Caderno de Erros, uma por vez"
            className={cn(
              'group h-9 gap-2 border text-xs font-medium shadow-sm transition-all',
              // COR = SIGNIFICADO na fila de ações: na véspera a revisão guiada
              // é O plano do dia (offset 1, kind 'revisao') — com fila real ela
              // sobe de tinta translúcida para sólida (o mesmo salto do hero).
              examBrief?.kind === 'vespera' && reviewCount > 0
                ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/25 hover:bg-amber-600 dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-900 dark:hover:bg-amber-300'
                : reviewCount > 0
                  ? 'border-amber-500/40 bg-amber-500/[0.07] text-amber-700 hover:bg-amber-500/15 hover:shadow-md dark:text-amber-400'
                  : 'text-muted-foreground',
            )}
          >
            <NotebookPen className="size-3.5 transition-transform group-hover:scale-110" />
            Revisão guiada
            {reviewCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
                {reviewCount}
              </span>
            )}
          </Button>
          <Button
            size="sm"
            // Abertura MANUAL sempre limpa: sem isso, a pré-config de um pedido
            // externo anterior (preset da Av1, drill de tópico) vazava para cá.
            // O MODO idem — um treino de tópico antigo não pode rotular a prova nova.
            onClick={() => {
              setSimuladoInitialConfig(undefined);
              setSimuladoInitialMode('prova');
              setSimuladoOpen(true);
            }}
            className={cn(
              'group gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/25 transition-all hover:shadow-emerald-600/40 hover:shadow-xl',
              // COR = SIGNIFICADO: no dia do simulado sem run, ESTE é o botão
              // da manhã — o halo âmbar marca a ação do dia sem mudar a marca
              // esmeralda (a faixa acima conta o porquê; o halo só aponta).
              examBrief?.kind === 'simulado-hoje' &&
                'ring-2 ring-amber-400/60 ring-offset-2 ring-offset-background dark:ring-amber-300/50',
            )}
          >
            <Target className="size-3.5 transition-transform group-hover:scale-110" /> Simulado Pro
          </Button>
        </div>
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

      {/* Caderno de Erros: questões marcadas "precisei de ajuda" ou tentou/não resolveu */}
      <MistakeNotebook onFocar={focarErros} />

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
          <button
            type="button"
            onClick={() => setOnlyMarked((v) => !v)}
            aria-pressed={onlyMarked}
            title="Só as questões que você marcou com ★"
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors',
              onlyMarked
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Star className={cn('size-3.5', onlyMarked && 'fill-current')} />
            Marcadas
            {markedCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold tabular-nums">
                {markedCount}
              </span>
            )}
          </button>
          {/* Chip do CONJUNTO material-first — aparece quando um pedido externo
              pediu o conjunto exato de um material (ex.: a folha da S3 → as 8
              questões). Família violeta (a mesma do chip 'praticar' que o
              criou), contagem ao vivo e X para limpar — o filtro nunca prende
              o aluno: um clique devolve a lista completa do filtro atual. */}
          {filterMaterial !== 'all' &&
            (() => {
              const mat = allMaterials.find((m) => m.id === filterMaterial);
              return (
                <div
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/50 bg-violet-500/10 px-2.5 py-2 text-xs font-medium text-violet-700 dark:text-violet-300"
                  title="Conjunto de questões ligadas ao material — X para limpar"
                >
                  <Layers className="size-3.5 shrink-0" aria-hidden />
                  <span className="max-w-52 truncate sm:max-w-64">
                    Conjunto:{' '}
                    <span className="font-semibold">{mat?.title ?? filterMaterial}</span>
                  </span>
                  <span className="rounded-full bg-violet-500/20 px-1.5 text-[10px] font-semibold tabular-nums">
                    {filteredExercises.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterMaterial('all')}
                    aria-label="Limpar o filtro de conjunto"
                    className="rounded-full p-0.5 transition-colors hover:bg-violet-500/20"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </div>
              );
            })()}
          {/* Chip do APOIO do plano — aparece quando um pedido externo pediu
              os exercícios EXATOS de uma tarefa (ex.: 'Apoio no Praticar:
              mat-ex07 e mat-ex08' → os 2, um clique). A mesma família violeta
              do conjunto, com os IDs no rótulo (o aluno sabe O QUE abre),
              contagem ao vivo e X para limpar. */}
          {filterExercises.length > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/50 bg-violet-500/10 px-2.5 py-2 text-xs font-medium text-violet-700 dark:text-violet-300"
              title="Exercícios de apoio do plano — X para limpar"
            >
              <Dumbbell className="size-3.5 shrink-0" aria-hidden />
              <span className="max-w-52 truncate sm:max-w-64">
                Apoio:{' '}
                <span className="font-semibold">{filterExercises.join(' · ')}</span>
              </span>
              <span className="rounded-full bg-violet-500/20 px-1.5 text-[10px] font-semibold tabular-nums">
                {filterExercises.length}
              </span>
              <button
                type="button"
                onClick={() => setFilterExercises([])}
                aria-label="Limpar o filtro de apoio"
                className="rounded-full p-0.5 transition-colors hover:bg-violet-500/20"
              >
                <X className="size-3" aria-hidden />
              </button>
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {filteredExercises.length} exercício(s)
          </div>
        </div>
      </Card>

      {/* Lista de exercícios */}
      <div className="space-y-2" ref={listRef}>
        {filteredExercises.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 rounded-xl bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <RotateCcw className="size-6 text-muted-foreground/50" aria-hidden />
            {onlyAligned ? (
              <>
                Tudo aqui já está no ritmo da turma com esses filtros.
                <button
                  type="button"
                  onClick={() => setOnlyAligned(false)}
                  className="text-xs font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
                >
                  Ver também os conteúdos futuros ({ALIGN_STATS.adiantado})
                </button>
              </>
            ) : (
              <>Nenhum exercício com esses filtros. Ajuste a seleção acima.</>
            )}
          </Card>
        ) : (
          filteredExercises.map((ex, i) => (
            <ExerciseCard key={ex.id} exercise={ex} index={i} />
          ))
        )}
      </div>

      {/* Simulado Pro (prova com cronômetro) */}
      <SimuladoView
        open={simuladoOpen}
        onOpenChange={setSimuladoOpen}
        initialConfig={simuladoInitialConfig}
        initialMode={simuladoInitialMode}
      />

      {/* Modo Revisão (★ + Caderno de Erros, uma questão por vez) */}
      <ReviewModeDialog open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}

interface MistakeItem {
  ex: Exercise;
  kind: 'ajuda' | 'erro';
  lastPracticedAt: string;
  /** "Erros de sempre": recaídas após já ter resolvido (0/undefined = 1ª vez). */
  lapses?: number;
}

/**
 * Caderno de Erros — todo exercício marcado como "precisei de ajuda" ou
 * tentado e não resolvido vira uma linha aqui, mais recente primeiro.
 * Cada linha tem 2 ações: FOCAR (filtra a lista no tópico) e PERGUNTAR AO
 * TUTOR (abre o chat na disciplina certa com a dúvida já escrita).
 */
function MistakeNotebook({ onFocar }: { onFocar: (code: string, topic: string) => void }) {
  const sp = useStudyProgress();
  const [expanded, setExpanded] = React.useState(false);
  // Questões que TAMBÉM aparecem perdidas em simulado(s) — mesmo casamento do
  // caderno completo (Progresso): o badge "também no simulado" mantém as duas
  // superfícies contando a mesma história.
  const runMisses = React.useMemo(() => simuladoMissedMap(sp.progress), [sp.progress]);

  const mistakes = React.useMemo<MistakeItem[]>(() => {
    return Object.entries(sp.progress.exerciseProgress ?? {})
      .filter(([, v]) => v.neededHelp || (v.tried && !v.solved))
      .map(([id, v]): MistakeItem | null => {
        const ex = exercises.find((e) => e.id === id);
        if (!ex) return null;
        return {
          ex,
          kind: v.neededHelp ? ('ajuda' as const) : ('erro' as const),
          lastPracticedAt: v.lastPracticedAt,
          lapses: v.lapses,
        };
      })
      .filter((m): m is MistakeItem => m !== null)
      // "Erros de sempre" primeiro, depois a recência — mesma ordem do
      // caderno completo (Progresso) e da revisão dirigida (Simulado Pro).
      .sort((a, b) => {
        const la = a.lapses ?? 0;
        const lb = b.lapses ?? 0;
        if (la !== lb) return lb - la;
        return (b.lastPracticedAt || '').localeCompare(a.lastPracticedAt || '');
      });
  }, [sp.progress.exerciseProgress, runMisses]);

  if (mistakes.length === 0) return null;

  const visible = expanded ? mistakes : mistakes.slice(0, 3);
  // Tópicos com mais erros — o "onde dói" do aluno.
  const topicCounts = mistakes.reduce<Record<string, number>>((acc, m) => {
    const key = `${m.ex.disciplineCode}::${m.ex.topic}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const topicoMaisErros = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <Card className="overflow-hidden rounded-xl border-amber-500/30 bg-gradient-to-r from-amber-500/[0.06] to-transparent shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/20 px-3.5 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <NotebookPen className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Caderno de Erros
            <Badge className="ml-2 border-0 bg-amber-500 text-[10px] text-white tabular-nums">
              {mistakes.length}
            </Badge>
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Questões que você marcou como “precisei de ajuda” ou tentou e não resolveu.
            {topicoMaisErros && topicoMaisErros[1] > 1 && (
              <> Mais erros em{' '}
              <button
                type="button"
                className="font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
                onClick={() => {
                  const [code, topic] = topicoMaisErros[0].split('::');
                  onFocar(code, topic);
                }}
              >
                {topicoMaisErros[0].split('::')[1]}
              </button>
              </>)}
            .
          </p>
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {visible.map(({ ex, kind, lapses }) => {
          const disc = getDisciplineByCode(ex.disciplineCode);
          const color = getColorClasses(disc?.color ?? 'slate');
          return (
            <li key={ex.id} className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn('border text-[10px]', color.badge)}>
                    {disc?.shortName ?? ex.disciplineCode}
                  </Badge>
                  <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                    {ex.topic}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px]', difficultyColor[ex.difficulty])}>
                    {difficultyLabel[ex.difficulty]}
                  </Badge>
                  {kind === 'ajuda' ? (
                    <Badge className="border-0 bg-amber-500/90 text-[9px] text-white">precisei de ajuda</Badge>
                  ) : (
                    <Badge className="border-0 bg-rose-500/90 text-[9px] text-white">não resolvi</Badge>
                  )}
                  {(lapses ?? 0) > 0 && (
                    <Badge
                      variant="outline"
                      title="Erro de sempre: você já tinha resolvido este item e voltou a errar — prioridade máxima na véspera."
                      className="border-rose-400/60 bg-rose-500/10 text-[9px] font-semibold text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300"
                    >
                      <Repeat2 className="mr-0.5 size-2.5" aria-hidden />
                      voltou {lapses}×
                    </Badge>
                  )}
                  {(() => {
                    const m = runMisses.get(ex.id);
                    if (!m) return null;
                    // Crônico entre corridas (≥ 2 simulados) SEM recaída de
                    // exercício (lapses 0): o badge sobe para o estilo forte
                    // "N× no simulado" — mesma gramática do caderno completo,
                    // que aqui só não aparece quando o "voltou N×" já cobre.
                    if (m.dates.length >= 2 && (lapses ?? 0) <= 0) {
                      return (
                        <Badge
                          variant="outline"
                          title={`Erro de sempre: perdida em ${m.dates.length} simulados diferentes e continua pendente — prioridade máxima na véspera.`}
                          className="border-rose-400/60 bg-rose-500/10 text-[9px] font-semibold text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300"
                        >
                          <Repeat2 className="mr-0.5 size-2.5" aria-hidden />
                          {m.dates.length}× no simulado
                        </Badge>
                      );
                    }
                    return (
                      <Badge
                        variant="outline"
                        title={
                          m.dates.length > 1
                            ? `Esta questão também foi ${m.missed ? 'errada' : 'pulada'} em ${m.dates.length} simulados — o caderno completo une tudo numa linha só.`
                            : `Esta questão também foi ${m.missed ? 'errada' : 'pulada'} no simulado — o caderno completo une os dois registros.`
                        }
                        className="border-rose-300/60 bg-rose-500/[0.07] text-[9px] font-medium text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                      >
                        <Target className="mr-0.5 size-2.5" aria-hidden />
                        {m.dates.length > 1 ? `também em ${m.dates.length} simulados` : 'também no simulado'}
                      </Badge>
                    );
                  })()}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/85">{ex.statement}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={() => onFocar(ex.disciplineCode, ex.topic)}
                >
                  <RotateCcw className="size-3" /> Refazer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 border-emerald-500/40 px-2 text-[11px] text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                  onClick={() =>
                    openTutor({
                      disciplineCode: ex.disciplineCode,
                      question: `Estou travando nesta questão (${ex.topic}): "${ex.statement}" — me explica o passo a passo e o conceito por trás, como se fosse cair na prova.`,
                    })
                  }
                >
                  <MessageCircleQuestion className="size-3" /> Tutor
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {mistakes.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-amber-500/20 py-1.5 text-[11px] font-medium text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
        >
          {expanded ? 'Mostrar menos' : `Ver todos os ${mistakes.length} erros`}
          <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} aria-hidden />
        </button>
      )}
    </Card>
  );
}

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const sp = useStudyProgress();
  const progress = sp.progress.exerciseProgress[exercise.id];
  const disc = getDisciplineByCode(exercise.disciplineCode);
  const color = getColorClasses(disc?.color ?? 'slate');
  // Material-first: marca o que ainda não foi dado em aula (visível só com
  // "Mostrar futuros" ligado).
  const stage = getExerciseStage(exercise);

  // PRINT DA QUESTÃO (141 — a porta da LISTA, pedido do dono: "no site dos
  // assuntos, lista e etc"): o conteúdo da questão (enunciado + dica, SEM os
  // controles de progresso) vira imagem e entra direto no chat do tutor via
  // openTutor({image}) — a MESMA porta do print do PDF (139) e dos assuntos
  // (140). Nada toca o disco: o anexo morre com o envio.
  const [capturing, setCapturing] = React.useState(false);
  const questionRef = React.useRef<HTMLDivElement>(null);
  const captureQuestion = async () => {
    const el = questionRef.current;
    if (!el || capturing) return;
    setCapturing(true);
    try {
      const image = await captureElementToDataUrl(el);
      openTutor({ image, imageLabel: 'print da questão', disciplineCode: exercise.disciplineCode, materialId: exercise.linkedMaterials?.[0] });
      toast.success('Print da questão anexado ao tutor — nada foi salvo no seu computador.');
    } catch {
      toast.error('Não consegui capturar esta questão. Tente de novo.');
    } finally {
      setCapturing(false);
    }
  };

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
          // ★ pendente ganha presença visual sutil (precisa de revisão)
          progress?.marked && !progress?.solved && 'border-amber-400/50 bg-amber-500/[0.03]',
        )}
      >
        <div ref={questionRef}>
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
          {stage === 'adiantado' && (
            <Badge
              variant="outline"
              className="border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-600 dark:text-sky-400"
              title="Tópico ainda não dado em aula — no ritmo da turma este exercício fica oculto"
            >
              futuro
            </Badge>
          )}
          {progress?.solved && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="size-2.5" /> Resolvido
            </Badge>
          )}
          {/* Marcar questão (⭐) — vira lista de revisão + revisita fácil com o tutor */}
          <button
            type="button"
            onClick={() => {
              const next = !progress?.marked;
              sp.updateExerciseProgress(exercise.id, { marked: next });
              if (next) toast.success('Questão marcada ★ — use o filtro "Marcadas" para revisar.');
            }}
            aria-pressed={!!progress?.marked}
            aria-label={
              progress?.marked
                ? 'Remover marcação da questão'
                : 'Marcar questão para revisar depois'
            }
            title={progress?.marked ? 'Remover marcação ★' : 'Marcar questão ★ (para revisar depois)'}
            className={cn(
              'ml-auto rounded-md p-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60',
              progress?.marked
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-muted-foreground/50 hover:bg-muted hover:text-foreground',
            )}
          >
            <Star className={cn('size-4', progress?.marked && 'fill-current')} />
          </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{exercise.statement}</p>
          {exercise.hint && (
            <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
              <Lightbulb className="mt-0.5 size-3 shrink-0" /> {exercise.hint}
            </p>
          )}
        </div>

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
          {/* Print da questão (141): a porta da LISTA — vira imagem e entra no
              chat do tutor com a disciplina/material pré-selecionados. */}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto size-7 shrink-0 border-emerald-500/40 p-0 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
            onClick={() => void captureQuestion()}
            disabled={capturing}
            aria-label="Print da questão para o tutor"
            title="Print desta questão — anexa ao tutor para perguntar sobre ela (nada é salvo no seu computador)"
          >
            {capturing ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Camera className="size-3" aria-hidden />
            )}
          </Button>
          {/* Tutor contextual: a IA recebe a questão + a dica, com o material vinculado */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-emerald-500/40 px-2 text-[11px] text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
            onClick={() =>
              openTutor({
                disciplineCode: exercise.disciplineCode,
                materialId: exercise.linkedMaterials?.[0],
                question: `Estou trabalhando esta questão de ${disc?.shortName ?? exercise.disciplineCode} (${exercise.topic}): "${exercise.statement}" — me guie pelo raciocínio passo a passo, sem entregar a resposta final de uma vez.${exercise.hint ? ` A dica do Hub é: "${exercise.hint}".` : ''}`,
              })
            }
          >
            <MessageCircleQuestion className="size-3" /> Perguntar ao tutor
          </Button>
          {progress && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
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
