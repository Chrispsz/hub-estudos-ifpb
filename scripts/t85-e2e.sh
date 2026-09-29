#!/bin/bash
# QA Task 85 — "o hero fala o simulado" (chip do marco mais próximo no topo)
# Fases: A real (chip em N dias + clique) · B mock 28/09 (amanhã) · C mock 29/09
# (é hoje, sólido) · D seed run (feito ✓ em hero E marcos — fonte única) ·
# E mock 30/09 (chip sai) · F mobile 390 · limpeza total
cd /home/z/my-project
SNAP="agent-browser snapshot"
KEY='hub-estudos-ifpb:v2'

echo "=== FASE A: data real (dom 27/09) — chip 'em 2 dias' ==="
agent-browser open "http://localhost:3000/?r=t85A" > /dev/null 2>&1; sleep 4
agent-browser press Escape > /dev/null 2>&1; sleep 1
$SNAP > scripts/t85-A.txt 2>&1
echo "A-prova: $(grep -c 'Faltam 4 dias' scripts/t85-A.txt) (esperado >=1)"
echo "A-simulado-em2: $(grep -c 'Simulado da Av1 em 2 dias' scripts/t85-A.txt) (esperado 1)"
echo "A-data-marco: $(grep -c 'ter\., 29/09' scripts/t85-A.txt) (esperado 1)"
echo "A-sem-amanha: $(grep -c 'Amanhã: Simulado' scripts/t85-A.txt) (esperado 0)"

echo "--- clique no chip do simulado abre o setup com preset ---"
REF=$($SNAP | grep 'Simulado da Av1 em 2 dias' | grep -oE 'ref=e[0-9]+' | head -1 | grep -oE 'e[0-9]+')
agent-browser click "$REF" > /dev/null 2>&1; sleep 3
$SNAP > scripts/t85-A2.txt 2>&1
echo "A-setup-aberto: $(grep -ci 'questões\|60 min\|escopo' scripts/t85-A2.txt) (esperado >=1)"

echo "=== FASE B: mock seg 28/09 — 'Amanhã' ==="
agent-browser open "http://localhost:3000/?r=t85B" > /dev/null 2>&1; sleep 3
agent-browser eval "(() => { const M = new Date('2026-09-28T10:00:00'); class F extends Date { constructor(...a) { a.length === 0 ? super(M) : super(...a); } static now() { return M.getTime(); } } window.Date = F; return 'ok ' + new Date().toDateString(); })()" > /dev/null 2>&1
sleep 66
$SNAP > scripts/t85-B.txt 2>&1
echo "B-amanha: $(grep -c 'Amanhã: Simulado da Av1' scripts/t85-B.txt) (esperado 1)"
echo "B-prova-3d: $(grep -c 'Falta 3 dias' scripts/t85-B.txt) (esperado >=1)"
echo "B-sem-em2: $(grep -c 'em 2 dias' scripts/t85-B.txt) (esperado 0)"

echo "=== FASE C: mock ter 29/09 — 'É hoje' sólido ==="
agent-browser eval "(() => { const M = new Date('2026-09-29T10:00:00'); class F extends Date { constructor(...a) { a.length === 0 ? super(M) : super(...a); } static now() { return M.getTime(); } } window.Date = F; return 'ok'; })()" > /dev/null 2>&1
sleep 66
$SNAP > scripts/t85-C.txt 2>&1
echo "C-ehoje: $(grep -c 'É hoje: Simulado da Av1' scripts/t85-C.txt) (esperado 1)"
echo "C-entrega-s3: $(grep -c 'entrega S3 de Algoritmos' scripts/t85-C.txt) (esperado >=1)"
echo "C-prova-2d: $(grep -c 'Faltam 2 dias' scripts/t85-C.txt) (esperado >=1)"
echo "C-sem-amanha: $(grep -c 'Amanhã: Simulado' scripts/t85-C.txt) (esperado 0)"

echo "=== FASE D: seed do run oficial — hero E marcos viram 'feito ✓' (fonte única) ==="
agent-browser eval "(() => { const raw = localStorage.getItem('$KEY'); window.__qa85 = raw; const o = JSON.parse(raw || '{}'); o.simuladoRuns = [{ id: 'qa85-run', date: '2026-09-29T18:00:00', mode: 'prova', total: 10, solved: 7, missed: 2, skipped: 1, durationSec: 3600, filters: { discipline: 'TEC.1984' } }]; const nv = JSON.stringify(o); localStorage.setItem('$KEY', nv); window.dispatchEvent(new StorageEvent('storage', { key: '$KEY', newValue: nv })); return 'seeded'; })()" > /dev/null 2>&1
sleep 3
$SNAP > scripts/t85-D.txt 2>&1
echo "D-hero-feito: $(grep -c 'feito ✓ — pedir a correção' scripts/t85-D.txt) (esperado >=1)"
echo "D-marcos-feito: $(grep -c 'Simulado da Av1 feito ✓' scripts/t85-D.txt) (esperado >=1)"
echo "D-sem-ehoje: $(grep -c 'É hoje: Simulado' scripts/t85-D.txt) (esperado 0)"

echo "--- clique no chip feito abre o tutor com a correção ---"
REF=$($SNAP | grep 'feito ✓' | grep -oE 'ref=e[0-9]+' | head -1 | grep -oE 'e[0-9]+')
agent-browser click "$REF" > /dev/null 2>&1; sleep 3
$SNAP > scripts/t85-D2.txt 2>&1
echo "D-tutor-aberto: $(grep -ci 'correção\|tutor' scripts/t85-D2.txt) (esperado >=1)"

echo "=== FASE E: mock qua 30/09 — chip sai, prova 'Falta 1 dia' ==="
agent-browser open "http://localhost:3000/?r=t85E" > /dev/null 2>&1; sleep 3
agent-browser eval "(() => { const M = new Date('2026-09-30T10:00:00'); class F extends Date { constructor(...a) { a.length === 0 ? super(M) : super(...a); } static now() { return M.getTime(); } } window.Date = F; return 'ok'; })()" > /dev/null 2>&1
sleep 66
$SNAP > scripts/t85-E.txt 2>&1
echo "E-sem-chip: $(grep -c 'Simulado da Av1 em\|Amanhã: Simulado\|É hoje: Simulado' scripts/t85-E.txt) (esperado 0)"
echo "E-prova-1d: $(grep -c 'Falta 1 dia' scripts/t85-E.txt) (esperado >=1)"

echo "=== FASE F: mobile 390 (data real) — sem overflow, chips quebram linha ==="
agent-browser open "http://localhost:3000/?r=t85F" > /dev/null 2>&1; sleep 4
agent-browser set viewport 390 844 > /dev/null 2>&1; sleep 2
agent-browser eval "({sw: document.documentElement.scrollWidth, iw: window.innerWidth})" 2>&1
$SNAP > scripts/t85-F.txt 2>&1
echo "F-chip-presente: $(grep -c 'Simulado da Av1 em 2 dias' scripts/t85-F.txt) (esperado 1)"
agent-browser screenshot scripts/t85-hero-mobile390.png > /dev/null 2>&1
agent-browser set viewport 1280 720 > /dev/null 2>&1

echo "=== LIMPEZA: storage restaurado, mock morto no reload ==="
agent-browser open "http://localhost:3000/?r=t85clean" > /dev/null 2>&1; sleep 3
agent-browser eval "(() => { if (window.__qa85 !== undefined) { localStorage.setItem('$KEY', window.__qa85); window.dispatchEvent(new StorageEvent('storage', { key: '$KEY', newValue: window.__qa85 })); return 'restored'; } return 'sem-backup (mock morreu no reload — nada seedado no storage real)'; })()" 2>&1
agent-browser open "http://localhost:3000/?r=t85final" > /dev/null 2>&1; sleep 4
$SNAP > scripts/t85-final.txt 2>&1
echo "FINAL-real: $(grep -c 'Faltam 4 dias' scripts/t85-final.txt) (esperado >=1)"
echo "FINAL-sem-run-feito: $(grep -c 'feito ✓' scripts/t85-final.txt) (esperado 0)"
agent-browser console > scripts/t85-console.txt 2>&1
echo "console-errors: $(grep -ci 'error' scripts/t85-console.txt) (esperado 0)"
echo "FIM"
