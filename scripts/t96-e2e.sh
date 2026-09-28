#!/bin/bash
# Task 96 — E2E do APOIO DO PLANO ABRE O PALCO (exercisePool das tarefas →
# chip 'apoio (N)' → Praticar com os exercícios EXATOS do dia, chip violeta
# com IDs + contagem + X; pedido sem apoio limpa — lição da 82/94).
# Padrões provados (t88–t95): contagem por ELEMENTO exato (lição 94.1),
# e.preventDefault() no chip dentro do label, volta pelo rótulo real do DOM.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t96.log 2>&1 &)
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
exact_count() { # lição 94.1: lê o ELEMENTO cujo texto casa /^N exercício\(s\)$/
  agent-browser eval "(function(){var els=document.querySelectorAll('div');for(var i=0;i<els.length;i++){var m=els[i].textContent.trim().match(/^(\\d+) exercício\\(s\\)$/);if(m)return m[1]}return 'NO'})()" 2>/dev/null | tr -d '"'
}
click_btn() { # $1=trecho · $2=índice
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){if(n===$2){els[i].click();return 'ok'}n++}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
count_btn() { # quantos botões contêm o trecho
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0)n++}return n})()" 2>/dev/null | tr -d '"'
}
chip_visible() { # o chip violeta do apoio está no DOM?
  agent-browser eval "(function(){var els=document.querySelectorAll('div');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('border-violet-500/50')>=0&&els[i].textContent.indexOf('Apoio:')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
goto_home() { # o rótulo REAL do nav da home é 'Visão Geral' (lição 94.2);
  # marcador case-imune (textContent é RAW — o uppercase é só CSS, lição 94.5)
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(agent-browser eval "(function(){return document.body.textContent.toLowerCase().indexOf('faça hoje')>=0?1:0})()" 2>/dev/null | tr -d '"')" = "1" ] && return 0
  done
  return 1
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [A] DATA REAL (D-4): o dia de hoje TEM apoio (mat-ex07 + mat-ex08) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
CH=$(has 'apoio (2)')
[ "$CH" = "1" ] && ok "chip 'apoio (2)' visível na tarefa do dia (Lógica Parte 1)" || bad "chip de apoio ausente no dia D-4"

echo "=== [B] CLIQUE: Praticar abre com EXATAMENTE os 2 do apoio ==="
CB=$(click_btn 'apoio (' 0); sleep 2
CHIP=$(chip_visible); IDS=$(has 'Apoio: mat-ex07 · mat-ex08')
CNT=$(exact_count)
echo "  contador exato: $CNT"
[ "$CB" = "ok" ] && [ "$CHIP" = "1" ] && [ "$IDS" = "1" ] && ok "chip violeta 'Apoio: mat-ex07 · mat-ex08' no Praticar" || bad "apoio não chegou ao Praticar (cb=$CB chip=$CHIP ids=$IDS)"
[ "$CNT" = "2" ] && ok "contador EXATO = 2 (lição 94.1)" || bad "contador esperado 2, veio '$CNT'"
TASK=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub:math-exam:v1:plan')||'{}');return 'task43='+(p['task-4-3']?1:0)})()" 2>/dev/null | tr -d '"')
case "$TASK" in *task43=0*) ok "checkbox da tarefa NÃO marcou (preventDefault no label)";; *) bad "checkbox marcado pelo clique do chip: $TASK";; esac

echo "=== [C] X limpa: a lista volta aos 13 de Matemática (48 é a fila ALG) ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if((els[i].getAttribute('aria-label')||'')==='Limpar o filtro de apoio'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
CNT=$(exact_count); CHIP=$(chip_visible)
echo "  contador exato: $CNT"
[ "$CNT" = "13" ] && ok "X devolve os 13 de Matemática em sala (baseline correto)" || bad "esperado 13, veio '$CNT'"
[ "$CHIP" = "0" ] && ok "chip do apoio sumiu" || bad "chip do apoio ainda visível"

echo "=== [D] ANTI-VAZAMENTO: pedido sem apoio LIMPA o apoio anterior ==="
goto_home || { bad "não voltei à home"; FAIL=1; }
CB=$(click_btn 'apoio (' 0); sleep 2
[ "$(chip_visible)" = "1" ] && ok "apoio reaberto (preparação do teste)" || bad "apoio não reabriu"
goto_home || { bad "não voltei à home (2)"; FAIL=1; }
CB=$(click_btn 'praticar' 0); sleep 2   # chip 'praticar' da fila S2: só disciplineCode
CHIP=$(chip_visible); CNT=$(exact_count)
echo "  contador exato: $CNT"
[ "$CHIP" = "0" ] && ok "pedido sem apoio limpou o filtro (lição da 82)" || bad "apoio VAZOU através do pedido novo"
[ "$CNT" = "48" ] && ok "fila ALG genérica intacta (48, agora na disciplina certa)" || bad "esperado 48, veio '$CNT'"

echo "=== [E] PLANO COMPLETO: 3 tarefas com apoio (D-5, D-4, D-3) ==="
goto_home || { bad "não voltei à home (3)"; FAIL=1; }
CB=$(click_btn 'Plano completo' 0); sleep 2
N=$(count_btn 'apoio (')
echo "  botões 'apoio (' no DOM: $N"
[ "$N" -ge 3 ] && ok "as 3 tarefas com exercisePool têm chip (D-5 + D-4 + D-3, +1 do card do dia)" || bad "esperado ≥3 chips, veio $N"
agent-browser press Escape >/dev/null 2>&1; sleep 1
DLG=$(agent-browser eval "(function(){return 'dlg='+(document.querySelector('[role=dialog]')?'open':'closed')})()" 2>/dev/null | tr -d '"')
echo "  $DLG"

echo "=== [F] MOCK 28/09 (D-3): o dia de amanhã também abre (mat-ex11 + mat-ex12) ==="
goto_home || { bad "não voltei à home (4)"; FAIL=1; }
echo "  $(mock_date '2026-09-28T15:00:00')"; poke
sleep 1
CH=$(has 'apoio (2)')
[ "$CH" = "1" ] && ok "D-3: chip 'apoio (2)' no dia Lógica Parte 2" || bad "D-3: chip de apoio ausente"
CB=$(click_btn 'apoio (' 0); sleep 2
IDS=$(has 'Apoio: mat-ex11 · mat-ex12'); CNT=$(exact_count)
echo "  contador exato: $CNT"
[ "$IDS" = "1" ] && [ "$CNT" = "2" ] && ok "D-3 abre EXATAMENTE mat-ex11 · mat-ex12" || bad "apoio D-3 errado (ids=$IDS cnt=$CNT)"

echo "=== [G] MOBILE 390 com o filtro ativo: sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'ovf='+(d.scrollWidth>d.clientWidth?1:0)})()" 2>/dev/null | tr -d '"')
echo "  $OVF"
case "$OVF" in *ovf=0*) ok "mobile 390: sem overflow horizontal";; *) bad "mobile 390 com overflow";; esac
agent-browser screenshot scripts/qa96-apoio-mobile390.png >/dev/null 2>&1

echo "=== [H] HIGIENE: zero seed, console limpo, data real ==="
agent-browser set viewport 1440 900 >/dev/null 2>&1
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);return 'poke-deleted'})()" >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');var pl=JSON.parse(localStorage.getItem('hub:math-exam:v1:plan')||'{}');return 'realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)+' runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' planChecked='+(Object.keys(pl).length)})()" 2>/dev/null | tr -d '"')
echo "  storage: $S"
case "$S" in *runs=0*poke=0*planChecked=0*) ok "storage intocado (feature é UI pura)";; *) bad "storage inesperado: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t96"; else echo ""; echo "FAILURES — t96"; exit 1; fi
