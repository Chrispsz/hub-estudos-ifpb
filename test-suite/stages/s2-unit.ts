// s2-unit.ts — PEÇA 2: O NÚCLEO PURO. ~200 testes bun:test sobre a lógica que
// é o cérebro do Hub: compilador clab em cadeia (lexer→parser→VM→fluxograma),
// cronograma inteligente, sessão sintonizada, dia pronto, radar de provas,
// maestria, sinais de aprendizagem, retrato do dia, calendário oficial,
// integridade do acervo, fila do dia, ciclo do erro e segurança de conteúdo.

import { type Check, type StageResult, timedCheck } from '../lib/chain';
import { runCmd } from '../lib/proc';

export async function run(): Promise<StageResult> {
  const t0 = Date.now();
  const checks: Check[] = [];

  await timedCheck(checks, 'bun test — suíte unitária completa', async () => {
    const r = await runCmd('bun', ['test', 'test-suite/unit/'], { timeoutMs: 300_000 });
    const out = (r.stdout + r.stderr).trim();
    const lines = out.split('\n');

    const passMatch = lines.find((l) => /^\s*\d+ pass/.test(l));
    const failMatch = lines.find((l) => /^\s*\d+ fail/.test(l));
    const passed = passMatch ? Number(passMatch.trim().split(' ')[0]) : -1;
    const failed = failMatch ? Number(failMatch.trim().split(' ')[0]) : -1;

    if (!r.ok || failed > 0 || passed < 0) {
      // recolhe só os (fail) para o relatório caber
      const fails = lines.filter((l) => l.includes('(fail)')).slice(0, 15).join('\n');
      return {
        ok: false,
        severity: 'error' as const,
        detail: `${passed} pass · ${failed} fail\n${fails || out.slice(-800)}`,
      };
    }
    return {
      ok: true,
      severity: 'error' as const,
      detail: `${passed} testes passaram · 0 falhas · ${r.ms}ms`,
    };
  });

  await timedCheck(checks, 'compilador clab: cadeia lexer→parser→VM→fluxograma sem furos', async () => {
    const r = await runCmd('bun', ['test', 'test-suite/unit/clab-compiler.test.ts', 'test-suite/unit/clab-examples.test.ts'], { timeoutMs: 120_000 });
    const ok = r.ok;
    return {
      ok,
      severity: 'error' as const,
      detail: ok ? 'compilador + acervo oficial íntegros' : (r.stdout + r.stderr).slice(-400),
    };
  });

  await timedCheck(checks, 'acervo: integridade de dados (matérias, exercícios, avaliações, calendário)', async () => {
    const r = await runCmd('bun', ['test', 'test-suite/unit/data-integrity.test.ts', 'test-suite/unit/semester.test.ts'], { timeoutMs: 120_000 });
    return {
      ok: r.ok,
      severity: 'error' as const,
      detail: r.ok ? 'fonte única da verdade íntegra' : (r.stdout + r.stderr).slice(-400),
    };
  });

  const ok = checks.every((c) => c.ok || c.severity !== 'error');
  return { piece: 2, name: 'Núcleo puro (unitários)', ok, ms: Date.now() - t0, checks };
}
