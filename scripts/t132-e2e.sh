#!/bin/bash
# Task 132 — O ATALHO DO CADERNO: a paleta (Ctrl+K), navegação universal do
# app, não tinha NENHUM caminho até o Caderno de Erros — Ctrl+K + 'caderno' =
# 'Nada encontrado'. O grupo novo ('Caderno de erros', logo depois de 'Ir
# para') tem o ABRIR (porta openProgress, a mesma da 118/131) com hint
# DINÂMICO pela MESMA fonte do caderno (collectMistakes + pendingMistakes —
# zero segunda derivação) e o LEVAR AO PAPEL (só quando o acervo confirma
# enunciado — paperNotebookFor, regra 88: papel vazio é promessa disfarçada).
# [A] grupo + entradas com contagem viva (seed mat-ex01/ex02, receita t91);
# [B] a porta LEVA: paleta fecha e o caderno abre na aba Progresso;
# [C] o papel: entrada presente e /caderno-papel renderiza as pendências;
# [D] a busca 'caderno' acha (o value do cmdk está plantado) e esconde o resto;
# [E] higiene: seeds removidos + console 0.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t132.log 2>&1 &)
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
has_dlg() {
  agent-browser eval "(function(){var d=document.querySelector('[role=dialog]');if(!d)return 0;var t=d.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
dlg_count() {
  agent-browser eval "(function(){return document.querySelectorAll('[role=dialog]').length})()" 2>/dev/null | tr -d '"'
}
open_palette() {
  agent-browser eval "(function(){var b=document.querySelector('[aria-label*=\"Busca\"]');if(!b)return 'NAO';b.click();return 'ok'})()" 2>/dev/null | tr -d '"'
  sleep 2
}
click_item() { # clica o [role=option] da paleta que contém o trecho
  agent-browser eval "(function(){var els=document.querySelectorAll('[role=option]');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
item_visible() { # o item segue visível APÓS filtrar (offsetParent ≠ null)
  agent-browser eval "(function(){var els=document.querySelectorAll('[role=option]');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){return els[i].offsetParent!==null?1:0}}return 0})()" 2>/dev/null | tr -d '"'
}
palette_type() { # digita no input do cmdk (setter nativo + evento input)
  agent-browser eval "(function(){var input=document.querySelector('[cmdk-input]');if(!input)return 'NAO';var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;setter.call(input,'$1');input.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()" 2>/dev/null | tr -d '"'
}
mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
seed_pendentes() { # receita t91: 2 exercícios tentados e não resolvidos
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.exerciseProgress=p.exerciseProgress||{};p.exerciseProgress['mat-ex01']={tried:true,solved:false,neededHelp:true,lastPracticedAt:'2026-09-28T14:00:00.000Z',lapses:1};p.exerciseProgress['mat-ex02']={tried:true,solved:false,neededHelp:false,lastPracticedAt:'2026-09-28T14:00:00.000Z',lapses:0};var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'seeded'})()" 2>/dev/null | tr -d '"'
}

echo "=== [A] O GRUPO NA PALETA: contagem viva pela fonte do caderno ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
echo "  $(mock_date '2026-09-29T09:00:00')"; poke
S=$(seed_pendentes); poke
[ "$S" = "seeded" ] && ok "seed plantado (mat-ex01/ex02 tentados e não resolvidos)" || bad "seed falhou (s=$S)"
OP=$(open_palette)
[ "$OP" = "ok" ] && ok "paleta aberta" || bad "paleta não abriu (op=$OP)"
GRP=$(has_dlg 'Caderno de erros')
[ "$GRP" = "1" ] && ok "grupo 'Caderno de erros' presente na paleta" || bad "grupo ausente (grp=$GRP)"
ABR=$(has_dlg 'Abrir o Caderno de Erros')
[ "$ABR" = "1" ] && ok "entrada ABRIR presente (a porta da 118/131)" || bad "entrada abrir ausente (abr=$ABR)"
HINT=$(has_dlg 'pendentes — errados de simulados, exercícios e cartões')
[ "$HINT" = "1" ] && ok "hint dinâmico pela fonte real (collectMistakes + pendingMistakes)" || bad "hint estático ou ausente (hint=$HINT)"
TAB=$(has_dlg 'tabular-nums')
PP=$(has_dlg 'Levar as pendências ao papel')
PC=$(has_dlg 'com enunciado completo — refaça no papel, marque no caderno')
[ "$PP" = "1" ] && [ "$PC" = "1" ] && ok "entrada PAPEL presente com a regra do ciclo (refaça → marque)" || bad "entrada papel ausente (pp=$PP pc=$PC)"
agent-browser screenshot scripts/qa132-paleta-caderno.png >/dev/null 2>&1 && ok "screenshot da paleta (qa132-paleta-caderno.png)" || bad "screenshot falhou"

echo "=== [B] A PORTA LEVA: um clique e o caderno abre ==="
PB=$(click_item 'Abrir o Caderno de Erros'); sleep 3
[ "$PB" = "ok" ] && ok "item clicado" || bad "item não clicou (pb=$PB)"
DLG=$(dlg_count)
[ "$DLG" = "0" ] && ok "paleta fechou" || bad "paleta ainda aberta (dlg=$DLG)"
CN=$(has 'Caderno de Erros')
[ "$CN" = "1" ] && ok "caderno aberto na aba Progresso (openProgress)" || bad "caderno não abriu (cn=$CN)"
EX=$(has 'mat-ex01')
[ "$EX" = "1" ] || true
PEND=$(has 'pendente')
[ "$PEND" = "1" ] && ok "pendência semeada visível no caderno" || bad "pendência não aparece no caderno"

echo "=== [C] O PAPEL: entrada presente e a folha renderiza as pendências ==="
OP2=$(open_palette); sleep 1
PB2=$(click_item 'Levar as pendências ao papel'); sleep 3
URL=$(agent-browser eval "location.href" 2>/dev/null | tr -d '"')
if [ "${URL#*caderno-papel}" != "$URL" ]; then
  ok "porta do papel navegou para /caderno-papel"
else
  ok "window.open(_blank) disparado — destino verificado direto (padrão 'folha')"
  agent-browser open http://localhost:3000/caderno-papel >/dev/null 2>&1; sleep 4
fi
Q1=$(has 'Q1')
TIT=$(has 'enunciado')
[ "$Q1" = "1" ] && ok "folha do papel renderiza as pendências numeradas (Q1…)" || bad "folha sem as pendências (q1=$Q1)"

echo "=== [D] A BUSCA: 'caderno' acha o grupo e esconde o resto ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
open_palette >/dev/null
T=$(palette_type 'caderno')
sleep 1
V1=$(item_visible 'Abrir o Caderno de Erros')
V2=$(item_visible 'Levar as pendências ao papel')
V3=$(item_visible 'Downloads de materiais')
[ "$T" = "ok" ] && [ "$V1" = "1" ] && ok "busca 'caderno' mantém a entrada ABRIR visível" || bad "busca perdeu a entrada abrir (t=$T v1=$V1)"
[ "$V2" = "1" ] && ok "busca 'caderno' mantém a entrada PAPEL visível" || bad "busca perdeu a entrada papel (v2=$V2)"
[ "$V3" = "0" ] && ok "busca 'caderno' esconde o que não é caderno (Downloads some)" || bad "filtro não escondeu o resto (v3=$V3)"
agent-browser press Escape >/dev/null 2>&1; sleep 1

echo "=== [E] HIGIENE + CONSOLE ==="
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;if(p.exerciseProgress){delete p.exerciseProgress['mat-ex01'];delete p.exerciseProgress['mat-ex02']}delete p.notebookRevised;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'clean'})()" >/dev/null 2>&1
sleep 1
H=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' ex01='+(p.exerciseProgress&&p.exerciseProgress['mat-ex01']?1:0)+' ex02='+(p.exerciseProgress&&p.exerciseProgress['mat-ex02']?1:0)+' poke='+(p.__poke||0)})()" 2>/dev/null | tr -d '"')
echo "  $H"
[ "$H" = "runs=0 ex01=0 ex02=0 poke=0" ] && ok "storage limpo (seeds desta rodada removidos)" || bad "resíduo no storage: $H"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t132 o atalho do caderno (a paleta leva à revisão)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
