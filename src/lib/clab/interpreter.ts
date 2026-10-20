/**
 * Lab de Código — Interpretador de C (máquina de passos)
 * -------------------------------------------------------
 * Executa o programa UMA ação por vez e tira uma "foto" (snapshot) de cada
 * passo: linha em execução, escopos/variáveis, memória dos vetores, saída.
 *
 * Recursos pedagógicos:
 *  - Passo a passo navegável (timeline) com nota explicativa por passo;
 *  - Pilha de chamadas visível (funções/recursão aparecem como escopos);
 *  - Erros amigáveis em português (divisão por zero, índice fora do vetor,
 *    variável sem valor, laço infinito, scanf sem entrada...);
 *  - "E se...?" — o estado de qualquer passo pode ser restaurado (fork),
 *    uma variável editada e o resto da execução recalculado.
 *
 * Chamadas de função: quando a chamada é a instrução inteira (ou o lado
 * direito direto de um = / de um return / de um init), ela aparece passo a
 * passo. Chamadas aninhadas dentro de expressões maiores rodam de uma vez.
 */
import { parseC, type Program, type FnDef, type Stmt, type Expr, type Declarator, type BType } from './parser';

export class ClabError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(message);
    this.name = 'ClabError';
    this.line = line;
  }
}

type Value = number | string; // string = 1 caractere

interface ArrayRef {
  cells: unknown[];
  dims: number[];
  base: BType;
  name: string;
  aliasName: string;
}

interface VRec {
  name: string;
  base: BType;
  isArray: boolean;
  value?: Value;   // escalar (undefined = sem valor ainda → "lixo")
  cells?: unknown[]; // 1D: Value[] · 2D: Value[][]
  dims?: number[];
  addr: number;
  alias?: string;  // parâmetro-vetor aponta para o vetor de quem chamou
}

interface Frame {
  fn: string;
  fnLine: number;
  retType: BType;
  isGlobal?: boolean;
  vars: VRec[];
  alloc: number;
  ret?: Value;
}

type CallTarget =
  | { kind: 'drop' }
  | { kind: 'assign'; f: number; name: string; path: number[] | null }
  | { kind: 'init'; f: number; name: string }
  | { kind: 'ret'; f: number };

type WhileStmt = Extract<Stmt, { k: 'while' }>;
type DowhileStmt = Extract<Stmt, { k: 'dowhile' }>;
type ForStmt = Extract<Stmt, { k: 'for' }>;

type Ctrl =
  | { k: 'seq'; stmts: Stmt[]; ip: number; fr: Frame; isFnBody?: boolean; isSwitchBody?: boolean }
  | { k: 'while'; n: WhileStmt; fr: Frame }
  | { k: 'dowhile'; n: DowhileStmt; fr: Frame }
  | { k: 'for'; n: ForStmt; fr: Frame; phase: 'init' | 'cond' | 'update' }
  | { k: 'call'; fn: FnDef; args: (Value | ArrayRef)[]; callerFr: Frame; calleeFr?: Frame; target?: CallTarget; entered: boolean; gotRet?: Value };

type Signal = { t: 'break' } | { t: 'continue' } | { t: 'return'; v?: Value };
const DEFER = Symbol('clab-defer');

interface VMState {
  ctrl: Ctrl[];
  frames: Frame[];
  output: string;
  input: string;
  inPos: number;
  randState: number;
  status: 'running' | 'done' | 'error';
  errorMsg?: string;
  errorLine?: number;
}

// ---------- visualização ----------

export interface ViewVar {
  name: string;
  type: string;
  base: BType;
  kind: 'scalar' | 'array';
  value?: string;
  uninitialized?: boolean;
  cells?: string[];
  rows?: string[][];
  addr: string;
  alias?: string;
  strText?: string;
  dims?: number[];
}

export interface ViewFrame {
  fn: string;
  isGlobal?: boolean;
  vars: ViewVar[];
}

export interface ClabSnapshot {
  line: number;
  note: string;
  frames: ViewFrame[];
  output: string;
  status: 'running' | 'done' | 'error';
  errorMsg?: string;
  errorLine?: number;
  /** Estado completo da VM no passo — a fonte do "E se...?" (forkFrom). */
  state: VMState;
}

const SIZES: Record<BType, number> = { int: 4, float: 4, double: 8, char: 1, bool: 1, void: 0 };
const MAX_OUTPUT = 8000;

function toNum(v: Value): number {
  return typeof v === 'string' ? v.charCodeAt(0) : v;
}

function trimNum(n: number): string {
  return String(parseFloat(n.toPrecision(10)));
}

function fmtScalar(v: Value, base: BType): string {
  if (base === 'char') return `'${v}'`;
  const n = toNum(v);
  if (base === 'float' || base === 'double') return Number.isInteger(n) ? n.toFixed(1) : trimNum(n);
  return String(n);
}

function fmtCell(v: Value | undefined, base: BType): string {
  if (v === undefined) return '?';
  if (base === 'char') return v === '\0' ? '\\0' : String(v);
  return fmtScalar(v, base);
}

function hexAddr(a: number): string {
  return '0x' + a.toString(16).padStart(4, '0');
}

// ---------- clone profundo com memória de células compartilhadas ----------

function cloneCells(arr: unknown[], memo: Map<unknown[], unknown[]>): unknown[] {
  const hit = memo.get(arr);
  if (hit) return hit;
  const out: unknown[] = [];
  memo.set(arr, out);
  for (const item of arr) {
    out.push(Array.isArray(item) ? cloneCells(item as unknown[], memo) : item);
  }
  return out;
}

function cloneRec(v: VRec, memo: Map<unknown[], unknown[]>): VRec {
  return { ...v, cells: v.cells ? cloneCells(v.cells, memo) : undefined };
}

function cloneFrame(f: Frame, memo: Map<unknown[], unknown[]>): Frame {
  return { ...f, vars: f.vars.map((v) => cloneRec(v, memo)) };
}

function cloneState(s: VMState): VMState {
  const memo = new Map<unknown[], unknown[]>();
  const frames = s.frames.map((f) => cloneFrame(f, memo));
  const fmap = new Map<Frame, Frame>();
  s.frames.forEach((f, i) => fmap.set(f, frames[i]));
  const ctrl = s.ctrl.map((e) => {
    const c = { ...e } as Ctrl;
    if ('fr' in c && c.fr) (c as { fr: Frame }).fr = fmap.get(c.fr) ?? c.fr;
    if (c.k === 'call') {
      c.callerFr = fmap.get(c.callerFr) ?? c.callerFr;
      if (c.calleeFr) c.calleeFr = fmap.get(c.calleeFr) ?? c.calleeFr;
    }
    return c;
  });
  return { ...s, ctrl, frames };
}

// ---------- engine ----------

export type PrepareResult =
  | { ok: true; engine: ClabEngine }
  | { ok: false; message: string; line: number; col: number };

export class ClabEngine {
  private state: VMState;
  private fns = new Map<string, FnDef>();
  private pending: Signal | null = null;
  private silent = 0;
  private syncFrame: Frame | null = null; // barreira da chamada síncrona
  private _snapshots: ClabSnapshot[] = [];
  maxSteps = 4000;

  private constructor(program: Program, input: string) {
    for (const f of program.fns) this.fns.set(f.name, f);
    const globalFr: Frame = { fn: 'global', fnLine: 1, retType: 'void', isGlobal: true, vars: [], alloc: 0x0800 };
    this.state = {
      ctrl: [], frames: [globalFr], output: '', input: input ?? '',
      inPos: 0, randState: 12345, status: 'running',
    };
    for (const g of program.globals) {
      this.execDecl({ k: 'decl', line: g.line, text: '', base: g.base, decls: g.decls }, globalFr);
    }
    const main = program.fns.find((f) => f.name === 'main')!;
    const mainFr: Frame = { fn: 'main', fnLine: main.line, retType: main.ret, vars: [], alloc: 0x1000 };
    this.state.frames.push(mainFr);
    this.state.ctrl.push({ k: 'seq', stmts: main.body, ip: 0, fr: mainFr, isFnBody: true });
    this.snap(false, 1, 'Programa carregado — pronto para executar. Avance passo a passo ou clique em Rodar.');
  }

  static prepare(code: string, stdin: string): PrepareResult {
    const parsed = parseC(code);
    if (!parsed.ok) return parsed;
    try {
      return { ok: true, engine: new ClabEngine(parsed.program, stdin) };
    } catch (err) {
      if (err instanceof ClabError) return { ok: false, message: err.message, line: err.line, col: 1 };
      throw err;
    }
  }

  get status(): 'running' | 'done' | 'error' { return this.state.status; }
  get snapshots(): ClabSnapshot[] { return this._snapshots; }
  get output(): string { return this.state.output; }

  /** Executa exatamente UMA ação (instrução/condição/chamada). false = terminou. */
  step(): boolean {
    if (this.state.status !== 'running') return false;
    try {
      return this.stepCore(false);
    } catch (err) {
      if (err instanceof ClabError) {
        this.fail(err.message, err.line);
        return false;
      }
      throw err;
    }
  }

  /** Roda até o fim (ou até o limite de passos). */
  runToEnd(): void {
    let guard = 0;
    while (this.step()) {
      if (++guard > this.maxSteps + 10) break;
    }
  }

  /** Restaura o estado exato do passo i (para o "E se...?"). */
  forkFrom(i: number): void {
    const snap = this._snapshots[i];
    if (!snap) return;
    this.state = cloneState(snap.state);
    this._snapshots = this._snapshots.slice(0, i + 1);
    this.pending = null;
    this.silent = 0;
  }

  /** Edita uma variável/célula no estado atual (depois de forkFrom). */
  editVar(fIdx: number, name: string, path: number[] | null, raw: string): { ok: boolean; error?: string } {
    const fr = this.state.frames[fIdx];
    if (!fr) return { ok: false, error: 'Escopo não encontrado' };
    const rec = fr.vars.find((v) => v.name === name);
    if (!rec) return { ok: false, error: `Variável '${name}' não encontrada` };
    let v: Value;
    try {
      v = this.parseRaw(raw, rec.base);
    } catch (e) {
      return { ok: false, error: e instanceof ClabError ? e.message : 'Valor inválido' };
    }
    try {
      if (path === null) {
        if (rec.isArray) return { ok: false, error: `'${name}' é um vetor — edite as posições individualmente` };
        rec.value = this.convert(rec.base, v, 1);
      } else {
        let cells = rec.cells;
        for (let d = 0; d < path.length - 1; d++) {
          if (!Array.isArray(cells)) throw new ClabError('Índice inválido', 1);
          cells = cells[path[d]] as unknown[];
        }
        if (!Array.isArray(cells)) throw new ClabError('Índice inválido', 1);
        cells[path[path.length - 1]] = this.convert(rec.base, v, 1);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof ClabError ? e.message : 'Valor inválido' };
    }
  }

  private parseRaw(raw: string, base: BType): Value {
    const s = raw.trim();
    if (base === 'char') {
      if (s.length === 1) return s;
      if (/^\d+$/.test(s)) return String.fromCharCode(parseInt(s, 10));
      if (s === '\\0' || s === '') return '\0';
      throw new ClabError(`'${raw}' não é um char — use 1 caractere (ex.: a) ou um código (ex.: 97)`, 1);
    }
    if (base === 'int' || base === 'bool') {
      if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
      if (base === 'bool' && (s === 'true' || s === 'false')) return s === 'true' ? 1 : 0;
      throw new ClabError(`'${raw}' não é um número inteiro — ex.: 42`, 1);
    }
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n)) throw new ClabError(`'${raw}' não é um número — ex.: 3.14`, 1);
    return n;
  }

  // ================= núcleo da máquina de passos =================

  private fail(msg: string, line: number) {
    this.state.status = 'error';
    this.state.errorMsg = msg;
    this.state.errorLine = line;
    this.silent = 0;
    this.snap(false, line, `ERRO: ${msg}`);
  }

  private snap(silent: boolean, line: number, note: string) {
    if (this.silent > 0 && this.state.status !== 'error') return;
    if (this._snapshots.length >= this.maxSteps && this.state.status === 'running') {
      this.state.status = 'error';
      this.state.errorMsg = `A execução passou de ${this.maxSteps} passos — provável laço infinito. Verifique a condição do laço e o incremento.`;
      this.state.errorLine = line;
    }
    this._snapshots.push({
      line,
      note,
      frames: this.buildView(),
      output: this.state.output,
      status: this.state.status,
      errorMsg: this.state.errorMsg,
      errorLine: this.state.errorLine,
      state: cloneState(this.state),
    });
  }

  private stepCore(silent: boolean): boolean {
    if (this.state.status !== 'running') return false;
    if (silent) this.silent++;
    try {
      let guard = 0;
      while (this.state.ctrl.length > 0) {
        // barreira: a chamada síncrona terminou (frame saiu) → devolve o controle
        if (this.syncFrame && !this.state.frames.includes(this.syncFrame)) return false;
        if (++guard > 300) {
          throw new ClabError('Erro interno do Lab (fluxo de controle) — avise o dono!', 1);
        }
        const top = this.state.ctrl[this.state.ctrl.length - 1];

        // ---- roteia sinal pendente (break/continue/return) ----
        if (this.pending) {
          if (top.k === 'seq') {
            this.state.ctrl.pop();
            if (top.isSwitchBody && this.pending.t === 'break') { this.pending = null; continue; }
            if (top.isFnBody) {
              if (this.pending.t === 'return') {
                this.finalizeFn(top.fr, this.pending.v, silent);
                this.pending = null;
              } else {
                this.finalizeFn(top.fr, undefined, silent);
              }
            }
            continue;
          }
          if (top.k === 'while' || top.k === 'dowhile') {
            if (this.pending.t === 'return') { this.state.ctrl.pop(); continue; }
            if (this.pending.t === 'break') this.state.ctrl.pop();
            this.pending = null; // break sai · continue re-testa a condição
            continue;
          }
          if (top.k === 'for') {
            if (this.pending.t === 'break') { this.state.ctrl.pop(); this.pending = null; }
            else if (this.pending.t === 'continue') { top.phase = 'update'; this.pending = null; }
            else this.state.ctrl.pop(); // return propaga
            continue;
          }
          if (top.k === 'call') { this.state.ctrl.pop(); this.pending = null; continue; }
        }

        // ---- executa a ação do topo ----
        switch (top.k) {
          case 'seq': {
            if (top.ip >= top.stmts.length) {
              this.state.ctrl.pop();
              if (top.isFnBody) this.finalizeFn(top.fr, undefined, silent);
              continue;
            }
            const st = top.stmts[top.ip++];
            const res = this.exec(st, top.fr, silent);
            if (res === DEFER) continue;
            if (res) { this.pending = res; continue; }
            return true; // ação com foto tirada
          }
          case 'while': {
            const c = this.truthy(this.evalExpr(top.n.cond, top.fr));
            this.snap(silent, top.n.line, `while: condição ${this.fmt(top.n.cond, top.fr)} → ${c ? 'verdadeira, repete o laço' : 'falsa, SAI do laço'}`);
            if (c) this.pushSeq(top.n.body, top.fr);
            else this.state.ctrl.pop();
            return true;
          }
          case 'dowhile': {
            const c = this.truthy(this.evalExpr(top.n.cond, top.fr));
            this.snap(silent, top.n.cond.line, `do-while: condição → ${c ? 'verdadeira, repete o corpo' : 'falsa, SAI do laço'}`);
            if (c) this.pushSeq(top.n.body, top.fr);
            else this.state.ctrl.pop();
            return true;
          }
          case 'for': {
            if (top.phase === 'init') {
              if (top.n.init) {
                const res = this.exec(top.n.init, top.fr, silent);
                if (res === DEFER) { top.phase = 'cond'; continue; }
                if (res) { this.pending = res; top.phase = 'cond'; continue; }
                top.phase = 'cond';
                return true;
              }
              this.snap(silent, top.n.line, 'for: começa (sem inicialização)');
              top.phase = 'cond';
              return true;
            }
            if (top.phase === 'cond') {
              const c = top.n.cond ? this.truthy(this.evalExpr(top.n.cond, top.fr)) : true;
              this.snap(silent, top.n.line, `for: condição ${top.n.cond ? this.fmt(top.n.cond, top.fr) : ''} → ${c ? 'verdadeira, entra no laço' : 'falsa, SAI do laço'}`);
              if (c) { top.phase = 'update'; this.pushSeq(top.n.body, top.fr); }
              else this.state.ctrl.pop();
              return true;
            }
            // update
            if (top.n.update) this.evalExpr(top.n.update, top.fr);
            // A fase muda ANTES do snapshot: o estado congelado já é "incremento
            // feito, pronto para testar a condição". Se o snap viesse antes da
            // troca de fase, um fork deste passo re-aplicaria o incremento e o
            // replay do "E se...?" divergia da linha do tempo original.
            top.phase = 'cond';
            this.snap(silent, top.n.line, `for: passo (${top.n.update ? stmtTextOf(top.n.update) : '—'}) → volta a testar a condição`);
            return true;
          }
          case 'call': {
            if (!top.entered) {
              if (this.state.frames.length >= 200) {
                throw new ClabError('Recursão muito profunda (mais de 200 chamadas empilhadas) — provavelmente falta um caso base', top.fn.line);
              }
              const fr = this.makeFrame(top.fn, top.args, top.callerFr);
              top.calleeFr = fr;
              this.state.frames.push(fr);
              this.state.ctrl.push({ k: 'seq', stmts: top.fn.body, ip: 0, fr, isFnBody: true });
              top.entered = true;
              this.snap(silent, top.fn.line, `→ entrou em ${top.fn.name}(${top.args.map((a) => (typeof a === 'object' ? a.name : this.fmtVal(a))).join(', ')})`);
              return true;
            }
            // corpo terminou (frame já saiu pelo finalize) — aplica o resultado
            this.state.ctrl.pop();
            const ret = top.gotRet;
            if (top.target) {
              //captura local — a closure do find() abaixo invalida o narrowing
              //de propriedades através de `top` (top.target pode mutar em teoria).
              const tgt = top.target;
              if (tgt.kind === 'assign') {
                const fr = this.state.frames[tgt.f];
                const rec = fr?.vars.find((v) => v.name === tgt.name);
                if (!rec) throw new ClabError(`Variável '${tgt.name}' sumiu (erro interno)`, top.fn.line);
                if (ret === undefined) throw new ClabError(`${top.fn.name}() é void — não retorna valor para guardar`, top.fn.line);
                this.storeLvalue(rec, tgt.path, this.convert(rec.base, ret, top.fn.line), top.fn.line);
                this.snap(silent, top.fn.line, `${tgt.name} = ${this.fmtVal(ret)} (retorno de ${top.fn.name}())`);
                return true;
              }
              if (tgt.kind === 'init') {
                const fr = this.state.frames[tgt.f];
                const rec = fr?.vars.find((v) => v.name === tgt.name);
                if (!rec) throw new ClabError(`Variável '${tgt.name}' sumiu (erro interno)`, top.fn.line);
                if (ret === undefined) throw new ClabError(`${top.fn.name}() é void — não retorna valor para iniciar '${tgt.name}'`, top.fn.line);
                rec.value = this.convert(rec.base, ret, top.fn.line);
                this.snap(silent, top.fn.line, `${tgt.name} = ${this.fmtVal(ret)} (retorno de ${top.fn.name}())`);
                return true;
              }
              if (top.target.kind === 'ret') {
                const fr = this.state.frames[top.target.f];
                if (!fr) throw new ClabError('Erro interno: função do return sumiu', top.fn.line);
                if (ret === undefined && fr.retType !== 'void') {
                  throw new ClabError(`${top.fn.name}() é void — não retorna valor para o return`, top.fn.line);
                }
                fr.ret = ret === undefined ? undefined : this.convert(fr.retType, ret, top.fn.line);
                this.pending = { t: 'return', v: fr.ret };
                this.snap(silent, top.fn.line, `${top.fn.name}() devolveu ${this.fmtVal(ret)} → isso é o return`);
                return true;
              }
            }
            continue; // drop: nada a fazer com o retorno
          }
        }
      }
      // ctrl vazio
      if (this.state.status === 'running') {
        this.state.status = 'done';
        this.snap(silent, 1, 'fim do programa');
      }
      return false;
    } finally {
      if (silent) this.silent--;
    }
  }

  private finalizeFn(fr: Frame, ret: Value | undefined, silent: boolean) {
    if (ret !== undefined) fr.ret = ret;
    const idx = this.state.frames.lastIndexOf(fr);
    if (idx >= 0) this.state.frames.splice(idx, 1);
    // entrega o retorno para o 'call' que aguarda este frame
    for (let i = this.state.ctrl.length - 1; i >= 0; i--) {
      const e = this.state.ctrl[i];
      if (e.k === 'call' && e.entered && e.calleeFr === fr) { e.gotRet = fr.ret; break; }
    }
    if (fr.fn === 'main' && this.state.frames.length <= 1) {
      this.state.status = 'done';
      this.snap(silent, fr.fnLine, `fim do programa — main retornou ${fr.ret === undefined ? '0' : this.fmtVal(fr.ret)}`);
      return;
    }
    this.snap(silent, fr.fnLine, fr.ret !== undefined && fr.retType !== 'void'
      ? `← ${fr.fn} retornou ${this.fmtVal(fr.ret)}`
      : `← ${fr.fn} terminou`);
  }

  private pushSeq(body: Stmt, fr: Frame) {
    const stmts = body.k === 'block' ? body.stmts : [body];
    this.state.ctrl.push({ k: 'seq', stmts, ip: 0, fr });
  }

  // ================= execução de instruções =================

  private exec(st: Stmt, fr: Frame, silent: boolean): Signal | typeof DEFER | null {
    switch (st.k) {
      case 'empty': return DEFER;
      case 'decl': {
        this.execDecl(st, fr);
        const parts = st.decls.map((d) => {
          const rec = fr.vars.find((v) => v.name === d.name)!;
          let s = `${d.name} (${this.typeLabel(rec)})`;
          if (rec.value !== undefined) s += ` = ${this.fmtVal(rec.value)}`;
          else if (rec.isArray && d.strInit) s += ` = "${d.strInit}"`;
          return s;
        });
        this.snap(silent, st.line, `declara ${parts.join(', ')}`);
        return null;
      }
      case 'expr': {
        const e = st.e;
        // chamada visível: instrução inteira, ou lado direito direto de um =
        if (e.k === 'call' && this.fns.has(e.name)) {
          const fn = this.fns.get(e.name)!;
          const args = this.evalCallArgs(fn, e.args, fr, e.line);
          this.state.ctrl.push({ k: 'call', fn, args, callerFr: fr, target: { kind: 'drop' }, entered: false });
          this.snap(silent, st.line, `chamada ${e.name}(${e.args.map((a) => stmtTextOf(a)).join(', ')}) — a função vai rodar nos próximos passos`);
          return null;
        }
        if (e.k === 'assign' && e.rhs.k === 'call' && this.fns.has(e.rhs.name)) {
          const fn = this.fns.get(e.rhs.name)!;
          const args = this.evalCallArgs(fn, e.rhs.args, fr, e.line);
          const lv = this.getLvalue(e.lhs, fr);
          const target: CallTarget = lv.isArray
            ? { kind: 'drop' }
            : { kind: 'assign', f: this.state.frames.indexOf(fr), name: lv.rec.name, path: lv.path };
          this.state.ctrl.push({ k: 'call', fn, args, callerFr: fr, target, entered: false });
          this.snap(silent, st.line, `${stmtTextOf(e.lhs)} = ${e.rhs.name}(...) — aguardando o retorno da função`);
          return null;
        }
        this.evalExpr(e, fr);
        this.snap(silent, st.line, st.text || 'expressão');
        return null;
      }
      case 'if': {
        const c = this.truthy(this.evalExpr(st.cond, fr));
        this.snap(silent, st.line, `if: ${this.fmt(st.cond, fr)} → ${c ? 'VERDADEIRO, entra no if' : 'falso, vai para o else (ou pula)'}`);
        this.pushSeq(c ? st.then : (st.els ?? { k: 'empty', line: st.line, text: ';' }), fr);
        return null;
      }
      case 'while': {
        this.state.ctrl.push({ k: 'while', n: st, fr });
        return DEFER;
      }
      case 'dowhile': {
        this.state.ctrl.push({ k: 'dowhile', n: st, fr });
        this.pushSeq(st.body, fr);
        this.snap(silent, st.line, 'do-while: executa o corpo (a condição só é testada no final)');
        return null;
      }
      case 'for': {
        this.state.ctrl.push({ k: 'for', n: st, fr, phase: 'init' });
        return DEFER;
      }
      case 'return': {
        if (!st.e) {
          fr.ret = undefined;
          this.snap(silent, st.line, `return — sai de ${fr.fn}`);
          return { t: 'return' };
        }
        if (st.e.k === 'call' && this.fns.has(st.e.name)) {
          const fn = this.fns.get(st.e.name)!;
          const args = this.evalCallArgs(fn, st.e.args, fr, st.line);
          this.state.ctrl.push({
            k: 'call', fn, args, callerFr: fr, entered: false,
            target: { kind: 'ret', f: this.state.frames.indexOf(fr) },
          });
          this.snap(silent, st.line, `return ${st.e.name}(...) — a função vai rodar e o resultado sai daqui`);
          return null;
        }
        const v = this.evalExpr(st.e, fr);
        fr.ret = this.convert(fr.retType, v, st.line);
        this.snap(silent, st.line, `return ${this.fmtVal(fr.ret)} — sai de ${fr.fn}`);
        return { t: 'return', v: fr.ret };
      }
      case 'break': {
        this.snap(silent, st.line, 'break — interrompe o laço/switch aqui');
        return { t: 'break' };
      }
      case 'continue': {
        this.snap(silent, st.line, 'continue — pula para o próximo passo do laço');
        return { t: 'continue' };
      }
      case 'switch': {
        const disc = this.evalExpr(st.disc, fr);
        let target = -1;
        let label = '';
        let defaultIdx = -1;
        for (let i = 0; i < st.cases.length; i++) {
          const c = st.cases[i];
          if (c.match === null) { if (defaultIdx < 0) defaultIdx = i; continue; }
          const mv = this.evalExpr(c.match, fr);
          if (toNum(mv) === toNum(disc)) { target = i; label = `case ${this.fmtVal(mv)}`; break; }
        }
        if (target < 0 && defaultIdx >= 0) { target = defaultIdx; label = 'default'; }
        if (target < 0) {
          this.snap(silent, st.line, `switch: valor ${this.fmtVal(disc)} não bateu com nenhum case → sai do switch`);
          return null;
        }
        this.snap(silent, st.line, `switch: valor ${this.fmtVal(disc)} → entra no ${label}`);
        this.state.ctrl.push({ k: 'seq', stmts: st.body.slice(st.cases[target].start), ip: 0, fr, isSwitchBody: true });
        return null;
      }
      case 'block': {
        this.state.ctrl.push({ k: 'seq', stmts: st.stmts, ip: 0, fr });
        return DEFER;
      }
      default: return DEFER;
    }
  }

  /** Declaração: aloca memória (com endereço didático) e inicia. */
  private execDecl(st: Extract<Stmt, { k: 'decl' }>, fr: Frame) {
    for (const d of st.decls) {
      // remove redeclaração no mesmo escopo de função
      fr.vars = fr.vars.filter((v) => v.name !== d.name);
      const rec: VRec = { name: d.name, base: st.base, isArray: false, addr: this.allocAddr(fr, st.base) };
      if (d.dims.length > 0 || d.strInit || d.initList) {
        rec.isArray = true;
        const lens: number[] = [];
        for (const dim of d.dims) {
          const n = Math.trunc(toNum(this.evalExpr(dim, fr)));
          lens.push(n);
        }
        if (d.strInit) {
          const need = d.strInit.length + 1; // +1 pelo '\0'
          if (lens[0] === 0) lens[0] = need;
          else if (lens[0] < need) {
            throw new ClabError(`Texto "${d.strInit}" (${d.strInit.length} letras + '\\0') não cabe em ${d.name}[${lens[0]}] — aumente o tamanho`, d.line);
          }
        } else if (d.initList) {
          if (d.dims.length === 1 && lens[0] === 0) lens[0] = d.initList[0]?.length ?? 0;
          if (d.dims.length === 2 && lens[0] === 0) lens[0] = d.initList.length;
          if (d.dims.length === 2 && lens[1] === 0) lens[1] = d.initList[0]?.length ?? 0;
        } else {
          if (lens.some((n) => !n || n <= 0)) {
            throw new ClabError(`Vetor '${d.name}' precisa de um tamanho entre [ ] (ex.: int ${d.name}[10];) — ou inicie com { ... }`, d.line);
          }
        }
        for (const n of lens) {
          if (!Number.isFinite(n) || n <= 0) throw new ClabError(`Tamanho inválido para '${d.name}' (deve ser inteiro positivo)`, d.line);
          if (n > 10000) throw new ClabError(`Vetor '${d.name}' gigante demais (${n}) — use até 10000 posições no Lab`, d.line);
        }
        rec.dims = lens;
        rec.addr = this.allocAddr(fr, st.base, lens.reduce((a, b) => a * b, 1));
        rec.cells = this.buildArray(lens);
        // inicia
        if (d.strInit) {
          const chars: Value[] = [...d.strInit, '\0'];
          for (let i = 0; i < chars.length; i++) rec.cells[i] = chars[i];
        } else if (d.initList) {
          const fill = (cells: unknown[], items: (Expr | Expr[])[], depth: number, line: number) => {
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              if (Array.isArray(it)) {
                if (depth >= lens.length - 1) throw new ClabError(`'${d.name}' tem ${lens.length} dimensão(ões) — não dá para aninhar { } nessa posição`, line);
                if (!Array.isArray(cells[i])) cells[i] = this.buildArray(lens.slice(depth + 1));
                fill(cells[i] as unknown[], it as Expr[], depth + 1, line);
              } else {
                if (depth < lens.length - 1 && Array.isArray(cells[i])) {
                  fill(cells[i] as unknown[], [it], depth + 1, line);
                  continue;
                }
                cells[i] = this.convert(st.base, this.evalExpr(it, fr), it.line);
              }
            }
          };
          // zero-fill nos não informados (comportamento do C quando há { })
          const zero = (cells: unknown[], depth: number) => {
            for (let i = 0; i < cells.length; i++) {
              if (depth < lens.length - 1) { if (!Array.isArray(cells[i])) cells[i] = this.buildArray(lens.slice(depth + 1)); zero(cells[i] as unknown[], depth + 1); }
              else if (cells[i] === undefined) cells[i] = st.base === 'char' ? '\0' : 0;
            }
          };
          if (d.dims.length <= 1) {
            const items = d.initList[0] ?? [];
            for (let i = 0; i < items.length; i++) rec.cells[i] = this.convert(st.base, this.evalExpr(items[i] as Expr, fr), (items[i] as Expr).line);
            // C zera o resto quando há { } no inicializador
            for (let i = items.length; i < lens[0]; i++) rec.cells[i] = st.base === 'char' ? '\0' : 0;
          } else {
            zero(rec.cells, 0);
            for (let r = 0; r < d.initList.length && r < lens[0]; r++) {
              fill(rec.cells[r] as unknown[], d.initList[r] as (Expr | Expr[])[], 1, d.line);
            }
          }
        }
      } else if (d.init) {
        // chamada visível? (só declarador único) — rec fica sem valor até a função voltar
        if (st.decls.length === 1 && d.init.k === 'call' && this.fns.has(d.init.name)) {
          const fn = this.fns.get(d.init.name)!;
          const args = this.evalCallArgs(fn, d.init.args, fr, d.line);
          fr.vars.push(rec);
          this.state.ctrl.push({
            k: 'call', fn, args, callerFr: fr, entered: false,
            target: { kind: 'init', f: this.state.frames.indexOf(fr), name: rec.name },
          });
          continue;
        }
        rec.value = this.convert(st.base, this.evalExpr(d.init, fr), d.line);
      }
      fr.vars.push(rec);
    }
  }

  private allocAddr(fr: Frame, base: BType, count = 1): number {
    const bytes = SIZES[base] * Math.max(1, count);
    const a = fr.alloc + 0x1000 * (fr.isGlobal ? 0 : 0) + (fr.isGlobal ? 0x0800 : 0x1000);
    fr.alloc += bytes;
    void a;
    return (fr.isGlobal ? 0x0800 : 0x1000) + fr.alloc - bytes;
  }

  private buildArray(lens: number[]): unknown[] {
    if (lens.length === 1) return new Array(lens[0]);
    const out: unknown[] = [];
    for (let i = 0; i < lens[0]; i++) out.push(this.buildArray(lens.slice(1)));
    return out;
  }

  // ================= expressões =================

  private evalExpr(e: Expr, fr: Frame): Value {
    switch (e.k) {
      case 'num': return e.v;
      case 'str': throw new ClabError('Texto sozinho não é valor numérico aqui — use %s no printf ou um char[]', e.line);
      case 'char': return e.v;
      case 'id': {
        const rec = this.findRec(e.name, fr, e.line);
        if (rec.isArray) throw new ClabError(`Vetor '${e.name}' sozinho não é um valor — use uma posição (ex.: ${e.name}[0])`, e.line);
        if (rec.value === undefined) {
          throw new ClabError(`Lendo '${e.name}' antes de dar um valor a ele — comece com ${e.name} = algo (ou inicie na declaração)`, e.line);
        }
        return rec.value;
      }
      case 'index': return this.readIndex(e, fr);
      case 'un': {
        if (e.op === '!') return this.truthy(this.evalExpr(e.e, fr)) ? 0 : 1;
        const v = toNum(this.evalExpr(e.e, fr));
        return e.op === '-' ? -v : v;
      }
      case 'incdec': {
        const lv = this.getLvalue(e.e, fr);
        const old = this.readLvalue(lv, e.line);
        const n = toNum(old) + (e.op === '++' ? 1 : -1);
        const nw = lv.rec.base === 'char' ? String.fromCharCode(n) : n;
        this.storeLvalue(lv.rec, lv.path, nw, e.line);
        return e.postfix ? old : nw;
      }
      case 'bin': {
        if (e.op === ',') { this.evalExpr(e.l, fr); return this.evalExpr(e.r, fr); }
        const a = toNum(this.evalExpr(e.l, fr));
        const b = toNum(this.evalExpr(e.r, fr));
        switch (e.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': {
            if (b === 0) throw new ClabError('Divisão por zero — ninguém divide por 0! Confira o denominador', e.line);
            const isInt = e.t === 'int' || e.t === 'char' || e.t === 'bool';
            return isInt ? Math.trunc(a / b) : a / b;
          }
          case '%': {
            if (b === 0) throw new ClabError('Módulo (%) por zero — o resto de uma divisão por 0 não existe', e.line);
            return Math.trunc(a) % Math.trunc(b);
          }
          case '==': return a === b ? 1 : 0;
          case '!=': return a !== b ? 1 : 0;
          case '<': return a < b ? 1 : 0;
          case '>': return a > b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0;
          case '>=': return a >= b ? 1 : 0;
          default: throw new ClabError(`Operador '${e.op}' não suportado`, e.line);
        }
      }
      case 'logic': {
        const l = this.truthy(this.evalExpr(e.l, fr));
        if (e.op === '&&') return l ? (this.truthy(this.evalExpr(e.r, fr)) ? 1 : 0) : 0;
        return l ? 1 : (this.truthy(this.evalExpr(e.r, fr)) ? 1 : 0);
      }
      case 'assign': {
        if (e.op !== '=') {
          const lv0 = this.getLvalue(e.lhs, fr);
          if (lv0.isArray) throw new ClabError('Use strcpy() para mexer em texto de um vetor', e.line);
          const cur = toNum(this.readLvalue(lv0, e.line));
          const rhs = toNum(this.evalExpr(e.rhs, fr));
          let n: number;
          switch (e.op) {
            case '+=': n = cur + rhs; break;
            case '-=': n = cur - rhs; break;
            case '*=': n = cur * rhs; break;
            case '/=': if (rhs === 0) throw new ClabError('Divisão por zero no /=', e.line); n = (e.t === 'double' || e.t === 'float') ? cur / rhs : Math.trunc(cur / rhs); break;
            case '%=': if (rhs === 0) throw new ClabError('Módulo por zero no %=', e.line); n = Math.trunc(cur) % Math.trunc(rhs); break;
            default: throw new ClabError(`Operador '${e.op}' não suportado`, e.line);
          }
          const v = lv0.rec.base === 'char' ? String.fromCharCode(n) : n;
          this.storeLvalue(lv0.rec, lv0.path, this.convert(lv0.rec.base, v, e.line), e.line);
          return v;
        }
        if (e.lhs.k === 'id') {
          const rec = this.findRec(e.lhs.name, fr, e.line);
          if (rec.isArray) {
            throw new ClabError(`Para trocar o texto de '${e.lhs.name}' use strcpy(${e.lhs.name}, "novo texto"); — = não copia texto em C`, e.line);
          }
          const v = this.evalExpr(e.rhs, fr);
          rec.value = this.convert(rec.base, v, e.line);
          return rec.value;
        }
        const lv = this.getLvalue(e.lhs, fr);
        if (lv.isArray) throw new ClabError('Atribuição em vetor inteiro não existe em C — copie posição por posição ou use strcpy', e.line);
        const v = this.evalExpr(e.rhs, fr);
        const conv = this.convert(lv.rec.base, v, e.line);
        this.storeLvalue(lv.rec, lv.path, conv, e.line);
        return conv;
      }
      case 'ternary': return this.truthy(this.evalExpr(e.c, fr)) ? this.evalExpr(e.a, fr) : this.evalExpr(e.b, fr);
      case 'cast': {
        const v = this.evalExpr(e.e, fr);
        return this.convert(e.base, v, e.line);
      }
      case 'sizeof': {
        if ('type' in e.target) return SIZES[e.target.type];
        const rec = this.findRec(e.target.name, fr, e.line);
        if (rec.isArray) {
          const count = rec.dims?.reduce((a, b) => a * b, 1) ?? 0;
          return SIZES[rec.base] * count;
        }
        return SIZES[rec.base];
      }
      case 'call': return this.evalCall(e, fr);
      case 'addr': throw new ClabError('& só é usado dentro do scanf (e lá o Lab já cuida disso)', e.line);
      default:
        // switch exaustivo — aqui não sobra variante
        throw new ClabError('Expressão não suportada', 0);
    }
  }

  private evalCall(e: Extract<Expr, { k: 'call' }>, fr: Frame): Value {
    const fn = this.fns.get(e.name);
    if (!fn) {
      // builtin
      return this.builtin(e, fr);
    }
    const args = this.evalCallArgs(fn, e.args, fr, e.line);
    return this.runFnSync(fn, args, e.line);
  }

  /** Roda a função de forma síncrona (chamada aninhada em expressão) — sem fotos. */
  private runFnSync(fn: FnDef, args: (Value | ArrayRef)[], line: number): Value {
    if (this.state.frames.length >= 200) {
      throw new ClabError('Recursão muito profunda (mais de 200 chamadas empilhadas) — provavelmente falta um caso base', line);
    }
    const caller = this.state.frames[this.state.frames.length - 1];
    const fr = this.makeFrame(fn, args, caller);
    const depthBefore = this.state.frames.length;
    this.state.frames.push(fr);
    this.state.ctrl.push({ k: 'seq', stmts: fn.body, ip: 0, fr, isFnBody: true });
    this.syncFrame = fr;
    try {
      while (this.state.status === 'running' && this.state.frames.length > depthBefore) {
        this.stepCore(true);
      }
    } finally {
      this.syncFrame = null;
    }
    if (this.state.status === 'error') throw new ClabError(this.state.errorMsg ?? 'erro', this.state.errorLine ?? line);
    if (fn.ret === 'void') return 0;
    if (fr.ret === undefined) {
      throw new ClabError(`${fn.name}() terminou sem return — e o valor dela foi usado na expressão`, line);
    }
    return fr.ret;
  }

  private makeFrame(fn: FnDef, args: (Value | ArrayRef)[], caller: Frame): Frame {
    const fr: Frame = { fn: fn.name, fnLine: fn.line, retType: fn.ret, vars: [], alloc: 0 };
    for (let i = 0; i < fn.params.length; i++) {
      const p = fn.params[i];
      const a = args[i];
      if (p.isArray) {
        const ref = a as ArrayRef;
        fr.vars.push({
          name: p.name, base: p.base, isArray: true,
          cells: ref.cells, dims: ref.dims, addr: 0,
          alias: `${ref.aliasName} (de ${caller.fn})`,
        });
      } else {
        fr.vars.push({
          name: p.name, base: p.base, isArray: false,
          value: this.convert(p.base, a as Value, fn.line),
          addr: 0,
        });
      }
    }
    // endereços didáticos para parâmetros
    for (const v of fr.vars) {
      const count = v.isArray ? (v.dims?.reduce((x, y) => x * y, 1) ?? 1) : 1;
      v.addr = 0x1000 + fr.alloc;
      fr.alloc += SIZES[v.base] * Math.max(1, count);
    }
    return fr;
  }

  private evalCallArgs(fn: FnDef, argNodes: Expr[], fr: Frame, line: number): (Value | ArrayRef)[] {
    return fn.params.map((p, i) => {
      const node = argNodes[i];
      if (p.isArray) {
        return this.arrayRefOf(node, fr, line);
      }
      if (node.k === 'id') {
        const rec = this.findRec(node.name, fr, line);
        if (rec.isArray) throw new ClabError(`O parâmetro ${p.name} de ${fn.name}() não é vetor — passe um valor (ex.: ${node.name}[0])`, line);
      }
      return this.evalExpr(node, fr);
    });
  }

  /** Referência de vetor (para parâmetros vetor / funções de string). */
  private arrayRefOf(node: Expr, fr: Frame, line: number): ArrayRef {
    if (node.k === 'id') {
      const rec = this.findRec(node.name, fr, line);
      if (!rec.isArray || !rec.cells) throw new ClabError(`'${node.name}' não é um vetor`, line);
      return { cells: rec.cells, dims: rec.dims ?? [rec.cells.length], base: rec.base, name: node.name, aliasName: node.name };
    }
    if (node.k === 'index') {
      const arrRef = this.arrayRefOf(node.arr, fr, line);
      const idx = Math.trunc(toNum(this.evalExpr(node.idx, fr)));
      if (idx < 0 || idx >= arrRef.dims[0]) {
        throw new ClabError(`Índice ${idx} fora do vetor '${arrRef.name}' (vai de 0 a ${arrRef.dims[0] - 1})`, line);
      }
      const row = arrRef.cells[idx] as unknown[];
      return { cells: row, dims: arrRef.dims.slice(1).length ? arrRef.dims.slice(1) : [row.length], base: arrRef.base, name: `${arrRef.name}[${idx}]`, aliasName: `${arrRef.name}[${idx}]` };
    }
    throw new ClabError('Esperava um vetor aqui (passe o nome dele, sem colchetes)', line);
  }

  // ---------- builtins ----------

  private builtin(e: Extract<Expr, { k: 'call' }>, fr: Frame): Value {
    const line = e.line;
    switch (e.name) {
      case 'printf': {
        const fmtArg = e.args[0];
        if (!fmtArg || fmtArg.k !== 'str')
          throw new ClabError('O printf precisa de um texto entre aspas como primeiro argumento', line);
        return this.doPrintf(fmtArg.v, e.args.slice(1), fr, line);
      }
      case 'scanf': {
        const fmtArg = e.args[0];
        if (!fmtArg || fmtArg.k !== 'str')
          throw new ClabError('O scanf precisa de um texto entre aspas como primeiro argumento', line);
        return this.doScanf(fmtArg.v, e.args.slice(1), fr, line);
      }
      case 'puts': {
        this.appendOutput(this.stringOf(e.args[0], fr) + '\n', line);
        return 0;
      }
      case 'strlen': {
        const s = this.stringOf(e.args[0], fr);
        const z = s.indexOf('\0');
        return z >= 0 ? z : s.length;
      }
      case 'strcpy':
      case 'strncpy': {
        const destNode = e.args[0];
        if (destNode.k !== 'id') throw new ClabError('strcpy precisa do vetor de destino primeiro: strcpy(destino, origem);', line);
        const rec = this.findRec(destNode.name, fr, line);
        if (!rec.isArray || !rec.cells || rec.base !== 'char') throw new ClabError(`'${destNode.name}' precisa ser um char[]`, line);
        const src = this.stringOf(e.args[1], fr);
        const srcClean = src.replace(/\0.*$/, '');
        const n = e.name === 'strncpy' ? Math.trunc(toNum(this.evalExpr(e.args[2], fr))) : srcClean.length + 1;
        const take = srcClean.slice(0, Math.max(0, Math.min(n, srcClean.length)));
        const out = [...take, '\0'];
        if (out.length > rec.cells.length) {
          throw new ClabError(`Texto de ${take.length} letras + '\\0' não cabe em ${rec.name}[${rec.cells.length}] — aumente o vetor`, line);
        }
        for (let i = 0; i < out.length; i++) rec.cells[i] = out[i];
        return 0;
      }
      case 'strcmp': {
        const a = this.stringOf(e.args[0], fr).replace(/\0.*$/, '');
        const b = this.stringOf(e.args[1], fr).replace(/\0.*$/, '');
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
          if (a[i] !== b[i]) return a.charCodeAt(i) - b.charCodeAt(i);
        }
        return a.length - b.length;
      }
      case 'strcat': {
        const destNode = e.args[0];
        if (destNode.k !== 'id') throw new ClabError('strcat precisa do vetor de destino primeiro: strcat(destino, origem);', line);
        const rec = this.findRec(destNode.name, fr, line);
        if (!rec.isArray || !rec.cells || rec.base !== 'char') throw new ClabError(`'${destNode.name}' precisa ser um char[]`, line);
        const cur = this.stringOf(destNode, fr).replace(/\0.*$/, '');
        const add = this.stringOf(e.args[1], fr).replace(/\0.*$/, '');
        const out = [...cur, ...add, '\0'];
        if (out.length > rec.cells.length) {
          throw new ClabError(`Juntando os textos dá ${cur.length + add.length} letras + '\\0' — não cabe em ${rec.name}[${rec.cells.length}]`, line);
        }
        for (let i = 0; i < out.length; i++) rec.cells[i] = out[i];
        return 0;
      }
      case 'toupper': case 'tolower': {
        const v = this.evalExpr(e.args[0], fr);
        const code = toNum(v);
        const ch = typeof v === 'string' ? v : String.fromCharCode(code);
        return e.name === 'toupper' ? ch.toUpperCase()[0] ?? ch : ch.toLowerCase()[0] ?? ch;
      }
      case 'abs': return Math.abs(Math.trunc(toNum(this.evalExpr(e.args[0], fr))));
      case 'fabs': return Math.abs(toNum(this.evalExpr(e.args[0], fr)));
      case 'sqrt': {
        const n = toNum(this.evalExpr(e.args[0], fr));
        if (n < 0) throw new ClabError('sqrt de número negativo — não existe raiz real de negativo', line);
        return Math.sqrt(n);
      }
      case 'pow': return Math.pow(toNum(this.evalExpr(e.args[0], fr)), toNum(this.evalExpr(e.args[1], fr)));
      case 'floor': return Math.floor(toNum(this.evalExpr(e.args[0], fr)));
      case 'ceil': return Math.ceil(toNum(this.evalExpr(e.args[0], fr)));
      case 'round': return Math.round(toNum(this.evalExpr(e.args[0], fr)));
      case 'srand': this.state.randState = Math.trunc(toNum(this.evalExpr(e.args[0], fr))) >>> 0; return 0;
      case 'rand': {
        this.state.randState = (Math.imul(this.state.randState, 1103515245) + 12345) >>> 0;
        return this.state.randState % 2147483648;
      }
      case 'getchar': {
        if (this.state.inPos >= this.state.input.length) return -1;
        return this.state.input.charCodeAt(this.state.inPos++);
      }
      case 'system': case 'fflush': return 0; // ignorados no Lab
      default:
        throw new ClabError(`Função '${e.name}' não é suportada no Lab — use as do material (printf, scanf, strlen, strcpy, strcmp, strcat, sqrt, pow, fabs, abs, floor, ceil, round, rand, toupper, tolower...)`, line);
    }
  }

  private doPrintf(fmt: string, argNodes: Expr[], fr: Frame, line: number): Value {
    let out = '';
    let ai = 0;
    for (let i = 0; i < fmt.length; i++) {
      const ch = fmt[i];
      if (ch !== '%') { out += ch; continue; }
      let j = i + 1;
      let left = false;
      while (j < fmt.length && '-+ 0#'.includes(fmt[j])) { if (fmt[j] === '-') left = true; j++; }
      let width = '';
      while (j < fmt.length && fmt[j] >= '0' && fmt[j] <= '9') { width += fmt[j]; j++; }
      let prec = '';
      if (fmt[j] === '.') {
        j++;
        while (j < fmt.length && fmt[j] >= '0' && fmt[j] <= '9') { prec += fmt[j]; j++; }
      }
      while (fmt[j] === 'l') j++;
      const spec = fmt[j];
      if (spec === undefined) { out += '%'; break; }
      i = j;
      if (spec === '%') { out += '%'; continue; }
      const node = argNodes[ai];
      if (node === undefined) throw new ClabError(`printf: faltou o valor do %${spec}`, line);
      ai++;
      let piece = '';
      switch (spec) {
        case 'd': case 'i': case 'u': {
          const n = Math.trunc(toNum(this.evalExpr(node, fr)));
          piece = String(Math.abs(n));
          if (n < 0) piece = '-' + piece;
          break;
        }
        case 'f': piece = toNum(this.evalExpr(node, fr)).toFixed(prec ? parseInt(prec, 10) : 6); break;
        case 'g': {
          const s = toNum(this.evalExpr(node, fr)).toFixed(prec ? parseInt(prec, 10) : 6);
          piece = s.replace(/\.?0+$/, '');
          break;
        }
        case 'c': {
          const v = this.evalExpr(node, fr);
          piece = typeof v === 'string' ? v : String.fromCharCode(toNum(v));
          break;
        }
        case 's': piece = this.stringOf(node, fr).replace(/\0.*$/, ''); break;
        case 'x': piece = (Math.trunc(toNum(this.evalExpr(node, fr))) >>> 0).toString(16); break;
        default:
          throw new ClabError(`printf: formato %${spec} não suportado — use %d %i %u %f %g %c %s %x ou %%`, line);
      }
      const w = parseInt(width || '0', 10);
      if (w > piece.length) piece = left ? piece.padEnd(w, ' ') : piece.padStart(w, ' ');
      out += piece;
    }
    this.appendOutput(out, line);
    return out.length;
  }

  private doScanf(fmt: string, argNodes: Expr[], fr: Frame, line: number): Value {
    let count = 0;
    let ai = 0;
    for (let i = 0; i < fmt.length; i++) {
      if (fmt[i] !== '%') continue;
      let j = i + 1;
      while (j < fmt.length && (fmt[j] === '*' || (fmt[j] >= '0' && fmt[j] <= '9'))) j++;
      while (fmt[j] === 'l') j++;
      const spec = fmt[j];
      i = j;
      if (spec === undefined) break;
      if (spec === '%') continue;
      const node = argNodes[ai];
      if (node === undefined) throw new ClabError(`scanf: faltou o &variável do %${spec}`, line);
      ai++;
      if (spec === 's') {
        if (node.k !== 'id') throw new ClabError('scanf %s lê texto: passe o char[] direto, sem &', line);
        const rec = this.findRec(node.name, fr, line);
        if (!rec.isArray || !rec.cells || rec.base !== 'char') throw new ClabError(`scanf %s precisa de um char[] — '${node.name}' não é`, line);
        const tok = this.readToken(line);
        if (tok.length + 1 > rec.cells.length) {
          throw new ClabError(`O texto "${tok}" (${tok.length} letras + '\\0') não cabe em ${rec.name}[${rec.cells.length}]`, line);
        }
        for (let k = 0; k < rec.cells.length; k++) rec.cells[k] = undefined;
        for (let k = 0; k < tok.length; k++) rec.cells[k] = tok[k];
        rec.cells[tok.length] = '\0';
        count++;
        continue;
      }
      if (node.k !== 'addr') {
        throw new ClabError(`scanf: faltou o & — use scanf("%${spec}", &variavel)`, line);
      }
      const lv = this.getLvalue(node.e, fr);
      if (lv.isArray) throw new ClabError('scanf: passe &v[i] para uma posição específica', line);
      let v: Value;
      if (spec === 'd' || spec === 'i' || spec === 'u') {
        const tok = this.readToken(line);
        if (!/^[+-]?\d+$/.test(tok)) throw new ClabError(`scanf %${spec}: esperava um número inteiro, mas veio '${tok}'`, line);
        v = parseInt(tok, 10);
      } else if (spec === 'f' || spec === 'g' || spec === 'e') {
        const tok = this.readToken(line);
        const n = Number(tok.replace(',', '.'));
        if (!Number.isFinite(n)) throw new ClabError(`scanf %${spec}: esperava um número, mas veio '${tok}'`, line);
        v = n;
      } else if (spec === 'c') {
        if (this.state.inPos >= this.state.input.length) {
          throw new ClabError("Acabou a entrada para o scanf — preencha o painel 'Entrada' (um valor por linha ou separado por espaço)", line);
        }
        v = this.state.input[this.state.inPos++];
      } else {
        throw new ClabError(`scanf: formato %${spec} não suportado — use %d %f %c %s`, line);
      }
      this.storeLvalue(lv.rec, lv.path, this.convert(lv.rec.base, v, line), line);
      count++;
    }
    return count;
  }

  private readToken(line: number): string {
    while (this.state.inPos < this.state.input.length && /\s/.test(this.state.input[this.state.inPos])) this.state.inPos++;
    if (this.state.inPos >= this.state.input.length) {
      throw new ClabError("Acabou a entrada para o scanf — preencha o painel 'Entrada' com os valores, na ordem (separados por espaço ou linha)", line);
    }
    let out = '';
    while (this.state.inPos < this.state.input.length && !/\s/.test(this.state.input[this.state.inPos])) {
      out += this.state.input[this.state.inPos++];
    }
    return out;
  }

  private appendOutput(s: string, line: number) {
    if (this.state.output.length + s.length > MAX_OUTPUT) {
      throw new ClabError('O printf escreveu demais (mais de 8000 caracteres) — tem um laço imprimindo sem parar?', line);
    }
    this.state.output += s;
  }

  /** Valor textual: "literal", char[] (até o '\0') ou char. */
  private stringOf(node: Expr, fr: Frame, depth = 0): string {
    if (node.k === 'str') return node.v;
    if (node.k === 'char') return node.v;
    if (node.k === 'id' && depth < 2) {
      const rec = this.findRec(node.name, fr, node.line);
      if (rec.isArray && rec.cells && rec.base === 'char') {
        let out = '';
        for (const c of rec.cells) {
          if (c === undefined) break;
          if (c === '\0') break;
          out += c;
        }
        return out;
      }
      if (rec.isArray) throw new ClabError(`'${node.name}' não é um char[] — só vetor de letras vira texto`, node.line);
      return String(rec.value ?? '');
    }
    if (node.k === 'index' && depth < 2) {
      const arr = this.arrayRefOf(node.arr, fr, node.line);
      if (arr.base === 'char') {
        const idx = Math.trunc(toNum(this.evalExpr(node.idx, fr)));
        const row = arr.cells as unknown[];
        return row.slice(0, idx).map((c) => (c === undefined ? '?' : String(c))).join('');
      }
    }
    throw new ClabError('Aqui era esperado um texto (string entre aspas ou char[])', node.line);
  }

  // ---------- lvalues ----------

  private getLvalue(e: Expr, fr: Frame): { rec: VRec; path: number[] | null; isArray: boolean } {
    if (e.k === 'id') {
      const rec = this.findRec(e.name, fr, e.line);
      return { rec, path: null, isArray: rec.isArray };
    }
    if (e.k === 'index') {
      // desmonta a cadeia v[i][j]
      const dims: Expr[] = [];
      let cur: Expr = e;
      while (cur.k === 'index') { dims.unshift(cur.idx); cur = cur.arr; }
      if (cur.k !== 'id') throw new ClabError('Só dá para atribuir em variável ou v[i]', e.line);
      const rec = this.findRec(cur.name, fr, e.line);
      if (!rec.isArray || !rec.cells || !rec.dims) throw new ClabError(`'${cur.name}' não é um vetor`, e.line);
      const path: number[] = [];
      let cells = rec.cells;
      for (let d = 0; d < dims.length; d++) {
        const idx = Math.trunc(toNum(this.evalExpr(dims[d], fr)));
        const lim = rec.dims[d] ?? (Array.isArray(cells) ? cells.length : 0);
        if (idx < 0 || idx >= lim) {
          throw new ClabError(`Índice ${idx} fora do vetor '${cur.name}' na dimensão ${d + 1} (vai de 0 a ${lim - 1}) — esse é o famoso estouro de vetor`, e.line);
        }
        path.push(idx);
        cells = cells[idx] as unknown[];
        if (d < dims.length - 1 && !Array.isArray(cells)) {
          throw new ClabError(`'${cur.name}' não tem ${dims.length} dimensões — confira os colchetes`, e.line);
        }
      }
      if (path.length > rec.dims.length) {
        throw new ClabError(`'${cur.name}' tem ${rec.dims.length} dimensão(ões), mas recebeu ${path.length} índices`, e.line);
      }
      return { rec, path, isArray: path.length < rec.dims.length };
    }
    throw new ClabError('Do lado esquerdo precisa de variável ou v[i]', e.line);
  }

  private readLvalue(lv: { rec: VRec; path: number[] | null; isArray: boolean }, line: number): Value {
    if (lv.path === null) {
      if (lv.rec.value === undefined) {
        throw new ClabError(`Lendo '${lv.rec.name}' antes de dar um valor a ele — inicie a variável primeiro`, line);
      }
      return lv.rec.value;
    }
    let cells = lv.rec.cells;
    for (const idx of lv.path) {
      if (!Array.isArray(cells)) throw new ClabError('Índice fora do vetor', line);
      cells = cells[idx] as unknown[];
    }
    if (cells === undefined) {
      throw new ClabError(`Lendo '${lv.rec.name}[...]' antes de guardar algo nessa posição — posições de vetor começam sem valor`, line);
    }
    return cells as unknown as Value;
  }

  private storeLvalue(rec: VRec, path: number[] | null, v: Value, line: number) {
    if (path === null) { rec.value = v; return; }
    let cells = rec.cells;
    for (let d = 0; d < path.length - 1; d++) {
      if (!Array.isArray(cells)) throw new ClabError('Índice fora do vetor', line);
      cells = cells[path[d]] as unknown[];
    }
    if (!Array.isArray(cells)) throw new ClabError('Índice fora do vetor', line);
    cells[path[path.length - 1]] = v;
  }

  private readIndex(e: Extract<Expr, { k: 'index' }>, fr: Frame): Value {
    const lv = this.getLvalue(e, fr);
    if (lv.isArray) {
      // leitura parcial: v[i] de 2D usado como vetor (raro) — trata como erro didático
      throw new ClabError(`'${lv.rec.name}' é um vetor de vetores — use dois índices: ${lv.rec.name}[i][j]`, e.line);
    }
    return this.readLvalue(lv, e.line);
  }

  private findRec(name: string, fr: Frame, line: number): VRec {
    const rec = fr.vars.find((v) => v.name === name);
    if (rec) return rec;
    const g = this.state.frames[0];
    if (g !== fr) {
      const recG = g.vars.find((v) => v.name === name);
      if (recG) return recG;
    }
    throw new ClabError(`Variável '${name}' não existe nesse escopo — declare antes de usar (ex.: int ${name};)`, line);
  }

  private convert(base: BType, v: Value, line: number): Value {
    if (base === 'char') {
      if (typeof v === 'string') return v[0] ?? '\0';
      const n = Math.trunc(v);
      if (!Number.isFinite(n)) throw new ClabError('Valor inválido para char', line);
      return String.fromCharCode(n);
    }
    const n = toNum(v);
    if (!Number.isFinite(n)) throw new ClabError('Conta gerou um valor inválido (NaN/infinito) — confira os números', line);
    if (base === 'int' || base === 'bool') {
      const t = Math.trunc(n);
      return base === 'bool' ? (t === 0 ? 0 : 1) : t;
    }
    return n; // float/double
  }

  private truthy(v: Value): boolean {
    return toNum(v) !== 0;
  }

  private fmtVal(v: Value | undefined): string {
    if (v === undefined) return '?';
    return typeof v === 'string' ? `'${v === '\0' ? '\\0' : v}'` : trimNum(v);
  }

  /** Representação curta de uma expressão para as notas (ex.: condição do while). */
  private fmt(e: Expr, fr: Frame): string {
    try {
      if (e.k === 'id' || e.k === 'index' || e.k === 'un' || e.k === 'bin' || e.k === 'logic' || e.k === 'call') {
        return `${stmtTextOf(e)} = ${this.fmtVal(this.evalExpr(e, fr))}`;
      }
      return this.fmtVal(this.evalExpr(e, fr));
    } catch {
      return stmtTextOf(e);
    }
  }

  private typeLabel(rec: VRec): string {
    if (!rec.isArray) return rec.base;
    const dims = rec.dims ?? [];
    return `${rec.base}[${dims.join('][')}]`;
  }

  // ---------- visualização ----------

  private buildView(): ViewFrame[] {
    return this.state.frames.map((f) => ({
      fn: f.fn,
      isGlobal: f.isGlobal,
      vars: f.vars.map((v) => {
        const base: ViewVar = {
          name: v.name,
          type: this.typeLabel(v),
          base: v.base,
          kind: v.isArray ? 'array' : 'scalar',
          addr: hexAddr(v.addr),
          alias: v.alias,
        };
        if (v.isArray) {
          const flat = (cells: unknown[]): string[] => cells.map((c) => (Array.isArray(c) ? '{...}' : fmtCell(c as Value | undefined, v.base)));
          if ((v.dims?.length ?? 0) >= 2 && v.cells) {
            base.rows = (v.cells as unknown[]).map((row) => (Array.isArray(row) ? flat(row) : ['?']));
          } else if (v.cells) {
            base.cells = flat(v.cells);
            if (v.base === 'char') {
              let txt = '';
              for (const c of v.cells) { if (c === undefined || c === '\0') break; txt += c; }
              base.strText = txt;
            }
          }
        } else {
          if (v.value === undefined) base.uninitialized = true;
          else base.value = fmtScalar(v.value, v.base);
        }
        return base;
      }),
    }));
  }
}

function stmtTextOf(e: Expr): string {
  // reconstrução curta da expressão para notas — usa o que o parser guardou
  switch (e.k) {
    case 'id': return e.name;
    case 'num': return String(e.v);
    case 'char': return `'${e.v === '\0' ? '\\0' : e.v}'`;
    case 'str': return `"${e.v}"`;
    case 'bin': return `${stmtTextOf(e.l)} ${e.op} ${stmtTextOf(e.r)}`;
    case 'logic': return `${stmtTextOf(e.l)} ${e.op} ${stmtTextOf(e.r)}`;
    case 'un': return `${e.op}${stmtTextOf(e.e)}`;
    case 'incdec': return e.postfix ? `${stmtTextOf(e.e)}${e.op}` : `${e.op}${stmtTextOf(e.e)}`;
    case 'assign': return `${stmtTextOf(e.lhs)} ${e.op} ${stmtTextOf(e.rhs)}`;
    case 'ternary': return `${stmtTextOf(e.c)} ? ${stmtTextOf(e.a)} : ${stmtTextOf(e.b)}`;
    case 'call': return `${e.name}(${e.args.map(stmtTextOf).join(', ')})`;
    case 'index': return `${stmtTextOf(e.arr)}[${stmtTextOf(e.idx)}]`;
    case 'cast': return `(${e.base})${stmtTextOf(e.e)}`;
    case 'sizeof': return 'sizeof';
    case 'addr': return `&${stmtTextOf(e.e)}`;
    default: return '?';
  }
}
