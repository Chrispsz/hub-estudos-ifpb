#!/bin/bash
# Task 98 — E2E da BIBLIOTECA FALA A SEMANA DA AV1 (strip + badges de escopo).
# A faixa é render-time puro (lição 79): D-N e progresso reagem a mock de
# relógio e a poke no mesmo render. Radix Tabs só abre com click NATIVO
# (lição desta rodada): eval click() não dispara o onValueChange do Tabs.
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
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
count() { # ocorrências de um texto no body
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');var n=0,i=0;while((i=t.indexOf('$1',i))>=0){n++;i+=$2}return n})()" 2>/dev/null | tr -d '"'
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked'})()" >/dev/null 2>&1
  sleep 1
}
open_library() {
  agent-browser open http://localhost:3000 >/dev/null 2>&1
  sleep 6
  agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Biblioteca'||t.indexOf('Biblioteca')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 3
}

echo "=== [A] D-4 REAL: faixa no topo da Biblioteca ==="
open_library
STRIP=$(has 'Semana da Av1 · faltam 4 dias')
[ "$STRIP" = "1" ] && ok "título: 'Semana da Av1 · faltam 4 dias'" || bad "faixa ausente ou título errado"
D4=$(has 'D-4')
[ "$D4" = "1" ] && ok "badge D-4 (tabular)" || bad "badge D-4 ausente"
LINHA=$(has 'o plano de hoje é')
P1=$(has 'Parte 1 (Q1')
[ "$LINHA" = "1" ] && [ "$P1" = "1" ] && ok "linha honesta aponta o plano de hoje (Lógica — Parte 1)" || bad "linha do plano errada"
CH1=$(has 'Matrizes — teoria da Aula 00')
CH2=$(has 'Matrizes — lista (Q1')
CH3=$(has 'Lógica — slides (47p)')
CH4=$(has 'Lógica — lista (Q1')
[ "$CH1" = "1" ] && [ "$CH2" = "1" ] && [ "$CH3" = "1" ] && [ "$CH4" = "1" ] && ok "4 chips do escopo (2 teoria + 2 lista, agrupados por tópico)" || bad "chips do escopo incompletos ($CH1$CH2$CH3$CH4)"
ESC=$(has 'escopo lido:')
[ "$ESC" = "1" ] && ok "progresso do escopo visível (estado real, nada inventado)" || bad "progresso ausente"

echo "=== [B] CHIP → dialog do material (Escape fecha, lição 96.3) ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if((els[i].textContent||'').indexOf('Matrizes — teoria da Aula 00')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
DLG=$(agent-browser eval "(function(){var d=document.querySelectorAll('[role=dialog]');for(var i=0;i<d.length;i++){if((d[i].textContent||'').indexOf('Matrizes — Aula 00 (Slides)')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"')
[ "$DLG" = "1" ] && ok "dialog abre o material EXATO do chip" || bad "dialog não abriu o material"
agent-browser press Escape >/dev/null 2>&1; sleep 1
DLG2=$(agent-browser eval "(function(){var d=document.querySelectorAll('[role=dialog]');return d.length})()" 2>/dev/null | tr -d '"')
[ "$DLG2" = "0" ] && ok "Escape fecha o dialog (sem clicar no primeiro button)" || bad "dialog ficou aberto ($DLG2)"

echo "=== [C] LEITURA AO VIVO: seed 1 lido + poke → 1/4 ==="
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');localStorage.setItem('__qa98_cm',JSON.stringify(p.completedMaterials||[]));p.completedMaterials=['mat-00-matrizes'];var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok'})()" >/dev/null 2>&1
poke; sleep 1
L1=$(has 'escopo lido: 1/4')
[ "$L1" = "1" ] && ok "progresso ao vivo: 1/4 (storage event → re-render)" || bad "progresso não reagiu ao seed"
MARK=$(has 'já lido')
[ "$MARK" = "0" ] && ok "(title attr não vaza para textContent — asserção por progresso)" || true

echo "=== [D] BADGES DE ESCOPO nas linhas (aba Resumos IA, click NATIVO) ==="
agent-browser click "[role=tab]:nth-of-type(2)" >/dev/null 2>&1
sleep 3
# o sub-tab padrão é 'Recentes' (poucas linhas) — ir para 'Todos' (3º trigger
# do TabsList interno, MaterialList) para ver as 5 linhas de Matemática
agent-browser click "[role=tab]:nth-of-type(3)" >/dev/null 2>&1
sleep 3
NB=$(count 'escopo Av1' 9)
echo "  badges visíveis: $NB"
[ "$NB" = "4" ] && ok "exatamente 4 linhas com badge 'escopo Av1'" || bad "esperava 4 badges, vi $NB"
REC=$(has 'Recentes')
[ "$REC" = "1" ] && ok "aba Resumos IA renderiza a lista" || bad "lista não renderizou"

echo "=== [E] O RELÓGIO MANDA: mocks D-2 / D-1 / D-0 / D-8 / pós-prova ==="
echo "  $(mock_date '2026-09-29T10:00:00')"; poke; sleep 1
E1=$(has 'É hoje: Simulado da Av1')
[ "$E1" = "1" ] && ok "D-2: 'É hoje: Simulado da Av1'" || bad "D-2 errado"
E1L=$(has 'a teoria abre só para conferir o que travou')
[ "$E1L" = "1" ] && ok "D-2 linha de conferência (ensaio é no Praticar)" || bad "linha D-2 errada"
echo "  $(mock_date '2026-09-30T10:00:00')"; poke; sleep 1
E2=$(has 'Véspera da prova')
E2L=$(has 'a folha e o kit mandam hoje')
[ "$E2" = "1" ] && [ "$E2L" = "1" ] && ok "D-1: véspera — folha e kit mandam" || bad "D-1 errado"
echo "  $(mock_date '2026-10-01T08:00:00')"; poke; sleep 1
E3=$(has 'É hoje: Prova da Av1')
E3L=$(has 'só reler e respirar')
[ "$E3" = "1" ] && [ "$E3L" = "1" ] && ok "D-0: calma — 'só reler e respirar'" || bad "D-0 errado"
echo "  $(mock_date '2026-09-23T10:00:00')"; poke; sleep 1
E4=$(has 'Semana da Av1')
[ "$E4" = "0" ] && ok "D-8: fora da janela → faixa cala (silêncio honesto)" || bad "faixa apareceu fora da janela"
echo "  $(mock_date '2026-10-03T10:00:00')"; poke; sleep 1
E5=$(has 'escopo lido')
[ "$E5" = "0" ] && ok "pós-prova: silêncio (regra da fila da 88)" || bad "faixa viva depois da prova"

echo "=== [F] MOBILE 390: sem overflow ==="
mock_date '2026-09-27T10:00:00' >/dev/null; poke; sleep 1
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'ovf='+(d.scrollWidth>d.clientWidth?1:0)})()" 2>/dev/null | tr -d '"')
echo "  $OVF"
case "$OVF" in *ovf=0*) ok "mobile 390: faixa quebra linha limpa, sem overflow";; *) bad "mobile com overflow";; esac
agent-browser screenshot scripts/qa98-biblioteca-mobile390.png >/dev/null 2>&1

echo "=== [G] HIGIENE: restore do progresso real, poke 0, console limpo ==="
agent-browser set viewport 1440 900 >/dev/null 2>&1
H=$(agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');var orig=JSON.parse(localStorage.getItem('__qa98_cm')||'[]');if(orig.length>0)p.completedMaterials=orig;else delete p.completedMaterials;delete p.__poke;localStorage.removeItem('__qa98_cm');var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'cm='+(p.completedMaterials?p.completedMaterials.length:0)+' poke='+(p.__poke===undefined?0:1)})()" 2>/dev/null | tr -d '"')
echo "  storage: $H"
case "$H" in *poke=0*) ok "poke limpo, completedMaterials restaurado";; *) bad "higiene falhou: $H";; esac
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' cm='+(p.completedMaterials?p.completedMaterials.length:0)+' qa='+(localStorage.getItem('__qa98_cm')===null?0:1)})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *qa=0*) ok "backup removido";; *) bad "backup residencial: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t98"; else echo ""; echo "FAILURES — t98"; exit 1; fi
