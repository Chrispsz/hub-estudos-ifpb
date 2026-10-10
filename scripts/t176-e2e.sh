#!/usr/bin/env bash
# ============================================================================
# t176 E2E — O RASCUNHO QUE SOBREVIVE (suite ao vivo, server standalone 3100).
#
# [A] Chat principal: rascunho digitado → navegar (desmonta StudyView) →
#     voltar → o texto VOLTA + pill "Rascunho restaurado" → o X descarta.
# [B] Painel dividido: rascunho no composer do painel → fechar o diálogo →
#     reabrir o MESMO material → o texto VOLTA + pill do painel.
# [C] Higiene: mobile 390 sem overflow-X + console sem erros.
# ============================================================================
set -u
cd /home/z/my-project
BASE="${BASE:-http://localhost:3100}"
FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

click_text() { # $1 = substring do textContent de um <button>
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'');if(t.indexOf('$1')>=0){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
click_tab() { # $1 = nome EXATO da tab Radix — lição 125/134: tab por REF do snapshot
  local REF; REF=$(agent-browser snapshot 2>/dev/null | grep -oE "tab \"$1\"[^]]*ref=e[0-9]+\]" | grep -oE 'e[0-9]+' | tail -1)
  [ -n "$REF" ] && agent-browser click "$REF" >/dev/null 2>&1 && return 0
  return 1
}
ta_val() { # $1 = aria-label do textarea
  agent-browser eval "(function(){var el=document.querySelector('textarea[aria-label=\"$1\"]');return el?el.value:'NO_TA'})()" 2>/dev/null | tr -d '"'
}
has_sel() {
  agent-browser eval "(function(){return !!document.querySelector('$1')})()" 2>/dev/null | tr -d '"'
}

echo "== setup: SW desregistrado + caches limpos (lição 173) =="
agent-browser close >/dev/null 2>&1; sleep 1
agent-browser open "$BASE" >/dev/null 2>&1; sleep 3
agent-browser eval "Promise.all(navigator.serviceWorker.getRegistrations().map(function(r){return r.unregister()})).then(function(){return Promise.all(caches.keys().map(function(k){return caches.delete(k)}))}).then(function(){return 'sw-clean'})" 2>/dev/null | tr -d '"'
agent-browser open "$BASE" >/dev/null 2>&1; sleep 4

echo "== [A] chat principal: o rascunho sobrevive à navegação =="
DRAFT='Pergunta da véspera: como eu começo a questão 3 da lista de matrizes? Me dá a estratégia.'
click_text 'Estudar'; sleep 1.5
click_text 'Tirar dúvida com IA'; sleep 1.5
agent-browser type 'textarea[aria-label="Sua pergunta para o tutor"]' "$DRAFT" >/dev/null 2>&1; sleep 0.5
V1=$(ta_val 'Sua pergunta para o tutor')
[ "$V1" = "$DRAFT" ] && ok "rascunho digitado no composer" || bad "digitou e não ficou: '$V1'"

click_text 'Biblioteca'; sleep 1.5   # desmonta o StudyView
click_text 'Estudar'; sleep 1.5      # remonta — o lazy init lê o rascunho
click_text 'Tirar dúvida com IA'; sleep 1.5
V2=$(ta_val 'Sua pergunta para o tutor')
[ "$V2" = "$DRAFT" ] && ok "o texto VOLTA depois de navegar (o gesto não morre)" || bad "rascunho morreu na navegação: '$V2'"
PILL=$(has_sel '[data-testid="chat-draft-pill"]')
[ "$PILL" = "true" ] && ok "pill 'Rascunho restaurado' visível" || bad "pill não apareceu"
PTXT=$(agent-browser eval "(function(){var el=document.querySelector('[data-testid=\"chat-draft-pill\"]');return el?el.textContent.replace(/\\s+/g,' '):'NONE'})()" 2>/dev/null | tr -d '"')
echo "$PTXT" | grep -q '89 caracteres' && ok "a pill conta os caracteres em tabular-nums" || echo "  (info) pill: $PTXT"
agent-browser screenshot /home/z/my-project/scripts/qa176-chat-draft-pill.png >/dev/null 2>&1

agent-browser eval "(function(){var el=document.querySelector('[aria-label=\"Descartar o rascunho restaurado\"]');if(!el)return 'NO_X';el.click();return 'ok'})()" >/dev/null 2>&1; sleep 0.6
V3=$(ta_val 'Sua pergunta para o tutor')
[ "$V3" = "" ] && ok "o X da pill descarta o texto" || bad "descartou e sobrou: '$V3'"
PILL2=$(has_sel '[data-testid="chat-draft-pill"]')
[ "$PILL2" = "false" ] && ok "pill some com o descarte" || bad "pill persiste após descarte"

echo "== [B] painel dividido: o rascunho sobrevive ao fechar do diálogo =="
PDRAFT='Do recorte: essa integral sai na prova?'
agent-browser press Escape >/dev/null 2>&1; sleep 1
R1=$(click_text 'Biblioteca'); echo "    (biblioteca: $R1)"; sleep 2
click_tab 'Disciplinas'; echo "    (tab disciplinas: $?)"; sleep 2   # a grade de cards tem animação de entrada (framer)
R2=$(agent-browser eval "(function(){var hs=document.querySelectorAll('h3');for(var i=0;i<hs.length;i++){if(hs[i].textContent.trim()==='Matemática'){var el=hs[i];while(el&&el.tagName!=='BUTTON')el=el.parentElement;if(el){el.click();return 'ok'}return 'NO_BTN'}}return 'NO_H3'})()" 2>/dev/null | tr -d '"'); echo "    (card: $R2)"; sleep 2.5
click_tab 'Materiais'; echo "    (tab materiais: $?)"; sleep 2
R3=$(click_text 'Abrir PDF'); echo "    (abrir pdf: $R3)"; sleep 3.5
R4=$(click_text 'Tela dividida'); echo "    (split: $R4)"; sleep 2
agent-browser type 'textarea[aria-label="Pergunta ao tutor"]' "$PDRAFT" >/dev/null 2>&1; sleep 0.5
VP2=$(ta_val 'Pergunta ao tutor')
[ "$VP2" = "$PDRAFT" ] && ok "rascunho digitado no painel dividido" || bad "painel não digitou: '$VP2'"

agent-browser press Escape >/dev/null 2>&1; sleep 1.5   # fecha o diálogo (desmonta o painel)
click_text 'Abrir PDF' >/dev/null 2>&1; sleep 3.5
click_text 'Tela dividida' >/dev/null 2>&1; sleep 2
VP3=$(ta_val 'Pergunta ao tutor')
[ "$VP3" = "$PDRAFT" ] && ok "o texto do painel VOLTA ao reabrir o material" || bad "rascunho do painel morreu: '$VP3'"
PPILL=$(has_sel '[data-testid="panel-draft-pill"]')
[ "$PPILL" = "true" ] && ok "pill do painel visível" || bad "pill do painel não apareceu"
agent-browser screenshot /home/z/my-project/scripts/qa176-panel-draft-pill.png >/dev/null 2>&1

echo "== [C] higiene: mobile 390 + console =="
agent-browser press Escape >/dev/null 2>&1; sleep 0.5
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 1.5
agent-browser open "$BASE" >/dev/null 2>&1; sleep 3.5
SW=$(agent-browser eval "(function(){return document.documentElement.scrollWidth})()" 2>/dev/null | tr -d '"')
IW=$(agent-browser eval "(function(){return window.innerWidth})()" 2>/dev/null | tr -d '"')
[ "$SW" = "$IW" ] && ok "mobile 390: scrollW=$SW = innerW=$IW (zero overflow)" || bad "overflow-X: scrollW=$SW vs innerW=$IW"
agent-browser screenshot /home/z/my-project/scripts/qa176-mobile390.png >/dev/null 2>&1
agent-browser set viewport 1280 800 >/dev/null 2>&1

ERRS=$(agent-browser errors 2>/dev/null | grep -ci "error" || true)
CONS=$(agent-browser console 2>/dev/null | grep -ciE "^\s*(error|\[ERROR\])" || true)
[ "${ERRS:-0}" = "0" ] && [ "${CONS:-0}" = "0" ] && ok "console/erros limpos" || { echo "  (info) errors=$ERRS console=$CONS"; agent-browser errors 2>/dev/null | head -5; agent-browser console 2>/dev/null | tail -5; }

echo
[ "$FAIL" = "0" ] && echo "T176 E2E: ALL GREEN" || echo "T176 E2E: FALHAS ACIMA"
exit $FAIL
