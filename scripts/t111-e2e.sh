#!/bin/bash
# Task 111 — AS CONQUISTAS SABEM A SEMANA: as 10 conquistas mediam só a
# ROTINA (foco/streak/materiais) e as três ações que decidem a nota — rodar
# o ensaio oficial, treinar o bloco fraco, bater a meta — não rendiam
# NADA. Este E2E verifica: [A] data real = 3 novas cartas TRAVADAS e
# honestas (recibo, não promessa); [B] ensaio 70%+ drill depois = 3/13;
# [C] drill ANTES do oficial = promessa NÃO cumpre (ordem do tempo, 107);
# [D] ensaio 40% + drill 20% = Ensaio ✓ Meta ✗ Promessa ✓ (a revisão
# aconteceu — o recibo não é a nota); [E] véspera D-3 não inventa nada;
# [F] mobile 390; [G] higiene zero + console 0.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t111.log 2>&1 &)
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
seed_prova() { # $1=id · $2=date ISO · $3=mat solved · $4=mat missed · $5=log solved · $6=log missed
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];var i;for(i=0;i<$3;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'solved'});for(i=0;i<$4;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'missed'});for(i=0;i<$5;i++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(i=0;i<$6;i++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'$1',date:'$2',mode:'prova',total:qs.length,solved:($3+$5),missed:($4+$6),skipped:0,durationSec:3600,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
}
seed_drill() { # $1=id · $2=date ISO · $3=solved · $4=missed · $5=tópico
  local topic="${5:-Álgebra Matricial}"
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var topic='$topic';var qs=[];var i;for(i=0;i<$3;i++)qs.push({disciplineCode:'TEC.1984',topic:topic,status:'solved'});for(i=0;i<$4;i++)qs.push({disciplineCode:'TEC.1984',topic:topic,status:'missed'});p.simuladoRuns.push({id:'$1',date:'$2',mode:'topico',total:qs.length,solved:$3,missed:$4,skipped:0,durationSec:900,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
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
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(has 'Mapa de consistência')" = "1" ] && return 0
  done
  return 1
}
ach() { # $1=label · $2=description → unlocked/locked/absent (o title muda de dono)
  agent-browser eval "(function(){var els=document.querySelectorAll('div[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('$1')>=0||t.indexOf('$2')>=0){return t.indexOf('desbloqueada')>=0?'unlocked':'locked'}}return 'absent'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] DATA REAL (dom 27/09, D-4, storage limpo): três cartas honestas ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
clean_all_runs >/dev/null 2>&1; poke
go_progress || bad "não chegou no Progresso"
sleep 1
[ "$(has '0/13 desbloqueadas')" = "1" ] && ok "contador honesto: 0/13" || bad "contador errado"
[ "$(has 'Semana da Av1')" = "1" ] && ok "divisor 'Semana da Av1' presente na fileira própria" || bad "divisor ausente"
S1=$(ach 'Ensaio real' 'Rode o simulado oficial')
[ "$S1" = "locked" ] && ok "'Ensaio real' travada (recibo, não promessa)" || bad "ensaio-real: $S1"
S2=$(ach 'A revisão de amanhã' 'treine o bloco fraco')
[ "$S2" = "locked" ] && ok "'A revisão de amanhã' travada" || bad "promessa: $S2"
S3=$(ach 'Meta da Av1' 'Bata 70%')
[ "$S3" = "locked" ] && ok "'Meta da Av1' travada" || bad "meta: $S3"

echo "=== [B] ENSAIO 80% + drill DEPOIS: as três cumprem (3/13) ==="
seed_prova 'qa111-a' '2026-09-29T15:30:00' 5 2 3 0 >/dev/null
seed_drill 'qa111-d' '2026-09-29T19:00:00' 4 1 'Álgebra Matricial' >/dev/null
poke
sleep 1
B1=$(ach 'Ensaio real' 'Rode o simulado oficial')
[ "$B1" = "unlocked" ] && ok "'Ensaio real' desbloqueada (run oficial registrado)" || bad "ensaio-real: $B1"
B2=$(ach 'Meta da Av1' 'Bata 70%')
[ "$B2" = "unlocked" ] && ok "'Meta da Av1' desbloqueada (80% ≥ 70)" || bad "meta: $B2"
B3=$(ach 'A revisão de amanhã' 'treine o bloco fraco')
[ "$B3" = "unlocked" ] && ok "'A revisão de amanhã' desbloqueada (drill depois, 80% > 71%)" || bad "promessa: $B3"
[ "$(has '3/13 desbloqueadas')" = "1" ] && ok "contador: 3/13" || bad "contador não virou 3/13"

echo "=== [C] ORDEM DO TEMPO: drill ANTES do oficial NÃO cumpre a promessa ==="
clean_all_runs >/dev/null 2>&1
seed_drill 'qa111-pre' '2026-09-28T20:00:00' 4 1 'Álgebra Matricial' >/dev/null
seed_prova 'qa111-a' '2026-09-29T15:30:00' 5 2 3 0 >/dev/null
poke
sleep 1
C1=$(ach 'A revisão de amanhã' 'treine o bloco fraco')
[ "$C1" = "locked" ] && ok "drill antes = promessa NÃO desbloqueada (preparo, não revisão)" || bad "ordem do tempo violada: $C1"
C2=$(ach 'Ensaio real' 'Rode o simulado oficial')
[ "$C2" = "unlocked" ] && ok "ensaio segue desbloqueado (o run existe)" || bad "ensaio: $C2"
[ "$(has '2/13 desbloqueadas')" = "1" ] && ok "contador: 2/13 (a mesma regra da 107 em outra sala)" || bad "contador errado no C"

echo "=== [D] RECIBO HONESTO: ensaio 40% + drill 20% = revisão aconteceu ==="
clean_all_runs >/dev/null 2>&1
seed_prova 'qa111-b' '2026-09-29T15:30:00' 2 3 2 3 >/dev/null
seed_drill 'qa111-ruim' '2026-09-29T19:00:00' 1 4 'Álgebra Matricial' >/dev/null
poke
sleep 1
D1=$(ach 'Ensaio real' 'Rode o simulado oficial')
[ "$D1" = "unlocked" ] && ok "ensaio feito = desbloqueada (40% também é recibo)" || bad "ensaio: $D1"
D2=$(ach 'Meta da Av1' 'Bata 70%')
[ "$D2" = "locked" ] && ok "meta 40% NÃO desbloqueada (20% não se comemora)" || bad "meta liberada indevidamente: $D2"
D3=$(ach 'A revisão de amanhã' 'treine o bloco fraco')
[ "$D3" = "unlocked" ] && ok "promessa desbloqueada: a REVISÃO aconteceu (o recibo não é a nota)" || bad "recibo honesto falhou: $D3"

echo "=== [E] VÉSPERA D-3 NÃO INVENTA: sem run, 0/13 mesmo na véspera ==="
clean_all_runs >/dev/null 2>&1
mock_date '2026-09-28T20:00:00' >/dev/null; poke
go_home; sleep 1
go_progress || bad "remount do Progresso falhou"
sleep 1
[ "$(has '0/13 desbloqueadas')" = "1" ] && ok "véspera sem run = 0/13 (a conquista espera o trabalho real)" || bad "véspera inventou conquista"
E1=$(ach 'Ensaio real' 'Rode o simulado oficial')
[ "$E1" = "locked" ] && ok "cartas seguem travadas na véspera" || bad "carta aberta na véspera: $E1"

echo "=== [F] MOBILE 390: conquistas com fileira da Av1 sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var hs=document.querySelectorAll('h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Conquistas')>=0){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa111-conquistas-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa111-conquistas-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

echo "=== [G] HIGIENE + CONSOLE (reload mata o mock) ==="
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
  echo "ALL GREEN — t111 as conquistas sabem a semana (a reta final rende recibo)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
