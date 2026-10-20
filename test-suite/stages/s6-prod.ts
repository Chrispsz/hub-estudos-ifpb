// s6-prod.ts — PEÇA 6: O LINK ORIGINAL (produção Vercel).
// O dono pergunta "subiu no link original?" — esta peça responde a CADA
// rodada, direto na produção: https://hub-estudos-ifpb.vercel.app
// Rotas essenciais com severidade de erro; estáticos com aviso (rede do
// sandbox não pode derrubar o quebra-cabeça por flakiness).

import { type Check, type StageResult, timedCheck } from '../lib/chain';

const PROD = 'https://hub-estudos-ifpb.vercel.app';

async function probe(path: string, timeoutMs = 20_000): Promise<{ status: number; ok: boolean; server: string; body: string }> {
  const res = await fetch(`${PROD}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'hub-estudos-test-suite/1.0' },
  });
  const body = await res.text();
  return {
    status: res.status,
    ok: res.ok,
    server: res.headers.get('server') ?? '',
    body,
  };
}

export async function run(): Promise<StageResult> {
  const t0 = Date.now();
  const checks: Check[] = [];

  await timedCheck(checks, 'produção · home responde 200 com o título da casa (server: Vercel)', async () => {
    const r = await probe('/');
    const titleOk = r.body.includes('Hub de Estudos') && r.body.includes('IFPB');
    return {
      ok: r.status === 200 && titleOk && r.server === 'Vercel',
      severity: 'error' as const,
      detail: `status ${r.status} · server=${r.server || '??'} · título=${titleOk ? 'ok' : 'NÃO reconhecido'}`,
    };
  });

  await timedCheck(checks, 'produção · /api responde 200 (tutor vivo no link original)', async () => {
    const r = await probe('/api');
    return { ok: r.status === 200, severity: 'error' as const, detail: `status ${r.status}` };
  });

  await timedCheck(checks, 'produção · PWA no ar: manifest + service worker', async () => {
    const man = await probe('/manifest.webmanifest');
    const sw = await probe('/sw.js');
    return {
      ok: man.status === 200 && sw.status === 200,
      severity: 'warning' as const,
      detail: `manifest=${man.status} · sw=${sw.status}`,
    };
  });

  await timedCheck(checks, 'produção · páginas de apoio (folha de revisão, caderno de papel)', async () => {
    const folha = await probe('/folha-revisao');
    const caderno = await probe('/caderno-papel');
    return {
      ok: folha.status === 200 && caderno.status === 200,
      severity: 'warning' as const,
      detail: `folha=${folha.status} · caderno=${caderno.status}`,
    };
  });

  await timedCheck(checks, 'produção · estáticos servidos (ícone, logo, robots)', async () => {
    const icon = await probe('/icons/icon-192.png');
    const logo = await probe('/logo.svg');
    return {
      ok: icon.status === 200 && logo.status === 200,
      severity: 'warning' as const,
      detail: `ícone=${icon.status} · logo=${logo.status}`,
    };
  });

  await timedCheck(checks, 'produção · conteúdo do acervo cacheado (headers do vercel.json vivos)', async () => {
    const res = await fetch(`${PROD}/data/`, { signal: AbortSignal.timeout(20_000) });
    const cache = res.headers.get('cache-control') ?? '';
    // /data/* deve carregar o cache-control declarado no vercel.json
    const comCache = cache.includes('max-age');
    return {
      ok: comCache,
      severity: 'warning' as const,
      detail: `cache-control de /data/: "${cache || 'ausente'}"`,
    };
  });

  const ok = checks.every((c) => c.ok || c.severity !== 'error');
  return { piece: 6, name: 'Produção (Vercel — o link original)', ok, ms: Date.now() - t0, checks, data: { prod: PROD } };
}
