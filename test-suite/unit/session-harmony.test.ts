// session-harmony.test.ts — A SESSÃO SINTONIZADA: o check-in de horas vira um
// plano único (fila + Pomodoro em harmonia). Estados: sem-sessao, micro,
// pronta, em-andamento, cumprida.

import { describe, test, expect } from 'bun:test';
import {
  fitPomodoro,
  buildSessionHarmony,
  suggestBudgetFromHistory,
  BUDGET_PRESETS,
  MICRO_THRESHOLD,
  WRAPUP_MIN,
} from '@/lib/session-harmony';
import { mergeWithDefaults, type StudyProgress, type PomodoroConfig } from '@/lib/study-progress';

const CFG: PomodoroConfig = { focus: 45, shortBreak: 10, longBreak: 20, cyclesBeforeLong: 3 };

function spFor(over: Partial<StudyProgress>): StudyProgress {
  return mergeWithDefaults(over);
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// O encaixe do Pomodoro no tempo que sobrou
// ---------------------------------------------------------------------------
describe('session-harmony · fitPomodoro', () => {
  test('sessão de 120min cabe: ciclos ≥1, total ≤ orçamento', () => {
    const fit = fitPomodoro(120, CFG);
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.cycles).toBeGreaterThanOrEqual(1);
    expect(fit.totalMin).toBeLessThanOrEqual(120);
    expect(fit.focusMin).toBeGreaterThan(0);
  });

  test('orçamento zero/negativo não tem encaixe (null)', () => {
    expect(fitPomodoro(0, CFG)).toBeNull();
    expect(fitPomodoro(-10, CFG)).toBeNull();
  });

  test('tempo micro (<20min) vira foco único encurtado, com wrap zerado', () => {
    const fit = fitPomodoro(15, CFG);
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.single).toBe(true);
    expect(fit.totalMin).toBeLessThanOrEqual(15);
    expect(fit.focusMin).toBeGreaterThanOrEqual(3);
  });

  test('encaixe respeita o fecho (wrap-up) quando sobra espaço', () => {
    const fit = fitPomodoro(120, CFG);
    if (!fit) return;
    if (fit.totalMin + fit.leftover >= WRAPUP_MIN) {
      // o fecho está embutido no total, não somado por fora
      expect(fit.totalMin).toBeLessThanOrEqual(120);
    }
  });

  test('needsSync só acende quando o foco sugerido difere do configurado', () => {
    const fit = fitPomodoro(120, CFG);
    if (!fit) return;
    expect(fit.needsSync).toBe(fit.focusMin !== CFG.focus);
  });
});

// ---------------------------------------------------------------------------
// A sessão do dia: estados pela vida real
// ---------------------------------------------------------------------------
describe('session-harmony · buildSessionHarmony (estados do dia)', () => {
  const now = new Date();
  const key = todayKey(now);

  test('sem check-in de horas: sem-sessao (a casa não inventa plano)', () => {
    const h = buildSessionHarmony(spFor({}), now);
    expect(h.state).toBe('sem-sessao');
    expect(h.plannedMinutes).toBe(0);
    expect(h.blocks).toEqual([]);
  });

  test('check-in 2h sem foco ainda: pronta, remaining = orçamento cheio', () => {
    const h = buildSessionHarmony(spFor({ dailyHours: { [key]: 2 } }), now);
    expect(h.state).toBe('pronta');
    expect(h.plannedMinutes).toBe(120);
    expect(h.remaining).toBe(120);
    expect(h.fit).not.toBeNull();
  });

  test('45min feitos de 2h: em-andamento com 75min restantes', () => {
    const h = buildSessionHarmony(
      spFor({
        dailyHours: { [key]: 2 },
        pomodoroSessions: [
          { date: key, startedAt: new Date(now.getTime() - 3_600_000).toISOString(), completedAt: now.toISOString(), disciplineId: 'TEC.1687', focusMinutes: 45, mode: 'estudo' },
        ],
      }),
      now,
    );
    expect(h.state).toBe('em-andamento');
    expect(h.focusToday).toBe(45);
    expect(h.remaining).toBe(75);
  });

  test('orçamento cumprido: cumprida com remaining 0', () => {
    const h = buildSessionHarmony(
      spFor({
        dailyHours: { [key]: 1 },
        pomodoroSessions: [
          { date: key, startedAt: new Date(now.getTime() - 3_600_000).toISOString(), completedAt: now.toISOString(), disciplineId: 'TEC.1687', focusMinutes: 60, mode: 'estudo' },
        ],
      }),
      now,
    );
    expect(h.state).toBe('cumprida');
    expect(h.remaining).toBe(0);
  });

  test('check-in minúsculo (<20min) sem foco ainda: estado micro (sessão curta honesta)', () => {
    const h = buildSessionHarmony(
      spFor({ dailyHours: { [key]: 0.2 } }),
      now,
    );
    expect(h.remaining).toBeLessThan(MICRO_THRESHOLD);
    expect(h.state).toBe('micro');
  });

  test('fecho confesso: pendingErrors nasce do caderno, não de chute', () => {
    const h = buildSessionHarmony(spFor({ dailyHours: { [key]: 2 } }), now);
    expect(h.fecho).toBeDefined();
    expect(typeof h.fecho.pendingErrors).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// O orçamento que aprende (sugestão do check-in)
// ---------------------------------------------------------------------------
describe('session-harmony · suggestBudgetFromHistory', () => {
  test('sem histórico: null (sugestão inventada é ruído)', () => {
    expect(suggestBudgetFromHistory(undefined, new Date())).toBeNull();
    expect(suggestBudgetFromHistory({}, new Date())).toBeNull();
  });

  test('com dias logados: sugere hora do universo dos chips', () => {
    const now = new Date();
    const dh: Record<string, number> = {};
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getTime() - i * 86_400_000);
      dh[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = i % 2 ? 2 : 3;
    }
    const s = suggestBudgetFromHistory(dh, now);
    expect(s).not.toBeNull();
    if (!s) return;
    expect(BUDGET_PRESETS as readonly number[]).toContain(s.hours);
    expect(s.why.length).toBeGreaterThan(5);
    expect(s.daysCounted).toBe(6);
  });

  test('véspera de prova reforça o orçamento (+30min, teto 4h)', () => {
    const now = new Date();
    const dh: Record<string, number> = {};
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getTime() - i * 86_400_000);
      dh[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = 1;
    }
    const base = suggestBudgetFromHistory(dh, now);
    const reforco = suggestBudgetFromHistory(dh, now, { examDaysLeft: 2 });
    expect(base).not.toBeNull();
    expect(reforco).not.toBeNull();
    if (base && reforco) {
      expect(reforco.hours).toBeGreaterThanOrEqual(base.hours);
      expect(reforco.hours).toBeLessThanOrEqual(4);
    }
  });

  test('BUDGET_PRESETS é o universo dos chips do check-in', () => {
    expect([...BUDGET_PRESETS]).toEqual([1, 1.5, 2, 2.5, 3, 4]);
  });
});
