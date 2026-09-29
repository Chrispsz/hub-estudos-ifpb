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

# GUARDA APPEND-ONLY (171 — lição do APAGAMENTO): o branch órfão é reconstruído
# do zero a cada update, então publicar um worklog.md local menor que o do
# branch APAGA histórico de verdade (as rodadas 27–166 quase viraram pó nesta
# rodada: o arquivo local tinha só a entrada 171 e o push substituiu tudo).
# O protocolo é APPEND-ONLY: o arquivo local TEM que conter TODOS os Task ID
# que o branch já publicou — recusar com a receita da recuperação.
git fetch -q origin worklog 2>/dev/null || true
if git cat-file -e "origin/worklog:worklog.md" 2>/dev/null; then
  remote_ids=$(git show "origin/worklog:worklog.md" | grep -c '^Task ID:' || true)
  local_ids=$(grep -c '^Task ID:' worklog.md || true)
  if [ "${local_ids:-0}" -lt "${remote_ids:-0}" ]; then
    missing=$(git show "origin/worklog:worklog.md" | grep '^Task ID:' | sort > /tmp/wl-remote.$$; grep '^Task ID:' worklog.md | sort > /tmp/wl-local.$$; comm -23 /tmp/wl-remote.$$ /tmp/wl-local.$$ | head -5; rm -f /tmp/wl-remote.$$ /tmp/wl-local.$$)
    echo "ERRO: o worklog.md local tem ${local_ids} entradas mas o branch tem ${remote_ids} — publicar APAGARIA o histórico (append-only!)."
    echo "Entradas que sumiriam (até 5): ${missing}"
    echo "Recuperação: git show \$(git reflog show origin/worklog | sed -n 's/^\([0-9a-f]*\).*/\1/p' | head -1):worklog.md > worklog.md && append a entrada nova no fim."
    exit 1
  fi
fi

blob_main=$(git hash-object -w worklog.md)
entries="100644 blob ${blob_main}$(printf '\t')worklog.md"
if [ -f worklog-backup.md ]; then
  blob_backup=$(git hash-object -w worklog-backup.md)
  entries="${entries}
100644 blob ${blob_backup}$(printf '\t')worklog-backup.md"
fi

tree=$(printf '%s\n' "$entries" | git mktree)

# vercel.json TEM que ir junto: com git.deploymentEnabled {"worklog": false} no
# próprio commit pushado, a Vercel ignora o branch (senão tenta buildar e falha
# por falta de package.json). Como o mktree reconstrói a árvore do zero, sem
# isso o próximo update apagaria o arquivo do branch.
if [ -f vercel.json ]; then
  blob_vjson=$(git hash-object -w vercel.json)
  entries="${entries}
100644 blob ${blob_vjson}$(printf '\t')vercel.json"
  tree=$(printf '%s\n' "$entries" | git mktree)
fi
note="${1:-update $(date -u '+%Y-%m-%dT%H:%MZ')}"
commit=$(git commit-tree "$tree" -m "worklog: ${note}")
git push -q origin "${commit}:refs/heads/worklog" --force
echo "OK: worklog.md publicado no branch 'worklog' (commit ${commit:0:7})"
