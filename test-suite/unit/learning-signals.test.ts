// learning-signals.test.ts — O ALGORITMO QUE APRENDE COM O USO REAL.
// Facilidade medida nas questões (não auto-relato): puxada pesa mais,
// fluida respira, sem dado é neutro. A régua do motor inteiro.

import { describe, test, expect } from 'bun:test';
import {
  facilityLevelOf,
  facilityMultiplierOf,
  facilityReasonOf,
  formatQuestionTime,
} from '@/lib/learning-signals';

describe('learning-signals · níveis de facilidade', () => {
  test('sem dado é sem-dado — a casa nunca inventa', () => {
    expect(facilityLevelOf(undefined)).toBe('sem-dado');
  });

  test('puxada < 0.4 · solida entre 0.4–0.75 · fluida > 0.75', () => {
    expect(facilityLevelOf(0.2)).toBe('puxada');
    expect(facilityLevelOf(0.39)).toBe('puxada');
    expect(facilityLevelOf(0.4)).toBe('solida');
    expect(facilityLevelOf(0.5)).toBe('solida');
    expect(facilityLevelOf(0.75)).toBe('solida');
    expect(facilityLevelOf(0.76)).toBe('fluida');
    expect(facilityLevelOf(1)).toBe('fluida');
  });
});

describe('learning-signals · multiplicador no score do motor', () => {
  test('sem dado é neutro (×1)', () => {
    expect(facilityMultiplierOf(undefined)).toBe(1);
  });

  test('puxada PESA MAIS (>1) — reforço sobe na fila', () => {
    expect(facilityMultiplierOf(0.2)).toBeGreaterThan(1);
  });

  test('fluida respira (<1) — não superestuda o que já saiu de cabeça', () => {
    expect(facilityMultiplierOf(0.9)).toBeLessThan(1);
  });

  test('solida fica neutra', () => {
    expect(facilityMultiplierOf(0.5)).toBe(1);
  });
});

describe('learning-signals · razão humana do ajuste', () => {
  test('sem dado não tem motivo (null)', () => {
    expect(facilityReasonOf(undefined)).toBeNull();
    expect(facilityReasonOf(0.5)).toBeNull();
  });

  test('puxada explica o reforço; fluida explica a aceleração', () => {
    expect(facilityReasonOf(0.2)).toContain('reforço');
    expect(facilityReasonOf(0.9)).toContain('acelerar');
  });
});

describe('learning-signals · tempo honesto de questão', () => {
  test('abaixo de 90s fala em segundos (25s ≠ "1min")', () => {
    expect(formatQuestionTime(25)).toBe('25s');
    expect(formatQuestionTime(65)).toBe('65s');
  });

  test('arredonda de 5 em 5 abaixo de 90s', () => {
    expect(formatQuestionTime(27)).toBe('25s');
  });

  test('acima de 90s fala em minutos', () => {
    expect(formatQuestionTime(90)).toBe('2min');
    expect(formatQuestionTime(125)).toBe('2min');
    expect(formatQuestionTime(3600)).toBe('60min');
  });

  test('valor mínimo nunca é 0s (esbarrão vira 1s)', () => {
    expect(formatQuestionTime(0)).toBe('1s');
  });
});
