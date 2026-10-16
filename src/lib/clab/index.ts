/**
 * Lab de Código — API pública
 * Reexporta o motor (lexer → parser → interpretador) e os exemplos.
 */
export { ClabEngine, ClabError } from './interpreter';
export type { ClabSnapshot, ViewFrame, ViewVar, PrepareResult } from './interpreter';
export { parseC, ClabParseError } from './parser';
export type { Program, FnDef, Stmt, Expr, BType } from './parser';
export { CLAB_EXAMPLES } from './examples';
export type { ClabExample } from './examples';
