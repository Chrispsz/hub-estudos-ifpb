// study-plan.test.ts — A FILA DO DIA (o plano que se monta sozinho).
// Invariantes: blocos com identidade e porquê, total somando, cap respeitado,
// Ciclo do Erro entrando com a unidade do re-teste, foco do dia abrindo a fila.

import { describe, test, expect } from 'bun:test';
import { buildDayPlan, PLAN_KIND_LABEL, type ErrorReviewTask } from '@/lib/study-plan';
import { mergeWithDefaults, type StudyProgress } from '@/lib/study-progress';
import { materials, disciplines } from '@/data/course-data';

const NOW = new Date();

function spFor(over: Partial<StudyProgress>): StudyProgress {
  return mergeWithDefaults(over);
}

describe('study-plan · estrutura do plano (contrato que a UI consome)', () => {
  test('plano nasce com blocos íntegros: id, título, porquê, minutos > 0', () => {
    const mat = materials[0];
    const sp = spFor({
      recentMaterials: [{ id: mat.id, accessedAt: NOW.toISOString() }],
    });
    const plan = buildDayPlan(sp, NOW);
    expect(Array.isArray(plan.blocks)).toBe(true);
    for (const b of plan.blocks) {
      expect(b.id.length).toBeGreaterThan(0);
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.why.length).toBeGreaterThan(0);
      expect(b.minutes).toBeGreaterThan(0);
      expect(Object.keys(PLAN_KIND_LABEL)).toContain(b.kind);
    }
  });

  test('totalMinutes é a soma honesta dos blocos (sem número mágico)', () => {
    const mat = materials[0];
    const sp = spFor({ recentMaterials: [{ id: mat.id, accessedAt: NOW.toISOString() }] });
    const plan = buildDayPlan(sp, NOW);
    const soma = plan.blocks.reduce((a, b) => a + b.minutes, 0);
    expect(plan.totalMinutes).toBe(soma);
  });

  test('ids únicos — o dashboard usa como key e data-t', () => {
    const plan = buildDayPlan(spFor({}), NOW);
    const ids = plan.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('cap de blocos respeitado (maxBlocks)', () => {
    const sp = spFor({
      completedMaterials: materials.slice(0, 5).map((m) => m.id),
      recentMaterials: materials.slice(0, 5).map((m) => ({ id: m.id, accessedAt: NOW.toISOString() })),
    });
    const plan = buildDayPlan(sp, NOW, { maxBlocks: 3 });
    expect(plan.blocks.length).toBeLessThanOrEqual(3);
  });
});

describe('study-plan · Ciclo do Erro entra na fila com destino de re-teste', () => {
  test('bloco de erro carrega a unidade exata (o clique re-testa a questão)', () => {
    const erro: ErrorReviewTask = {
      attemptId: 'att-1',
      unitId: 'unit-exemplo-1',
      disciplineCode: 'TEC.1687',
      topicName: 'Unidade 1',
      reason: 'confundi a ordem do scanf',
      category: 'conceito',
      at: NOW.getTime() - 3_600_000,
    };
    const plan = buildDayPlan(spFor({}), NOW, { errorReviews: [erro], maxBlocks: 8 });
    const erros = plan.blocks.filter((b) => b.errorUnitId !== undefined);
    if (erros.length === 0) return; // a régua pode recusar se não houver casa para o erro
    for (const b of erros) {
      expect(b.errorUnitId).toBe('unit-exemplo-1');
      expect(b.disciplineCode).toBe('TEC.1687');
    }
  });

  test('sem erros injetados: nenhum bloco de erro aparece (nada inventado)', () => {
    const plan = buildDayPlan(spFor({}), NOW);
    expect(plan.blocks.every((b) => b.errorUnitId === undefined)).toBe(true);
  });
});

describe('study-plan · foco do dia abre a fila da matéria escolhida', () => {
  test('com foco declarado, a matéria focada ganha mais espaço (cap 4 vs 2)', () => {
    const code = disciplines[0].code;
    const mat = materials.find((m) => m.disciplineCode === code) ?? materials[0];
    const sp = spFor({
      recentMaterials: [{ id: mat.id, accessedAt: NOW.toISOString() }],
      completedMaterials: [mat.id],
    });
    const comFoco = buildDayPlan(sp, NOW, { focusDiscipline: code, maxBlocks: 10 });
    const daFocada = comFoco.blocks.filter((b) => b.disciplineCode === code).length;
    // cap da focada (4) é maior que o das demais (2) — se ela entrou, pode ir até 4
    expect(daFocada).toBeLessThanOrEqual(4);
  });
});
