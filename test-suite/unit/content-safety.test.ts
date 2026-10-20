// content-safety.test.ts — O QUE APARECE NA TELA E O QUE NÃO SE PERDE.
// LaTeX vira KaTeX sem vazar sintaxe crua, código é tokenizado, e o aviso
// de backup fala a verdade sobre o risco de perder o progresso.

import { describe, test, expect } from 'bun:test';
import { normalizeMath, sanitizeLatex } from '@/lib/sanitize-latex';
import { tokenizeCode, normalizeLang, langLabel } from '@/lib/code-highlight';
import { backupStatus, progressWorthOf, BACKUP_STAMP_KEY } from '@/lib/backup-guard';

describe('latex · normalização para o KaTeX do tutor', () => {
  test('\\[...\\] vira bloco $$...$$', () => {
    const out = normalizeMath('A raiz é \\[x = \\frac{-b}{2a}\\] ok');
    expect(out).toContain('$$');
    expect(out).not.toContain('\\[');
  });

  test('\\(...\\) vira inline $...$', () => {
    const out = normalizeMath('valor \\(n^2\\) aqui');
    expect(out).toContain('$n^2$');
    expect(out).not.toContain('\\(');
  });

  test('texto sem math passa intacto', () => {
    const t = 'só texto, nada de fórmula';
    expect(normalizeMath(t)).toBe(t);
  });

  test('matriz em bmatrix é humanizada (sem ambiente cru na tela)', () => {
    const out = sanitizeLatex('\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}');
    expect(out).not.toContain('\\begin{bmatrix}');
    expect(out).not.toContain('\\end{bmatrix}');
  });
});

describe('code-highlight · tokenização do Lab e do chat', () => {
  test('normalizeLang reconhece variantes de C, portugol e html; lixo → null', () => {
    expect(normalizeLang('c')).toBe('c');
    expect(normalizeLang('C++')).toBe('c');
    expect(normalizeLang('hpp')).toBe('c');
    expect(normalizeLang('portugol')).toBe('portugol');
    expect(normalizeLang('PSEUDOCODIGO')).toBe('portugol');
    expect(normalizeLang('html')).toBe('html');
    expect(normalizeLang('python')).toBeNull();
    expect(normalizeLang(undefined)).toBeNull();
    expect(normalizeLang('')).toBeNull();
  });

  test('langLabel devolve rótulo humano', () => {
    expect(langLabel('c').length).toBeGreaterThan(0);
    expect(langLabel('portugol').length).toBeGreaterThan(0);
  });

  test('tokenizeCode quebra o código em tokens tipados (keywords, strings, números)', () => {
    const toks = tokenizeCode('int main() { printf("Ola"); return 0; }', 'c');
    expect(toks.length).toBeGreaterThan(5);
    const kinds = new Set(toks.map((t) => t.type));
    expect(kinds.size).toBeGreaterThan(1);
    const joined = toks.map((t) => t.value).join('');
    expect(joined).toContain('printf');
  });
});

describe('backup · o aviso honesto do seguro do progresso', () => {
  const now = new Date();

  test('nunca exportou → never (a casa confessa)', () => {
    expect(backupStatus(null, now).tone).toBe('never');
    expect(backupStatus('data-invalida', now).tone).toBe('never');
  });

  test('backup de hoje e da semana: ok', () => {
    const iso = (diasAtras: number) => new Date(now.getTime() - diasAtras * 86_400_000).toISOString();
    expect(backupStatus(iso(0), now).tone).toBe('ok');
    expect(backupStatus(iso(3), now).tone).toBe('ok');
    expect(backupStatus(iso(0), now).label).toContain('hoje');
  });

  test('entre 8 e 29 dias: warn — já dá uma semana sem seguro', () => {
    const iso = (diasAtras: number) => new Date(now.getTime() - diasAtras * 86_400_000).toISOString();
    expect(backupStatus(iso(10), now).tone).toBe('warn');
    expect(backupStatus(iso(29), now).tone).toBe('warn');
  });

  test('30+ dias: danger — o seguro venceu', () => {
    const iso40 = new Date(now.getTime() - 40 * 86_400_000).toISOString();
    expect(backupStatus(iso40, now).tone).toBe('danger');
  });

  test('a chave do carimbo é estável (o aviso lê de onde o export grava)', () => {
    expect(BACKUP_STAMP_KEY).toBe('hub:backup:last-export-at');
  });

  test('progressWorthOf conta o que há a perder (e zero em tudo não pede confirmação)', () => {
    const vazio = progressWorthOf({ pomodoroSessions: [], completedMaterials: [], flashcards: [], simuladoRuns: [] });
    expect(vazio.total).toBe(0);
    const cheio = progressWorthOf({
      pomodoroSessions: [1, 2, 3],
      completedMaterials: [1, 2],
      flashcards: [1],
      simuladoRuns: [1, 2, 3, 4],
    });
    expect(cheio.total).toBe(10);
    expect(cheio.sessions).toBe(3);
    expect(cheio.runs).toBe(4);
  });
});
