#!/usr/bin/env bash
# ============================================================================
# INSTALA A CERCA (Task 125/126) — idempotente, roda em qualquer clone novo ou
# depois de reboot. A cerca vive COMMITADA em hooks/ (a fonte da verdade que
# sobrevive a reboots e clones); este script arma o clone local:
#   1. core.hooksPath → hooks/  (a versão commitada é quem roda)
#   2. cópia de reserva em .git/hooks/ (caso a config se perca num reboot)
# Arma DOIS hooks: pre-commit (a cerca de caminhos) e commit-msg (o selo da
# mensagem — a lição AO VIVO da 126: o sweep comita caminhos legítimos com
# trace-id de cron como mensagem; o estrago mora no nome).
# Idempotente: seguro rodar toda rodada (o ritual de abertura pode chamá-lo).
# ============================================================================
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

[ -f hooks/pre-commit ] || { echo "[cerca] hooks/pre-commit não encontrado no repo" >&2; exit 1; }
[ -f hooks/commit-msg ] || { echo "[cerca] hooks/commit-msg não encontrado no repo" >&2; exit 1; }

chmod +x hooks/pre-commit hooks/commit-msg
git config core.hooksPath hooks
mkdir -p .git/hooks
cp hooks/pre-commit hooks/commit-msg .git/hooks/
chmod +x .git/hooks/pre-commit .git/hooks/commit-msg

echo "[cerca] armada: core.hooksPath=$(git config core.hooksPath) (pre-commit + commit-msg) + reserva em .git/hooks/"
