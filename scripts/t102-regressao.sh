#!/bin/bash
# Task 102 — regressão do estado 22e428b (Tasks 95..101) na data real.
# Coexistência das 7 camadas da semana da Av1 em 27/09 (D-4, domingo UTC):
# 95 kit fora da janela · 96 chip apoio · 97 badge tutor · 98 faixa Biblioteca
# 99 strip do cronograma silencioso · 100 chip da disciplina · 101 grupo da semana na paleta.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t101.log 2>&1 &)
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
  agent-browser eval "(function(){var t=document.body.textContent.toLowerCase().replace(/\s+/g,' ');return (t.indexOf('$(echo "$1" | tr 'A-Z' 'a-z')')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
click_text() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='$1'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 3
}

echo "=== [A] HOME na data real (dom 27/09, D-4) — camadas 95/99/96 ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
H4=$(has 'faltam 4 dias')
[ "$H4" = "1" ] && ok "hero: 'Faltam 4 dias'" || bad "hero errado"
SIM2=$(has 'simulado da av1 em 2 dias')
[ "$SIM2" = "1" ] && ok "chip: 'Simulado da Av1 em 2 dias'" || bad "chip simulado ausente"
KIT=$(has 'revisão da véspera')
[ "$KIT" = "0" ] && ok "kit ausente (D-4 fora da janela da 95)" || bad "kit deveria estar fechado"
EHOJE=$(has 'é hoje')
[ "$EHOJE" = "0" ] && ok "strip do cronograma silencioso (99, D-4)" || bad "'é hoje' no D-4?"
APOIO=$(has 'apoio (2)')
[ "$APOIO" = "1" ] && ok "chip 'apoio (2)' na tarefa de hoje (96, mat-ex07/08)" || bad "chip apoio ausente"

echo "=== [B] TUTOR (97) no chat ==="
click_text 'Estudar'
sleep 2
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Tirar dúvida com IA')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
BDG=$(has 'semana da av1 · d-4')
[ "$BDG" = "1" ] && ok "badge: 'contexto: semana da Av1 · D-4'" || bad "badge do tutor ausente"
NS=$(has 'simulado 70%')
[ "$NS" = "0" ] && ok "sem run → badge não inventa veredito" || bad "badge inventa simulado!"

echo "=== [C] BIBLIOTECA (98+100) — faixa da semana + chip da disciplina ==="
click_text 'Visão Geral'
sleep 2
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Biblioteca')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
FAIXA=$(has 'semana da av1 · faltam 4 dias')
[ "$FAIXA" = "1" ] && ok "faixa: 'Semana da Av1 · faltam 4 dias'" || bad "faixa da Biblioteca ausente"
LIDOS=$(has 'escopo lido: 0/4')
[ "$LIDOS" = "1" ] && ok "progresso do escopo: 0/4 (nada lido)" || bad "progresso do escopo errado"
PLANO=$(has 'o plano de hoje é')
[ "$PLANO" = "1" ] && ok "faixa cita o plano de hoje" || bad "linha do plano ausente"
CHIPD=$(has 'av1 · faltam 4 dias')
[ "$CHIPD" = "1" ] && ok "chip da disciplina: 'Av1 · faltam 4 dias' no card (100)" || bad "chip da disciplina ausente"

echo "=== [C2] PALETA (101) — grupo da semana em 1º lugar ==="
agent-browser eval "(function(){var b=document.querySelector('[aria-label*=\"Busca\"]');if(!b)return 'NAO';b.click();return 'ok'})()" >/dev/null 2>&1
sleep 2
FHP=$(agent-browser eval "(function(){var e=document.querySelector('[cmdk-group-heading]');return e?e.textContent.replace(/\s+/g,' '):'vazio'})()" 2>/dev/null | tr -d '"')
case "$FHP" in *'Semana da Av1 · faltam '*) ok "paleta: 1º grupo 'Semana da Av1 · faltam N dias' (data-agnóstica — relógio real)";; *) bad "paleta: 1º grupo errado: $FHP";; esac
ENSP=$(agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d)return 0;return d.textContent.indexOf('Simulado da Av1 — ensaio real')>=0?1:0})()" 2>/dev/null | tr -d '"')
[ "$ENSP" = "1" ] && ok "paleta: ação do ensaio presente" || bad "paleta: ensaio ausente"
agent-browser press Escape >/dev/null 2>&1
sleep 1

echo "=== [D] HIGIENE + CONSOLE ==="
agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');delete p.__poke;var s=JSON.stringify(p);localStorage.setItem('$STORE',s);window.dispatchEvent(new StorageEvent('storage',{key:'$STORE',newValue:s}));return 'ok'})()" >/dev/null 2>&1
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*) ok "storage limpo";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t102 regressão (8 camadas)"; else echo ""; echo "FAILURES — t101 regressão"; exit 1; fi
