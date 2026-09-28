#!/bin/bash
# Task 112 — A PRÉVIA SABE A SEMANA: a 'Prévia do semestre' era a última
# superfície de PLANEJAMENTO cega à semana da Av1 — pior, era a única que
# dava conselho ATIVO CONTRA o kit: 'Comece agora: Funções — reserve 3
# semanas' no D-4, quando o kit manda 'sem conteúdo novo'. Este E2E
# verifica: [A] data real D-4 = sugestão da Funções ALIADA da semana (gate
# ≤7 dias) + marcos da Av1 nos cards de semana + 'Em 4 dias' honesto;
# [B] D-3 = Sem 6 vira 'agora' com os 4 marcos; [C] D-0 = 'é hoje!' na
# eval e na sugestão; [D] pós-prova (04/10) = 'data passada' honesto +
# conselho original volta + chips ficam como história; [E] mobile;
# [F] higiene + console.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t112.log 2>&1 &)
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
go_progress() { # (lição 102.1) 'Progresso' mora DENTRO do submenu 'Mais' — também serve de remount
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(has 'Mapa de consistência')" = "1" ] && return 0
  done
  return 1
}

echo "=== [A] DATA REAL (dom 27/09, D-4): a sugestão vira aliada da semana ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
clean_all_runs >/dev/null 2>&1; poke
go_home
sleep 1
[ "$(has 'Prévia do semestre')" = "1" ] && ok "prévia presente na Visão Geral" || bad "prévia ausente"
GATE='Av1 em 4 dias — sem conteúdo novo agora; Funções volta depois da prova.'
[ "$(has "$GATE")" = "1" ] && ok "sugestão da Funções ALIADA: 'Av1 em 4 dias — sem conteúdo novo'" || bad "gate da reta final não aplicou (D-4)"
[ "$(has 'reserve 3 semanas')" = "0" ] && ok "conselho antigo 'reserve 3 semanas' CALADO na reta final" || bad "o conselho contrário ao kit ainda aparece"
[ "$(has 'reta final')" = "1" ] && ok "badge 'reta final' na sugestão gated" || bad "badge ausente"
[ "$(has 'preparo 28')" = "1" ] && [ "$(has 'ensaio 29')" = "1" ] && [ "$(has 'véspera 30')" = "1" ] && [ "$(has 'prova 01')" = "1" ] && ok "Sem 6 (28/09–04/10) mostra os 4 marcos da Av1 (o ensaio não é eval — era invisível)" || bad "marcos incompletos na Sem 6"
[ "$(has 'Em 4 dias')" = "1" ] && ok "eval da Av1 honesta: 'Em 4 dias'" || bad "dias da Av1 errados"
[ "$(has 'Base para a Prova 3')" = "1" ] && ok "regressão: Algoritmos segue original (P1 a 33 dias > 7)" || bad "gate vazou para Algoritmos"
[ "$(has 'Necessário para o A2')" = "1" ] && ok "regressão: LM segue original (A2 a 12 dias > 7)" || bad "gate vazou para LM"

echo "=== [B] MOCK D-3 (28/09): a Sem 6 é AGORA — marcos no card corrente ==="
mock_date '2026-09-28T20:00:00' >/dev/null; poke
go_progress >/dev/null 2>&1; go_home; sleep 1
[ "$(has "$GATE")" = "0" ] && ok "gate recalcula: 'Av1 em 4 dias' saiu" || bad "gate congelado"
[ "$(has 'Av1 em 3 dias — sem conteúdo novo')" = "1" ] && ok "D-3: 'Av1 em 3 dias' na sugestão" || bad "gate não recalculou para 3 dias"
[ "$(has 'preparo 28')" = "1" ] && [ "$(has 'prova 01')" = "1" ] && ok "marcos seguem na semana corrente" || bad "marcos sumiram no D-3"

echo "=== [C] MOCK D-0 (01/10): 'é hoje!' nos dois lugares ==="
mock_date '2026-10-01T09:00:00' >/dev/null; poke
go_progress >/dev/null 2>&1; go_home; sleep 1
[ "$(has 'é hoje!')" = "1" ] && ok "eval da Av1: 'é hoje!' (dia 0 não é 'esta semana')" || bad "'é hoje!' ausente na prova"
[ "$(has 'Av1 é hoje — sem conteúdo novo')" = "1" ] && ok "sugestão: 'Av1 é hoje' (sem 'em 0 dias' torto)" || bad "texto do dia 0 torto"

echo "=== [D] PÓS-PROVA (04/10): passado diz o que é, conselho volta, história fica ==="
mock_date '2026-10-04T10:00:00' >/dev/null; poke
go_progress >/dev/null 2>&1; go_home; sleep 1
[ "$(has 'data passada')" = "1" ] && ok "eval passada diz 'data passada' (não mente 'esta semana')" || bad "'data passada' ausente"
[ "$(has 'reserve 3 semanas')" = "1" ] && ok "conselho original VOLTA depois da prova (o gate era temporal)" || bad "gate eterno — conselho nunca mais voltou"
[ "$(has 'ensaio 29')" = "1" ] && ok "chips dos marcos FICAM como história (nada é apagado)" || bad "chips apagados"

echo "=== [E] MOBILE 390: prévia com marcos sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var hs=document.querySelectorAll('h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Prévia do semestre')>=0){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa112-previa-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa112-previa-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

echo "=== [F] HIGIENE + CONSOLE (reload mata o mock) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
H=$(clean_all_runs)
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RUNS"
echo "$H" >/dev/null 2>&1
[ "$RUNS" = "runs=0 poke=0 realGrades=0" ] && ok "storage limpo (runs/poke/realGrades)" || bad "resíduo no storage: $RUNS"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t112 a prévia sabe a semana (o conselho não briga mais com o kit)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
