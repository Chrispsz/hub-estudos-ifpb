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
# registro' + PPC acompanha; [C] checklist: badge 'em estudo'
# na unidade 1 + evidência 1/2 materiais · 1/7 questões · última hoje; [D] o
# FLUXO REAL registra: abrir material na Biblioteca escreve
# disciplineProgress.lastStudiedAt; [E] mobile 390; [F] higiene TOTAL +
# console 0.
#
# LIÇÃO 127 (a re-escrita das âncoras): as 6 falhas crônicas da 118 NÃO eram
# produto nem 'partição morta' da 125 — eram âncoras first-match cegas pela
# saturação da semana (121–126 pôs hero/kit/strip/recibo ANTES da fila de
# avaliações no DOM; o primeiro card contendo 'Av1' deixou de ser a row).
# Evidência ao vivo: a row REAL tem pb=50 com atividade semeada — o produto
# nunca deixou de funcionar. E o seed por eval CRUZA nesta sessão (o flip
# 'em estudo' é a prova) — a lei da partição da 125 não reproduz aqui.
# As âncoras novas: (1) a MENOR div com badge dentro da seção do h3
# 'Próximas avaliações (datas oficiais)'; (2) PPC ancorado no h3 'Progresso
# por disciplina' (a faixa Sem 6–11 herdou o H2 'Prévia do semestre'; a row
# mínima é 'Matemática0/29em estudo'); (3) o nav 'Biblioteca' agora carrega o
# contador ('Biblioteca52') — match por prefixo; (4) retry 3x nos helpers —
# o relógio do header re-renderiza a cada segundo e troca nós sob o eval.
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
# Selo da ROW de avaliação: a âncora correta é a MENOR div com badge dentro
# da seção do h3 'Próximas avaliações (datas oficiais)' — NÃO o primeiro card
# com o termo (a saturação 121–126 cegou o first-match; lição 127 no topo).
# Retry 3x: o relógio do header re-renderiza a cada segundo e troca nós sob o
# eval (a sondagem solta NOROW fantasma no meio da reconciliação).
# Retorna 'FAM|classe§BARxx|NOBAR' (família + barra da row).
assess_find() {
  local R=""
  for try in 1 2 3; do
    R=$(agent-browser eval "(function(){try{var hs=document.querySelectorAll('h3');var sec=null;for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Próximas avaliações')>=0){sec=hs[i].nextElementSibling;break}}if(!sec)return '';var divs=sec.querySelectorAll('div');var best=null;for(var j=0;j<divs.length;j++){var d=divs[j];var t=(d.textContent||'');if(t.indexOf('$1')>=0&&d.querySelectorAll('[data-slot=\"badge\"]').length>0){if(!best||t.length<best.length)best=d}}if(!best)return 'NOROW';var fam='NOFAM';var bs=best.querySelectorAll('[data-slot=\"badge\"]');for(var j=0;j<bs.length;j++){var tx=(bs[j].textContent||'').trim();if(tx==='em dia'||tx==='em estudo'||tx==='sem registro'){fam=tx+'|'+(bs[j].className||'');break}}var b=best.querySelector('[role=\"progressbar\"]');return fam+'§'+(b?('BAR'+b.getAttribute('aria-valuenow')):'NOBAR')}catch(e){return ''}})()" 2>/dev/null | tr -d '"')
    case "$R" in
      *§*) echo "$R"; return ;;
    esac
    sleep 1
  done
  echo "$R"
}
row_badge() { assess_find "$1" | sed 's/§.*//'; }
# Barra da row (role=progressbar): aria-valuenow ou ausência.
row_bar() { assess_find "$1" | sed 's/^.*§//'; }
kpi_val() {
  agent-browser eval "(function(){var cards=document.querySelectorAll('[data-slot=\"card\"]');for(var i=0;i<cards.length;i++){var t=cards[i].textContent||'';var m=t.match(/(\\d+)\\s*$1/);if(m)return m[1]}return 'X'})()" 2>/dev/null | tr -d '"'
}
# O 'prévia do semestre' da 118 virou o card 'Progresso por disciplina (PPC)'
# (o H2 'Prévia do semestre' agora é da faixa Sem 6–11; lição 127). Row mínima
# do PPC: 'Matemática0/29em estudo' (len 23) — match por PREFIXO da disciplina.
ppc_badge() {
  local R=""
  for try in 1 2 3; do
    R=$(agent-browser eval "(function(){try{var hs=document.querySelectorAll('h3');var card=null;for(var i=0;i<hs.length;i++){if(hs[i].textContent.indexOf('Progresso por disciplina')>=0){var c=hs[i].parentElement;while(c&&c.getAttribute('data-slot')!=='card')c=c.parentElement;card=c;break}}if(!card)return '';var divs=card.querySelectorAll('div');var best=null;for(var j=0;j<divs.length;j++){var d=divs[j];var t=(d.textContent||'').trim();if(t.indexOf('$1')===0&&t.length<70&&(t.indexOf('em dia')>=0||t.indexOf('em estudo')>=0||t.indexOf('sem registro')>=0)){if(!best||t.length<(best.textContent||'').length)best=d}}if(!best)return 'NOROW';var bs=best.querySelectorAll('[data-slot=\"badge\"]');for(var j=0;j<bs.length;j++){var tx=(bs[j].textContent||'').trim();if(tx==='em dia'||tx==='em estudo'||tx==='sem registro')return tx}return 'NOFAM'}catch(e){return ''}})()" 2>/dev/null | tr -d '"')
    case "$R" in
      'em dia'|'em estudo'|'sem registro') echo "$R"; return ;;
    esac
    sleep 1
  done
  echo "$R"
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
[ "$BR" = "BAR0" ] && ok "Av1 em 0% honesto (a régua existe — conteúdo dado em aula; zero medido ≠ acusação, lição 127: o contrato evoluiu na 120)" || bad "Av1 deveria mostrar a régua em 0% honesto: $BR"
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
BL=$(row_badge 'Projeto 1ª etapa')
echo "$BL" | grep -q '^sem registro' && ok "LM · Projeto 1ª etapa continua 'sem registro' (atividade de uma disciplina não vaza na outra)" || bad "selo da LM errado: $BL"
[ "$(has 'atrasada')" = "0" ] && ok "mesmo com 0 atividade em LM/Alg, NADA diz 'atrasada'" || bad "'atrasada' voltou"
PB=$(ppc_badge 'Matemática')
echo "$PB" | grep -q '^em estudo' && ok "PPC lê a MESMA fonte (Matemática 'em estudo')" || bad "PPC não acompanhou: $PB"
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
R1=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Biblioteca')===0){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
sleep 3
R2=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,[role=\"button\"]');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Matemática')===0&&t.indexOf('67h')>=0){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
sleep 3
R3=$(agent-browser eval "(function(){var btns=document.querySelectorAll('button');for(var i=0;i<btns.length;i++){var t=(btns[i].textContent||'').trim();if(t.indexOf('Matrizes — teoria da Aula 00')===0){btns[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
sleep 3
[ "$R1" = "ok" ] && [ "$R2" = "ok" ] && [ "$R3" = "ok" ] && ok "navegação Biblioteca → card Matemática → material 'Matrizes — teoria da Aula 00' ($R1/$R2/$R3) — o caminho REAL da Biblioteca 102 (o acordeão 'Matemática Aplicada' + 'Resumo IA' da 118 não existem mais)" || bad "navegação do [D] falhou: $R1/$R2/$R3"
POST=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');var v=p.disciplineProgress&&p.disciplineProgress['TEC.1984']&&p.disciplineProgress['TEC.1984'].lastStudiedAt;return v?v:'UNSET'})()" 2>/dev/null | tr -d '"')
[ "$POST" != "UNSET" ] && ok "abrir o material escreveu disciplineProgress.lastStudiedAt (o fluxo real registra sozinho — o 'estudo atrasado' para de cobrar)" || bad "markAccessed NÃO tocou lastStudiedAt"
TODAY=$(agent-browser eval "new Date().toISOString().slice(0,10)" 2>/dev/null | tr -d '"')
[ "${POST:0:10}" = "$TODAY" ] && ok "o registro é de hoje ($TODAY)" || bad "registro com data estranha: $POST"
MATKEY=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return Object.keys(p.materialProgress||{}).indexOf('mat-00-matrizes')>=0?'OK':'NO'})()" 2>/dev/null | tr -d '"')
[ "$MATKEY" = "OK" ] && ok "o gesto real escreveu materialProgress['mat-00-matrizes'] — a MESMA chave que o seed do [B] (seed e gesto convergem num só registro)" || bad "gesto real não escreveu materialProgress: $MATKEY"

echo "=== [D2] A COERÊNCIA CRUZA A SUPERFÍCIE: Recentes mostra o material aberto ==="
go_dash
sleep 3
# Lição 105 de novo: o card Recentes mostra o título CURTO do material
# ('Matrizes — Aula 00 (Slides)'), NÃO o label do botão da Biblioteca.
REC=$(has 'Matrizes — Aula 00 (Slides)')
[ "$REC" = "1" ] && ok "Recentes lista o material aberto pelo gesto real (o registro é visível na home — a mesma fonte em toda superfície)" || bad "Recentes não mostra o material aberto: $REC"
[ "$(has 'Abrir um material registra o estudo da disciplina')" = "1" ] && ok "o recibo EXPLICA: linha didática diz o que o acesso faz (o 'em que momento marco' da 118 fecha na superfície onde ele aparece)" || bad "linha didática do recibo ausente"

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
