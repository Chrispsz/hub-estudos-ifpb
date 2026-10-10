#!/bin/bash
# Task 89 — QA de estado do 98bbffc (Task 88: fila lê o simulado oficial)
# Data real (dom 27/09, D-4): hero 'Faltam 4 dias', chip simulado 'em 2 dias', fila pointer D-4, badge prova 'em 4d'
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

# garante server vivo (reaper intermitente)
if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t89.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

echo "=== [A] DASHBOARD (data real, fresh open) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2

# hidratação viva (fiber presente = não é página de cache)
FIBER=$(agent-browser eval "(function(){var m=document.querySelector('main')||document.body;var k=Object.keys(m);for(var i=0;i<k.length;i++){if(k[i].startsWith('__reactFiber'))return 'fiber:true'}return 'fiber:MISSING'})()" 2>/dev/null | tr -d '"')
echo "hydration: $FIBER"
[ "$FIBER" = "fiber:true" ] || bad "página sem fiber (cache?) — abortar"

SNAP=$(agent-browser snapshot 2>/dev/null)

check() { # grep simplificado no snapshot
  if echo "$SNAP" | grep -qF "$1"; then ok "$2"; else bad "$2 — ausente: '$1'"; fi
}

check 'Faltam 4 dias'          'hero: contagem da prova (D-4)'
check 'Simulado da Av1 em 2 dias' 'hero: chip do simulado (janela ativa)'
check 'Prova de Matemática em 4d' 'card recovery: badge da prova'
check 'Plano da prova (D-4)'   'fila: pointer vivo do plano (Task 84/88 regressão)'

# fila NÃO pode falar 'feito' sem run (honestidade da 88)
if echo "$SNAP" | grep -qF 'feito hoje ✓'; then bad "fila fala 'feito hoje' SEM run — regressão da 88"; else ok "fila honesta: sem run não inventa resultado"; fi

echo "=== [B] HEADER fora do dashboard (Praticar) ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Praticar'){els[i].click();return 'clicou'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
SNAP2=$(agent-browser snapshot 2>/dev/null)
if echo "$SNAP2" | grep -qF 'Simulado em 2d'; then ok "header: chip do simulado 'Simulado em 2d'"; else bad "header: chip do simulado ausente"; fi
if echo "$SNAP2" | grep -qF '4d → Av1'; then ok "header: badge da prova '4d → Av1'"; else bad "header: badge da prova ausente"; fi

echo "=== [C] Console ==="
CONSOLE=$(agent-browser console 2>/dev/null | tail -30)
APPERR=$(echo "$CONSOLE" | grep -iE 'error' | grep -viE 'fast.refresh|hmr|dev|Download the React DevTools' | head -5)
if [ -z "$APPERR" ]; then ok "console: 0 erros de app"; else bad "console: $APPERR"; fi

echo "=== [D] Mobile 390 — overflow ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Painel'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 3
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'sw='+window.innerWidth+' iw='+d.clientWidth+' ovf='+(d.scrollWidth>d.clientWidth)})()" 2>/dev/null)
echo "  $OVF"
if echo "$OVF" | grep -qF 'ovf=false'; then ok "mobile 390: zero overflow"; else bad "mobile 390: OVERFLOW ($OVF)"; fi

agent-browser set viewport 1440 900 >/dev/null 2>&1
echo ""
if [ $FAIL -eq 0 ]; then echo "QA-ESTADO: ALL GREEN"; else echo "QA-ESTADO: FALHAS ACIMA"; fi
