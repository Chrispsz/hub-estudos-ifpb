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
 * LIÇÃO 145 — a ordem dos símbolos era um BUG que CRIAVA entulho: \leq?
 * casava ANTES de \leftrightarrow/\left (virava ≤ftrightarrow / ≤ft() e
 * \cdot antes de \cdots (virava ·s) — exatamente o lixo que a IA lia nos
 * textos de matemática (a reclamação do dono: "a ia erra em matemática").
 * Agora: comandos LONGOS primeiro, prefixos depois + FASE DE REPARO para o
 * entulho já escrito + GUARDA final que falha alto se sobrar lixo.
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

  // ---- REPARO (145): entulho deixado por versões antigas deste script —
  // a ordem antiga casava \le antes de \leftrightarrow/\left e \cdot antes
  // de \cdots. Determinístico e cirúrgico: só o padrão conhecido, com
  // fronteira de contexto (não toca "2·s" de multiplicação legítima).
  t = t.replace(/≤ftrightarrow/g, '↔');
  t = t.replace(/≤ft/g, '');
  t = t.replace(/(^|[\s+&[(])·s(?=$|[\s,)&\\\]])/gm, '$1···');

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
  // REGRA DA ORDEM (145): comando LONGO antes de qualquer PREFIXO seu.
  // \leq? casava \left e o \le de \leftrightarrow (nascia ≤ft(/≤ftrightarrow)
  // e \cdot casava o início de \cdots (nascia ·s) — a ordem abaixo conserta.
  const SYMBOLS: [RegExp, string][] = [
    // pontilhados ANTES de \cdot (o prefixo engolia o "s" de \cdots → ·s)
    [/\\cdots|\\ldots|\\dots/g, '···'],
    [/\\vdots/g, '⋮'],
    [/\\ddots/g, '⋱'],
    [/\\cdot/g, '·'],
    // setas longas ANTES de \leq?/\geq? (o \le de \leftrightarrow virava ≤ft…)
    [/\\leftrightarrow/g, '↔'],
    [/\\Leftrightarrow/g, '↔'],
    [/\\Leftarrow/g, '⇐'],
    [/\\Rightarrow/g, '⇒'],
    [/\\rightarrow|\\to/g, '→'],
    // delimitadores ANTES de \leq? (o \le de \left( virava ≤ft()
    [/\\left|\\right/g, ''],
    [/\\times/g, '×'],
    [/\\ne(q)?/g, '≠'],
    [/\\leq?/g, '≤'],
    [/\\geq?/g, '≥'],
    [/\\approx/g, '≈'],
    [/\\in\b/g, '∈'],
    [/\\notin\b/g, '∉'],
    [/\\subseteq/g, '⊂'],
    [/\\forall/g, '∀'],
    [/\\exists/g, '∃'],
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
    [/\\prod/g, '∏'],
    [/\\qquad/g, ' '],
    [/\\quad/g, ' '],
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

// GUARDA (145): o entulho que a ordem antiga criava não pode mais existir —
// se sobrar, o script falha ALTO em vez de escrever silenciosamente lixo que
// a IA vai ler (a reclamação do dono nasceu daqui).
const DEBRIS = /≤ftrightarrow|≤ft|≥ft|·s/g;

let totalCmds = 0;
let totalDebris = 0;
for (const f of FILES) {
  const src = readFileSync(f, 'utf8');
  const out = linearize(src);
  const leftovers = (out.match(/\\[a-zA-Z]+/g) ?? []).length;
  const debris = (out.match(DEBRIS) ?? []).length;
  const changed = out !== src;
  if (debris === 0) writeFileSync(f, out);
  totalCmds += leftovers;
  totalDebris += debris;
  console.log(
    `${changed ? '✎' : '='} ${f} · comandos \\ residuais: ${leftovers}${debris ? ` · ENTULHO: ${debris} (não escrito!)` : ''}`,
  );
}
if (totalCmds === 0 && totalDebris === 0) {
  console.log('OK — zero LaTeX residual, zero entulho.');
} else {
  console.error(
    `ATENÇÃO: ${totalCmds} comandos residuais · ${totalDebris} entulho — CONSERTAR antes de servir à IA.`,
  );
  process.exit(1);
}
