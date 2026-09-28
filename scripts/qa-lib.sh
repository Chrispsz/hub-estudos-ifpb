#!/usr/bin/env bash
# ============================================================================
# QA-LIB — o chão comum da frota de suites E2E (Task 125; P1 da 124).
#
# O PROBLEMA: cada suite copiava o chão de higiene à mão — e o chão CRESCIA
# (runs → poke → realGrades → matProg): a próxima chave nova seria esquecida
# pela metade das suites, e o resíduo só apareceria como flake semanas depois.
# A ponte de eventos scriptada também se mostrou rácia (lição 124) — os seeds
# futuros preferem o caminho da UI REAL; quando o seed scriptado for
# indispensável, use qa_seed e confirme com qa_storage_get (nunca confie no
# 'ok' do eval — confirme o efeito no storage).
#
# USO:
#   source "$(dirname "$0")/qa-lib.sh"
#   qa_ensure_dev            # sobe o dev se estiver caído; imprime o status
#   qa_has 'texto no DOM'    # 1 se document.body contém o texto
#   qa_seed 'p.simuladoRuns=[];'   # mutação no store + StorageEvent
#   qa_storage_get 'p.realGrades'  # lê o valor PÓS-mutação (confirmação)
#   qa_hygiene_check         # chão inteiro: todas as chaves + console 0
#   qa_clean_all             # wipe do store (entre fases)
#   qa_mobile_check 390      # sem overflow-X na largura dada
#   exit $QA_FAIL            # FAIL=1 se qualquer qa_assert falhou
#
# A lista de chaves do chão mora AQUI — chave nova no store = uma linha nova
# em QA_FLOOR_KEYS, e todas as suites herdam na próxima cópia.
# ============================================================================

QA_FAIL=0
STORE='hub-estudios-ifpb:v2'
# O chão de limpeza (uma linha por chave; suites antigas copiavam à mão).
QA_FLOOR_KEYS='simuladoRuns __poke realGrades materialProgress'

qa_ok() { echo "  [OK] $1"; }
qa_bad() { echo "  [FAIL] $1"; QA_FAIL=1; }
# Nomes curtos das suites (a convenção de todas elas) — aliases, não cópias.
ok()  { qa_ok "$@"; }
bad() { qa_bad "$@"; }

# SELF-CHECK (a vitória vazia da lição 124 mora no HARNESS também): se o lib
# não carregou, as asserções somem e a suite imprime ALL GREEN FALSO. Toda
# suite chama `qa_selfcheck || exit 2` logo após o source.
qa_selfcheck() {
  if ! type qa_ok >/dev/null 2>&1 || ! type qa_bad >/dev/null 2>&1 \
     || [ -z "${QA_FAIL+x}" ]; then
    echo "FATAL: qa-lib.sh não carregou — asserções não existiriam (ALL GREEN falso)" >&2
    return 1
  fi
  return 0
}

qa_ensure_dev() {
  if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
    echo "(boot dev server...)"
    (bun run dev > /tmp/dev-qa-lib.log 2>&1 &)
    for _ in $(seq 1 45); do
      curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
      sleep 2
    done
  fi
  curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000
}

qa_has() { # 1 se o texto está no body — asserções copiam o DOM REAL (lição 105)
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}

# Mutação direta no store + StorageEvent (a ponte). SEMPRE confirme com
# qa_storage_get — o 'ok' do eval não prova que o app leu (lição 124).
qa_seed() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');$1;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok'})()" 2>/dev/null | tr -d '"'
}

# Leitura confirmada do store — expressão sobre `p` (ex.: 'p.simuladoRuns').
qa_storage_get() {
  agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return String($1)})()" 2>/dev/null | tr -d '"'
}

qa_console_errors() {
  agent-browser console 2>/dev/null | grep -ci "error" || true
}

qa_clean_all() { # wipe total do store (o esquecido pelo suite antigo não existe)
  qa_seed 'localStorage.setItem(k,"{}")' >/dev/null 2>&1
  agent-browser eval "localStorage.removeItem('$STORE')" >/dev/null 2>&1
}

# O CHÃO: todas as chaves do QA_FLOOR_KEYS vazias/ausentes + console limpo.
# Uso no fim de cada suite (o padrão runs=0 poke=0 realGrades=0 matProg=0).
qa_hygiene_check() {
  local floor_report
  floor_report=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');var out=[];var keys='$QA_FLOOR_KEYS'.split(' ');for(var i=0;i<keys.length;i++){var k=keys[i];var v=p[k];var n=0;if(v!=null){if(Array.isArray(v))n=v.length;else if(typeof v==='object')n=Object.keys(v).length;else n=1}out.push(k+'='+n)}return out.join(' ')})()" 2>/dev/null | tr -d '"')
  local clean=1
  for k in $QA_FLOOR_KEYS; do
    case "$floor_report" in *"$k=0"*) ;; *) clean=0 ;; esac
  done
  [ "$clean" = "1" ] && qa_ok "storage limpo ($floor_report)" \
                       || qa_bad "resíduo no storage: $floor_report"
  local ce
  ce=$(qa_console_errors)
  [ "$ce" = "0" ] && qa_ok "console: 0 erros" || qa_bad "console com $ce erros"
}

# Sem overflow horizontal na largura dada (o padrão mobile 390 das suites).
qa_mobile_check() {
  local w="$1"
  agent-browser set-viewport "${w}" 844 >/dev/null 2>&1
  sleep 1
  local dims
  dims=$(agent-browser eval "(function(){return document.documentElement.scrollW+'x'+window.innerWidth})()" 2>/dev/null | tr -d '"')
  local sw="${dims%%x*}" iw="${dims##*x}"
  if [ "$sw" -le "$iw" ] 2>/dev/null; then
    qa_ok "mobile ${w}px sem overflow horizontal (${dims})"
  else
    qa_bad "mobile ${w}px com overflow (${dims})"
  fi
}
