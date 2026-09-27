#!/bin/bash
# Task 99 — O DIA COMUM TAMBÉM SABE A SEMANA: TodayStudyCard ('O que estudar
# hoje') cede a vez ao plano nos 3 dias da reta final (simulado/véspera/prova).
# Padrões provados (t88–t98): textContent SEM aspas, poke __poke = re-render,
# mock de relógio class extends Date + eco na página, seed com data absoluta,
# aspas SIMPLES dentro de eval (lição 89.3), asserção por fragmento do
# ELEMENTO NOVO (lição 95.1) ESCOPADA no card (data-slot=card).
# Lições DESTA rodada: (99.1) o rótulo 'O que estudar hoje' mora num <p> —
# o h3 é o DIA da semana; (99.2) o eval volta como STRING JSON empacotada
# ("{\"k\":0}") — desembrulhar com json.load antes do grep; (99.3) o mount
# congela `today` — o mock de relógio pós-mount não muda o dia do card, então
# o QA SOWEIA studyPreferences.days[0].enabled=true (domingo real) para render
# no branch NÃO-dayoff, onde mora o rodapé que a prova troca.
set -u
cd /home/z/my-project

FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t99.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

has() { # texto na página inteira (lowercase, sem aspas)
  agent-browser eval "(function(){var t=document.body.textContent.toLowerCase().replace(/\s+/g,' ');return (t.indexOf($(printf '%s' "$1" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().lower()))'))>=0?1:0)})()" 2>/dev/null | tr -d '"'
}

card_json() { # fragmentos ESCOPADOS no card 'O que estudar hoje' → JSON {frag:0/1}
  # (99.1) o rótulo mora num <p>; (99.2) desembrulhar a string JSON do eval
  agent-browser eval "(function(){var els=document.querySelectorAll('p');var base=null;for(var i=0;i<els.length;i++){if((els[i].textContent||'').indexOf('O que estudar hoje')>=0){base=els[i];break}}if(!base)return '{\"card-nao\":1}';var card=base.closest('[data-slot=\"card\"]');if(!card)return '{\"slot-nao\":1}';var t=(card.textContent||'').toLowerCase().replace(/\s+/g,' ');var out={};var list='$1'.split('|');for(var j=0;j<list.length;j++){var f=list[j].toLowerCase();out[f]=t.indexOf(f)>=0?1:0}return JSON.stringify(out)})()" 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin) or "{}")'
}
low() { python3 -c "import sys;print(sys.stdin.read().strip().lower())" <<< "$1"; }
card_has()  { card_json "$1" | grep -q "\"$(low "$2")\":1"; }
card_hasnt(){ card_json "$1" | grep -q "\"$(low "$2")\":0"; }

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
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=(p.simuladoRuns||[]).filter(function(r){return r.id.indexOf('qa99')!==0&&r.id.indexOf('qa95')!==0});if(p.simuladoRuns.length===0)delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null | tr -d '"'
  sleep 1
}

setup_prefs() { # (99.3) domingo real habilitado → card monta no branch NÃO-dayoff
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');if(p.__qa99_sp===undefined)p.__qa99_sp=JSON.stringify(p.studyPreferences);p.studyPreferences.days['0'].enabled=true;p.studyPreferences.days['0'].durationMin=120;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'dom0=on'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
restore_prefs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');if(p.__qa99_sp!==undefined){p.studyPreferences=JSON.parse(p.__qa99_sp);delete p.__qa99_sp}var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'dom0='+(p.studyPreferences.days['0'].enabled?'on':'off')})()" 2>/dev/null | tr -d '"'
  sleep 1
}

CARD='o que estudar hoje'

echo "=== [PREP] domingo real habilitado (branch NÃO-dayoff com rodapé) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
echo "  setup: $(setup_prefs)"
poke
card_has "bloco(s) pendente(s)|dia de descanso|O que estudar hoje" "bloco(s) pendente(s)" && ok "branch não-dayoff ativo ('N pendente(s) • M min' visível)" || bad "domingo semeado ainda em dayoff"

echo "=== [A] DATA REAL (dom 27/09, D-4) — dia comum, strip SILENCIOSO ==="
card_hasnt "É hoje: Simulado da Av1|o dia é do ensaio real|Véspera da prova —|É hoje: Prova da Av1|cede a vez" "É hoje: Simulado da Av1" && ok "strip simulado ausente (D-4 fora da janela)" || bad "strip simulado INVENTADO no D-4"
card_hasnt "É hoje: Simulado da Av1|o dia é do ensaio real|Véspera da prova —|É hoje: Prova da Av1|cede a vez" "o dia é do ensaio real" && ok "linha do ensaio ausente" || bad "linha do ensaio inventada"
card_hasnt "É hoje: Simulado da Av1|o dia é do ensaio real|Véspera da prova —|É hoje: Prova da Av1|cede a vez" "É hoje: Prova da Av1" && ok "strip prova ausente" || bad "strip prova inventado"
card_has "É hoje: Simulado da Av1|o dia é do ensaio real|Véspera da prova —|É hoje: Prova da Av1|cede a vez|bloco(s) pendente(s)" "bloco(s) pendente(s)" && ok "rodapé normal do dia comum intacto" || bad "rodapé normal sumiu no dia comum"

echo "=== [B] MOCK 29/09 (TERÇA, SIMULADO) — strip amber SEM run ==="
ECHO=$(mock_date '2026-09-29T12:00:00')
echo "  $ECHO"
case "$ECHO" in mock=2026-9-29) ok "relógio mockado na página";; *) bad "mock falhou: $ECHO";; esac
poke
card_has "É hoje: Simulado da Av1|o dia é do ensaio real|feito ✓|70% · meta" "É hoje: Simulado da Av1" && ok "strip: 'É hoje: Simulado da Av1'" || bad "título do strip ausente"
card_has "É hoje: Simulado da Av1|o dia é do ensaio real|feito ✓|70% · meta" "o dia é do ensaio real" && ok "linha: 'o dia é do ensaio real (+ S3)'" || bad "linha do ensaio ausente"
card_hasnt "É hoje: Simulado da Av1|o dia é do ensaio real|feito ✓|70% · meta" "feito ✓" && ok "SEM run → strip NÃO inventa registro" || bad "feito inventado sem run!"
card_has "É hoje: Simulado da Av1|o dia é do ensaio real|feito ✓|70% · meta|bloco(s) pendente(s)" "bloco(s) pendente(s)" && ok "rodapé normal (simulado dia ainda estuda)" || bad "rodapé sumiu no dia do simulado"

echo "=== [C] RUN OFICIAL SEEDADO + poke — strip flipa emerald 'feito ✓' ==="
S=$(seed_run 'qa99-a' 5 2 3); echo "  $S"
poke
card_has "É hoje: Simulado da Av1|o dia é do ensaio real|feito ✓|70% · meta" "feito ✓" && ok "strip flipa 'feito ✓' (registro vence relógio, ao vivo)" || bad "flip 'feito' não aconteceu"
card_has "É hoje: Simulado da Av1|o dia é do ensaio real|feito ✓|70% · meta 70" "70% · meta 70" && ok "chip com o veredito da 95: '70% · meta 70'" || bad "chip do % ausente"
card_hasnt "É hoje: Simulado da Av1|o dia é do ensaio real|feito ✓|70% · meta 70" "o dia é do ensaio real" && ok "linha do ensaio trocada pela do registro" || bad "linha antiga ficou"
agent-browser screenshot /home/z/my-project/scripts/qa99-card-feito.png >/dev/null 2>&1

echo "=== [D] MOCK 30/09 (QUARTA, VÉSPERA) ==="
mock_date '2026-09-30T12:00:00' >/dev/null
poke
card_has "Véspera da prova|revisão leve|folha, fórmulas|É hoje: Simulado" "Véspera da prova" && ok "strip: 'Véspera da prova'" || bad "título véspera ausente"
card_has "Véspera da prova|revisão leve|folha, fórmulas|É hoje: Simulado" "revisão leve" && ok "linha: 'revisão leve: o plano manda — folha, fórmulas e só as travadas'" || bad "linha da véspera ausente"
card_hasnt "Véspera da prova|revisão leve|folha, fórmulas|É hoje: Simulado" "É hoje: Simulado" && ok "marco anterior não vaza" || bad "strip do simulado vazou na véspera"

echo "=== [E] MOCK 01/10 (QUINTA, PROVA) — cronograma cede a vez ==="
mock_date '2026-10-01T12:00:00' >/dev/null
poke
card_has "É hoje: Prova da Av1|boa prova!|cede a vez|bloco(s) pendente(s)" "É hoje: Prova da Av1" && ok "strip: 'É hoje: Prova da Av1'" || bad "título prova ausente"
card_has "É hoje: Prova da Av1|boa prova!|cede a vez|bloco(s) pendente(s)" "boa prova!" && ok "linha: 'boa prova! O dia é do exame'" || bad "linha da prova ausente"
card_has "É hoje: Prova da Av1|boa prova!|cede a vez|bloco(s) pendente(s)" "cede a vez" && ok "rodapé trocado: 'o cronograma cede a vez hoje'" || bad "rodapé da prova ausente"
card_hasnt "É hoje: Prova da Av1|boa prova!|cede a vez|bloco(s) pendente(s)" "bloco(s) pendente(s)" && ok "pressão de pendência some no D-0" || bad "pressão de pendência NO DIA DA PROVA!"
agent-browser screenshot /home/z/my-project/scripts/qa99-card-prova.png >/dev/null 2>&1

echo "=== [F] MOBILE 390 — prova day sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 2
OF=$(agent-browser eval "(function(){return 'iw='+window.innerWidth+' sw='+document.documentElement.scrollWidth})()" 2>/dev/null | tr -d '"')
echo "  $OF"
case "$OF" in *iw=390*sw=390*|*iw=390*sw=39[01]*) ok "mobile 390 sem overflow";; *) bad "overflow no mobile: $OF";; esac
agent-browser set viewport 1440 900 >/dev/null 2>&1

echo "=== [G] HIGIENE + CONSOLE (data real e domingo off voltam) ==="
echo "  restore: $(restore_prefs)"
clean_runs
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
H=$(has 'faltam 4 dias')
[ "$H" = "1" ] && ok "data real de volta (reload matou o mock)" || bad "data real não voltou"
card_json "É hoje: Simulado|cede a vez|bloco(s) pendente(s)" | grep -q '"é hoje: simulado":0' && ok "strip sumiu no reload (dia comum de novo)" || bad "strip sobreviveu ao reload"
R=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'dom0='+(p.studyPreferences.days['0'].enabled?'on':'off')+' backup='+(p.__qa99_sp===undefined?'removido':'FICOU')})()" 2>/dev/null | tr -d '"')
echo "  $R"
case "$R" in *dom0=off*backup=removido*) ok "studyPreferences restaurado";; *) bad "prefs não restauradas: $R";; esac
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t99 e2e"; else echo ""; echo "FAILURES — t99 e2e"; exit 1; fi
