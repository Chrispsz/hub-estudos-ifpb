// smart-schedule.test.ts — O CRONOGRAMA INTELIGENTE ROTATIVO.
// Invariantes sagrados: capacidade aprendida respeitada, nenhuma matéria em
// todos os dias, semana absorve o estudo real (sem cobrar duas vezes),
// hoje não repete material que já teve foco.

import { describe, test, expect } from 'bun:test';
import {
  generateSmartSchedule,
  learnedRhythmFromHistory,
  todayMinutesByPeriod,
  adaptTodayBlocksToNow,
  blockKey,
  formatTime,
  BLOCK_MINUTES,
  type SmartScheduleInput,
  type SmartBlock,
} from '@/lib/smart-schedule';
import { mergeWithDefaults, type StudyPreferences } from '@/lib/study-progress';
import { disciplines } from '@/data/course-data';

const CODES = disciplines.map((d) => d.code);

function prefsFor(daysEnabled = true): StudyPreferences {
  const base = mergeWithDefaults({}).studyPreferences;
  const days: StudyPreferences['days'] = {};
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    days[d] = {
      enabled: daysEnabled,
      startHour: 8,
      durationMin: 180,
      windows: [
        { turno: 'manha', startHour: 8, durationMin: 120 },
        { turno: 'noite', startHour: 19, durationMin: 60 },
      ],
    };
  }
  return { ...base, days, maxBlocksPerDay: 5, maxMinutesPerDay: 240 };
}

function inputFor(over: Partial<SmartScheduleInput> = {}): SmartScheduleInput {
  return {
    preferences: prefsFor(),
    topicProgress: {},
    ...over,
  };
}

// ---------------------------------------------------------------------------
// O ritmo que a casa mediu (mediana, clamp, testemunha do check-in)
// ---------------------------------------------------------------------------
describe('smart-schedule · ritmo aprendido (learnedRhythmFromHistory)', () => {
  const now = new Date();

  function sessionsOf(minutesPerDay: number[]): { completedAt: string; focusMinutes: number }[] {
    return minutesPerDay.map((min, i) => ({
      completedAt: new Date(now.getTime() - (i + 1) * 86_400_000).toISOString(),
      focusMinutes: min,
    }));
  }

  test('mediana dos dias reais (5 dias → valor do meio)', () => {
    const r = learnedRhythmFromHistory(sessionsOf([60, 120, 180, 90, 150]), undefined, now);
    expect(r.daysCounted).toBe(5);
    expect(r.minutesPerDay).toBe(120);
  });

  test('menos de 3 dias: assume 2h padrão e confessa quantos dias tem', () => {
    const r = learnedRhythmFromHistory(sessionsOf([90, 60]), undefined, now);
    expect(r.minutesPerDay).toBe(120);
    expect(r.daysCounted).toBe(2);
  });

  test('clamp: nada abaixo de 50min nem acima de 240min', () => {
    const baixo = learnedRhythmFromHistory(sessionsOf([15, 20, 25]), undefined, now);
    expect(baixo.minutesPerDay).toBeGreaterThanOrEqual(50);
    const alto = learnedRhythmFromHistory(sessionsOf([300, 280, 260]), undefined, now);
    expect(alto.minutesPerDay).toBeLessThanOrEqual(240);
  });

  test('esbarrão de <15min no dia não desenha ritmo', () => {
    const r = learnedRhythmFromHistory(sessionsOf([60, 10, 120, 90]), undefined, now);
    // dia de 10min é descartado → 3 dias contam
    expect(r.daysCounted).toBe(3);
  });

  test('check-in de horas é testemunha em dia sem foco registrado', () => {
    const fourDaysAgo = new Date(now.getTime() - 4 * 86_400_000);
    const key = `${fourDaysAgo.getFullYear()}-${String(fourDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(fourDaysAgo.getDate()).padStart(2, '0')}`;
    const r = learnedRhythmFromHistory(
      sessionsOf([60, 120, 180]),
      { [key]: 2 },
      now,
    );
    expect(r.daysCounted).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// O site sabe quando você estudou (manhã/tarde/noite — sem perguntar)
// ---------------------------------------------------------------------------
describe('smart-schedule · todayMinutesByPeriod (detecção automática)', () => {
  test('manhã <12h, tarde 12–17h, noite ≥18h — lido do completedAt', () => {
    const now = new Date();
    const iso = (h: number, m = 0) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      return d.toISOString();
    };
    const sessions = [
      { completedAt: iso(9), focusMinutes: 60 },
      { completedAt: iso(14, 30), focusMinutes: 45 },
      { completedAt: iso(20, 15), focusMinutes: 90 },
    ];
    const p = todayMinutesByPeriod(sessions, now);
    expect(p.manha).toBe(60);
    expect(p.tarde).toBe(45);
    expect(p.noite).toBe(90);
  });

  test('sessão de ontem não conta no hoje', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 10);
    const p = todayMinutesByPeriod(
      [{ completedAt: yesterday.toISOString(), focusMinutes: 120 }],
      now,
    );
    expect(p.manha).toBe(0);
    expect(p.tarde).toBe(0);
    expect(p.noite).toBe(0);
  });

  test('sem sessões: três períodos zerados (nunca inventa)', () => {
    const p = todayMinutesByPeriod([], new Date());
    expect(p).toEqual({ manha: 0, tarde: 0, noite: 0 });
  });
});

// ---------------------------------------------------------------------------
// O gerador: distribuição rotativa proporcional à CH
// ---------------------------------------------------------------------------
describe('smart-schedule · generateSmartSchedule (invariantes da semana)', () => {
  test('gera blocos com estrutura completa (id, dia, hora, duração, matéria)', () => {
    const blocks = generateSmartSchedule(inputFor());
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b.day).toBeGreaterThanOrEqual(0);
      expect(b.day).toBeLessThanOrEqual(6);
      expect(b.durationMin).toBeGreaterThan(0);
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.id.length).toBeGreaterThan(0);
      expect(['estudo', 'revisao', 'projeto', 'exercicios']).toContain(b.activity);
    }
  });

  test('matéria dos blocos pertence à grade (ou é revisão geral)', () => {
    const blocks = generateSmartSchedule(inputFor());
    for (const b of blocks) {
      const ok = CODES.includes(b.disciplineCode) || b.disciplineCode === 'revisao' || b.disciplineCode === '';
      expect(ok).toBe(true);
    }
  });

  test('capacidade aprendida comanda: semana ≤ mediana × 7 (+ folga de arredondamento em bloco)', () => {
    const blocks = generateSmartSchedule(inputFor({ learnedCapacity: { minutesPerDay: 120, daysCounted: 21 } }));
    const byDay = new Map<number, number>();
    for (const b of blocks) byDay.set(b.day, (byDay.get(b.day) ?? 0) + b.durationMin);
    for (const [, min] of byDay) {
      expect(min).toBeLessThanOrEqual(120 + BLOCK_MINUTES);
    }
  });

  test('não há dois blocos da mesma matéria no mesmo encaixe (dia + hora)', () => {
    const blocks = generateSmartSchedule(inputFor({ learnedCapacity: { minutesPerDay: 120, daysCounted: 21 } }));
    const keys = blocks.map((b) => `${b.day}|${b.startHour}:${b.startMinute}|${b.disciplineCode}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('estudo REAL da semana desconta: matéria com 600min feitos não ganha mais que sem nada', () => {
    const sem = generateSmartSchedule(inputFor());
    const com = generateSmartSchedule(inputFor({ weekStudiedMinutes: { 'TEC.1687': 600 } }));
    const somaPor = (bs: SmartBlock[], code: string) =>
      bs.filter((b) => b.disciplineCode === code).reduce((a, b) => a + b.durationMin, 0);
    expect(somaPor(com, 'TEC.1687')).toBeLessThanOrEqual(somaPor(sem, 'TEC.1687'));
  });

  test('facilidade puxada pesa mais: disciplina difícil não desaparece da semana', () => {
    const blocks = generateSmartSchedule(
      inputFor({ learnedCapacity: { minutesPerDay: 120, daysCounted: 21 }, facility: Object.fromEntries(CODES.map((c) => [c, 0.2])) }),
    );
    expect(blocks.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Re-ancoragem de hoje no momento do acesso
// ---------------------------------------------------------------------------
describe('smart-schedule · adaptTodayBlocksToNow', () => {
  test('bloco de hoje que já passou é re-agendado para frente (nunca no passado)', () => {
    const now = new Date();
    const blocks: SmartBlock[] = [
      { id: 'a', day: now.getDay(), startHour: 6, startMinute: 0, durationMin: 50, disciplineCode: 'TEC.1687', title: 'Passado', activity: 'estudo', source: 'auto' },
      { id: 'b', day: now.getDay(), startHour: 23, startMinute: 30, durationMin: 50, disciplineCode: 'TEC.1984', title: 'Futuro', activity: 'estudo', source: 'auto' },
    ];
    const adapted = adaptTodayBlocksToNow(blocks, now);
    const nowH = now.getHours() + now.getMinutes() / 60;
    for (const b of adapted) {
      if (b.day !== now.getDay()) continue;
      const start = b.startHour + b.startMinute / 60;
      // nenhum bloco de hoje começa antes de agora (com tolerância de um passo)
      expect(start >= nowH - 0.01 || b.id === 'b').toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------
describe('smart-schedule · utilidades', () => {
  test('blockKey é estável e distingue encaixes', () => {
    const a = blockKey({ day: 1, startHour: 8, startMinute: 0 });
    const b = blockKey({ day: 1, startHour: 8, startMinute: 0 });
    const c = blockKey({ day: 1, startHour: 9, startMinute: 0 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test('formatTime padroniza hh:mm', () => {
    expect(formatTime(14, 5)).toMatch(/14:05/);
    expect(formatTime(9, 0)).toMatch(/09:00/);
  });
});
