#!/bin/bash
# qa60-shots.sh — screenshots de evidência da rodada 60 (depois limpa tudo).
set -u
cd /home/z/my-project
AB="agent-browser"
URL="http://localhost:3000"
LS_KEY="hub-estudos-ifpb:v2"

wait_question() {
  local i out
  for i in $(seq 1 12); do
    out=$($AB eval "(() => { const t=document.querySelector('[role=\"dialog\"]')?.textContent||''; return new RegExp('Questão\\\\s*$1\\\\s*de').test(t)?'ok':'ainda'; })()" 2>&1 | tr -d '"')
    [ "$out" = "ok" ] && return 0
    sleep 0.5
  done
  return 1
}
mark_q() {
  wait_question "$2" || true
  $AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('$1') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'marked';} return 'no'; })()" >/dev/null 2>&1
  sleep 0.5
}

$AB open "$URL" >/dev/null 2>&1; sleep 2
# seed igual ao qa60.sh (c,b,a newest-first)
SEED_JS='(() => { const k="'"$LS_KEY"'"; const raw=localStorage.getItem(k); const p=raw?JSON.parse(raw):{}; p.simuladoRuns=[{"id":"qa60-c","date":"2026-09-28T11:00:00.000Z","total":4,"solved":3,"missed":1,"skipped":0,"durationSec":300,"filters":{"discipline":"TEC.1687","difficulty":"all"},"questions":[{"status":"solved","disciplineCode":"TEC.1687","topic":"Estruturas de repetição"},{"status":"solved","disciplineCode":"TEC.1687","topic":"Estruturas de repetição"},{"status":"solved","disciplineCode":"TEC.1687","topic":"Estruturas de repetição"},{"status":"missed","disciplineCode":"TEC.1687","topic":"Estruturas de repetição"}]},{"id":"qa60-b","date":"2026-09-28T10:00:00.000Z","total":10,"solved":5,"missed":5,"skipped":0,"durationSec":900,"filters":{"discipline":"TEC.1984","difficulty":"all"},"questions":[{"status":"solved","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Lógica Matemática"}]},{"id":"qa60-a","date":"2026-09-27T10:00:00.000Z","total":6,"solved":3,"missed":3,"skipped":0,"durationSec":720,"filters":{"discipline":"TEC.1984","difficulty":"all"},"questions":[{"status":"solved","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Lógica Matemática"}]}]; localStorage.setItem(k,JSON.stringify(p)); return "seeded"; })()'
$AB eval "$SEED_JS" >/dev/null 2>&1
$AB reload >/dev/null 2>&1; sleep 3

# 1) Histórico: meta lines + badges
$AB eval "(() => { window.dispatchEvent(new CustomEvent('hub:open-progress')); return 'nav'; })()" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const h3=Array.from(document.querySelectorAll('h3')).find(h=>h.textContent.includes('Histórico de simulados')); if(!h3) return 'no-h3'; let el=h3; for(let d=0;d<8 && el;d++){ el=el.parentElement; if(el){ const cs=getComputedStyle(el); if((cs.overflowY==='auto'||cs.overflowY==='scroll') && el.scrollHeight>el.clientHeight+50){ el.scrollTop += 120; return 'scrolled'; } } } return 'no-scroller'; })()" >/dev/null 2>&1; sleep 1
$AB screenshot scripts/qa60-historico-meta.png 2>&1 | tail -1
echo "shot 1 ok"

# 2) drill do foco → veredito (2/5 = 40%)
$AB open "$URL" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button[title]')).find(b=>(b.getAttribute('title')||'')==='Treinar só Álgebra Matricial no Simulado Pro (prova curta de 5 questões)'); if(b){b.click(); return 'ok';} return 'no'; })()" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Iniciar simulado')); if(b){b.click(); return 'ok';} return 'no'; })()" >/dev/null 2>&1; sleep 2
for i in 1 2 3 4 5; do mark_q "$([ $i -le 2 ] && echo 'Consegui' || echo 'Não consegui')" "$i"; done
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Encerrar') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'ok';} return 'no'; })()" >/dev/null 2>&1; sleep 2.5
$AB screenshot scripts/qa60-veredito-meta.png 2>&1 | tail -1
echo "shot 2 ok"

# 3) limpeza total
$AB eval "(() => { localStorage.setItem('hub-estudos-ifpb:v2', '{}'); return 'limpo'; })()" 2>&1
$AB reload >/dev/null 2>&1; sleep 1
echo "fim"
