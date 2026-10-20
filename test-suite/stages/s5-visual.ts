// s5-visual.ts — PEÇA 5: A CARA DA CASA. Tema AMOLED escuro, zero overflow
// horizontal, rodapé colado no fundo, mobile de 390px digno. Screenshots
// ficam em .chain/shots/ para inspeção.

import {
  type Check, type StageResult, timedCheck, BASE_URL, SHOTS_DIR,
} from '../lib/chain';
import { runCmd } from '../lib/proc';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

async function ab(...args: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  const r = await runCmd('agent-browser', args, { timeoutMs: 60_000 });
  return { ok: r.ok, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

async function evalStr(js: string): Promise<string> {
  const r = await ab('eval', `String(${js})`);
  return r.out.replace(/^["']|["']$/g, '');
}

function parseRgb(css: string): [number, number, number] | null {
  const m = css.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export async function run(): Promise<StageResult> {
  const t0 = Date.now();
  const checks: Check[] = [];

  await ab('open', BASE_URL).catch(() => {});
  await ab('wait', '1200');

  // ---------- Desktop 1440×900 ----------
  await timedCheck(checks, 'visual · desktop 1440×900 sem overflow horizontal', async () => {
    await ab('set', 'viewport', '1440', '900');
    await ab('wait', '500');
    const sw = Number(await evalStr(`document.documentElement.scrollWidth`));
    const iw = Number(await evalStr(`window.innerWidth`));
    return {
      ok: sw <= iw + 1,
      severity: 'error' as const,
      detail: `scrollWidth=${sw} vs innerWidth=${iw}`,
    };
  });

  await timedCheck(checks, 'visual · tema escuro AMOLED ativo (fundo quase preto)', async () => {
    await ab('set', 'media', 'dark');
    await ab('reload');
    await ab('wait', '1500');
    const bg = await evalStr(`getComputedStyle(document.body).backgroundColor`);
    const rgb = parseRgb(bg);
    const escuro = rgb !== null && rgb.every((v) => v <= 40);
    return {
      ok: escuro,
      severity: 'warning' as const,
      detail: `body bg=${bg} (esperado ~rgb(0,0,0) do AMOLED; claro não é erro fatal se o sistema do usuário for claro)`,
    };
  });

  await timedCheck(checks, 'visual · rodapé colado no fim (sem flutuar)', async () => {
    await ab('scroll', 'down', '20000');
    await ab('wait', '400');
    const r = await evalStr(
      `(function(){var f=document.querySelector('footer');if(!f)return 'NOFOOTER';var rect=f.getBoundingClientRect();return 'BOTTOM='+Math.round(rect.bottom)+' INNER='+Math.round(window.innerHeight);})()`,
    );
    const m = r.match(/BOTTOM=(\d+) INNER=(\d+)/);
    const ok = m !== null && Math.abs(Number(m[1]) - Number(m[2])) <= 80;
    await ab('scroll', 'up', '20000');
    return { ok, severity: 'warning' as const, detail: r };
  });

  const shotDesktop = join(SHOTS_DIR, 'desktop-1440.png');
  await timedCheck(checks, 'visual · screenshot desktop salvo', async () => {
    const s = await ab('screenshot', shotDesktop);
    return { ok: s.ok && existsSync(shotDesktop), severity: 'warning' as const, detail: shotDesktop };
  });

  // ---------- Mobile 390×844 ----------
  await timedCheck(checks, 'visual · mobile 390×844 sem overflow horizontal', async () => {
    await ab('set', 'viewport', '390', '844');
    await ab('wait', '700');
    const sw = Number(await evalStr(`document.documentElement.scrollWidth`));
    const iw = Number(await evalStr(`window.innerWidth`));
    return {
      ok: sw <= iw + 1,
      severity: 'error' as const,
      detail: `scrollWidth=${sw} vs innerWidth=${iw}`,
    };
  });

  await timedCheck(checks, 'visual · mobile tem navegação alcançável (menu hambúrguer)', async () => {
    const has = await evalStr(`!!document.querySelector('[aria-label="Abrir menu"]')`);
    return {
      ok: has === 'true',
      severity: 'warning' as const,
      detail: has === 'true' ? 'hambúrguer presente' : 'botão "Abrir menu" não encontrado (nav mobile pode ter mudado)',
    };
  });

  const shotMobile = join(SHOTS_DIR, 'mobile-390.png');
  await timedCheck(checks, 'visual · screenshot mobile salvo', async () => {
    const s = await ab('screenshot', shotMobile);
    return { ok: s.ok && existsSync(shotMobile), severity: 'warning' as const, detail: shotMobile };
  });

  await ab('set', 'viewport', '1440', '900').catch(() => {});
  await ab('close').catch(() => {});

  const ok = checks.every((c) => c.ok || c.severity !== 'error');
  return { piece: 5, name: 'Visual & responsivo', ok, ms: Date.now() - t0, checks };
}
