#!/bin/bash
# t188 E2E — O ENDEREÇO DA REGRA (single-call: subir + agir + capturar) — v2
# Cenário: corrida real do Simulado Pro com 10 QUESTÕES (o escopo real, dois
# tópicos — a linha do veredito exige multiTopic) com o bloco de Álgebra
# INTEIRO pulado (estratégia: puladas as que o diálogo nomeia Álgebra,
# respondidas as de Lógica) → o debrief cita "pelo plano D-2" (endereço
# derivado — o D-7 velho morreu) e a folha /folha-revisao acorda com o bloco
# pulado no papel ("N puladas", nunca "0%" falso).
# Lições da casa: matar por 'next-server' TAMBÉM; esperas VERIFICÁVEIS; waits
# generosos entre cliques (o E2E v1 clicou cedo e a marca não registrou).

set -u
cd /home/z/my-project
PORT=3100
BASE="http://localhost:$PORT"
DL=/home/z/my-project/download

pkill -f "standalone/server.js" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

PORT=$PORT NODE_ENV=production nohup bun .next/standalone/server.js > /tmp/e2e188-server.log 2>&1 &
SRV=$!
UP=""
for i in $(seq 1 30); do
  CODE=$(curl -s -m 2 -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then UP="sim (tentativa $i)"; break; fi
  sleep 2
done
echo "SERVIDOR: ${UP:-NAO SUBIU}"
[ -z "$UP" ] && tail -5 /tmp/e2e188-server.log && exit 1

AUDIT=$(curl -s -m 5 "$BASE/api/audit" | head -c 120)
echo "AUDIT: $AUDIT"

# --- sessão limpa ---
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
agent-browser open "$BASE/#/practice" >/dev/null 2>&1
agent-browser console --clear >/dev/null 2>&1 || true

# espera VERIFICÁVEL: a porta do banner existe (hidratado)
READY=""
for i in $(seq 1 20); do
  R=$(agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Abrir o Simulado'); return b ? 'pronto' : 'nao'; })()" 2>/dev/null)
  echo "$R" | grep -q "pronto" && READY="sim (tentativa $i)" && break
  sleep 2
done
echo "HIDRATACAO: ${READY:-FALHOU}"
[ -z "$READY" ] && exit 1

# --- abre o setup PELA PORTA DO BANNER (pré-config do escopo oficial:
#     Matemática + 10 questões) e inicia ---
agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Abrir o Simulado'); b && b.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2.5
SETUP=$(agent-browser eval "(() => { const dlg = document.querySelector('[role=dialog]'); if (!dlg) return 'sem-dialog'; const combo = dlg.querySelector('[role=combobox]'); const disc = combo?.textContent.trim() || '?'; if (!/Matemática/.test(disc)) return 'disciplina-errada: ' + disc; const b = [...dlg.querySelectorAll('button')].find(x => /Iniciar simulado/.test(x.textContent)); if (!b) return 'sem-iniciar'; b.click(); return 'iniciou-mat'; })()" 2>/dev/null)
echo "SETUP: $SETUP"

# espera VERIFICÁVEL: a questão 1 está na tela (o run hidratou)
Q1=""
for i in $(seq 1 15); do
  S=$(agent-browser eval "(() => { const dlg = document.querySelector('[role=dialog]'); return dlg && /Questão 1 de 10/.test(dlg.innerText) ? 'q1' : 'aguardando'; })()" 2>/dev/null)
  echo "$S" | grep -q "q1" && Q1="sim (tentativa $i)" && break
  sleep 2
done
echo "QUESTAO-1: ${Q1:-FALHOU}"
[ -z "$Q1" ] && exit 1
sleep 2

# --- a corrida: Álgebra INTEIRA pulada; Lógica respondida (mistura honesta) ---
ANSWER=$(agent-browser eval "(async () => {
  const dlg = document.querySelector('[role=dialog]');
  if (!dlg) return 'sem-dialog';
  const find = (re) => [...dlg.querySelectorAll('button')].find(b => re.test(b.textContent.trim()) && b.offsetParent !== null);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  let log = '';
  for (let n = 0; n < 16; n++) {
    const txt = dlg.innerText;
    const m = txt.match(/Questão (\\d+) de (\\d+)/);
    if (!m) break;
    const alg = /Álgebra Matricial/.test(txt);
    log += alg ? 'P' : 'R';
    if (alg) {
      const prox = find(/^Próxima$/);
      if (!prox) break; // última pergunta
      prox.click(); await wait(350); continue;
    }
    // Lógica: alterna Consegui / Não consegui (a marca auto-avança)
    const par = parseInt(m[1], 10) % 2 === 0;
    const alvo = find(par ? /^Consegui$/ : /^Não consegui$/) || find(/^Consegui$/) || find(/^Não consegui$/);
    if (alvo) { alvo.click(); await wait(400); continue; }
    const prox = find(/^Próxima$/);
    if (prox) { prox.click(); await wait(350); continue; }
    break;
  }
  return log;
})()" 2>/dev/null)
echo "PERGUNTAS (P=pulada R=respondida): $ANSWER"
sleep 1

# --- encerra a corrida ---
ENCERROU=$(agent-browser eval "(async () => {
  const dlg = document.querySelector('[role=dialog]');
  if (!dlg) return 'sem-dialog';
  const find = (re) => [...dlg.querySelectorAll('button')].find(b => re.test(b.textContent.trim()) && b.offsetParent !== null);
  const enc = find(/^Encerrar$/);
  if (!enc) return 'sem-encerrar';
  enc.click();
  await new Promise(r => setTimeout(r, 500));
  const conf = [...(document.querySelector('[role=dialog]')?.querySelectorAll('button') || [])].find(b => /encerrar|confirmar/i.test(b.textContent) && !/^Encerrar$/.test(b.textContent.trim()));
  if (conf) { conf.click(); await new Promise(r => setTimeout(r, 800)); }
  return 'encerrado';
})()" 2>/dev/null)
echo "ENCERRAR: $ENCERROU"
sleep 2

# --- O DEBRIEF cita o endereço DERIVADO do plano ---
DEBRIEF=""
T="?"
for i in $(seq 1 10); do
  T=$(agent-browser eval "(() => { const dlg = document.querySelector('[role=dialog]'); if (!dlg) return 'sem-dialog'; const t = dlg.innerText.replace(/\\s+/g, ' '); if (!/Faltam \\d+pp/.test(t)) return 'aguardando: ' + t.slice(0, 120); return t.includes('pelo plano D-2') && t.includes('o bloco com mais erros vira a revisão de amanhã') ? 'endereco-ok' : 'sem-endereco'; })()" 2>/dev/null)
  echo "$T" | grep -q "endereco-ok" && DEBRIEF="sim (tentativa $i)" && break
  sleep 1.5
done
echo "DEBRIEF-ENDEREÇO: ${DEBRIEF:-FALHOU} (última leitura: $T)"
[ -n "$DEBRIEF" ] && agent-browser screenshot "$DL/qa188-debrief-endereco.png" >/dev/null 2>&1
STATS=$(agent-browser eval "(() => { const dlg = document.querySelector('[role=dialog]'); const t = (dlg?.innerText || '').replace(/\\s+/g, ' '); const nota = t.match(/\\d+% \\d+\\/\\d+ resolvidas/); const alg = t.match(/Álgebra Matricial \\d+\\/\\d+ · \\d+%/); return (nota ? nota[0] : '?') + ' || ' + (alg ? alg[0] : '?'); })()" 2>/dev/null)
echo "STATS-DEBRIEF: $STATS"

# --- fecha o diálogo e abre a folha ---
agent-browser press Escape >/dev/null 2>&1
sleep 1
agent-browser open "$BASE/folha-revisao" >/dev/null 2>&1
FOLHA=""
for i in $(seq 1 15); do
  S=$(agent-browser eval "(() => { const p = [...document.querySelectorAll('p')].find(x => x.textContent.includes('Foco do simulado')); return p ? (p.textContent.includes('chega hoje') ? 'slot' : 'bloco') : 'aguardando'; })()" 2>/dev/null)
  echo "$S" | grep -q "bloco" && FOLHA="sim (tentativa $i)" && break
  sleep 2
done
echo "FOLHA-FOCO: ${FOLHA:-FALHOU} (última leitura: $S)"
FOCO=$(agent-browser eval "(() => { const p = [...document.querySelectorAll('p')].find(x => x.textContent.includes('Foco do simulado')); const bloco = p?.closest('div'); if (!bloco) return 'sem-bloco'; const chip = p.querySelector('span'); return (chip ? chip.textContent.trim() : 'sem-chip') + ' || ' + bloco.innerText.replace(/\\s+/g, ' ').slice(0, 300); })()" 2>/dev/null)
echo "FOCO-PAPEL: $FOCO"
echo "$FOCO" | grep -q "puladas" && echo "$FOCO" | grep -q "bloco inteiro sem tentativa" && echo "PAPEL-PULOU: ok (o chip confessa — zero 0% falso no papel)" || echo "PAPEL-PULOU: VERIFICAR"
agent-browser screenshot "$DL/qa188-folha-foco-pulou.png" >/dev/null 2>&1

# --- mobile 390: sem overflow no papel ---
agent-browser set viewport 390 844 >/dev/null 2>&1 || agent-browser resize 390 844 >/dev/null 2>&1
sleep 1.5
MOBW=$(agent-browser eval "document.documentElement.scrollWidth + '=' + window.innerWidth" 2>/dev/null)
echo "MOBILE: scrollW=innerW → $MOBW"
agent-browser screenshot "$DL/qa188-mobile390-folha.png" >/dev/null 2>&1

# --- console limpo? ---
CON=$(agent-browser console 2>/dev/null | tail -30)
echo "CONSOLE-ERROS: $(echo "$CON" | grep -ci 'error' || true)"
echo "$CON" | grep -i "error" | head -5

# --- higiene ---
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
kill $SRV 2>/dev/null
pkill -f "next-server" 2>/dev/null
echo "E2E t188 CONCLUÍDO"
