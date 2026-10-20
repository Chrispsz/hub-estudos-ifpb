// clab-compiler.test.ts — PEÇA 2 do quebra-cabeça: o compilador em CADEIA.
// Aqui o encaixe é literal: o lexer alimenta o parser, o parser alimenta a VM,
// a VM alimenta os snapshots e o flowchart lê o AST. Cada teste atravessa a
// cadeia inteira com programas reais das listas de Algoritmos.

import { describe, test, expect } from 'bun:test';
import { parseC, ClabParseError } from '@/lib/clab/parser';
import { ClabEngine, ClabError } from '@/lib/clab/interpreter';
import { flowchartsFor } from '@/lib/clab/flowchart';
import { lex } from '@/lib/clab/lexer';

const HELLO = `#include <stdio.h>
int main() {
    printf("Ola, C!\\n");
    return 0;
}
`;

const SOMA_SCANF = `#include <stdio.h>
int main() {
    int a, b, soma;
    scanf("%d", &a);
    scanf("%d", &b);
    soma = a + b;
    printf("%d\\n", soma);
    return 0;
}
`;

const FOR_SOMA = `#include <stdio.h>
int main() {
    int soma = 0;
    for (int i = 1; i <= 5; i++) {
        soma = soma + i;
    }
    printf("%d\\n", soma);
    return 0;
}
`;

const IF_ELSE = `#include <stdio.h>
int main() {
    int n = 7;
    if (n % 2 == 0) {
        printf("par\\n");
    } else {
        printf("impar\\n");
    }
    return 0;
}
`;

const WHILE = `#include <stdio.h>
int main() {
    int n = 5;
    int fat = 1;
    while (n > 1) {
        fat = fat * n;
        n = n - 1;
    }
    printf("%d\\n", fat);
    return 0;
}
`;

const VETOR = `#include <stdio.h>
int main() {
    int v[3];
    v[0] = 7;
    v[1] = v[0] + 1;
    v[2] = v[0] + v[1];
    printf("%d %d\\n", v[0], v[2]);
    return 0;
}
`;

const FUNCAO = `#include <stdio.h>
int dobro(int x) {
    return x * 2;
}
int main() {
    printf("%d\\n", dobro(21));
    return 0;
}
`;

const DIV_ZERO = `#include <stdio.h>
int main() {
    int a = 10;
    int b = 0;
    printf("%d\\n", a / b);
    return 0;
}
`;

// ---------------------------------------------------------------------------
// ELO 1 — LEXER
// ---------------------------------------------------------------------------
describe('clab · elo 1: lexer', () => {
  test('tokeniza o programa Olá em sequência coerente (kw, id, str, op, eof)', () => {
    const toks = lex(HELLO);
    expect(toks.length).toBeGreaterThan(5);
    expect(toks[toks.length - 1].t).toBe('eof');
    const kinds = new Set(toks.map((t) => t.t));
    expect(kinds.has('kw')).toBe(true);      // int, return
    expect(kinds.has('id')).toBe(true);      // main, printf
    expect(kinds.has('str')).toBe(true);     // "Ola, C!\n"
    const strTok = toks.find((t) => t.t === 'str');
    expect(strTok?.v).toContain('Ola');
  });

  test('erro léxico levanta ClabSyntaxError com linha', () => {
    expect(() => lex('int main() { char c = @; }')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ELO 2 — PARSER
// ---------------------------------------------------------------------------
describe('clab · elo 2: parser', () => {
  test('programa válido vira AST com main', () => {
    const r = parseC(HELLO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.program.fns.some((f) => f.name === 'main')).toBe(true);
    }
  });

  test('função declarada além de main entra no AST', () => {
    const r = parseC(FUNCAO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.program.fns.map((f) => f.name)).toContain('dobro');
    }
  });

  test('código quebrado devolve erro com linha apontada', () => {
    const quebrado = 'int main() {\n  int x = ;\n}';
    const r = parseC(quebrado);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBeGreaterThan(0);
      expect(typeof r.message).toBe('string');
      expect(r.message.length).toBeGreaterThan(0);
    }
  });

  test('main ausente é rejeitado (todo programa começa nela)', () => {
    const r = parseC('int outra() { return 0; }');
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ELO 3 — VM (intérprete) rodando programas inteiros
// ---------------------------------------------------------------------------
describe('clab · elo 3: VM executa programas reais', () => {
  function runFull(code: string, stdin = '') {
    const prep = ClabEngine.prepare(code, stdin);
    if (!prep.ok) throw new Error(`prepare falhou: ${prep.message}`);
    prep.engine.runToEnd();
    return prep.engine;
  }

  test('Olá, C! imprime a saída esperada e termina done', () => {
    const eng = runFull(HELLO);
    expect(eng.status).toBe('done');
    expect(eng.output).toContain('Ola, C!');
  });

  test('scanf lê a entrada e soma (7 + 5 = 12)', () => {
    const eng = runFull(SOMA_SCANF, '7 5');
    expect(eng.status).toBe('done');
    expect(eng.output).toContain('12');
  });

  test('laço for soma 1..5 = 15', () => {
    const eng = runFull(FOR_SOMA);
    expect(eng.status).toBe('done');
    expect(eng.output).toContain('15');
  });

  test('if/else escolhe o ramo certo (ímpar)', () => {
    const eng = runFull(IF_ELSE);
    expect(eng.status).toBe('done');
    expect(eng.output).toContain('impar');
    expect(eng.output).not.toContain('par\nimpar');
  });

  test('while calcula fatorial de 5 = 120', () => {
    const eng = runFull(WHILE);
    expect(eng.status).toBe('done');
    expect(eng.output).toContain('120');
  });

  test('vetor guarda e soma células', () => {
    const eng = runFull(VETOR);
    expect(eng.status).toBe('done');
    expect(eng.output).toContain('7');
    expect(eng.output).toContain('15');
  });

  test('função chamada devolve valor (dobro de 21 = 42)', () => {
    const eng = runFull(FUNCAO);
    expect(eng.status).toBe('done');
    expect(eng.output).toContain('42');
  });

  test('erro de runtime (divisão por zero) vira status error com mensagem pedagógica', () => {
    const eng = runFull(DIV_ZERO);
    expect(eng.status).toBe('error');
    expect(eng.output).not.toContain('Infinity');
  });
});

// ---------------------------------------------------------------------------
// ELO 4 — SNAPSHOTS passo a passo + fork ("E se...?")
// ---------------------------------------------------------------------------
describe('clab · elo 4: passo a passo e fork', () => {
  test('step() avança instrução a instrução e snapshots crescem', () => {
    const prep = ClabEngine.prepare(FOR_SOMA, '');
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    const eng = prep.engine;
    let steps = 0;
    while (eng.step() && steps < 500) steps++;
    expect(eng.status).toBe('done');
    expect(eng.snapshots.length).toBeGreaterThan(3);
    expect(eng.output).toContain('15');
  });

  test('forkFrom restaura o estado do passo e o replay chega na mesma saída', () => {
    const prep = ClabEngine.prepare(FOR_SOMA, '');
    if (!prep.ok) throw new Error('prepare falhou');
    const eng = prep.engine;
    eng.runToEnd();
    const saidaOriginal = eng.output;
    const totalSnaps = eng.snapshots.length;
    expect(totalSnaps).toBeGreaterThan(3);

    eng.forkFrom(Math.floor(totalSnaps / 2));
    expect(eng.snapshots.length).toBeLessThan(totalSnaps);
    eng.runToEnd();
    expect(eng.output).toBe(saidaOriginal);
  });

  test('editVar altera variável no estado atual após fork', () => {
    const prep = ClabEngine.prepare(IF_ELSE, '');
    if (!prep.ok) throw new Error('prepare falhou');
    const eng = prep.engine;
    eng.step(); // entra no main
    const res = eng.editVar(1, 'n', null, '8');
    expect(res.ok).toBe(true);
  });

  test('editVar rejeita variável inexistente com erro claro', () => {
    const prep = ClabEngine.prepare(IF_ELSE, '');
    if (!prep.ok) throw new Error('prepare falhou');
    const eng = prep.engine;
    eng.step();
    const res = eng.editVar(1, 'inexistente', null, '1');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('inexistente');
  });
});

// ---------------------------------------------------------------------------
// ELO 5 — FLUXOGRAMA (o AST vira desenho)
// ---------------------------------------------------------------------------
describe('clab · elo 5: fluxograma do código', () => {
  test('programa com if gera nós start, decision e end ligados por arestas', () => {
    const r = parseC(IF_ELSE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const charts = flowchartsFor(r.program);
    expect(charts.length).toBeGreaterThanOrEqual(1);
    const main = charts[0];
    const kinds = new Set(main.nodes.map((n) => n.kind));
    expect(kinds.has('start')).toBe(true);
    expect(kinds.has('end')).toBe(true);
    expect(kinds.has('decision')).toBe(true);
    // toda aresta aponta para nós que existem
    const ids = new Set(main.nodes.map((n) => n.id));
    for (const e of main.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  test('programa com laço for gera decisão (condição do laço)', () => {
    const r = parseC(FOR_SOMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const charts = flowchartsFor(r.program);
    const main = charts[0];
    expect(main.nodes.some((n) => n.kind === 'decision')).toBe(true);
    expect(main.nodes.length).toBeGreaterThan(3);
  });

  test('função auxiliar ganha o próprio fluxograma', () => {
    const r = parseC(FUNCAO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const charts = flowchartsFor(r.program);
    expect(charts.length).toBeGreaterThanOrEqual(2); // main + dobro
  });

  test('programa linear não tem decisão', () => {
    const r = parseC(HELLO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const charts = flowchartsFor(r.program);
    const main = charts[0];
    expect(main.nodes.some((n) => n.kind === 'decision')).toBe(false);
    expect(main.nodes.some((n) => n.kind === 'io')).toBe(true); // printf é I/O
  });
});

// ---------------------------------------------------------------------------
// Guarda-chuva: prepare devolve falha estruturada, nunca explode
// ---------------------------------------------------------------------------
describe('clab · contrato de falha estruturada', () => {
  test('prepare em código inválido devolve { ok:false, message, line, col }', () => {
    const prep = ClabEngine.prepare('int main() { int x = ; }', '');
    expect(prep.ok).toBe(false);
    if (!prep.ok) {
      expect(prep.message.length).toBeGreaterThan(0);
      expect(prep.line).toBeGreaterThanOrEqual(1);
      expect(prep.col).toBeGreaterThanOrEqual(1);
    }
  });
});
