#!/bin/bash
# Task 114 — A ENTREGA EXISTE NO CALENDÁRIO: a S3 de Algoritmos (29/09, fonte:
# dono, documentada no math-exam-prep) era o ÚNICO prazo escolar da semana da
# Av1 e NÃO existia na agenda acadêmica — o app dizia '+ S3 de Algoritmos' em
# sussurros (subtitulo do marco, title do header) mas o calendário, a
# superfície cujo trabalho são prazos, não tinha o evento: no D-4 o card
# 'Agenda acadêmica' mostrava o evento mais próximo a 10 dias (a semana mais
# importante do semestre não existia nele). Este E2E verifica: [A] data real
# D-4 = S3 em 'em 2d' no TOPO da agenda + weekday 'TER' na caixa + tom
# urgPerto + trancamento/LM mantêm a identidade do kind + 'Semana de Ciência'
# sai honestamente do top-4; [B] mock 29/09 = badge 'hoje' SÓLIDO amber com
# pulso (gramática do header 'É hoje') + badge do simulado segue no header;
# [C] mock 30/09 = prazo passado SAI da lista (nada de prazo fantasma);
# [D] mobile 390 sem overflow; [E] higiene zero + console 0 + data real.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t114.log 2>&1 &)
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
# Remount do dashboard (a AcademicAgenda lê new Date() no mount): sai para
# Estudar e volta — o mock de Date sobrevive à navegação SPA.
go_dash_remount() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
# O CARD da agenda que contém um marcador de título → className do Badge
agenda_badge_class() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0){var b=cards[i].querySelector('[data-slot=\"badge\"]');return b?b.className:'NOBADGE'}}return 'NOCARD'})()" 2>/dev/null | tr -d '"'
}
# Ordem dos prazos no documento: índice do card de cada marcador
agenda_index() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0){return i}}return -1})()" 2>/dev/null | tr -d '"'
}
agenda_weekday() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0){return (t.indexOf('$2')>=0?1:0)}}return -1})()" 2>/dev/null | tr -d '"'
}
# O pulso mora no SPAN INTERNO do badge (ícone), não no className do badge
badge_pulse() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0){var b=cards[i].querySelector('[data-slot=\"badge\"]');if(!b)return 0;return (b.querySelector('span.animate-pulse')?1:0)}}return -1})()" 2>/dev/null | tr -d '"'
}
# 'agora no relógio do plano' é TITLE (não textContent) — lição 105: a
# asserção copia o DOM real, e title não aparece em body.textContent
agora_label() {
  agent-browser eval "(function(){var els=document.querySelectorAll('span[title]');for(var i=0;i<els.length;i++){if(els[i].getAttribute('title').indexOf('agora no relógio do plano')===0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
scroll_agenda() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('entrega da S3 — programas')>=0){cards[i].scrollIntoView({block:'center'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [A] MOCK 27/09 (D-4): a S3 existe na agenda acadêmica — poda da 120, lição 117 ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 1
echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1
go_dash_remount

[ "$(has 'entrega da S3 — programas')" = "1" ] && ok "S3 na Agenda acadêmica ('Alg: entrega da S3 — programas (Classroom)')" || bad "S3 ausente da agenda acadêmica"
[ "$(has 'Entrega da Semana 3 no Classroom, no mesmo dia do Simulado da Av1')" = "1" ] && ok "descrição honesta: entrega no mesmo dia do simulado" || bad "descrição da S3 errada"
[ "$(has 'em 2d')" = "1" ] && ok "badge 'em 2d' (29/09 a 2 dias do D-4)" || bad "badge 'em 2d' ausente"
BC=$(agenda_badge_class 'entrega da S3 — programas')
echo "$BC" | grep -q 'border-amber-300/70' && ok "badge S3 no tom urgPerto (família do 'amanhã' do header)" || bad "badge S3 sem o tom de urgência: $BC"
echo "$BC" | grep -q 'animate-pulse' && bad "badge 'em 2d' PULSA (pulso é só do hoje)" || ok "'em 2d' sem pulso (a calma da espera, sem grito)"
[ "$(agenda_weekday 'entrega da S3 — programas' 'TER')" = "1" ] && ok "caixa de data diz TER (a casa nomeia o dia da semana)" || bad "weekday ausente na caixa de data"
BCN=$(agenda_badge_class 'trancamento 2026.2')
echo "$BCN" | grep -q 'border-amber-200' && ok "prazo a 10d mantém a identidade pale do kind (rampa não vaza)" || bad "rampa de urgência vazou para prazo longe: $BCN"
IS3=$(agenda_index 'entrega da S3 — programas'); ITR=$(agenda_index 'trancamento 2026.2'); ILM=$(agenda_index 'LM: entrega do Projeto')
[ "$IS3" -ge 0 ] && [ "$IS3" -lt "$ITR" ] && [ "$ITR" -lt "$ILM" ] 2>/dev/null && ok "S3 no TOPO da agenda (ordem por dias: S3 2d < trancamento 10d < LM 12d)" || bad "ordem da agenda errada (S3=$IS3 tranc=$ITR LM=$ILM)"
[ "$(has 'Semana de Ciência')" = "0" ] && ok "'Semana de Ciência' (22d) sai honestamente do top-4 (a semana AGORA vem primeiro)" || bad "top-4 não rotacionou"
scroll_agenda
agent-browser screenshot scripts/qa114-agenda-s3-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa114-agenda-s3-desktop.png)" || bad "screenshot falhou"

echo "=== [B] MOCK 29/09 (dia da S3 + do simulado): 'hoje' sólido + pulso ==="
mock_date '2026-09-29T08:15:00' >/dev/null; poke
go_dash_remount

BC2=$(agenda_badge_class 'entrega da S3 — programas')
echo "$BC2" | grep -q 'bg-amber-500' && ok "badge S3 'hoje' SÓLIDO amber (gramática do header 'É hoje')" || bad "badge S3 sem o sólido do hoje: $BC2"
[ "$(badge_pulse 'entrega da S3 — programas')" = "1" ] && ok "ícone do prazo HOJE pulsa (é hoje = pulso)" || bad "'hoje' sem pulso"
[ "$(agenda_weekday 'entrega da S3 — programas' 'hoje')" = "1" ] && ok "badge diz 'hoje' (o ongoing não come o dia do prazo de um dia)" || bad "badge não diz 'hoje' no dia"
[ "$(agora_label)" = "1" ] && ok "card de hoje segue vivo (regressão 113 no dia do simulado)" || bad "card de hoje quebrou no mock 29/09"
# Header: o badge do simulado no dia — sai para Estudar (no dashboard o header esconde)
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
[ "$(has 'É hoje: Simulado')" = "1" ] && ok "header mantém 'É hoje: Simulado' no mesmo dia do prazo S3 (as duas vozes coexistem)" || bad "badge do simulado sumiu no header no dia 29/09"
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2

echo "=== [C] MOCK 30/09: prazo passado SAI da lista (nada de fantasma) ==="
mock_date '2026-09-30T10:00:00' >/dev/null; poke
go_dash_remount

[ "$(has 'entrega da S3 — programas')" = "0" ] && ok "S3 entregue sai da agenda (o prazo cumpre-se e vai embora)" || bad "S3 fantasma após a data"
[ "$(has 'trancamento 2026.2')" = "1" ] && ok "agenda segue viva (trancamento 07/10 continua)" || bad "agenda vazia no mock 30/09"

echo "=== [D] MOBILE 390: agenda da semana sem overflow ==="
mock_date '2026-09-27T19:00:00' >/dev/null; poke
go_dash_remount
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
scroll_agenda
agent-browser screenshot scripts/qa114-agenda-s3-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa114-agenda-s3-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

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
  echo "ALL GREEN — t114 a entrega existe no calendário (a semana da Av1 chega à agenda acadêmica)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
