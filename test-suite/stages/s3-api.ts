// s3-api.ts — PEÇA 3: A PONTE HTTP. Os endpoints do backend respondem com o
// contrato esperado — validação rejeita lixo e nunca devolve 5xx surpresa.

import { type Check, type StageResult, timedCheck, BASE_URL } from '../lib/chain';

interface HttpProbe {
  ok: boolean;
  status: number;
  body: string;
}

async function get(path: string, timeoutMs = 15_000): Promise<HttpProbe> {
  const res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function isJson(body: string): boolean {
  try { JSON.parse(body); return true; } catch { return false; }
}

export async function run(): Promise<StageResult> {
  const t0 = Date.now();
  const checks: Check[] = [];

  await timedCheck(checks, 'GET /api → 200 com mensagem', async () => {
    const r = await get('/api');
    const json = isJson(r.body) ? JSON.parse(r.body) : null;
    return {
      ok: r.status === 200 && json !== null,
      severity: 'error' as const,
      detail: `status ${r.status} · ${r.body.slice(0, 80)}`,
    };
  });

  await timedCheck(checks, 'GET /api/audit → 200 JSON válido', async () => {
    const r = await get('/api/audit');
    return {
      ok: r.status === 200 && isJson(r.body),
      severity: 'error' as const,
      detail: `status ${r.status} · json=${isJson(r.body)}`,
    };
  });

  await timedCheck(checks, 'GET /api/tutor/signals → 200 JSON válido (sinais do tutor)', async () => {
    const r = await get('/api/tutor/signals');
    return {
      ok: r.status === 200 && isJson(r.body),
      severity: 'error' as const,
      detail: `status ${r.status} · bytes ${r.body.length}`,
    };
  });

  await timedCheck(checks, 'GET /api/settings/ai → 200 JSON válido', async () => {
    const r = await get('/api/settings/ai');
    return {
      ok: r.status === 200 && isJson(r.body),
      severity: 'error' as const,
      detail: `status ${r.status}`,
    };
  });

  await timedCheck(checks, 'GET /api/tutor/history?discipline → 200 com { messages }', async () => {
    const r = await get('/api/tutor/history?discipline=TEC.1687');
    const json = isJson(r.body) ? JSON.parse(r.body) : null;
    const temMessages = json !== null && Array.isArray(json.messages);
    return {
      ok: r.status === 200 && temMessages,
      severity: 'error' as const,
      detail: `status ${r.status} · messages=${temMessages ? json.messages.length : 'ausente'}`,
    };
  });

  await timedCheck(checks, 'GET /api/tutor/history sem discipline → 400 (validação vive)', async () => {
    const r = await get('/api/tutor/history');
    return {
      ok: r.status === 400,
      severity: 'error' as const,
      detail: `status ${r.status} (contrato: parâmetro obrigatório rejeitado com 400)`,
    };
  });

  await timedCheck(checks, 'POST /api/settings/ai com lixo → NUNCA 5xx (validação destrói)', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{{lixo%%%}}}',
      signal: AbortSignal.timeout(15_000),
    });
    return {
      ok: res.status < 500,
      severity: 'error' as const,
      detail: `POST inválido → ${res.status} (esperado 4xx/2xx tolerante)`,
    };
  });

  await timedCheck(checks, 'rota inexistente em /api → 404/405 (não 500)', async () => {
    const r = await get('/api/essa-rota-nao-existe-xyz');
    return {
      ok: r.status === 404 || r.status === 405,
      severity: 'error' as const,
      detail: `status ${r.status}`,
    };
  });

  const ok = checks.every((c) => c.ok || c.severity !== 'error');
  return { piece: 3, name: 'API HTTP', ok, ms: Date.now() - t0, checks };
}
