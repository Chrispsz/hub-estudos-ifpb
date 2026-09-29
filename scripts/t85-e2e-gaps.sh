#!/bin/bash
# QA Task 85 — verificação final dos 2 gaps: (1) branch "É hoje" sem run;
# (2) clique no chip feito abre o tutor. Com cleanup ANTI-LEAK (filtra por id
# na MESMA página viva, antes de qualquer reload).
cd /home/z/my-project
SNAP="agent-browser snapshot"
KEY='hub-estudos-ifpb:v2'

echo "=== G1: mock 29/09 SEM run — branch 'É hoje' (convite) ==="
agent-browser open "http://localhost:3000/?r=t85G1" > /dev/null 2>&1; sleep 4
agent-browser eval "(() => { const M = new Date('2026-09-29T10:00:00'); class F extends Date { constructor(...a) { a.length === 0 ? super(M) : super(...a); } static now() { return M.getTime(); } } window.Date = F; return 'ok'; })()" > /dev/null 2>&1
sleep 66
$SNAP > scripts/t85-G1.txt 2>&1
echo "G1-aria-convite: $(grep -c 'Hoje é o dia do Simulado da Av1 e da entrega S3 de Algoritmos — abrir o simulado' scripts/t85-G1.txt) (esperado >=1)"
echo "G1-sem-feito: $(grep -c 'já foi feito' scripts/t85-G1.txt) (esperado 0)"

echo "=== G2: seed run — clique no chip feito abre o tutor ==="
agent-browser eval "(() => { const raw = localStorage.getItem('$KEY'); const o = JSON.parse(raw || '{}'); o.simuladoRuns = [{ id: 'qa85-run', date: '2026-09-29T18:00:00', mode: 'prova', total: 10, solved: 7, missed: 2, skipped: 1, durationSec: 3600, filters: { discipline: 'TEC.1984' } }]; const nv = JSON.stringify(o); localStorage.setItem('$KEY', nv); window.dispatchEvent(new StorageEvent('storage', { key: '$KEY', newValue: nv })); return 'seeded'; })()" > /dev/null 2>&1
sleep 3
$SNAP > scripts/t85-G2.txt 2>&1
echo "G2-hero-feito-aria: $(grep -c 'Simulado da Av1 de hoje já foi feito' scripts/t85-G2.txt) (esperado >=1 = hero + marcos)"

REF=$($SNAP | grep 'button "Simulado da Av1 de hoje já foi feito' | grep -oE 'ref=e[0-9]+' | head -1 | grep -oE 'e[0-9]+')
echo "G2-ref-extraido: ${REF:-VAZIO}"
agent-browser click "$REF" > /dev/null 2>&1; sleep 3
$SNAP > scripts/t85-G2b.txt 2>&1
echo "G2-tutor-aberto: $(grep -c 'aproveitamento 70%\|7/10 resolvidas\|correção do simulado\|debrief' scripts/t85-G2b.txt) (esperado >=1)"
echo "G2-nav-estudar-ativo: $(grep -c '\[current\]' scripts/t85-G2b.txt) (informativo)"

echo "=== CLEANUP: filtra qa85-run na MESMA página (anti-leak) ==="
agent-browser eval "(() => { const KEY='$KEY'; const raw=localStorage.getItem(KEY); if(!raw) return 'no storage'; const o=JSON.parse(raw); const b=(o.simuladoRuns||[]).length; o.simuladoRuns=(o.simuladoRuns||[]).filter(r=>r.id!=='qa85-run'); const nv=JSON.stringify(o); localStorage.setItem(KEY,nv); window.dispatchEvent(new StorageEvent('storage',{key:KEY,newValue:nv})); return 'runs '+b+' -> '+o.simuladoRuns.length; })()" 2>&1

echo "=== G3: data real final — estado limpo ==="
agent-browser open "http://localhost:3000/?r=t85G3" > /dev/null 2>&1; sleep 5
$SNAP > scripts/t85-G3.txt 2>&1
echo "G3-real: $(grep -c 'Faltam 4 dias' scripts/t85-G3.txt) (esperado >=1)"
echo "G3-chip-em2: $(grep -c 'Simulado da Av1 em 2 dias' scripts/t85-G3.txt) (esperado 1)"
echo "G3-sem-feito: $(grep -c 'já foi feito' scripts/t85-G3.txt) (esperado 0)"
agent-browser screenshot scripts/t85-hero-final.png > /dev/null 2>&1
agent-browser console 2>&1 | rg -v "\[log\] \[Fast Refresh|\[log\] \[HMR\]|DevTools|unrecoverable" | rg -ci "\[error\]"; echo "(esperado 0)"
echo "FIM G"
