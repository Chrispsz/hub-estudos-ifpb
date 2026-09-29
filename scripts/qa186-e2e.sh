#!/bin/bash
# t186 — E2E SINGLE-CALL v2 (lição t176/t185 + desta rodada: o servidor morre
# no recycle do shell; a hidratação pós-reload precisa de ESPERA VERIFICÁVEL,
# não sleep cego — cada passo devolve o estado real).
set -u
cd /home/z/my-project

PORT=3100 NODE_ENV=production nohup bun .next/standalone/server.js > server-qa.log 2>&1 &
SRV=$!
sleep 4
if ! curl -s -m 4 http://localhost:3100/api/audit > /dev/null; then
  echo "SERVIDOR NAO SUBIU"; tail -5 server-qa.log; kill $SRV 2>/dev/null; exit 1
fi
echo "== servidor no ar (pid $SRV) =="

ab() { agent-browser "$@" 2>&1 | tail -1; }

# espera até a eval devolver true (teto de tentativas)
espera_eval() { # $1 = js que devolve true/false
  for i in $(seq 1 12); do
    R=$(ab eval "$1")
    [ "$R" = "true" ] && return 0
    sleep 1
  done
  echo "  [espera_eval esgotou: $1 -> $R]"
  return 1
}

hidratado() {
  espera_eval "(() => { const b = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim().startsWith('Biblioteca')); return !!b && !!b.offsetParent; })()"
}

goto_resumos() {
  ab eval "(() => { const bib = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim().startsWith('Biblioteca')); bib?.click(); return 1; })()" >/dev/null
  espera_eval "(() => { const tab = [...document.querySelectorAll('[role=tab]')].find(e => e.textContent.includes('Resumos')); return !!tab; })()"
  ab eval "(() => { const tab = [...document.querySelectorAll('[role=tab]')].find(e => e.textContent.includes('Resumos')); for (const t of ['pointerdown','mousedown','pointerup','mouseup','click']) tab.dispatchEvent(new MouseEvent(t, {bubbles:true,cancelable:true,view:window})); return 1; })()" >/dev/null
  espera_eval "(() => { const tab = [...document.querySelectorAll('[role=tab]')].find(e => e.textContent.includes('Resumos')); return tab?.getAttribute('aria-selected') === 'true'; })()"
  # a lista interna tem abas próprias (recentes/concluídos/Todos) — TODOS os materiais só na aba all
  ab eval "(() => { const tab = [...document.querySelectorAll('[role=tab]')].find(e => e.textContent.trim().startsWith('Todos')); for (const t of ['pointerdown','mousedown','pointerup','mouseup','click']) tab?.dispatchEvent(new MouseEvent(t, {bubbles:true,cancelable:true,view:window})); return 1; })()" >/dev/null
  espera_eval "(() => { const tab = [...document.querySelectorAll('[role=tab]')].find(e => e.textContent.trim().startsWith('Todos')); return tab?.getAttribute('aria-selected') === 'true'; })()"
}

open_resumo() { # $1 = trecho do título do material
  for i in 1 2 3; do
    R=$(ab eval "(() => { const row = [...document.querySelectorAll('li')].find(r => r.textContent.includes('$1')); if (!row) return 'ROW NAO ACHADA'; const btn = [...row.querySelectorAll('button')].find(b => b.textContent.includes('Resumo IA')); if (!btn) return 'BTN NAO ACHADO'; for (const t of ['pointerdown','mousedown','pointerup','mouseup','click']) btn.dispatchEvent(new MouseEvent(t, {bubbles:true,cancelable:true,view:window})); return 'clicado'; })()")
    [ "$R" = "clicado" ] && break
    echo "  [tentativa $i: $R]"; sleep 2
  done
  espera_eval "(() => { const dlg = document.querySelector('[role=dialog]'); return !!dlg && !!dlg.textContent; })()"
  espera_eval "(() => { const dlg = document.querySelector('[role=dialog]'); return !/Carregando|carregando/.test(dlg?.textContent ?? '') && (dlg?.querySelectorAll('h4,h3')?.length ?? 0) > 0 || /Resumo indisponível/.test(dlg?.textContent ?? ''); })()"
}

# --- preparo: página limpa SEM marcas antigas (a chave certa do progresso) ---
ab open "http://localhost:3100/" >/dev/null
ab eval "localStorage.removeItem('hub-estudos-ifpb:v2'); location.reload(); 1" >/dev/null
sleep 3
hidratado && echo "  app hidratado" || echo "  FALHA DE HIDRATAÇÃO"

# --- A) Matrizes — Aula 01 (Lista) ---
echo "== A) Matrizes: 8 perguntas, gesto, esmeralda, persistência =="
goto_resumos || echo "  goto_resumos FALHOU"
open_resumo 'Matrizes — Aula 01 (Lista)'
ab eval "(() => { const dlg = document.querySelector('[role=dialog]'); const per = [...dlg.querySelectorAll('label')].filter(l => l.querySelector('[role=checkbox]')); const cnt = [...dlg.querySelectorAll('span')].find(s => /perguntas respondidas/.test(s.textContent)); return JSON.stringify({ n: per.length, contador: cnt?.textContent?.trim() ?? 'AUSENTE', ring: per[0]?.className.includes('focus-within:ring-emerald-500/40'), transicao: per[0]?.className.includes('transition-colors') }); })()"
ab eval "(() => { const dlg = document.querySelector('[role=dialog]'); const cb = [...dlg.querySelectorAll('label')].filter(l => l.querySelector('[role=checkbox]'))[0].querySelector('[role=checkbox]'); cb.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); cb.dispatchEvent(new MouseEvent('click', {bubbles:true})); return 1; })()" >/dev/null
sleep 1
echo "-- após marcar a 1ª:"
ab eval "(() => { const dlg = document.querySelector('[role=dialog]'); const per = [...dlg.querySelectorAll('label')].filter(l => l.querySelector('[role=checkbox]')); const cnt = [...dlg.querySelectorAll('span')].find(s => /perguntas respondidas/.test(s.textContent)); per[0].scrollIntoView({block:'center'}); return JSON.stringify({ contador: cnt?.textContent?.trim(), esmeralda: per[0].className.includes('border-emerald-500/40'), checked: per[0].querySelector('[role=checkbox]').getAttribute('aria-checked'), outrasIntactas: per.slice(1).every(l => !l.className.includes('border-emerald-500/40')) }); })()"
sleep 1
ab screenshot download/qa186-perguntas-matrizes.png
ab press Escape >/dev/null
sleep 2
echo "-- reabre (persistência):"
open_resumo 'Matrizes — Aula 01 (Lista)'
ab eval "(() => { const dlg = document.querySelector('[role=dialog]'); const per = [...dlg.querySelectorAll('label')].filter(l => l.querySelector('[role=checkbox]')); const cnt = [...dlg.querySelectorAll('span')].find(s => /perguntas respondidas/.test(s.textContent)); return JSON.stringify({ contador: cnt?.textContent?.trim(), checked: per[0]?.querySelector('[role=checkbox]')?.getAttribute('aria-checked') }); })()"
ab press Escape >/dev/null
sleep 2
ab reload >/dev/null
sleep 3
hidratado >/dev/null

# --- B) Resgatado: Questões da Semana 3 ---
echo "== B) Resgatado: Questões da Semana 3 (5 perguntas de volta) =="
goto_resumos || echo "  goto_resumos FALHOU"
open_resumo 'Questões da Semana 3'
ab eval "(() => { const dlg = document.querySelector('[role=dialog]'); const per = [...dlg.querySelectorAll('label')].filter(l => l.querySelector('[role=checkbox]')); return JSON.stringify({ n: per.length, primeira: per[0]?.textContent?.trim().slice(0, 70) ?? 'AUSENTE' }); })()"
ab eval "(() => { const d = document.querySelector('[role=dialog]'); [...d.querySelectorAll('label')].filter(l=>l.querySelector('[role=checkbox]'))[0]?.scrollIntoView({block:'center'}); return 1; })()" >/dev/null
sleep 1
ab screenshot download/qa186-perguntas-resgatadas.png
ab press Escape >/dev/null
sleep 2
ab reload >/dev/null
sleep 3
hidratado >/dev/null

# --- C) Honesto: Cronograma IVS ---
echo "== C) Honesto: sem perguntas → sem contador 0/0, Recarregar fica =="
goto_resumos || echo "  goto_resumos FALHOU"
open_resumo 'Cronograma'
ab eval "(() => { const dlg = document.querySelector('[role=dialog]'); const per = [...dlg.querySelectorAll('label')].filter(l => l.querySelector('[role=checkbox]')); const cnt = [...dlg.querySelectorAll('span')].find(s => /perguntas respondidas/.test(s.textContent)); const recarregar = [...dlg.querySelectorAll('button')].find(b => b.textContent.includes('Recarregar')); return JSON.stringify({ nPerguntas: per.length, contador: cnt?.textContent?.trim() ?? 'AUSENTE (correto)', recarregarVivo: !!recarregar }); })()"
ab press Escape >/dev/null

# --- D) Console da sessão ---
echo "== D) Console da sessão =="
ab errors

kill $SRV 2>/dev/null
sleep 1
echo "== servidor encerrado; E2E completo =="
