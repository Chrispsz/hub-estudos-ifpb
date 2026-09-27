#!/bin/bash
# Task 97 — E2E do TUTOR SABE A SEMANA (examWeek no HubContext + badge visível
# no chat: D-N da prova, veredito do simulado quando feito). O badge é o output
# LIVE de buildHubContext — a mesma função que monta o payload do POST; o bloco
# server-side (buildHubBlock) é garantido pelo tsc. Sem chamada de LLM no QA.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t97.log 2>&1 &)
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
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked'})()" >/dev/null 2>&1
  sleep 1
}
# run oficial 29/09 com tópicos: Matrizes 5/5 + Lógica 2/5 = 70% (meta batida)
seed_run() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];for(var i=0;i<5;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'solved'});for(var j=0;j<2;j++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(var m=0;m<3;m++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'qa97-of',date:'2026-09-29T15:30:00',mode:'prova',total:10,solved:7,missed:3,skipped:0,durationSec:2400,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok'})()" >/dev/null 2>&1
  sleep 1
}
clean_run() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=(p.simuladoRuns||[]).filter(function(r){return r.id!=='qa97-of'});if(p.simuladoRuns.length===0)delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null | tr -d '"'
  sleep 1
}
open_chat() { # Estudar → botão 'Tirar dúvida com IA'
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Tirar dúvida com IA')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(has 'Tirar dúvida com IA')" = "1" ] && return 0
  done
  return 1
}

echo "=== [A] DATA REAL (D-4): badge do contexto no chat SEM simulado ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
if open_chat; then ok "chat aberto (Sheet)"; else bad "chat não abriu — abortar"; FAIL=1; fi
D4=$(has 'semana da Av1 · D-4'); NOSIM=$(has 'simulado 70%')
[ "$D4" = "1" ] && ok "badge: 'contexto: semana da Av1 · D-4'" || bad "badge D-4 ausente"
[ "$NOSIM" = "0" ] && ok "sem run → badge NÃO mostra simulado (não inventa)" || bad "badge mostra simulado sem run!"

echo "=== [B] RUN 70% (29/09) + poke: badge ganha o veredito ==="
seed_run
poke
sleep 1
B70=$(has '· simulado 70%')
[ "$B70" = "1" ] && ok "badge ao vivo: 'contexto: semana da Av1 · D-4 · simulado 70%'" || bad "badge não reagiu ao run (storage event)"

echo "=== [C] MOCK 30/09 (D-1, véspera): badge segue o relógio ==="
echo "  $(mock_date '2026-09-30T15:00:00')"; poke
sleep 1
D1=$(has 'semana da Av1 · D-1')
[ "$D1" = "1" ] && ok "badge na véspera: '· D-1' com o veredito" || bad "badge não mudou para D-1"

echo "=== [D] MOCK 01/10 (D-0): badge no dia da prova ==="
echo "  $(mock_date '2026-10-01T08:00:00')"; poke
sleep 1
D0=$(has 'semana da Av1 · D-0')
[ "$D0" = "1" ] && ok "badge no dia: '· D-0'" || bad "badge D-0 ausente"

echo "=== [E] MOBILE 390: badge sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'ovf='+(d.scrollWidth>d.clientWidth?1:0)})()" 2>/dev/null | tr -d '"')
echo "  $OVF"
case "$OVF" in *ovf=0*) ok "mobile 390: sem overflow horizontal";; *) bad "mobile 390 com overflow";; esac
agent-browser screenshot scripts/qa97-tutor-contexto.png >/dev/null 2>&1

echo "=== [F] HIGIENE: zero resíduo, data real, console limpo ==="
agent-browser set viewport 1440 900 >/dev/null 2>&1
H=$(clean_run)
echo "  storage: $H"
case "$H" in *runs=0*) ok "run qa97 removido";; *) bad "resíduo de run: $H";; esac
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)+' runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*) ok "storage limpo";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t97"; else echo ""; echo "FAILURES — t97"; exit 1; fi
