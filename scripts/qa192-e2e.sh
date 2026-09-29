#!/bin/bash
# t192 E2E — ONDE O TEMPO FOI (single-call, standalone :3100, build FRESCO)
# Cenário: relógio REAL — noite do simulado (29/09 BRT).
# Prova: (1) run com gestos de teclado + dwell variado → o strip "Onde o tempo
#        foi" aparece no debrief com Q1..Q5, a mais lenta em amber (q3, pulada
#        com o relógio mais alto — a confissão dupla), footer "nas questões";
#        (2) Pausar → o storage carrega timeByQ com o trecho da q1 (nada órfão);
#        (3) remaining reescrito a 1 → retomar → o sino toca → o debrief
#        confessa "pelo relógio" E o strip mostra o pacing PRESERVADO da
#        retomada; (4) mobile 390 sem overflow; (5) console limpo; (6) higiene.
set -u
cd /home/z/my-project
PORT=3100
BASE="http://localhost:$PORT"
DIR=/home/z/my-project/scripts

pkill -f "standalone/server.js" 2>/dev/null
sleep 1
PORT=$PORT NODE_ENV=production nohup bun .next/standalone/server.js > /tmp/e2e192-server.log 2>&1 &
SRV=$!
UP=""
for i in $(seq 1 30); do
  CODE=$(curl -s -m 2 -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then UP="sim (tentativa $i)"; break; fi
  sleep 2
done
echo "SERVIDOR: ${UP:-NAO SUBIU}"
[ -z "$UP" ] && tail -5 /tmp/e2e192-server.log && exit 1
AUDIT=$(curl -s -m 5 "$BASE/api/audit" | head -c 120)
echo "AUDIT: $AUDIT"

agent-browser close --all >/dev/null 2>&1
sleep 1
agent-browser set viewport 1366 900 >/dev/null 2>&1 || true
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
agent-browser console --clear >/dev/null 2>&1 || true
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2

# localizador do botão de abrir o simulado (a casa tem 3 portas)
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

echo "=== 0. ABRIR O SIMULADO PRO ==="
open_sim
sleep 1
agent-browser eval "(() => {
  const dlg = document.querySelector('[role=dialog]');
  if (!dlg) return 'dialog ausente';
  const cinco = [...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === '5');
  if (cinco) cinco.click();
  return '5 questões selecionadas';
})()" 2>/dev/null | tr -d '\\'

echo "=== 1. RUN 1 — dwell variado (q3 fica a mais lenta E pulada) ==="
agent-browser eval "[...document.querySelectorAll('[role=dialog] button')].find(b => (b.textContent || '').trim() === 'Iniciar simulado')?.click(); 'go'" >/dev/null 2>&1
sleep 3
agent-browser press 2 >/dev/null 2>&1            # q1 não consegui (~3s) → avança
sleep 2
agent-browser press 1 >/dev/null 2>&1            # q2 consegui (~2s) → avança
sleep 5
agent-browser press ArrowRight >/dev/null 2>&1   # q3 PULADA com ~5s (a mais lenta)
sleep 2
agent-browser press 2 >/dev/null 2>&1            # q4 não consegui (~2s) → avança
sleep 1.5
agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => (x.textContent || '').trim() === 'Encerrar'); if (!b) return 'encerrar ausente'; b.click(); return 'encerrando'; })()" 2>/dev/null | tr -d '\\'
sleep 1
agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => (x.textContent || '').trim() === 'Encerrar e ver resultado'); if (!b) return 'confirm ausente'; b.click(); return 'confirmado'; })()" 2>/dev/null | tr -d '\\'
sleep 1.5

echo "=== 2. O STRIP NO DEBRIEF (run 1) ==="
agent-browser eval "(() => {
  const dlg = document.querySelector('[role=dialog]');
  if (!dlg) return JSON.stringify({ erro: 'dialog ausente' });
  const t = dlg.textContent;
  const chips = [...dlg.querySelectorAll('span')].filter(s => /^Q[1-9] \\d{2}:\\d{2}/.test((s.textContent || '').trim()));
  const amber = chips.find(s => (s.className || '').includes('amber'));
  return JSON.stringify({
    strip: t.includes('Onde o tempo foi'),
    footer: t.includes('nas questões'),
    nChips: chips.length,
    amberNaQ3: amber ? (amber.textContent || '').trim().slice(0, 9) : null,
    sinoAusente: !t.includes('pelo relógio'),
    resultado: t.includes('Resultado do simulado')
  });
})()" 2>/dev/null | tr -d '\\'
agent-browser eval "document.querySelector('[role=dialog]')?.scrollTo ? document.querySelector('[role=dialog]').querySelector('.overflow-y-auto, [class*=overflow]')?.scrollBy(0, 400) : 'n/a'" >/dev/null 2>&1
sleep 0.5
agent-browser screenshot $DIR/qa192-debrief-strip.png >/dev/null 2>&1 && echo "print: qa192-debrief-strip.png"

echo "=== 3. RUN 2 — PAUSA PRESERVA O PACING NO STORAGE ==="
agent-browser eval "[...document.querySelectorAll('[role=dialog] button')].find(b => (b.textContent || '').trim() === 'Novo simulado')?.click(); 'novo'" >/dev/null 2>&1
sleep 1
agent-browser eval "(() => { const cinco = [...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === '5'); if (cinco) cinco.click(); return '5q'; })()" >/dev/null 2>&1
agent-browser eval "[...document.querySelectorAll('[role=dialog] button')].find(b => (b.textContent || '').trim() === 'Iniciar simulado')?.click(); 'go'" >/dev/null 2>&1
sleep 3
agent-browser press 2 >/dev/null 2>&1            # q1 não consegui (~3s)
agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => (x.textContent || '').trim() === 'Pausar'); if (!b) return 'pausar ausente'; b.click(); return 'pausado'; })()" 2>/dev/null | tr -d '\\'
sleep 1.5
agent-browser eval "(() => {
  const raw = localStorage.getItem('hub-estudos-ifpb:simulado-inprogress');
  let s = null; try { s = JSON.parse(raw); } catch (e) {}
  return JSON.stringify({
    salvo: !!s,
    timeByQLen: s && Array.isArray(s.timeByQ) ? s.timeByQ.length : 0,
    q1Sec: s && Array.isArray(s.timeByQ) ? Math.round(s.timeByQ[0] || 0) : 0,
    remaining: s ? s.remaining : 0
  });
})()" 2>/dev/null | tr -d '\\'

echo "=== 4. O SINO: remaining → 1, retomar, esperar o 00:00 ==="
agent-browser eval "(() => {
  const KEY = 'hub-estudos-ifpb:simulado-inprogress';
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (!s) return 'save ausente';
  s.remaining = 1;
  localStorage.setItem(KEY, JSON.stringify(s));
  return 'remaining=1 gravado';
})()" 2>/dev/null | tr -d '\\'
open_sim
sleep 1
agent-browser eval "(() => {
  const t = document.body.textContent;
  const b = [...document.querySelectorAll('button')].find(x => /^Retomar/.test((x.textContent || '').trim()));
  if (!b) return JSON.stringify({ banner: t.includes('Pausada há'), retomar: false });
  b.click();
  return JSON.stringify({ banner: true, retomar: true });
})()" 2>/dev/null | tr -d '\\'
sleep 3.5

echo "=== 5. O DEBRIEF DO SINO (run 2) ==="
agent-browser eval "(() => {
  const dlg = document.querySelector('[role=dialog]');
  if (!dlg) return JSON.stringify({ erro: 'dialog ausente' });
  const t = dlg.textContent;
  const chips = [...dlg.querySelectorAll('span')].filter(s => /^Q[1-9] \\d{2}:\\d{2}/.test((s.textContent || '').trim()));
  const q1 = chips[0] ? (chips[0].textContent || '').trim() : null;
  return JSON.stringify({
    sino: t.includes('pelo relógio'),
    vozSino: t.includes('Encerrada pelo relógio (00:00)'),
    chute: t.includes('chute educado'),
    strip: t.includes('Onde o tempo foi'),
    q1Chip: q1,
    q1Preservado: !!q1 && !q1.startsWith('Q1 00:00')
  });
})()" 2>/dev/null | tr -d '\\'
agent-browser screenshot $DIR/qa192-debrief-sino.png >/dev/null 2>&1 && echo "print: qa192-debrief-sino.png"

echo "=== 6. MOBILE 390 NO DEBRIEF DO SINO ==="
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 1
agent-browser eval "JSON.stringify({scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth})" 2>/dev/null | tr -d '\\'
agent-browser screenshot $DIR/qa192-mobile390-sino.png >/dev/null 2>&1 && echo "print: qa192-mobile390-sino.png"

echo "=== 7. O HISTÓRICO CONFESSA O SINO (chip pelo relógio, aba Progresso) ==="
agent-browser set viewport 1366 900 >/dev/null 2>&1
sleep 0.5
agent-browser eval "(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => (x.textContent || '').trim() === 'Close'); if (b) b.click(); return 'fechado'; })()" >/dev/null 2>&1
sleep 1
agent-browser eval "window.dispatchEvent(new CustomEvent('hub:open-progress')); 'indo para o Progresso'" 2>/dev/null | tr -d '\\'
sleep 2
agent-browser eval "(() => {
  const t = document.body.textContent;
  const chips = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent || '').trim() === 'pelo relógio');
  return JSON.stringify({ noProgresso: t.includes('Histórico de simulados') || t.includes('Tendência'), chipPeloRelogio: chips.length > 0 });
})()" 2>/dev/null | tr -d '\\'
agent-browser eval "(() => { const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && (e.textContent || '').trim() === 'pelo relógio'); if (el) el.scrollIntoView({ block: 'center' }); return el ? 'rolado' : 'chip ausente'; })()" 2>/dev/null | tr -d '\\'
sleep 0.5
agent-browser screenshot $DIR/qa192-historico-sino.png >/dev/null 2>&1 && echo "print: qa192-historico-sino.png"

echo "=== 8. CONSOLE + HIGIENE ==="
agent-browser console 2>/dev/null | rg -i "error|warning" | head -5
echo "console-verificado"
agent-browser eval "(() => { localStorage.removeItem('hub-estudos-ifpb:simulado-inprogress'); localStorage.removeItem('hub-estudos-ifpb:simulado-runs'); localStorage.removeItem('hub:math-exam:v1:kit'); localStorage.removeItem('hub:math-exam:v1:plan'); return 'higiene feita'; })()" 2>/dev/null | tr -d '\\'
agent-browser close --all >/dev/null 2>&1
echo "FIM t192 E2E"
