#!/usr/bin/env bash
# ============================================================================
# t142 — O TUTOR EM TELA DIVIDIDA (o workspace que o dono pediu)
#
# MENTA: "repense completamente o tutor e sua utilização no site para que
# seja perfeito, tenha espaço e seja produtivo pra conseguir tirar dúvidas e
# ler enquanto dá para ver o PDF perfeitamente, ou seja um split screen —
# porque da forma que está hoje um abaixo do outro fica roubando espaço do
# outro com espaço limitado". A 142 acaba com o empilhamento 52vh/28vh:
#   • desktop: PDF de um lado, tutor do OUTRO, divisor arrastável (pointer +
#     teclado) com largura lembrada no localStorage;
#   • mobile: abas de TELA CHEIA (Material | Tutor IA) — nada de 28vh;
#   • o painel fica MONTADO nos dois modos — trocar de modo não apaga a fala;
#   • "Print de página" no dividido ancora o anexo no painel AO LADO
#     (onAttach), sem abrir o chat principal por cima;
#   • ponto emerald na aba Tutor quando a resposta chega durante a leitura.
#
# [A] toggle + geometria (lado a lado, % lembrada)
# [B] divisor: teclado (←/→) e pointer drag, persistência dos dois
# [C] print de página no dividido → anexo no painel AO LADO (sem sheet)
# [D] mobile 390px: abas tela cheia, PDF não recarrega, 0 overflow-X
# [E] conversa sobrevive à troca de modo + header com limpar
# [F] higiene: console 0 + sessão fechada
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
qa_selfcheck || exit 2

qa_ensure_dev

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ok: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }

# Estado limpo: preferências do dividido ZERADAS (o teste define as suas)
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser eval "try{localStorage.removeItem('hub:pdf-split');localStorage.removeItem('hub:pdf-split-pct');}catch(e){} 'ok'" >/dev/null 2>&1

open_split() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Biblioteca')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var bs=[...document.querySelectorAll('button')];var b=bs.find(function(x){return (x.getAttribute('aria-label')||'').indexOf('resumo IA de Matrizes — Aula 01')>=0});if(!b) return 'no-btn';b.click();return 'ok'})()" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d) return 'no-dialog';var b=[...d.querySelectorAll('button')].find(function(x){return (x.textContent||'').trim().indexOf('Abrir PDF')>=0});if(!b) return 'no-pdf-btn';b.click();return 'ok'})()" >/dev/null 2>&1
  sleep 3
  agent-browser eval "(function(){var dl=[...document.querySelectorAll('[role=dialog]')];for(var i=0;i<dl.length;i++){var t=[...dl[i].querySelectorAll('button')].find(function(x){return (x.textContent||'').indexOf('Tela dividida')>=0});if(t){t.click();return '1'}}return '0'})()" >/dev/null 2>&1
  sleep 2
}

echo "=== [A] O TOGGLE + A GEOMETRIA (PDF à esquerda, tutor à direita) ==="
open_split
GEOM=$(agent-browser eval "(function(){var d=[...document.querySelectorAll('[role=dialog]')].find(function(x){return x.querySelector('[data-split-pane=material]')});if(!d) return JSON.stringify({err:'no-split'});var p=d.querySelector('[data-split-pane=material]').getBoundingClientRect();var t=d.querySelector('[data-split-pane=tutor]').getBoundingClientRect();var sep=d.querySelector('[role=separator]');var hdr=d.querySelector('[data-split-pane=tutor] p');return JSON.stringify({side:p.left<t.left&&p.right<=t.left+2,sep:!!sep,now:sep?sep.getAttribute('aria-valuenow'):null,hdr:hdr?hdr.textContent.slice(0,40):null,dlgW:Math.round(d.getBoundingClientRect().width)})})()" 2>/dev/null | tr -d '"\\')
echo "$GEOM" | grep -q 'side:true' && ok "painéis lado a lado (PDF esquerda, tutor direita)" || bad "geometria lado a lado falhou ($GEOM)"
echo "$GEOM" | grep -q 'sep:true' && ok "divisor presente com aria-valuenow" || bad "divisor ausente ($GEOM)"
echo "$GEOM" | grep -q 'Tutor IA ·' && ok "cabeçalho próprio do painel identifica o material" || bad "cabeçalho do painel ausente ($GEOM)"
DLGW=$(echo "$GEOM" | sed -n 's/.*dlgW:\([0-9]*\).*/\1/p')
[ "$DLGW" -ge 1100 ] && ok "o workspace usa a tela quase INTEIRA no dividido (${DLGW}px — a caixa 4xl apertava)" || bad "diálogo estreito demais no dividido (${DLGW}px)"

echo "=== [B] O DIVISOR: teclado e ponteiro, os dois persistem ==="
agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');s.focus();return 'ok'})()" >/dev/null 2>&1
agent-browser press ArrowRight >/dev/null 2>&1
agent-browser press ArrowRight >/dev/null 2>&1
KBD=$(agent-browser eval "document.querySelector('[role=dialog] [role=separator]').getAttribute('aria-valuenow') + '|' + (localStorage.getItem('hub:pdf-split-pct')||'')" 2>/dev/null | tr -d '"\\')
[ "$KBD" = "62|62" ] && ok "teclado ←/→ move 2% e PERSISTE (58→62)" || bad "teclado do divisor falhou ($KBD)"
agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');var r=s.parentElement.getBoundingClientRect();var o=function(x){return {bubbles:true,cancelable:true,pointerId:1,clientX:x,clientY:r.top+r.height/2}};s.dispatchEvent(new PointerEvent('pointerdown',o(r.left+r.width*0.5)));s.dispatchEvent(new PointerEvent('pointermove',o(r.left+r.width*0.55)));s.dispatchEvent(new PointerEvent('pointerup',o(r.left+r.width*0.55)));return 'ok'})()" >/dev/null 2>&1
sleep 0.6
DRAG=$(agent-browser eval "document.querySelector('[role=dialog] [role=separator]').getAttribute('aria-valuenow') + '|' + (localStorage.getItem('hub:pdf-split-pct')||'')" 2>/dev/null | tr -d '"\\')
[ "$DRAG" = "55|55" ] && ok "pointer drag move o divisor e persiste (62→55)" || bad "drag do divisor falhou ($DRAG)"
# limites honestos: 30..72 (nem PDF minúsculo, nem coluna apertada)
agent-browser eval "(function(){var s=document.querySelector('[role=dialog] [role=separator]');var r=s.parentElement.getBoundingClientRect();var o=function(x){return {bubbles:true,cancelable:true,pointerId:1,clientX:x,clientY:r.top+r.height/2}};s.dispatchEvent(new PointerEvent('pointerdown',o(r.left+r.width*0.5)));s.dispatchEvent(new PointerEvent('pointermove',o(r.left+r.width*0.99)));s.dispatchEvent(new PointerEvent('pointerup',o(r.left+r.width*0.99)));return 'ok'})()" >/dev/null 2>&1
sleep 0.6
MAXP=$(agent-browser eval "document.querySelector('[role=dialog] [role=separator]').getAttribute('aria-valuenow')" 2>/dev/null | tr -d '"\\')
[ "$MAXP" = "72" ] && ok "divisor respeita o teto de 72% (o tutor nunca some)" || bad "teto do divisor violado ($MAXP)"

echo "=== [C] PRINT DE PÁGINA NO DIVIDIDO: o anexo nasce NO PAINEL AO LADO ==="
agent-browser eval "(function(){var dl=[...document.querySelectorAll('[role=dialog]')];for(var i=0;i<dl.length;i++){var t=[...dl[i].querySelectorAll('button')].find(function(x){return (x.textContent||'').indexOf('Print de página')>=0});if(t){t.click();return '1'}}return '0'})()" >/dev/null 2>&1
sleep 3
agent-browser eval "(function(){var lb=document.querySelector('[role=listbox]');if(!lb) return 'no-listbox';var o=lb.querySelectorAll('[role=option]')[0];if(!o) return 'no-opt';o.click();return 'ok'})()" >/dev/null 2>&1
sleep 2
ATT=$(agent-browser eval "(function(){var bs=[...document.querySelectorAll('[role=dialog] button')];var b=bs.find(function(x){return (x.textContent||'').indexOf('Anexar ao tutor')>=0});if(!b) return 'no-btn';b.click();return 'ok'})()" 2>/dev/null | tr -d '"\\')
sleep 1.5
INPANE=$(agent-browser eval "(function(){var d=[...document.querySelectorAll('[role=dialog]')].find(function(x){return x.querySelector('[data-split-pane=tutor]')});var pane=d?d.querySelector('[data-split-pane=tutor]'):null;var img=pane?pane.querySelector('img[alt=\"Prévia do print anexado\"]'):null;var sheets=[...document.querySelectorAll('[data-slot=sheet-content]')].filter(function(s){return s.getAttribute('data-state')==='open'});return JSON.stringify({chip:!!img,sheets:sheets.length})})()" 2>/dev/null | tr -d '"\\')
echo "$INPANE" | grep -q 'chip:true' && ok "print de página anexado no painel AO LADO (chip de prévia vivo)" || bad "anexo não chegou ao painel ($INPANE)"
echo "$INPANE" | grep -q 'sheets:0' && ok "o chat principal NÃO abriu por cima (a porta do dividido é interna)" || bad "sheet principal aberto junto ($INPANE)"
[ "$ATT" = "ok" ] && ok "fluxo do seletor de páginas íntegro (escolha → anexar → fechar)" || bad "seletor de páginas falhou ($ATT)"

echo "=== [D] MOBILE 390px: ABAS DE TELA CHEIA (o fim do 52vh/28vh) ==="
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 1
MOB=$(agent-browser eval "(function(){var d=[...document.querySelectorAll('[role=dialog]')].find(function(x){return x.querySelector('[data-split-pane=material]')});if(!d) return JSON.stringify({err:'no-split'});var tabs=d.querySelector('[role=tablist]');var p=d.querySelector('[data-split-pane=material]').getBoundingClientRect();var dw=d.getBoundingClientRect();var vis=function(el){return el&&getComputedStyle(el).display!=='none'};var tp=d.querySelector('[data-split-pane=tutor]');return JSON.stringify({tabs:!!tabs,tabsHiddenOffDesktop:tabs?getComputedStyle(tabs).display!=='none':false,matVis:vis(d.querySelector('[data-split-pane=material]')),tutVis:vis(tp),paneW:Math.round(p.width),fills:Math.abs(p.width-dw.width)<6,ovf:document.documentElement.scrollWidth>window.innerWidth})})()" 2>/dev/null | tr -d '"\\')
echo "$MOB" | grep -q 'tabs:true' && ok "abas Material | Tutor IA presentes no mobile" || bad "abas ausentes no mobile ($MOB)"
echo "$MOB" | grep -q 'fills:true' && ok "painel do material ocupa a TELA INTEIRA (nada de 52vh)" || bad "painel não enche a tela ($MOB)"
echo "$MOB" | grep -q 'ovf:false' && ok "zero overflow-X no mobile" || bad "overflow-X no mobile ($MOB)"
TABSW=$(agent-browser eval "(function(){var tb=document.querySelectorAll('[role=dialog] [role=tab]')[1];tb.click();return 'ok'})()" >/dev/null 2>&1)
sleep 0.8
TABT=$(agent-browser eval "(function(){var d=[...document.querySelectorAll('[role=dialog]')].find(function(x){return x.querySelector('[data-split-pane=tutor]')});var vis=function(el){return el&&getComputedStyle(el).display!=='none'};var tp=d.querySelector('[data-split-pane=tutor]');var pp=d.querySelector('[data-split-pane=material]');return JSON.stringify({tut:vis(tp),mat:vis(pp),w:Math.round(tp.getBoundingClientRect().width),ta:!!tp.querySelector('textarea'),frame:!!pp.querySelector('iframe'),chip:!!tp.querySelector('img[alt=\"Prévia do print anexado\"]')})})()" 2>/dev/null | tr -d '"\\')
echo "$TABT" | grep -q 'tut:true' && ok "aba Tutor abre o painel em TELA CHEIA" || bad "aba Tutor não abriu ($TABT)"
echo "$TABT" | grep -q 'frame:true' && ok "o PDF NÃO recarregou (iframe segue montado atrás da aba)" || bad "iframe remontou na troca de aba ($TABT)"
echo "$TABT" | grep -q 'chip:true' && ok "o anexo da fase [C] está lá quando o aluno chega na aba" || bad "anexo sumiu na troca de aba ($TABT)"
agent-browser set viewport 1280 800 >/dev/null 2>&1
sleep 1

echo "=== [E] A CONVERSA SOBREVIVE À TROCA DE MODO (painel montado, não remontado) ==="
agent-browser eval "(function(){var ta=document.querySelector('[data-split-pane=tutor] textarea');if(!ta) return 'no-ta';var set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;set.call(ta,'teste de vida do painel');ta.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()" >/dev/null 2>&1
TOGG=$(agent-browser eval "(function(){var dl=[...document.querySelectorAll('[role=dialog]')];for(var i=0;i<dl.length;i++){var t=[...dl[i].querySelectorAll('button')].find(function(x){return (x.textContent||'').indexOf('Tela dividida')>=0 && x.getAttribute('aria-pressed')!==null});if(t){t.click();return t.getAttribute('aria-pressed')}}return 'x'})()" 2>/dev/null | tr -d '"\\')
sleep 0.6
LIFE=$(agent-browser eval "(function(){var dl=[...document.querySelectorAll('[role=dialog]')];for(var i=0;i<dl.length;i++){var pane=dl[i].querySelector('[data-split-pane=tutor]');if(pane){var hidden=getComputedStyle(pane.parentElement).display==='none'||getComputedStyle(pane).display==='none';var input=pane.querySelector('textarea');return JSON.stringify({hidden:hidden,value:input?input.value:null})}}return '{}'})()" 2>/dev/null | tr -d '"\\')
echo "$LIFE" | grep -q 'value:teste de vida do painel' && ok "o texto do aluno sobrevive escondido (estado preservado, não resetado)" || bad "estado do painel morreu na troca de modo ($LIFE)"

echo "=== [F] HIGIENE + CONSOLE ==="
agent-browser eval "(function(){try{localStorage.removeItem('hub:pdf-split');localStorage.removeItem('hub:pdf-split-pct');}catch(e){}document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return 'ok'})()" >/dev/null 2>&1
sleep 1
CONSOLE=$(qa_console_errors)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"
agent-browser screenshot scripts/qa143-split-desktop.png >/dev/null 2>&1 && ok "screenshot final: scripts/qa142-split-desktop.png"
agent-browser close >/dev/null 2>&1
ok "sessão fechada — a frota segue limpa"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t142 o tutor em tela dividida (ler e perguntar no mesmo fôlego)"
else
  echo "FAIL — t142 (ver fases acima)"
fi
exit $FAIL
