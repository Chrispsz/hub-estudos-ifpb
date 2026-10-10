#!/usr/bin/env bash
# ============================================================================
# t135 — O CARTÃO NO CADERNO (a ponte da 134 no lugar onde o erro mora)
#
# MENTA: a 134 entregou a ponte erro→cartão na faixa dos flashcards (o lugar
# da PROMESSA) e no seletor do diálogo; o caderno — onde o erro VIVE — seguia
# sem caminho de 1 clique. O chip amber por item (Layers) leva o erro ao
# baralho num clique: frente = enunciado completo, verso = hint do acervo.
# HONESTIDADE: (1) só itens COM hint têm o chip — sem verso no acervo o cartão
# nasceria oco (esses seguem para o seletor do diálogo, onde o verso é escrito
# pelo aluno); (2) o cardado ganha o recibo 'no baralho' e o chip se aposenta
# (dedupe pela fonte — fromMistake); (3) revisado não oferece cartão (revisar
# duas vezes o mesmo cansaço). A criação usa a FORMA CANÔNICA movida para a
# lib (newCardFields exportado — zero segunda derivação do shape do cartão).
#
# [A] 3 pendências (ex01/ex02 com hint, 001 sem) → 2 chips amber; 001 sem chip
# [B] clique no chip do ex01 → card no storage com fromMistake + recibo
#     'no baralho' na linha + chip se aposenta (resta 1)
# [C] o seletor do diálogo (flashcards) ainda oferece os 2 restantes — o
#     hintless 001 chega pela ponte da 134
# [D] higiene VERIFICADA no chão real + console 0 + sessão fechada (lição 133)
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
qa_selfcheck || exit 2   # lib não carregou = asserções somem = ALL GREEN falso

qa_ensure_dev

# A suíte não usa mock (o chip não tem porta de data) — mas PRECISA de página:
# a rodada anterior fechou a sessão, e eval contra browser fechado é silêncio.
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 5

seed_mistakes() { # $@ = ids sem 'mat-' — pendências TEC.1984 com par no acervo
  local JS="(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.exerciseProgress=p.exerciseProgress||{};"
  for n in "$@"; do
    JS="$JS p.exerciseProgress['mat-$n']={tried:true,solved:false,neededHelp:false,lastPracticedAt:'2026-09-28T15:00:00.000Z',lapses:0};"
  done
  JS="$JS var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok $@'})()"
  agent-browser eval "$JS" 2>/dev/null | tr -d '"'
}

go_caderno() { # lição 102.1: 'Progresso' mora no submenu 'Mais' — o caderno é o conteúdo da aba
  # âncoras sempre-vivas: o título e o filtro de período (o caderno vazio não
  # tem 'pendentes' no DOM — a 105: copiar o texto real, nunca presumir)
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(qa_has 'Caderno de Erros')" = "1" ] && [ "$(qa_has 'Período:')" = "1" ] && return 0
  done
  return 1
}

go_flashcards() { # 'Praticar' direto; Flashcards é tab Radix (ref — lição 125/134)
  local REF
  agent-browser press Escape >/dev/null 2>&1; sleep 1  # o submenu 'Mais' pode estar aberto — o overlay cobre a sidebar
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Praticar')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 3
    for k in 1 2 3 4 5; do
      # a view LEMBRA a última tab — se já pousou em Flashcards, não há o que clicar
      [ "$(agent-browser eval "document.body.innerText.indexOf('Novo cartão')>=0?'fc-ok':'fc-no'" 2>/dev/null | tr -d '"')" = "fc-ok" ] && return 0
      # o snapshot da tab SELECIONADA vira 'tab "Flashcards" [selected, ref=e..]' —
      # o grep tem que casar as duas formas (a lição da 135: o formato muda com o estado)
      REF=$(agent-browser snapshot 2>/dev/null | grep -o 'tab "Flashcards.*ref=e[0-9]*\]' | grep -oE 'e[0-9]+' | tail -1)
      [ -n "$REF" ] && agent-browser click "$REF" >/dev/null 2>&1
      sleep 2
      [ "$(agent-browser eval "document.body.innerText.indexOf('Novo cartão')>=0?'fc-ok':'fc-no'" 2>/dev/null | tr -d '"')" = "fc-ok" ] && return 0
    done
  done
  return 1
}

chips() { # quantidade de chips 'virar cartão' no caderno
  agent-browser eval "(function(){return String(document.querySelectorAll('button[aria-label^=\"Transformar o erro em cartão:\"]').length)})()" 2>/dev/null | tr -d '"'
}

click_chip() { # clica o chip do item cujo aria-label contém $1 (fragmento do enunciado)
  agent-browser eval "(function(){var bs=[...document.querySelectorAll('button[aria-label^=\"Transformar o erro em cartão:\"]')];var b=bs.find(function(x){return (x.getAttribute('aria-label')||'').indexOf('$1')>=0});if(!b)return 'NOBTN';b.click();return 'ok'})()" 2>/dev/null | tr -d '"'
}

fc_storage() { # $1 js-expr sobre p.flashcards — lê o baralho direto da fonte
  agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');var f=p.flashcards||[];return String(f.length)+':'+($1)})()" 2>/dev/null | tr -d '"'
}

floor_read() {
  agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'cards='+((p.flashcards||[]).length)+'|ex='+Object.keys(p.exerciseProgress||{}).length+'|runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] O CHIP NO CADERNO: só quem tem verso no acervo oferece o clique ==="
qa_clean_all >/dev/null 2>&1   # o erro cardado numa sessão anterior sobrevive ao close+open — o clean é por fase
sleep 1
# seed ANTES de navegar: o caderno vazio faz early-return (sem filtro/pendentes
# no DOM — a lição da 105: a âncora tem que existir de verdade)
SEED=$(seed_mistakes ex01 ex02 001)
sleep 1
if go_caderno; then
  ok "caderno aterrissado pela UI real (Mais → Progresso)"
  echo "$SEED" | grep -q "ok ex01" && ok "seed plantado (mat-ex01/ex02/001 pendentes)" || bad "seed falhou ($SEED)"
  sleep 1
  C=$(chips)
  [ "$C" = "2" ] && ok "2 chips amber (ex01/ex02 COM hint); o hintless 001 não oferece o que não tem" || bad "chips errado ($C — esperado 2)"
  EX1=$(agent-browser eval "(function(){var bs=[...document.querySelectorAll('button[aria-label^=\"Transformar o erro em cartão:\"]')];return bs.some(function(b){return (b.getAttribute('aria-label')||'').indexOf('Considere a matriz A')>=0})?'yes':'no'})()" 2>/dev/null | tr -d '"')
  [ "$EX1" = "yes" ] && ok "chip do ex01 presente (aria-label com o enunciado — o aluno sabe o que vai virar)" || bad "chip do ex01 ausente ($EX1)"
  agent-browser screenshot scripts/qa135-cartao-no-caderno.png >/dev/null 2>&1 \
    && ok "screenshot do caderno com os chips (qa135-cartao-no-caderno.png)" || bad "screenshot falhou"
else
  bad "navegação até o caderno falhou — fase [A] abortada honestamente"
fi

echo "=== [B] O CLIQUE LEVA: erro vira cartão e o caderno dá o recibo ==="
qa_clean_all >/dev/null 2>&1
sleep 1
seed_mistakes ex01 ex02 001 >/dev/null 2>&1; sleep 1
if go_caderno; then
  C=$(click_chip 'Considere a matriz A'); sleep 1
  [ "$C" = "ok" ] && ok "chip do ex01 clicado" || bad "chip não clicável ($C)"
  T=$(qa_has 'O erro virou cartão')
  [ "$T" = "1" ] && ok "toast com a voz da ponte ('o cram da véspera já o encontra')" || bad "toast ausente (t=$T)"
  ST=$(fc_storage "f[0].fromMistake+':'+(f[0].front.indexOf('Considere a matriz A')>=0)+':'+(f[0].back.indexOf('linha i, coluna j')>=0)")
  [ "$ST" = "1:ex:mat-ex01:true:true" ] && ok "cartão nasceu completo: frente=enunciado, verso=hint, ref=ex:mat-ex01" || bad "cartão errado no storage ($ST)"
  R=$(qa_has 'no baralho')
  [ "$R" = "1" ] && ok "recibo 'no baralho' na linha (o caderno não esconde o que carregou)" || bad "recibo ausente (r=$R)"
  C=$(chips)
  [ "$C" = "1" ] && ok "chip do ex01 se aposentou (dedupe: resta só o ex02)" || bad "dedupe falhou ($C — esperado 1)"
else
  bad "mock da fase [B] falhou"
fi

echo "=== [C] A PONTE DOS SEM-HINT: o seletor do diálogo ainda os oferece ==="
qa_clean_all >/dev/null 2>&1
sleep 1
seed_mistakes ex01 ex02 001 >/dev/null 2>&1; sleep 1
if go_caderno; then
  click_chip 'Considere a matriz A' >/dev/null 2>&1; sleep 2   # ex01 vira cartão
  if go_flashcards; then
    agent-browser eval "(function(){var b=document.querySelector('button[aria-label=\"Criar novo cartão\"]');if(!b)return 'NO';b.click();return 'ok'})()" >/dev/null 2>&1
    sleep 1
    SEC=$(qa_has 'Nascer de um erro do caderno (2)')
    [ "$SEC" = "1" ] && ok "seletor mostra (2) — ex02 + 001; o cardado saiu (dedupe na fonte)" || bad "seletor errado (sec=$SEC)"
    OPT=$(agent-browser eval "(function(){var c=document.getElementById('fc-add-seed');if(!c)return 'NOSEL';c.click();return 'open'})()" >/dev/null 2>&1; sleep 1; agent-browser eval "(function(){var opts=[...document.querySelectorAll('[role=option]')];return opts.some(function(o){return (o.textContent||'').indexOf('Dadas as matrizes')>=0})?'yes':'no'})()" 2>/dev/null | tr -d '"')
    [ "$OPT" = "yes" ] && ok "o hintless 001 chega pela ponte da 134 (verso nasce no diálogo, com as palavras do aluno)" || bad "opção do 001 ausente ($OPT)"
    agent-browser press Escape >/dev/null 2>&1
  else
    bad "navegação até Flashcards falhou — fase [C] abortada honestamente"
  fi
else
  bad "mock da fase [C] falhou"
fi

echo "=== [D] HIGIENE + CONSOLE (verificada no chão real; a sessão entra no chão) ==="
FLOOR=""
for ATT in 1 2 3; do
  qa_clean_all >/dev/null 2>&1
  sleep 1
  FLOOR=$(floor_read)
  echo "$FLOOR" | grep -q "cards=0|ex=0|runs=0" && break
  agent-browser reload >/dev/null 2>&1; sleep 3
done
echo "$FLOOR" | grep -q "cards=0|ex=0|runs=0" && ok "chão zerado ($FLOOR)" || bad "chão sujo após 3 tentativas ($FLOOR)"
C=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$C" = "0" ] && ok "console: 0 erros" || bad "console tem $C erros"
agent-browser close >/dev/null 2>&1; sleep 2
ok "sessão fechada (o chão é bidimensional: storage E sessão — lição 133)"

echo ""
if [ "$QA_FAIL" = "0" ]; then
  echo "ALL GREEN — t135 o cartão no caderno (a ponte no lugar onde o erro mora)"
else
  echo "FAIL — t135 (ver fases acima)"
fi
exit $QA_FAIL
