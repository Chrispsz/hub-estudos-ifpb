// chain.ts — A ESTRUTURA DO QUEBRA-CABEÇA
// ---------------------------------------------------------------
// A suíte é uma CADEIA de peças: cada peça produz um artefato em
// test-suite/.chain/ e a peça seguinte consome o artefato anterior.
// Se uma peça não encaixa (falha), a cadeia para ali (a menos que
// --continue) e o relatório mostra exatamente ONDE o encaixe quebrou.
//
//   PEÇA 0 ambiente ─▶ PEÇA 1 código ─▶ PEÇA 2 núcleo puro ─▶
//   PEÇA 3 API HTTP ─▶ PEÇA 4 jornada E2E ─▶ PEÇA 5 visual ─▶ RELATÓRIO

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const SUITE_DIR = join(import.meta.dir, '..');
export const CHAIN_DIR = join(SUITE_DIR, '.chain');
export const SHOTS_DIR = join(CHAIN_DIR, 'shots');
export const REPORT_PATH = join(SUITE_DIR, 'report.md');

/** URL base do site — preenchida pela Peça 0, consumida por 3, 4 e 5. */
export let BASE_URL = 'http://localhost:3000';
export function setBaseUrl(url: string) { BASE_URL = url; }

export interface Check {
  name: string;
  ok: boolean;
  /** warning = não quebra a cadeia, mas entra no relatório. */
  severity: 'error' | 'warning' | 'info';
  ms?: number;
  detail?: string;
}

export interface StageResult {
  piece: number;
  name: string;
  ok: boolean;
  ms: number;
  checks: Check[];
  /** Dados que a peça escreve para a próxima consumir. */
  data?: Record<string, unknown>;
}

export interface Piece {
  piece: number;
  name: string;
  description: string;
  run: () => Promise<StageResult>;
}

export function initChainDirs() {
  mkdirSync(SHOTS_DIR, { recursive: true });
}

export function resetChain() {
  if (existsSync(CHAIN_DIR)) rmSync(CHAIN_DIR, { recursive: true, force: true });
  mkdirSync(SHOTS_DIR, { recursive: true });
}

export function artifactPath(piece: number): string {
  return join(CHAIN_DIR, `piece-${piece}.json`);
}

export function saveArtifact(result: StageResult) {
  writeFileSync(artifactPath(result.piece), JSON.stringify(result, null, 2));
}

export function loadArtifact<T = StageResult>(piece: number): T | null {
  const p = artifactPath(piece);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Helper para montar checks cronometrados. */
export async function timedCheck(
  checks: Check[],
  name: string,
  fn: () => Promise<Omit<Check, 'name' | 'ms'>> | Omit<Check, 'name' | 'ms'>,
): Promise<void> {
  const t0 = Date.now();
  try {
    const out = await fn();
    checks.push({ name, ms: Date.now() - t0, ...out });
  } catch (err) {
    checks.push({
      name,
      ok: false,
      severity: 'error',
      ms: Date.now() - t0,
      detail: String(err instanceof Error ? err.message : err),
    });
  }
}

export function summarize(result: StageResult): string {
  const icon = result.ok ? '✅' : '❌';
  const errors = result.checks.filter((c) => !c.ok && c.severity === 'error').length;
  const warnings = result.checks.filter((c) => !c.ok && c.severity === 'warning').length;
  return `${icon} PEÇA ${result.piece} · ${result.name} — ${result.ms}ms · ${result.checks.length} checks (${errors} erros, ${warnings} avisos)`;
}
