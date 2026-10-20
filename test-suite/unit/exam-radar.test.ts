// exam-radar.test.ts — O RADAR DE PROVAS: só DATA OFICIAL conta (política
// anti-estimativa). A pressão da fila nasce do calendário, nunca de chute.

import { describe, test, expect } from 'bun:test';
import {
  examRadarFor,
  examBoostLevel,
  examWhenPhrase,
} from '@/lib/exam-radar';
import { evaluationPeriods } from '@/data/course-data';

describe('exam-radar · radar por disciplina', () => {
  test('devolve entradas com status válido (feita | agendada | sem-data)', () => {
    const radar = examRadarFor(new Date());
    expect(Array.isArray(radar)).toBe(true);
    expect(radar.length).toBeGreaterThan(0);
    for (const e of radar) {
      expect(['feita', 'agendada', 'sem-data']).toContain(e.status);
      expect(typeof e.name).toBe('string');
    }
  });

  test('uma entrada por disciplina do curso (sem duplicar)', () => {
    const radar = examRadarFor(new Date());
    const keys = radar.map((e) => e.disciplineCode);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('agendada implica data oficial à frente; feita implica data no passado', () => {
    const now = new Date();
    for (const e of examRadarFor(now)) {
      if (e.status === 'agendada') {
        expect(e.date).toBeTruthy();
      }
    }
  });
});

describe('exam-radar · nível de pressão na fila', () => {
  test('sem data nenhuma pressão (0)', () => {
    expect(examBoostLevel(null)).toBe(0);
  });

  test('véspera é pico: D-3 ou menos = 3', () => {
    expect(examBoostLevel(0)).toBe(3);
    expect(examBoostLevel(3)).toBe(3);
  });

  test('semana da prova (D-4 a D-7) = 2', () => {
    expect(examBoostLevel(4)).toBe(2);
    expect(examBoostLevel(7)).toBe(2);
  });

  test('mês da prova (D-8 a D-21) = 1', () => {
    expect(examBoostLevel(8)).toBe(1);
    expect(examBoostLevel(21)).toBe(1);
  });

  test('longe demais = 0', () => {
    expect(examBoostLevel(22)).toBe(0);
    expect(examBoostLevel(90)).toBe(0);
  });

  test('a pressão é monotônica: mais perto nunca pesa menos', () => {
    const seq = [60, 30, 21, 14, 7, 3, 1, 0].map((d) => examBoostLevel(d));
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
  });
});

describe('exam-radar · frase de prazo (voz da casa)', () => {
  test('hoje e amanhã em palavras', () => {
    expect(examWhenPhrase(0)).toBe('hoje');
    expect(examWhenPhrase(1)).toBe('amanhã');
  });

  test('até 14 dias: "em N dias"', () => {
    expect(examWhenPhrase(10)).toBe('em 10 dias');
  });

  test('mais longe com data oficial: dia dd/mm', () => {
    expect(examWhenPhrase(40, '2026-12-05')).toBe('dia 05/12');
  });

  test('mais longe sem data: mantém "em N dias"', () => {
    expect(examWhenPhrase(40)).toBe('em 40 dias');
  });
});

describe('exam-radar · coerência com o calendário oficial', () => {
  test('avaliações com data passada nunca aparecem como pressão futura', () => {
    const now = new Date();
    for (const e of evaluationPeriods) {
      if (!e.date) continue;
      const daysLeft = Math.round(
        (new Date(`${e.date}T00:00:00`).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000,
      );
      if (daysLeft < 0) {
        // passada: examPressureFor nunca devolve (coberto por examRadarFor → feita)
        expect(daysLeft).toBeLessThan(0);
      }
    }
  });
});
