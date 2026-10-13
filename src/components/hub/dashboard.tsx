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
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
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
import { Badge } from '@/components/ui/badge';
import { disciplines, materials, type Material } from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { openPractice, openProgress, openSimulado } from '@/lib/hub-events';
import { MATH_EXAM } from '@/lib/math-exam-prep';
import { upcomingEvents } from '@/lib/semester';
import { PnaatReminderCard } from './pnaat-reminder-card';
import { ExamRadarCard } from './exam-radar-card';
import { Switch } from '@/components/ui/switch';
import { buildTodaySnapshot, buildTrackingDetail, todayDateKey } from '@/lib/today-focus';
import { buildDayPlan, PLAN_KIND_LABEL, type PlanKind } from '@/lib/study-plan';
import { suggestBudgetFromHistory, syncPomodoroToBudget } from '@/lib/session-harmony';
import { useStudyProgress } from '@/lib/study-progress';
import { useStudyFocus } from '@/lib/pomodoro-engine';
import { readerDoorVisible } from '@/lib/study-reader-door';
import { recallPdfPage } from '@/lib/pdf-position';
import { TrackingPanel } from './tracking-panel';
import { PdfViewerDialog } from './pdf-viewer-dialog';
import { SessionHarmonyCard } from './session-harmony-card';

/** A folha da prova — as questões do professor como MATERIAL (t180). */
const FOLHA_DA_PROVA_ID = 'mat-av1-questoes-professor';

/** FRENTE 13 — a cara de cada tipo de bloco do plano: cor fixa por natureza
 *  (tempo = âmbar, atraso = rosa, recall = violeta, novo = teal, retomar =
 *  a cor de ação da casa). Definido fora do componente — é tabela, não estado. */
const PLAN_KIND_META: Record<PlanKind, { icon: LucideIcon; bg: string; text: string }> = {
  continuar: {
    icon: BookOpen,
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  revisao: {
    icon: History,
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
  },
  pratica: {
    icon: ListChecks,
    bg: 'bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-400',
  },
  atrasado: {
    icon: AlarmClock,
    bg: 'bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-400',
  },
  proximo: {
    icon: Sparkles,
    bg: 'bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-400',
  },
};

/** A página de retomada REAL (memória do leitor, hub:pdf-pos — t161), injetada
 *  no retrato: o chip "(pág. N)" da home fala a verdade da leitura. */
function resumePageOf(materialId: string): number | null {
  const m = materials.find((x) => x.id === materialId);
  return m ? recallPdfPage(materialId, m.pages) : null;
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

  // FRENTE 13 — O PLANO DE HOJE: o cronograma que se monta sozinho do uso
  // diário (retomada + ciclo 1·3·7·14·30 dos concluídos + cartões vencidos
  // + atrasados + próximos da fila). Recomputado pós-mount (mesmo `agora`
  // do retrato — SSR e 1º render dividem o neutro) e a cada write do
  // progresso (a checklist tiqueada no leitor muda o porquê aqui na hora).
  const plan = React.useMemo(
    () => (agora ? buildDayPlan(sp.progress, agora, { pageOf: resumePageOf }) : null),
    [sp.progress, agora],
  );

  const nextExam = snap?.nextExam ?? null;
  const provaPerto = !!nextExam && nextExam.daysLeft <= 7;
  const provaLabel = nextExam
    ? nextExam.daysLeft === 0
      ? 'prova hoje'
      : nextExam.daysLeft === 1
        ? 'prova amanhã'
        : `prova em ${nextExam.daysLeft} dias`
    : undefined;

  // ----- Horas do dia (check-in) + doses do método + agenda oficial -----
  const plannedHours = snap?.plannedHours ?? null;
  /** A sessão sintonizada existe quando há orçamento no dia (Task 30). */
  const sessionActive = (plannedHours ?? 0) > 0;
  const dateKey = agora ? todayDateKey(agora) : '';

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

  /** 1.5 → "1h30" · 2 → "2h" · 0.75 → "45min". */
  const fmtH = (h: number): string => {
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    if (hh === 0) return `${mm}min`;
    return mm === 0 ? `${hh}h` : `${hh}h${mm}`;
  };

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

  const agenda = React.useMemo(() => (agora ? upcomingEvents(agora, 5) : []), [agora]);

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
        `prova de ${snap.nextExam.disciplineShort} ${
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

  // FRENTE 13 + TASK 30 — o gesto de um bloco: plano cru (PlanBlock) e bloco
  // da sessão (HarmonyBlock) compartilham a forma essencial — o MESMO clique
  // abre os dois (material → openMaterialFocused; prática → flashcards).
  const openPlanBlock = React.useCallback(
    (b: { kind: string; materialId?: string; disciplineCode?: string }) => {
      if (b.kind === 'pratica') {
        openPractice({ mode: 'flashcards' });
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
  const step1Static = provaPerto
    ? {
        icon: BookOpen,
        title: 'Leia com o tutor ao lado',
        body: 'Abra o PDF da aula em tela dividida: o texto de um lado, o tutor do outro. Pergunte qualquer coisa — ele lê o material com você.',
        action: 'Estudar',
        onClick: () => onStartStudy(),
      }
    : ultimoMaterial
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
              onClick: () => openSimulado({ disciplineCode: f.disciplineCode }),
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

  // Passo 2 e 3 mudam com a distância da prova VIVA — o método é sempre o mesmo.
  // A folha dedicada só existe para a prova que a tem (a Av1 de Matemática);
  // para as demais, o Praticar filtrado é o caminho honesto.
  const examSoon = !!nextExam && nextExam.daysLeft <= 7;
  const folhaServe = examSoon && nextExam.disciplineCode === MATH_EXAM.disciplineCode;
  const step2 = examSoon
    ? folhaServe
      ? {
          icon: PenLine,
          title: 'Resolva as questões do professor',
          body: `As questões da ${nextExam.name} em uma folha só, com método e gabarito. Resolva no papel, sem pressa.`,
          action: 'Abrir a folha',
          onClick: () => {
            setLeitorPage(undefined);
            if (folha) setLeitorMat(folha);
          },
        }
      : {
          icon: PenLine,
          title: 'Resolva as questões da lista',
          body: `Questões de ${nextExam.disciplineShort} para treinar o que a ${nextExam.name} cobra — no papel, uma por vez.`,
          action: 'Ir para Praticar',
          onClick: () => openPractice({ disciplineCode: nextExam.disciplineCode }),
        }
    : {
        icon: PenLine,
        title: 'Resolva as questões da lista',
        body: 'Pegue as questões do material que você acabou de ler e faça no papel, uma por vez.',
        action: 'Ir para Praticar',
        onClick: () => openPractice({}),
      };

  const step3 = examSoon
    ? {
        icon: Timer,
        title: 'Faça o ensaio',
        body: 'As mesmas questões do professor, com cronômetro real. O ensaio mostra o que falta — sem cobrar nada.',
        action: 'Começar o ensaio',
        onClick: () =>
          openSimulado({
            disciplineCode: nextExam.disciplineCode,
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
          {provaPerto && nextExam
            ? `Foco: ${nextExam.name} de ${nextExam.disciplineShort}.`
            : 'Bom estudo.'}
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {provaPerto && nextExam ? (
            <>
              {nextExam.daysLeft === 0
                ? 'A prova é hoje'
                : `Prova em ${nextExam.daysLeft} ${nextExam.daysLeft === 1 ? 'dia' : 'dias'}`}
              . Um método, três passos: leia com o tutor, resolva no papel, ensaie.
            </>
          ) : (
            <>
              Um método, três passos: leia com o tutor, resolva no papel, ensaie. É tudo o que o
              site pede de você.
            </>
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
            A casa aprende (banco #3): com ritmo recente, a mediana vira o 1º chip. */}
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
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
            <TrackingPanel open={trackingOpen} detail={detail} snap={snap} />
          </div>
        )}
      </section>

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

      {/* TASK 30 — A SESSÃO SINTONIZADA: com orçamento no dia, ela assume a
          vez do Plano de hoje (a MESMA fila, agora casada com o tempo — blocos
          que cabem, fecho garantido, pomodoro encaixado, barra viva). Sem
          check-in, a casa segue com o plano de sempre. */}
      {sessionActive ? (
        <SessionHarmonyCard onOpenBlock={openPlanBlock} />
      ) : (
        plan &&
        plan.blocks.length > 0 && (
        <Card className="rounded-2xl p-5 sm:p-6" data-t="plano-card">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className="text-base font-semibold leading-tight">Plano de hoje</h2>
            <span className="flex items-center gap-2">
              {/* REVISÃO SOB COMANDO (Task 27): o dono decide se o ciclo de
                  antigos entra na fila — o plano reflowa no mesmo render. */}
              <label
                htmlFor="toggle-revisao"
                className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Switch
                  id="toggle-revisao"
                  checked={sp.progress.preferences?.includeReviews !== false}
                  onCheckedChange={(v) => sp.updatePreferences({ includeReviews: v })}
                  aria-label="Incluir revisão de assuntos antigos no plano"
                  data-t="toggle-revisao"
                />
                revisar antigos
              </label>
              <span className="text-xs tabular-nums text-muted-foreground" data-t="plano-total">
                ~{fmtH(plan.totalMinutes / 60)} · {plan.blocks.length}{' '}
                {plan.blocks.length === 1 ? 'bloco' : 'blocos'}
              </span>
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sp.progress.preferences?.includeReviews === false
              ? 'Só conteúdo novo, prática e prova — revisão espaçada desligada por você.'
              : 'Recentes da aula primeiro, prova marcada pesa, revisão espaçada no meio — some da lista conforme você conclui.'}
          </p>
          <ul className="mt-2">
            {plan.blocks.map((b) => {
              const meta = PLAN_KIND_META[b.kind];
              const Icon = meta.icon;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => openPlanBlock(b)}
                    data-t={`plano-${b.id}`}
                    data-testid={`plano-bloco-${b.kind}`}
                    aria-label={`${PLAN_KIND_LABEL[b.kind]}: ${b.title} — ${b.why} (≈${fmtH(b.minutes / 60)}). Clique para abrir com o tutor ao lado`}
                    className="group flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-xl',
                        meta.bg,
                        meta.text,
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span
                          className={cn(
                            'shrink-0 text-[10.5px] font-semibold uppercase tracking-wide',
                            meta.text,
                          )}
                        >
                          {PLAN_KIND_LABEL[b.kind]}
                        </span>
                        {b.exam && (
                          <span
                            className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                            aria-label={`Prova de ${b.exam.name} em ${b.exam.daysLeft} dias`}
                          >
                            D-{b.exam.daysLeft}
                          </span>
                        )}
                        <span className="truncate text-[14px] font-medium leading-snug">
                          {b.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] leading-snug text-muted-foreground">
                        {b.why}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {fmtH(b.minutes / 60)}
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        )
      )}

      {/* TASK 27 — O RADAR DE PROVAS: o ciclo real do semestre — o que foi,
          o que tem data e o que está a definir. É o espelho do que a fila já
          faz: prova marcada pesa, prova feita sai. */}
      <ExamRadarCard />

      {/* Lembrete PNAAT — compromisso externo (plataforma FIT): lembrar, não replicar */}
      <PnaatReminderCard />

      {/* Agenda oficial — o calendário do campus, fonte viva: nada de prazo surpresa */}
      {agenda.length > 0 && (
        <Card className="rounded-2xl p-5 sm:p-6" data-t="agenda-card">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-base font-semibold leading-tight">Agenda</h2>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Próximos compromissos oficiais do calendário do campus.
          </p>
          <ul className="mt-3">
            {agenda.map((ev, i) => (
              <li
                key={`${ev.date}-${ev.title}`}
                className={`flex items-center gap-3 py-2 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    ev.kind === 'provas'
                      ? 'bg-violet-500'
                      : ev.kind === 'prazo'
                        ? 'bg-amber-500'
                        : ev.kind === 'feriado'
                          ? 'bg-emerald-500'
                          : ev.kind === 'letivo'
                            ? 'bg-teal-500'
                            : 'bg-zinc-400'
                  }`}
                  aria-hidden
                />
                <span className="w-14 shrink-0 text-muted-foreground">
                  {ev.ongoing
                    ? 'em curso'
                    : ev.daysLeft === 0
                      ? 'hoje'
                      : ev.daysLeft === 1
                        ? 'amanhã'
                        : `${ev.date.slice(8, 10)}/${ev.date.slice(5, 7)}`}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{ev.title}</span>
                {ev.daysLeft >= 0 && ev.daysLeft <= 7 && !ev.ongoing && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ev.daysLeft === 0 ? 'hoje' : ev.daysLeft === 1 ? 'amanhã' : `em ${ev.daysLeft} dias`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Disciplinas — uma lista simples, cada linha abre os materiais */}
      <section aria-labelledby="disciplinas-titulo">
        <h2 id="disciplinas-titulo" className="text-base font-semibold leading-tight">
          Disciplinas
        </h2>
        <div className="mt-3 grid gap-2" data-t="disciplinas-lista">
          {disciplines.map((d) => {
            const count = materials.filter((m) => m.disciplineCode === d.code).length;
            const prova = provaPerto && d.code === (nextExam?.disciplineCode ?? '');
            return (
              <button
                key={d.code}
                type="button"
                onClick={() => onStartStudy(d.code)}
                className="group flex w-full min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-foreground/25 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Abrir materiais de ${d.name}`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${getColorClasses(d.color).bgSoft} ${getColorClasses(d.color).text}`}
                >
                  <DisciplineIcon name={d.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{d.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {count === 0 ? 'sem materiais ainda' : `${count} ${count === 1 ? 'material' : 'materiais'}`}
                  </span>
                </span>
                {prova && provaLabel && (
                  <Badge className="shrink-0 gap-1 bg-violet-600 text-white shadow-sm">
                    <CalendarCheck className="size-3" aria-hidden />
                    {provaLabel}
                  </Badge>
                )}
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </section>

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
        onOpenChange={(v) => {
          if (!v) setLeitorMat(null);
        }}
        initialMode="split"
        initialPage={leitorPage}
      />
    </div>
  );
}
