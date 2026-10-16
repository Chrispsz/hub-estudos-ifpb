/**
 * Lab de Código — Parser de C (subconjunto didático) + anotação de tipos
 * ------------------------------------------------------------------------
 * Gera a AST e depois roda a passada de anotação, que:
 *  - confere variáveis declaradas antes do uso (com mensagem amigável);
 *  - confere funções existentes e nº de argumentos;
 *  - anota o tipo estático de cada expressão (int/float/double/char/bool)
 *    → o interpretador usa isso para divisão inteira vs. real, % e conversões.
 *
 * Suporta: main + funções (recursão), globais, int/float/double/char/bool/void,
 * vetores 1D/2D, strings (char[]), if/else, while, do-while, for, switch,
 * break/continue/return, ++/--, compostos, ternário, casts, sizeof,
 * printf/scanf e as funções do material (strlen, strcpy, strcmp, sqrt...).
 */
import { lex, ClabSyntaxError, type Tok } from './lexer';

export type BType = 'int' | 'float' | 'double' | 'char' | 'bool' | 'void';
export type AnnType = BType | 'string';

export interface Declarator {
  name: string;
  line: number;
  dims: Expr[];              // [] = escalar; ex.: [n] = 1D; [3][3] = 2D (avaliados na execução)
  init?: Expr;               // = expressão
  initList?: Expr[][];       // = { ... } (linhas para 2D; [0] para 1D)
  strInit?: string;          // char s[] = "texto"
}

export interface Param {
  name: string;
  base: BType;
  isArray: boolean;
  line: number;
}

export interface FnDef {
  name: string;
  ret: BType;
  params: Param[];
  body: Stmt[];
  line: number;
}

export interface Program {
  globals: { base: BType; decls: Declarator[]; line: number }[];
  fns: FnDef[];
}

export type Stmt =
  | { k: 'decl'; line: number; text: string; base: BType; decls: Declarator[] }
  | { k: 'expr'; line: number; text: string; e: Expr }
  | { k: 'if'; line: number; text: string; cond: Expr; then: Stmt; els?: Stmt }
  | { k: 'while'; line: number; text: string; cond: Expr; body: Stmt }
  | { k: 'dowhile'; line: number; text: string; cond: Expr; body: Stmt }
  | { k: 'for'; line: number; text: string; init: Stmt | null; cond: Expr | null; update: Expr | null; body: Stmt }
  | { k: 'return'; line: number; text: string; e: Expr | null }
  | { k: 'break'; line: number; text: string }
  | { k: 'continue'; line: number; text: string }
  | { k: 'switch'; line: number; text: string; disc: Expr; cases: { match: Expr | null; start: number; line: number }[]; body: Stmt[] }
  | { k: 'block'; line: number; text: string; stmts: Stmt[] }
  | { k: 'empty'; line: number; text: string };

export type Expr =
  | { k: 'num'; v: number; isFloat: boolean; line: number; t?: AnnType }
  | { k: 'str'; v: string; line: number; t?: AnnType }
  | { k: 'char'; v: string; line: number; t?: AnnType }
  | { k: 'id'; name: string; line: number; t?: AnnType; isArray?: boolean }
  | { k: 'un'; op: '-' | '+' | '!'; e: Expr; line: number; t?: AnnType }
  | { k: 'incdec'; op: '++' | '--'; postfix: boolean; e: Expr; line: number; t?: AnnType }
  | { k: 'bin'; op: string; l: Expr; r: Expr; line: number; t?: AnnType }
  | { k: 'logic'; op: '&&' | '||'; l: Expr; r: Expr; line: number; t?: AnnType }
  | { k: 'assign'; op: string; lhs: Expr; rhs: Expr; line: number; t?: AnnType }
  | { k: 'ternary'; c: Expr; a: Expr; b: Expr; line: number; t?: AnnType }
  | { k: 'call'; name: string; args: Expr[]; line: number; t?: AnnType }
  | { k: 'index'; arr: Expr; idx: Expr; line: number; t?: AnnType }
  | { k: 'cast'; base: BType; e: Expr; line: number; t?: AnnType }
  | { k: 'sizeof'; target: { type: BType } | { name: string }; line: number; t?: AnnType }
  | { k: 'addr'; e: Expr; line: number; t?: AnnType };

export class ClabParseError extends Error {
  line: number;
  col: number;
  constructor(message: string, line: number, col: number) {
    super(message);
    this.name = 'ClabParseError';
    this.line = line;
    this.col = col;
  }
}

const BASE_TYPES = new Set(['int', 'float', 'double', 'char', 'bool', 'void']);

/** Funções nativas suportadas (para conferência na anotação). */
export const BUILTIN_FNS: Record<string, number> = {
  printf: -1, scanf: -1, puts: 1,
  strlen: 1, strcpy: 2, strncpy: 3, strcmp: 2, strcat: 2,
  toupper: 1, tolower: 1, abs: 1, fabs: 1,
  sqrt: 1, pow: 2, floor: 1, ceil: 1, round: 1,
  srand: 1, rand: 0, getchar: 0,
  system: 1, fflush: 1,
};

class Parser {
  private toks: Tok[];
  private pos = 0;
  private src: string;
  private loopDepth = 0;
  private switchDepth = 0;

  constructor(src: string) {
    this.src = src;
    this.toks = lex(src);
  }

  private peek(offset = 0): Tok { return this.toks[Math.min(this.pos + offset, this.toks.length - 1)]; }
  private next(): Tok { const t = this.toks[this.pos]; if (t.t !== 'eof') this.pos++; return t; }
  private atOp(v: string, offset = 0): boolean { const t = this.peek(offset); return t.t === 'op' && t.v === v; }
  private atKw(v: string, offset = 0): boolean { const t = this.peek(offset); return t.t === 'kw' && t.v === v; }
  private eatOp(v: string): boolean { if (this.atOp(v)) { this.next(); return true; } return false; }
  private eatKw(v: string): boolean { if (this.atKw(v)) { this.next(); return true; } return false; }
  private expectOp(v: string): Tok {
    if (!this.atOp(v)) {
      const t = this.peek();
      throw new ClabParseError(`Esperava '${v}' mas encontrei ${t.t === 'eof' ? 'o fim do código' : `'${t.v}'`}`, t.line, t.col);
    }
    return this.next();
  }
  private expectId(): Tok {
    const t = this.peek();
    if (t.t !== 'id') {
      throw new ClabParseError(`Esperava um nome, mas encontrei ${t.t === 'eof' ? 'o fim do código' : `'${t.v}'`}`, t.line, t.col);
    }
    return this.next();
  }

  /** Texto do trecho fonte entre dois offsets (para a nota do passo). */
  private slice(from: number, to: number): string {
    return this.src.slice(from, to).replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  private isTypeStart(): boolean {
    const t = this.peek();
    if (t.t === 'kw' && BASE_TYPES.has(t.v)) return true;
    if (t.t === 'kw' && t.v === 'const') return true;
    if (t.t === 'kw' && (t.v === 'unsigned' || t.v === 'long' || t.v === 'short' || t.v === 'signed')) return true;
    return false;
  }

  private parseBase(): BType {
    this.eatKw('const');
    if (this.eatKw('unsigned') || this.eatKw('signed')) {
      this.eatKw('long'); this.eatKw('short'); this.eatKw('int');
      return 'int';
    }
    if (this.eatKw('long')) { this.eatKw('long'); this.eatKw('double'); this.eatKw('int'); return 'double'; }
    if (this.eatKw('short')) { this.eatKw('int'); return 'int'; }
    const t = this.peek();
    if (t.t === 'kw' && BASE_TYPES.has(t.v)) { this.next(); return t.v as BType; }
    throw new ClabParseError(`Esperava um tipo (int, float, double, char, bool, void) mas encontrei '${t.v || 'fim do código'}'`, t.line, t.col);
  }

  /** Detecta '*' (ponteiros) para dar mensagem didática. */
  private rejectPointer() {
    if (this.atOp('*')) {
      const t = this.peek();
      throw new ClabParseError('Ponteiros (*) ainda não são suportados no Lab — o curso cobre eles mais adiante. Use vetores e & apenas no scanf.', t.line, t.col);
    }
  }

  parseProgram(): Program {
    const prog: Program = { globals: [], fns: [] };
    while (this.peek().t !== 'eof') {
      if (this.eatOp(';')) continue; // ';'
      const startTok = this.peek();
      const base = this.parseBase();
      this.rejectPointer();
      const nameTok = this.expectId();
      if (this.atOp('(')) {
        // função (parseParams consome o próprio '(')
        const params = this.parseParams();
        const body = this.parseBlock();
        prog.fns.push({ name: nameTok.v, ret: base, params, body, line: nameTok.line });
      } else {
        const decls = this.parseDeclarators(nameTok, base);
        this.expectOp(';');
        prog.globals.push({ base, decls, line: startTok.line });
      }
    }
    if (!prog.fns.some((f) => f.name === 'main')) {
      throw new ClabParseError('Não encontrei a função main(). Todo programa precisa de um int main() { ... }', 1, 1);
    }
    return prog;
  }

  private parseParams(): Param[] {
    this.expectOp('(');
    const params: Param[] = [];
    if (this.eatOp(')')) return params;
    if (this.atKw('void') && this.atOp(')', 1)) { this.next(); this.next(); return params; }
    do {
      const base = this.parseBase();
      this.rejectPointer();
      const nameTok = this.expectId();
      let isArray = false;
      while (this.eatOp('[')) {
        if (!this.atOp(']')) this.parseAssignExpr(); // tamanho ignorado no parâmetro
        this.expectOp(']');
        isArray = true;
      }
      params.push({ name: nameTok.v, base, isArray, line: nameTok.line });
    } while (this.eatOp(','));
    this.expectOp(')');
    return params;
  }

  private parseDeclarators(first: Tok, base: BType): Declarator[] {
    const decls: Declarator[] = [];
    let nameTok = first;
    do {
      if (decls.length > 0) nameTok = this.expectId();
      const dims: Expr[] = [];
      while (this.eatOp('[')) {
        if (!this.atOp(']')) dims.push(this.parseAssignExpr());
        else dims.push({ k: 'num', v: 0, isFloat: false, line: nameTok.line }); // [] vazio → resolvido pelo init
        this.expectOp(']');
      }
      const d: Declarator = { name: nameTok.v, line: nameTok.line, dims };
      if (this.eatOp('=')) {
        if (this.atOp('{')) {
          d.initList = this.parseInitList();
          if (base === 'char' && dims.length === 0) {
            throw new ClabParseError(`Para texto em char use aspas: char ${d.name}[] = "texto";`, nameTok.line, nameTok.col);
          }
        } else {
          const t = this.peek();
          if (t.t === 'str') {
            if (base !== 'char') throw new ClabParseError(`Só variáveis char[] guardam texto — '${d.name}' é ${base}`, t.line, t.col);
            d.strInit = this.next().v;
          } else {
            d.init = this.parseAssignExpr();
          }
        }
      }
      decls.push(d);
    } while (this.eatOp(','));
    return decls;
  }

  private parseInitList(): Expr[][] {
    this.expectOp('{');
    const rows: Expr[][] = [];
    const flat: Expr[] = [];
    let sawBraced = false;
    if (!this.atOp('}')) {
      do {
        if (this.atOp('{')) {
          sawBraced = true;
          rows.push(this.parseInnerList());
        } else {
          if (sawBraced) {
            const t = this.peek();
            throw new ClabParseError('Não misture valores soltos com { } no inicializador — use tudo dentro de { }', t.line, t.col);
          }
          flat.push(this.parseAssignExpr());
        }
      } while (this.eatOp(','));
    }
    this.expectOp('}');
    return flat.length > 0 ? [flat] : rows;
  }

  private parseInnerList(): Expr[] {
    this.expectOp('{');
    const items: Expr[] = [];
    if (!this.atOp('}')) {
      do { items.push(this.parseAssignExpr()); } while (this.eatOp(','));
    }
    this.expectOp('}');
    return items;
  }

  private parseBlock(): Stmt[] {
    const open = this.expectOp('{');
    const stmts: Stmt[] = [];
    while (!this.atOp('}') && this.peek().t !== 'eof') {
      stmts.push(this.parseStmt());
    }
    if (this.peek().t === 'eof') {
      throw new ClabParseError(`Faltou fechar o bloco com '}' (o { foi aberto na linha ${open.line})`, this.peek().line, this.peek().col);
    }
    this.expectOp('}');
    return stmts;
  }

  private parseStmt(): Stmt {
    const startTok = this.peek();
    const mark = startTok.start;

    if (this.eatOp('{')) {
      this.pos--; // volta o '{' para o parseBlock
      const stmts = this.parseBlock();
      return { k: 'block', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), stmts };
    }
    if (this.eatOp(';')) return { k: 'empty', line: startTok.line, text: ';' };

    if (this.atKw('if')) {
      this.next();
      this.expectOp('(');
      const cond = this.parseExpr();
      this.expectOp(')');
      const then = this.parseStmt();
      let els: Stmt | undefined;
      if (this.eatKw('else')) els = this.parseStmt();
      return { k: 'if', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), cond, then, els };
    }
    if (this.atKw('while')) {
      this.next();
      this.expectOp('(');
      const cond = this.parseExpr();
      this.expectOp(')');
      this.loopDepth++;
      const body = this.parseStmt();
      this.loopDepth--;
      return { k: 'while', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), cond, body };
    }
    if (this.atKw('do')) {
      this.next();
      this.loopDepth++;
      const body = this.parseStmt();
      this.loopDepth--;
      if (!this.eatKw('while')) {
        const t = this.peek();
        throw new ClabParseError("do { ... } precisa do 'while (condição);' no final", t.line, t.col);
      }
      this.expectOp('(');
      const cond = this.parseExpr();
      this.expectOp(')');
      this.expectOp(';');
      return { k: 'dowhile', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), cond, body };
    }
    if (this.atKw('for')) {
      this.next();
      this.expectOp('(');
      let init: Stmt | null = null;
      if (!this.atOp(';')) {
        if (this.isTypeStart()) {
          const base = this.parseBase();
          const nameTok = this.expectId();
          const decls = this.parseDeclarators(nameTok, base);
          init = { k: 'decl', line: nameTok.line, text: this.slice(startTok.start, this.toks[this.pos - 1].end), base, decls };
        } else {
          const e = this.parseExpr();
          init = { k: 'expr', line: startTok.line, text: this.slice(startTok.start, this.toks[this.pos - 1].end), e };
        }
      }
      this.expectOp(';');
      const cond = this.atOp(';') ? null : this.parseExpr();
      this.expectOp(';');
      const update = this.atOp(')') ? null : this.parseExpr();
      this.expectOp(')');
      this.loopDepth++;
      const body = this.parseStmt();
      this.loopDepth--;
      return { k: 'for', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), init, cond, update, body };
    }
    if (this.atKw('return')) {
      this.next();
      let e: Expr | null = null;
      if (!this.atOp(';')) e = this.parseExpr();
      this.expectOp(';');
      return { k: 'return', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), e };
    }
    if (this.atKw('break')) {
      this.next();
      this.expectOp(';');
      if (this.loopDepth === 0 && this.switchDepth === 0) {
        throw new ClabParseError('break só funciona dentro de laço (for/while/do) ou switch', startTok.line, startTok.col);
      }
      return { k: 'break', line: startTok.line, text: 'break;' };
    }
    if (this.atKw('continue')) {
      this.next();
      this.expectOp(';');
      if (this.loopDepth === 0) {
        throw new ClabParseError('continue só funciona dentro de laço (for/while/do)', startTok.line, startTok.col);
      }
      return { k: 'continue', line: startTok.line, text: 'continue;' };
    }
    if (this.atKw('switch')) {
      this.next();
      this.expectOp('(');
      const disc = this.parseExpr();
      this.expectOp(')');
      this.expectOp('{');
      const cases: { match: Expr | null; start: number; line: number }[] = [];
      const body: Stmt[] = [];
      this.switchDepth++;
      while (!this.atOp('}') && this.peek().t !== 'eof') {
        if (this.atKw('case')) {
          this.next();
          const m = this.parseAssignExpr();
          this.expectOp(':');
          cases.push({ match: m, start: body.length, line: startTok.line });
        } else if (this.atKw('default')) {
          this.next();
          this.expectOp(':');
          cases.push({ match: null, start: body.length, line: startTok.line });
        } else {
          body.push(this.parseStmt());
        }
      }
      this.switchDepth--;
      this.expectOp('}');
      return { k: 'switch', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), disc, cases, body };
    }

    // Declaração local
    if (this.isTypeStart()) {
      const base = this.parseBase();
      this.rejectPointer();
      const nameTok = this.expectId();
      const decls = this.parseDeclarators(nameTok, base);
      this.expectOp(';');
      return { k: 'decl', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), base, decls };
    }

    // Expressão
    const e = this.parseExpr();
    this.expectOp(';');
    return { k: 'expr', line: startTok.line, text: this.slice(mark, this.toks[this.pos - 1].end), e };
  }

  // ---------- expressões ----------

  private parseExpr(): Expr {
    let e = this.parseAssignExpr();
    if (this.atOp(',')) {
      // expressão com vírgula: executa tudo, usa o último
      while (this.eatOp(',')) {
        const r = this.parseAssignExpr();
        e = { k: 'bin', op: ',', l: e, r, line: e.line };
      }
    }
    return e;
  }

  private parseAssignExpr(): Expr {
    const lhs = this.parseTernary();
    const t = this.peek();
    if (t.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%='].includes(t.v)) {
      this.next();
      const rhs = this.parseAssignExpr();
      if (lhs.k !== 'id' && lhs.k !== 'index') {
        throw new ClabParseError('Do lado esquerdo do = precisa de uma variável (ex.: x = ... ou v[i] = ...)', t.line, t.col);
      }
      return { k: 'assign', op: t.v, lhs, rhs, line: t.line };
    }
    return lhs;
  }

  private parseTernary(): Expr {
    const c = this.parseBin(0);
    if (this.atOp('?')) {
      this.next();
      const a = this.parseAssignExpr();
      this.expectOp(':');
      const b = this.parseAssignExpr();
      return { k: 'ternary', c, a, b, line: c.line };
    }
    return c;
  }

  private static LEVELS: string[][] = [
    ['||'], ['&&'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%'],
  ];

  private parseBin(level: number): Expr {
    if (level >= Parser.LEVELS.length) return this.parseUnary();
    let l = this.parseBin(level + 1);
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && Parser.LEVELS[level].includes(t.v)) {
        this.next();
        const r = this.parseBin(level + 1);
        if (t.v === '&&' || t.v === '||') {
          l = { k: 'logic', op: t.v as '&&' | '||', l, r, line: t.line };
        } else {
          l = { k: 'bin', op: t.v, l, r, line: t.line };
        }
      } else return l;
    }
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!')) {
      this.next();
      const e = this.parseUnary();
      return { k: 'un', op: t.v as '-' | '+' | '!', e, line: t.line };
    }
    if (t.t === 'op' && (t.v === '++' || t.v === '--')) {
      this.next();
      const e = this.parseUnary();
      if (e.k !== 'id' && e.k !== 'index') {
        throw new ClabParseError(`${t.v} precisa de uma variável (ex.: i++ ou v[i]++)`, t.line, t.col);
      }
      return { k: 'incdec', op: t.v as '++' | '--', postfix: false, e, line: t.line };
    }
    if (t.t === 'op' && t.v === '&') {
      this.next();
      const e = this.parseUnary();
      if (e.k !== 'id' && e.k !== 'index') {
        throw new ClabParseError('& só faz sentido em variável (ex.: &x ou &v[0]) — é o endereço dela', t.line, t.col);
      }
      return { k: 'addr', e, line: t.line };
    }
    if (t.t === 'op' && t.v === '(') {
      // cast (int)x? — se o próximo token é tipo, é cast
      const inner = this.peek(1);
      if (inner.t === 'kw' && BASE_TYPES.has(inner.v)) {
        this.next();
        const base = this.parseBase();
        this.rejectPointer();
        this.expectOp(')');
        const e = this.parseUnary();
        return { k: 'cast', base, e, line: t.line };
      }
    }
    if (t.t === 'kw' && t.v === 'sizeof') {
      this.next();
      this.expectOp('(');
      if (this.isTypeStart()) {
        const base = this.parseBase();
        this.expectOp(')');
        return { k: 'sizeof', target: { type: base }, line: t.line };
      }
      const nameTok = this.expectId();
      this.expectOp(')');
      return { k: 'sizeof', target: { name: nameTok.v }, line: t.line };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && t.v === '[') {
        this.next();
        const idx = this.parseExpr();
        this.expectOp(']');
        e = { k: 'index', arr: e, idx, line: t.line };
      } else if (t.t === 'op' && t.v === '(' && e.k === 'id') {
        this.next();
        const args: Expr[] = [];
        if (!this.atOp(')')) {
          do { args.push(this.parseAssignExpr()); } while (this.eatOp(','));
        }
        this.expectOp(')');
        e = { k: 'call', name: e.name, args, line: t.line };
      } else if (t.t === 'op' && (t.v === '++' || t.v === '--')) {
        this.next();
        if (e.k !== 'id' && e.k !== 'index') {
          throw new ClabParseError(`${t.v} precisa de uma variável (ex.: i++ ou v[i]++)`, t.line, t.col);
        }
        e = { k: 'incdec', op: t.v as '++' | '--', postfix: true, e, line: t.line };
      } else return e;
    }
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.t === 'num') { this.next(); return { k: 'num', v: t.num ?? 0, isFloat: !!t.isFloat, line: t.line }; }
    if (t.t === 'str') { this.next(); return { k: 'str', v: t.v, line: t.line }; }
    if (t.t === 'char') { this.next(); return { k: 'char', v: t.v, line: t.line }; }
    if (t.t === 'id') { this.next(); return { k: 'id', name: t.v, line: t.line }; }
    if (t.t === 'kw' && (t.v === 'true' || t.v === 'false')) {
      this.next();
      return { k: 'num', v: t.v === 'true' ? 1 : 0, isFloat: false, line: t.line };
    }
    if (t.t === 'op' && t.v === '(') {
      this.next();
      const e = this.parseExpr();
      this.expectOp(')');
      return e;
    }
    throw new ClabParseError(`Não entendi '${t.t === 'eof' ? 'o fim do código' : t.v}' aqui — esperava um valor, variável ou expressão`, t.line, t.col);
  }
}

// ============================================================================
// Passada de anotação — tipos estáticos + conferências amigáveis
// ============================================================================

type Scope = Map<string, { base: BType; isArray: boolean }>;

function promote(a?: AnnType, b?: AnnType): AnnType {
  if (a === 'double' || b === 'double') return 'double';
  if (a === 'float' || b === 'float') return 'float';
  if (a === 'string' || b === 'string') return 'string';
  if (a === 'char' || b === 'char') return 'char';
  return 'int';
}

class Annotator {
  private fns = new Map<string, FnDef>();

  run(prog: Program) {
    for (const f of prog.fns) {
      if (this.fns.has(f.name)) {
        throw new ClabParseError(`Função '${f.name}' declarada duas vezes`, f.line, 1);
      }
      this.fns.set(f.name, f);
    }
    const globalScope: Scope = new Map();
    for (const g of prog.globals) {
      for (const d of g.decls) {
        if (globalScope.has(d.name)) {
          throw new ClabParseError(`Variável global '${d.name}' declarada duas vezes`, d.line, 1);
        }
        globalScope.set(d.name, { base: g.base, isArray: d.dims.length > 0 || !!d.strInit });
        if (d.init) this.expr(d.init, [globalScope]);
        if (d.initList) for (const row of d.initList) for (const e of row) this.expr(e, [globalScope]);
      }
    }
    for (const f of prog.fns) {
      const scope: Scope = new Map();
      for (const p of f.params) {
        if (scope.has(p.name)) throw new ClabParseError(`Parâmetro '${p.name}' repetido em ${f.name}()`, f.line, 1);
        scope.set(p.name, { base: p.base, isArray: p.isArray });
      }
      this.stmts(f.body, [globalScope, scope], f);
    }
  }

  private stmts(list: Stmt[], scopes: Scope[], f: FnDef) {
    for (const s of list) this.stmt(s, scopes, f);
  }

  private stmt(s: Stmt, scopes: Scope[], f: FnDef) {
    switch (s.k) {
      case 'decl': {
        const top = scopes[scopes.length - 1];
        for (const d of s.decls) {
          if (d.init) this.expr(d.init, scopes);
          if (d.initList) for (const row of d.initList) for (const e of row) this.expr(e, scopes);
          if (top.has(d.name)) {
            throw new ClabParseError(`Variável '${d.name}' já existe — escolha outro nome (ou reutilize a que existe)`, d.line, 1);
          }
          top.set(d.name, { base: s.base, isArray: d.dims.length > 0 || !!d.strInit });
        }
        break;
      }
      case 'expr': this.expr(s.e, scopes); break;
      case 'if':
        this.expr(s.cond, scopes);
        this.stmt(s.then, scopes, f);
        if (s.els) this.stmt(s.els, scopes, f);
        break;
      case 'while': this.expr(s.cond, scopes); this.stmt(s.body, scopes, f); break;
      case 'dowhile': this.expr(s.cond, scopes); this.stmt(s.body, scopes, f); break;
      case 'for': {
        const inner: Scope = new Map();
        const ss = [...scopes, inner];
        if (s.init) this.stmt(s.init, ss, f);
        if (s.cond) this.expr(s.cond, ss);
        if (s.update) this.expr(s.update, ss);
        this.stmt(s.body, ss, f);
        break;
      }
      case 'return':
        if (s.e) {
          const t = this.expr(s.e, scopes);
          if (f.ret === 'void') {
            throw new ClabParseError(`${f.name}() é void (não retorna nada) — não pode ter return com valor`, s.line, 1);
          }
          if (t === 'string') {
            throw new ClabParseError('return não devolve texto direto — copie para um char[] e devolva via parâmetro vetor', s.line, 1);
          }
        } else if (f.ret !== 'void') {
          throw new ClabParseError(`${f.name}() promete retornar ${f.ret} — o return precisa de um valor`, s.line, 1);
        }
        break;
      case 'switch':
        this.expr(s.disc, scopes);
        for (const c of s.cases) if (c.match) this.expr(c.match, scopes);
        this.stmts(s.body, scopes, f);
        break;
      case 'block': this.stmts(s.stmts, scopes, f); break;
      default: break;
    }
  }

  private lookup(scopes: Scope[], name: string): { base: BType; isArray: boolean } | null {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const hit = scopes[i].get(name);
      if (hit) return hit;
    }
    return null;
  }

  private expr(e: Expr, scopes: Scope[]): AnnType {
    switch (e.k) {
      case 'num': e.t = e.isFloat ? 'double' : 'int'; return e.t;
      case 'str': e.t = 'string'; return e.t;
      case 'char': e.t = 'char'; return e.t;
      case 'id': {
        const hit = this.lookup(scopes, e.name);
        if (!hit) {
          const fns = [...Object.keys(BUILTIN_FNS), ...this.fns.keys()].slice(0, 6).join(', ');
          throw new ClabParseError(`Variável '${e.name}' não existe — declare antes (ex.: int ${e.name};). Funções conhecidas: ${fns}...`, e.line, 1);
        }
        if (hit.isArray) e.isArray = true;
        e.t = hit.base;
        return e.t;
      }
      case 'un': {
        const t = this.expr(e.e, scopes);
        if (t === 'string') throw new ClabParseError("Não dá para usar texto aqui — textos não fazem conta direta (use strcmp/strlen)", e.line, 1);
        e.t = e.op === '!' ? 'int' : t;
        return e.t;
      }
      case 'incdec': {
        const t = this.expr(e.e, scopes);
        if (t === 'string') throw new ClabParseError(`++/-- não funciona em texto`, e.line, 1);
        e.t = t;
        return e.t;
      }
      case 'index': {
        const at = this.expr(e.arr, scopes);
        const it = this.expr(e.idx, scopes);
        if (it === 'double' || it === 'float' || it === 'string') {
          throw new ClabParseError('O índice do vetor precisa ser um número inteiro (ex.: v[i], não v[1.5] nem v["a"])', e.line, 1);
        }
        e.t = at === 'string' ? 'char' : at;
        return e.t;
      }
      case 'bin': {
        const lt = this.expr(e.l, scopes);
        const rt = this.expr(e.r, scopes);
        if (e.op === ',') { e.t = rt; return rt; }
        if (lt === 'string' || rt === 'string') {
          throw new ClabParseError(`Texto não faz '${e.op}' direto — use strcmp(a, b) para comparar ou strcat(a, b) para juntar`, e.line, 1);
        }
        if (e.op === '%') {
          if (lt === 'double' || lt === 'float' || rt === 'double' || rt === 'float') {
            throw new ClabParseError("O operador % (resto) só funciona com inteiros — para decimais use fmod ou repense a conta", e.line, 1);
          }
          e.t = 'int';
          return 'int';
        }
        if (e.op === '/') {
          const p = promote(lt, rt);
          e.t = p;
          return p;
        }
        e.t = promote(lt, rt);
        return e.t;
      }
      case 'logic': {
        this.expr(e.l, scopes);
        this.expr(e.r, scopes);
        e.t = 'int';
        return 'int';
      }
      case 'assign': {
        const lt = this.expr(e.lhs, scopes);
        const rt = this.expr(e.rhs, scopes);
        if (rt === 'string' && lt !== 'string') {
          if (lt === 'char' && e.lhs.k === 'index') {
            throw new ClabParseError("Para guardar texto use o vetor inteiro: strcpy(nome, texto);", e.line, 1);
          }
          throw new ClabParseError("Não dá para guardar texto em variável numérica", e.line, 1);
        }
        e.t = lt;
        return lt;
      }
      case 'ternary': {
        this.expr(e.c, scopes);
        const a = this.expr(e.a, scopes);
        const b = this.expr(e.b, scopes);
        e.t = promote(a, b);
        return e.t;
      }
      case 'cast': {
        const t = this.expr(e.e, scopes);
        if (t === 'string' && e.base !== 'char') {
          throw new ClabParseError('Cast em texto não suportado', e.line, 1);
        }
        e.t = e.base;
        return e.base;
      }
      case 'sizeof': e.t = 'int'; return 'int';
      case 'addr': {
        const t = this.expr(e.e, scopes);
        e.t = t;
        return t;
      }
      case 'call': return this.callExpr(e, scopes);
      default: return 'int';
    }
  }

  private callExpr(e: Extract<Expr, { k: 'call' }>, scopes: Scope[]): AnnType {
    const argTypes = e.args.map((a) => this.expr(a, scopes));
    const builtin = BUILTIN_FNS[e.name];
    if (builtin !== undefined) {
      if (e.name === 'printf') {
        if (e.args.length < 1 || e.args[0].k !== 'str') {
          throw new ClabParseError('printf precisa de um texto entre aspas primeiro: printf("texto %d", x);', e.line, 1);
        }
        const fmt = e.args[0].v;
        const specs = (fmt.match(/%[0-9.\-*]*[a-zA-Z%]/g) ?? []).filter((s) => s !== '%%');
        if (specs.length > e.args.length - 1) {
          throw new ClabParseError(`printf: o texto tem ${specs.length} % (como %d/%f) mas você passou ${Math.max(0, e.args.length - 1)} valor(es) — faltou argumento`, e.line, 1);
        }
        if (specs.length < e.args.length - 1) {
          throw new ClabParseError(`printf: você passou ${e.args.length - 1} valor(es) mas o texto só usa ${specs.length} % — sobrou argumento`, e.line, 1);
        }
        e.t = 'int';
        return 'int';
      }
      if (e.name === 'scanf') {
        if (e.args.length < 1 || e.args[0].k !== 'str') {
          throw new ClabParseError('scanf precisa de um texto entre aspas primeiro: scanf("%d", &x);', e.line, 1);
        }
        const fmt = e.args[0].v;
        const specs = (fmt.match(/%[0-9.*]*[a-zA-Z]/g) ?? []);
        for (let i = 0; i < specs.length; i++) {
          const a = e.args[i + 1];
          if (!a) {
            throw new ClabParseError(`scanf: o formato tem ${specs.length} % mas você passou só ${e.args.length - 1} endereço(s) — faltou &variável`, e.line, 1);
          }
          const spec = specs[i].replace(/[0-9.*]/g, '');
          if (spec === '%s') {
            const t = a.k === 'addr' ? this.expr(a.e, scopes) : argTypes[i + 1];
            if (a.k !== 'id' || !this.isArrayArg(a)) {
              throw new ClabParseError('scanf %s lê texto: passe o vetor direto, sem & — ex.: scanf("%s", nome);', e.line, 1);
            }
            if (t !== 'char') throw new ClabParseError('scanf %s precisa de um char[] (vetor de letras)', e.line, 1);
          } else {
            if (a.k !== 'addr') {
              throw new ClabParseError(`scanf: faltou o & antes da variável — ex.: scanf("${specs[i]}", &x);`, e.line, 1);
            }
            if (a.e.k !== 'id' && a.e.k !== 'index') {
              throw new ClabParseError('scanf espera &variável ou &v[i]', e.line, 1);
            }
          }
        }
        if (e.args.length - 1 > specs.length) {
          throw new ClabParseError(`scanf: você passou ${e.args.length - 1} endereço(s) mas o formato só usa ${specs.length} %`, e.line, 1);
        }
        e.t = 'int';
        return 'int';
      }
      const need = builtin;
      if (need >= 0 && e.args.length !== need) {
        throw new ClabParseError(`${e.name}() recebe ${need} argumento(s), mas recebeu ${e.args.length}`, e.line, 1);
      }
      if (e.name === 'sqrt' || e.name === 'fabs' || e.name === 'floor' || e.name === 'ceil' || e.name === 'round' || e.name === 'pow') e.t = 'double';
      else if (e.name === 'toupper' || e.name === 'tolower') e.t = 'char';
      else if (e.name === 'strlen' || e.name === 'abs' || e.name === 'rand' || e.name === 'srand' || e.name === 'getchar' || e.name === 'system' || e.name === 'fflush') e.t = 'int';
      else if (e.name === 'puts') e.t = 'int';
      else e.t = 'int'; // strcpy/strcat/strcmp/strncpy → usados como instrução/comparação
      return e.t;
    }
    const fn = this.fns.get(e.name);
    if (!fn) {
      throw new ClabParseError(`Função '${e.name}' não existe no programa — confira o nome (o Lab suporta printf, scanf, strlen, strcpy, strcmp, strcat, sqrt, pow, fabs, abs, floor, ceil, toupper, tolower, rand...)`, e.line, 1);
    }
    if (e.args.length !== fn.params.length) {
      throw new ClabParseError(`${e.name}() recebe ${fn.params.length} argumento(s) (${fn.params.map((p) => p.base + (p.isArray ? '[]' : '') + ' ' + p.name).join(', ')}), mas recebeu ${e.args.length}`, e.line, 1);
    }
    for (let i = 0; i < fn.params.length; i++) {
      const p = fn.params[i];
      const a = e.args[i];
      if (p.isArray) {
        const ok = (a.k === 'id' && this.isArrayArg(a)) || (a.k === 'index' && a.arr.k === 'id' && this.isArrayArg(a.arr));
        if (!ok) {
          throw new ClabParseError(`O parâmetro ${p.name} de ${e.name}() é vetor — passe o vetor direto, sem & e sem colchetes (ex.: ${p.name})`, e.line, 1);
        }
      } else if (a.k === 'addr') {
        throw new ClabParseError(`Sem & aqui: ${e.name}() recebe o VALOR de ${p.name} — chame ${e.name}(${fn.params.map((q) => (q === p ? 'x' : q.name)).join(', ')})`, e.line, 1);
      }
    }
    e.t = fn.ret;
    return fn.ret;
  }

  private isArrayArg(a: Extract<Expr, { k: 'id' }>): boolean {
    return a.isArray === true;
  }
}

export interface ParsedProgram {
  ok: true;
  program: Program;
}
export interface FailedParse {
  ok: false;
  message: string;
  line: number;
  col: number;
}

export function parseC(src: string): ParsedProgram | FailedParse {
  try {
    const p = new Parser(src).parseProgram();
    new Annotator().run(p);
    return { ok: true, program: p };
  } catch (err) {
    if (err instanceof ClabSyntaxError || err instanceof ClabParseError) {
      return { ok: false, message: err.message, line: err.line, col: err.col };
    }
    return { ok: false, message: err instanceof Error ? err.message : String(err), line: 1, col: 1 };
  }
}
