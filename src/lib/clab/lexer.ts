/**
 * Lab de Código — Lexer de C (subconjunto didático)
 * ---------------------------------------------------
 * Tokeniza o código C do curso (Algoritmos) para o parser.
 * Suporta: identificadores, palavras-chave, números (int/float, sufixo f),
 * strings e chars com escapes, comentários // e /* *\/, diretivas # (ignoradas).
 *
 * Erros são lançados como ClabSyntaxError com linha/coluna em português.
 */

export class ClabSyntaxError extends Error {
  line: number;
  col: number;
  constructor(message: string, line: number, col: number) {
    super(message);
    this.name = 'ClabSyntaxError';
    this.line = line;
    this.col = col;
  }
}

export type TokType = 'num' | 'str' | 'char' | 'id' | 'kw' | 'op' | 'eof';

export interface Tok {
  t: TokType;
  v: string;
  num?: number;
  isFloat?: boolean;
  line: number;
  col: number;
  start: number;
  end: number;
}

export const C_KEYWORDS = new Set([
  'int', 'float', 'double', 'char', 'void', 'bool', 'const',
  'if', 'else', 'while', 'do', 'for', 'return', 'break', 'continue',
  'switch', 'case', 'default', 'true', 'false', 'sizeof',
  'struct', 'typedef', 'unsigned', 'long', 'short', 'signed', 'goto',
]);

/** Operadores em ordem: os maiores primeiro (ganham do prefixo). */
const MULTI_OPS = [
  '++', '--', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||',
];
const SINGLE_OPS = '+-*/%=<>!&(){}[];,.?:';

const ESCAPES: Record<string, string> = {
  n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '0': '\0', a: '\x07', b: '\b', f: '\f', v: '\v',
};

export function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = src.length;

  const advance = (count = 1) => {
    for (let k = 0; k < count && i < n; k++) {
      if (src[i] === '\n') { line++; col = 1; } else { col++; }
      i++;
    }
  };

  const push = (t: TokType, v: string, start: number, startLine: number, startCol: number, extra?: { num?: number; isFloat?: boolean }) => {
    toks.push({ t, v, line: startLine, col: startCol, start, end: i, ...extra });
  };

  while (i < n) {
    const c = src[i];
    const start = i;
    const startLine = line;
    const startCol = col;

    // Espaços em branco
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { advance(); continue; }

    // Comentário de linha
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') advance();
      continue;
    }

    // Comentário de bloco
    if (c === '/' && src[i + 1] === '*') {
      advance(2);
      let closed = false;
      while (i < n) {
        if (src[i] === '*' && src[i + 1] === '/') { advance(2); closed = true; break; }
        advance();
      }
      if (!closed) throw new ClabSyntaxError('Comentário /* aberto e nunca fechado', startLine, startCol);
      continue;
    }

    // Diretiva de pré-processador → ignora a linha inteira (#include, #define simples...)
    if (c === '#') {
      while (i < n && src[i] !== '\n') advance();
      continue;
    }

    // String
    if (c === '"') {
      advance();
      let out = '';
      let closed = false;
      while (i < n) {
        const ch = src[i];
        if (ch === '"') { advance(); closed = true; break; }
        if (ch === '\\') {
          const esc = src[i + 1];
          if (esc in ESCAPES) { out += ESCAPES[esc]; advance(2); continue; }
          throw new ClabSyntaxError(`Escape desconhecido \\${esc ?? ''} na string`, line, col);
        }
        if (ch === '\n') throw new ClabSyntaxError('String aberta e nunca fechada (falta o ")', startLine, startCol);
        out += ch;
        advance();
      }
      if (!closed) throw new ClabSyntaxError('String aberta e nunca fechada (falta o ")', startLine, startCol);
      push('str', out, start, startLine, startCol);
      continue;
    }

    // Char
    if (c === "'") {
      advance();
      let out = '';
      let closed = false;
      while (i < n) {
        const ch = src[i];
        if (ch === "'") { advance(); closed = true; break; }
        if (ch === '\\') {
          const esc = src[i + 1];
          if (esc in ESCAPES) { out += ESCAPES[esc]; advance(2); continue; }
          throw new ClabSyntaxError(`Escape desconhecido \\${esc ?? ''} no char`, line, col);
        }
        if (ch === '\n') throw new ClabSyntaxError('Char aberto e nunca fechado (falta o \')', startLine, startCol);
        out += ch;
        advance();
      }
      if (!closed || out.length !== 1) {
        throw new ClabSyntaxError("Char precisa ter exatamente 1 caractere (ex.: 'a', '\\n', '\\0')", startLine, startCol);
      }
      push('char', out, start, startLine, startCol);
      continue;
    }

    // Número
    if (c >= '0' && c <= '9') {
      let out = '';
      let isFloat = false;
      while (i < n && src[i] >= '0' && src[i] <= '9') { out += src[i]; advance(); }
      if (src[i] === '.') {
        isFloat = true;
        out += '.';
        advance();
        if (!(src[i] >= '0' && src[i] <= '9')) {
          throw new ClabSyntaxError('Número decimal incompleto (falta o dígito depois do ponto)', startLine, startCol);
        }
        while (i < n && src[i] >= '0' && src[i] <= '9') { out += src[i]; advance(); }
      }
      // sufixo f/F (3.5f) e u/l ignorados
      if (src[i] === 'f' || src[i] === 'F') { isFloat = true; advance(); }
      else if (src[i] === 'u' || src[i] === 'U' || src[i] === 'l' || src[i] === 'L') { advance(); }
      push('num', out, start, startLine, startCol, { num: parseFloat(out), isFloat });
      continue;
    }

    // Identificador / palavra-chave
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let out = '';
      while (i < n && ((src[i] >= 'a' && src[i] <= 'z') || (src[i] >= 'A' && src[i] <= 'Z') || (src[i] >= '0' && src[i] <= '9') || src[i] === '_')) {
        out += src[i];
        advance();
      }
      push(C_KEYWORDS.has(out) ? 'kw' : 'id', out, start, startLine, startCol);
      continue;
    }

    // Operadores
    const two = src.slice(i, i + 2);
    if (MULTI_OPS.includes(two)) { advance(2); push('op', two, start, startLine, startCol); continue; }
    if (SINGLE_OPS.includes(c)) { advance(); push('op', c, start, startLine, startCol); continue; }

    throw new ClabSyntaxError(`Símbolo inesperado '${c}'`, startLine, startCol);
  }

  toks.push({ t: 'eof', v: '', line, col, start: n, end: n });
  return toks;
}
