#!/usr/bin/env bash
# ============================================================================
# QA136 — VARREDURA DOS 4 DIAS CRÍTICOS (Task 136 · QA de entrada)
#
# A semana da prova é a semana do app: TER 29/09 = o dia (simulado + S3),
# QUA 30/09 = véspera, QUI 01/10 = PROVA, SEX 02/10 = nota + destrava.
# A varredura planta o relógio de cada dia (init-script, sessão nova —
# lição 133) e pergunta ao app: QUE DIA É HOJE? O que a casa diz tem que
# ser a voz certa do dia — nem ausente, nem atrasada, nem ruidosa.
# Cada dia deixa screenshot para a vistoria visual (estilo é obrigatório).
# HIGIENE: chão zerado por dia · console 0 · SESSÃO FECHADA no fim.
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
MOCKJS="/tmp/qa136-mock.js"

write_mock() { # $1 = ISO — a receita da t134 (class extends Date; zero recursão)
cat > "$MOCKJS" <<EOF
(function(){
  var M = new Date('$1').getTime();
  class FD extends Date {
    constructor(...args){ args.length===0 ? super(M) : super(...args); }
    static now(){ return M; }
  }
  window.Date = FD;
})();
EOF
}

open_day() { # $1 ISO · $2 toDateString esperado · $3 url
  write_mock "$1"
  local got
  for _ in 1 2 3; do
    agent-browser close >/dev/null 2>&1
    sleep 3
    agent-browser open --init-script "$MOCKJS" "http://localhost:3000$3" >/dev/null 2>&1
    sleep 6
    got=$(agent-browser eval "new Date().toDateString()" 2>/dev/null | tr -d '"')
    if [ "$got" = "$2" ]; then qa_clean_all >/dev/null 2>&1; return 0; fi
  done
  qa_bad "mock do dia $2 falhou (got: $got)"
  return 1
}

day_report() { # $1 tag · $2 screenshot — imprime a voz da casa no dia
  agent-browser snapshot >/tmp/qa136-$1.txt 2>&1
  agent-browser screenshot "/tmp/qa136-$2.png" >/dev/null 2>&1
  echo "---- $1 ----"
  grep -oE '"[^"]{10,160}' /tmp/qa136-$1.txt | grep -iE "hoje|amanhã|prova|simulado|entrega|vesper|véspera|nota|descans|dormir|boa" | head -8
}

echo "== [29/09] O DIA — simulado + S3 =="
if open_day "2026-09-29T09:00:00" "Tue Sep 29 2026" "/"; then
  day_report dia29 dia29
  qa_has "Hoje é o dia do Simulado" || qa_bad "29/09: faixa do dia ausente"
else exit 1; fi

echo ""
echo "== [30/09] VÉSPERA da prova =="
if open_day "2026-09-30T09:00:00" "Wed Sep 30 2026" "/"; then
  day_report ves30 ves30
  grep -iE "véspera|vespera|folha|119|125" /tmp/qa136-ves30.txt | head -5
else exit 1; fi

echo ""
echo "== [01/10] DIA DA PROVA =="
if open_day "2026-10-01T08:30:00" "Thu Oct 01 2026" "/"; then
  day_report prova01 prova01
  grep -iE "prova|boa|hoje" /tmp/qa136-prova01.txt | head -6
else exit 1; fi

echo ""
echo "== [02/10] NOTA + destrava =="
if open_day "2026-10-02T09:00:00" "Fri Oct 02 2026" "/"; then
  day_report nota02 nota02
  grep -iE "nota|calculadora|após|apos" /tmp/qa136-nota02.txt | head -6
else exit 1; fi

echo ""
qa_console_errors
agent-browser close >/dev/null 2>&1
echo "== higiene: chão zerado + sessão fechada =="
exit $QA_FAIL
