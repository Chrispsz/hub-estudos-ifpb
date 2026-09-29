#!/bin/bash
# Task 107 — A ORDEM DO TEMPO MANDA: o recibo da 106 tinha uma mentira
# latente — um drill ANTES do simulado (ex.: o aluno treinou Matrizes na
# segunda e o simulado de terça ainda mostrou 40%) continuava ganhando
# recibo 'subiu de 40% para 80%', com o 80% tendo VINDO ANTES do 40%: a
# ordem dos fatos invertida. A promessa do plano é "o bloco com mais erros
# vira a revisão de AMANHÃ" — treino antes do diagnóstico é PREPARO, não
# revisão cumprida. Este E2E verifica: [B] drill antes do oficial = recibo
# AUSENTE (badge/CTA ficam no estado da promessa); [C] drill depois = recibo
# aparece (regressão da 106 com a nova regra); [D] o HISTÓRICO conta a
# mesma história com a mesma fonte — badge 'Treino: Matrizes' (o tópico
# agora tem nome) e chip 'subiu de 40%' só no drill DEPOIS do oficial;
# [E] treino de tópico FORA do escopo ganha nome no badge mas nunca delta;
# [F] D-2 com drill no mesmo dia (17:00 > 15:30) segue cumprindo.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t107.log 2>&1 &)
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
badge_tone() {
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0&&els[i].textContent.length<140)return 1}return 0})()" 2>/dev/null | tr -d '"'
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
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs=0'})()" 2>/dev/null | tr -d '"'
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
    [ "$(has 'Relatório semanal')" = "1" ] && return 0
  done
  return 1
}

echo "=== [A] FORA DA JANELA (mock 20/09, D-11): sanity — poda da 120 (lição 117: asserção de data real é bomba-relógio de 24h; o UTC virou 28/09 = D-3 e a fase original explodiu) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 1
echo "  $(mock_date '2026-09-20T20:00:00')"; poke
sleep 1
KIT=$(has 'Kit da véspera')
[ "$KIT" = "0" ] && ok "mock 20/09 (fora da janela): kit ausente" || bad "kit presente fora da janela"

echo "=== [B] A CORREÇÃO DA ORDEM: drill ANTES do oficial NÃO cumpre a promessa ==="
echo "  $(mock_date '2026-09-30T15:00:00')"; poke
SP=$(seed_prova 'qa107-a' '2026-09-29T15:30:00' 2 3 4 1)
poke
[ "$SP" = "ok n=10" ] && ok "oficial semeado (29/09 15:30): Matrizes 40% · Lógica 80%" || bad "seed do oficial falhou"
SD=$(seed_drill 'qa107-antes' '2026-09-28T20:00:00' 4 1)
poke
[ "$SD" = "ok n=5" ] && ok "drill ANTERIOR semeado (28/09 20:00): Matrizes 4/5 (80%)" || bad "seed do drill-antes falhou"
NOREC=$(has 'no drill')
[ "$NOREC" = "0" ] && ok "recibo AUSENTE (treino antes do diagnóstico é preparo, não revisão)" || bad "recibo apareceu com o tempo invertido"
BB=$(badge_tone '40% no bloco' 'border-amber-500/50')
[ "$BB" = "1" ] && ok "badge segue no diagnóstico real: '40% no bloco' amber" || bad "badge do bloco sumiu (bb=$BB)"
CTA=$(has 'Treinar Matrizes')
CTA2=$(has 'Treinar de novo')
[ "$CTA" = "1" ] && [ "$CTA2" = "0" ] && ok "CTA fica na promessa: 'Treinar Matrizes' (não 'de novo')" || bad "CTA no estado errado (cta=$CTA denovo=$CTA2)"

echo "=== [C] O DRILL DEPOIS do oficial cumpre (regressão da 106 com a regra nova) ==="
SD2=$(seed_drill 'qa107-depois' '2026-09-29T19:00:00' 4 1)
poke
[ "$SD2" = "ok n=5" ] && ok "drill POSTERIOR semeado (29/09 19:00): Matrizes 4/5 (80%)" || bad "seed do drill-depois falhou"
REC=$(has 'treino de ontem: 4/5 no drill · subiu de 40% para 80%')
[ "$REC" = "1" ] && ok "recibo aparece: 'treino de ontem: 4/5 no drill · subiu de 40% para 80%'" || bad "recibo do drill-depois ausente (rec=$REC)"
BD=$(badge_tone '80% no treino' 'border-emerald-500/40')
[ "$BD" = "1" ] && ok "badge troca de dono: '80% no treino ✓' emerald" || bad "badge do treino ausente"

echo "=== [D] O HISTÓRICO CONTA A MESMA HISTÓRIA (badge com nome + chip do ganho) ==="
go_progress; sleep 1
TB=$(has 'Treino: Matrizes')
[ "$TB" = "1" ] && ok "badge do drill diz o tópico: 'Treino: Matrizes'" || bad "badge do drill sem tópico (tb=$TB)"
OF=$(has 'Oficial da Av1')
[ "$OF" = "1" ] && ok "oficial segue marcado ('Oficial da Av1')" || bad "badge do oficial ausente"
CHIP=$(has 'subiu de 40%')
[ "$CHIP" = "1" ] && ok "chip do ganho real no drill DEPOIS do oficial: 'subiu de 40%'" || bad "chip do delta ausente (chip=$CHIP)"
TS=$(has 'Treino: Sistemas Lineares')
[ "$TS" = "0" ] && ok "sem treino fora do escopo ainda (cenário limpo)" || bad "badge inesperado de fora do escopo"

echo "=== [E] TREINO FORA DO ESCOPO: nome no badge, delta NUNCA ==="
SD3=$(seed_drill 'qa107-sis' '2026-09-30T10:00:00' 3 2 'Sistemas Lineares')
poke
[ "$SD3" = "ok n=5" ] && ok "treino fora do escopo semeado: Sistemas Lineares 3/5" || bad "seed do sistemas falhou"
go_home; sleep 1
go_progress; sleep 1
TS2=$(has 'Treino: Sistemas Lineares')
[ "$TS2" = "1" ] && ok "badge nomeia o tópico de fora do escopo: 'Treino: Sistemas Lineares'" || bad "badge do sistemas ausente (ts2=$TS2)"
CHIP2=$(has 'subiu de')
[ "$CHIP2" = "1" ] && ok "chip de delta continua único (só o Matrizes do escopo tem 'de onde')" || bad "chip de delta sumiu ou duplicou"
REC2=$(has 'no drill')
go_home; sleep 1
KREC=$(has 'subiu de 40% para 80%')
[ "$KREC" = "1" ] && ok "kit intacto: o recibo do foco ignora treino de fora do escopo" || bad "recibo do kit sumiu"

echo "=== [F] D-2 COM DRILL NO MESMO DIA (17:00 > 15:30): segue cumprindo ==="
clean_all_runs >/dev/null 2>&1
echo "  $(mock_date '2026-09-29T20:00:00')"; poke
SP2=$(seed_prova 'qa107-a2' '2026-09-29T15:30:00' 2 3 4 1)
SD4=$(seed_drill 'qa107-mesmo-dia' '2026-09-29T17:00:00' 4 1)
poke
[ "$SP2" = "ok n=10" ] && [ "$SD4" = "ok n=5" ] && ok "D-2 semeado: oficial 15:30 + drill 17:00" || bad "seeds do F falharam"
REC3=$(has 'treino de hoje: 4/5 no drill · subiu de 40% para 80%')
[ "$REC3" = "1" ] && ok "recibo do mesmo dia: 'treino de hoje: 4/5 no drill · subiu de 40% para 80%'" || bad "recibo do mesmo dia ausente (rec3=$REC3)"

echo "=== [G] MOBILE 390: kit com recibo sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var el=[...document.querySelectorAll('h3')].find(function(h){return h.textContent.indexOf('Kit da véspera')>=0});if(el){el.scrollIntoView({block:'start'});return 'ok'}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa107-kit-recibo-mobile.png >/dev/null 2>&1 && ok "screenshot mobile (qa107-kit-recibo-mobile.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

echo "=== [H] HIGIENE + CONSOLE (reload mata o mock) ==="
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
  echo "ALL GREEN — t107 a ordem do tempo manda (o recibo virou verdade temporal)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
