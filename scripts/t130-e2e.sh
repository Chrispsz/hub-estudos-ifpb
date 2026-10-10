#!/bin/bash
# Task 130 — O PROJETOR QUE DORMIA + O QUANTO FALTA: (1) o semester-projection
# tinha DOIS relógios capturados no mount (linhagem 115/116/129): o gate da
# reta final (nextEvalDaysByCode, deps []) congelava 'faltam N dias' e a
# janela de 6 semanas (currentWeek) congelava os marcos da Av1 — aba aberta
# na virada do dia/da semana mentia até um reload; a cura é o tick de 60s
# (useNow) alimentando os dois memos, a MESMA cura do mapa da 129.
# (2) ESTILO: as conquistas de ROTINA bloqueadas mostram O QUANTO FALTA
# (x/y tabular-nums + trilho fino amber) — 'bloqueada' sozinha não diz se
# falta muito ou pouco; os recibos da semana NÃO têm barra (sem
# meio-caminho — a honestidade da casa).
# Fases: [A] data real = gate ativo (D-3) + sugestão aliada da semana;
# [B] micro-progresso nas locked de rotina (seed 1 sessão → 1/10 + trilho;
# recibo da semana SEM barra; Primeiro passo desbloqueia de verdade);
# [C] mock 20/09 (11 dias) = gate CALA ('reserve 3 semanas' volta — a
# sugestão honesta fora da janela); [D] LIVE TICK — re-mock 28/09 SEM
# remontar, o tick de 60s acorda o memo sozinho (re-render ≠ re-computo,
# lição 129.2 — a cura sem reload); [E] mobile 390; [F] higiene.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t130.log 2>&1 &)
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
go_progress() { # (lição 102.1) 'Progresso' mora DENTRO do submenu 'Mais'
  local try=""
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    try=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
    sleep 2
    [ "$(has 'Mapa de consistência')" = "1" ] && return 0
  done
  return 1
}
go_projecao() { # (a projeção mora num TAB da calculadora — TabsContent desmonta
  # o tab inativo: sem o clique, SemesterProjection nem existe no DOM.
  # ⚠️ Lição 129.2: Radix troca tab no MOUSEDOWN — .click() sozinho não basta)
  agent-browser eval "(function(){var els=document.querySelectorAll('button[role=tab]');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Projeção do semestre')>=0){els[i].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var els=document.querySelectorAll('button[role=tab]');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Projeção do semestre')>=0){return els[i].getAttribute('data-state')==='active'?1:0}}return 0})()" 2>/dev/null | tr -d '"' | grep -q 1
}
ach() { # $1=label · $2=description → unlocked/locked/absent (herdada da 111;
        # locked com micro-progresso continua 'locked' — '(bloqueada)' não
        # contém 'desbloqueada')
  agent-browser eval "(function(){var els=document.querySelectorAll('div[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('$1')>=0||t.indexOf('$2')>=0){return t.indexOf('desbloqueada')>=0?'unlocked':'locked'}}return 'absent'})()" 2>/dev/null | tr -d '"'
}
tile_bar() { # $1=description (o title do tile é description+progresso, não o
  # label) → 1 se o tile tem trilho amber (estilo 130)
  agent-browser eval "(function(){var els=document.querySelectorAll('div[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('$1')>=0){return els[i].innerHTML.indexOf('bg-amber-500/40')>=0?1:0}}return 0})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] DATA REAL (seg 28/09, D-3): o gate da reta final está ACORDADO ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
clean_all_runs >/dev/null 2>&1; poke
go_progress || bad "remount do Progresso falhou"
go_projecao || bad "tab Projeção do semestre não abriu"
sleep 1
[ "$(has 'Comece agora (tópicos complexos)')" = "1" ] && ok "sugestões 'comece agora' na tela" || bad "seção de sugestões ausente"
[ "$(has 'reta final')" = "1" ] && ok "gate ATIVO no D-3: selo 'reta final' presente" || bad "gate calou no D-3 (devia gritar)"
[ "$(has 'Funções volta depois da prova')" = "1" ] && ok "voz aliada da semana: 'Funções volta depois da prova'" || bad "voz da reta final ausente"
agent-browser screenshot scripts/qa130-projetor-reta-final.png >/dev/null 2>&1 && ok "screenshot desktop (qa130-projetor-reta-final.png)" || bad "screenshot falhou"

echo "=== [B] O QUANTO FALTA (estilo): micro-progresso nas locked de rotina ==="
PRE=$(agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');return JSON.stringify(p.pomodoroSessions||[])})()" 2>/dev/null | tr -d '"')
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.pomodoroSessions=[{date:'2026-09-28',startedAt:'2026-09-28T09:00:00',completedAt:'2026-09-28T09:25:00',disciplineId:'TEC.1984',focusMinutes:25,mode:'estudo'}];var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'seeded'})()" >/dev/null 2>&1
poke
go_home; go_progress || bad "remount pós-seed falhou"
sleep 1
[ "$(ach 'Primeiro passo' 'Conclua 1 sessão de foco')" = "unlocked" ] && ok "1 sessão semeada = 'Primeiro passo' desbloqueada (o contador é real)" || bad "Primeiro passo não desbloqueou"
[ "$(ach 'Ritmo constante' 'Conclua 10 sessões de foco')" = "locked" ] && ok "'Ritmo constante' continua locked" || bad "Ritmo constante devia estar locked"
B1=$(tile_bar 'Conclua 10 sessões')
T=$(has '1/10')
[ "$B1" = "1" ] && [ "$T" = "1" ] && ok "locked de rotina mostra O QUANTO FALTA: trilho amber + '1/10' tabular-nums" || bad "micro-progresso ausente (bar=$B1 text=$T)"
[ "$(ach 'Ensaio real' 'Rode o simulado oficial')" = "locked" ] && ok "recibo da semana locked (honesto)" || bad "Ensaio real devia estar locked"
B2=$(tile_bar 'Rode o simulado oficial')
[ "$B2" = "0" ] && ok "recibo da semana SEM trilho — não existe meio-caminho para recibo" || bad "recibo inventou progresso"
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.pomodoroSessions=$PRE;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'restored'})()" >/dev/null 2>&1
poke

echo "=== [C] MOCK 20/09 (11 dias): fora da janela o gate CALA com honestidade ==="
mock_date '2026-09-20T12:00:00' >/dev/null; poke
go_home; go_progress || bad "remount do mock 20/09 falhou"
go_projecao || bad "tab Projeção do mock 20/09 não abriu"
sleep 1
[ "$(has 'reta final')" = "0" ] && ok "11 dias antes: gate cala (não é reta final)" || bad "gate gritou a 11 dias"
[ "$(has 'reserve 3 semanas')" = "1" ] && ok "voz honesta fora da janela: 'reserve 3 semanas para dominar'" || bad "voz do planejamento ausente"
[ "$(has 'Funções volta depois da prova')" = "0" ] && ok "a voz da véspera não vaza para fora da semana" || bad "voz da prova vazou fora da janela"

echo "=== [D] LIVE TICK (a cura sem remontar): o relógio de 60s acorda o memo ==="
mock_date '2026-09-28T20:00:00' >/dev/null; poke
echo "  (aguardando o tick de 60s — aba aberta na virada do dia...)"
sleep 65
[ "$(has 'reta final')" = "1" ] && ok "SEM reload: o tick re-derivou o gate e o 'reta final' voltou sozinho" || bad "o memo continuou dormindo (re-render ≠ re-computo — deps de nowMin?)"
[ "$(has 'Funções volta depois da prova')" = "1" ] && ok "a voz aliada da semana voltou com o gate" || bad "voz da semana não acompanhou o gate"

echo "=== [E] MOBILE 390: projetor e conquistas sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser screenshot scripts/qa130-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa130-mobile390.png)" || bad "screenshot falhou"

echo "=== [F] HIGIENE + CONSOLE (reload mata o mock) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 3
clean_all_runs >/dev/null 2>&1
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)+' sessions='+((p.pomodoroSessions||[]).length)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo (runs/poke/realGrades)";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t130 o projetor acordou + o quanto falta"; else echo ""; echo "FAILURES — t130"; exit 1; fi
