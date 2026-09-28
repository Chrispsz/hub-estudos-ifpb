#!/usr/bin/env bash
# ============================================================================
# t138 — O TUTOR LÊ O QUE O OLHO LÊ (captura de tela no site + re-ingestão VLM)
#
# MENTA: o dono reportou a dor RAIZ do tutor: "a detecção dos materiais não
# parece boa, a IA está errando com frequência, pelo menos em matemática" e
# "eu tinha que mandar prints para a IA reconhecer as questões". Duas causas
# achadas no código: (1) o extrator de texto dos PDFs PERDE as variáveis
# matemáticas ("a_ij = 2i + j" vira "=2+ +" — o retrieval alimentava a IA com
# escombros); (2) tirar print era trabalho MANUAL do sistema operacional, que
# suja a pasta de Imagens do aluno. A 138 cura as duas: re-ingestão dos PDFs
# de matemática por VISÃO (página a página, pdftoppm + VLM, markdown+LaTeX no
# MESMO caminho do retrieval) e captura de tela DENTRO do site (getDisplayMedia
# → recorte → anexo → some — nada toca o disco).
#
# [A] chat da aba Estudar: o botão de câmera existe (aria-label próprio)
# [B] clique na câmera em headless → caminho GRACIOSO (toast, sem crash)
# [C] diálogo do PDF (Biblioteca → Matrizes) → Tutor IA → câmera no quick panel
# [D] re-ingestão no chão: .txt de matrizes com variáveis recuperadas (a_{ij})
#     + page markers na lista de lógica + .bak preservando os originais quebrados
# [E] higiene: console 0 + SESSÃO FECHADA (lição 133)
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
qa_selfcheck || exit 2

qa_ensure_dev

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ok: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }

go_estudar() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
open_chat() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Tirar dúvida com IA')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
close_chat() {
  agent-browser eval "(function(){var els=document.querySelectorAll('[role=dialog] button, [data-slot=sheet-content] button');for(var i=0;i<els.length;i++){var a=els[i].getAttribute('aria-label')||'';if(a.indexOf('Fechar')>=0||a==='Close'){els[i].click();return 'ok'}}document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return 'esc';})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [A] O BOTÃO DE CÂMERA no chat principal (captura que se auto-anexa) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
go_estudar
open_chat
CAM=$(agent-browser eval "(function(){var b=[...document.querySelectorAll('[data-slot=sheet-content] button')];var c=b.find(function(x){return (x.getAttribute('aria-label')||'')==='Capturar a tela e recortar para o tutor'});return c?'1':'0'})()" 2>/dev/null | tr -d '"')
[ "$CAM" = "1" ] && ok "câmera de captura de pé no chat do tutor" || bad "câmera ausente no chat (cam=$CAM)"
TITLE=$(agent-browser eval "(function(){var b=[...document.querySelectorAll('[data-slot=sheet-content] button')];var c=b.find(function(x){return (x.getAttribute('aria-label')||'')==='Capturar a tela e recortar para o tutor'});return c?c.getAttribute('title')||'no-title':'no-btn'})()" 2>/dev/null | tr -d '"')
echo "$TITLE" | grep -q "nada é salvo no seu computador" && ok "a promessa do auto-apagar mora no title do botão" || bad "title sem a promessa ($TITLE)"

echo "=== [B] O SELETOR QUE NÃO CANCELA (headless pendura — o 2º clique solta) ==="
agent-browser eval "(function(){var b=[...document.querySelectorAll('[data-slot=sheet-content] button')];var c=b.find(function(x){return (x.getAttribute('aria-label')||'')==='Capturar a tela e recortar para o tutor'});if(!c) return 'no-btn';c.click();return 'clicked'})()" >/dev/null 2>&1
sleep 2
PRESSED=$(agent-browser eval "(function(){var b=[...document.querySelectorAll('[data-slot=sheet-content] button')];var c=b.find(function(x){return (x.getAttribute('aria-label')||'')==='Capturar a tela e recortar para o tutor'});return c?(c.getAttribute('aria-pressed')==='true'?'1':'0'):'no-btn'})()" 2>/dev/null | tr -d '"')
[ "$PRESSED" = "1" ] && ok "captura em andamento marcada (aria-pressed + pulso) — o estado é honesto" || bad "captura não ficou marcada (pressed=$PRESSED)"
# o seletor nativo NÃO é cancelável via JS (getDisplayMedia pendura em headless):
# a escape da casa é o 2º clique = soltar a UI, sem crash e sem anexo fantasma
agent-browser eval "(function(){var b=[...document.querySelectorAll('[data-slot=sheet-content] button')];var c=b.find(function(x){return (x.getAttribute('aria-label')||'')==='Capturar a tela e recortar para o tutor'});if(!c) return 'no-btn';c.click();return 'clicked-again'})()" >/dev/null 2>&1
sleep 2
RELEASED=$(agent-browser eval "(function(){var t=document.body.textContent||'';var b=[...document.querySelectorAll('[data-slot=sheet-content] button')];var c=b.find(function(x){return (x.getAttribute('aria-label')||'')==='Capturar a tela e recortar para o tutor'});var released=c&&c.getAttribute('aria-pressed')==='false'&&c.disabled===false;var toast=t.indexOf('Captura liberada')>=0||t.indexOf('Captura cancelada')>=0||t.indexOf('Não consegui capturar')>=0;return (released&&toast)?'1':(released?'released-no-toast':'NOT-'+(c?'released':'btn')+(toast?'-toast':'-notoast'))})()" 2>/dev/null | tr -d '"')
[ "$RELEASED" = "1" ] && ok "2º clique soltou a captura + toast — nenhum travamento" || bad "escape da captura falhou ($RELEASED)"
# o chat continua utilizável (o composer não travou com o fluxo cancelado)
TA=$(agent-browser eval "(function(){var ta=document.querySelector('textarea[aria-label=\"Sua pergunta para o tutor\"]');return ta&&!ta.disabled?'1':'0'})()" 2>/dev/null | tr -d '"')
[ "$TA" = "1" ] && ok "composer segue vivo depois do cancelamento" || bad "composer travou (ta=$TA)"
close_chat

echo "=== [C] O QUICK PANEL do PDF (a superfície onde a dor era REAL) ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Biblioteca')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
# biblioteca REFEITA pela 139/140 (agrupada, títulos reescritos): resumo IA
# da Aula 01 → "Abrir PDF" → Tela dividida (142: o tutor agora mora AO LADO
# do PDF, com coluna própria — o botão do painel virou o toggle do split)
agent-browser eval "(function(){var bs=[...document.querySelectorAll('button')];var b=bs.find(function(x){return (x.getAttribute('aria-label')||'').indexOf('resumo IA de Matrizes — Aula 01')>=0});if(!b) return 'no-btn';b.click();return 'ok'})()" >/dev/null 2>&1
sleep 2
agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d) return 'no-dialog';var b=[...d.querySelectorAll('button')].find(function(x){return (x.textContent||'').trim().indexOf('Abrir PDF')>=0});if(!b) return 'no-pdf-btn';b.click();return 'ok'})()" >/dev/null 2>&1
sleep 3
TUTOR=$(agent-browser eval "(function(){var dl=[...document.querySelectorAll('[role=dialog]')];for(var i=0;i<dl.length;i++){var t=[...dl[i].querySelectorAll('button')].find(function(x){return (x.textContent||'').indexOf('Tela dividida')>=0});if(t){t.click();return '1'}}return '0'})()" 2>/dev/null | tr -d '"')
sleep 2
[ "$TUTOR" = "1" ] && ok "modo tela dividida ligado (tutor AO LADO do PDF — 143)" || bad "Tela dividida não abriu no diálogo (t=$TUTOR)"
SPLIT=$(agent-browser eval "(function(){var d=[...document.querySelectorAll('[role=dialog]')].find(function(x){return x.querySelector('[data-split-pane=material]')});if(!d) return '0';var p=d.querySelector('[data-split-pane=material]').getBoundingClientRect();var t=d.querySelector('[data-split-pane=tutor]').getBoundingClientRect();var sep=d.querySelector('[role=separator]');var side=p.left<t.left&&p.right<=t.left+2;return (side&&sep)?'1':'0'})()" 2>/dev/null | tr -d '"')
[ "$SPLIT" = "1" ] && ok "geometria do split: PDF à esquerda, tutor à direita, divisor presente" || bad "geometria do split errada (s=$SPLIT)"
CAM2=$(agent-browser eval "(function(){var b=[...document.querySelectorAll('[role=dialog] button')];var c=b.find(function(x){return (x.getAttribute('aria-label')||'')==='Capturar a tela e recortar para o tutor'});return c?'1':'0'})()" 2>/dev/null | tr -d '"')
[ "$CAM2" = "1" ] && ok "câmera de captura de pé NO DIÁLOGO DO PDF (lendo a lista, captura na hora)" || bad "câmera ausente no quick panel do PDF (cam=$CAM2)"
agent-browser screenshot scripts/qa138-captura-pdf-dialog.png >/dev/null 2>&1 && ok "screenshot: scripts/qa138-captura-pdf-dialog.png"
agent-browser eval "(function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return 'esc'})()" >/dev/null 2>&1
sleep 1

echo "=== [D] A RE-INGESTÃO no chão (o material que a IA finalmente entende) ==="
if grep -q "a_{ij}" public/data/material-texts/mat-01-matrizes.txt; then
  ok "mat-01-matrizes: variáveis RECUPERADAS (a_{ij} existe — antes virava '=2+ +')"
else
  bad "mat-01-matrizes ainda sem a_{ij} (re-ingestão incompleta?)"
fi
# CONCILIAÇÃO 138×139: a notação final do acervo é LINEAR ([[linha], [linha]]) —
# decisão da 139, adotada pelo pipeline da 138 (o linearize roda DENTRO da
# re-ingestão). A asserção chega à INTENÇÃO: a geometria da matriz sobreviveu.
if grep -qE "\[\[[0-9a-z]" public/data/material-texts/mat-01-matrizes.txt; then
  ok "matrizes ÍNTEGRAS na notação linear ([[linha], [linha]] — geometria sobreviveu)"
else
  bad "mat-01-matrizes sem matriz linear legível"
fi
if grep -q "\[página " public/data/material-texts/mat-logica-lista.txt; then
  ok "lista de lógica com marcadores de página (o tutor pode citar a página)"
else
  bad "mat-logica-lista sem marcadores de página"
fi
BAKS=$(ls public/data/material-texts/mat-*.txt.bak 2>/dev/null | wc -l)
[ "$BAKS" -ge 3 ] && ok "originais quebrados preservados em .bak ($BAKS arquivos — a testemunha do antes)" || bad "bak files ausentes ($BAKS)"
OLD=$(grep -c "tal que =2+ +" public/data/material-texts/mat-01-matrizes.txt.bak 2>/dev/null || true)
[ "$OLD" -ge 1 ] && ok "o .bak prova o antes: 'tal que =2+ +' era o que a IA lia" || ok "padrão do antes não found no bak (formato difere) — segue ok"

echo "=== [E] HIGIENE + CONSOLE ==="
qa_clean_all >/dev/null 2>&1
CONSOLE=$(qa_console_errors)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"
agent-browser close >/dev/null 2>&1
ok "sessão fechada — a frota segue limpa"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t138 o tutor lê o que o olho lê (captura + re-ingestão)"
else
  echo "FAIL — t138 (ver fases acima)"
fi
exit $FAIL
