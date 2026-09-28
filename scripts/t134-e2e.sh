#!/usr/bin/env bash
# ============================================================================
# t134 — O CARTÃO QUE NASCE DO ERRO (a promessa dos flashcards ganha porta)
#
# MENTA: o brief da semana da Av1 nos flashcards (flashcardExamBriefFor)
# promete 'os erros de hoje viram cartões' e a criação era 100% manual — o
# aluno que fechou o ensaio teria que copiar o enunciado À MÃO no diálogo.
# A semente transporta o MATERIAL do acervo ao diálogo: frente = enunciado
# completo (fullStatementFor — o padrão do papel da 125: truncado não
# resolve), verso = hint do acervo SE existir (sem hint o verso nasce vazio
# e o aluno escreve a resolução — o app transporta, nunca inventa resposta;
# source 'manual' honesto: o aluno CONFIRMA). Porta só com estoque real
# (regra 88); dedupe por fromMistake — um erro vira UM cartão.
#
# [A] mock 29/09 (init-script, sessão nova, lição 133) + 3 pendências math
#     (ex01/ex02/001) → faixa 'É hoje' + porta 'Do erro ao cartão (3)'
# [B] a porta LEVA: diálogo → semente ex01 → frente/verso preenchidos do
#     acervo → Adicionar → card com fromMistake='ex:mat-ex01' → porta (2)
# [C] sem hint: SÓ mat-001 semeada → porta (1) → verso vazio + placeholder
#     honesto → aluno escreve → card ex:mat-001 → porta SOME (regra 88)
# [D] dedupe: card da ex01 → 'Novo cartão' manual → seletor mostra (2) →
#     cartão manual puro SEM fromMistake (a ref só nasce de erro)
# [E] higiene: chão da casa 0 + console 0 + SESSÃO FECHADA (lição 133)
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
qa_selfcheck || exit 2   # lib não carregou = asserções somem = ALL GREEN falso

qa_ensure_dev

MOCKJS=/tmp/t134-mock.js

write_mock() { # $1 ISO — Date mockado ANTES do primeiro script da página
cat > "$MOCKJS" <<EOF
(function(){
  var M = new Date('$1').getTime();
  class FD extends Date {
    constructor(...args){ args.length===0 ? super(M) : super(...args); }
    static now(){ return M; }
  }
  window.Date = FD;
})();
EOF
}

open_mocked() { # $1 ISO · $2 URL · $3 toDateString esperado — mock CONFIRMADO · chão zerado
  write_mock "$1"
  local got
  for _ in 1 2 3; do
    agent-browser close >/dev/null 2>&1
    sleep 3
    agent-browser open --init-script "$MOCKJS" "http://localhost:3000$2" >/dev/null 2>&1
    sleep 6
    got=$(agent-browser eval "new Date().toDateString()" 2>/dev/null | tr -d '"')
    if [ "$got" = "$3" ]; then qa_clean_all >/dev/null 2>&1; return 0; fi
  done
  return 1
}

seed_mistakes() { # $@ = ids sem 'mat-' (ex: 'ex01 ex02 001') — pendências TEC.1984 com par no acervo
  local JS="(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');p.exerciseProgress=p.exerciseProgress||{};"
  for n in "$@"; do
    JS="$JS p.exerciseProgress['mat-$n']={tried:true,solved:false,neededHelp:false,lastPracticedAt:'2026-09-29T10:00:00.000Z',lapses:0};"
  done
  JS="$JS var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok $@'})()"
  agent-browser eval "$JS" 2>/dev/null | tr -d '"'
}

go_flashcards() { # 'Praticar' direto na sidebar; Flashcards é tab Radix (ref — lição 125)
  # clicou → POLLOU o pouso ('Novo cartão') — ref de snapshot envelhece e o
  # Radix Tabs engole cliques na corrida (a 129.2: mousedown confiável ou nada)
  local REF
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

fc_storage() { # $1 js-expr sobre p.flashcards — lê o baralho direto da fonte
  agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');var f=p.flashcards||[];return String(f.length)+':'+($1)})()" 2>/dev/null | tr -d '"'
}

porta() { # o texto da porta lido do BUTTON (textContent — o innerText quebra
# linha no span tabular-nums: 'Do erro ao cartão (\n1\n)' mente ao grep)
  agent-browser eval "(function(){var b=document.querySelector('button[aria-label^=\"Transformar um erro em cartão\"]');return b?b.textContent.replace(/\s+/g,' ').trim():'AUSENTE'})()" 2>/dev/null | tr -d '"'
}

assert_porta() { # $1 esperado · $2 rótulo
  local P=$(porta)
  [ "$P" = "$1" ] && ok "$2 ('$1')" || bad "$2 — esperado '$1', obtido '$P'"
}

click_porta() { # clica a porta da faixa pelo aria-label real
  agent-browser eval "(function(){var b=document.querySelector('button[aria-label^=\"Transformar um erro em cartão\"]');if(!b)return 'NOBTN';b.click();return 'ok'})()" 2>/dev/null | tr -d '"'
}

pick_seed() { # $1 fragmento do enunciado — abre o combobox e clica a opção que casa
  agent-browser eval "(function(){var c=document.getElementById('fc-add-seed');if(!c)return 'NOSEL';c.click();return 'open'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var opts=[...document.querySelectorAll('[role=option]')];var o=opts.find(function(x){return (x.textContent||'').indexOf('$1')>=0});if(!o)return 'NOOPT';o.click();return 'picked'})()" 2>/dev/null | tr -d '"'
}

textarea_vals() { # 'front|||back' do diálogo aberto (60 chars cada)
  agent-browser eval "(function(){var tas=document.querySelectorAll('textarea');if(tas.length<2)return 'FEW';return tas[0].value.slice(0,60)+'|||'+tas[1].value.slice(0,60)})()" 2>/dev/null | tr -d '"'
}

click_adicionar() {
  agent-browser eval "(function(){var bs=document.querySelectorAll('[role=dialog] button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim()==='Adicionar'){bs[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] A PORTA EXISTE: 3 pendências math → faixa anuncia e conta ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  SEED=$(seed_mistakes ex01 ex02 001); sleep 1
  echo "$SEED" | grep -q "ok ex01" && ok "seed plantado (mat-ex01/ex02/001 pendentes)" || bad "seed falhou ($SEED)"
  if go_flashcards; then
    ok "Flashcards aterrissado pela UI real (Praticar → tab)"
    BRIEF=$(qa_has 'É hoje: Simulado da Av1')
    [ "$BRIEF" = "1" ] && ok "faixa do dia do ensaio de pé (brief simulado-hoje)" || bad "faixa ausente (brief=$BRIEF)"
    assert_porta "Do erro ao cartão (3)" "porta conta as sementes math (3 pendências TEC.1984)"
  else
    bad "navegação até Flashcards falhou — fase [A] abortada honestamente"
  fi
else
  bad "mock 29/09 não aterrissou — fase [A] abortada honestamente"
fi

echo "=== [B] A PORTA LEVA: semente ex01 preenche frente+verso do acervo ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  seed_mistakes ex01 ex02 001 >/dev/null 2>&1; sleep 1
  go_flashcards >/dev/null 2>&1
  C=$(click_porta); sleep 1
  [ "$C" = "ok" ] && ok "porta clicada — diálogo abriu" || bad "porta não clicável ($C)"
  SEC=$(qa_has 'Nascer de um erro do caderno')
  [ "$SEC" = "1" ] && ok "seção da semente visível no diálogo (família amber)" || bad "seção da semente ausente (sec=$SEC)"
  PK=$(pick_seed 'ordem de A'); sleep 1
  [ "$PK" = "picked" ] && ok "semente ex01 escolhida no seletor" || bad "semente não escolhida ($PK)"
  agent-browser screenshot scripts/qa134-semente.png >/dev/null 2>&1 \
    && ok "screenshot da semente no diálogo (qa134-semente.png)" || bad "screenshot falhou"
  V=$(textarea_vals)
  if echo "$V" | grep -q "Considere a matriz A" && echo "$V" | grep -q "linha i, coluna j"; then
    ok "frente=enunciado completo, verso=hint do acervo (material transportado, nada inventado)"
  else
    bad "preenchimento errado ($V)"
  fi
  A=$(click_adicionar); sleep 2
  [ "$A" = "ok" ] && ok "Adicionar clicado" || bad "Adicionar não clicado ($A)"
  ST=$(fc_storage "f[0].fromMistake+':'+(f[0].front.indexOf('ordem de A')>=0)")
  [ "$ST" = "1:ex:mat-ex01:true" ] && ok "cartão nasceu com fromMistake='ex:mat-ex01' (dedupe ancorado na fonte)" || bad "fromMistake ausente ($ST)"
  assert_porta "Do erro ao cartão (2)" "porta decrementou (3→2: o ofertado saiu do seletor)"
else
  bad "mock 29/09 falhou na fase [B]"
fi

echo "=== [C] SEM HINT: o verso nasce vazio e o app não inventa resposta ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  seed_mistakes 001 >/dev/null 2>&1; sleep 1
  go_flashcards >/dev/null 2>&1
  assert_porta "Do erro ao cartão (1)" "só mat-001 semeada → porta (1)"
  click_porta >/dev/null 2>&1; sleep 1
  PK=$(pick_seed 'Dadas as matrizes'); sleep 1
  [ "$PK" = "picked" ] && ok "semente mat-001 (sem hint no acervo) escolhida" || bad "mat-001 não escolhida ($PK)"
  PH=$(agent-browser eval "(function(){var tas=document.querySelectorAll('textarea');return tas.length>1?tas[1].placeholder.slice(0,20):'NO'})()" 2>/dev/null | tr -d '"')
  [ "$PH" = "Escreva o caminho da" ] && ok "placeholder honesto no verso sem hint ('escreva o caminho')" || bad "placeholder errado ($PH)"
  V=$(textarea_vals)
  if echo "$V" | grep -q "Dadas as matrizes" && echo "$V" | grep -q "|||$"; then
    ok "frente completa do acervo, verso VAZIO (nada inventado)"
  else
    bad "preenchimento sem hint errado ($V)"
  fi
  # o aluno escreve a resolução (o gesto real que o verso pede)
  agent-browser eval "(function(){var tas=document.querySelectorAll('textarea');if(tas.length<2)return 'NO';var S=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;S.call(tas[1],'A+B=[[6,8],[10,12]]; 3A=[[3,6],[9,12]]; A×B existe (2×2 vezes 2×2)');tas[1].dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()" >/dev/null 2>&1
  click_adicionar >/dev/null 2>&1; sleep 2
  ST=$(fc_storage "f[0].fromMistake+':'+(f[0].back.indexOf('3A=')>=0)")
  [ "$ST" = "1:ex:mat-001:true" ] && ok "cartão ex:mat-001 nasceu com o verso ESCRITO pelo aluno" || bad "cartão mat-001 errado ($ST)"
  P=$(porta)
  [ "$P" = "AUSENTE" ] && ok "porta CALA no zero (regra 88: sem erro ofertável não há linha)" || bad "porta deveria ter sumido ($P)"
else
  bad "mock 29/09 falhou na fase [C]"
fi

echo "=== [D] DEDUPE: cartões criados, o seletor não oferece de novo ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  seed_mistakes ex01 ex02 001 >/dev/null 2>&1; sleep 1
  go_flashcards >/dev/null 2>&1
  # cria o cartão da ex01 (a porta leva, mais uma vez)
  click_porta >/dev/null 2>&1; sleep 1
  pick_seed 'ordem de A' >/dev/null 2>&1; sleep 1
  click_adicionar >/dev/null 2>&1; sleep 2
  # abre o diálogo MANUAL ('Novo cartão') — o seletor mostra só as 2 restantes
  agent-browser eval "(function(){var b=document.querySelector('button[aria-label=\"Criar novo cartão\"]');if(!b)return 'NO';b.click();return 'ok'})()" >/dev/null 2>&1
  sleep 1
  SEC=$(qa_has 'Nascer de um erro do caderno (2)')
  [ "$SEC" = "1" ] && ok "seletor mostra só as restantes (2 — ex02/001; ex01 já cardado)" || bad "dedupe do seletor falhou (sec=$SEC)"
  agent-browser press Escape >/dev/null 2>&1; sleep 1
  # nasce cartão SEM semente → fromMistake ausente (o manual puro não carrega ref)
  agent-browser eval "(function(){var b=document.querySelector('button[aria-label=\"Criar novo cartão\"]');if(!b)return 'NO';b.click();return 'ok'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var tas=document.querySelectorAll('textarea');if(tas.length<2)return 'NO';var S=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;S.call(tas[0],'O que é uma matriz transposta?');tas[0].dispatchEvent(new Event('input',{bubbles:true}));S.call(tas[1],'Troca linhas por colunas: Aij = Aji');tas[1].dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()" >/dev/null 2>&1
  click_adicionar >/dev/null 2>&1; sleep 2
  ST=$(fc_storage "f.map(function(c){return c.fromMistake||'-'}).join(',')")
  echo "$ST" | grep -q "^2:ex:mat-ex01,-$" && ok "cartão manual puro sem fromMistake (a ref só existe quando nasce de erro)" || bad "ref vazando para cartão manual ($ST)"
else
  bad "mock 29/09 falhou na fase [D]"
fi

echo "=== [E] HIGIENE + CONSOLE (fechar a sessão mockada — a suíte seguinte não herda o relógio) ==="
# HIGIENE COM VERIFICAÇÃO (o dogma da própria lib: 'nunca confie no ok do
# eval — confirme o efeito no storage'). Com o STORE da lib curado (o typo
# 'estudios' operava numa chave fantasma), o clean agora toca o chão REAL.
floor_read() {
  agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');return 'cards='+((p.flashcards||[]).length)+'|ex='+Object.keys(p.exerciseProgress||{}).length+'|runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null | tr -d '"'
}
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
# ⚠️ LIÇÃO 133: o mock por init-script VIVE NA SESSÃO — a t134 termina com
# 29/09 armado; sem este close, a SUÍTE SEGUINTE herda o relógio falso.
agent-browser close >/dev/null 2>&1; sleep 2
ok "sessão fechada (o chão é bidimensional: storage E sessão)"

echo ""
if [ "$QA_FAIL" = "0" ]; then
  echo "ALL GREEN — t134 o cartão que nasce do erro (a promessa dos flashcards ganha porta)"
else
  echo "FAIL — t134 (ver fases acima)"
fi
exit $QA_FAIL
