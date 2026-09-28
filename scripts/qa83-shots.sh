#!/bin/bash
# QA Task 83 — parte 2: screenshots + mobile overflow (uma única invocação)
cd /home/z/my-project
echo "=== BOOT ==="
(setsid nohup bunx next dev -p 3000 > scripts/dev-server.log 2>&1 < /dev/null &)
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  [ "$code" = "200" ] && break; sleep 1
done
echo "server up (${i}s)"; curl -s -o /dev/null http://localhost:3000/; sleep 2

agent-browser open "http://localhost:3000/?r=shot" > /dev/null 2>&1; sleep 4
# estado C: D-7 e D-5 feitos, D-6 pendente → banner com crédito emerald
agent-browser eval "(() => { const v = JSON.stringify({'7-0':true,'7-1':true,'7-2':true,'5-0':true,'5-1':true,'5-2':true}); localStorage.setItem('hub:math-exam:v1:plan', v); window.dispatchEvent(new StorageEvent('storage',{key:'hub:math-exam:v1:plan',newValue:v})); return 'ok'; })()" > /dev/null 2>&1
sleep 1.5
agent-browser screenshot --path scripts/qa83-banner-honesto-dark.png > /dev/null 2>&1 || agent-browser screenshot scripts/qa83-banner-honesto-dark.png > /dev/null 2>&1
echo "shot1: $(ls -la scripts/qa83-banner-honesto-dark.png 2>/dev/null | awk '{print $5}') bytes"

REF=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Abrir plano completo[^"]*" \[ref=[a-z0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
agent-browser click "$REF" > /dev/null 2>&1; sleep 1.5
agent-browser screenshot scripts/qa83-dialog-estados-dark.png > /dev/null 2>&1
echo "shot2: $(ls -la scripts/qa83-dialog-estados-dark.png 2>/dev/null | awk '{print $5}') bytes"
agent-browser press Escape > /dev/null 2>&1; sleep 0.5

# light theme
agent-browser eval "(() => { document.documentElement.className = 'light'; localStorage.setItem('theme','light'); return 'light'; })()" > /dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa83-banner-honesto-light.png > /dev/null 2>&1
echo "shot3: $(ls -la scripts/qa83-banner-honesto-light.png 2>/dev/null | awk '{print $5}') bytes"

# mobile 390: banner novo não pode estourar
agent-browser set viewport 390 844 > /dev/null 2>&1; sleep 1
agent-browser eval "(() => { document.documentElement.className = 'dark'; localStorage.setItem('theme','dark'); return 'dark'; })()" > /dev/null 2>&1
sleep 1.5
M=$(agent-browser snapshot 2>/dev/null)
agent-browser eval "JSON.stringify({scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth})" 2>&1 | tail -1
agent-browser screenshot scripts/qa83-banner-mobile390.png > /dev/null 2>&1
echo "shot4: $(ls -la scripts/qa83-banner-mobile390.png 2>/dev/null | awk '{print $5}') bytes"

# limpeza
agent-browser eval "(() => { localStorage.removeItem('hub:math-exam:v1:plan'); return 'limpo'; })()" > /dev/null 2>&1
agent-browser set viewport 1440 900 > /dev/null 2>&1
agent-browser open "http://localhost:3000/?r=final2" > /dev/null 2>&1; sleep 3
echo "FINAL-faltam4: $(agent-browser snapshot 2>/dev/null | grep -c 'Faltam 4 dias')"
echo "FINAL-erros: $(agent-browser console 2>&1 | grep -c '\[error\]')"
echo "=== FIM ==="
