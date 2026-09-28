'use client';

// ExamPrepCard — FOCO: Prova de Matemática (Av1, 01/10).
// Card do Painel com plano de 12 dias material-first, fórmulas essenciais,
// checklist de domínio e atalho para o Simulado da Av1. Persistência do
// progresso das tarefas em localStorage (sobrevive a reloads).

import * as React from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  AlarmClock,
  ArrowUpRight,
  Backpack,
  BookOpen,
  BookX,
  Calculator,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Crosshair,
  Dumbbell,
  Flag,
  GraduationCap,
  Layers,
  ListChecks,
  Minus,
  Moon,
  PenLine,
  Play,
  Printer,
  RotateCcw,
  ScrollText,
  Sigma,
  Sparkles,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { daysUntilDate } from '@/lib/semester';
import { openMethod, openPractice, openProgress, openSimulado, openTutor } from '@/lib/hub-events';
import { buildQuizPrompt } from '@/lib/tutor-quiz';
import { buildRunDebriefQuestion, computeTopicTrends } from '@/lib/simulado-debrief';
import {
  buildReadinessQuestion,
  computeReadiness,
  type ReadinessComponentId,
  type ReadinessResult,
  type ReadinessTone,
} from '@/lib/exam-readiness';
import { useLocalStorage } from '@/lib/use-local-storage';
import { flashcardsDueFor, useStudyProgress } from '@/lib/study-progress';
import { collectMistakes, notebookStats, pendingMistakes } from '@/lib/mistake-notebook';
import { cn } from '@/lib/utils';
import { TutorMarkdown } from '@/components/hub/tutor-markdown';
import {
  MATH_CHECKLIST,
  MATH_DECK_FLAG,
  MATH_EXAM,
  MATH_EXAM_KIT,
  MATH_EXAM_PLAN,
  MATH_FLASHCARDS,
  MATH_FORMULAS,
  MATH_LISTAS,
  MATH_META,
  MATH_PLAN_KEY,
  MATH_SIMULADO_DATE,
  MATH_TOPICO_CURTO,
  MATH_TRAVADAS_KEY,
  countTravadas,
  examWeekMilestoneFor,
  findMathSimuladoRunOficial,
  formatTravadas,
  isVesperaWindow,
  mathDrillFeedbackFor,
  normalizeTravadas,
  planDayChecked,
  planDayFor,
  planDaysBehind,
  simuladoVerdictFor,
  type DrillRunLike,
  type PlanDay,
  type PlanKind,
  type SimuladoTopicScore,
  type SimuladoVerdict,
} from '@/lib/math-exam-prep';

/** Rótulo curto do tópico — o kit fala 'Matrizes'/'Lógica', não o nome do catálogo. */
const curto = (topic: string): string => MATH_TOPICO_CURTO[topic] ?? topic;

/**
 * O PLACAR DO SIMULADO EM CHIPS — a linha do bloco fraco mostrava o placar
 * como texto corrido; na véspera, noite, o número que importa tem que ser
 * ESCANEÁVEL: verde = taxa ≥ meta, âmbar = abaixo (número real atrás), e o
 * NOVO estado — borda TRACEJADA rose = o bloco todo pulado (nem tentou:
 * '0/5' com a cor de erro mentiria, com a cor de acerto também). Puladas
 * parciais ganham '(N puladas)' no chip. Os separadores ' · ' ficam como
 * texto entre os spans — o textContent continua 'Matrizes 5/5 · Lógica 2/5'
 * (o QA da 95 continua válido sem mudança).
 */
function PlacarChips({ porTopico }: { porTopico: SimuladoTopicScore[] }) {
  if (porTopico.length === 0) return null;
  return (
    <>
      {porTopico.map((t, i) => {
        const pulouTudo = t.skipped === t.total;
        const abaixo = t.pct != null && t.pct < 70;
        return (
          <span key={t.topic}>
            {i > 0 && ' · '}
            <span
              className={cn(
                'inline-block whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] font-semibold tabular-nums',
                pulouTudo
                  ? 'border-dashed border-rose-400/70 bg-rose-500/[0.06] text-rose-600 dark:text-rose-400'
                  : abaixo
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              )}
            >
              {curto(t.topic)} {t.solved}/{t.total}
              {pulouTudo
                ? ' (pulou tudo)'
                : t.skipped > 0
                  ? ` (${t.skipped} ${t.skipped === 1 ? 'pulada' : 'puladas'})`
                  : ''}
            </span>
          </span>
        );
      })}
    </>
  );
}

const KIND_LABEL: Record<PlanKind, string> = {
  estudo: 'Estudo',
  pratica: 'Prática',
  simulado: 'Simulado',
  revisao: 'Revisão',
  prova: 'Prova',
};

const KIND_STYLE: Record<PlanKind, string> = {
  estudo: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  pratica: 'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  simulado: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  revisao: 'border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400',
  prova: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

type CheckedMap = Record<string, boolean>;
const LS_CHECK = 'hub:math-exam:v1:checklist';

/** Mapeia "faltam N dias" para o dia do plano (offset N = N dias antes da prova; 0 = prova). */
function planDayForDaysLeft(daysLeft: number): PlanDay | undefined {
  if (daysLeft < 0) return undefined;
  const offset = Math.min(Math.max(daysLeft, 0), MATH_EXAM_PLAN.length - 1);
  return planDayFor(offset) ?? MATH_EXAM_PLAN[Math.min(offset, MATH_EXAM_PLAN.length - 1)];
}

export function ExamPrepCard() {
  const daysLeft = daysUntilDate(MATH_EXAM.date);
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = useLocalStorage<CheckedMap>(MATH_PLAN_KEY, {});
  const [checklist, setChecklist] = useLocalStorage<CheckedMap>(LS_CHECK, {});
  // Espelho das marcas de caneta nas listas impressas (Travadas das listas):
  // o aluno marca as questões que travaram e a véspera usa o registro.
  const [travadas, setTravadas] = useLocalStorage<Record<string, boolean>>(
    MATH_TRAVADAS_KEY,
    {},
    normalizeTravadas,
  );
  const travadasCount = countTravadas(travadas);
  const travadasLabel = React.useMemo(() => formatTravadas(travadas), [travadas]);
  const sp = useStudyProgress();
  // Caderno de Erros: contagem ao vivo dos PENDENTES (revisados não disputam
  // atenção na véspera — o card mostra o que ainda pede trabalho).
  const mistakes = React.useMemo(() => collectMistakes(sp.progress), [sp.progress]);
  const mistakePending = React.useMemo(
    () => pendingMistakes(mistakes, sp.progress.notebookRevised).length,
    [mistakes, sp.progress.notebookRevised],
  );
  const mistakeRevised = mistakes.length - mistakePending;
  const mistakeStats = React.useMemo(() => notebookStats(mistakes), [mistakes]);
  // Score de prontidão: recalculado AO VIVO — marcar tarefa/checklist, revisar
  // cartão ou correr o simulado sobe o número na hora (sem reload).
  const readiness = React.useMemo(
    () => computeReadiness(sp.progress, checked, checklist),
    [sp.progress, checked, checklist],
  );
  // Baralho da Av1: flag no localStorage + dedupe por frente (à prova de flag perdida).
  const [deckAdded, setDeckAdded] = React.useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(MATH_DECK_FLAG) === '1',
  );
  // Kit da véspera → "Recitar as fórmulas" e "Refazer as travadas" abrem o
  // plano completo JÁ ROLADO até a seção pedida (o aluno não caça seção na
  // véspera da prova).
  const [dialogFocus, setDialogFocus] = React.useState<'formulas' | 'travadas' | null>(null);
  React.useEffect(() => {
    if (!open || !dialogFocus) return;
    const id = window.setTimeout(() => {
      document
        .getElementById(`dlg-${dialogFocus}`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      setDialogFocus(null);
    }, 120); // espera o conteúdo do Dialog montar
    return () => window.clearTimeout(id);
  }, [open, dialogFocus]);

  // FOCO DA PROVA (dados reais, material-first): pior tópico do escopo da Av1
  // segundo a tendência das tentativas do Simulado Pro. O card deixa de ser
  // só plano e aponta ONDE revisar — com 1 clique no drill daquele tópico.
  // Sem tentativas com detalhes → a linha some (honesto, sem invenção).
  const examFocus = React.useMemo(() => {
    const trends = computeTopicTrends(sp.progress.simuladoRuns ?? []).filter(
      (t) =>
        t.disciplineCode === MATH_EXAM.disciplineCode &&
        (MATH_EXAM.topicosEscopo as readonly string[]).includes(t.topic),
    );
    if (trends.length === 0) return null;
    return { worst: trends[0], allGood: trends.every((t) => t.last >= 80), trends };
  }, [sp.progress.simuladoRuns]);

  // O DIA DO SIMULADO SABE QUANDO ELE JÁ ACONTECEU: uma prova de Matemática
  // encerrada no DIA OFICIAL do plano vira estado "feito" no chip do marco,
  // no kit, na linha do tempo e no modo recuperação — a noite da terça pede a
  // CORREÇÃO, não um convite para começar de novo; e a véspera (30/09) não
  // acusa o simulado de "ter ficado para trás" quando ele foi feito. Render-
  // time (sem effect/interval, lição da 79): reage a mock de relógio no mesmo
  // frame e a runs novas no mesmo re-render (storage event). Sem prova de
  // Matemática no dia oficial → undefined (o chip continua convidando —
  // estado honesto).
  const simuladoDaysLeft = daysUntilDate(MATH_SIMULADO_DATE);
  // Fonte única (85): a MESMA função que o hero do dashboard usa — a verdade
  // "simulado feito no dia oficial" não pode divergir entre superfícies.
  // Render-time (sem effect/interval, lição da 79): reage a mock de relógio
  // no mesmo frame e a runs novas no mesmo re-render (storage event).
  const simuladoRunOnPlanDate = React.useMemo(
    () => findMathSimuladoRunOficial(sp.progress.simuladoRuns),
    [sp.progress.simuladoRuns],
  );
  const simuladoDoneOnPlanDate = !!simuladoRunOnPlanDate;
  // "Feito HOJE" é mais estreito: só no próprio dia (o kit da 80 fala do
  // simulado de hoje; na véspera o run é de ONTEM e o badge volta ao default).
  const simuladoDoneToday = simuladoDaysLeft === 0 && simuladoDoneOnPlanDate;

  // O KIT CUMPRE A PROMESSA DO PLANO: o simulado oficial promete "o bloco com
  // mais erros vira a revisão de amanhã" — o veredito transforma o run em
  // números por tópico (fonte única no módulo puro) e o kit da reta final
  // passa a falar o DESEMPENHO, não só o calendário. Render-time (sem
  // effect/interval, lição da 79): reage ao run no mesmo re-render via
  // storage event. Sem run → null — o kit segue no estado de espera honesto.
  const simuladoVerdict = React.useMemo(
    () => simuladoVerdictFor(simuladoRunOnPlanDate),
    [simuladoRunOnPlanDate],
  );

  // O PLANO NÃO MENTE: dias "para trás" = só os pendentes de verdade (tarefas
  // não marcadas E, no dia do simulado, sem run oficial). Antes, TODO dia
  // passado era acusado — "SIMULADO ficou para trás" na véspera com a prova
  // feita era a mentira mais cara da semana.
  const behind = planDaysBehind(daysLeft, checked, simuladoDoneOnPlanDate);

  // O BANNER APRENDE O MARCO (ensaio geral da rodada 121 — dress rehearsal do dia 29/09):
  // hoje = prova − daysLeft (o round-trip é honesto — daysLeft deriva de
  // startOfDay local nos DOIS lados). Âncora no meio-dia LOCAL (lição 108) e
  // FONTE ÚNICA examWeekMilestoneFor: o banner passa a falar a mesma língua
  // da Agenda/folha/mapa sem segunda derivação de data. Sem isso, no dia do
  // ensaio o banner ainda empurrava "catch-up ≈90 min antes do dia de hoje"
  // — um prazo impossível brigando com o dono do dia (e com o veredito do
  // kit, que já tinha nomeado a revisão de amanhã).
  const todayMilestone = React.useMemo(() => {
    const [y, m, d] = MATH_EXAM.date.split('-').map(Number);
    return examWeekMilestoneFor(new Date(y, m - 1, d - daysLeft, 12));
  }, [daysLeft]);

  /** 1 toque: todos os cartões da Av1 entram no sistema Leitner (Praticar → Flashcards). */
  function addAv1Deck() {
    const existing = new Set(sp.progress.flashcards.map((c) => c.front));
    const novas = MATH_FLASHCARDS.filter((c) => !existing.has(c.front));
    if (novas.length === 0) {
      setDeckAdded(true);
      window.localStorage.setItem(MATH_DECK_FLAG, '1');
      toast.info('O baralho da Av1 já está nos seus flashcards.');
      return;
    }
    const now = new Date().toISOString();
    sp.addFlashcards(
      novas.map((c) => ({
        disciplineCode: 'TEC.1984',
        front: c.front,
        back: c.back,
        source: 'manual' as const,
        createdAt: now,
        box: 0,
        dueAt: now, // vencidos já na criação — a revisão começa hoje
        reviews: 0,
        lapses: 0,
      })),
    );
    window.localStorage.setItem(MATH_DECK_FLAG, '1');
    setDeckAdded(true);
    toast.success(`${novas.length} cartões da Av1 adicionados — revise na aba Praticar → Flashcards.`);
  }

  // Prova passou → estado compacto, sem ruído — mas com o próximo passo real:
  // a nota vai para a Calculadora (deep-link, não só menção no texto).
  if (daysLeft < 0) {
    return (
      <Card className="rounded-xl border-rose-500/20 bg-gradient-to-r from-rose-500/5 to-transparent p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
            <CircleCheck className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Prova de Matemática (Av1) realizada</p>
            <p className="text-xs text-muted-foreground">
              Registre a nota na Calculadora quando sair o resultado — a média do semestre
              acompanha na hora.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openProgress()}
            className="h-9 shrink-0 gap-1.5 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 sm:h-8"
            aria-label="Abrir a Calculadora de notas na aba Progresso"
          >
            <Calculator className="size-3.5" /> Abrir a Calculadora
          </Button>
        </div>
      </Card>
    );
  }

  const day = planDayForDaysLeft(daysLeft);
  const totalTasks = MATH_EXAM_PLAN.reduce((a, d) => a + d.tarefas.length, 0);
  const doneTasks = Object.values(checked).filter(Boolean).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const urgente = daysLeft <= 3;

  function toggleTask(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleCheck(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleTravada(key: string) {
    setTravadas((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function openTravadas() {
    setDialogFocus('travadas');
    setOpen(true);
  }

  // Linha do tempo dos 8 dias (offset 7 → 0): passado✓ verde, passado✗ âmbar,
  // hoje pulsando em rosa, futuro cinza e prova como bandeira.
  const todayOffset = Math.min(Math.max(daysLeft, 0), MATH_EXAM_PLAN.length - 1);
  // Fonte única da conta (a mesma do banner e do diálogo): planDayChecked.
  const doneDay = (offset: number) =>
    MATH_EXAM_PLAN.filter((d) => d.offset === offset && d.offset !== 0).every((d) =>
      planDayChecked(d, checked),
    );

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden rounded-xl border shadow-sm transition-all',
          urgente
            ? 'border-rose-500/40 shadow-rose-500/10'
            : 'border-rose-500/20 hover:border-rose-500/40',
        )}
      >
        {/* Cabeçalho com contagem */}
        <div className="flex flex-col gap-3 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/30">
              <Sigma className="size-5.5" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                Foco: Prova de Matemática (Av1)
                {urgente && (
                  <Badge className="border-0 bg-rose-500 text-white">urgente</Badge>
                )}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3" />
                {MATH_EXAM.programa}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5">
            <span
              className={cn(
                'text-2xl font-bold leading-none tabular-nums',
                urgente ? 'text-rose-500' : 'text-foreground',
              )}
            >
              {daysLeft === 0 ? 'HOJE' : `${daysLeft}d`}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {daysLeft === 0 ? '01/10 · prova de Matemática' : '01/10 · faltam'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              title="Abrir o plano completo e as evidências do score de prontidão"
              aria-label="Abrir plano completo com as evidências do score de prontidão"
              className="mt-0.5 -mx-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              <span aria-hidden className={cn('size-1.5 rounded-full', READINESS_DOT[readiness.tone])} />
              <span className="text-muted-foreground">prontidão</span>
              <span className={cn('tabular-nums', READINESS_TEXT[readiness.tone])}>
                {readiness.score === null ? '—' : `${readiness.score}%`}
              </span>
              <ChevronDown className="size-2.5 text-muted-foreground/70" aria-hidden />
            </button>
          </div>
        </div>

        {/* MARCOS DA SEMANA: 29/09 (simulado escopo real + S3 Algoritmos) → 01/10 (prova).
            Ambos com estado "é hoje" no dia — mesmo tratamento visual do banner D-0:
            chip sólido, texto em contraste, pulso. Render-time, sem interval. */}
        <div className="border-t px-4 py-2.5">
          {/* flex-wrap: no dia do simulado o chip ganha a linha inteira (o
              aviso é longo e é O compromisso do dia) — divider e prova caem
              para a linha de baixo */}
          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const isSimuladoDay = simuladoDaysLeft === 0;
              const isSimuladoEve = simuladoDaysLeft === 1;
              // Feito no dia: a prova de Matemática do dia oficial já foi
              // encerrada — o chip deixa de convidar a começar e vira o
              // próximo passo real do plano D-2 (refazer no papel o que
              // errou → a correção ajuda).
              const isSimuladoDone = isSimuladoDay && simuladoDoneOnPlanDate;
              return (
                <button
                  type="button"
                  onClick={
                    isSimuladoDone && simuladoRunOnPlanDate
                      ? () =>
                          openTutor({
                            question: buildRunDebriefQuestion(simuladoRunOnPlanDate),
                            disciplineCode: MATH_EXAM.disciplineCode,
                          })
                      : () => openSimulado({ preset: 'math_exam' })
                  }
                  className={cn(
                    'group flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    isSimuladoDone
                      ? 'w-full border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600'
                      : isSimuladoDay
                        ? 'w-full border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30 hover:bg-amber-600 dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-900 dark:hover:bg-amber-300'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400',
                  )}
                  aria-label={
                    isSimuladoDone
                      ? 'Simulado da Av1 de hoje já foi feito — pedir a correção comentada ao tutor'
                      : isSimuladoDay
                        ? 'Hoje é o dia do Simulado da Av1 e da entrega S3 de Algoritmos — abrir o simulado'
                        : 'Abrir Simulado da Av1 com o escopo real da prova'
                  }
                >
                  {isSimuladoDone ? (
                    <CircleCheck className="size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        isSimuladoDay ? 'animate-pulse bg-white dark:bg-zinc-900' : 'animate-pulse bg-amber-500',
                      )}
                    />
                  )}
                  <span className={cn(isSimuladoDay ? 'whitespace-normal leading-snug' : 'truncate')}>
                    {isSimuladoDone ? (
                      <>
                        Simulado da Av1 <span className="font-bold">feito ✓</span> — pedir a correção
                      </>
                    ) : isSimuladoDay ? (
                      <>
                        É hoje · <span className="font-bold">Simulado da Av1</span> + entrega S3
                        Algoritmos
                      </>
                    ) : isSimuladoEve ? (
                      <>
                        Amanhã · <span className="font-semibold">Simulado da Av1</span> + entrega S3
                        Algoritmos
                      </>
                    ) : (
                      <>
                        29/09 · <span className="font-semibold">Simulado da Av1</span> no Hub +
                        entrega S3 Algoritmos
                      </>
                    )}
                  </span>
                  <ArrowUpRight className="size-3 shrink-0 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              );
            })()}
            <span
              aria-hidden
              className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-rose-500/40"
            />
            {(() => {
              const isProvaDay = daysLeft === 0;
              // Véspera da prova (30/09): o chip da prova também reconhece o
              // "amanhã" — simetria com o chip do simulado, estado via copy
              // (família rose contornada intacta: a urgência sólida é só do dia).
              const isProvaEve = daysLeft === 1;
              return (
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                    isProvaDay
                      ? 'border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/30 dark:border-rose-400 dark:bg-rose-400 dark:text-zinc-900'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 shrink-0',
                      isProvaDay ? 'animate-pulse rounded-full bg-white dark:bg-zinc-900' : 'rounded-full bg-rose-500',
                    )}
                  />
                  {isProvaDay ? (
                    <>
                      É hoje · <span className="font-bold">Prova Av1</span>
                    </>
                  ) : isProvaEve ? (
                    <>
                      Amanhã · <span className="font-semibold">Prova Av1</span>
                    </>
                  ) : (
                    <>
                      01/10 · <span className="font-semibold">Prova Av1</span>
                    </>
                  )}
                </span>
              );
            })()}
          </div>
        </div>

        {/* FOCO DA PROVA — pior tópico do escopo segundo a tendência REAL das tentativas */}
        {examFocus && (
          <div className="border-t px-4 py-2.5">
            {examFocus.allGood ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CircleCheck className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                Escopo da Av1 em dia —{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  todos os tópicos ≥ 80%
                </span>{" "}
                na última tentativa. Manter o ritmo.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px]">
                <span className="flex shrink-0 items-center gap-1 font-medium text-muted-foreground">
                  <Crosshair className="size-3.5 text-rose-500" aria-hidden /> foco da prova:
                </span>
                {examFocus.trends.map((t) => {
                  const isWorst = t === examFocus.worst;
                  const worstTone =
                    t.last < 40
                      ? 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                      : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400';
                  const pctTone =
                    t.last >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : t.last >= 40
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400';
                  return (
                    <span
                      key={t.topic}
                      className={cn(
                        'inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 font-medium',
                        isWorst ? worstTone : 'border-border bg-muted/30 text-muted-foreground',
                      )}
                    >
                      {isWorst && (
                        <button
                          type="button"
                          onClick={() =>
                            openSimulado({
                              disciplineCode: MATH_EXAM.disciplineCode,
                              topicScope: t.topic,
                            })
                          }
                          title={`Treinar só ${t.topic} no Simulado Pro (prova curta de 5 questões)`}
                          aria-label={`Treinar só ${t.topic} no Simulado Pro`}
                          className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                        >
                          <Play className="size-2.5" aria-hidden />
                        </button>
                      )}
                      <span className="max-w-[13rem] truncate">{t.topic}</span>
                      <span className={cn('font-bold tabular-nums', isWorst ? '' : pctTone)}>
                        {t.last}%
                      </span>
                      {t.series.length >= 2 && t.delta !== 0 && (
                        <span
                          title={
                            t.delta > 0
                              ? `Subiu ${t.delta} pp da 1ª para a última tentativa`
                              : `Caiu ${Math.abs(t.delta)} pp da 1ª para a última tentativa`
                          }
                          className={cn(
                            'flex items-center gap-0.5 text-[10px] font-semibold tabular-nums',
                            t.delta > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {t.delta > 0 ? (
                            <TrendingUp className="size-2.5" aria-hidden />
                          ) : (
                            <TrendingDown className="size-2.5" aria-hidden />
                          )}
                          {t.delta > 0 ? '+' : ''}
                          {t.delta}pp
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODO RECUPERAÇÃO: só os dias PENDENTES de verdade (o simulado feito
            no dia oficial e as tarefas marcadas saem da conta — o plano não mente).
            ENSAIO GERAL 121: o parágrafo agora DEFERE ao marco do dia (fonte única) —
            nos dias em que outra superfície é a dona (ensaio, véspera, prova) o
            catch-up não briga: espera, ou admite que já não cabe. */}
        {behind.length > 0 && (
          <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-2">
              {(() => {
                // O ÍCONE SEGUE O DONO DO DIA — detalhe com significado:
                // CircleAlert = a pendência é urgente AGORA (dia comum);
                // CalendarClock = a pendência espera o marco (a gramática de
                // espera da casa, a mesma do chip da Agenda);
                // Flag = prova — alarme nenhum, só a despedida honesta.
                const IconeRecuperacao =
                  todayMilestone?.kind === 'prova'
                    ? Flag
                    : todayMilestone
                      ? CalendarClock
                      : CircleAlert;
                return (
                  <IconeRecuperacao
                    className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                );
              })()}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Modo recuperação:{' '}
                  <span className="tabular-nums">{behind.length}</span> dia(s) do plano
                  seguem pendentes
                  {(() => {
                    // O banner também PROVA progresso: dias passados já cumpridos
                    // aparecem em emerald ao lado do que pende — recuperação sem
                    // culpa, com o crédito que o esforço merece.
                    const pastCount = MATH_EXAM_PLAN.filter(
                      (d) => d.offset > daysLeft && d.offset > 0,
                    ).length;
                    const doneCount = pastCount - behind.length;
                    return doneCount > 0 ? (
                      <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {' '}· {doneCount} já cumprido(s) ✓
                      </span>
                    ) : null;
                  })()}
                </p>
                <p
                  aria-live="polite"
                  className="mt-0.5 text-[11px] leading-relaxed text-amber-700/80 dark:text-amber-300/80"
                >
                  {(() => {
                    // A VOZ MUDA COM O MARCO (sem inventar estado — o pend
                    // segue listado em todos os dias que ainda aceitam ação):
                    const pend = behind.map((m) => m.titulo).join(' · ');
                    const fila = 'A fila certa está no card “Plano de Recuperação”.';
                    if (todayMilestone?.kind === 'prova') {
                      // O dia é do exame: alarme nenhum — o catch-up não é agora.
                      return 'Hoje é o dia da prova: nada de catch-up agora — boa prova!';
                    }
                    if (todayMilestone?.kind === 'simulado') {
                      // O ensaio é o dono do dia; o resultado decide a revisão
                      // de amanhã (a mesma voz do veredito do kit).
                      return `${pend}. O conteúdo CONTINUA na prova — hoje, porém, o dia é do ensaio real: o catch-up (≈90 min) espera, e o resultado decide o que a véspera revisa. ${fila}`;
                    }
                    if (todayMilestone?.kind === 'vespera') {
                      // Véspera = revisão leve (folha + só as travadas): o
                      // catch-up já não cabe, e o banner não mente dizendo que cabe.
                      return `${pend}. O conteúdo CONTINUA na prova, mas hoje é revisão leve — folha e só as travadas; o catch-up já não cabe nesta semana. ${fila}`;
                    }
                    // Dia comum (inclui o preparo): o catch-up ainda é ação real —
                    // e o prazo agora existe: a PROVA (antes dizia "antes do dia
                    // de hoje", um prazo impossível).
                    return `${pend}. O conteúdo CONTINUA na prova (01/10) — faça um catch-up condensado (≈90 min: slides da Aula 00 + 3 exercícios da Lista 01) até lá. ${fila}`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Linha do tempo: D-7 → prova — estado do plano num relance.
            TRILHO com preenchimento: verde no passado, rosando a prova —
            a posição de hoje é visível na linha, não só nos pontos. */}
        <div className="border-t px-4 py-3">
          <div className="relative">
            <span
              aria-hidden
              className="absolute top-[10px] h-0.5 rounded-full bg-muted"
              style={{
                left: `${100 / (MATH_EXAM_PLAN.length * 2)}%`,
                right: `${100 / (MATH_EXAM_PLAN.length * 2)}%`,
              }}
            />
            <span
              aria-hidden
              className="absolute top-[10px] h-0.5 rounded-full bg-gradient-to-r from-emerald-500/70 via-emerald-500/60 to-rose-500/50 transition-[width] duration-700 ease-out"
              style={{
                left: `${100 / (MATH_EXAM_PLAN.length * 2)}%`,
                // ENSAIO GERAL 121: o offset CONTA ATÉ A PROVA (D-7 = 7 … prova
                // = 0), mas o índice do ponto na tela corre PARA A PROVA — o
                // preenchimento é o caminho JÁ ANDADO: do primeiro dia (D-7)
                // até hoje. A fórmula antiga usava todayOffset como índice
                // crescente: no D-2 pintava até o D-5 e, NO DIA DA PROVA, o
                // trilho amanhecia VAZIO (width 0) — o único dia em que ele
                // deveria estar inteiro. (len−1−todayOffset) = índice de hoje.
                width: `${((MATH_EXAM_PLAN.length - 1 - todayOffset) / (MATH_EXAM_PLAN.length - 1)) * (100 - 2 * (100 / (MATH_EXAM_PLAN.length * 2)))}%`,
              }}
            />
            <div className="relative flex items-end justify-between gap-1">
            {MATH_EXAM_PLAN.map((d) => {
              const past = d.offset > todayOffset;
              const today = d.offset === todayOffset;
              const prova = d.offset === 0;
              // Feito = tarefas marcadas OU, no dia do simulado, a prova
              // oficial encerrada (o run é o registro — checkboxes são opcional).
              const complete =
                past && (doneDay(d.offset) || (d.kind === 'simulado' && simuladoDoneOnPlanDate));
              return (
                <div key={d.offset} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    aria-hidden
                    className={cn(
                      'relative z-10 grid size-5 place-items-center rounded-full border-2 text-[9px] font-bold tabular-nums transition-all',
                      prova && 'size-6 border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-600/30',
                      !prova && today && 'animate-pulse border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400',
                      !prova && !today && complete && 'border-emerald-500 bg-emerald-500 text-white',
                      !prova && !today && !complete && past && 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400',
                      !prova && !today && !past && 'border-border bg-muted text-muted-foreground/60',
                    )}
                  >
                    {complete ? '✓' : prova ? '🏁' : d.offset}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-medium tabular-nums',
                      today ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground/70',
                      prova && 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {prova ? 'prova' : `D-${d.offset}`}
                  </span>
                </div>
              );
            })}
            </div>
          </div>
        </div>

        {/* Dia de hoje do plano */}
        {day && (
          <div className="border-t px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('border text-[10px]', KIND_STYLE[day.kind])}>
                {KIND_LABEL[day.kind]}
              </Badge>
              <p className="text-sm font-medium">{day.titulo}</p>
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                <Timer className="size-3" /> {day.minutos} min
              </span>
            </div>
            {/* Reconhecimento honesto do simulado feito: a noite da terça vê
                o resultado no PRÓPRIO dia do plano (as checkboxes continuam
                lá — registro manual — mas o run já diz o que aconteceu). */}
            {day.kind === 'simulado' && simuladoRunOnPlanDate && (
              <div className="mt-2.5 flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/[0.07] px-2.5 py-2">
                <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <p className="min-w-0 text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-200/90">
                  <span className="font-semibold">Simulado feito hoje ✓</span>{' '}
                  <span className="tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                    {Math.round((simuladoRunOnPlanDate.solved / Math.max(simuladoRunOnPlanDate.total, 1)) * 100)}%
                  </span>{' '}
                  ({simuladoRunOnPlanDate.solved}/{simuladoRunOnPlanDate.total} resolvidas) — agora é
                  refazer no papel o que errou; a correção comentada está no chip verde acima.
                </p>
              </div>
            )}
            <ul className="mt-2.5 space-y-1.5">
              {day.tarefas.map((t, i) => {
                const key = `${day.offset}-${i}`;
                const done = !!checked[key];
                return (
                  <li key={key} className="flex items-start gap-2">
                    <Checkbox
                      id={`task-${key}`}
                      checked={done}
                      onCheckedChange={() => toggleTask(key)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`task-${key}`}
                      className={cn(
                        'min-w-0 flex-1 cursor-pointer text-xs leading-relaxed',
                        done ? 'text-muted-foreground line-through' : 'text-foreground/85',
                      )}
                    >
                      {t.texto}
                      {t.materialId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            openMethod({ disciplineCode: MATH_EXAM.disciplineCode, materialId: t.materialId });
                          }}
                          className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
                        >
                          <BookOpen className="size-2.5" /> material
                        </button>
                      )}
                      {t.exercisePool && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            openPractice({
                              disciplineCode: MATH_EXAM.disciplineCode,
                              exerciseIds: t.exercisePool,
                            });
                          }}
                          title={`Abrir no Praticar só os exercícios de apoio: ${t.exercisePool.join(', ')}`}
                          className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
                        >
                          <Dumbbell className="size-2.5" /> apoio ({t.exercisePool.length})
                        </button>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            {/* Entrada no dia de prática: marcações de travada ficam a 1 toque
                de onde o aluno está trabalhando (sem abrir o plano completo). */}
            {day.kind === 'pratica' && (
              <button
                type="button"
                onClick={openTravadas}
                className="mt-2.5 flex w-full items-center gap-1.5 rounded-md border border-dashed border-rose-500/40 bg-rose-500/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:text-rose-400"
              >
                <PenLine className="size-3 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 text-left">
                  {travadasCount > 0
                    ? `${travadasCount} ${travadasCount === 1 ? 'questão travada' : 'questões travadas'} nas listas — toque para conferir ou ajustar`
                    : 'Travou em alguma questão da lista? Marque aqui — a véspera refaz só estas'}
                </span>
                {travadasCount > 0 && (
                  <Badge className="border-0 bg-rose-600 px-1.5 text-[9px] text-white shadow-sm">
                    {travadasCount}
                  </Badge>
                )}
              </button>
            )}
          </div>
        )}

        {/* Progresso + ações */}
        <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Plano completo</span>
              <span className="tabular-nums">
                {doneTasks}/{totalTasks} tarefas
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => openSimulado({ preset: 'math_exam' })}
              className="group h-11 flex-1 gap-1.5 bg-rose-600 text-white shadow-md shadow-rose-600/25 hover:bg-rose-700 sm:h-8 sm:flex-none"
            >
              <Target className="size-3.5 transition-transform group-hover:scale-110" /> Simulado da Av1
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              className="h-11 flex-1 gap-1.5 sm:h-8 sm:flex-none"
              aria-label="Abrir plano completo da prova"
            >
              <ListChecks className="size-3.5" /> Plano completo
              <ChevronDown className="size-3" />
            </Button>
          </div>
        </div>

        {/* KIT DA VÉSPERA — o bloco calmo da reta final (aparece em D-3, a véspera
            do simulado, e segue até o D-0). */}
        {isVesperaWindow(daysLeft) && (
          <VesperaKit
            daysLeft={daysLeft}
            mistakePending={mistakePending}
            simuladoDoneToday={simuladoDoneToday}
            verdict={simuladoVerdict}
            runs={sp.progress.simuladoRuns}
            oficialDate={simuladoRunOnPlanDate?.date ?? null}
            deckAdded={deckAdded}
            flashcardsDue={
              // LEITNER VIVO (116): o seletor puro com o agora do render — o
              // kit da véspera (na árvore do dashboard que tica a 60s) lê o
              // vencimento REAL do baralho, não o memo cacheado do passado.
              flashcardsDueFor(sp.allFlashcards, Date.now()).length
            }
            travadasCount={travadasCount}
            travadasLabel={travadasLabel}
            onOpenErrors={() => openSimulado()}
            onOpenFormulas={() => {
              setDialogFocus('formulas');
              setOpen(true);
            }}
            onOpenTravadas={openTravadas}
            onDeckAction={addAv1Deck}
            onOpenFlashcards={() => openPractice({ mode: 'flashcards' })}
            onOpenSelfAssessment={() =>
              openMethod({ disciplineCode: MATH_EXAM.disciplineCode, materialId: 'mat-01-matrizes' })
            }
          />
        )}

        {/* Treino de recall ativo: a IA PERGUNTA, o dono responde — véspera de prova. */}
        <button
          type="button"
          onClick={() =>
            openTutor({
              disciplineCode: MATH_EXAM.disciplineCode,
              question: buildQuizPrompt({
                disciplineName: 'Matemática',
                scope: MATH_EXAM.programa,
                count: 5,
              }),
            })
          }
          className="flex w-full items-center gap-2 border-t border-dashed border-violet-400/40 bg-violet-500/[0.04] px-4 py-2.5 text-left text-xs font-medium text-violet-700 transition-colors hover:bg-violet-500/10 dark:text-violet-300"
        >
          <Sparkles className="size-3.5 shrink-0 text-violet-500" />
          <span className="min-w-0 flex-1 truncate">
            Treino de véspera: a IA me testa no conteúdo da prova (recall ativo, 5 questões)
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">Estudar →</span>
        </button>
      </Card>

      {/* Dialog: plano completo + fórmulas + checklist */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl p-0 sm:max-w-2xl">
          <div className="border-b bg-gradient-to-r from-rose-500/10 to-transparent px-6 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="size-5 text-rose-500" />
                Plano até a prova — Matemática (D-7 → 01/10)
              </DialogTitle>
              <DialogDescription>
                {MATH_EXAM.programa} · {MATH_EXAM.notaPeso}. Tudo extraído dos
                materiais reais da disciplina.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 py-4">
            {/* Score de prontidão — o número-norte da preparação (1º do diálogo) */}
            <ReadinessSection readiness={readiness} daysLeft={daysLeft} />

            {/* Dias */}
            <section aria-label="Cronograma dia a dia">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlarmClock className="size-3.5" /> Cronograma
              </h3>
              <ol className="mt-3 space-y-2.5">
                {MATH_EXAM_PLAN.map((d) => (
                  <li
                    key={d.offset}
                    className={cn(
                      'rounded-lg border p-3',
                      d.offset === todayOffset
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : 'border-border',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-border px-1.5 text-[10px] tabular-nums text-muted-foreground">
                        {d.offset === 0 ? '01/10' : `D-${d.offset}`}
                      </Badge>
                      <Badge variant="outline" className={cn('border text-[10px]', KIND_STYLE[d.kind])}>
                        {KIND_LABEL[d.kind]}
                      </Badge>
                      {d.offset === todayOffset && (
                        <Badge className="border-0 bg-rose-500 text-[9px] text-white">hoje</Badge>
                      )}
                      {/* Estados honestos do passado: feito ✓ (tarefas marcadas
                          ou simulado oficial feito) em emerald — a cor que o Hub
                          já consagrou para done; atrasado só no que PENDE de verdade. */}
                      {d.offset > todayOffset &&
                        d.offset > 0 &&
                        (doneDay(d.offset) || (d.kind === 'simulado' && simuladoDoneOnPlanDate)) && (
                          <Badge className="border-0 bg-emerald-600 text-[9px] text-white">
                            feito ✓
                          </Badge>
                        )}
                      {behind.some((m) => m.offset === d.offset) && (
                        <Badge className="border-0 bg-amber-500 text-[9px] text-white">atrasado</Badge>
                      )}
                      <p className="min-w-0 flex-1 text-sm font-medium">{d.titulo}</p>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Timer className="size-3" /> {d.minutos}min
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {d.tarefas.map((t, i) => {
                        const key = `${d.offset}-${i}`;
                        const done = !!checked[key];
                        return (
                          <li key={key} className="flex items-start gap-2">
                            <Checkbox
                              id={`dlg-${key}`}
                              checked={done}
                              onCheckedChange={() => toggleTask(key)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`dlg-${key}`}
                              className={cn(
                                'min-w-0 flex-1 cursor-pointer text-xs leading-relaxed',
                                done ? 'text-muted-foreground line-through' : 'text-foreground/85',
                              )}
                            >
                              {t.texto}
                              {t.materialId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    openMethod({ disciplineCode: MATH_EXAM.disciplineCode, materialId: t.materialId });
                                  }}
                                  className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                                >
                                  <BookOpen className="size-2.5" /> material
                                </button>
                              )}
                              {t.exercisePool && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    openPractice({
                                      disciplineCode: MATH_EXAM.disciplineCode,
                                      exerciseIds: t.exercisePool,
                                    });
                                  }}
                                  title={`Abrir no Praticar só os exercícios de apoio: ${t.exercisePool.join(', ')}`}
                                  className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                                >
                                  <Dumbbell className="size-2.5" /> apoio ({t.exercisePool.length})
                                </button>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>

            {/* Travadas das listas — espelho digital das marcas de caneta.
                O plano manda FAZER as listas no papel; o que travou vira
                registro aqui e a véspera (kit + folha) refaz SÓ estas. */}
            <section id="dlg-travadas" aria-label="Questões que travaram nas listas" className="scroll-mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <PenLine className="size-3.5" /> Travadas das listas (espelho do papel)
                </h3>
                {travadasCount > 0 && (
                  <Badge className="border-0 bg-rose-600 px-1.5 text-[10px] text-white shadow-sm shadow-rose-600/30">
                    {travadasCount} {travadasCount === 1 ? 'travada' : 'travadas'}
                  </Badge>
                )}
                <a
                  href="/folha-revisao"
                  target="_blank"
                  rel="noreferrer"
                  title="Na folha impressa, as travadas aparecem listadas para refazer na véspera"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-zinc-300/70 bg-zinc-100 px-2.5 py-1 text-[10px] font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                >
                  <Printer className="size-3" aria-hidden />
                  Folha para imprimir
                </a>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Fez a lista no papel? Toque nos números que travaram — o Kit da véspera e a
                folha impressa usam este registro para montar o que refazer. Toque de novo para
                desmarcar.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {MATH_LISTAS.map((lista) => (
                  <TravadasRow
                    key={lista.id}
                    lista={lista}
                    travadas={travadas}
                    onToggle={toggleTravada}
                  />
                ))}
              </div>
            </section>

            {/* Fórmulas */}
            <section id="dlg-formulas" aria-label="Fórmulas essenciais" className="scroll-mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="size-3.5" /> Fórmulas essenciais (dos materiais)
                </h3>
                <a
                  href="/folha-revisao"
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir a folha de revisão pronta para imprimir (fórmulas + checklist + kit)"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-zinc-300/70 bg-zinc-100 px-2.5 py-1 text-[10px] font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                >
                  <Printer className="size-3" aria-hidden />
                  Folha para imprimir
                </a>
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {MATH_FORMULAS.map((f) => (
                  <Card
                    key={f.titulo}
                    className={cn(
                      'rounded-lg p-3',
                      f.grupo === 'Matrizes'
                        ? 'border-rose-500/20 bg-rose-500/[0.04]'
                        : 'border-sky-500/20 bg-sky-500/[0.04]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{f.titulo}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px]',
                          f.grupo === 'Matrizes'
                            ? 'border-rose-500/30 text-rose-600 dark:text-rose-400'
                            : 'border-sky-500/30 text-sky-600 dark:text-sky-400',
                        )}
                      >
                        {f.grupo}
                      </Badge>
                    </div>
                    {f.math && (
                      <div className="mt-1 rounded-md bg-background/60 px-2 py-1.5">
                        {f.math.map((line, i) => (
                          <TutorMarkdown key={i} content={`$$${line}$$`} className="text-xs [&_.katex-display]:my-1" />
                        ))}
                      </div>
                    )}
                    <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-foreground/70">
                      {f.corpo}
                    </p>
                  </Card>
                ))}
              </div>
            </section>

            {/* Baralho da Av1 (flashcards Leitner) */}
            <section aria-label="Baralho da Av1">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="size-3.5" /> Baralho da Av1 (revisão espaçada)
              </h3>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {MATH_FLASHCARDS.length} cartões prontos — Matrizes + Lógica, 1:1 com os materiais
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Entram no sistema Leitner (Praticar → Flashcards) já vencidos para começar hoje.
                    Errou um cartão? O botão verde no verso manda ele para o tutor.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={deckAdded ? 'ghost' : 'outline'}
                  onClick={addAv1Deck}
                  disabled={deckAdded}
                  className={cn(
                    'shrink-0 gap-1.5',
                    deckAdded
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'border-teal-500/40 bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 dark:text-teal-400',
                  )}
                >
                  {deckAdded ? (
                    <>
                      <CircleCheck className="size-3.5" /> no seu baralho
                    </>
                  ) : (
                    <>
                      <Layers className="size-3.5" /> Adicionar baralho
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* Caderno de Erros — diagnóstico agregado (aba Progresso) */}
            <section aria-label="Caderno de Erros">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <BookX className="size-3.5 text-rose-500" aria-hidden /> Caderno de Erros
                    {mistakePending > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                      >
                        {mistakePending} {mistakePending === 1 ? 'pendente' : 'pendentes'}
                      </Badge>
                    ) : mistakes.length > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        ✓ {mistakeRevised} {mistakeRevised === 1 ? 'erro revisado' : 'erros revisados'}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {mistakePending > 0
                      ? `Questões erradas nos simulados, exercícios não resolvidos e cartões errados estão no caderno${mistakeStats.topDisciplineCode === 'TEC.1984' ? ' — e tocam a prova de Matemática' : ''}. Com reensino pela IA: resolva cada erro e marque como revisado.`
                      : mistakes.length > 0
                        ? 'Tudo que você errou já foi revisado — caderno em dia para a prova. Se errar de novo, o item reabre sozinho.'
                        : 'Nenhum erro registrado ainda. Faça o simulado da prova — o que você errar vira caderno automaticamente, para a IA transformar em acerto.'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openProgress()}
                  className="shrink-0 gap-1.5 border-rose-500/40 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                  aria-label="Abrir o Caderno de Erros na aba Progresso"
                >
                  <BookX className="size-3.5" aria-hidden /> Ver caderno
                </Button>
              </div>
            </section>

            {/* Checklist de domínio */}
            <section aria-label="Checklist de domínio">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ListChecks className="size-3.5" /> Checklist: só vá para a prova marcando tudo
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {MATH_CHECKLIST.map((g) => (
                  <Card key={g.grupo} className="rounded-lg p-3">
                    <p className="text-xs font-semibold">{g.grupo}</p>
                    <ul className="mt-2 space-y-1.5">
                      {g.itens.map((item, i) => {
                        const key = `${g.grupo}-${i}`;
                        const done = !!checklist[key];
                        return (
                          <li key={key} className="flex items-start gap-2">
                            <Checkbox
                              id={`chk-${key}`}
                              checked={done}
                              onCheckedChange={() => toggleCheck(key)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`chk-${key}`}
                              className={cn(
                                'min-w-0 flex-1 cursor-pointer text-xs leading-relaxed',
                                done ? 'text-muted-foreground line-through' : 'text-foreground/85',
                              )}
                            >
                              {item}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Score de prontidão: gauge radial + evidências + coach ----------

const READINESS_DOT: Record<ReadinessTone, string> = {
  pronto: 'bg-emerald-500',
  quase: 'bg-amber-500',
  atencao: 'bg-rose-500',
};

const READINESS_TEXT: Record<ReadinessTone, string> = {
  pronto: 'text-emerald-600 dark:text-emerald-400',
  quase: 'text-amber-600 dark:text-amber-400',
  atencao: 'text-rose-600 dark:text-rose-400',
};

const READINESS_BADGE: Record<ReadinessTone, string> = {
  pronto: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  quase: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  atencao: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const READINESS_LABEL: Record<ReadinessTone, string> = {
  pronto: 'pronto para a prova',
  quase: 'quase lá',
  atencao: 'precisa de atenção',
};

/** Barras na MESMA gramática semântica dos badges de tipo do plano. */
const COMPONENT_BAR: Record<ReadinessComponentId, string> = {
  simulado: 'bg-amber-500',
  exercicios: 'bg-violet-500',
  checklist: 'bg-emerald-500',
  baralho: 'bg-teal-500',
  plano: 'bg-sky-500',
};

const COMPONENT_ICON_BG: Record<ReadinessComponentId, string> = {
  simulado: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  exercicios: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  checklist: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  baralho: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  plano: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

const COMPONENT_ICON: Record<ReadinessComponentId, React.ComponentType<{ className?: string }>> = {
  simulado: Timer,
  exercicios: Dumbbell,
  checklist: ListChecks,
  baralho: Layers,
  plano: AlarmClock,
};

/** Para onde cada evidência NAVEGA (null = vive neste diálogo, não navega). */
const READINESS_TARGET: Record<ReadinessComponentId, ((disciplineCode: string) => void) | null> = {
  simulado: (code) => openSimulado({ disciplineCode: code }),
  exercicios: (code) => openPractice({ disciplineCode: code }),
  baralho: (code) => openPractice({ disciplineCode: code }),
  checklist: null,
  plano: null,
};

const GAUGE_R = 52;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

/** Réguia de domínio por tópico — a MESMA gramática de cores da tendência
 *  do Histórico e da faixa "foco da prova" (≥60 emerald / ≥40 amber / <40 rose). */
function masteryBarCls(pct: number): string {
  if (pct >= 60) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

function masteryTextCls(pct: number): string {
  if (pct >= 60) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

/* ================= KIT DA VÉSPERA ================= */

/**
 * A reta final da Av1 num bloco só — D-2 (noite do simulado) até D-0 (prova).
 *
 * Gramática visual NOTURNA (indigo/slate): distinta de todas as famílias do
 * card — rose = prova/urgência, amber = recuperação/retomada, violet = IA,
 * teal = flashcards, emerald = acerto. Indigo aqui é CALMA: a véspera não é
 * dia de urgência, é dia de recitar o que já sabe e dormir cedo.
 *
 * Linhas acionáveis com deep-links reais (nada de decorativo), em cascata:
 *   erros pendentes → Simulado Pro (o card rose do setup monta a prova)
 *   travadas das listas (quando existem) → plano completo na seção delas
 *   recitar fórmulas → abre o plano JÁ ROLADO até a seção das fórmulas
 *   baralho Leitner → adiciona ao deck OU abre a aba Flashcards
 *   autoavaliação → resumo IA da Lista de Matrizes (perguntas de autoavaliação)
 *   kit do dia → estático (o que levar), sem ação — numeração calculada da
 *   fila (as linhas condicionais não deixam buraco nos números).
 * Honestidade: sem erros pendentes a linha some; sem travadas, idem; sem dias,
 * o bloco inteiro.
 */
function VesperaKit({
  daysLeft,
  mistakePending,
  simuladoDoneToday,
  verdict,
  runs,
  oficialDate,
  deckAdded,
  flashcardsDue,
  travadasCount,
  travadasLabel,
  onOpenErrors,
  onOpenFormulas,
  onOpenTravadas,
  onDeckAction,
  onOpenFlashcards,
  onOpenSelfAssessment,
}: {
  daysLeft: number;
  mistakePending: number;
  /** Prova de Matemática encerrada HOJE — o badge do D-2 vira "feito" (calma, não cobrança). */
  simuladoDoneToday: boolean;
  /** Veredito do run oficial (fonte única: simuladoVerdictFor) — null = sem run, kit no estado de espera. */
  verdict: SimuladoVerdict | null;
  /** Runs do Simulado Pro (mesmo registro do pai) — de onde o leitor do drill
   *  acha o treino 'topico' do foco. undefined/null = sem drill (estado honesto). */
  runs?: DrillRunLike[] | null;
  /** Data (ISO) do run oficial — a ORDEM DO TEMPO manda (107): só drill
   *  DEPOIS do diagnóstico cumpre a promessa; treino antes é preparo e não
   *  ganha recibo (nenhum 'subiu' com a ordem dos fatos invertida). */
  oficialDate?: string | null;
  deckAdded: boolean;
  flashcardsDue: number;
  travadasCount: number;
  travadasLabel: string;
  onOpenErrors: () => void;
  onOpenFormulas: () => void;
  onOpenTravadas: () => void;
  onDeckAction: () => void;
  onOpenFlashcards: () => void;
  onOpenSelfAssessment: () => void;
}) {
  const worst = verdict?.worst ?? null;

  // O FOCO DA REVISÃO: pulouTudo ?? worst. Um bloco INTEIRO sem tentativa
  // (o tempo acabou nele, ou o aluno passou reto) é o diagnóstico mais grave
  // que existe — nem taxa houve para comparar — e o placar honesto ('Matrizes
  // 0/5') já mostrava o sinal sem dar a ele VOZ na ação: o drill apontava
  // para o pior tópico RESPONDIDO enquanto o bloco nunca visto ficava mudo.
  // A promessa do plano ('o bloco com mais erros vira a revisão') se cumpre
  // no sentido que importa: o bloco todo pulado É o bloco com mais erros.
  // worst segue com o contrato documentado para quem só olha número.
  const foco = verdict?.pulouTudo ?? worst;
  const focoPulou = foco != null && foco.pct == null;

  // O DRILL RESPONDE: a linha do foco promete ('a revisão de amanhã') e o CTA
  // abre o treino daquele tópico — mas o kit nunca soube se o treino
  // ACONTECEU: depois do drill a linha seguia idêntica, o badge continuava no
  // % do simulado e o aluno não via o efeito do esforço da noite anterior.
  // O leitor puro acha o run 'topico' mais recente do foco e o recibo diz a
  // verdade do número: subiu (emerald), não subiu (amber, honesto) — e a
  // comparação só existe quando os dois lados têm taxa (bloco pulado não
  // inventa delta). Render-time (sem effect, lição 79): run novo no storage
  // re-renderiza e o recibo aparece no mesmo frame.
  const drill = foco
    ? mathDrillFeedbackFor(runs, foco.topic, foco.pct, oficialDate)
    : null;
  const drillDia = (() => {
    if (!drill) return '';
    const d = new Date(drill.dateISO).toDateString();
    if (d === new Date().toDateString()) return 'treino de hoje';
    if (d === new Date(Date.now() - 86_400_000).toDateString()) return 'treino de ontem';
    return 'treino recente';
  })();

  const contextBadge =
    daysLeft === 3
      ? 'véspera do simulado — amanhã é o ensaio real'
      : daysLeft === 2
        ? simuladoDoneToday
          ? verdict
            ? verdict.metaBatida
              ? `simulado feito — ${verdict.pct}% ≥ meta, véspera leve`
              : `simulado feito — ${verdict.pct}%: abaixo da meta`
            : 'simulado feito hoje — agora é só o kit, com calma'
          : 'depois do simulado de hoje — comece por aqui'
        : daysLeft === 1
          ? verdict
            ? verdict.metaBatida
              ? `véspera — ${verdict.pct}% no simulado, manter o plano`
              : `véspera — ${verdict.pct}% no simulado: bloco fraco primeiro`
            : 'véspera — revisão leve, sem conteúdo novo'
          : 'hoje é o dia — só reler e respirar';

  // Cor = significado no badge do kit: emerald = meta batida (calma, a mesma
  // família do "Feito"); amber = abaixo da meta (atenção com número real
  // atrás — nunca urgência inventada); indigo = espera / dia da prova (D-0
  // mantém a calma do reler-e-respirar, venha como vier o veredito).
  const badgeTone =
    verdict && daysLeft >= 1
      ? verdict.metaBatida
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-400'
      : simuladoDoneToday && daysLeft === 2
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-indigo-400/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300';

  const rows: {
    icon: typeof Moon;
    title: string;
    sub?: string;
    /** Placar do simulado em chips (pulada ganha voz: dashed = nem tentou). */
    subNode?: React.ReactNode;
    action: () => void;
    badge?: { text: string; tone: string };
    cta: string;
    /** Acento de ESTADO da linha (ex.: recibo do drill = fechamento emerald à esquerda). */
    accent?: string;
  }[] = [
    // A VÉSPERA DO SIMULADO (D-3): a noite em que o ensaio real é AMANHÃ.
    // O kit abre um dia antes para PREPARAR — a linha diz o que amanhã exige
    // (escopo, condição, meta) e o CTA abre o simulado com o preset oficial,
    // a mesma porta do botão do card. Só existe em D-3: em D-2 a linha do
    // veredito assume o palco (o run oficial vira a fonte do que a linha diz).
    ...(daysLeft === 3
      ? [
          {
            icon: Target,
            title: 'O ensaio real é amanhã',
            sub: `Simulado da Av1: escopo completo (${MATH_EXAM.topicosEscopo.join(
              ' + ',
            )}), sem consulta, meta ${MATH_META}%. Depois do run, este kit lê o resultado e aponta a revisão.`,
            action: () => openSimulado({ preset: 'math_exam' }),
            badge: {
              text: `meta ${MATH_META}`,
              tone: 'border-indigo-400/40 bg-indigo-500/10 tabular-nums text-indigo-600 dark:text-indigo-300',
            },
            cta: 'Ver o simulado',
          },
        ]
      : []),
    // A PROMESSA DO PLANO, AGORA COM NÚMEROS: o run oficial diz qual bloco
    // errou mais — e, quando um bloco INTEIRO ficou sem tentativa, é ELE que
    // manda (pulouTudo ?? worst). A linha abre o drill daquele tópico (a
    // mesma entrada do FOCO DA PROVA, mas com o dado DO SIMULADO, não a
    // tendência geral). D-0 some: prova não treina (a faixa rose da 92
    // manda só leveza).
    ...(foco && daysLeft >= 1
      ? [
          {
            icon: Crosshair,
            title:
              daysLeft === 2
                ? focoPulou
                  ? `${curto(foco.topic)}: pulou tudo — a revisão de amanhã`
                  : `${curto(foco.topic)}: a revisão de amanhã`
                : focoPulou
                  ? `${curto(foco.topic)}: pulou tudo — começa por ela`
                  : `${curto(foco.topic)}: começa a revisão de hoje`,
            subNode: (
              <>
                <span className="block">
                  {'No simulado: '}
                  <PlacarChips porTopico={verdict?.porTopico ?? []} />
                  {' — '}
                  {focoPulou
                    ? 'pular um bloco inteiro também é diagnóstico: a revisão começa por ele.'
                    : 'o plano promete: o bloco com mais erros vira a revisão.'}
                </span>
                {/* O RECIBO DO DRILL — a promessa ganhou resposta: o treino do
                    foco vira uma linha própria, com ponto-colorido (emerald =
                    subiu, amber = não subiu, honesto) e o delta real quando
                    os dois lados têm taxa. Sem drill a linha não existe —
                    nada inventado (a regra da 88). */}
                {drill && drill.pct !== null && (
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        drill.melhorou ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                    />
                    <span className="tabular-nums">
                      {`${drillDia}: ${drill.solved}/${drill.total} no drill`}
                      {drill.melhorou === true
                        ? ` · subiu de ${foco.pct}% para ${drill.pct}%`
                        : ''}
                      {drill.melhorou === false
                        ? ` · ${drill.pct}% no treino — vale outra passada`
                        : ''}
                      {focoPulou && drill.melhorou === null
                        ? ' · o bloco saiu do zero'
                        : ''}
                    </span>
                  </span>
                )}
              </>
            ),
            action: () =>
              openSimulado({
                disciplineCode: MATH_EXAM.disciplineCode,
                topicScope: foco.topic,
              }),
            badge:
              drill && drill.pct !== null
                ? {
                    text: `${drill.pct}% no treino${drill.pct >= MATH_META ? ' ✓' : ''}`,
                    tone:
                      drill.pct >= MATH_META
                        ? 'border-emerald-500/40 bg-emerald-500/10 tabular-nums text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-amber-500/50 bg-amber-500/10 tabular-nums text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-400',
                  }
                : focoPulou
                  ? {
                      text: `${foco.skipped} ${foco.skipped === 1 ? 'pulada' : 'puladas'}`,
                      tone:
                        'border-rose-400/60 bg-rose-500/10 tabular-nums text-rose-600 dark:border-rose-400/60 dark:bg-rose-500/10 dark:text-rose-400',
                    }
                  : {
                      text: `${foco.pct ?? 0}% no bloco`,
                      tone:
                        (foco.pct ?? 0) < 70
                          ? 'border-amber-500/50 bg-amber-500/10 tabular-nums text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-400'
                          : 'border-emerald-500/40 bg-emerald-500/10 tabular-nums text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
                    },
            cta: drill ? 'Treinar de novo' : `Treinar ${curto(foco.topic)}`,
            accent: drill
              ? 'border-l-2 border-l-emerald-500/60 bg-emerald-500/[0.05] hover:border-l-emerald-500/70'
              : undefined,
          },
        ]
      : []),
    ...(mistakePending > 0
      ? [
          {
            icon: RotateCcw,
            title: 'Fechar os seus erros',
            sub: 'Revisão dirigida no Simulado Pro: o card rose do setup monta a prova só com o que você errou.',
            action: onOpenErrors,
            badge: {
              text: `${mistakePending} ${mistakePending === 1 ? 'pendente' : 'pendentes'}`,
              tone: 'border-rose-300/60 bg-rose-500/10 text-rose-600 dark:text-rose-400',
            },
            cta: 'Treinar',
          },
        ]
      : []),
    ...(travadasCount > 0
      ? [
          {
            icon: PenLine,
            title: 'Refazer as travadas no papel',
            sub: `${travadasLabel} — sem consultar a fórmula; conferir com o card só depois.`,
            action: onOpenTravadas,
            badge: {
              text: `${travadasCount} ${travadasCount === 1 ? 'travada' : 'travadas'}`,
              tone: 'border-rose-300/60 bg-rose-500/10 text-rose-600 dark:text-rose-400',
            },
            cta: 'Ver lista',
          },
        ]
      : []),
    {
      icon: ScrollText,
      title: 'Recitar as fórmulas de memória',
      sub:
        foco && ((foco.pct ?? 0) < 70 || focoPulou) && daysLeft >= 1
          ? `${curto(foco.topic)} primeiro (${foco.solved}/${foco.total} no simulado), ${curto(
              MATH_EXAM.topicosEscopo.find((t) => t !== foco.topic) ?? '',
            )} depois — se travar numa, é só ela que você relê antes de dormir.`
          : 'Matrizes primeiro, Lógica depois — se travar numa, é só ela que você relê antes de dormir.',
      action: onOpenFormulas,
      cta: 'Abrir fórmulas',
    },
    {
      icon: Layers,
      title: 'Passar o baralho da Av1',
      sub: deckAdded
        ? flashcardsDue > 0
          ? `${flashcardsDue} ${flashcardsDue === 1 ? 'cartão vence' : 'cartões vencem'} hoje no Leitner — recall ativo de 2 minutos por vez.`
          : 'Nenhum cartão vence agora — de volta amanhã de manhã, antes de sair.'
        : `${MATH_FLASHCARDS.length} cartões prontos (Matrizes + Lógica) — entram vencidos para a revisão começar hoje.`,
      action: deckAdded ? onOpenFlashcards : onDeckAction,
      badge: deckAdded
        ? {
            text: flashcardsDue > 0 ? `${flashcardsDue} hoje` : 'em dia',
            tone:
              flashcardsDue > 0
                ? 'border-amber-300/60 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-emerald-300/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          }
        : undefined,
      cta: deckAdded ? 'Abrir flashcards' : 'Adicionar',
    },
    {
      icon: BookOpen,
      title: 'Autoavaliação dos resumos IA',
      sub: 'Perguntas de autoavaliação do resumo da Lista — responda de cabeça, confira depois. 10 minutos.',
      action: onOpenSelfAssessment,
      cta: 'Abrir resumo',
    },
  ];

  const kit = MATH_EXAM_KIT;

  return (
    <div className="border-t border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.09] via-slate-500/[0.05] to-transparent">
      {/* Cabeçalho do kit — medalhão Moon + contexto da reta final */}
      <div className="flex flex-wrap items-center gap-2.5 px-4 pt-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
          <Moon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Kit da véspera
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-medium',
                // Cor = significado (badgeTone): emerald = meta batida (calma),
                // amber = abaixo da meta (atenção com número real), indigo =
                // espera / D-0 (o dia da prova mantém o reler-e-respirar).
                badgeTone,
              )}
            >
              {contextBadge}
            </Badge>
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            A prova já está no seu preparo — estes passos fecham o que falta e guardam o resto
            para o sono.
          </p>
        </div>
      </div>

      {/* Linhas numeradas — cada uma uma ação real, entrada em cascata */}
      <ol className="px-4 py-3">
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <motion.li
              key={row.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25, ease: 'easeOut' }}
            >
              <button
                type="button"
                onClick={row.action}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-all hover:border-indigo-500/25 hover:bg-indigo-500/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40',
                  row.accent,
                )}
              >
                <span className="pt-0.5 text-[10px] font-bold tabular-nums text-indigo-400/70 dark:text-indigo-400/60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-indigo-500/25 bg-indigo-500/10 text-indigo-600 transition-transform group-hover:scale-105 dark:text-indigo-300">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold">{row.title}</span>
                    {row.badge && (
                      <Badge
                        variant="outline"
                        className={cn('px-1.5 text-[9px]', row.badge.tone)}
                      >
                        {row.badge.text}
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {row.subNode ?? row.sub}
                  </span>
                </span>
                <span className="mt-1 flex shrink-0 items-center gap-1 text-[10px] font-medium text-indigo-600 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-indigo-300">
                  {row.cta} <ArrowUpRight className="size-3" aria-hidden />
                </span>
              </button>
            </motion.li>
          );
        })}

        {/* 05 — kit do dia da prova: o único passo SEM ação (nada para clicar,
            nada para esquecer: é só levar). */}
        <motion.li
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: rows.length * 0.06, duration: 0.25, ease: 'easeOut' }}
          className="flex items-start gap-3 rounded-lg px-2.5 py-2.5"
        >
          <span className="pt-0.5 text-[10px] font-bold tabular-nums text-indigo-400/70 dark:text-indigo-400/60">
            {String(rows.length + 1).padStart(2, '0')}
          </span>
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <Backpack className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-xs font-semibold">Kit do dia da prova</span>
            <span className="mt-1 flex flex-wrap gap-1.5">
              {kit.map((k) => (
                <span
                  key={k.label}
                  className="rounded-full border border-indigo-500/25 bg-indigo-500/[0.08] px-2 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-300"
                >
                  {k.emoji} {k.label}
                </span>
              ))}
            </span>
          </span>
        </motion.li>
      </ol>

      {/* Rodapé do kit — o conselho que nenhum plano de estudo dá + a ponte para o papel */}
      <div className="border-t border-indigo-500/15 bg-indigo-500/[0.05] px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-indigo-600 dark:text-indigo-300">Noite calma:</span>{' '}
          depois das fórmulas, nada de conteúdo novo — o sono consolida mais que a madrugada de
          estudo.
        </p>
        <a
          href="/folha-revisao"
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 underline-offset-2 transition-colors hover:underline dark:text-indigo-300"
        >
          <Printer className="size-3" aria-hidden />
          Prefere papel? Abrir a folha de revisão para imprimir →
        </a>
      </div>
    </div>
  );
}

/* ================= TRAVADAS DAS LISTAS (linha do diálogo) ================= */

/**
 * Uma lista impressa = cabeçalho + grade de números clicáveis. O número em
 * rose é a marca de caneta espelhada: "essa eu travei na hora de resolver".
 * Tamanho de toque 28px (h-7/w-7) — apertado de propósito para os 35 números
 * caberem em 2–3 linhas sem dominar o diálogo, ainda assim tocável.
 */
function TravadasRow({
  lista,
  travadas,
  onToggle,
}: {
  lista: (typeof MATH_LISTAS)[number];
  travadas: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const qsDaLista = MATH_LISTAS.find((l) => l.id === lista.id)?.total ?? 0;
  const marcadas = React.useMemo(() => {
    let n = 0;
    for (let q = 1; q <= qsDaLista; q++) if (travadas[`${lista.id}-${q}`]) n++;
    return n;
  }, [travadas, lista.id, qsDaLista]);

  return (
    <Card className="rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-xs font-semibold">{lista.nome}</p>
        {marcadas > 0 ? (
          <Badge className="border-0 bg-rose-600 px-1.5 text-[9px] text-white shadow-sm">
            {marcadas}/{lista.total}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">nenhuma travada</span>
        )}
        <button
          type="button"
          onClick={() => openMethod({ disciplineCode: MATH_EXAM.disciplineCode, materialId: lista.fonte })}
          className="ml-auto inline-flex items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
          title={`Abrir ${lista.nome} na Biblioteca`}
        >
          <BookOpen className="size-2.5" aria-hidden /> abrir lista
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{lista.resumo}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {Array.from({ length: lista.total }, (_, i) => i + 1).map((q) => {
          const key = `${lista.id}-${q}`;
          const on = !!travadas[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              aria-label={`Q${q} da ${lista.nome}${on ? ' — travada (toque para desmarcar)' : ' — marcar como travada'}`}
              title={on ? `Q${q} travada — toque para desmarcar` : `Marcar Q${q} como travada`}
              onClick={() => onToggle(key)}
              className={cn(
                'grid h-7 w-7 place-items-center rounded-md border text-[10px] font-semibold tabular-nums transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 active:scale-95',
                on
                  ? 'border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                  : 'border-border bg-muted/50 text-muted-foreground hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400',
              )}
            >
              {q}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ReadinessSection({
  readiness,
  daysLeft,
}: {
  readiness: ReadinessResult;
  daysLeft: number;
}) {
  const score = readiness.score;

  // Contagem animada: o número sobe junto com o arco (mesma duração).
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${Math.round(v)}`);
  React.useEffect(() => {
    const controls = animate(mv, score ?? 0, { duration: 1.1, ease: 'easeOut' });
    return () => controls.stop();
  }, [score, mv]);

  return (
    <section aria-label="Score de prontidão da Av1">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Target className="size-3.5" /> Score de prontidão
      </h3>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Gauge radial — arco esmeralda→teal animado, tom do veredito fica no badge */}
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <svg
            viewBox="0 0 120 120"
            className="size-28"
            role="img"
            aria-label={
              score === null
                ? 'Score de prontidão ainda sem dados'
                : `Score de prontidão ${score} de 100 — ${READINESS_LABEL[readiness.tone]}`
            }
          >
            <defs>
              <linearGradient id="readiness-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={GAUGE_R} fill="none" strokeWidth="11" className="stroke-muted" />
            <motion.circle
              cx="60"
              cy="60"
              r={GAUGE_R}
              fill="none"
              strokeWidth="11"
              strokeLinecap="round"
              stroke="url(#readiness-grad)"
              strokeDasharray={GAUGE_C}
              initial={{ strokeDashoffset: GAUGE_C }}
              animate={{ strokeDashoffset: score === null ? GAUGE_C : GAUGE_C * (1 - score / 100) }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            {score === null ? (
              <span className="text-xl font-bold text-muted-foreground" aria-hidden>
                —
              </span>
            ) : (
              <p className="text-center leading-none" aria-hidden>
                <motion.span className="text-2xl font-bold tabular-nums">{rounded}</motion.span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </p>
            )}
          </div>
        </div>

        {/* Evidências: 1 barra por componente, na cor do seu tipo.
            As 3 evidências com AÇÃO em OUTRA superfície (simulado, exercícios
            e baralho) são clicáveis — o número aponta para o que o move.
            Checklist e plano vivem DENTRO deste diálogo (não navegam). */}
        <div className="min-w-0 flex-1 space-y-2.5">
          {readiness.components.map((c, i) => {
            const Icon = COMPONENT_ICON[c.id];
            const target = READINESS_TARGET[c.id];
            const clickable = target !== null && c.pct !== null;
            const row = (
              <>
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-md',
                    c.pct === null ? 'bg-muted text-muted-foreground/50' : COMPONENT_ICON_BG[c.id],
                  )}
                  aria-hidden
                >
                  <Icon className="size-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn('truncate text-xs font-medium', c.pct === null && 'text-muted-foreground')}>
                      {c.label}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 text-[10px] font-semibold tabular-nums',
                        c.pct === null ? 'font-normal text-muted-foreground/70' : READINESS_TEXT[readiness.tone],
                      )}
                    >
                      {c.pct === null ? 'sem dados' : `${c.pct}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    {c.pct === null ? (
                      <div className="h-full w-full rounded-full border border-dashed border-border/80" aria-hidden />
                    ) : (
                      <motion.div
                        className={cn('h-full rounded-full', COMPONENT_BAR[c.id])}
                        initial={{ width: 0 }}
                        animate={{ width: `${c.pct}%` }}
                        transition={{ duration: 0.7, delay: 0.25 + i * 0.06, ease: 'easeOut' }}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={c.detail}>
                    {c.detail}
                  </p>
                  {/* DOMÍNIO POR TÓPICO (só simulado, só com detalhe por questão):
                      a evidência de 30% do score deixa de ser um número plano —
                      cada tópico do escopo mostra onde está AGORA (última
                      tentativa), com delta e a régua de cor do resultado. O
                      tópico <60% carrega a mira do "foco da prova". */}
                  {c.id === 'simulado' && readiness.topicMastery ? (
                    <div
                      className="mt-1.5 space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 p-1.5"
                      aria-label="Domínio atual por tópico do escopo da prova"
                    >
                      {readiness.topicMastery.map((t, ti) => {
                        const DeltaIcon = t.delta > 0 ? TrendingUp : t.delta < 0 ? TrendingDown : Minus;
                        const deltaCls =
                          t.delta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : t.delta < 0
                              ? 'text-rose-500'
                              : 'text-muted-foreground/60';
                        const deltaTxt = `Δ ${t.delta >= 0 ? '+' : ''}${t.delta}pp em ${t.attempts} tentativa${t.attempts === 1 ? '' : 's'}`;
                        return (
                          <div
                            key={t.topic}
                            className="flex items-center gap-1.5"
                            title={`${t.topic}: ${t.pct}% na última tentativa · ${deltaTxt}`}
                          >
                            {t.pct < 60 ? (
                              <Crosshair
                                className="size-3 shrink-0 text-rose-500"
                                role="img"
                                aria-label={`${t.topic} é o foco da prova`}
                              />
                            ) : (
                              <span className="size-3 shrink-0" aria-hidden />
                            )}
                            <span className="min-w-0 flex-[2] truncate text-[10px] font-medium">
                              {t.topic}
                            </span>
                            <span className="h-1 flex-[3] overflow-hidden rounded-full bg-muted" aria-hidden>
                              <motion.span
                                className={cn('block h-full rounded-full', masteryBarCls(t.pct))}
                                initial={{ width: 0 }}
                                animate={{ width: `${t.pct}%` }}
                                transition={{ duration: 0.6, delay: 0.4 + ti * 0.08, ease: 'easeOut' }}
                              />
                            </span>
                            <span
                              className={cn(
                                'w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums',
                                masteryTextCls(t.pct),
                              )}
                            >
                              {t.pct}%
                            </span>
                            <DeltaIcon className={cn('size-3 shrink-0', deltaCls)} aria-hidden />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                {clickable ? (
                  <ArrowUpRight
                    className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover/evidence:translate-x-0.5 group-hover/evidence:-translate-y-0.5 group-hover/evidence:text-foreground"
                    aria-hidden
                  />
                ) : null}
              </>
            );
            const rowClass = cn(
              'flex items-center gap-2.5 rounded-lg p-1 -m-1 transition-colors',
              clickable &&
                'group/evidence cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50',
            );
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
              >
                {clickable ? (
                  <button
                    type="button"
                    className={cn(rowClass, 'w-full text-left')}
                    onClick={() => target?.(MATH_EXAM.disciplineCode)}
                    title={`Ir para ${c.label.toLowerCase()} — é daí que o número nasce`}
                    aria-label={`Abrir ${c.label} (evidência do score de prontidão)`}
                  >
                    {row}
                  </button>
                ) : (
                  <div className={rowClass}>{row}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {score !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={cn('border-0 text-[10px]', READINESS_BADGE[readiness.tone])}>
            {READINESS_LABEL[readiness.tone]}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {readiness.topicMastery
              ? 'derrubar o tópico em foco sobe o score ao vivo — o simulado usa seu domínio atual por tópico'
              : 'sobe ao vivo: marcar tarefas, revisar cartões e correr o simulado'}
          </span>
        </div>
      )}
      {readiness.pendentesMat > 0 && (
        <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
          Caderno de Erros: {readiness.pendentesMat} pendente(s) na Matemática — revisar sobe o score e limpa o caderno.
        </p>
      )}

      <Button
        variant="outline"
        className="mt-3 w-full !whitespace-normal border-amber-300 bg-amber-50 text-amber-800 transition-transform hover:bg-amber-100 active:scale-[0.99] dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
        onClick={() =>
          openTutor({
            disciplineCode: MATH_EXAM.disciplineCode,
            question: buildReadinessQuestion(daysLeft, readiness, readiness.pendentesMat),
          })
        }
        aria-label="Pedir ao tutor um plano para chegar pronto na prova"
      >
        <Sparkles className="size-3.5 shrink-0" aria-hidden />
        {score === null
          ? 'Por onde começo para ter score? (plano do tutor)'
          : 'Como chego 100% pronto até 01/10? (plano do tutor)'}
      </Button>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Score = média ponderada das evidências (simulado 30% · exercícios 20% · checklist 20% ·
        baralho 15% · plano 15%). Componente sem dado não entra na conta — o score não inventa
        prontidão. Com detalhe por questão, o simulado usa o domínio ATUAL de cada tópico do
        escopo (média das últimas tentativas), não só a última nota geral.
      </p>
    </section>
  );
}
