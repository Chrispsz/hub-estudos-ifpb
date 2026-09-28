#!/usr/bin/env bash
# =============================================================================
# t125-e2e — A FOLHA DO CADERNO (o papel da véspera chega ao Caderno de Erros)
# =============================================================================
# O QUE A RODADA ENTREGOU:
#   • rota /caderno-papel — as pendências do caderno com enunciado COMPLETO do
#     acervo, numeradas (Q1…Qn), agrupadas por disciplina, com espaço de
#     trabalho; papel WYSIWYG no padrão da folha de revisão (selo print-only
#     'Impresso em dd/mm · marco' via examWeekMilestoneFor — lição 108).
#   • lib (mistake-notebook.ts): paperNotebookFor + fullStatementFor — FONTE
#     ÚNICA do papel: `ex:`/`sim:` imprimem (acervo confirma agora); cartões
#     (`fc:` — o verso é parte da prática) e `simx:`/sem par não vão — e a
#     folha DIZ o que ficou de fora.
#   • caderno na tela: botão 'Levar N ao papel' (cala com N=0, regra da 88) +
#     a faixa da VÉSPERA ganha CTA que FAZ: 'Imprimir as N questões para o
#     papel' (o brief mandava refazer no papel e não dava a ferramenta).
#
# FASES (tudo por UI — as leis do ambiente mandaram):
#   [1] semente 100% UI (relapse do ex01: Tentei→Consegui→Consegui-off;
#       ex02 Tentei; cartão via Novo cartão + Revisar agora + Errei)
#   [2] TELA: caderno 3 itens + recorrente + botão 'Levar 2 ao papel'
#   [3] A FOLHA em data real (Q1/Q2, enunciado completo, erro de sempre,
#       pautas, honestidade do cartão, selo display:none na tela) + screenshot
#   [4] SELO no 30/09 mockado (sessão nova + re-semeadura por UI — o close
#       limpa o storage do app): 'Impresso em 30/09 · Véspera da prova'
#   [5] a faixa da véspera: CTA 'Imprimir as 2 questões para o papel' →
#       window.open('/caderno-papel') capturado por stub
#   [6] dia da prova (01/10): o CTA da faixa CALA; o botão do cabeçalho fica
#   [7] higiene por UI (resolver os 2 + remover o cartão) + vazio honesto nos
#       dois lugares + Imprimir desabilitado + console 0
#   [8] mobile 390 sem overflow + screenshot
#
# ⚠️ LEIS DO AMBIENTE DESTA RODADA (harness — descoberta da 124 confirmada):
#   • o localStorage lido pelo `eval` vive em PARTIÇÃO SEPARADA do storage do
#     app: leitura/escrita via eval NÃO cruza (nos dois sentidos) — seed por
#     storage/evento é morta; asserts de storage também;
#   • o que sobrevive: o WRITE do app (gesto de UI) — sobrevive a navegação
#     inteira na mesma sessão; `agent-browser close` LIMPA (perfil efêmero) —
#     sessão mockada = re-semeadura por UI depois do init-script;
#   • Date mock via --init-script (lição 121): sessão NOVA por fase;
#   • tabs Radix exigem evento confiável — snapshot + ref (checkboxes nativos
#     e botões comuns aceitam click via eval).
# =============================================================================
set -u
cd /home/z/my-project

FAIL=0
ok()  { echo "  [OK] $1"; }
bad() { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t125.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null
sleep 1

MOCKJS=/tmp/t125-mock.js
write_mock() { # $1 = ISO local do relógio mockado (lição 121)
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
open_mocked() { # $1 ISO, $2 URL — sessão nova por fase (close limpa o storage!)
  write_mock "$1"
  agent-browser close >/dev/null 2>&1
  sleep 1
  agent-browser open --init-script "$MOCKJS" "$2" >/dev/null 2>&1
  sleep 6
}
has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
go_praticar() {
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Praticar'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 3
  [ "$(has 'exercícios no filtro atual')" = "1" ] || [ "$(has 'Simulado Pro')" = "1" ]
}
go_progress() { # lição 102.1: 'Progresso' mora dentro do submenu 'Mais'
  for i in 1 2 3 4; do
    agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Mais'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 1
    agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Progresso'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
    sleep 2
    [ "$(has 'Mapa de consistência')" = "1" ] && return 0
  done
  return 1
}
# Clica o checkbox do caderno (label) do exercício cujo cartão contém $1
state_click() { # $1 marcador do enunciado · $2 rótulo ('Tentei fazer' etc.)
  agent-browser eval "(function(){var labels=document.querySelectorAll('label');for(var i=0;i<labels.length;i++){var l=labels[i];if((l.textContent||'').trim()==='$2'){var card=l.closest('div.text-card-foreground')||l.closest('div.flex.flex-col');if(card&&card.textContent.indexOf('$1')>=0){l.click();return 'ok'}}}return 'NOTFOUND'})()" 2>/dev/null | tr -d '"'
}
# Semeia os DOIS exercícios por UI (o ex01 relapsa: Tentei→Consegui→Consegui-off)
seed_exercicios() {
  go_praticar || return 1
  state_click 'Considere a matriz A' 'Tentei fazer' >/dev/null; sleep 1
  state_click 'Considere a matriz A' 'Consegui resolver' >/dev/null; sleep 1
  state_click 'Considere a matriz A' 'Consegui resolver' >/dev/null; sleep 1 # uncheck = recaída
  state_click 'Sejam A = [[2, 1]' 'Tentei fazer' >/dev/null; sleep 1
  sleep 3 # settle: o write-back do app precisa aterrissar antes de navegar
  return 0
}
# Cartão por UI: Flashcards (tab Radix via ref) → Novo cartão → Errei
seed_cartao() {
  local REF
  # os toasts das marcações cobrem a tab — escapa e espera (o overlay é real)
  agent-browser press Escape >/dev/null 2>&1
  sleep 2
  REF=$(agent-browser snapshot 2>/dev/null | grep -o 'tab "Flashcards" \[ref=e[0-9]*\]' | grep -oE 'e[0-9]+' | tail -1)
  [ -n "$REF" ] && agent-browser click "$REF" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var b=document.querySelector('button[aria-label=\"Criar novo cartão\"]');if(!b)return 'NO';b.click();return 'ok'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var tas=document.querySelectorAll('textarea');if(tas.length<2)return 'FEW';var S=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;S.call(tas[0],'Definição de matriz identidade');tas[0].dispatchEvent(new Event('input',{bubbles:true}));S.call(tas[1],'Matriz quadrada com 1 na diagonal e 0 fora');tas[1].dispatchEvent(new Event('input',{bubbles:true}));return 'filled'})()" >/dev/null 2>&1
  agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim()==='Adicionar'){bs[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
  # verificação intermediária: o cartão existe na lista (senão as fases seguintes
  # passam com vitória vazia — lição 124)
  local CARD_OK=$(has 'Definição de matriz identidade')
  [ "$CARD_OK" = "1" ] || echo "  [warn] cartão não apareceu na lista (seed_cartao falhou antes)"
  agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim().indexOf('Revisar agora')>=0){bs[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
  agent-browser eval "(function(){var b=document.querySelector('button[aria-label=\"Ver resposta do cartão\"]');if(!b)return 'NO';b.click();return 'ok'})()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').trim().indexOf('Errei')===0){bs[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
  sleep 2
}
paper_btn() { # o botão do papel no cabeçalho do caderno
  agent-browser eval "(function(){var b=document.querySelector('button[aria-label*=\"folha do papel\"]');return b?b.textContent.trim().replace(/\s+/g,' '):''})()" 2>/dev/null | tr -d '"'
}
vespera_cta() { # o CTA da faixa da véspera (por texto)
  agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=els[i].textContent||'';if(t.indexOf('Imprimir as')>=0)return t.trim().replace(/\s+/g,' ')}return ''})()" 2>/dev/null | tr -d '"'
}
stamp_info() { # display + texto do selo print-only
  agent-browser eval "(function(){var s=document.querySelector('[data-testid=caderno-papel-print-stamp]');if(!s)return 'NO-STAMP';var d=getComputedStyle(s).display;return d+'::'+s.textContent.replace(/\s+/g,' ').trim()})()" 2>/dev/null | tr -d '"'
}

# =============================================================================
echo "=== [1] SEMEADURA 100% UI: relapse + pendente + cartão errei ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
seed_exercicios && ok "exercícios semeados por UI (ex01 relapsa, ex02 pendente)" || bad "semeadura dos exercícios falhou"
seed_cartao
go_progress || bad "navegação ao Progresso falhou"
[ "$(has 'Caderno de Erros')" = "1" ] && ok "caderno presente no Progresso" || bad "caderno sumiu"
[ "$(has '3 itens')" = "1" ] && ok "badge: 3 itens (2 exercícios + 1 cartão)" || bad "contagem errada (esperado 3)"
[ "$(has '1 recorrente')" = "1" ] && ok "recorrente marcado: o relapse do ex01 (erro de sempre)" || bad "recorrente não marcado"

# =============================================================================
echo "=== [2] TELA: o botão do papel conta 2 (o cartão fica de fora) ==="
PB=$(paper_btn)
[ "$PB" = "Levar 2 ao papel" ] && ok "botão do papel: 'Levar 2 ao papel' (o cartão não vai)" || bad "botão errado: '$PB'"
TITLE_OK=$(agent-browser eval "(function(){var b=document.querySelector('button[aria-label*=\"folha do papel\"]');return (b&&b.getAttribute('title')&&b.getAttribute('title').indexOf('a véspera é o dia do papel')>=0)?'1':'0'})()" 2>/dev/null | tr -d '"')
[ "$TITLE_OK" = "1" ] && ok "title didático do botão presente (via getAttribute)" || bad "title do botão sumiu"
[ -z "$(vespera_cta)" ] && ok "data real: nenhum CTA de faixa (28/09 é preparo — silêncio honesto)" || bad "CTA presente na data real: $(vespera_cta)"

# =============================================================================
echo "=== [3] A FOLHA (data real): enunciado completo, erro de sempre, honestidade ==="
sleep 3 # settle extra: a navegação inteira lê o storage do app — dar tempo ao write-back
agent-browser open http://localhost:3000/caderno-papel >/dev/null 2>&1
sleep 5
[ "$(has '2 pendências no papel')" = "1" ] && ok "barra de ações: '2 pendências no papel'" || bad "contagem da barra errada"
STAMP=$(stamp_info)
case "$STAMP" in
  none::*)
    TXT="${STAMP#*::}"
    echo "$TXT" | grep -q "Impresso em" && ok "selo print-only na DOM (display:none na tela — só o papel o vê)" || bad "selo sem data: $TXT"
    ;;
  *) bad "selo inesperado: $STAMP" ;;
esac
[ "$(has 'Q1.')" = "1" ] && ok "numeração Q1 presente" || bad "Q1 sumiu"
[ "$(has 'Q2.')" = "1" ] && ok "numeração Q2 presente" || bad "Q2 sumiu"
ORD=$(agent-browser eval "(function(){var t=document.body.innerText;var a=t.indexOf('Q1.');var b=t.indexOf('Sejam A');var c=t.indexOf('Q2.');var d=t.indexOf('Considere a matriz A');return (a>=0&&b>a&&b-a<40&&c>a&&d>c&&d-c<40)?'1':'0'})()" 2>/dev/null | tr -d '"')
[ "$ORD" = "1" ] && ok "numeração segue a recência: Q1=mat-ex02 (mais recente), Q2=mat-ex01" || bad "ordem numeração/enunciado quebrada"
[ "$(has 'Sejam A = [[2, 1]')" = "1" ] && ok "Q1 = mat-ex02 (enunciado do acervo)" || bad "mat-ex02 sumiu da folha"
[ "$(has 'diga se B = A.')" = "1" ] && ok "ENUNCIADO COMPLETO (trecho além do truncamento de 120)" || bad "enunciado truncado no papel!"
[ "$(has 'erro de sempre — prioridade máxima')" = "1" ] && ok "tag do recorrente vai ao papel" || bad "tag do recorrente sumiu"
[ "$(has 'Matemática Aplicada à Computação')" = "1" ] && ok "grupo por disciplina presente" || bad "cabeçalho de disciplina sumiu"
[ "$(has 'Ficam na tela do caderno: 1 cartão')" = "1" ] && ok "honestidade: a folha DIZ que o cartão ficou de fora" || bad "linha de honestidade sumiu"
DOTS=$(agent-browser eval "document.querySelectorAll('.border-dotted').length" 2>/dev/null | tr -d '"')
[ "${DOTS:-0}" -ge 6 ] 2>/dev/null && ok "pautas de trabalho pontilhadas ($DOTS = 3 por questão)" || bad "pautas insuficientes: $DOTS"
DIS=$(agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].getAttribute('aria-label')||'')==='Imprimir a folha do caderno de erros')return bs[i].disabled?'DISABLED':'ENABLED'}return 'NO'})()" 2>/dev/null | tr -d '"')
[ "$DIS" = "ENABLED" ] && ok "Imprimir habilitado com pendências" || bad "Imprimir errado: $DIS"
agent-browser set viewport 1280 900 >/dev/null 2>&1; sleep 1
agent-browser screenshot scripts/qa125-caderno-papel-desktop.png >/dev/null 2>&1 && ok "screenshot desktop (qa125-caderno-papel-desktop.png)" || bad "screenshot falhou"

# =============================================================================
echo "=== [4] O SELO SABE O DIA (30/09 mockado + re-semeadura por UI) ==="
open_mocked "2026-09-30T09:00:00" "http://localhost:3000"
seed_exercicios || bad "re-semeadura no 30/09 falhou"
sleep 3 # settle
agent-browser open http://localhost:3000/caderno-papel >/dev/null 2>&1
sleep 5
STAMP=$(stamp_info)
case "$STAMP" in
  none::*"Impresso em 30/09 · Véspera da prova"*) ok "selo exato: 'Impresso em 30/09 · Véspera da prova' (fonte única, meio-dia local)" ;;
  *) bad "selo no 30/09 errado: $STAMP" ;;
esac
[ "$(has '2 pendências no papel')" = "1" ] && ok "a folha carrega as 2 pendências no dia da véspera" || bad "pendências sumiram no 30/09"
agent-browser screenshot scripts/qa125-caderno-papel-vespera.png >/dev/null 2>&1 && ok "screenshot véspera (qa125-caderno-papel-vespera.png)" || bad "screenshot falhou"

# =============================================================================
echo "=== [5] A FAIXA DA VÉSPERA: o CTA que FAZ o papel ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
go_progress || bad "Progresso (30/09) falhou"
sleep 2
[ "$(has 'Véspera da Av1 — o dia do papel')" = "1" ] && ok "faixa da véspera presente no caderno" || bad "faixa da véspera sumiu"
[ "$(has 'refaça no papel as 2 questões de Matemática pendentes')" = "1" ] && ok "brief: 'refaça no papel as 2 questões de Matemática pendentes'" || bad "brief da véspera mudou"
CTA=$(vespera_cta)
[ "$CTA" = "Imprimir as 2 questões para o papel" ] && ok "CTA da faixa: 'Imprimir as 2 questões para o papel'" || bad "CTA da véspera errado: '$CTA'"
agent-browser eval "window.__t125=[];window.open=function(u){window.__t125.push(String(u));return null};'stub'" >/dev/null 2>&1
agent-browser eval "(function(){var els=document.querySelectorAll('button');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Imprimir as 2 questões para o papel'){els[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
CAP=$(agent-browser eval "(window.__t125&&window.__t125[0])||''" 2>/dev/null | tr -d '"')
case "$CAP" in
  */caderno-papel*) ok "CTA abre a folha: window.open('/caderno-papel') capturado" ;;
  *) bad "CTA não abriu a folha: capturado='$CAP'" ;;
esac

# =============================================================================
echo "=== [6] DIA DA PROVA (01/10): o CTA da faixa CALA — papel não é missão do dia ==="
open_mocked "2026-10-01T09:00:00" "http://localhost:3000"
seed_exercicios || bad "re-semeadura no 01/10 falhou"
sleep 3 # settle
go_progress || bad "Progresso (01/10) falhou"
[ "$(has 'É hoje: Prova da Av1')" = "1" ] && ok "faixa da prova presente" || bad "faixa da prova sumiu"
[ "$(has 'boa prova!')" = "1" ] && ok "brief da prova: 'boa prova!'" || bad "brief da prova mudou"
[ -z "$(vespera_cta)" ] && ok "CTA de impressão CALA no dia da prova (o dia não é do papel)" || bad "CTA vivo no dia da prova: $(vespera_cta)"
PB=$(paper_btn)
[ "$PB" = "Levar 2 ao papel" ] && ok "botão do cabeçalho segue disponível (o papel existe; o dia que manda)" || bad "botão sumiu na prova: '$PB'"

# =============================================================================
echo "=== [7] HIGIENE por UI: resolver tudo + remover o cartão ==="
agent-browser close >/dev/null 2>&1
sleep 1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
seed_exercicios || bad "semeadura para a higiene falhou"
seed_cartao
# resolve os DOIS (Consegui resolver) — saem das pendências
state_click 'Considere a matriz A' 'Consegui resolver' >/dev/null; sleep 1
state_click 'Sejam A = [[2, 1]' 'Consegui resolver' >/dev/null; sleep 1
# remove o cartão (Trash no Flashcards)
REF=$(agent-browser snapshot 2>/dev/null | grep -o 'tab "Flashcards" \[ref=e[0-9]*\]' | grep -oE 'e[0-9]+' | tail -1)
[ -n "$REF" ] && agent-browser click "$REF" >/dev/null 2>&1
sleep 2
agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){var a=bs[i].getAttribute('aria-label')||'';if(a.indexOf('Remover cartão')>=0){bs[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 2
go_progress || bad "Progresso (higiene) falhou"
[ "$(has 'Nada aqui por agora')" = "1" ] && ok "caderno honestamente vazio pós-higiene" || bad "caderno com resíduo"
[ -z "$(paper_btn)" ] && ok "botão do papel CALA com 0 pendências (regra da 88)" || bad "botão vivo sem pendências: $(paper_btn)"
agent-browser open http://localhost:3000/caderno-papel >/dev/null 2>&1
sleep 5
[ "$(has 'Nada pendente com enunciado completo')" = "1" ] && ok "folha: estado vazio honesto" || bad "folha vazia mentindo"
DIS=$(agent-browser eval "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].getAttribute('aria-label')||'')==='Imprimir a folha do caderno de erros')return bs[i].disabled?'DISABLED':'ENABLED'}return 'NO'})()" 2>/dev/null | tr -d '"')
[ "$DIS" = "DISABLED" ] && ok "Imprimir DESABILITADO sem pendências" || bad "Imprimir habilitado no vazio: $DIS"

# =============================================================================
echo "=== [8] MOBILE 390: a folha sem overflow + console ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser screenshot scripts/qa125-caderno-papel-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa125-caderno-papel-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1280 900 >/dev/null 2>&1
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t125 a folha do caderno (o papel da véspera chega ao Caderno de Erros)"
else
  echo "FAILURES — t125"
  exit 1
fi
