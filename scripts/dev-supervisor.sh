#!/usr/bin/env bash
# Supervisor do dev server (lição da Task 225/226: o sandbox mata o processo
# em silêncio — OOM de Turbopack acumulado ou reaper externo). Este loop
# reergue o servidor em ≤3s sempre que ele cair, com teto de memória.
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=1280" bun run dev >> dev.log 2>&1
  echo "[supervisor] dev server caiu ($(date '+%H:%M:%S')) — reerguendo em 3s" >> dev.log
  sleep 3
done
