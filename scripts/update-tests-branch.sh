#!/usr/bin/env bash
# update-tests-branch.sh — publica tests/*.ts no branch órfão 'tests' no GitHub.
#
# Por quê: a série de contratos (t139–t170) era gitignored e MORREU com o
# reboot do sandbox (t171 reabriu a série; t172/t173 seguiram). A dívida
# registrada na 171/172 era "versionar os testes num branch próprio (como o
# worklog) para sobreviver a reboots" — este script é essa promessa cumprida.
# O branch 'tests' é órfão (sem histórico do app) e contém APENAS os
# contratos (+ vercel.json, para a Vercel NÃO buildar o branch).
#
# Uso:  bash scripts/update-tests-branch.sh "nota opcional do commit"
# Não troca de branch nem mexe na árvore de trabalho (usa git plumbing).
set -euo pipefail
cd "$(dirname "$0")/.."

shopt -s nullglob
test_files=(tests/*.ts)
shopt -u nullglob
[ "${#test_files[@]}" -gt 0 ] || { echo "ERRO: nenhum tests/*.ts encontrado"; exit 1; }

# GUARDA DA SÉRIE (a lição do APAGAMENTO do worklog, aplicada aos testes):
# o branch órfão é reconstruído do zero a cada update — publicar MENOS
# contratos do que o branch já tem APAGARIA a série. O número de arquivos
# local não pode ser menor que o do branch (append-only por contagem; renomear
# um teste substitui 1 por 1 — a contagem segura é por NOME + contagem).
git fetch -q origin tests 2>/dev/null || true
if git cat-file -e "origin/tests" 2>/dev/null; then
  remote_count=$(git ls-tree -r --name-only "origin/tests" 2>/dev/null | grep -c '^tests/.*\.ts$' || true)
  local_count=${#test_files[@]}
  if [ "${local_count:-0}" -lt "${remote_count:-0}" ]; then
    echo "ERRO: o tests/ local tem ${local_count} contratos mas o branch tem ${remote_count} — publicar APAGARIA parte da série."
    echo "Contratos no branch:"
    git ls-tree -r --name-only "origin/tests" | grep '^tests/.*\.ts$' | sed 's/^/  /'
    echo "Recuperação: git ls-tree -r --name-only origin/tests | grep tests/ → git show origin/tests:<arquivo> > <arquivo> para cada um que sumiu, e rode de novo."
    exit 1
  fi
  # Guarda por NOME: um contrato que existe no branch e sumiu do disco é
  # apagamento mesmo com contagem igual (renomear sem repor).
  missing=""
  for f in $(git ls-tree -r --name-only "origin/tests" | grep '^tests/.*\.ts$'); do
    [ -f "$f" ] || missing="${missing} ${f}"
  done
  if [ -n "${missing}" ]; then
    echo "ERRO: contratos que existem no branch e sumiram do disco:${missing}"
    echo "Recuperação: git show origin/tests:<arquivo> > <arquivo> e rode de novo."
    exit 1
  fi
fi

entries=""
for f in "${test_files[@]}"; do
  blob=$(git hash-object -w "$f")
  entries="${entries}100644 blob ${blob}$(printf '\t')%s\n" "$f"
done

# vercel.json TEM que ir junto: com git.deploymentEnabled {"tests": false} no
# próprio commit pushado, a Vercel ignora o branch (senão tenta buildar e
# falha por falta de package.json). Como a árvore é reconstruída do zero, sem
# isso o próximo update apagaria o arquivo do branch.
if [ -f vercel.json ]; then
  blob_vjson=$(git hash-object -w vercel.json)
  entries="${entries}100644 blob ${blob_vjson}$(printf '\t')vercel.json\n"
fi

tree=$(printf '%b' "$entries" | git mktree)
note="${1:-update $(date -u '+%Y-%m-%dT%H:%MZ')}"
commit=$(git commit-tree "$tree" -m "tests: ${note}")
git push -q origin "${commit}:refs/heads/tests" --force
echo "OK: ${#test_files[@]} contratos publicados no branch 'tests' (commit ${commit:0:7})"
