#!/bin/bash
# Task 102 — E2E: O MÉTODO SABE A SEMANA (faixa da semana na Sessão Guiada +
# sugestão de 1 clique com o tema do plano de hoje; sugestão CALA honestamente
# nos dias em que o método não é a ferramenta).
# Padrões provados (t88–t101): mock class extends Date com eco na página,
# sandbox UTC (datas absolutas), higiene total no fim.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t102.log 2>&1 &)
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
go_metodo() {
  # 'Método' mora DENTRO do submenu 'Mais' do sidebar (lição desta rodada):
  # abrir o submenu antes de procurar o botão.
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();break}}return 'ok'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Método'){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"'
  sleep 3
}
click_plano_chip() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('plano de hoje:')>=0){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
tema_value() {
  agent-browser eval "(function(){var e=document.getElementById('mtd-topic');return e?e.value:'sem-campo'})()" 2>/dev/null | tr -d '"'
}
disc_combo() {
  agent-browser eval "(function(){var e=document.querySelector('[role=combobox]');return e?e.textContent.replace(/\s+/g,' ').slice(0,60):'sem-combo'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] Data real (dom 27/09, D-4): faixa + tema do plano a 1 clique ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
GM=$(go_metodo)
[ "$GM" = "ok" ] && ok "aba Método aberta" || bad "não achei o nav Método"
FAIXA=$(has 'Semana da Av1 · faltam 4 dias')
[ "$FAIXA" = "1" ] && ok "faixa: 'Semana da Av1 · faltam 4 dias'" || bad "faixa da semana ausente"
D4=$(has 'D-4')
[ "$D4" = "1" ] && ok "chip tabular D-4" || bad "chip D-N ausente"
LIN=$(has 'planeje, recupere e explique a lista que cai')
[ "$LIN" = "1" ] && ok "linha honesta da faixa" || bad "linha da faixa ausente"
CHIP=$(has 'plano de hoje: Lista de Lógica — Parte 1 (Q1–12)')
[ "$CHIP" = "1" ] && ok "chip 'plano de hoje' com o título do dia D-4" || bad "chip de sugestão ausente"

echo "=== [B] Clique no chip → tema + disciplina preenchidos ==="
CC=$(click_plano_chip)
TV=$(tema_value)
DC=$(disc_combo)
[ "$CC" = "ok" ] && [ "$TV" = "Lista de Lógica — Parte 1 (Q1–12)" ] && ok "tema preenchido: '$TV'" || bad "tema errado (cc=$CC tv=$TV)"
case "$DC" in *Matemática*) ok "disciplina virou Matemática ($DC)";; *) bad "disciplina errada: $DC";; esac

echo "=== [C] Mock 29/09 (D-2, dia do simulado): método espera, sem sugestão ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
MD=$(mock_date '2026-09-29T12:00:00'); echo "  ($MD)"
go_metodo >/dev/null
EH=$(has 'É hoje: Simulado da Av1')
[ "$EH" = "1" ] && ok "faixa: 'É hoje: Simulado da Av1'" || bad "faixa do ensaio ausente"
ESP=$(has 'o método espera')
[ "$ESP" = "1" ] && ok "linha honesta: 'o método espera'" || bad "linha do ensaio ausente"
CHIP2=$(has 'plano de hoje:')
[ "$CHIP2" = "0" ] && ok "sugestão CALA no dia do ensaio" || bad "sugestão no dia do simulado!"

echo "=== [D] Mock 30/09 (D-1, véspera): a véspera é do kit ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
MD2=$(mock_date '2026-09-30T12:00:00'); echo "  ($MD2)"
go_metodo >/dev/null
VE=$(has 'Véspera da prova')
[ "$VE" = "1" ] && ok "faixa: 'Véspera da prova'" || bad "faixa da véspera ausente"
KD=$(has 'a véspera é do kit da véspera')
[ "$KD" = "1" ] && ok "linha honesta aponta o kit" || bad "linha da véspera ausente"
CHIP3=$(has 'plano de hoje:')
[ "$CHIP3" = "0" ] && ok "sugestão CALA na véspera" || bad "sugestão na véspera!"

echo "=== [E] Mock 01/10 (D-0, prova): não é dia de sessão ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
MD3=$(mock_date '2026-10-01T12:00:00'); echo "  ($MD3)"
go_metodo >/dev/null
PR=$(has 'É hoje: Prova da Av1')
[ "$PR" = "1" ] && ok "faixa: 'É hoje: Prova da Av1'" || bad "faixa da prova ausente"
NS=$(has 'não é dia de sessão')
[ "$NS" = "1" ] && ok "linha honesta: 'não é dia de sessão'" || bad "linha da prova ausente"
CHIP4=$(has 'plano de hoje:')
[ "$CHIP4" = "0" ] && ok "sugestão CALA no dia da prova" || bad "sugestão no D-0!"

echo "=== [F] Mock 03/10 (pós-prova): silêncio honesto ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
MD4=$(mock_date '2026-10-03T12:00:00'); echo "  ($MD4)"
go_metodo >/dev/null
SEM=$(has 'Semana da Av1')
EHOJE=$(has 'É hoje: Simulado\|É hoje: Prova')
[ "$SEM" = "0" ] && ok "faixa cala após a prova" || bad "faixa grita pós-prova!"

echo "=== [G] Mobile 390: sem overflow ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
go_metodo >/dev/null
agent-browser eval "(function(){var els=document.querySelectorAll('h1,h2');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Semana da Av1')>=0){els[i].scrollIntoView({block:'start'});break}}return 'ok'})()" >/dev/null 2>&1
sleep 1
OW=$(agent-browser eval "(function(){return document.documentElement.scrollWidth})()" 2>/dev/null | tr -d '"')
[ "$OW" -le 390 ] 2>/dev/null && ok "sem overflow horizontal (scrollWidth=$OW)" || bad "overflow mobile: $OW"
agent-browser screenshot scripts/qa102-metodo-mobile390.png >/dev/null 2>&1
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 1

echo "=== [H] Higiene + console (feature é date-pura) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);return 'ok'})()" >/dev/null 2>&1
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo (nada semeado — date-puro)";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t102 e2e (método sabe a semana)"; else echo ""; echo "FAILURES — t102 e2e"; exit 1; fi
