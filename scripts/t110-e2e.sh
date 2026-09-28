#!/bin/bash
# Task 110 — O MAPA SABE A SEMANA: o Mapa de consistência é a única
# superfície do app cujo TRABALHO é desenhar o calendário (18 semanas de
# dias reais) e era a única superfície de calendário cega à semana da Av1:
# 29/09 (ensaio) e 01/10 (prova) eram células tracejadas mudas idênticas a
# qualquer dia futuro. Este E2E verifica: [A] mock D-4 = marcos no mapa
# (células com anel da família + título real + chip do topo + legenda +
# aria); [B] D-3 = preparo é HOJE (anel amber, 'hoje' no título) e o kit da
# véspera segue de pé em casa; [C] D-0 = prova é HOJE (rose + brilho);
# [D] pós-prova = chip cala, anéis ficam como história; [E] mobile 390;
# [F] higiene zero + console 0. (117: [A] agora é MOCK-ancorado — a asserção
# 'Dom, 27 set' era data-real e apodrecia no dia seguinte; mock devolve o
# determinismo sem tocar nas asserções.)
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t110.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
clean_all_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.__poke;delete p.realGrades;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs=0'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
go_home() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
go_progress() { # (lição 102.1) 'Progresso' mora DENTRO do submenu 'Mais'
  local try=""
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    try=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
    sleep 2
    [ "$(has 'Mapa de consistência')" = "1" ] && return 0
  done
  return 1
}
cell_title() { # $1 = substring do title → title completo do primeiro match (ou '')
  agent-browser eval "(function(){var els=document.querySelectorAll('div[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('$1')>=0)return t}return ''})()" 2>/dev/null | tr -d '"'
}
cell_class() { # $1 = substring do title → className do primeiro match (ou '')
  agent-browser eval "(function(){var els=document.querySelectorAll('div[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('$1')>=0)return els[i].className}return ''})()" 2>/dev/null | tr -d '"'
}
chip_check() { # $1 = texto do chip âmbar do topo do mapa
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('border-amber-500/25')>=0&&els[i].textContent.indexOf('$1')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
aria_map() {
  agent-browser eval "(function(){var el=document.querySelector('div[role=\"img\"]');return el?el.getAttribute('aria-label'):''})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] MOCK D-4 (dom 27/09): marcos no mapa (ancorado no mock — 117) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
mock_date '2026-09-27T20:00:00' >/dev/null; poke
go_home; sleep 1
go_progress || bad "não chegou no Progresso"
sleep 1

CH_S=$(chip_check 'Simulado da Av1 29/09')
[ "$CH_S" = "1" ] && ok "chip do topo: 'Simulado da Av1 29/09'" || bad "chip do simulado ausente"
CH_P=$(chip_check 'Prova da Av1 01/10')
[ "$CH_P" = "1" ] && ok "chip do topo: 'Prova da Av1 01/10'" || bad "chip da prova ausente"

TP=$(cell_title 'Prova da Av1')
echo "$TP" | grep -q "boa prova" && ok "célula da prova tem título REAL (futuras mudas não escondem o evento)" || bad "título da prova ausente/mudo ($TP)"
TC=$(cell_class 'Prova da Av1')
echo "$TC" | grep -q "border-rose-500/50" && echo "$TC" | grep -q "ring-rose-500/35" && ok "célula futura da prova: tracejada rose + anel (família da casa)" || bad "classe da prova futura errada ($TC)"

TS=$(cell_class 'Simulado da Av1')
echo "$TS" | grep -q "border-amber-500/50" && echo "$TS" | grep -q "ring-amber-500/35" && ok "célula futura do simulado: tracejada amber + anel" || bad "classe do simulado futuro errada ($TS)"
[ -n "$(cell_title 'Véspera do simulado')" ] && ok "célula do preparo (28/09) datada no mapa" || bad "célula do preparo ausente"
[ -n "$(cell_title 'Véspera da prova')" ] && ok "célula da véspera (30/09) datada no mapa" || bad "célula da véspera ausente"

TT=$(cell_title 'Dom, 27 set')
TC2=$(cell_class 'Dom, 27 set')
echo "$TC2" | grep -q "ring-emerald-400/70" && echo "$TC2" | grep -q "bg-muted/40" && ok "HOJE ganha o anel esmeralda do agora (sem marco, nível 0)" || bad "anel do hoje ausente ou célula pintada ($TC2)"
echo "$TT" | grep -q "sem foco registrado" && ok "título do hoje segue honesto ('sem foco registrado')" || bad "título do hoje mudou ($TT)"

AR=$(aria_map)
echo "$AR" | grep -q "semana da Av1" && echo "$AR" | grep -q "Prova da Av1 01/10" && ok "aria-label nomeia a semana completa" || bad "aria sem a semana ($AR)"

[ "$(has '· marco:')" = "1" ] && [ "$(has 'ensaio')" = "1" ] && ok "legenda explica os marcos (ensaio / prova)" || bad "legenda dos marcos ausente"

FS=$(cell_title 'sex, 09 out')
[ -z "$FS" ] && ok "célula futura comum continua MUDA (só marcos falam)" || bad "célula futura comum ganhou título indevido ($FS)"

agent-browser eval "(function(){var hs=document.querySelectorAll('h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Mapa de consistência')>=0){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa110-mapa-av1-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa110-mapa-av1-desktop.png)" || bad "screenshot falhou"

echo "=== [B] MOCK D-3 (28/09): o preparo é HOJE — mapa e kit juntos ==="
mock_date '2026-09-28T20:00:00' >/dev/null; poke
go_home; sleep 1
go_progress || bad "remount do Progresso falhou"
sleep 1
TB=$(cell_title 'Véspera do simulado')
TCB=$(cell_class 'Véspera do simulado')
echo "$TB" | grep -q "• hoje" && ok "título do marco diz '• hoje' quando o dia chega" || bad "marco de hoje sem 'hoje' ($TB)"
echo "$TCB" | grep -q "ring-amber-500/70" && echo "$TCB" | grep -q "bg-amber-500/15" && ok "célula do preparo HOJE: anel amber cheio + tinta da espera" || bad "classe do preparo hoje errada ($TCB)"
echo "$TCB" | grep -q "ring-emerald" && bad "anel esmeralda vazou para a célula de marco" || ok "anel do agora cede ao anel do marco (sem briga de anéis)"
CH2=$(chip_check 'Prova da Av1 01/10')
[ "$CH2" = "1" ] && ok "chip segue no topo (a semana continua à frente)" || bad "chip sumiu no D-3"
go_home; sleep 1
KIT=$(has 'véspera do simulado — amanhã é o ensaio real')
[ "$KIT" = "1" ] && ok "regressão 109: kit da véspera de pé no D-3 (mesma voz, outra sala)" || bad "kit D-3 sumiu"

echo "=== [C] MOCK D-0 (01/10): a prova é HOJE — rose no dia ==="
mock_date '2026-10-01T09:00:00' >/dev/null; poke
go_home; sleep 1
go_progress || bad "remount do Progresso falhou"
sleep 1
TD=$(cell_title 'Prova da Av1')
TCD=$(cell_class 'Prova da Av1')
echo "$TD" | grep -q "• hoje" && ok "prova hoje: título diz '• hoje'" || bad "título da prova sem 'hoje' ($TD)"
echo "$TCD" | grep -q "ring-rose-500/70" && echo "$TCD" | grep -q "shadow-\[" && ok "célula da prova HOJE: anel rose cheio + brilho (a família do dia)" || bad "classe da prova hoje errada ($TCD)"

echo "=== [D] PÓS-PROVA (05/10): o chip cala, a história fica ==="
mock_date '2026-10-05T10:00:00' >/dev/null; poke
go_home; sleep 1
go_progress || bad "remount do Progresso falhou"
sleep 1
CH3=$(chip_check 'Prova da Av1 01/10')
[ "$CH3" = "0" ] && ok "chip do topo CALA depois da prova (semana saiu do relógio)" || bad "chip ainda grita semana passada"
TP2=$(cell_class 'Prova da Av1')
echo "$TP2" | grep -q "ring-rose-500/70" && ok "anel da prova fica no mapa como HISTÓRIA (nada é apagado)" || bad "anel histórico sumiu"
[ "$(has '· marco:')" = "1" ] && ok "legenda segue explicando os anéis do histórico" || bad "legenda sumiu"

echo "=== [E] MOBILE 390: mapa com marcos sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var hs=document.querySelectorAll('h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Mapa de consistência')>=0){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa110-mapa-av1-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa110-mapa-av1-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

echo "=== [F] HIGIENE + CONSOLE (reload mata o mock) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
H=$(clean_all_runs)
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RUNS"
echo "$H" >/dev/null 2>&1
[ "$RUNS" = "runs=0 poke=0 realGrades=0" ] && ok "storage limpo (runs/poke/realGrades)" || bad "resíduo no storage: $RUNS"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t110 o mapa sabe a semana (o calendário do app enxerga a Av1)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
