#!/bin/bash
# Task 104 — O RESUMO DO MATERIAL ABRE O PALCO (o reverso da 94): o dialog de
# resumo IA ganha a ponte teoria→prática ('Praticar (N)' → openPractice
# {linkedMaterial} → o conjunto exato no Praticar, chip violeta da 94) e o
# chip 'escopo Av1' com o veredito curto do dia (fonte da 98, janela D-7→D-0,
# regra da 88). Padrões provados (t88–t103): Radix Tabs só com click NATIVO
# (lição 98), asserção de dialog ESCOPADA em [role=dialog] (lição 100.2),
# mock de relógio + reopen = render fresco, nav por prefixo 'Biblioteca'
# (lição 100.3: count colado no textContent).
set -u
cd /home/z/my-project

FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t104.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

dlg_json() { # fragmentos ESCOPADOS no [role=dialog] do resumo (lição 100.2)
  agent-browser eval "(function(){var d=document.querySelectorAll('[role=dialog]');var dlg=null;for(var i=0;i<d.length;i++){if((d[i].textContent||'').indexOf('Resumo gerado por IA')>=0){dlg=d[i];break}}if(!dlg)return '{\"dlg-nao\":1}';var t=(dlg.textContent||'').toLowerCase().replace(/\s+/g,' ');var out={};var list='$1'.split('|');for(var j=0;j<list.length;j++){var f=list[j].toLowerCase();out[f]=t.indexOf(f)>=0?1:0}return JSON.stringify(out)})()" 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin) or "{}")'
}
low() { python3 -c "import sys;print(sys.stdin.read().strip().lower())" <<< "$1"; }
dlg_has()   { dlg_json "$1" | grep -q "\"$(low "$1")\":1"; }
dlg_hasnt() { dlg_json "$1" | grep -q "\"$(low "$1")\":0"; }

page_has() { # texto na página inteira (lowercase) — com retry de mount
  local want got
  want=$(printf '%s' "$1" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().lower()))')
  for i in 1 2 3 4; do
    got=$(agent-browser eval "(function(){var t=document.body.textContent.toLowerCase().replace(/\s+/g,' ');return (t.indexOf($want)>=0?1:0)})()" 2>/dev/null | tr -d '"')
    [ "$got" = "1" ] && return 0
    sleep 2
  done
  return 1
}

go_library_rows() { # Biblioteca com linhas visíveis (retry — timing do Radix Tabs)
  for i in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t.indexOf('Biblioteca')===0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    agent-browser click "[role=tab]:nth-of-type(2)" >/dev/null 2>&1
    sleep 2
    # (lição desta rodada) storage limpo → sub-tab 'Recentes' = 0 e vira estado
    # vazio — os 52 moram no sub-tab 'Todos' (3º tab: o topo só tem 2)
    agent-browser click "[role=tab]:nth-of-type(3)" >/dev/null 2>&1
    sleep 2
    local has_row
    has_row=$(agent-browser eval "(function(){var lis=document.querySelectorAll('li');for(var i=0;i<lis.length;i++){var bs=lis[i].querySelectorAll('button');for(var j=0;j<bs.length;j++){if((bs[j].textContent||'').indexOf('Resumo IA')>=0)return 1}}return 0})()" 2>/dev/null | tr -d '"')
    [ "$has_row" = "1" ] && return 0
  done
  return 1
}

mock_date() {
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}

poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}

open_mat_dialog() { # li mais CURTA que casa o título (innermost) → botão 'Resumo IA'
  agent-browser eval "(function(){var lis=document.querySelectorAll('li');var best=null;for(var i=0;i<lis.length;i++){var t=lis[i].textContent||'';if(t.indexOf('$1')>=0){if(best===null||t.length<best.length)best=lis[i]}}if(!best)return 'NAO';var bs=best.querySelectorAll('button');for(var j=0;j<bs.length;j++){if((bs[j].textContent||'').indexOf('Resumo IA')>=0){bs[j].click();return 'ok'}}return 'SEM-BOTAO'})()" 2>/dev/null | tr -d '"'
}

close_dlg() { agent-browser key Escape >/dev/null 2>&1; sleep 1; }

snap_accessed() { # markAccessed escreve accessedMaterials — snapshot p/ restaurar
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__qa104_acc=JSON.stringify(p.accessedMaterials||[]);return 'snap'})()" >/dev/null 2>&1
}
restore_accessed() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');if(p.__qa104_acc!==undefined){p.accessedMaterials=JSON.parse(p.__qa104_acc);delete p.__qa104_acc}var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'restaurado'})()" 2>/dev/null | tr -d '"'
}

echo "=== [PREP] storage limpo + Biblioteca → Resumos IA → Todos ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
snap_accessed
if go_library_rows; then ok "Biblioteca com linhas Resumo IA visíveis"; else bad "Biblioteca não abriu"; fi

echo "=== [A] DATA REAL (D-4): dialog do material do ESCOPO — chip + ponte ==="
echo "  open: $(open_mat_dialog 'Matrizes — Aula 00')"
sleep 2
dlg_json 'resumo gerado por ia' | grep -q '"resumo gerado por ia":1' && ok "dialog do resumo aberto" || { bad "dialog não abriu"; }
dlg_has 'escopo av1' && ok "chip 'escopo Av1' no dialog (fonte da 98)" || bad "chip de escopo ausente"
dlg_has 'faltam 4 dias' && ok "veredito curto 'faltam 4 dias' (D-4)" || bad "veredito do chip errado"
dlg_has 'praticar (4)' && ok "ponte 'Praticar (4)' presente (4 questões ligadas)" || bad "botão Praticar ausente/contagem errada"
agent-browser screenshot scripts/qa104-dialog-desktop.png >/dev/null 2>&1
[ -s scripts/qa104-dialog-desktop.png ] && ok "screenshot desktop (qa104-dialog-desktop.png)" || bad "screenshot falhou"

echo "=== [B] CLIQUE NA PONTE → Praticar com o conjunto exato (94) ==="
agent-browser eval "(function(){var d=document.querySelectorAll('[role=dialog]');for(var i=0;i<d.length;i++){if((d[i].textContent||'').indexOf('Resumo gerado por IA')>=0){var bs=d[i].querySelectorAll('button');for(var j=0;j<bs.length;j++){if((bs[j].textContent||'').indexOf('Praticar (')>=0){bs[j].click();return 'ok'}}}}return 'NAO'})()" >/dev/null 2>&1
sleep 3
CJ=0
page_has 'conjunto:' && CJ=1
[ "$CJ" = "1" ] && ok "chip 'Conjunto:' vivo no Praticar" || bad "conjunto não chegou ao Praticar"
CM=0
page_has 'aula 00' && CM=1
[ "$CM" = "1" ] && ok "chip nomeia o material exato (Aula 00)" || bad "material errado no chip"
CN=$(agent-browser eval "(function(){var els=document.querySelectorAll('div');for(var i=0;i<els.length;i++){var t=els[i].textContent||'';if(t.indexOf('Conjunto:')===0){var m=t.match(/(\d+)\s*$/);return m?m[1]:'sem-num'}}return 'sem-chip'})()" 2>/dev/null | tr -d '"')
# 4 ligadas − 1 gated (mat-ex05, Determinantes é pós-prova) = 3 no palco
[ "$CN" = "3" ] && ok "contagem do conjunto = 3 (4 ligadas − 1 gated, honesta)" || bad "contagem do conjunto errada: $CN"

echo "=== [C] MATERIAL SEM EXERCÍCIOS LIGADOS: ponte honestamente ausente ==="
if go_library_rows; then ok "Biblioteca de volta"; else bad "Biblioteca não voltou"; fi
echo "  open: $(open_mat_dialog 'Plano de Disciplina - Matemática')"
sleep 2
dlg_json 'resumo gerado por ia' | grep -q '"resumo gerado por ia":1' && ok "dialog da ementa aberto" || bad "dialog da ementa não abriu"
dlg_hasnt 'praticar (' && ok "SEM ponte onde não há exercícios (nada inventado)" || bad "botão Praticar inventado na ementa"
dlg_hasnt 'escopo av1' && ok "ementa fora do escopo (chip só nos 4 da Av1)" || bad "chip de escopo vazou para a ementa"
close_dlg

echo "=== [D] MOCK 03/10 (pós-prova): chip cala (regra da 88), ponte fica ==="
echo "  mock: $(mock_date 2026-10-03)"
echo "  open: $(open_mat_dialog 'Matrizes — Aula 00')"
sleep 2
dlg_has 'praticar (4)' && ok "ponte existe pós-prova (não é coisa da semana)" || bad "ponte sumiu pós-prova"
dlg_hasnt 'escopo av1' && ok "chip do escopo silencioso pós-prova" || bad "chip sobreviveu pós-prova"
close_dlg

echo "=== [E] MOCK 29/09 (D-2): chip fala a língua do dia ('ensaio hoje') ==="
echo "  mock: $(mock_date 2026-09-29)"
echo "  open: $(open_mat_dialog 'Matrizes — Aula 00')"
sleep 2
dlg_has 'ensaio hoje' && ok "chip 'ensaio hoje' no dia do simulado" || bad "veredito do D-2 errado"
close_dlg

echo "=== [F] MOBILE 390: dialog e ponte sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 1
echo "  open: $(open_mat_dialog 'Matrizes — Aula 00')"
sleep 2
dlg_has 'praticar (4)' && ok "ponte presente no mobile" || bad "ponte sumiu no mobile"
OF=$(agent-browser eval "(function(){return 'iw='+window.innerWidth+'sw='+document.documentElement.scrollWidth})()" 2>/dev/null | tr -d '"')
echo "  $OF"
case "$OF" in *iw=390*sw=390*|*iw=390*sw=39[01]*) ok "mobile 390 sem overflow";; *) bad "overflow no mobile: $OF";; esac
agent-browser screenshot scripts/qa104-dialog-mobile390.png >/dev/null 2>&1
[ -s scripts/qa104-dialog-mobile390.png ] && ok "screenshot mobile (qa104-dialog-mobile390.png)" || bad "screenshot mobile falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1

echo "=== [G] HIGIENE + CONSOLE (reload mata o mock, accessed restaurado) ==="
echo "  restore: $(restore_accessed)"
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)+' backup='+(p.__qa104_acc===undefined?'removido':'FICOU')})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*backup=removido*) ok "storage limpo";; *) bad "storage sujo: $S";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t104 e2e"; else echo ""; echo "FAILURES — t104 e2e"; exit 1; fi
