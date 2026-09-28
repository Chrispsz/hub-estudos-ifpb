#!/bin/bash
# Task 118 — O PROGRESSO SE REGISTRA SOZINHO: o dono foi direto (28/09):
# "não tô entendendo em que momento marco esses tópicos ou como o site
# acompanha meu progresso… eu geralmente só abro os materiais e tiro dúvidas
# com a tutor e resolvo… muita coisa fica como atrasado na minha página pois
# nenhum progresso eu registro". Diagnóstico: o Hub media progresso SÓ pelos
# checkboxes manuais (topicProgress) — abrir material e resolver exercício
# não alimentava NADA: 0/29, barra 0% e o selo 'atrasada' em toda avaliação
# (fileira do painel E prévia do semestre). O FIX: fonte única nova
# (discipline-activity) deriva a atividade REAL (materiais abertos + questões
# tentadas, material-first); as duas superfícies leem essa fonte com selo
# honesto em dia/em estudo/sem registro (a palavra 'atrasada' saiu do painel);
# KPI 'Disciplinas em dia' virou 'Disciplinas ativas'; o checklist de tópicos
# mostra a evidência por unidade + o critério didático do 'quando marcar'; e
# abrir material/resolver questão agora toca o lastStudiedAt (o fluxo real
# registra sozinho — o 'estudo atrasado' para de cobrar quem está estudando).
# Este E2E verifica: [A] perfil limpo = ZERO 'atrasada' + barra some (sem
# régua) + 'sem registro' + KPI 0 + dica didática no checklist; [B] atividade
# semeada = Av1 'em estudo' amber + barra 50% + KPI 1 + LM continua 'sem
# registro' + prévia do semestre acompanha; [C] checklist: badge 'em estudo'
# na unidade 1 + evidência 1/2 materiais · 1/7 questões · última hoje; [D] o
# FLUXO REAL registra: abrir material na Biblioteca escreve
# disciplineProgress.lastStudiedAt; [E] mobile 390; [F] higiene TOTAL +
# console 0.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t118.log 2>&1 &)
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
count_has() {
  agent-browser eval "(function(){var t=document.body.textContent;return t.split('$1').length-1})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked'})()" >/dev/null 2>&1
  sleep 1
}
# HIGIENE TOTAL: apaga o perfil inteiro (a 118 semeia materialProgress e
# exerciseProgress — o clean dos runs não basta).
wipe_all() {
  agent-browser eval "(function(){localStorage.removeItem('$STORE');window.dispatchEvent(new StorageEvent('storage',{key:'$STORE',newValue:null}));return 'wiped'})()" >/dev/null 2>&1
  agent-browser open http://localhost:3000 >/dev/null 2>&1
  sleep 9
}
# Selo do card de avaliação: o badge cujo card cita a avaliação (o badge da
# DATA tem ml-auto e é ignorado; o do STATUS tem texto da família).
row_badge() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0){var bs=cards[i].querySelectorAll('[data-slot=\"badge\"]');for(var j=0;j<bs.length;j++){var c=bs[j].className||'';if(c.indexOf('ml-auto')>=0)continue;var tx=(bs[j].textContent||'').trim();if(tx==='em dia'||tx==='em estudo'||tx==='sem registro')return tx+'|'+c}}}return 'NOBADGE'})()" 2>/dev/null | tr -d '"'
}
# Barra da row (role=progressbar): aria-valuenow ou ausência.
row_bar() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';if(t.indexOf('$1')>=0){var b=cards[i].querySelector('[role=\"progressbar\"]');if(!b)return 'NOBAR';return 'BAR'+b.getAttribute('aria-valuenow')}}return 'NOCARD'})()" 2>/dev/null | tr -d '"'
}
kpi_val() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';var m=t.match(/(\\d+)\\s*$1/);if(m)return m[1]}return 'X'})()" 2>/dev/null | tr -d '"'
}
previa_badge() {
  agent-browser eval "(function(){var rows=document.querySelectorAll('div.flex.items-center');for(var i=0;i<rows.length;i++){var t=rows[i].textContent||'';if(t.indexOf('$1')>=0){var bs=rows[i].querySelectorAll('[data-slot=\"badge\"]');return bs.length?bs[bs.length-1].textContent.trim():'NOBADGE'}}return 'NOROW'})()" 2>/dev/null | tr -d '"'
}
go_estudar() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
go_dash() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
select_matematica() {
  agent-browser eval "(function(){var tr=document.querySelector('#study-discipline');if(!tr)return 'NOTRIGGER';tr.click();return 'ok'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var opts=document.querySelectorAll('[role=\"option\"]');for(var i=0;i<opts.length;i++){if((opts[i].textContent||'').indexOf('Matemática Aplicada')>=0){opts[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}

echo "=== [A] PERFIL LIMPO: a palavra 'atrasada' saiu do painel ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
wipe_all
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

[ "$(has 'atrasada')" = "0" ] && ok "ZERO 'atrasada' no painel inteiro (a acusação sem registro morreu)" || bad "ainda existe 'atrasada' no painel"
[ "$(has 'sem registro')" = "1" ] && ok "selo honesto 'sem registro' presente (o registro é que falta, não o aluno)" || bad "selo 'sem registro' ausente"
BR=$(row_bar 'Av1')
[ "$BR" = "NOBAR" ] && ok "Av1 SEM barra (nenhum material registrado = sem régua; zero medido ≠ zero esforço)" || bad "Av1 mostra barra sem régua: $BR"
BA=$(row_badge 'Av1')
echo "$BA" | grep -q '^sem registro' && ok "selo da Av1 = 'sem registro'" || bad "selo da Av1 errado: $BA"
[ "$(kpi_val 'Disciplinas ativas')" = "0" ] && ok "KPI 'Disciplinas ativas' = 0 no perfil limpo" || bad "KPI Disciplinas ativas errado: $(kpi_val 'Disciplinas ativas')"

echo "=== [A2] CHECKLIST LIMPO: a dica didática responde 'em que momento marco' ==="
go_estudar; select_matematica
[ "$(has 'Marque o tópico quando conseguir resolver sem olhar o material')" = "1" ] && ok "dica didática visível: marque quando resolver sem olhar; o resto o Hub registra sozinho" || bad "dica didática ausente"
[ "$(count_has 'em estudo')" = "0" ] && ok "nenhum badge 'em estudo' sem atividade (nada inventado)" || bad "badge 'em estudo' sem evidência"
[ "$(has '0/2 materiais')" = "1" ] && ok "ponteiro didático '0/2 materiais' nas unidades dadas (o que abrir)" || bad "ponteiro de materiais ausente"

echo "=== [B] ATIVIDADE SEMEADA: o painel reage ao fluxo real ==="
go_dash
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');var now=new Date().toISOString();p.materialProgress=p.materialProgress||{};p.materialProgress['mat-00-matrizes']={lastAccessedAt:now};p.exerciseProgress=p.exerciseProgress||{};p.exerciseProgress['mat-001']={tried:true,solved:false,neededHelp:false,lastPracticedAt:now};var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'seeded'})()" >/dev/null 2>&1
sleep 2

BB=$(row_badge 'Av1')
echo "$BB" | grep -q '^em estudo' && ok "Av1 flipou para 'em estudo' (material aberto + questão tentada contam)" || bad "Av1 não reagiu à atividade: $BB"
echo "$BB" | grep -q 'amber-300/70' && ok "selo 'em estudo' na família da espera (amber, sem pulso — não é prazo)" || bad "selo fora da família amber: $BB"
[ "$(row_bar 'Av1')" = "BAR50" ] && ok "barra da Av1 = 50% (1 de 2 unidades dadas tocada — conteúdo não dado não pune)" || bad "barra da Av1 errada: $(row_bar 'Av1')"
[ "$(kpi_val 'Disciplinas ativas')" = "1" ] && ok "KPI 'Disciplinas ativas' = 1 (o estudo de hoje apareceu)" || bad "KPI não contou a atividade"
BL=$(row_badge 'A2')
echo "$BL" | grep -q '^sem registro' && ok "LM (A2) continua 'sem registro' (atividade de uma disciplina não vaza na outra)" || bad "selo da LM errado: $BL"
[ "$(has 'atrasada')" = "0" ] && ok "mesmo com 0 atividade em LM/Alg, NADA diz 'atrasada'" || bad "'atrasada' voltou"
PB=$(previa_badge 'Mat')
echo "$PB" | grep -q '^em estudo' && ok "prévia do semestre lê a MESMA fonte (Mat 'em estudo')" || bad "prévia não acompanhou: $PB"
agent-browser screenshot scripts/qa118-atividade-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa118-atividade-desktop.png)" || bad "screenshot desktop falhou"

echo "=== [C] CHECKLIST VIVO: a evidência da unidade 1 ==="
go_estudar; select_matematica
[ "$(count_has 'em estudo')" = "1" ] && ok "badge 'em estudo' só na unidade com atividade (1 de 4)" || bad "contagem de badges 'em estudo' errada: $(count_has 'em estudo')"
[ "$(has '1/2 materiais')" = "1" ] && ok "evidência '1/2 materiais' na unidade 1" || bad "evidência de materiais errada"
[ "$(has '1/7 questões')" = "1" ] && ok "evidência '1/7 questões' na unidade 1" || bad "evidência de questões errada"
[ "$(has 'unidade com atividade sua · última hoje')" = "1" ] && ok "linha de resumo: '1 unidade com atividade sua · última hoje'" || bad "linha de resumo da atividade ausente"
[ "$(has 'Marque o tópico quando conseguir')" = "0" ] && ok "dica didática dá lugar à linha de atividade (o estado fala)" || bad "dica e atividade se sobrepondo"

echo "=== [D] O FLUXO REAL REGISTRA: abrir material toca lastStudiedAt ==="
PRE=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return (p.disciplineProgress&&p.disciplineProgress['TEC.1984']&&p.disciplineProgress['TEC.1984'].lastStudiedAt)?p.disciplineProgress['TEC.1984'].lastStudiedAt:'UNSET'})()" 2>/dev/null | tr -d '"')
[ "$PRE" = "UNSET" ] && ok "pré-condição: lastStudiedAt de Matemática ainda unset (o seed só tocou materialProgress)" || bad "pré-condição falhou: $PRE"
R1=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Biblioteca'){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
sleep 3
R2=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,[role=\"button\"],[data-slot=\"accordion-trigger\"]');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Matemática Aplicada')===0){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
sleep 3
R3=$(agent-browser eval "(function(){var btns=document.querySelectorAll('button');for(var i=0;i<btns.length;i++){if((btns[i].textContent||'').indexOf('Resumo IA')>=0){btns[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
sleep 3
[ "$R1" = "ok" ] && [ "$R2" = "ok" ] && [ "$R3" = "ok" ] && ok "navegação Biblioteca → Matemática → Resumo IA clicada ($R1/$R2/$R3)" || bad "navegação do [D] falhou: $R1/$R2/$R3"
POST=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');var v=p.disciplineProgress&&p.disciplineProgress['TEC.1984']&&p.disciplineProgress['TEC.1984'].lastStudiedAt;return v?v:'UNSET'})()" 2>/dev/null | tr -d '"')
[ "$POST" != "UNSET" ] && ok "abrir o material escreveu disciplineProgress.lastStudiedAt (o fluxo real registra sozinho — o 'estudo atrasado' para de cobrar)" || bad "markAccessed NÃO tocou lastStudiedAt"
TODAY=$(agent-browser eval "new Date().toISOString().slice(0,10)" 2>/dev/null | tr -d '"')
[ "${POST:0:10}" = "$TODAY" ] && ok "o registro é de hoje ($TODAY)" || bad "registro com data estranha: $POST"

echo "=== [E] MOBILE 390: painel honesto sem overflow ==="
go_dash
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var hs=document.querySelectorAll('h3');for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Próximas avaliações')>=0){hs[i].scrollIntoView({block:'start'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa118-atividade-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa118-atividade-mobile390.png)" || bad "screenshot mobile falhou"

echo "=== [F] HIGIENE TOTAL + CONSOLE ==="
wipe_all
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
RES=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' cards='+((p.flashcards||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length+' mat='+Object.keys(p.materialProgress||{}).length+' ex='+Object.keys(p.exerciseProgress||{}).length+' top='+Object.keys(p.topicProgress||{}).length+' disc='+Object.keys(p.disciplineProgress||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RES"
[ "$RES" = "runs=0 cards=0 poke=0 realGrades=0 mat=0 ex=0 top=0 disc=0" ] && ok "storage 100% limpo (o seed da 118 também foi embora)" || bad "resíduo no storage: $RES"
[ "$(has 'Faltam')" = "1" ] && ok "data real de volta (hero do relógio vivo)" || bad "hero sem 'Faltam'"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t118 o progresso se registra sozinho (o fluxo real virou fonte)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
