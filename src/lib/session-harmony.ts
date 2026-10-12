// session-harmony.ts — A SESSÃO SINTONIZADA (Task 30, pedido do dono 11/10/2026:
// "com aquele tempo que a gente escolhe quando loga, TUDO no site deve ficar
// adaptado para aquele tempo — cronograma, pomodoro e etc — funcionando em
// perfeita harmonia, direcionando ao melhor estudo, melhores resultados,
// melhor organização").
//
// O check-in de horas (dono 10/10/2026) já captura o orçamento do dia. Esta
// lib é o REGENTE: transforma os minutos disponíveis num plano único que
//   • reaproveita a inteligência do Plano de hoje (study-plan.ts — as mesmas
//     filas de continuar/revisão/prática/atrasados/próximos, sem segundo
//     cérebro rival);
//   • corta e fecha EXATAMENTE no orçamento (sobrando o FECHO — o último
//     minuto que registra o que ficou e escolhe o 1º passo de amanhã);
//   • encaixa o pomodoro na sessão: quantos focos cabem, com quantos minutos
//     cada um, e — quando o config atual não aproveita o tempo — o foco
//     ideal (syncPomodoroToBudget aplica e guarda o original para restaurar);
//   • re-flui na hora: mudou o orçamento (−30/+30 ou novo check-in), o plano,
//     a barra e o encaixe recalculam sozinhos (função pura — zero estado).
//   • MODO MICRO: menos de 20 min não é sessão pequena, é sessão outra —
//     um bloco único (a fila de cartões, se venceu) e o streak fica guardado.
//
// Doutrina da casa (today-focus/study-plan): lib PURA — recebe StudyProgress
// + now e devolve retrato honesto. Nada lê storage aqui; a página de retomada
// REAL chega injetada (opts.pageOf — a mesma fronteira da frente 9/13).
// As duas exceções client-friendly vivem NO FIM do arquivo e declaram-se:
// syncPomodoroToBudget / restorePomodoroConfig tocam o contrato único
// (sp.updatePreferences) porque a harmonia precisa escrever o config —
// sempre com volta (o original fica guardado em preferences.autoFit).

import {
  flashcardsDueFor,
  type PomodoroConfig,
  type Preferences,
  type StudyProgress,
} from './study-progress';
import { buildDayPlan, type PlanBlock, type PlanKind } from './study-plan';
import { todayDateKey } from './today-focus';

// ---------- Tipos públicos ----------

/** Minutos do FECHO — o fim de sessão que registra e aponta o amanhã. */
export const WRAPUP_MIN = 5;

/** Abaixo disso a sessão vira MODO MICRO (um bloco único, sem fecho). */
export const MICRO_THRESHOLD = 20;

export type SessionState =
  | 'sem-sessao' // sem check-in de horas — a casa fica limpa (nada aparece)
  | 'pronta' // orçamento lançado, nenhum foco rodou
  | 'micro' // orçamento < 20 min — um bloco único
  | 'em-andamento' // parte do foco já rodou, ainda cabe estudo
  | 'cumprida'; // o foco registrado cobriu (ou passou) o orçamento

/**
 * Bloco da sessão — a mesma gramática do PlanBlock (o dashboard abre com o
 * MESMO gesto de 1 clique: material + tutor + foco) + o estado vivo.
 */
export interface HarmonyBlock {
  /** Estável por construção — reutiliza o contrato de id do plano. */
  id: string;
  /** 'fecho' é o bloco final de registro (não existe no plano cru). */
  kind: PlanKind | 'fecho';
  materialId?: string;
  disciplineCode?: string;
  title: string;
  /** O porquê em uma linha — o plano decide, mas explica. */
  why: string;
  minutes: number;
  /** Concluído pelo uso real (foco registrado / fila zerada / concluído hoje). */
  done: boolean;
  doneWhy?: string;
  /** true = o orçamento cortou este bloco (o conteúdo continua amanhã). */
  trimmed?: boolean;
}

/** O encaixe do pomodoro na sessão — a matemática honesta do tempo. */
export interface PomodoroFit {
  /** Minutos de foco por ciclo (o ideal sincronizado; pode ser o config atual). */
  focusMin: number;
  /** Quantos focos cabem no orçamento. */
  cycles: number;
  focusTotal: number;
  breakTotal: number;
  wrapMin: number;
  /** Total consumido = focusTotal + breakTotal + wrapMin (≤ remaining). */
  totalMin: number;
  /** Sobrou sem alocação — folga honesta, nunca escondida. */
  leftover: number;
  /** Orçamento curto: UM foco único, sem pausas. */
  single: boolean;
  /** O foco ideal difere do config e vale o sync (ganho ≥ 10 min aproveitados). */
  needsSync: boolean;
  /** Frase pronta para a casa (pt-BR, a voz do lugar). */
  suggestion: string;
}

export interface SessionHarmony {
  state: SessionState;
  plannedMinutes: number;
  /** Foco REAL registrado hoje (pomodoroSessions) — a barra vive disso. */
  focusToday: number;
  remaining: number;
  blocks: HarmonyBlock[];
  doneCount: number;
  fit: PomodoroFit | null;
  /** Sugestão do amanhã (estado 'cumprida'): o primeiro pendente da fila. */
  nextHint?: { title: string; why: string };
}

const DAY = 86_400_000;

/** Presets de foco candidatos ao encaixe (o mesmo universo do menu de duração). */
const FIT_PRESETS = [10, 15, 20, 25, 30, 45, 50, 60] as const;

const round5 = (n: number): number => Math.round(n / 5) * 5;

function fmtMin(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Quantos minutos de foco+pausas cabem em `usable` com blocos de `f` minutos.
 * Devolve também quantos focos foram. Máximo de 10 focos (sessão real não é
 * maratona infinita — é o teto do cálculo, não da pessoa).
 */
function packWithFocus(
  f: number,
  usable: number,
  cfg: PomodoroConfig,
): { used: number; cycles: number } {
  let total = 0;
  let used = 0;
  let cycles = 0;
  for (let i = 1; i <= 10; i += 1) {
    if (total + f > usable) break;
    total += f;
    cycles = i;
    used = total;
    if (i === 10) break;
    const brk = i % cfg.cyclesBeforeLong === 0 ? cfg.longBreak : cfg.shortBreak;
    if (total + brk > usable) break; // sem casa para a pausa — o próximo foco não fecha
    total += brk;
  }
  return { used, cycles };
}

/** O foco ideal: o preset que aproveita mais minutos (empate = mais perto do config). */
function bestFocusFor(usable: number, cfg: PomodoroConfig): { focusMin: number; used: number; cycles: number } {
  const current = packWithFocus(cfg.focus, usable, cfg);
  let best = { focusMin: cfg.focus, used: current.used, cycles: current.cycles };
  let bestGain = 0;
  for (const preset of FIT_PRESETS) {
    if (preset === cfg.focus) continue;
    const p = packWithFocus(preset, usable, cfg);
    const gain = p.used - best.used;
    if (gain >= 10 || (best.used === 0 && p.used > 0 && gain > 0)) {
      if (gain > bestGain || best.used === 0) {
        best = { focusMin: preset, used: p.used, cycles: p.cycles };
        bestGain = gain;
      }
    }
  }
  return best;
}

/** Monta a frase do encaixe — a matemática contada em humano. */
function fitSuggestion(fit: Omit<PomodoroFit, 'suggestion' | 'needsSync'>): string {
  if (fit.single) {
    return fit.wrapMin > 0
      ? `Foco único de ${fit.focusMin}min + ${fit.wrapMin} de fecho — um bloco só fecha a sessão.`
      : `Foco único de ${fit.focusMin}min — um bloco só, e a sessão está feita.`;
  }
  const breaks =
    fit.breakTotal > 0
      ? ` + ${fit.breakTotal}min de pausas`
      : '';
  const total = `${fmtMin(fit.totalMin)}`;
  const loose =
    fit.leftover > 0 ? ` · sobram ${fit.leftover}min de folga` : ' — fecha a sessão em ponto';
  return `${fit.cycles} focos de ${fit.focusMin}min${breaks} + ${fit.wrapMin} de fecho = ${total}${loose}.`;
}

/**
 * O encaixe do pomodoro no orçamento restante. null = nada a encaixar.
 * • remaining < 20 → MODO MICRO: foco único do tamanho do que existe.
 * • resto → reserva o FECHO (5min) e procura o preset que aproveita mais.
 */
export function fitPomodoro(remainingMin: number, cfg: PomodoroConfig): PomodoroFit | null {
  if (remainingMin <= 0) return null;

  if (remainingMin < MICRO_THRESHOLD) {
    const focusMin = Math.max(3, Math.min(remainingMin, Math.floor(remainingMin / 5) * 5 || remainingMin));
    const fit = {
      focusMin,
      cycles: 1,
      focusTotal: focusMin,
      breakTotal: 0,
      wrapMin: 0,
      totalMin: focusMin,
      leftover: remainingMin - focusMin,
      single: true,
    };
    return {
      ...fit,
      needsSync: cfg.focus !== focusMin,
      suggestion: fitSuggestion(fit),
    };
  }

  const usable = remainingMin - WRAPUP_MIN;
  const best = bestFocusFor(usable, cfg);
  if (best.used <= 0) return null;

  const breakTotal = Math.max(0, best.used - best.cycles * best.focusMin);
  const wrapMin = WRAPUP_MIN;
  const leftover = Math.max(0, remainingMin - best.used - wrapMin);
  const single = best.cycles === 1;
  const fit = {
    focusMin: best.focusMin,
    cycles: best.cycles,
    focusTotal: best.cycles * best.focusMin,
    breakTotal,
    wrapMin,
    totalMin: best.used + wrapMin,
    leftover,
    single,
  };
  const needsSync = best.focusMin !== cfg.focus;
  return { ...fit, needsSync, suggestion: fitSuggestion(fit) };
}

// ---------- A sessão ----------

function completedToday(materialId: string, sp: StudyProgress, nowMs: number): boolean {
  const st = sp.materialProgress?.[materialId];
  if (!st?.completed || !st.lastAccessedAt) return false;
  const t = new Date(st.lastAccessedAt).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t < DAY && new Date(t).toDateString() === new Date(nowMs).toDateString();
}

/**
 * A SESSÃO SINTONIZADA completa: estado, blocos casados com o orçamento,
 * encaixe do pomodoro e o amanhã. Pura — o dashboard chama pós-mount (o mesmo
 * `agora` do retrato: SSR e 1º render dividem o neutro).
 */
export function buildSessionHarmony(
  sp: StudyProgress,
  now: Date,
  opts?: { pageOf?: (materialId: string) => number | null },
): SessionHarmony {
  const dateKey = todayDateKey(now);
  const nowMs = now.getTime();

  const plannedHours = sp.dailyHours?.[dateKey] ?? 0;
  const plannedMinutes = Math.round(plannedHours * 60);
  if (plannedMinutes <= 0) {
    return {
      state: 'sem-sessao',
      plannedMinutes: 0,
      focusToday: 0,
      remaining: 0,
      blocks: [],
      doneCount: 0,
      fit: null,
    };
  }

  // ----- o foco REAL de hoje (a mesma convenção do retrato: s.date vs chave local) -----
  const focusToday = (sp.pomodoroSessions ?? [])
    .filter((s) => s.date === dateKey)
    .reduce((acc, s) => acc + (s.focusMinutes || 0), 0);
  const remaining = Math.max(0, plannedMinutes - focusToday);

  // ----- os minutos de foco por material hoje (a conclusão pela prática) -----
  const minByMaterial = new Map<string, number>();
  for (const s of sp.pomodoroSessions ?? []) {
    if (s.date !== dateKey || !s.materialId) continue;
    minByMaterial.set(s.materialId, (minByMaterial.get(s.materialId) ?? 0) + (s.focusMinutes || 0));
  }

  const cardsDue = flashcardsDueFor(Array.isArray(sp.flashcards) ? sp.flashcards : [], nowMs).length;

  // ----- o estado -----
  const state: SessionState =
    remaining <= 0 ? 'cumprida' : focusToday === 0 ? (remaining < MICRO_THRESHOLD ? 'micro' : 'pronta') : 'em-andamento';

  // ----- a fila da casa (o Plano de hoje, a MESMA inteligência) -----
  const plan = buildDayPlan(sp, now, { pageOf: opts?.pageOf, maxBlocks: 8 });

  const toHarmony = (b: PlanBlock, patch?: Partial<HarmonyBlock>): HarmonyBlock => {
    const doneByFocus = (minByMaterial.get(b.materialId ?? '') ?? 0) > 0;
    const doneByCompletion = b.materialId ? completedToday(b.materialId, sp, nowMs) : false;
    let done = false;
    let doneWhy: string | undefined;
    if (b.kind === 'pratica') {
      done = cardsDue === 0;
      if (done) doneWhy = 'fila de cartões zerada hoje';
    } else if (doneByFocus) {
      done = true;
      doneWhy = `${minByMaterial.get(b.materialId ?? '')}min de foco neste material hoje`;
    } else if (doneByCompletion) {
      done = true;
      doneWhy = 'concluído hoje';
    }
    return {
      ...b,
      ...patch,
      done,
      doneWhy: done ? doneWhy : undefined,
    };
  };

  const blocks: HarmonyBlock[] = [];

  if (state === 'micro') {
    // MODO MICRO — um bloco único: a fila de cartões se venceu, senão o topo
    // do plano. O porquê confessa o modo (o streak fica guardado, sem culpa).
    const cardsFirst = cardsDue >= 3;
    const base = cardsFirst
      ? plan.blocks.find((b) => b.kind === 'pratica')
      : plan.blocks[0];
    if (base) {
      blocks.push(
        toHarmony(base, {
          minutes: Math.max(5, remaining),
          trimmed: base.minutes > remaining,
          why: `modo micro · ${base.why}`,
        }),
      );
    } else {
      blocks.push({
        id: 'fecho:micro',
        kind: 'fecho',
        title: 'Fecho relâmpago',
        why: 'registre o que travou e escolha o 1º passo de amanhã',
        minutes: Math.max(3, remaining),
        done: false,
      });
    }
  } else if (state !== 'cumprida') {
    // SESSÃO CHEIA — encaixa a fila no orçamento: cabem inteiros; o último
    // pode ser cortado (≥10min) se o corte valer; o FECHO fecha a conta.
    let used = 0;
    for (const b of plan.blocks) {
      const room = remaining - used - WRAPUP_MIN; // o fecho já tem casa reservada
      if (room <= 0) break;
      if (b.minutes <= room) {
        blocks.push(toHarmony(b));
        used += b.minutes;
      } else if (room >= 10) {
        blocks.push(toHarmony(b, { minutes: room, trimmed: true }));
        used += room;
        break;
      } else {
        break;
      }
    }
    const roomLeft = remaining - used;
    if (roomLeft >= WRAPUP_MIN) {
      blocks.push({
        id: 'fecho:sessao',
        kind: 'fecho',
        title: 'Fecho da sessão',
        why: 'erros → cartões · cheque as listas · escolha o 1º passo de amanhã',
        minutes: Math.min(10, roomLeft),
        done: false,
      });
    } else if (blocks.length === 0 && roomLeft > 0) {
      // plano vazio mas há tempo: o fecho assume a sessão inteira
      blocks.push({
        id: 'fecho:sessao',
        kind: 'fecho',
        title: 'Fecho da sessão',
        why: 'erros → cartões · cheque as listas · escolha o 1º passo de amanhã',
        minutes: roomLeft,
        done: false,
      });
    }
  } else {
    // CUMPRIDA — a lista mostra o dia com o estado de cada bloco (espelho).
    for (const b of plan.blocks) blocks.push(toHarmony(b));
  }

  // ----- o amanhã (estado cumprida): o primeiro pendente da fila da casa -----
  let nextHint: SessionHarmony['nextHint'];
  if (state === 'cumprida') {
    const pending = plan.blocks.find((b) => !toHarmony(b).done);
    if (pending) nextHint = { title: pending.title, why: pending.why };
  }

  return {
    state,
    plannedMinutes,
    focusToday,
    remaining,
    blocks,
    doneCount: blocks.filter((b) => b.done).length,
    fit: state === 'cumprida' ? null : fitPomodoro(remaining, sp.preferences?.pomodoroConfig ?? { focus: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLong: 4 }),
    nextHint,
  };
}

// ---------- A escrita da harmonia (as duas mãos que tocam o config) ----------
//
// Aqui a lib assume a interface do hook (sem React — só o contrato). É a
// exceção declarada no cabeçalho: a harmonia precisa escrever o config do
// pomodoro, e escreve com VOLTA — o original fica guardado em
// preferences.autoFit para o botão Restaurar devolver o que era.

type BudgetHook = {
  progress: StudyProgress;
  updatePreferences: (partial: Partial<Preferences>) => void;
};

/**
 * Alinha o pomodoro ao orçamento (o gesto de 1 toque / o automático do
 * check-in). Só escreve quando o encaixe GANHA ≥10min aproveitados — o
 * config do dono nunca é trocado por trocadinho. Guarda o original uma
 * única vez por dia (o primeiro sync do dia preserva o config de ontem).
 */
export function syncPomodoroToBudget(
  sp: BudgetHook,
  remainingMinutes: number,
  dateKey: string,
): PomodoroFit | null {
  const cfg = sp.progress.preferences.pomodoroConfig;
  const fit = fitPomodoro(remainingMinutes, cfg);
  if (!fit || !fit.needsSync) return fit;
  // O 1º sync do dia preserva o config de ontem; os seguintes preservam o mesmo original.
  const existing = sp.progress.preferences.autoFit;
  const saved = existing && existing.dateKey === dateKey ? existing.saved : cfg;
  sp.updatePreferences({
    pomodoroConfig: { ...cfg, focus: fit.focusMin },
    autoFit: { dateKey, saved },
  });
  return fit;
}

/** Devolve o config original do dia (o botão Restaurar). true se restaurou. */
export function restorePomodoroConfig(sp: BudgetHook, dateKey: string): boolean {
  const auto = sp.progress.preferences.autoFit;
  if (!auto || auto.dateKey !== dateKey) return false;
  sp.updatePreferences({
    pomodoroConfig: { ...auto.saved },
    autoFit: undefined,
  });
  return true;
}
