// s0-env.ts — PEÇA 0: O AMBIENTE. Se a base não está sólida, nada encaixa.
// Verifica runtime, dependências, banco, build config e o dev server.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Check, type StageResult, timedCheck, setBaseUrl, SUITE_DIR,
} from '../lib/chain';
import { runCmd } from '../lib/proc';

const ROOT = SUITE_DIR.replace(/\/test-suite$/, '');

export async function run(): Promise<StageResult> {
  const t0 = Date.now();
  const checks: Check[] = [];

  await timedCheck(checks, 'bun runtime presente', async () => {
    const r = await runCmd('bun', ['--version']);
    return { ok: r.ok, severity: 'error' as const, detail: `bun ${r.stdout.trim()}` };
  });

  await timedCheck(checks, 'node_modules instalado', async () => {
    const ok = existsSync(join(ROOT, 'node_modules', 'next'));
    return { ok, severity: 'error' as const, detail: ok ? 'next presente' : 'rode bun install' };
  });

  await timedCheck(checks, 'prisma schema + cliente gerado', async () => {
    const schema = existsSync(join(ROOT, 'prisma', 'schema.prisma'));
    const client = existsSync(join(ROOT, 'node_modules', '.prisma', 'client'));
    return {
      ok: schema && client,
      severity: schema ? 'warning' : 'error',
      detail: `schema=${schema} client=${client}`,
    };
  });

  await timedCheck(checks, 'db local existe', async () => {
    const dbDir = join(ROOT, 'db');
    const ok = existsSync(dbDir);
    return { ok, severity: 'warning' as const, detail: ok ? 'pasta db presente' : 'sem pasta db' };
  });

  await timedCheck(checks, 'next.config.ts presente', async () => {
    const ok = existsSync(join(ROOT, 'next.config.ts'));
    return { ok, severity: 'error' as const };
  });

  await timedCheck(checks, 'dev server responde 200 em /', async () => {
    try {
      const res = await fetch('http://localhost:3000/', { signal: AbortSignal.timeout(15_000) });
      setBaseUrl('http://localhost:3000');
      return {
        ok: res.status === 200,
        severity: 'error' as const,
        detail: `GET / → ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        severity: 'error' as const,
        detail: `dev server não acessível: ${err instanceof Error ? err.message : err} — rode bun run dev`,
      };
    }
  });

  await timedCheck(checks, 'página serve HTML com root do React', async () => {
    const res = await fetch('http://localhost:3000/', { signal: AbortSignal.timeout(15_000) });
    const html = await res.text();
    const ok = html.includes('<div') && (html.includes('__next') || html.includes('id="root"') || html.length > 5000);
    return {
      ok,
      severity: 'error' as const,
      detail: `html ${html.length} bytes`,
    };
  });

  await timedCheck(checks, 'fonts/tema: globals.css com tokens da casa (AMOLED + teal)', async () => {
    const css = readFileSync(join(ROOT, 'src', 'app', 'globals.css'), 'utf8');
    const hasDark = css.includes('--background') && css.includes('--primary');
    const textWrap = css.includes('text-wrap');
    return {
      ok: hasDark,
      severity: 'warning' as const,
      detail: `tokens=${hasDark} text-wrap=${textWrap}`,
    };
  });

  const ok = checks.every((c) => c.ok || c.severity !== 'error');
  return {
    piece: 0,
    name: 'Ambiente',
    ok,
    ms: Date.now() - t0,
    checks,
    data: { baseUrl: 'http://localhost:3000' },
  };
}
