'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Eye,
  Flame,
  Layers,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Sprout,
  Target,
  Timer,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  disciplines,
  getDisciplineByCode,
  materials,
} from '@/data/course-data';
import { listAllTopicsOfDiscipline } from '@/lib/study-topics';
import { TutorMarkdown } from '@/components/hub/tutor-markdown';
import {
  flashcardBoxLabel,
  flashcardNextIntervalLabel,
  useStudyProgress,
  type Flashcard,
  type FlashcardGrade,
} from '@/lib/study-progress';
import { cn } from '@/lib/utils';

// ---------- Tipos locais ----------

type Phase = 'plan' | 'pretest' | 'focus' | 'recall' | 'feynman' | 'kaizen';

interface PretestQuestion {
  front: string;
  back: string;
}

const PHASES: Array<{
  key: Phase;
  label: string;
  short: string;
  icon: React.ReactNode;
  tech: string;
}> = [
  {
    key: 'plan',
    label: '1. Planejar',
    short: 'Planejar',
    icon: <Target className="size-4" />,
    tech: 'Intenção + intercalação',
  },
  {
    key: 'pretest',
    label: '2. Pré-teste',
    short: 'Pré-teste',
    icon: <Brain className="size-4" />,
    tech: 'Efeito de pré-teste',
  },
  {
    key: 'focus',
    label: '3. Foco',
    short: 'Foco',
    icon: <Timer className="size-4" />,
    tech: 'Pomodoro / foco profundo',
  },
  {
    key: 'recall',
    label: '4. Recuperar',
    short: 'Recuperar',
    icon: <Layers className="size-4" />,
    tech: 'Recuperação ativa + repetição espaçada',
  },
  {
    key: 'feynman',
    label: '5. Feynman',
    short: 'Feynman',
    icon: <MessageSquare className="size-4" />,
    tech: 'Técnica Feynman',
  },
  {
    key: 'kaizen',
    label: '6. Kaizen',
    short: 'Kaizen',
    icon: <Sprout className="size-4" />,
    tech: 'Kaizen japonês (1% por dia)',
  },
];

const PHASE_ORDER: Phase[] = ['plan', 'pretest', 'focus', 'recall', 'feynman', 'kaizen'];

// ---------- Helpers ----------

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Extrai um array JSON de {front, back} da resposta da IA (tolerante a markdown). */
function parseFlashcardsJSON(raw: string): Array<{ front: string; back: string }> | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) return null;
    const cards = arr
      .map((c) => {
        const o = c as { front?: unknown; back?: unknown };
        const front = typeof o.front === 'string' ? o.front.trim() : '';
        const back = typeof o.back === 'string' ? o.back.trim() : '';
        return front && back ? { front, back } : null;
      })
      .filter((c): c is { front: string; back: string } => !!c);
    return cards.length ? cards : null;
  } catch {
    return null;
  }
}

/** Extrai a nota "X/100" do feedback Feynman. */
function parseFeynmanScore(md: string): number | null {
  const m = md.match(/(\d{1,3})\s*\/\s*100/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

function makeCard(
  disciplineCode: string,
  front: string,
  back: string,
): Omit<Flashcard, 'id'> {
  const now = new Date().toISOString();
  return {
    disciplineCode,
    front: front.slice(0, 300),
    back: back.slice(0, 600),
    source: 'ia',
    createdAt: now,
    box: 0,
    dueAt: now,
    reviews: 0,
    lapses: 0,
  };
}

// ---------- Componente ----------

interface MethodViewProps {
  onOpenStudy?: (disciplineCode?: string, materialId?: string) => void;
}

export function MethodView({ onOpenStudy }: MethodViewProps) {
  const sp = useStudyProgress();

  // ----- Sessão -----
  const [phase, setPhase] = React.useState<Phase>('plan');
  const [disciplineCode, setDisciplineCode] = React.useState<string>('TEC.1687');
  const [topic, setTopic] = React.useState('');
  const [materialId, setMaterialId] = React.useState<string>('');
  const [focusMinutes, setFocusMinutes] = React.useState(25);
  const [startedAt, setStartedAt] = React.useState<string>('');

  // ----- Pré-teste -----
  const [pretest, setPretest] = React.useState<PretestQuestion[]>([]);
  const [pretestLoading, setPretestLoading] = React.useState(false);
  const [pretestAttempts, setPretestAttempts] = React.useState<Record<number, string>>({});
  const [revealed, setRevealed] = React.useState<Record<number, boolean>>({});

  // ----- Foco (timer) -----
  const [secondsLeft, setSecondsLeft] = React.useState(25 * 60);
  const [elapsedFocusSec, setElapsedFocusSec] = React.useState(0);
  const [running, setRunning] = React.useState(false);

  // ----- Recuperação ativa -----
  const [queue, setQueue] = React.useState<Flashcard[]>([]);
  const [reviewIdx, setReviewIdx] = React.useState(0);
  const [showBack, setShowBack] = React.useState(false);
  const [reviewed, setReviewed] = React.useState({ n: 0, correct: 0 });
  const [genLoading, setGenLoading] = React.useState(false);

  // ----- Feynman -----
  const [feynmanText, setFeynmanText] = React.useState('');
  const [feynmanLoading, setFeynmanLoading] = React.useState(false);
  const [feynmanFeedback, setFeynmanFeedback] = React.useState('');
  const [feynmanScore, setFeynmanScore] = React.useState<number | undefined>(undefined);

  // ----- Kaizen -----
  const [kaizenText, setKaizenText] = React.useState('');
  const [kaizenDone, setKaizenDone] = React.useState(false);
  const [registering, setRegistering] = React.useState(false);
  const [lastSummary, setLastSummary] = React.useState<{
    minutes: number;
    cards: number;
    score?: number;
  } | null>(null);

  const discipline = getDisciplineByCode(disciplineCode);
  const discMaterials = React.useMemo(
    () => materials.filter((m) => m.disciplineCode === disciplineCode),
    [disciplineCode],
  );
  const topicSuggestions = React.useMemo(
    () => listAllTopicsOfDiscipline(disciplineCode).slice(0, 8),
    [disciplineCode],
  );

  // Timer
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      setElapsedFocusSec((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Foco chegou a zero → para o timer
  React.useEffect(() => {
    if (secondsLeft === 0 && running) {
      setRunning(false);
      toast.success('Foco concluído! Hora de recuperar o que você estudou. 🧠');
    }
  }, [secondsLeft, running]);

  const totalTimerSec = focusMinutes * 60;
  const timerProgress =
    totalTimerSec > 0
      ? Math.min(100, ((totalTimerSec - secondsLeft) / totalTimerSec) * 100)
      : 0;
  const focusCompleted = secondsLeft === 0 && elapsedFocusSec > 0;

  const phaseIdx = PHASE_ORDER.indexOf(phase);

  function goPhase(next: Phase) {
    setPhase(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startSession() {
    if (!disciplineCode) {
      toast.error('Escolha a disciplina da sessão.');
      return;
    }
    setStartedAt(new Date().toISOString());
    setSecondsLeft(focusMinutes * 60);
    setElapsedFocusSec(0);
    setPretest([]);
    setPretestAttempts({});
    setRevealed({});
    setQueue([]);
    setReviewIdx(0);
    setShowBack(false);
    setReviewed({ n: 0, correct: 0 });
    setFeynmanText('');
    setFeynmanFeedback('');
    setFeynmanScore(undefined);
    setKaizenText('');
    goPhase('pretest');
  }

  function resetSession() {
    setPhase('plan');
    setStartedAt('');
    setLastSummary(null);
    setKaizenDone(false);
    setPretest([]);
    setQueue([]);
    setFeynmanFeedback('');
    setFeynmanScore(undefined);
    setKaizenText('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ----- Pré-teste (IA) -----
  async function generatePretest() {
    setPretestLoading(true);
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'flashcards',
          discipline: discipline?.name ?? 'Estudos',
          topic: topic || discipline?.name,
          question: `Gere 3 perguntas de pré-teste (pergunta + resposta modelo) sobre: ${topic || discipline?.name}`,
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error ?? 'Falha ao gerar perguntas.');
      const parsed = parseFlashcardsJSON(data.answer);
      if (!parsed) throw new Error('A IA respondeu em formato inesperado. Tente de novo.');
      setPretest(parsed.slice(0, 4));
      toast.success(`${Math.min(4, parsed.length)} pergunta(s) de pré-teste prontas.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado no pré-teste.');
    } finally {
      setPretestLoading(false);
    }
  }

  // ----- Geração de flashcards (IA) na fase de recuperação -----
  async function generateCardsAndReview() {
    setGenLoading(true);
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'flashcards',
          discipline: discipline?.name ?? 'Estudos',
          topic: topic || discipline?.name,
          question: `Gere 5 flashcards sobre: ${topic || discipline?.name}`,
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error ?? 'Falha ao gerar cartões.');
      const parsed = parseFlashcardsJSON(data.answer);
      if (!parsed) throw new Error('A IA respondeu em formato inesperado. Tente de novo.');
      sp.addFlashcards(parsed.map((c) => makeCard(disciplineCode, c.front, c.back)));
      const now = Date.now();
      const fresh: Flashcard[] = parsed.map((c, i) => ({
        ...makeCard(disciplineCode, c.front, c.back),
        id: `card-local-${now}-${i}`,
      }));
      setQueue(fresh.slice(0, 5));
      setReviewIdx(0);
      setShowBack(false);
      toast.success(`${parsed.length} cartões gerados e enfileirados para revisão!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado ao gerar cartões.');
    } finally {
      setGenLoading(false);
    }
  }

  function gradeCard(g: FlashcardGrade) {
    const card = queue[reviewIdx];
    if (!card) return;
    sp.gradeFlashcard(card.id, g);
    setReviewed((r) => ({
      n: r.n + 1,
      correct: r.correct + (g === 'good' || g === 'easy' ? 1 : 0),
    }));
    setShowBack(false);
    setReviewIdx((i) => i + 1);
  }

  // ----- Feynman (IA) -----
  async function submitFeynman() {
    if (feynmanText.trim().length < 40) {
      toast.error('Escreva uma explicação com pelo menos 40 caracteres para avaliar.');
      return;
    }
    setFeynmanLoading(true);
    setFeynmanFeedback('');
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'feynman',
          discipline: discipline?.name ?? 'Estudos',
          disciplineCode,
          topic: topic || discipline?.name,
          materialId: materialId || undefined,
          question: `Minha explicação do tema "${topic || discipline?.name}":\n\n${feynmanText.trim().slice(0, 1800)}`,
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error ?? 'Falha ao avaliar.');
      setFeynmanFeedback(data.answer);
      setFeynmanScore(parseFeynmanScore(data.answer) ?? undefined);
      toast.success('Avaliação Feynman recebida!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado na avaliação.');
    } finally {
      setFeynmanLoading(false);
    }
  }

  // ----- Registro final -----
  function registerSession() {
    if (registering) return;
    setRegistering(true);
    try {
      const minutes = Math.round(elapsedFocusSec / 60);
      sp.addFocusSession({
        startedAt: startedAt || new Date().toISOString(),
        disciplineCode,
        topic: topic || discipline?.shortName || 'Tema livre',
        focusMinutes: minutes,
        pretestQuestions: pretest.length,
        flashcardsReviewed: reviewed.n,
        flashcardsCorrect: reviewed.correct,
        feynmanScore,
        kaizenNote: kaizenText.trim().slice(0, 300) || undefined,
      });
      if (kaizenText.trim()) sp.addKaizenEntry(kaizenText, disciplineCode);
      setLastSummary({ minutes, cards: reviewed.n, score: feynmanScore });
      setKaizenDone(true);
      toast.success('Sessão registrada! +1% hoje. 🌱');
      goPhase('kaizen');
    } finally {
      setRegistering(false);
    }
  }

  const dueForDisc = React.useMemo(
    () => sp.flashcardsDue.filter((c) => c.disciplineCode === disciplineCode),
    [sp.flashcardsDue, disciplineCode],
  );

  const currentCard = queue[reviewIdx];
  const pretestAnswered = Object.values(pretestAttempts).filter((a) => a.trim()).length;

  // ---------- Render ----------

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {/* Cabeçalho do método */}
      <Card className="overflow-hidden rounded-2xl border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-card to-teal-50 p-5 shadow-sm sm:p-6 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                Protocolo HUB — Sessão Guiada
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                As 6 técnicas de estudo mais bem avaliadas pela ciência (Dunlosky et al.,
                2013; Karpicke &amp; Blunt, 2011), encadeadas na ordem certa — mais o
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {' '}
                  Kaizen japonês
                </span>{' '}
                de melhoria contínua. Uma sessão = um ciclo completo.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PHASES.map((p) => (
            <Badge
              key={p.key}
              variant="outline"
              className="gap-1 border-emerald-200 bg-emerald-50/60 text-[11px] font-normal text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {p.icon}
              {p.short}
            </Badge>
          ))}
        </div>
      </Card>

      {/* KPIs do método */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Sequência (dias)',
            value: sp.methodStreak,
            icon: <Flame className="size-4 text-orange-500" />,
          },
          {
            label: 'Sessões hoje',
            value: sp.methodStats.sessionsToday,
            icon: <CheckCircle2 className="size-4 text-emerald-500" />,
          },
          {
            label: 'Min. de foco',
            value: sp.methodStats.totalMinutes,
            icon: <Timer className="size-4 text-teal-500" />,
          },
          {
            label: 'Média Feynman',
            value: sp.methodStats.avgFeynman !== null ? `${sp.methodStats.avgFeynman}/100` : '—',
            icon: <MessageSquare className="size-4 text-violet-500" />,
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {kpi.icon}
              {kpi.label}
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums">{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Stepper */}
      {phase !== 'plan' && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PHASES.map((p, i) => {
            const done = i < phaseIdx || (kaizenDone && p.key === 'kaizen');
            const active = p.key === phase && !kaizenDone;
            return (
              <React.Fragment key={p.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (done) goPhase(p.key);
                  }}
                  disabled={!done && !active}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                    active &&
                      'border-emerald-500 bg-emerald-500 text-white shadow-sm',
                    done &&
                      !active &&
                      'cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
                    !done && !active && 'border-border text-muted-foreground',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done && !active ? <CheckCircle2 className="size-3.5" /> : p.icon}
                  <span className="hidden sm:inline">{p.short}</span>
                </button>
                {i < PHASES.length - 1 && (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={phase + (kaizenDone ? '-done' : '')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {/* ================= FASE 1: PLAN ================= */}
          {phase === 'plan' && (
            <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Target className="size-4 text-emerald-500" /> Planeje a sessão (2 min)
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Definir alvo antes de começar é metade do método. Dica: alterne a
                disciplina em relação à última sessão (intercalação).
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mtd-disc">Disciplina</Label>
                  <Select value={disciplineCode} onValueChange={setDisciplineCode}>
                    <SelectTrigger id="mtd-disc" aria-label="Disciplina da sessão">
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {disciplines.map((d) => (
                        <SelectItem key={d.code} value={d.code}>
                          {d.shortName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dueForDisc.length > 0 && (
                    <p className="text-xs text-teal-600 dark:text-teal-400">
                      🃏 {dueForDisc.length} flashcard(s) vencido(s) nesta disciplina —
                      ótima escolha.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mtd-topic">Tema da sessão</Label>
                  <input
                    id="mtd-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex.: Estruturas de repetição"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {topicSuggestions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {topicSuggestions.slice(0, 5).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTopic(t)}
                          className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {t.length > 34 ? `${t.slice(0, 34)}…` : t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Duração do bloco de foco</Label>
                  <div className="flex gap-1.5">
                    {[15, 25, 50].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setFocusMinutes(m);
                          setSecondsLeft(m * 60);
                        }}
                        className={cn(
                          'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                          focusMinutes === m
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'hover:bg-muted',
                        )}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mtd-mat">Material (opcional)</Label>
                  <Select
                    value={materialId || 'nenhum'}
                    onValueChange={(v) => setMaterialId(v === 'nenhum' ? '' : v)}
                  >
                    <SelectTrigger id="mtd-mat" aria-label="Material da sessão">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {discMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title.length > 44 ? `${m.title.slice(0, 44)}…` : m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={startSession}
                  className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  size="lg"
                >
                  <Play className="size-4" /> Iniciar sessão guiada
                </Button>
                {materialId && onOpenStudy && (
                  <Button variant="outline" onClick={() => onOpenStudy(disciplineCode, materialId)}>
                    Abrir material no Estudar
                  </Button>
                )}
              </div>

              {sp.methodStats.totalSessions > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Últimas sessões: {sp.methodStats.totalSessions} registradas ·{' '}
                  {sp.methodStats.weekSessions} nos últimos 7 dias.
                </p>
              )}
            </Card>
          )}

          {/* ================= FASE 2: PRETEST ================= */}
          {phase === 'pretest' && (
            <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Brain className="size-4 text-violet-500" /> Pré-teste: tente ANTES de estudar
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Errar no pré-teste prepara o cérebro para absorver (efeito de
                pré-teste). Tente responder mesmo sem saber — depois estude o que
                faltou.
              </p>

              {pretest.length === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
                  <Brain className="size-8 text-violet-400" />
                  <p className="text-sm text-muted-foreground">
                    O tutor IA vai gerar perguntas sobre{' '}
                    <span className="font-medium text-foreground">
                      {topic || discipline?.shortName}
                    </span>{' '}
                    para você tentar agora.
                  </p>
                  <Button
                    onClick={generatePretest}
                    disabled={pretestLoading}
                    className="gap-2 bg-violet-600 text-white hover:bg-violet-700"
                  >
                    {pretestLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Gerando…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" /> Gerar perguntas com IA
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {pretest.map((q, i) => (
                    <div key={i} className="rounded-xl border p-3.5">
                      <p className="text-sm font-medium">
                        {i + 1}. {q.front}
                      </p>
                      <Textarea
                        value={pretestAttempts[i] ?? ''}
                        onChange={(e) =>
                          setPretestAttempts((p) => ({ ...p, [i]: e.target.value }))
                        }
                        placeholder="Tente responder em 1-3 linhas (ou do jeito que conseguir)…"
                        className="mt-2 min-h-[60px] text-sm"
                      />
                      {revealed[i] ? (
                        <div className="mt-2 rounded-lg bg-muted/60 p-2.5 text-sm">
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            Resposta modelo:{' '}
                          </span>
                          {q.back}
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1.5 gap-1.5 text-violet-600 hover:text-violet-700 dark:text-violet-400"
                          onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}
                        >
                          <Eye className="size-3.5" /> Ver resposta modelo
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    {pretestAnswered}/{pretest.length} tentativa(s) registrada(s).
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={() => goPhase('focus')}
                  className="gap-1.5 text-muted-foreground"
                >
                  <SkipForward className="size-4" /> Pular pré-teste
                </Button>
                <Button
                  onClick={() => goPhase('focus')}
                  className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={pretest.length > 0 && pretestAnswered === 0}
                >
                  Feito — agora estudar <ChevronRight className="size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* ================= FASE 3: FOCUS ================= */}
          {phase === 'focus' && (
            <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Timer className="size-4 text-teal-500" /> Bloco de foco profundo
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Uma coisa só: <span className="font-medium text-foreground">{topic || discipline?.shortName}</span>.
                Celular longe, uma aba só. Ao terminar, venha recuperar o que leu.
              </p>

              <div className="mt-5 flex flex-col items-center gap-4">
                <p
                  className={cn(
                    'font-mono text-6xl font-bold tabular-nums tracking-tight',
                    focusCompleted ? 'text-emerald-600 dark:text-emerald-400' : '',
                  )}
                >
                  {fmtClock(secondsLeft)}
                </p>
                <Progress value={timerProgress} className="h-2 w-full max-w-sm" />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {!focusCompleted && (
                    <Button
                      onClick={() => setRunning((r) => !r)}
                      className="gap-2 bg-teal-600 text-white hover:bg-teal-700"
                    >
                      {running ? (
                        <>
                          <Pause className="size-4" /> Pausar
                        </>
                      ) : (
                        <>
                          <Play className="size-4" /> {elapsedFocusSec > 0 ? 'Retomar' : 'Iniciar foco'}
                        </>
                      )}
                    </Button>
                  )}
                  {!focusCompleted && (
                    <Button variant="outline" onClick={() => setSecondsLeft((s) => s + 300)} className="gap-1.5">
                      <Plus className="size-4" /> 5 min
                    </Button>
                  )}
                  {focusCompleted ? (
                    <Button
                      onClick={() => goPhase('recall')}
                      className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Continuar para recuperação <ChevronRight className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => goPhase('recall')}
                      className="text-muted-foreground"
                    >
                      Encerrar foco agora
                    </Button>
                  )}
                </div>
                {materialId && onOpenStudy && (
                  <Button variant="link" size="sm" onClick={() => onOpenStudy(disciplineCode, materialId)}>
                    Abrir material no Estudar ↗
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Foco acumulado nesta sessão: {Math.floor(elapsedFocusSec / 60)} min
                </p>
              </div>
            </Card>
          )}

          {/* ================= FASE 4: RECALL ================= */}
          {phase === 'recall' && (
            <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Layers className="size-4 text-teal-500" /> Recuperação ativa (flashcards)
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Testar a memória vale mais que reler. Nota honesta → o algoritmo de
                repetição espaçada agenda a próxima revisão no momento ideal.
              </p>

              {queue.length === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
                  <Layers className="size-8 text-teal-400" />
                  {dueForDisc.length > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {dueForDisc.length} cartão(ões) vencido(s) em{' '}
                        {discipline?.shortName}.
                      </p>
                      <Button
                        onClick={() => {
                          setQueue(dueForDisc.slice(0, 12));
                          setReviewIdx(0);
                          setShowBack(false);
                        }}
                        className="gap-2 bg-teal-600 text-white hover:bg-teal-700"
                      >
                        <Play className="size-4" /> Revisar agora
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Nenhum cartão vencido nesta disciplina. Gere alguns com IA
                        (ficam no baralho para as próximas revisões) ou continue.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button
                          onClick={generateCardsAndReview}
                          disabled={genLoading}
                          className="gap-2 bg-violet-600 text-white hover:bg-violet-700"
                        >
                          {genLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Gerando…
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-4" /> Gerar com IA
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => goPhase('feynman')}>
                          Continuar sem revisão
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : currentCard ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Cartão {Math.min(reviewIdx + 1, queue.length)} de {queue.length} ·{' '}
                      {flashcardBoxLabel(currentCard.box)}
                    </span>
                    <span>
                      ✅ {reviewed.correct}/{reviewed.n}
                    </span>
                  </div>
                  <Progress
                    value={(reviewIdx / queue.length) * 100}
                    className="mb-4 h-1.5"
                  />
                  <div className="rounded-xl border p-4">
                    <p className="text-base font-medium">{currentCard.front}</p>
                    {showBack && (
                      <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                        {currentCard.back}
                      </div>
                    )}
                  </div>
                  {!showBack ? (
                    <Button
                      onClick={() => setShowBack(true)}
                      variant="outline"
                      className="mt-3 w-full gap-2"
                    >
                      <Eye className="size-4" /> Mostrar resposta
                    </Button>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(
                        [
                          ['again', 'Errei', 'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40'],
                          ['hard', 'Difícil', 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40'],
                          ['good', 'Soube', 'border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-900 dark:text-teal-400 dark:hover:bg-teal-950/40'],
                          ['easy', 'Fácil', 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40'],
                        ] as Array<[FlashcardGrade, string, string]>
                      ).map(([g, label, cls]) => (
                        <Button
                          key={g}
                          variant="outline"
                          onClick={() => gradeCard(g)}
                          className={cn('flex-col gap-0.5 h-auto py-2.5', cls)}
                        >
                          <span className="text-sm font-semibold">{label}</span>
                          <span className="text-[10px] opacity-70">
                            {flashcardNextIntervalLabel(currentCard.box, g)}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center dark:bg-emerald-950/40">
                  <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-medium">
                    Fila concluída: {reviewed.n} cartão(ões) revisado(s),{' '}
                    {reviewed.correct} acerto(s).
                  </p>
                  <Button
                    onClick={() => goPhase('feynman')}
                    className="mt-3 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Continuar para Feynman <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}

              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => goPhase('feynman')}
                  className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Parar revisão e continuar →
                </button>
              )}
            </Card>
          )}

          {/* ================= FASE 5: FEYNMAN ================= */}
          {phase === 'feynman' && (
            <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MessageSquare className="size-4 text-violet-500" /> Técnica Feynman:
                explique como se ensinasse uma criança
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Escreva com suas palavras o que entendeu de{' '}
                <span className="font-medium text-foreground">
                  {topic || discipline?.shortName}
                </span>
                . O tutor IA avalia, aponta lacunas e dá a nota.
              </p>

              <Textarea
                value={feynmanText}
                onChange={(e) => setFeynmanText(e.target.value)}
                placeholder="Ex.: 'Repetição é quando o computador executa um bloco várias vezes. O while repete enquanto a condição for verdadeira, e o for repete um número conhecido de vezes…'"
                className="mt-3 min-h-[140px] text-sm"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{feynmanText.trim().length} caracteres (mín. 40)</span>
                {feynmanScore !== undefined && (
                  <Badge
                    className={cn(
                      'gap-1',
                      feynmanScore >= 75
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : feynmanScore >= 50
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
                    )}
                  >
                    Nota: {feynmanScore}/100
                  </Badge>
                )}
              </div>

              {feynmanLoading && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-violet-500" />
                  Avaliando sua explicação contra o material oficial…
                </div>
              )}

              {feynmanFeedback && !feynmanLoading && (
                <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border bg-muted/30 p-4">
                  <TutorMarkdown content={feynmanFeedback} accent="text-violet-500" />
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={() => goPhase('kaizen')}
                  className="gap-1.5 text-muted-foreground"
                >
                  <SkipForward className="size-4" /> Pular avaliação
                </Button>
                <Button
                  onClick={feynmanFeedback ? () => goPhase('kaizen') : submitFeynman}
                  disabled={feynmanLoading || (!feynmanFeedback && feynmanText.trim().length < 40)}
                  className="gap-2 bg-violet-600 text-white hover:bg-violet-700"
                >
                  {feynmanLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Avaliando…
                    </>
                  ) : feynmanFeedback ? (
                    <>
                      Continuar para Kaizen <ChevronRight className="size-4" />
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" /> Enviar ao tutor IA
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* ================= FASE 6: KAIZEN ================= */}
          {phase === 'kaizen' && (
            <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
              {kaizenDone && lastSummary ? (
                <div className="text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                    <Sprout className="size-7 text-emerald-500" />
                  </div>
                  <h2 className="mt-3 text-lg font-bold">Sessão completa! 🌱</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Você fechou o ciclo do Protocolo HUB.
                  </p>
                  <div className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-2">
                    {[
                      { label: 'Foco', value: `${lastSummary.minutes} min` },
                      { label: 'Flashcards', value: String(lastSummary.cards) },
                      {
                        label: 'Feynman',
                        value: lastSummary.score !== undefined ? `${lastSummary.score}/100` : '—',
                      },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border p-3">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-bold">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sequência atual: <span className="font-bold text-orange-500">{sp.methodStreak} dia(s)</span> 🔥
                  </p>
                  <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                    <Button
                      onClick={resetSession}
                      className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <RotateCcw className="size-4" /> Nova sessão
                    </Button>
                    {onOpenStudy && (
                      <Button variant="outline" onClick={() => onOpenStudy(disciplineCode)}>
                        Abrir Estudar
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Sprout className="size-4 text-emerald-500" /> Kaizen: o que fica 1% melhor?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Método japonês de melhoria contínua: uma pequena melhoria por sessão
                    compõe ~37x em um ano. Escreva UMA coisa concreta.
                  </p>
                  <Textarea
                    value={kaizenText}
                    onChange={(e) => setKaizenText(e.target.value)}
                    placeholder="Ex.: Na próxima sessão, escrever o pseudocódigo antes de abrir o editor."
                    className="mt-3 min-h-[80px] text-sm"
                  />

                  <Separator className="my-4" />
                  <p className="text-xs font-medium text-muted-foreground">Resumo da sessão</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Foco</p>
                      <p className="font-bold">{Math.round(elapsedFocusSec / 60)} min</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Pré-teste</p>
                      <p className="font-bold">{pretest.length ? '✓' : '—'}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Feynman</p>
                      <p className="font-bold">
                        {feynmanScore !== undefined ? `${feynmanScore}/100` : '—'}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={registerSession}
                    disabled={registering}
                    className="mt-4 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    size="lg"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Registrando…
                      </>
                    ) : (
                      <>
                        <Sprout className="size-4" /> Registrar sessão 🌱
                      </>
                    )}
                  </Button>
                </>
              )}
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Diário Kaizen */}
      {sp.methodStats.kaizenCount > 0 && (
        <Card className="rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sprout className="size-4 text-emerald-500" /> Diário Kaizen (
              {sp.methodStats.kaizenCount})
            </h3>
          </div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {sp.progress.kaizenEntries
              .slice()
              .reverse()
              .slice(0, 10)
              .map((k) => (
                <div
                  key={k.id}
                  className="group flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm">{k.text}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {k.date}
                      {k.disciplineCode ? ` · ${getDisciplineByCode(k.disciplineCode)?.shortName ?? k.disciplineCode}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => sp.removeKaizenEntry(k.id)}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                    aria-label="Remover registro Kaizen"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
