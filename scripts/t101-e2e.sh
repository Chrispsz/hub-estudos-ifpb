#!/bin/bash
# Task 101 — E2E: A PALETA DE COMANDOS SABE A SEMANA (Ctrl+K ganha o grupo da
# Av1 na janela D-7→D-0, em PRIMEIRO lugar, com ações REAIS: simulado/correção/
# kit/folha/plano — e silêncio honesto fora da janela).
# Padrões provados (t88–t100): textContent SEM aspas, mock class extends Date
# com eco na página, sandbox UTC (datas absolutas), [cmdk-item] para clicar.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t101.log 2>&1 &)
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
# LIÇÃO 100.2 invertida: a paleta é um OVERLAY — has() global vê a página ATRÁS
# dela (no D-0 o dashboard atrás tem 'faltam' de outros cards). Asserção de
# conteúdo da paleta escopa [role=dialog].
has_dlg() {
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d)return 0;var t=d.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
mock_date() { # padrão provado (class extends Date) + eco DENTRO da página
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
open_palette() {
  agent-browser eval "(function(){var b=document.querySelector('[aria-label*=\"Busca\"]');if(!b)return 'NAO';b.click();return 'ok'})()" 2>/dev/null | tr -d '"'
  sleep 2
}
close_palette() {
  agent-browser press Escape >/dev/null 2>&1
  sleep 1
}
click_cmdk() { # $1=trecho do rótulo do item
  agent-browser eval "(function(){var els=document.querySelectorAll('[cmdk-item]');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"'
  sleep 2
}
first_item() {
  agent-browser eval "(function(){var e=document.querySelector('[cmdk-item]');return e?e.textContent.replace(/\s+/g,' ').slice(0,80):'vazio'})()" 2>/dev/null | tr -d '"'
}
first_heading() {
  agent-browser eval "(function(){var e=document.querySelector('[cmdk-group-heading]');return e?e.textContent.replace(/\s+/g,' '):'vazio'})()" 2>/dev/null | tr -d '"'
}
seed_run() { # run oficial 29/09 prova TEC.1984: Matrizes 5/5 + Lógica 2/5 = 70%
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];for(var i=0;i<5;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'solved'});for(var j=0;j<2;j++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(var m=0;m<3;m++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'qa101-a',date:'2026-09-29T15:30:00',mode:'prova',total:10,solved:7,missed:3,skipped:0,durationSec:2400,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n=10'})()" 2>/dev/null | tr -d '"'
}
clean_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=(p.simuladoRuns||[]).filter(function(r){return r.id.indexOf('qa101')!==0});if(p.simuladoRuns.length===0)delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null | tr -d '"'
  sleep 1
}
home() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}

echo "=== [A] Data real (dom 27/09, D-4): grupo da semana em PRIMEIRO lugar ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
P=$(open_palette)
[ "$P" = "ok" ] && ok "paleta abriu (botão Buscar do header)" || bad "paleta não abriu"
FH=$(first_heading)
case "$FH" in *'Semana da Av1 · faltam 4 dias'*) ok "1º grupo: 'Semana da Av1 · faltam 4 dias' (antes de 'Ir para')";; *) bad "1º grupo errado: $FH";; esac
D4=$(has_dlg 'D-4')
[ "$D4" = "1" ] && ok "chip tabular D-4 no heading" || bad "chip D-N ausente"
ENS=$(has_dlg 'Simulado da Av1 — ensaio real')
[ "$ENS" = "1" ] && ok "ação 'Simulado da Av1 — ensaio real'" || bad "ação do ensaio ausente"
PLA=$(has_dlg 'Plano da semana (Painel)')
[ "$PLA" = "1" ] && ok "ação 'Plano da semana (Painel)'" || bad "ação do plano ausente"
COR=$(has_dlg 'Pedir correção do simulado')
[ "$COR" = "0" ] && ok "sem run → correção NÃO inventada" || bad "correção sem run!"
KIT=$(has_dlg 'Kit da véspera (Painel)')
[ "$KIT" = "0" ] && ok "kit cala fora da janela D-2→D-0" || bad "kit vazou no D-4!"
FOL=$(has_dlg 'Folha de revisão')
[ "$FOL" = "0" ] && ok "folha cala fora da véspera" || bad "folha vazou no D-4!"
FI=$(first_item)
case "$FI" in *'ensaio real'*) ok "1º item é o ensaio (ordem certa)";; *) bad "1º item errado: $FI";; esac

echo "=== [B] Clique no ensaio → Praticar com o Simulado Pro aberto ==="
CB=$(click_cmdk 'Simulado da Av1 — ensaio real')
HASH=$(agent-browser eval "window.location.hash" 2>/dev/null | tr -d '"')
SIM=$(has 'Simulado Pro')
[ "$CB" = "ok" ] && [ "$HASH" = "#practice" ] && [ "$SIM" = "1" ] && ok "paleta abriu o Simulado Pro (#practice)" || bad "ensaio não abriu (cb=$CB hash=$HASH sim=$SIM)"
home

echo "=== [C] Mock 29/09 (D-2) SEM run: é-hoje com pulso e kit ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
MD=$(mock_date '2026-09-29T12:00:00')
echo "  ($MD)"
open_palette >/dev/null
EH=$(has_dlg 'É hoje: Simulado da Av1')
[ "$EH" = "1" ] && ok "heading: 'É hoje: Simulado da Av1'" || bad "heading do simulado ausente"
INI=$(has_dlg 'Iniciar o Simulado da Av1')
[ "$INI" = "1" ] && ok "ação 'Iniciar o Simulado da Av1'" || bad "ação iniciar ausente"
K2=$(has_dlg 'Kit da véspera (Painel)')
[ "$K2" = "1" ] && ok "kit entra na janela (D-2)" || bad "kit ausente no D-2"
COR2=$(has_dlg 'Pedir correção do simulado')
[ "$COR2" = "0" ] && ok "sem registro → correção honestamente ausente" || bad "correção sem run no D-2!"
close_palette

echo "=== [D] Run 70% + poke: flip 'ensaio' → 'correção' AO VIVO ==="
SR=$(seed_run)
echo "  (seed=$SR)"
open_palette >/dev/null
CORR=$(has_dlg 'Pedir correção do simulado (IA)')
[ "$CORR" = "1" ] && ok "run feito → 'Pedir correção do simulado (IA)'" || bad "correção não apareceu com run"
INI2=$(has_dlg 'Iniciar o Simulado da Av1')
[ "$INI2" = "0" ] && ok "ensaio SAI (a paleta não oferece o que já aconteceu)" || bad "ensaio ainda oferecido com run!"
CC=$(click_cmdk 'Pedir correção do simulado')
HASH2=$(agent-browser eval "window.location.hash" 2>/dev/null | tr -d '"')
sleep 2
PREFILL=$(agent-browser eval "(function(){var t=document.querySelector('textarea');return t&&t.value.indexOf('Acabei de terminar um simulado')>=0?1:0})()" 2>/dev/null | tr -d '"')
[ "$CC" = "ok" ] && [ "$HASH2" = "#study" ] && [ "$PREFILL" = "1" ] && ok "correção abriu o tutor com o debrief pré-preenchido" || bad "correção falhou (cc=$CC hash=$HASH2 prefill=$PREFILL)"

echo "=== [E] Mock 30/09 (D-1) véspera: kit + folha + correção ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
MD2=$(mock_date '2026-09-30T12:00:00')
echo "  ($MD2)"
open_palette >/dev/null
VE=$(has_dlg 'Véspera da prova')
[ "$VE" = "1" ] && ok "heading: 'Véspera da prova'" || bad "heading da véspera ausente"
K1=$(has_dlg 'Abrir o Kit da Véspera (Painel)')
[ "$K1" = "1" ] && ok "ação do kit" || bad "kit ausente na véspera"
FO1=$(has_dlg 'Folha de revisão para imprimir')
[ "$FO1" = "1" ] && ok "ação da folha para imprimir" || bad "folha ausente na véspera"
COR3=$(has_dlg 'Pedir correção do simulado (IA)')
[ "$COR3" = "1" ] && ok "correção de ontem na véspera" || bad "correção ausente na véspera"
close_palette

echo "=== [F] Mock 01/10 (D-0) prova: kit de reler + folha, ensaio some ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
MD3=$(mock_date '2026-10-01T12:00:00')
echo "  ($MD3)"
open_palette >/dev/null
PR=$(has_dlg 'É hoje: Prova da Av1')
[ "$PR" = "1" ] && ok "heading: 'É hoje: Prova da Av1'" || bad "heading da prova ausente"
KD=$(has_dlg 'Reler o Kit da Véspera (Painel)')
[ "$KD" = "1" ] && ok "ação 'Reler o Kit' (só reler e respirar)" || bad "kit de reler ausente"
FD0=$(has_dlg 'Folha de revisão para levar')
[ "$FD0" = "1" ] && ok "ação 'Folha para levar'" || bad "folha do D-0 ausente"
SIM0=$(has_dlg 'Iniciar o Simulado')
[ "$SIM0" = "0" ] && ok "ensaio NÃO oferecido no dia da prova" || bad "ensaio no D-0!"
FMT=$(has_dlg 'faltam')
[ "$FMT" = "0" ] && ok "nenhum 'faltam' na paleta do dia da prova" || bad "'faltam' no D-0!"
close_palette

echo "=== [G] Mock 03/10 (pós-prova): silêncio honesto ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
MD4=$(mock_date '2026-10-03T12:00:00')
echo "  ($MD4)"
open_palette >/dev/null
SEMA=$(has_dlg 'Semana da Av1')
EHOJE=$(has_dlg 'É hoje')
[ "$SEMA" = "0" ] && [ "$EHOJE" = "0" ] && ok "grupo da semana cala após a prova (nota mora na calculadora)" || bad "paleta grita pós-prova (semana=$SEMA ehoje=$EHOJE)"
close_palette

echo "=== [H] Mobile 390: sem overflow ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
open_palette >/dev/null
agent-browser eval "(function(){document.body.scrollIntoView();return 'ok'})()" >/dev/null 2>&1; sleep 1
OW=$(agent-browser eval "(function(){return document.documentElement.scrollWidth})()" 2>/dev/null | tr -d '"')
[ "$OW" -le 390 ] 2>/dev/null && ok "sem overflow horizontal (scrollWidth=$OW)" || bad "overflow mobile: $OW"
agent-browser screenshot scripts/qa101-palette-mobile390.png >/dev/null 2>&1
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 1

echo "=== [I] Higiene + console ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
CL=$(clean_runs)
echo "  ($CL)"
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t101 e2e (paleta sabe a semana)"; else echo ""; echo "FAILURES — t101 e2e"; exit 1; fi
