#!/bin/bash
# Task 123 — O TUTOR CONTA: a dúvida enviada com material selecionado É
# estudo do material (o P2 que a 118 deixou pendente). O dono disse
# (28/09): "eu geralmente só abro os materiais e tiro dúvidas com a tutor" —
# abrir material já registrava, mas a pergunta ao tutor NÃO: metade do fluxo
# real do aluno continuava invisível. A FIXAÇÃO: sendQuestion registra
# markAccessed(materialId) NO ENVIO (a mesma fonte da abertura — abrir o
# chat e cancelar não provou nada), e o chat ganha o recibo honesto ANTES da
# pergunta: chip emerald 'dúvidas contam como estudo' quando há material
# selecionado (a família do registro que a casa já consagrou).
set -u
cd /home/z/my-project

FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t123.log 2>&1)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6

go_estudar() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
mat_progress() {
  agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');var k=Object.keys(p.materialProgress||{});return k.length?k.join(',')+':'+(p.materialProgress[k[0]].lastAccessedAt||'no-stamp'):'EMPTY'})()" 2>/dev/null | tr -d '"'
}
open_chat() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Tirar dúvida com IA')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
close_chat() {
  agent-browser eval "(function(){var els=document.querySelectorAll('[role=dialog] button, [data-slot=sheet-content] button');for(var i=0;i<els.length;i++){var a=els[i].getAttribute('aria-label')||'';if(a.indexOf('Fechar')>=0||a==='Close'){els[i].click();return 'ok'}}document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return 'esc';})()" >/dev/null 2>&1
  sleep 1
}
pick_material() { # primeira opção real do select de material
  agent-browser eval "(function(){var sels=document.querySelectorAll('[role=combobox]');var m=[...sels].find(function(s){return s.id==='study-material'});if(!m) return 'no-select';m.click();return 'open';})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var opts=[...document.querySelectorAll('[role=option]')];if(opts.length<2) return 'no-opts';opts[1].click();return 'picked';})()" >/dev/null 2>&1
  sleep 1
}
dash_remount() { # lição 120: memo de mount — troca de aba reexecuta com o storage novo
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 3
}

echo "=== [1] SEM material: o recibo honesto NÃO mente ==="
go_estudar
open_chat
if [ "$(has 'dúvidas contam como estudo')" = "0" ]; then
  ok "chip AUSENTE sem material selecionado (nada prometido, nada registrado)"
else
  bad "chip aparece sem material — o recibo mentiria"
fi
close_chat

echo "=== [2] COM material: o chip chega ANTES da pergunta ==="
pick_material
open_chat
[ "$(has 'dúvidas contam como estudo')" = "1" ] && ok "chip emerald presente: 'dúvidas contam como estudo'" || bad "chip do recibo não apareceu"
[ "$(has 'Lista de Exercícios de Programação')" = "1" ] && ok "o título do material segue no contexto do chat" || bad "material não refletido no chat"

echo "=== [3] O ENVIO REGISTRA (fonte única, no momento do envio) ==="
BEFORE=$(mat_progress)
agent-browser eval "(function(){var ta=document.querySelector('textarea[aria-label=\"Sua pergunta para o tutor\"]');if(!ta) return 'no-textarea';var set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;set.call(ta,'Me explica o que é um vetor com um exemplo');ta.dispatchEvent(new Event('input',{bubbles:true}));return 'filled';})()" >/dev/null 2>&1
agent-browser eval "(function(){var b=document.querySelector('button[aria-label=\"Enviar mensagem\"]');if(!b) return 'no-send';b.click();return 'sent';})()" >/dev/null 2>&1
sleep 2
AFTER=$(mat_progress)
echo "  before=$BEFORE"
echo "  after=$AFTER"
case "$AFTER" in
  alg-lista*20*) ok "registro NO ENVIO: materialProgress['alg-lista'].lastAccessedAt carimbado (sem esperar a IA)";;
  EMPTY) bad "envio com material NÃO registrou — o tutor continua invisível";;
  *) bad "registro inesperado: $AFTER";;
esac
close_chat

echo "=== [4] O RECIBO FLUI: a atividade chega ao painel ==="
dash_remount
if [ "$(has 'em dia')" = "1" ] || [ "$(has 'em estudo')" = "1" ]; then
  ok "o registro do tutor alimentou a régua: badge de atividade vivo no painel"
else
  bad "painel não leu a atividade gerada pelo tutor"
fi
if [ "$(has 'sem registroAlg')" = "0" ] && [ "$(has 'registrem registro')" = "0" ]; then
  ok "Algoritmos não figura mais como 'sem registro' após a dúvida"
else
  bad "Algoritmos ainda 'sem registro' — o fluxo não chegou à régua"
fi
agent-browser screenshot scripts/qa123-tutor-registra-desktop.png >/dev/null 2>&1 && ok "screenshot: scripts/qa123-tutor-registra-desktop.png"

echo "=== [5] HIGIENE + CONSOLE (sessão nova, sem mock) ==="
agent-browser eval "(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.materialProgress;var s=JSON.stringify(p);localStorage.setItem(k,s);return 'mat-clean';})()" >/dev/null 2>&1
curl -s -X DELETE "http://localhost:3000/api/tutor/history?discipline=TEC.1687" >/dev/null 2>&1
agent-browser close 2>/dev/null
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length+' matProg='+Object.keys(p.materialProgress||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*matProg=0*) ok "storage limpo (o ensaio não escreve nada)";; *) bad "resíduo: $S";; esac
C=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$C" = "0" ] && ok "console: 0 erros" || bad "console tem $C erros"

[ "$FAIL" = "0" ] && echo "ALL GREEN — t123 o tutor conta (a dúvida com material é estudo)" || echo "FAIL — ver [FAIL] acima"
exit $FAIL
