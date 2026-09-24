#!/usr/bin/env bash
# update-worklog-branch.sh — publica worklog.md no branch órfão 'worklog' no GitHub.
#
# Por quê: o dono pediu para o worklog viver no GitHub "limpo e cuidadoso, em
# outra branch, que não entre no Vercel". A Vercel acompanha só a 'main' — o
# branch 'worklog' é órfão (sem histórico do app) e contém APENAS o histórico:
# worklog.md (+ worklog-backup.md se existir).
#
# Uso:  bash scripts/update-worklog-branch.sh "nota opcional do commit"
# Não troca de branch nem mexe na árvore de trabalho (usa git plumbing).
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f worklog.md ] || { echo "ERRO: worklog.md não encontrado"; exit 1; }

blob_main=$(git hash-object -w worklog.md)
entries="100644 blob ${blob_main}$(printf '\t')worklog.md"
if [ -f worklog-backup.md ]; then
  blob_backup=$(git hash-object -w worklog-backup.md)
  entries="${entries}
100644 blob ${blob_backup}$(printf '\t')worklog-backup.md"
fi

tree=$(printf '%s\n' "$entries" | git mktree)
note="${1:-update $(date -u '+%Y-%m-%dT%H:%MZ')}"
commit=$(git commit-tree "$tree" -m "worklog: ${note}")
git push -q origin "${commit}:refs/heads/worklog" --force
echo "OK: worklog.md publicado no branch 'worklog' (commit ${commit:0:7})"
