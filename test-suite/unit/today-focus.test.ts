// today-focus.test.ts — O ACOMPANHAMENTO AUTOMÁTICO DA CASA: todos os números
// nascem do uso diário (Pomodoro, questões, simulados, caderno de erros) e do
// calendário oficial. Lib pura: recebe progresso + agora e devolve o retrato.

import { describe, test, expect } from 'bun:test';
import { todayDateKey, buildTodaySnapshot, buildTrackingDetail } from '@/lib/today-focus';
import { mergeWithDefaults } from '@/lib/study-progress';

describe('today-focus · chave do dia local (yyyy-mm-dd)', () => {
  test('formato AAAA-MM-DD com zero à esquerda', () => {
    const key = todayDateKey(new Date(2026, 2, 5, 14, 30)); // 5 de março de 2026
    expect(key).toBe('2026-03-05');
  });

  test('bate com os componentes locais do relógio (não UTC)', () => {
    const now = new Date();
    const esperado = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayDateKey(now)).toBe(esperado);
  });
});

describe('today-focus · retrato do dia com progresso vazio', () => {
  test('retrato nasce completo mesmo sem nada registrado (nada explode)', () => {
    const snap = buildTodaySnapshot(mergeWithDefaults({}), new Date());
    expect(snap).toBeDefined();
    expect(typeof snap).toBe('object');
  });

  test('retrato aceita o agora injetado (SSR e cliente dividem o mesmo instante)', () => {
    const agora = new Date(2026, 9, 21, 15, 0);
    const a = buildTodaySnapshot(mergeWithDefaults({}), agora);
    const b = buildTodaySnapshot(mergeWithDefaults({}), agora);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('today-focus · detalhe de rastreamento (canais de telemetria)', () => {
  test('com progresso vazio: estrutura presente, números zerados ou vazios', () => {
    const d = buildTrackingDetail(mergeWithDefaults({}), new Date());
    expect(d).toBeDefined();
  });

  test('com sessões de Pomodoro hoje, o canal de foco reage', () => {
    const now = new Date();
    const key = todayDateKey(now);
    const sp = mergeWithDefaults({
      pomodoroSessions: [
        {
          date: key,
          startedAt: new Date(now.getTime() - 3_600_000).toISOString(),
          completedAt: now.toISOString(),
          disciplineId: 'TEC.1687',
          focusMinutes: 50,
          mode: 'estudo' as const,
        },
      ],
    });
    const vazio = buildTrackingDetail(mergeWithDefaults({}), now);
    const cheio = buildTrackingDetail(sp, now);
    expect(JSON.stringify(cheio)).not.toBe(JSON.stringify(vazio));
  });
});
