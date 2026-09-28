/**
 * linearize-math-text — conserta DRIFT de LaTeX nas transcrições de visão.
 *
 * Por quê: o prompt do VLM proíbe LaTeX, mas em ~1/3 das páginas o modelo
 * escorrega e volta a \begin{bmatrix}/\frac. LaTeX cru no material-text é o
 * ruído antigo (o tutor de texto não renderiza nada — o aluno lia "\\frac{1}{2}").
 *
 * O que faz: converte DETERMINISTICAMENTE a notação LaTeX para a notação linear
 * do acervo (matriz [[a,b],[c,d]], fração a/b, símbolos unicode) — a MESMA
 * convenção do prompt de transcrição (vlm-transcribe-math.ts). Idempotente:
 * rodar de novo não muda nada (sobram zero comandos \). Roda sobre TODOS os
 * textos de matemática para pegar drift em qualquer página.
 *
 * Uso: bun scripts/linearize-math-text.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'public/data/material-texts/mat-00-matrizes.txt',
  'public/data/material-texts/mat-01-matrizes.txt',
  'public/data/material-texts/mat-logica-lista.txt',
  'public/data/material-texts/mat-logica-slides.txt',
];

function linearize(src: string): string {
  let t = src;

  // ---- matrizes/vetores: \begin{bmatrix|pmatrix|vmatrix} … \end{…} ----
  // Linhas separadas por \\, colunas por & → [[a, b], [c, d]]
  const matrixRe = /\\begin\{(bmatrix|pmatrix|matrix|smallmatrix)\}([\s\S]*?)\\end\{\1\}/g;
  t = t.replace(matrixRe, (_m, _kind: string, body: string) => {
    const rows = body
      .split(/\\\\/g)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) =>
        '[' +
        r
          .split(/&/g)
          .map((c) => c.replace(/\s+/g, ' ').trim())
          .filter((c) => c.length > 0)
          .join(', ') +
        ']',
      );
    return '[' + rows.join(', ') + ']';
  });

  // ---- casos: \begin{cases} … \\ … \end{cases} → { eq1; eq2 } ----
  t = t.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_m, body: string) => {
    const eqs = body
      .split(/\\\\/g)
      .map((e) => e.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return '{ ' + eqs.join('; ') + ' }';
  });

  // ---- frações (repete para aninhadas): \frac{a}{b} → a/b ----
  for (let i = 0; i < 6; i++) {
    t = t.replace(/\\[dt]?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_m, a: string, b: string) => {
      const need = /[,+\-*/ ]/.test(a) || /[,+\-*/ ]/.test(b);
      return need ? `(${a.trim()})/(${b.trim()})` : `${a.trim()}/${b.trim()}`;
    });
  }

  // ---- símbolos e comandos comuns ----
  const SYMBOLS: [RegExp, string][] = [
    [/\\times/g, '×'],
    [/\\cdot/g, '·'],
    [/\\ne(q)?/g, '≠'],
    [/\\leq?/g, '≤'],
    [/\\geq?/g, '≥'],
    [/\\approx/g, '≈'],
    [/\\in\b/g, '∈'],
    [/\\notin\b/g, '∉'],
    [/\\subseteq/g, '⊂'],
    [/\\forall/g, '∀'],
    [/\\exists/g, '∃'],
    [/\\rightarrow|\\to/g, '→'],
    [/\\Rightarrow/g, '⇒'],
    [/\\leftrightarrow/g, '↔'],
    [/\\land|\\wedge/g, '∧'],
    [/\\lor|\\vee/g, '∨'],
    [/\\sim/g, '∼'],
    [/\\sqrt\s*\{([^{}]+)\}/g, '√($1)'],
    [/\\sqrt(?![a-zA-Z])/g, '√'],
    [/\\pm/g, '±'],
    [/\\pi/g, 'π'],
    [/\\Delta/g, 'Δ'],
    [/\\infty/g, '∞'],
    [/\\sum/g, '∑'],
    [/\\left|\\right/g, ''],
    [/\\quad|\\qquad/g, ' '],
    [/\\,/g, ' '],
    [/\\;/g, ' '],
    [/\\!/g, ''],
    [/\\\{/g, '{'],
    [/\\\}/g, '}'],
    [/\\%/g, '%'],
    [/\\&/g, '&'],
    [/\\\$/g, '$'],
    [/\\text\s*\{([^{}]+)\}/g, '$1'],
    [/\\mathbb\s*\{([^{}]+)\}/g, '$1'],
    [/\\begin\{array\}\{[^}]*\}/g, ''],
    [/\\end\{array\}/g, ''],
    [/\\hline/g, ''],
    [/\\displaystyle/g, ''],
    [/\\\(|\\\)|\\\[|\\\]/g, ''],
    [/\$\$/g, ''],
    [/\$/g, ''],
    [/\\[a-zA-Z]+/g, ''], // qualquer comando residual sem argumento
  ];
  for (const [re, to] of SYMBOLS) t = t.replace(re, to);

  // ---- marcadores de página: <!-- página N --> → [página N] ----
  t = t.replace(/<!--\s*p[áa]gina\s+(\d+)\s*-->/g, '[página $1]');

  // ---- resíduos de espaçamento múltiplo ----
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/ \n/g, '\n');
  return t;
}

let totalCmds = 0;
for (const f of FILES) {
  const src = readFileSync(f, 'utf8');
  const out = linearize(src);
  const leftovers = (out.match(/\\[a-zA-Z]+/g) ?? []).length;
  const changed = out !== src;
  writeFileSync(f, out);
  totalCmds += leftovers;
  console.log(`${changed ? '✎' : '='} ${f} · comandos \\ residuais: ${leftovers}`);
}
console.log(totalCmds === 0 ? 'OK — zero LaTeX residual.' : `ATENÇÃO: ${totalCmds} residuais.`);
