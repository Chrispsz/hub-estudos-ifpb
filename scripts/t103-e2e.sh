#!/bin/bash
# Task 103 — O RELATÓRIO SEMANAL SABE A SEMANA: a analítica (aba Progresso)
# era a última superfície falando a língua da produtividade nos dias críticos
# ('agende um bloco' no DIA DA PROVA, 'adicione mais uma sessão' na véspera).
# Padrões provados (t88–t102): textContent SEM aspas, poke __poke = re-render,
# mock de relógio class extends Date + eco na página, seed com data absoluta,
# asserção por fragmento do ELEMENTO NOVO (lição 95.1) ESCOPADA no card
# (data-slot=card via h2 'Relatório semanal' — lição 101.1: has() global vê a
# página ATRÁS; aqui o card do relatório é o escopo certo).
# Lições herdadas aplicadas: (95.3) trocar o cenário ANTES de afirmar —
# clean_runs antes do mock D-1; (99.2) eval volta como string JSON empacotada
# — desembrulhar com json.load; (102.3) aspas simples dentro de eval.
set -u
cd /home/z/my-project

FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t103.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

rep_json() { # fragmentos ESCOPADOS no card do relatório (h2 'Relatório semanal')
  agent-browser eval "(function(){var els=document.querySelectorAll('h2');var base=null;for(var i=0;i<els.length;i++){if((els[i].textContent||'').indexOf('Relatório semanal')>=0){base=els[i];break}}if(!base)return '{\"card-nao\":1}';var card=base.closest('[data-slot=\"card\"]');if(!card)return '{\"slot-nao\":1}';var t=(card.textContent||'').toLowerCase().replace(/\s+/g,' ');var out={};var list='$1'.split('|');for(var j=0;j<list.length;j++){var f=list[j].toLowerCase();out[f]=t.indexOf(f)>=0?1:0}return JSON.stringify(out)})()" 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin) or "{}")'
}
low() { python3 -c "import sys;print(sys.stdin.read().strip().lower())" <<< "$1"; }
rep_has()   { rep_json "$1" | grep -q "\"$(low "$1")\":1"; }
rep_hasnt() { rep_json "$1" | grep -q "\"$(low "$1")\":0"; }

mock_date() { # padrão provado (class extends Date) + eco DENTRO da página
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}

poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}

seed_run() { # $1=id · $2=matrizes solved · $3=logica solved · $4=logica missed
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];for(var i=0;i<$2;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'solved'});for(var j=0;j<$3;j++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(var m=0;m<$4;m++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'$1',date:'2026-09-29T15:30:00',mode:'prova',total:qs.length,solved:$2+$3,missed:$4,skipped:0,durationSec:2400,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
}

clean_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=(p.simuladoRuns||[]).filter(function(r){return r.id.indexOf('qa103')!==0&&r.id.indexOf('qa95')!==0&&r.id.indexOf('qa99')!==0});if(p.simuladoRuns.length===0)delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null | tr -d '"'
  sleep 1
}

go_progress() { # (lição 102.1) 'Progresso' mora DENTRO do submenu 'Mais' do
  # sidebar — abrir o submenu primeiro, senão a navegação falha em cascata
  local try=""
  try=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
  sleep 1
  for i in 1 2 3; do
    try=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
    sleep 2
    rep_json 'relatório semanal' | grep -q '"relatório semanal":1' && return 0
  done
  return 1
}

shot_card() { # scrollIntoView block:'start' (lição da 95: 'center' não chega)
  agent-browser eval "(function(){var els=document.querySelectorAll('h2');for(var i=0;i<els.length;i++){if((els[i].textContent||'').indexOf('Relatório semanal')>=0){els[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
  agent-browser screenshot "$1" >/dev/null 2>&1
}

echo "=== [PREP] storage limpo + aba Progresso (data real dom 27/09, D-4) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
agent-browser eval "(function(){localStorage.clear();return 'cleared'})()" >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
if go_progress; then ok "aba Progresso aberta (h2 'Relatório semanal' visível)"; else bad "navegação para Progresso falhou"; fi

echo "=== [A] DATA REAL (D-4): relatório normal, faixa fora da janela (regra da 88) ==="
rep_json 'é hoje: simulado da av1|véspera da prova|é hoje: prova da av1|complete um pomodoro' | grep -q '"card-nao":1' && bad "card do relatório não encontrado" || true
rep_hasnt 'é hoje: simulado da av1' && ok "sem faixa do simulado (D-4 fora da janela de 3 dias)" || bad "faixa apareceu fora da janela"
rep_hasnt 'véspera da prova' && ok "sem faixa da véspera" || bad "véspera vazou"
rep_has 'complete um pomodoro' && ok "mensagem normal presente (sem dados = convite honesto)" || bad "mensagem normal sumiu"

echo "=== [B] MOCK 29/09 (D-2) SEM run: faixa âmbar + mensagem de ritmo SUPRIMIDA ==="
echo "  mock: $(mock_date 2026-09-29)"
poke
rep_has 'é hoje: simulado da av1' && ok "faixa do ensaio no relatório" || bad "faixa do ensaio ausente"
rep_has 'd-2' && ok "chip D-2 tabular" || bad "chip D-N ausente"
rep_has 'o número que importa hoje é o % do simulado' && ok "linha honesta do ensaio" || bad "linha do ensaio errada"
rep_hasnt '% · meta' && ok "sem chip de veredito (nada inventado sem registro)" || bad "chip de % sem run"
rep_hasnt 'agende um bloco' && ok "'agende um bloco' SUPRIMIDO" || bad "pressão de cronograma no dia do ensaio"
rep_hasnt 'continue assim' && ok "'continue assim' suprimido no dia-macro" || bad "mensagem de ritmo vazou"
rep_hasnt 'complete um pomodoro' && ok "convite de pomodoro suprimido (a faixa é a mensagem)" || bad "convite de pomodoro no dia do ensaio"

echo "=== [C] RUN 70% + poke: flip emerald com o veredito da 95 ==="
echo "  seed: $(seed_run qa103-a 5 2 3)"
poke
rep_has 'feito ✓' && ok "flip 'feito ✓' ao vivo (storage event)" || bad "flip não aconteceu"
rep_has '70% · meta 70' && ok "chip do veredito '70% · meta 70'" || bad "chip de veredito errado"
rep_has 'o kit da véspera já lê o resultado' && ok "linha aponta o kit" || bad "linha pós-run errada"
rep_hasnt 'o dia é do ensaio real' && ok "linha pendente saiu (registro vence relógio, 85/86)" || bad "linha pendente sobreviveu"
shot_card scripts/qa103-report-desktop.png
[ -s scripts/qa103-report-desktop.png ] && ok "screenshot desktop (qa103-report-desktop.png)" || bad "screenshot desktop falhou"

echo "=== [D] clean + MOCK 30/09 (D-1): véspera — nenhum recorde importa ==="
echo "  clean: $(clean_runs)"
echo "  mock: $(mock_date 2026-09-30)"
poke
rep_has 'véspera da prova' && ok "faixa da véspera" || bad "faixa da véspera ausente"
rep_has 'd-1' && ok "chip D-1" || bad "chip D-1 ausente"
rep_has 'nenhum recorde de foco importa hoje' && ok "linha honesta da véspera" || bad "linha da véspera errada"
rep_hasnt 'feito ✓' && ok "run limpo antes do cenário (lição 95.3) — sem veredito" || bad "run vazou para a véspera"
rep_hasnt 'd-2' && ok "marco anterior não vaza" || bad "D-2 vazou na véspera"

echo "=== [E] MOCK 01/10 (D-0): prova — a pressão morre (o bug central da rodada) ==="
echo "  mock: $(mock_date 2026-10-01)"
poke
rep_has 'é hoje: prova da av1' && ok "faixa rose da prova" || bad "faixa da prova ausente"
rep_has 'd-0' && ok "chip D-0" || bad "chip D-0 ausente"
rep_has 'os gráficos esperam' && ok "linha do exame" || bad "linha da prova errada"
rep_hasnt 'agende um bloco' && ok "'agende um bloco' NUNCA no dia da prova (bug da rodada morto)" || bad "pressão de cronograma no D-0"
rep_hasnt 'complete um pomodoro' && ok "sem convite de pomodoro no D-0 sem dados" || bad "convite de pomodoro no dia da prova"

echo "=== [F] MOCK 03/10 (pós-prova): silêncio honesto — relatório volta a ser relatório ==="
echo "  mock: $(mock_date 2026-10-03)"
poke
rep_hasnt 'é hoje: prova da av1' && ok "faixa da prova sumiu" || bad "faixa sobreviveu pós-prova"
rep_hasnt 'véspera da prova' && ok "sem véspera pós-prova" || bad "véspera vazou pós-prova"
rep_has 'complete um pomodoro' && ok "modo normal restaurado (nota mora na calculadora, não aqui)" || bad "modo normal não voltou"

echo "=== [G] MOBILE 390: faixa quebra limpa, sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1
echo "  mock: $(mock_date 2026-09-29)"
poke
sleep 1
OF=$(agent-browser eval "(function(){return 'iw='+window.innerWidth+'sw='+document.documentElement.scrollWidth})()" 2>/dev/null | tr -d '"')
echo "  $OF"
case "$OF" in *iw=390*sw=390*|*iw=390*sw=39[01]*) ok "mobile 390 sem overflow";; *) bad "overflow no mobile: $OF";; esac
shot_card scripts/qa103-report-mobile390.png
[ -s scripts/qa103-report-mobile390.png ] && ok "screenshot mobile (qa103-report-mobile390.png)" || bad "screenshot mobile falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1

echo "=== [H] HIGIENE + CONSOLE (reload mata o mock, storage limpo) ==="
echo "  clean: $(clean_runs)"
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)+' sessions='+((p.pomodoroSessions||[]).length)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo (runs/poke/realGrades)";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t103 e2e"; else echo ""; echo "FAILURES — t103 e2e"; exit 1; fi
