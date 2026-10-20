/**
 * Fluxograma — da AST do clab para o desenho clássico de algoritmo
 * -----------------------------------------------------------------
 * "E se o compilador desenhasse o raciocínio?" — é isto. O parser já entrega
 * a árvore do programa (cada Stmt com `line` e `text`); este módulo caminha
 * pela árvore e monta o fluxograma nos símbolos de sempre: oval (início/fim),
 * retângulo (processo), losango (decisão), paralelogramo (entrada/saída) e
 * setas com Sim/Não — incluindo setas de volta dos laços, break/continue e
 * switch com seus casos.
 *
 * Zero dependências: layout próprio em colunas com canais de roteamento
 * (esquerda = volta do laço/continue, direita = saída "Não"/break).
 * O nó guarda a linha do código-fonte → a UI acende o nó que está rodando
 * na timeline do Lab (o fluxograma vira o mapa da execução).
 *
 * Cada função do programa vira um FlowChart próprio (main, funções...).
 */
import type { Expr, Program, Stmt } from './parser';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type FlowNodeKind = 'start' | 'end' | 'process' | 'decision' | 'io' | 'return' | 'merge';

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  /** Rótulo já quebrado em linhas (pronto para <tspan>). */
  lines: string[];
  /** Linha do código-fonte que originou o nó (para acender na execução). */
  line?: number;
  /** Centro do nó. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** "Sim" / "Não" / valor do case / "break"… */
  label?: string;
  /** Linha de origem (para acender junto do nó da mesma linha). */
  line?: number;
  /** Polilinha ortogonal (pontos na ordem, da saída à chegada). */
  points: { x: number; y: number }[];
  /** Arestas de volta (laço) e continue — tracejadas na UI. */
  dashed?: boolean;
}

export interface FlowChart {
  /** Nome da função. */
  fn: string;
  /** Assinatura curta para o seletor (ex.: "main()", "mmc(a, b)"). */
  signature: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Métricas do desenho
// ---------------------------------------------------------------------------

const PAD = 96; // margem lateral (cabe os canais da esquerda)
const PAD_TOP = 30;
const COL = 252; // passo horizontal entre colunas
const GAP = 54; // respiro vertical entre caixas

const PROC_W = 208;
const PILL_W = 118; // break/continue
const RET_W = 172;
const DEC_W = 196;
const DEC_H_BASE = 46; // + 15 por linha extra
const TERM_W = 138;
const TERM_H = 42;
const MERGE_R = 9;

const CH_EXIT = 44; // canal direito: saída "Não" / casos
const CH_CASE = 26; // passo entre canais de casos do switch
const CH_BREAK = 68; // canal direito: break/return
const CH_BACK = 38; // canal esquerdo: volta do laço
const CH_BACK_STEP = 20; // laços aninhados deslocam o canal
const CH_CONT = 62; // canal esquerdo: continue

const MAX_ELEMENTS = 380;

class TooBigError extends Error {}

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

/** Quebra o rótulo em linhas com reticências na última, se precisar. */
function wrapText(s: string, maxChars: number, maxLines: number): string[] {
  const clean = s.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return [clean];
  const lines: string[] = [];
  let rest = clean;
  while (rest.length > maxChars && lines.length < maxLines - 1) {
    let cut = rest.lastIndexOf(' ', maxChars);
    if (cut < maxChars * 0.5) cut = maxChars;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > maxChars) {
    let cut = rest.lastIndexOf(' ', maxChars - 1);
    if (cut < maxChars * 0.5) cut = maxChars - 1;
    lines.push(`${rest.slice(0, cut).trim()}…`);
  } else {
    lines.push(rest);
  }
  return lines;
}

/** Texto compacto de uma expressão (init/cond/update do for, cases, do-while). */
function exprLabel(e: Expr): string {
  const child = (x: Expr): string => {
    const parens = x.k === 'bin' || x.k === 'logic' || x.k === 'ternary' || x.k === 'assign';
    return parens ? `(${exprLabel(x)})` : exprLabel(x);
  };
  switch (e.k) {
    case 'num':
      return String(e.v);
    case 'str':
      return `"${e.v}"`;
    case 'char':
      return `'${e.v}'`;
    case 'id':
      return e.name;
    case 'un':
      return `${e.op}${child(e.e)}`;
    case 'incdec':
      return e.postfix ? `${child(e.e)}${e.op}` : `${e.op}${child(e.e)}`;
    case 'bin':
      return `${child(e.l)} ${e.op} ${child(e.r)}`;
    case 'logic':
      return `${child(e.l)} ${e.op} ${child(e.r)}`;
    case 'assign':
      return `${exprLabel(e.lhs)} ${e.op} ${exprLabel(e.rhs)}`;
    case 'ternary':
      return `${child(e.c)} ? ${exprLabel(e.a)} : ${exprLabel(e.b)}`;
    case 'call':
      return `${e.name}(${e.args.map(exprLabel).join(', ')})`;
    case 'index':
      return `${exprLabel(e.arr)}[${exprLabel(e.idx)}]`;
    case 'cast':
      return `(${e.base})${child(e.e)}`;
    case 'sizeof':
      return 'sizeof(…)';
    case 'addr':
      return `&${child(e.e)}`;
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

interface Anchor {
  nodeId: string;
  x: number;
  y: number;
  /** Meia-largura do nó (para entrar/sair pelo lado certo). */
  hw: number;
}

interface Region {
  /** Ancoragem do topo, onde a seta de entrada chega. */
  entry: Anchor | null;
  /** Ancoragem de saída para o próximo comando (null = terminou em return/break). */
  out: Anchor | null;
  /** y mais baixo usado (base real, em px). */
  endY: number;
}

interface LoopFrame {
  kind: 'loop' | 'switch';
  /** Nó de saída do laço/switch — nasce só no fim do corpo. */
  exitNode: FlowNode | null;
  /** Breaks pendentes (o nó de saída ainda não existe). */
  pendingBreaks: { node: FlowNode; line?: number }[];
  /** Alvo do continue e sua ancoragem (null até nascer — do-while/for). */
  continueAnchor: Anchor | null;
  pendingContinues: { node: FlowNode; line?: number }[];
  depth: number;
}

function colX(col: number): number {
  return PAD + PROC_W / 2 + col * COL;
}

const topOf = (n: FlowNode): Anchor => ({ nodeId: n.id, x: n.x, y: n.y - n.h / 2, hw: n.w / 2 });
const botOf = (n: FlowNode): Anchor => ({ nodeId: n.id, x: n.x, y: n.y + n.h / 2, hw: n.w / 2 });
const leftOf = (n: FlowNode): Anchor => ({ nodeId: n.id, x: n.x - n.w / 2, y: n.y, hw: n.w / 2 });
const rightOf = (n: FlowNode): Anchor => ({ nodeId: n.id, x: n.x + n.w / 2, y: n.y, hw: n.w / 2 });
const mergeBot = (n: FlowNode): Anchor => ({ nodeId: n.id, x: n.x, y: n.y + MERGE_R, hw: MERGE_R });
const mergeTop = (n: FlowNode): Anchor => ({ nodeId: n.id, x: n.x, y: n.y - MERGE_R, hw: MERGE_R });

class FnBuilder {
  private readonly nodes: FlowNode[] = [];
  private readonly edges: FlowEdge[] = [];
  private readonly seq = { n: 0 };
  private readonly frames: LoopFrame[] = [];
  private readonly pendingReturns: { node: FlowNode; line?: number }[] = [];
  private loopDepth = 0;

  // ---- primitivas ----

  private nextId(prefix: string): string {
    this.seq.n += 1;
    return `${prefix}${this.seq.n}`;
  }

  private addNode(
    kind: FlowNodeKind,
    label: string,
    x: number,
    yTop: number,
    opts: { w?: number; line?: number; wrap?: number; maxLines?: number } = {},
  ): FlowNode {
    if (this.nodes.length + this.edges.length >= MAX_ELEMENTS) throw new TooBigError();
    const wrapChars = opts.wrap ?? 30;
    const maxLines = opts.maxLines ?? 3;
    const lines = label ? wrapText(label, wrapChars, maxLines) : [];
    let w = opts.w ?? PROC_W;
    let h: number;
    if (kind === 'decision') {
      w = DEC_W;
      h = DEC_H_BASE + (lines.length - 1) * 15 + 12;
    } else if (kind === 'merge') {
      w = MERGE_R * 2;
      h = MERGE_R * 2;
    } else if (kind === 'start' || kind === 'end') {
      w = TERM_W;
      h = TERM_H;
    } else {
      h = 28 + lines.length * 15;
    }
    const node: FlowNode = { id: this.nextId('n'), kind, lines, line: opts.line, x, y: yTop + h / 2, w, h };
    this.nodes.push(node);
    return node;
  }

  private addEdge(
    from: string,
    to: string,
    points: { x: number; y: number }[],
    opts: { label?: string; line?: number; dashed?: boolean } = {},
  ): void {
    if (this.nodes.length + this.edges.length >= MAX_ELEMENTS * 2) throw new TooBigError();
    this.edges.push({ id: this.nextId('e'), from, to, points, ...opts });
  }

  // ---- conectores ortogonais ----

  /** Reta vertical (mesma coluna) — a ligação padrão da cadeia. */
  private vLink(a: Anchor, b: Anchor, opts: { label?: string; line?: number } = {}): void {
    this.addEdge(a.nodeId, b.nodeId, [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ], opts);
  }

  /** Cotovelo: desce, anda na horizontal, desce — para colunas diferentes. */
  private elbowLink(a: Anchor, b: Anchor, opts: { label?: string; line?: number } = {}): void {
    if (Math.abs(a.x - b.x) < 1) {
      this.vLink(a, b, opts);
      return;
    }
    const midY = (a.y + b.y) / 2;
    this.addEdge(a.nodeId, b.nodeId, [
      { x: a.x, y: a.y },
      { x: a.x, y: midY },
      { x: b.x, y: midY },
      { x: b.x, y: b.y },
    ], opts);
  }

  /** Decisão → ramo à direita: sai pelo vértice direito, sobe o nível, desce. */
  private branchRight(d: FlowNode, target: Anchor, label: string, channelX: number, line?: number): void {
    this.addEdge(d.id, target.nodeId, [
      { x: d.x + d.w / 2, y: d.y },
      { x: channelX, y: d.y },
      { x: channelX, y: target.y },
      { x: target.x - target.hw, y: target.y },
    ], { label, line });
  }

  /** Decisão → nó de fusão pela direita (Não / caso vazio). */
  private intoMergeRight(d: FlowNode, m: FlowNode, label: string | undefined, channelX: number, line?: number): void {
    this.addEdge(d.id, m.id, [
      { x: d.x + d.w / 2, y: d.y },
      { x: channelX, y: d.y },
      { x: channelX, y: m.y },
      { x: m.x + MERGE_R, y: m.y },
    ], { label, line });
  }

  /** Volta do laço: desce, vai pela esquerda, sobe, entra no vértice do losango. */
  private backToDecision(from: Anchor, d: FlowNode, depth: number, line?: number): void {
    const chanX = d.x - d.w / 2 - CH_BACK - CH_BACK_STEP * depth;
    this.addEdge(from.nodeId, d.id, [
      { x: from.x, y: from.y },
      { x: from.x, y: from.y + 20 },
      { x: chanX, y: from.y + 20 },
      { x: chanX, y: d.y },
      { x: d.x - d.w / 2, y: d.y },
    ], { dashed: true, line });
  }

  /** continue: pela esquerda até o alvo (vértice do losango ou lado do update). */
  private continueTo(node: FlowNode, target: Anchor, depth: number, line?: number): void {
    const chanX = Math.min(node.x, target.x) - CH_CONT - CH_BACK_STEP * depth;
    this.addEdge(node.id, target.nodeId, [
      { x: node.x - node.w / 2, y: node.y },
      { x: chanX, y: node.y },
      { x: chanX, y: target.y },
      { x: target.x - target.hw, y: target.y },
    ], { label: 'continue', line, dashed: true });
  }

  /** break: pela direita até o nó de saída do laço. */
  private breakTo(node: FlowNode, exit: FlowNode, line?: number): void {
    const chanX = node.x + node.w / 2 + CH_BREAK;
    this.addEdge(node.id, exit.id, [
      { x: node.x + node.w / 2, y: node.y },
      { x: chanX, y: node.y },
      { x: chanX, y: exit.y },
      { x: exit.x + MERGE_R, y: exit.y },
    ], { label: 'break', line });
  }

  /** return: pela direita até o Fim da função (resolvido no fim da construção). */
  private deferReturn(node: FlowNode, line?: number): void {
    this.pendingReturns.push({ node, line });
  }

  // ---- frames de laço/switch ----

  private pushFrame(frame: LoopFrame): void {
    this.frames.push(frame);
    if (frame.kind === 'loop') this.loopDepth += 1;
  }

  private popFrame(frame: LoopFrame): void {
    this.frames.pop();
    if (frame.kind === 'loop') this.loopDepth -= 1;
  }

  /** Liga os breaks pendentes do frame ao nó de saída recém-nascido. */
  private resolveBreaks(frame: LoopFrame, exit: FlowNode): void {
    for (const p of frame.pendingBreaks) this.breakTo(p.node, exit, p.line);
    frame.pendingBreaks = [];
    frame.exitNode = exit;
  }

  // ---- emissão de comandos ----

  /** Normaliza um Stmt de corpo (bloco → lista; comando único → lista de 1). */
  private asList(s: Stmt): Stmt[] {
    return s.k === 'block' ? s.stmts : [s];
  }

  /** Emite uma sequência encadeada na vertical, a partir de yTop, na coluna col. */
  private emitSeq(stmts: Stmt[], col: number, yTop: number): Region {
    let anchor: Anchor | null = null;
    let entry: Anchor | null = null;
    let cursor = yTop;
    let endY = yTop;
    for (const st of stmts) {
      const reg = this.emitStmt(st, col, cursor);
      if (!reg || !reg.entry) continue; // vazio
      if (anchor) this.vLink(anchor, reg.entry, { line: st.line });
      if (!entry) entry = reg.entry;
      anchor = reg.out;
      cursor = reg.endY + GAP;
      endY = reg.endY;
      if (!reg.out) break; // return/break — o resto da sequência é inalcançável
    }
    return { entry, out: anchor, endY };
  }

  private emitStmt(st: Stmt, col: number, yTop: number): Region | null {
    switch (st.k) {
      case 'empty':
        return null;
      case 'block':
        return this.emitSeq(st.stmts, col, yTop);
      case 'decl':
      case 'expr':
        return this.emitSimple(st, col, yTop);
      case 'if':
        return this.emitIf(st, col, yTop);
      case 'while':
        return this.emitWhile(st, col, yTop);
      case 'dowhile':
        return this.emitDoWhile(st, col, yTop);
      case 'for':
        return this.emitFor(st, col, yTop);
      case 'switch':
        return this.emitSwitch(st, col, yTop);
      case 'return':
        return this.emitReturn(st, col, yTop);
      case 'break':
        return this.emitBreak(st, col, yTop);
      case 'continue':
        return this.emitContinue(st, col, yTop);
    }
  }

  private emitSimple(st: Stmt & { k: 'decl' | 'expr' }, col: number, yTop: number): Region {
    const isIO =
      st.k === 'expr' && st.e.k === 'call' && ['printf', 'scanf', 'puts'].includes(st.e.name);
    const n = this.addNode(isIO ? 'io' : 'process', st.text, colX(col), yTop, { line: st.line });
    return { entry: topOf(n), out: botOf(n), endY: n.y + n.h / 2 };
  }

  private emitIf(st: Extract<Stmt, { k: 'if' }>, col: number, yTop: number): Region {
    const d = this.addNode('decision', st.text, colX(col), yTop, { line: st.line, wrap: 22, maxLines: 2 });
    const branchY = d.y + d.h / 2 + GAP;

    const thenR = this.emitSeq(this.asList(st.then), col, branchY);
    const elseR = st.els ? this.emitSeq(this.asList(st.els), col + 1, branchY) : null;

    const bottoms = [thenR?.endY ?? 0, elseR?.endY ?? 0].filter((v) => v > 0);
    const mergeY = (bottoms.length ? Math.max(...bottoms) : d.y + d.h / 2) + (bottoms.length ? GAP : 0);
    const m = this.addNode('merge', '', colX(col), mergeY);

    // Sim → ramo do então (mesma coluna: seta reta)
    if (thenR?.entry) {
      this.vLink(botOf(d), thenR.entry, { label: 'Sim', line: st.line });
    } else {
      this.addEdge(d.id, m.id, [{ x: d.x, y: d.y + d.h / 2 }, { x: d.x, y: m.y - MERGE_R }], {
        label: 'Sim',
        line: st.line,
      });
    }
    if (thenR?.out) this.vLink(thenR.out, mergeTop(m), { line: st.line });

    if (elseR) {
      if (elseR.entry) {
        this.branchRight(d, elseR.entry, 'Não', d.x + d.w / 2 + CH_EXIT, st.line);
      } else {
        this.intoMergeRight(d, m, 'Não', d.x + d.w / 2 + CH_EXIT, st.line);
      }
      if (elseR.out) this.elbowLink(elseR.out, mergeTop(m), { line: st.line });
    } else {
      this.intoMergeRight(d, m, 'Não', d.x + d.w / 2 + CH_EXIT, st.line);
    }

    return { entry: topOf(d), out: mergeBot(m), endY: m.y + MERGE_R };
  }

  private emitWhile(st: Extract<Stmt, { k: 'while' }>, col: number, yTop: number): Region {
    const d = this.addNode('decision', st.text, colX(col), yTop, { line: st.line, wrap: 22, maxLines: 2 });
    const frame: LoopFrame = {
      kind: 'loop',
      exitNode: null,
      pendingBreaks: [],
      continueAnchor: leftOf(d),
      pendingContinues: [],
      depth: this.loopDepth,
    };

    this.pushFrame(frame);
    const body = this.emitSeq(this.asList(st.body), col, d.y + d.h / 2 + GAP);
    this.popFrame(frame);

    const exit = this.addNode('merge', '', colX(col), (body?.endY ?? d.y + d.h / 2) + GAP);
    this.resolveBreaks(frame, exit);

    // Sim → corpo
    if (body?.entry) {
      this.vLink(botOf(d), body.entry, { label: 'Sim', line: st.line });
    } else {
      this.addEdge(d.id, exit.id, [{ x: d.x, y: d.y + d.h / 2 }, { x: d.x, y: exit.y - MERGE_R }], {
        label: 'Sim',
        line: st.line,
      });
    }
    // volta do corpo para a condição
    if (body?.out) this.backToDecision(body.out, d, frame.depth, st.line);
    // continue pendente (não deve ocorrer em while — alvo já conhecido)
    for (const p of frame.pendingContinues) this.continueTo(p.node, frame.continueAnchor!, frame.depth, p.line);
    // Não → sai do laço
    this.intoMergeRight(d, exit, 'Não', d.x + d.w / 2 + CH_EXIT, st.line);

    return { entry: topOf(d), out: mergeBot(exit), endY: exit.y + MERGE_R };
  }

  private emitDoWhile(st: Extract<Stmt, { k: 'dowhile' }>, col: number, yTop: number): Region {
    const frame: LoopFrame = {
      kind: 'loop',
      exitNode: null,
      pendingBreaks: [],
      continueAnchor: null, // o losango só nasce depois do corpo
      pendingContinues: [],
      depth: this.loopDepth,
    };

    this.pushFrame(frame);
    const body = this.emitSeq(this.asList(st.body), col, yTop);
    this.popFrame(frame);

    const d = this.addNode('decision', `while (${exprLabel(st.cond)})`, colX(col), (body?.endY ?? yTop) + GAP, {
      line: st.line,
      wrap: 22,
      maxLines: 2,
    });
    frame.continueAnchor = leftOf(d);

    const exit = this.addNode('merge', '', colX(col), d.y + d.h / 2 + GAP);
    this.resolveBreaks(frame, exit);

    // corpo desce para a condição
    if (body?.out) this.vLink(body.out, topOf(d), { line: st.line });
    // Sim → volta pro corpo (canal esquerdo, tracejada)
    if (body?.entry) {
      const chanX = d.x - d.w / 2 - CH_BACK - CH_BACK_STEP * frame.depth;
      this.addEdge(d.id, body.entry.nodeId, [
        { x: d.x - d.w / 2, y: d.y },
        { x: chanX, y: d.y },
        { x: chanX, y: body.entry.y },
        { x: body.entry.x - body.entry.hw, y: body.entry.y },
      ], { label: 'Sim', line: st.line, dashed: true });
    }
    for (const p of frame.pendingContinues) this.continueTo(p.node, frame.continueAnchor!, frame.depth, p.line);
    // Não → sai
    this.addEdge(d.id, exit.id, [{ x: d.x, y: d.y + d.h / 2 }, { x: d.x, y: exit.y - MERGE_R }], {
      label: 'Não',
      line: st.line,
    });

    return {
      entry: body?.entry ?? topOf(d),
      out: mergeBot(exit),
      endY: exit.y + MERGE_R,
    };
  }

  private emitFor(st: Extract<Stmt, { k: 'for' }>, col: number, yTop: number): Region {
    let cursor = yTop;
    let entry: Anchor | null = null;

    if (st.init && st.init.k !== 'empty') {
      const initReg = this.emitStmt(st.init, col, cursor);
      if (initReg?.entry) {
        entry = initReg.entry;
        cursor = initReg.endY + GAP;
      }
    }

    const d = this.addNode('decision', st.cond ? exprLabel(st.cond) : 'sempre verdadeiro', colX(col), cursor, {
      line: st.line,
      wrap: 22,
      maxLines: 2,
    });
    if (entry) this.vLink(entry, topOf(d), { line: st.line });
    else entry = topOf(d);

    const frame: LoopFrame = {
      kind: 'loop',
      exitNode: null,
      pendingBreaks: [],
      continueAnchor: null, // o update nasce depois do corpo
      pendingContinues: [],
      depth: this.loopDepth,
    };

    this.pushFrame(frame);
    const body = this.emitSeq(this.asList(st.body), col, d.y + d.h / 2 + GAP);
    this.popFrame(frame);

    // Sim → corpo
    if (body?.entry) this.vLink(botOf(d), body.entry, { label: 'Sim', line: st.line });

    // update (alvo do continue)
    let upd: FlowNode | null = null;
    let afterBody: Anchor | null = body?.out ?? null;
    if (st.update) {
      upd = this.addNode('process', exprLabel(st.update), colX(col), (body?.endY ?? d.y + d.h / 2) + GAP, {
        line: st.line,
        wrap: 24,
        maxLines: 2,
      });
      frame.continueAnchor = leftOf(upd);
      if (afterBody) this.vLink(afterBody, topOf(upd), { line: st.line });
      afterBody = botOf(upd);
    } else {
      frame.continueAnchor = leftOf(d);
    }
    for (const p of frame.pendingContinues) this.continueTo(p.node, frame.continueAnchor!, frame.depth, p.line);

    // volta do laço
    if (afterBody) this.backToDecision(afterBody, d, frame.depth, st.line);

    // saída
    const exit = this.addNode('merge', '', colX(col), (upd ? upd.y + upd.h / 2 : body?.endY ?? d.y + d.h / 2) + GAP);
    this.resolveBreaks(frame, exit);
    this.intoMergeRight(d, exit, 'Não', d.x + d.w / 2 + CH_EXIT, st.line);

    return { entry, out: mergeBot(exit), endY: exit.y + MERGE_R };
  }

  private emitSwitch(st: Extract<Stmt, { k: 'switch' }>, col: number, yTop: number): Region {
    const d = this.addNode('decision', `switch (${exprLabel(st.disc)})`, colX(col), yTop, {
      line: st.line,
      wrap: 22,
      maxLines: 2,
    });
    const frame: LoopFrame = {
      kind: 'switch',
      exitNode: null,
      pendingBreaks: [],
      continueAnchor: null, // continue atravessa o switch (alvo é o laço externo)
      pendingContinues: [],
      depth: this.loopDepth,
    };

    const cases = st.cases.length
      ? st.cases
      : [{ match: null as Expr | null, start: 0, line: st.line }];
    const branchY = d.y + d.h / 2 + GAP;

    // 1) emite todos os casos (posições fixas: todos começam no mesmo nível)
    const caseCols: { label: string; line?: number; reg: Region; x: number }[] = [];
    let caseEndMax = branchY;
    cases.forEach((c, i) => {
      const end = i + 1 < cases.length ? cases[i + 1].start : st.body.length;
      const head = c.start > 0 && i === 0 ? st.body.slice(0, c.start) : [];
      const stmts = [...head, ...st.body.slice(Math.max(c.start, 0), Math.max(end, c.start))];
      const caseCol = col + i;
      const reg = this.emitSeq(stmts, caseCol, branchY);
      caseCols.push({ label: c.match ? exprLabel(c.match) : 'default', line: c.line ?? st.line, reg, x: colX(caseCol) });
      if (reg.endY > caseEndMax) caseEndMax = reg.endY;
    });

    // 2) nó de saída do switch
    const exit = this.addNode('merge', '', colX(col), caseEndMax + GAP);

    // 3) arestas: decisão → casos; fallthrough; último caso → saída
    this.pushFrame(frame);
    caseCols.forEach((c, i) => {
      const chanX = d.x + d.w / 2 + CH_EXIT + i * CH_CASE;
      if (c.reg.entry) {
        this.branchRight(d, c.reg.entry, c.label, chanX, c.line);
      } else {
        this.addEdge(d.id, exit.id, [
          { x: d.x + d.w / 2, y: d.y },
          { x: chanX, y: d.y },
          { x: chanX, y: exit.y },
          { x: exit.x + MERGE_R, y: exit.y },
        ], { label: c.label, line: c.line });
      }

      const next = caseCols[i + 1];
      if (c.reg.out) {
        if (next?.reg.entry) {
          // fallthrough: caso sem break desagua no caso seguinte
          this.elbowLink(c.reg.out, next.reg.entry, { line: c.line });
        } else {
          this.elbowLink(c.reg.out, mergeTop(exit), { line: c.line });
        }
      }
    });
    this.resolveBreaks(frame, exit);
    this.popFrame(frame);

    return { entry: topOf(d), out: mergeBot(exit), endY: exit.y + MERGE_R };
  }

  private emitReturn(st: Extract<Stmt, { k: 'return' }>, col: number, yTop: number): Region {
    const n = this.addNode('return', st.text, colX(col), yTop, { line: st.line, w: RET_W, wrap: 22, maxLines: 2 });
    this.deferReturn(n, st.line);
    return { entry: topOf(n), out: null, endY: n.y + n.h / 2 };
  }

  private emitBreak(st: Extract<Stmt, { k: 'break' }>, col: number, yTop: number): Region | null {
    const frame = this.frames[this.frames.length - 1];
    if (!frame) return null; // break fora de laço/switch — ignora com elegância
    const n = this.addNode('process', 'break', colX(col), yTop, { line: st.line, w: PILL_W, wrap: 12, maxLines: 1 });
    if (frame.exitNode) {
      this.breakTo(n, frame.exitNode, st.line);
    } else {
      frame.pendingBreaks.push({ node: n, line: st.line });
    }
    return { entry: topOf(n), out: null, endY: n.y + n.h / 2 };
  }

  private emitContinue(st: Extract<Stmt, { k: 'continue' }>, col: number, yTop: number): Region | null {
    // continue pertence ao laço mais interno (atravessa frames de switch)
    let fi = this.frames.length - 1;
    while (fi >= 0 && this.frames[fi].kind !== 'loop') fi -= 1;
    if (fi < 0) return null;
    const frame = this.frames[fi];
    const n = this.addNode('process', 'continue', colX(col), yTop, { line: st.line, w: PILL_W, wrap: 12, maxLines: 1 });
    if (frame.continueAnchor) {
      this.continueTo(n, frame.continueAnchor, frame.depth, st.line);
    } else {
      frame.pendingContinues.push({ node: n, line: st.line });
    }
    return { entry: topOf(n), out: null, endY: n.y + n.h / 2 };
  }

  // ---- função inteira ----

  build(fn: { name: string; params: { name: string }[]; body: Stmt[] }): FlowChart {
    const isMain = fn.name === 'main';
    const signature = isMain ? 'main()' : `${fn.name}(${fn.params.map((p) => p.name).join(', ')})`;
    const start = this.addNode('start', isMain ? 'Início' : signature, colX(0), PAD_TOP);

    const region = this.emitSeq(fn.body, 0, PAD_TOP + TERM_H + GAP);
    if (region.entry) this.vLink(botOf(start), region.entry);

    const end = this.addNode('end', isMain ? 'Fim' : `fim de ${fn.name}()`, colX(0), (region.endY ?? PAD_TOP) + GAP);
    if (region.out) this.vLink(region.out, topOf(end));

    // returns espalhados → Fim (canal direito)
    for (const p of this.pendingReturns) {
      const chanX = Math.max(p.node.x + p.node.w / 2, end.x + end.w / 2) + CH_BREAK;
      this.addEdge(p.node.id, end.id, [
        { x: p.node.x + p.node.w / 2, y: p.node.y },
        { x: chanX, y: p.node.y },
        { x: chanX, y: end.y },
        { x: end.x + end.w / 2, y: end.y },
      ], { line: p.line });
    }

    const width = Math.max(...this.nodes.map((n) => n.x + n.w / 2), 320) + PAD / 2;
    const height = Math.max(...this.nodes.map((n) => n.y + n.h / 2), 160) + PAD_TOP;
    return { fn: fn.name, signature, nodes: this.nodes, edges: this.edges, width, height };
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Um fluxograma por função (main, auxiliares…). Nunca lança. */
export function flowchartsFor(program: Program): FlowChart[] {
  const out: FlowChart[] = [];
  for (const fn of program.fns) {
    try {
      out.push(new FnBuilder().build(fn));
    } catch {
      // Código patológico (grande demais para desenhar): gráfico vazio sinaliza
      // o estado na UI — sem derrubar a aba.
      out.push({ fn: fn.name, signature: `${fn.name}()`, nodes: [], edges: [], width: 320, height: 120 });
    }
  }
  return out;
}
