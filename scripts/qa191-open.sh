#!/bin/bash
# qa191 v2 — QA de abertura (dev :3000) — retry com viewport fixo
AB="agent-browser"
DIR="/home/z/my-project/scripts"
BASE="http://localhost:3000"

$AB open "$BASE" >/dev/null 2>&1
sleep 2
$AB set viewport 1440 900 >/dev/null 2>&1 || true
sleep 1
$AB open "$BASE" >/dev/null 2>&1

READY=""
for i in $(seq 1 15); do
  R=$($AB eval "document.body && document.body.textContent.length > 200 ? 'pronto' : 'nao'" 2>/dev/null)
  echo "$R" | grep -q "pronto" && READY="sim (tentativa $i)" && break
  sleep 2
done
echo "PAGINA: ${READY:-NAO CARREGOU}"
[ -z "$READY" ] && exit 1

echo "=== URL/TITLE ==="
$AB get url
$AB get title

echo "=== TEXTOS-CHAVE DA HOME ==="
$AB eval "(() => {
  const t = document.body.innerText;
  const has = (s) => t.includes(s) ? 'SIM' : 'não';
  return JSON.stringify({
    simulado: has('Simulado'), av1: has('Av1'), folha: has('Folha'),
    kit: has('Kit'), foco: has('foco da prova'), erroApp: has('Application error')
  });
})()" 2>/dev/null

echo "=== HIGIENE SCROLL (1440) ==="
$AB eval "JSON.stringify({innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth})" 2>/dev/null

echo "=== CONSOLE ==="
$AB console 2>/dev/null | grep -iE "error|warn" | head -10
echo "console-fim"
$AB screenshot $DIR/qa191-home-noite.png 2>/dev/null
