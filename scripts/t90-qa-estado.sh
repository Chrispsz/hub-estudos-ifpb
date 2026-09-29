#!/bin/bash
# Task 90 — QA de estado do 430f18c (Task 89: agenda fala a semana da Av1)
# Data real (dom 27/09, D-4): hero 'Faltam 4 dias', chip simulado 'em 2 dias',
# agenda: resumo '3 marcos' + strips tinted de ter/qua/qui, fila pointer D-4, badge 'em 4d'
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

# garante server vivo (reaper intermitente)
if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t90.log 2>&1 &)
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

FIBER=$(agent-browser eval "(function(){var m=document.querySelector('main')||document.body;var k=Object.keys(m);for(var i=0;i<k.length;i++){if(k[i].startsWith('__reactFiber'))return 'fiber:true'}return 'fiber:MISSING'})()" 2>/dev/null | tr -d '"')
echo "hydration: $FIBER"
[ "$FIBER" = "fiber:true" ] || bad "página sem fiber (cache?) — abortar"

SNAP=$(agent-browser snapshot 2>/dev/null)

check() {
  if echo "$SNAP" | grep -qF "$1"; then ok "$2"; else bad "$2 — ausente: '$1'"; fi
}

check 'Faltam 4 dias'             'hero: contagem da prova (D-4)'
check 'Simulado da Av1 em 2 dias' 'hero: chip do simulado (regressão 85)'
check 'Prova de Matemática em 4d' 'card recovery: badge da prova'
check 'Plano da prova (D-4)'      'fila: pointer vivo do plano (regressão 84/88)'
check '3 marcos da Av1'           'agenda no dashboard? (resumo da semana — se visível)'

if echo "$SNAP" | grep -qF 'feito hoje ✓'; then bad "fila fala 'feito hoje' SEM run — regressão da 88"; else ok "fila honesta: sem run não inventa resultado"; fi

echo "=== [B] AGENDA (Estudar -> Cronograma) ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Cronograma'){els[i].click();return 'direct'}}for(var j=0;j<els.length;j++){if(els[j].textContent.trim()==='Mais'){els[j].click();return 'mais'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Cronograma'){els[i].click();return 'clicked'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
ON_AG=$(agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return 'on-agenda='+(t.indexOf('Cronograma inteligente')>=0?'yes':'no')})()" 2>/dev/null)
echo "  $ON_AG"
SNAP3=$(agent-browser snapshot 2>/dev/null)
check3() {
  if echo "$SNAP3" | grep -qF "$1"; then ok "$2"; else bad "$2 — ausente: '$1'"; fi
}
check3 '3 marcos da Av1 — simulado em 2 dias' 'resumo da semana: 4ª estatística com marco mais próximo'
check3 'Simulado da Av1'                      'strip do simulado (ter 29/09)'
check3 'Véspera da prova'                     'strip da véspera (qua 30/09)'
check3 'Prova da Av1'                         'strip da prova (qui 01/10)'
check3 'em 2 dias'                            'chip do simulado (D-2 a partir de dom)'
check3 'Boa prova!'                           'dica da prova no strip futuro'
if echo "$SNAP3" | grep -qF 'É hoje'; then bad "agenda mostra 'É hoje' no domingo (não é hoje)"; else ok "agenda honesta: nenhum strip sólido fora do dia"; fi

echo "=== [C] HEADER fora do dashboard (Praticar) ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Praticar'){els[i].click();return 'clicou'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
SNAP2=$(agent-browser snapshot 2>/dev/null)
if echo "$SNAP2" | grep -qF 'Simulado em 2d'; then ok "header: chip do simulado 'Simulado em 2d'"; else bad "header: chip do simulado ausente"; fi
if echo "$SNAP2" | grep -qF '4d → Av1'; then ok "header: badge da prova '4d → Av1'"; else bad "header: badge da prova ausente"; fi

echo "=== [D] Console ==="
CONSOLE=$(agent-browser console 2>/dev/null | tail -30)
APPERR=$(echo "$CONSOLE" | grep -iE 'error' | grep -viE 'fast.refresh|hmr|dev|Download the React DevTools' | head -5)
if [ -z "$APPERR" ]; then ok "console: 0 erros de app"; else bad "console: $APPERR"; fi

echo "=== [E] Mobile 390 — overflow (dashboard) ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Visão Geral'||els[i].textContent.trim()==='Painel'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 3
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'sw='+window.innerWidth+' iw='+d.clientWidth+' ovf='+(d.scrollWidth>d.clientWidth)})()" 2>/dev/null)
echo "  $OVF"
if echo "$OVF" | grep -qF 'ovf=false'; then ok "mobile 390: zero overflow"; else bad "mobile 390: OVERFLOW ($OVF)"; fi

agent-browser set viewport 1440 900 >/dev/null 2>&1
echo ""
if [ $FAIL -eq 0 ]; then echo "QA-ESTADO: ALL GREEN"; else echo "QA-ESTADO: FALHAS ACIMA"; fi
