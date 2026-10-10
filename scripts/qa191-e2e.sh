#!/bin/bash
# t191 E2E — O DEBRIEF DA PROVA REAL (single-call, standalone :3100, build FRESCO)
# Cenário: 02/10 (pós-prova) — o dono volta da Av1 e abre o Hub.
# Prova: (1) card pós-prova com a pergunta "Como foi a prova, por tópico?" e 6 chips
#        (2 tópicos × 3 níveis); (2) clique "Travei" em Lógica → chip veste rose +
#        recibo no localStorage + toast; (3) Recuperação confessa "autoavaliação da
#        prova: Lógica — travei" sem reload; (4) Ajuste: "Não caiu" sobrescreve;
#        (5) mobile 390 sem overflow; (6) console limpo.
set -u
cd /home/z/my-project
PORT=3100
BASE="http://localhost:$PORT"
DIR=/home/z/my-project/scripts

pkill -f "standalone/server.js" 2>/dev/null
sleep 1
PORT=$PORT NODE_ENV=production nohup bun .next/standalone/server.js > /tmp/e2e191-server.log 2>&1 &
SRV=$!
UP=""
for i in $(seq 1 30); do
  CODE=$(curl -s -m 2 -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then UP="sim (tentativa $i)"; break; fi
  sleep 2
done
echo "SERVIDOR: ${UP:-NAO SUBIU}"
[ -z "$UP" ] && tail -5 /tmp/e2e191-server.log && exit 1
AUDIT=$(curl -s -m 5 "$BASE/api/audit" | head -c 120)
echo "AUDIT: $AUDIT"

# init script: Date mock 02/10/2026 21:30 Brasília (a noite do pós-prova)
cat > $DIR/qa191-e2e-init.js <<'EOF'
(function () {
  try {
    var FAKE = new Date('2026-10-02T00:30:00Z').getTime(); // 21:30 de 01/10 em Brasília
    var RealDate = Date;
    function FakeDate(...args) {
      if (args.length === 0) return new RealDate(FAKE);
      return new RealDate(...args);
    }
    FakeDate.prototype = RealDate.prototype;
    Object.getOwnPropertyNames(RealDate).forEach(function (p) { try { FakeDate[p] = RealDate[p]; } catch (e) {} });
    FakeDate.now = function () { return FAKE; };
    window.Date = FakeDate;
  } catch (e) {}
})();
EOF

agent-browser close --all >/dev/null 2>&1
sleep 1
agent-browser open --init-script "$DIR/qa191-e2e-init.js" >/dev/null 2>&1
agent-browser set viewport 1366 900 >/dev/null 2>&1 || true
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
agent-browser console --clear >/dev/null 2>&1 || true
agent-browser open "$BASE" >/dev/null 2>&1

READY=""
for i in $(seq 1 20); do
  R=$(agent-browser eval "document.body && document.body.textContent.includes('Prova de Matemática (Av1) realizada') ? 'pronto' : 'nao'" 2>/dev/null)
  echo "$R" | grep -q "pronto" && READY="sim (tentativa $i)" && break
  sleep 2
done
echo "CARD POS-PROVA: ${READY:-NAO APARECEU}"
[ -z "$READY" ] && exit 1

echo "=== 1. O DEBRIEF NO CARD ==="
agent-browser eval "(() => {
  const t = document.body.textContent;
  return JSON.stringify({
    pergunta: t.includes('Como foi a prova, por tópico?'),
    tranquilos: (t.match(/Tranquilo/g) || []).length,
    traveis: (t.match(/Travei/g) || []).length,
    naoCaiu: (t.match(/Não caiu/g) || []).length,
    matrizes: t.includes('Matrizes'),
    logica: t.includes('Lógica'),
    calculadora: t.includes('Abrir a Calculadora')
  });
})()" 2>/dev/null | tr -d '\\'

echo "=== 2. SCREENSHOT ANTES ==="
agent-browser eval "document.querySelector('[class*=rounded-xl]')?.scrollIntoView({block:'center'}); 'rolado'" >/dev/null 2>&1
sleep 1
agent-browser screenshot $DIR/qa191-posprova-antes.png >/dev/null 2>&1 && echo "salvo"

echo "=== 3. CLICAR TRAVEI em LÓGICA (o chip do tópico Lógica, nível Travei) ==="
CLICKED=$(agent-browser eval "(() => {
  const rows = [...document.querySelectorAll('div')].filter(d => d.children.length >= 2 && d.textContent.includes('Lógica') && d.textContent.includes('Travei') && d.textContent.includes('Não caiu') && d.textContent.includes('Matrizes') === false);
  const row = rows[rows.length-1];
  if (!row) return 'row nao achada';
  const btn = [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Travei');
  if (!btn) return 'botao nao achado';
  btn.click();
  return 'clicado';
})()" 2>/dev/null | tr -d '\\')
echo "CLIQUE: $CLICKED"
sleep 1.5

echo "=== 4. ESTADO PÓS-CLIQUE ==="
agent-browser eval "(() => {
  const raw = localStorage.getItem('hub:math-exam:v1:prova-real');
  let saved = null; try { saved = JSON.parse(raw); } catch (e) {}
  return JSON.stringify({
    salvo: !!raw,
    logica: saved && saved.perTopic ? saved.perTopic['Lógica Matemática'] : null,
    registeredAt: saved && saved.registeredAt ? 'sim' : 'não',
    recibo: document.body.textContent.includes('registrado') && document.body.textContent.includes('toque para ajustar'),
    toast: document.body.textContent.includes('Debrief da prova salvo')
  });
})()" 2>/dev/null | tr -d '\\'

echo "=== 5. RECUPERAÇÃO CONFESSA (sem reload) ==="
agent-browser eval "(() => {
  const el = [...document.querySelectorAll('p')].find(p => p.textContent.includes('autoavaliação da prova'));
  return JSON.stringify({ confissao: el ? el.textContent : null });
})()" 2>/dev/null | tr -d '\\'

echo "=== 6. SCREENSHOT DEPOIS ==="
agent-browser screenshot $DIR/qa191-posprova-depois.png >/dev/null 2>&1 && echo "salvo"

echo "=== 7. AJUSTE: Não caiu sobrescreve (recibo = último toque) ==="
agent-browser eval "(() => {
  const rows = [...document.querySelectorAll('div')].filter(d => d.children.length >= 2 && d.textContent.includes('Lógica') && d.textContent.includes('Travei') && d.textContent.includes('Não caiu') && d.textContent.includes('Matrizes') === false);
  const row = rows[rows.length-1];
  const btn = row && [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Não caiu');
  if (!btn) return 'botao nao achado';
  btn.click();
  return 'clicado';
})()" 2>/dev/null | tr -d '\\'
sleep 1.5
agent-browser eval "(() => {
  let saved = null; try { saved = JSON.parse(localStorage.getItem('hub:math-exam:v1:prova-real')); } catch (e) {}
  return JSON.stringify({ logica: saved && saved.perTopic ? saved.perTopic['Lógica Matemática'] : null });
})()" 2>/dev/null | tr -d '\\'

echo "=== 8. RELOAD: o registro sobrevive ==="
agent-browser open "$BASE" >/dev/null 2>&1
sleep 3
agent-browser eval "(() => {
  let saved = null; try { saved = JSON.parse(localStorage.getItem('hub:math-exam:v1:prova-real')); } catch (e) {}
  const t = document.body.textContent;
  return JSON.stringify({
    sobreviveu: saved && saved.perTopic ? saved.perTopic['Lógica Matemática'] : null,
    chipNaoCaiuAtivo: t.includes('Não caiu'),
    card: t.includes('Como foi a prova, por tópico?')
  });
})()" 2>/dev/null | tr -d '\\'

echo "=== 9. MOBILE 390 ==="
agent-browser set viewport 390 844 >/dev/null 2>&1 || true
agent-browser open "$BASE" >/dev/null 2>&1
sleep 3
agent-browser eval "JSON.stringify({innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > window.innerWidth})" 2>/dev/null | tr -d '\\'
agent-browser eval "document.querySelector('[class*=rounded-xl]')?.scrollIntoView({block:'center'}); 'rolado'" >/dev/null 2>&1
sleep 1
agent-browser screenshot $DIR/qa191-posprova-mobile390.png >/dev/null 2>&1 && echo "salvo"

echo "=== 10. CONSOLE ==="
agent-browser console 2>/dev/null | grep -iE "error|warn" | head -6
echo "console-fim"

agent-browser close --all >/dev/null 2>&1
echo "E2E t191 COMPLETO"
