#!/usr/bin/env bash
# t130 sweep: rodar os candidatos data-rot restantes ANTES de editar (método 128/129)
cd /home/z/my-project
for t in t88 t94 t105-ensaio t108 t111 t113 t115 t116 t120; do
  echo "=== $t ===" >> /tmp/t130-sweep.log
  if bash scripts/$t-e2e.sh > /tmp/t130-$t.out 2>&1; then
    echo "GREEN" >> /tmp/t130-sweep.log
  else
    echo "RED (ver /tmp/t130-$t.out)" >> /tmp/t130-sweep.log
  fi
done
echo "SWEEP_DONE" >> /tmp/t130-sweep.log
