// ciclo-do-erro.test.ts — O CICLO QUE FECHA: erro registrado → re-testado →
// dominado (2 acertos de cabeça seguidos). O caderno de erros e a fila do
// Code Review vivem do MESMO critério — aqui os dois lados provam isso.

import { describe, test, expect } from 'bun:test';
import { errorStatusFor, openErrorsByUnit } from '@/lib/v2/error-review';
import type { Attempt } from '@/lib/v2/domain';
import type { PracticeUnit, Topic } from '@/lib/v2/domain';
import {
  isRecorrenteMistake,
  notebookStats,
  windowCounts,
  groupByDiscipline,
  type MistakeItem,
} from '@/lib/mistake-notebook';

const HOUR = 3_600_000;
const T0 = 1_760_000_000_000; // epoch base fixo

function attemptOf(partial: Partial<Attempt> & { id: string; at: number }): Attempt {
  return {
    unitId: 'u1',
    result: 'correct',
    noLookup: true,
    ...partial,
  } as Attempt;
}

function unitOf(id: string): PracticeUnit {
  return {
    id,
    subjectId: 'TEC.1687',
    topicId: null,
    type: 'exercise',
    prompt: 'enunciado',
    difficulty: 2,
    source: 'lista_algoritmos',
    linkedMaterials: [],
    createdAt: T0,
  } as unknown as PracticeUnit;
}

describe('ciclo do erro · status pela régua do Code Review', () => {
  test('erro sem re-teste depois: aberto', () => {
    const erro = attemptOf({ id: 'a1', at: T0, result: 'wrong', noLookup: false, error: { reason: 'x', category: 'conceito' } });
    expect(errorStatusFor(erro, [erro])).toBe('aberto');
  });

  test('1 acerto de cabeça depois: re-testado (ainda não é prova)', () => {
    const erro = attemptOf({ id: 'a1', at: T0, result: 'wrong', noLookup: false, error: { reason: 'x', category: 'conceito' } });
    const acerto = attemptOf({ id: 'a2', at: T0 + HOUR, unitId: 'u1' });
    expect(errorStatusFor(erro, [erro, acerto])).toBe('re-testado');
  });

  test('2 acertos de cabeça SEGUIDOS: dominado — o ciclo fechou', () => {
    const erro = attemptOf({ id: 'a1', at: T0, result: 'wrong', noLookup: false, error: { reason: 'x', category: 'conceito' } });
    const a2 = attemptOf({ id: 'a2', at: T0 + HOUR, unitId: 'u1' });
    const a3 = attemptOf({ id: 'a3', at: T0 + 2 * HOUR, unitId: 'u1' });
    expect(errorStatusFor(erro, [erro, a2, a3])).toBe('dominado');
  });

  test('acerto COM consulta não domina (a ciência da casa: sem lookup)', () => {
    const erro = attemptOf({ id: 'a1', at: T0, result: 'wrong', noLookup: false, error: { reason: 'x', category: 'conceito' } });
    const a2 = attemptOf({ id: 'a2', at: T0 + HOUR, unitId: 'u1', noLookup: false });
    const a3 = attemptOf({ id: 'a3', at: T0 + 2 * HOUR, unitId: 'u1', noLookup: false });
    expect(errorStatusFor(erro, [erro, a2, a3])).not.toBe('dominado');
  });

  test('skipped não conta como re-teste (pular não é resolver)', () => {
    const erro = attemptOf({ id: 'a1', at: T0, result: 'wrong', noLookup: false, error: { reason: 'x', category: 'conceito' } });
    const pulou = attemptOf({ id: 'a2', at: T0 + HOUR, unitId: 'u1', result: 'skipped' });
    expect(errorStatusFor(erro, [erro, pulou])).toBe('aberto');
  });

  test('erros de OUTRA unidade não interferem na régua', () => {
    const erro = attemptOf({ id: 'a1', at: T0, result: 'wrong', noLookup: false, error: { reason: 'x', category: 'conceito' } });
    const outro = attemptOf({ id: 'a2', at: T0 + HOUR, unitId: 'outra-unidade' });
    const outro2 = attemptOf({ id: 'a3', at: T0 + 2 * HOUR, unitId: 'outra-unidade' });
    expect(errorStatusFor(erro, [erro, outro, outro2])).toBe('aberto');
  });
});

describe('ciclo do erro · fila agregada por unidade (openErrorsByUnit)', () => {
  const units = [unitOf('u1'), unitOf('u2')];
  const topics: Topic[] = [];

  test('reincidente na mesma unidade vira UMA tarefa com o porquê mais recente', () => {
    const e1 = attemptOf({ id: 'a1', at: T0, result: 'wrong', error: { reason: 'primeira vez', category: 'conceito' } });
    const e2 = attemptOf({ id: 'a2', at: T0 + HOUR, unitId: 'u1', result: 'wrong', noLookup: false, error: { reason: 'caiu de novo', category: 'deslize' } });
    const out = openErrorsByUnit([e1, e2], units, topics);
    const u1 = out.filter((o) => o.unitId === 'u1');
    expect(u1.length).toBe(1);
    expect(u1[0].reason).toBe('caiu de novo');
  });

  test('unidade dominada sai da fila inteira (nada de fantasma)', () => {
    const e1 = attemptOf({ id: 'a1', at: T0, result: 'wrong', noLookup: false, error: { reason: 'x', category: 'conceito' } });
    const a2 = attemptOf({ id: 'a2', at: T0 + HOUR, unitId: 'u1' });
    const a3 = attemptOf({ id: 'a3', at: T0 + 2 * HOUR, unitId: 'u1' });
    const out = openErrorsByUnit([e1, a2, a3], units, topics);
    expect(out.some((o) => o.unitId === 'u1')).toBe(false);
  });

  test('erro sem casa (unidade apagada) não entra — a fila nunca quebra', () => {
    const fantasma = attemptOf({ id: 'a1', at: T0, unitId: 'unidade-apagada', result: 'wrong', noLookup: false, error: { reason: 'x', category: 'conceito' } });
    expect(openErrorsByUnit([fantasma], units, topics)).toEqual([]);
  });
});

describe('caderno de erros · helpers puros do painel', () => {
  function itemOf(partial: Partial<MistakeItem>): MistakeItem {
    return {
      key: partial.key ?? 'k',
      kind: partial.kind ?? 'exercicio',
      disciplineCode: partial.disciplineCode ?? 'TEC.1687',
      title: partial.title ?? 'Questão 3',
      ...partial,
    } as MistakeItem;
  }

  test('recorrência: lapses ≥ 1 é erro de sempre; sem lapses não é', () => {
    expect(isRecorrenteMistake(itemOf({ lapses: 2 }))).toBe(true);
    expect(isRecorrenteMistake(itemOf({ lapses: 1 }))).toBe(true);
    expect(isRecorrenteMistake(itemOf({}))).toBe(false);
    expect(isRecorrenteMistake(itemOf({ lapses: 0 }))).toBe(false);
  });

  test('estatísticas do caderno somam o que existe', () => {
    const stats = notebookStats([
      itemOf({ key: 'a' }),
      itemOf({ key: 'b', disciplineCode: 'TEC.1984' }),
    ]);
    expect(stats.total).toBe(2);
  });

  test('janelas de tempo: 48h pega hoje + ontem (30h < 48h); 7d pega os três dias recentes', () => {
    const agora = Date.now();
    const stats = windowCounts([
      itemOf({ key: 'hoje', when: new Date(agora - 2 * HOUR).toISOString() }),
      itemOf({ key: 'ontem', when: new Date(agora - 30 * HOUR).toISOString() }),
      itemOf({ key: 'velho', when: new Date(agora - 20 * 24 * HOUR).toISOString() }),
    ]);
    expect(stats['48h']).toBe(2); // 2h e 30h atrás cabem nas 48h
    expect(stats['7d']).toBe(2);
    expect(stats.all).toBe(3);
  });

  test('agrupamento por disciplina devolve grupos { disciplineCode, items }', () => {
    const grupos = groupByDiscipline([
      itemOf({ key: 'a', disciplineCode: 'TEC.1687' }),
      itemOf({ key: 'b', disciplineCode: 'TEC.1687' }),
      itemOf({ key: 'c', disciplineCode: 'TEC.1984' }),
    ]);
    expect(grupos.length).toBe(2);
    const alg = grupos.find((g) => g.disciplineCode === 'TEC.1687');
    const mat = grupos.find((g) => g.disciplineCode === 'TEC.1984');
    expect(alg?.items.length).toBe(2);
    expect(mat?.items.length).toBe(1);
  });
});
