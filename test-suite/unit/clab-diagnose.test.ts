// clab-diagnose.test.ts — o diagnóstico didático: dica e categoria nascem da
// MESMA tabela de regras (o card e o painel "Onde você erra mais" nunca
// podem discordar).

import { describe, test, expect } from 'bun:test';
import { diagnoseClabError, categorizeClabError } from '@/lib/clab/diagnose';

describe('clab · diagnóstico didático de erros', () => {
  test('laço infinito → categoria laco com dica de condição de parada', () => {
    const msg = 'A execução passou de 4000 passos — provável laço infinito.';
    expect(categorizeClabError(msg)).toBe('laco');
    expect(diagnoseClabError(msg)).toContain('condição de parada');
  });

  test('recursão sem caso base → laco', () => {
    expect(categorizeClabError('Recursão muito profunda (mais de 200 chamadas)')).toBe('laco');
  });

  test('scanf sem & → io com dica do &', () => {
    const msg = 'O scanf precisa do & antes da variável.';
    expect(categorizeClabError(msg)).toBe('io');
    expect(diagnoseClabError(msg)).toContain('scanf');
  });

  test('variável não declarada → variavel', () => {
    const msg = "variável 'x' não existe — declare antes de usar";
    expect(categorizeClabError(msg)).toBe('variavel');
  });

  test('função inexistente → variavel (nome não bate)', () => {
    const msg = "A função 'prontf' não existe — confira a grafia.";
    expect(categorizeClabError(msg)).toBe('variavel');
  });

  test('divisão por zero → outro com dica do denominador', () => {
    const msg = 'divisão por zero detectada';
    expect(categorizeClabError(msg)).toBe('outro');
    expect(diagnoseClabError(msg)).toContain('denominador');
  });

  test('índice fora do vetor → outro', () => {
    expect(categorizeClabError('Acesso fora do vetor: índice 5 em vetor de 3')).toBe('outro');
  });

  test("';' faltando → sintaxe", () => {
    expect(categorizeClabError("esperava ';' antes de")).toBe('sintaxe');
  });

  test('chave aberta sem fecho → sintaxe', () => {
    expect(categorizeClabError('esperava fechar o bloco com }')).toBe('sintaxe');
  });

  test('mensagem desconhecida cai no fallback honesto e categoria outro', () => {
    const hint = diagnoseClabError('zebra abstrata 123');
    expect(hint.length).toBeGreaterThan(10);
    expect(categorizeClabError('zebra abstrata 123')).toBe('outro');
  });

  test('string vazia/undefined não explode (defensivo)', () => {
    expect(diagnoseClabError('')).toBeTruthy();
    expect(categorizeClabError('')).toBe('outro');
  });
});
