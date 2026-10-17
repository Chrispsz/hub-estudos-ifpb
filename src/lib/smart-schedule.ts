// smart-schedule.ts v2.1 — Cronograma inteligente ROTATIVO
// Reescrita completa: distribuição rotativa proporcional à CH (deficit scheduling).
// Garante que NENHUMA disciplina aparece todos os dias e que a CH de cada uma
// é respeitada no agregado da semana.
//
// v2.1 (Task 219 — "algoritmo inteligente, não plano de recuperação"):
//   · TIPO de avaliação manda: prova = pico (revisão/prática dirigida),
//     trabalho = maratona (blocos de projeto sustentados), atividade = meio.
//   · DÍVIDA DE PRÁTICA (perfilPratica do curso) pesa na fila e ganha bloco
//     próprio "Prática constante" — sem hard-code de matéria.
//   · TRIAGEM (study-triage.ts): disciplinas "em espera" têm peso reduzido
//     (×0.25) em vez de sumir — deixar para trás é decisão visível e reversível.
// v2.2 (Mensagem 7 do dono — "por que tanta prioridade para RHT?"):
//   · PESOS DO PERFIL valem aqui também: priorityMultiplierOf (alta 1.35 /
//     media 0.95 / baixa 0.75) + strategyMultiplierOf (escada 1.15, acúmulo
//     1.1, fluência 0.9) — a MESMA régua da triagem, 1 motor só.
//   · BLOCO INTENSIVO DIÁRIO só para PROVA ≤7d: atividade/trabalho ganham o
//     bloco garantido só na véspera real (≤3d) — antes disso competem pelos
//     pesos como todo mundo (a atividade de sala não ocupa o dia, D-5).
//   · customEvaluations do dono entram na mesma régua (op North da casa).
// v2.3 (Mensagem 8 do dono — "não só carga horária mas na grade e importância
//     no curso em si"): curriculumMultiplierOf (núcleo 1.15 / estruturante
//     1.05 / complementar 0.95 / transversal 0.85) entra nos pesos — o PPC do
//     ADS reforça a hierarquia que a CH desenha.

import {
  disciplines,
  getDisciplineByCode,
  classWindowForDay,
  type Discipline,
} from '@/data/course-data';
import type { CustomEvaluation, StudyPreferences, TopicProgress } from './study-progress';
import { windowsOf } from './study-progress';
// Fonte única do calendário — funções reexportadas p/ compatibilidade com os views.
import { currentWeekOfSemester, daysUntilDate } from './semester';
export { daysUntilDate };
import {
  computeTriage,
  curriculumMultiplierOf,
  evalsFor,
  practiceDebtDays,
  priorityMultiplierOf,
  strategyMultiplierOf,
  urgencyFactor,
  type DiscEval,
  type Triage,
} from './study-triage';

export { currentWeekOfSemester };

export const BLOCK_MINUTES = 50; // 1 bloco = 50min foco + 10min pausa
export const BREAK_MINUTES = 10;

export interface SmartBlock {
  id: string;
  day: number; // 0=Dom..6=Sáb
  startHour: number;
  startMinute: number;
  durationMin: number;
  disciplineCode: string;
  title: string;
  activity: 'estudo' | 'revisao' | 'projeto' | 'exercicios';
  isReview?: boolean;   // bloco de revisão geral (sábado)
  intensive?: boolean;  // priorizado por avaliação próxima
  fixed?: boolean;      // fixado manualmente pelo usuário ("Seg = Matemática")
  stale?: boolean;      // incluído por estar esquecido (≥5 dias sem estudo)
  rescheduled?: boolean;
  source: 'auto' | 'recommended';
}

export interface ScheduleDisciplineState {
  studiedMinutes: number;
  lastStudiedAt?: string; // ISO
}

export interface SmartScheduleInput {
  preferences: StudyPreferences;
  topicProgress: TopicProgress;
  disciplineProgress?: { [code: string]: ScheduleDisciplineState };
  /** Avaliações customizadas do dono (radar/calculadora) — entram na régua. */
  customEvaluations?: CustomEvaluation[];
  /**
   * O estudo REAL da semana corrente por disciplina (foco do Pomodoro,
   * weekStudiedMinutesByDiscipline) — descontado das metas: quem já estudou
   * via sessões livres recebe menos blocos planejados (a semana absorve o
   * real, sem repetição — Mensagem 9/10 do dono).
   */
  weekStudiedMinutes?: { [code: string]: number };
  now?: Date;
}

const STALE_DAYS = 5; // disciplina sem estudo há ≥5 dias entra no próximo dia

// ---------- Pesos ----------

/** CH total do curso — constante do módulo (evita reduce em cada chamada de chShare). */
const TOTAL_CH = disciplines.reduce((acc, d) => acc + d.chTotal, 0);

/** Fração da CH total — base da distribuição proporcional. */
function chShare(d: Discipline): number {
  return d.chTotal / (TOTAL_CH || 1);
}

/**
 * Blocos INTENSIVOS DIÁRIOS por avaliação — com dose (Mensagem 7 do dono):
 * prova é PICO (diário a partir de D-7); atividade/trabalho são meio-termo e
 * maratona — o bloco garantido é só na VÉSPERA real (≤3d); antes disso eles
 * disputam vagas pelos pesos como todas as demais.
 */
function shouldIntensify(kind: DiscEval['kind'], daysLeft: number | undefined): boolean {
  if (daysLeft === undefined) return false;
  if (kind === 'prova') return daysLeft <= 7;
  return daysLeft <= 3;
}

function pendingTopics(code: string, topicProgress: TopicProgress): number {
  const disc = getDisciplineByCode(code);
  if (!disc) return 0;
  const all = disc.conteudoProgramatico.flatMap((u) => u.topicos);
  const done = topicProgress[code] ?? {};
  return all.filter((t) => !done[t]).length;
}

function isStale(code: string, state: ScheduleDisciplineState | undefined, now: Date): boolean {
  if (!state?.lastStudiedAt) {
    // Nunca estudou: só considera "esquecido" depois da 1ª semana do semestre
    return currentWeekOfSemester(now) > 1;
  }
  const last = new Date(state.lastStudiedAt).getTime();
  const days = (now.getTime() - last) / (24 * 60 * 60 * 1000);
  return days >= STALE_DAYS;
}

interface DiscWeight {
  code: string;
  weight: number;         // peso normalizado (soma = 1)
  evalBoostDays?: number; // dias restantes p/ avaliação mais próxima
  evalKind?: DiscEval['kind']; // prova | trabalho | atividade (muda o TIPO de bloco)
  debtDays?: number;      // dívida de prática (muda o título/tipo do bloco)
}

/**
 * Pesos de distribuição (v2.1): CH × prioridade × pendência × URGÊNCIA POR TIPO
 * × DÍVIDA DE PRÁTICA, com balde da triagem amortizando "em espera" (×0.25).
 * A fonte de verdade de tipo/dívida/prazos é study-triage.ts (1 motor só).
 * rotationMode:
 *  - 'proportional' → CH + prioridade (recomendado)
 *  - 'fixed'        → rotação igualitária (mesma fatia para todas)
 *  - 'random'       → proporcional com aleatoriedade (varia a cada geração)
 */
function computeWeights(
  mode: StudyPreferences['rotationMode'],
  topicProgress: TopicProgress,
  disciplineProgress: { [code: string]: ScheduleDisciplineState },
  customEvaluations: CustomEvaluation[] | undefined,
  triage: Triage,
  now: Date,
): Map<string, DiscWeight> {
  const result = new Map<string, DiscWeight>();
  const raw = new Map<string, number>();
  const bucketOf = new Map<string, Triage['foco'][number]['bucket']>();
  for (const list of [triage.foco, triage.manter, triage.espera]) {
    for (const e of list) bucketOf.set(e.code, e.bucket);
  }

  for (const d of disciplines) {
    const pend = pendingTopics(d.code, topicProgress);
    if (pend === 0) {
      result.set(d.code, { code: d.code, weight: 0 });
      continue;
    }
    let w: number;
    if (mode === 'fixed') {
      w = 1; // igualitário
    } else {
      // CH × papel na grade (PPC do ADS) × prioridade do perfil × estratégia
      // de conteúdo (a MESMA régua da triagem: página do curso + desenho da
      // grade + perfil do dono + escada/acúmulo/fluência).
      w = chShare(d) * curriculumMultiplierOf(d) * priorityMultiplierOf(d) * strategyMultiplierOf(d);
      // Tópicos pendentes pesam um pouco (mais pendente → leve reforço)
      w *= 1 + Math.min(0.3, pend * 0.02);
    }

    // URGÊNCIA POR TIPO (v2.1): a avaliação mais pressionante da disciplina
    // (oficial datada/em aberto + customização do dono) decide o fator.
    const evals = evalsFor(d.code, customEvaluations, now);
    const pressing = evals
      .slice()
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))[0];
    w *= urgencyFactor(pressing);

    // DÍVIDA DE PRÁTICA (v2.1): perfil do CURSO × último toque do aluno.
    const debt = practiceDebtDays(d, disciplineProgress[d.code]?.lastStudiedAt, now);
    if (d.perfilPratica !== 'teoria') w *= 1 + Math.min(0.5, debt * 0.08);

    const entry: DiscWeight = {
      code: d.code,
      weight: w,
      ...(pressing?.daysLeft !== undefined ? { evalBoostDays: pressing.daysLeft } : {}),
      ...(pressing ? { evalKind: pressing.kind } : {}),
      ...(debt > 0 ? { debtDays: debt } : {}),
    };
    // TRIAGEM: em espera não some — respira (×0.25) até o radar trazê-la de volta.
    if (bucketOf.get(d.code) === 'espera') entry.weight *= 0.25;
    raw.set(d.code, entry.weight);
    result.set(d.code, entry);
  }

  // Normaliza (soma = 1) preservando os metadados
  const sum = Array.from(raw.values()).reduce((a, b) => a + b, 0) || 1;
  for (const [code, dw] of result) {
    if (dw.weight === 0) continue;
    result.set(code, { ...dw, weight: dw.weight / sum });
  }
  return result;
}

// ---------- Geração ----------

/**
 * Gera o cronograma semanal rotativo v2.0.
 *
 * Regras (em ordem de precedência por dia):
 *  1. Disciplina FIXADA pelo usuário (`fixedDisciplines[day]`) → 1º bloco
 *  2. Sábado → bloco de "Revisão geral da semana" (se habilitado)
 *  3. Avaliação ≤7 dias → blocos intensivos dessa disciplina
 *  4. Disciplina esquecida (≥5 dias sem estudo) → incluída no próximo dia
 *  5. Demais vagas → deficit scheduling rotativo proporcional à CH
 *
 * Limites: maxBlocksPerDay (default 4), maxMinutesPerDay (default 180).
 * NUNCA aloca a mesma disciplina para todos os blocos do dia (máx. metade dos blocos).
 */
export function generateSmartSchedule(input: SmartScheduleInput): SmartBlock[] {
  const { preferences, topicProgress } = input;
  const disciplineProgress = input.disciplineProgress ?? {};
  const now = input.now ?? new Date();
  const mode = preferences.rotationMode ?? 'proportional';
  // MOTOR v2.1: a triagem é calculada UMA vez e manda nos pesos, nos blocos
  // urgentes e na prática constante — 1 fonte de verdade para toda a casa.
  const triage = computeTriage({
    topicProgress,
    disciplineProgress,
    customEvaluations: input.customEvaluations,
    now,
  });
  const weights = computeWeights(mode, topicProgress, disciplineProgress, input.customEvaluations, triage, now);

  // Capacidade planejada da semana (para calcular metas proporcionais).
  // RITMO SEMANAL (Mensagem 10 do dono): o dia vira JANELAS por turno
  // (manhã 08:00 · tarde 14:00 · noite 19:00) — cada janela cabe
  // ⌊duração/60⌋ blocos de 50+10. As janelas são vontade explícita do dono
  // (ritmo aplicado em 1 toque), então maxBlocksPerDay/maxMinutesPerDay não
  // as engarrafam; no modo legado (sem `windows`) os tetos continuam valendo.
  const weekStudiedMinutes = input.weekStudiedMinutes;
  const dayCapacity = new Map<
    number,
    {
      blocks: number;
      minutes: number;
      windows: { startMin: number; durationMin: number; budget: number; placed: number }[];
    }
  >();
  let plannedTotal = 0;
  for (let day = 0; day <= 6; day++) {
    const pref = preferences.days[day];
    const wins = windowsOf(pref);
    if (wins.length === 0) continue;
    // A GRADE OFICIAL MANDA (Task 217): dia com aula (P1 = seg–sex 07:00–11:25)
    // empurra o início de cada janela para depois do fim da última aula.
    const classWindow = classWindowForDay(day);
    const windows = wins.map((w) => {
      let startMin = w.startHour * 60;
      if (classWindow) startMin = Math.max(startMin, classWindow.endMin + 15);
      const budget = Math.max(1, Math.floor(w.durationMin / (BLOCK_MINUTES + BREAK_MINUTES)));
      return { startMin, durationMin: w.durationMin, budget, placed: 0 };
    });
    const blocks = windows.reduce((acc, w) => acc + w.budget, 0);
    const minutes = windows.reduce((acc, w) => acc + w.durationMin, 0);
    dayCapacity.set(day, { blocks, minutes, windows });
    plannedTotal += Math.min(minutes, blocks * (BLOCK_MINUTES + BREAK_MINUTES));
  }
  if (plannedTotal === 0) return [];

  // Metas proporcionais (minutos alvo por disciplina na semana)
  const targetMin = new Map<string, number>();
  const allocatedMin = new Map<string, number>();
  for (const [code, dw] of weights) {
    targetMin.set(code, dw.weight * plannedTotal);
    allocatedMin.set(code, 0);
  }

  // Aleatoriedade (modo 'random'): jitter fixo por disciplina nesta geração
  const jitter = new Map<string, number>();
  if (mode === 'random') {
    for (const code of weights.keys()) jitter.set(code, Math.random() * 0.5 - 0.25);
  }

  // Disciplinas esquecidas na ordem do semestre (garantia de inclusão)
  const staleCodes = disciplines
    .filter((d) => isStale(d.code, disciplineProgress[d.code], now) && (weights.get(d.code)?.weight ?? 0) > 0)
    .map((d) => d.code);

  // Avaliações com BLOCO GARANTIDO (com dose — shouldIntensify): prova ≤7d é
  // diária; atividade/trabalho só na véspera real (≤3d). O TIPO decide o bloco:
  // prova/atividade = prática dirigida (antes de D-4) ou revisão (D-3);
  // trabalho = avanço de projeto (maratona, não véspera).
  const urgentEvalCodes = Array.from(weights.values())
    .filter(
      (dw) =>
        dw.evalBoostDays !== undefined &&
        shouldIntensify(dw.evalKind ?? 'prova', dw.evalBoostDays),
    )
    .map((dw) => dw);

  // Prática constante (v2.1): dívida ≥ cadência → bloco garantido para as
  // disciplinas de FOCO (capacidade já comprometida com elas).
  // Teoria/fluência FORA (Mensagem 7 do dono: RHT é trabalhada em aula,
  // discursiva — o toque em casa é leve, vive na fila e no FSRS, não em
  // bloco diário que engarrafa a semana).
  // v2.3 — DOSE SEMANAL DA DÍVIDA: a cadência É a meta ("1 prática a cada
  // Nd"), então a garantia não pode valer mais que a própria cadência —
  // teto de ⌈7/cadência⌉ blocos na semana por disciplina. Sem isso, a dívida
  // profunda de quem nunca estudou (2× cadência) engarrafa a semana: Alg+LM
  // tomavam 10 dos 17 blocos e Matemática (16% CH, perfil alta) ficava com 1.
  const debtCodes = triage.foco
    .filter((e) => e.debtDays >= e.cadence && e.perfilPratica !== 'teoria')
    .map((e) => ({
      code: e.code,
      debt: e.debtDays,
      short: e.shortName,
      weeklyCap: Math.max(1, Math.ceil(7 / e.cadence)),
    }));
  const debtCount = new Map<string, number>();

  const blocks: SmartBlock[] = [];
  const staleQueue = [...staleCodes];

  for (const [day, cap] of dayCapacity) {
    const todayCodes = new Set<string>();
    // Blocos por disciplina HOJE (exclui a revisão geral) — mantido incrementalmente
    // pelo push; substitui o re-filtro de `blocks` a cada vaga do deficit scheduling.
    const todayCount = new Map<string, number>();
    // RITMO SEMANAL: os slots vêm das JANELAS do dia — quando uma enche, o
    // cursor salta para a próxima (tarde 14:00, noite 19:00…). O bloqueio da
    // grade oficial já foi aplicado no início de cada janela (capacidade).
    const dayWindows = cap.windows;
    let winIdx = 0;
    let cursorHour = 0;
    let cursorMinute = 0;
    const syncCursor = (): boolean => {
      while (winIdx < dayWindows.length) {
        const w = dayWindows[winIdx];
        if (w.placed < w.budget) {
          const startMin = w.startMin + w.placed * (BLOCK_MINUTES + BREAK_MINUTES);
          cursorHour = Math.floor(startMin / 60);
          cursorMinute = startMin % 60;
          return true;
        }
        winIdx += 1;
      }
      return false;
    };
    if (!syncCursor()) continue; // dia sem slot livre (não deveria ocorrer)
    let usedMinutes = 0;
    let usedBlocks = 0;
    const maxRepeat = Math.max(1, Math.ceil(cap.blocks / 2)); // nunca domina o dia

    function push(
      code: string,
      title: string,
      activity: SmartBlock['activity'],
      opts: Partial<Pick<SmartBlock, 'isReview' | 'intensive' | 'fixed' | 'stale'>> = {},
    ): boolean {
      if (usedBlocks >= cap.blocks) return false;
      if (usedMinutes + BLOCK_MINUTES > cap.minutes) return false;
      if (!syncCursor()) return false;
      const win = dayWindows[winIdx];
      blocks.push({
        id: `auto-${day}-${code}-${usedBlocks}-${title.slice(0, 12)}`,
        day,
        startHour: cursorHour,
        startMinute: cursorMinute,
        durationMin: BLOCK_MINUTES,
        disciplineCode: code,
        title,
        activity,
        source: 'auto',
        ...opts,
      });
      todayCodes.add(code);
      if (code !== 'revisao') {
        todayCount.set(code, (todayCount.get(code) ?? 0) + 1);
      }
      usedMinutes += BLOCK_MINUTES + BREAK_MINUTES;
      win.placed += 1;
      usedBlocks += 1;
      allocatedMin.set(code, (allocatedMin.get(code) ?? 0) + BLOCK_MINUTES);
      return true;
    }

    // 1. Fixada pelo usuário
    const fixedCode = preferences.fixedDisciplines?.[day];
    if (fixedCode && (weights.get(fixedCode)?.weight ?? 0) > 0) {
      const d = getDisciplineByCode(fixedCode);
      push(fixedCode, `${d?.shortName ?? fixedCode} — Estudo fixado por você`, 'estudo', { fixed: true });
    }

    // 2. Sábado: revisão geral
    if (day === 6) {
      push(
        'revisao',
        'Revisão geral da semana',
        'revisao',
        { isReview: true },
      );
    }

    // 3. Urgentes com dose (prova ≤7d diário; atividade/trabalho só ≤3d)
    //    — 1 bloco intensivo garantido por dia para quem se qualifica
    for (const dw of urgentEvalCodes) {
      if (usedBlocks >= cap.blocks) break;
      const daysLeft = dw.evalBoostDays;
      const code = dw.code;
      const d = getDisciplineByCode(code);
      if (d && !todayCodes.has(code)) {
        const kind = dw.evalKind ?? 'prova';
        // TIPO MANDA: prova/atividade viram revisão na reta final; antes disso
        // é PRÁTICA dirigida (a prova pode puxar da lista — dado do curso).
        const finalStraight = daysLeft !== undefined && daysLeft <= 3;
        const activity: SmartBlock['activity'] =
          kind === 'trabalho' ? 'projeto' : finalStraight ? 'revisao' : 'exercicios';
        const what =
          kind === 'trabalho'
            ? `Trabalho em ${daysLeft}d — avançar projeto`
            : finalStraight
              ? `Revisão intensiva (avaliação em ${daysLeft}d)`
              : `Prática dirigida (avaliação em ${daysLeft}d)`;
        push(code, `${d.shortName} — ${what}`, activity, { intensive: true });
      }
    }

    // 3.5 Prática constante (v2.1 + v2.3): dívida ≥ cadência no foco — bloco
    // garantido DENTRO da dose semanal (a dívida cobra na cadência da
    // disciplina, não todos os dias; o resto do dia volta ao deficit scheduler).
    for (const dc of debtCodes) {
      if (usedBlocks >= cap.blocks) break;
      if (todayCodes.has(dc.code)) continue;
      if (!getDisciplineByCode(dc.code)) continue;
      if ((debtCount.get(dc.code) ?? 0) >= dc.weeklyCap) continue;
      push(
        dc.code,
        `${dc.short} — Prática constante (dívida ${dc.debt}d)`,
        'exercicios',
        { intensive: true },
      );
      debtCount.set(dc.code, (debtCount.get(dc.code) ?? 0) + 1);
    }

    // 4. Esquecidas (≥5 dias) — 1 por dia até esgotar a fila
    while (staleQueue.length > 0 && usedBlocks < cap.blocks) {
      const code = staleQueue.shift()!;
      if (todayCodes.has(code)) continue;
      const d = getDisciplineByCode(code);
      if (!d) continue;
      push(code, `${d.shortName} — Retomada (estudo atrasado)`, 'estudo', { stale: true });
      break; // no máximo 1 retomada por dia
    }

    // 5. Preenche o resto com deficit scheduling rotativo
    let guard = 0;
    while (usedBlocks < cap.blocks && guard < 20) {
      guard++;
      let best: string | null = null;
      let bestDeficit = -Infinity;
      for (const [code, dw] of weights) {
        if (dw.weight <= 0 || code === 'revisao') continue;
        const countToday = todayCount.get(code) ?? 0;
        if (countToday >= maxRepeat) continue; // anti-domínio: não vira "a mesma todos os dias"
        const behind =
          (targetMin.get(code) ?? 0) -
          (allocatedMin.get(code) ?? 0) -
          (weekStudiedMinutes?.[code] ?? 0) + // O REAL DESCONTA: foco já estudado na semana libera vaga
          (jitter.get(code) ?? 0) * plannedTotal;
        if (behind > bestDeficit) {
          bestDeficit = behind;
          best = code;
        }
      }
      if (!best) break;
      if (process.env.DEBUG_SCHED) {
        console.error(
          `[sched day=${day}] escolheu ${best} (deficit ${bestDeficit.toFixed(1)}) — behind: ` +
            [...weights.entries()]
              .filter(([c, dw]) => dw.weight > 0)
              .map(([c, dw]) => `${c}:${((targetMin.get(c) ?? 0) - (allocatedMin.get(c) ?? 0)).toFixed(0)}min`)
              .join(' '),
        );
      }
      const d = getDisciplineByCode(best);
      const remaining = todayCount.get(best) ?? 0;
      const title =
        remaining === 0
          ? `${d?.shortName ?? best} — Estudo de novos tópicos`
          : `${d?.shortName ?? best} — Exercícios/prática`;
      push(best, title, remaining === 0 ? 'estudo' : 'exercicios');
    }
  }

  return blocks;
}

// ---------- O ESTUDO REAL DA SEMANA (Mensagem 9/10 do dono) ----------

/**
 * Foco REAL registrado (Pomodoro) na semana corrente (dom–sáb LOCAL) por
 * disciplina. O deficit scheduler o desconta das metas semanais: quem já
 * estudou 2h de Algoritmos fora dos blocos recebe menos blocos planejados —
 * a semana absorve o que foi estudado de verdade, sem repetição.
 */
export function weekStudiedMinutesByDiscipline(
  sessions: { completedAt: string; disciplineId: string; focusMinutes: number }[],
  now: Date,
): { [code: string]: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
  const end = start + 7 * 86_400_000;
  const out: { [code: string]: number } = {};
  for (const s of sessions) {
    const t = new Date(s.completedAt).getTime();
    if (Number.isNaN(t) || t < start || t >= end) continue;
    out[s.disciplineId] = (out[s.disciplineId] ?? 0) + (s.focusMinutes || 0);
  }
  return out;
}

// ---------- Utilitários (compat) ----------

export function findReschedulableBlocks(
  blocksDone: string[],
  previousBlocks: SmartBlock[],
): SmartBlock[] {
  const done = new Set(blocksDone); // Set evita includes() O(n) dentro do filtro
  return previousBlocks.filter((b) => !done.has(b.id));
}

export function getDaySummary(
  blocks: SmartBlock[],
  day: number,
  blocksDone: string[],
): { total: number; done: number; minutes: number; minutesDone: number; pending: SmartBlock[] } {
  const dayBlocks = blocks.filter((b) => b.day === day);
  const doneSet = new Set(blocksDone); // Set evita includes() O(n) repetido
  const doneBlocks = dayBlocks.filter((b) => doneSet.has(b.id));
  const minutes = dayBlocks.reduce((acc, b) => acc + b.durationMin, 0);
  const minutesDone = doneBlocks.reduce((acc, b) => acc + b.durationMin, 0);
  return {
    total: dayBlocks.length,
    done: doneBlocks.length,
    minutes,
    minutesDone,
    pending: dayBlocks.filter((b) => !doneSet.has(b.id)),
  };
}

export const DAYS_OF_WEEK = [
  { num: 0, label: 'Dom' },
  { num: 1, label: 'Seg' },
  { num: 2, label: 'Ter' },
  { num: 3, label: 'Qua' },
  { num: 4, label: 'Qui' },
  { num: 5, label: 'Sex' },
  { num: 6, label: 'Sáb' },
];

export function formatTime(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function blockKey(b: { day: number; startHour: number; startMinute: number }): string {
  return `${b.day}-${b.startHour.toString().padStart(2, '0')}:${b.startMinute.toString().padStart(2, '0')}`;
}
