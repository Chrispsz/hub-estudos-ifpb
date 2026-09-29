#!/bin/bash
# t189 E2E — A TABELA QUE FALA A LÍNGUA DO VEREDITO (single-call) — v2
# Cenário: corrida OFICIAL (porta do banner, Matemática + 10) com o bloco de
# Álgebra INTEIRO pulado e a Lógica MISTA (2 conseguidas + 1 não + restantes
# puladas). A tabela "Desempenho por tópico" deve:
#  - mostrar "pulou tudo" no bloco inteiro pulado (nunca "0%" falso);
#  - mostrar a taxa sobre RESPONDIDAS no tópico misto (a régua velha com
#    puladas no denominador diria outro número) + "N puladas" à parte;
#  - ordenar pior primeiro (o pulou-tudo antes do misto) e apontar o badge
#    "foco:" e o CTA do drill para o bloco pulado;
#  - manter "pelo plano D-2" no veredito (t188).
# Lições da casa: corrida inteira em UM eval (o vaivém bash↔browser corre
# contra a transição do app); botões casados por PREFIXO real ("Consegui 1",
# "Não consegui 2", "Próxima →") com filtro de retângulos (offsetParent é
# null dentro do diálogo fixo do Radix).

set -u
cd /home/z/my-project
PORT=3100
BASE="http://localhost:$PORT"
DL=/home/z/my-project/download

pkill -f "standalone/server.js" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

PORT=$PORT NODE_ENV=production nohup bun .next/standalone/server.js > /tmp/e2e189-server.log 2>&1 &
SRV=$!
UP=""
for i in $(seq 1 30); do
  CODE=$(curl -s -m 2 -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then UP="sim (tentativa $i)"; break; fi
  sleep 2
done
echo "SERVIDOR: ${UP:-NAO SUBIU}"
[ -z "$UP" ] && tail -5 /tmp/e2e189-server.log && exit 1

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

# --- abre o setup pela porta do banner (escopo oficial) e inicia ---
agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Abrir o Simulado'); b && b.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2.5
SETUP=$(agent-browser eval "(() => { const dlg = document.querySelector('[role=dialog]'); if (!dlg) return 'sem-dialog'; const disc = dlg.querySelector('[role=combobox]')?.textContent.trim() || '?'; if (!/Matemática/.test(disc)) return 'disciplina-errada: ' + disc; const vis = (b) => b.getClientRects().length > 0 && b.getBoundingClientRect().width > 0; const b = [...dlg.querySelectorAll('button')].find(x => /Iniciar simulado/.test(x.textContent) && vis(x)); if (!b) return 'sem-iniciar'; b.click(); return 'iniciou-mat'; })()" 2>/dev/null)
echo "SETUP: $SETUP"

# espera VERIFICÁVEL: a questão 1 de 10 na tela
Q1=""
for i in $(seq 1 15); do
  S=$(agent-browser eval "(() => { const dlg = document.querySelector('[role=dialog]'); return dlg && /Questão 1 de 10/.test(dlg.innerText) ? 'q1' : 'aguardando'; })()" 2>/dev/null)
  echo "$S" | grep -q "q1" && Q1="sim (tentativa $i)" && break
  sleep 2
done
echo "QUESTAO-1: ${Q1:-FALHOU}"
[ -z "$Q1" ] && exit 1
sleep 3

# --- a corrida INTEIRA em um eval (sem corrida bash↔browser) ---
RUN=$(agent-browser eval "(async () => {
  const dlg = document.querySelector('[role=dialog]');
  if (!dlg) return 'sem-dialog';
  const vis = (b) => b.getClientRects().length > 0 && b.getBoundingClientRect().width > 0;
  const btn = (re) => [...dlg.querySelectorAll('button')].find(b => re.test(b.textContent.trim()) && vis(b));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const qnum = () => { const m = dlg.innerText.match(/Questão (\\d+) de/); return m ? +m[1] : 0; };
  let log = '';
  let logicaFeitas = 0;
  for (let n = 0; n < 22; n++) {
    await wait(350);
    const start = qnum();
    if (!start) break;
    const alg = /Álgebra Matricial/.test(dlg.innerText);
    if (alg) {
      log += 'P';
      btn(/^Próxima/)?.click();
    } else {
      logicaFeitas++;
      if (logicaFeitas === 1 || logicaFeitas === 2) { log += 'C'; btn(/^Consegui/)?.click(); }
      else if (logicaFeitas === 3) { log += 'N'; btn(/^Não consegui/)?.click(); }
      else { log += 'P'; btn(/^Próxima/)?.click(); }
    }
    // espera a questão MUDAR (todo gesto avança) — teto 3s
    let mudou = false;
    for (let w = 0; w < 12; w++) {
      await wait(250);
      if (qnum() !== start) { mudou = true; break; }
    }
    if (!mudou) break; // última questão (ou travou — o Encerrar vem fora)
    await wait(300); // settle da transição antes da próxima leitura
  }
  return log;
})()" 2>/dev/null)
echo "PERCURSO (C=consegui N=não P=pulou): $RUN"
sleep 1

# --- encerra a corrida ---
agent-browser eval "(() => { const dlg = document.querySelector('[role=dialog]'); const vis = (b) => b.getClientRects().length > 0 && b.getBoundingClientRect().width > 0; const b = [...(dlg?.querySelectorAll('button')||[])].find(x => /^Encerrar/.test(x.textContent.trim()) && vis(x)); if (!b) return 'sem-encerrar'; b.click(); return 'clicou'; })()" >/dev/null 2>&1
sleep 1
agent-browser eval "(() => { const dlg = document.querySelector('[role=dialog]'); const conf = [...(dlg?.querySelectorAll('button')||[])].find(b => /encerrar|confirmar/i.test(b.textContent) && !/^Encerrar$/.test(b.textContent.trim())); conf && conf.click(); return 'confirmado'; })()" >/dev/null 2>&1
sleep 2.5

# --- O DEBRIEF: asserções da tabela na RÉGUA ÚNICA ---
DEBRIEF=""
T="?"
for i in $(seq 1 10); do
  T=$(agent-browser eval "(() => {
    const dlg = document.querySelector('[role=dialog]');
    if (!dlg) return 'sem-dialog';
    const t = dlg.innerText.replace(/\\s+/g, ' ');
    if (!/Desempenho por tópico/.test(t)) return 'aguardando: ' + t.slice(0, 90);
    // a linha do tópico MISTO: 'Nome S/T · P% · N puladas'
    const misto = t.match(/([A-ZÁ-Ú][\\wà-ú ]+?) (\\d+)\\/(\\d+) · (\\d+)%\\s*(\\d+) puladas/);
    // a régua velha (puladas no denominador) NÃO pode estar na linha
    let reguaOk = false, esperadoVelho = null;
    if (misto) {
      const solved = +misto[2], total = +misto[3], pct = +misto[4], puladas = +misto[5];
      const respondidas = total - puladas;
      reguaOk = pct === Math.round((solved / respondidas) * 100);
      esperadoVelho = Math.round((solved / total) * 100);
    }
    const pulou = t.includes('pulou tudo');
    const endereco = t.includes('pelo plano D-2');
    // ordem pior primeiro: 'pulou tudo' vem ANTES da linha mista
    const idxPulou = t.indexOf('pulou tudo');
    const idxMisto = misto ? t.indexOf(misto[1] + ' ' + misto[2]) : -1;
    const ordemOk = pulou && misto ? idxPulou < idxMisto : true;
    return JSON.stringify({
      temPulouTudo: pulou,
      misto: misto ? misto[0] : null,
      reguaOk, esperadoVelho,
      endereco, ordemOk,
      badgeFoco: (t.match(/foco: [A-ZÁ-Ú][\\wà-ú ]+/) || [null])[0],
      cta: (t.match(/Treinar só [A-ZÁ-Ú][\\wà-ú ]+ \\(\\d+\\/\\d+\\)/) || [null])[0]
    });
  })()" 2>/dev/null)
  echo "$T" | rg -q "temPulouTudo" && DEBRIEF="sim (tentativa $i)" && break
  sleep 1.5
done
echo "DEBRIEF-TABELA: ${DEBRIEF:-FALHOU}"
echo "LEITURA: $T"
[ -n "$DEBRIEF" ] && agent-browser screenshot "$DL/qa189-debrief-tabela.png" >/dev/null 2>&1

# --- fecha e abre a folha: o papel segue na MESMA fonte (t188) ---
agent-browser press Escape >/dev/null 2>&1
sleep 1
agent-browser open "$BASE/folha-revisao" >/dev/null 2>&1
FOLHA=""
for i in $(seq 1 15); do
  S=$(agent-browser eval "(() => { const p = [...document.querySelectorAll('p')].find(x => x.textContent.includes('Foco do simulado')); return p ? (p.textContent.includes('chega hoje') ? 'slot' : 'bloco') : 'aguardando'; })()" 2>/dev/null)
  echo "$S" | grep -q "bloco" && FOLHA="sim (tentativa $i)" && break
  sleep 2
done
FOCO=$(agent-browser eval "(() => { const p = [...document.querySelectorAll('p')].find(x => x.textContent.includes('Foco do simulado')); return p?.closest('div')?.innerText.replace(/\\s+/g, ' ').slice(0, 240) || 'sem-bloco'; })()" 2>/dev/null)
echo "FOLHA-FOCO: ${FOLHA:-FALHOU} → $FOCO"
agent-browser set viewport 1400 900 >/dev/null 2>&1 || agent-browser resize 1400 900 >/dev/null 2>&1
sleep 1.5
agent-browser eval "(() => { const p = [...document.querySelectorAll('p')].find(x => x.textContent.includes('Foco do simulado')); p && p.scrollIntoView({ block: 'center' }); return 'ok'; })()" >/dev/null 2>&1
sleep 1
agent-browser screenshot "$DL/qa189-folha-foco.png" >/dev/null 2>&1

# --- console limpo? ---
CON=$(agent-browser console 2>/dev/null | tail -30)
echo "CONSOLE-ERROS: $(echo "$CON" | grep -ci 'error' || true)"
echo "$CON" | grep -i "error" | head -5

# --- higiene ---
agent-browser eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
kill $SRV 2>/dev/null
pkill -f "next-server" 2>/dev/null
echo "E2E t189 CONCLUÍDO"
