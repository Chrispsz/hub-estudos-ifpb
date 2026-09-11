// code-highlight — tokenizer leve para as linguagens do curso (C, Portugol, HTML)
//
// Zero dependências: um mini-lexer feito à mão, suficiente para snippets curtos
// do Tutor IA. Objetivo é LEGIBILIDADE (cores por categoria), não parsing completo.
// Consumido pelo <CodeBlock> que renderiza os blocos de código do tutor.

export type CodeTokenType =
  | 'keyword'
  | 'type'
  | 'preproc'
  | 'string'
  | 'char'
  | 'number'
  | 'comment'
  | 'func'
  | 'tag'
  | 'attr'
  | 'entity'
  | 'punct'
  | 'plain';

export interface CodeToken {
  type: CodeTokenType;
  value: string;
}

export type CodeLang = 'c' | 'portugol' | 'html';

const C_KEYWORDS = new Set([
  'if', 'else', 'while', 'for', 'do', 'return', 'break', 'continue', 'switch',
  'case', 'default', 'sizeof', 'goto', 'typedef', 'struct', 'union', 'enum',
  'static', 'const', 'register', 'volatile', 'extern', 'auto', 'inline', 'restrict',
]);

const C_TYPES = new Set([
  'int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned', 'signed',
  'bool', 'size_t', 'FILE', 'NULL', 'true', 'false',
  'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
]);

const PORTUGOL_KEYWORDS = new Set([
  'ALGORITMO', 'VAR', 'INICIO', 'FIMALGORITMO', 'LEIA', 'ESCREVA',
  'SE', 'ENTAO', 'SENAO', 'FIMSE', 'ENQUANTO', 'FACA', 'FIMENQUANTO',
  'PARA', 'DE', 'ATE', 'FIMPARA', 'REPITA', 'FIMREPITA', 'INTERROMPA',
  'E', 'OU', 'NAO', 'MOD', 'DIV',
  'FUNCAO', 'PROCEDIMENTO', 'FIMFUNCAO', 'FIMPROCEDIMENTO', 'RETORNE',
]);

const PORTUGOL_TYPES = new Set([
  'INTEIRO', 'REAL', 'CARACTERE', 'LOGICO', 'VETOR', 'LITERAL',
]);

/** Mapeia a linguagem declarada no bloco markdown para um tokenizer conhecido. */
export function normalizeLang(raw?: string | null): CodeLang | null {
  const l = (raw ?? '').toLowerCase().trim();
  if (['c', 'cpp', 'c++', 'cc', 'cxx', 'h', 'hpp', 'clike'].includes(l)) return 'c';
  if (['portugol', 'pseudocodigo', 'pseudocode', 'pseudo'].includes(l)) return 'portugol';
  if (['html', 'xml', 'htm', 'xhtml'].includes(l)) return 'html';
  return null;
}

/** Rótulo amigável exibido no cabeçalho do bloco de código. */
export function langLabel(lang: CodeLang): string {
  return lang === 'c' ? 'C' : lang === 'portugol' ? 'Portugol' : 'HTML';
}

/** C e Portugol compartilham a estrutura do lexer; muda a tabela de palavras. */
function tokenizeCLike(code: string, lang: 'c' | 'portugol'): CodeToken[] {
  const tokens: CodeToken[] = [];
  const keywords = lang === 'c' ? C_KEYWORDS : PORTUGOL_KEYWORDS;
  const types = lang === 'c' ? C_TYPES : PORTUGOL_TYPES;
  const caseInsensitive = lang === 'portugol';
  const n = code.length;
  let i = 0;

  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_]/.test(c);

  while (i < n) {
    const c = code[i];

    // comentário de linha
    if (c === '/' && code[i + 1] === '/') {
      let j = i + 2;
      while (j < n && code[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // comentário de bloco /* ... */
    if (c === '/' && code[i + 1] === '*') {
      let j = i + 2;
      while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++;
      const end = j < n ? j + 2 : n;
      tokens.push({ type: 'comment', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // string "..." (com escapes)
    if (c === '"') {
      let j = i + 1;
      while (j < n && code[j] !== '"' && code[j] !== '\n') {
        if (code[j] === '\\') j++;
        j++;
      }
      const end = j < n && code[j] === '"' ? j + 1 : j;
      tokens.push({ type: 'string', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // caractere 'a' (com escapes)
    if (c === "'") {
      let j = i + 1;
      while (j < n && code[j] !== "'" && code[j] !== '\n') {
        if (code[j] === '\\') j++;
        j++;
      }
      const end = j < n && code[j] === "'" ? j + 1 : j;
      tokens.push({ type: 'char', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // diretiva de pré-processador (#include, #define) — consome a linha inteira
    if (c === '#' && lang === 'c') {
      let j = i + 1;
      while (j < n && code[j] !== '\n') j++;
      tokens.push({ type: 'preproc', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // número (decimal, float, hex 0x, sufixos f/L/u)
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9a-fA-FxX.uUlLfF]/.test(code[j])) j++;
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // identificador → palavra-chave, tipo ou chamada de função
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdent(code[j])) j++;
      const word = code.slice(i, j);
      const probe = caseInsensitive ? word.toUpperCase() : word;
      let type: CodeTokenType = 'plain';
      if (keywords.has(probe)) type = 'keyword';
      else if (types.has(probe)) type = 'type';
      else {
        let k = j;
        while (k < n && (code[k] === ' ' || code[k] === '\t')) k++;
        if (code[k] === '(') type = 'func';
      }
      tokens.push({ type, value: word });
      i = j;
      continue;
    }

    // espaços agrupados (preserva indentação)
    if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(code[j])) j++;
      tokens.push({ type: 'plain', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // pontuação e operadores agrupados — para antes de comentário/str/#/ident
    let j = i;
    while (
      j < n &&
      !/[\sA-Za-z0-9_"'#]/.test(code[j]) &&
      !(code[j] === '/' && (code[j + 1] === '/' || code[j + 1] === '*'))
    ) {
      j++;
    }
    if (j === i) j = i + 1; // garantia contra laço infinito
    tokens.push({ type: 'punct', value: code.slice(i, j) });
    i = j;
  }

  return tokens;
}

/** HTML simplificado: tags, atributos, strings, comentários e entidades. */
function tokenizeHtml(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const n = code.length;
  let i = 0;

  // texto simples até o próximo '<' ou '&'
  const pushText = () => {
    let j = i;
    while (j < n && code[j] !== '<' && code[j] !== '&') j++;
    if (j === i) j = i + 1;
    tokens.push({ type: 'plain', value: code.slice(i, j) });
    i = j;
  };

  while (i < n) {
    const c = code[i];

    if (c === '<') {
      // comentário <!-- ... -->
      if (code.startsWith('<!--', i)) {
        const end = code.indexOf('-->', i + 4);
        const stop = end === -1 ? n : end + 3;
        tokens.push({ type: 'comment', value: code.slice(i, stop) });
        i = stop;
        continue;
      }

      const next = code[i + 1] ?? '';
      if (next === '/' || /[A-Za-z]/.test(next)) {
        // abre tag: '<' ou '</' + nome
        let j = i + (next === '/' ? 2 : 1);
        let k = j;
        while (k < n && /[A-Za-z0-9:-]/.test(code[k])) k++;
        tokens.push({ type: 'punct', value: code.slice(i, j) });
        tokens.push({ type: 'tag', value: code.slice(j, k) });
        i = k;

        // interior da tag (atributos, =, strings, self-close) até '>'
        while (i < n && code[i] !== '>') {
          const ch = code[i];
          if (/\s/.test(ch)) {
            let w = i;
            while (w < n && /\s/.test(code[w])) w++;
            tokens.push({ type: 'plain', value: code.slice(i, w) });
            i = w;
          } else if (ch === '/') {
            tokens.push({ type: 'punct', value: '/' });
            i++;
          } else if (/[A-Za-z]/.test(ch) || ch === '-' || ch === '_' || ch === ':') {
            let w = i;
            while (w < n && /[A-Za-z0-9:@._-]/.test(code[w])) w++;
            tokens.push({ type: 'attr', value: code.slice(i, w) });
            i = w;
          } else if (ch === '=') {
            tokens.push({ type: 'punct', value: '=' });
            i++;
          } else if (ch === '"' || ch === "'") {
            let w = i + 1;
            while (w < n && code[w] !== ch && code[w] !== '\n') w++;
            const stop = w < n && code[w] === ch ? w + 1 : w;
            tokens.push({ type: 'string', value: code.slice(i, stop) });
            i = stop;
          } else {
            tokens.push({ type: 'punct', value: ch });
            i++;
          }
        }
        if (i < n) {
          tokens.push({ type: 'punct', value: '>' });
          i++;
        }
        continue;
      }

      pushText();
      continue;
    }

    if (c === '&') {
      const m = /^&[A-Za-z0-9#]+;/.exec(code.slice(i));
      if (m) {
        tokens.push({ type: 'entity', value: m[0] });
        i += m[0].length;
        continue;
      }
      pushText();
      continue;
    }

    pushText();
  }

  return tokens;
}

/** Tokeniza de acordo com a linguagem. Chamar só quando normalizeLang != null. */
export function tokenizeCode(code: string, lang: CodeLang): CodeToken[] {
  if (lang === 'html') return tokenizeHtml(code);
  return tokenizeCLike(code, lang);
}

/** Agrupa tokens em linhas — tokens longos (comentários de bloco) podem conter \n. */
export function tokensToLines(tokens: CodeToken[]): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const tk of tokens) {
    const parts = tk.value.split('\n');
    for (let p = 0; p < parts.length; p++) {
      if (p > 0) lines.push([]);
      if (parts[p]) lines[lines.length - 1].push({ type: tk.type, value: parts[p] });
    }
  }
  return lines;
}
