#!/bin/bash
# Task 115 — O APP NÃO DORME NO RELÓGIO: o dashboard tinha TRÊS fontes de
# tempo próprias — o hero ('Faltam N dias') e o header votavam com
# setInterval de 60s CADA (a árvore inteira re-renderizava duas vezes por
# minuto por fontes diferentes), e a Agenda acadêmica + a fileira 'Próximas
# avaliações' só liam o relógio NO MOUNT: a tab aberta na virada do dia
# continuava dizendo 'em 2d' à meia-noite passada — o badge mentia até um
# reload. O useNow da 113 (a fonte de tempo viva do app) agora alimenta
# TUDO: três loops a menos no mundo, e a virada do dia flipa os badges no
# mesmo tick (lição 79). [ESTILO] A fileira de avaliações aprende a MESMA
# rampa de urgência da agenda (114): prova HOJE = sólido amber + pulso,
# a ≤2d = o tom do 'amanhã', longe = a identidade da disciplina.
# Este E2E verifica: [A] data real D-4 = hero 'Faltam 4 dias' + 3 rows
# ('4d'/'12d'/'33d' na identidade da disciplina — rampa não vaza a 4d) +
# agenda S3 'em 2d' + header badges; [B] mock 01/10 = Av1 'hoje' SÓLIDO +
# pulso na fileira + hero 'É hoje' (regressão); [C] A VIRADA VIVA — mount
# 23:59:30 de segunda, re-mock 00:01 de terça SEM reload, 62s de tick: S3
# 'em 1d' → 'hoje' + hero 'Faltam 3' → 'Faltam 2' + strip do simulado 'É
# hoje' flipam sozinhos; [D] mobile 390; [E] higiene + console 0.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t115.log 2>&1 &)
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
clean_all_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.__poke;delete p.realGrades;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs=0'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
go_dash_remount() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
# Badge da row de avaliação (Próximas avaliações): o badge ml-auto cuja
# card contém o nome da avaliação + o status de PPC ('em dia' OU 'atrasada' —
# o perfil de QA limpo tem progresso 0 = 'atrasada'; só as rows de avaliações têm esse par)
row_badge_class() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0&&(t.indexOf('em dia')>=0||t.indexOf('atrasada')>=0||t.indexOf('em estudo')>=0||t.indexOf('sem registro')>=0)){var bs=cards[i].querySelectorAll('[data-slot=\"badge\"]');for(var j=0;j<bs.length;j++){if((bs[j].className||'').indexOf('ml-auto')>=0)return bs[j].className}} }return 'NOCARD'})()" 2>/dev/null | tr -d '"'
}
row_badge_pulse() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0&&(t.indexOf('em dia')>=0||t.indexOf('atrasada')>=0||t.indexOf('em estudo')>=0||t.indexOf('sem registro')>=0)){var bs=cards[i].querySelectorAll('[data-slot=\"badge\"]');for(var j=0;j<bs.length;j++){if((bs[j].className||'').indexOf('ml-auto')>=0){return (bs[j].querySelector('span.animate-pulse')?1:0)}}}}return -1})()" 2>/dev/null | tr -d '"'
}
agenda_badge_class() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0){var b=cards[i].querySelector('[data-slot=\"badge\"]');return b?b.className:'NOBADGE'}}return 'NOCARD'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] MOCK 27/09 (D-4): o hero e as fileiras vivem do useNow — poda da 120, lição 117 ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 1
echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1
go_dash_remount

[ "$(has 'Faltam 4 dias')" = "1" ] && ok "hero 'Faltam 4 dias' (useNow alimenta o nextEval do hero)" || bad "hero do nextEval quebrou"
[ "$(has '4d')" = "1" ] && [ "$(has '12d')" = "1" ] && [ "$(has '33d')" = "1" ] && ok "Próximas avaliações: Av1 4d · LM 12d · Alg 33d (as três rows vivas)" || bad "rows de avaliações erradas"
BA=$(row_badge_class 'Av1')
echo "$BA" | grep -q 'tabular-nums' && ok "badge da row com tabular-nums (a gramática da casa)" || bad "badge da row sem tabular-nums: $BA"
echo "$BA" | grep -q 'amber-300/70' && bad "rampa vazou para a 4d (urgência é ≤2d)" || ok "row a 4d mantém a identidade da disciplina (rampa não vaza)"
[ "$(has 'entrega da S3 — programas')" = "1" ] && [ "$(has 'em 2d')" = "1" ] && ok "agenda S3 'em 2d' segue de pé (regressão 114)" || bad "agenda da 114 quebrou"
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
T0=$(date -d "today 00:00" +%s); B=$(date -d "2026-10-01" +%s); HD=$(( (B - T0 + 86399) / 86400 ))
[ "$(has 'em 2d')" = "1" ] && [ "$(has "${HD}d → Av1 (Matemática)")" = "1" ] && ok "header: simulado 'em 2d' (mock) + nextEval '${HD}d → Av1' (o badge segue o relógio REAL — o header não remonta)" || bad "header badges errados (HD=$HD)"
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2

echo "=== [B] MOCK 01/10 (dia da prova): a fileira aprende a voz do marco ==="
mock_date '2026-10-01T09:00:00' >/dev/null; poke
go_dash_remount

BB=$(row_badge_class 'Av1')
echo "$BB" | grep -q 'bg-amber-500' && ok "row da Av1 'hoje' SÓLIDO amber (mesma família do header 'É hoje')" || bad "row da Av1 sem o sólido do hoje: $BB"
[ "$(row_badge_pulse 'Av1')" = "1" ] && ok "ícone da prova HOJE pulsa" || bad "'hoje' na row sem pulso"
[ "$(has 'É hoje: Av1 — Matemática')" = "1" ] && ok "hero mantém 'É hoje: Av1 — Matemática. Boa prova!' (regressão)" || bad "hero do dia da prova quebrou"
[ "$(has 'entrega da S3 — programas')" = "0" ] && ok "agenda segue honesta (S3 já cumprida, sem fantasma)" || bad "S3 fantasma no dia da prova"

echo "=== [C] A VIRADA VIVA: segunda 23:59:30 → terça 00:01, SEM reload ==="
mock_date '2026-09-28T23:59:30' >/dev/null; poke
go_dash_remount
[ "$(has 'em 1d')" = "1" ] && ok "segunda 23:59: S3 'em 1d' (véspera do simulado)" || bad "S3 não está 'em 1d' na segunda"
[ "$(has 'Faltam 3 dias')" = "1" ] && ok "hero 'Faltam 3 dias' (D-3)" || bad "hero errado na segunda"
[ "$(has 'Faltam 2 dias')" = "1" ] && bad "hero já diz 2 dias antes da virada?!" || ok "hero ainda não virou (o relógio não mente)"
# Re-mock SEM remount: o tick do useNow (60s) pega a nova hora sozinho
mock_date '2026-09-29T00:01:00' >/dev/null
echo "  (aguardando o tick de 60s do useNow...)"
sleep 62
BC=$(agenda_badge_class 'entrega da S3 — programas')
echo "$BC" | grep -q 'bg-amber-500' && ok "S3 flipou 'em 1d' → 'hoje' SÓLIDO SEM reload (a agenda é viva)" || bad "agenda dormiu no relógio: $BC"
[ "$(has 'Faltam 2 dias')" = "1" ] && ok "hero flipou 'Faltam 3' → 'Faltam 2' no mesmo tick" || bad "hero dormiu no relógio"
[ "$(has 'É hoje: Simulado')" = "1" ] && ok "card de hoje: strip 'É hoje: Simulado da Av1' (o tick de 1s da 113)" || bad "strip do simulado não virou"

echo "=== [D] MOBILE 390: dashboard vivo sem overflow ==="
mock_date '2026-09-27T19:00:00' >/dev/null; poke
go_dash_remount
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser screenshot scripts/qa115-tick-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa115-tick-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
agent-browser screenshot scripts/qa115-tick-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa115-tick-desktop.png)" || bad "screenshot falhou"

echo "=== [E] HIGIENE + CONSOLE (reload mata o mock) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
H=$(clean_all_runs)
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RUNS"
echo "$H" >/dev/null 2>&1
[ "$RUNS" = "runs=0 poke=0 realGrades=0" ] && ok "storage limpo (runs/poke/realGrades)" || bad "resíduo no storage: $RUNS"
D=$(agent-browser eval "(function(){var n=new Date();var a=new Date(n.getFullYear(),n.getMonth(),n.getDate());var b=new Date(2026,9,1);return Math.ceil((b-a)/86400000)})()" 2>/dev/null | tr -d '"')
case "$D" in ''|*[!0-9-]*) D="?" ;; esac
if [ "$D" != "?" ] && [ "$D" -ge 1 ] 2>/dev/null; then
  [ "$(has "Faltam $D dias")" = "1" ] && ok "data real de volta (hero D-$D lido do relógio real)" || bad "data real não voltou (esperado 'Faltam $D dias')"
else
  ok "data real de volta (relógio real fora da contagem: D=$D)"
fi
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t115 o app não dorme no relógio (o tick único chegou ao dashboard)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
