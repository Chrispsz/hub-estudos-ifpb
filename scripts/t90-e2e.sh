#!/bin/bash
# Task 90 — E2E da faixa da Av1 nos Flashcards + cram escopado (v5)
# v5: SEM remount por navegação — examBrief é recomputado a cada render do
# FlashcardsView, então um StorageEvent que MUDA o valor (poke __poke) basta
# para re-renderizar com o relógio mockado (lição 80 elevada ao render).
# Radix Tabs: ativação por MOUSEDOWN (click() sozinho não troca o conteúdo).
# Sessão ativa sai pelo botão ghost (aria-label 'Encerrar sessão de revisão').
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t90.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

on_flashcards() {
  agent-browser eval "(function(){var t=document.body.textContent;return 'fc='+(t.indexOf('Leitner')>=0?'yes':'no')})()" 2>/dev/null | tr -d '"'
}
goto_flashcards() {
  for try in 1 2 3; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){if(els[i].textContent.trim()==='Praticar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 3
    agent-browser eval "(function(){var els=document.querySelectorAll('[role=tab]');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Flashcards')>=0){els[i].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(on_flashcards)" = "fc=yes" ] && return 0
  done
  return 1
}
# asserções por textContent — formato SEM aspas (escapes do CLI matam case)
flags() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return ['hoje='+(t.indexOf('É hoje: Simulado da Av1')>=0?1:0),'feito='+(t.indexOf('Simulado da Av1 feito')>=0?1:0),'vesp='+(t.indexOf('Véspera da Av1 — dia do cram')>=0?1:0),'prova='+(t.indexOf('É hoje: Prova da Av1')>=0?1:0),'frescas='+(t.indexOf('fórmulas frescas para amanhã')>=0?1:0),'cta='+(t.indexOf('Cram de Matemática')>=0?1:0),'rev='+(t.indexOf('Revisar fórmulas')>=0?1:0)].join('|')})()" 2>/dev/null | tr -d '"'
}
has() { # $1=trecho
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
ctas() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var out=[];for(var i=0;i<els.length;i++){var s=els[i].textContent.replace(/\s+/g,' ').trim();if(s.indexOf('Cram de Matemática')>=0||s.indexOf('Revisar fórmulas')>=0){out.push((els[i].disabled?'OFF':'ON')+':'+s)}}return out.join('|')||'NO-CTA'})()" 2>/dev/null | tr -d '"'
}
strip_class() { # $1=trecho do texto · $2=classe esperada
  agent-browser eval "(function(){var els=document.querySelectorAll('div');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0&&els[i].textContent.length<420)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
mock_date() { # padrão provado (class extends Date) + eco DENTRO da página
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
# POKE: muda o valor no storage (contador __poke) + StorageEvent → hook faz
# setState (guard anti-loop não engola) → FlashcardsView re-renderiza →
# examBrief recalculado NO RELÓGIO MOCKADO do frame. Zero navegação.
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
seed_run() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=[{id:'qa90-of',date:'2026-09-29T15:30:00',mode:'prova',total:10,solved:7,missed:3,skipped:0,durationSec:1800,filters:{discipline:'TEC.1984'}}];var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
  sleep 1
}
seed_cards() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.flashcards=p.flashcards||[];var now=new Date().toISOString();for(var i=1;i<=3;i++){p.flashcards.push({id:'qa90-fc-'+i,disciplineCode:'TEC.1984',front:'QA90 frente '+i,back:'QA90 verso '+i,source:'manual',createdAt:now,box:0,dueAt:now,reviews:0,lapses:0})}var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
  sleep 1
}

# Lição 129 — O TICK DE 30s: o examBrief dos Flashcards é render-time sobre
# `now = useNow(30_000)` (contrato null-até-mount da 113) — o poke re-renderiza
# a view mas NÃO muda o `now`: o strip só flipa no próximo tick (até 30s de
# atraso, non-determinístico para o harness). A cura: REMOUNT da tab após cada
# mock/seed+poke — o useNow dispara setNow(new Date()) no mount e o brief
# recompõe IMEDIATAMENTE com o relógio plantado (validado ao vivo).
# ⚠️ Lição 129.2: mousedown na tab JÁ ATIVA não remonta (React bail-out) —
# o remount tem que TROCAR de tab (Exercícios → Flashcards) para desmontar
# e montar o conteúdo de verdade (o useNow do mount lê o relógio plantado).
remount_fc() {
  agent-browser eval "(function(){var els=document.querySelectorAll('[role=tab]');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Exercícios')>=0){els[i].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 1
  goto_flashcards >/dev/null 2>&1
  sleep 1
}

echo "=== [A] MOCK 27/09 (D-4): silêncio honesto (Lição 128 — data-rot) ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
echo "  $(mock_date '2026-09-27T15:30:00')"
if goto_flashcards; then ok "navegação: Flashcards aberta (mount com D-4 plantado)"; else bad "não cheguei nos Flashcards — abortar"; fi
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=0*feito=0*vesp=0*prova=0*cta=0*) ok "D-4 plantado: nenhuma faixa, nenhum CTA (fora da janela)";; *) bad "D-4: faixa/CTA presente";; esac

echo "=== [B] MOCK 29/09 + remount: 'É hoje: Simulado da Av1', CTA OFF ==="
M=$(mock_date "2026-09-29T15:30:00"); echo "  $M"
[ "$M" = "mock=2026-9-29" ] && ok "date mock confirmado pela página" || bad "mock não confirmado: '$M'"
poke
remount_fc
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=1*feito=0*) ok "29/09 sem run: 'É hoje: Simulado da Av1'";; *) bad "estado simulado-hoje: $F";; esac
[ "$(strip_class 'É hoje: Simulado da Av1' 'shadow-amber-500/30')" = "1" ] && ok "sólido âmbar com glow (é-hoje)" || bad "classe sólida âmbar ausente"
C=$(ctas); echo "  ctas: $C"
case "$C" in *OFF:Cram*) ok "0 cartões MAT: CTA desabilitado (hint no title)";; *) bad "CTA devia estar OFF: $C";; esac

echo "=== [C] 3 cartões MAT semeados: CTA ON com contagem ==="
seed_cards
poke
remount_fc
C=$(ctas); echo "  ctas: $C"
case "$C" in *ON:Cram*"(3)"*) ok "CTA 'Cram de Matemática (3)' habilitado (StorageEvent síncrono)";; *) bad "CTA (3) esperado: $C";; esac

echo "=== [D] Clique → sessão 'Cram — Matemática' ==="
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('Cram de Matemática')>=0){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
B=$(has "Cram — Matemática"); G=$(has "Cram — tudo"); K=$(has "QA90 frente")
echo "  badge=$B tudo=$G card=$K"
[ "$B" = "1" ] && ok "badge da sessão: 'Cram — Matemática'" || bad "badge escopado ausente"
[ "$G" = "0" ] && ok "não diz 'Cram — tudo'" || bad "badge genérico presente"
[ "$K" = "1" ] && ok "primeiro cartão é de Matemática" || bad "cartão MAT ausente"
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){if(els[i].getAttribute('aria-label')==='Encerrar sessão de revisão'){els[i].click();return 'exit-ghost'}}for(var j=0;j<els.length;j++){if(els[j].textContent.trim()==='Voltar à lista'){els[j].click();return 'exit-lista'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
[ "$(on_flashcards)" = "fc=yes" ] && ok "sessão encerrada (de volta à lista)" || bad "sessão não encerrou"

echo "=== [E] Run oficial semeado: strip flipa 'feito ✓ — 70%' (remount) ==="
seed_run
poke
remount_fc
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=0*feito=1*) ok "com run: 'feito ✓' (registro vence o relógio)";; *) bad "estado feito esperado: $F";; esac
[ "$(has 'feito ✓ — 70%')" = "1" ] && ok "percentual do run no título: 70%" || bad "percentual ausente"
[ "$(strip_class 'Simulado da Av1 feito' 'bg-emerald-600')" = "1" ] && ok "sólido emerald sem pulso" || bad "classe emerald ausente"

echo "=== [F] MOCK 30/09 + remount: véspera tinted + CTA ==="
mock_date "2026-09-30T10:00:00" >/dev/null 2>&1
poke
remount_fc
F=$(flags); echo "  flags: $F"
case "$F" in *feito=0*vesp=1*frescas=1*) ok "véspera: título + chamada, sem 'feito' (janela do simulado saiu)";; *) bad "véspera esperada: $F";; esac
[ "$(strip_class 'Véspera da Av1' 'bg-amber-500/[0.07]')" = "1" ] && ok "tinta translúcida âmbar (espera)" || bad "classe tinted ausente"
C=$(ctas); echo "  ctas: $C"
case "$C" in *ON:Cram*"(3)"*) ok "CTA ativo na véspera";; *) bad "CTA devia estar ON: $C";; esac

echo "=== [G] MOCK 01/10 + remount: prova rose + Revisar fórmulas ==="
mock_date "2026-10-01T08:00:00" >/dev/null 2>&1
poke
remount_fc
F=$(flags); echo "  flags: $F"
case "$F" in *vesp=0*prova=1*) ok "01/10: 'É hoje: Prova da Av1'";; *) bad "prova-hoje esperada: $F";; esac
[ "$(strip_class 'É hoje: Prova da Av1' 'shadow-rose-500/30')" = "1" ] && ok "sólido rose com glow" || bad "classe rose ausente"
C=$(ctas); echo "  ctas: $C"
case "$C" in *ON:Revisar*"(3)"*) ok "CTA 'Revisar fórmulas (3)'";; *) bad "CTA revisão: $C";; esac

echo "=== [H] Mobile 390 (véspera): sem overflow ==="
mock_date "2026-09-30T10:00:00" >/dev/null 2>&1
poke
agent-browser set viewport 390 844 >/dev/null 2>&1
sleep 3
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'sw='+window.innerWidth+' iw='+d.clientWidth+' ovf='+(d.scrollWidth>d.clientWidth)})()" 2>/dev/null)
echo "  $OVF"
echo "$OVF" | grep -qF 'ovf=false' && ok "mobile 390: zero overflow" || bad "mobile: OVERFLOW ($OVF)"
agent-browser set viewport 1440 900 >/dev/null 2>&1

echo "=== [I] HIGIENE: semeados fora + reload + estado zero ==="
agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.flashcards=(p.flashcards||[]).filter(function(c){return c.id.indexOf('qa90-fc-')!==0});delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 1})()" >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 5
H=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');var n=(p.flashcards||[]).filter(function(c){return c.id.indexOf('qa90-fc-')===0}).length;return 'qacards='+n+' runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)})()" 2>/dev/null | tr -d '"')
echo "  $H"
case "$H" in *qacards=0*runs=0*"poke=0"*) ok "storage limpo: 0 cartões QA · 0 runs · poke fora";; *) bad "higiene: $H";; esac
if goto_flashcards; then ok "navegação final OK"; else bad "navegação final falhou"; fi
F=$(flags); echo "  flags: $F"
case "$F" in *hoje=0*vesp=0*cta=0*) ok "data real restaurada: mock morto no reload, faixa some";; *) bad "faixa presente na data real pós-reload: $F";; esac

echo "=== [J] Console ==="
CONSOLE=$(agent-browser console 2>/dev/null | tail -40)
APPERR=$(echo "$CONSOLE" | grep -iE 'error' | grep -viE 'fast.refresh|hmr|dev|Download the React DevTools' | head -5)
[ -z "$APPERR" ] && ok "console: 0 erros de app" || bad "console: $APPERR"

echo ""
if [ $FAIL -eq 0 ]; then echo "T90-E2E: ALL GREEN"; else echo "T90-E2E: FALHAS ACIMA"; fi
