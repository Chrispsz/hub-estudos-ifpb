#!/bin/bash
# QA E2E Task 87 — "a nota registrada fala" (single invocation, lição 83/85/86)
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; sleep 2
nohup bun run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null --max-time 2 http://localhost:3000 && break; sleep 2; done
echo "server: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000)"

agent-browser --clear >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 8
echo "fiber: $(agent-browser eval "(() => Object.keys(document.querySelector('main')).some(k=>k.startsWith('__react')))()" 2>/dev/null | head -1)"

cardtxt() { agent-browser eval "(() => { const el=[...document.querySelectorAll('section')].find(s=>s.querySelector('[id=recovery-title]')); return el ? el.innerText.replace(/\n/g,' § ') : 'CARD NAO ACHEI'; })()" 2>/dev/null | head -3; }

echo "=== [A] data real (D-4): badge + fila pointer ==="
cardtxt | head -1 | cut -c1-400

echo "=== [B] mock 02/10 (pós-prova) SEM nota ==="
agent-browser eval "(() => { const M=new Date(2026,9,2,10,0,0).getTime(); class F extends Date { constructor(...a){ a.length===0?super(M):super(...a);} static now(){return M;} } window.Date=F; return 'ok'; })()" >/dev/null 2>&1
agent-browser eval "(() => { [...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Biblioteca'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 1
agent-browser eval "(() => { [...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Visão Geral'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
T=$(cardtxt)
echo "$T" | grep -o "realizada — falta a nota" | head -1
echo "$T" | grep -o "Anotar a nota da Av1 na Calculadora" | head -1

echo "=== [C] seed nota 85 → fila larga 'Anotar' + badge emerald ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)||'{}'); cur.realGrades={...(cur.realGrades||{}),'TEC.1984-Av1':{grade:85,doneAt:new Date().toISOString()}}; const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'seeded'; })()" >/dev/null 2>&1
sleep 2
T=$(cardtxt)
echo "badge-emerald: $(echo "$T" | grep -o 'Realizada — nota 85 · meta 70 ✓' | head -1)"
echo "fila-sem-anotar: $(echo "$T" | grep -c 'Anotar a nota da Av1' | head -1) (0 = largou)"
echo "1º-item-agora: $(echo "$T" | grep -o 'Fazer as 10 questões da Semana 2' | head -1)"
echo "=== [C2] resumo da trilha mat expandida ==="
agent-browser eval "(() => { const el=[...document.querySelectorAll('section')].find(s=>s.querySelector('[id=recovery-title]')); const btn=[...el.querySelectorAll('button')].find(b=>b.textContent.includes('Matemática')); btn?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 1
T=$(cardtxt)
echo "$T" | grep -o "nota 85 registrada ✓ acima da meta de aprovação (≥ 70)" | head -1

echo "=== [D] nota muda p/ 55 → badge amber (valor MUDOU, lição 80) ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)); cur.realGrades['TEC.1984-Av1']={grade:55,doneAt:new Date().toISOString()}; const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'ok'; })()" >/dev/null 2>&1
sleep 2
T=$(cardtxt)
echo "badge-amber: $(echo "$T" | grep -o 'Realizada — nota 55 · meta 70' | head -1)"
echo "resumo-abaixo: $(echo "$T" | grep -o 'abaixo da meta de aprovação (≥ 70)' | head -1)"
agent-browser screenshot scripts/qa87-nota-registrada.png >/dev/null 2>&1 && echo shot-ok

echo "=== [E] higiene: remover nota + data real ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)); delete cur.realGrades['TEC.1984-Av1']; const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'ok'; })()" >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
T=$(cardtxt)
echo "badge-real: $(echo "$T" | grep -o 'Prova de Matemática em 4d' | head -1)"
agent-browser eval "(() => { const cur=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}'); return JSON.stringify({av1:cur.realGrades?.['TEC.1984-Av1']??'ausente', runs:(cur.simuladoRuns||[]).length}); })()" 2>/dev/null | head -2

echo "=== [F] mobile 390 ==="
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 1
agent-browser eval "(() => ({sw:document.documentElement.scrollWidth, iw:window.innerWidth}))()" 2>/dev/null | grep -E "sw|iw" | head -2
agent-browser set viewport 1440 900 >/dev/null 2>&1

echo "=== [G] console ==="
agent-browser --clear >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser console 2>/dev/null | grep -icE "\[error\]|\[warning\]" | head -1
echo "=== FIM ==="
