#!/bin/bash
# t193 E2E — O REPLAY DO TEMPO (single-call, standalone :3100, build FRESCO)
# Cenário: relógio REAL — noite do simulado (29/09 BRT); amanhã o dono revisa
# esta tentativa pelo HISTÓRICO.
# Prova: (1) run ao vivo com dwell variado (q3 a mais lenta E pulada) →
#        encerrado → o run grava questions[].timeSec; (2) o HISTÓRICO ganha
#        o botão de replay (chevron, hover-reveal) → o painel abre com o
#        strip "Onde o tempo foi" (mesma gramática do t192: amber na lenta,
#        dots do desfecho, footer ≥ 3s) + a linha por questão (status,
#        tópico, enunciado, tempo MM:SS); (3) corrida ANTIGA sem detalhes
#        não ganha botão (regra 88 — nada fabricado); (4) uma aberta por
#        vez; (5) mobile 390 sem overflow; (6) light paritário; (7) console
#        limpo; (8) higiene.
set -u
cd /home/z/my-project
PORT=3100
BASE="http://localhost:$PORT"
DIR=/home/z/my-project/scripts

agent-browser close --all >/dev/null 2>&1
pkill -f "standalone/server.js" 2>/dev/null
sleep 1
PORT=$PORT NODE_ENV=production nohup bun .next/standalone/server.js > /tmp/e2e193-server.log 2>&1 &
UP=""
for i in $(seq 1 30); do
  CODE=$(curl -s -m 2 -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then UP="sim (tentativa $i)"; break; fi
  sleep 2
done
echo "SERVIDOR: ${UP:-NAO SUBIU}"
[ -z "$UP" ] && tail -5 /tmp/e2e193-server.log && exit 1
AUDIT=$(curl -s -m 5 "$BASE/api/audit" | head -c 120)
echo "AUDIT: $AUDIT"

sleep 1
agent-browser set viewport 1366 900 >/dev/null 2>&1 || true
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2

open_sim() {
  agent-browser eval "(() => {
    const alvos = ['Abrir o Simulado', 'Simulado Pro', 'Simulado da Av1'];
    for (const alvo of alvos) {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim().startsWith(alvo));
      if (b) { b.click(); return 'aberto via: ' + alvo; }
    }
    return 'nenhuma porta achada';
  })()" 2>/dev/null | tr -d '\\'
}

echo "=== 0. RUN AO VIVO — dwell variado (q3 a mais lenta E pulada) ==="
open_sim
sleep 1
agent-browser eval "(() => { const cinco = [...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === '5'); if (cinco) cinco.click(); return '5q'; })()" >/dev/null 2>&1
agent-browser eval "[...document.querySelectorAll('[role=dialog] button')].find(b => (b.textContent || '').trim() === 'Iniciar simulado')?.click(); 'go'" >/dev/null 2>&1
sleep 3
agent-browser press 2 >/dev/null 2>&1            # q1 não consegui (~3s)
sleep 2
agent-browser press 1 >/dev/null 2>&1            # q2 consegui (~2s)
sleep 5
agent-browser press ArrowRight >/dev/null 2>&1   # q3 PULADA com ~5s (a mais lenta)
sleep 2
agent-browser press 2 >/dev/null 2>&1            # q4 não consegui
sleep 1.5
agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => (x.textContent || '').trim() === 'Encerrar'); if (!b) return 'encerrar ausente'; b.click(); return 'encerrando'; })()" 2>/dev/null | tr -d '\\'
sleep 1
agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => (x.textContent || '').trim() === 'Encerrar e ver resultado'); if (!b) return 'confirm ausente'; b.click(); return 'confirmado'; })()" 2>/dev/null | tr -d '\\'
sleep 1.5
echo "run gravado:"
agent-browser eval "(() => {
  const p = JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2') || '{}');
  const runs = p.simuladoRuns || [];
  const last = runs[runs.length - 1];
  return JSON.stringify({
    nRuns: runs.length,
    temDetalhes: !!(last && last.questions && last.questions.length),
    timeSecs: last && last.questions ? last.questions.map(q => q.timeSec) : null
  });
})()" 2>/dev/null | tr -d '\\'

echo "=== 1. FECHAR O DEBRIEF E IR AO PROGRESSO ==="
agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => (x.textContent || '').trim() === 'Close' || (x.textContent || '').trim() === 'Fechar'); if (b) { b.click(); return 'fechado'; } return 'close ausente'; })()" 2>/dev/null | tr -d '\\'
sleep 1
agent-browser eval "window.dispatchEvent(new CustomEvent('hub:open-progress')); 'indo para o Progresso'" 2>/dev/null | tr -d '\\'
sleep 2

echo "=== 2. O BOTÃO DE REPLAY (gate honesto: só a corrida com detalhes) ==="
agent-browser eval "(() => {
  const replay = [...document.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label') || '').includes('replay questão a questão'));
  const chevrons = replay.map(b => (b.getAttribute('aria-expanded') === 'true' ? 'aberto' : 'fechado'));
  return JSON.stringify({ nBotoesReplay: replay.length, estados: chevrons, visiveisNoHover: replay.every(b => (b.className || '').includes('group-hover:opacity-100')) });
})()" 2>/dev/null | tr -d '\\'

echo "=== 3. ABRIR O REPLAY — O PAINEL ==="
agent-browser eval "(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').includes('replay questão a questão'));
  if (!b) return 'botão ausente';
  b.click();
  return 'replay aberto';
})()" 2>/dev/null | tr -d '\\'
sleep 1
agent-browser eval "(() => {
  const labels = [...document.querySelectorAll('p')].filter(p => (p.textContent || '').includes('Onde o tempo foi'));
  const t = document.body.textContent;
  const chips = [...document.querySelectorAll('span')].filter(s => /^Q[1-9] \d{2}:\d{2}/.test((s.textContent || '').trim()));
  const amber = chips.find(s => (s.className || '').includes('amber'));
  const linhas = (t.match(/consegui|não consegui|pulada/g) || []).length;
  return JSON.stringify({
    stripNoPainel: labels.length > 0,
    nChips: chips.length,
    amberNaQ3: amber ? (amber.textContent || '').trim().slice(0, 9) : null,
    q3Pulada: t.includes('pulada'),
    enunciados: t.includes('tabela verdade') || t.includes('proposição') || t.includes('Dada'),
    notaPausa: t.includes('a pausa não entra (o cronômetro congela)')
  });
})()" 2>/dev/null | tr -d '\\'

echo "=== 3b. A CONFISSÃO DA LENTA NO TITLE (fonte única) ==="
agent-browser eval "(() => {
  const amber = [...document.querySelectorAll('span')].find(s => /^Q[1-9] \d{2}:\d{2}/.test((s.textContent || '').trim()) && (s.className || '').includes('amber'));
  const ttl = amber ? amber.getAttribute('title') : null;
  return JSON.stringify({ temTitle: !!ttl, confessao: ttl ? ttl.slice(0, 90) : null });
})()" 2>/dev/null | tr -d '\\'
agent-browser eval "(() => { const el = [...document.querySelectorAll('p')].find(p => (p.textContent || '').includes('Onde o tempo foi')); if (el) el.scrollIntoView({ block: 'center' }); return 'rolado'; })()" >/dev/null 2>&1
sleep 0.5
agent-browser screenshot $DIR/qa193-replay-painel.png >/dev/null 2>&1 && echo "print: qa193-replay-painel.png"

echo "=== 4. UMA ABERTA POR VEZ + FECHAR ==="
agent-browser eval "(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').includes('replay questão a questão'));
  if (!b) return 'botão ausente';
  b.click();
  return 'replay fechado';
})()" 2>/dev/null | tr -d '\\'
sleep 0.8
agent-browser eval "(() => {
  const abertos = [...document.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label') || '').includes('replay questão a questão') && b.getAttribute('aria-expanded') === 'true').length;
  const paineis = [...document.querySelectorAll('p')].filter(p => (p.textContent || '').includes('Onde o tempo foi')).length;
  return JSON.stringify({ abertos, paineis });
})()" 2>/dev/null | tr -d '\\'

echo "=== 5. A CORRIDA ANTIGA (sem detalhes) NEM MOSTRA O BOTÃO ==="
agent-browser eval "(() => {
  const KEY = 'hub-estudos-ifpb:v2';
  const p = JSON.parse(localStorage.getItem(KEY) || '{}');
  p.simuladoRuns = p.simuladoRuns || [];
  p.simuladoRuns.unshift({
    id: 'legacy-pre-detail', date: '2026-09-20T22:00:00.000Z', mode: 'prova',
    total: 10, solved: 4, missed: 5, skipped: 1, durationSec: 602
  });
  localStorage.setItem(KEY, JSON.stringify(p));
  return 'run antigo semeado';
})()" 2>/dev/null | tr -d '\\'
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2
agent-browser eval "window.dispatchEvent(new CustomEvent('hub:open-progress')); 'progresso'" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => {
  const replay = [...document.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label') || '').includes('replay questão a questão'));
  const linhaAntiga = [...document.querySelectorAll('div')].find(d => (d.textContent || '').includes('20/09') && (d.className || '').includes('group'));
  return JSON.stringify({
    nBotoesReplay: replay.length,
    runAntigoNaLista: document.body.textContent.includes('20/09'),
    gateHonesto: replay.length === 1
  });
})()" 2>/dev/null | tr -d '\\'

echo "=== 6. MOBILE 390 — O PAINEL ABERTO SEM OVERFLOW ==="
agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').includes('replay questão a questão')); if (b) b.click(); return 'aberto'; })()" >/dev/null 2>&1
sleep 0.8
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 1
agent-browser eval "JSON.stringify({scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth})" 2>/dev/null | tr -d '\\'
agent-browser eval "(() => { const el = [...document.querySelectorAll('p')].find(p => (p.textContent || '').includes('Onde o tempo foi')); if (el) el.scrollIntoView({ block: 'start' }); return 'rolado'; })()" >/dev/null 2>&1
sleep 0.5
agent-browser screenshot $DIR/qa193-replay-mobile390.png >/dev/null 2>&1 && echo "print: qa193-replay-mobile390.png"

echo "=== 7. LIGHT PARITÁRIO ==="
agent-browser set viewport 1366 900 >/dev/null 2>&1
agent-browser eval "localStorage.setItem('theme', 'light'); 'light'" >/dev/null 2>&1
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2
agent-browser eval "window.dispatchEvent(new CustomEvent('hub:open-progress')); 'progresso'" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').includes('replay questão a questão')); if (b) b.click(); return 'aberto'; })()" >/dev/null 2>&1
sleep 0.8
agent-browser eval "(() => ({ dark: document.documentElement.classList.contains('dark'), painel: [...document.querySelectorAll('p')].some(p => (p.textContent || '').includes('Onde o tempo foi')) }))()" 2>/dev/null | tr -d '\\'
agent-browser eval "(() => { const el = [...document.querySelectorAll('p')].find(p => (p.textContent || '').includes('Onde o tempo foi')); if (el) el.scrollIntoView({ block: 'center' }); return 'rolado'; })()" >/dev/null 2>&1
sleep 0.5
agent-browser screenshot $DIR/qa193-replay-light.png >/dev/null 2>&1 && echo "print: qa193-replay-light.png"

echo "=== 8. CONSOLE + HIGIENE ==="
agent-browser console 2>/dev/null | rg -i "error|warning" | head -5
echo "console-verificado"
agent-browser eval "localStorage.clear(); 'higiene total'" 2>/dev/null | tr -d '\\'
agent-browser close --all >/dev/null 2>&1
echo "FIM t193 E2E"
