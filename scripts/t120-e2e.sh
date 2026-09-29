#!/bin/bash
# Task 120 — O SELO DO PAPEL: a folha impressa não sabe que dia é. O selo
# print-only no cabeçalho diz 'Impresso em dd/mm' e nomeia o marco da semana
# da Av1 quando a impressão cai num dia dele (28 véspera do simulado, 29 o
# ensaio, 30 véspera da prova, 01 a prova) — fonte única examWeekMilestoneFor
# (restaurada na 120). Este E2E: [1] o selo EXISTE no DOM e está OCULTO na
# tela (getComputedStyle display:none); [2] o texto é EXATAMENTE o esperado
# para o dia real (computado do relógio do BASH — data-agnóstico, nunca mais
# bomba de 24h; lição 117/120); [3] o selo é print:block (o papel recebe) e
# a folha segue renderizando 5 seções/15 katex (regressão 119); [4] higiene.
set -u
cd /home/z/my-project

FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t120.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

echo "=== [1] O SELO EXISTE E DORME NA TELA ==="
agent-browser open http://localhost:3000/folha-revisao >/dev/null 2>&1
sleep 5
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
STAMP=$(agent-browser eval "(function(){var el=document.querySelector('[data-testid=\"folha-print-stamp\"]');if(!el)return 'NOELEMENT';var d=getComputedStyle(el).display;return 'display='+d})()" 2>/dev/null | tr -d '"')
case "$STAMP" in
  display=none) ok "selo presente no DOM e oculto na tela ($STAMP — a tela não precisa do selo)";;
  display=*) bad "selo VISÍVEL na tela: $STAMP";;
  *) bad "selo ausente do DOM: $STAMP";;
esac

echo "=== [2] O TEXTO É O ESPERADO PARA O DIA REAL (data-agnóstico) ==="
EXPECTED="Impresso em $(date +%d/%m)"
case "$(date +%Y-%m-%d)" in
  2026-09-28) EXPECTED="$EXPECTED · Véspera do simulado" ;;
  2026-09-29) EXPECTED="$EXPECTED · Simulado da Av1" ;;
  2026-09-30) EXPECTED="$EXPECTED · Véspera da prova" ;;
  2026-10-01) EXPECTED="$EXPECTED · Prova da Av1" ;;
esac
TEXT=$(agent-browser eval "(function(){var el=document.querySelector('[data-testid=\"folha-print-stamp\"]');return el?el.textContent.replace(/\s+/g,' ').trim():''})()" 2>/dev/null | tr -d '"')
if [ "$TEXT" = "$EXPECTED" ]; then
  ok "selo diz: '$TEXT'"
else
  bad "selo errado: '$TEXT' vs esperado '$EXPECTED'"
fi

echo "=== [3] O PAPEL RECEBE (print:block) + regressão 119 ==="
CLS=$(agent-browser eval "(function(){var el=document.querySelector('[data-testid=\"folha-print-stamp\"]');return el?el.className:''})()" 2>/dev/null | tr -d '"')
echo "$CLS" | grep -q 'hidden' && echo "$CLS" | grep -q 'print:block' && ok "selo é gêmea de papel: hidden na tela + print:block (a mesma gramática da 119)" || bad "classes do selo erradas: $CLS"
KATEX=$(agent-browser eval "document.querySelectorAll('.katex').length" 2>/dev/null | tr -d '"')
[ "$KATEX" = "15" ] && ok "15 katex à vista (regressão 119 intocada)" || bad "katex mudou: $KATEX"

echo "=== [4] HIGIENE + CONSOLE ==="
S=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub-estudos-ifpb:v2')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $S"
case "$S" in *runs=0*poke=0*realGrades=0*) ok "storage limpo (a folha não escreve nada)";; *) bad "resíduo: $S";; esac
C=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$C" = "0" ] && ok "console: 0 erros" || bad "console tem $C erros"

[ "$FAIL" = "0" ] && echo "ALL GREEN — t120 o selo do papel (a folha impressa sabe que dia é)" || echo "FAIL — ver [FAIL] acima"
exit $FAIL
