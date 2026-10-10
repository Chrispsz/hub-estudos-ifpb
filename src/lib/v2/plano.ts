// PLANO DO DIA — o algoritmo cirúrgico da Edição Definitiva (Fase 6).
//
// Resposta direta às dores do dono:
//   · "o que eu estudo hoje?" → o app DECIDE (implementation intention pronta,
//     P8 da pesquisa: planos se→então dobram/triplicam a adesão)
//   · "foco no que o professor está dando agora" → boost ×1.8 na marca
//     "conteúdo da semana" (planner.focusAgeOf)
//   · "estou com 1 mês+ de atraso sem culpa" → começo mínimo (P6/P7: tiny
//     habits; consistência frouxa > sequência perfeita)
//   · "pausas que não cortem raciocínio" → pomodoros SUGERIDOS por item; a
//     pausa só nasce quando o aluno aceita (finish-the-thought, P14)
//
// Puro como o planner: entra com arrays do núcleo, sai com o plano + o PORQUÊ
// de cada linha. Nada de Dexie aqui.

import type { FocusMarks, PlannerCtx, Suggestion } from './planner';
import { flashcardsDue, focusAgeOf, pickFundacao, pickRevisao, pickRitmo, recoveryStatus } from './planner';

export type PlanBlockKind = 'estudo-pesado' | 'estudo-revisao' | 'flashcards';

export interface PlanItem {
  key: string;
  kind: 'ritmo' | 'fundacao' | 'revisao' | 'flashcards';
  title: string;
  why: string;
  estMin: number;
  /** nº de ciclos de foco de 25min sugeridos (1–3 — dose humana, não heroica) */
  pomodoros: number;
  /** PDFs do professor ligados ao tópico (a fusão com a casa antiga) */
  materialIds: string[];
  /** em qual tipo de bloco da rotina este item roda */
  blockKind: PlanBlockKind;
  /** o COMEÇO MÍNIMO do dia — o primeiro clique do hábito (P6 da pesquisa) */
  startHere?: boolean;
  /** a sugestão original do planner — o board do Hoje recebe isto inteiro */
  sug: Suggestion;
}

export interface DayPlan {
  dateKey: string;
  lightDay: boolean;
  /** 1–2 frases gentis e honestas sobre o dia (o "olá" do plano) */
  narrative: string;
  items: PlanItem[];
  totalMin: number;
  dueUnits: number;
  dueCards: number;
}

/** Ciclos de foco por item: dose de 15–75min, nunca "o dia inteiro". */
export function pomodorosFor(estMin: number): number {
  return Math.max(1, Math.min(3, Math.ceil(estMin / 25)));
}

/** Tópicos → materiais PDF do professor (via linkedMaterials das unidades). */
function materialsForTopic(ctx: PlannerCtx, topicId: string | undefined): string[] {
  if (!topicId) return [];
  const out = new Set<string>();
  for (const u of ctx.units) {
    if (u.topicId !== topicId) continue;
    for (const m of u.linkedMaterials) out.add(m);
  }
  return [...out].slice(0, 2);
}

/**
 * O elo cirúrgico: marcar o MATERIAL na prateleira (1 toque) também impulsiona
 * os TÓPICOS cujas unidades vêm dele — o aluno pensa "o professor passou este
 * PDF" e o plano entende qual assunto da cadeia é esse.
 */
function mergeMaterialFocus(ctx: PlannerCtx, focus: FocusMarks): FocusMarks {
  const topics = { ...(focus.topics ?? {}) };
  for (const [mid, key] of Object.entries(focus.materials ?? {})) {
    if (focusAgeOf(key, ctx.dateKey) === null) continue;
    for (const u of ctx.units) {
      if (u.linkedMaterials.includes(mid) && u.topicId && !topics[u.topicId]) {
        topics[u.topicId] = key;
      }
    }
  }
  return { topics, materials: focus.materials };
}

function itemFromSug(sug: Suggestion, blockKind: PlanBlockKind, ctx: PlannerCtx): PlanItem {
  return {
    key: sug.key,
    kind: sug.kind as PlanItem['kind'],
    title: sug.title,
    why: sug.why,
    estMin: sug.estMin,
    pomodoros: pomodorosFor(sug.estMin),
    materialIds: materialsForTopic(ctx, sug.topicId),
    blockKind,
    sug,
  };
}

/**
 * O PLANO DE HOJE — 2 a 4 itens, um porquê por linha, dose por pomodoro.
 * Começo mínimo: o item `startHere` é sempre o de menor fricção do dia
 * (fila pequena de revisão vence — vitória rápida em ~3min por unidade).
 */
export function buildDayPlan(
  ctx: PlannerCtx,
  focusRaw: FocusMarks,
  opts?: { lightDay?: boolean },
): DayPlan {
  const lightDay = !!opts?.lightDay;
  const focus = mergeMaterialFocus(ctx, focusRaw);
  const dueUnits = ctx.units.filter((u) => u.fsrs && u.fsrs.due <= ctx.now && u.topicId).length;
  const dueCards = flashcardsDue(ctx).length;
  const rec = recoveryStatus(ctx);
  const exam = ctx.exams
    .filter((e) => e.status === 'awaiting')
    .map((e) => ({ e, days: Math.round((new Date(`${e.date}T12:00:00`).getTime() - ctx.now) / 86_400_000) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  // ---- DIA LEVE: uma coisa só, e o dia já conta (o piso do hábito) ----
  if (lightDay) {
    const ritmo = pickRitmo(ctx, 1, focus);
    const first = ritmo[0] ?? null;
    const items: PlanItem[] = first
      ? [{ ...itemFromSug({ ...first, estMin: 15 }, 'estudo-pesado', ctx), pomodoros: 1 }]
      : [];
    return {
      dateKey: ctx.dateKey,
      lightDay,
      narrative:
        'Dia leve: uma coisa só, 15 minutos, e o dia já conta como estudo. ' +
        'Constância vence intensidade — é assim que o hábito se constrói.',
      items,
      totalMin: 15,
      dueUnits,
      dueCards,
    };
  }

  // ---- DIA NORMAL: Ritmo (conteúdo da semana) + Fundação (próximo degrau) + fila ----
  const ritmo = pickRitmo(ctx, 2, focus);
  const fundacao = pickFundacao(ctx, 1);
  const items: PlanItem[] = [];

  for (const r of ritmo) items.push(itemFromSug(r, 'estudo-pesado', ctx));
  if (fundacao[0] && !items.some((i) => i.sug.topicId === fundacao[0].topicId)) {
    items.push(itemFromSug(fundacao[0], 'estudo-pesado', ctx));
  }
  if (dueUnits > 0) {
    const fila = pickRevisao(ctx, 10);
    items.push(itemFromSug(fila, 'estudo-revisao', ctx));
  }

  // começo mínimo: fila pequena = vitória rápida (~3min/unidade); senão o Ritmo #1
  if (items.length > 0) {
    const quickWin = dueUnits > 0 && dueUnits <= 8 ? items.find((i) => i.kind === 'revisao') : undefined;
    const start = quickWin ?? items[0];
    start.startHere = true;
  }

  const totalMin = items.reduce((acc, i) => acc + i.estMin, 0);

  // narrativa honesta e gentil (passa no teste "alivia e clareia")
  const parts: string[] = [];
  if (exam && exam.days <= 21) {
    parts.push(
      exam.days === 0
        ? `${exam.e.name} é HOJE — o plano encolhe para o que prova isso`
        : `${exam.e.name} em ${exam.days}d — o plano já está apontando para ela`,
    );
  } else if (rec.active) {
    parts.push(
      `recuperação em andamento: ${rec.ritmoDebt} matéria(s) esperando um toque, fundação ${rec.fundacaoProgress}% estável — um bloco por vez`,
    );
  } else {
    parts.push('plano equilibrado: conteúdo atual + o próximo degrau');
  }
  if (dueUnits > 8) {
    parts.push(`a fila de revisão está com ${dueUnits} — dose pequena hoje, ela encolhe dia após dia`);
  }

  return {
    dateKey: ctx.dateKey,
    lightDay,
    narrative: `${parts.join('. ')}. Tudo com porquê na linha de baixo.`,
    items,
    totalMin,
    dueUnits,
    dueCards,
  };
}
