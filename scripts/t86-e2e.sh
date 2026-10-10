#!/bin/bash
# QA E2E rodada 17:30 (Task 86) — single invocation (lição 83)
# Fases: A real (badges header fora do dashboard) · B/C/D mocks 28-29/09 + feito ✓
# · E histórico com oficial · F pós-janela · G higiene · H mobile · console
cd /home/z/my-project
if ! curl -s -o /dev/null --max-time 3 http://localhost:3000; then
  nohup bun run dev > /tmp/dev.log 2>&1 &
  sleep 8
fi
echo "=== server: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000) ==="

agent-browser --clear >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6

hdr() { agent-browser eval "(() => { const h = document.querySelector('header'); return h ? h.innerText.replace(/\n/g,' § ') : 'NO_HEADER'; })()" 2>/dev/null | head -3; }

echo "=== [A1] dashboard real: hero ==="
agent-browser snapshot 2>/dev/null | grep -oE "Faltam [0-9]+ dias" | head -1

echo "=== [A2] header em aba externa (Praticar) — prova + simulado ==="
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Praticar'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
hdr

echo "=== [A3] dashboard: badges AUSENTES no topo (regra antiga preservada) ==="
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Visão Geral'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const t=document.querySelector('header').innerText; return t.includes('Simulado') ? 'FALHA: chip visível no dashboard' : 'ok: sem chips no dashboard'; })()" 2>/dev/null | head -2

echo "=== [B] mock 28/09 (véspera do simulado) + remount por abas ==="
agent-browser eval "(() => { const M=new Date(2026,8,28,10,0,0).getTime(); class F extends Date { constructor(...a){ a.length===0?super(M):super(...a);} static now(){return M;} } window.Date=F; return 'mock28'; })()" >/dev/null 2>&1
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Praticar'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
hdr

echo "=== [C] mock 29/09 (dia) — sólido ==="
agent-browser eval "(() => { const M=new Date(2026,8,29,9,30,0).getTime(); class F extends Date { constructor(...a){ a.length===0?super(M):super(...a);} static now(){return M;} } window.Date=F; return 'mock29'; })()" >/dev/null 2>&1
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Biblioteca'))?.click(); setTimeout(()=>[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('Praticar'))?.click(),50); return 'ok'; })()" >/dev/null 2>&1
sleep 2
hdr

echo "=== [D] seed run oficial (29/09 prova MAT 40%) — flip emerald ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)||'{}'); const run={id:'qa86-oficial',date:'2026-09-29T10:15:00.000Z',mode:'prova',total:10,solved:4,missed:6,skipped:0,durationSec:2731,filters:{discipline:'TEC.1984'}}; cur.simuladoRuns=[run,...(cur.simuladoRuns||[])]; const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'seeded'; })()" 2>/dev/null | head -2
sleep 2
hdr

echo "=== [E] Progresso: histórico com oficial (badge/coluna/rodapé) ==="
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Progresso'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const cards=[...document.querySelectorAll('main [class*=card], main .bg-card')]; const h=cards.find(c=>c.innerText.includes('Histórico de simulados')); if(!h) return 'HISTORICO NAO ENCONTRADO'; const t=h.innerText.replace(/\n/g,' § '); return { oficialBadge:t.includes('Oficial da Av1'), rodape:t.includes('oficial da Av1 (29/09): 40%'), medalAria:!!h.querySelector('[aria-label^=\"Tentativa oficial\"]'), ringEmerald:!!h.querySelector('.ring-emerald-500\\\\/50') }; })()" 2>/dev/null | head -5

echo "=== [E2] treino run + prova prática: badge só na oficial ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)); cur.simuladoRuns=[...cur.simuladoRuns,{id:'qa86-treino',date:'2026-09-28T22:00:00.000Z',mode:'treino',total:8,solved:5,missed:3,skipped:0,durationSec:900},{id:'qa86-pratica',date:'2026-09-26T14:00:00.000Z',mode:'prova',total:6,solved:6,missed:0,skipped:0,durationSec:600,filters:{discipline:'TEC.1687'}}]; const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const cards=[...document.querySelectorAll('main .bg-card')]; const h=cards.find(c=>c.innerText.includes('Histórico de simulados')); if(!h) return 'X'; const rows=[...h.querySelectorAll('div')].filter(d=>d.className.includes('border-l-2')); const res={}; rows.forEach(r=>{ if(r.innerText.includes('qa86')||r.innerText.includes('/')){ if(r.innerText.includes('4/10')) res.oficial=r.innerText.includes('Oficial da Av1'); if(r.innerText.includes('5/8')) res.treino=r.innerText.includes('Treino'); if(r.innerText.includes('6/6')) res.pratica=r.innerText.includes('Oficial da Av1')?'FALHA:pratica-badge':'ok-sem-badge'; }}); return JSON.stringify(res); })()" 2>/dev/null | head -4

echo "=== [E3] screenshot histórico ==="
agent-browser screenshot scripts/qa86-historico-oficial.png >/dev/null 2>&1 && echo "shot ok"

echo "=== [F] mock 01/10 — chip sai do header (janela fechada) ==="
agent-browser eval "(() => { const M=new Date(2026,9,1,15,0,0).getTime(); class F extends Date { constructor(...a){ a.length===0?super(M):super(...a);} static now(){return M;} } window.Date=F; return 'mock01'; })()" >/dev/null 2>&1
agent-browser eval "(() => { const b=[...document.querySelectorAll('nav button')]; b.find(x=>x.textContent.includes('Praticar'))?.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const t=document.querySelector('header').innerText; return t.includes('Simulado') ? 'FALHA: chip fora da janela' : 'ok: chip saiu da janela'; })()" 2>/dev/null | head -2

echo "=== [G] higiene: remover runs qa86 (na página viva) + reload real ==="
agent-browser eval "(() => { const K='hub-estudos-ifpb:v2'; const cur=JSON.parse(localStorage.getItem(K)); cur.simuladoRuns=(cur.simuladoRuns||[]).filter(r=>!String(r.id).startsWith('qa86-')); const v=JSON.stringify(cur); localStorage.setItem(K,v); window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v})); return 'runs:'+cur.simuladoRuns.length; })()" 2>/dev/null | head -2
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
agent-browser eval "(() => { const cur=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}'); const t=document.body.innerText; return JSON.stringify({runs:(cur.simuladoRuns||[]).length, hero:t.match(/Faltam \\d+ dias/)?.[0], travadas:!!localStorage.getItem('hub:math-exam:v1:travadas')}); })()" 2>/dev/null | head -3

echo "=== [H] mobile 390 — overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 1
agent-browser eval "(() => ({sw:document.documentElement.scrollWidth, iw:window.innerWidth}))()" 2>/dev/null | head -3
agent-browser set viewport 1440 900 >/dev/null 2>&1

echo "=== [I] console (erros?) ==="
agent-browser console 2>/dev/null | grep -iE "error|warn" | grep -v "Download the React" | head -5
echo "=== FIM QA ==="
