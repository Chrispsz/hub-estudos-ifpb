#!/bin/bash
# Revalidação final Task 86 — SINGLE INVOCATION (lição 83/85: server + QA no mesmo comando)
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; sleep 2
nohup bun run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null --max-time 2 http://localhost:3000 && break; sleep 2; done
echo "server: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000)"

agent-browser --clear >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 8
echo "fiber: $(agent-browser eval "(() => Object.keys(document.querySelector('main')).some(k=>k.startsWith('__react')))()" 2>/dev/null | head -1)"

echo "=== [R1] Praticar: milestone-stack no header ==="
agent-browser eval "(() => { [...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Praticar'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const t=document.querySelector('header').innerText; return JSON.stringify({chipSimulado:t.includes('Simulado em 2d'), badgeProva:t.includes('4d → Av1'), ambos:t.includes('Simulado em 2d') && t.includes('4d → Av1')}); })()" 2>/dev/null | head -2

echo "=== [R2] mock 29/09 + run oficial → 'feito ✓' no header ==="
agent-browser eval "(() => { const M=new Date(2026,8,29,10,0,0).getTime(); class F extends Date { constructor(...a){ a.length===0?super(M):super(...a);} static now(){return M;} } window.Date=F; const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)||'{}'); const run={id:'qa86-of',date:'2026-09-29T10:15:00.000Z',mode:'prova',total:10,solved:4,missed:6,skipped:0,durationSec:2731,filters:{discipline:'TEC.1984'}}; cur.simuladoRuns=[run,...(cur.simuladoRuns||[])]; const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'mock+seed'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const t=document.querySelector('header').innerText; return JSON.stringify({feito:t.includes('Simulado feito ✓'), semEhoje:!t.includes('É hoje')}); })()" 2>/dev/null | head -2

echo "=== [R3] Progresso (via Mais): badge Oficial da Av1 no histórico ==="
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Mais'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 1
agent-browser eval "(() => { [...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Progresso'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const cards=[...document.querySelectorAll('main .rounded-xl')]; const h=cards.find(c=>c.innerText.includes('Histórico de simulados')); if(!h) return 'X'; const t=h.innerText; return JSON.stringify({badgeOficial:t.includes('Oficial da Av1'), rodape:t.includes('oficial da Av1 (29/09): 40%'), medal:!!h.querySelector('[aria-label^=\"Tentativa oficial\"]')}); })()" 2>/dev/null | head -2

echo "=== [R4] screenshot final (dark, histórico) ==="
agent-browser screenshot scripts/qa86-historico-oficial.png >/dev/null 2>&1 && echo shot-ok

echo "=== [R5] higiene: remover run qa86 + reset data ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)); cur.simuladoRuns=(cur.simuladoRuns||[]).filter(r=>!String(r.id).startsWith('qa86-')); const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'runs:'+cur.simuladoRuns.length; })()" >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser eval "(() => { const cur=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}'); const t=document.body.innerText; return JSON.stringify({runs:(cur.simuladoRuns||[]).length, hero:t.match(/Faltam \\d+ dias/)?.[0], tema:document.documentElement.className}); })()" 2>/dev/null | head -2
agent-browser screenshot scripts/qa86-final-real.png >/dev/null 2>&1 && echo shot2-ok

echo "=== [R6] console ==="
agent-browser console 2>/dev/null | grep -icE "\[error\]|\[warning\]" | head -1
echo "=== FIM REVALIDAÇÃO ==="
