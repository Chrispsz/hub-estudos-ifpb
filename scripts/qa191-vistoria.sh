#!/bin/bash
# qa191 vistoria — VÉSPERA (30/09) e DIA DA PROVA (01/10) com data mockada
# A casa: Date mock via --init-script (padrão qa65), estado injetado em UMA eval,
# screenshots + greps de textos. Dev :3000 (t190 no ar).
set -u
cd /home/z/my-project
AB="agent-browser"
DIR="/home/z/my-project/scripts"
BASE="http://localhost:3000"

cat > $DIR/qa191-init-d1.js <<'EOF'
(function () {
  try {
    var FAKE = new Date('2026-09-30T12:00:00Z').getTime(); // 09:00 Brasília 30/09 (véspera)
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

cat > $DIR/qa191-init-d0.js <<'EOF'
(function () {
  try {
    var FAKE = new Date('2026-10-01T12:00:00Z').getTime(); // 09:00 Brasília 01/10 (DIA DA PROVA)
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

# estado: corrida do simulado 29/09 (Lógica mista 2C+1N+4P=67% sobre respondidas, Álgebra inteiro pulado)
INJ_EVAL="(() => {
  const q = (t, s) => ({ disciplineCode: 'TEC.1984', topic: t, status: s, difficulty: 'medio', statement: 'q' });
  const run = {
    id: 'qa191-simulado', date: '2026-09-29T21:00:00-03:00', mode: 'simulado',
    durationSec: 1817, total: 10, solved: 2, missed: 1, skipped: 7,
    filters: { discipline: 'TEC.1984' },
    questions: [ q('Álgebra Matricial','skipped'), q('Álgebra Matricial','skipped'), q('Álgebra Matricial','skipped'),
      q('Lógica Matemática','solved'), q('Lógica Matemática','solved'), q('Lógica Matemática','missed'),
      q('Lógica Matemática','skipped'), q('Lógica Matemática','skipped'), q('Lógica Matemática','skipped'), q('Lógica Matemática','skipped') ],
  };
  localStorage.setItem('hub-estudos-ifpb:v2', JSON.stringify({ simuladoRuns: [run] }));
  return 'injetado';
})()"

vistoria() {
  local DIA="$1" INIT="$2" TAG="$3"
  $AB close --all >/dev/null 2>&1
  sleep 1
  $AB open --init-script "$INIT" >/dev/null 2>&1
  $AB set viewport 1366 900 >/dev/null 2>&1 || true
  $AB open "$BASE" >/dev/null 2>&1
  sleep 2
  $AB eval "localStorage.clear(); 'limpo'" >/dev/null 2>&1
  $AB eval "$INJ_EVAL" >/dev/null 2>&1
  $AB open "$BASE" >/dev/null 2>&1
  sleep 2
  local READY=""
  for i in $(seq 1 15); do
    R=$($AB eval "document.body && document.body.textContent.length > 200 ? 'pronto' : 'nao'" 2>/dev/null)
    echo "$R" | grep -q "pronto" && READY="sim" && break
    sleep 2
  done
  echo "### DIA=$DIA home: ${READY:-FALHOU}"
  [ -z "$READY" ] && return 1

  echo "=== [$TAG] HOME textos ==="
  $AB eval "(() => {
    const t = document.body.innerText;
    const has = (s) => t.includes(s);
    return JSON.stringify({
      vespProva: has('véspera') || has('Véspera'), folhaPorta: has('Folha do dia'), folhaLink: !!document.querySelector('a[href=\"/folha-revisao\"]'),
      kit: has('Kit'), recitar: has('Recitar'), boaProva: has('Boa prova') || has('boa prova'),
      catchUp: has('catch-up'), provaHoje: has('Prova') || has('prova'), falta1: has('Falta 1 dia') || has('Falta 1'),
      pulouTudo: has('pulou tudo'), semTaxa: has('sem taxa')
    });
  })()" 2>/dev/null
  $AB screenshot $DIR/qa191-$TAG-home.png >/dev/null 2>&1

  echo "=== [$TAG] FOLHA (/folha-revisao) ==="
  $AB open "$BASE/folha-revisao" >/dev/null 2>&1
  sleep 3
  $AB eval "(() => {
    const t = document.body.innerText;
    const has = (s) => t.includes(s);
    return JSON.stringify({
      data30: has('30/09'), data01: has('01/10'), foco: has('FOCO DO SIMULADO'),
      puladas: has('PULADAS') || has('puladas'), kit: has('Kit do dia da prova'),
      formulas: has('Fórmulas'), checklist: has('Checklist'), plano: has('Plano'),
      vespVoice: has('véspera'), provaVoice: has('prova')
    });
  })()" 2>/dev/null
  $AB screenshot $DIR/qa191-$TAG-folha.png >/dev/null 2>&1

  echo "=== [$TAG] mobile 390 home overflow ==="
  $AB set viewport 390 844 >/dev/null 2>&1 || true
  $AB open "$BASE" >/dev/null 2>&1
  sleep 2
  $AB eval "JSON.stringify({innerW: window.innerWidth, scrollW: document.documentElement.scrollW || document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > window.innerWidth})" 2>/dev/null
  $AB screenshot $DIR/qa191-$TAG-mobile390.png >/dev/null 2>&1

  echo "=== [$TAG] mobile 390 folha overflow ==="
  $AB open "$BASE/folha-revisao" >/dev/null 2>&1
  sleep 2
  $AB eval "JSON.stringify({overflow: document.documentElement.scrollWidth > window.innerWidth, scrollW: document.documentElement.scrollWidth})" 2>/dev/null
  $AB screenshot $DIR/qa191-$TAG-mobile390-folha.png >/dev/null 2>&1

  echo "=== [$TAG] console erros/avisos ==="
  $AB console 2>/dev/null | grep -iE "error|warn" | head -8
  echo "fim-console-$TAG"
}

vistoria "30/09 véspera" "$DIR/qa191-init-d1.js" "d1"
vistoria "01/10 prova" "$DIR/qa191-init-d0.js" "d0"
echo "VISTORIA COMPLETA"
