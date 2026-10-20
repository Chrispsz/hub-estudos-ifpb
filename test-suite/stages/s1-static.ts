// s1-static.ts — PEÇA 1: QUALIDADE DO CÓDIGO. Lint, tipos e as leis da casa.
// As "leis da casa" são os invariantes de arquitetura que o projeto assumiu:
//   · fetch sempre relativo (nada de http://localhost ou porta na URL)
//   · z-ai-web-dev-sdk SOMENTE no backend (src/app/api)
//   · console.log moderado no código de produção

import { type Check, type StageResult, timedCheck } from '../lib/chain';
import { runCmd, runShell } from '../lib/proc';

export async function run(): Promise<StageResult> {
  const t0 = Date.now();
  const checks: Check[] = [];

  await timedCheck(checks, 'ESLint passa (bun run lint)', async () => {
    const r = await runCmd('bun', ['run', 'lint'], { timeoutMs: 300_000 });
    if (!r.ok) {
      const tail = (r.stdout + '\n' + r.stderr).trim().split('\n').slice(-25).join('\n');
      return { ok: false, severity: 'error' as const, detail: tail };
    }
    return { ok: true, severity: 'error' as const, detail: `${r.ms}ms sem warnings` };
  });

  await timedCheck(checks, 'TypeScript compila sem erro (tsc --noEmit: app + suíte)', async () => {
    const app = await runCmd('bunx', ['tsc', '--noEmit'], { timeoutMs: 420_000 });
    if (!app.ok) {
      const tail = (app.stdout + '\n' + app.stderr).trim().split('\n').slice(-25).join('\n');
      return { ok: false, severity: 'error' as const, detail: `app: ${tail}` };
    }
    const suite = await runCmd('bunx', ['tsc', '--noEmit', '-p', 'test-suite/tsconfig.json'], { timeoutMs: 180_000 });
    if (!suite.ok) {
      const tail = (suite.stdout + '\n' + suite.stderr).trim().split('\n').slice(-20).join('\n');
      return { ok: false, severity: 'error' as const, detail: `suíte de testes: ${tail}` };
    }
    return { ok: true, severity: 'error' as const, detail: `app ${app.ms}ms + suíte ${suite.ms}ms — ambos limpos` };
  });

  await timedCheck(checks, 'LEI DA CASA: fetch sempre relativo (sem http://localhost/porta em src/)', async () => {
    const r = await runShell(
      `rg -n "fetch\\(['\\"]https?://(localhost|127\\.0\\.0\\.1)|:3000/api|:3030/api" src/ --glob '!**/node_modules/**' || true`,
    );
    const hits = r.stdout.trim();
    return {
      ok: hits.length === 0,
      severity: 'error' as const,
      detail: hits.length ? hits.split('\n').slice(0, 10).join(' · ') : 'nenhum fetch absoluto',
    };
  });

  await timedCheck(checks, 'LEI DA CASA: z-ai-web-dev-sdk só no backend (src/app/api)', async () => {
    const r = await runShell(
      `rg -l "z-ai-web-dev-sdk" src/ --glob '!src/app/api/**' --glob '!**/node_modules/**' || true`,
    );
    const hits = r.stdout.trim();
    return {
      ok: hits.length === 0,
      severity: 'error' as const,
      detail: hits.length ? `fora do backend: ${hits.split('\n').slice(0, 6).join(', ')}` : 'SDK confinado ao backend',
    };
  });

  await timedCheck(checks, 'higiene: console.log em produção (informativo)', async () => {
    const r = await runShell(
      `rg -n "console\\.log\\(" src/ --glob '!**/node_modules/**' -c || true`,
    );
    const lines = r.stdout.trim();
    let total = 0;
    for (const line of lines.split('\n')) {
      const n = Number(line.split(':')[1] ?? 0);
      if (Number.isFinite(n)) total += n;
    }
    return {
      ok: total <= 10,
      severity: 'warning' as const,
      detail: `${total} ocorrências${lines.length ? ` — ${lines.split('\n').slice(0, 6).join(', ')}` : ''}`,
    };
  });

  await timedCheck(checks, 'higiene: @ts-ignore/@ts-expect-error (informativo)', async () => {
    const r = await runShell(`rg -n "@ts-ignore|@ts-expect-error" src/ -c || true`);
    const lines = r.stdout.trim();
    let total = 0;
    for (const line of lines.split('\n')) {
      const n = Number(line.split(':')[1] ?? 0);
      if (Number.isFinite(n)) total += n;
    }
    return { ok: total <= 15, severity: 'warning' as const, detail: `${total} ocorrências` };
  });

  await timedCheck(checks, 'integridade: pontos de entrada essenciais existem', async () => {
    const must = [
      'src/app/page.tsx',
      'src/app/layout.tsx',
      'src/app/globals.css',
      'src/lib/study-progress.ts',
      'src/lib/smart-schedule.ts',
      'src/lib/clab/index.ts',
    ];
    const missing: string[] = [];
    for (const m of must) {
      const okFile = await runShell(`test -f ${m} && echo ok || true`);
      if (!okFile.stdout.includes('ok')) missing.push(m);
    }
    return {
      ok: missing.length === 0,
      severity: 'error' as const,
      detail: missing.length ? `faltando: ${missing.join(', ')}` : `${must.length} arquivos presentes`,
    };
  });

  const ok = checks.every((c) => c.ok || c.severity !== 'error');
  return { piece: 1, name: 'Qualidade do código', ok, ms: Date.now() - t0, checks };
}
