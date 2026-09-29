#!/bin/bash
# Task 100 — E2E da camada DISCIPLINA falando a semana da Av1.
# (1) card da disciplina (grade + filtro) com chip D-N; (2) dialog Avaliação:
# linha da Av1 em amber/rose com chip tabular + 'próxima' genérica nas outras
# disciplinas; (3) relógio manda (mocks D-2/D-0/pós); (4) mobile; (5) higiene.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t100.log 2>&1 &)
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
  agent-browser eval "(function(){var t=document.body.textContent.toLowerCase().replace(/\s+/g,' ');return (t.indexOf('$(echo "$1" | tr 'A-Z' 'a-z')')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
# só o [role=dialog] — o texto da página ATRÁS do overlay continua no DOM
# (o card da Matemática com o chip fica atrás de QUALQUER dialog de disciplina)
has_dlg() {
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d)return 0;var t=d.textContent.toLowerCase().replace(/\s+/g,' ');return (t.indexOf('$(echo "$1" | tr 'A-Z' 'a-z')')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
wait_dialog() {
  for i in $(seq 1 10); do
    D=$(agent-browser eval "(function(){return document.querySelector('[role=dialog]')?1:0})()" 2>/dev/null | tr -d '"')
    [ "$D" = "1" ] && break
    sleep 1
  done
  sleep 1
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked'})()" >/dev/null 2>&1
  sleep 1
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
open_library() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Biblioteca')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 3
}
open_math_dialog() {
  # abre o card da Matemática (o card É um botão <motion.button> com o texto)
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if((els[i].textContent||'').indexOf('Matemática')>=0&&(els[i].textContent||'').indexOf('materiais')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  wait_dialog
}
open_eval_tab() {
  # Radix Tabs ignora click() sintético (lição 98.2) — click nativo, 3º tab
  agent-browser click '[role=tab]:nth-of-type(3)' >/dev/null 2>&1
  sleep 2
}
close_dialog() {
  agent-browser press Escape >/dev/null 2>&1
  sleep 1
}

echo "=== [A] D-4 MOCKADO (2026-09-27) — card da Matemática na grade ==="
# Lição 128 — data-rot (mesma cura da t98): [A]/[B] corriam no relógio REAL da
# entrega e apodreceram em D-3; o produto estava certo, o teste casava com o
# calendário. Mock + poke tornam as fases A–C determinísticas em qualquer dia.
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
open_library
echo "  $(mock_date '2026-09-27T10:00:00')"; poke; sleep 1
CHIP4=$(has 'av1 · faltam 4 dias')
[ "$CHIP4" = "1" ] && ok "chip no card: 'Av1 · faltam 4 dias'" || bad "chip D-4 ausente no card"
EHOJE=$(has 'av1 · é hoje')
[ "$EHOJE" = "0" ] && ok "sem 'é hoje' no D-4" || bad "'é hoje' inventado"
EHJ2=$(has 'é hoje')
[ "$EHJ2" = "0" ] && ok "nenhum é-hoje na Biblioteca (D-4)" || bad "vazou é-hoje"

echo "=== [B] Dialog da Matemática — aba Avaliação (fonte única no render) ==="
open_math_dialog
open_eval_tab
LINHA=$(has_dlg 'a semana da av1 vive no painel')
[ "$LINHA" = "1" ] && ok "linha honesta do D-4 no dialog" || bad "linha do dialog ausente"
PROX=$(has_dlg 'próxima')
[ "$PROX" = "0" ] && ok "Av1 é a próxima avaliação → marcador genérico cala (chip do exame manda)" || bad "'próxima' genérica deveria calar"
CHIPD=$(has_dlg 'av1 · faltam 4 dias')
[ "$CHIPD" = "1" ] && ok "chip tabular no dialog: 'Av1 · faltam 4 dias'" || bad "chip ausente no dialog"
close_dialog

echo "=== [C] Dialog de ALGORITMOS — 'próxima' genérica, sem voz do exame ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if((els[i].textContent||'').indexOf('Algoritmos')>=0&&(els[i].textContent||'').indexOf('materiais')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
wait_dialog
open_eval_tab
PROXA=$(has_dlg 'próxima')
[ "$PROXA" = "1" ] && ok "Prova 1 (30/10) marcada como 'próxima' (genérico)" || bad "marcador 'próxima' ausente no Algoritmos"
SEMEX=$(has_dlg 'a semana da av1')
[ "$SEMEX" = "0" ] && ok "sem linha do exame em outra disciplina" || bad "voz do exame vazou p/ Algoritmos"
SEMCHIP=$(has_dlg 'av1 ·')
[ "$SEMCHIP" = "0" ] && ok "sem chip do exame no dialog do Algoritmos" || bad "chip vazou"
close_dialog

echo "=== [D] Mock 29/09 (D-2) — dia do simulado oficial ==="
echo "  $(mock_date '2026-09-29T10:00:00')"; poke; sleep 1
CHIP2=$(has 'av1 · faltam 2 dias')
[ "$CHIP2" = "1" ] && ok "chip segue o relógio: 'faltam 2 dias'" || bad "chip não mudou para D-2"
open_math_dialog
open_eval_tab
LINSIM=$(has_dlg 'hoje é o dia do simulado oficial')
[ "$LINSIM" = "1" ] && ok "linha do ensaio real no dialog" || bad "linha do simulado ausente"
close_dialog

echo "=== [E] Mock 01/10 (D-0) — é hoje ==="
echo "  $(mock_date '2026-10-01T08:00:00')"; poke; sleep 1
CHIP0=$(has 'av1 · é hoje')
[ "$CHIP0" = "1" ] && ok "chip: 'Av1 · é hoje'" || bad "chip D-0 ausente"
open_math_dialog
open_eval_tab
LINP=$(has_dlg 'a prova é hoje — levar o kit')
[ "$LINP" = "1" ] && ok "linha da prova no dialog" || bad "linha da prova ausente"
close_dialog

echo "=== [F] Mock 03/10 (pós-prova) — silêncio honesto ==="
echo "  $(mock_date '2026-10-03T10:00:00')"; poke; sleep 1
GONE=$(has 'av1 ·')
[ "$GONE" = "0" ] && ok "chip desaparece pós-prova (janela fechada)" || bad "chip deveria calar"
open_math_dialog
open_eval_tab
SEMAM=$(has_dlg 'a prova é hoje')
[ "$SEMAM" = "0" ] && ok "dialog sem linha da prova (pós)" || bad "linha vazou pós-prova"
PROXP=$(has_dlg 'próxima')
[ "$PROXP" = "0" ] && ok "sem 'próxima' (Av2/Av3 sem data — anti-estimativa)" || bad "'próxima' inventada pós-prova"
SEMAM2=$(has_dlg 'av1 ·')
[ "$SEMAM2" = "0" ] && ok "sem chip do exame no dialog (pós)" || bad "chip vazou pós-prova"
close_dialog

echo "=== [G] Data real de volta + card FILTRADO (Exata) ==="
echo "  $(mock_date '2026-09-27T10:00:00')"; poke; sleep 1
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Exata')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
CHIPE=$(has 'av1 · faltam 4 dias')
[ "$CHIPE" = "1" ] && ok "card filtrado (Exata) também fala a semana (2º ponto de render)" || bad "chip ausente no card filtrado"

echo "=== [H] Mobile 390 — sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 2
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Todos')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
OV=$(agent-browser eval "(function(){var d=document.documentElement;return (d.scrollWidth>window.innerWidth+1)?1:0})()" 2>/dev/null | tr -d '"')
[ "$OV" = "0" ] && ok "sem overflow horizontal (390px)" || bad "overflow no mobile"
agent-browser screenshot scripts/qa100-disciplina-mobile390.png >/dev/null 2>&1

echo "=== [I] HIGIENE + CONSOLE ==="
agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');delete p.__poke;var s=JSON.stringify(p);localStorage.setItem('$STORE',s);window.dispatchEvent(new StorageEvent('storage',{key:'$STORE',newValue:s}));return 'ok'})()" >/dev/null 2>&1
sleep 1
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo (feature é date-pura, storage intocado)";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t100 e2e"; else echo ""; echo "FAILURES — t100 e2e"; exit 1; fi
