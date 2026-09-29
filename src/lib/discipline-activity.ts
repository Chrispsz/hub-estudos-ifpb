/**
 * discipline-activity.ts — A ATIVIDADE REAL DE CADA DISCIPLINA (fonte única).
 *
 * O dono foi direto (28/09): "não tô entendendo em que momento marco esses
 * tópicos ou como o site acompanha meu progresso… eu geralmente só abro os
 * materiais e tiro dúvidas com a tutor e resolvo… muita coisa fica como
 * atrasado na minha página pois nenhum progresso eu registro".
 *
 * O diagnóstico: o Hub media progresso SÓ pelos checkboxes manuais de tópicos
 * (topicProgress) — e o fluxo real do aluno (abrir material, perguntar ao
 * tutor, resolver exercício) não alimentava NADA. Resultado: 0/29, barra 0%
 * e o selo "atrasada" em toda avaliação — ruído que o aluno aprendeu a
 * ignorar.
 *
 * Este módulo inverte a fonte: o progresso é derivado do que o aluno JÁ FAZ
 * (lições 85/86 — recibo derivado do registro, zero storage novo):
 *  - materiais abertos (materialProgress.lastAccessedAt / completedMaterials)
 *  - exercícios tentados/resolvidos (exerciseProgress.lastPracticedAt)
 *  - tópicos marcados manualmente continuam valendo (quem marca, quer dizer).
 *
 * A régua é MATERIAL-FIRST como a casa manda (curriculum-state): uma unidade
 * "dada em aula" é a que tem material real com topicosCobertos. O percentual
 * de acompanhamento responde UMA pergunta honesta: "do que foi dado em aula,
 * quanto você já tocou?" — conteúdo que ainda não foi dado NÃO pune ninguém.
 */

import { disciplines, materials } from '@/data/course-data';
import { exercises } from './exercise-extractor';
import type { StudyProgress } from './study-progress';

// ---------- Tipos ----------

export interface UnitActivity {
  /** Nome da unidade (igual ao conteudoProgramatico). */
  unit: string;
  /** Materiais reais que cobrem a unidade (0 = ainda não dada em aula). */
  materiaisTotal: number;
  materiaisVistos: number;
  materiaisConcluidos: number;
  /** Exercícios do acervo da unidade — só os "em sala" (material-first). */
  questoesTotal: number;
  questoesTentadas: number;
  /** Última atividade real desta unidade (material aberto ou questão tentada). */
  lastActivityAt: string | null;
  /** Evidência real: ≥1 material visto, questão tentada ou tópicos todos marcados. */
  tocada: boolean;
}

export interface DisciplineActivity {
  code: string;
  units: UnitActivity[];
  /** Unidades com material real (= dadas em aula, fonte curriculum-state). */
  unitsGiven: number;
  /** Unidades dadas que o aluno já tocou. */
  unitsTouched: number;
  /**
   * % do conteúdo DADO que o aluno acompanhou (0–100).
   * null = nenhuma unidade com material registrado — sem régua, sem julgamento.
   */
  pctAcompanha: number | null;
  materiaisVistos: number;
  questoesTentadas: number;
  /** Última atividade real (material aberto ou questão tentada), ISO ou null. */
  lastActivityAt: string | null;
  /** Atividade nos últimos 7 dias. */
  emEstudo: boolean;
  /** Primeira unidade dada ainda não tocada — o ponteiro didático do "por onde". */
  proximaUnidade: string | null;
}

// ---------- Helpers ----------

const ATIVIDADE_RECENTE_MS = 7 * 24 * 60 * 60 * 1000;

function isSeen(
  materialId: string,
  progress: StudyProgress,
): boolean {
  const mp = progress.materialProgress?.[materialId];
  return (
    !!mp?.lastAccessedAt ||
    mp?.completed === true ||
    (progress.completedMaterials ?? []).includes(materialId)
  );
}

function isConcluded(materialId: string, progress: StudyProgress): boolean {
  return (
    progress.materialProgress?.[materialId]?.completed === true ||
    (progress.completedMaterials ?? []).includes(materialId)
  );
}

function latestIso(a: string | undefined, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

// ---------- Cálculo ----------

/** Atividade real de uma unidade (por nome exato do conteudoProgramatico). */
export function unitActivityFor(
  code: string,
  unit: string,
  progress: StudyProgress,
  manualTopicsDone: number,
  manualTopicsTotal: number,
): UnitActivity {
  const mats = materials.filter(
    (m) => m.disciplineCode === code && (m.topicosCobertos ?? []).includes(unit),
  );
  const vistos = mats.filter((m) => {
    if (!isSeen(m.id, progress)) return false;
    return true;
  }).length;
  const concluidos = mats.filter((m) => isConcluded(m.id, progress)).length;

  const emSala = exercises.filter(
    (e) => e.disciplineCode === code && e.unit === unit,
  );
  const tentadas = emSala.filter((e) => {
    const ep = progress.exerciseProgress?.[e.id];
    return !!ep && (ep.tried || ep.solved);
  }).length;

  let lastActivityAt: string | null = null;
  for (const m of mats) {
    if (isSeen(m.id, progress)) {
      lastActivityAt = latestIso(progress.materialProgress?.[m.id]?.lastAccessedAt, lastActivityAt);
    }
  }
  for (const e of emSala) {
    const ep = progress.exerciseProgress?.[e.id];
    if (ep && (ep.tried || ep.solved)) {
      lastActivityAt = latestIso(ep.lastPracticedAt, lastActivityAt);
    }
  }

  const tocada =
    vistos > 0 ||
    tentadas > 0 ||
    (manualTopicsTotal > 0 && manualTopicsDone >= manualTopicsTotal);

  return {
    unit,
    materiaisTotal: mats.length,
    materiaisVistos: vistos,
    materiaisConcluidos: concluidos,
    questoesTotal: emSala.length,
    questoesTentadas: tentadas,
    lastActivityAt,
    tocada,
  };
}

/** Atividade real de uma disciplina inteira (null se o código não existe). */
export function disciplineActivityFor(
  code: string,
  progress: StudyProgress,
): DisciplineActivity | null {
  const disc = disciplines.find((d) => d.code === code);
  if (!disc) return null;

  let lastActivityAt: string | null = null;

  const units: UnitActivity[] = disc.conteudoProgramatico.map((u) => {
    const mats = materials.filter(
      (m) => m.disciplineCode === code && (m.topicosCobertos ?? []).includes(u.unidade),
    );
    const vistos = mats.filter((m) => {
      if (!isSeen(m.id, progress)) return false;
      lastActivityAt = latestIso(progress.materialProgress?.[m.id]?.lastAccessedAt, lastActivityAt);
      return true;
    }).length;
    const concluidos = mats.filter((m) => isConcluded(m.id, progress)).length;

    const emSala = exercises.filter(
      (e) => e.disciplineCode === code && e.unit === u.unidade,
    );
    const tentadas = emSala.filter((e) => {
      const ep = progress.exerciseProgress?.[e.id];
      if (!ep || (!ep.tried && !ep.solved)) return false;
      lastActivityAt = latestIso(ep.lastPracticedAt, lastActivityAt);
      return true;
    }).length;

    const manualDone = u.topicos.filter((t) => progress.topicProgress?.[code]?.[t]).length;
    const tocada =
      vistos > 0 ||
      tentadas > 0 ||
      (u.topicos.length > 0 && manualDone >= u.topicos.length);

    // Última atividade SÓ desta unidade (a global já está no closure).
    let unitLast: string | null = null;
    for (const m of mats) {
      if (isSeen(m.id, progress)) {
        unitLast = latestIso(progress.materialProgress?.[m.id]?.lastAccessedAt, unitLast);
      }
    }
    for (const e of emSala) {
      const ep = progress.exerciseProgress?.[e.id];
      if (ep && (ep.tried || ep.solved)) {
        unitLast = latestIso(ep.lastPracticedAt, unitLast);
      }
    }

    return {
      unit: u.unidade,
      materiaisTotal: mats.length,
      materiaisVistos: vistos,
      materiaisConcluidos: concluidos,
      questoesTotal: emSala.length,
      questoesTentadas: tentadas,
      lastActivityAt: unitLast,
      tocada,
    };
  });

  const dadas = units.filter((u) => u.materiaisTotal > 0);
  const tocadas = dadas.filter((u) => u.tocada);
  const pctAcompanha =
    dadas.length === 0 ? null : Math.round((tocadas.length / dadas.length) * 100);

  const materiaisVistos = units.reduce((a, u) => a + u.materiaisVistos, 0);
  const questoesTentadas = units.reduce((a, u) => a + u.questoesTentadas, 0);

  const emEstudo =
    !!lastActivityAt &&
    Date.now() - new Date(lastActivityAt).getTime() <= ATIVIDADE_RECENTE_MS;

  const proximaUnidade =
    dadas.find((u) => !u.tocada)?.unit ?? null;

  return {
    code,
    units,
    unitsGiven: dadas.length,
    unitsTouched: tocadas.length,
    pctAcompanha,
    materiaisVistos,
    questoesTentadas,
    lastActivityAt,
    emEstudo,
    proximaUnidade,
  };
}

// ---------- Apresentação ----------

export type ActivityBadgeTone = 'dia' | 'estudo' | 'registro';

/** Selo honesto da disciplina: em dia (acompanha) / em estudo (tem atividade) / sem registro. */
export function activityBadgeFor(a: DisciplineActivity): {
  tone: ActivityBadgeTone;
  label: string;
  title: string;
} {
  if (a.pctAcompanha === null) {
    return {
      tone: 'registro',
      label: 'sem registro',
      title: 'Nenhum material desta disciplina foi aberto ainda — abra um material e o Hub registra sozinho.',
    };
  }
  if (a.pctAcompanha >= 100) {
    return {
      tone: 'dia',
      label: 'em dia',
      title: `Você já tocou todo o conteúdo dado em aula (${a.unitsTouched}/${a.unitsGiven} unidades).`,
    };
  }
  if (a.unitsTouched > 0) {
    return {
      tone: 'estudo',
      label: 'em estudo',
      title: `${a.unitsTouched}/${a.unitsGiven} unidades dadas em aula já têm atividade sua — continue que o Hub registra sozinho.`,
    };
  }
  return {
    tone: 'registro',
    label: 'sem registro',
    title: 'O conteúdo dado em aula ainda não tem registro seu — abra um material da disciplina.',
  };
}

/** "hoje" · "ontem" · "há Nd" · "dd/mm" — a voz da casa para atividade recente. */
export function lastActivityLabel(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias}d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}
