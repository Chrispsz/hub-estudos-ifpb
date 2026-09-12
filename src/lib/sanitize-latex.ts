// sanitize-latex — converte LaTeX que modelos free soltam em texto/markdown legível.
// Usada no POST /api/tutor (resposta nova) e no GET /api/tutor/history (auto-cura
// de mensagens antigas salvas antes das correções).

export function sanitizeLatex(input: string): string {
  let out = input;

  // Matrizes: \begin{bmatrix} a & b \\ c & d \end{bmatrix} → [ a b / c d ]
  out = out.replace(
    /\\begin\{(?:b|p|v)?matrix\}([\s\S]*?)\\end\{(?:b|p|v)?matrix\}/g,
    (_m, body: string) => {
      const rows = body
        .split(/\\\\/)
        .map((r) => r.split('&').map((c) => c.trim()).filter(Boolean).join(' '))
        .filter(Boolean);
      return `[ ${rows.join(' / ')} ]`;
    },
  );

  // Símbolos comuns → unicode legível
  const symbols: Record<string, string> = {
    '\\cdot': '·', '\\times': '×', '\\div': '÷',
    '\\geq': '≥', '\\ge': '≥', '\\leq': '≤', '\\le': '≤',
    '\\neq': '≠', '\\ne': '≠', '\\pm': '±', '\\approx': '≈',
    '\\rightarrow': '→', '\\to': '→', '\\leftrightarrow': '↔',
    '\\infty': '∞', '\\sum': 'Σ',
  };
  for (const [latex, unicode] of Object.entries(symbols)) {
    out = out.split(latex).join(unicode);
  }

  // \text{...}/\mathrm{...}/\mathbf{...} → conteúdo — ANTES do \frac, para desaninhar
  // chaves (ex.: \frac{1000 \text{ m}}{3600 \text{ s}} só casa com \text já resolvido)
  out = out.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^{}]*)\}/g, '$1');

  // \frac{a}{b} → (a)/(b)  ·  \sqrt{x} → √(x) — 2 passadas (aninhamento simples)
  out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  out = out.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  out = out.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // Blocos $$...$$ e $...$ (pares) → conteúdo — R$ (moeda) protegido do pareamento
  const CUR = '\u0001CUR\u0001';
  out = out.split('R$').join(CUR);
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  out = out.replace(/\$([^$\n]+)\$/g, '$1');
  out = out.split(CUR).join('R$');

  // Delimitadores display/inline \[ \] \( \)
  out = out.split('\\[').join('').split('\\]').join('');
  out = out.split('\\(').join('').split('\\)').join('');

  return out;
}
