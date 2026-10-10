// study-plan.ts — O CRONOGRAMA QUE SE MONTA SOZINHO (frente 13, pedido do
// dono 12/10/2026: "priorizar os documentos mais recentes que estão sendo
// vistos em aula mas também revisar os antigos com prática e técnica de
// memorização de dias pra sempre ter o que estudar").
//
// A fila do dia nasce do que o uso diário já registra — nada é lançado à mão:
//   1. CONTINUAR — o material recente que ainda não virou conhecimento;
//   2. REVISÃO — o ciclo espaçado 1·3·7·14·30 semeado ao concluir (o antigo
//      volta ao dia quando a memória dele começa a desbotar);
//   3. PRÁTICA — cartões vencidos (recall ativo, o teste que fixa);
//   4. ATRASADO — material da disciplina que você anda seguindo, sem concluir;
//   5. PRÓXIMO — o acervo na ordem da aula, para a fila nunca ficar vazia.
// A checklist de cada PDF pesa no PORQUÊ ("faltam 3 de 5 no checklist") —
// o cronograma e as caixinhas são o mesmo sistema, não duas prateleiras.
//
// Lib PURA (lição do today-focus.ts): sem React, sem localStorage — recebe
// StudyProgress + now e devolve blocos honestos com o porquê de cada um.
// A página de retomada REAL chega injetada (opts.pageOf — mesma doutrina da
// frente 9: a lib não lê storage, o chamador entrega o valor pronto).

import { disciplines, materials, type Material } from '@/data/course-data';
import {
  flashcardsDueFor,
  MATERIAL_REVIEW_DAYS,
  type StudyProgress,
} from './study-progress';

export type PlanKind = 'continuar' | 'revisao' | 'pratica' | 'atrasado' | 'proximo';

export interface PlanBlock {
  /** Estável por construção — o dashboard usa como key e data-t de teste. */
  id: string;
  kind: PlanKind;
  materialId?: string;
  disciplineCode?: string;
  title: string;
  /** O porquê em uma linha — o plano decide, mas explica. */
  why: string;
  /** Estimativa honesta de tempo (minutos). */
  minutes: number;
}

export interface DayPlan {
  blocks: PlanBlock[];
  totalMinutes: number;
}

const DAY = 86_400_000;

/** Tipos de acervo que NÃO viram fila de estudo (consulta, não conteúdo). */
function isQueueMaterial(m: Material): boolean {
  return m.type !== 'web_page' && m.type !== 'calendar' && m.type !== 'ementa';
}

function daysAgo(iso: string, nowMs: number): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return -1;
  return Math.floor((nowMs - t) / DAY);
}

export function buildDayPlan(
  sp: StudyProgress,
  now: Date,
  opts?: { pageOf?: (materialId: string) => number | null; maxBlocks?: number },
): DayPlan {
  const maxBlocks = opts?.maxBlocks ?? 6;
  const nowMs = now.getTime();
  const completed = new Set(sp.completedMaterials ?? []);
  const matOf = (id: string): Material | null =>
    materials.find((m) => m.id === id) ?? null;

  const blocks: PlanBlock[] = [];
  const usedIds = new Set<string>();
  const usedMaterials = new Set<string>();

  const push = (b: Omit<PlanBlock, 'id'>) => {
    if (blocks.length >= maxBlocks) return false;
    const id = `${b.kind}:${b.materialId ?? 'geral'}`;
    if (usedIds.has(id)) return false;
    if (b.materialId && usedMaterials.has(b.materialId)) return false;
    usedIds.add(id);
    if (b.materialId) usedMaterials.add(b.materialId);
    blocks.push({ ...b, id });
    return true;
  };

  const focusMin = Math.max(15, sp.preferences?.pomodoroConfig?.focus ?? 25);

  // ----- a checklist de cada PDF pesa no porquê (a fila e as caixinhas são
  // o MESMO sistema: o cronograma lê o que falta e diz) -----
  const checklistWhy = (id: string): string | null => {
    const items = sp.materialChecklists?.[id]?.items ?? [];
    if (items.length === 0) return null;
    const remaining = items.filter((it) => !it.done).length;
    if (remaining === 0)
      return `checklist completo (${items.length}/${items.length}) — vale marcar como concluído`;
    return `faltam ${remaining} de ${items.length} no checklist`;
  };

  // 1) CONTINUAR — o mais recente que ainda não virou conhecimento. O momentum
  //    mora no retomar: 1 clique devolve ao ponto exato (página e foco).
  {
    const last = (sp.recentMaterials ?? []).find((r) => {
      const m = matOf(r.id);
      return m && isQueueMaterial(m) && !completed.has(r.id);
    });
    if (last) {
      const m = matOf(last.id)!;
      const page = opts?.pageOf ? opts.pageOf(last.id) : null;
      const opened = last.accessedAt ? daysAgo(last.accessedAt, nowMs) : -1;
      const whys: string[] = [];
      if (page && page > 1) whys.push(`parou na pág. ${page}`);
      else if (opened >= 0)
        whys.push(
          opened === 0
            ? 'aberto hoje, sem terminar'
            : `aberto há ${opened === 1 ? '1 dia' : `${opened} dias`}, sem terminar`,
        );
      const ck = checklistWhy(last.id);
      if (ck) whys.push(ck);
      push({
        kind: 'continuar',
        materialId: last.id,
        disciplineCode: m.disciplineCode,
        title: m.title,
        why: whys.join(' · ') || 'onde o estudo parou',
        minutes: focusMin,
      });
    }
  }

  // 2) REVISÕES ESPAÇADAS VENCIDAS — o antigo não apodrece: o ciclo o traz de
  //    volta. Material CONCLUÍDO revisa de propósito (o marcador de concluído
  //    não isenta da revisão — é ela que mantém o conteúdo vivo).
  {
    const due = Object.entries(sp.materialReviews ?? {})
      .filter(([id, st]) => {
        const m = matOf(id);
        if (!m || !isQueueMaterial(m)) return false;
        const t = new Date(st.dueAt).getTime();
        return !Number.isNaN(t) && t <= nowMs;
      })
      .sort((a, b) => new Date(a[1].dueAt).getTime() - new Date(b[1].dueAt).getTime());
    for (const [id, st] of due) {
      if (blocks.length >= maxBlocks) break;
      const m = matOf(id)!;
      const interval = MATERIAL_REVIEW_DAYS[Math.min(st.stage, MATERIAL_REVIEW_DAYS.length - 1)];
      const overdue = Math.floor((nowMs - new Date(st.dueAt).getTime()) / DAY);
      push({
        kind: 'revisao',
        materialId: id,
        disciplineCode: m.disciplineCode,
        title: m.title,
        why:
          overdue > 0
            ? `revisão espaçada vencida há ${overdue === 1 ? '1 dia' : `${overdue} dias`} — a volta de ${interval}d que fixa`
            : `revisão espaçada do dia — a volta de ${interval}d que fixa`,
        minutes: 15,
      });
    }
  }

  // 3) PRÁTICA — recall ativo dos cartões vencidos (o mesmo princípio da
  //    recomendação única: dez minutos de teste valem mais que uma hora lendo).
  {
    const dueCards = flashcardsDueFor(
      Array.isArray(sp.flashcards) ? sp.flashcards : [],
      nowMs,
    ).length;
    if (dueCards > 0) {
      push({
        kind: 'pratica',
        title:
          dueCards === 1 ? 'Revisar 1 cartão vencido' : `Revisar ${dueCards} cartões vencidos`,
        why: 'recall ativo — testar de cabeça fixa mais que reler',
        minutes: 10,
      });
    }
  }

  // 4) ATRASADOS — material da disciplina que você anda seguindo (recentes +
  //    foco dos últimos 14 dias), ainda sem concluir, na ordem da aula.
  {
    const discOrder: string[] = [];
    for (const r of sp.recentMaterials ?? []) {
      const m = matOf(r.id);
      if (m && !discOrder.includes(m.disciplineCode)) discOrder.push(m.disciplineCode);
    }
    for (const s of sp.pomodoroSessions ?? []) {
      if (!s.date || !s.disciplineId || discOrder.includes(s.disciplineId)) continue;
      const d = new Date(`${s.date}T00:00:00`).getTime();
      if (!Number.isNaN(d) && nowMs - d <= 14 * DAY) discOrder.push(s.disciplineId);
    }

    let added = 0;
    for (const code of discOrder) {
      if (added >= 2 || blocks.length >= maxBlocks) break;
      for (const m of materials) {
        if (added >= 2 || blocks.length >= maxBlocks) break;
        if (m.disciplineCode !== code) continue;
        if (!isQueueMaterial(m) || completed.has(m.id)) continue;
        const ck = checklistWhy(m.id);
        // O retorno de push É o contrato: material que já entrou no plano
        // (continuar/revisão) não consome slot de atrasado — o mesmo PDF
        // nunca aparece duas vezes com etiquetas diferentes.
        const ok = push({
          kind: 'atrasado',
          materialId: m.id,
          disciplineCode: m.disciplineCode,
          title: m.title,
          why: ck ?? 'ainda sem concluir — o conteúdo que ficou para trás',
          minutes: focusMin,
        });
        if (ok) added += 1;
      }
    }
  }

  // 5) PRÓXIMOS — o acervo na ordem da aula completa a fila: "sempre ter o
  //    que estudar" sem que o plano invente conteúdo que a aula não deu.
  {
    let added = 0;
    for (const m of materials) {
      if (added >= 2 || blocks.length >= maxBlocks) break;
      if (!isQueueMaterial(m) || completed.has(m.id)) continue;
      const short =
        disciplines.find((d) => d.code === m.disciplineCode)?.shortName ?? m.disciplineCode;
      const ok = push({
        kind: 'proximo',
        materialId: m.id,
        disciplineCode: m.disciplineCode,
        title: m.title,
        why: `próximo da fila de ${short} — o acervo na ordem da aula`,
        minutes: focusMin,
      });
      if (ok) added += 1;
    }
  }

  return {
    blocks,
    totalMinutes: blocks.reduce((acc, b) => acc + b.minutes, 0),
  };
}

/** Rótulo curto do tipo de bloco (o dashboard desenha a mini-etiqueta). */
export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  continuar: 'Continuar',
  revisao: 'Revisão',
  pratica: 'Prática',
  atrasado: 'Atrasado',
  proximo: 'Próximo',
};
