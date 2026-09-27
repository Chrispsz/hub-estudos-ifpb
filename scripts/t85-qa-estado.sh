#!/bin/bash
# QA Task 85 — estado do b98a2d8 (fila viva da 84) + superfícies de contagem
cd /home/z/my-project
SNAP="agent-browser snapshot"

echo "=== FASE A: data real (domingo 27/09, D-4) ==="
agent-browser open "http://localhost:3000/?r=t85A" > /dev/null 2>&1; sleep 4
agent-browser press Escape > /dev/null 2>&1; sleep 1
$SNAP > scripts/t85-A.txt 2>&1
echo "A-fila-pointer: $(grep -c 'Plano da prova (D-4): Lista de Lógica' scripts/t85-A.txt) (esperado >=1 — fila viva da 84)"
echo "A-hero-4-dias: $(grep -c 'Faltam 4 dias' scripts/t85-A.txt) (esperado >=1)"
echo "A-sem-0d: $(grep -c 'hoje' scripts/t85-A.txt | head -1) (informativo)"
echo "A-card-prova: $(grep -c 'Lógica — Parte 1' scripts/t85-A.txt) (esperado >=1)"

echo "=== FASE B: console errors ==="
agent-browser console > scripts/t85-console.txt 2>&1
echo "console-errors: $(grep -ci 'error' scripts/t85-console.txt) (esperado 0)"

echo "=== FASE C: mobile 390 overflow ==="
agent-browser set viewport 390 844 > /dev/null 2>&1; sleep 2
agent-browser eval "({sw: document.documentElement.scrollWidth, iw: window.innerWidth})" 2>&1
agent-browser set viewport 1280 720 > /dev/null 2>&1
echo "FIM QA estado"
