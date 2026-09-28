#!/bin/bash
# Task 122 — O ENSAIO DA VÉSPERA: os DOIS dias que nenhuma suíte tinha
# ensaiado (t121 cobriu 29/09 e 01/10; a véspera ficou sem rehearsal) —
# e o que o ensaio achou: (1) o banner 'Modo recuperação' era a ÚNICA voz
# da casa que ainda empurrava catch-up na véspera DO SIMULADO (28/09),
# brigando com kit/brief/fila e nomeando conteúdo errado (slides Aula 00 +
# Lista 01) enquanto o plano do dia é Lógica Parte 2 — o texto agora defere
# ao dono do dia com o TÍTULO REAL do bloco (day?.titulo, fonte do plano);
# (2) o rótulo 'Treino de véspera' mentia em D-3/D-2 (a véspera é UM dia);
# (3) o detalhe do marco da véspera sempre mandou 'imprimir a folha de
# revisão' e o kit nunca teve a linha — na véspera (D-1) ela ganha fileira
# com badge da FONTE (MATH_FORMULAS.length) e accent de papel. Harness:
# agent-browser open --init-script (sessão NOVA por fase — lição 121).
set -u
cd /home/z/my-project

FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t122.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null
sleep 1

MOCKJS=/tmp/t122-mock.js
write_mock() { # $1 = ISO local do relógio mockado
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
open_mocked() { # $1 ISO, $2 URL — SESSÃO NOVA por fase (o --init-script só
  # registra na primeira navegação da sessão — lição 121)
  write_mock "$1"
  agent-browser close >/dev/null 2>&1
  sleep 1
  agent-browser open --init-script "$MOCKJS" "$2" >/dev/null 2>&1
  sleep 6
}
has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
kit_row_class() { # classe do botão da linha do kit que contém $1 no título
  agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').replace(/\s+/g,' ');if(t.indexOf('$1')>=0){return bs[i].className||''}}return 'NOBUTTON'})()" 2>/dev/null | tr -d '"'
}
scroll_to() {
  agent-browser eval "(function(){var els=document.querySelectorAll('h3,h2,p');for(var i=0;i<els.length;i++){if((els[i].textContent||'').indexOf('$1')===0){els[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [1] HOJE 28/09 20h (VÉSPERA DO SIMULADO): o banner aprende a defere ==="
open_mocked '2026-09-28T20:00:00' 'http://localhost:3000'
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
[ "$(has 'Faltam 3 dias')" = "1" ] && ok "hero D-3: 'Faltam 3 dias'" || bad "hero D-3 não apareceu"
[ "$(has 'Amanhã: Simulado da Av1')" = "1" ] && ok "brief do preparo: 'Amanhã: Simulado da Av1'" || bad "brief do preparo ausente"
[ "$(has 'fórmulas e dormir cedo')" = "1" ] && ok "brief manda dormir cedo (a calma manda na noite anterior)" || bad "linha 'dormir cedo' sumiu do brief"
[ "$(has 'véspera do simulado — amanhã é o ensaio real')" = "1" ] && ok "kit D-3 no palco: 'véspera do simulado — amanhã é o ensaio real'" || bad "kit D-3 ausente"
[ "$(has 'O ensaio real é amanhã')" = "1" ] && ok "linha 01 do kit: 'O ensaio real é amanhã'" || bad "linha do ensaio sumiu do kit"
[ "$(has 'O ensaio de amanhã mede o que já está no seu preparo')" = "1" ] && ok "intro do kit fala o dia D-3 (o ensaio, não 'a prova' — lição 128)" || bad "intro do kit ainda nomeia o dia errado"
if [ "$(has 'Amanhã é o ensaio real — hoje é o último bloco do plano')" = "1" ]; then
  ok "banner DEFERE no preparo: 'Amanhã é o ensaio real — hoje é o último bloco do plano'"
else
  bad "banner do preparo ainda não defere ao dono do dia"
fi
[ "$(has 'catch-up espera o resultado do ensaio')" = "1" ] && ok "catch-up espera o veredito (a voz do kit, agora no banner)" || bad "catch-up não espera no banner do preparo"
[ "$(has 'Lista de Lógica — Parte 2 (Q13–18: argumentos): fórmulas e dormir cedo')" = "1" ] && ok "banner nomeia o BLOCO REAL de hoje (fonte do plano, zero segunda derivação)" || bad "banner não nomeia o bloco do dia"
if [ "$(has 'faça um catch-up condensado')" = "0" ]; then
  ok "o empurrão 'catch-up condensado' SAIU do dia do preparo"
else
  bad "banner ainda empurra 'catch-up condensado' na véspera do ensaio"
fi
[ "$(has 'Treino de recall')" = "1" ] && ok "CTA honesto em D-3: 'Treino de recall' (a véspera é UM dia)" || bad "CTA ainda diz 'véspera' em D-3"
if [ "$(has 'Imprimir a folha de revisão')" = "0" ]; then
  ok "folha NÃO entra no kit em D-3 (antes do ensaio a recitação manda)"
else
  bad "folha apareceu cedo demais (D-3) no kit"
fi
scroll_to 'Kit da véspera'
agent-browser screenshot scripts/qa122-preparo-banner-desktop.png >/dev/null 2>&1 && ok "screenshot do preparo: scripts/qa122-preparo-banner-desktop.png"

echo "=== [2] VÉSPERA DA PROVA (30/09): a folha ganha fileira no kit ==="
open_mocked '2026-09-30T20:00:00' 'http://localhost:3000'
[ "$(has 'Falta 1 dia')" = "1" ] && ok "hero D-1: 'Falta 1 dia' (singular correto)" || bad "hero D-1 errado"
[ "$(has 'Véspera da prova')" = "1" ] && ok "brief da véspera: 'Véspera da prova'" || bad "brief da véspera ausente"
[ "$(has 'revisão leve: o plano manda — folha, fórmulas e só as travadas')" = "1" ] && ok "brief: 'revisão leve: o plano manda'" || bad "linha do brief da véspera mudou"
[ "$(has 'véspera — revisão leve, sem conteúdo novo')" = "1" ] && ok "kit: 'véspera — revisão leve, sem conteúdo novo'" || bad "badge de contexto do kit mudou"
[ "$(has 'o catch-up já não cabe nesta semana')" = "1" ] && ok "banner da véspera intocado (regressão 121)" || bad "banner da véspera regrediu"
if [ "$(has 'Imprimir a folha de revisão')" = "1" ]; then
  ok "NOVIDADE 122: o kit ganha a linha 'Imprimir a folha de revisão' (o detalhe do marco virou fileira)"
else
  bad "a folha continua sem fileira no kit da véspera"
fi
[ "$(has 'fórmulas em uma folha A4 para levar')" = "1" ] && ok "sub da linha fala a promessa: 'fórmulas em uma folha A4 para levar'" || bad "sub da linha da folha errado"
if agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');var m=t.match(/(\d+) fórmulas em uma folha/);return m?m[1]:'0'})()" 2>/dev/null | tr -d '"' | grep -qE '^[0-9]+$'; then
  N=$(agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');var m=t.match(/(\d+) fórmulas em uma folha/);return m?m[1]:'0'})()" 2>/dev/null | tr -d '"')
  ok "badge da FONTE: $N fórmulas (MATH_FORMULAS.length — o número que a folha de fora)"
else
  bad "badge sem número da fonte"
fi
RC=$(kit_row_class 'Imprimir a folha de revisão')
case "$RC" in
  *border-l-indigo*) ok "accent de papel na linha: borda esquerda indigo (a fileira se destaca no kit)";;
  *) bad "accent da linha da folha ausente: $RC";;
esac
case "$(agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').replace(/\\s+/g,' ');if(t.indexOf('Imprimir a folha de revisão')>=0){return bs[i].querySelector('.tabular-nums')?'1':'0'}}return '0'})()" 2>/dev/null | tr -d '"')" in
  1) ok "número do badge em tabular-nums (a gramática da casa, no Badge da linha)";;
  *) bad "badge da folha sem tabular-nums";;
esac
[ "$(has 'Treino de véspera')" = "1" ] && ok "CTA assume 'Treino de véspera' no ÚNICO dia em que é verdade" || bad "CTA não diz véspera no dia da véspera"
scroll_to 'Kit da véspera'
agent-browser screenshot scripts/qa122-vespera-kit-folha-desktop.png >/dev/null 2>&1 && ok "screenshot do kit com a folha: scripts/qa122-vespera-kit-folha-desktop.png"

echo "=== [3] A FOLHA NOS DOIS DIAS: selo nomeia o marco, promessa envelhece honesta ==="
open_mocked '2026-09-28T12:00:00' 'http://localhost:3000/folha-revisao'
[ "$(has 'Foco do simulado · chega em 29/09')" = "1" ] && ok "slot da promessa em 28/09: 'chega em 29/09' (a promessa ainda é futura)" || bad "slot da promessa errado em 28/09"
STAMP=$(agent-browser eval "(function(){var el=document.querySelector('[data-testid=\"folha-print-stamp\"]');return el?el.textContent.replace(/\s+/g,' ').trim():''})()" 2>/dev/null | tr -d '"')
[ "$STAMP" = "Impresso em 28/09 · Véspera do simulado" ] && ok "selo de papel em 28/09: '$STAMP'" || bad "selo errado em 28/09: '$STAMP'"
KATEX=$(agent-browser eval "document.querySelectorAll('.katex').length" 2>/dev/null | tr -d '"')
[ "$KATEX" = "15" ] && ok "15 katex à vista (regressão 119/120 intocada)" || bad "katex mudou: $KATEX"
open_mocked '2026-09-30T12:00:00' 'http://localhost:3000/folha-revisao'
STAMP=$(agent-browser eval "(function(){var el=document.querySelector('[data-testid=\"folha-print-stamp\"]');return el?el.textContent.replace(/\s+/g,' ').trim():''})()" 2>/dev/null | tr -d '"')
[ "$STAMP" = "Impresso em 30/09 · Véspera da prova" ] && ok "selo de papel em 30/09: '$STAMP'" || bad "selo errado em 30/09: '$STAMP'"
if [ "$(has 'Foco do simulado')" = "0" ]; then
  ok "promessa envelhecida sai em 30/09 (o slot é promessa do ensaio, não da prova)"
else
  bad "slot da promessa ainda vive na véspera da prova"
fi

echo "=== [4] HIGIENE + CONSOLE (sessão nova, sem mock) ==="
agent-browser close 2>/dev/null
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo (o ensaio não escreve nada)";; *) bad "resíduo: $S";; esac
C=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$C" = "0" ] && ok "console: 0 erros" || bad "console tem $C erros"

[ "$FAIL" = "0" ] && echo "ALL GREEN — t122 o ensaio da véspera (os dois dias que ninguém tinha ensaiado)" || echo "FAIL — ver [FAIL] acima"
exit $FAIL
