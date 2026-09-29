#!/bin/bash
# Task 117 — O MAPA GANHA PORTAS: o mapa da 110 sabia a semana mas não
# RESPONDIA — o marco era só tinta (tooltip), o aluno via 'Simulado da Av1
# 29/09' e não tinha o que clicar. A fila 'A semana em ações' dá a cada marco
# a porta que JÁ existe no app (zero caminho novo): preparo → Método com o
# tema do dia, simulado → Simulado Pro com o preset da Av1, véspera → Folha
# de Revisão, prova → tutor com a pergunta do kit. A fila mora FORA do
# role="img" (a grade continua imagem para AT) e os marcos PASSADOS fecham a
# porta (a história não tem ação). Este E2E (TODO mock-ancorado — zero data
# real, lição da rotinação de datas do t110): [A] D-3 = 4 portas na fila +
# HOJE sólido+pulso + cores da família + as TRÊS portas abrem de verdade
# (Simulado Pro / tutor preenchido / Método com tema); [B] D-1 (30/09) =
# portas fecham com o dia (2 restantes, véspera vira HOJE); [C] pós-prova
# (02/10) = fila INTEIRA some (chip cala junto — regressão 110); [D] folha
# 200; [E] mobile 390; [F] higiene zero + console 0.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t117.log 2>&1 &)
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
door_class() { # $1 = substring do texto do chip → className (ou '')
  agent-browser eval "(function(){var els=document.querySelectorAll('button[title]');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'');if(t.indexOf('$1')>=0&&els[i].getAttribute('title').indexOf('abre')>=0)return els[i].className}return ''})()" 2>/dev/null | tr -d '"'
}
door_pulse() { # $1 = substring do texto do chip → 1 se o ÍCONE pulsa (o pulso mora no filho, não no botão)
  agent-browser eval "(function(){var els=document.querySelectorAll('button[title]');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'');if(t.indexOf('$1')>=0&&els[i].getAttribute('title').indexOf('abre')>=0)return (els[i].innerHTML.indexOf('animate-pulse')>=0?1:0)}return 0})()" 2>/dev/null | tr -d '"'
}
door_click() { # $1 = substring do texto do chip → clica (ou 'NAO')
  agent-browser eval "(function(){var els=document.querySelectorAll('button[title]');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'');if(t.indexOf('$1')>=0&&els[i].getAttribute('title').indexOf('abre')>=0){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
door_count() { # nº de portas abertas na fila
  agent-browser eval "(function(){var n=0;var els=document.querySelectorAll('button[title]');for(var i=0;i<els.length;i++){if(els[i].getAttribute('title').indexOf('abre')>=0)n++}return n})()" 2>/dev/null | tr -d '"'
}
input_values() { # soma dos values de inputs+textareas (para o pré-fill)
  agent-browser eval "(function(){var s='';var els=document.querySelectorAll('input,textarea');for(var i=0;i<els.length;i++){s+=' '+(els[i].value||'')}return s})()" 2>/dev/null | tr -d '"'
}
chip_check() { # $1 = texto do chip âmbar do topo do mapa (regressão 110)
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('border-amber-500/25')>=0&&els[i].textContent.indexOf('$1')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
scroll_map() {
  agent-browser eval "(function(){var hs=document.querySelectorAll('h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Mapa de consistência')>=0){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [A] MOCK D-3 (28/09): 4 portas, HOJE sólido, as portas abrem ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
mock_date '2026-09-28T20:00:00' >/dev/null; poke
go_progress || bad "não chegou no Progresso"
sleep 1

[ "$(has 'A semana em ações')" = "1" ] && ok "fila 'A semana em ações' existe" || bad "fila das portas ausente"

N=$(door_count)
[ "$N" = "4" ] && ok "4 portas abertas (preparo hoje + simulado + véspera + prova)" || bad "contagem de portas errada ($N)"

CP=$(door_class 'abrir no Método')
echo "$CP" | grep -q "text-amber-950" && [ "$(door_pulse 'abrir no Método')" = "1" ] && ok "porta do preparo (HOJE): sólido amber + pulso no ícone (a gramática do 'é hoje')" || bad "porta de hoje sem sólido/pulso ($CP)"
echo "$CP" | grep -q "border-amber-500/30" && bad "porta de hoje vazou para o estilo de espera" || ok "HOJE não usa a tinta translúcida da espera"

CS=$(door_class 'iniciar o simulado')
echo "$CS" | grep -q "border-amber-500/30" && echo "$CS" | grep -q "bg-amber-500/10" && ok "porta do simulado: família amber na espera" || bad "classe da porta do simulado errada ($CS)"
CV=$(door_class 'abrir a folha')
echo "$CV" | grep -q "border-amber-500/30" && ok "porta da véspera: família amber na espera" || bad "classe da porta da véspera errada ($CV)"
CT=$(door_class 'kit com o tutor')
echo "$CT" | grep -q "border-rose-500/35" && echo "$CT" | grep -q "bg-rose-500/10" && ok "porta da prova: família rose (o dia é outro)" || bad "classe da porta da prova errada ($CT)"

AR=$(agent-browser eval "(function(){var els=document.querySelectorAll('button[title]');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'');if(t.indexOf('Simulado da Av1')>=0&&els[i].getAttribute('title').indexOf('abre')>=0)return els[i].getAttribute('aria-label')}return ''})()" 2>/dev/null | tr -d '"')
echo "$AR" | grep -q "abre o Simulado Pro" && echo "$AR" | grep -q "29/09" && ok "aria-label da porta nomeia a ação e a data" || bad "aria da porta incompleta ($AR)"

DC=$(door_click 'iniciar o simulado')
sleep 3
[ "$DC" = "ok" ] && [ "$(has 'Simulado Pro')" = "1" ] && ok "PORTA DO SIMULADO ABRE: Simulado Pro com o preset da Av1 na tela" || bad "porta do simulado não abriu ($DC)"

go_progress || bad "volta ao Progresso falhou"
sleep 1
DC2=$(door_click 'kit com o tutor')
sleep 3
IV=$(input_values)
echo "$IV" | grep -q "kit do dia" && ok "PORTA DA PROVA ABRE: tutor recebe a pergunta do kit pronta no campo" || bad "porta da prova não preencheu o tutor ($IV)"

go_progress || bad "volta ao Progresso (2) falhou"
sleep 1
DC3=$(door_click 'abrir no Método')
sleep 3
IV2=$(input_values)
echo "$IV2" | grep -q "Véspera do simulado" && ok "PORTA DO PREPARO ABRE: Método com o tema do dia preenchido" || bad "porta do método não preencheu o tema ($IV2)"

scroll_map
agent-browser screenshot scripts/qa117-portas-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa117-portas-desktop.png)" || bad "screenshot falhou"

echo "=== [B] MOCK D-1 (30/09): portas fecham com o dia ==="
go_home; sleep 1
mock_date '2026-09-30T09:00:00' >/dev/null; poke
go_progress || bad "remount do Progresso (B) falhou"
sleep 1
N2=$(door_count)
[ "$N2" = "2" ] && ok "só 2 portas restantes (véspera HOJE + prova)" || bad "contagem no D-1 errada ($N2)"
[ "$(has 'iniciar o simulado')" = "0" ] && [ "$(has 'abrir no Método')" = "0" ] && ok "portas do preparo e do simulado FECHARAM (o dia passou, a história não tem ação)" || bad "porta de dia passado ainda aberta"
[ "$(has 'abrir a folha')" = "1" ] && ok "porta da véspera presente (é o dia dela)" || bad "porta da véspera sumiu no próprio dia"
CV2=$(door_class 'abrir a folha')
echo "$CV2" | grep -q "text-amber-950" && [ "$(door_pulse 'abrir a folha')" = "1" ] && ok "véspera vira HOJE: sólido + pulso" || bad "véspera hoje sem sólido ($CV2)"

echo "=== [C] PÓS-PROVA (02/10): a fila INTEIRA some ==="
go_home; sleep 1
mock_date '2026-10-02T10:00:00' >/dev/null; poke
go_progress || bad "remount do Progresso (C) falhou"
sleep 1
[ "$(has 'A semana em ações')" = "0" ] && ok "fila das portas some depois da prova (nada a abrir no passado)" || bad "fila viva depois da prova"
N3=$(door_count)
[ "$N3" = "0" ] && ok "zero portas no pós-prova" || bad "$N3 portas sobreviveram"
CH=$(chip_check 'Prova da Av1 01/10')
[ "$CH" = "0" ] && ok "regressão 110: chip do topo cala junto" || bad "chip do topo gritando no pós-prova"

echo "=== [D] A FOLHA (destino da porta da véspera) responde 200 ==="
FOLHA=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/folha-revisao)
[ "$FOLHA" = "200" ] && ok "rota /folha-revisao 200 (a porta abre para um destino real)" || bad "folha $FOLHA"

echo "=== [E] MOBILE 390: a fila empilha sem overflow ==="
go_home; sleep 1
mock_date '2026-09-28T20:00:00' >/dev/null; poke
go_progress || bad "remount do Progresso (E) falhou"
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
scroll_map
agent-browser screenshot scripts/qa117-portas-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa117-portas-mobile390.png)" || bad "screenshot falhou"
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
  echo "ALL GREEN — t117 o mapa ganha portas (um clique por marco da semana)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
