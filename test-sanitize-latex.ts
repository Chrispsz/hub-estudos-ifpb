// One-shot: valida sanitizeLatex pós-fix (caso real do E2E + regressões)
const src = await Bun.file('src/lib/sanitize-latex.ts').text();
const m = src.match(/function sanitizeLatex[\s\S]*?\n\}/);
if (!m) { console.error('sanitizeLatex não encontrada'); process.exit(1); }
const js = new Bun.Transpiler({ loader: "ts" }).transformSync(m[0]);
const sanitizeLatex = new Function(`${js}; return sanitizeLatex;`)() as (s: string) => string;

let pass = 0, fail = 0;
const t = (name: string, got: string, want: string) => {
  if (got === want) { pass++; }
  else { fail++; console.log(`✗ ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); }
};

// CASO REAL do E2E: \frac com \text aninhado (bug do vazamento)
t('frac+text aninhado', sanitizeLatex('1 km/h = \\frac{1000 \\text{ m}}{3600 \\text{ s}}'), '1 km/h = (1000  m)/(3600  s)');
t('frac simples', sanitizeLatex('\\frac{5}{18} m/s'), '(5)/(18) m/s');
t('frac duplo aninhado 2 níveis', sanitizeLatex('\\frac{\\frac{a}{b}}{2}'), '((a)/(b))/(2)');
t('sqrt com text', sanitizeLatex('\\sqrt{\\text{area}}'), '√(area)');
t('sqrt dupla', sanitizeLatex('\\sqrt{\\sqrt{16}}'), '√(√(16))');
t('matriz', sanitizeLatex('\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}'), '[ 1 2 / 3 4 ]');
t('simbolos', sanitizeLatex('a \\times b \\geq c'), 'a × b ≥ c');
t('dollar par', sanitizeLatex('$x + 1$ ok'), 'x + 1 ok');
t('display delims', sanitizeLatex('\\[ E = mc^2 \\]'), ' E = mc^2 ');
t('sem latex intacto', sanitizeLatex('Use scanf("%d", &n) e printf'), 'Use scanf("%d", &n) e printf');
// R$ preservado (regra antiga)
t('R$ preservado', sanitizeLatex('custa R$ 50 e $y$'), 'custa R$ 50 e y');
console.log(`\nResultado: ${pass} passou, ${fail} falhou`);
process.exit(fail ? 1 : 0);
