#!/bin/bash
# Task 92 — E2E do PRATICAR lendo a semana da Av1 (faixa PracticeExamStrip no topo
# da aba Exercícios + ação do dia nos botões). Padrões provados (t88–t91):
# textContent SEM aspas (escapes do CLI matam case), mousedown em Radix tabs,
# poke __poke = re-render com relógio mockado sem navegação, mock via class
# extends Date com eco dentro da página, navegação = máquina de estados,
# browser sandbox em UTC (seeds com data absoluta dentro da janela).
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t92.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

on_praticar() { # a aba Exercícios tem o botão Simulado Pro + banner da turma
  agent-browser eval "(function(){var t=document.body.textContent;return 'pr='+(t.indexOf('Simulado Pro')>=0&&t.indexOf('No ritmo da turma')>=0?'yes':'no')})()" 2>/dev/null | tr -d '"'
}
goto_praticar() { # máquina de estados: JÁ estar em Praticar NÃO re-clica (lição 90)
  [ "$(on_praticar)" = "pr=yes" ] && return 0
  for try in 1 2 3; do
    # reset pelo Estudar remonta o shell (lição 89)
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Praticar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(on_praticar)" = "pr=yes" ] && return 0
  done
  return 1
}
flags() { # fragmentos ÚNICOS da faixa do Praticar (não colidem com caderno/flashcards)
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return ['hoje='+(t.indexOf('Matrizes e Lógica, 60 min')>=0?1:0),'feito='+(t.indexOf('fila guiada desta aba')>=0?1:0),'p60='+(t.indexOf('feito ✓ — 60%')>=0?1:0),'vesp='+(t.indexOf('Véspera da Av1 — revisão leve')>=0?1:0),'prova='+(t.indexOf('kit em mãos e confiança')>=0?1:0),'abrirS='+(t.indexOf('Abrir o Simulado')>=0?1:0),'rg2='+(t.indexOf('Revisão guiada (2)')>=0?1:0)].join('|')})()" 2>/dev/null | tr -d '"'
}
has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
strip_class() { # $1=trecho único da faixa · $2=classe esperada
  agent-browser eval "(function(){var els=document.querySelectorAll('div');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0&&els[i].textContent.length<460)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
strip_icon_pulse() { # o pulso mora no SPAN do ícone (descendente), não no shell
  agent-browser eval "(function(){var els=document.querySelectorAll('div');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('shadow-amber-500/30')>=0&&els[i].textContent.indexOf('Matrizes e Lógica, 60 min')>=0&&els[i].innerHTML.indexOf('animate-pulse')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
btn_has_class() { # $1=trecho do texto do botão · $2=classe esperada
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
dialog_open() {
  agent-browser eval "(function(){return 'dlg='+(document.querySelector('[role=dialog]')?'yes':'no')})()" 2>/dev/null | tr -d '"'
}
click_btn() { # $1=trecho · $2=índice (0 = primeiro)
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){if(n===$2){els[i].click();return 'ok'}n++}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
mock_date() { # padrão provado (class extends Date) + eco DENTRO da página
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
# 2 itens de fila guiada (mat-ex01 neededHelp + mat-ex02 marked) — também deixam
# o caderno não-vazio (valida a COEXISTÊNCIA das faixas na mesma aba).
seed_ex() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.exerciseProgress=p.exerciseProgress||{};p.exerciseProgress['mat-ex01']={tried:true,solved:false,neededHelp:true,lastPracticedAt:'2026-09-29T10:00:00.000Z',lapses:1};p.exerciseProgress['mat-ex02']={tried:true,solved:true,marked:true,lastPracticedAt:'2026-09-29T10:00:00.000Z',lapses:0};var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
  sleep 1
}
# run oficial do dia 29 (prova, 6/10 = 60%) — REGISTRO vence o relógio
seed_run() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];p.simuladoRuns.push({id:'qa92-of',date:'2026-09-29T15:30:00',mode:'prova',total:10,solved:6,missed:3,skipped:1,durationSec:1800,filters:{discipline:'TEC.1984'},questions:[{disciplineCode:'TEC.1984',status:'missed'},{disciplineCode:'TEC.1984',status:'missed'},{disciplineCode:'TEC.1984',status:'missed'},{disciplineCode:'TEC.1984',status:'skipped'}]});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
  sleep 1
}

echo "=== [A] DATA REAL (dom 27/09, D-4): silêncio honesto no topo da aba ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
FIBER=$(agent-browser eval "(function(){var m=document.querySelector('main')||document.body;var k=Object.keys(m);for(var i=0;i<k.length;i++){if(k[i].startsWith('__reactFiber'))return 'fiber:true'}return 'fiber:MISSING'})()" 2>/dev/null | tr -d '"')
echo "hydration: $FIBER"
[ "$FIBER" = "fiber:true" ] || bad "sem fiber — abortar"
if goto_praticar; then ok "navegação: Praticar · Exercícios abertos"; else bad "não cheguei no Praticar — abortar"; FAIL=1; fi
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=0*feito=0*vesp=0*prova=0*abrirS=0*) ok "data real: nenhuma faixa no topo (fora da janela — silêncio honesto)";; *) bad "data real: faixa presente: $F";; esac

echo "=== [B] MOCK 29/09 + seeds + poke: 'É hoje' sólido + CTA + halo no botão ==="
M=$(mock_date "2026-09-29T15:30:00"); echo "  $M"
[ "$M" = "mock=2026-9-29" ] && ok "date mock confirmado pela página" || bad "mock não confirmado: '$M'"
seed_ex
poke
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=1*feito=0*abrirS=1*) ok "29/09 sem run: 'É hoje: Simulado da Av1' + 'Abrir o Simulado'";; *) bad "estado simulado-hoje: $F";; esac
[ "$(strip_class 'Matrizes e Lógica, 60 min' 'shadow-amber-500/30')" = "1" ] && ok "sólido âmbar com glow (é-hoje, gramática da 76/90/91)" || bad "classe sólida âmbar ausente"
[ "$(strip_icon_pulse)" = "1" ] && ok "ícone com pulso (é-hoje)" || bad "pulso ausente"
[ "$(btn_has_class 'Simulado Pro' 'ring-2')" = "1" ] && ok "Simulado Pro com halo âmbar — ação do dia (cor = significado)" || bad "halo do Simulado Pro ausente"
S=$(agent-browser screenshot scripts/qa92-praticar-hoje-dark.png 2>&1 >/dev/null); [ -f scripts/qa92-praticar-hoje-dark.png ] && ok "screenshot dark salvo" || bad "screenshot: $S"
L=$(agent-browser eval "(function(){document.documentElement.classList.remove('dark');return 'light'})()" 2>/dev/null | tr -d '"'); sleep 1
agent-browser screenshot scripts/qa92-praticar-hoje-light.png >/dev/null 2>&1 || true
agent-browser eval "(function(){document.documentElement.classList.add('dark');return 'dark'})()" >/dev/null 2>&1
[ -f scripts/qa92-praticar-hoje-light.png ] && ok "screenshot light salvo" || bad "screenshot light falhou"

echo "=== [C] CTA 'Abrir o Simulado' AO VIVO: setup abre já configurado (82) ==="
click_btn 'Abrir o Simulado' 0 >/dev/null 2>&1
sleep 2
D=$(dialog_open); echo "  $D"
[ "$D" = "dlg=yes" ] && ok "CTA abre o setup do Simulado" || bad "CTA não abriu o setup"
H=$(has 'É hoje o simulado oficial da Av1')
[ "$H" = "1" ] && ok "setup reconhece o dia (banner da 82) — cadeia faixa→preset→setup" || bad "banner do setup ausente: $H"
S3=$(has 'S3')
echo "  s3-mention=$S3"
agent-browser press Escape >/dev/null 2>&1
sleep 1
D=$(dialog_open)
[ "$D" = "dlg=no" ] && ok "setup fechou (Escape) sem registrar nada" || bad "setup não fechou: $D"

echo "=== [D] Run oficial semeado: flipa 'feito ✓ — 60%' + CTA fila guiada ==="
seed_run
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=0*feito=1*p60=1*rg2=1*) ok "com run: 'feito ✓ — 60%' + CTA 'Revisão guiada (2)' (registro vence o relógio)";; *) bad "estado feito esperado: $F";; esac
[ "$(strip_class 'fila guiada desta aba' 'bg-emerald-600')" = "1" ] && ok "sólido emerald sem pulso (registro é calmo)" || bad "classe emerald ausente"
[ "$(btn_has_class 'Simulado Pro' 'ring-2')" = "0" ] && ok "halo calou com o run (feito não é 'hoje')" || bad "halo devia sumir após o run"
click_btn 'Revisão guiada (2)' 0 >/dev/null 2>&1
sleep 2
D=$(dialog_open); echo "  $D"
[ "$D" = "dlg=yes" ] && ok "CTA do 'feito' abre a Revisão guiada (fila ★ + caderno)" || bad "Revisão guiada não abriu"
agent-browser press Escape >/dev/null 2>&1
sleep 1

echo "=== [E] MOCK 30/09 + poke: véspera tinted + Revisão guiada promovida ==="
mock_date "2026-09-30T10:00:00" >/dev/null 2>&1
poke
F=$(flags); echo "  flags: $F"
case "$F" in *feito=0*vesp=1*rg2=1*) ok "véspera: 'revisão leve' + CTA fila guiada (plano offset 1 = revisao)";; *) bad "véspera esperada: $F";; esac
[ "$(strip_class 'Véspera da Av1 — revisão leve' 'bg-amber-500/[0.07]')" = "1" ] && ok "tinta translúcida âmbar (espera)" || bad "classe tinted ausente"
[ "$(btn_has_class 'Revisão guiada' 'shadow-amber-500/25')" = "1" ] && ok "botão Revisão guiada promovido a sólido (ação do dia)" || bad "promoção do botão ausente"
agent-browser screenshot scripts/qa92-praticar-vespera-dark.png >/dev/null 2>&1 || true

echo "=== [F] MOCK 01/10 + poke: prova rose, sem CTA ==="
mock_date "2026-10-01T08:00:00" >/dev/null 2>&1
poke
F=$(flags); echo "  flags: $F"
case "$F" in *vesp=0*prova=1*abrirS=0*rg2=0*) ok "01/10: 'É hoje: Prova da Av1' — sem botão (a ação é fora de casa)";; *) bad "prova-hoje esperada: $F";; esac
[ "$(strip_class 'kit em mãos e confiança' 'shadow-rose-500/30')" = "1" ] && ok "sólido rose com glow" || bad "classe rose ausente"
agent-browser screenshot scripts/qa92-praticar-prova-dark.png >/dev/null 2>&1 || true

echo "=== [G] Mobile 390 (simulado-hoje): faixa empilha, sem overflow ==="
mock_date "2026-09-29T15:30:00" >/dev/null 2>&1
poke
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 3
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'iw='+window.innerWidth+' cw='+d.clientWidth+' ovf='+(d.scrollWidth>d.clientWidth)})()" 2>/dev/null)
echo "  $OVF"
echo "$OVF" | grep -qF 'ovf=false' && ok "mobile 390: zero overflow" || bad "mobile: OVERFLOW ($OVF)"
agent-browser screenshot scripts/qa92-praticar-mobile390.png >/dev/null 2>&1 || true
agent-browser set viewport 1440 900 >/dev/null 2>&1

echo "=== [H] HIGIENE: semeados fora + reload + estado zero ==="
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=(p.simuladoRuns||[]).filter(function(r){return r.id!=='qa92-of'});if(p.simuladoRuns.length===0)delete p.simuladoRuns;delete p.exerciseProgress['mat-ex01'];delete p.exerciseProgress['mat-ex02'];delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
H=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' ex01='+(p.exerciseProgress&&p.exerciseProgress['mat-ex01']?1:0)+' ex02='+(p.exerciseProgress&&p.exerciseProgress['mat-ex02']?1:0)+' poke='+(p.__poke===undefined?0:1)+' realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)})()" 2>/dev/null | tr -d '"')
echo "  $H"
case "$H" in *runs=0*ex01=0*ex02=0*realGrades=0*) ok "storage limpo: 0 runs · exercícios restaurados · realGrades 0 chaves reais";; *) bad "higiene: $H";; esac
if goto_praticar; then ok "navegação final OK"; else bad "navegação final falhou"; fi
F=$(flags); MN=$(has 'Caderno de Erros')
echo "  mini-caderno=$MN flags=$F"
[ "$MN" = "0" ] && ok "mini-caderno da aba sumiu com os erros (null honesto do estado vazio)" || bad "mini-caderno ainda presente"
case "$F" in *hoje=0*feito=0*vesp=0*prova=0*) ok "data real restaurada: mock morto no reload, faixa some";; *) bad "faixa presente na data real pós-reload: $F";; esac

echo "=== [I] Console ==="
CON=$(agent-browser console 2>/dev/null | grep -iE "error|warn" | grep -viE "Download the React DevTools|hydration|fast-refresh" | head -5)
if [ -z "$CON" ]; then ok "console: 0 erros de app"; else bad "console: $CON"; fi

echo ""
[ $FAIL -eq 0 ] && echo "T92-E2E: ALL GREEN" || echo "T92-E2E: FALHAS ACIMA"
exit $FAIL
