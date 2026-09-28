#!/usr/bin/env bash
# ============================================================================
# t133 — O CONTE DA S3 (a ação do prazo conta a preparação)
#
# MENTA: a ação do prazo da S3 (93/126) dizia 'as 8 questões estão no
# Praticar; resolva e envie' — mas nunca dizia QUANTAS o aluno já havia
# resolvido. Na véspera e no dia, o número é a pergunta real ('estou pronto
# para enviar?'). A contagem lê a MESMA fonte do Praticar (exerciseProgress)
# sobre as questões amarradas ao material da S3 (linkedMaterials — a MESMA
# amarra do chip 'praticar'). Contagem é CONTAGEM: trilho fino + x/y
# tabular-nums no card (a gramática da 130); o registro binário da entrega
# continua sendo só o checkbox — recibo não tem meio-caminho (126/130).
#
# [A] mock 29/09 (init-script, sessão nova) + seed 3/8 solved → texto
#     '(3/8 resolvidas)' + chip '3/8' com trilho parcial (barra ≠ 0/100%)
# [B] re-seed 8/8 → '8/8 resolvidas: só falta enviar os programas' + trilho cheio
# [C] seed 1/8 → singular honesto ('1/8 resolvida') — a gramática acompanha
# [D] zero: sem progresso → '(0/8 resolvidas)' (o número existe desde o nada)
# [E] entrega: clique REAL no checkbox (id rec-alg-s3-entrega, receita t126)
#     → recibo emerald fica e a ação (com o trilho) se aposenta — a fila
#     volta à primeira ação pendente
# [F] higiene: chão da casa 0 + console 0
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
qa_selfcheck || exit 2   # lib não carregou = asserções somem = ALL GREEN falso

qa_ensure_dev

MOCKJS=/tmp/t133-mock.js

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

open_mocked() { # $1 ISO · $2 URL · $3 toDateString esperado — mock CONFIRMADO
  write_mock "$1"
  local got
  for _ in 1 2 3; do
    agent-browser close >/dev/null 2>&1
    sleep 3
    agent-browser open --init-script "$MOCKJS" "http://localhost:3000$2" >/dev/null 2>&1
    sleep 6
    got=$(agent-browser eval "new Date().toDateString()" 2>/dev/null | tr -d '"')
    [ "$got" = "$3" ] && return 0
  done
  return 1
}

seed_s3() { # $1..$8 = lista de questões resolvidas (ex.: 1 2 3) — solved:true
  agent-browser eval "(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');p.exerciseProgress=p.exerciseProgress||{};var arr=[$(for n in "$@"; do printf "'alg-s3q%s'," "$n"; done | sed 's/,$//')];for(var i=0;i<arr.length;i++){p.exerciseProgress[arr[i]]={tried:true,solved:true,neededHelp:false,lastPracticedAt:'2026-09-28T14:00:00.000Z'}}var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+arr.length})()" 2>/dev/null | tr -d '"'
}

clear_s3() { # apaga as 8 chaves da S3 do exerciseProgress
  agent-browser eval "(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');if(p.exerciseProgress){for(var i=1;i<=8;i++){delete p.exerciseProgress['alg-s3q'+i]}}var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok'})()" 2>/dev/null | tr -d '"'
}

trilho_width() { # largura do FILL do trilho da ação da S3 (percent inteiro)
  agent-browser eval "(function(){var labels=document.querySelectorAll('span');for(var i=0;i<labels.length;i++){if(labels[i].textContent.trim()==='$1'&&(labels[i].className||'').indexOf('tabular-nums')>=0){var fill=labels[i].parentElement.querySelector('span[style*=width]');if(fill){return (fill.style.width||'').replace('%','')}return 'NORAIL'}}return 'NOLABEL'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] 3/8 resolvidas: o texto conta e o trilho enche um terço ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  SEED=$(seed_s3 1 2 3); sleep 1; poke=/dev/null
  [ "$SEED" = "ok n=3" ] && ok "seed plantado (alg-s3q1..q3 solved)" || bad "seed falhou ($SEED)"
  PR=$(qa_has 'PRAZO HOJE: entrega da S3')
  [ "$PR" = "1" ] && ok "ação do prazo na fila (âncora 93/126 intacta)" || bad "ação do prazo ausente (pr=$PR)"
  CNT=$(qa_has '(3/8 resolvidas)')
  [ "$CNT" = "1" ] && ok "texto conta a preparação: '(3/8 resolvidas)'" || bad "contagem ausente no texto (cnt=$CNT)"
  W=$(trilho_width '3/8')
  [ "$W" != "NORAIL" ] && [ "$W" != "NOLABEL" ] && [ "$W" -gt 0 ] 2>/dev/null && [ "$W" -lt 100 ] 2>/dev/null \
    && ok "trilho parcial vivo: fill em ${W}% (entre 0 e 100)" || bad "trilho errado (w=$W)"
  CH=$(qa_has 'prazo hoje')
  [ "$CH" = "1" ] && ok "chip 'prazo hoje' segue de pé (a urgência e a contagem convivem)" || bad "chip do prazo sumiu (ch=$CH)"
  agent-browser screenshot scripts/qa133-conte-s3.png >/dev/null 2>&1 && ok "screenshot do conte (qa133-conte-s3.png)" || bad "screenshot falhou"
else
  bad "mock 29/09 não aterrissou — fase [A] abortada honestamente"
fi

echo "=== [B] 8/8: 'só falta enviar' — a voz do preparo completo ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  SEED=$(seed_s3 1 2 3 4 5 6 7 8); sleep 1
  FULL=$(qa_has '8/8 resolvidas: só falta enviar os programas')
  [ "$FULL" = "1" ] && ok "preparo completo manda a mensagem certa ('só falta enviar')" || bad "texto do 8/8 ausente (full=$FULL)"
  W=$(trilho_width '8/8')
  [ "$W" = "100" ] && ok "trilho cheio (100%)" || bad "trilho não está cheio (w=$W)"
else
  bad "mock 29/09 falhou na fase [B]"
fi

echo "=== [C] 1/8: o singular acompanha ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  SEED=$(seed_s3 5); sleep 1
  UM=$(qa_has '(1/8 resolvida)')
  [ "$UM" = "1" ] && ok "singular honesto: '(1/8 resolvida)'" || bad "singular errado (um=$UM)"
else
  bad "mock 29/09 falhou na fase [C]"
fi

echo "=== [D] zero: o número existe desde o nada (honestidade do 0/8) ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  CLEAR=$(clear_s3); sleep 1
  Z=$(qa_has '(0/8 resolvidas)')
  [ "$Z" = "1" ] && ok "0/8 declarado (nada de fingir que a contagem não existe)" || bad "0/8 ausente (z=$Z)"
  W=$(trilho_width '0/8')
  [ "$W" = "0" ] && ok "trilho vazio no 0/8 (a barra não mente)" || bad "trilho no 0/8 deveria estar vazio (w=$W)"
else
  bad "mock 29/09 falhou na fase [D]"
fi

echo "=== [E] A ENTREGA: checkbox real → recibo fica, contagem se aposenta ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  SEED=$(seed_s3 1 2 3); sleep 1
  CLICK=$(agent-browser eval "(function(){var el=document.getElementById('rec-alg-s3-entrega');if(!el)return 'NOEL';el.click();return 'ok'})()" 2>/dev/null | tr -d '"')
  sleep 1
  [ "$CLICK" = "ok" ] && ok "checkbox da S3 clicado na UI real" || bad "checkbox não encontrado ($CLICK)"
  REC=$(qa_has 'Entrega da S3 registrada')
  [ "$REC" = "1" ] && ok "recibo emerald fica na fila (o 126 intacto)" || bad "recibo ausente após o clique (rec=$REC)"
  GONE=$(qa_has '(3/8 resolvidas)')
  [ "$GONE" = "0" ] && ok "a ação com o trilho se aposenta junto (a fila segue limpa)" || bad "ação da S3 ainda na fila (gone=$GONE)"
else
  bad "mock 29/09 falhou na fase [E]"
fi

echo "=== [F] HIGIENE + CONSOLE (fechar a sessão mockada — a suíte seguinte não herda o relógio) ==="
clear_s3 >/dev/null 2>&1
agent-browser eval "(function(){var k='hub:recovery:v1:done';localStorage.setItem(k,'{}');return 'ok'})()" >/dev/null 2>&1
qa_clean_all >/dev/null 2>&1
CONSOLE=$(qa_console_errors)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"
# ⚠️ LIÇÃO 133: o mock por init-script VIVE NA SESSÃO do agent-browser — toda
# navegação seguinte da MESMA sessão re-aplica o relógio. Suíte que termina
# sem close arma uma armadilha para a próxima que abrir sem close (a t93
# herdou 29/09 e 'falhou' 3 asserções que estavam verdes). Fechar é parte da
# higiene — o chão do storage não basta; a SESSÃO também entra no chão.
agent-browser close >/dev/null 2>&1
ok "sessão fechada — o mock morre com ela (a frota segue limpa)"

echo ""
if [ "$QA_FAIL" = "0" ]; then
  echo "ALL GREEN — t133 o conte da S3 (a fila conta a preparação)"
else
  echo "FAIL — t133 (ver fases acima)"
fi
exit $QA_FAIL
