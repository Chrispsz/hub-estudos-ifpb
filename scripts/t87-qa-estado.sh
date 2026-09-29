#!/bin/bash
# QA de estado rodada 18:00 — regressão 86 (header stack + oficial no histórico)
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; sleep 2
nohup bun run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null --max-time 2 http://localhost:3000 && break; sleep 2; done
echo "server: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000)"

agent-browser --clear >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 8
echo "fiber: $(agent-browser eval "(() => Object.keys(document.querySelector('main')).some(k=>k.startsWith('__react')))()" 2>/dev/null | head -1)"

echo "=== [1] hero (85) + card D-4 ==="
agent-browser snapshot 2>/dev/null | grep -oE "Faltam [0-9]+ dias|Simulado da Av1 em [0-9]+ dias" | head -2

echo "=== [2] header fora do dashboard: stack prova+simulado (86) ==="
agent-browser eval "(() => { [...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Praticar'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const t=document.querySelector('header').innerText; return JSON.stringify({simulado:t.includes('Simulado em 2d'), prova:t.includes('4d → Av1')}); })()" 2>/dev/null | head -2

echo "=== [3] histórico: estado vazio honesto (runs 0) ==="
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Mais'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 1
agent-browser eval "(() => { [...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Progresso'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const t=document.body.innerText; return JSON.stringify({semRuns:t.includes('Nenhum simulado ainda'), fila:'Verificado em seguida'}); })()" 2>/dev/null | head -2

echo "=== [4] fila de recuperação: ação pós-prova atual (84) ==="
agent-browser eval "(() => { [...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Visão Geral'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const t=document.body.innerText.replace(/\n/g,' § '); const i=t.indexOf('FAÇA HOJE'); return i>=0 ? t.slice(i, i+420) : 'FAÇA HOJE NAO ENCONTRADO'; })()" 2>/dev/null | head -4

echo "=== [5] console ==="
agent-browser console 2>/dev/null | grep -icE "\[error\]|\[warning\]" | head -1
echo "=== FIM ==="
