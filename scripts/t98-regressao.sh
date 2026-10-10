#!/bin/bash
# Task 98 — regressão do estado 0456339 (Tasks 95+96+97) na data real.
# Nada novo é implementado aqui: só garantia de que as três últimas rodadas
# coexistem — badge do tutor (97), chip apoio (96), kit fora da janela (95).
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t98.log 2>&1 &)
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
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked'})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [A] HOME na data real (dom 27/09, D-4) ==="
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

echo "=== [B] TAREFA D-4 no DASHBOARD: chip 'apoio (2)' da 96 ==="
# o ExamPrepCard mora no dashboard (Visão Geral) — NÃO no Estudar (lição desta rodada)
APOIO=$(has 'apoio (2)')
[ "$APOIO" = "1" ] && ok "chip 'apoio (2)' na tarefa de hoje (mat-ex07/08)" || bad "chip apoio ausente"
MATEX=$(has 'mat-ex07')
[ "$MATEX" = "1" ] && ok "IDs no rótulo/title: mat-ex07" || bad "IDs não visíveis"
# navegar para Estudar SÓ AGORA (o chat/Tirar dúvida com IA mora lá)
agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3

echo "=== [C] BADGE DO TUTOR (97) no chat ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Tirar dúvida com IA')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
BDG=$(has 'semana da av1 · d-4')
[ "$BDG" = "1" ] && ok "badge: 'contexto: semana da Av1 · D-4'" || bad "badge do tutor ausente"
NS=$(has 'simulado 70%')
[ "$NS" = "0" ] && ok "sem run → badge não inventa veredito" || bad "badge inventa simulado!"

echo "=== [D] HIGIENE + CONSOLE ==="
agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');delete p.__poke;var s=JSON.stringify(p);localStorage.setItem('$STORE',s);window.dispatchEvent(new StorageEvent('storage',{key:'$STORE',newValue:s}));return 'ok'})()" >/dev/null 2>&1
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*) ok "storage limpo";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t98 regressão"; else echo ""; echo "FAILURES — t98 regressão"; exit 1; fi
