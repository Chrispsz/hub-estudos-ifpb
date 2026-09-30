'use client';

// t179 — MATHTEXT: matemática com cara de livro em TODO o conteúdo estático.
// O dono: "tá mal estruturado as formatações e etc por ser matemática, organiza
// o máximo, usa LaTeX etc". Enunciados e gabaritos das listas viviam em texto
// puro — matrizes como [[1, 2],[3, 4]], π, −, × — ilegível para quem está
// estudando (pior ainda com TDAH). Isto renderiza:
//
//   1. $$...$$ e $...$ → KaTeX (o tutor já escreve LaTeX — route.ts:407);
//   2. [[a, b],[c, d]] → \begin{bmatrix} (KaTeX — a matriz vira MATRIZ);
//   3. símbolos unicode dentro de math (π − × · √ ≤ ≥ ≠ ∈ Σ → ∧ ∨ ⇔) viram
//      LaTeX válido (KaTeX rejeita unicode — sem isso renderizava em vermelho);
//   4. todo o resto é texto plano SEGURO (HTML escapado, nunca executa).
//
// Aplicado em: Treino Guiado, Treino Espelhado, Praticar (lista + detalhe),
// Simulado (enunciado + dica), Revisão e flashcards.

import * as React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

/** Símbolos unicode do acervo → LaTeX válido (usado SÓ dentro de math). */
const SYMBOLS: [RegExp, string][] = [
  [/π/g, '\\pi '],
  [/−/g, '-'], // unicode minus (U+2212)
  [/×/g, '\\times '],
  [/·/g, '\\cdot '],
  [/√/g, '\\sqrt '],
  [/≤/g, '\\le '],
  [/≥/g, '\\ge '],
  [/≠/g, '\\ne '],
  [/∈/g, '\\in '],
  [/Σ/g, '\\sum '],
  [/∀/g, '\\forall '],
  [/∞/g, '\\infty '],
  [/→/g, '\\to '],
  [/⇒/g, '\\Rightarrow '],
  [/⇔/g, '\\iff '],
  [/∧/g, '\\land '],
  [/∨/g, '\\lor '],
  [/~/g, '\\neg '],
  // super/subscritos unicode (celulas de matriz legadas: z², a₂ₖ, Aᵗ…)
  [/⁻¹/g, '^{-1}'],
  [/²/g, '^2'],
  [/³/g, '^3'],
  [/⁴/g, '^4'],
  [/ⁿ/g, '^n'],
  [/ᵗ/g, '^t'],
  [/ᵀ/g, '^T'],
  [/ᵢ/g, '_i'],
  [/ⱼ/g, '_j'],
  [/ₖ/g, '_k'],
  [/₁/g, '_1'],
  [/₂/g, '_2'],
  [/₃/g, '_3'],
  [/₄/g, '_4'],
  [/₅/g, '_5'],
];

function toLatexSymbols(s: string): string {
  let out = s;
  for (const [re, rep] of SYMBOLS) out = out.replace(re, rep);
  return out;
}

/** Inner de [[...]] → LaTeX bmatrix (linha por row, & por coluna). */
function matrixToLatex(inner: string): string {
  const rows = inner
    .split(/\]\s*,\s*\[/)
    .map((row) =>
      row
        .split(',')
        .map((cell) => {
          const safe = cell
            .trim()
            .replace(/\\/g, '')
            .replace(/([&%#_])/g, '\\$1');
          return toLatexSymbols(safe) || '\\;';
        })
        .join(' & '),
    );
  return `\\begin{bmatrix}${rows.join(' \\\\ ')}\\end{bmatrix}`;
}

function katexHtml(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      strict: false,
      displayMode: display,
    });
  } catch {
    return escapeHtml(latex); // última linha de defesa — nunca quebra a página
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOKEN = '\uE000';
const TOKEN_END = '\uE001';

/** Pipeline: $$ → $ → matrizes [[..]] → escapa o resto → reinjeta o KaTeX. */
function renderMathHtml(text: string): string {
  const maths: string[] = [];
  const tokenized = text
    // 1) display $$...$$
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner: string) => {
      maths.push(
        `<span class="block overflow-x-auto py-0.5">${katexHtml(inner, true)}</span>`,
      );
      return `${TOKEN}${maths.length - 1}${TOKEN_END}`;
    })
    // 2) inline $...$ — sem quebra de linha, primeiro char real (evita "R$ 5 e R$ 3")
    .replace(/\$([^$\s][^$\n]*?)\$/g, (_m, inner: string) => {
      maths.push(katexHtml(inner, false));
      return `${TOKEN}${maths.length - 1}${TOKEN_END}`;
    })
    // 3) matrizes [[a, b],[c, d]] — o padrão do acervo das listas.
    //    Tempered dot: o inner é qualquer coisa que não inicie ']]' — os
    //    separadores "],[" entre linhas têm colchetes DOS DOIS lados.
    .replace(/\[\[((?:(?!\]\])[\s\S])*?)\]\]/g, (_m, inner: string) => {
      maths.push(katexHtml(matrixToLatex(inner), false));
      return `${TOKEN}${maths.length - 1}${TOKEN_END}`;
    });

  const escaped = escapeHtml(tokenized);
  return escaped.replace(
    new RegExp(`${TOKEN}(\\d+)${TOKEN_END}`, 'g'),
    (_m, i: string) => maths[Number(i)] ?? '',
  );
}

/**
 * Texto com matemática renderizada. Renderiza como <span> (o pai decide o
 * display) — passar "block" no className quando precisar virar bloco.
 */
export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const html = React.useMemo(() => renderMathHtml(text), [text]);
  return (
    <span
      className={cn('whitespace-pre-wrap', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
