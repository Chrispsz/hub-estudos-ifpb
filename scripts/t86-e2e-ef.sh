#!/bin/bash
# QA E2E rodada 17:30 — fases E (histórico) e F (pós-janela) corrigidas:
# Progresso é aba SECUNDÁRIA (atrás de "Mais") e re-render exige troca real de aba.
cd /home/z/my-project
if ! curl -s -o /dev/null --max-time 3 http://localhost:3000; then
  nohup bun run dev > /tmp/dev.log 2>&1 &
  sleep 8
fi
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5

clicknav() { agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; const alvo=b.find(x=>x.textContent.includes('$1')); if(!alvo){ const mais=b.find(x=>x.textContent.includes('Mais')); if(mais){mais.click(); return 'mais-aberto';} } alvo?.click(); return alvo?'ok':'NAO_ACHEI:$1'; })()" 2>/dev/null | head -2; }

echo "=== [E1] abrir Mais → Progresso ==="
clicknav "Progresso"
sleep 2
clicknav "Progresso"
sleep 2

echo "=== [E2] seed 3 runs (oficial 29/09 prova MAT + treino + prova prática) ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)||'{}'); cur.simuladoRuns=[{id:'qa86-oficial',date:'2026-09-29T10:15:00.000Z',mode:'prova',total:10,solved:4,missed:6,skipped:0,durationSec:2731,filters:{discipline:'TEC.1984'}},{id:'qa86-treino',date:'2026-09-28T22:00:00.000Z',mode:'treino',total:8,solved:5,missed:3,skipped:0,durationSec:900},{id:'qa86-pratica',date:'2026-09-26T14:00:00.000Z',mode:'prova',total:6,solved:6,missed:0,skipped:0,durationSec:600,filters:{discipline:'TEC.1687'}}]; const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'seeded:'+cur.simuladoRuns.length; })()" 2>/dev/null | head -2
sleep 2

echo "=== [E3] histórico: badge oficial / badge treino / prática sem badge / Medal / rodapé ==="
agent-browser eval "(() => { const cards=[...document.querySelectorAll('main .rounded-xl, main [class*=bg-card]')]; const h=cards.find(c=>c.innerText.includes('Histórico de simulados')); if(!h) return 'X'; const t=h.innerText.replace(/\n/g,' § '); const rows=[...h.querySelectorAll('div')].filter(d=>d.className.includes('border-l-2')); const res={badgeOficial:t.includes('Oficial da Av1'), rodape:t.includes('oficial da Av1 (29/09): 40%'), medalAria:!!h.querySelector('[aria-label^=\"Tentativa oficial\"]'), ringEmerald:!!h.querySelector('.ring-emerald-500\\\\/50')||!!h.querySelector('[class*=\"ring-emerald\"]')}; rows.forEach(r=>{ if(r.innerText.includes('4/10')) res.oficial=r.innerText.includes('Oficial da Av1'); if(r.innerText.includes('5/8')) res.treino=r.innerText.includes('Treino') && !r.innerText.includes('Oficial'); if(r.innerText.includes('6/6')) res.praticaSemBadge=!r.innerText.includes('Oficial da Av1'); }); return JSON.stringify(res); })()" 2>/dev/null | head -6

echo "=== [E4] screenshots (dark) ==="
agent-browser screenshot scripts/qa86-historico-oficial.png >/dev/null 2>&1 && echo shot1-ok

echo "=== [F] mock 01/10 + troca dupla de abas (re-render garantido) ==="
agent-browser eval "(() => { const M=new Date(2026,9,1,15,0,0).getTime(); class F extends Date { constructor(...a){ a.length===0?super(M):super(...a);} static now(){return M;} } window.Date=F; return 'mock01'; })()" >/dev/null 2>&1
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Biblioteca'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 1
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Praticar'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const t=document.querySelector('header').innerText; return t.includes('Simulado') ? 'FALHA: chip fora da janela → '+t.split('§').slice(3,5).join('§') : 'ok: chip saiu da janela (dias<0)'; })()" 2>/dev/null | head -3

echo "=== [G] higiene: runs qa86 fora + reload real ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)); cur.simuladoRuns=(cur.simuladoRuns||[]).filter(r=>!String(r.id).startsWith('qa86-')); const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'runs:'+cur.simuladoRuns.length; })()" 2>/dev/null | head -2
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
agent-browser eval "(() => { const cur=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}'); const t=document.body.innerText; return JSON.stringify({runs:(cur.simuladoRuns||[]).length, hero:t.match(/Faltam \\d+ dias/)?.[0], tema:document.documentElement.className}); })()" 2>/dev/null | head -3
agent-browser screenshot scripts/qa86-final-real.png >/dev/null 2>&1 && echo shot2-ok

echo "=== [I] console ==="
agent-browser --clear >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
agent-browser console 2>/dev/null | grep -iE "\[error\]|\[warning\]" | grep -v "Download the React" | head -5
echo "=== FIM QA E/F ==="
