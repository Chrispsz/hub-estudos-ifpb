#!/usr/bin/env bash
# t94-e2e.sh — QA E2E da Task 94 (ciclo 416224, rodada 22:00) — v2
# Foco: o CONJUNTO material-first no Praticar — a folha da S3 abre as 8
# questões EXATAS (filtro por linkedMaterial + chip violeta com X), a partir
# dos chips da fila (ação genérica alg-s3 e prazo de 29/09).
# Lições aplicadas: assert de contagem EXATA por elemento (grep de substring
# pegou '18' como '8' na v1), navegação pelo rótulo REAL do DOM ('Visão
# Geral'), self-verifying mock/poke (93), asserção em pipe (90.4).
set -u
cd /home/z/my-project
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS $1"; }
no()   { FAIL=$((FAIL+1)); echo "FAIL $1"; }
has()  { echo "$2" | grep -qF "$1" && ok "$3" || no "$3"; }
nohas(){ echo "$2" | grep -qF "$1" && no "$3" || ok "$3"; }
ab()   { agent-browser "$@" 2>/dev/null; }

MOCK='(function(){var M=new Date("__ISO__");class F extends Date{constructor(...a){a.length===0?super(M.getTime()):super(...a)}static now(){return M.getTime()}}window.Date=F;return "mock-ok"})()'

exact_count() { # lê o contador da lista de exercícios DIRETO do elemento
  ab eval '(function(){var d=[].slice.call(document.querySelectorAll("div")).find(function(x){return /^[0-9]+ exercício\(s\)$/.test(x.textContent.trim())});return d?"count="+d.textContent.trim().replace(/[^0-9]/g,"")+"|":"sem-contador|"})()' | tr -d '"'
}
assert_count() { # assert_count <esperado> <nome>
  C=$(exact_count)
  echo "$C" | grep -qF "count=$1" && ok "$2 (=$1)" || no "$2 — obtido $C"
}
poke() { # poke <json-literal-js> — done do recovery com read-back no browser
  R=$(ab eval "(function(){var k=\"hub:recovery:v1:done\";var v=$1;localStorage.setItem(k,JSON.stringify(v));window.dispatchEvent(new StorageEvent(\"storage\",{key:k,newValue:JSON.stringify(v)}));return \"same=\"+(localStorage.getItem(k)===JSON.stringify(v))+\"|\"})()")
  echo "$R" | grep -qF "same=true" && ok "poke-aplicado ($1)" || no "poke-aplicado ($1) — $R"
}
mock() { # mock <iso-SEM-aspas> <poke-json> — self-verifying (lições 93)
  R=$(ab eval "${MOCK/__ISO__/$1}")
  V=$(ab eval 'new Date().toISOString()')
  echo "$V" | grep -qF "$1" && ok "mock-armado ($1)" || no "mock-armado ($1) — $R/$V"
  poke "$2"
  sleep 0.6
}
click_praticar() { # clica o ÚNICO chip 'praticar' da fila do recovery
  R=$(ab eval '(function(){var b=[].slice.call(document.querySelectorAll("button")).find(function(x){return x.textContent.trim()==="praticar"});if(!b)return "sem-chip|";b.click();return "clicou|"})()')
  echo "$R" | grep -qF "clicou" && ok "chip-praticar-clicado" || no "chip-praticar-clicado — $R"
  sleep 1
}
goto_visao() { # volta ao Painel pela sidebar (rótulo REAL: 'Visão Geral')
  R=$(ab eval '(function(){var b=[].slice.call(document.querySelectorAll("button")).find(function(x){return x.textContent.trim()==="Visão Geral"});if(!b)return "sem-nav|";b.click();return "navegou|"})()')
  echo "$R" | grep -qF "navegou" && ok "voltou-ao-painel" || no "voltou-ao-painel — $R"
  sleep 1
}
fila_chips() { # estado dos chips do item DA FILA (li com checkbox rec-*)
  # badge = span do prazo · mat = chip material · prat = chip praticar
  local JS='(function(){var txt="__TX__";var li=[].slice.call(document.querySelectorAll("li")).find(function(l){return l.textContent.indexOf(txt)>=0&&l.querySelector("[id^=rec-]")});if(!li)return "badge=?|mat=?|prat=?|";var bs=[].slice.call(li.querySelectorAll("button")).map(function(b){return b.textContent.trim()});return "badge="+(li.textContent.indexOf("prazo hoje")>=0?1:0)+"|mat="+(bs.indexOf("material")>=0?1:0)+"|prat="+(bs.indexOf("praticar")>=0?1:0)+"|"})()'
  ab eval "${JS/__TX__/$1}" | tr -d '"'
}

echo "=== FASE A — data real: caminho genérico intacto (S2, sem conjunto) ==="
ab set viewport 1440 900 >/dev/null
ab open http://localhost:3000 >/dev/null
sleep 3
poke '{}'
T=$(ab eval "document.body.innerText")
has 'FAÇA HOJE, NESTA ORDEM' "$T" A1-fila-visivel
has 'Semana 2 no Praticar' "$T" A2-alg-S2-primeiro
nohas 'Conjunto:' "$T" A3-sem-conjunto-no-painel
CH=$(fila_chips 'Semana 2 no Praticar')
echo "INFO A4-state=$CH"
has 'badge=0' "$CH" A4-s2-sem-badge-prazo
has 'mat=0' "$CH" A5-s2-sem-chip-material
has 'prat=1' "$CH" A4b-s2-tem-chip-praticar
click_praticar
T=$(ab eval "document.body.innerText")
nohas 'Conjunto:' "$T" A6-generico-nao-cria-conjunto
ALGCOUNT=$(exact_count | sed 's/count=//;s/|//')
echo "INFO alg-em-sala-count=$ALGCOUNT"
if [ -n "$ALGCOUNT" ] && [ "$ALGCOUNT" -gt 8 ] 2>/dev/null; then ok A7-contador-alg-presente; else no A7-contador-alg-presente; fi

echo "=== FASE B — ação S3 (genérica): praticar abre as 8 EXATAS ==="
goto_visao
poke '{"alg-s2":true}'
T=$(ab eval "document.body.innerText")
has 'Fazer as 8 questões da Semana 3' "$T" B1-fila-mostra-S3
CH=$(fila_chips 'Fazer as 8 questões da Semana 3')
echo "INFO B2-state=$CH"
has 'mat=1' "$CH" B2-s3-tem-chip-material
has 'prat=1' "$CH" B2b-s3-tem-chip-praticar
click_praticar
T=$(ab eval "document.body.innerText")
has 'Conjunto: Questões da Semana 3' "$T" B3-chip-conjunto-titulo-real
assert_count 8 B4-exatamente-8
has 'Q1 (Semana 3):' "$T" B5-primeira-card-e-a-S3Q1
ab eval 'document.querySelector("[aria-label=\"Limpar o filtro de conjunto\"]")?.closest("div").scrollIntoView({block:"center"})' >/dev/null; sleep 0.5
ab screenshot scripts/qa94-conjunto-dark.png >/dev/null && ok B6-shot-conjunto

echo "=== FASE C — X limpa o conjunto (o filtro não prende) ==="
ab eval '(function(){var b=document.querySelector("[aria-label=\"Limpar o filtro de conjunto\"]");if(!b)return "sem-x|";b.click();return "limpou|"})()' >/dev/null
sleep 0.6
T=$(ab eval "document.body.innerText")
nohas 'Conjunto:' "$T" C1-chip-foi-embora
assert_count "$ALGCOUNT" C2-volta-ao-acervo-alg

echo "=== FASE D — dia do prazo (29/09): o PRAZO também abre o conjunto ==="
goto_visao
mock '2026-09-29T10:00:00' '{}'
T=$(ab eval "document.body.innerText")
has 'PRAZO HOJE: entrega da S3' "$T" D1-prazo-visivel
CH=$(fila_chips 'PRAZO HOJE')
echo "INFO D2-state=$CH"
has 'badge=1' "$CH" D2-chip-prazo-no-item
has 'mat=1' "$CH" D3-prazo-tem-material
has 'prat=1' "$CH" D3b-prazo-tem-praticar
click_praticar
T=$(ab eval "document.body.innerText")
has 'Conjunto: Questões da Semana 3' "$T" D4-prazo-abre-conjunto
assert_count 8 D5-exatamente-8

echo "=== FASE E — interplay: conjunto + tópico (AND) ==="
ab eval '(function(){var s=[].slice.call(document.querySelectorAll("[role=combobox]"));var t=s.find(function(x){return x.textContent.indexOf("Todos")>=0});if(!t)return "sem-select|";t.dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));t.click();return "abriu|"})()' >/dev/null
sleep 0.5
ab eval '(function(){var o=[].slice.call(document.querySelectorAll("[role=option]")).find(function(x){return x.textContent.trim()==="Desvios condicionais"});if(!o)return "sem-op|";o.click();return "sel|"})()' >/dev/null
sleep 0.6
T=$(ab eval "document.body.innerText")
has 'Desvios condicionais' "$T" E1-topico-selecionado
assert_count 8 E2-conjunto-e-topico-combinam-em-8

echo "=== FASE F — anti-vazamento: pedido SEM conjunto limpa (lição 82) ==="
goto_visao
mock '2026-09-27T10:00:00' '{__f:1}' # transição 1 (o guard engole valor idêntico)
poke '{}'                            # transição 2: estado líquido {} no relógio 27/09
T=$(ab eval "document.body.innerText")
has 'Semana 2 no Praticar' "$T" F1-fila-de-volta-ao-S2
click_praticar
T=$(ab eval "document.body.innerText")
nohas 'Conjunto:' "$T" F2-conjunto-limpou-no-pedido-novo
assert_count "$ALGCOUNT" F3-lista-completa-de-volta

echo "=== FASE G — mobile 390 com conjunto ativo ==="
goto_visao
poke '{__f:2}'
poke '{"alg-s2":true}' # transição líquida: alg-s2 done → fila mostra S3
T=$(ab eval "document.body.innerText")
has 'Fazer as 8 questões da Semana 3' "$T" G0-fila-mostra-S3
click_praticar
ab set viewport 390 844 >/dev/null; sleep 1
T=$(ab eval "document.body.innerText")
has 'Conjunto: Questões da Semana 3' "$T" G1-conjunto-no-mobile
assert_count 8 G2-oito-no-mobile
W=$(ab eval 'document.documentElement.scrollWidth+"|"+document.documentElement.clientWidth' | tr -d '"')
SC=$(echo "$W" | cut -d"|" -f1)
if [ "${SC:-9999}" -le 390 ]; then ok G3-sem-overflow; else no G3-sem-overflow; fi
ab screenshot scripts/qa94-conjunto-mobile390.png >/dev/null && ok G4-shot-mobile
ab set viewport 1440 900 >/dev/null; sleep 0.5

echo "=== FASE H — higiene e console ==="
goto_visao
poke '{__f:3}'
poke '{}'
ab reload >/dev/null; sleep 3
T=$(ab eval "document.body.innerText")
nohas 'PRAZO HOJE' "$T" H1-fila-real-limpa
ST=$(ab eval 'localStorage.getItem("hub:recovery:v1:done")')
nohas 'alg-s2' "$ST" H2-done-zerado
RG=$(ab eval '(function(){var n=0;for(var k in localStorage){if(k.indexOf("realGrades")>=0)n++}return "rg="+n+"|"})()')
has 'rg=0' "$RG" H3-realGrades-intocado
ERR=$(ab errors)
if [ -z "$ERR" ] || ! echo "$ERR" | grep -qiE "error"; then ok H4-console-sem-erros; else no H4-console-sem-erros; fi

echo ""
echo "=== RESULTADO: PASS=$PASS FAIL=$FAIL ==="
[ "$FAIL" -eq 0 ] && echo "ALL GREEN" || echo "HÁ FALHAS — revisar acima"
