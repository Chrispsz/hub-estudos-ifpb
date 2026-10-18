// day-launch.ts — O DIA PRONTO (Mensagem 8 do dono, 16/10/2026: "consigo
// iniciar o cronograma do dia de forma que ele já prepara tudo e adapta o
// pomodoro etc — eu clico para iniciar e ele inicia no cronograma conforme
// configurei e o algoritmo definiu com tudo organizado e pronto da forma mais
// inteligente possível para iniciar?").
//
// O que a lib faz (pura — nada de storage/React aqui, mesma doutrina da casa):
//   1. Recebe a fila de HOJE — os blocos do cronograma inteligente
//      (smart-schedule, MESMA fonte da aba Cronograma e da home) OU os blocos
//      da sessão sintonizada (session-harmony, quando há check-in de horas) —
//      e devolve a fila de lançamento já NORMALIZADA: um passo, um método,
//      um material, um porquê.
//   2. Para cada passo define O MÉTODO do bloco (leitura com o tutor, prática
//      no papel, recall ativo, avanço de projeto) — a casa nunca entrega um
//      bloco sem dizer o que fazer com ele.
//   3. Calcula o ENCAIXE do Pomodoro no resto do dia (fitPomodoro) — o dono
//      clica, o foco já nasce do tamanho certo (o sync real acontece no
//      onStartStep do dashboard, que escreve a config com volta).
//
// A conclusão dos blocos é o MESMO estado da aba Cronograma
// (scheduleBlocksDone) — concluir no lançamento marca no cronograma, sem
// segunda contabilidade. Nos blocos da sessão, a conclusão é pelo USO REAL
// (minutos de foco registrados) — a harmonia já resolve, nada duplicado.

import type { SmartBlock } from './smart-schedule';
import { formatTime } from './smart-schedule';
import type { HarmonyBlock, PomodoroFit } from './session-harmony';
import { fitPomodoro } from './session-harmony';
import type { PomodoroConfig } from './study-progress';

// ---------------------------------------------------------------------------
// O método de cada passo — o que fazer dentro do bloco (2–3 gestos, pt-BR)
// ---------------------------------------------------------------------------

export interface LaunchMethod {
  name: string;
  steps: string[];
}

/** Para onde o clique do passo leva — o dashboard mapeia para o gesto certo. */
export type LaunchOpen = 'material' | 'pratica' | 'flashcards' | 'estudar';

export interface LaunchStep {
  /** Estável: id do bloco do cronograma ou id do bloco da harmonia. */
  id: string;
  disciplineCode?: string;
  materialId?: string;
  title: string;
  /** Nome curto (a disciplina, ou "Revisão"). */
  short: string;
  minutes: number;
  /** Hora de início no cronograma ("12:00") — só nos blocos do cronograma. */
  time?: string;
  method: LaunchMethod;
  why?: string;
  open: LaunchOpen;
  intensive?: boolean;
  stale?: boolean;
  done: boolean;
  doneWhy?: string;
  /**
   * true = concluir aqui REGISTRA (scheduleBlocksDone). Nos blocos da sessão
   * a conclusão é pelo uso real (foco registrado) — nada de marcar à mão o
   * que o Pomodoro já mediu.
   */
  completable: boolean;
  source: 'cronograma' | 'sessao';
}

const METODO_LEITURA: LaunchMethod = {
  name: 'Leitura com o tutor',
  steps: [
    'Abra o material em tela dividida — o tutor lê com você',
    'Feche o PDF e escreva de cabeça o que entendeu',
    'O que escapou vira pergunta ao tutor — antes de virar erro',
  ],
};

const METODO_PRATICA: LaunchMethod = {
  name: 'Prática no papel',
  steps: [
    'Uma questão por vez, sem olhar o gabarito',
    'Erro anota no Caderno de Erros — é dado, não punição',
    'Só confira depois de tentar de verdade',
  ],
};

const METODO_REVISAO: LaunchMethod = {
  name: 'Recall ativo',
  steps: [
    'Fale a resposta ANTES de virar o cartão',
    'Zere a fila de flashcards da casa',
    'O que falhar 2× vira cartão novo',
  ],
};

const METODO_PROJETO: LaunchMethod = {
  name: 'Avanço de projeto',
  steps: [
    'Escolha UMA entrega pequena para este bloco',
    'Faça o rascunho existir — perfeição vem na revisão',
    'Anote o próximo passo antes de sair, para retomar quente',
  ],
};

function methodForActivity(activity: SmartBlock['activity']): LaunchMethod {
  switch (activity) {
    case 'estudo':
      return METODO_LEITURA;
    case 'exercicios':
      return METODO_PRATICA;
    case 'revisao':
      return METODO_REVISAO;
    case 'projeto':
      return METODO_PROJETO;
  }
}

/** Método do bloco da sessão (mesma gramática, chave pelo kind do plano).
 *  PlanKind não tem 'projeto' — o caso vivia morto aqui e saiu (Task 233). */
function methodForKind(kind: HarmonyBlock['kind']): LaunchMethod {
  switch (kind) {
    case 'revisao':
    case 'pratica':
      return METODO_REVISAO;
    case 'erro':
      return METODO_PRATICA;
    default:
      return METODO_LEITURA;
  }
}

// ---------------------------------------------------------------------------
// As duas fontes da fila — uma normalização só
// ---------------------------------------------------------------------------

/**
 * Blocos de HOJE do cronograma inteligente (a MESMA fonte da aba).
 * `materialOf` é o mapa disciplina→material sugerido da fila (o MESMO que a
 * home usa nos blocos clicáveis) — é o que faz "Começar o dia" abrir o PDF
 * certo com o tutor, não uma disciplina genérica.
 */
export function launchStepsFromSchedule(
  blocks: SmartBlock[],
  doneIds: string[],
  materialOf?: Map<string, string>,
): LaunchStep[] {
  const done = new Set(doneIds);
  return [...blocks]
    .sort((a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute))
    .map((b) => {
      const isReview = b.disciplineCode === 'revisao';
      const materialId = isReview ? undefined : materialOf?.get(b.disciplineCode);
      const activity = b.activity;
      return {
        id: b.id,
        disciplineCode: isReview ? undefined : b.disciplineCode,
        materialId,
        title: b.title,
        short: isReview ? 'Revisão' : b.title.split(' — ')[0] ?? b.title,
        minutes: b.durationMin,
        time: formatTime(b.startHour, b.startMinute),
        method: methodForActivity(activity),
        open: isReview
          ? 'flashcards'
          : activity === 'exercicios'
            ? 'pratica'
            : activity === 'revisao'
              ? 'flashcards'
              : materialId
                ? 'material'
                : 'estudar',
        intensive: b.intensive,
        stale: b.stale,
        done: done.has(b.id),
        completable: true,
        source: 'cronograma',
      } satisfies LaunchStep;
    });
}

/** Blocos da sessão sintonizada (check-in de horas) — conclusão pelo uso. */
export function launchStepsFromSession(blocks: HarmonyBlock[]): LaunchStep[] {
  return blocks
    .filter((b) => b.kind !== 'fecho')
    .map((b) => ({
      id: b.id,
      disciplineCode: b.disciplineCode,
      materialId: b.materialId,
      title: b.title,
      short: b.title.split(' — ')[0] ?? b.title,
      minutes: b.minutes,
      method: methodForKind(b.kind),
      why: b.why,
      open: (b.kind === 'pratica' || b.kind === 'revisao'
        ? 'flashcards'
        : b.kind === 'erro'
          ? 'pratica'
          : b.materialId
            ? 'material'
            : 'estudar') as LaunchOpen,
      done: b.done,
      doneWhy: b.doneWhy,
      completable: false,
      source: 'sessao',
    }));
}

// ---------------------------------------------------------------------------
// O plano do dia — fila + encaixe do Pomodoro + a linha que a casa fala
// ---------------------------------------------------------------------------

export interface DayLaunchPlan {
  steps: LaunchStep[];
  /** Índice do 1º pendente (=-1 quando não há). */
  firstPendingIndex: number;
  pendingCount: number;
  doneCount: number;
  totalPendingMinutes: number;
  /** O encaixe do Pomodoro no que RESTA do dia (o sync acontece no start). */
  fit: PomodoroFit | null;
  /** A linha pronta: "3 blocos · ~2h30 · focos de 45min". */
  readiness: string;
}

function fmtMin(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function buildDayLaunchPlan(steps: LaunchStep[], cfg: PomodoroConfig): DayLaunchPlan {
  const pending = steps.filter((s) => !s.done);
  const firstPendingIndex = steps.findIndex((s) => !s.done);
  const totalPendingMinutes = pending.reduce((acc, s) => acc + s.minutes, 0);
  const fit = pending.length > 0 ? fitPomodoro(totalPendingMinutes, cfg) : null;
  const parts = [`${pending.length} ${pending.length === 1 ? 'bloco' : 'blocos'}`];
  if (totalPendingMinutes > 0) parts.push(`~${fmtMin(totalPendingMinutes)}`);
  if (fit && !fit.single && fit.focusMin !== cfg.focus) parts.push(`focos de ${fit.focusMin}min`);
  else if (fit && fit.single) parts.push(`foco único de ${fit.focusMin}min`);
  return {
    steps,
    firstPendingIndex,
    pendingCount: pending.length,
    doneCount: steps.length - pending.length,
    totalPendingMinutes,
    fit,
    readiness: parts.join(' · '),
  };
}
