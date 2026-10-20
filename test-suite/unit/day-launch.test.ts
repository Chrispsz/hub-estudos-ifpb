// day-launch.test.ts — O DIA PRONTO: o clique que inicia tudo organizado.
// Fila ordenada, conclusão pelo uso, Pomodoro sincronizado com o que resta.

import { describe, test, expect } from 'bun:test';
import {
  launchStepsFromSchedule,
  launchStepsFromSession,
  buildDayLaunchPlan,
} from '@/lib/day-launch';
import type { SmartBlock } from '@/lib/smart-schedule';
import type { HarmonyBlock } from '@/lib/session-harmony';

function blockOf(partial: Partial<SmartBlock>): SmartBlock {
  return {
    id: partial.id ?? 'b',
    day: partial.day ?? 1,
    startHour: partial.startHour ?? 8,
    startMinute: partial.startMinute ?? 0,
    durationMin: partial.durationMin ?? 50,
    disciplineCode: partial.disciplineCode ?? 'TEC.1687',
    title: partial.title ?? 'Algoritmos — estudo',
    activity: partial.activity ?? 'estudo',
    source: partial.source ?? 'auto',
    ...partial,
  } as SmartBlock;
}

describe('day-launch · fila do cronograma (launchStepsFromSchedule)', () => {
  test('lista vazia → fila vazia (nada inventado)', () => {
    expect(launchStepsFromSchedule([], [])).toEqual([]);
  });

  test('passos nascem ordenados pela hora (independente da ordem de entrada)', () => {
    const blocks = [
      blockOf({ id: 'tarde', startHour: 14 }),
      blockOf({ id: 'manha', startHour: 8, disciplineCode: 'TEC.1984', title: 'Matemática — estudo' }),
      blockOf({ id: 'noite', startHour: 19, disciplineCode: 'TEC.2000', title: 'Programação — exercícios', activity: 'exercicios' }),
    ];
    const steps = launchStepsFromSchedule(blocks, []);
    expect(steps.map((s) => s.id)).toEqual(['manha', 'tarde', 'noite']);
    expect(steps.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  test('bloco ✓ marcado como feito checa done pelo id', () => {
    const blocks = [blockOf({ id: 'x1' }), blockOf({ id: 'x2' })];
    const steps = launchStepsFromSchedule(blocks, ['x1']);
    expect(steps.find((s) => s.id === 'x1')?.done).toBe(true);
    expect(steps.find((s) => s.id === 'x2')?.done).toBe(false);
  });

  test('atividade muda a porta de entrada (exercícios → prática)', () => {
    const steps = launchStepsFromSchedule(
      [blockOf({ id: 'e1', activity: 'exercicios' }), blockOf({ id: 'r1', activity: 'revisao' })],
      [],
    );
    const porId = new Map(steps.map((s) => [s.id, s]));
    expect(porId.get('e1')?.open).toBe('pratica');
    expect(porId.get('r1')?.open).toBe('flashcards');
  });

  test('cada passo tem minutos e método declarados', () => {
    const steps = launchStepsFromSchedule([blockOf({ durationMin: 50 })], []);
    expect(steps[0].minutes).toBe(50);
    expect(steps[0].method).toBeDefined();
    expect(steps[0].method.name.length).toBeGreaterThan(0);
    expect(steps[0].method.steps.length).toBeGreaterThan(0);
  });
});

describe('day-launch · fila da sessão sintonizada (launchStepsFromSession)', () => {
  function harmonyOf(partial: Partial<HarmonyBlock>): HarmonyBlock {
    return {
      id: partial.id ?? 'h',
      kind: partial.kind ?? 'continuar',
      title: partial.title ?? 'Bloco',
      why: partial.why ?? 'porque faz parte do plano',
      minutes: partial.minutes ?? 45,
      done: partial.done ?? false,
      ...partial,
    } as HarmonyBlock;
  }

  test('filtra o bloco de fecho (fecho é ritual, não passo de fila)', () => {
    const steps = launchStepsFromSession([
      harmonyOf({ id: 'a', kind: 'continuar' }),
      harmonyOf({ id: 'f', kind: 'fecho' }),
      harmonyOf({ id: 'b', kind: 'pratica' }),
    ]);
    expect(steps.map((s) => s.id)).toEqual(['a', 'b']);
  });

  test('erro vai para prática (o Ciclo doErro resolve na resolução)', () => {
    const steps = launchStepsFromSession([harmonyOf({ id: 'e', kind: 'erro' })]);
    expect(steps[0].open).toBe('pratica');
  });

  test('conclusão pelo uso: done do bloco de harmonia preservado', () => {
    const steps = launchStepsFromSession([harmonyOf({ id: 'a', done: true }), harmonyOf({ id: 'b', done: false })]);
    expect(steps.find((s) => s.id === 'a')?.done).toBe(true);
    expect(steps.find((s) => s.id === 'b')?.done).toBe(false);
  });
});

describe('day-launch · plano do dia (buildDayLaunchPlan)', () => {
  const CFG = { focus: 45, shortBreak: 10, longBreak: 20, cyclesBeforeLong: 3 };

  test('conta pendentes, feitos e minutos restantes', () => {
    const blocks = [
      blockOf({ id: 'a' }),
      blockOf({ id: 'b', startHour: 9 }),
    ];
    const steps = launchStepsFromSchedule(blocks, ['a']);
    const plan = buildDayLaunchPlan(steps, CFG);
    expect(plan.doneCount).toBe(1);
    expect(plan.pendingCount).toBe(1);
    expect(plan.totalPendingMinutes).toBe(50);
    expect(plan.firstPendingIndex).toBe(1);
  });

  test('linha de prontidão fala humano: "N blocos · ~tempo"', () => {
    const steps = launchStepsFromSchedule([blockOf({ id: 'a' }), blockOf({ id: 'b', startHour: 9 })], []);
    const plan = buildDayLaunchPlan(steps, CFG);
    expect(plan.readiness).toContain('2 blocos');
    expect(plan.readiness).toContain('1h40');
  });

  test('dia todo feito: zero pendentes e sem encaixe (fit null)', () => {
    const steps = launchStepsFromSchedule([blockOf({ id: 'a' })], ['a']);
    const plan = buildDayLaunchPlan(steps, CFG);
    expect(plan.pendingCount).toBe(0);
    expect(plan.fit).toBeNull();
    expect(plan.totalPendingMinutes).toBe(0);
  });

  test('com pendentes, o fit do Pomodoro existe e cabe no tempo restante', () => {
    const steps = launchStepsFromSchedule([blockOf({ id: 'a' }), blockOf({ id: 'b', startHour: 9 })], []);
    const plan = buildDayLaunchPlan(steps, CFG);
    expect(plan.fit).not.toBeNull();
    if (plan.fit) {
      expect(plan.fit.totalMin).toBeLessThanOrEqual(100);
    }
  });
});
