#!/usr/bin/env bash
# t93-e2e.sh — QA E2E da Task 93 (ciclo 416224, rodada 21:30)
# Foco: o PRAZO DA S3 fala na fila no dia dele (29/09) — recovery-plan.ts +
# recovery-card.tsx. Matriz: real D-4 / mock 29/09 (prazo visível) / toggle ao
# vivo / persistência / re-armo / 30-09 (dia passado) / 01-10 (prova) / mobile.
# Formato de asserção: key=value|pipe (lição 90.4 — CLI escapa aspas).
set -u
cd /home/z/my-project
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS $1"; }
no()   { FAIL=$((FAIL+1)); echo "FAIL $1"; }
has()  { echo "$2" | grep -qF "$1" && ok "$3" || no "$3"; }
nohas(){ echo "$2" | grep -qF "$1" && no "$3" || ok "$3"; }
ab()   { agent-browser "$@" 2>/dev/null; }

MOCK='(function(){var M=new Date("__ISO__");class F extends Date{constructor(...a){a.length===0?super(M.getTime()):super(...a)}static now(){return M.getTime()}}window.Date=F;return "mock-ok"})()'

poke() { # poke <json-literal-js> — escreve, dispara e CONFIRMA a escrita no browser
  R=$(ab eval "(function(){var k=\"hub:recovery:v1:done\";var v=$1;localStorage.setItem(k,JSON.stringify(v));window.dispatchEvent(new StorageEvent(\"storage\",{key:k,newValue:JSON.stringify(v)}));return \"same=\"+(localStorage.getItem(k)===JSON.stringify(v))+\"|\"})()")
  echo "$R" | grep -qF "same=true" && ok "poke-aplicado ($1)" || no "poke-aplicado ($1) — $R"
}
mock() { # mock <iso-SEM-aspas> <poke-json> — o template já tem as aspas
  R=$(ab eval "${MOCK/__ISO__/$1}")
  V=$(ab eval 'new Date().toISOString()')
  echo "$V" | grep -qF "$1" && ok "mock-armado ($1)" || no "mock-armado ($1) — injecao falhou: $R/$V"
  poke "$2"
  sleep 0.6
}

echo "=== FASE A — mock 27/09 (o dia em que a suíte foi escrita: D-4) — LIÇÃO 128: a fase
que correla asserção com relógio REAL apodrece no dia seguinte (a t93 dormiu por
UM dia e a 133 a pegou vermelha: o sweep da 128/129/130 não a listou e o D-4
virou D-3). A casa manda a suíte PLANTAR o dia, nunca herdá-lo — e a sessão é
NOVA com init-script, para não herdar o mock de quem veio antes (lição 133). ==="
ab set viewport 1440 900 >/dev/null
MOCKJS93=/tmp/t93-mock.js
cat > "$MOCKJS93" <<'EOF'
(function(){var M=new Date('2026-09-27T10:00:00').getTime();class F extends Date{constructor(...a){a.length===0?super(M):super(...a)}static now(){return M}}window.Date=F})()
EOF
for ATT in 1 2 3; do
  ab close >/dev/null 2>&1; sleep 3
  ab open --init-script "$MOCKJS93" http://localhost:3000 >/dev/null 2>&1
  sleep 6
  D=$(ab eval 'new Date().toDateString()')
  echo "$D" | grep -qF 'Sun Sep 27 2026' && break
  [ "$ATT" = 3 ] && echo "FAIL A0-mock-nao-aterrissou ($D)" && FAIL=$((FAIL+1))
done
poke '{}' # NORMALIZA: o done do perfil pode ter resto de QAs anteriores —
          # o poke de B precisa ser uma TRANSIÇÃO de valor (o guard engole
          # valor idêntico — lição 90), senão a fila nunca recomputa.
T=$(ab eval "document.body.innerText")
has 'Plano da prova (D-4)' "$T" A1-mat-pointer-D4
has 'Semana 2 no Praticar' "$T" A2-alg-S2-primeiro
nohas 'PRAZO HOJE' "$T" A3-sem-prazo-fora-do-dia

echo "=== FASE B — mock 29/09: o prazo aparece na fila ==="
mock '2026-09-29T10:00:00' '{__t93:1}'
T=$(ab eval "document.body.innerText")
has 'PRAZO HOJE: entrega da S3' "$T" B1-texto-prazo
has 'prazo hoje' "$T" B2-chip-prazo-hoje
has 'Plano da prova (D-2)' "$T" B3-mat-pointer-D2-no-mesmo-frame
CB=$(ab eval '(function(){return document.getElementById("rec-alg-s3-entrega")?"cb-sim|":"cb-nao|"})()')
has 'cb-sim' "$CB" B4-checkbox-do-prazo-existe
CL=$(ab eval '(function(){var el=document.getElementById("rec-alg-s3-entrega");if(!el)return "li=nao|";var li=el.closest("li");return "li="+(li.className.indexOf("border-amber-500/60")>=0?"amber":"outro")+"|pulse="+(li.querySelector(".animate-pulse")?"sim":"nao")+"|"})()')
has 'li=amber' "$CL" B5-li-na-familia-ehoje
has 'pulse=sim' "$CL" B6-relogio-pulsa
ab scrollintoview '#rec-alg-s3-entrega' >/dev/null; sleep 0.5
ab screenshot scripts/qa93-fila-prazo-dark.png >/dev/null && ok B7-shot-dark

echo "=== FASE B2 — light (mesmo estado) ==="
ab eval '(function(){var d=document.documentElement.classList;d.remove("dark");d.add("light");return "light-ok"})()' >/dev/null; sleep 0.4
ab screenshot scripts/qa93-fila-prazo-light.png >/dev/null && ok B8-shot-light
ab eval '(function(){var d=document.documentElement.classList;d.remove("light");d.add("dark");return "dark-ok"})()' >/dev/null; sleep 0.4

echo "=== FASE C — entrega marcada AO VIVO: fallback honesto ==="
ab check '#rec-alg-s3-entrega' >/dev/null; sleep 0.6
CB2=$(ab eval '(function(){return document.getElementById("rec-alg-s2")?"s2-na-fila|":"s2-fora|"})()')
has 's2-na-fila' "$CB2" C1-fallback-S2-volta-pra-fila
T=$(ab eval "document.body.innerText")
nohas 'prazo hoje' "$T" C2-chip-some-quando-entregue
LT=$(ab eval '(function(){return document.getElementById("rec-alg-s3-entrega")?"prazo-ainda-na-fila|":"prazo-saiu|"})()')
has 'prazo-saiu' "$LT" C3-entregue-sai-da-fila-contrato-1a-pendente
ST=$(ab eval 'localStorage.getItem("hub:recovery:v1:done")')
has 'alg-s3-entrega' "$ST" C4-registro-persiste-no-done
ab scrollintoview '#rec-alg-s2' >/dev/null; sleep 0.4
ab screenshot scripts/qa93-fila-prazo-done.png >/dev/null && ok C5-shot-done

echo "=== FASE D — reload: registro sobrevive, mock morre ==="
ab reload >/dev/null; sleep 3
T=$(ab eval "document.body.innerText")
nohas 'PRAZO HOJE' "$T" D1-real-date-sem-prazo
ST=$(ab eval 'localStorage.getItem("hub:recovery:v1:done")')
has 'alg-s3-entrega' "$ST" D2-done-sobreviveu

echo "=== FASE E — desmarcado: o prazo volta no dia (máquina de estados) ==="
poke '{}' '{}'
mock '2026-09-29T10:00:00' '{__t93:9}'
T=$(ab eval "document.body.innerText")
has 'PRAZO HOJE: entrega da S3' "$T" E1-prazo-voltou

echo "=== FASE F — dia passado e prova: prazo cala ==="
mock '2026-09-30T10:00:00' '{__t93:8}'
T=$(ab eval "document.body.innerText")
nohas 'PRAZO HOJE' "$T" F1-dia-passado-sem-prazo
has 'Semana 2 no Praticar' "$T" F2-alg-volta-pro-normal
has 'Plano da prova (D-1)' "$T" F3-mat-pointer-vespera
mock '2026-10-01T10:00:00' '{__t93:7}'
T=$(ab eval "document.body.innerText")
has 'Plano da prova (D-0)' "$T" F4-mat-pointer-prova
nohas 'PRAZO HOJE' "$T" F5-prova-sem-prazo

echo "=== FASE G — mobile 390 com o prazo visível ==="
mock '2026-09-29T10:00:00' '{__t93:6}'
ab set viewport 390 844 >/dev/null; sleep 1
W=$(ab eval 'document.documentElement.scrollWidth+"|"+document.documentElement.clientWidth' | tr -d '"')
SC=$(echo "$W" | cut -d"|" -f1); CLW=$(echo "$W" | cut -d"|" -f2)
if [ "${SC:-9999}" -le 390 ]; then ok G1-sem-overflow-horizontal; else no G1-sem-overflow-horizontal; fi
ab scrollintoview '#rec-alg-s3-entrega' >/dev/null; sleep 0.5
ab screenshot scripts/qa93-fila-prazo-mobile390.png >/dev/null && ok G2-shot-mobile
ab set viewport 1440 900 >/dev/null; sleep 0.5

echo "=== FASE H — higiene e console (mock 27/09 de novo: a fase RESTAURADORA também
herdava o relógio real — a lição 129 chamou isso de 'asserção de restauração
apodrece'; planta o dia da escrita e a restauração volta a significar) ==="
for ATT in 1 2 3; do
  ab close >/dev/null 2>&1; sleep 3
  ab open --init-script "$MOCKJS93" http://localhost:3000 >/dev/null 2>&1
  sleep 6
  D=$(ab eval 'new Date().toDateString()')
  echo "$D" | grep -qF 'Sun Sep 27 2026' && break
done
poke '{}' '{}'
ab reload >/dev/null; sleep 3
T=$(ab eval "document.body.innerText")
nohas 'PRAZO HOJE' "$T" H1-real-date-limpo
has 'Semana 2 no Praticar' "$T" H2-fila-normal-restaurada
ST=$(ab eval 'localStorage.getItem("hub:recovery:v1:done")')
nohas '__t93' "$ST" H3-poke-fora
nohas 'alg-s3-entrega' "$ST" H4-done-zerado
RG=$(ab eval '(function(){var n=0;for(var k in localStorage){if(k.indexOf("realGrades")>=0)n++}return "rg="+n+"|"})()')
has 'rg=0' "$RG" H5-realGrades-intocado
ERR=$(ab errors)
if [ -z "$ERR" ] || ! echo "$ERR" | grep -qiE "error"; then ok H6-console-sem-erros; else no H6-console-sem-erros; fi

echo ""
echo "=== RESULTADO: PASS=$PASS FAIL=$FAIL ==="
[ "$FAIL" -eq 0 ] && echo "ALL GREEN" || echo "HÁ FALHAS — revisar acima"
