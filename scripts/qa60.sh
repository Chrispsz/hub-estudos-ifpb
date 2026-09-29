#!/bin/bash
# qa60.sh (v4) — QA da rodada 60: Meta da Av1 (≥70) end-to-end.
# v4: seed em ordem NEWEST-FIRST (convenção do addSimuladoRun: prepend),
#     diagnósticos do veredito (anel + frase), close_dialog com verificação.
set -u
cd /home/z/my-project

AB="agent-browser"
URL="http://localhost:3000"
LS_KEY="hub-estudos-ifpb:v2"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL: $1"; }
chk() { if echo "$2" | tr -d '"' | grep -qF "$3"; then ok "$1"; else bad "$1 — esperava [$3], obtive: $(echo "$2" | tr -d '"' | head -c 300)"; fi }
wait_question() { # espera a questão N (1-based) estar montada (evita clicar botão em saída animada)
  local i out
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    out=$($AB eval "(() => { const t=document.querySelector('[role=\"dialog\"]')?.textContent||''; return new RegExp('Questão\\\\s*$1\\\\s*de').test(t)?'ok':'ainda:['+t.slice(0,80)+']'; })()" 2>&1 | tr -d '"')
    [ "$out" = "ok" ] && return 0
    [ $i -ge 11 ] && echo "  diag espera Q$1: $out"
    sleep 0.5
  done
  echo "  AVISO: Questão $1 não apareceu"; return 1
}
mark_q() { # mark_q <Consegui|Não consegui> <qidx> — marca e o app auto-avança (sem Próxima!)
  wait_question "$2" || true
  local attempt out
  for attempt in 1 2 3; do
    out=$($AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('$1') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'marked';} return 'no-mark-btn'; })()" 2>&1 | tr -d '"')
    [ "$out" = "marked" ] && break
    sleep 1
  done
  sleep 0.5
}
wait_exam_start() {
  local i out
  for i in 1 2 3 4 5 6 7 8; do
    out=$($AB eval "(() => { const t=document.querySelector('[role=\"dialog\"]')?.textContent||''; return /Questão\\s*1\\s*de/.test(t)?'pronta':'ainda'; })()" 2>&1 | tr -d '"')
    [ "$out" = "pronta" ] && { echo "  prova montada (espera ${i}x0.8s)"; return 0; }
    sleep 0.8
  done
  echo "  AVISO: prova não montou em 6.4s"; return 1
}
results_diag() { # anel + veredito, para diagnóstico
  $AB eval "(() => { const ring=document.querySelector('[role=\"dialog\"] .text-3xl'); const t=document.querySelector('[role=\"dialog\"]')?.textContent||''; const m=t.match(/(Meta da Av1 batida: \d+%|Faltam \d+pp para a meta da Av1)/); return JSON.stringify({ring: ring?ring.textContent:'?', veredito: m?m[0]:'?'}) })()" 2>&1
}
close_all_dialogs() {
  for try in 1 2 3; do
    OPEN=$($AB eval "(() => !!document.querySelector('[role=\"dialog\"]'))()" 2>&1 | tr -d '"')
    [ "$OPEN" = "false" ] && return 0
    $AB eval "(() => { const c=Array.from(document.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||'')==='Fechar'||(b.getAttribute('aria-label')||'')==='Close'); if(c){c.click(); return 'closed';} document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc'; })()" >/dev/null 2>&1
    sleep 1.2
  done
  return 0
}

echo "=== 0) dev no ar ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$URL")
[ "$CODE" = "200" ] && ok "dev 200" || { bad "dev $CODE"; exit 1; }

echo "=== 1) seed de 3 runs NEWEST-FIRST (c,b,a): Álgebra 50→20 · Lógica 50→80 · Estruturas fora do escopo ==="
$AB open "$URL" >/dev/null 2>&1; sleep 2
# SNAPSHOT do progresso ANTES do QA — restaurado no fim (higiene total, incl. exerciseProgress)
$AB eval "(() => { window.__qa60_snap = localStorage.getItem('hub-estudos-ifpb:v2'); return window.__qa60_snap===null?'snap-null':'snap-ok'; })()" >/dev/null 2>&1
SEED_JS='(() => { const k="'"$LS_KEY"'"; const raw=localStorage.getItem(k); const p=raw?JSON.parse(raw):{}; p.simuladoRuns=[{"id":"qa60-c","date":"2026-09-28T11:00:00.000Z","total":4,"solved":3,"missed":1,"skipped":0,"durationSec":300,"filters":{"discipline":"TEC.1687","difficulty":"all"},"questions":[{"status":"solved","disciplineCode":"TEC.1687","topic":"Estruturas de repetição"},{"status":"solved","disciplineCode":"TEC.1687","topic":"Estruturas de repetição"},{"status":"solved","disciplineCode":"TEC.1687","topic":"Estruturas de repetição"},{"status":"missed","disciplineCode":"TEC.1687","topic":"Estruturas de repetição"}]},{"id":"qa60-b","date":"2026-09-28T10:00:00.000Z","total":10,"solved":5,"missed":5,"skipped":0,"durationSec":900,"filters":{"discipline":"TEC.1984","difficulty":"all"},"questions":[{"status":"solved","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Lógica Matemática"}]},{"id":"qa60-a","date":"2026-09-27T10:00:00.000Z","total":6,"solved":3,"missed":3,"skipped":0,"durationSec":720,"filters":{"discipline":"TEC.1984","difficulty":"all"},"questions":[{"status":"solved","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Álgebra Matricial"},{"status":"solved","disciplineCode":"TEC.1984","topic":"Lógica Matemática"},{"status":"missed","disciplineCode":"TEC.1984","topic":"Lógica Matemática"}]}]; localStorage.setItem(k,JSON.stringify(p)); return "seeded-3"; })()'
chk "seed gravado (3 runs, ordem certa)" "$($AB eval "$SEED_JS" 2>&1)" "seeded-3"
$AB reload >/dev/null 2>&1; sleep 3

echo "=== 2) Progresso: linha da meta + legenda + badges de gap ==="
$AB eval "(() => { window.dispatchEvent(new CustomEvent('hub:open-progress')); return 'nav'; })()" >/dev/null 2>&1; sleep 2.5
SNAP=$($AB snapshot 2>&1)
chk "histórico renderiza com runs" "$SNAP" "Tendência por tópico"
chk "legenda 'meta de aprovação (70%)'" "$($AB eval "(() => document.body.textContent.includes('meta de aprovação (70%)'))()" 2>&1)" "true"
META_SEGS=$($AB eval "(() => document.querySelectorAll('span.border-dashed').length)()" 2>&1)
echo "  segmentos tracejados: $(echo "$META_SEGS" | tr -d '"') (3 runs → 3 gráfico + 2 tendências + 1 legenda)"
[ "$(echo "$META_SEGS" | tr -d '"')" = "6" ] 2>/dev/null && ok "linha da meta: 3 segmentos do gráfico + 2 tendências + 1 legenda" || bad "segmentos de meta inesperados: $META_SEGS"
GAP_BAD=$($AB eval "(() => Array.from(document.querySelectorAll('span[title]')).map(s=>s.getAttribute('title')).filter(t=>t&&t.includes('para a meta de aprovação')).join('|'))()" 2>&1)
chk "badge Álgebra: faltam 50pp" "$GAP_BAD" "Faltam 50pp para a meta de aprovação da Av1 (70%)"
OK_BAD=$($AB eval "(() => Array.from(document.querySelectorAll('span[title]')).map(s=>s.getAttribute('title')).filter(t=>t&&t.includes('batida — folga')).join('|'))()" 2>&1)
chk "badge Lógica: meta ✓ (folga 10pp)" "$OK_BAD" "folga de 10pp"
chk "rodapé da tendência cita a linha da meta" "$SNAP" "linha tracejada = meta de aprovação da Av1"
NOLEAK=$($AB eval "(() => Array.from(document.querySelectorAll('span[title]')).filter(s=>(s.getAttribute('title')||'').includes('Estruturas')).length)()" 2>&1)
[ "$(echo "$NOLEAK" | tr -d '"')" = "0" ] 2>/dev/null && ok "tópico fora do escopo SEM badge/linha de meta" || bad "meta vazou para tópico fora do escopo: $NOLEAK"

echo "=== 3) drill 1 (play do foco): 2/5 (40%) → veredito faltam 30pp + CTA ==="
$AB open "$URL" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button[title]')).find(b=>(b.getAttribute('title')||'')==='Treinar só Álgebra Matricial no Simulado Pro (prova curta de 5 questões)'); if(b){b.click(); return 'clicked';} return 'no-button'; })()" >/dev/null 2>&1
sleep 3
chk "diálogo com escopo do tópico" "$($AB eval "(() => { const d=document.querySelector('[role=\"dialog\"]'); return d?d.textContent.slice(0,500):'sem-dialog'; })()" 2>&1)" "escopo ativo · 1/6"
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Iniciar simulado')); if(b){b.click(); return 'started';} return 'no-start'; })()" >/dev/null 2>&1
wait_exam_start || true
for i in 1 2 3 4 5; do mark_q "$([ $i -le 2 ] && echo 'Consegui' || echo 'Não consegui')" "$i"; done
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Encerrar') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'done';} return 'no-finish'; })()" >/dev/null 2>&1; sleep 2
echo "  diag: $(results_diag)"
RES=$($AB snapshot 2>&1)
chk "veredito abaixo da meta" "$RES" "Faltam 30pp para a meta da Av1"
chk "veredito mostra nota do run (40%)" "$RES" "você fez 40%"
chk "CTA do pior tópico no veredito" "$RES" "Treinar só Álgebra Matricial (2/5)"

echo "=== 4) CTA do veredito → reabre o drill com escopo; fechar ==="
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button[title]')).find(b=>(b.getAttribute('title')||'').startsWith('Abrir prova curta (5 questões) só de')); if(b){b.click(); return 'cta';} return 'no-cta'; })()" >/dev/null 2>&1; sleep 2.5
DLG2=$($AB eval "(() => { const d=document.querySelector('[role=\"dialog\"]'); return d?d.textContent.slice(0,400):'sem-dialog'; })()" 2>&1)
echo "  diálogo pós-CTA: $(echo "$DLG2" | tr -d '"' | head -c 180)"
chk "CTA reabre o Simulado Pro com escopo" "$DLG2" "escopo ativo · 1/6"
close_all_dialogs

echo "=== 5) drill 2 (play da tendência no Progresso): Lógica 4/5 (80%) → meta batida +10pp ==="
$AB eval "(() => { window.dispatchEvent(new CustomEvent('hub:open-progress')); return 'nav'; })()" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button[title]')).find(b=>(b.getAttribute('title')||'')==='Treinar só Lógica Matemática no Simulado Pro (prova curta de 5 questões)'); if(b){b.click(); return 'clicked';} return 'no-button'; })()" >/dev/null 2>&1; sleep 3
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Iniciar simulado')); if(b){b.click(); return 'started';} return 'no-start'; })()" >/dev/null 2>&1
wait_exam_start || true
for i in 1 2 3 4 5; do mark_q "$([ $i -le 4 ] && echo 'Consegui' || echo 'Não consegui')" "$i"; done
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Encerrar') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'done';} return 'no-finish'; })()" >/dev/null 2>&1; sleep 2
echo "  diag: $(results_diag)"
RES2=$($AB snapshot 2>&1)
chk "veredito meta batida" "$RES2" "Meta da Av1 batida: 80%"
chk "folga de +10pp" "$RES2" "+10pp"
chk "drill de 1 tópico NÃO cita a regra do plano (só multi-tópico)" "$(echo "$RES2" | grep -qF 'vira a revisão de amanhã' && echo TEM || echo NAO)" "NAO"
close_all_dialogs

echo "=== 6) PRESET OFICIAL: Simulado da Av1 10Q → 60% → regra do plano + blocos por tópico ==="
$AB open "$URL" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=document.querySelector('[aria-label=\"Abrir Simulado da Av1 com o escopo real da prova\"]'); if(b){b.click(); return 'marco';} return 'no-marco'; })()" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Iniciar simulado')); if(b){b.click(); return 'started';} return 'no-start'; })()" >/dev/null 2>&1
wait_exam_start || true
for i in 1 2 3 4 5 6 7 8 9 10; do mark_q "$([ $i -le 6 ] && echo 'Consegui' || echo 'Não consegui')" "$i"; done
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Encerrar') && b.closest('[role=\"dialog\"]')); if(b){b.click(); return 'done';} return 'no-finish'; })()" >/dev/null 2>&1; sleep 2
echo "  diag: $(results_diag)"
RES3=$($AB snapshot 2>&1)
chk "veredito do preset: faltam 10pp (60%)" "$RES3" "Faltam 10pp para a meta da Av1"
if echo "$RES3" | grep -qF "Desempenho por tópico"; then
  chk "corrida multi-tópico cita a regra do plano D-7" "$RES3" "vira a revisão de amanhã"
  chk "blocos por tópico mostram o pior primeiro" "$RES3" "Desempenho por tópico"
else
  echo "SKIP: preset sorteou 1 tópico só — regra não se aplica"
fi
chk "perguntas erradas listadas para revisão" "$RES3" "Para revisar depois"
close_all_dialogs

echo "=== 7) prontidão: evidência do simulado com metaGapText ==="
$AB open "$URL" >/dev/null 2>&1; sleep 2.5
$AB eval "(() => { const b=Array.from(document.querySelectorAll('button[aria-label=\"Abrir plano completo da prova\"]')); if(b[0]){b[0].click(); return 'opened';} return 'no-btn'; })()" >/dev/null 2>&1; sleep 2.5
RDVAL=$($AB eval "(() => { const t=document.querySelector('[role=\"dialog\"]')?.textContent||document.body.textContent; const m=t.match(/(meta batida \(\+\d+pp de folga\)|faltam \d+pp para a meta 70)/); return m?m[0]:'nada'; })()" 2>&1)
echo "  metaGapText no DOM: $(echo "$RDVAL" | tr -d '"')"
chk "readiness mostra a meta (70) na evidência" "$RDVAL" "meta"
chk "readiness cita 'meta 70'" "$($AB eval "(() => (document.querySelector('[role=\"dialog\"]')?.textContent||'').includes('meta 70'))()" 2>&1)" "true"
close_all_dialogs

echo "=== 8) overflow ==="
OV=$($AB eval "(() => document.documentElement.scrollWidth===document.documentElement.clientWidth)()" 2>&1)
[ "$(echo "$OV" | tr -d '"')" = "true" ] && ok "sem overflow horizontal (sw=cw)" || bad "overflow: $OV"

echo "=== 9) higiene: restaurar o progresso EXATO de antes do QA (runs + exerciseProgress + tudo) ==="
CLEAN=$($AB eval "(() => { if (window.__qa60_snap === null) { localStorage.removeItem('hub-estudos-ifpb:v2'); return 'removida-chave'; } localStorage.setItem('hub-estudos-ifpb:v2', window.__qa60_snap); return 'progresso-restaurado'; })()" 2>&1)
echo "  $(echo "$CLEAN" | tr -d '"')"
$AB reload >/dev/null 2>&1; sleep 1

echo ""
echo "RESULTADO: PASS=$PASS FAIL=$FAIL"
