// semester.test.ts — O CALENDÁRIO OFICIAL VIVO. Toda a inteligência da casa
// (véspera, semana da prova, semestre) nasce destas datas. Bug de fuso ou de
// pausa de dezembro aqui = algoritmo inteiro mentindo. Zero tolerância.

import { describe, test, expect } from 'bun:test';
import {
  SEMESTER_START,
  SEMESTER_PAUSE_START,
  SEMESTER_PAUSE_END,
  SEMESTER_END,
  FINAL_EXAM_START,
  FINAL_EXAM_END,
  TOTAL_TEACHING_WEEKS,
  weekStartDate,
  currentWeekOfSemester,
  daysUntilDate,
  semesterProgressPct,
  upcomingEvents,
} from '@/lib/semester';

describe('semester · datas oficiais coerentes entre si', () => {
  test('a linha do tempo do semestre nunca se atravessa', () => {
    expect(SEMESTER_START.getTime()).toBeLessThan(SEMESTER_PAUSE_START.getTime());
    expect(SEMESTER_PAUSE_START.getTime()).toBeLessThan(SEMESTER_PAUSE_END.getTime());
    expect(SEMESTER_PAUSE_END.getTime()).toBeLessThan(SEMESTER_END.getTime());
    expect(SEMESTER_END.getTime()).toBeLessThan(FINAL_EXAM_START.getTime());
    expect(FINAL_EXAM_START.getTime()).toBeLessThan(FINAL_EXAM_END.getTime());
  });

  test('19 semanas letivas declaradas', () => {
    expect(TOTAL_TEACHING_WEEKS).toBe(19);
  });
});

describe('semester · semana corrente (ignorando a pausa de dezembro/janeiro)', () => {
  test('antes do semestre: semana 0 (pré-semestre, nada inventado)', () => {
    const antes = new Date(2026, 6, 1); // julho/2026
    expect(currentWeekOfSemester(antes)).toBe(0);
  });

  test('primeira semana letiva: semana 1', () => {
    const primeira = new Date(SEMESTER_START.getTime() + 3 * 86_400_000);
    expect(currentWeekOfSemester(primeira)).toBe(1);
  });

  test('durante a pausa: congela na última semana de 2026 (não avança)', () => {
    const natal = new Date(2026, 11, 25); // dentro da pausa
    expect(currentWeekOfSemester(natal)).toBeGreaterThan(0);
    const anoNovo = new Date(2027, 0, 2);
    expect(currentWeekOfSemester(anoNovo)).toBe(currentWeekOfSemester(natal));
  });

  test('depois do fim: semana 0 (semestre encerrado não comanda nada)', () => {
    const depois = new Date(2027, 2, 15);
    expect(currentWeekOfSemester(depois)).toBe(0);
  });

  test('as semanas nunca passam do total declarado', () => {
    for (let m = 7; m <= 13; m++) {
      const w = currentWeekOfSemester(new Date(2026, m, 15));
      expect(w).toBeLessThanOrEqual(TOTAL_TEACHING_WEEKS);
    }
  });

  test('weekStartDate é monotônica e a semana 1 começa no início do semestre', () => {
    expect(weekStartDate(1).getTime()).toBe(SEMESTER_START.getTime());
    for (let w = 2; w <= TOTAL_TEACHING_WEEKS; w++) {
      expect(weekStartDate(w).getTime()).toBeGreaterThan(weekStartDate(w - 1).getTime());
    }
  });
});

describe('semester · dias até uma data (a régua da véspera)', () => {
  const now = new Date(2026, 9, 20); // 20/10/2026 local

  test('futuro positivo, passado negativo, hoje zero', () => {
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(daysUntilDate(todayIso, now)).toBe(0);
    expect(daysUntilDate('2026-10-25', now)).toBe(5);
    expect(daysUntilDate('2026-10-15', now)).toBe(-5);
  });

  test('véspera de prova (D-1) e o dia (D-0) — o pico da fila', () => {
    expect(daysUntilDate('2026-10-21', now)).toBe(1);
  });
});

describe('semester · progresso do semestre', () => {
  test('antes do início: 0% (nunca negativo)', () => {
    expect(semesterProgressPct(new Date(2026, 6, 1))).toBe(0);
  });

  test('nunca passa de 100%', () => {
    expect(semesterProgressPct(new Date(2027, 5, 1))).toBeLessThanOrEqual(100);
  });

  test('no meio do semestre: entre 0 e 100', () => {
    const p = semesterProgressPct(new Date(2026, 9, 20));
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(100);
  });
});

describe('semester · próximos eventos oficiais', () => {
  test('nada já-passado entra; evento em andamento marca ongoing (daysLeft ≤ 0); limite respeitado', () => {
    const now = new Date(2026, 9, 20);
    const evs = upcomingEvents(now, 3);
    expect(evs.length).toBeLessThanOrEqual(3);
    for (const ev of evs) {
      if (ev.ongoing) {
        // em andamento: começou (daysLeft ≤ 0) e ainda não terminou
        expect(ev.daysLeft).toBeLessThanOrEqual(0);
      } else {
        expect(ev.daysLeft).toBeGreaterThan(0);
      }
    }
  });

  test('eventos ordenados por proximidade', () => {
    const evs = upcomingEvents(new Date(2026, 9, 20), 10);
    for (let i = 1; i < evs.length; i++) {
      expect(evs[i].daysLeft).toBeGreaterThanOrEqual(evs[i - 1].daysLeft);
    }
  });
});
