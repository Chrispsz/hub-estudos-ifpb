// clab-examples.test.ts — o acervo oficial do Lab tem que rodar PERFEITO.
// Cada exemplo é o material de aula do dono: se um deles quebra, a aula quebra.

import { describe, test, expect } from 'bun:test';
import { CLAB_EXAMPLES } from '@/lib/clab/examples';
import { ClabEngine } from '@/lib/clab/interpreter';

describe('clab · acervo oficial de exemplos', () => {
  test('o acervo tem exemplos nos 3 grupos do curso', () => {
    const grupos = new Set(CLAB_EXAMPLES.map((e) => e.grupo));
    expect(grupos.has('Unidade 1')).toBe(true);
    expect(grupos.has('Unidade 2')).toBe(true);
    expect(CLAB_EXAMPLES.length).toBeGreaterThanOrEqual(5);
  });

  test('todo exemplo tem id/titulo/código com main', () => {
    for (const ex of CLAB_EXAMPLES) {
      expect(ex.id.length).toBeGreaterThan(0);
      expect(ex.titulo.length).toBeGreaterThan(0);
      expect(ex.code).toContain('main');
    }
  });

  test('TODO exemplo compila, roda até o fim e termina sem erro', () => {
    const falhas: string[] = [];
    for (const ex of CLAB_EXAMPLES) {
      const prep = ClabEngine.prepare(ex.code, ex.stdin ?? '');
      if (!prep.ok) {
        falhas.push(`${ex.id}: prepare → ${prep.message} (linha ${prep.line})`);
        continue;
      }
      prep.engine.runToEnd();
      if (prep.engine.status !== 'done') {
        const snap = prep.engine.snapshots.at(-1);
        falhas.push(`${ex.id}: status=${prep.engine.status} — ${snap?.note ?? prep.engine.output}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  test('exemplos com saída esperada imprimem de fato (nada de aula muda)', () => {
    for (const ex of CLAB_EXAMPLES) {
      const prep = ClabEngine.prepare(ex.code, ex.stdin ?? '');
      if (!prep.ok) continue;
      prep.engine.runToEnd();
      // Todo exemplo do acervo imprime algo — se um dia houver exemplo sem
      // printf, esta guarda precisa ser atualizada junto.
      expect(prep.engine.output.length).toBeGreaterThan(0);
    }
  });

  test('ids do acervo são únicos (a navegação usa id como chave)', () => {
    const ids = CLAB_EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
