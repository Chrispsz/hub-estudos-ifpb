#!/bin/bash
# Task 105 — O ENSAIO GERAL: o percurso COMPLETO da terça (29/09) percorrido
# pela UI REAL — nada semeado no [C]: o run nasce do clique (Consegui/Não
# consegui/Encerrar), passa por recordRun → addSimuladoRun → storage e tem que
# ACORDAR as nove superfícies no mesmo re-render. As rodadas 95–104 testaram
# cada camada com run SEMEADO; o pipeline de CRIAÇÃO do run (mode/date/filters
# → findMathSimuladoRunOficial) nunca foi verificado ponta a ponta — se o run
# real não for reconhecido como oficial, TODAS as camadas falham juntas na
# noite da terça. [E] semeia um cenário determinístico que a UI não permite
# controlar (tópico do sorteio): bloco INTEIRO pulado → pulouTudo manda.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t105.log 2>&1 &)
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
has_dlg() { # escopo do overlay do Simulado Pro / paleta (lição 100.2/101.1)
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d)return 0;var t=d.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
click_btn() { # $1=trecho · $2=índice (0 = primeiro)
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){if(n===$2){els[i].click();return 'ok'}n++}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
badge_tone() { # $1=trecho do texto do badge · $2=classe esperada
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0&&els[i].textContent.length<140)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
open_palette() {
  agent-browser eval "(function(){var b=document.querySelector('[aria-label*=\"Busca\"]');if(!b)return 'NAO';b.click();return 'ok'})()" 2>/dev/null | tr -d '"'
  sleep 2
}
# Run SEMEADO (só no [E], cenário determinístico): $1=id · $2=matrizes puladas · $3=lógica solved · $4=lógica missed
seed_pulou() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];for(var i=0;i<$2;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'skipped'});for(var j=0;j<$3;j++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(var m=0;m<$4;m++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'$1',date:'2026-09-29T15:30:00',mode:'prova',total:qs.length,solved:$3,missed:$4,skipped:$2,durationSec:3600,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
}
clean_all_runs() { # o storage entra limpo; sai limpo — apaga TUDO de simuladoRuns
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs=0'})()" 2>/dev/null | tr -d '"'
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
    [ "$(has 'Relatório semanal')" = "1" ] && return 0
  done
  return 1
}
go_tutor() { # (t102-regressao [B]) o tutor abre da aba 'Estudar' → botão 'Tirar dúvida com IA'
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Tirar dúvida com IA')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(has 'Tirar dúvida com IA')" = "1" ] && return 0
  done
  return 1
}

echo "=== [A] MOCK FORA DA JANELA (20/09, ancorado — 117): sanity ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
# (lição 117) a data REAL apodrece: o kit da véspera É para existir no D-3
# (kit 109) — o 'ausente' só é verdade fora da semana. Mock fixo fora da
# janela devolve o determinismo (mock+poke, NUNCA reload).
mock_date '2026-09-20T20:00:00' >/dev/null; poke; sleep 1
KIT=$(has 'Kit da véspera')
[ "$KIT" = "0" ] && ok "fora da janela (20/09): kit ausente" || bad "fora da janela: kit presente"

echo "=== [B] MOCK 29/09 (D-2) SEM run: a manhã da espera ==="
echo "  $(mock_date '2026-09-29T09:00:00')"; poke
KIT=$(has 'Kit da véspera'); ESP=$(has 'comece por aqui')
HERO=$(agent-browser eval "(function(){var b=document.querySelector('[aria-label^=\"Hoje é o dia do Simulado\"]');return b?1:0})()" 2>/dev/null | tr -d '"')
[ "$KIT" = "1" ] && ok "kit visível no D-2" || bad "kit ausente no D-2"
[ "$ESP" = "1" ] && ok "badge de espera: 'depois do simulado de hoje — comece por aqui'" || bad "badge de espera ausente"
[ "$HERO" = "1" ] && ok "hero: botão do dia oficial presente (aria-label 'Hoje é o dia')" || bad "botão do hero ausente"

echo "=== [C] O RUN REAL (a peça central): hero → setup → 10 questões → entrega ==="
HB=$(agent-browser eval "(function(){var b=document.querySelector('[aria-label^=\"Hoje é o dia do Simulado\"]');if(!b)return 'NAO';b.click();return 'ok'})()" 2>/dev/null | tr -d '"')
sleep 3
[ "$HB" = "ok" ] && ok "hero abriu o Simulado Pro (preset math_exam)" || bad "hero não abriu o simulado (hb=$HB)"
BAN=$(has_dlg 'É hoje o simulado oficial da Av1')
C1=$(has_dlg 'Sem consulta'); C2=$(has_dlg 'Meta ≥ 70%'); C3=$(has_dlg 'Erro vira revisão de amanhã')
ESC=$(has_dlg 'escopo: Álgebra Matricial + Lógica Matemática')
[ "$BAN" = "1" ] && ok "banner do setup: 'É hoje o simulado oficial da Av1'" || bad "banner do setup ausente (ban=$BAN)"
[ "$C1" = "1" ] && [ "$C2" = "1" ] && [ "$C3" = "1" ] && ok "chips das condições de prova (sem consulta · meta · erro vira revisão)" || bad "chips do banner incompletos (c1=$C1 c2=$C2 c3=$C3)"
[ "$ESC" = "1" ] && ok "preset ativo: 'escopo: Álgebra Matricial + Lógica Matemática'" || bad "escopo do preset não reflete a Av1"
ST=$(click_btn 'Iniciar simulado' 0); sleep 2
[ "$ST" = "ok" ] && ok "prova iniciada (10 questões · 60 min)" || bad "setup não iniciou (st=$ST)"
# 7 Consegui + 2 Não consegui; a 10ª fica SEM MARCA (Encerrar com ela em branco
# = pulada real, o caminho que o tempo esgotado também produz)
for i in 1 2 3 4 5 6 7; do click_btn 'Consegui' 0 >/dev/null 2>&1; sleep 1; done
for i in 1 2; do click_btn 'Não consegui' 0 >/dev/null 2>&1; sleep 1; done
EN=$(click_btn 'Encerrar' 0); sleep 2
[ "$EN" = "ok" ] && ok "Encerrar abriu a revisão de entrega" || bad "Encerrar falhou (en=$EN)"
CONF=$(has_dlg 'sem marca')
[ "$CONF" = "1" ] && ok "revisão de entrega marca a 10ª como 'sem marca'" || bad "revisão de entrega não mostra a sem marca"
FI=$(click_btn 'Encerrar e ver resultado' 0); sleep 3
[ "$FI" = "ok" ] && ok "entrega confirmada — run registrado pela UI" || bad "confirmação falhou (fi=$FI)"
META70=$(has_dlg 'Meta da Av1 batida: 70%')
[ "$META70" = "1" ] && ok "resultado: 'Meta da Av1 batida: 70%' (7/10 — taxa real do clique)" || bad "bloco de meta do resultado ausente ou % errado (meta70=$META70)"
CLOSE=1
agent-browser press Escape >/dev/null 2>&1; sleep 2
DLG=$(agent-browser eval "(function(){return document.querySelector('[role=dialog]')?1:0})()" 2>/dev/null | tr -d '"')
if [ "$DLG" = "1" ]; then agent-browser eval "(function(){var els=document.querySelectorAll('[role=dialog] button');for(var i=0;i<els.length;i++){var l=els[i].getAttribute('aria-label')||'';if(/close|fechar/i.test(l)){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1; sleep 2; fi

echo "=== [D] A MATRIZ DO FLIP: o run REAL acorda as superfícies ==="
go_home; poke; sleep 1
KITB=$(has 'simulado feito — 70% ≥ meta, véspera leve')
KTONE=$(badge_tone '≥ meta' 'border-emerald-500/40')
ROW=$(has 'a revisão de amanhã')
PLAC=$(has 'No simulado: Matrizes')
[ "$KITB" = "1" ] && ok "kit: badge flipou para 'simulado feito — 70% ≥ meta, véspera leve'" || bad "kit não flipou com o run real (kitb=$KITB)"
[ "$KTONE" = "1" ] && ok "kit badge em emerald (calma — meta batida)" || bad "kit badge sem emerald"
[ "$ROW" = "1" ] && ok "linha do foco presente ('… a revisão de amanhã')" || bad "linha do foco ausente"
[ "$PLAC" = "1" ] && ok "placar em chips: 'No simulado: Matrizes …'" || bad "placar do simulado ausente"
go_progress; sleep 1
RP=$(has 'feito ✓'); RC=$(has '70% · meta 70'); RL=$(has 'o kit da véspera já lê o resultado')
[ "$RP" = "1" ] && ok "relatório: strip flipou 'feito ✓'" || bad "relatório não flipou (rp=$RP)"
[ "$RC" = "1" ] && ok "relatório: chip do veredito '70 · meta 70'" || bad "chip do veredito ausente"
[ "$RL" = "1" ] && ok "relatório: linha aponta o kit" || bad "linha do relatório ausente"
HIST=$(has 'Oficial da Av1'); OF=$(has 'oficial da Av1 (29/09)')
[ "$HIST" = "1" ] && ok "histórico: o run UI-nativo é reconhecido 'Oficial da Av1'" || bad "histórico não reconheceu o run real (hist=$HIST)"
[ "$OF" = "1" ] && ok "histórico: 'oficial da Av1 (29/09)' no resumo" || bad "resumo do oficial ausente"
go_home; sleep 1
P=$(open_palette)
COR=$(has_dlg 'Pedir correção do simulado')
INI=$(has_dlg 'Iniciar o Simulado')
[ "$P" = "ok" ] && [ "$COR" = "1" ] && ok "paleta: 'Pedir correção do simulado (IA)' entrou" || bad "paleta sem a correção (p=$P cor=$COR)"
[ "$INI" = "0" ] && ok "paleta: 'Iniciar o Simulado' SAIU (nunca oferece o ensaio que foi)" || bad "paleta ainda oferece o ensaio feito"
agent-browser press Escape >/dev/null 2>&1; sleep 1
if go_tutor; then
  BDG=$(has 'simulado 70%')
  [ "$BDG" = "1" ] && ok "tutor: badge ganhou o veredito ('· simulado 70%')" || bad "badge do tutor sem veredito (bdg=$BDG)"
else
  bad "navegação para o Tutor falhou"
fi
go_home; sleep 1
REC=$(has 'simulado 70% · meta 70 ✓')
[ "$REC" = "1" ] && ok "fila de recuperação: chip 'simulado 70% · meta 70 ✓'" || bad "chip do simulado na fila ausente (rec=$REC)"

echo "=== [E] PULOU TUDO (determinístico): o bloco inteiro sem tentativa manda ==="
clean_all_runs >/dev/null 2>&1
SEED=$(seed_pulou 'qa105-pulou' 5 3 2)
poke
[ "$SEED" = "ok n=10" ] && ok "cenário semeado: Matrizes 5/5 PULADAS + Lógica 3/5" || bad "seed falhou (seed=$SEED)"
ROWP=$(has 'Matrizes: pulou tudo — a revisão de amanhã')
BP=$(badge_tone 'puladas' 'border-rose-400/60')
CHIP=$(has 'Matrizes 0/5 (pulou tudo)')
TAIL=$(has 'pular um bloco inteiro também é diagnóstico')
FRM=$(has 'Matrizes primeiro (0/5 no simulado), Lógica depois')
CTA=$(has 'Treinar Matrizes')
[ "$ROWP" = "1" ] && ok "linha: 'Matrizes: pulou tudo — a revisão de amanhã' (pulouTudo vence worst)" || bad "pulouTudo não assumiu a linha (rowp=$ROWP)"
[ "$BP" = "1" ] && ok "badge do bloco: '5 puladas' em rose (nem tentou)" || bad "badge de puladas ausente/sem rose (bp=$BP)"
[ "$CHIP" = "1" ] && ok "chip tracejado: 'Matrizes 0/5 (pulou tudo)'" || bad "chip do pulou-tudo ausente"
[ "$TAIL" = "1" ] && ok "cauda honesta: 'pular um bloco inteiro também é diagnóstico'" || bad "cauda do pulou-tudo ausente"
[ "$FRM" = "1" ] && ok "fórmulas reordenadas pelo pulouTudo: 'Matrizes primeiro (0/5)'" || bad "fórmulas ignoraram o pulou-tudo (frm=$FRM)"
[ "$CTA" = "1" ] && ok "CTA: 'Treinar Matrizes' (drill no bloco nunca visto)" || bad "CTA não aponta o bloco pulado"
AB=$(has '30%: abaixo da meta')
[ "$AB" = "1" ] && ok "badge do kit segue o % geral real: '30%: abaixo da meta'" || bad "badge do % geral ausente"

echo "=== [F] VÉSPERA E PROVA com o run pulou-tudo ==="
echo "  $(mock_date '2026-09-30T15:00:00')"; poke
HOJEP=$(has 'Matrizes: pulou tudo — começa por ela')
[ "$HOJEP" = "1" ] && ok "D-1: 'Matrizes: pulou tudo — começa por ela'" || bad "linha D-1 do pulou-tudo ausente"
VESP=$(has 'bloco fraco primeiro')
[ "$VESP" = "1" ] && ok "badge D-1: 'véspera — 30% no simulado: bloco fraco primeiro'" || bad "badge da véspera ausente"
echo "  $(mock_date '2026-10-01T08:00:00')"; poke
GONE=$(has 'pulou tudo')
DAY0=$(has 'hoje é o dia — só reler e respirar')
[ "$GONE" = "0" ] && ok "D-0: a linha do foco some (prova não treina)" || bad "linha do foco presente no D-0"
[ "$DAY0" = "1" ] && ok "D-0: kit no reler-e-respirar" || bad "badge do D-0 ausente"

echo "=== [G] MOBILE 390: kit com chips sem overflow ==="
echo "  $(mock_date '2026-09-30T15:00:00')"; poke
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var el=[...document.querySelectorAll('h3')].find(function(h){return h.textContent.indexOf('Kit da véspera')>=0});if(el){el.scrollIntoView({block:'start'});return 'ok'}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa105-kit-pulou-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa105-kit-pulou-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

echo "=== [H] HIGIENE + CONSOLE (reload mata o mock) ==="
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
  echo "ALL GREEN — t105 ensaio geral (o dia da terça ponta a ponta)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
