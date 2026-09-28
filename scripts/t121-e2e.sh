#!/bin/bash
# Task 121 — O ENSAIO GERAL DO DIA DO SIMULADO (dress rehearsal 29/09) e o
# plano que não briga consigo mesmo. O rehearsal achou DOIS bugs reais no
# banner 'Modo recuperação' do card da Av1: (1) o prazo 'antes do dia de
# hoje' — um prazo impossível, a data nunca era computada; (2) o banner não
# conhecia o marco do dia e empurrava 'catch-up ≈90 min' no DIA do ensaio,
# brigando com o brief ('o dia é do ensaio real') e com o veredito do kit
# ('a revisão de amanhã'). A FIXAÇÃO: o banner aprende o marco pela FONTE
# ÚNICA examWeekMilestoneFor (hoje = prova − daysLeft, âncora no meio-dia
# local, lição 108) e DEFERE ao dono do dia — simulado espera o resultado,
# véspera admite que o catch-up já não cabe, prova deseja boa prova (ícone
# troca com significado: CircleAlert comum → CalendarClock espera → Flag
# prova). Detalhe da folha: o slot da promessa no PRÓPRIO dia diz 'chega
# hoje' (antes dizia 'chega em 29/09' no dia 29/09). Este E2E usa a FERRA-
# MENTA NOVA da frota — agent-browser open --init-script (Date mockado
# ANTES do primeiro script da página, determinístico, sem poke+remount):
# [1] dia comum 26/09 = branch padrão com prazo na PROVA; [2] 29/09 sem run
# = banner defere + brief/kit/agenda do ensaio; [3] 29/09 com run = strip
# flipa 'feito ✓' e o banner AINDA defere; [4] 01/10 = 'boa prova' + Flag;
# [5] folha no dia do ensaio = 'chega hoje' + selo 'Impresso em 29/09 ·
# Simulado da Av1' + 15 katex; [6] higiene + console.
set -u
cd /home/z/my-project

FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t121.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null
sleep 1

MOCKJS=/tmp/t121-mock.js
write_mock() { # $1 = ISO local do relógio mockado (ex.: '2026-09-29T12:00:00')
  cat > "$MOCKJS" <<EOF
(function(){
  var M = new Date('$1').getTime();
  class FD extends Date {
    constructor(...args){ args.length===0 ? super(M) : super(...args); }
    static now(){ return M; }
  }
  window.Date = FD;
})();
EOF
}
open_mocked() { # $1 ISO, $2 URL — SESSÃO NOVA por fase: --init-script só
  # registra na primeira navegação da sessão (sem o close, o mock da fase
  # anterior é quem continua correndo — lição da primeira execução da t121)
  write_mock "$1"
  agent-browser close >/dev/null 2>&1
  sleep 1
  agent-browser open --init-script "$MOCKJS" "$2" >/dev/null 2>&1
  sleep 6
}
has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
banner_icon() { # classe do svg do banner 'Modo recuperação' (mais interno div.border-t)
  agent-browser eval "(function(){var divs=document.querySelectorAll('div.border-t');for(var i=0;i<divs.length;i++){var t=(divs[i].textContent||'').replace(/\s+/g,' ');if(t.indexOf('Modo recuperação')===0){var svg=divs[i].querySelector('svg');return svg?(svg.getAttribute('class')||''):'NOSVG'}}return 'NOBANNER'})()" 2>/dev/null | tr -d '"'
}
timeline_fill() { # width inline do preenchimento do trilho D-7→prova (span do gradiente)
  agent-browser eval "(function(){var sp=document.querySelectorAll('span');for(var i=0;i<sp.length;i++){var c=sp[i].className||'';if(c.indexOf('from-emerald-500/70')>=0){return sp[i].style.width||'NOSTYLE'}}return 'NOSPAN'})()" 2>/dev/null | tr -d '"'
}
clean_runs() {
  agent-browser eval "(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.__poke;delete p.realGrades;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs=0'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
insert_run() { # run oficial do ensaio (o mesmo shape da t105) — 3 puladas em Matrizes, 5 certas e 2 erros em Lógica
  agent-browser eval "(function(){var k='hub-estudos-ifpb:v2';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];for(var i=0;i<3;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'skipped'});for(var j=0;j<5;j++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(var m=0;m<2;m++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'qa121-run',date:'2026-09-29T15:30:00',mode:'prova',total:qs.length,solved:5,missed:2,skipped:3,durationSec:3600,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'run in'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
go_dash_remount() { # lição 120: estado cacheado no mount/ticks longos — troca de aba força remount com o Date já mockado
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 3
}

echo "=== [1] DIA COMUM (26/09): o prazo agora é a PROVA ==="
open_mocked '2026-09-26T12:00:00' 'http://localhost:3000'
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
[ "$(has 'Faltam 5 dias')" = "1" ] && ok "hero D-5: 'Faltam 5 dias' (o mock do init-script chegou à página)" || bad "hero D-5 não apareceu"
[ "$(has 'Modo recuperação')" = "1" ] && ok "banner de recuperação presente (2 dias pendentes)" || bad "banner ausente no dia comum"
[ "$(has 'O conteúdo CONTINUA na prova (01/10)')" = "1" ] && ok "prazo existe: 'até a prova (01/10)'" || bad "prazo da prova sumiu do banner"
[ "$(has 'até lá')" = "1" ] && ok "CTA mantido no dia comum ('até lá')" || bad "CTA 'até lá' ausente"
if [ "$(has 'antes do dia de hoje')" = "0" ]; then
  ok "o prazo impossível 'antes do dia de hoje' FOI EXTIRPADO"
else
  bad "o prazo impossível 'antes do dia de hoje' continua no DOM"
fi
IC=$(banner_icon)
case "$IC" in
  *lucide-circle-alert*) ok "ícone do dia comum = CircleAlert (a pendência é urgente agora)";;
  *) bad "ícone errado no dia comum: $IC";;
esac

echo "=== [2] DIA DO ENSAIO (29/09, sem run): o banner DEFERE ao dono do dia ==="
open_mocked '2026-09-29T12:00:00' 'http://localhost:3000'
[ "$(has 'É hoje: Simulado da Av1')" = "1" ] && ok "brief do dia: 'É hoje: Simulado da Av1'" || bad "brief do ensaio ausente"
[ "$(has 'depois do simulado de hoje — comece por aqui')" = "1" ] && ok "kit do dia: 'depois do simulado de hoje'" || bad "kit do ensaio mudou"
[ "$(has 'no mesmo dia do Simulado da Av1 de Matemática.hoje')" = "1" ] && ok "agenda: S3 no topo com badge 'hoje'" || bad "S3 sem badge 'hoje' na agenda"
[ "$(has 'o dia é do ensaio real')" = "1" ] && ok "banner defere: 'o dia é do ensaio real'" || bad "banner não defere ao ensaio"
[ "$(has 'o catch-up (≈90 min) espera')" = "1" ] && ok "banner espera: 'o catch-up (≈90 min) espera'" || bad "banner ainda empurra o catch-up no dia do ensaio"
if [ "$(has 'antes do dia de hoje')" = "0" ]; then
  ok "prazo impossível ausente também no dia do ensaio"
else
  bad "prazo impossível voltou no dia do ensaio"
fi
IC=$(banner_icon)
case "$IC" in
  *lucide-calendar-clock*) ok "ícone de espera = CalendarClock (a gramática de espera da casa)";;
  *) bad "ícone errado no dia do ensaio: $IC";;
esac
W=$(timeline_fill)
[ "$W" = "62.5%" ] && ok "trilho D-7→prova pinta ATÉ HOJE no D-2 (width 62.5% — antes parava no D-5)" || bad "trilho não chega ao D-2: width=$W"
agent-browser screenshot scripts/qa121-dia-do-ensaio-desktop.png >/dev/null 2>&1 && ok "screenshot do dia do ensaio: scripts/qa121-dia-do-ensaio-desktop.png"

echo "=== [3] NOITE DO ENSAIO (29/09 20h, COM run): o registro vence o relógio e o banner segue em silêncio ==="
open_mocked '2026-09-29T20:00:00' 'http://localhost:3000'
insert_run
go_dash_remount
[ "$(has 'feito ✓ — o kit da véspera já lê seu resultado')" = "1" ] && ok "strip flipou: 'feito ✓ — o kit da véspera já lê seu resultado'" || bad "strip não flipou com o run"
[ "$(has '50% · meta 70')" = "1" ] && ok "veredito no strip: '50% · meta 70'" || bad "% do veredito ausente"
[ "$(has 'abaixo da meta')" = "1" ] && ok "kit lê o resultado: 'abaixo da meta'" || bad "kit não leu o veredito"
[ "$(has 'Matrizes: pulou tudo — a revisão de amanhã')" = "1" ] && ok "feedback do drill: 'Matrizes: pulou tudo — a revisão de amanhã'" || bad "feedback do drill ausente"
[ "$(has 'o dia é do ensaio real')" = "1" ] && ok "banner AINDA defere com o run feito (não volta a empurrar catch-up)" || bad "banner voltou a empurrar catch-up depois do run"

echo "=== [4] DIA DA PROVA (01/10): alarme nenhum, só a despedida honesta ==="
open_mocked '2026-10-01T12:00:00' 'http://localhost:3000'
clean_runs >/dev/null 2>&1
[ "$(has 'É hoje: Prova da Av1')" = "1" ] && ok "brief da prova: 'É hoje: Prova da Av1'" || bad "brief da prova ausente"
[ "$(has 'Hoje é o dia da prova: nada de catch-up agora — boa prova!')" = "1" ] && ok "banner da prova: 'nada de catch-up agora — boa prova!'" || bad "banner da prova errado"
W=$(timeline_fill)
[ "$W" = "87.5%" ] && ok "NO DIA DA PROVA o trilho amanhece INTEIRO (width 87.5% — antes, vazio)" || bad "trilho não preenche na prova: width=$W"
IC=$(banner_icon)
case "$IC" in
  *lucide-flag*) ok "ícone da prova = Flag (alarme nenhum)";;
  *) bad "ícone errado no dia da prova: $IC";;
esac

echo "=== [5] A FOLHA NO DIA DO ENSAIO: a promessa diz 'chega hoje' ==="
open_mocked '2026-09-29T12:00:00' 'http://localhost:3000/folha-revisao'
[ "$(has 'Foco do simulado · chega hoje')" = "1" ] && ok "slot no dia 29/09: 'Foco do simulado · chega hoje'" || bad "slot ainda diz 'chega em 29/09' no próprio dia"
STAMP=$(agent-browser eval "(function(){var el=document.querySelector('[data-testid=\"folha-print-stamp\"]');return el?el.textContent.replace(/\s+/g,' ').trim():''})()" 2>/dev/null | tr -d '"')
[ "$STAMP" = "Impresso em 29/09 · Simulado da Av1" ] && ok "selo sob o marco: '$STAMP'" || bad "selo errado sob mock: '$STAMP'"
KATEX=$(agent-browser eval "document.querySelectorAll('.katex').length" 2>/dev/null | tr -d '"')
[ "$KATEX" = "15" ] && ok "15 katex à vista (regressão 119 intocada)" || bad "katex mudou: $KATEX"

echo "=== [6] HIGIENE + CONSOLE (sessão nova, sem mock) ==="
agent-browser close 2>/dev/null
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo (o ensaio não escreve nada)";; *) bad "resíduo: $S";; esac
C=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$C" = "0" ] && ok "console: 0 erros" || bad "console tem $C erros"

[ "$FAIL" = "0" ] && echo "ALL GREEN — t121 o ensaio geral (o plano não briga consigo mesmo no dia do simulado)" || echo "FAIL — ver [FAIL] acima"
exit $FAIL
