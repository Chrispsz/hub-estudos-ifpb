#!/usr/bin/env bash
# ============================================================================
# T136-E2E — O CARTÃO LEMBRA DE ONDE VEIO (a origem no baralho)
#
# A 134 levou o erro ao baralho e a 135 pôs o botão na mesa do erro — mas o
# cartão, depois de nascido, ficava MUDO sobre a origem: na fila de revisão
# ele era indistinguível de um cartão manual qualquer. A 136 fecha o ciclo:
# (1) o badge 'caderno' na lista (o par do badge 'IA'); (2) o chip 'do
# caderno de erros' na FRENTE do cartão durante a sessão; (3) o recibo amber
# no debriefing — 'N destes erros nasceram do caderno' — com a porta 'Abrir
# o caderno' (openProgress, a MESMA porta da 131), o inverso exato da
# semente. Regra 88: sem erro-nascido-do-caderno na sessão, o recibo cala.
#
# [A] lista: badge 'caderno' SÓ no cartão com fromMistake (o manual não o tem)
# [B] sessão: chip 'do caderno de erros' na frente do A; NADA na frente do B
#     (Errei re-enfileira — o fluxo real da véspera: 2×Errei, 2×Bom)
# [C] recibo: '1 destes erros nasceu do caderno' + 'Abrir o caderno' → o
#     app POUSA na aba Progresso, no Caderno de Erros (a porta LEVA)
# [D] regra 88: sessão sem erro-nascido-do-caderno → recibo CALA (nada no DOM)
# [E] higiene: chão limpo e VERIFICADO + console 0 + SESSÃO FECHADA (lição 133)
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"

STORE='hub-estudos-ifpb:v2'

ok() { qa_ok "$1"; }
bad() { qa_bad "$1"; }
has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
click_btn() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){if(n===$2){els[i].click();return 'ok'}n++}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
badge_count() { # badges [data-slot=badge] com o texto pedido
  agent-browser eval "(function(){var els=document.querySelectorAll('[data-slot=badge]');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.replace(/\s+/g,' ').indexOf('$1')>=0)n++}return n})()" 2>/dev/null | tr -d '"'
}
chip_on_front() { # o chip de origem visível NA FRENTE do cartão da sessão
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('do caderno de erros')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
seed_cards() { # A: nascido do erro (fromMistake) · B: manual puro — MESMO resto, só a origem muda
  # UMA LINHA (a lição da 136: fragmentos com {a,b} FORA de assoalhos disparam
  # a expansão de chaves do bash e rasgam o JS ao meio)
  local JS="(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.flashcards=[{id:'fc-t136-a',disciplineCode:'TEC.1984',front:'Cartão do erro A — operações com matrizes',back:'A resposta do acervo',source:'manual',createdAt:'2025-01-01T09:00:00.000Z',box:0,dueAt:'2025-01-01T10:00:00.000Z',reviews:0,lapses:0,fromMistake:'ex:mat-ex01'},{id:'fc-t136-b',disciplineCode:'TEC.1984',front:'Cartão manual B — lógica de proposições',back:'Resposta manual',source:'manual',createdAt:'2025-01-01T09:00:00.000Z',box:0,dueAt:'2025-01-01T11:00:00.000Z',reviews:0,lapses:0}];var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok 2 cartoes'})()"
  agent-browser eval "$JS" 2>/dev/null | tr -d '"'
}
seed_manual_only() {
  local JS="(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.flashcards=[{id:'fc-t136-c',disciplineCode:'TEC.1984',front:'Cartão manual C — só o manual, sem origem',back:'Resposta C',source:'manual',createdAt:'2025-01-01T09:00:00.000Z',box:0,dueAt:'2025-01-01T11:00:00.000Z',reviews:0,lapses:0}];var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok 1 cartao'})()"
  agent-browser eval "$JS" 2>/dev/null | tr -d '"'
}
go_flashcards() { # 'Praticar' na sidebar; Flashcards é tab Radix (lição 125/135)
  local REF
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Praticar')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 3
    for k in 1 2 3 4 5; do
      [ "$(has 'Novo cartão')" = "1" ] && return 0
      REF=$(agent-browser snapshot 2>/dev/null | grep -o 'tab "Flashcards.*ref=e[0-9]*\]' | grep -oE 'e[0-9]+' | tail -1)
      [ -n "$REF" ] && agent-browser click "$REF" >/dev/null 2>&1
      sleep 2
      [ "$(has 'Novo cartão')" = "1" ] && return 0
    done
  done
  return 1
}
start_review() { # 'Revisar agora' + pouso REAL da sessão (poll 'na fila' — o
  # botão pode existir desabilitado: o click não basta, o ESTADO é a prova)
  local R
  R=$(click_btn 'Revisar agora' 0)
  for k in 1 2 3 4 5; do
    [ "$(has 'na fila')" = "1" ] && return 0
    R=$(click_btn 'Revisar agora' 0)
    sleep 1
  done
  return 1
}
flip_card() { # a frente é um botão ('Mostrar resposta') — o clique vira o cartão
  local R
  for k in 1 2 3; do
    R=$(click_btn 'Mostrar resposta' 0)
    [ "$R" = "ok" ] && { sleep 1; return 0; }
    sleep 1
  done
  return 1
}
grade() { # $1 = 'Errei'|'Bom' — o botão da nota SÓ EXISTE depois do flip
  local R
  flip_card || return 1
  for k in 1 2 3; do
    R=$(click_btn "$1" 0)
    [ "$R" = "ok" ] && { sleep 1; return 0; }
    sleep 1
  done
  return 1
}

qa_ensure_dev
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000
agent-browser close 2>/dev/null || true
sleep 1

echo "=== [A] A LISTA: badge 'caderno' só no cartão nascido do erro ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 1
qa_clean_all >/dev/null 2>&1
SEED=$(seed_cards); sleep 2
echo "  seed: $SEED"
if go_flashcards; then ok "Flashcards pousou"; else bad "Flashcards não pousou"; fi
A1=$(has 'Cartão do erro A'); A2=$(has 'Cartão manual B')
[ "$A1" = "1" ] && [ "$A2" = "1" ] && ok "os 2 cartões seedados estão na lista" || bad "lista não hidratou (A=$A1 B=$A2)"
NB=$(badge_count 'caderno')
[ "$NB" = "1" ] && ok "badge 'caderno' aparece EXATAMENTE 1× (só no A)" || bad "badge 'caderno' = $NB (esperado 1)"
NIA=$(badge_count 'IA')
[ "$NIA" = "0" ] && ok "nenhum badge 'IA' (fonte manual) — a origem não mente" || echo "  (info) badge IA=$NIA"
agent-browser screenshot /tmp/qa136-lista.png >/dev/null 2>&1

echo "=== [B] A SESSÃO: chip 'do caderno de erros' na frente do A, nada no B ==="
if start_review; then ok "sessão iniciou (Revisar agora)"; else bad "sessão não iniciou"; fi
sleep 1
# fila: A primeiro (dueAt mais antigo — o seletor ordena pelo vencimento)
C1=$(chip_on_front)
FA=$(has 'Cartão do erro A')
[ "$C1" = "1" ] && [ "$FA" = "1" ] && ok "frente do A mostra o chip 'do caderno de erros'" || bad "frente do A sem chip (chip=$C1 cartão=$FA)"
agent-browser screenshot /tmp/qa136-chip-front.png >/dev/null 2>&1
grade 'Errei' >/dev/null
sleep 1
FB=$(has 'Cartão manual B'); C2=$(chip_on_front)
[ "$FB" = "1" ] && [ "$C2" = "0" ] && ok "frente do B está MUDA sobre origem (manual não inventa)" || bad "B: cartão=$FB chip=$C2 (esperado 1/0)"
grade 'Errei' >/dev/null
grade 'Bom' >/dev/null
grade 'Bom' >/dev/null
sleep 1
FIN=$(has 'Sessão concluída')
[ "$FIN" = "1" ] && ok "fluxo real 2×Errei + 2×Bom fecha a sessão" || bad "sessão não fechou"

echo "=== [C] O RECIBO: '1 destes erros nasceu do caderno' + a porta LEVA ==="
R1=$(has 'destes erros nasceu do caderno')
[ "$R1" = "1" ] && ok "recibo da origem no debriefing (singular, 1)" || bad "recibo ausente"
RT=$(has 'Abrir o caderno')
[ "$RT" = "1" ] && ok "porta 'Abrir o caderno' presente" || bad "porta ausente"
agent-browser screenshot /tmp/qa136-recibo.png >/dev/null 2>&1
PB=$(click_btn 'Abrir o caderno' 0); sleep 3
CAD=$(has 'Caderno de Erros')
[ "$PB" = "ok" ] && [ "$CAD" = "1" ] && ok "a porta LEVA: o app pousou no Caderno de Erros (aba Progresso)" || bad "porta não levou (pb=$PB caderno=$CAD)"

echo "=== [D] A REGRA 88: sem erro-nascido-do-caderno, o recibo CALA ==="
agent-browser close 2>/dev/null; sleep 3   # sessão nova — lição 133
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
qa_clean_all >/dev/null 2>&1
SM=$(seed_manual_only); sleep 2
echo "  seed: $SM"
if go_flashcards; then ok "Flashcards pousou (2ª rodada)"; else bad "Flashcards não pousou (2ª)"; fi
if start_review; then ok "sessão iniciou (2ª rodada)"; else bad "sessão não iniciou (2ª)"; fi
grade 'Errei' >/dev/null   # re-enfileira
grade 'Bom' >/dev/null
sleep 1
F2=$(has 'Sessão concluída')
[ "$F2" = "1" ] && ok "sessão fechou (Errei + Bom)" || bad "sessão 2 não fechou"
R2=$(has 'destes erros nasceu')
[ "$R2" = "0" ] && ok "regra 88: recibo CALA quando nenhum erro nasceu do caderno" || bad "recibo apareceu sem direito (regra 88 violada)"
T2=$(has 'Abrir o caderno')
[ "$T2" = "0" ] && ok "porta também cala (a casa não abre porta para lugar nenhum)" || bad "porta órfã no DOM"

echo "=== [E] HIGIENE: chão limpo e verificado + console 0 + sessão fechada ==="
qa_clean_all >/dev/null 2>&1
qa_hygiene_check
CE=$(qa_console_errors)
[ "$CE" = "0" ] && ok "console 0 erros" || bad "console: $CE"
agent-browser close >/dev/null 2>&1
echo "  sessão fechada (lição 133)"

exit $QA_FAIL
