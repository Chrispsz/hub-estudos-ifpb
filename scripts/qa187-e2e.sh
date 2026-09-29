#!/bin/bash
# t187 E2E — O DEEP-LINK DA AUTOAVALIAÇÃO (single-call: subir + agir + capturar)
# Lições da casa: matar por 'next-server' TAMBÉM; esperas VERIFICÁVEIS (eval que
# devolve estado, teto de tentativas); console do agent-browser acumula (marcar sessão).

set -u
cd /home/z/my-project
PORT=3100
BASE="http://localhost:$PORT"
DL=/home/z/my-project/download

pkill -f "standalone/server.js" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

PORT=$PORT NODE_ENV=production nohup bun .next/standalone/server.js > /tmp/e2e187-server.log 2>&1 &
SRV=$!
UP=""
for i in $(seq 1 30); do
  CODE=$(curl -s -m 2 -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then UP="sim (tentativa $i)"; break; fi
  sleep 2
done
echo "SERVIDOR: ${UP:-NAO SUBIU}"
[ -z "$UP" ] && tail -5 /tmp/e2e187-server.log && exit 1

AUDIT=$(curl -s -m 5 "$BASE/api/audit" | head -c 120)
echo "AUDIT: $AUDIT"

# --- sessão limpa ---
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
agent-browser open "$BASE" >/dev/null 2>&1
agent-browser console --clear >/dev/null 2>&1 || true

# espera VERIFICÁVEL: o botão do plano existe (hidratado)
READY=""
for i in $(seq 1 20); do
  R=$(agent-browser eval "(() => { const b = document.querySelector('button[aria-label=\"Abrir plano completo com as evidências do score de prontidão\"]'); return b ? 'pronto' : 'nao'; })()" 2>/dev/null)
  echo "$R" | grep -q "pronto" && READY="sim (tentativa $i)" && break
  sleep 2
done
echo "HIDRATACAO: ${READY:-FALHOU}"
[ -z "$READY" ] && exit 1

D=$(agent-browser eval "document.querySelector('main') ? 'home-ok' : 'sem-main'" 2>/dev/null)
echo "HOME: $D"
agent-browser screenshot "$DL/qa187-home.png" >/dev/null 2>&1

# --- abre o plano completo ---
agent-browser click 'button[aria-label="Abrir plano completo com as evidências do score de prontidão"]' >/dev/null 2>&1
sleep 1
PLAN=$(agent-browser eval "(() => { const chips = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Lógica · Lista')); return chips.length; })()" 2>/dev/null)
echo "CHIPS NO PLANO: $PLAN (esperado >= 1)"
agent-browser screenshot "$DL/qa187-plano-vespera.png" >/dev/null 2>&1

# --- clica o chip 'Matrizes · Aula 00' ---
CLICKED=$(agent-browser eval "(() => { const chip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Matrizes · Aula 00')); if (!chip) return 'sem-chip'; chip.click(); return 'clicado'; })()" 2>/dev/null)
echo "CHIP: $CLICKED"

# espera VERIFICÁVEL: o diálogo do resumo abriu com a seção das perguntas
FAROL=""
for i in $(seq 1 15); do
  S=$(agent-browser eval "(() => { const sec = document.getElementById('resumo-autoavaliacao'); if (!sec) return 'sem-secao'; const r = sec.getBoundingClientRect(); const visivel = r.top < window.innerHeight && r.bottom > 0; return 'secao visivel=' + visivel; })()" 2>/dev/null)
  echo "$S" | grep -q "visivel=true" && FAROL="sim (tentativa $i)" && break
  sleep 1.5
done
echo "FAROL/ANCORA: ${FAROL:-FALHOU}"
FOOT=$(agent-browser eval "(() => { const el = [...document.querySelectorAll('span')].find(s => s.textContent.includes('perguntas respondidas')); return el ? el.textContent.trim() : 'sem-contador'; })()" 2>/dev/null)
echo "RODAPE: $FOOT"
agent-browser screenshot "$DL/qa187-deeplink-farol.png" >/dev/null 2>&1

# --- marca a 1ª pergunta e confere o rodapé + o chip atrás ---
TOG=$(agent-browser eval "(() => { const sec = document.getElementById('resumo-autoavaliacao'); if (!sec) return 'sem-secao'; const cb = sec.querySelector('button[role=checkbox]'); if (!cb) return 'sem-checkbox'; cb.click(); return 'marcado'; })()" 2>/dev/null)
sleep 1
FOOT2=$(agent-browser eval "(() => { const el = [...document.querySelectorAll('span')].find(s => s.textContent.includes('perguntas respondidas')); return el ? el.textContent.trim() : 'sem-contador'; })()" 2>/dev/null)
echo "TOGGLE: $TOG · RODAPE-DEPOIS: $FOOT2"
agent-browser screenshot "$DL/qa187-toggle-esmeralda.png" >/dev/null 2>&1

# fecha o diálogo (ESC) e lê o chip — a contagem ao vivo atrás
agent-browser press Escape >/dev/null 2>&1
sleep 1
CHIPN=$(agent-browser eval "(() => { const chip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Matrizes · Aula 00')); return chip ? 'chip=' + chip.textContent.trim() : 'sem-chip'; })()" 2>/dev/null)
echo "CHIP ATRAS: $CHIPN (esperado '· 1')"

# reabre — a persistência é a prova
agent-browser eval "(() => { const chip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Matrizes · Aula 00')); chip && chip.click(); return 'ok'; })()" >/dev/null 2>&1
PERSIST=""
for i in $(seq 1 15); do
  F=$(agent-browser eval "(() => { const el = [...document.querySelectorAll('span')].find(s => s.textContent.includes('perguntas respondidas')); return el ? el.textContent.trim() : 'aguardando'; })()" 2>/dev/null)
  echo "$F" | grep -q "1 / 8" && PERSIST="sim (tentativa $i)" && break
  sleep 1.5
done
echo "PERSISTENCIA: ${PERSIST:-FALHOU} ($F)"
agent-browser screenshot "$DL/qa187-persistencia.png" >/dev/null 2>&1
agent-browser press Escape >/dev/null 2>&1

# --- console limpo? ---
CON=$(agent-browser console 2>/dev/null | tail -20)
echo "CONSOLE-ERROS: $(echo "$CON" | grep -ci 'error' || true)"
echo "$CON" | grep -i "error" | head -5

# --- mobile 390 ---
agent-browser set viewport 390 844 >/dev/null 2>&1 || agent-browser resize 390 844 >/dev/null 2>&1
sleep 1
agent-browser eval "(() => { const chip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Lógica · Lista')); chip && chip.click(); return 'ok'; })()" >/dev/null 2>&1
MOB=""
for i in $(seq 1 15); do
  S=$(agent-browser eval "(() => { const sec = document.getElementById('resumo-autoavaliacao'); return sec ? 'secao' : 'aguardando'; })()" 2>/dev/null)
  echo "$S" | grep -q "secao" && MOB="sim (tentativa $i)" && break
  sleep 1.5
done
sleep 1.5
MOBW=$(agent-browser eval "document.documentElement.scrollWidth + '=' + window.innerWidth" 2>/dev/null)
echo "MOBILE: farol=$MOB · scrollW=innerW → $MOBW"
agent-browser screenshot "$DL/qa187-mobile390-deeplink.png" >/dev/null 2>&1

# --- higiene ---
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
kill $SRV 2>/dev/null
pkill -f "next-server" 2>/dev/null
echo "E2E t187 CONCLUÍDO"
