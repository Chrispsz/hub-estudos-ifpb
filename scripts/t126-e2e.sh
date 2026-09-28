#!/usr/bin/env bash
# ============================================================================
# t126 — A CERCA E O RECIBO (a infra que protege a semana + a voz que fica)
#
# MENTA: (1) o P2 pendente desde a 121 vira CERCA COMMITADA (hooks/pre-commit
# + install-hooks.sh): o sweep-cron da 114 fez `git add -A` em estado sujo de
# terceiros, comitou lixo `*-cron` no main e destruiu a árvore P0 — a cerca
# torna esse gesto impossível (ensaio REAL em clone temporário: o acidente é
# encenado e tem que ser BLOQUEADO; FENCE_ALLOW=1 é o escape honesto; commit
# limpo passa sem env). A asserção é o MARCADOR da cerca, não só o rc — rc=1
# vazio de 'nothing added' fingiria bloqueio (vitória vazia, lição 124, que
# mordeu o próprio harness desta rodada). (2) o P1 da 124 vira qa-lib.sh — o
# chão de higiene da frota mora num lugar só (chave nova = uma linha em
# QA_FLOOR_KEYS) e ESTA suite o consome (o teste do lib é o uso; qa_selfcheck
# mata o ALL GREEN falso quando o lib não carrega). (3) o detalhe do produto:
# a entrega da S3 (trabalho REAL avaliado, 29/09) tinha o chip 'prazo hoje'
# que CALAVA ao marcar — o recibo emerald 'entrega registrada ✓' fica (lição
# 123: registro que o aluno não vê vira dúvida).
#
# [A] cerca: clone temporário — git add -A com lixo BLOQUEADO (marcador na
#     saída) / worklog.md -f BLOQUEADO / .env -f BLOQUEADO / FENCE_ALLOW
#     libera E anuncia / commit limpo passa sem env
# [B] recibo: mock 29/09 (init-script, sessão nova) — chip 'prazo hoje' na
#     fila → clique REAL no checkbox → 'entrega registrada ✓' + amber calado;
#     storage confirma o done
# [C] qa-lib: resíduo plantado → confirmado → qa_clean_all → chão inteiro 0
#     + console 0 (o lib que as próximas suites vão copiar)
# ============================================================================
set -u
cd /home/z/my-project
source "$(dirname "$0")/qa-lib.sh"
qa_selfcheck || exit 2   # lib não carregou = asserções somem = ALL GREEN falso

qa_ensure_dev

CLONE=/tmp/fence-t126
MOCKJS=/tmp/t126-mock.js

write_mock() { # $1 ISO — Date mockado ANTES do primeiro script da página
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

open_mocked() { # $1 ISO · $2 URL · $3 toDateString esperado — sessão nova COM
  # VERIFICAÇÃO do mock: a estreia mostrou o open perder a corrida com o close
  # (o eval seguinte auto-lança um browser LIMPO, sem init-script — relógio
  # real e página vazia). O mock se CONFIRMA, nunca se presume.
  write_mock "$1"
  local got
  for _ in 1 2 3; do
    agent-browser close >/dev/null 2>&1
    sleep 3   # o close precisa assentar
    agent-browser open --init-script "$MOCKJS" "http://localhost:3000$2" >/dev/null 2>&1
    sleep 6
    got=$(agent-browser eval "new Date().toDateString()" 2>/dev/null | tr -d '"')
    [ "$got" = "$3" ] && return 0
  done
  return 1
}

# ============================================================================
echo "=== [A] A CERCA (ensaio do acidente da 114 em clone temporário) ==="
rm -rf "$CLONE"
if git clone --local --quiet /home/z/my-project "$CLONE" 2>/dev/null; then
  # A cerca ainda NÃO está commitada (esta suite roda ANTES do push) — o clone
  # recebe os DOIS artefatos por cp; depois do commit o cp é redundante e a
  # suite segue self-sufficient (o clone só tem o HEAD).
  mkdir -p "$CLONE/hooks"
  cp hooks/pre-commit "$CLONE/hooks/pre-commit"
  cp hooks/commit-msg "$CLONE/hooks/commit-msg"
  cp scripts/install-hooks.sh "$CLONE/scripts/install-hooks.sh"
  ( cd "$CLONE" && bash scripts/install-hooks.sh >/dev/null 2>&1
    git config user.email qa@fence.local; git config user.name "QA Fence" )
  HOOKS=$( cd "$CLONE" && git config core.hooksPath )
  [ "$HOOKS" = "hooks" ] \
    && ok "cerca armada no clone (core.hooksPath=hooks)" \
    || bad "cerca NÃO armada no clone (hooksPath='$HOOKS') — fases A sem valor"

  # A1: o ACIDENTE REAL — lixo de cron + git add -A tem que ser BLOQUEADO
  mkdir -p "$CLONE/7e0deadbeef-cron" && echo lixo > "$CLONE/7e0deadbeef-cron/junk.txt"
  ( cd "$CLONE" && git add -A >/dev/null 2>&1 )
  STAGED=$( cd "$CLONE" && git diff --cached --name-only | head -1 )
  [ -n "$STAGED" ] \
    && ok "git add -A capturou o lixo ($STAGED) — o cenário da 114 montado" \
    || bad "nada staged: o cenário do acidente não aterrissou"
  OUT=$( cd "$CLONE" && git commit -m "acidente ensaiado" 2>&1 ); RC=$?
  [ "$RC" -ne 0 ] && echo "$OUT" | grep -q "A CERCA DO REPOSITÓRIO" \
    && ok "lixo *-cron via git add -A BLOQUEADO com a lição na mensagem" \
    || bad "cerca não bloqueou com marcador (rc=$RC)"
  echo "$OUT" | grep -q "git add <somente os seus arquivos>" \
    && ok "a cerca ensina o caminho certo no rodapé" \
    || bad "o 'faça o certo' ausente na saída"

  # A2: worklog.md via add -f (o cenário hostil que o gitignore não cobre)
  echo segredo > "$CLONE/worklog.md"
  OUT=$( cd "$CLONE" && git add -f worklog.md >/dev/null 2>&1 && git commit -m "worklog no main?" 2>&1 ); RC=$?
  [ "$RC" -ne 0 ] && echo "$OUT" | grep -q "A CERCA DO REPOSITÓRIO" \
    && ok "worklog.md com add -f BLOQUEADO" || bad "worklog.md passou (rc=$RC)"

  # A3: .env via add -f (segredo não viaja nem à força)
  echo SECRET=1 > "$CLONE/.env"
  OUT=$( cd "$CLONE" && git add -f .env >/dev/null 2>&1 && git commit -m "env acidental" 2>&1 ); RC=$?
  [ "$RC" -ne 0 ] && echo "$OUT" | grep -q "A CERCA DO REPOSITÓRIO" \
    && ok ".env com add -f BLOQUEADO" || bad ".env passou (rc=$RC)"

  # A4: o escape honesto existe E se anuncia (.env ainda staged do A3)
  OUT=$( cd "$CLONE" && FENCE_ALLOW=1 git commit -m "exceção real" 2>&1 ); RC=$?
  [ "$RC" -eq 0 ] && echo "$OUT" | grep -q "FENCE_ALLOW" \
    && ok "FENCE_ALLOW=1 libera E se registra na saída" \
    || bad "FENCE_ALLOW=1 não liberou ou liberou calado (rc=$RC)"

  # A5: commit LIMPO passa sem env nenhum (a cerca não vira burocracia)
  echo "// ok" > "$CLONE/src/fence-ok.txt"
  ( cd "$CLONE" && git add src/fence-ok.txt >/dev/null 2>&1 )
  ( cd "$CLONE" && git commit -m "limpo" >/dev/null 2>&1 ); RC=$?
  [ "$RC" -eq 0 ] && ok "commit limpo passa sem FENCE_ALLOW" \
                 || bad "a cerca bloqueou commit LEGÍTIMO (rc=$RC)"

  # A6: O SELO DA MENSAGEM (a lição AO VIVO da 126 — o incidente aconteceu
  # ENQUANTO esta cerca era construída): o sweep da paralela (31f169b) comitou
  # caminhos LEGÍTIMOS de dois agentes com o trace-id de cron como mensagem —
  # a cerca de caminhos não via estrago nenhum; o estrago mora no NOME.
  echo "// ok" > "$CLONE/src/fence-msg.txt"
  ( cd "$CLONE" && git add src/fence-msg.txt >/dev/null 2>&1 )
  OUT=$( cd "$CLONE" && git commit -m "0c67d8b1-cf55-4bc7-a7e6-5303e72a11dc" 2>&1 ); RC=$?
  [ "$RC" -ne 0 ] && echo "$OUT" | grep -q "selo da mensagem" \
    && ok "trace-id como mensagem BLOQUEADO (a lacuna que a 126 revelou, fechada)" \
    || bad "mensagem-trace-id passou (rc=$RC)"
  OUT=$( cd "$CLONE" && git commit -m "fix: mensagem de verdade passa pelo selo" 2>&1 ); RC=$?
  [ "$RC" -eq 0 ] && ok "mensagem de verdade atravessa o selo sem ruído" \
                 || bad "selo bloqueou mensagem legítima (rc=$RC)"
  rm -rf "$CLONE"
  ok "clone temporário removido"
else
  bad "clone temporário falhou (fase A não rodou)"
fi

# ============================================================================
echo "=== [B] O RECIBO DA ENTREGA (mock 29/09, o clique REAL do dono) ==="
# O card de recuperação mora na HOME (Visão Geral) — nada de navegar: o mock
# 29/09 + a fila 'Faça hoje' na própria entrada são o palco. A frota
# COMPARTILHA o agent-browser (e o dev server recompila com HMR de edição ao
# vivo — 404s transitórios vistos na estreia): pré-requisito com RETRY
# honesto; se a página não cooperar, a fase declara e NÃO finge nada.
B_OK=0
for ATT in 1 2 3; do
  [ "$ATT" -gt 1 ] && sleep 15
  if open_mocked "2026-09-29T12:00:00" "/" "Tue Sep 29 2026" \
     && [ "$(qa_has 'Faça hoje')" = "1" ] \
     && [ "$(qa_has 'PRAZO HOJE: entrega da S3')" = "1" ]; then
    B_OK=1
    ok "pré-requisitos da fase B aterrissados (tentativa $ATT)"
    break
  fi
done
if [ "$B_OK" = "1" ]; then
  BEFORE=$(qa_has 'prazo hoje')
  DONEKEY=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub:recovery:v1:done')||'{}');return String(Object.keys(p).length)})()" 2>/dev/null | tr -d '"')
  [ "$BEFORE" = "1" ] && [ "$DONEKEY" = "0" ] \
    && ok "estado pré-clique: chip 'prazo hoje' presente, done vazio" \
    || bad "estado pré-clique inesperado (chip=$BEFORE done=$DONEKEY)"

  # O CLIQUE REAL (o gesto do dono na noite da entrega)
  CLICK=$(agent-browser eval "(function(){var el=document.getElementById('rec-alg-s3-entrega');if(!el)return 'NOEL';el.click();return 'ok'})()" 2>/dev/null | tr -d '"')
  sleep 1
  [ "$CLICK" = "ok" ] && ok "checkbox da S3 clicado na UI real" || bad "checkbox não encontrado ($CLICK)"

  [ "$(qa_has 'Entrega da S3 registrada')" = "1" ] \
    && ok "o RECIBO emerald fica na fila ('Entrega da S3 registrada — os programas seguem no Classroom')" \
    || bad "recibo não apareceu após o clique"
  [ "$(qa_has 'Semana 2 no Praticar')" = "1" ] \
    && ok "a trilha volta à primeira ação pendente (S2 assume o lugar)" \
    || bad "fila não convergiu para a S2 após a entrega"
  [ "$(qa_has 'prazo hoje')" = "0" ] \
    && ok "o chip amber cumpre sua palavra (some quando entregue)" \
    || bad "chip 'prazo hoje' ainda presente após marcar"
  DONEKEY=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('hub:recovery:v1:done')||'{}');return String(p['alg-s3-entrega']||'')!==''?'1':'0'})()" 2>/dev/null | tr -d '"')
  [ "$DONEKEY" = "1" ] \
    && ok "storage confirma o registro (hub:recovery:v1:done.alg-s3-entrega)" \
    || bad "storage não confirma o done do checkbox"

  agent-browser screenshot scripts/qa126-entrega-registrada-desktop.png >/dev/null 2>&1 \
    && ok "screenshot: qa126-entrega-registrada-desktop.png"
else
  bad "fase B impossível: fila não cooperou em 3 tentativas (conteção da frota em curso?)"
fi

# ============================================================================
echo "=== [C] QA-LIB (o chão que a frota inteira vai copiar) ==="
qa_clean_all
qa_seed 'p.materialProgress={fake:{lastAccessedAt:1}}' >/dev/null
RES=$(qa_storage_get "Object.keys(p.materialProgress||{}).length")
[ "$RES" = "1" ] \
  && ok "qa_seed plantou resíduo e qa_storage_get CONFIRMOU (fé não, evidência)" \
  || bad "seed não confirmado no storage ($RES)"
qa_clean_all
sleep 1
# LIÇÃO 134: a lib carregava a chave FANTASMA ('estudios') — este check lia a
# chave errada e 'zerou o store' passava vago. Com o STORE curado, o clean
# toca o chão REAL e o app re-hidrata o esqueleto padrão (21 chaves) — o que
# define 'limpo' não é 0 chaves, é RESÍDUO ZERO: o plantado sumiu.
FLOOR=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'mp='+(p.materialProgress?Object.keys(p.materialProgress).length:0)+'|fake='+(p.materialProgress&&p.materialProgress.fake?1:0)+'|runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null | tr -d '"')
[ "$FLOOR" = "mp=0|fake=0|runs=0" ] && ok "qa_clean_all limpou o resíduo do chão REAL (o esqueleto do app é vida, não sujeira)" || bad "resíduo sobreviveu ao clean ($FLOOR)"
qa_hygiene_check

# LIÇÃO 133: a fase B arma o mock 29/09 por init-script e o close do helper
# vem ANTES do open — a suíte terminava com a SESSÃO viva e armada; a próxima
# suíte herdava o relógio. O chão de higiene é bidimensional: storage E sessão.
agent-browser close >/dev/null 2>&1; sleep 2

echo
if [ "$QA_FAIL" = "0" ]; then
  echo "ALL GREEN — t126 a cerca e o recibo (a infra que protege a semana)"
else
  echo "FAIL — t126 (ver fases acima)"
fi
exit $QA_FAIL
