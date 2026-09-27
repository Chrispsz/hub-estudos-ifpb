#!/bin/bash
# Task 106 — O DRILL RESPONDE: a promessa do kit ('a revisão de amanhã') tinha
# CTA mas não tinha RECIBO — depois do treino do foco (mode 'topico'), a linha
# seguia idêntica, o badge continuava no % do simulado e o esforço da noite
# anterior era invisível. Este E2E semeia os DOIS lados do loop (run oficial
# 'prova' + drill 'topico') e verifica a gramática inteira do recibo:
# badge troca de dono ('40% no bloco' → '80% no treino ✓'), recibo com
# ponto-colorido (emerald = subiu, amber = não subiu — honesto), delta real
# ('subiu de 40% para 80%'), dia do treino (hoje/ontem), CTA 'Treinar de
# novo', acento emerald à esquerda (estilo de fechamento) e o caso
# pulouTudo → 'o bloco saiu do zero' (a taxa do simulado não existia —
# nenhum delta inventado). O leitor puro (mathDrillFeedbackFor) NUNCA colide
# com o leitor do oficial (mode 'prova' ≠ 'topico').
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t106.log 2>&1 &)
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
click_btn() { # $1=trecho · $2=índice (0 = primeiro)
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){if(n===$2){els[i].click();return 'ok'}n++}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
badge_tone() { # $1=trecho do texto do badge · $2=classe esperada
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0&&els[i].textContent.length<140)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
row_accent() { # $1=trecho do título da linha · classe do acento no button
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('border-l-emerald-500/60')>=0&&els[i].textContent.indexOf('$1')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
dot_tone() { # ponto VAZIO do recibo (sem textContent) — class no span, contexto no pai
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&c.indexOf('size-1.5')>=0&&els[i].parentElement&&els[i].parentElement.textContent.indexOf('$1')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
# Run oficial 'prova' semeado: $1=id · $2=date ISO · $3=mat solved · $4=mat missed · $5=log solved · $6=log missed
seed_prova() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];var i;for(i=0;i<$3;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'solved'});for(i=0;i<$4;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'missed'});for(i=0;i<$5;i++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(i=0;i<$6;i++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'$1',date:'$2',mode:'prova',total:qs.length,solved:($3+$5),missed:($4+$6),skipped:0,durationSec:3600,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
}
# Drill 'topico' semeado: $1=id · $2=date ISO · $3=solved · $4=missed ($5=tópico, default Matrizes)
seed_drill() {
  local topic="${5:-Álgebra Matricial}"
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var topic='$topic';var qs=[];var i;for(i=0;i<$3;i++)qs.push({disciplineCode:'TEC.1984',topic:topic,status:'solved'});for(i=0;i<$4;i++)qs.push({disciplineCode:'TEC.1984',topic:topic,status:'missed'});p.simuladoRuns.push({id:'$1',date:'$2',mode:'topico',total:qs.length,solved:$3,missed:$4,skipped:0,durationSec:900,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
}
seed_pulou() { # $1=id · $2=matrizes puladas · $3=log solved · $4=log missed
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];var i;for(i=0;i<$2;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'skipped'});for(i=0;i<$3;i++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(i=0;i<$4;i++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'$1',date:'2026-09-29T15:30:00',mode:'prova',total:qs.length,solved:$3,missed:$4,skipped:$2,durationSec:3600,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
}
clean_all_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs=0'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
go_home() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}

echo "=== [A] DATA REAL (dom 27/09, D-4): sanity ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
KIT=$(has 'Kit da véspera')
[ "$KIT" = "0" ] && ok "data real D-4: kit ausente" || bad "data real: kit presente fora da janela"

echo "=== [B] D-1 (30/09) com run oficial: a promessa SEM recibo (estado da 105) ==="
echo "  $(mock_date '2026-09-30T15:00:00')"; poke
SP=$(seed_prova 'qa106-a' '2026-09-29T15:30:00' 2 3 4 1)
poke
[ "$SP" = "ok n=10" ] && ok "oficial semeado: Matrizes 2/5 (40%) + Lógica 4/5 (80%)" || bad "seed do oficial falhou (sp=$SP)"
ROW=$(has 'Matrizes: começa a revisão de hoje')
[ "$ROW" = "1" ] && ok "linha do foco D-1: 'Matrizes: começa a revisão de hoje'" || bad "linha do foco ausente (row=$ROW)"
BB=$(badge_tone '40% no bloco' 'border-amber-500/50')
[ "$BB" = "1" ] && ok "badge no % do simulado: '40% no bloco' amber" || bad "badge do bloco ausente/sem amber (bb=$BB)"
CTA=$(has 'Treinar Matrizes')
[ "$CTA" = "1" ] && ok "CTA da promessa: 'Treinar Matrizes'" || bad "CTA do drill ausente"
NOREC=$(has 'no drill')
[ "$NOREC" = "0" ] && ok "sem recibo ainda (nada inventado)" || bad "recibo apareceu sem drill"

echo "=== [C] O RECIBO: drill de ONTEM (4/5) — a revisão cumpriu ==="
SD=$(seed_drill 'qa106-drill1' '2026-09-29T19:00:00' 4 1)
poke
[ "$SD" = "ok n=5" ] && ok "drill semeado (mode topico, ontem 19:00): Matrizes 4/5" || bad "seed do drill falhou (sd=$SD)"
REC=$(has 'treino de ontem: 4/5 no drill · subiu de 40% para 80%')
[ "$REC" = "1" ] && ok "recibo: 'treino de ontem: 4/5 no drill · subiu de 40% para 80%'" || bad "recibo do delta ausente (rec=$REC)"
BD=$(badge_tone '80% no treino' 'border-emerald-500/40')
[ "$BD" = "1" ] && ok "badge trocou de dono: '80% no treino ✓' emerald" || bad "badge do treino ausente/sem emerald (bd=$BD)"
OLD=$(has '40% no bloco')
[ "$OLD" = "0" ] && ok "badge antigo do simulado saiu (o placar segue nos chips)" || bad "badge antigo ainda presente"
DOT=$(dot_tone 'treino de ontem' 'bg-emerald-500')
[ "$DOT" = "1" ] && ok "ponto do recibo em emerald (subiu)" || bad "ponto do recibo sem emerald (dot=$DOT)"
CTA2=$(has 'Treinar de novo')
[ "$CTA2" = "1" ] && ok "CTA flipou: 'Treinar de novo'" || bad "CTA não flipou"
ACC=$(row_accent 'começa a revisão de hoje')
[ "$ACC" = "1" ] && ok "acento de fechamento: borda emerald à esquerda na linha do foco" || bad "acento emerald ausente (acc=$ACC)"

echo "=== [D] O RECIBO HONESTO: drill de HOJE pior (1/5) — não subiu ==="
SD2=$(seed_drill 'qa106-drill2' '2026-09-30T08:00:00' 1 4)
poke
[ "$SD2" = "ok n=5" ] && ok "drill mais recente semeado (hoje 08:00): Matrizes 1/5 (20%)" || bad "seed do drill2 falhou (sd2=$SD2)"
REC2=$(has 'treino de hoje: 1/5 no drill · 20% no treino — vale outra passada')
[ "$REC2" = "1" ] && ok "recibo honesto: 'treino de hoje: 1/5 no drill · 20% no treino — vale outra passada'" || bad "recibo do não-subiu ausente (rec2=$REC2)"
BA=$(badge_tone '20% no treino' 'border-amber-500/50')
EM=$(badge_tone '20% no treino' 'border-emerald-500/40')
[ "$BA" = "1" ] && [ "$EM" = "0" ] && ok "badge amber SEM check (20% < meta — nada comemorado)" || bad "badge do não-subiu com tom errado (ba=$BA em=$EM)"
DOT2=$(dot_tone 'treino de hoje' 'bg-amber-500')
[ "$DOT2" = "1" ] && ok "ponto do recibo em amber (não subiu)" || bad "ponto amber ausente (dot2=$DOT2)"

echo "=== [E] PULOU TUDO + DRILL: 'o bloco saiu do zero' (sem delta inventado) ==="
clean_all_runs >/dev/null 2>&1
SEEDP=$(seed_pulou 'qa106-pulou' 5 3 2)
SD3=$(seed_drill 'qa106-drill3' '2026-09-30T09:00:00' 3 2)
poke
[ "$SEEDP" = "ok n=10" ] && [ "$SD3" = "ok n=5" ] && ok "cenário: Matrizes 5/5 PULADAS no oficial + drill 3/5 hoje" || bad "seeds do cenário E falharam"
ROWP=$(has 'Matrizes: pulou tudo — começa por ela')
[ "$ROWP" = "1" ] && ok "linha: 'Matrizes: pulou tudo — começa por ela' (pulouTudo manda)" || bad "linha do pulou-tudo ausente (rowp=$ROWP)"
REC3=$(has 'treino de hoje: 3/5 no drill · o bloco saiu do zero')
[ "$REC3" = "1" ] && ok "recibo do zero: 'treino de hoje: 3/5 no drill · o bloco saiu do zero' (sem delta — não havia taxa)" || bad "recibo do saiu-do-zero ausente (rec3=$REC3)"
BP=$(has '5 puladas')
[ "$BP" = "0" ] && ok "badge rose de puladas deu lugar ao resultado do treino" || bad "badge de puladas deveria ter saído"
BT=$(badge_tone '60% no treino' 'border-amber-500/50')
[ "$BT" = "1" ] && ok "badge do treino amber (60% < meta, honesto)" || bad "badge do treino 60% com tom errado"

echo "=== [F] D-2 com drill NO MESMO DIA: treino de hoje à noite do simulado ==="
clean_all_runs >/dev/null 2>&1
echo "  $(mock_date '2026-09-29T20:00:00')"; poke
SP2=$(seed_prova 'qa106-a2' '2026-09-29T15:30:00' 2 3 4 1)
SD4=$(seed_drill 'qa106-drill4' '2026-09-29T17:00:00' 4 1)
poke
[ "$SP2" = "ok n=10" ] && [ "$SD4" = "ok n=5" ] && ok "D-2 semeado: oficial 15:30 + drill 17:00 do MESMO dia" || bad "seeds do F falharam"
ROW2=$(has 'Matrizes: a revisão de amanhã')
[ "$ROW2" = "1" ] && ok "título D-2 preservado: 'Matrizes: a revisão de amanhã'" || bad "título do D-2 mudou (row2=$ROW2)"
REC4=$(has 'treino de hoje: 4/5 no drill · subiu de 40% para 80%')
[ "$REC4" = "1" ] && ok "recibo D-2: 'treino de hoje: 4/5 no drill · subiu de 40% para 80%'" || bad "recibo do D-2 ausente (rec4=$REC4)"
AB=$(has 'abaixo da meta')
[ "$AB" = "1" ] && ok "badge do kit segue real: 'simulado feito — 60%: abaixo da meta'" || bad "badge do % geral ausente"

echo "=== [G] MOBILE 390: kit com recibo sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var el=[...document.querySelectorAll('h3')].find(function(h){return h.textContent.indexOf('Kit da véspera')>=0});if(el){el.scrollIntoView({block:'start'});return 'ok'}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa106-kit-drill-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa106-kit-drill-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
DESK=$(agent-browser screenshot scripts/qa106-kit-drill-desktop.png >/dev/null 2>&1 && echo 1 || echo 0)
[ "$DESK" = "1" ] && ok "screenshot desktop do recibo (qa106-kit-drill-desktop.png)" || bad "screenshot desktop falhou"

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
  echo "ALL GREEN — t106 o drill responde (a promessa ganhou recibo)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
