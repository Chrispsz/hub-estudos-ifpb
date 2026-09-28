#!/usr/bin/env bash
# ============================================================================
# INSTALA A CERCA (Task 125) — idempotente, roda em qualquer clone novo ou
# depois de reboot. A cerca vive COMMITADA em hooks/pre-commit (a fonte da
# verdade que sobrevive a reboots e clones); este script arma o clone local:
#   1. core.hooksPath → hooks/  (a versão commitada é quem roda)
#   2. cópia de reserva em .git/hooks/pre-commit (caso a config se perca)
# Idempotente: seguro rodar toda rodada (o ritual de abertura pode chamá-lo).
# ============================================================================
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

[ -f hooks/pre-commit ] || { echo "[cerca] hooks/pre-commit não encontrado no repo" >&2; exit 1; }

chmod +x hooks/pre-commit
git config core.hooksPath hooks
mkdir -p .git/hooks
cp hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "[cerca] armada: core.hooksPath=$(git config core.hooksPath) + reserva em .git/hooks/pre-commit"
