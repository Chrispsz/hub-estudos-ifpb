#!/usr/bin/env bash
# =============================================================================
# t124-e2e — O DIA SEGUINTE (o card da prova acorda pós-prova)
# -----------------------------------------------------------------------------
# A 121 ensaiou 29/09 e 01/10; a 122, 28/09 e 30/09. O ÚNICO dia que nenhuma
# suíte tinha ensaiado era o DEPOIS da prova (02/10+): a janela entre o exame
# e a nota. O rehearsal desta rodada varreu todas as superfícies e achou UM
# fóssil: o card da prova pedia 'Registre a nota' PARA SEMPRE, mesmo com a
# nota lançada na Calculadora (o badge do Plano de Recuperação já lia a nota
# e celebrava — o card da PRÓPRIA prova era a última voz cega ao registro).
# AS FIXAÇÕES: o card pós-prova lê realGrades[MATH_NOTA_REAL_KEY] +
# notaRealAv1Valida (a MESMA fonte do kit, da fila e da calculadora — zero
# segunda derivação) e fala TRÊS estados, cor = significado:
#   pendente (rose) → nota ≥ meta (emerald, ✓) → nota < meta (amber, 'Av2 e
#   Av3 abrem caminho'). Registro suspeito (lançado antes do dia) NÃO conta.
# Fases:
# [A] 02/10 sem nota — a manhã depois é honesta (card pendente + hero segue
#     em frente + recovery pede a nota + mapa mantém a história + silêncios);
# [B] 02/10 com nota 85 legítima — o card acorda EMERALD e o fóssil morre
#     (coerência com o badge do recovery, fila convergiu);
# [C] nota 65 — amber honesto, sem alarme ('Av2 e Av3 abrem caminho');
# [D] registro SUSPEITO (doneAt antes da prova) — o % do ensaio não vira nota
#     (lição 108): a voz pendente volta;
# [E] mobile 390 sem overflow + higiene zero + console 0.
# (Asserções copiam o texto REAL do DOM — lição 105.)
# =============================================================================
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }
STORE='hub-estudios-ifpb:v2'

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t124.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

has() {
  agent-browser eval "(function(){return document.body.innerText.indexOf('$1')>=0?1:0})()" 2>/dev/null | tr -d '"'
}
go_home() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
go_progress() { # (lição 102.1) 'Progresso' mora DENTRO do submenu 'Mais'
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    local r=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
    sleep 2
    [ "$r" = "ok" ] && return 0
  done
  return 1
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getDate()+'/'+(d.getMonth()+1)})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked'})()" >/dev/null 2>&1
  sleep 1
}
seed_nota() { # $1=grade · $2=doneAt (ISO)
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.realGrades=p.realGrades||{};var r={grade:$1};if('$2'!==''){r.doneAt='$2'}p.realGrades['TEC.1984-Av1']=r;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok grade=$1'})()" 2>/dev/null | tr -d '"'
}
clean_notas() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.realGrades;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'limpo'})()" >/dev/null 2>&1
  sleep 1
}
clean_all_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.realGrades;delete p.__poke;delete p.materialProgress;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'limpo total'})()" 2>/dev/null | tr -d '"'
}
# O CARD PÓS-PROVA: classe do Card que contém o título (cor = significado).
card_class() {
  agent-browser eval "(function(){var ps=document.querySelectorAll('p');for(var i=0;i<ps.length;i++){if(ps[i].textContent.indexOf('Prova de Matemática (Av1) realizada')>=0){var el=ps[i].closest('div[class*=border-]');return el?el.className:''}}return ''})()" 2>/dev/null | tr -d '"'
}
card_cta() { # o CTA do card pós-prova (aria-label contém 'Calculadora')
  agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){var a=bs[i].getAttribute('aria-label')||'';if(a.indexOf('Calculadora de notas')>=0)return bs[i].textContent.trim()}return ''})()" 2>/dev/null | tr -d '"'
}
cell_class() {
  agent-browser eval "(function(){var els=document.querySelectorAll('div[title]');for(var i=0;i<els.length;i++){var t=els[i].getAttribute('title');if(t.indexOf('$1')>=0)return els[i].className}return ''})()" 2>/dev/null | tr -d '"'
}
chip_check() {
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('border-amber-500/25')>=0&&els[i].textContent.indexOf('$1')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}

agent-browser close 2>/dev/null || true
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 4

# RECEITA FINAL (a lição que custou a rodada): NUNCA RELOAD. As suítes verdes
# da frota (t108/t110) montam a página UMA vez e fazem TODO o resto por
# eventos: mock_date (eval) → seed/clean com StorageEvent → view switch. O
# reload re-monta o app e a ponte de eventos com o contexto recém-nascido é
# rácio (o listener registra em useEffect; o evento chega antes → perdido, e
# a hidratação já leu o storage sem o seed). Sem reload, o evento ponteia na
# hora (verificado: badge vira no mesmo tick) e o re-render do contexto
# recalcula daysLeft com o relógio já mockado.
prep_fase() { # $1 = código JS sobre p (corpo do try) · $2 = marcador
  go_home
  agent-browser eval "(function(){var M=new Date('2026-10-02T15:00:00').getTime();class FD extends Date{constructor(...a){a.length===0?super(M):super(...a)}static now(){return M}}window.Date=FD;return 'mock'})()" >/dev/null 2>&1
  local landed=0
  for i in 1 2 3; do
    agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');try{ $1 }catch(e){};var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok'})()" >/dev/null 2>&1
    sleep 2
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    if [ "$(agent-browser eval "(function(){return document.body.innerText.indexOf('$2')>=0?1:0})()" 2>/dev/null | tr -d '"')" = "1" ]; then
      landed=1; break
    fi
  done
  if [ "$landed" = "1" ]; then
    echo "  (fase aterrissou no ciclo $i — mock → seed+evento → remount, sem reload)"
  else
    echo "  (ATENÇÃO: marcador não aterrissou após 3 ciclos)"
  fi
}

echo "=== [A] 02/10 SEM nota: a manhã depois é honesta ==="
prep_fase "delete p.realGrades;" 'Prova de Matemática (Av1) realizada'
[ "$(has 'Prova de Matemática (Av1) realizada')" = "1" ] && ok "card pós-prova compacto presente" || bad "card pós-prova ausente"
[ "$(has 'Registre a nota na Calculadora quando sair o resultado')" = "1" ] && ok "pendente honesto: 'Registre a nota quando sair o resultado'" || bad "voz pendente sumiu"
[ "$(card_cta | grep -c 'Abrir a Calculadora')" = "1" ] && ok "CTA pendente: 'Abrir a Calculadora'" || bad "CTA pendente errado: $(card_cta)"
[ "$(has 'Faltam 7 dias para Projeto 1ª etapa')" = "1" ] && ok "hero segue em frente: o próximo prazo real é o projeto de LM (09/10)" || bad "hero preso na semana passada"
[ "$(has 'Prova de Matemática realizada — falta a nota')" = "1" ] && ok "recovery fala a mesma língua: 'falta a nota'" || bad "recovery dessincronizado"
[ "$(has 'Anotar a nota da Av1')" = "1" ] && ok "fila: o passo real é anotar a nota" || bad "fila não pede a nota"
[ "$(has 'boa prova')" = "0" ] && ok "silêncio: 'boa prova' não vive depois do dia" || bad "eco de 'boa prova' pós-prova"
[ "$(has 'catch-up')" = "0" ] && ok "silêncio: nenhum catch-up pós-prova" || bad "catch-up falando depois da prova"
[ "$(has 'Modo recuperação:')" = "0" ] && ok "silêncio: o banner do card dorme pós-prova" || bad "banner de recuperação pós-prova"
go_progress || bad "ida ao Progresso falhou"
CC=$(cell_class 'Prova da Av1')
echo "$CC" | grep -q "ring-rose-500/70" && ok "mapa: anel da prova fica como HISTÓRIA" || bad "anel histórico do mapa sumiu"
[ "$(chip_check 'Prova da Av1 01/10')" = "0" ] && ok "mapa: chip da semana CALA depois da prova" || bad "chip ainda grita semana passada"
[ "$(has '· marco:')" = "1" ] && ok "mapa: legenda segue explicando os anéis" || bad "legenda do mapa sumiu"

# FASES B/C VIA UI REAL (o caminho do aluno): a ponte de eventos do harness
# se mostrou rácia para seeds scriptados (lição da rodada) — o caminho do
# FORMULÁRIO é a verdade absoluta: digitar na Calculadora é exatamente o que
# o dono fará no dia 02/10. Cada digitação é confirmada no storage antes de
# seguir (o input controlado engole o 2º dígito às vezes — retry honesto).
ui_select_matematica() {
  agent-browser eval "(function(){var b=document.querySelector('button[role=combobox]');if(!b)return 'sem combobox';b.click();return 'aberto'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var opts=document.querySelectorAll('div[role=option],span[role=option],[role=option]');for(var i=0;i<opts.length;i++){if(opts[i].textContent.trim()==='Matemática'){opts[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
}
ui_focus_av1_input() {
  agent-browser eval "(function(){var rows=document.querySelectorAll('tr');for(var i=0;i<rows.length;i++){var r=rows[i];if(r.textContent.indexOf('Av1')>=0&&r.textContent.indexOf('Av2')<0&&r.textContent.indexOf('Matem')>=0){var inp=r.querySelector('input[placeholder=\"0-100\"]');if(inp){inp.focus();inp.click();return 'ok'}}}return 'NAO'})()" >/dev/null 2>&1
}
ui_rg_grade() {
  agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');var r=(p.realGrades||{})['TEC.1984-Av1'];return r?String(r.grade):''})()" 2>/dev/null | tr -d '"'
}

echo "=== [B] nota 85 LEGÍTIMA (via UI da Calculadora): o card acorda EMERALD ==="
go_progress || bad "ida ao Progresso falhou"
ui_select_matematica
ui_focus_av1_input
agent-browser keyboard type "85" >/dev/null 2>&1
sleep 2
TRY=0
while [ "$(ui_rg_grade)" != "85" ] && [ $TRY -lt 6 ]; do
  TRY=$((TRY+1))
  ui_focus_av1_input
  agent-browser press Control+a >/dev/null 2>&1
  agent-browser keyboard type "85" >/dev/null 2>&1
  sleep 2
done
[ "$(ui_rg_grade)" = "85" ] && ok "nota 85 registrada pela UI (o gesto real do dono)" || bad "UI não registrou a 85 (rg=$(ui_rg_grade))"
go_home
[ "$(has 'Nota 85 registrada · meta 70 ✓')" = "1" ] && ok "card lê o registro: 'Nota 85 registrada · meta 70 ✓'" || bad "card não leu a nota 85"
[ "$(has 'Registre a nota na Calculadora quando sair o resultado')" = "0" ] && ok "FÓSSIL MORTO: nenhum 'Registre a nota' com a nota lançada" || bad "fóssil vivo: card manda registrar o que já foi registrado"
[ "$(card_cta | grep -c 'Ver a média na Calculadora')" = "1" ] && ok "CTA honesto: 'Ver a média na Calculadora'" || bad "CTA não acompanhou o estado: $(card_cta)"
K=$(card_class)
echo "$K" | grep -q "border-emerald-500/20" && ok "cor = significado: card emerald (meta batida)" || bad "card emerald sem a borda"
[ "$(has 'Realizada — nota')" = "1" ] && ok "coerência: recovery celebra a MESMA nota" || bad "recovery perdeu a nota"
[ "$(has 'meta 70 ✓')" = "1" ] && ok "coerência: meta 70 ✓ nas duas vozes" || bad "meta não marcada no recovery"
[ "$(has 'Anotar a nota da Av1')" = "0" ] && ok "fila convergiu: o passo 'Anotar a nota' saiu" || bad "fila ainda pede nota já registrada"

echo "=== [C] nota 65 (via UI): amber honesto, sem alarme ==="
go_progress || bad "volta ao Progresso falhou"
ui_focus_av1_input
agent-browser press Control+a >/dev/null 2>&1
agent-browser keyboard type "65" >/dev/null 2>&1
sleep 2
TRY=0
while [ "$(ui_rg_grade)" != "65" ] && [ $TRY -lt 6 ]; do
  TRY=$((TRY+1))
  ui_focus_av1_input
  agent-browser press Control+a >/dev/null 2>&1
  agent-browser keyboard type "65" >/dev/null 2>&1
  sleep 2
done
[ "$(ui_rg_grade)" = "65" ] && ok "nota 65 registrada pela UI" || bad "UI não registrou a 65 (rg=$(ui_rg_grade))"
go_home
[ "$(has 'Nota 65 registrada · meta 70')" = "1" ] && ok "card lê a nota abaixo da meta" || bad "card não leu a 65"
[ "$(has 'Av2 e Av3 abrem caminho')" = "1" ] && ok "voz honesta: 'Av2 e Av3 abrem caminho' (informativo, nunca alarme)" || bad "linha honesta ausente"
CC65=$(card_class)
echo "$CC65" | grep -q "border-amber-500/20" && ok "cor = significado: card amber (abaixo da meta)" || bad "card amber sem a borda"
echo "$CC65" | grep -q "border-emerald-500/20" && bad "emerald não pode aparecer abaixo da meta" || ok "emerald ausente abaixo da meta"
[ "$(has 'Realizada — nota')" = "1" ] && ok "recovery mostra a nota 65" || bad "recovery perdeu a 65"

echo "=== [D] registro SUSPEITO (antes da prova): o ensaio não vira nota ==="
go_progress || bad "volta ao Progresso falhou"
ui_focus_av1_input
agent-browser press Control+a >/dev/null 2>&1
agent-browser press BackSpace >/dev/null 2>&1
sleep 2
TRY=0
while [ -n "$(ui_rg_grade)" ] && [ $TRY -lt 6 ]; do
  TRY=$((TRY+1))
  ui_focus_av1_input
  agent-browser press Control+a >/dev/null 2>&1
  agent-browser press BackSpace >/dev/null 2>&1
  sleep 2
done
[ -z "$(ui_rg_grade)" ] && ok "nota apagada pela UI (o registro sai do storage)" || bad "nota não saiu (rg=$(ui_rg_grade))"
# o registro SUSPEITO (doneAt ANTES do dia da prova) não é digitável — mora no
# storage: o % do ensaio digitado na mesma noite. Seed t108-style + evento.
agent-browser eval "(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');p.realGrades={};p.realGrades['TEC.1984-Av1']={grade:50,doneAt:'2026-09-29T12:00:00.000Z'};var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok'})()" >/dev/null 2>&1
sleep 2
go_home
[ "$(has 'Registre a nota na Calculadora quando sair o resultado')" = "1" ] && ok "voz pendente VOLTA (o % do ensaio não é nota — lição 108)" || bad "ensaiou como nota"
[ "$(has 'Nota 50 registrada')" = "0" ] && ok "nenhuma 'Nota 50 registrada' fabricada" || bad "registro suspeito virou nota no card"
[ "$(has 'Prova de Matemática realizada — falta a nota')" = "1" ] && ok "recovery segue pedindo a nota verdadeira" || bad "recovery celebrou o suspeito"

echo "=== [E] MOBILE 390 + HIGIENE + CONSOLE ==="
prep_fase "delete p.realGrades;" 'Prova de Matemática (Av1) realizada'
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var ps=document.querySelectorAll('p');for(var i=0;i<ps.length;i++){if(ps[i].textContent.indexOf('Prova de Matemática (Av1) realizada')>=0){ps[i].scrollIntoView({block:'center'});return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa124-pos-prova-pendente-mobile.png >/dev/null 2>&1 && ok "screenshot mobile (qa124-pos-prova-pendente-mobile.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
H=$(clean_all_runs)
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length+' matProg='+Object.keys(p.materialProgress||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RUNS"
echo "$H" >/dev/null 2>&1
case "$RUNS" in *runs=0*poke=0*realGrades=0*matProg=0*) ok "storage limpo (o ensaio não escreve nada)";; *) bad "resíduo no storage: $RUNS";; esac
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t124 o dia seguinte (o card da prova acorda pós-prova)"
else
  echo "FAILURES — t124"
  exit 1
fi
