'use client';

// Simulado Pro — prova simulada com cronômetro, navegação por questões,
// avaliação própria (consegui/não consegui) e resultado com anel de desempenho.
// Substitui o antigo "Modo simulado (5 aleatórios)" por uma experiência completa.

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { disciplines, getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import {
  exercises,
  pickRandomExercises,
  type Exercise,
} from '@/lib/exercise-extractor';

type DifficultyFilter = 'all' | Exercise['difficulty'];

interface SimuladoConfig {
  discipline: string; // 'all' | code
  difficulty: DifficultyFilter;
  quantity: number;
  durationMin: number; // 0 = sem tempo
}

interface QuestionResult {
  solved: boolean | null; // true=consegui, false=não consegui, null=pulado/não vista
}

type Phase = 'setup' | 'running' | 'results';

const DURATION_OPTIONS = [
  { value: 0, label: 'Sem tempo (estudo)' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
];

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SimuladoView({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [phase, setPhase] = React.useState<Phase>('setup');
  const [config, setConfig] = React.useState<SimuladoConfig>({
    discipline: 'all',
    difficulty: 'all',
    quantity: 5,
    durationMin: 15,
  });
  const [questions, setQuestions] = React.useState<Exercise[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [results, setResults] = React.useState<QuestionResult[]>([]);
  const [hintVisible, setHintVisible] = React.useState(false);
  const [remaining, setRemaining] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  // Reset quando abre o diálogo
  React.useEffect(() => {
    if (open) {
      setPhase('setup');
      setIdx(0);
      setHintVisible(false);
      setQuestions([]);
      setResults([]);
      setRemaining(0);
      setElapsed(0);
    }
  }, [open]);

  // Cronômetro (contagem regressiva ou progressiva)
  React.useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      setElapsed((e) => e + 1);
      if (config.durationMin > 0) {
        setRemaining((r) => {
          if (r <= 1) return 0;
          return r - 1;
        });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, config.durationMin]);

  // Alertas sonoros: 1 bip aos 60s, 2 bips aos 10s, 3 bips no tempo esgotado
  React.useEffect(() => {
    if (phase !== 'running' || config.durationMin === 0) return;
    if (remaining === 60) beep(1);
    else if (remaining === 10) beep(2);
  }, [remaining, phase, config.durationMin]);

  const sp = useStudyProgress();

  const pool = React.useMemo(() => {
    let list = exercises;
    if (config.discipline !== 'all') {
      list = list.filter((e) => e.disciplineCode === config.discipline);
    }
    if (config.difficulty !== 'all') {
      list = list.filter((e) => e.difficulty === config.difficulty);
    }
    return list;
  }, [config.discipline, config.difficulty]);

  function start(cfg: SimuladoConfig = config) {
    // Sorteio com seed diferente a cada tentativa (evita repetir o mesmo conjunto)
    let picked: Exercise[] = [];
    const seedBase = Date.now();
    // pickRandomExercises sortea do acervo completo — filtramos antes re-implementando
    // a escolha com seed determinística no pool filtrado:
    const shuffled = shuffle(pool, seedBase);
    picked = shuffled.slice(0, Math.min(cfg.quantity, shuffled.length));
    if (picked.length === 0) {
      toast.error('Nenhum exercício com esses filtros. Ajuste a seleção.');
      return;
    }
    setQuestions(picked);
    setResults(picked.map(() => ({ solved: null })));
    setIdx(0);
    setHintVisible(false);
    setRemaining(cfg.durationMin * 60);
    setElapsed(0);
    setPhase('running');
  }

  function mark(solved: boolean) {
    const ex = questions[idx];
    if (!ex) return;
    setResults((r) => {
      const next = [...r];
      next[idx] = { solved };
      return next;
    });
    // Registra no progresso em tempo real (nada se perde se fechar)
    sp.updateExerciseProgress(ex.id, solved ? { tried: true, solved: true } : { tried: true });
    // Avança automaticamente (fica na última para revisar)
    if (idx < questions.length - 1) {
      setIdx(idx + 1);
      setHintVisible(false);
    }
  }

  function finish() {
    recordRun();
    beep(3);
    setPhase('results');
  }

  /** Registra a tentativa no histórico (progress-view exibe a evolução). */
  function recordRun() {
    if (questions.length === 0) return;
    sp.addSimuladoRun({
      total: questions.length,
      solved: results.filter((r) => r.solved === true).length,
      missed: results.filter((r) => r.solved === false).length,
      skipped: results.filter((r) => r.solved === null).length,
      durationSec: elapsed,
      filters: {
        discipline: config.discipline === 'all' ? undefined : config.discipline,
        difficulty: config.difficulty === 'all' ? undefined : config.difficulty,
        durationMin: config.durationMin || undefined,
      },
    });
  }

  // Tempo esgotado → encerra automaticamente
  React.useEffect(() => {
    if (phase === 'running' && config.durationMin > 0 && remaining === 0 && elapsed > 0) {
      finish();
      toast.warning('⏰ Tempo esgotado! Simulado encerrado.');
    }
  }, [remaining, phase]);

  // Atalhos de teclado no modo running: 1=consegui, 2=não consegui,
  // ←/→ navegam, D alterna a dica. Usa fase de captura + stopPropagation
  // para SUPRIMIR os atalhos globais da Command Palette (1-8 trocam de aba).
  React.useEffect(() => {
    if (!open || phase !== 'running') return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      const isOurs =
        e.key === 'ArrowRight' ||
        e.key === 'ArrowLeft' ||
        e.key === '1' ||
        e.key === '2' ||
        e.key.toLowerCase() === 'd';
      if (!isOurs) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'ArrowRight') {
        setIdx((i) => Math.min(questions.length - 1, i + 1));
        setHintVisible(false);
      } else if (e.key === 'ArrowLeft') {
        setIdx((i) => Math.max(0, i - 1));
        setHintVisible(false);
      } else if (e.key === '1') {
        mark(true);
      } else if (e.key === '2') {
        mark(false);
      } else if (e.key.toLowerCase() === 'd') {
        setHintVisible((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, phase, questions.length, idx]);

  const solvedCount = results.filter((r) => r.solved === true).length;
  const missedCount = results.filter((r) => r.solved === false).length;
  const skippedCount = results.filter((r) => r.solved === null).length;
  const pct = questions.length > 0 ? Math.round((solvedCount / questions.length) * 100) : 0;

  const timeInfo =
    config.durationMin > 0
      ? { label: 'Tempo restante', value: fmtClock(remaining) }
      : { label: 'Tempo decorrido', value: fmtClock(elapsed) };
  const timePct =
    config.durationMin > 0 ? (remaining / (config.durationMin * 60)) * 100 : 100;
  const barColor =
    timePct > 50 ? 'bg-emerald-500' : timePct > 20 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto overflow-x-hidden rounded-xl p-0">
        {phase === 'setup' && (
          <SetupScreen
            config={config}
            setConfig={setConfig}
            poolCount={pool.length}
            onStart={() => start()}
          />
        )}

        {phase === 'running' && questions[idx] && (
          <ExamScreen
            questions={questions}
            results={results}
            idx={idx}
            hintVisible={hintVisible}
            timeInfo={timeInfo}
            barColor={barColor}
            timePct={timePct}
            onHintToggle={() => setHintVisible((v) => !v)}
            onMark={mark}
            onNavigate={(i) => {
              setIdx(i);
              setHintVisible(false);
            }}
            onFinish={finish}
          />
        )}

        {phase === 'results' && (
          <ResultsScreen
            questions={questions}
            results={results}
            solvedCount={solvedCount}
            missedCount={missedCount}
            skippedCount={skippedCount}
            pct={pct}
            elapsed={elapsed}
            onRetryMissed={() => {
              const missed = questions.filter((q, i) => results[i].solved !== true);
              // reinicia com apenas as questões erradas/puladas
              setQuestions(missed);
              setResults(missed.map(() => ({ solved: null })));
              setIdx(0);
              setHintVisible(false);
              setRemaining(config.durationMin * 60);
              setElapsed(0);
              setPhase('running');
            }}
            onNew={() => {
              setPhase('setup');
              setIdx(0);
              setHintVisible(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ================= Setup ================= */

function SetupScreen({
  config,
  setConfig,
  poolCount,
  onStart,
}: {
  config: SimuladoConfig;
  setConfig: (c: SimuladoConfig) => void;
  poolCount: number;
  onStart: () => void;
}) {
  return (
    <div>
      <div className="border-b bg-gradient-to-r from-emerald-600/15 via-teal-500/10 to-transparent px-6 py-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <Target className="size-4" />
            </span>
            Simulado Pro
          </DialogTitle>
          <DialogDescription>
            Monte sua prova: cronômetro, filtros e desempenho ao final.
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Disciplina</Label>
          <Select
            value={config.discipline}
            onValueChange={(v) => setConfig({ ...config, discipline: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as disciplinas</SelectItem>
              {disciplines.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Dificuldade</Label>
          <Select
            value={config.difficulty}
            onValueChange={(v) =>
              setConfig({ ...config, difficulty: v as DifficultyFilter })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="facil">Fácil</SelectItem>
              <SelectItem value="medio">Médio</SelectItem>
              <SelectItem value="dificil">Difícil</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Questões</Label>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15].map((n) => (
              <button
                key={n}
                onClick={() => setConfig({ ...config, quantity: n })}
                className={cn(
                  'h-9 rounded-lg border text-sm font-medium transition-all',
                  config.quantity === n
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-sm shadow-emerald-500/20 dark:text-emerald-400'
                    : 'border-border text-muted-foreground hover:border-emerald-500/40 hover:text-foreground',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Duração</Label>
          <Select
            value={String(config.durationMin)}
            onValueChange={(v) => setConfig({ ...config, durationMin: Number(v) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
        <p className="text-xs text-muted-foreground">
          <ListChecks className="mr-1 inline size-3.5" />
          {poolCount} questão(ões) no filtro · dicas liberadas durante a prova
        </p>
        <Button
          onClick={onStart}
          disabled={poolCount === 0}
          className="bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
        >
          <Sparkles className="size-4" /> Iniciar simulado
        </Button>
      </div>
    </div>
  );
}

/* ================= Prova ================= */

function ExamScreen({
  questions,
  results,
  idx,
  hintVisible,
  timeInfo,
  barColor,
  timePct,
  onHintToggle,
  onMark,
  onNavigate,
  onFinish,
}: {
  questions: Exercise[];
  results: QuestionResult[];
  idx: number;
  hintVisible: boolean;
  timeInfo: { label: string; value: string };
  barColor: string;
  timePct: number;
  onHintToggle: () => void;
  onMark: (solved: boolean) => void;
  onNavigate: (i: number) => void;
  onFinish: () => void;
}) {
  const ex = questions[idx];
  const disc = getDisciplineByCode(ex.disciplineCode);
  const color = getColorClasses(disc?.color ?? 'slate');
  const urgent = timePct <= 20;

  return (
    <div>
      {/* Barra de tempo fixa */}
      <div className="border-b px-4 pb-3 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge className="shrink-0 bg-emerald-600 text-white">Simulado</Badge>
            <span className="truncate text-sm font-medium text-muted-foreground">
              Questão {idx + 1} de {questions.length}
            </span>
          </div>
          <div
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm font-semibold tabular-nums',
              configTimeTone(timePct),
            )}
          >
            <AlarmClock className={cn('size-3.5', urgent && 'animate-pulse')} />
            {timeInfo.value}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={cn('h-full rounded-full', barColor)}
            animate={{ width: `${Math.max(0, Math.min(100, timePct))}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn('border text-[10px]', color.badge)}>
                {disc?.shortName ?? ex.disciplineCode}
              </Badge>
              <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                {ex.topic}
              </Badge>
              <Badge variant="outline" className={cn('border text-[10px]', difficultyBadge(ex.difficulty))}>
                {difficultyLabel(ex.difficulty)}
              </Badge>
              {results[idx].solved === true && (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-2.5" /> marcada como resolvida
                </Badge>
              )}
              {results[idx].solved === false && (
                <Badge variant="outline" className="border-rose-300 bg-rose-500/10 text-[10px] text-rose-600 dark:text-rose-400">
                  <XCircle className="size-2.5" /> sem sucesso
                </Badge>
              )}
            </div>

            <ScrollArea className="max-h-[30vh] pr-2">
              <p className="text-sm leading-relaxed text-foreground/90">{ex.statement}</p>
            </ScrollArea>

            {ex.hint && hintVisible && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400"
              >
                <Lightbulb className="mt-0.5 size-3 shrink-0" /> {ex.hint}
              </motion.p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navegação por questões */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {questions.map((_, i) => {
            const r = results[i];
            return (
              <button
                key={i}
                onClick={() => onNavigate(i)}
                aria-label={`Ir para questão ${i + 1}`}
                className={cn(
                  'size-7 rounded-md border text-[11px] font-semibold transition-all',
                  i === idx && 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-background',
                  r.solved === true && 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                  r.solved === false && 'border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400',
                  r.solved === null && i !== idx && 'border-border text-muted-foreground hover:border-emerald-500/40',
                  r.solved === null && i === idx && 'border-emerald-500 text-emerald-600 dark:text-emerald-400',
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rodapé de avaliação — 2 linhas no mobile, 1 no desktop */}
      <div className="space-y-2.5 border-t bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onHintToggle}
            className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400"
          >
            {hintVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {hintVisible ? 'Esconder dica' : 'Ver dica'}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={idx === 0}
              onClick={() => onNavigate(idx - 1)}
            >
              <ArrowLeft className="size-3.5" /> Anterior
            </Button>
            {idx < questions.length - 1 ? (
              <Button variant="outline" size="sm" onClick={() => onNavigate(idx + 1)}>
                Próxima <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={onFinish}>
                <Flag className="size-3.5" /> Encerrar
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-2">
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => onMark(true)}
          >
            <CheckCircle2 className="size-3.5" /> Consegui <kbd className="ml-1 hidden rounded bg-white/20 px-1 text-[10px] lg:inline">1</kbd>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
            onClick={() => onMark(false)}
          >
            <XCircle className="size-3.5" /> Não consegui <kbd className="ml-1 hidden rounded bg-muted px-1 text-[10px] lg:inline">2</kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

function configTimeTone(timePct: number): string {
  if (timePct > 50) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (timePct > 20) return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400';
}

/* ================= Resultado ================= */

function ResultsScreen({
  questions,
  results,
  solvedCount,
  missedCount,
  skippedCount,
  pct,
  elapsed,
  onRetryMissed,
  onNew,
}: {
  questions: Exercise[];
  results: QuestionResult[];
  solvedCount: number;
  missedCount: number;
  skippedCount: number;
  pct: number;
  elapsed: number;
  onRetryMissed: () => void;
  onNew: () => void;
}) {
  const missedList = questions.filter((q, i) => results[i].solved !== true);
  const hasMissed = missedList.length > 0;
  const verdict =
    pct >= 80
      ? { label: 'Excelente!', tone: 'text-emerald-500', icon: Trophy }
      : pct >= 60
        ? { label: 'Bom trabalho', tone: 'text-emerald-500', icon: CheckCircle2 }
        : pct >= 40
          ? { label: 'Continue praticando', tone: 'text-amber-500', icon: Target }
          : { label: 'Hora de revisar', tone: 'text-rose-500', icon: RotateCcw };

  return (
    <div>
      <div className="border-b bg-gradient-to-r from-emerald-600/15 via-teal-500/10 to-transparent px-6 py-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <verdict.icon className="size-4" />
            </span>
            Resultado do simulado
          </DialogTitle>
          <DialogDescription>
            <span className={cn('font-semibold', verdict.tone)}>{verdict.label}</span> · progresso nos
            exercícios e nota no histórico de simulados — tudo salvo automaticamente. ✓
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="flex flex-col items-center gap-6 px-6 py-5 sm:flex-row sm:items-start">
        {/* Anel de desempenho */}
        <div className="relative shrink-0">
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r="56" fill="none" strokeWidth="10" className="stroke-muted" />
            <motion.circle
              cx="66"
              cy="66"
              r="56"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className={pct >= 60 ? 'stroke-emerald-500' : pct >= 40 ? 'stroke-amber-500' : 'stroke-rose-500'}
              strokeDasharray={2 * Math.PI * 56}
              initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - pct / 100) }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{pct}%</span>
            <span className="text-[11px] text-muted-foreground">
              {solvedCount}/{questions.length} resolvidas
            </span>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid w-full grid-cols-2 gap-2.5">
          <MiniStat icon={<CheckCircle2 className="size-3.5" />} label="Consegui resolver" value={String(solvedCount)} tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <MiniStat icon={<XCircle className="size-3.5" />} label="Não consegui" value={String(missedCount)} tone="bg-rose-500/10 text-rose-600 dark:text-rose-400" />
          <MiniStat icon={<ChevronRight className="size-3.5" />} label="Puladas" value={String(skippedCount)} tone="bg-muted text-muted-foreground" />
          <MiniStat icon={<Timer className="size-3.5" />} label="Tempo total" value={fmtClock(elapsed)} tone="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
        </div>
      </div>

      {hasMissed && (
        <div className="px-6 pb-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Para revisar depois ({missedList.length}):
          </p>
          <div className="space-y-1.5">
            {missedList.slice(0, 4).map((q) => (
              <div key={q.id} className="truncate rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                {getDisciplineByCode(q.disciplineCode)?.shortName ?? q.disciplineCode} · {q.topic} — {q.statement.slice(0, 70)}…
              </div>
            ))}
            {missedList.length > 4 && (
              <p className="text-[11px] text-muted-foreground">+ {missedList.length - 4} outras</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-6 py-4">
        <Button variant="ghost" size="sm" onClick={onNew}>
          <RotateCcw className="size-3.5" /> Novo simulado
        </Button>
        {hasMissed && (
          <Button
            size="sm"
            onClick={onRetryMissed}
            className="bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
          >
            <Target className="size-4" /> Refazer só os errados ({missedList.length})
          </Button>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className={cn('grid size-7 shrink-0 place-items-center rounded-md', tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

/* ================= helpers ================= */


/** Bipes de alerta via WebAudio (n=1 aos 60s, 2 aos 10s, 3 no fim). */
function beep(times: number) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const offset = i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = times >= 3 ? 660 : 880;
      const t0 = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    }
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, times * 300 + 400);
  } catch {
    // áudio indisponível — ignora
  }
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  const rand = () => {
    // LCG determinístico — mesmo seed = mesmo sorteio
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function difficultyLabel(d: Exercise['difficulty']): string {
  return d === 'facil' ? 'Fácil' : d === 'medio' ? 'Médio' : 'Difícil';
}

function difficultyBadge(d: Exercise['difficulty']): string {
  return d === 'facil'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : d === 'medio'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400';
}
