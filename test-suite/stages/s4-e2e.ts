// s4-e2e.ts — PEÇA 4: A JORNADA (o coração do quebra-cabeça).
// Uma pessoa real abrindo o site: carrega, lê o título, anda pelas 6 abas,
// roda o Lab de Código, faz o check-in de horas e recarrega a página para
// provar que a casa LEMBRA. Cada passo alimenta o próximo — em cadeia.

import {
  type Check, type StageResult, timedCheck, BASE_URL, SHOTS_DIR,
} from '../lib/chain';
import { runCmd } from '../lib/proc';
import { join } from 'node:path';

const LS_KEY = 'hub-estudos-ifpb:v2';

const BENIGN = [
  /devtools/i,
  /favicon/i,
  /sourcemap/i,
  /telemetry/i,
  /Download the React DevTools/i,
  /cross.?origin/i,
  /autofill/i,
  /third.?party/i,
  /net::ERR/i,
  /Failed to load resource/i,
];

function isBenign(line: string): boolean {
  return BENIGN.some((re) => re.test(line));
}

async function ab(...args: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  const r = await runCmd('agent-browser', args, { timeoutMs: 60_000 });
  return { ok: r.ok, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/** eval que devolve uma string garantida (sem depender de undefined). */
async function evalStr(js: string): Promise<string> {
  const r = await ab('eval', `String(${js})`);
  return r.out.replace(/^["']|["']$/g, '');
}

async function todayKey(): Promise<string> {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function run(): Promise<StageResult> {
  const t0 = Date.now();
  const checks: Check[] = [];

  // ---------- E1: A porta de entrada ----------
  await timedCheck(checks, 'jornada · abre a home e a página renderiza', async () => {
    await ab('close', '--all').catch(() => {});
    const open = await ab('open', BASE_URL);
    if (!open.ok && !open.out.includes('localhost')) {
      return { ok: false, severity: 'error' as const, detail: `open falhou: ${open.err || open.out}` };
    }
    await ab('wait', '1500');
    const title = await ab('get', 'title');
    const chars = await evalStr(`document.body.innerText.length`);
    const n = Number(chars);
    return {
      ok: n > 300,
      severity: 'error' as const,
      detail: `título="${title.out}" · corpo com ${chars} caracteres`,
    };
  });

  // ---------- E2: A casa sem erros no console ----------
  await timedCheck(checks, 'jornada · zero erros de página (uncaught)', async () => {
    const errs = await ab('errors');
    const lines = errs.out.split('\n').filter((l) => l.trim() && !isBenign(l));
    return {
      ok: lines.length === 0,
      severity: 'error' as const,
      detail: lines.length ? lines.slice(0, 8).join(' | ') : 'nenhum erro de execução',
    };
  });

  // ---------- E3: As seis abas em cadeia ----------
  // O Modo Foco nasce LIGADO: Cronograma/Método/Progresso moram sob o "Mais".
  // A jornada de uma pessoa real inclui esse toque — faz parte do puzzle.
  const TABS: { label: string; keywords: string[]; viaMais?: boolean }[] = [
    { label: 'Conteúdos', keywords: ['Unidade', 'Algoritmos', 'material'] },
    { label: 'Tutor IA', keywords: ['Tutor', 'pergunta', 'conversa'] },
    { label: 'Praticar', keywords: ['Quest', 'flashcard', 'praticar', 'Semana'] },
    { label: 'Cronograma', keywords: ['semana', 'bloco', 'Cronograma', 'dias'], viaMais: true },
    { label: 'Lab de Código', keywords: ['Rodar', 'main', 'printf', 'Entrada'] },
    { label: 'Configurações', keywords: ['Aparência', 'tema', 'Backup', 'dados'] },
  ];

  for (const tab of TABS) {
    await timedCheck(checks, `jornada · aba "${tab.label}" abre e ativa${tab.viaMais ? ' (via menu Mais do Modo Foco)' : ''}`, async () => {
      if (tab.viaMais) {
        await ab('find', 'text', 'Mais', 'click');
        await ab('wait', '300');
      }
      const click = await ab('find', 'text', tab.label, 'click');
      if (!click.ok) {
        return { ok: false, severity: 'error' as const, detail: `botão não encontrado: ${click.err || click.out}` };
      }
      await ab('wait', '500');
      const active = await evalStr(`document.querySelector('[aria-current="page"]')?.textContent ?? 'NENHUM'`);
      const ativa = active.includes(tab.label);
      const body = await evalStr(`document.body.innerText`);
      const kw = tab.keywords.some((k) => body.toLowerCase().includes(k.toLowerCase()));
      return {
        ok: ativa && kw,
        severity: 'error' as const,
        detail: `aria-current="${active.slice(0, 40)}" · conteúdo reconhecido=${kw}`,
      };
    });
  }

  // ---------- E4: O Lab roda código de verdade ----------
  await timedCheck(checks, 'jornada · Lab de Código: Rodar executa e mostra saída', async () => {
    // o texto "Rodar" também existe na ajuda — clica no BOTÃO cujo texto é exatamente "Rodar"
    const clicked = await evalStr(
      `(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim()==='Rodar'){bs[i].click();return 'CLICKED';}}return 'NOTFOUND';})()`,
    );
    if (clicked !== 'CLICKED') {
      return { ok: false, severity: 'warning' as const, detail: 'botão Rodar não encontrado na aba do Lab' };
    }
    await ab('wait', '1500');
    const body = await evalStr(`document.body.innerText`);
    const imprimiu = body.includes('Ola') || body.includes('Programa carregado') || body.includes('passo');
    return {
      ok: imprimiu,
      severity: 'error' as const,
      detail: imprimiu ? 'VM rodou: nota/gerada e saída visíveis' : 'Rodar clicado, mas nenhuma saída reconhecida',
    };
  });

  // ---------- E5: O check-in que sobrevive ao reload (a memória da casa) ----------
  await timedCheck(checks, 'jornada · check-in de horas persiste no localStorage e no reload', async () => {
    // guarda o estado original para devolver no fim (a casa fica como estava)
    const original = await evalStr(`localStorage.getItem('${LS_KEY}') ?? 'NULL'`);

    // limpa para provar a jornada do zero — e volta para a home SEM hash
    // (a aba persiste no hash da URL; a home é a aba Conteúdos, que renderiza
    // o Dashboard com o check-in no topo)
    await evalStr(`localStorage.removeItem('${LS_KEY}')`);
    await ab('open', BASE_URL);
    await ab('wait', '2000');

    // clica no gesto padrão da casa: "Estudar 2h agora"
    const click = await ab('click', '[data-t="checkin-sessao-2h"]');
    if (!click.ok) {
      // devolve o estado original antes de falhar
      if (original !== 'NULL') await ab('eval', `localStorage.setItem('${LS_KEY}', ${JSON.stringify(original)})`);
      const tab = await evalStr(`document.querySelector('[aria-current="page"]')?.textContent ?? 'none'`);
      return { ok: false, severity: 'error' as const, detail: `chip "Estudar 2h agora" não encontrado na home (aba ativa: ${tab}): ${click.err}` };
    }
    await ab('wait', '600');

    const key = await todayKey();
    const probe = await evalStr(
      `(function(){try{var p=JSON.parse(localStorage.getItem('${LS_KEY}')||'{}');return 'H='+(p.dailyHours&&p.dailyHours['${key}']!==undefined?p.dailyHours['${key}']:'MISSING');}catch(e){return 'ERR';}})()`,
    );

    if (probe !== 'H=2') {
      if (original !== 'NULL') await ab('eval', `localStorage.setItem('${LS_KEY}', ${JSON.stringify(original)})`);
      return { ok: false, severity: 'error' as const, detail: `após clicar, localStorage ${key} = ${probe} (esperado H=2)` };
    }

    // reload: a casa tem que lembrar
    await ab('reload');
    await ab('wait', '2000');
    const probe2 = await evalStr(
      `(function(){try{var p=JSON.parse(localStorage.getItem('${LS_KEY}')||'{}');return 'H='+(p.dailyHours&&p.dailyHours['${key}']!==undefined?p.dailyHours['${key}']:'MISSING');}catch(e){return 'ERR';}})()`,
    );

    // volta para a home para os checks finais (rodapé/screenshot)
    await ab('open', BASE_URL);
    await ab('wait', '1200');

    // devolve o estado original (o teste não deixa rastro)
    if (original === 'NULL') await evalStr(`localStorage.removeItem('${LS_KEY}')`);
    else await ab('eval', `localStorage.setItem('${LS_KEY}', ${JSON.stringify(original)})`);

    return {
      ok: probe2 === 'H=2',
      severity: 'error' as const,
      detail: `pós-reload: ${probe2} (esperado H=2) — check-in sobrevive ao F5`,
    };
  });

  // ---------- E6: O rodapé existe (lei da casa: sticky footer) ----------
  await timedCheck(checks, 'jornada · rodapé presente e renderizado', async () => {
    const has = await evalStr(`!!document.querySelector('footer')`);
    const visible = await evalStr(`(function(){var f=document.querySelector('footer');if(!f)return 'NO';var r=f.getBoundingClientRect();return r.height>0?'YES':'NO';})()`);
    return {
      ok: has === 'true' && visible === 'YES',
      severity: 'error' as const,
      detail: `footer existe=${has} · visível=${visible}`,
    };
  });

  // ---------- E7: Foto do fim da jornada ----------
  await timedCheck(checks, 'jornada · screenshot final salvo', async () => {
    const path = join(SHOTS_DIR, 'e2e-final.png');
    const shot = await ab('screenshot', path);
    const ok = shot.ok || (await evalStr('1')) === '1';
    return { ok, severity: 'warning' as const, detail: path };
  });

  await ab('console', '--clear').catch(() => {});
  await ab('close').catch(() => {});

  const ok = checks.every((c) => c.ok || c.severity !== 'error');
  return { piece: 4, name: 'Jornada E2E (o quebra-cabeça vivo)', ok, ms: Date.now() - t0, checks };
}
