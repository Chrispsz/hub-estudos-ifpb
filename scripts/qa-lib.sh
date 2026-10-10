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
# A CHAVE REAL DO APP (lição 134): 'estudos' — a lib inteira carregava
# 'estudios' (typo de nascença) e qa_seed/qa_clean_all/qa_hygiene_check
# operavam numa chave FANTASMA: o clean nunca limpou o store real e o seed
# nunca pousou nele — as suítes só passavam porque cada uma hardcodava a
# chave certa nos próprios evals (a infra era teatro; a auditoria da 134
# pegou o fantasma porque a higiene da [E] passou a LER o chão real).
STORE='hub-estudos-ifpb:v2'
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
# LIÇÃO 134: a versão antiga passava 'localStorage.setItem(k,"{}")' como $1 do
# qa_seed — mas o qa_seed faz p=parse(current) ANTES de rodar $1 e DEPOIS grava
# stringify(p): o '{}' era sobrescrito pelo ESTADO VELHO e o dispatch re-armava
# a memória do app. A suíte seguinte herdava o estado (e um reload re-persistia:
# o pagehide escreve a memória de volta). Cura: '{}' + dispatch REAL do vazio +
# remove — a memória do app reseta junto (o chão é bidimensional: storage E
# memória; a 133 disse para a sessão, esta diz para o estado vivo).
  agent-browser eval "(function(){var k='$STORE';localStorage.setItem(k,'{}');window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:'{}'}));localStorage.removeItem(k);return 'ok'})()" >/dev/null 2>&1
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

# ============================================================================
# LIÇÃO 138 — A ESCRITA FANTASMA (o setItem é CHAMADO e não persiste)
#
# A auditoria da 138 provou com matriz 2×2 (real/mock × toggle/run, build
# PRISTINO, `rm -rf .next` + restart) que DUAS variáveis produzem a MESMA
# assinatura: o app atualiza o estado (fiber: tried/runs presentes,
# hydrated=true), o UI funciona, o persist effect RODA e chama setItem —
# e o storage NÃO recebe nada (ler de volta dá ''/ausente), sem exceção:
#   (a) mock de Date via `agent-browser open --init-script` (a classe
#       FD extends Date, padrão das suites) envenena a aba inteira;
#   (b) o dev server com MUITA idade/sessões acumuladas degrada do mesmo
#       jeito — TEST1 (toggle) e TEST3 (run) passaram num server recém-
#       nascido; 40min depois o MESMO código reverteu a falhar (V1).
# Em produção (Vercel, sem HMR, sem dev-mode) o caminho é o do server
# novo: o aluno está fora disso. CURA IMEDIATA EM QA: `pkill next; rm -rf
# .next; restart` — e rodar as asserções de persistência CEDO na vida do
# server. Nunca confie num 'não persistiu' sem antes reiniciar o server.
# Consequências para a frota:
#   1. Suites com --init-script mockando Data NÃO PODEM confiar em escrita
#      do app no storage durante a sessão mockada (o 'ALL GREEN' das velhas
#      era cego a isso — nenhuma assertava persistência do run).
#   2. Padrão SEGURO p/ mockar o dia: abrir SEM init-script, injetar o mock
#      por eval DEPOIS do mount e despertar com qa_seed '__poke' — o
#      qa_mock_date abaixo faz isso (retorna o toDateString confirmado).
#   3. t138 é a SUÍTE-CANÁRIO: verifica persistência real (toggle + run +
#      reload) sob relógio verdadeiro — se o ambiente apodrecer, ela falha
#      ALTA em vez de deixar a frota dançando num storage teatro.
# ============================================================================
qa_mock_date() { # $1 = ISO datetime — injeção PÓS-mount, nunca init-script
  agent-browser eval "(function(){var M=new Date('$1').getTime();var RD=Date;function MD(a,b,c,d,e,f,g){if(arguments.length===0)return new RD(M);switch(arguments.length){case 1:return new RD(a);case 2:return new RD(a,b);case 3:return new RD(a,b,c);case 4:return new RD(a,b,c,d);case 5:return new RD(a,b,c,d,e);case 6:return new RD(a,b,c,d,e,f);default:return new RD(a,b,c,d,e,f,g)}}MD.now=function(){return M};MD.parse=RD.parse?function(s){return RD.parse(s)}:undefined;MD.UTC=RD.UTC;MD.prototype=RD.prototype;window.Date=MD;return new Date().toDateString()})()" 2>/dev/null | tr -d '"'
}

qa_restart_dev() { # a cura da escrita fantasma — mata, limpa .next, sobe novo
  pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
  sleep 3
  rm -rf /home/z/my-project/.next
  ( cd /home/z/my-project && setsid nohup bun run dev >> dev.log 2>&1 < /dev/null & )
  for _ in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
  curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000
}
