#!/bin/bash
# Task 113 — O AGORA NO CARD DE HOJE: o card respondia 'o que estudar hoje'
# mas não 'o que estudar AGORA' — o bloco mostrava só o horário de início
# e o aluno fazia a conta de cabeça (já começou? falta muito? passou batido?).
# O relógio do app (clock-widget) tinha um tick vivo que NINGUÉM consumia
# (onTick zero usos; variantes card/inline eram código morto). Este E2E
# verifica: [A] data real (dom, dia off) = AGORA no cabeçalho + descanso
# honesto; [B] mock seg 19:30 = 'agora' no bloco 1 + 'em 30 min' no bloco 2
# + silêncio nos blocos distantes + strip do preparo segue (regressão 109);
# [C] mock 18:35 = só 'em 25 min'; [D] mock 23:05 = dia passou, zero chip
# (sem culpa) + rodapé conta os pendentes; [E] mobile 390 sem overflow;
# [F] higiene zero + console 0 + data real de volta.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t113.log 2>&1 &)
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
go_home() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
# Remount FORÇADO do card: go_home puro é no-op se o dashboard já está ativo
# (o botão da tab ativa não navega) e o todayDayOfWeek só roda no mount —
# o useNow sobrevive (tick por segundo) mas os blocos de hoje não remontam.
# Sai para outra tab e volta: o mock de Date sobrevive à navegação SPA.
go_dash_remount() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
  go_home
}
# O AGORA do cabeçalho do card (title único: 'agora no relógio do plano')
now_clock() {
  agent-browser eval "(function(){var el=document.querySelector('span[title=\"agora no relógio do plano\"]');return el?el.textContent.replace(/\\s+/g,' ').trim():''})()" 2>/dev/null | tr -d '"'
}
# Chip 'agora' (title começa com 'bloco em andamento') → texto ou ''
chip_now() {
  agent-browser eval "(function(){var els=document.querySelectorAll('span[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('bloco em andamento')===0)return els[i].textContent.trim()}return ''})()" 2>/dev/null | tr -d '"'
}
chip_em() { # $1 = minutos → texto do chip 'em N min' (title começa com 'começa em N min') ou ''
  agent-browser eval "(function(){var els=document.querySelectorAll('span[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('começa em $1 min')===0)return els[i].textContent.trim()}return ''})()" 2>/dev/null | tr -d '"'
}
chip_em_count() { # quantos chips 'começa em …' existem
  agent-browser eval "(function(){return document.querySelectorAll('span[title^=\"começa em\"]').length})()" 2>/dev/null | tr -d '"'
}
now_pulse() { # o chip 'agora' pulsa? (gramática: é hoje = sólido + pulso)
  agent-browser eval "(function(){var els=document.querySelectorAll('span[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('bloco em andamento')===0)return (els[i].className.indexOf('animate-pulse')>=0?1:0)}return 0})()" 2>/dev/null | tr -d '"'
}
scroll_card() {
  agent-browser eval "(function(){var hs=document.querySelectorAll('h3');for(var i=0;i<hs.length;i++){if(hs[i].textContent==='Segunda'||hs[i].textContent==='Domingo'){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [A] MOCK 27/09 (D-4, domingo/dia off): o AGORA no cabeçalho — poda da 120, lição 117 ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 1
echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Praticar')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1; sleep 1
go_home; sleep 1

[ "$(has 'Dia de descanso')" = "1" ] && ok "domingo honesto: 'Dia de descanso' (dia off do padrão)" || bad "domingo não mostra descanso (plano mudou?)"
NC=$(now_clock)
echo "$NC" | grep -qE '^([0-9]{2}):([0-9]{2})$' && ok "AGORA no cabeçalho do card: '$NC' (HH:MM tabular)" || bad "AGORA ausente ou mal formatado ($NC)"
[ -z "$(chip_now)" ] && ok "sem bloco → sem chip 'agora' (dia off não inventa agora)" || bad "chip 'agora' num dia sem blocos"
scroll_card
agent-browser screenshot scripts/qa113-agora-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa113-agora-desktop.png)" || bad "screenshot falhou"

echo "=== [B] MOCK SEG 19:30 (28/09, D-3): 'agora' no bloco 1, 'em 30 min' no bloco 2 ==="
mock_date '2026-09-28T19:30:00' >/dev/null; poke
go_dash_remount

[ "$(has 'Segunda')" = "1" ] && ok "mock remonta o card na Segunda (todayDayOfWeek no mesmo frame)" || bad "card não remontou na segunda"
NC2=$(now_clock)
[ "$NC2" = "19:30" ] && ok "AGORA segue o relógio mockado: '$NC2'" || bad "AGORA não reagiu ao mock ($NC2)"
[ "$(has 'Amanhã: Simulado da Av1')" = "1" ] && ok "strip do preparo segue de pé (regressão 109)" || bad "strip do preparo sumiu no D-3"
CN=$(chip_now)
[ "$CN" = "agora" ] && ok "bloco 19:00 em andamento → chip 'agora'" || bad "chip 'agora' ausente/errado ($CN)"
[ "$(now_pulse)" = "1" ] && ok "'agora' pulsa (gramática da casa: é hoje = sólido + pulso)" || bad "'agora' sem pulso"
CE=$(chip_em 30)
[ "$CE" = "em 30 min" ] && ok "bloco 20:00 → 'em 30 min' (tabular, família da espera)" || bad "chip 'em 30 min' ausente/errado ($CE)"
[ -z "$(chip_em 90)" ] && ok "bloco 21:00 (90 min) fica MUDO — o horário basta longe" || bad "bloco distante ganhou chip indevido"
[ "$(chip_em_count)" = "1" ] && ok "só 1 chip de espera (blocos distantes silenciosos)" || bad "contagem de chips errada: $(chip_em_count)"

echo "=== [C] MOCK 18:35: faltam 25 min — só espera, sem 'agora' ==="
mock_date '2026-09-28T18:35:00' >/dev/null; poke
go_dash_remount

CE2=$(chip_em 25)
[ "$CE2" = "em 25 min" ] && ok "bloco 19:00 → 'em 25 min'" || bad "chip 'em 25 min' ausente/errado ($CE2)"
[ -z "$(chip_now)" ] && ok "nenhum 'agora' antes da hora (o chip não mente)" || bad "'agora' fora do bloco"
NC3=$(now_clock)
[ "$NC3" = "18:35" ] && ok "AGORA = '18:35' (tick vivo)" || bad "AGORA errado ($NC3)"

echo "=== [D] MOCK 23:05: o dia passou — silêncio honesto, sem culpa ==="
mock_date '2026-09-28T23:05:00' >/dev/null; poke
go_dash_remount

[ -z "$(chip_now)" ] && ok "sem 'agora' à noite (bloco já foi)" || bad "'agora' num bloco que já passou"
[ "$(chip_em_count)" = "0" ] && ok "zero chips 'em N min' (passado não espera)" || bad "chip de espera sobrou à noite"
[ "$(has '3 bloco(s) pendente(s)')" = "1" ] && ok "rodapé conta os pendentes (3 blocos do padrão; o passou-batido é dito, sem chip acusatório)" || bad "rodapé não conta pendentes"
NC4=$(now_clock)
[ "$NC4" = "23:05" ] && ok "AGORA = '23:05'" || bad "AGORA errado ($NC4)"

echo "=== [E] MOBILE 390 @ 19:30: AGORA + chips sem overflow ==="
mock_date '2026-09-28T19:30:00' >/dev/null; poke
go_dash_remount
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
scroll_card
agent-browser screenshot scripts/qa113-agora-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa113-agora-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

echo "=== [F] HIGIENE + CONSOLE (reload mata o mock) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
H=$(clean_all_runs)
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RUNS"
echo "$H" >/dev/null 2>&1
[ "$RUNS" = "runs=0 poke=0 realGrades=0" ] && ok "storage limpo (runs/poke/realGrades)" || bad "resíduo no storage: $RUNS"
NC=$(now_clock); REAL=$(agent-browser eval "(function(){var d=new Date();var p=function(x){return (x<10?'0':'')+x};return p(d.getHours())+':'+p(d.getMinutes())})()" 2>/dev/null | tr -d '"')
if [ "$NC" != "$REAL" ]; then sleep 2; NC=$(now_clock); REAL=$(agent-browser eval "(function(){var d=new Date();var p=function(x){return (x<10?'0':'')+x};return p(d.getHours())+':'+p(d.getMinutes())})()" 2>/dev/null | tr -d '"'); fi
[ -n "$NC" ] && [ "$NC" = "$REAL" ] && ok "data real de volta (AGORA=$NC = relógio real)" || bad "data real não voltou (AGORA=$NC vs real=$REAL)"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t113 o agora no card de hoje (o relógio chega nos blocos)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
