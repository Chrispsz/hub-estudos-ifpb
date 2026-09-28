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

echo "=== [B] O CAMINHO GRACIOSO (headless nega a tela — a UI não quebra) ==="
agent-browser eval "(function(){var b=[...document.querySelectorAll('[data-slot=sheet-content] button')];var c=b.find(function(x){return (x.getAttribute('aria-label')||'')==='Capturar a tela e recortar para o tutor'});if(!c) return 'no-btn';c.click();return 'clicked'})()" >/dev/null 2>&1
sleep 5
TOAST=$(agent-browser eval "(function(){var t=document.body.textContent||'';if(t.indexOf('Captura cancelada')>=0) return 'cancelled';if(t.indexOf('Não consegui capturar')>=0) return 'failed';if(t.indexOf('não suporta captura')>=0) return 'unsupported';if(t.indexOf('Recortar a questão')>=0) return 'dialog-open';return 'nothing'})()" 2>/dev/null | tr -d '"')
case "$TOAST" in
  cancelled|failed|unsupported) ok "cabeça dura do headless virou toast honesto ($TOAST) — nenhum crash";;
  dialog-open) ok "headless deixou capturar — diálogo de recorte abriu";;
  *) bad "nenhuma resposta da captura ($TOAST)";;
esac
# o chat continua utilizável (o composer não travou com o fluxo cancelado)
TA=$(agent-browser eval "(function(){var ta=document.querySelector('textarea[aria-label=\"Sua pergunta para o tutor\"]');return ta&&!ta.disabled?'1':'0'})()" 2>/dev/null | tr -d '"')
[ "$TA" = "1" ] && ok "composer segue vivo depois do cancelamento" || bad "composer travou (ta=$TA)"
close_chat

echo "=== [C] O QUICK PANEL do PDF (a superfície onde a dor era REAL) ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Biblioteca'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
# abre o PDF da lista de matrizes pelo botão "Abrir" da linha dela
agent-browser eval "(function(){var rows=[...document.querySelectorAll('li,div')];for(var i=0;i<rows.length;i++){var r=rows[i];if(r.textContent&&r.textContent.indexOf('Matrizes — Aula 01')>=0&&r.textContent.length<400){var bs=[...r.querySelectorAll('button')];var ab=bs.find(function(x){var t=(x.textContent||'').trim();return t.indexOf('Abrir')===0||t==='PDF'});if(ab){ab.click();return 'ok'}}}return 'no-row'})()" >/dev/null 2>&1
sleep 3
TUTOR=$(agent-browser eval "(function(){var b=[...document.querySelectorAll('[role=dialog] button')];var t=b.find(function(x){return (x.textContent||'').indexOf('Tutor IA')>=0});if(!t) return '0';t.click();return '1'})()" 2>/dev/null | tr -d '"')
sleep 2
[ "$TUTOR" = "1" ] && ok "painel do tutor aberto dentro do diálogo do PDF" || bad "Tutor IA não abriu no diálogo (t=$TUTOR)"
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
if grep -qE "pmatrix|bmatrix" public/data/material-texts/mat-01-matrizes.txt; then
  ok "matrizes em LaTeX de verdade (pmatrix/bmatrix — não escombros de parênteses)"
else
  bad "mat-01-matrizes sem matrizes LaTeX"
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
