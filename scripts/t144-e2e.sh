#!/usr/bin/env bash
# ============================================================================
# t144 — O FIO DA DÚVIDA SOBREVIVE (a conversa do painel não morre no X)
#
# DOR: o painel do tutor em tela dividida vivia só enquanto o diálogo estava
# aberto — fechar o PDF desmontava o painel e a conversa (com a explicação
# longa, LaTeX e exemplo resolvido) morria no clique. Reabrir o MESMO
# material voltava com o painel vazio.
#
# CURA (t144): cache de SESSÃO por material (lib/tutor-thread-cache) — reabrir
# o mesmo PDF reidrata o fio; outro material vê só a conversa dele; bolhas de
# erro não sobrevivem; "Limpar conversa" apaga de verdade; reload recomeça.
# E as outras curas de acabamento da rodada: dica de arraste do divisor
# (uma vez na vida), leitura viva em % durante o drag, aria-valuetext real.
#
# [A] dica de arraste: aparece no 1º dividido, morre na interação, não volta
# [B] leitura viva do drag: pílula "Material N% · Tutor M%" durante o gesto
# [C] aria-valuetext: o leitor de tela lê a PARTILHA, não número cru
# [D] O FIO: pergunta real → fechar → reabrir o MESMO material = conversa lá;
#     outro material = isolado; limpar = limpo no reabrir também
# [E] higiene: console 0 + sessão fechada
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
qa_selfcheck || exit 2

qa_ensure_dev

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ok: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }

# Estado limpo: preferências do dividido E da dica ZERADAS (o teste define as suas)
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser eval "try{localStorage.removeItem('hub:pdf-split');localStorage.removeItem('hub:pdf-split-pct');localStorage.removeItem('hub:pdf-split-hint');}catch(e){} 'ok'" >/dev/null 2>&1

# $1 = trecho do aria-label do botão de resumo na Biblioteca (ex.: 'Aula 01')
open_material_pdf() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Biblioteca')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var bs=[...document.querySelectorAll('button')];var b=bs.find(function(x){return (x.getAttribute('aria-label')||'').indexOf('resumo IA de Matrizes — $1')>=0});if(!b) return 'no-btn';b.click();return 'ok'})()" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d) return 'no-dialog';var b=[...d.querySelectorAll('button')].find(function(x){return (x.textContent||'').trim().indexOf('Abrir PDF')>=0});if(!b) return 'no-pdf-btn';b.click();return 'ok'})()" >/dev/null 2>&1
  sleep 3
}

toggle_split() {
  agent-browser eval "(function(){var dl=[...document.querySelectorAll('[role=dialog]')];for(var i=0;i<dl.length;i++){var t=[...dl[i].querySelectorAll('button')].find(function(x){return (x.textContent||'').indexOf('Tela dividida')>=0});if(t){t.click();return '1'}}return '0'})()" >/dev/null 2>&1
  sleep 2
}

close_dialog() {
  # Clique CONFIÁVEL (CDP) + TENTATIVAS: fechou pode demorar (streaming
  # re-renderizando); conta dialogs depois de cada clique, até 5x.
  for _ in 1 2 3 4 5; do
    agent-browser click '[data-slot=dialog-close]' >/dev/null 2>&1
    sleep 1.2
    N=$(agent-browser eval "document.querySelectorAll('[role=dialog]').length" 2>/dev/null | tr -d '"\\')
    [ "$N" = "0" ] && return 0
  done
}

pane_text() {
  agent-browser eval "(function(){var dl=[...document.querySelectorAll('[role=dialog]')];for(var i=0;i<dl.length;i++){var p=dl[i].querySelector('[data-split-pane=tutor]');if(p) return p.textContent.slice(0,4000)}return 'no-pane'})()" 2>/dev/null | tr -d '"\\'
}

echo "=== [A] A DICA DE ARRASTE: nasce uma vez, morre na interação ==="
open_material_pdf 'Aula 01'
toggle_split
HINT=$(agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');if(!s) return 'no-sep';return JSON.stringify({hint:s.textContent.indexOf('arraste para ajustar')>=0})})()" 2>/dev/null | tr -d '"\\')
echo "$HINT" | grep -q 'hint:true' && ok "1ª vez no dividido: pílula 'arraste para ajustar' no divisor" || bad "dica de arraste não apareceu ($HINT)"
agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');var r=s.parentElement.getBoundingClientRect();var o=function(x){return {bubbles:true,cancelable:true,pointerId:1,clientX:x,clientY:r.top+r.height/2}};s.dispatchEvent(new PointerEvent('pointerdown',o(r.left+r.width*0.5)));s.dispatchEvent(new PointerEvent('pointermove',o(r.left+r.width*0.52)));s.dispatchEvent(new PointerEvent('pointerup',o(r.left+r.width*0.52)));return 'ok'})()" >/dev/null 2>&1
sleep 0.6
HINT2=$(agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');return JSON.stringify({hint:s.textContent.indexOf('arraste')>=0,flag:localStorage.getItem('hub:pdf-split-hint')})})()" 2>/dev/null | tr -d '"\\')
echo "$HINT2" | grep -q 'hint:false' && ok "interagiu → a dica se aposenta na hora" || bad "dica não saiu após o drag ($HINT2)"
echo "$HINT2" | grep -q 'flag:1' && ok "a aposentadoria é para sempre (localStorage)'" || bad "flag da dica não persistiu ($HINT2)"
close_dialog
open_material_pdf 'Aula 01'
HINT3=$(agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');if(!s) return 'no-sep';return s.textContent.indexOf('arraste')>=0?'voltou':'ok'})()" 2>/dev/null | tr -d '"\\')
[ "$HINT3" = "ok" ] && ok "reabrir o diálogo: a dica NÃO volta (missão cumprida)" || bad "dica ressuscitou ($HINT3)"

echo "=== [B] A LEITURA VIVA DO DRAG: % no ponto do gesto ==="
agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');var r=s.parentElement.getBoundingClientRect();var o=function(x){return {bubbles:true,cancelable:true,pointerId:1,clientX:x,clientY:r.top+r.height/2}};s.dispatchEvent(new PointerEvent('pointerdown',o(r.left+r.width*0.5)));s.dispatchEvent(new PointerEvent('pointermove',o(r.left+r.width*0.6)));return 'ok'})()" >/dev/null 2>&1
sleep 0.4
PILL=$(agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');var now=s.getAttribute('aria-valuenow');var pill=s.textContent.indexOf('Material '+now+'%')>=0&&s.textContent.indexOf('Tutor '+(100-Number(now))+'%')>=0;return JSON.stringify({now:now,pill:pill,open:s.textContent.indexOf('arraste')<0})})()" 2>/dev/null | tr -d '"\\')
echo "$PILL" | grep -q 'pill:true' && ok "durante o drag: pílula 'Material N% · Tutor M%' casa com a posição" || bad "pílula de % ausente ou errada ($PILL)"
agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');var r=s.parentElement.getBoundingClientRect();s.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:r.left+r.width*0.6,clientY:r.top+r.height/2}));return 'ok'})()" >/dev/null 2>&1
sleep 0.4
PILL2=$(agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');return s.textContent.indexOf('Material ')>=0?'ficou':'ok'})()" 2>/dev/null | tr -d '"\\')
[ "$PILL2" = "ok" ] && ok "soltou → a pílula some (era leitura do gesto, não enfeite)" || bad "pílula permaneceu após o soltar ($PILL2)"

echo "=== [C] ARIA-VALUETEXT: o leitor de tela lê a PARTILHA ==="
VT=$(agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');var n=Number(s.getAttribute('aria-valuenow'));return n+'|'+s.getAttribute('aria-valuetext')})()" 2>/dev/null | tr -d '"\\')
VTNOW=$(echo "$VT" | cut -d'|' -f1)
VTTEXT=$(echo "$VT" | cut -d'|' -f2-)
[ "$VTTEXT" = "Material $VTNOW% · Tutor $((100 - VTNOW))%" ] && ok "aria-valuetext = 'Material N% · Tutor M%' (número cru virou fala)" || bad "aria-valuetext diverge (now=$VTNOW text='$VTTEXT')"

echo "=== [D] O FIO SOBREVIVE AO FECHAR (a cura central da t144) ==="
# VASSOURA CIRÚRGICA (t147): anota o relógio ANTES da pergunta de teste —
# no fim o script apaga SÓ o que nasceu depois, e a memória real do aluno
# (mesma disciplina no banco compartilhado) fica intocada.
PRE_TURN=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
Q='pergunta de sobrevivencia t144: o que sao matrizes simetricas?'
TYPEOUT=$(agent-browser type '[data-split-pane=tutor] textarea' "$Q" 2>&1)
VAL=$(agent-browser eval "(function(){var ta=document.querySelector('[data-split-pane=tutor] textarea');return ta?ta.value:'no-ta'})()" 2>/dev/null | tr -d '"\\')
echo "$VAL" | grep -q 'sobrevivencia t144' && ok "a pergunta está no campo (digitação real, React onChange vivo)" || bad "digitação não chegou ao campo (val='$VAL' typeout='$TYPEOUT')"
agent-browser press Enter >/dev/null 2>&1
sleep 3
SENT=$(pane_text)
echo "$SENT" | grep -q 'sobrevivencia t144' && ok "pergunta real entrou no fio do painel" || bad "pergunta não apareceu no painel ($SENT)"
# resposta (stream ou erro de provedor — as DUAS provam fim de turno): até 60s
DONE=0
for i in $(seq 1 60); do
  T=$(pane_text)
  if echo "$T" | grep -q 'O tutor está pensando'; then sleep 1; continue; fi
  if echo "$T" | grep -qE 'copiar|via |Tente novamente|tente novamente|⚠'; then DONE=1; break; fi
  sleep 1
done
[ "$DONE" = "1" ] && ok "turno completo no painel (resposta ou fim honesto de erro)" || bad "turno não completou em 60s"
close_dialog
GONE=$(agent-browser eval "(function(){return document.querySelectorAll('[role=dialog]').length})()" 2>/dev/null | tr -d '"\\')
[ "$GONE" = "0" ] && ok "diálogo fechado (a 143 morria aqui)" || bad "diálogo não fechou ($GONE)"
open_material_pdf 'Aula 01'
REVIVED=$(pane_text)
echo "$REVIVED" | grep -q 'sobrevivencia t144' && ok "REABRIU O MESMO PDF: o fio reidratou (a pergunta está lá)" || bad "fio morreu no fechar ($REVIVED)"
echo "$REVIVED" | grep -q 'arraste' && bad "dica de arraste voltou no reabrir (não devia)" || ok "dica continua aposentada no reabrir"
# isolamento: OUTRO material não herda o fio alheio
close_dialog
open_material_pdf 'Aula 00'
OTHER=$(pane_text)
echo "$OTHER" | grep -q 'sobrevivencia t144' && bad "fio VAZOU para outro material ($OTHER)" || ok "outro material nasce LIMPO (cache isolado por material)"
echo "$OTHER" | grep -q 'Me testa' && ok "painel vazio mostra os chips de início (estado vazio honesto)" || bad "chips de início ausentes no painel novo ($OTHER)"
# volta ao material original: o fio continua lá
close_dialog
open_material_pdf 'Aula 01'
BACK=$(pane_text)
echo "$BACK" | grep -q 'sobrevivencia t144' && ok "voltou ao material original: o fio segue vivo na sessão" || bad "fio sumiu ao voltar ($BACK)"
# limpar é limpar: sobrevive ao fechar/abrir também
agent-browser eval "(function(){var b=[...document.querySelectorAll('[data-split-pane=tutor] button')].find(function(x){return (x.getAttribute('aria-label')||'').indexOf('Limpar conversa')>=0});if(!b) return 'no-btn';b.click();return 'ok'})()" >/dev/null 2>&1
sleep 0.6
close_dialog
open_material_pdf 'Aula 01'
CLEAN=$(pane_text)
echo "$CLEAN" | grep -q 'sobrevivencia t144' && bad "limpar não sobreviveu ao fechar ($CLEAN)" || ok "limpou + reabriu: fio zero de verdade (o cache apaga junto)"

echo "=== [E] HIGIENE + CONSOLE ==="
agent-browser eval "try{localStorage.removeItem('hub:pdf-split');localStorage.removeItem('hub:pdf-split-pct');localStorage.removeItem('hub:pdf-split-hint');}catch(e){} 'ok'" >/dev/null 2>&1
close_dialog
CONSOLE=$(qa_console_errors)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"
agent-browser screenshot scripts/qa144-thread-survives.png >/dev/null 2>&1 && ok "screenshot: scripts/qa144-thread-survives.png"
agent-browser close >/dev/null 2>&1
ok "sessão fechada — a frota segue limpa"
# HIGIENE (t147): a pergunta de teste NÃO fica no histórico real do aluno.
SWEEP=$(curl -s -X DELETE "http://localhost:3000/api/tutor/history?discipline=TEC.1984&after=$PRE_TURN" --max-time 15 2>/dev/null | grep -o '"deleted":[0-9]*' | cut -d: -f2)
[ -n "$SWEEP" ] && [ "$SWEEP" -ge 2 ] && ok "histórico limpo após o teste (after=$PRE_TURN → ${SWEEP:-0} msgs de QA apagadas)" || bad "vassoura não confirmou a limpeza (deleted='$SWEEP')"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t144 o fio da dúvida sobrevive (a conversa não morre no X)"
else
  echo "FAIL — t144 (ver fases acima)"
fi
exit $FAIL
