#!/bin/bash
# QA Task 83 — "o plano não mente" (completion-aware recovery)
# Roda server + todas as fases numa ÚNICA invocação Bash (o sandbox mata
# processos de fundo entre invocações — lição da rodada).
cd /home/z/my-project
SNAP="agent-browser snapshot"

echo "=== BOOT SERVER ==="
(setsid nohup bunx next dev -p 3000 > scripts/dev-server.log 2>&1 < /dev/null &)
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
if [ "$up" != "1" ]; then echo "SERVER FAILED TO BOOT"; tail -20 scripts/dev-server.log; exit 1; fi
echo "server up after ${i}s"
curl -s -o /dev/null http://localhost:3000/ # warm compile
sleep 2

echo "=== FASE A: data real, sem dados — banner honesto (3 pendentes) ==="
agent-browser open "http://localhost:3000/?r=qaA" > /dev/null 2>&1
sleep 4
$SNAP > scripts/qa83-A.txt 2>&1
echo "A-banner: $(grep -c 'Modo recuperação: 3 dia(s) do plano seguem pendentes' scripts/qa83-A.txt) (esperado 1)"
echo "A-tarefas: $(grep -oE 'Plano completo[0-9]+/25 tarefas' scripts/qa83-A.txt | head -1)"

echo "=== FASE B: marca TUDO dos offsets 7,6,5 → banner some ==="
agent-browser eval "(() => { const v = JSON.stringify({'7-0':true,'7-1':true,'7-2':true,'6-0':true,'6-1':true,'6-2':true,'5-0':true,'5-1':true,'5-2':true}); localStorage.setItem('hub:math-exam:v1:plan', v); window.dispatchEvent(new StorageEvent('storage',{key:'hub:math-exam:v1:plan',newValue:v})); return 'ok-B'; })()" 2>&1 | tail -1
sleep 1.5
$SNAP > scripts/qa83-B.txt 2>&1
echo "B-banner-ausente: $(grep -c 'Modo recuperação' scripts/qa83-B.txt) (esperado 0)"
echo "B-tarefas: $(grep -oE 'Plano completo[0-9]+/25 tarefas' scripts/qa83-B.txt | head -1) (esperado 9/25)"

echo "=== FASE C: desmarca offset 6 → banner: 2 pendentes · 1 já cumprido ==="
agent-browser eval "(() => { const v = JSON.stringify({'7-0':true,'7-1':true,'7-2':true,'5-0':true,'5-1':true,'5-2':true}); localStorage.setItem('hub:math-exam:v1:plan', v); window.dispatchEvent(new StorageEvent('storage',{key:'hub:math-exam:v1:plan',newValue:v})); return 'ok-C'; })()" 2>&1 | tail -1
sleep 1.5
$SNAP > scripts/qa83-C.txt 2>&1
echo "C-banner: $(grep -c 'Modo recuperação: 2 dia(s) do plano seguem pendentes' scripts/qa83-C.txt) (esperado 1)"
echo "C-cumprido: $(grep -c '1 já cumprido(s) ✓' scripts/qa83-C.txt) (esperado 1)"
echo "C-titulos: $(grep -c 'Lista de Matrizes — Bloco 1 (Q1–16) · Lista de Matrizes — Bloco 2 (Q17–30) · Lista de Matrizes — Bloco 3' scripts/qa83-C.txt) (esperado 1 — Bloco 3 NÃO pode estar na lista)"

echo "=== FASE D: diálogo plano completo — hoje / feito ✓ / atrasado ==="
REF=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Abrir plano completo[^"]*" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF" > /dev/null 2>&1
sleep 1.5
$SNAP > scripts/qa83-D.txt 2>&1
echo "D-dialog: $(grep -c 'Plano até a prova' scripts/qa83-D.txt) (esperado 1)"
echo "D-hoje-badge: $(grep -c 'hoje' scripts/qa83-D.txt) (esperado >=1)"
echo "D-feito-badges: $(grep -c 'feito ✓' scripts/qa83-D.txt) (esperado 2 — D-7 e D-5)"
echo "D-atrasado: $(grep -c 'atrasado' scripts/qa83-D.txt) (esperado 1 — só D-6)"
agent-browser press Escape > /dev/null 2>&1
sleep 0.5

echo "=== FASE E: mock 29/09 + remount por abas — chip É hoje + banner sem run ==="
agent-browser eval "(() => { const MOCK = new Date(2026,8,29,9,30).getTime(); class FakeDate extends Date { constructor(...a){ a.length===0 ? super(MOCK) : super(...a); } static now(){ return MOCK; } } window.Date = FakeDate; return 'mocked-29set'; })()" 2>&1 | tail -1
REF_E=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Estudar" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF_E" > /dev/null 2>&1; sleep 1
REF_G=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Visão Geral" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF_G" > /dev/null 2>&1; sleep 1.5
$SNAP > scripts/qa83-E.txt 2>&1
echo "E-chip-hoje: $(grep -c 'É hoje · Simulado da Av1' scripts/qa83-E.txt) (esperado 1)"
echo "E-banner: $(grep -c 'Modo recuperação: 3 dia(s) do plano seguem pendentes' scripts/qa83-E.txt) (esperado 1 — [6,4,3])"
echo "E-cumprido: $(grep -c '2 já cumprido(s) ✓' scripts/qa83-E.txt) (esperado 1)"

echo "=== FASE F: seed run oficial (4/10) — chip feito ✓ + reconhecimento no dia ==="
agent-browser eval "(() => { const KEY='hub-estudos-ifpb:v2'; let obj={}; try { obj = JSON.parse(localStorage.getItem(KEY)||'{}'); } catch(e) {} window.__v2backup = localStorage.getItem(KEY); const qs = []; for (let i=0;i<10;i++){ qs.push({ status: (i===0||i===2||i===3||i===5)?'solved':'missed', disciplineCode:'TEC.1984', topic: i<5 ? 'Lógica Matemática' : 'Álgebra Matricial', statement:'Q'+i }); } obj.simuladoRuns = [{ id:'sim-qa83', date:new Date(2026,8,29,10,15).toISOString(), mode:'prova', total:10, solved:4, missed:6, skipped:0, durationSec:2731, filters:{discipline:'TEC.1984'}, questions:qs }]; const s = JSON.stringify(obj); localStorage.setItem(KEY, s); window.dispatchEvent(new StorageEvent('storage',{key:KEY,newValue:s})); return 'run-seeded'; })()" 2>&1 | tail -1
sleep 1.5
$SNAP > scripts/qa83-F.txt 2>&1
echo "F-chip-feito: $(grep -c 'Simulado da Av1 feito ✓' scripts/qa83-F.txt) (esperado 1)"
echo "F-reconhece: $(grep -c 'Simulado feito hoje ✓' scripts/qa83-F.txt) (esperado 1)"
echo "F-pct: $(grep -c '40%' scripts/qa83-F.txt) (esperado >=1)"
echo "F-kit: $(grep -c 'simulado feito hoje — agora é só o kit' scripts/qa83-F.txt) (esperado 1 — badge do kit no dia)"

echo "=== FASE G: mock 30/09 (véspera) — D-2 verde por RUN, banner não acusa, kit default ==="
agent-browser eval "(() => { const MOCK = new Date(2026,8,30,20,0).getTime(); class FakeDate extends Date { constructor(...a){ a.length===0 ? super(MOCK) : super(...a); } static now(){ return MOCK; } } window.Date = FakeDate; return 'mocked-30set'; })()" 2>&1 | tail -1
REF_E2=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Estudar" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF_E2" > /dev/null 2>&1; sleep 1
REF_G2=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Visão Geral" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF_G2" > /dev/null 2>&1; sleep 1.5
$SNAP > scripts/qa83-G.txt 2>&1
echo "G-chip-prova-amanha: $(grep -c 'Amanhã · Prova Av1' scripts/qa83-G.txt) (esperado 1)"
echo "G-banner: $(grep -c 'Modo recuperação: 3 dia(s) do plano seguem pendentes' scripts/qa83-G.txt) (esperado 1)"
echo "G-sem-simulado-na-lista: $(grep -c 'SIMULADO — prova completa ficaram\|SIMULADO — prova completa ·' scripts/qa83-G.txt) (esperado 0)"
echo "G-cumprido: $(grep -c '3 já cumprido(s) ✓' scripts/qa83-G.txt) (esperado 1 — 7,5 + simulado via run)"
echo "G-kit-default: $(grep -c 'agora é só o kit, com calma' scripts/qa83-G.txt) (esperado 0 — kit só no próprio dia)"
echo "G-titulos-behind: $(grep -c 'Bloco 2 (Q17–30) · Lista de Lógica — Parte 1 (Q1–12) · Lista de Lógica — Parte 2' scripts/qa83-G.txt) (esperado 1 — [6,4,3])"

echo "=== FASE H: diálogo na véspera — D-2 com feito ✓, sem atrasado nele ==="
REF=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Abrir plano completo[^"]*" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF" > /dev/null 2>&1
sleep 1.5
$SNAP > scripts/qa83-H.txt 2>&1
echo "H-dialog: $(grep -c 'Plano até a prova' scripts/qa83-H.txt) (esperado 1)"
echo "H-feito: $(grep -c 'feito ✓' scripts/qa83-H.txt) (esperado 3 — D-7, D-5, D-2-via-run)"
echo "H-atrasado: $(grep -c 'atrasado' scripts/qa83-H.txt) (esperado 2 — D-6 e D-4)"
agent-browser press Escape > /dev/null 2>&1

echo "=== LIMPEZA + regresso à data real ==="
agent-browser eval "(() => { if (window.__v2backup === null || window.__v2backup === undefined) { localStorage.removeItem('hub-estudos-ifpb:v2'); } else { localStorage.setItem('hub-estudos-ifpb:v2', window.__v2backup); } localStorage.removeItem('hub:math-exam:v1:plan'); return 'limpo'; })()" 2>&1 | tail -1
agent-browser open "http://localhost:3000/?r=final" > /dev/null 2>&1
sleep 4
$SNAP > scripts/qa83-FINAL.txt 2>&1
echo "FINAL-faltam4: $(grep -c 'Faltam 4 dias' scripts/qa83-FINAL.txt) (esperado >=1)"
echo "FINAL-banner-honesto: $(grep -c 'Modo recuperação: 3 dia(s) do plano seguem pendentes' scripts/qa83-FINAL.txt) (esperado 1 — sem dados, pendentes de verdade)"
echo "FINAL-sem-feito-hoje: $(grep -c 'Simulado feito hoje' scripts/qa83-FINAL.txt) (esperado 0)"
echo "FINAL-console-erros: $(agent-browser console 2>&1 | grep -c '\[error\]') (esperado 0)"
echo "FINAL-v2: $(agent-browser eval "JSON.stringify({v2: !!localStorage.getItem('hub-estudos-ifpb:v2'), plan: localStorage.getItem('hub:math-exam:v1:plan')})" 2>&1 | tail -1)"

echo "=== FIM QA83 ==="
