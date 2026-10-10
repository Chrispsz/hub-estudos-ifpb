#!/bin/bash
# t190 E2E — A ÚLTIMA RÉGUA VELHA (single-call)
# Cenário: DUAS corridas injetadas (a de ontem + a de hoje — a forma real do
# QA da t189): Álgebra INTEIRO pulado HOJE (mas respondido ontem: 2C+1N) e
# Lógica mista hoje (2C+1N+4P → 67% sobre respondidas) com bloco INTEIRO
# pulado ONTEM. A régua velha (solved/TOTAL) diria: Álgebra 0% e Lógica 29%.
# A casa honesta deve dizer: Álgebra "pulou tudo" (zinc, foco) e Lógica 67%.
# Superfícies provadas:
#  (1) HOME — chips "foco da prova" (pulou tudo em zinc + 67% + sem 0%/29%);
#  (2) PRONTIDÃO — diálogo do score (média renormalizada + confissão do bloco);
#  (3) PROGRESSO — histórico "Tendência por tópico" (barra OCA, "pulou tudo",
#      chip "sem taxa", badge "sem Δ", badge "foco:" no pulado);
#  (4) mobile 390 sem overflow; console 0 erros/0 avisos.
# Lições da casa: espera VERIFICÁVEL por eval; texto procurado por substring
# simples (sem aspas escapadas no grep); state injection em UMA eval.

set -u
cd /home/z/my-project
PORT=3100
BASE="http://localhost:$PORT"
DL=/home/z/my-project/download

pkill -f "standalone/server.js" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

PORT=$PORT NODE_ENV=production nohup bun .next/standalone/server.js > /tmp/e2e190-server.log 2>&1 &
SRV=$!
UP=""
for i in $(seq 1 30); do
  CODE=$(curl -s -m 2 -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then UP="sim (tentativa $i)"; break; fi
  sleep 2
done
echo "SERVIDOR: ${UP:-NAO SUBIU}"
[ -z "$UP" ] && tail -5 /tmp/e2e190-server.log && exit 1

AUDIT=$(curl -s -m 5 "$BASE/api/audit" | head -c 120)
echo "AUDIT: $AUDIT"

# viewport desktop fixo (o viewport persiste entre sessões do agent-browser)
agent-browser set viewport 1366 900 >/dev/null 2>&1 || agent-browser viewport 1366 900 >/dev/null 2>&1 || true

# --- sessão limpa + INJEÇÃO do estado em UMA eval ---
agent-browser open "$BASE" >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
agent-browser console --clear >/dev/null 2>&1 || true

INJ=$(agent-browser eval "(() => {
  const q = (t, s) => ({ disciplineCode: 'TEC.1984', topic: t, status: s, difficulty: 'medio', statement: 'q' });
  const runHoje = {
    id: 'qa190-hoje', date: '2026-09-29T21:00:00-03:00', mode: 'simulado',
    durationSec: 1817, total: 10, solved: 2, missed: 1, skipped: 7,
    filters: { discipline: 'TEC.1984' },
    questions: [ q('Álgebra Matricial','skipped'), q('Álgebra Matricial','skipped'), q('Álgebra Matricial','skipped'),
      q('Lógica Matemática','solved'), q('Lógica Matemática','solved'), q('Lógica Matemática','missed'),
      q('Lógica Matemática','skipped'), q('Lógica Matemática','skipped'), q('Lógica Matemática','skipped'), q('Lógica Matemática','skipped') ],
  };
  const runOntem = {
    id: 'qa190-ontem', date: '2026-09-28T21:00:00-03:00', mode: 'simulado',
    durationSec: 1500, total: 4, solved: 2, missed: 1, skipped: 1,
    filters: { discipline: 'TEC.1984' },
    questions: [ q('Álgebra Matricial','solved'), q('Álgebra Matricial','missed'), q('Álgebra Matricial','solved'),
      q('Lógica Matemática','skipped') ],
  };
  localStorage.setItem('hub-estudos-ifpb:v2', JSON.stringify({ simuladoRuns: [runHoje, runOntem] }));
  return 'injetado';
})()" 2>/dev/null)
echo "INJECAO: $INJ"

# recarrega com o estado injetado
agent-browser open "$BASE" >/dev/null 2>&1
agent-browser console --clear >/dev/null 2>&1 || true

# espera VERIFICÁVEL: a faixa "foco da prova" existe (hidratado + trends)
READY=""
for i in $(seq 1 20); do
  R=$(agent-browser eval "document.body.textContent.includes('foco da prova') ? 'pronto' : 'nao'" 2>/dev/null)
  echo "$R" | grep -q "pronto" && READY="sim (tentativa $i)" && break
  sleep 2
done
echo "HIDRATACAO: ${READY:-FALHOU}"
[ -z "$READY" ] && exit 1

# normalização anti-escape (lição t189): o eval devolve JSON com aspas
# ESCAPADAS — strip de backslashes antes de qualquer grep de aspas
clean() { printf '%s' "$1" | tr -d '\\'; }

# --- (1) HOME: os chips "foco da prova" ---
HOMEchk=$(agent-browser eval "(() => {
  const label = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'foco da prova:');
  const row = label ? label.parentElement : null;
  const chipAlg = row ? [...row.querySelectorAll('span')].find(s => s.className && String(s.className).includes('rounded-full') && s.textContent && s.textContent.startsWith('Álgebra Matricial')) : null;
  const chipLog = row ? [...row.querySelectorAll('span')].find(s => s.className && String(s.className).includes('rounded-full') && s.textContent && s.textContent.startsWith('Lógica Matemática')) : null;
  const playAlg = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Treinar só Álgebra Matricial no Simulado Pro');
  return JSON.stringify({
    temRow: !!row,
    temPulou: row ? row.textContent.includes('pulou tudo') : null,
    tem67: row ? row.textContent.includes('67%') : null,
    tem0: row ? row.textContent.includes('0%') : null,
    tem29: row ? row.textContent.includes('29%') : null,
    chipAlgZinc: chipAlg ? String(chipAlg.className).includes('zinc') : null,
    chipAlgTxt: chipAlg ? chipAlg.textContent : null,
    chipLogTxt: chipLog ? chipLog.textContent : null,
    playAlgFoco: !!playAlg,
  });
})()" 2>/dev/null)
HOMEchk=$(clean "$HOMEchk")
echo "HOME_CHIPS: $HOMEchk"
echo "$HOMEchk" | grep -q '"temRow":true' && echo "$HOMEchk" | grep -q '"temPulou":true' && echo "$HOMEchk" | grep -q '"tem67":true' && \
echo "$HOMEchk" | grep -q '"tem0":false'    && echo "$HOMEchk" | grep -q '"tem29":false' && \
echo "$HOMEchk" | grep -q '"chipAlgZinc":true' && echo "$HOMEchk" | grep -q '"playAlgFoco":true' && \
echo "$HOMEchk" | grep -q '"chipLogTxt":"Lógica Matemática67%"' && echo "PASS home chips" || echo "FAIL home chips"

# screenshot da faixa (desktop)
agent-browser eval "(() => { const el = [...document.querySelectorAll('div')].find(d => d.className && String(d.className).includes('border-t') && [...d.children].some(c => c.textContent && c.textContent.includes('foco da prova'))); if (el) el.scrollIntoView({block:'center'}); return 'ok'; })()" >/dev/null 2>&1
sleep 1
agent-browser screenshot "$DL/qa190-home-foco.png" >/dev/null 2>&1 && echo "print: qa190-home-foco.png"

# --- (2) PRONTIDÃO: diálogo do score ---
agent-browser eval "(() => { const b = document.querySelector('button[aria-label=\"Abrir plano completo com as evidências do score de prontidão\"]'); b && b.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 1.5
RDchk=$(agent-browser eval "(() => {
  const dlg = document.querySelector('[role=\"dialog\"]');
  if (!dlg) return JSON.stringify({ erro: 'sem dialog' });
  const t = dlg.textContent;
  const zincRow = [...dlg.querySelectorAll('div')].some(d => d.title && String(d.title).includes('bloco inteiro pulado'));
  return JSON.stringify({
    temConfissao: t.includes('sem taxa (bloco pulado): Álgebra Matricial'),
    temPulou: t.includes('pulou tudo'),
    tem67: t.includes('67%'),
    tem0NoDominio: /Álgebra Matricial[^A-Z]*0%/.test(t),
    titleHonesto: zincRow,
  });
})()" 2>/dev/null)
RDchk=$(clean "$RDchk")
echo "PRONTIDAO: $RDchk"
echo "$RDchk" | grep -q '"temConfissao":true' && echo "$RDchk" | grep -q '"temPulou":true' && \
echo "$RDchk" | grep -q '"tem67":true'       && echo "$RDchk" | grep -q '"tem0NoDominio":false' && \
echo "$RDchk" | grep -q '"titleHonesto":true' && echo "PASS prontidao" || echo "FAIL prontidao"
agent-browser screenshot "$DL/qa190-readiness-pulado.png" >/dev/null 2>&1 && echo "print: qa190-readiness-pulado.png"
agent-browser press Escape >/dev/null 2>&1
sleep 0.8

# --- (3) PROGRESSO: histórico "Tendência por tópico" ---
agent-browser open "$BASE/#/progress" >/dev/null 2>&1
HIST=""
for i in $(seq 1 15); do
  R=$(agent-browser eval "document.body.textContent.includes('Tendência por tópico') ? 'pronto' : 'nao'" 2>/dev/null)
  echo "$R" | grep -q "pronto" && HIST="sim (tentativa $i)" && break
  sleep 2
done
echo "HISTORICO: ${HIST:-FALHOU}"
if [ -n "$HIST" ]; then
  Hchk=$(agent-browser eval "(() => {
    const head = [...document.querySelectorAll('p')].find(p => p.textContent.includes('Tendência por tópico'));
    const sec = head ? head.closest('div.rounded-lg') || head.parentElement.parentElement : document.body;
    const t = sec.textContent || '';
    const oca = [...sec.querySelectorAll('span')].some(s => s.className && String(s.className).includes('border-dashed') && String(s.className).includes('zinc'));
    const rowAlg = [...sec.querySelectorAll('div.group')].find(d => d.textContent.includes('Álgebra Matricial'));
    const rowLog = [...sec.querySelectorAll('div.group')].find(d => d.textContent.includes('Lógica Matemática'));
    return JSON.stringify({
      temPulouTudo: t.includes('pulou tudo'),
      temSemTaxa: t.includes('sem taxa'),
      temSemDelta: t.includes('sem Δ'),
      temFoco: t.includes('foco:'),
      barraOca: oca,
      algPulou: rowAlg ? rowAlg.textContent.includes('pulou tudo') : null,
      algSem0: rowAlg ? !rowAlg.textContent.includes('0%') : null,
      log67: rowLog ? rowLog.textContent.includes('67%') : null,
      logSem29: rowLog ? !rowLog.textContent.includes('29%') : null,
    });
  })()" 2>/dev/null)
  Hchk=$(clean "$Hchk")
  echo "HISTORICO_CHK: $Hchk"
  echo "$Hchk" | grep -q '"temPulouTudo":true' && echo "$Hchk" | grep -q '"temSemTaxa":true' && \
  echo "$Hchk" | grep -q '"temSemDelta":true' && echo "$Hchk" | grep -q '"barraOca":true' && \
  echo "$Hchk" | grep -q '"algPulou":true'    && echo "$Hchk" | grep -q '"algSem0":true' && \
  echo "$Hchk" | grep -q '"log67":true'       && echo "$Hchk" | grep -q '"logSem29":true' && \
  echo "$Hchk" | grep -q '"temFoco":true' && echo "PASS historico" || echo "FAIL historico"
  agent-browser eval "(() => { const head = [...document.querySelectorAll('p')].find(p => p.textContent.includes('Tendência por tópico')); const el = head ? (head.closest('div.rounded-lg') || head.parentElement.parentElement) : null; if (el) el.scrollIntoView({block:'center'}); return 'ok'; })()" >/dev/null 2>&1
  sleep 1
  agent-browser screenshot "$DL/qa190-historico-tendencia.png" >/dev/null 2>&1 && echo "print: qa190-historico-tendencia.png"
fi

# --- (4) MOBILE 390: a faixa na home sem overflow ---
agent-browser set viewport 390 844 >/dev/null 2>&1 || agent-browser viewport 390 844 >/dev/null 2>&1 || true
agent-browser open "$BASE" >/dev/null 2>&1
sleep 3
Mchk=$(agent-browser eval "JSON.stringify({w: document.documentElement.scrollWidth, iw: window.innerWidth, temPulou: document.body.textContent.includes('pulou tudo')})" 2>/dev/null)
Mchk=$(clean "$Mchk")
echo "MOBILE390: $Mchk"
echo "$Mchk" | grep -q '"w":390' && echo "$Mchk" | grep -q '"temPulou":true' && echo "PASS mobile390" || echo "FAIL mobile390"
agent-browser screenshot "$DL/qa190-mobile390-foco.png" >/dev/null 2>&1 && echo "print: qa190-mobile390-foco.png"

# volta ao desktop para a sessão seguinte
agent-browser set viewport 1366 900 >/dev/null 2>&1 || agent-browser viewport 1366 900 >/dev/null 2>&1 || true

# --- CONSOLE ---
echo "--- CONSOLE (erros/avisos) ---"
CONSOLE=$(agent-browser console 2>/dev/null | rg -i "error|warn" | head -5)
if [ -n "$CONSOLE" ]; then echo "$CONSOLE"; else echo "(console limpo)"; fi

# --- higiene: chave limpa ao fim (origem :3100 só) ---
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
echo "HIGIENE: chave limpa"
