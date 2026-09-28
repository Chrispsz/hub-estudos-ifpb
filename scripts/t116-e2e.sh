#!/bin/bash
# Task 116 — O LEITNER NÃO DORME NO RELÓGIO: o agendamento do baralho vivia
# num useMemo que cacheava Date.now() — o cartão 'Errei' (volta em 5min) só
# "nascia" num reload ou noutra mutação de storage: o botão 'Revisar agora'
# continuava DESABILITADO com cartões vencidos, a linha do dashboard não
# nascia, o kit da véspera dizia 'em dia' mentindo, e o tutor ouvia um
# vencimento do passado. Este E2E verifica: [A] baralho vazio = silêncio
# honesto; [B] 3 cartões semeados = placar/badge/rótulos vivos + linha no
# dashboard; [C] A BATIDA: cartão vence com a tab aberta e o botão HABILITA
# SOZINHO no tick de 30s, sem reload; [D] kit da véspera (mock D-3) lê o
# baralho real e flipa no storage; [E] mobile 390; [F] higiene zero.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t116.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
# seed_cards — cartões com dueAt RELATIVO ao relógio DA PÁGINA (offset em
# segundos; negativo = vencido). Fonte da verdade: o relógio do browser,
# não o do shell — sem skew entre server e cliente.
seed_cards() { # $1=offset_seg cartão1 · $2=offset cartão2 · $3=offset cartão3 ('x' = pula)
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.flashcards=[];var offs=['$1','$2','$3'];var fronts=['Álgebra: o que é uma matriz identidade?','Álgebra: condição de existência do inverso','Lógica: tabela-verdade do OU exclusivo'];var backs=['matriz I: diagonal 1, resto 0','determinante diferente de zero','1 quando os bits diferem'];var i;for(i=0;i<offs.length;i++){if(offs[i]==='x')continue;var due=new Date(Date.now()+parseInt(offs[i],10)*1000).toISOString();p.flashcards.push({id:'qa116-'+i,disciplineCode:'TEC.1984',front:fronts[i],back:backs[i],source:'manual',createdAt:new Date(Date.now()-86400000).toISOString(),box:i===0?0:2,dueAt:due,reviews:2,lapses:i===0?1:0})}var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'cards='+p.flashcards.length})()" 2>/dev/null | tr -d '"'
}
clean_all_cards() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.flashcards;delete p.simuladoRuns;delete p.__poke;delete p.realGrades;localStorage.removeItem('hub:math-exam:v1:deck-added');var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'clean'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
go_home() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Visão Geral')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
go_flashcards() { # Praticar → aba Flashcards
  # LIÇÃO 116 (duas): (1) o botão lateral ganha badge de vencidos ('Praticar1')
  # quando há cartão due — casar por PREFIXO, não por igualdade; (2) o
  # TabsTrigger (Radix) ignora o click sintético do eval (sem pointerdown) —
  # a aba só troca com clique NATIVO por ref do snapshot.
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Praticar')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    FCREF=$(agent-browser snapshot -c 2>&1 | grep -oE 'tab "Flashcards[^"]*" \[ref=e[0-9]+' | grep -oE 'e[0-9]+' | head -1)
    [ -n "$FCREF" ] && agent-browser click "$FCREF" >/dev/null 2>&1
    sleep 2
    [ "$(has 'Flashcards — revisão espaçada')" = "1" ] && return 0
  done
  return 1
}
# review_btn — estado do botão 'Revisar agora' da VIEW de flashcards:
# enabled | disabled | absent (o badge conta os vencidos)
review_btn() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'');if(t.indexOf('Revisar agora')>=0){return els[i].disabled?'disabled':'enabled:'+t.replace(/[^0-9]/g,'')}}return 'absent'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] DATA REAL, BARALHO VAZIO: silêncio honesto ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
# Espera o app ficar pronto (cold compile do dev pode passar de 30s)
for i in $(seq 1 30); do
  [ "$(has 'Visão Geral')" = "1" ] && break
  sleep 2
done
sleep 2
agent-browser set viewport 1440 900 >/dev/null 2>&1
clean_all_cards >/dev/null 2>&1
go_flashcards || bad "não chegou na aba Flashcards"
[ "$(has 'Nenhum cartão por aqui ainda')" = "1" ] && ok "estado vazio honesto presente" || bad "estado vazio ausente"
A1=$(review_btn)
[ "$A1" = "disabled" ] && ok "'Revisar agora' desabilitado sem baralho" || bad "botão sem baralho: $A1"
[ "$(has 'próxima revisão')" = "0" ] && ok "linha do relógio cala com baralho vazio (nada para antecipar)" || bad "linha do relógio vazou com baralho vazio"

echo "=== [B] TRÊS CARTÕES SEMEADOS: placar, badge e rótulos vivos ==="
seed_cards '-180' '300' '7200' >/dev/null
sleep 1
B1=$(review_btn)
echo "$B1" | grep -q '^enabled' && ok "botão habilitou no storage event (badge/contador: $(echo "$B1" | cut -d: -f2))" || bad "botão deveria estar habilitado: $B1"
[ "$(has 'atrasado')" = "1" ] && ok "cartão vencido com rótulo 'atrasado Nmin' vivo (a contagem corre — número exato é corrida com o relógio)" || bad "rótulo do vencido ausente"
[ "$(has 'em 5min')" = "1" ] && ok "cartão futuro 'em 5min'" || bad "rótulo do futuro ausente"
[ "$(has 'em 2h')" = "1" ] && ok "cartão distante 'em 2h'" || bad "rótulo do distante ausente"
[ "$(has 'próxima revisão')" = "0" ] && ok "linha do relógio cala com vencidos (o botão fala)" || bad "linha duplicou a voz do botão"
[ "$(has 'Retenção')" = "1" ] && ok "placar presente" || bad "placar ausente"
go_home
sleep 1
[ "$(has 'Revisão espaçada — 1 cartão esperando')" = "1" ] && ok "linha do dashboard nasce na montagem (singular correto)" || bad "linha do dashboard ausente/errada"

echo "=== [C] A BATIDA (o coração): vencimento ao vivo, SEM reload ==="
go_flashcards >/dev/null 2>&1
clean_all_cards >/dev/null 2>&1
seed_cards '40' 'x' 'x' >/dev/null
sleep 1
C1=$(review_btn)
[ "$C1" = "disabled" ] && ok "pré-vencimento: botão desabilitado" || bad "pré-vencimento deveria estar desabilitado: $C1"
[ "$(has 'próxima revisão')" = "1" ] && ok "linha do relógio antecipa ('em 2min' com o Clock âmbar)" || bad "linha do relógio ausente pré-vencimento"
echo "  (aguardando o cartão vencer — dois ticks de 30s do useNow...)"
sleep 78
C2=$(review_btn)
echo "$C2" | grep -q '^enabled' && ok "POW: botão HABILITOU SOZINHO no tick, zero reload" || bad "a batida morreu: $C2"
[ "$(has 'próxima revisão')" = "0" ] && ok "linha do relógio calou (o vencido virou presente)" || bad "linha fantasma pós-vencimento"
[ "$(has 'atrasado')" = "1" ] && ok "linha do cartão flipou para 'atrasado Nmin' ao vivo (o rótulo envelhece no tick)" || bad "cartão não flipou: $(has 'atrasado')"

echo "=== [D] KIT DA VÉSPERA (mock D-3) lê o baralho REAL e flipa no storage ==="
mock_date '2026-09-28T20:00:00' >/dev/null
clean_all_cards >/dev/null 2>&1
agent-browser eval "(function(){localStorage.setItem('hub:math-exam:v1:deck-added','1');var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.flashcards=[{id:'qa116-k1',disciplineCode:'TEC.1984',front:'Matriz inversa',back:'A⁻¹ existe sse det ≠ 0',source:'manual',createdAt:new Date(Date.now()-86400000).toISOString(),box:1,dueAt:new Date(Date.now()-3600000).toISOString(),reviews:1,lapses:0},{id:'qa116-k2',disciplineCode:'TEC.1984',front:'Multiplicação de matrizes',back:'linha × coluna',source:'manual',createdAt:new Date(Date.now()-86400000).toISOString(),box:0,dueAt:new Date(Date.now()-60000).toISOString(),reviews:0,lapses:0}];var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok2'})()" >/dev/null 2>&1
go_home
sleep 2
[ "$(has 'Kit da véspera')" = "1" ] && ok "kit visível no mock D-3" || bad "kit ausente no D-3"
[ "$(has '2 hoje')" = "1" ] && ok "linha de flashcards do kit: '2 hoje' (o baralho real no kit)" || bad "chip do kit não lê 2 vencidos"
[ "$(has 'cartões vencem hoje no Leitner')" = "1" ] && ok "frase do Leitner presente na linha do kit" || bad "frase do Leitner ausente"
clean_all_cards >/dev/null 2>&1
sleep 1
[ "$(has 'em dia')" = "1" ] && ok "baralho limpo → kit flipa para 'em dia' no storage event (render-time)" || bad "kit não flipou para 'em dia'"

echo "=== [E] MOBILE 390: baralho vivo sem overflow ==="
clean_all_cards >/dev/null 2>&1
seed_cards '-60' '3600' 'x' >/dev/null
go_flashcards >/dev/null 2>&1
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var hs=document.querySelectorAll('h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Flashcards')>=0){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa116-leitner-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa116-leitner-mobile390.png)" || bad "screenshot mobile falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
go_flashcards >/dev/null 2>&1
agent-browser eval "(function(){var hs=document.querySelectorAll('h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Flashcards')>=0){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa116-leitner-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa116-leitner-desktop.png)" || bad "screenshot desktop falhou"

echo "=== [F] HIGIENE + CONSOLE (reload mata o mock) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
H=$(clean_all_cards)
RES=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' cards='+((p.flashcards||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RES"
echo "$H" >/dev/null 2>&1
[ "$RES" = "runs=0 cards=0 poke=0 realGrades=0" ] && ok "storage limpo (runs/cards/poke/realGrades)" || bad "resíduo no storage: $RES"
[ "$(has 'Faltam')" = "1" ] && ok "data real de volta (hero do relógio vivo)" || bad "hero sem 'Faltam' (relógio estranho)"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t116 o Leitner não dorme no relógio (o baralho respira com a tab aberta)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
