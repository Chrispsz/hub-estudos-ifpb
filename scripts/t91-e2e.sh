#!/bin/bash
# Task 91 — E2E do Caderno de Erros lendo a semana da Av1 (faixa NotebookExamStrip)
# Padrões provados (t88/t89/t90): textContent SEM aspas (escapes do CLI matam case),
# mousedown em Radix tabs, poke __poke = re-render com relógio mockado sem navegação,
# mock via class extends Date com eco dentro da página, navegação = máquina de estados.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t91.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

on_notebook() {
  agent-browser eval "(function(){var t=document.body.textContent;return 'nb='+(t.indexOf('Caderno de Erros')>=0?'yes':'no')})()" 2>/dev/null | tr -d '"'
}
goto_progresso() {
  for try in 1 2 3; do
    # reset: aba primária Estudar remonta o shell (lição 89 — re-click cego togglA)
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(on_notebook)" = "nb=yes" ] && return 0
    # fallback: Progresso pode estar dentro do submenu 'Mais'
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(on_notebook)" = "nb=yes" ] && return 0
  done
  return 1
}
flags() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return ['hoje='+(t.indexOf('É hoje: Simulado da Av1')>=0?1:0),'feito='+(t.indexOf('Simulado da Av1 feito ✓')>=0?1:0),'p60='+(t.indexOf('feito ✓ — 60%')>=0?1:0),'vesp='+(t.indexOf('Véspera da Av1 — o dia do papel')>=0?1:0),'n6='+(t.indexOf('6 questões de Matemática pendentes')>=0?1:0),'prova='+(t.indexOf('É hoje: Prova da Av1')>=0?1:0),'frescas='+(t.indexOf('Ver as frescas')>=0?1:0),'abrir='+(t.indexOf('Abrir o simulado')>=0?1:0)].join('|')})()" 2>/dev/null | tr -d '"'
}
has() { # $1=trecho
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
ctas() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var out=[];for(var i=0;i<els.length;i++){var s=els[i].textContent.replace(/\s+/g,' ').trim();if(s.indexOf('Ver as frescas')>=0||s.indexOf('Abrir o simulado')>=0){out.push((els[i].disabled?'OFF':'ON')+':'+s)}}return out.join('|')||'NO-CTA'})()" 2>/dev/null | tr -d '"'
}
strip_class() { # $1=trecho do texto · $2=classe esperada
  agent-browser eval "(function(){var els=document.querySelectorAll('div');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0&&els[i].textContent.length<460)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
mock_date() { # padrão provado (class extends Date) + eco DENTRO da página
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
# 2 erros de exercício reais do acervo (mat-ex01/02, TEC.1984) — caderno não-vazio.
# lastPracticedAt FIXO às 10:00Z de 29/09: dentro da janela 48h do mock
# (15:30Z) — o browser roda em UTC (lição desta rodada: TZ real ≠ TZ do dono).
seed_ex() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.exerciseProgress=p.exerciseProgress||{};p.exerciseProgress['mat-ex01']={tried:true,solved:false,neededHelp:true,lastPracticedAt:'2026-09-29T10:00:00.000Z',lapses:1};p.exerciseProgress['mat-ex02']={tried:true,solved:false,neededHelp:false,marked:true,lastPracticedAt:'2026-09-29T10:00:00.000Z',lapses:0};var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
  sleep 1
}
# run oficial COM detalhe por questão (3 missed + 1 skipped, sem enunciado —
# viram linhas noStatement no caderno) — é o seed que o t88/t90 NÃO tinha
seed_run() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=[{id:'qa91-of',date:'2026-09-29T15:30:00',mode:'prova',total:10,solved:6,missed:3,skipped:1,durationSec:1800,filters:{discipline:'TEC.1984'},questions:[{disciplineCode:'TEC.1984',status:'missed'},{disciplineCode:'TEC.1984',status:'missed'},{disciplineCode:'TEC.1984',status:'missed'},{disciplineCode:'TEC.1984',status:'skipped'}]}];var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
  sleep 1
}
del_run() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [A] DATA REAL (dom 27/09, D-4): silêncio honesto ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
FIBER=$(agent-browser eval "(function(){var m=document.querySelector('main')||document.body;var k=Object.keys(m);for(var i=0;i<k.length;i++){if(k[i].startsWith('__reactFiber'))return 'fiber:true'}return 'fiber:MISSING'})()" 2>/dev/null | tr -d '"')
echo "hydration: $FIBER"
[ "$FIBER" = "fiber:true" ] || bad "sem fiber — abortar"
seed_ex
if goto_progresso; then ok "navegação: Progresso aberta (Caderno de Erros visível)"; else bad "não cheguei no Progresso — abortar"; FAIL=1; fi
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=0*feito=0*vesp=0*prova=0*frescas=0*abrir=0*) ok "data real: nenhuma faixa (fora da janela — silêncio honesto)";; *) bad "data real: faixa presente: $F";; esac
[ "$(has '2 itens')" = "1" ] && ok "caderno não-vazio com os 2 erros semeados (badge rose)" || bad "badge '2 itens' ausente: $(has '2 itens')"

echo "=== [B] MOCK 29/09 + poke: 'É hoje: Simulado da Av1' + CTA ==="
M=$(mock_date "2026-09-29T15:30:00"); echo "  $M"
[ "$M" = "mock=2026-9-29" ] && ok "date mock confirmado pela página" || bad "mock não confirmado: '$M'"
poke
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=1*feito=0*abrir=1*) ok "29/09 sem run: 'É hoje: Simulado da Av1' + 'Abrir o simulado'";; *) bad "estado simulado-hoje: $F";; esac
[ "$(strip_class 'É hoje: Simulado da Av1' 'shadow-amber-500/30')" = "1" ] && ok "sólido âmbar com glow (é-hoje)" || bad "classe sólida âmbar ausente"
C=$(ctas); echo "  ctas: $C"
case "$C" in *ON:Abrir*simulado*) ok "CTA 'Abrir o simulado' habilitado";; *) bad "CTA abrir esperado: $C";; esac
agent-browser screenshot scripts/qa91-notebook-hoje-dark.png >/dev/null 2>&1 || true

echo "=== [C] Run oficial semeado (com 4 questões): flipa 'feito ✓ — 60%' ==="
seed_run
F=$(flags); echo "  flags: $F"
# Lição 129 — o contrato do hoje evoluiu: o card 'O que estudar hoje' (na
# página Progresso) MANTÉM o título 'É hoje: Simulado da Av1' com o run e
# ganha o chip do veredito (today-study-card: o dia é hoje; o registro vence
# o relógio) — hoje=1 É a voz certa; o strip do caderno é que flipa 'feito ✓'.
case "$F" in *hoje=1*feito=1*p60=1*) ok "com run: card mantém 'É hoje' + chip 60%, caderno flipa 'feito ✓'";; *) bad "estado feito esperado: $F";; esac
[ "$(strip_class 'Simulado da Av1 feito' 'bg-emerald-600')" = "1" ] && ok "sólido emerald sem pulso" || bad "classe emerald ausente"
C=$(ctas); echo "  ctas: $C"
case "$C" in *ON:Ver*"(6)"*) ok "CTA 'Ver as frescas (6)' com a contagem da janela 48h";; *) bad "CTA frescas (6) esperado: $C";; esac
# clique no CTA → janela 48h ativa na própria lista (chip '48 h' — COM espaço)
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Ver as frescas')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
W=$(agent-browser eval "(function(){var btns=document.querySelectorAll('button[aria-pressed]');var out=[];for(var i=0;i<btns.length;i++){if(btns[i].getAttribute('aria-pressed')==='true'&&btns[i].textContent.indexOf('48 h')>=0)out.push('48h-ativa')}return out.join('|')||'nenhum'})()" 2>/dev/null | tr -d '"')
echo "  chip: $W"
[ "$W" = "48h-ativa" ] && ok "clique filtrou a janela 48h (aria-pressed)" || bad "janela 48h não ativou: $W"

echo "=== [D] MOCK 30/09 + poke: véspera, o dia do papel (6 pendentes) ==="
mock_date "2026-09-30T10:00:00" >/dev/null 2>&1
poke
F=$(flags); echo "  flags: $F"
case "$F" in *feito=0*vesp=1*n6=1*) ok "véspera: 'o dia do papel' + '6 questões de Matemática pendentes'";; *) bad "véspera esperada: $F";; esac
[ "$(strip_class 'Véspera da Av1' 'bg-amber-500/[0.07]')" = "1" ] && ok "tinta translúcida âmbar (espera)" || bad "classe tinted ausente"
C=$(ctas); echo "  ctas: $C"
[ "$C" = "NO-CTA" ] && ok "véspera: sem botão — a ação é no papel (honesto)" || bad "véspera devia ser sem CTA: $C"

echo "=== [E] MOCK 01/10 + poke: prova rose, calma ==="
mock_date "2026-10-01T08:00:00" >/dev/null 2>&1
poke
F=$(flags); echo "  flags: $F"
case "$F" in *vesp=0*prova=1*) ok "01/10: 'É hoje: Prova da Av1'";; *) bad "prova-hoje esperada: $F";; esac
[ "$(strip_class 'É hoje: Prova da Av1' 'shadow-rose-500/30')" = "1" ] && ok "sólido rose com glow" || bad "classe rose ausente"
C=$(ctas); echo "  ctas: $C"
[ "$C" = "NO-CTA" ] && ok "prova: sem botão — revisão leve, nada novo" || bad "prova devia ser sem CTA: $C"

echo "=== [F] ESTILO: caderno todo revisado → badge emerald + chip 'em dia' ==="
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.notebookRevised={'ex:mat-ex01':'2026-10-01T08:30:00.000Z','ex:mat-ex02':'2026-10-01T08:30:00.000Z','qa91-of:0':'2026-10-01T08:30:00.000Z','qa91-of:1':'2026-10-01T08:30:00.000Z','qa91-of:2':'2026-10-01T08:30:00.000Z','qa91-of:3':'2026-10-01T08:30:00.000Z'};var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
sleep 1
poke
EM=$(agent-browser eval "(function(){var els=document.querySelectorAll('span');var chips=0;for(var i=0;i<els.length;i++){if(els[i].textContent.replace(/\s+/g,' ').trim()==='em dia')chips++}var badge=0;var sps=document.querySelectorAll('span,div');for(var j=0;j<sps.length;j++){var c=sps[j].className;if(typeof c==='string'&&c.indexOf('border-emerald-200')>=0&&sps[j].textContent.indexOf('itens')>=0&&sps[j].textContent.length<30)badge++}return 'emdia='+chips+' badge-emerald='+badge})()" 2>/dev/null | tr -d '"')
echo "  $EM"
case "$EM" in *emdia=1*badge-emerald=1*) ok "grupo 'em dia' + badge flipa emerald (cor = significado)";; *) bad "estilo de caderno zerado: $EM";; esac
agent-browser screenshot scripts/qa91-notebook-prova-dark.png >/dev/null 2>&1 || true

echo "=== [G] Mobile 390 (véspera): faixa empilha, sem overflow ==="
mock_date "2026-09-30T10:00:00" >/dev/null 2>&1
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.notebookRevised;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
poke
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 3
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'iw='+window.innerWidth+' cw='+d.clientWidth+' ovf='+(d.scrollWidth>d.clientWidth)})()" 2>/dev/null)
echo "  $OVF"
echo "$OVF" | grep -qF 'ovf=false' && ok "mobile 390: zero overflow" || bad "mobile: OVERFLOW ($OVF)"
agent-browser screenshot scripts/qa91-notebook-vespera-mobile390.png >/dev/null 2>&1 || true
agent-browser set viewport 1440 900 >/dev/null 2>&1

echo "=== [H] HIGIENE: semeados fora + reload + estado zero ==="
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.exerciseProgress['mat-ex01'];delete p.exerciseProgress['mat-ex02'];delete p.notebookRevised;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
H=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' ex01='+(p.exerciseProgress&&p.exerciseProgress['mat-ex01']?1:0)+' ex02='+(p.exerciseProgress&&p.exerciseProgress['mat-ex02']?1:0)+' rev='+(p.notebookRevised===undefined?0:Object.keys(p.notebookRevised).length)+' poke='+(p.__poke===undefined?0:1)})()" 2>/dev/null | tr -d '"')
echo "  $H"
case "$H" in *runs=0*ex01=0*ex02=0*"rev=0"*) ok "storage limpo: 0 runs · exercícios restaurados · revisados fora";; *) bad "higiene: $H";; esac
if goto_progresso; then ok "navegação final OK"; else bad "navegação final falhou"; fi
V=$(has 'Nada aqui por agora'); F=$(flags)
echo "  vazio=$V flags=$F"
[ "$V" = "1" ] && ok "caderno voltou ao vazio honesto (estado inicial)" || bad "caderno não voltou ao vazio"
case "$F" in *hoje=0*vesp=0*prova=0*) ok "data real restaurada: mock morto no reload, faixa some";; *) bad "faixa presente na data real pós-reload: $F";; esac

echo "=== [I] Console ==="
CON=$(agent-browser console 2>/dev/null | grep -iE "error|warn" | grep -viE "Download the React DevTools|hydration|fast-refresh" | head -5)
if [ -z "$CON" ]; then ok "console: 0 erros de app"; else bad "console: $CON"; fi

echo ""
[ $FAIL -eq 0 ] && echo "T91-E2E: ALL GREEN" || echo "T91-E2E: FALHAS ACIMA"
exit $FAIL
