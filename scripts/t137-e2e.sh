#!/usr/bin/env bash
# ============================================================================
# t137 — A VÉSPERA DO PRAZO (o D-1 da entrega S3 fala na fila)
#
# MENTA: o design da 93 limitava a voz do prazo da S3 ao DIA dela (29/09) —
# mas o aluno que abria a fila na VÉSPERA via só a ação genérica da trilha
# (S2, sem data), enquanto a entrega REAL vencia AMANHÃ junto com o simulado:
# acordar com 'PRAZO HOJE' + ensaio + entrega no mesmo dia é descobrir o
# prazo tarde, quando fechar o que falta já não cabe. A 137 dá a voz do D-1:
# mesmo prazo, MESMO id (um prazo, um registro), tom de VÉSPERA — o texto
# manda fechar hoje o que falta (amanhã é só enviar), o chip é a família
# "a espera" (amber calmo, CalendarClock, SEM pulso — o pulso é do dia) e a
# borda é a amber menos intensa. Contagem da 133 segue viva nos dois dias.
#
# [A] mock 28/09 (a véspera REAL desta rodada) + seed 3/8 → 'PRAZO AMANHÃ'
#     + '(3/8 resolvidas)' + trilho parcial + chip 'prazo amanhã' SEM pulso
#     + borda amber calma + 'PRAZO HOJE' AUSENTE + S2 genérica FORA da fila
# [B] 8/8 na véspera → 'amanhã é só enviar os programas' + trilho cheio
# [C] véspera: clique REAL no checkbox → ação se aposenta → a trilha volta
#     à primeira ação pendente de sempre (S2 genérica de volta)
# [D] mock 29/09 (O DIA, sessão nova — a lição 133 manda): 'PRAZO HOJE'
#     BYTE-IDENTICAL à 93/126/133 + chip 'prazo hoje' COM pulso + borda
#     amber forte + 'prazo amanhã' ausente — o dia não mudou NADA
# [E] mock 30/09 (passado o prazo, sessão nova): 'PRAZO' ausente da fila
#     (prazo vencido não inventa culpa — regra da 93) + S2 de volta
# [F] higiene: chão da casa 0 + console 0 + SESSÃO FECHADA (lição 133)
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
qa_selfcheck || exit 2   # lib não carregou = asserções somem = ALL GREEN falso

qa_ensure_dev

MOCKJS=/tmp/t137-mock.js

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

seed_s3() { # $1..$8 = questões resolvidas — solved:true (o mesmo chão da 133)
  agent-browser eval "(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');p.exerciseProgress=p.exerciseProgress||{};var arr=[$(for n in "$@"; do printf "'alg-s3q%s'," "$n"; done | sed 's/,$//')];for(var i=0;i<arr.length;i++){p.exerciseProgress[arr[i]]={tried:true,solved:true,neededHelp:false,lastPracticedAt:'2026-09-28T14:00:00.000Z'}}var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+arr.length})()" 2>/dev/null | tr -d '"'
}

clear_s3() { # apaga as 8 chaves da S3 do exerciseProgress
  agent-browser eval "(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');if(p.exerciseProgress){for(var i=1;i<=8;i++){delete p.exerciseProgress['alg-s3q'+i]}}var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok'})()" 2>/dev/null | tr -d '"'
}

trilho_width() { # largura do FILL do trilho da ação (percent inteiro)
  agent-browser eval "(function(){var labels=document.querySelectorAll('span');for(var i=0;i<labels.length;i++){if(labels[i].textContent.trim()==='$1'&&(labels[i].className||'').indexOf('tabular-nums')>=0){var fill=labels[i].parentElement.querySelector('span[style*=width]');if(fill){return (fill.style.width||'').replace('%','')}return 'NORAIL'}}return 'NOLABEL'})()" 2>/dev/null | tr -d '"'
}

li_class() { # classe do <li> que contém o texto dado (a borda é o tom do dia)
  agent-browser eval "(function(){var lis=document.querySelectorAll('li');for(var i=0;i<lis.length;i++){if(lis[i].textContent.indexOf('$1')>=0&&(lis[i].className||'').indexOf('amber')>=0){return lis[i].className}}return 'NOLI'})()" 2>/dev/null | tr -d '"'
}

badge_pulse() { # 1 se o badge do texto dado tem pulso (o pulso é DO DIA)
  agent-browser eval "(function(){var bs=document.querySelectorAll('span');for(var i=0;i<bs.length;i++){if(bs[i].textContent.indexOf('$1')>=0&&bs[i].querySelector('.animate-pulse')){return '1'}}return '0'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] A VÉSPERA REAL (28/09): o prazo anuncia, a voz não grita ==="
if open_mocked "2026-09-28T19:00:00" "/" "Mon Sep 28 2026"; then
  SEED=$(seed_s3 1 2 3); sleep 1
  [ "$SEED" = "ok n=3" ] && ok "seed plantado (alg-s3q1..q3 solved)" || bad "seed falhou ($SEED)"
  AM=$(qa_has 'PRAZO AMANHÃ: entrega da S3')
  [ "$AM" = "1" ] && ok "o prazo fala na véspera ('PRAZO AMANHÃ: entrega da S3')" || bad "voz do D-1 ausente (am=$AM)"
  HOJ=$(qa_has 'PRAZO HOJE')
  [ "$HOJ" = "0" ] && ok "'PRAZO HOJE' ausente na véspera (o dia não rouba a voz do amanhã)" || bad "'PRAZO HOJE' vazou para a véspera (hoj=$HOJ)"
  CNT=$(qa_has '(3/8 resolvidas)')
  [ "$CNT" = "1" ] && ok "contagem da 133 vive na véspera: '(3/8 resolvidas)'" || bad "contagem ausente na véspera (cnt=$CNT)"
  W=$(trilho_width '3/8')
  [ "$W" != "NORAIL" ] && [ "$W" != "NOLABEL" ] && [ "$W" -gt 0 ] 2>/dev/null && [ "$W" -lt 100 ] 2>/dev/null \
    && ok "trilho parcial vivo na véspera: ${W}%" || bad "trilho errado na véspera (w=$W)"
  CHIP=$(qa_has 'prazo amanhã')
  [ "$CHIP" = "1" ] && ok "chip 'prazo amanhã' na fila" || bad "chip da véspera ausente (chip=$CHIP)"
  P=$(badge_pulse 'prazo amanhã')
  [ "$P" = "0" ] && ok "chip da véspera SEM pulso (o pulso é do dia — a espera não corre)" || bad "chip da véspera pulsando (p=$P)"
  CL=$(li_class 'PRAZO AMANHÃ')
  echo "$CL" | grep -q 'border-amber-500/40' && ok "borda amber CALMA na véspera (border-amber-500/40)" || bad "borda da véspera errada ($CL)"
  S2=$(qa_has 'Fazer as 10 questões da Semana 2 no Praticar')
  [ "$S2" = "0" ] && ok "S2 genérica FORA da fila na véspera (o prazo com data precede a dívida sem data)" || bad "S2 deveria ter cedido o slot (s2=$S2)"
  OV=$(agent-browser eval "(function(){return document.documentElement.scrollWidth+'x'+window.innerWidth})()" 2>/dev/null | tr -d '"')
  [ "${OV%%x*}" -le "${OV##*x}" ] 2>/dev/null && ok "sem overflow horizontal ($OV)" || bad "overflow horizontal ($OV)"
  agent-browser screenshot scripts/qa137-vespera-prazo-mock.png >/dev/null 2>&1 && ok "screenshot da véspera (qa137-vespera-prazo-mock.png)" || bad "screenshot falhou"
else
  bad "mock 28/09 não aterrissou — fase [A] abortada honestamente"
fi

echo "=== [B] 8/8 na véspera: amanhã é SÓ enviar ==="
if open_mocked "2026-09-28T19:00:00" "/" "Mon Sep 28 2026"; then
  SEED=$(seed_s3 1 2 3 4 5 6 7 8); sleep 1
  FULL=$(qa_has '8/8 resolvidas: amanhã é só enviar os programas')
  [ "$FULL" = "1" ] && ok "preparo completo na véspera manda a mensagem certa" || bad "texto do 8/8 na véspera ausente (full=$FULL)"
  W=$(trilho_width '8/8')
  [ "$W" = "100" ] && ok "trilho cheio na véspera (100%)" || bad "trilho não cheio (w=$W)"
else
  bad "mock 28/09 falhou na fase [B]"
fi

echo "=== [C] ENTREGA ANTECIPADA: checkbox real → trilha volta à ação de sempre ==="
if open_mocked "2026-09-28T19:00:00" "/" "Mon Sep 28 2026"; then
  SEED=$(seed_s3 1 2 3); sleep 1
  CLICK=$(agent-browser eval "(function(){var el=document.getElementById('rec-alg-s3-entrega');if(!el)return 'NOEL';el.click();return 'ok'})()" 2>/dev/null | tr -d '"')
  sleep 1
  [ "$CLICK" = "ok" ] && ok "checkbox da S3 clicado na UI real (o registro é o MESMO do dia)" || bad "checkbox não encontrado ($CLICK)"
  GONE=$(qa_has 'PRAZO AMANHÃ')
  [ "$GONE" = "0" ] && ok "o prazo se aposenta (entregue é entregue — na véspera também)" || bad "prazo ainda na fila após entrega (gone=$GONE)"
  S2=$(qa_has 'Fazer as 10 questões da Semana 2 no Praticar')
  [ "$S2" = "1" ] && ok "a trilha volta à primeira ação pendente de sempre (S2 de volta)" || bad "trilha não retornou à S2 (s2=$S2)"
else
  bad "mock 28/09 falhou na fase [C]"
fi

echo "=== [D] O DIA (29/09, sessão nova): a voz da 93/126/133 BYTE-IDENTICAL ==="
if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026"; then
  SEED=$(seed_s3 1 2 3 4 5 6 7 8); sleep 1
  HOJ=$(qa_has 'PRAZO HOJE: entrega da S3')
  [ "$HOJ" = "1" ] && ok "no dia, o prazo em voz cheia (âncora 93/126 intacta)" || bad "voz do dia ausente (hoj=$HOJ)"
  FULL=$(qa_has '8/8 resolvidas: só falta enviar os programas')
  [ "$FULL" = "1" ] && ok "sufixo do dia BYTE-IDENTICAL ('só falta enviar' — sem 'amanhã')" || bad "texto do dia mudou (full=$FULL)"
  AM=$(qa_has 'PRAZO AMANHÃ')
  [ "$AM" = "0" ] && ok "'PRAZO AMANHÃ' não vaza para o dia" || bad "voz da véspera vazou para o dia (am=$AM)"
  CH=$(qa_has 'prazo hoje')
  [ "$CH" = "1" ] && ok "chip 'prazo hoje' de pé" || bad "chip do dia ausente (ch=$CH)"
  P=$(badge_pulse 'prazo hoje')
  [ "$P" = "1" ] && ok "chip do dia COM pulso (o é-hoje do relógio corre quando vence)" || bad "chip do dia sem pulso (p=$P)"
  CHA=$(qa_has 'prazo amanhã')
  [ "$CHA" = "0" ] && ok "chip da véspera ausente no dia" || bad "chip da véspera vazou (cha=$CHA)"
  CL=$(li_class 'PRAZO HOJE')
  echo "$CL" | grep -q 'border-amber-500/60' && ok "borda amber FORTE no dia (border-amber-500/60)" || bad "borda do dia errada ($CL)"
else
  bad "mock 29/09 falhou na fase [D]"
fi

echo "=== [E] PASSADO O PRAZO (30/09): a culpa não é inventada ==="
if open_mocked "2026-09-30T12:00:00" "/" "Wed Sep 30 2026"; then
  CLEAR=$(clear_s3); sleep 1
  AM=$(qa_has 'PRAZO AMANHÃ')
  HOJ=$(qa_has 'PRAZO HOJE')
  [ "$AM" = "0" ] && [ "$HOJ" = "0" ] && ok "prazo vencido não fala na fila (regra da 93 intacta)" || bad "prazo vencido apareceu (am=$AM hoj=$HOJ)"
  S2=$(qa_has 'Fazer as 10 questões da Semana 2 no Praticar')
  [ "$S2" = "1" ] && ok "trilha segue a ação genérica de sempre (a dívida continua honesta)" || bad "S2 ausente (s2=$S2)"
else
  bad "mock 30/09 falhou na fase [E]"
fi

echo "=== [F] HIGIENE + CONSOLE (fechar a sessão mockada — a lição 133 é passo) ==="
clear_s3 >/dev/null 2>&1
agent-browser eval "(function(){var k='hub:recovery:v1:done';localStorage.setItem(k,'{}');return 'ok'})()" >/dev/null 2>&1
qa_clean_all >/dev/null 2>&1
CONSOLE=$(qa_console_errors)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"
agent-browser close >/dev/null 2>&1
ok "sessão fechada — o mock morre com ela (a frota segue limpa)"

echo ""
if [ "$QA_FAIL" = "0" ]; then
  echo "ALL GREEN — t137 a véspera do prazo (o D-1 da entrega fala na fila)"
else
  echo "FAIL — t137 (ver fases acima)"
fi
exit $QA_FAIL
