#!/bin/bash
# QA de estado da rodada 17:30 (regressão 85/84/83) — single invocation
cd /home/z/my-project
# garante server vivo (reaper do sandbox mata entre invocações)
if ! curl -s -o /dev/null --max-time 3 http://localhost:3000; then
  nohup bun run dev > /tmp/dev.log 2>&1 &
  sleep 8
fi
echo "=== servidor: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000) ==="

agent-browser --clear >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6

echo "=== [1] hero + countdown (data real, Dom 27/09) ==="
agent-browser snapshot 2>/dev/null | grep -iE "faltam|falta|hoje|simulado|prova" | head -8

echo "=== [2] chip do simulado no hero (estados) ==="
agent-browser snapshot 2>/dev/null | grep -iE "Simulado da Av1 em|Amanhã: Simulado|É hoje.*Simulado|feito ✓" | head -4

echo "=== [3] fila de recuperação (pointer vivo da 84) ==="
agent-browser snapshot 2>/dev/null | grep -iE "Plano da prova|Faça hoje|Lógica" | head -6

echo "=== [4] banner do plano (honesto da 83) ==="
agent-browser snapshot 2>/dev/null | grep -iE "seguem pendentes|já cumprido" | head -3

echo "=== [5] console ==="
agent-browser console 2>/dev/null | tail -5

echo "=== [6] badge do header (persistente em todas as abas) ==="
agent-browser snapshot 2>/dev/null | grep -iE "4d|Falta|Av1" | head -4
