'use client';

// Simulado Pro — prova simulada com cronômetro, navegação por questões,
// avaliação própria (consegui/não consegui) e resultado com anel de desempenho.
// Substitui o antigo "Modo simulado (5 aleatórios)" por uma experiência completa.

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlarmClock,
  Hourglass,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookX,
  CalendarCheck,
  CheckCircle2,
  CheckCheck,
  ChevronRight,
  Dumbbell,
  Eye,
  EyeOff,
  Flag,
  History,
  Lightbulb,
  ListChecks,
  Pause,
  Play,
  Repeat2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { disciplines, getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { useStudyProgress, type RunQuestionDetail } from '@/lib/study-progress';
import {
  buildDebriefFromDetails,
  isSimuladoDayToday,
  pacingChipTitle,
  pacingFor,
} from '@/lib/simulado-debrief';
import { openMethod, openPractice, openProgress, openSimulado, openTutor } from '@/lib/hub-events';
import { MATH_EXAM, MATH_META, MATH_SIMULADO_DATE, MATH_SIMULADO_REGRA_REVISAO, simuladoRegraPlanoChip, sortWorstFirst, topicRowsFor } from '@/lib/math-exam-prep';
import { daysUntilDate } from '@/lib/semester';
import { simuladoMissedMap } from '@/lib/mistake-notebook';
import { buildQuizPrompt } from '@/lib/tutor-quiz';
import { getExerciseStage } from '@/lib/curriculum-state';
import {
  exercises,
  pickRandomExercises,
  type Exercise,
} from '@/lib/exercise-extractor';
import {
  clearInProgress,
  loadInProgress,
  normalizeMode,
  rebuildQuestions,
  saveInProgress,
  validateSaved,
  type AttemptMode,
  type InProgressRun,
} from '@/lib/simulado-resume';

type DifficultyFilter = 'all' | Exercise['difficulty'];

export interface SimuladoConfig {
  discipline: string; // 'all' | code
  difficulty: DifficultyFilter;
  quantity: number;
  durationMin: number; // 0 = sem tempo
  aligned: boolean; // PADRÃO MATERIAL-FIRST: só o que já foi dado em sala
  /**
   * Escopo por tópico (ex.: Av1 = só Álgebra Matricial + Lógica).
   * Vazio/undefined = todos os tópicos da disciplina.
   */
  topics?: string[];
}

interface QuestionResult {
  solved: boolean | null; // true=consegui, false=não consegui, null=pulado/não vista
}

type Phase = 'setup' | 'running' | 'results';

/**
 * Rótulos e textos honestos por MODO da tentativa — uma única fonte para
 * todas as superfícies (toast de pausa/retomada/tempo esgotado, badge da
 * tela de prova, chip do banner de retomada, título do resultado).
 * O texto declara a natureza: o treino não finge ser prova.
 */
const MODE_INFO: Record<
  AttemptMode,
  {
    badge: string; // badge da tela de prova (ExamScreen)
    chip: string; // chip no banner de retomada
    pauseToast: string;
    resumeToast: string;
    expiredToast: string;
    savedTitle: string; // tooltip do pulso "salvo" (concordância certa)
    resultsTitle: string;
    resultsDesc: string;
  }
> = {
  prova: {
    badge: 'Simulado',
    chip: 'Prova',
    pauseToast: 'Prova pausada — ela te espera no banner do setup.',
    resumeToast: 'Prova retomada de onde você parou.',
    expiredToast: '⏰ Tempo esgotado! Simulado encerrado.',
    savedTitle:
      'Progresso salvo automaticamente — se a prova fechar, ela te espera no banner do setup.',
    resultsTitle: 'Resultado do simulado',
    resultsDesc:
      'progresso nos exercícios e nota no histórico de simulados — tudo salvo automaticamente. ✓',
  },
  treino: {
    badge: 'Treino',
    chip: 'Treino do Caderno',
    pauseToast: 'Treino pausado — ele te espera no banner do setup.',
    resumeToast: 'Treino retomado de onde você parou.',
    expiredToast: '⏰ Tempo esgotado! Treino encerrado.',
    savedTitle:
      'Progresso salvo automaticamente — se o treino fechar, ele te espera no banner do setup.',
    resultsTitle: 'Resultado do treino',
    resultsDesc:
      'resolver de novo limpa o erro do caderno — e a nota fica no histórico. Tudo salvo automaticamente. ✓',
  },
  topico: {
    badge: 'Treino de tópico',
    chip: 'Treino de tópico',
    pauseToast: 'Treino de tópico pausado — ele te espera no banner do setup.',
    resumeToast: 'Treino de tópico retomado de onde você parou.',
    expiredToast: '⏰ Tempo esgotado! Treino encerrado.',
    savedTitle:
      'Progresso salvo automaticamente — se o treino fechar, ele te espera no banner do setup.',
    resultsTitle: 'Resultado do treino de tópico',
    resultsDesc:
      'progresso nos exercícios e nota no histórico — tudo salvo automaticamente. ✓',
  },
};

/** Config padrão do setup — reconstruída a CADA abertura do diálogo. */
const DEFAULT_SIMULADO_CONFIG: SimuladoConfig = {
  discipline: 'all',
  difficulty: 'all',
  quantity: 5,
  durationMin: 15,
  aligned: true, // no ritmo da turma por padrão
};

const DURATION_OPTIONS = [
  { value: 0, label: 'Sem tempo (estudo)' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '60 minutos (prova)' },
];

const QUANTITY_OPTIONS = [5, 10, 15];

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "pausada há …" — rótulo relativo curto para o banner de retomada. */
function pausedWhenLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'menos de 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return mins % 60 > 0 ? `${h}h ${mins % 60} min` : `${h}h`;
}

export function SimuladoView({
  open,
  onOpenChange,
  initialConfig,
  initialMode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pré-config externa (ex.: preset da prova de Matemática do card do Painel). */
  initialConfig?: Partial<SimuladoConfig>;
  /**
   * Natureza da tentativa vinda de UM evento externo (ex.: drill de tópico
   * do Histórico) — prova é o default. Reiniciada a cada abertura junto com
   * a config, para um pedido não vazar no próximo (mesma regra dela).
   */
  initialMode?: AttemptMode;
}) {
  const [phase, setPhase] = React.useState<Phase>('setup');
  const [config, setConfig] = React.useState<SimuladoConfig>(DEFAULT_SIMULADO_CONFIG);
  const [questions, setQuestions] = React.useState<Exercise[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [results, setResults] = React.useState<QuestionResult[]>([]);
  const [hintVisible, setHintVisible] = React.useState(false);
  const [remaining, setRemaining] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  /**
   * ONDE O TEMPO FOI (t192): segundos acumulados POR QUESTÃO, na ordem da
   * prova. A Av1 real tem relógio — o pacing é intel da prova real (saber
   * que a q3 comeu 18 dos 60 min muda a estratégia: pular e voltar).
   * Pausa não conta (o cronômetro congela fechado — o tempo aqui é o que
   * passou EM questões, nunca o que passou longe delas).
   */
  const [timeByQ, setTimeByQ] = React.useState<number[]>([]);
  /**
   * O relógio encerrou a prova (00:00)? O debrief confessa — "acabou o
   * tempo" e "desisti" são diagnósticos diferentes (estratégia × conteúdo).
   */
  const [endedByClock, setEndedByClock] = React.useState(false);
  /**
   * Instante (Date.now) em que a questão ATUAL ficou na tela — o efeito de
   * pacing acumula o trecho na troca/pausa/fim. null = nada contando agora.
   */
  const qShownAtRef = React.useRef<number | null>(null);
  /**
   * Espelho SÍNCRONO de timeByQ — a fonte da verdade para PERSISTIR. O state
   * só alimenta a renderização (assíncrono); o ref é lido no mesmo tick pelo
   * efeito de persistência (a cada segundo) e pelo recordRun — F5, X e pausa
   * nunca perdem o trecho em curso. Escrito SEMPRE junto com o state.
   */
  const timeByQRef = React.useRef<number[]>([]);
  /** Tentativa pausada encontrada no storage ao abrir (banner de retomada). */
  const [resumeRun, setResumeRun] = React.useState<InProgressRun | null>(null);
  /** Natureza da tentativa EM CURSO — rotula todas as superfícies com honestidade. */
  const [attemptMode, setAttemptMode] = React.useState<AttemptMode>('prova');
  /** Confirmação de entrega: revisão das questões antes de encerrar (prova real tem). */
  const [confirmingFinish, setConfirmingFinish] = React.useState(false);

  // ---- PACING: os três gestos do tempo por questão (t192) ----
  /** Acumula `seg` na questão `i` — espelho ref (síncrono) + state (tela). */
  function addTimeTo(i: number, seg: number) {
    const next = [...timeByQRef.current];
    next[i] = (next[i] ?? 0) + seg;
    timeByQRef.current = next;
    setTimeByQ(next);
  }
  /** Leitura PURA: o acumulado + o trecho em curso, sem fechar nada — o
   *  efeito de persistência lê a verdade inteira a cada gravação. */
  function peekMergedTimes(): number[] {
    if (qShownAtRef.current == null) return timeByQRef.current;
    const seg = (Date.now() - qShownAtRef.current) / 1000;
    const next = [...timeByQRef.current];
    next[idx] = (next[idx] ?? 0) + seg;
    return next;
  }
  /** Fecha o trecho em curso na questão atual (ref + state) e devolve o
   *  array final — o recordRun lê a última questão também (inclusive a que
   *  estava na tela quando o sino tocou). O ref zera para o cleanup do
   *  efeito de pacing não dobrar a conta. */
  function closeInFlightForRecord(): number[] {
    if (qShownAtRef.current == null) return timeByQRef.current;
    const seg = (Date.now() - qShownAtRef.current) / 1000;
    qShownAtRef.current = null;
    addTimeTo(idx, seg);
    return timeByQRef.current;
  }
  /** Zera o pacing para uma corrida NOVA (espelho + tela + relógio). */
  function resetPacing(n: number) {
    timeByQRef.current = new Array(n).fill(0);
    setTimeByQ(timeByQRef.current);
    qShownAtRef.current = null;
    setEndedByClock(false);
  }

  // Reset quando abre o diálogo (e aplica pré-config externa, se houver)
  React.useEffect(() => {
    if (open) {
      setPhase('setup');
      setIdx(0);
      setHintVisible(false);
      setQuestions([]);
      setResults([]);
      setRemaining(0);
      setElapsed(0);
      setTimeByQ([]); // o pacing da tentativa anterior nunca vaza para a próxima
      timeByQRef.current = [];
      setEndedByClock(false); // o sino de uma prova passada não toca de novo
      qShownAtRef.current = null;
      // Config SEMPRE reconstruída na abertura: sem config externa, volta ao
      // padrão — evita escopo/preset de uma abertura anterior vazando na próxima
      // (o estado do componente sobrevive ao fechamento do diálogo).
      setConfig(
        initialConfig && Object.keys(initialConfig).length > 0
          ? { ...DEFAULT_SIMULADO_CONFIG, ...initialConfig }
          : { ...DEFAULT_SIMULADO_CONFIG },
      );
      // Modo idem: reiniciado a cada abertura — o pedido externo (drill de
      // tópico) não vaza para a abertura manual seguinte.
      setAttemptMode(initialMode ?? 'prova');
      setConfirmingFinish(false); // revisão de entrega nunca vaza entre aberturas
      // Retomada: tentativa pausada (F5, queda de aba, X acidental) sobrevive
      // no storage — banner no setup oferece Retomar ou Descartar.
      const saved = loadInProgress();
      if (saved && validateSaved(saved)) {
        setResumeRun(saved);
      } else {
        if (saved) clearInProgress(); // corrompida/órfã → autodestrói
        setResumeRun(null);
      }
    }
  }, [open, initialConfig, initialMode]);

  // Cronômetro (contagem regressiva ou progressiva) — PAUSA REAL: só corre
  // com o diálogo aberto; fechou, congela (a retomada continua do segundo
  // exato — a pausa não pune o aluno).
  React.useEffect(() => {
    if (phase !== 'running' || !open) return;
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
  }, [phase, open, config.durationMin]);

  // PACING POR QUESTÃO (t192) — o trecho em curso acumula na questão que está
  // na tela quando ela SAI da tela: troca de questão, pausa (fechamento) ou
  // fim. O cleanup do efeito é o relógio: roda com o idx da questão que ESTAVA
  // visível (a closure guarda o valor certo) e ANTES dos efeitos do mesmo
  // commit (ordem do React: cleanups primeiro), então o saveInProgress já
  // nasce com o trecho fechado — a pausa e o X não deixam segundo órfão.
  // Revisar uma questão respondida soma nela: tempo na tela é tempo honesto.
  React.useEffect(() => {
    if (phase !== 'running' || !open) return;
    if (qShownAtRef.current == null) qShownAtRef.current = Date.now();
    return () => {
      if (qShownAtRef.current == null) return;
      const seg = (Date.now() - qShownAtRef.current) / 1000;
      qShownAtRef.current = null;
      addTimeTo(idx, seg);
    };
  }, [idx, phase, open]);

  // Persistência da tentativa em andamento — sobrevive a F5, queda de aba e
  // X acidental. Grava a cada mudança relevante (inclui o tick do cronômetro;
  // payload pequeno, escrita local — barata). Deps incluem `open`: o fechamento
  // dispara a última gravação (com o cronômetro já congelado). O timeByQ
  // viaja MESCLADO com o trecho em curso (t192): o espelho ref + o cleanup
  // do efeito de pacing garantem que a pausa/X/F5 salve a verdade inteira.
  React.useEffect(() => {
    if (phase !== 'running' || questions.length === 0) return;
    saveInProgress({
      mode: attemptMode, // a retomada sabe o que era: prova ou treino
      config,
      qids: questions.map((q) => q.id),
      results,
      idx,
      remaining,
      elapsed,
      timeByQ: peekMergedTimes(),
    });
  }, [phase, open, attemptMode, config, questions, results, idx, remaining, elapsed, timeByQ]);

  // Guarda de saída da PÁGINA durante a prova — SÓ com o diálogo aberto:
  // depois de Pausar (X ou botão), a tentativa está salva no storage e o
  // aluno navega o site sem o alerta de "sair da página?" perseguindo-o.
  // A guarda existe para o acidente no MEIO da prova (reload que interrompe
  // o fluxo), não para punir o uso normal depois de uma pausa.
  React.useEffect(() => {
    if (phase !== 'running' || !open) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = ''; // requerido pelo Chrome
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase, open]);

  // Alertas sonoros: 1 bip aos 60s, 2 bips aos 10s, 3 bips no tempo esgotado
  React.useEffect(() => {
    if (phase !== 'running' || config.durationMin === 0) return;
    if (remaining === 60) beep(1);
    else if (remaining === 10) beep(2);
  }, [remaining, phase, config.durationMin]);

  const sp = useStudyProgress();

  // REVISÃO DIRIGIDA — os erros REAIS do aluno (Caderno de Erros), nas DUAS
  // fontes treináveis: (1) exercícios tentados e NÃO resolvidos — com "erros
  // de sempre" (lapses) no topo — e (2) as questões erradas/puladas de
  // SIMULADOS passados, reconstruídas do acervo estático pelo enunciado
  // (o detalhe da corrida guarda só o recorte de 160 chars; o acervo devolve
  // a questão inteira — material-first: nada sorteado, nada inventado).
  // Máx. 15; dentro do corte, recaída primeiro, depois a recência.
  const mistakeSources = React.useMemo(() => {
    type MistakeSource = {
      ex: Exercise;
      lapses: number;
      when: string;
      fromSimulado: boolean;
    };
    const byId = new Map(exercises.map((e) => [e.id, e]));
    // Fonte 1: exercícios do caderno (tried && !solved).
    const exItems: MistakeSource[] = Object.entries(sp.progress.exerciseProgress ?? {})
      .filter(([, v]) => v.tried && !v.solved)
      .map(([id, v]) => {
        const ex = byId.get(id);
        return ex
          ? { ex, lapses: v.lapses ?? 0, when: v.lastPracticedAt || '', fromSimulado: false }
          : null;
      })
      .filter((x): x is MistakeSource => x !== null);
    // Fonte 2: corridas de simulado (mais recente primeiro) — erradas e puladas.
    // A corrida é HISTÓRICA (o detalhe nunca muda), então o estado ATUAL da
    // questão decide: se ela já virou acerto em qualquer lugar (exerciseProgress
    // solved), sai do treino — resolver de novo não pode reabrir erro antigo.
    const prog = sp.progress.exerciseProgress ?? {};
    const byStatement = new Map(exercises.map((e) => [e.statement.slice(0, 160), e]));
    const simItems: MistakeSource[] = [];
    // Cronicidade = nº de corridas em que a MESMA questão foi perdida — vira
    // o peso de prioridade no treino (o erro de sempre sobe, como no caderno).
    const runCountByEx = new Map<string, number>();
    for (const run of [...(sp.progress.simuladoRuns ?? [])].sort((a, b) =>
      (b.date || '').localeCompare(a.date || ''),
    )) {
      if (!run.questions) continue; // corridas antigas sem detalhe: nada a reconstruir
      for (const q of run.questions) {
        if (q.status === 'solved') continue;
        const ex = q.statement ? byStatement.get(q.statement) : undefined;
        if (!ex) continue; // enunciado sem par no acervo — nada a exibir, sem inventar
        if (prog[ex.id]?.solved) continue; // já resolvida depois da corrida — honesto
        runCountByEx.set(ex.id, (runCountByEx.get(ex.id) ?? 0) + 1);
        simItems.push({ ex, lapses: 0, when: run.date || '', fromSimulado: true });
      }
    }
    for (const s of simItems) s.lapses = runCountByEx.get(s.ex.id) ?? 0;
    // Dedupe: a entrada de exercício vence (tem lapses + estado rico); a mesma
    // questão perdida em várias corridas entra UMA vez (a mais recente primeiro).
    const seen = new Set(exItems.map((x) => x.ex.id));
    const combined = [...exItems];
    for (const s of simItems) {
      if (seen.has(s.ex.id)) continue;
      seen.add(s.ex.id);
      combined.push(s);
    }
    return combined
      .sort((a, b) => {
        if (a.lapses !== b.lapses) return b.lapses - a.lapses;
        return (b.when || '').localeCompare(a.when || '');
      })
      .slice(0, 15);
  }, [sp.progress.exerciseProgress, sp.progress.simuladoRuns]);
  const mistakeExercises = React.useMemo(
    () => mistakeSources.map((x) => x.ex),
    [mistakeSources],
  );
  // Quantas questões do treino (pós-cap) vêm de SIMULADOS — badge honesto
  // sobre a composição da prova que vai ser servida.
  const mistakeSimuladoCount = React.useMemo(
    () => mistakeSources.filter((x) => x.fromSimulado).length,
    [mistakeSources],
  );
  // Quantas das pendentes são RECORRENTES (pré-cap, ordem real do caderno) —
  // badge do card de revisão dirigida fica honesto mesmo com >15 erros.
  // Dois sinais, mesma regra do caderno (isRecorrenteMistake): recaída do
  // exercício (lapses > 0) OU crônico entre corridas (perdida em ≥ 2
  // simulados) — contando também as linhas só-de-simulado (sem exercício).
  const mistakeRecorrentes = React.useMemo(() => {
    const simMap = simuladoMissedMap(sp.progress);
    const prog = sp.progress.exerciseProgress ?? {};
    const exPending = new Set<string>();
    let n = 0;
    for (const [id, v] of Object.entries(prog)) {
      if (!v.tried || v.solved) continue;
      exPending.add(id);
      if ((v.lapses ?? 0) > 0 || (simMap.get(id)?.dates.length ?? 0) >= 2) n += 1;
    }
    for (const [id, acc] of simMap) {
      if (exPending.has(id)) continue;
      if (acc.dates.length >= 2) n += 1;
    }
    return n;
  }, [sp.progress]);

  const pool = React.useMemo(() => {
    let list = exercises;
    if (config.discipline !== 'all') {
      list = list.filter((e) => e.disciplineCode === config.discipline);
    }
    if (config.difficulty !== 'all') {
      list = list.filter((e) => e.difficulty === config.difficulty);
    }
    if (config.aligned) {
      list = list.filter((e) => getExerciseStage(e) === 'em_sala');
    }
    if (config.topics && config.topics.length > 0) {
      list = list.filter((e) => config.topics!.includes(e.topic));
    }
    return list;
  }, [config.discipline, config.difficulty, config.aligned, config.topics]);

  /** Tópicos da disciplina selecionada (com contagem no acervo) p/ chips de escopo. */
  const topicOptions = React.useMemo(() => {
    const src =
      config.discipline === 'all'
        ? exercises
        : exercises.filter((e) => e.disciplineCode === config.discipline);
    const counts = new Map<string, number>();
    for (const e of src) counts.set(e.topic, (counts.get(e.topic) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [config.discipline]);

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
    setResumeRun(null); // nova prova substitui a pausada (o efeito persiste já grava esta)
    setQuestions(picked);
    setResults(picked.map(() => ({ solved: null })));
    setIdx(0);
    setHintVisible(false);
    setRemaining(cfg.durationMin * 60);
    setElapsed(0);
    resetPacing(picked.length); // o relógio de cada questão começa do zero
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

  function finish(byClock = false) {
    // A ÚLTIMA questão também é tempo de prova — inclusive a que estava na
    // tela quando o sino tocou (byClock). O trecho fecha ANTES do registro:
    // o strip e a IA leem a verdade inteira.
    const times = closeInFlightForRecord();
    setEndedByClock(byClock); // o sino tocou → a tela confessa (o run grava idem)
    recordRun(times, byClock);
    clearInProgress(); // tentativa registrada no histórico — o rascunho se aposenta
    beep(3);
    setConfirmingFinish(false); // entrega confirmada — o próximo run começa limpo
    setPhase('results');
  }

  /** Retoma a tentativa pausada exatamente de onde parou. */
  function resumeSaved() {
    const saved = resumeRun;
    if (!saved) return;
    const qs = rebuildQuestions(saved.qids);
    if (qs.length === 0) {
      clearInProgress();
      setResumeRun(null);
      return;
    }
    // Config veio do storage (JSON): a forma é a mesma, mas difficulty chega
    // como string — o cast é seguro porque só foi gravado de um SimuladoConfig válido.
    setConfig({ ...DEFAULT_SIMULADO_CONFIG, ...saved.config } as SimuladoConfig);
    const savedMode = normalizeMode(saved.mode); // saves antigos não têm modo
    setAttemptMode(savedMode);
    setQuestions(qs);
    setResults(saved.results.map((r) => ({ solved: r.solved })));
    setIdx(Math.min(saved.idx, qs.length - 1));
    setRemaining(saved.remaining);
    setElapsed(saved.elapsed);
    // O pacing viajou na pausa (t192): a retomada continua de onde parou.
    // Save antigo (pré-t192) ou comprimento desalinhado → recomeça do zero
    // (contar tempo que não foi medido seria inventar).
    const savedTimes =
      Array.isArray(saved.timeByQ) && saved.timeByQ.length === qs.length
        ? saved.timeByQ.map((t) => (typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : 0))
        : new Array(qs.length).fill(0);
    timeByQRef.current = savedTimes;
    setTimeByQ(savedTimes);
    qShownAtRef.current = null; // o efeito recomeça o relógio na questão atual
    setEndedByClock(false); // retomada nunca nasce encerrada pelo sino
    setHintVisible(false);
    setResumeRun(null); // o efeito de persistência regrava já no próximo tick
    setPhase('running');
    toast.success(MODE_INFO[savedMode].resumeToast);
  }

  /** Revisão dirigida: prova só com os ERROS do aluno (Caderno de Erros). */
  function startMistakes() {
    if (mistakeExercises.length === 0) return;
    const qty = mistakeExercises.length;
    setResumeRun(null); // nova prova substitui a pausada
    setAttemptMode('treino'); // o texto declara: isto é TREINO, não prova
    setConfig({
      ...DEFAULT_SIMULADO_CONFIG,
      discipline: 'all',
      difficulty: 'all',
      quantity: qty,
      durationMin: Math.max(5, Math.min(45, qty * 3)), // ritmo alvo do app: 3 min/questão
      aligned: true,
      topics: [],
    });
    setQuestions(mistakeExercises);
    setResults(mistakeExercises.map(() => ({ solved: null })));
    setIdx(0);
    setHintVisible(false);
    setRemaining(Math.max(5, Math.min(45, qty * 3)) * 60);
    setElapsed(0);
    resetPacing(mistakeExercises.length); // treino de erros também tem relógio
    setPhase('running');
  }

  /** Descarta a tentativa pausada (decisão explícita do aluno). */
  function discardSaved() {
    clearInProgress();
    setResumeRun(null);
    toast.info('Tentativa pausada descartada.');
  }

  /** Registra a tentativa no histórico (progress-view exibe a evolução). */
  function recordRun(times: number[], byClock: boolean) {
    if (questions.length === 0) return;
    // Detalhes por questão: permitem "Analisar com IA" DEPOIS, no histórico,
    // com a mesma riqueza do debriefing ao vivo (padrão material-first de dados).
    // timeSec (t192): o pacing é intel da prova real — pulada com tempo alto
    // é a confissão mais valiosa (a questão que travou e não virou resposta).
    const details: RunQuestionDetail[] = questions.map((q, i) => ({
      status:
        results[i].solved === true ? 'solved' : results[i].solved === false ? 'missed' : 'skipped',
      disciplineCode: q.disciplineCode,
      topic: q.topic,
      difficulty: q.difficulty,
      statement: q.statement.slice(0, 160),
      timeSec: Math.max(0, Math.round(times[i] ?? 0)),
    }));
    sp.addSimuladoRun({
      mode: attemptMode, // o histórico sabe o que foi: prova, treino ou tópico
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
      questions: details,
      endedByClock: byClock || undefined, // ausente = terminou antes do sino
    });
  }

  // Tempo esgotado → encerra automaticamente — e CONFESSA (t192): a corrida
  // gravada sabe que foi o relógio, não uma desistência (o debrief e a IA
  // diagnosticam "acabou o tempo" diferente de "desisti").
  React.useEffect(() => {
    if (phase === 'running' && config.durationMin > 0 && remaining === 0 && elapsed > 0) {
      finish(true);
      toast.warning(MODE_INFO[attemptMode].expiredToast);
    }
  }, [remaining, phase]);

  // Atalhos de teclado no modo running: 1=consegui, 2=não consegui,
  // ←/→ navegam, D alterna a dica. Usa fase de captura + stopPropagation
  // para SUPRIMIR os atalhos globais da Command Palette (1-8 trocam de aba).
  React.useEffect(() => {
    // Na revisão de entrega os atalhos silenciam — marcar/navegar por trás
    // do painel de conferência deixaria a contagem da revisão mentindo.
    if (!open || phase !== 'running' || confirmingFinish) return;
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
  }, [open, phase, questions.length, idx, confirmingFinish]);

  const { solvedCount, missedCount, skippedCount } = React.useMemo(() => {
    let solved = 0;
    let missed = 0;
    let skipped = 0;
    for (const r of results) {
      if (r.solved === true) solved += 1;
      else if (r.solved === false) missed += 1;
      else skipped += 1;
    }
    return { solvedCount: solved, missedCount: missed, skippedCount: skipped };
  }, [results]);
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
      <DialogContent
        className="max-h-[92dvh] max-w-3xl overflow-y-auto overflow-x-hidden rounded-xl p-0 sm:max-w-3xl"
        // Prova em andamento não fecha por ESC nem clique fora — acidente
        // clássico que apagava a tentativa inteira. O X (fechar explícito)
        // continua funcionando e vira PAUSA: a retomada está no setup.
        onEscapeKeyDown={(e) => {
          if (phase === 'running') e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (phase === 'running') e.preventDefault();
        }}
      >
        {phase === 'setup' && (
          <SetupScreen
            config={config}
            setConfig={setConfig}
            poolCount={pool.length}
            topicOptions={topicOptions}
            onStart={() => start()}
            resume={resumeRun}
            onResume={resumeSaved}
            onDiscard={discardSaved}
            mistakesCount={mistakeExercises.length}
            recorrentesCount={mistakeRecorrentes}
            simuladoCount={mistakeSimuladoCount}
            onStartMistakes={startMistakes}
          />
        )}

        {phase === 'running' && !confirmingFinish && questions[idx] && (
          <ExamScreen
            questions={questions}
            results={results}
            idx={idx}
            hintVisible={hintVisible}
            timeInfo={timeInfo}
            barColor={barColor}
            timePct={timePct}
            mode={attemptMode}
            paceMin={
              config.durationMin > 0
                ? Math.max(1, Math.round(config.durationMin / questions.length))
                : undefined
            }
            onHintToggle={() => setHintVisible((v) => !v)}
            onMark={mark}
            onNavigate={(i) => {
              setIdx(i);
              setHintVisible(false);
            }}
            onFinish={() => setConfirmingFinish(true)}
            onPause={() => {
              // A tentativa já está salva (o efeito de persistência grava no
              // fechamento) — avisar ONDE retomar é o que falta para o aluno.
              toast.info(MODE_INFO[attemptMode].pauseToast);
              onOpenChange(false);
            }}
          />
        )}

        {phase === 'running' && confirmingFinish && (
          <FinishReview
            questions={questions}
            results={results}
            timeInfo={timeInfo}
            barColor={barColor}
            timePct={timePct}
            mode={attemptMode}
            onBack={() => setConfirmingFinish(false)}
            onConfirm={finish}
            onNavigate={(i) => {
              setIdx(i);
              setHintVisible(false);
              setConfirmingFinish(false);
            }}
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
            timeByQ={timeByQ}
            endedByClock={endedByClock}
            mode={attemptMode}
            onOpenChange={onOpenChange}
            onRetryMissed={(topic) => {
              const missed = questions.filter(
                (q, i) =>
                  results[i].solved !== true && (!topic || q.topic === topic),
              );
              if (missed.length === 0) return;
              // reinicia com apenas as questões erradas/puladas (opcionalmente só de 1 tópico)
              setAttemptMode('treino'); // refazer erradas É um treino — honesto no rótulo
              setQuestions(missed);
              setResults(missed.map(() => ({ solved: null })));
              setIdx(0);
              setHintVisible(false);
              setRemaining(config.durationMin * 60);
              setElapsed(0);
              resetPacing(missed.length); // corrida nova: relógio por questão do zero
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
  topicOptions,
  onStart,
  resume,
  onResume,
  onDiscard,
  mistakesCount,
  recorrentesCount,
  simuladoCount,
  onStartMistakes,
}: {
  config: SimuladoConfig;
  setConfig: (c: SimuladoConfig) => void;
  poolCount: number;
  topicOptions: [string, number][];
  onStart: () => void;
  /** Tentativa pausada (storage) — banner de retomada quando presente. */
  resume: InProgressRun | null;
  onResume: () => void;
  onDiscard: () => void;
  /** Erros pendentes do Caderno de Erros — card de revisão dirigida quando > 0. */
  mistakesCount: number;
  /** Quantas das pendentes são "erros de sempre" (lapses > 0) — badge honesto. */
  recorrentesCount: number;
  /** Quantas questões do treino vêm de simulados passados (pós-cap) — composição. */
  simuladoCount: number;
  onStartMistakes: () => void;
}) {
  const activeTopics = config.topics ?? [];

  // O SETUP CONHECE O DIA OFICIAL — 29/09 é o dia do simulado da Av1 (e 28/09
  // a véspera). Render-time via daysUntilDate (sem estado nem interval): reage
  // a mock de relógio no mesmo frame, lição da rodada 79. Outros dias: nada
  // (honesto — sem ruído quando o dia é qualquer outro).
  const simuladoDaysLeft = daysUntilDate(MATH_SIMULADO_DATE);

  // ---- Banner de retomada: métricas pré-computadas (nada no render basta) ----
  const answeredCount = resume ? resume.results.filter((r) => r.solved !== null).length : 0;
  const answeredPct = resume ? Math.round((answeredCount / resume.qids.length) * 100) : 0;
  const savedWhen = resume ? pausedWhenLabel(resume.savedAt) : '';
  const pausedTimeLabel = resume
    ? resume.config.durationMin > 0
      ? `${fmtClock(resume.remaining)} no cronômetro`
      : `${fmtClock(resume.elapsed)} decorridos`
    : '';
  /** Natureza da tentativa pausada (saves antigos = prova) — chip do banner. */
  const resumeMode = normalizeMode(resume?.mode);

  function toggleTopic(t: string) {
    const next = activeTopics.includes(t)
      ? activeTopics.filter((x) => x !== t)
      : [...activeTopics, t];
    // Todos marcados = sem filtro (equivalente a nenhum marcado).
    setConfig({ ...config, topics: next.length === topicOptions.length ? [] : next });
  }
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

      {/* DIA OFICIAL DO SIMULADO — banner do setup (mesma gramática visual do
          banner de retomada, família âmbar do "É hoje" do card da prova): o
          compromisso do dia falado no exato momento do clique em Iniciar. */}
      {(simuladoDaysLeft === 0 || simuladoDaysLeft === 1) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          role="status"
          className="mx-6 mt-5 overflow-hidden rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm"
        >
          <div className="flex items-start gap-3 p-4">
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-lg ring-1',
                simuladoDaysLeft === 0
                  ? 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400'
                  : 'bg-amber-500/10 text-amber-600/80 ring-amber-500/20 dark:text-amber-400/80',
              )}
            >
              <CalendarCheck className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              {simuladoDaysLeft === 0 ? (
                <>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    É hoje o simulado oficial da Av1
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Se esta for a tentativa oficial, condições de prova: sem
                    consultar nada antes de responder — {MATH_SIMULADO_REGRA_REVISAO}.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['Sem consulta', 'Meta ≥ 70%', 'Erro vira revisão de amanhã'].map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="border-amber-500/40 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-amber-700/90 dark:text-amber-400/90">
                    Amanhã é o simulado oficial da Av1
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Prepare hoje o lugar e o papel — e dormir cedo faz parte do
                    plano. O setup de amanhã já fica pronto com o escopo real.
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {resume && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          role="status"
          className="mx-6 mt-5 overflow-hidden rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm"
        >
          <div className="flex items-start gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-400">
              <History className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Tentativa pausada encontrada
                </p>
                {/* O que ERA a tentativa — o banner declara a natureza:
                    prova, treino do caderno ou treino de tópico. */}
                <Badge
                  variant="outline"
                  title={resumeMode === 'prova' ? 'Simulado montado no setup' : resumeMode === 'treino' ? 'Treino do Caderno de Erros' : 'Treino de 1 tópico (replay do Histórico)'}
                  className={cn(
                    'gap-1 px-1.5 text-[10px] font-semibold',
                    resumeMode === 'treino' &&
                      'border-rose-400/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-400',
                    resumeMode === 'topico' &&
                      'border-sky-400/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-400',
                    resumeMode === 'prova' &&
                      'border-amber-500/40 text-amber-700 dark:text-amber-400',
                  )}
                >
                  {resumeMode === 'treino' ? <Dumbbell className="size-3" aria-hidden /> : null}
                  {resumeMode === 'topico' ? <Target className="size-3" aria-hidden /> : null}
                  {resumeMode === 'prova' ? <AlarmClock className="size-3" aria-hidden /> : null}
                  {MODE_INFO[resumeMode].chip}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-amber-500/40 px-1.5 text-[10px] text-amber-700 dark:text-amber-400"
                >
                  {answeredCount}/{resume.qids.length} respondidas
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pausada há {savedWhen} · {pausedTimeLabel} · a retomada continua do
                segundo exato em que você parou.
              </p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width] duration-500"
                  style={{ width: `${answeredPct}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={onResume}
                >
                  <Play className="size-3.5" /> Retomar de onde parou
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                  onClick={onDiscard}
                >
                  Descartar
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {mistakesCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: resume ? 0.1 : 0 }}
          className="mx-6 mt-3 overflow-hidden rounded-lg border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent"
        >
          <div className="flex items-center gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/30 dark:text-rose-400">
              <RotateCcw className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  Revisão dirigida: só os seus erros
                </p>
                <Badge
                  variant="outline"
                  className="border-rose-500/40 px-1.5 text-[10px] text-rose-600 dark:text-rose-400"
                >
                  {mistakesCount} pendente{mistakesCount > 1 ? 's' : ''}
                </Badge>
                {/* "Erros de sempre" — as recaídas abrem a prova (mesma cor do badge do caderno) */}
                {recorrentesCount > 0 && (
                  <Badge
                    variant="outline"
                    title="Erros de sempre: você já tinha resolvido e voltou a errar — eles vêm primeiro na prova."
                    className="border-rose-400/60 bg-rose-500/10 px-1.5 text-[10px] font-semibold text-rose-700 shadow-sm dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300"
                  >
                    <Repeat2 className="mr-0.5 size-2.5" aria-hidden />
                    {recorrentesCount} recorrente{recorrentesCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {/* Composição do treino: questões reconstruídas de simulados passados */}
                {simuladoCount > 0 && (
                  <Badge
                    variant="outline"
                    title="Questões que você errou ou pulou em simulados anteriores — reconstruídas do acervo, na ordem mais recente primeiro."
                    className="border-rose-300/60 bg-rose-500/[0.07] px-1.5 text-[10px] text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400"
                  >
                    <Target className="mr-0.5 size-2.5" aria-hidden />
                    {simuladoCount} de simulado
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Do Caderno de Erros: as que você marcou “não consegui”
                {simuladoCount > 0 ? ' (inclusive de simulados)' : ''} —{' '}
                {recorrentesCount > 0 ? 'as recorrentes primeiro' : 'mais recentes primeiro'}, máx. 15,{' '}
                {Math.max(5, Math.min(45, mistakesCount * 3))} min no cronômetro.
              </p>
            </div>
            <Button
              size="sm"
              onClick={onStartMistakes}
              className="h-11 shrink-0 gap-1.5 bg-rose-600 text-white hover:bg-rose-700 sm:h-8"
            >
              <Play className="size-3.5" /> Treinar
            </Button>
          </div>
        </motion.div>
      )}

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
            {QUANTITY_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setConfig({ ...config, quantity: n })}
                aria-pressed={config.quantity === n}
                className={cn(
                  'h-11 rounded-lg border text-sm font-medium transition-all sm:h-9',
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

        {/* PADRÃO MATERIAL-FIRST: só o que já foi dado em sala */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 sm:col-span-2">
          <div className="min-w-0">
            <p className="text-xs font-medium">No ritmo da turma</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Sorteia só questões de tópicos já dados em aula (alinhado aos
              materiais reais). Desligue para incluir conteúdos futuros.
            </p>
          </div>
          <Switch
            checked={config.aligned}
            onCheckedChange={(v) => setConfig({ ...config, aligned: v })}
            aria-label="Sortear somente conteúdos já dados em sala"
          />
        </div>

        {/* ESCOPO POR TÓPICO — chips toggle (ex.: Av1 = Matrizes + Lógica) */}
        {topicOptions.length > 1 && (
          <div className="rounded-lg border border-border p-3 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-medium">Escopo por tópico</Label>
              {activeTopics.length > 0 ? (
                <Badge className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                  <Target className="mr-1 size-2.5" />
                  escopo ativo · {activeTopics.length}/{topicOptions.length}
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground">todos os tópicos</span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {topicOptions.map(([topic, count]) => {
                const active = activeTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-sm shadow-emerald-500/15 dark:text-emerald-400'
                        : 'border-border text-muted-foreground hover:border-emerald-500/40 hover:text-foreground',
                    )}
                  >
                    {active && <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />}
                    {topic}
                    <span className="text-[10px] font-normal tabular-nums opacity-70">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {activeTopics.length > 0
                ? 'O sorteio entra SÓ nos tópicos marcados — ideal para o escopo da prova.'
                : 'Marque tópicos para restringir o sorteio (clique de novo para liberar).'}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
        <div className="min-w-0 text-xs text-muted-foreground">
          <p>
            <ListChecks className="mr-1 inline size-3.5" />
            {poolCount} questão(ões) no filtro · dicas liberadas durante a prova
          </p>
          {activeTopics.length > 0 && (
            <p className="mt-0.5 truncate pl-5 text-[11px]">
              <span className="font-medium text-amber-600 dark:text-amber-400">escopo:</span>{' '}
              {activeTopics.join(' + ')}
            </p>
          )}
        </div>
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
  mode,
  paceMin,
  onHintToggle,
  onMark,
  onNavigate,
  onFinish,
  onPause,
}: {
  questions: Exercise[];
  results: QuestionResult[];
  idx: number;
  hintVisible: boolean;
  timeInfo: { label: string; value: string };
  barColor: string;
  timePct: number;
  /** Natureza da tentativa — badge e textos honestos (treino não finge prova). */
  mode: AttemptMode;
  /** Ritmo alvo por questão (min) — só com cronômetro ativo. */
  paceMin?: number;
  onHintToggle: () => void;
  onMark: (solved: boolean) => void;
  onNavigate: (i: number) => void;
  onFinish: () => void;
  /** Pausa explícita: salva e fecha — a retomada espera no banner do setup. */
  onPause: () => void;
}) {
  const ex = questions[idx];
  const disc = getDisciplineByCode(ex.disciplineCode);
  const color = getColorClasses(disc?.color ?? 'slate');
  const urgent = timePct <= 20;
  const info = MODE_INFO[mode];
  // Identidade visual do modo — helper compartilhado com o FinishReview.
  const badgeCls = modeBadgeCls(mode);

  // Pulso "salvo": dispara a cada mudança de resultado/posição (a prova
  // inteira é persistida a cada tick — aqui só confirmamos o que o aluno
  // FEZ). O skip inicial evita pulsar ao montar (nada foi salvo ainda).
  const [savedPulse, setSavedPulse] = React.useState(false);
  const skipFirstRef = React.useRef(true);
  React.useEffect(() => {
    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      return;
    }
    setSavedPulse(true);
    const t = setTimeout(() => setSavedPulse(false), 1800);
    return () => clearTimeout(t);
  }, [results, idx]);

  return (
    <div>
      {/* Barra de tempo fixa */}
      <div className="border-b px-4 pb-3 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge className={`shrink-0 ${badgeCls}`}>
              {mode === 'treino' ? <Dumbbell className="mr-1 size-3" aria-hidden /> : null}
              {mode === 'topico' ? <Target className="mr-1 size-3" aria-hidden /> : null}
              {info.badge}
            </Badge>
            <span className="truncate text-sm font-medium text-muted-foreground">
              Questão {idx + 1} de {questions.length}
            </span>
            {/* Confirmação de salvamento: pulsa a cada resposta/navegação
                (o tick do cronômetro não conta — só o que importa para a
                retomada). Fica em silêncio até haver o que confirmar. */}
            <AnimatePresence>
              {savedPulse && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7, x: -4 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  title={info.savedTitle}
                  className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCheck className="size-3" /> salvo
                </motion.span>
              )}
            </AnimatePresence>
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
        {paceMin !== undefined && paceMin >= 1 && (
          <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
            ritmo alvo ≈ <span className="font-semibold tabular-nums">{paceMin} min</span> por
            questão
          </p>
        )}
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

            {/* ENUNCIADO: div overflow-y-auto em vez de ScrollArea — o viewport
                do Radix usa display:table, que em telas estreitas impede o wrap
                do texto e estourava o diálogo (548px num viewport de 390). */}
            <div className="max-h-[30vh] min-w-0 overflow-y-auto pr-2">
              <p className="text-sm leading-relaxed text-foreground/90">{ex.statement}</p>
            </div>

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
                type="button"
                onClick={() => onNavigate(i)}
                aria-label={`Ir para questão ${i + 1}`}
                aria-current={i === idx ? 'step' : undefined}
                className={cn(
                  'size-11 rounded-md border text-[11px] font-semibold transition-all sm:size-7',
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

      {/* Rodapé de avaliação — 2 linhas no mobile, 1 no desktop. flex-wrap:
          sem ele, 5 botões h-11 não cabem em 390px e o último é cortado. */}
      <div className="space-y-2.5 border-t bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onHintToggle}
            className="h-11 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400 sm:h-8"
          >
            {hintVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {hintVisible ? 'Esconder dica' : 'Ver dica'}
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={idx === 0}
              onClick={() => onNavigate(idx - 1)}
              className="h-11 sm:h-8"
            >
              <ArrowLeft className="size-3.5" /> Anterior
              <kbd className="ml-1 hidden rounded bg-muted px-1 text-[10px] lg:inline">←</kbd>
            </Button>
            {idx < questions.length - 1 ? (
              <Button variant="outline" size="sm" onClick={() => onNavigate(idx + 1)} className="h-11 sm:h-8">
                Próxima <kbd className="mr-1 hidden rounded bg-muted px-1 text-[10px] lg:inline">→</kbd>
                <ArrowRight className="size-3.5" />
              </Button>
            ) : null}
            {/* Pausa EXPLÍCITA (descoberta do crash-proof do 62): salva e
                fecha — a retomada espera no banner do setup. */}
            <Button
              size="sm"
              variant="outline"
              onClick={onPause}
              title="Salva a prova e fecha — retome depois de onde parou"
              className="h-11 border-teal-500/40 text-teal-600 hover:bg-teal-500/10 hover:text-teal-600 dark:text-teal-400 sm:h-8"
            >
              <Pause className="size-3.5" /> Pausar
            </Button>
            {/* Encerrar sempre disponível — aluno pode parar antes do fim */}
            <Button size="sm" variant="ghost" onClick={onFinish} className="h-11 sm:h-8">
              <Flag className="size-3.5" /> Encerrar
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-2">
          <Button
            size="sm"
            className="h-11 bg-emerald-600 text-white hover:bg-emerald-700 sm:h-8"
            onClick={() => onMark(true)}
          >
            <CheckCircle2 className="size-3.5" /> Consegui <kbd className="ml-1 hidden rounded bg-white/20 px-1 text-[10px] lg:inline">1</kbd>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-11 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400 sm:h-8"
            onClick={() => onMark(false)}
          >
            <XCircle className="size-3.5" /> Não consegui <kbd className="ml-1 hidden rounded bg-muted px-1 text-[10px] lg:inline">2</kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

function modeBadgeCls(mode: AttemptMode): string {
  // Identidade visual do modo no badge da prova: prova = emerald (o padrão),
  // treino = rose (mesma cor do card do Caderno), tópico = sky (a cor do
  // replay do Histórico). A cor É o rótulo — escaneável a 1 metro.
  return mode === 'treino'
    ? 'bg-rose-600 text-white'
    : mode === 'topico'
      ? 'bg-sky-600 text-white'
      : 'bg-emerald-600 text-white';
}

/* ================= Revisão antes de entregar ================= */

/**
 * Conferência final antes de Encerrar — como numa prova real: nada de
 * surpresa no resultado. Mostra as marcas por questão (consegui/não
 * consegui/sem marca), deixa navegar para revisar e só então entrega.
 * O cronômetro CONTINUA no topo — encerrar continua sendo uma decisão
 * com preço, agora com visão do todo.
 */
function FinishReview({
  questions,
  results,
  timeInfo,
  barColor,
  timePct,
  mode,
  onBack,
  onConfirm,
  onNavigate,
}: {
  questions: Exercise[];
  results: QuestionResult[];
  timeInfo: { label: string; value: string };
  barColor: string;
  timePct: number;
  mode: AttemptMode;
  onBack: () => void;
  onConfirm: () => void;
  onNavigate: (i: number) => void;
}) {
  const info = MODE_INFO[mode];
  const solved = results.filter((r) => r.solved === true).length;
  const missed = results.filter((r) => r.solved === false).length;
  const unmarked = questions.length - solved - missed;

  const stateLabel = (s: boolean | null) =>
    s === true ? 'marcada como consegui' : s === false ? 'marcada como não consegui' : 'sem marca';

  return (
    <div>
      {/* Barra de tempo fixa (a prova segue correndo — honesto) */}
      <div className="border-b px-4 pb-3 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge className={`shrink-0 ${modeBadgeCls(mode)}`}>
            {mode === 'treino' ? <Dumbbell className="mr-1 size-3" aria-hidden /> : null}
            {mode === 'topico' ? <Target className="mr-1 size-3" aria-hidden /> : null}
            {info.badge}
          </Badge>
          <span className="min-w-0 truncate text-sm font-semibold">
            Confira antes de entregar
          </span>
          <div
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm font-semibold tabular-nums',
              configTimeTone(timePct),
            )}
          >
            <AlarmClock className="size-3.5" />
            {timeInfo.value}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', barColor)} style={{ width: `${Math.max(0, Math.min(100, timePct))}%` }} />
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-6">
        {/* Contagem honesta por estado — a mesma gramática do resultado */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" aria-hidden />
            <span className="font-bold tabular-nums">{solved}</span> resolvida{solved === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
            <XCircle className="size-3.5" aria-hidden />
            <span className="font-bold tabular-nums">{missed}</span> sem sucesso
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
            <ListChecks className="size-3.5" aria-hidden />
            <span className="font-bold tabular-nums">{unmarked}</span> sem marca
          </span>
        </div>

        {unmarked > 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
            Sem marca conta como pulada no resultado. Toque na questão para voltar e decidir.
          </p>
        )}

        {/* Chips por questão — mesma gramática visual da navegação da prova */}
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const r = results[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => onNavigate(i)}
                aria-label={`Revisar questão ${i + 1} — ${stateLabel(r.solved)}`}
                className={cn(
                  'size-11 rounded-md border text-[11px] font-semibold transition-all hover:scale-105 sm:size-9',
                  r.solved === true && 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                  r.solved === false && 'border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400',
                  r.solved === null && 'border-dashed border-border text-muted-foreground hover:border-emerald-500/40',
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Encerrar é definitivo: a tentativa vai para o Histórico e o que faltou
          alimenta o Caderno de Erros automaticamente.
        </p>
      </div>

      {/* Entrega — decisão em duas portas, mobile em coluna cheia */}
      <div className="space-y-2 border-t bg-muted/30 px-4 py-4 sm:flex sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-2 sm:space-y-0 sm:px-6">
        <Button
          onClick={() => onConfirm()}
          className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:h-9 sm:w-auto"
        >
          <Flag className="size-3.5" /> Encerrar e ver resultado
        </Button>
        <Button
          variant="outline"
          onClick={onBack}
          className="h-11 w-full sm:h-9 sm:w-auto"
        >
          <RotateCcw className="size-3.5" /> Voltar para a prova
        </Button>
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
  timeByQ,
  endedByClock,
  mode,
  onRetryMissed,
  onNew,
  onOpenChange,
}: {
  questions: Exercise[];
  results: QuestionResult[];
  solvedCount: number;
  missedCount: number;
  skippedCount: number;
  pct: number;
  elapsed: number;
  /** Tempo por questão (t192) — a matéria-prima do strip "Onde o tempo foi". */
  timeByQ: number[];
  /** O relógio encerrou a prova (00:00)? O debrief confessa o sino. */
  endedByClock: boolean;
  /** Natureza da tentativa — o resultado declara o que foi (prova/treino). */
  mode: AttemptMode;
  /** Reinicia com as erradas/puladas — com tópico, só as daquele tópico. */
  onRetryMissed: (topic?: string) => void;
  onNew: () => void;
  onOpenChange: (v: boolean) => void;
}) {
  const info = MODE_INFO[mode];
  const missedList = questions.filter((q, i) => results[i].solved !== true);
  const hasMissed = missedList.length > 0;
  // ONDE O TEMPO FOI (t192): o resumo de pacing vem da FUNÇÃO PURA da casa
  // (mesma régua do prompt da IA). Runs antigos (pré-t192) chegam sem tempo
  // → measured false → o strip CALA (sem registro não há linha, regra 88).
  const pacing = pacingFor(timeByQ);
  const stripSecs = timeByQ.map((t) => Math.max(0, Math.round(t ?? 0)));
  // A rodada FRESCA sabe que foi o ENSAIO OFICIAL quando é prova de Matemática
  // no dia marcado (mesmo critério do findMathSimuladoRunOficial, aqui local:
  // o ResultsScreen pode renderizar antes do histórico reler o localStorage).
  // Só o debrief do ensaio real pede o tom de prova oficial — treino cala.
  const freshRunOficial =
    mode === 'prova' &&
    isSimuladoDayToday() &&
    questions.every((q) => q.disciplineCode === MATH_EXAM.disciplineCode);
  const verdict =
    pct >= 80
      ? { label: 'Excelente!', tone: 'text-emerald-500', icon: Trophy }
      : pct >= 60
        ? { label: 'Bom trabalho', tone: 'text-emerald-500', icon: CheckCircle2 }
        : pct >= 40
          ? { label: 'Continue praticando', tone: 'text-amber-500', icon: Target }
          : { label: 'Hora de revisar', tone: 'text-rose-500', icon: RotateCcw };

  // Desempenho por tópico: onde o foco deve estar antes da prova (pior
  // primeiro). A AGREGAÇÃO é a FONTE ÚNICA da casa (t189): topicRowsFor —
  // a MESMA régua do veredito/kit/folha (taxa sobre RESPONDIDAS; bloco
  // inteiro pulado → pct null, sem taxa inventada) + sortWorstFirst (a
  // MESMA regra do foco: pulouTudo vem primeiro). A régua local antiga
  // (resolvidas/total — puladas no denominador) fazia a tabela divergir do
  // veredito no MESMO diálogo (2S+1M+1P = 50% na tabela, 67% no veredito)
  // e pintava o bloco nunca visto como "0%" (falso "tentou e errou").
  const topicStats = React.useMemo(() => {
    const rows = topicRowsFor(
      questions.map((q, i) => ({
        disciplineCode: q.disciplineCode,
        topic: q.topic,
        // QuestionResult: true=consegui, false=não consegui, null=pulado/não vista
        status:
          results[i]?.solved === true
            ? ('solved' as const)
            : results[i]?.solved === false
              ? ('missed' as const)
              : ('skipped' as const),
      })),
    );
    return sortWorstFirst(rows);
  }, [questions, results]);
  const multiTopic = topicStats.length > 1;
  // O ENDEREÇO DA REGRA (t188): o chip do dia do simulado lido do PRÓPRIO
  // plano — 'pelo plano D-7' era rótulo de memória que o PLANO REFEITO
  // deixou velho (a regra vive no D-2). Plano sem dia de simulado → chip
  // cala e a frase segue honesta ('pelo plano, ...').
  const regraChip = simuladoRegraPlanoChip();

  // VEREDITO DA META: corrida 100% Matemática = corrida do escopo da Av1 —
  // compara direto com a nota de aprovação (≥ 70, MATH_META). Abaixo da meta,
  // aplica a regra do plano (MATH_SIMULADO_REGRA_REVISAO, a tarefa do dia do
  // simulado — t188: o ENDEREÇO do plano é derivado via simuladoRegraPlanoChip,
  // o rótulo velho 'D-7' do plano antigo morreu) e oferece o drill do pior
  // tópico a 1 clique.
  const isAv1Run =
    questions.length > 0 &&
    questions.every((q) => q.disciplineCode === MATH_EXAM.disciplineCode);

  return (
    // min-w-0: como item do grid do DialogContent, permite o conteúdo encolher
    // abaixo do min-content (linhas com truncate/nowrap não podem estourar a caixa).
    <div className="min-w-0">
      <div className="border-b bg-gradient-to-r from-emerald-600/15 via-teal-500/10 to-transparent px-6 py-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <verdict.icon className="size-4" />
            </span>
            {info.resultsTitle}
          </DialogTitle>
          <DialogDescription>
            <span className={cn('font-semibold', verdict.tone)}>{verdict.label}</span> ·{' '}
            {info.resultsDesc}
          </DialogDescription>
          {/* O SINO CONFESSA (t192): acabou o tempo ≠ desisti — o primeiro
              pede ESTRATÉGIA (pular e voltar), o segundo pede CONTEÚDO. A
              voz é a da casa: fato seco, sem drama, família amber (a atenção). */}
          {endedByClock && (
            <DialogDescription className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/[0.07] px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
              <AlarmClock className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>
                Encerrada <span className="font-semibold">pelo relógio</span> (00:00) — o que
                ficou em branco ficou em branco. Na prova real: marque o chute educado e
                volte se sobrar minuto.
              </span>
            </DialogDescription>
          )}
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

      {/* VEREDITO DA META — a regra do plano (a tarefa do dia do simulado,
          "Meta: ≥ 70%") aplicada na hora; o endereço do dia lê o plano */}
      {isAv1Run && (
        <div className="px-6 pb-1">
          {pct >= MATH_META ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.07] px-3.5 py-3">
              <Target className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
              <p className="text-xs leading-relaxed">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Meta da Av1 batida: {pct}%
                </span>
                <span className="text-muted-foreground"> (aprovação ≥ {MATH_META})</span>
                {pct > MATH_META && (
                  <>
                    {' '}
                    · <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{pct - MATH_META}pp</span> de folga
                  </>
                )}
                <span className="text-muted-foreground"> — na véspera, manter o ritmo com drills curtos.</span>
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-3.5 py-3">
              <Target className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <div className="min-w-0 flex-1 text-xs leading-relaxed">
                <p>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    Faltam {MATH_META - pct}pp para a meta da Av1
                  </span>
                  <span className="text-muted-foreground">
                    {' '}(você fez <span className="font-semibold tabular-nums">{pct}%</span>, aprovação ≥ {MATH_META})
                  </span>
                  {multiTopic && (
                    <span className="text-muted-foreground">
                      {' '}— pelo plano
                      {regraChip && (
                        <span className="font-semibold tabular-nums"> {regraChip}</span>
                      )}
                      {', '}
                      {MATH_SIMULADO_REGRA_REVISAO}.
                    </span>
                  )}
                </p>
                {topicStats.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      openSimulado({
                        disciplineCode: MATH_EXAM.disciplineCode,
                        topicScope: topicStats[0].topic,
                      });
                    }}
                    title={`Abrir prova curta (5 questões) só de ${topicStats[0].topic} no Simulado Pro`}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-400"
                  >
                    <Play className="size-3" aria-hidden />
                    Treinar só {topicStats[0].topic} ({topicStats[0].solved}/{topicStats[0].total})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desempenho por tópico — a prova vira mapa de estudo (pior primeiro) */}
      {multiTopic && (
        <div className="px-6 pb-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Desempenho por tópico
            </p>
            {(topicStats[0].pct === null || topicStats[0].pct < 60) && (
              <Badge className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                <Target className="mr-1 size-2.5" /> foco: {topicStats[0].topic}
              </Badge>
            )}
          </div>
          <div className="space-y-2.5">
            {topicStats.map((t, i) => (
              <div key={`${t.disciplineCode}:${t.topic}`} className="group">
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate font-medium">{t.topic}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="tabular-nums text-muted-foreground">
                      {t.solved}/{t.total} ·{' '}
                      <span
                        className={cn(
                          'font-semibold',
                          // COR = SIGNIFICADO (t189): bloco inteiro pulado não
                          // veste a tinta do erro (nunca tentou ≠ tentou e
                          // errou) — zinc, a cor do neutro honesto.
                          t.pct === null
                            ? 'text-zinc-500 dark:text-zinc-400'
                            : t.pct >= 60
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : t.pct >= 40
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {t.pct === null ? 'pulou tudo' : `${t.pct}%`}
                      </span>
                      {/* A voz honesta do MISTO: puladas à parte (a taxa não
                          pune o pulado — o número confessa as duas verdades). */}
                      {t.pct !== null && t.skipped > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground/80">
                          {t.skipped} pulada{t.skipped === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                    {/* Micro-ações do tópico: aparecem no hover, sempre acessíveis por teclado.
                        1º Refazer as erradas DESTE tópico (só quando existe erro nele). */}
                    <span className="flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      {t.total - t.solved > 0 && (
                        <button
                          type="button"
                          onClick={() => onRetryMissed(t.topic)}
                          title={`Refazer agora as ${t.total - t.solved} que não consegui ou pulei em ${t.topic}`}
                          aria-label={`Refazer as questões erradas de ${t.topic}`}
                          className="inline-flex size-6 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-violet-800/70 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/50"
                        >
                          <RotateCcw className="size-3" aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          openPractice({ disciplineCode: t.disciplineCode, topic: t.topic });
                        }}
                        title={`Filtrar exercícios de ${t.topic} em Praticar`}
                        aria-label={`Filtrar exercícios de ${t.topic} em Praticar`}
                        className="inline-flex size-6 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/50"
                      >
                        <BookOpen className="size-3" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          openTutor({
                            disciplineCode: t.disciplineCode,
                            question: buildQuizPrompt({
                              disciplineName:
                                getDisciplineByCode(t.disciplineCode)?.shortName ??
                                t.disciplineCode,
                              scope: `somente o tópico "${t.topic}" (conteúdo já dado em sala)`,
                              count: 5,
                            }),
                          });
                        }}
                        title={`Me testa em ${t.topic} (recall ativo, 5 questões)`}
                        aria-label={`Me testa em ${t.topic} com recall ativo`}
                        className="inline-flex size-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                      >
                        <Sparkles className="size-3" aria-hidden />
                      </button>
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      // A barra LÊ O DIAGNÓSTICO (t189): bloco inteiro pulado
                      // fica vazia e neutra (nada tentado — nada pintado de
                      // erro); respondido segue na família da taxa.
                      t.pct === null
                        ? 'bg-zinc-400/60 dark:bg-zinc-600'
                        : t.pct >= 60
                          ? 'bg-emerald-500'
                          : t.pct >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500',
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: t.pct === null ? '0%' : `${Math.max(t.pct, 4)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 + i * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ONDE O TEMPO FOI (t192) — o pacing é intel da prova real: a Av1 tem
          relógio, e saber que a q3 comeu 18 dos 60 min muda a estratégia
          (pular e voltar). O dot segue a gramática do resultado (emerald/
          rose/zinc) — tempo × desfecho na MESMA linha; a mais lenta veste
          amber (a atenção da casa) com a confissão no hover. Runs sem tempo
          medido calam — sem registro não há linha (regra 88). */}
      {pacing.measured && (
        <div className="px-6 pb-2">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Hourglass className="size-3" aria-hidden /> Onde o tempo foi
            </p>
            <p className="text-[10px] tabular-nums text-muted-foreground/80">
              {fmtClock(Math.round(pacing.totalSec))} nas questões
              {elapsed - pacing.totalSec >= 3 && (
                <> · {fmtClock(elapsed)} no relógio (a diferença ficou fora das questões)</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stripSecs.map((secs, i) => {
              const isSlowest = i === pacing.slowestIdx;
              const solved = results[i]?.solved;
              const q = questions[i];
              return (
                <span
                  key={q?.id ?? i}
                  title={pacingChipTitle({
                    idx: i,
                    secs,
                    totalSec: Math.round(pacing.totalSec),
                    slowestIdx: pacing.slowestIdx,
                    topic: q?.topic,
                    solved: solved ?? null,
                  })}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                    isSlowest
                      ? 'border-amber-500/50 bg-amber-500/10 font-semibold text-amber-700 dark:text-amber-400'
                      : 'border-border bg-muted/50 text-muted-foreground',
                  )}
                >
                  {/* O DOT do desfecho (a gramática da casa): tempo × resultado
                      na mesma linha — a q que travou E errou fica visível num
                      olhar (amber + rose juntos contam a história completa). */}
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      solved === true
                        ? 'bg-emerald-500'
                        : solved === false
                          ? 'bg-rose-500'
                          : 'bg-zinc-400 dark:bg-zinc-600',
                    )}
                  />
                  Q{i + 1} {fmtClock(secs)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {hasMissed && (
        <div className="px-6 pb-2">
          <button
            type="button"
            onClick={() => {
              // disciplina com mais erros + 1º tópico perdido → sessão guiada de revisão
              const byDisc = new Map<string, number>();
              for (const q of missedList) {
                byDisc.set(q.disciplineCode, (byDisc.get(q.disciplineCode) ?? 0) + 1);
              }
              const worst = [...byDisc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
              onOpenChange(false);
              openMethod({
                disciplineCode: worst,
                topic: `Revisão de erros do simulado: ${missedList[0].topic}`,
              });
            }}
            className="w-full rounded-lg border border-violet-300 bg-violet-50/70 px-3 py-2.5 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/40"
          >
            🎯 Fechar o ciclo: revisar esses erros com uma Sessão guiada do Protocolo HUB →
          </button>
          {/* A PROMESSA CUMPRIDA (131): a tela de entrega promete "o que faltou
              alimenta o Caderno de Erros automaticamente" — mas o resultado
              nunca MOSTROU a promessa acontecer. O recibo mora aqui, onde o
              aluno aterrissa no instante da entrega (recordRun já gravou: as
              duas vias — exerciseProgress.tried e o run.questions — são
              escritas ANTES de setPhase('results'), o recibo nunca mente).
              A janela de 48h é a MESMA régua do caderno (frescas); a porta é
              a MESMA do card da prova (openProgress → aba Progresso). Família
              amber: revisão é "a espera" da casa (a gramática do kit/fila/
              mapa). Run perfeito cala — sem registro não há linha (regra 88). */}
          <div className="mt-2.5 flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-3.5 py-3">
            <BookX className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
            <div className="min-w-0 flex-1 text-xs leading-relaxed">
              <p>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  O que faltou ({missedList.length}) já está no Caderno de Erros
                </span>
                <span className="text-muted-foreground">
                  {' '}— a entrega prometeu, o caderno cumpriu. Revise as frescas em até{' '}
                  <span className="font-semibold tabular-nums">48h</span> — erro revisitado
                  logo vira acerto na prova.
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  openProgress();
                }}
                title="Abrir o Caderno de Erros na aba Progresso"
                aria-label="Abrir o Caderno de Erros na aba Progresso"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-400"
              >
                Abrir o caderno
                <ChevronRight className="size-3" aria-hidden />
              </button>
            </div>
          </div>
          <p className="mb-2 mt-3 text-xs font-medium text-muted-foreground">
            Para revisar depois ({missedList.length}):
          </p>
          <div className="space-y-1.5">
            {missedList.slice(0, 4).map((q) => (
              <div key={q.id} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 transition-colors hover:bg-muted/50">
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  {getDisciplineByCode(q.disciplineCode)?.shortName ?? q.disciplineCode} · {q.topic} — {q.statement.slice(0, 70)}…
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    openTutor({
                      disciplineCode: q.disciplineCode,
                      materialId: q.linkedMaterials?.[0],
                      question: `No simulado que acabei de fazer, NÃO CONSEGUI resolver a questão de ${getDisciplineByCode(q.disciplineCode)?.shortName ?? q.disciplineCode} (tópico: ${q.topic}): "${q.statement}". Me ensina como se resolve, passo a passo, como o professor faria na correção?`,
                    });
                  }}
                  title="Perguntar à IA como resolver esta questão"
                  aria-label="Perguntar à IA como resolver esta questão do simulado"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-200"
                >
                  <Sparkles className="size-3" aria-hidden />
                </button>
              </div>
            ))}
            {missedList.length > 4 && (
              // A PORTA DAS OCULTAS: a lista de cima mostra 4 — as restantes
              // não podiam ficar mudas no dia em que cada erro conta. Uma
              // pergunta só, com TODAS as ocultas (enunciado + tópico), na
              // mesma via openTutor das portas individuais. Em 10 questões
              // com 10 erros: ~3.2k chars, bem abaixo do teto de 5500 do
              // capQuestion — não trunca.
              <button
                type="button"
                onClick={() => {
                  const ocultas = missedList.slice(4);
                  const byDisc = new Map<string, number>();
                  for (const q of ocultas) {
                    byDisc.set(q.disciplineCode, (byDisc.get(q.disciplineCode) ?? 0) + 1);
                  }
                  // Disciplina com mais erros entre as ocultas — a mesma régua
                  // da porta do ciclo (linha 1924) e do debrief completo.
                  const worst =
                    [...byDisc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
                    ocultas[0]?.disciplineCode;
                  onOpenChange(false);
                  openTutor({
                    disciplineCode: worst,
                    question: [
                      `No simulado que acabei de fazer, NÃO CONSEGUI resolver também estas ${ocultas.length} questões (ficaram fora da lista de cima):`,
                      ...ocultas.map(
                        (q) =>
                          `- [${getDisciplineByCode(q.disciplineCode)?.shortName ?? q.disciplineCode} · ${q.topic}] ${q.statement}`,
                      ),
                      '',
                      'Me ensina como se resolve cada uma, passo a passo, como o professor faria na correção — começa pela que mais aparece na prova.',
                    ].join('\n'),
                  });
                }}
                title="Perguntar à IA como resolver TODAS as questões que ficaram fora da lista de cima"
                aria-label={`Perguntar à IA como resolver as outras ${missedList.length - 4} questões perdidas`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-500/[0.06] px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
                Perguntar à IA sobre as outras {missedList.length - 4} questões
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onNew}>
            <RotateCcw className="size-3.5" /> Novo simulado
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              const worst = questions.filter((q, i) => results[i].solved !== true);
              openTutor({
                disciplineCode: worst[0]?.disciplineCode ?? questions[0]?.disciplineCode,
                question: buildDebriefFromDetails({
                  mode, // prop do ResultsScreen — a IA sabe se foi prova ou treino
                  isOficial: freshRunOficial, // o ensaio oficial da Av1 se declara — a IA sabe o stake
                  pct,
                  elapsedSec: elapsed,
                  details: questions.map((q, i) => ({
                    status:
                      results[i].solved === true
                        ? 'solved'
                        : results[i].solved === false
                          ? 'missed'
                          : 'skipped',
                    disciplineCode: q.disciplineCode,
                    topic: q.topic,
                    difficulty: q.difficulty,
                    statement: q.statement,
                    // O PACING na análise (t192): a IA lê "onde o tempo foi"
                    // junto com o desfecho — pulada com 18 min é a história
                    // mais importante da prova cronometrada.
                    timeSec: stripSecs[i] ?? 0,
                  })),
                }),
              });
            }}
            aria-label={
              freshRunOficial
                ? 'Enviar o resultado do ensaio oficial da Av1 para a IA analisar e montar o plano da véspera'
                : 'Enviar o resultado do simulado para a IA analisar e montar plano de revisão'
            }
            title={
              freshRunOficial
                ? 'Foi o SIMULADO OFICIAL — a análise vira o plano da véspera, com a meta de aprovação na conta'
                : undefined
            }
            className="border-amber-300 bg-amber-50 font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
          >
            <Sparkles className="size-3.5" /> Analisar com IA
          </Button>
        </div>
        {hasMissed && (
          <Button
            size="sm"
            onClick={() => onRetryMissed()}
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
