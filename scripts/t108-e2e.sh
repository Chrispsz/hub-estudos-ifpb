#!/bin/bash
# Task 108 — O ENSAIO NÃO É A NOTA: a seção "Minhas notas reais" da
# Calculadora convida a "registrar as notas reais das avaliações que você
# JÁ FEZ" e, na noite do simulado (29/09, meta 70%), o % do ensaio é o
# número que pede para ser digitado na linha Av1 — registro ANTES do
# evento não é nota real (ordem do tempo, lição 107). Este E2E verifica:
# [B] D-2 sem registro = faixa âmbar de prevenção + radar mantém a prova;
# [C] A ARMADILHA: % do simulado digitado como nota real pré-prova = linha
#     'confira' + nota NÃO celebrada + prova NÃO some do radar;
# [D] pós-prova com registro suspeito = fila NÃO celebra ('falta a nota');
# [E] pós-prova com registro legítimo = celebração preservada (regressão);
# [F] registro antigo sem doneAt = benefício da dúvida (nada inventado);
# [G] mobile 390 sem overflow.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t108.log 2>&1 &)
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
badge_tone() { # $1=texto · $2=classe família
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0&&els[i].textContent.length<140)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
seed_nota() { # $1=grade · $2=doneAt (ISO) · vazio em $2 = sem doneAt
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.realGrades=p.realGrades||{};var r={grade:$1};if('$2'!==''){r.doneAt='$2'}p.realGrades['TEC.1984-Av1']=r;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok grade=$1'})()" 2>/dev/null | tr -d '"'
}
clean_all() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.realGrades;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'limpo'})()" 2>/dev/null | tr -d '"'
  sleep 1
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
go_home() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}

echo "=== [A] DATA REAL (dom 27/09, D-4): a calculadora é só calculadora ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
clean_all
go_progress || bad "navegação Progresso falhou"
[ "$(has 'Minhas notas reais')" = "1" ] && ok "seção Minhas notas reais renderiza" || bad "seção ausente"
[ "$(has 'nada para lançar aqui')" = "0" ] && ok "fora da janela: faixa ausente (regra da 88)" || bad "faixa apareceu fora da janela"
[ "$(has 'A Av1 aconteceu')" = "0" ] && ok "D-4: sem faixa pós-prova" || bad "faixa pós-prova no D-4"
[ "$(has 'Av1 — 01/10 (em 4 dias)')" = "1" ] && ok "radar normal: 'Av1 — 01/10 (em 4 dias)' (o próximo NO TEMPO)" || bad "radar quebrou"

echo "=== [B] D-2 (29/09) SEM registro: faixa de prevenção + radar intacto ==="
mock_date "2026-09-29T10:00:00" >/dev/null
poke
[ "$(has 'Hoje é o simulado — nada para lançar aqui')" = "1" ] && ok "faixa âmbar D-2: 'Hoje é o simulado — nada para lançar aqui'" || bad "faixa D-2 ausente"
[ "$(has 'a nota real da Av1 entra nesta tabela só depois da prova de 01/10')" = "1" ] && ok "faixa nomeia a regra (nota real só depois da prova)" || bad "texto da regra ausente"
[ "$(badge_tone 'D-2' 'border-amber-300')" = "1" ] && ok "chip tabular 'D-2' na família âmbar" || bad "chip D-2 ausente/errado"
[ "$(has 'Av1 — 01/10 (em 2 dias)')" = "1" ] && ok "radar mantém: 'Av1 — 01/10 (em 2 dias)'" || bad "radar perdeu a prova"

echo "=== [C] A ARMADILHA: % do simulado digitado como nota real PRÉ-prova ==="
seed_nota 70 "2026-09-29T22:00:00.000Z"
sleep 1
[ "$(badge_tone 'confira' 'border-amber-200')" = "1" ] && ok "linha Av1: badge 'confira' (não '✓ ok')" || bad "badge confira ausente"
[ "$(has 'lançada antes da prova — se é o % do simulado, apague: ensaio mora no histórico')" = "1" ] && ok "linha nomeia a regra junto do registro" || bad "nota da linha ausente"
[ "$(has '✓ ok')" = "0" ] && ok "celebração '✓ ok' NÃO existe com registro suspeito" || bad "registro suspeito foi celebrado"
[ "$(has 'Av1 — 01/10 (em 2 dias)')" = "1" ] && ok "RELÓGIO MANDA: prova segue no radar mesmo com registro suspeito" || bad "registro suspeito apagou a prova do radar"
[ "$(has 'Média real por disciplina')" = "0" ] && ok "resumo real não herda o ensaio (sem cabeçalho vazio)" || bad "resumo herdou o registro suspeito"
agent-browser eval "(function(){var h=[].slice.call(document.querySelectorAll('h3')).find(function(x){return x.textContent.indexOf('Minhas notas reais')>=0});if(h){h.scrollIntoView({block:'start'});return 'ok'}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa108-calculadora-ensaio-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa108-calculadora-ensaio-desktop.png)" || bad "screenshot falhou"

echo "=== [D] PÓS-PROVA (02/10) com registro SUSPEITO: a fila não celebra ==="
mock_date "2026-10-02T15:00:00" >/dev/null
poke
sleep 1
[ "$(has 'A nota lançada é anterior à prova')" = "1" ] && ok "faixa pós-prova suspeita: 'A nota lançada é anterior à prova'" || bad "faixa de suspeita pós-prova ausente"
[ "$(badge_tone 'confira' 'border-amber-200')" = "1" ] && ok "linha segue 'confira' (doneAt anterior ao dia da prova)" || bad "badge confira sumiu pós-prova"
go_home
sleep 1
[ "$(has 'Prova de Matemática realizada — falta a nota')" = "1" ] && ok "FILA HONESTA: badge diz 'falta a nota' (não celebra o ensaio)" || bad "fila celebrou registro suspeito"
[ "$(has 'Realizada — nota')" = "0" ] && ok "nenhum 'Realizada — nota' fabricado pelo ensaio" || bad "ensaio virou nota na fila"

echo "=== [E] PÓS-PROVA com registro LEGÍTIMO: celebração preservada (regressão) ==="
go_progress || bad "volta ao Progresso falhou"
clean_all
mock_date "2026-10-02T15:00:00" >/dev/null
seed_nota 70 "2026-10-02T18:00:00.000Z"
sleep 1
[ "$(has '✓ ok')" = "1" ] && ok "registro legítimo: linha '✓ ok'" || bad "celebração legítima sumiu"
[ "$(has 'A Av1 aconteceu')" = "0" ] && ok "faixa de convite cala (a nota chegou — a linha fala)" || bad "faixa redundante com registro válido"
[ "$(has 'Média real por disciplina')" = "1" ] && ok "resumo real herda o registro legítimo" || bad "resumo perdeu a nota real"
[ "$(has 'acima')" = "1" ] && ok "média real acima do alvo" || bad "situação real errada"
go_home
sleep 1
[ "$(has 'Realizada — nota')" = "1" ] && ok "fila celebra a nota REAL: 'Realizada — nota 70'" || bad "fila não leu a nota legítima"
[ "$(has 'meta 70 ✓')" = "1" ] && ok "meta batida ✓ na fila" || bad "meta não marcada"

echo "=== [F] Registro antigo SEM doneAt: benefício da dúvida ==="
go_progress || bad "volta ao Progresso falhou"
clean_all
mock_date "2026-10-02T15:00:00" >/dev/null
seed_nota 55 ""
sleep 1
[ "$(has '✓ ok')" = "0" ] && ok "nota 55 < alvo: sem '✓ ok'" || bad "celebrou nota abaixo"
[ "$(has 'abaixo')" = "1" ] && ok "linha 'abaixo' honesta para 55" || bad "estado abaixo ausente"
go_home
sleep 1
[ "$(has 'Realizada — nota')" = "1" ] && ok "registro sem doneAt pós-prova vale (nada inventado contra o dono)" || bad "fila puniu registro antigo"

echo "=== [G] MOBILE 390: faixa + linha confira sem overflow ==="
go_progress || bad "navegação falhou"
clean_all
mock_date "2026-09-29T20:00:00" >/dev/null
seed_nota 70 "2026-09-29T22:00:00.000Z"
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 2
OW=$(agent-browser eval "(function(){return 'iw='+window.innerWidth+' sw='+document.documentElement.scrollWidth})()" 2>/dev/null | tr -d '"')
echo "  $OW"
[ "$OW" = "iw=390 sw=390" ] && ok "mobile 390 sem overflow (iw=390 sw=390)" || bad "overflow no mobile: $OW"
agent-browser eval "(function(){var h=[].slice.call(document.querySelectorAll('h3')).find(function(x){return x.textContent.indexOf('Minhas notas reais')>=0});if(h){h.scrollIntoView({block:'start'});return 'ok'}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa108-calculadora-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa108-calculadora-mobile390.png)" || bad "screenshot falhou"

echo "=== [H] HIGIENE + CONSOLE (reload mata o mock) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
H=$(clean_all)
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RUNS"
echo "$H" >/dev/null 2>&1
[ "$RUNS" = "runs=0 poke=0 realGrades=0" ] && ok "storage limpo (runs/poke/realGrades)" || bad "resíduo no storage: $RUNS"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t108 o ensaio não é a nota (a calculadora obedece ao relógio)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
