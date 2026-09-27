#!/bin/bash
# qa61.sh — QA da rodada 61: replay de errados POR TÓPICO no resultado +
# badge de prontidão clicável no header do card.
set -u
cd /home/z/my-project

AB="agent-browser"
URL="http://localhost:3000"
LS_KEY="hub-estudos-ifpb:v2"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL: $1"; }
chk() { if echo "$2" | tr -d '"' | grep -qF "$3"; then ok "$1"; else bad "$1 — esperava [$3], obtive: $(echo "$2" | tr -d '"' | head -c 300)"; fi }
wait_question() {
  local i out
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    out=$($AB eval "(() => { const t=document.querySelector('[role=\"dialog\"]')?.textContent||''; return new RegExp('Questão\\\\s*$1\\\\s*de').test(t)?'ok':'ainda'; })()" 2>&1 | tr -d '"')
    [ "$out" = "ok" ] && return 0
    sleep 0.5
  done
  echo "  AVISO: Questão $1 não apareceu"; return 1
}
mark_q() { # marca e o app auto-avança
  wait_question "$2" || true
  local attempt out
  for attempt in 1 2 3; do
    out=$($AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('$1') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'marked';} return 'no-mark-btn'; })()" 2>&1 | tr -d '"')
    [ "$out" = "marked" ] && break
    sleep 1
  done
  sleep 0.4
}
q_total() { # lê o contador LIMPO "Questão 1 de X" (span próprio, sem o cronômetro colado)
  $AB eval "(() => { const s=Array.from(document.querySelectorAll('[role=\"dialog\"] span')).map(e=>e.textContent||'').find(t=>/^Questão\s*1\s*de\s*\d+$/.test(t.trim())); if(!s) return '?'; const m=s.trim().match(/de\s*(\d+)$/); return m?m[1]:'?'; })()" 2>&1 | tr -d '"'
}
close_all_dialogs() {
  for try in 1 2 3; do
    OPEN=$($AB eval "(() => !!document.querySelector('[role=\"dialog\"]'))()" 2>&1 | tr -d '"')
    [ "$OPEN" = "false" ] && return 0
    $AB eval "(() => { const c=Array.from(document.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||'')==='Fechar'||(b.getAttribute('aria-label')||'')==='Close'); if(c){c.click(); return 'closed';} document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc'; })()" >/dev/null 2>&1
    sleep 1.2
  done
}

echo "=== 0) dev + snapshot de segurança ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$URL")
[ "$CODE" = "200" ] && ok "dev 200" || { bad "dev $CODE"; exit 1; }
$AB open "$URL" >/dev/null 2>&1; sleep 2
$AB eval "(() => { window.__qa61_snap = localStorage.getItem('hub-estudos-ifpb:v2'); return window.__qa61_snap===null?'snap-null':'snap-ok'; })()" 2>&1

echo "=== 1) preset oficial 10Q: 5✓/5✗ → 50% → blocos por tópico com replay ==="
$AB eval "(() => { const b=document.querySelector('[aria-label=\"Abrir Simulado da Av1 com o escopo real da prova\"]'); if(b){b.click(); return 'marco';} return 'no-marco'; })()" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Iniciar simulado')); if(b){b.click(); return 'started';} return 'no-start'; })()" >/dev/null 2>&1
for i in 1 2 3 4 5 6 7 8 9 10; do mark_q "$([ $i -le 5 ] && echo 'Consegui' || echo 'Não consegui')" "$i"; done
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Encerrar') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'done';} return 'no-finish'; })()" >/dev/null 2>&1; sleep 2
RES=$($AB snapshot 2>&1)
chk "veredito do preset (50%)" "$RES" "Faltam 20pp para a meta da Av1"
chk "blocos por tópico presentes" "$RES" "Desempenho por tópico"
REPLAYS=$($AB eval "(() => Array.from(document.querySelectorAll('button[aria-label]')).map(b=>b.getAttribute('aria-label')).filter(t=>t&&t.startsWith('Refazer as questões erradas de')).join('|'))()" 2>&1)
echo "  replays por tópico: $(echo "$REPLAYS" | tr -d '"')"
[ "$(echo "$REPLAYS" | tr -d '"' | grep -o 'Refazer' | wc -l)" -ge 1 ] 2>/dev/null && ok "replay por tópico aparece nos blocos" || bad "nenhum replay por tópico"

echo "=== 2) clicar replay do pior tópico → reinicia só com as erradas dele ==="
# achar o k do pior tópico pelo title "Refazer agora as N que não consegui em X"
K=$($AB eval "(() => { const b=Array.from(document.querySelectorAll('button[title]')).find(b=>(b.getAttribute('title')||'').startsWith('Refazer agora as')); const m=(b?.getAttribute('title')||'').match(/Refazer agora as (\d+)/); const t=(b?.getAttribute('title')||'').match(/em (.+)$/); if(b){ b.click(); return (m?m[1]:'?')+'::'+(t?t[1]:'?'); } return 'no-btn'; })()" 2>&1 | tr -d '"')
echo "  replay alvo: k=$K"
KTOP=$(echo "$K" | cut -d: -f1)
[ "$K" != "no-btn" ] && [ "$KTOP" != "?" ] && ok "replay do tópico clicado (k=$KTOP)" || bad "replay não clicado: $K"
sleep 2
QT=$(q_total)
echo "  prova reiniciada com Questão 1 de $QT"
[ "$QT" = "$KTOP" ] && ok "reinicia com EXATAMENTE as $KTOP erradas do tópico" || bad "esperava 1 de $KTOP, veio 1 de $QT"
TT=$($AB eval "(() => { const t=document.querySelector('[role=\"dialog\"]')?.textContent||''; const m=t.match(/(\d+):(\d+)/); return m?m[1]+':'+m[2]:'?'; })()" 2>&1 | tr -d '"')
echo "  cronômetro reiniciado: $TT"
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Encerrar') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'done';} return 'no-finish'; })()" >/dev/null 2>&1; sleep 2
RES2=$($AB snapshot 2>&1)
chk "resultado do replay (0/k → abaixo da meta)" "$RES2" "Faltam"
close_all_dialogs

echo "=== 3) 'Refazer só os errados' global segue intacto (sem tópico) ==="
$AB open "$URL" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=document.querySelector('[aria-label=\"Abrir Simulado da Av1 com o escopo real da prova\"]'); if(b){b.click(); return 'marco';} return 'no-marco'; })()" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Iniciar simulado')); if(b){b.click(); return 'started';} return 'no-start'; })()" >/dev/null 2>&1
for i in 1 2 3 4 5 6 7 8 9 10; do mark_q "$([ $i -le 5 ] && echo 'Consegui' || echo 'Não consegui')" "$i"; done
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Encerrar') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'done';} return 'no-finish'; })()" >/dev/null 2>&1; sleep 2
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Refazer só os errados')); if(b){b.click(); return 'ok';} return 'no'; })()" >/dev/null 2>&1; sleep 2
QT2=$(q_total)
echo "  replay global: Questão 1 de $QT2"
[ "$QT2" = "5" ] && ok "global reinicia com as 5 erradas" || bad "esperava 1 de 5, veio 1 de $QT2"
close_all_dialogs

echo "=== 4) badge de prontidão clicável → abre o diálogo do plano ==="
$AB open "$URL" >/dev/null 2>&1; sleep 2.5
BADGE=$($AB eval "(() => { const b=Array.from(document.querySelectorAll('button[aria-label=\"Abrir plano completo com as evidências do score de prontidão\"]')); if(b[0]){b[0].click(); return 'clicked';} return 'no-badge'; })()" 2>&1 | tr -d '"')
[ "$BADGE" = "clicked" ] && ok "badge de prontidão clicável presente no header" || bad "badge não encontrado: $BADGE"
sleep 2
DIA=$($AB eval "(() => { const d=document.querySelector('[role=\"dialog\"]'); return d?(d.textContent.includes('Score de prontidão')?'aberto-com-score':'aberto-sem-score'):'sem-dialog'; })()" 2>&1 | tr -d '"')
chk "badge abre o diálogo do plano com o score" "$DIA" "aberto-com-score"
close_all_dialogs

echo "=== 5) overflow + console ==="
OV=$($AB eval "(() => document.documentElement.scrollWidth===document.documentElement.clientWidth)()" 2>&1 | tr -d '"')
[ "$OV" = "true" ] && ok "sem overflow horizontal (sw=cw)" || bad "overflow: $OV"

echo "=== 6) higiene: restaurar snapshot ==="
CLEAN=$($AB eval "(() => { if (window.__qa61_snap === null) { localStorage.removeItem('hub-estudos-ifpb:v2'); return 'removida'; } localStorage.setItem('hub-estudos-ifpb:v2', window.__qa61_snap); return 'restaurado'; })()" 2>&1 | tr -d '"')
echo "  $CLEAN"
$AB reload >/dev/null 2>&1; sleep 1

echo ""
echo "RESULTADO: PASS=$PASS FAIL=$FAIL"
