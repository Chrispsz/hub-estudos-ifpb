#!/bin/bash
# QA Task 84 — "a fila fala o dia" (recovery-card vivo) — server + fases numa invocação
cd /home/z/my-project
SNAP="agent-browser snapshot"
echo "=== BOOT (se preciso) ==="
code=$(curl -s -o /dev/null -w "%{http_code}" -m 3 http://localhost:3000 2>/dev/null)
if [ "$code" != "200" ]; then
  (setsid nohup bunx next dev -p 3000 > scripts/dev-server.log 2>&1 < /dev/null &)
  for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
    [ "$code" = "200" ] && break; sleep 1
  done
fi
echo "dev up (${code})"; curl -s -o /dev/null http://localhost:3000/; sleep 2

echo "=== FASE A: data real — fila de hoje VIVA ==="
agent-browser open "http://localhost:3000/?r=t84A" > /dev/null 2>&1; sleep 4
$SNAP > scripts/t84-A.txt 2>&1
echo "A-plano-dia: $(grep -c 'Plano da prova (D-4): Lista de Lógica — Parte 1 (Q1–12)' scripts/t84-A.txt) (esperado 1 — o MESMO dia do card da prova)"
echo "A-sem-HOJE-stale: $(grep -c 'HOJE — Lista de Matrizes' scripts/t84-A.txt) (esperado 0)"
echo "A-alg: $(grep -c 'Fazer as 10 questões da Semana 2 no Praticar' scripts/t84-A.txt) (esperado >=1)"
echo "A-lm: $(grep -c 'PROJETO 1ª etapa: com a equipe' scripts/t84-A.txt) (esperado >=1)"
echo "A-calculadora-btn-ausente: $(grep -c 'calculadora' scripts/t84-A.txt) (esperado 0 — só pós-prova)"

echo "=== FASE B: trilha mat expandida — resumo vivo sem 'Faltam 7 dias' ==="
REF=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Matemática — Prova 01/10 \(Av1\)" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
if [ -z "$REF" ]; then REF=$(agent-browser snapshot 2>/dev/null | grep -B1 'Matemática — Prova 01/10' | grep -oE 'e[0-9]+' | head -1); fi
agent-browser click "$REF" > /dev/null 2>&1; sleep 1
$SNAP > scripts/t84-B.txt 2>&1
echo "B-resumo-vivo: $(grep -c 'faltam 4 dia(s). O dia a dia (D-4) vive no card da prova' scripts/t84-B.txt) (esperado 1)"
echo "B-sem-faltam7: $(grep -c 'Faltam 7 dias' scripts/t84-B.txt) (esperado 0)"
echo "B-acao-datada: $(grep -c '24/09 — Lista de Matrizes, Bloco 1' scripts/t84-B.txt) (esperado 1 — data honesta)"
agent-browser press Escape > /dev/null 2>&1

echo "=== FASE C: seed done alg+lm → fila encolhe para [mat] ==="
agent-browser eval "(() => { const v = JSON.stringify({'alg-s2':true,'alg-s3':true,'alg-lista-q1-97':true,'alg-bug':true,'lm-proj-proposta':true,'lm-meta':true,'lm-form':true}); localStorage.setItem('hub:recovery:v1:done', v); window.dispatchEvent(new StorageEvent('storage',{key:'hub:recovery:v1:done',newValue:v})); return 'ok'; })()" 2>&1 | tail -1
sleep 1.5
$SNAP > scripts/t84-C.txt 2>&1
echo "C-sem-alg: $(grep -c 'Fazer as 10 questões da Semana 2' scripts/t84-C.txt) (esperado 0 — feitas saem)"
echo "C-sem-lm: $(grep -c 'PROJETO 1ª etapa: com a equipe' scripts/t84-C.txt) (esperado 0)"
echo "C-mat-fica: $(grep -c 'Plano da prova (D-4)' scripts/t84-C.txt) (esperado 1)"

echo "=== FASE D: mock 02/10 pós-prova — mat 'Feito' + item Calculadora ==="
agent-browser eval "(() => { const MOCK = new Date(2026,9,2,15,0).getTime(); class FakeDate extends Date { constructor(...a){ a.length===0 ? super(MOCK) : super(...a); } static now(){ return MOCK; } } window.Date = FakeDate; return 'mocked-02out'; })()" 2>&1 | tail -1
REF_E=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Estudar" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF_E" > /dev/null 2>&1; sleep 1
REF_G=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Visão Geral" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF_G" > /dev/null 2>&1; sleep 2
$SNAP > scripts/t84-D.txt 2>&1
echo "D-badge-feito: $(grep -c 'Prova de Matemática realizada — falta a nota' scripts/t84-D.txt) (esperado >=1 — header badge pré-existente)"
echo "D-item-calculadora: $(grep -c 'Anotar a nota da Av1 na Calculadora' scripts/t84-D.txt) (esperado 1)"
echo "D-btn-calculadora: $(grep -c 'calculadora' scripts/t84-D.txt) (esperado >=1)"
echo "D-sem-plano: $(grep -c 'Plano da prova (D-' scripts/t84-D.txt) (esperado 0)"
echo "D-sem-em-Nd: $(grep -c 'em -[0-9]d' scripts/t84-D.txt) (esperado 0 — herança 76/80)"

echo "=== FASE E: tick calculadora → fila vazia = estado emerald ==="
REF2=$(agent-browser snapshot 2>/dev/null | grep -oE 'checkbox "Marcar \\"Anotar a nota[^"]*" como feito" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF2" > /dev/null 2>&1; sleep 1.5
$SNAP > scripts/t84-E.txt 2>&1
echo "E-empty-state: $(grep -c 'Todas as prioridades de hoje concluídas' scripts/t84-E.txt) (esperado 1)"
echo "E-badge-feito-trilha: $(grep -cE 'P0' scripts/t84-E.txt) (esperado >=1 — trilha segue na fila)"

echo "=== FASE F: regresso à data real + limpeza ==="
agent-browser eval "(() => { localStorage.removeItem('hub:recovery:v1:done'); return 'limpo'; })()" > /dev/null 2>&1
agent-browser open "http://localhost:3000/?r=t84F" > /dev/null 2>&1; sleep 4
$SNAP > scripts/t84-F.txt 2>&1
echo "F-faltam4: $(grep -c 'Faltam 4 dias' scripts/t84-F.txt) (esperado >=1)"
echo "F-plano-dia-volta: $(grep -c 'Plano da prova (D-4)' scripts/t84-F.txt) (esperado 1)"
echo "F-sem-empty: $(grep -c 'Todas as prioridades de hoje concluídas' scripts/t84-F.txt) (esperado 0)"
echo "F-console-erros: $(agent-browser console --clear > /dev/null 2>&1; sleep 1; agent-browser console 2>&1 | grep -c '\[error\]') (esperado 0)"
echo "F-storage: $(agent-browser eval "localStorage.getItem('hub:recovery:v1:done')" 2>&1 | tail -1) (esperado null/'{}')"

echo "=== mobile 390 ==="
agent-browser set viewport 390 844 > /dev/null 2>&1; sleep 1.5
agent-browser eval "JSON.stringify({scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth})" 2>&1 | tail -1
agent-browser screenshot scripts/t84-fila-mobile390.png > /dev/null 2>&1
agent-browser set viewport 1440 900 > /dev/null 2>&1
echo "=== FIM T84 ==="
