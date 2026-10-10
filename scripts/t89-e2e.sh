#!/bin/bash
# Task 89 — E2E da AGENDA que fala a semana da Av1 (marcos nos DayCards)
# Fases: A data real (3 tinted) · B mock 29/09 sólido · C run → feito ✓ + tutor
#        D mock 30/09 véspera sólida · E mock 01/10 prova sólida · F mobile 390
#        G higiene (run removido, runs=0, tema dark)
set -u
cd /home/z/my-project

PASS=0; FAIL=0
ok()  { echo "  [OK] $1"; PASS=$((PASS+1)); }
bad() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

# ---------- server vivo (reaper intermitente) ----------
if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t89.log 2>&1 &)
  for i in $(seq 1 45); do curl -s -o /dev/null --max-time 3 http://localhost:3000 && break; sleep 2; done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

# ---------- helper: contém TODOS os substrings no body normalizado ----------
# uso: body_has "texto1|||texto2|||texto3"  -> 0 se todos presentes
# (1 retry: absorve re-render transitório entre mount e asserção)
body_has() {
  local R
  R=$(agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');var subs='$1'.split('|||');for(var i=0;i<subs.length;i++){if(t.indexOf(subs[i])<0)return 'MISS:'+subs[i]}return 'ALL'})()" 2>/dev/null | tr -d '"')
  if ! echo "$R" | grep -q '^ALL$'; then
    sleep 2
    R=$(agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');var subs='$1'.split('|||');for(var i=0;i<subs.length;i++){if(t.indexOf(subs[i])<0)return 'MISS:'+subs[i]}return 'ALL'})()" 2>/dev/null | tr -d '"')
  fi
  echo "$R" | grep -q '^ALL$'
}
body_lacks() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return t.indexOf('$1')>=0?'PRESENT':'ABSENT'})()" 2>/dev/null | tr -d '"' | grep -q '^ABSENT$'
}
has_sel() {
  agent-browser eval "(function(){return document.querySelectorAll('[class*=\"$1\"]').length>0?'YES':'NO'})()" 2>/dev/null | tr -d '"' | grep -q '^YES$'
}
no_sel() {
  agent-browser eval "(function(){return document.querySelectorAll('[class*=\"$1\"]').length===0?'YES':'NO'})()" 2>/dev/null | tr -d '"' | grep -q '^YES$'
}
echo_mock() {
  agent-browser eval "(function(){return 'MOCK='+new Date().toString()})()" 2>/dev/null
}
# remount: Estudar (primária, sempre no DOM) -> Mais -> RECONSULTA pós-mutação
# (lição desta rodada: NodeList capturado antes do click do 'Mais' fica STALE —
# o submenu é montado async pelo React e o botão 'Cronograma' não existia lá)
goto_agenda() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
  # direto (sem modo foco) OU abre o 'Mais' — depois RECONSULTA o DOM de novo
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Cronograma'){els[i].click();return 'direct'}}for(var j=0;j<els.length;j++){if(els[j].textContent.trim()==='Mais'){els[j].click();return 'mais'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Cronograma'){els[i].click();return 'clicked'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 3
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return 'on-agenda='+(t.indexOf('Cronograma inteligente')>=0?'yes':'no')})()" 2>/dev/null
}

agent-browser close >/dev/null 2>&1; sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 7
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
FIBER=$(agent-browser eval "(function(){var m=document.querySelector('main')||document.body;var k=Object.keys(m);for(var i=0;i<k.length;i++){if(k[i].startsWith('__reactFiber'))return 'fiber:true'}return 'fiber:MISSING'})()" 2>/dev/null)
echo "hydration: $FIBER"

echo "=== [A] MOCK 27/09 (D-4): 3 marcos tinted na grade (Lição 129 — data-rot) ==="
# Lição 129 — data-rot: [A] herdava o relógio REAL da entrega (27/09 = D-4);
# dias depois (D-3) o marco do dia EXISTE ('Véspera do simulado', fonte única
# examWeekMilestoneFor) e a grade honestamente diz 'É hoje'. O teste PLANTA o
# dia: mock ANTES do goto_agenda — o mount da Agenda captura o now mockado
# (setNow no mount, sem interval) e as asserções D-4 voltam a valer.
agent-browser eval "(function(){var M='2026-09-27T09:00:00';class F extends Date{constructor(...a){a.length===0?super(new Date(M)):super(...a)}static now(){return new Date(M)}}window.Date=F;return 'mock '+new window.Date().toString()})()" >/dev/null 2>&1
echo_mock
goto_agenda
# Lição 129: a voz do resumo evoluiu com a fonte — o marco 'preparo' (28/09)
# entrou na semana (122/128) e o resumo conta 4 marcos nomeando o mais próximo
# (data-agnóstico por design: reduce no nearest + hoje/amanhã/em N dias).
body_has '4 marcos da Av1|||preparo do simulado amanhã'   && ok "resumo: '4 marcos da Av1 — preparo do simulado amanhã'" || bad "resumo dos marcos"
body_has 'Simulado da Av1|||+ S3 de Algoritmos|||em 2 dias' && ok "Ter 29: simulado tinted + S3 + 'em 2 dias'" || bad "strip do simulado (Ter)"
body_has 'Véspera da prova|||em 3 dias|||montar o kit'    && ok "Qua 30: véspera tinted 'em 3 dias' + dica do kit" || bad "strip da véspera (Qua)"
body_has 'Prova da Av1|||em 4 dias|||levar o kit'         && ok "Qui 01: prova tinted 'em 4 dias' + dica" || bad "strip da prova (Qui)"
has_sel 'ring-rose-500/40'                                && ok "anel rose no dia da prova" || bad "anel rose da prova"
has_sel 'ring-amber-500/40'                               && ok "anel amber nos dias simulado/véspera" || bad "anel amber"
no_sel 'shadow-amber-500/30' && no_sel 'shadow-rose-600/30' && ok "nenhum strip sólido fora do dia (honesto no D-4)" || bad "strip sólido indevido no D-4 mockado"
body_lacks 'É hoje:'                                      && ok "sem 'É hoje' no D-4 (nada é hoje)" || bad "'É hoje' indevido no D-4"
agent-browser screenshot scripts/qa89-agenda-real.png >/dev/null 2>&1

echo "=== [B] MOCK 29/09 (ter): simulado SÓLIDO com pulso ==="
agent-browser eval "(function(){var M='2026-09-29T09:00:00';class F extends Date{constructor(...a){a.length===0?super(new Date(M)):super(...a)}static now(){return new Date(M)}}window.Date=F;return 'mock ok '+new window.Date().toString()})()" >/dev/null 2>&1
echo_mock
goto_agenda
body_has 'É hoje: Simulado da Av1|||prova completa no Praticar' && ok "Ter: 'É hoje: Simulado' sólido + detalhe do dia" || bad "strip sólido do simulado (29/09)"
has_sel 'shadow-amber-500/30'                             && ok "sólido amber com shadow (tratamento D-0 da 76)" || bad "shadow do sólido amber"
body_has 'Véspera da prova|||em 1 dia|||Prova da Av1|||em 2 dias' && ok "Qua véspera 'em 1 dia' + Qui prova 'em 2 dias'" || bad "marcos futuros no mock 29/09"

echo "=== [C] RUN OFICIAL SEMENTE: 'feito ✓' emerald + tutor ==="
agent-browser eval "(function(){var K='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(K)||'{}');p.simuladoRuns=[{id:'qa89-of',date:'2026-09-29T15:30:00',mode:'prova',total:10,solved:7,missed:2,skipped:1,durationSec:1800,filters:{discipline:'TEC.1984'}}];var v=JSON.stringify(p);localStorage.setItem(K,v);window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v}));return 'seeded runs=1'})()" >/dev/null 2>&1
sleep 2
body_has 'Simulado da Av1 feito ✓|||70% · meta 70 ✓|||pedir a correção no tutor' && ok "strip flipa 'feito ✓' 70% · meta 70 ✓ (registro vence relógio)" || bad "estado feito ✓ do simulado"
no_sel 'shadow-amber-500/30' && has_sel 'shadow-emerald-500/30' && ok "sólido emerald SEM pulso (a urgência acabou)" || bad "gramática do feito ✓ (emerald sólido)"
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var l=els[i].getAttribute('aria-label')||'';if(l.indexOf('Abrir o tutor com o debrief')===0){els[i].click();return 'clicou'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
body_has 'aproveitamento 70%'                             && ok "clique abre tutor com o debrief (70%, 7/10)" || bad "debrief do tutor"
agent-browser screenshot scripts/qa89-agenda-hoje-feito.png >/dev/null 2>&1
agent-browser press Escape >/dev/null 2>&1; sleep 2

echo "=== [D] MOCK 30/09 (qua): véspera SÓLIDA, prova 'em 1 dia' ==="
agent-browser eval "(function(){var K='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(K)||'{}');p.simuladoRuns=(p.simuladoRuns||[]).filter(function(r){return r.id!=='qa89-of'});var v=JSON.stringify(p);localStorage.setItem(K,v);window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v}));return 'run removido'})()" >/dev/null 2>&1
agent-browser eval "(function(){var M='2026-09-30T09:00:00';class F extends Date{constructor(...a){a.length===0?super(new Date(M)):super(...a)}static now(){return new Date(M)}}window.Date=F;return 'mock ok '+new window.Date().toString()})()" >/dev/null 2>&1
goto_agenda
echo_mock
body_has 'É hoje: Véspera da prova|||montar o kit, imprimir a folha de revisão e refazer só as travadas' && ok "Qua: 'É hoje: Véspera' sólida + detalhe do kit/folha/travadas" || bad "strip da véspera (30/09)"
body_has 'Prova da Av1|||em 1 dia|||levar o kit'          && ok "Qui: prova 'em 1 dia' + dica" || bad "prova em 1 dia"
body_lacks 'Simulado da Av1 — Matemática'                 && ok "Ter 06/10 sem strip (janela rolou)" || bad "strip do simulado fora da janela"

echo "=== [E] MOCK 01/10 (qui): PROVA SÓLIDA 'Boa prova!' ==="
agent-browser eval "(function(){var M='2026-10-01T09:00:00';class F extends Date{constructor(...a){a.length===0?super(new Date(M)):super(...a)}static now(){return new Date(M)}}window.Date=F;return 'mock ok '+new window.Date().toString()})()" >/dev/null 2>&1
goto_agenda
echo_mock
body_has 'É hoje: Prova da Av1|||Boa prova!|||levar o kit e chegar cedo — boa prova!' && ok "Qui: prova sólida rose + 'Boa prova!'" || bad "strip da prova (01/10)"
has_sel 'shadow-rose-600/30'                              && ok "sólido rose com shadow (família prova)" || bad "shadow do sólido rose"
body_has '1 marco da Av1|||prova hoje'                    && ok "resumo: '1 marco da Av1 — prova hoje'" || bad "resumo no dia da prova"

echo "=== [F] MOBILE 390 — overflow ==="
goto_agenda >/dev/null 2>&1
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 3
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'sw='+window.innerWidth+' iw='+d.clientWidth+' ovf='+(d.scrollWidth>d.clientWidth)})()" 2>/dev/null)
echo "  $OVF"
echo "$OVF" | grep -qF 'ovf=false' && ok "mobile 390: zero overflow" || bad "mobile 390 OVERFLOW"
agent-browser screenshot scripts/qa89-agenda-mobile390.png >/dev/null 2>&1

echo "=== [G] HIGIENE ==="
agent-browser set viewport 1440 900 >/dev/null 2>&1
agent-browser eval "(function(){var K='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(K)||'{}');p.simuladoRuns=(p.simuladoRuns||[]).filter(function(r){return r.id!=='qa89-of'});var v=JSON.stringify(p);localStorage.setItem(K,v);window.dispatchEvent(new StorageEvent('storage',{key:K,newValue:v}));return 'runs='+p.simuladoRuns.length})()" 2>/dev/null
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 6
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');return 'runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null)
echo "  storage pós-reload: $RUNS"
echo "$RUNS" | grep -qF 'runs=0' && ok "runs=0 após reload (zero resíduo)" || bad "resíduo do run semente"
agent-browser console 2>/dev/null | tail -20 | grep -iE 'error' | grep -viE 'fast.refresh|hmr|Download the React DevTools|dev' && bad "console com erros" || ok "console: 0 erros de app"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ $FAIL -eq 0 ] && echo "T89-E2E: ALL GREEN" || echo "T89-E2E: FALHAS ACIMA"
