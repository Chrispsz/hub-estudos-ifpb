'use client';

// t180 — A CASA LIMPA (o pedido do dono: "eu só quero conseguir estudar").
//
// A home tem UMA função: colocar a pessoa para estudar no método único —
// LER com o tutor ao lado → RESOLVER as questões do professor no papel →
// ENSAIAR no simulado. Sem placares, sem prontidão, sem caixinhas para
// marcar, sem avisos empilhados: qualquer pessoa entende em 5 segundos.
//
// O que existia aqui (t195) e saiu de vez: ExamPrepCard (prontidão, plano
// completo, seguro de progresso), RecoveryCard (fila P0–P5), ExamTutorCard,
// TodayStudyCard (unidades com checkbox), KPIs de pomodoro/streak.
// As provas viram CONTEÚDO (a folha de questões é um material como outro
// qualquer) — não viram mais abas, cards ou modos especiais.

import * as React from 'react';
import {
  AlarmClock,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  History,
  ListChecks,
  PenLine,
  Printer,
  Sparkles,
  Sunrise,
  Timer,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { disciplines, materials, type Material } from '@/data/course-data';
import { cn } from '@/lib/utils';
import { openPractice, openProgress, openSimulado } from '@/lib/hub-events';
import {
  disciplineSignalsOf,
  withTutorUsage,
  algorithmReadoutOf,
  facilityMapOf,
  type TutorUsageEntry,
} from '@/lib/learning-signals';
import { MATH_EXAM } from '@/lib/math-exam-prep';
import { WeeklyReport } from './weekly-report';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildTodaySnapshot, buildTrackingDetail, todayDateKey, type TodaySnapshot } from '@/lib/today-focus';
import { buildDayPlan } from '@/lib/study-plan';
import {
  adaptTodayBlocksToNow,
  generateSmartSchedule,
  formatTime,
  weekStudiedMinutesByDiscipline,
  type ScheduleDisciplineState,
  type SmartBlock,
} from '@/lib/smart-schedule';
import { suggestBudgetFromHistory, syncPomodoroToBudget, buildSessionHarmony } from '@/lib/session-harmony';
import { buildDayLaunchPlan, launchStepsFromSchedule, launchStepsFromSession, type LaunchStep } from '@/lib/day-launch';
import { useStudyProgress } from '@/lib/study-progress';
import { windowsOf, windowsWithLearnedStarts, TURNO_LABEL, turnoIsLearned, type DayWindow } from '@/lib/study-progress';
import { useErrorReviewTasks } from '@/lib/error-review-feed';
import { useStudyFocus } from '@/lib/pomodoro-engine';
import { readerDoorVisible } from '@/lib/study-reader-door';
import { recallPdfPage } from '@/lib/pdf-position';
import { TrackingPanel } from './tracking-panel';
import { PdfViewerDialog } from './pdf-viewer-dialog';
import { SessionHarmonyCard } from './session-harmony-card';
import { DayLauncherCard } from './day-launcher';

/** A folha da prova — as questões do professor como MATERIAL (t180). */
const FOLHA_DA_PROVA_ID = 'mat-av1-questoes-professor';

/** A página de retomada REAL (memória do leitor, hub:pdf-pos — t161), injetada
 *  no retrato: o chip "(pág. N)" da home fala a verdade da leitura. */
function resumePageOf(materialId: string): number | null {
  const m = materials.find((x) => x.id === materialId);
  return m ? recallPdfPage(materialId, m.pages) : null;
}

/**
 * Status das janelas do dia: o foco REAL registrado preenche as janelas em
 * sequência (manhã → tarde → noite) — função pura de módulo (o React Compiler
 * veda reatribuição de captura no corpo do componente; aqui é só matemática).
 */
function rhythmWindowStatus(
  windows: DayWindow[],
  focusMinutes: number,
): { window: DayWindow; status: 'done' | 'curso' | 'pendente'; minutes: number }[] {
  let left = focusMinutes;
  return windows.map((w) => {
    const take = Math.min(Math.max(0, left), w.durationMin);
    left -= take;
    return {
      window: w,
      status: take >= w.durationMin ? ('done' as const) : take > 0 ? ('curso' as const) : ('pendente' as const),
      minutes: take,
    };
  });
}

interface DashboardProps {
  /** Abre a aba Estudar (opcionalmente com disciplina/material selecionados). */
  onStartStudy: (disciplineCode?: string, materialId?: string) => void;
}

export function Dashboard({ onStartStudy }: DashboardProps) {
  const sp = useStudyProgress();
  // O motor do foco vive acima das abas — a home agora governa o foco direto
  // (frente 9): "Continuar" em 1 clique abre material + tutor + foco, sem
  // passar pela aba Estudar.
  const focusApi = useStudyFocus();
  // O leitor da home: um diálogo só para TODAS as aberturas (continuar, folha
  // da prova) — o mesmo pdf-viewer-dialog da casa, com tutor em tela dividida.
  const [leitorMat, setLeitorMat] = React.useState<Material | null>(null);
  // Página da retomada aceita pelo clique ("Continuar ... (pág. N)") — a
  // doutrina t162: o clique JÁ declarou a intenção, abre saltado, sem pill.
  const [leitorPage, setLeitorPage] = React.useState<number | undefined>(undefined);
  // Check-in de horas: pergunta 1 toque ao logar; EDITÁVEL a qualquer momento.
  const [editingHours, setEditingHours] = React.useState(false);
  // Meu acompanhamento: o espelho completo fica 1 toque abaixo do retrato —
  // a casa continua limpa por padrão (frente C, diretriz do dono 10/10/2026).
  const [trackingOpen, setTrackingOpen] = React.useState(false);
  // MOMENTO DE REVISÃO (Task 226): o relatório da semana abre AQUI na home —
  // sexta acende o chip, sábado/domingo é o momento; segunda some sozinho.
  const [semanaOpen, setSemanaOpen] = React.useState(false);

  const folha = materials.find((m) => m.id === FOLHA_DA_PROVA_ID) ?? null;

  // t198 — A DATA vira estado pós-mount: o servidor mora em UTC e o aluno em
  // Brasília — na virada do dia (21h–23h59 BRT) o daysLeft calculado no render
  // divergia entre SSR e navegador em 1 e o React estourava #418 (hidratação
  // de texto: "prova hoje" ≠ "prova amanhã"). SSR e 1º render do cliente
  // dividem o MESMO neutro (sem prova em foco); o efeito adapta em seguida e
  // reavalia a cada minuto — a home muda sozinha à meia-noite, sem F5.
  const [agora, setAgora] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setAgora(new Date());
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ----- O RETRATO + O FOCO DO DIA (acompanhamento automático, 10/10/2026) -----
  // Computado do que o uso diário já registra (pomodoro, exercícios, simulados,
  // flashcards, caderno, materiais) + calendário oficial VIVO (semester.ts —
  // só data oficial à frente; a Av1 congelada não comanda mais a casa).
  // Pós-mount, como o `agora`: SSR e 1º render dividem o neutro.
  const snap = React.useMemo(
    () => (agora ? buildTodaySnapshot(sp.progress, agora, { pageOf: resumePageOf }) : null),
    [sp.progress, agora],
  );

  // O detalhe do espelho (hoje/semana/disciplinas) — a mesma vida, um nível abaixo.
  const detail = React.useMemo(
    () => (agora ? buildTrackingDetail(sp.progress, agora) : null),
    [sp.progress, agora],
  );

  // ----- O ALGORITMO QUE APRENDE (Task 226 — pedido do dono: "acompanhamento
  // para treinar o próprio algoritmo… com base na facilidade e aprendizado
  // real… de forma quase que automática"): os sinais nascem do uso (questões
  // marcadas, tempo por questão, tutor acionado) e voltam como peso na fila.
  // O uso do tutor mora no servidor (memória por disciplina) — chega por fetch
  // e é mesclado; sem rede, a casa segue com os sinais locais.
  const [tutorSignals, setTutorSignals] = React.useState<TutorUsageEntry[] | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetch('/api/tutor/signals')
      .then((r) => r.json())
      .then((j: { signals?: TutorUsageEntry[] }) => {
        if (alive && Array.isArray(j?.signals)) setTutorSignals(j.signals);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const learningSignals = React.useMemo(
    () => (agora ? withTutorUsage(disciplineSignalsOf(sp.progress), tutorSignals) : []),
    [agora, sp.progress, tutorSignals],
  );
  const algoritmoLeitura = React.useMemo(
    () => algorithmReadoutOf(learningSignals),
    [learningSignals],
  );
  // MOMENTO DE REVISÃO (Task 226): o fim de semana carrega a leitura da
  // semana — sexta acende, sábado/dominguem manda (o slot de "Revisão geral
  // da semana" do cronograma já reserva o sábado; o chip leva aos sinais).
  const momentoRevisao = !!agora && [0, 5, 6].includes(agora.getDay());

  // FRENTE 13 — O PLANO DE HOJE (fila de materiais): hoje ela alimenta o
  // CRONOGRAMA DE HOJE (abaixo) — cada bloco ganha o material sugerido da
  // fila. Recomputado pós-mount (mesmo `agora` do retrato), a cada write do
  // progresso e a cada write do Code Review.
  const errorReviews = useErrorReviewTasks();
  // TASK 224 — O FOCO DO DIA: a matéria que o dono escolheu concentrar hoje
  // (por dateKey — amanhã a casa volta à fila normal). Os dois motores da
  // fila (plano cru e harmonia) recebem o MESMO comando — um foco, uma fila.
  const dayFocusCode =
    agora ? sp.progress.dailyFocusDiscipline?.[todayDateKey(agora)] ?? null : null;
  const dayFocusShort = dayFocusCode
    ? disciplines.find((d) => d.code === dayFocusCode)?.shortName ?? null
    : null;
  const plan = React.useMemo(
    () =>
      agora
        ? buildDayPlan(sp.progress, agora, { pageOf: resumePageOf, errorReviews, focusDiscipline: dayFocusCode ?? undefined })
        : null,
    [sp.progress, agora, errorReviews, dayFocusCode],
  );

  // TASK 221 — UM CRONOGRAMA SÓ: o "Plano de hoje" da home AGORA É o
  // cronograma inteligente (a MESMA fonte da aba Cronograma — smart-schedule),
  // filtrado para o dia de hoje e com o material da fila anexado a cada bloco.
  // Fim da era dos dois planos que não se falavam.
  // TASK 225 — O RITMO SEMANAL alimenta o motor: as janelas do dia (tarde+
  // noite / manhã+tarde+noite) viram os slots reais dos blocos, e o foco REAL
  // da semana (Pomodoro) desconta das metas — a semana absorve o que foi
  // estudado de verdade, sem repetir o que já foi.
  const weekStudied = React.useMemo(
    () => (agora ? weekStudiedMinutesByDiscipline(sp.progress.pomodoroSessions ?? [], agora) : {}),
    [agora, sp.progress.pomodoroSessions],
  );
  const dayBlocks = React.useMemo<SmartBlock[]>(() => {
    if (!agora) return [];
    const discProg: Record<string, ScheduleDisciplineState> = {};
    for (const [code, v] of Object.entries(sp.progress.disciplineProgress ?? {})) {
      discProg[code] = { studiedMinutes: v.studiedMinutes, lastStudiedAt: v.lastStudiedAt };
    }
    return adaptTodayBlocksToNow(
      generateSmartSchedule({
        preferences: sp.progress.studyPreferences,
        topicProgress: sp.progress.topicProgress,
        disciplineProgress: discProg,
        customEvaluations: sp.progress.customEvaluations,
        weekStudiedMinutes: weekStudied,
        facility: facilityMapOf(sp.progress),
        sessionStarts: sp.progress.sessionStarts,
        now: agora,
      })
        .filter((b) => b.day === agora.getDay())
        .sort((a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute)),
      agora,
    );
  }, [agora, sp.progress, weekStudied]);

  // O material sugerido por disciplina (1º da fila que toca aquele código) —
  // é o que faz o bloco do cronograma abrir o PDF certo em 1 clique.
  const materialOfDiscipline = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const b of plan?.blocks ?? []) {
      if (b.materialId && b.disciplineCode && !m.has(b.disciplineCode)) {
        m.set(b.disciplineCode, b.materialId);
      }
    }
    return m;
  }, [plan]);

  const dayBlocksMinutes = dayBlocks.reduce((acc, b) => acc + b.durationMin, 0);

  /** 1.5 → "1h30" · 2 → "2h" · 0.75 → "45min". */
  const fmtH = (h: number): string => {
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    if (hh === 0) return `${mm}min`;
    return mm === 0 ? `${hh}h` : `${hh}h${mm}`;
  };

  // A LINHA DO DIA (áudio do dono: "a home… não pode ser confusa, não pode
  // ser cheia… eu já tenho agenda, é meu cronograma") — o herói descreve o
  // dia do CRONOGRAMA, não grita a próxima avaliação. "Foco: X" só quando a
  // avaliação é HOJE ou AMANHÃ (heroEvalNow, definido após focusEval) — a
  // véspera merece o lugar, o d-5 não (era o que deixava a casa "focando
  // muito em resgate").
  const dayLine = React.useMemo(() => {
    if (dayBlocks.length === 0) return null;
    const first = dayBlocks[0];
    const firstShort = first.disciplineCode
      ? disciplines.find((d) => d.code === first.disciplineCode)?.shortName ?? ''
      : 'revisão';
    const codes = [...new Set(dayBlocks.map((b) => b.disciplineCode))]
      .map((c) => disciplines.find((d) => d.code === c)?.shortName ?? c)
      .filter((c) => c !== 'revisao');
    if (codes.length <= 1 && dayBlocks.length === 1) {
      // Um bloco só — sem redundância ("Algoritmos… começa por Algoritmos").
      return `1 bloco · ~${fmtH(dayBlocksMinutes / 60)} de ${codes[0] ?? 'revisão'}. Começa às ${formatTime(first.startHour, first.startMinute)}.`;
    }
    const subjects = codes.slice(0, 3).join(', ') + (codes.length > 3 ? ` e mais ${codes.length - 3}` : '');
    return `${dayBlocks.length} ${dayBlocks.length === 1 ? 'bloco' : 'blocos'} · ~${fmtH(dayBlocksMinutes / 60)} — ${subjects}. Começa por ${firstShort} às ${formatTime(first.startHour, first.startMinute)}.`;
  }, [dayBlocks, dayBlocksMinutes]);

  const nextExam = snap?.nextExam ?? null;
  // TASK 221 — o herói é CONSCIENTE DO TIPO e cita a avaliação CERTA:
  const focusExam = snap?.focus.kind === 'exam';
  const focusEval = snap?.focusEval ?? null;
  // "Foco: X" no herói só na véspera/hoje (d-1/d-0) — ver LINHA DO DIA acima.
  const heroEvalNow = !!focusEval && focusEval.daysLeft <= 1;

  // ----- Horas do dia (check-in) + doses do método + agenda oficial -----
  const plannedHours = snap?.plannedHours ?? null;
  /** A sessão sintonizada existe quando há orçamento no dia (Task 30). */
  const sessionActive = (plannedHours ?? 0) > 0;
  const dateKey = agora ? todayDateKey(agora) : '';

  // TASK 225 — O RITMO DE HOJE (Mensagem 10 do dono): as janelas do dia
  // (tarde+noite na semana; manhã+tarde+noite no fim de semana), com o status
  // de cada uma pelo foco REAL registrado — a casa mostra "manhã cumprida,
  // tarde em curso" sem ninguém marcar nada à mão.
  const dayRhythm = React.useMemo<DayWindow[]>(
    () =>
      agora
        ? windowsWithLearnedStarts(
            windowsOf(sp.progress.studyPreferences.days[agora.getDay()]),
            sp.progress.sessionStarts,
          )
        : [],
    [agora, sp.progress.studyPreferences.days, sp.progress.sessionStarts],
  );
  const rhythmTotalHours = dayRhythm.reduce((acc, w) => acc + w.durationMin, 0) / 60;
  const rhythmLine =
    dayRhythm.length > 0
      ? dayRhythm
          .map((w) => `${Math.round(w.durationMin / 60 * 10) / 10}h ${TURNO_LABEL[w.turno].toLowerCase()}`)
          .join(' + ')
      : '';
  /** Status das janelas: o foco de hoje é alocado em sequência (manhã → tarde → noite). */
  const rhythmStatus = React.useMemo(
    () => rhythmWindowStatus(dayRhythm, snap?.minutesToday ?? 0),
    [dayRhythm, snap?.minutesToday],
  );

  // TASK 222 — O DIA PRONTO (Mensagem 8 do dono: "eu clico para iniciar e ele
  // inicia no cronograma... com tudo organizado e pronto"): a fila do
  // lançador é UMA fonte só — a sessão sintonizada quando há check-in, os
  // blocos de HOJE do cronograma inteligente quando não há. Mesmo estado,
  // mesmo material, zero segunda contabilidade.
  const launchSteps = React.useMemo<LaunchStep[]>(() => {
    if (!agora) return [];
    if (sessionActive) {
      const harmony = buildSessionHarmony(sp.progress, agora, {
        pageOf: resumePageOf,
        errorReviews,
        focusDiscipline: dayFocusCode ?? undefined,
      });
      return launchStepsFromSession(harmony.blocks);
    }
    return launchStepsFromSchedule(dayBlocks, sp.progress.scheduleBlocksDone ?? [], materialOfDiscipline);
  }, [agora, sessionActive, sp.progress, errorReviews, dayBlocks, materialOfDiscipline, dayFocusCode]);

  const launchPlan = React.useMemo(
    () =>
      launchSteps.length > 0
        ? buildDayLaunchPlan(launchSteps, sp.progress.preferences.pomodoroConfig)
        : null,
    [launchSteps, sp.progress.preferences.pomodoroConfig],
  );

  // Concluir aqui É concluir no cronograma (mesmo scheduleBlocksDone da aba)
  // e o gesto de INICIAR mora junto do openMaterialFocused (logo abaixo).
  const completeLaunchStep = React.useCallback(
    (step: LaunchStep) => {
      if (step.completable) sp.toggleScheduleBlockDone(step.id);
    },
    [sp],
  );

  // O orçamento que aprende (banco de ideias #3): a casa já viu o dono estudar
  // e PROPÕE o orçamento — mediana do ritmo recente + prova próxima. Pura no
  // `agora` do retrato; sem história suficiente ela confessa e não sugere.
  const budgetSuggestion = React.useMemo(
    () =>
      agora
        ? suggestBudgetFromHistory(sp.progress.dailyHours, agora, {
            examDaysLeft: nextExam?.daysLeft ?? null,
          })
        : null,
    [agora, sp.progress.dailyHours, nextExam],
  );

  // O 1º passo gravado ONTEM no fecho (banco de ideias #6): a home abre nele.
  // A faixa vive SÓ no dia seguinte (setOn === ontem) e expira sozinha —
  // "Abrir agora" NÃO apaga o passo: abrir dispara markAccessed de outra
  // instância do hook no MESMO tick, e o write completo de uma instância
  // stale ressuscita o passo recém-apagado (descoberta E2E Task 206). O X
  // ("deixar pra lá") é escrita solitária — sem corrida — e some na hora.
  const ontemKey = agora ? todayDateKey(new Date(agora.getTime() - 86_400_000)) : '';
  const passoOntem =
    sp.progress.tomorrowStep?.setOn && sp.progress.tomorrowStep.setOn === ontemKey
      ? sp.progress.tomorrowStep
      : null;
  const passoMaterial = passoOntem?.materialId
    ? materials.find((m) => m.id === passoOntem.materialId) ?? null
    : null;
  const applyHours = React.useCallback(
    (h: number) => {
      if (dateKey) {
        sp.setAvailableHours(dateKey, h);
        // HORÁRIO REAL (Task 231): o check-in É o início do estudo — a casa
        // grava o momento e aprende os horários do dono sem ele configurar nada.
        sp.markSessionStart();
        // A harmonia nasce no check-in: o pomodoro encaixa no que RESTA da
        // sessão (o foco já rodado hoje desconta) na mesma respiração — o
        // original fica guardado, o Restaurar sempre à mão.
        if (h > 0)
          syncPomodoroToBudget(sp, Math.max(0, Math.round(h * 60) - (snap?.minutesToday ?? 0)), dateKey);
      }
      setEditingHours(false);
    },
    [dateKey, sp, snap],
  );

  // TASK 224 — SESSÕES PARTIDAS (dono: "2h de manhã… a noite coloco 3 horas"):
  // o gesto ADICIONA ao orçamento do dia em vez de substituir — a manhã não
  // é perdida quando a noite chega com mais tempo. O lance fica no log com
  // horário e o Pomodoro re-encaixa no que RESTA do dia novo.
  const addHours = React.useCallback(
    (h: number) => {
      if (dateKey) {
        sp.addAvailableHours(dateKey, h);
        sp.markSessionStart(); // 2ª sessão do dia também é um início real (Task 231)
        const newTotal = Math.round(((plannedHours ?? 0) + h) * 60);
        syncPomodoroToBudget(sp, Math.max(0, newTotal - (snap?.minutesToday ?? 0)), dateKey);
      }
      setEditingHours(false);
    },
    [dateKey, sp, snap, plannedHours],
  );

  /** Os lances de hoje (check-ins com horário) — a história das sessões partidas. */
  const checkinsToday = dateKey ? sp.progress.dailyCheckins?.[dateKey] ?? [] : [];

  // As horas lançadas viram doses por passo (40/35/25, arredondadas a 5min).
  const doseLine = React.useMemo(() => {
    if (!plannedHours) return null;
    const total = Math.round(plannedHours * 60);
    const round5 = (n: number) => Math.round(n / 5) * 5;
    const d1 = round5(total * 0.4);
    const d2 = round5(total * 0.35);
    const d3 = Math.max(5, total - d1 - d2);
    return `Plano para ${fmtH(plannedHours)}: leia ~${fmtH(d1 / 60)} · pratique ~${fmtH(d2 / 60)} · ensaie ~${fmtH(d3 / 60)}`;
  }, [plannedHours]);

  // A linha do retrato — números que contam a história, sem placar.
  const retrato = React.useMemo(() => {
    if (!snap) return [] as string[];
    const p: string[] = [];
    if (snap.plannedHours) p.push(`${fmtH(snap.plannedHours)} disponíveis hoje`);
    if (snap.activeDays30 > 0)
      p.push(
        `${snap.activeDays30} ${snap.activeDays30 === 1 ? 'dia' : 'dias'} de estudo nos últimos 30`,
      );
    if (snap.minutesToday > 0) p.push(`${snap.minutesToday} min de foco hoje`);
    if (snap.accuracyPct !== null) p.push(`acerto em ${snap.accuracyPct}%`);
    if (snap.cardsDue > 0) p.push(`${snap.cardsDue} cartões a revisar`);
    if (snap.openMistakes > 0)
      p.push(`${snap.openMistakes} ${snap.openMistakes === 1 ? 'erro' : 'erros'} em aberto`);
    if (snap.nextExam)
      p.push(
        `${snap.nextExam.kindLabel.toLowerCase()} de ${snap.nextExam.disciplineShort} ${
          snap.nextExam.daysLeft === 0
            ? 'hoje'
            : snap.nextExam.daysLeft === 1
              ? 'amanhã'
              : `em ${snap.nextExam.daysLeft} dias`
        }`,
      );
    if (snap.nextDeadline)
      p.push(
        `${snap.nextDeadline.daysLeft === 0 ? 'hoje' : `em ${snap.nextDeadline.daysLeft} ${snap.nextDeadline.daysLeft === 1 ? 'dia' : 'dias'}`}: ${snap.nextDeadline.title}`,
      );
    if (p.length === 0) p.push('seu progresso aparece aqui conforme você estuda');
    return p;
  }, [snap]);

  // O ÚLTIMO material aberto — a home não pode viver em modo prova: no dia a
  // dia, o passo 1 devolve a pessoa exatamente ao ponto onde ela parou.
  const ultimo = sp.progress.recentMaterials[0] ?? null;
  const ultimoMaterial = ultimo ? materials.find((m) => m.id === ultimo.id) ?? null : null;

  // FRENTE 9 — o gesto "Continuar" da home em 1 clique: material + tutor + foco.
  //   • Com PDF: o leitor abre AQUI (split) e o foco é governado com honestidade —
  //     rodando → não toca (o chip do header segue o que corre);
  //     banner de continuidade do MESMO material em fase de foco → retomada
  //     com desconto do tempo corrido (continueFromBanner);
  //     senão → foco cheio amarrado ao material (focusMaterial — retoma meio
  //     de foco parado, troca pausa por foco, nunca zera um ciclo vivo).
  //   • Sem PDF (vídeo/página/ementa): a aba Estudar, que tem as portas certas.
  const openMaterialFocused = React.useCallback(
    (mat: Material) => {
      if (!readerDoorVisible(mat)) {
        onStartStudy(mat.disciplineCode, mat.id);
        return;
      }
      const f = focusApi;
      if (f && !f.live.running) {
        const b = f.banner;
        if (b && b.saved.phase === 'focus' && b.saved.materialId === mat.id) {
          f.continueFromBanner();
        } else {
          f.focusMaterial(mat.disciplineCode, mat.id);
        }
      }
      setLeitorPage(recallPdfPage(mat.id, mat.pages) ?? undefined);
      setLeitorMat(mat);
    },
    [focusApi, onStartStudy],
  );

  // TASK 222 — o gesto de INICIAR um passo do dia: Pomodoro ajustado ao
  // tamanho do bloco (com volta — o original do dia fica no autoFit; na
  // sessão sintonizada o check-in já sincronizou, não sobrescreve) + o
  // conteúdo certo aberto em 1 clique (material+tutor+foco / Praticar /
  // flashcards / disciplina) — a MESMA gramática do gesto de um bloco da
  // home, agora disparada pelo piloto.
  const launchStep = React.useCallback(
    (step: LaunchStep) => {
      if (!agora) return;
      if (!sessionActive && step.minutes > 0) {
        syncPomodoroToBudget(sp, step.minutes, todayDateKey(agora));
      }
      const f = focusApi;
      // Todo caminho SEM PDF amarra o foco à disciplina e DISPARA (a promessa
      // do gesto: "clico para iniciar e ele inicia" — o foco não espera um
      // segundo clique). Com PDF, o openMaterialFocused já governa o foco.
      const bindAndStart = (code?: string) => {
        if (f && code && !f.live.running) f.focusMaterial(code, '');
      };
      switch (step.open) {
        case 'material': {
          const mat = step.materialId
            ? materials.find((m) => m.id === step.materialId) ?? null
            : null;
          if (mat) openMaterialFocused(mat);
          else {
            bindAndStart(step.disciplineCode);
            onStartStudy(step.disciplineCode, step.materialId);
          }
          return;
        }
        case 'pratica':
          bindAndStart(step.disciplineCode);
          openPractice({ disciplineCode: step.disciplineCode });
          return;
        case 'flashcards':
          bindAndStart(step.disciplineCode);
          openPractice({ mode: 'flashcards' });
          return;
        case 'estudar':
          bindAndStart(step.disciplineCode);
          onStartStudy(step.disciplineCode);
          return;
      }
    },
    [agora, sessionActive, sp, focusApi, openMaterialFocused, onStartStudy],
  );

  // FRENTE 13 + TASK 30 + CICLO DO ERRO (pauta nº 1) — o gesto de um bloco:
  // plano cru (PlanBlock) e bloco da sessão (HarmonyBlock) compartilham a
  // forma essencial — o MESMO clique abre os dois (material →
  // openMaterialFocused; prática → flashcards; ERRO → o re-teste da questão
  // exata no Praticar, via a unidade do Code Review que o gerou).
  const openPlanBlock = React.useCallback(
    (b: {
      kind: string;
      materialId?: string;
      disciplineCode?: string;
      errorUnitId?: string;
    }) => {
      if (b.kind === 'pratica') {
        openPractice({ mode: 'flashcards' });
        return;
      }
      if (b.kind === 'erro') {
        // a unidade do núcleo nasce do acervo (`unit:${exerciseId}`) — o
        // re-teste abre a questão EXATA que gerou o erro (filtro idêntico ao
        // apoio do dia); unidade sem exercício na casa abre a disciplina.
        const exerciseId = b.errorUnitId?.startsWith('unit:')
          ? b.errorUnitId.slice('unit:'.length)
          : undefined;
        openPractice({
          disciplineCode: b.disciplineCode,
          ...(exerciseId ? { exerciseIds: [exerciseId] } : {}),
        });
        return;
      }
      if (!b.materialId) return;
      const mat = materials.find((m) => m.id === b.materialId) ?? null;
      if (mat) openMaterialFocused(mat);
      else onStartStudy(b.disciplineCode, b.materialId);
    },
    [openMaterialFocused, onStartStudy],
  );

  // Passo 1 estático (pré-mount / neutro): o caminho de sempre, sem surpresa.
  const step1Static = ultimoMaterial
    ? {
        icon: BookOpen,
        title: 'Continue de onde parou',
        body: ultimoMaterial.title,
        action: 'Continuar',
        onClick: () => {
          if (ultimoMaterial) openMaterialFocused(ultimoMaterial);
        },
      }
    : {
          icon: BookOpen,
          title: 'Leia com o tutor ao lado',
          body: 'Abra o PDF da aula em tela dividida: o texto de um lado, o tutor do outro. Pergunte qualquer coisa — ele lê o material com você.',
          action: 'Estudar',
          onClick: () => onStartStudy(),
        };

  // Passo 1 = O FOCO DO DIA — UMA recomendação com porquê (today-focus.ts):
  // prova oficial à frente > fila de revisão > caderno de erros > retomar > método.
  const focusStep = snap
    ? (() => {
        const f = snap.focus;
        switch (f.kind) {
          case 'exam':
            return {
              icon: Timer,
              title: f.title,
              body: f.body,
              action: f.cta,
              // TASK 221: prova D-8..D-14 abre PRÁTICA dirigida (a lista);
              // na reta final (D-7..) e para atividade/trabalho véspera, ensaio.
              onClick: () =>
                f.open === 'pratica'
                  ? openPractice({ disciplineCode: f.disciplineCode })
                  : openSimulado({ disciplineCode: f.disciplineCode }),
            };
          case 'review':
            return {
              icon: ListChecks,
              title: f.title,
              body: f.body,
              action: f.cta,
              onClick: () => openPractice({ mode: 'flashcards' }),
            };
          case 'mistake':
            return {
              icon: PenLine,
              title: f.title,
              body: f.body,
              action: f.cta,
              onClick: () => openPractice({ disciplineCode: f.disciplineCode }),
            };
          case 'resume': {
            // Frente 9: o foco do dia "continuar" também abre em 1 clique.
            const mat = materials.find((m) => m.id === f.materialId) ?? null;
            return {
              icon: BookOpen,
              title: f.title,
              body: f.body,
              action: f.cta,
              onClick: () => {
                if (mat) openMaterialFocused(mat);
                else onStartStudy(f.disciplineCode, f.materialId);
              },
            };
          }
          default:
            return {
              icon: BookOpen,
              title: f.title,
              body: f.body,
              action: f.cta,
              onClick: () => onStartStudy(),
            };
        }
      })()
    : step1Static;

  // Passo 2 e 3 mudam com a avaliação viva — SEM DUPLICAR o passo 1 (Mensagem
  // 7 do dono: "ensaiar" aparecia 2× quando o foco já era o ensaio).
  //  · foco = prova D-8..D-14 → passo 1 já é a lista dirigida; passo 2 vira
  //    LEITURA da disciplina com o tutor (o método leia→resolva→ensaie continua).
  //  · foco = ensaio (prova ≤7d / atividade ≤3d / trabalho ≤7d) → passo 2 é a
  //    lista da disciplina, passo 3 é o recall (flashcards) — nunca outro ensaio.
  //  · sem avaliação em foco, com prova ≤7d na reta → lista + ensaio (o trio
  //    clássico); senão → lista genérica + revisão.
  const retaFinal = !!focusEval && focusEval.kindLabel === 'Prova' && focusEval.daysLeft <= 7;
  const folhaServe =
    (!!focusEval && focusEval.disciplineCode === MATH_EXAM.disciplineCode) &&
    (focusExam || retaFinal);
  const step2 = focusExam && focusEval && focusEval.daysLeft > 7
    ? {
        icon: BookOpen,
        title: `Leia o material da prova com o tutor`,
        body: `${focusEval.disciplineShort} em tela dividida: o texto de um lado, o tutor do outro — e a lista cobrando o que a prova cobra.`,
        action: 'Estudar',
        onClick: () => onStartStudy(focusEval.disciplineCode),
      }
    : focusExam || retaFinal
      ? folhaServe
        ? {
            icon: PenLine,
            title: 'Resolva as questões do professor',
            body: `As questões da ${focusEval!.name} em uma folha só, com método e gabarito. Resolva no papel, sem pressa.`,
            action: 'Abrir a folha',
            onClick: () => {
              setLeitorPage(undefined);
              if (folha) setLeitorMat(folha);
            },
          }
        : {
            icon: PenLine,
            title: 'Resolva as questões da lista',
            body: `Questões de ${focusEval!.disciplineShort} para treinar o que a ${focusEval!.name} cobra — no papel, uma por vez.`,
            action: 'Ir para Praticar',
            onClick: () => openPractice({ disciplineCode: focusEval!.disciplineCode }),
          }
      : {
          icon: PenLine,
          title: 'Resolva as questões da lista',
          body: 'Pegue as questões do material que você acabou de ler e faça no papel, uma por vez.',
          action: 'Ir para Praticar',
          onClick: () => openPractice({}),
        };

  const step3 = !focusExam && retaFinal
    ? {
        icon: Timer,
        title: 'Faça o ensaio',
        body: 'As mesmas questões do professor, com cronômetro real. O ensaio mostra o que falta — sem cobrar nada.',
        action: 'Começar o ensaio',
        onClick: () =>
          openSimulado({
            disciplineCode: focusEval!.disciplineCode,
            ...(folhaServe ? { preset: 'math_exam_prof' as const } : {}),
          }),
      }
    : {
        icon: Timer,
        title: 'Revise o que ficou',
        body: 'Passe pelos flashcards pendentes e confira os pontos que travaram na hora de resolver.',
        action: 'Revisar',
        onClick: () => openPractice({ mode: 'flashcards' }),
      };

  const steps = [focusStep, step2, step3];

  // Onde-parou como chip (só se o foco do dia não for ele) — extraído para
  // fora do JSX: o TS não afunila propriedade dentro de callbacks.
  const resumeChip =
    snap?.resume && snap.focus.kind !== 'resume' ? snap.resume : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {/* A linha do dia — uma frase humana, nada de painel */}
      <section aria-labelledby="dia-titulo">
        <h1 id="dia-titulo" className="text-2xl font-semibold tracking-tight">
          {heroEvalNow && focusEval
            ? `Foco: ${focusEval.name} de ${focusEval.disciplineShort}.`
            : 'Bom estudo.'}
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {heroEvalNow && focusEval ? (
            <>
              {focusEval.daysLeft === 0
                ? `A ${focusEval.kindLabel.toLowerCase()} é hoje`
                : `${focusEval.kindLabel} amanhã`}
              . {dayLine ?? 'Um método, três passos: leia com o tutor, resolva no papel, ensaie.'}
            </>
          ) : (
            dayLine ?? 'Um método, três passos: leia com o tutor, resolva no papel, ensaie.'
          )}
        </p>
        {/* O 1º passo de ontem — a promessa do fecho cobrada na hora certa (banco #6) */}
        {passoOntem && (
          <div
            className="mt-3 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/[0.06] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-t="passo-ontem"
          >
            <p className="min-w-0 text-sm leading-snug">
              <Sunrise className="mr-1.5 inline size-4 text-primary" aria-hidden />
              No fecho de ontem você escolheu começar por:{' '}
              <span className="font-semibold">{passoOntem.text}</span>
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  // Só abre — o passo é a promessa do dia e expira sozinho
                  // amanhã (apagar aqui corre a corrida do write completo
                  // contra o markAccessed do leitor, no mesmo tick).
                  if (passoMaterial) openMaterialFocused(passoMaterial);
                  else onStartStudy();
                }}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Abrir agora o passo escolhido ontem: ${passoOntem.text}`}
                data-t="passo-abrir"
              >
                Abrir agora
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => sp.setTomorrowStep(null)}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Deixar o passo de ontem pra lá"
                data-t="passo-fechar"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
        {/* Check-in de horas — 1 toque ao logar, editável sempre (dono 10/10/2026).
            A casa aprende (banco #3): com ritmo recente, a mediana vira o 1º chip.
            TASK 224 — SESSÕES PARTIDAS: com orçamento já lançado, ADICIONAR vem
            primeiro (2h de manhã + 3h à noite = 5h honestas, nada se perde). */}
        {agora && (plannedHours === null || editingHours) && (
          <div className="mt-2" data-t="checkin-horas">
            <p className="text-sm text-muted-foreground">
              Quanto tempo você tem hoje? A sessão inteira se ajusta: plano, pomodoro e fecho.
              {budgetSuggestion && (
                <>
                  {' '}
                  Sugestão: <span className="font-medium text-foreground">{fmtH(budgetSuggestion.hours)}</span>{' '}
                  — {budgetSuggestion.why}.
                </>
              )}
            </p>
            {plannedHours !== null && plannedHours > 0 && (
              <div
                className="mt-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-2.5"
                data-t="checkin-adicionar"
              >
                <p className="text-xs font-medium text-foreground/80">
                  Mais tempo agora? Adiciona à sessão — hoje já tem {fmtH(plannedHours)} lançadas e o foco de
                  {' '}{snap?.minutesToday ?? 0}min registrado não se perde.
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {[0.5, 1, 1.5, 2, 3].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => addHours(h)}
                      title={`Adicionar ${fmtH(h)} ao dia (vira ${fmtH(plannedHours + h)} no total)`}
                      aria-label={`Adicionar ${fmtH(h)} ao orçamento de hoje`}
                      data-t={`checkin-add-${String(h).replace('.', '_')}`}
                      className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      +{fmtH(h)}
                    </button>
                  ))}
                </div>
                {checkinsToday.length >= 2 && (
                  <p className="mt-1.5 text-xs text-muted-foreground" data-t="checkin-log">
                    Lances de hoje:{' '}
                    {checkinsToday
                      .map(
                        (c) =>
                          `+${fmtH(c.hours)} às ${new Date(c.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
                      )
                      .join(' · ')}
                  </p>
                )}
              </div>
            )}
            {plannedHours !== null && plannedHours > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Ou substituir o dia todo:</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {/* TASK 225 — SEGUIR O RITMO (Mensagem 10): a casa conhece o dia
                  (fds 3×2h · semana 2×2h) e lança o orçamento completo em 1
                  toque — cada sessão do dia registra o lance com o horário
                  real e o Pomodoro se ajusta ao que RESTA. */}
              {dayRhythm.length > 0 && (
                <button
                  type="button"
                  onClick={() => applyHours(rhythmTotalHours)}
                  title={`Lançar ${fmtH(rhythmTotalHours)} — ${rhythmLine}`}
                  aria-label={`Seguir o ritmo de hoje: ${fmtH(rhythmTotalHours)} (${rhythmLine})`}
                  data-t="checkin-ritmo"
                  className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Seguir o ritmo de hoje: {fmtH(rhythmTotalHours)}
                </button>
              )}
              {agora &&
                !Array.isArray(sp.progress.studyPreferences.days[agora.getDay()]?.windows) && (
                  <button
                    type="button"
                    onClick={() => sp.applyStudyRhythm()}
                    title="Semana: 2h de tarde + 2h de noite · Fim de semana: + 2h de manhã (2h por turno)"
                    aria-label="Mudar para o ritmo Semana/FDS (turnos de 2h)"
                    data-t="ritmo-adotar"
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Mudar para o ritmo Semana/FDS
                  </button>
                )}
              {budgetSuggestion && (
                <button
                  type="button"
                  onClick={() => applyHours(budgetSuggestion.hours)}
                  title={`${fmtH(budgetSuggestion.hours)} — ${budgetSuggestion.why}`}
                  aria-label={`Aplicar sugestão de ${fmtH(budgetSuggestion.hours)}: ${budgetSuggestion.why}`}
                  data-t="checkin-sugestao"
                  className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {fmtH(budgetSuggestion.hours)} · seu ritmo
                </button>
              )}
              {[1, 1.5, 2, 2.5, 3, 4].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => applyHours(h)}
                  title={`Substituir o dia por ${fmtH(h)}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {fmtH(h)}
                </button>
              ))}
              {plannedHours !== null && (
                <button
                  type="button"
                  onClick={() => applyHours(0)}
                  className="rounded-full px-2 py-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  limpar
                </button>
              )}
            </div>
          </div>
        )}
        {/* O retrato — o acompanhamento automático: números que o uso diário já gerou */}
        {retrato.length > 0 && (
          <p className="mt-1.5 text-sm text-muted-foreground/90" data-t="retrato-linha">
            {retrato.join(' · ')}
            {plannedHours !== null && !editingHours && (
              <button
                type="button"
                onClick={() => setEditingHours(true)}
                className="ml-2 text-xs text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                editar
              </button>
            )}
          </p>
        )}
        {/* TASK 225 — O RITMO DE HOJE, vivo: o foco REAL registrado preenche
            as janelas em sequência (manhã → tarde → noite) — ninguém marca
            nada à mão, a casa mostra o turno cumprido, o em curso e o que vem.
            M13 — a hora SÓ aparece quando o uso a ensinou (turnoIsLearned):
            turno ainda sem lances reais = nome do turno, nunca o relógio
            08h/14h/19h que ninguém escolheu (dono: "eu não defini esses
            horários nem quero"). */}
        {agora && dayRhythm.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" data-t="ritmo-hoje">
            <span className="font-medium text-muted-foreground">Ritmo de hoje:</span>
            {rhythmStatus.map(({ window: w, status, minutes }) => {
              const learned = turnoIsLearned(sp.progress.sessionStarts, w.turno);
              return (
                <span
                  key={w.turno}
                  title={
                    learned
                      ? `horário registrado do seu uso real (mediana dos seus inícios de ${TURNO_LABEL[w.turno].toLowerCase()})`
                      : 'a casa está registrando quando você começa — a hora deste turno aparece com o uso'
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums',
                    status === 'done'
                      ? 'border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400'
                      : status === 'curso'
                        ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground',
                  )}
                >
                  {TURNO_LABEL[w.turno]}
                  {learned ? ` ${formatTime(w.startHour, 0)}` : ''}
                  {status === 'done' ? ' · feita' : status === 'curso' ? ` · ${minutes}min` : ''}
                </span>
              );
            })}
            {dayRhythm.some((w) => !turnoIsLearned(sp.progress.sessionStarts, w.turno)) && (
              <span className="text-[11px] text-muted-foreground/60">— as horas nascem dos seus check-ins</span>
            )}
          </p>
        )}
        {/* TASK 224 — O FOCO DO DIA: escolher a matéria que concentra a fila.
            Por dia — amanhã a casa volta à fila normal por conta própria. */}
        {agora && (
          <div className="mt-2 flex flex-wrap items-center gap-2" data-t="foco-dia">
            <span className="text-xs font-medium text-muted-foreground">Foco de hoje:</span>
            <Select
              value={dayFocusCode ?? 'none'}
              onValueChange={(v) => sp.setDayFocus(todayDateKey(agora), v === 'none' ? null : v)}
            >
              <SelectTrigger
                className="h-8 w-[230px] rounded-lg text-xs"
                aria-label="Escolher a matéria foco de hoje"
                data-t="foco-dia-select"
              >
                <SelectValue placeholder="Sem foco específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem foco — a fila manda</SelectItem>
                {disciplines.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.shortName} — no comando do dia
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dayFocusShort && (
              <span className="text-xs text-muted-foreground">
                a fila concentra em {dayFocusShort} — véspera de prova continua na frente
              </span>
            )}
          </div>
        )}
        {/* Onde parou — um clique devolve ao ponto exato (só se o foco do dia não for ele) */}
        {resumeChip && (
          <p className="mt-1 text-sm">
            <button
              type="button"
              onClick={() => {
                const mat = materials.find((m) => m.id === resumeChip.materialId) ?? null;
                if (mat) openMaterialFocused(mat);
                else onStartStudy(resumeChip.disciplineCode, resumeChip.materialId);
              }}
              className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <BookOpen className="size-3.5" aria-hidden />
              Continue: {resumeChip.title}
              {resumeChip.page ? ` (pág. ${resumeChip.page})` : ''}
            </button>
          </p>
        )}
        {/* Meu acompanhamento — o espelho completo, um toque abaixo da linha (frente C):
            a casa segue limpa; o detalhe só abre quando o dono pede. */}
        {snap && detail && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setTrackingOpen((v) => !v)}
              aria-expanded={trackingOpen}
              aria-controls="painel-acompanhamento"
              className="inline-flex items-center gap-1 rounded text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-t="tracking-toggle"
            >
              Meu acompanhamento
              <ChevronDown
                className={`size-3.5 transition-transform ${trackingOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            <TrackingPanel open={trackingOpen} detail={detail} snap={snap} signals={learningSignals} />
          </div>
        )}
        {/* A LEITURA DO ALGORITMO NA SUPERFÍCIE (Task 226) — 1 linha suave:
            a casa conta o que o uso real mudou na fila (só quando tem algo a
            dizer — sem ruído na home limpa). */}
        {agora && algoritmoLeitura.frase && (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground" data-t="algoritmo-leitura">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              {algoritmoLeitura.frase}
              {algoritmoLeitura.ajustes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTrackingOpen(true)}
                  className="ml-1 text-foreground underline underline-offset-4 transition-colors hover:text-primary"
                >
                  ver como
                </button>
              )}
            </span>
          </p>
        )}
        {/* MOMENTO DE REVISÃO (Task 226) — o fim de semana carrega o espelho
            da semana NA PRÓPRIA HOME: relatório completo + sinais do algoritmo
            (questões demoradas, tutor, facilidade, ajustes). Um chip só, some
            na segunda (a casa volta a estudar). */}
        {momentoRevisao && (
          <>
            <p className="mt-2">
              <button
                type="button"
                onClick={() => setSemanaOpen((v) => !v)}
                aria-expanded={semanaOpen}
                aria-controls="painel-revisao-semana"
                data-t="momento-revisao"
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-violet-500/40 dark:text-violet-400"
              >
                <Sparkles className="size-3.5" aria-hidden />
                Momento de revisão — o que a semana ensinou
                <ChevronDown
                  className={`size-3.5 transition-transform ${semanaOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
            </p>
            <div
              id="painel-revisao-semana"
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: semanaOpen ? '1fr' : '0fr' }}
              aria-hidden={!semanaOpen}
              inert={semanaOpen ? undefined : true}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="mt-3" data-t="revisao-semana">
                  <WeeklyReport />
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* TASK 222 + ÁUDIO 18/10 — UM CARD SÓ PARA O DIA: o lançador É o
          cronograma de hoje (os blocos moram dentro dele, abertos com um
          toque). Fim dos dois cards dizendo a mesma coisa em horas
          diferentes — "eu não sei o que eu vou fazer ou o que eu vou dar no
          dia dessa maneira". Com sessão sintonizada, o card da sessão
          assume (a mesma fila, com barra viva e fecho). */}
      {!sessionActive && (
        <DayLauncherCard
          plan={launchPlan}
          steps={launchSteps}
          sessionActive={sessionActive}
          minutesToday={snap?.minutesToday ?? 0}
          focusLabel={dayFocusShort}
          onStartStep={launchStep}
          onCompleteStep={completeLaunchStep}
        />
      )}

      {/* O método — um caminho só, três passos, cada um abre o conteúdo certo */}
      <Card className="rounded-2xl p-5 sm:p-6" data-t="metodo-card">
        <h2 className="text-base font-semibold leading-tight">Como estudar hoje</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Três passos, sempre os mesmos — na ordem.
        </p>
        {doseLine && (
          <p className="mt-1 text-sm font-medium text-primary" data-t="dose-linha">
            {doseLine}
          </p>
        )}
        <ol className="mt-4">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className={`flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-start sm:gap-4 ${
                i > 0 ? 'border-t border-border/60' : ''
              }`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug">
                  <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
              <button
                type="button"
                onClick={s.onClick}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mt-0.5 sm:h-10 sm:w-auto sm:justify-start"
                aria-label={`${s.action} — ${s.title}`}
              >
                {s.action}
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      </Card>

      {/* TASK 221 + ÁUDIO 18/10 — UM CRONOGRAMA SÓ: com sessão sintonizada a
          home mostra a sessão (barra viva + fecho); sem sessão, o lançador
          acima É o dia (blocos dentro dele). O card separado "Hoje no
          cronograma" saiu daqui — era a segunda contabilidade que o dono
          apontou no áudio ("cinco blocos…" em cima e "~5h · 6 blocos"
          embaixo, com horas que não conversavam). */}
      {sessionActive && <SessionHarmonyCard onOpenBlock={openPlanBlock} />}

      {/* ÁUDIO 18/10 — A HOME LIMPA: a fila essencial (triagem), o radar de
          provas, a grade de aulas, o PNAAT e a agenda oficial moram na aba
          Cronograma — "algumas dessas coisas poderiam ser levadas a outras
          abas, claro, sem deixar o site complexo sujo". A home fica com o
          dia, o método e as disciplinas. */}

      {/* Links úteis — uma linha discreta, nada de blocos (backup saiu: sujeira
          consciente segundo o dono, 10/10/2026 — a função segue em Configurações) */}
      <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
        <a
          href="/folha-revisao"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <Printer className="size-3.5" aria-hidden /> Folha de revisão (imprimir)
        </a>
        <span aria-hidden>·</span>
        <a
          href="/#progress"
          onClick={(e) => {
            e.preventDefault();
            openProgress();
          }}
          className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <ListChecks className="size-3.5" aria-hidden /> Calculadora de notas
        </a>
      </p>

      {/* O leitor da home — PDF + tutor em tela dividida para TODAS as
          aberturas ("Continuar" em 1 clique e a folha da prova). Um diálogo
          só, o mesmo da casa: chip de foco, print e retomada dentro. */}
      <PdfViewerDialog
        material={leitorMat}
        open={leitorMat !== null}
        onOpenMaterial={(m) => {
          // A ESCADINHA GUIADA: desceu um degrau direto da home — o convite
          // de página morre (a base abre do topo, com a pill honesta dela).
          setLeitorPage(undefined);
          setLeitorMat(m);
        }}
        onOpenChange={(v) => {
          if (!v) setLeitorMat(null);
        }}
        initialMode="split"
        initialPage={leitorPage}
      />
    </div>
  );
}
