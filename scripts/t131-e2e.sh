#!/bin/bash
# Task 131 — A PROMESSA CUMPRIDA: a tela de resultado do Simulado Pro promete
# na entrega ("o que faltou alimenta o Caderno de Erros automaticamente") mas
# nunca MOSTROU a promessa — o recibo novo (131) aparece no ResultsScreen com
# a contagem honesta (missed + skipped), a janela de 48h (a MESMA régua das
# frescas do caderno) e a porta do card da prova (openProgress → aba
# Progresso). A suíte dirige o fluxo COMPLETO pela UI real (o run nasce do
# clique, receita t105): setup → 10 questões → entrega → resultado.
# [A] recibo presente com contagem certa (7✓/2✗/1 em branco = 3 no caderno);
# [B] a porta LEVA: caderno aberto com a faixa 'feito ✓' e as frescas;
# [C] o silêncio honesto: run perfeito (10✓) = recibo AUSENTE (regra 88 —
#     sem registro não há linha); [D] higiene zero + console 0.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t131.log 2>&1 &)
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
has_dlg() { # escopo do overlay do Simulado Pro (lição 100.2/101.1)
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d)return 0;var t=d.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
click_btn() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){if(n===$2){els[i].click();return 'ok'}n++}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
dlg_aria() { # botão com aria-label exato dentro do dialog
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d)return 0;var els=d.querySelectorAll('button');for(var i=0;i<els.length;i++){if((els[i].getAttribute('aria-label')||'')==='$1')return 1}return 0})()" 2>/dev/null | tr -d '"'
}
dlg_amber_block() { # o recibo: div amber contendo o texto, com o número tabular
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d)return 0;var els=d.querySelectorAll('div');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('border-amber-500/40')>=0&&els[i].textContent.indexOf('$1')>=0){if(c.indexOf('tabular-nums')>=0||els[i].innerHTML.indexOf('tabular-nums')>=0)return 2;return 1}}return 0})()" 2>/dev/null | tr -d '"'
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
clean_all_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs=0'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
go_home() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
click_hero() { # o botão do dia (aria-label 'Hoje é o dia do Simulado…')
  agent-browser eval "(function(){var b=document.querySelector('[aria-label^=\"Hoje é o dia do Simulado\"]');if(!b)return 'NAO';b.click();return 'ok'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] O RECIBO: run real 7✓/2✗/1 em branco → resultado honesto (3) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
echo "  $(mock_date '2026-09-29T09:00:00')"; poke
HB=$(click_hero); sleep 3
[ "$HB" = "ok" ] && ok "hero abriu o Simulado Pro no dia do ensaio" || bad "hero não abriu (hb=$HB)"
ST=$(click_btn 'Iniciar simulado' 0); sleep 2
[ "$ST" = "ok" ] && ok "prova iniciada" || bad "setup não iniciou (st=$ST)"
for i in 1 2 3 4 5 6 7; do click_btn 'Consegui' 0 >/dev/null 2>&1; sleep 1; done
for i in 1 2; do click_btn 'Não consegui' 0 >/dev/null 2>&1; sleep 1; done
EN=$(click_btn 'Encerrar' 0); sleep 2
FI=$(click_btn 'Encerrar e ver resultado' 0); sleep 3
[ "$FI" = "ok" ] && ok "entrega confirmada — resultado na tela" || bad "confirmação falhou (fi=$FI)"
REC=$(has_dlg 'já está no Caderno de Erros')
[ "$REC" = "1" ] && ok "recibo presente: 'O que faltou (…) já está no Caderno de Erros'" || bad "recibo ausente no resultado (rec=$REC)"
CNT=$(has_dlg 'O que faltou (3) já está no Caderno de Erros')
[ "$CNT" = "1" ] && ok "contagem honesta: 2 não consegui + 1 em branco = (3)" || bad "contagem errada (cnt=$CNT)"
J48=$(has_dlg 'Revise as frescas em até 48h')
[ "$J48" = "1" ] && ok "janela de 48h anunciada (a MESMA régua das frescas do caderno)" || bad "janela 48h ausente (j48=$J48)"
DOOR=$(dlg_aria 'Abrir o Caderno de Erros na aba Progresso')
[ "$DOOR" = "1" ] && ok "porta presente com aria-label do card da prova" || bad "porta sem aria-label (door=$DOOR)"
AMB=$(dlg_amber_block 'Caderno de Erros')
[ "$AMB" = "2" ] && ok "recibo na família amber (border-amber-500/40) com número tabular-nums" || bad "bloco amber/tabular errado (amb=$AMB)"
agent-browser screenshot scripts/qa131-recibo-caderno.png >/dev/null 2>&1 && ok "screenshot do recibo (qa131-recibo-caderno.png)" || bad "screenshot falhou"

echo "=== [B] A PORTA LEVA: um clique e o caderno está aberto ==="
PB=$(click_btn 'Abrir o caderno' 0); sleep 3
[ "$PB" = "ok" ] && ok "porta clicada" || bad "porta não clicou (pb=$PB)"
DLGCLOSE=$(agent-browser eval "(function(){return document.querySelector('[role=dialog]')?1:0})()" 2>/dev/null | tr -d '"')
[ "$DLGCLOSE" = "0" ] && ok "dialog fechou ao abrir o caderno" || bad "dialog ainda aberto (dlg=$DLGCLOSE)"
CN=$(has 'Caderno de Erros')
[ "$CN" = "1" ] && ok "caderno aberto na aba Progresso" || bad "caderno não abriu (cn=$CN)"
FEITO=$(has 'Simulado da Av1 feito ✓')
[ "$FEITO" = "1" ] && ok "faixa do caderno flipou: 'Simulado da Av1 feito ✓'" || bad "faixa sem o feito ✓ (feito=$FEITO)"
FR=$(has 'Ver as frescas')
[ "$FR" = "1" ] && ok "frescas com atalho ('Ver as frescas (…)') — as 48h vivem dos dois lados" || bad "atalho das frescas ausente (fr=$FR)"

echo "=== [C] O SILÊNCIO HONESTO: run perfeito = recibo cala (regra 88) ==="
clean_all_runs >/dev/null 2>&1; poke
go_home; sleep 2
HB2=$(click_hero); sleep 3
[ "$HB2" = "ok" ] && ok "simulado reaberto (run limpo, hero de volta)" || bad "hero não reabriu (hb2=$HB2)"
ST2=$(click_btn 'Iniciar simulado' 0); sleep 2
for i in 1 2 3 4 5 6 7 8 9 10; do click_btn 'Consegui' 0 >/dev/null 2>&1; sleep 1; done
EN2=$(click_btn 'Encerrar' 0); sleep 2
FI2=$(click_btn 'Encerrar e ver resultado' 0); sleep 3
META=$(has_dlg 'Meta da Av1 batida')
[ "$META" = "1" ] && ok "resultado do run perfeito na tela (meta batida)" || bad "resultado não chegou (meta=$META)"
REC2=$(has_dlg 'já está no Caderno de Erros')
[ "$REC2" = "0" ] && ok "run perfeito: recibo CALA — sem registro não há linha" || bad "recibo apareceu sem erros (rec2=$REC2)"
DOOR2=$(has_dlg 'Abrir o caderno')
[ "$DOOR2" = "0" ] && ok "porta também cala no run perfeito" || bad "porta órfã no run perfeito (door2=$DOOR2)"
agent-browser press Escape >/dev/null 2>&1; sleep 2

echo "=== [D] HIGIENE + CONSOLE (reload mata o mock) ==="
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
H=$(clean_all_runs)
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RUNS"
[ "$RUNS" = "runs=0 poke=0 realGrades=0" ] && ok "storage limpo (runs/poke/realGrades)" || bad "resíduo no storage: $RUNS"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t131 a promessa cumprida (o resultado mostra o caderno)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
