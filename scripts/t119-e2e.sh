#!/bin/bash
# Task 119 — A FOLHA CUMPRE AS DUAS PROMESSAS QUE FICARAM NO AR:
#  (1) MODO RECITAÇÃO — o cabeçalho das fórmulas promete "recite de memória,
#      confira aqui" desde sempre, sem ferramenta: o toggle oculta a fórmula,
#      cada caixa revela no toque, e a folha IMPRESSA sai sempre completa
#      (botão print:hidden + fórmula hidden print:block).
#  (2) O SLOT DA PROMESSA — a folha mais provável é a impressa ANTES do
#      simulado, exatamente a que nasce sem o bloco de foco (06312ad); o slot
#      tracejado nomeia a data (regra prova-2, SIMULADO_ISO) e manda reimprimir.
# QA: [A] folha fresca (slot no dia certo, recite off, foco ausente);
# [B] recitação (10 caixas escondíveis, revela individual, contador honesto,
# desligar zera); [C] integridade do PAPEL (classes print garantem tinta);
# [D] run injetado → foco real substitui o slot (a promessa cumpre);
# [E] mobile 390 sem overflow + screenshots; [F] higiene zero + console 0.
# NOTA DE DATA (lição 117): a ÚNICA asserção dependente de relógio é a
# presença do slot — e o script COMPUTA a expectativa com a mesma aritmética
# do componente (todayKey <= SIMULADO_ISO), sem ler data em texto.
# NOTA DE FUSÃO (119): suite reescrita sobre a árvore pós-fusão das duas
# linhas (00aa9fe) — o foco não filtra mais por mode (o campo não sobreviveu
# à fusão); a injeção usa só filters.discipline + questions com detalhes.
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t119.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'
FOLHA='http://localhost:3000/folha-revisao'

has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
ev() {
  agent-browser eval "$1" 2>/dev/null | tr -d '"'
}
clean_all_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');delete p.simuladoRuns;delete p.__poke;delete p.realGrades;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs=0'})()" 2>/dev/null | tr -d '"'
  sleep 1
}
inject_run() { # id date alg_s alg_m log_s log_m (tentativa TEC.1984 com detalhes)
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];var i;for(i=0;i<$3;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'solved'});for(i=0;i<$4;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'missed'});for(i=0;i<$5;i++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(i=0;i<$6;i++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'$1',date:'$2',total:qs.length,solved:($3+$5),missed:($4+$6),skipped:0,durationSec:3600,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
  sleep 1
}

# ---------- [A] FOLHA FRESCA ----------
echo "=== [A] folha fresca: slot da promessa no dia certo, recite off ==="
agent-browser open "$FOLHA" >/dev/null 2>&1; sleep 4
clean_all_runs >/dev/null 2>&1
agent-browser open "$FOLHA" >/dev/null 2>&1; sleep 4

# Expectativa do slot COMPUTADA com a aritmética do componente (UTC do sandbox
# = fuso do browser do sandbox): slot presente sse hoje <= 29/09 (simulado).
TODAY=$(date -u +%Y-%m-%d)
EXPECT_SLOT=0
[ "$TODAY" \< "2026-09-29" ] && EXPECT_SLOT=1
[ "$TODAY" = "2026-09-29" ] && EXPECT_SLOT=1
SLOT=$(has 'Foco do simulado · chega em 29/09')
if [ "$EXPECT_SLOT" = "1" ]; then
  [ "$SLOT" = "1" ] && ok "slot da promessa presente (hoje $TODAY <= 29/09) nomeando o simulado" || bad "slot deveria estar presente hoje ($TODAY)"
  [ "$(has 'reimprima esta folha')" = "1" ] && ok "slot manda reimprimir (a promessa do 06312ad agora é visível)" || bad "slot não manda reimprimir"
else
  [ "$SLOT" = "0" ] && ok "slot ausente (hoje $TODAY > 29/09 — promessa envelhecida sai de cena)" || bad "slot deveria ter saído depois do simulado"
fi
[ "$(has 'Foco do simulado · 2')" = "0" ] && ok "sem foco real em folha fresca (nada inventado)" || bad "foco inventado sem run"
TOGGLE_ARIA=$(ev "(function(){var bs=document.querySelectorAll('button[aria-pressed]');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').indexOf('Modo recitação')>=0)return bs[i].getAttribute('aria-pressed')}return 'NAO'})()")
[ "$TOGGLE_ARIA" = "false" ] && ok "toggle de recitação em aria-pressed=false (off por padrão)" || bad "toggle de recitação começa errado ($TOGGLE_ARIA)"
RECITE_BTNS=$(ev "document.querySelectorAll('button[aria-label^=\"Conferir a fórmula\"]').length")
[ "$RECITE_BTNS" = "0" ] && ok "nenhum botão de conferir com recite off (fórmulas todas à vista)" || bad "botões de conferir vazando com recite off ($RECITE_BTNS)"
KAT_VIS=$(ev "(function(){var ks=document.querySelectorAll('.katex');var n=0;for(var i=0;i<ks.length;i++){if(ks[i].offsetParent!==null)n++}return n})()")
[ "${KAT_VIS:-0}" -ge 10 ] 2>/dev/null && ok "fórmulas visíveis com recite off (katex=$KAT_VIS)" || bad "fórmulas sumiram com recite off (katex=$KAT_VIS)"
[ "$(has 'Caneta, lápis e borracha')" = "1" ] && ok "kit do dia da prova em papel (FOLHA_KIT local)" || bad "kit do dia sumiu da folha"

# ---------- [B] MODO RECITAÇÃO ----------
echo "=== [B] recitação: oculta tudo, revela no toque, contador honesto ==="
ev "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').indexOf('Modo recitação')>=0){bs[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
RECITE_BTNS=$(ev "document.querySelectorAll('button[aria-label^=\"Conferir a fórmula\"]').length")
[ "$RECITE_BTNS" = "10" ] && ok "recite on: 10 caixas com fórmula viraram botões de conferir (a pós-prova não tem fórmula — não se esconde)" || bad "esperava 10 botões de conferir, achei $RECITE_BTNS"
KAT_VIS=$(ev "(function(){var ks=document.querySelectorAll('.katex');var n=0;for(var i=0;i<ks.length;i++){if(ks[i].offsetParent!==null)n++}return n})()")
[ "$KAT_VIS" = "0" ] && ok "nenhuma fórmula visível em modo recitação (katex=$KAT_VIS)" || bad "fórmulas vazando na recitação (katex=$KAT_VIS)"
[ "$(has '10 ocultas')" = "1" ] && ok "contador honesto: 10 ocultas (= botões reais, lição 105)" || bad "contador não mostra 10 ocultas"
# revelar a primeira caixa
ev "(function(){var b=document.querySelector('button[aria-label^=\"Conferir a fórmula\"]');if(!b)return 'NAO';var l=b.getAttribute('aria-label');b.click();return l})()" >/dev/null 2>&1
sleep 1
RECITE_BTNS=$(ev "document.querySelectorAll('button[aria-label^=\"Conferir a fórmula\"]').length")
[ "$RECITE_BTNS" = "9" ] && ok "revelou 1: restam 9 botões" || bad "esperava 9 botões após revelar, achei $RECITE_BTNS"
KAT_VIS=$(ev "(function(){var ks=document.querySelectorAll('.katex');var n=0;for(var i=0;i<ks.length;i++){if(ks[i].offsetParent!==null)n++}return n})()")
[ "${KAT_VIS:-0}" -ge 1 ] 2>/dev/null && ok "a caixa revelada mostra a fórmula (katex=$KAT_VIS)" || bad "revelação não mostrou fórmula"
[ "$(has '9 ocultas')" = "1" ] && ok "contador acompanhou: 9 ocultas" || bad "contador travado em 10"
[ "$(has 'Recite o conteúdo — toque para conferir')" = "1" ] && ok "microcópia do toque presente nas caixas ocultas" || bad "microcópia ausente"
# desligar: tudo volta
ev "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').replace(/\s+/g,' ');if(t.indexOf('oculta')>=0&&t.indexOf('Recitação')>=0){bs[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
KAT_VIS=$(ev "(function(){var ks=document.querySelectorAll('.katex');var n=0;for(var i=0;i<ks.length;i++){if(ks[i].offsetParent!==null)n++}return n})()")
RECITE_BTNS=$(ev "document.querySelectorAll('button[aria-label^=\"Conferir a fórmula\"]').length")
[ "$RECITE_BTNS" = "0" ] && [ "${KAT_VIS:-0}" -ge 10 ] 2>/dev/null && ok "recite off: fórmulas todas de volta (katex=$KAT_VIS, botões=0)" || bad "desligar recitação não devolveu as fórmulas (katex=$KAT_VIS btns=$RECITE_BTNS)"

# ---------- [C] INTEGRIDADE DO PAPEL ----------
echo "=== [C] a folha impressa sai SEMPRE completa (classes print) ==="
ev "(function(){var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').indexOf('Modo recitação')>=0){bs[i].click();return 'ok'}}return 'NAO'})()" >/dev/null 2>&1
sleep 1
ALL_PH=$(ev "(function(){var bs=document.querySelectorAll('button[aria-label^=\"Conferir a fórmula\"]');var n=0;for(var i=0;i<bs.length;i++){if(bs[i].className.indexOf('print:hidden')>=0)n++}return n+'/'+bs.length})()")
[ "$ALL_PH" = "10/10" ] && ok "todo botão de conferir é print:hidden (não sai no papel)" || bad "botões sem print:hidden: $ALL_PH"
HIDDEN_MATH=$(ev "(function(){var ds=document.querySelectorAll('div[class*=\"print:block\"]');var n=0;for(var i=0;i<ds.length;i++){if(ds[i].className.indexOf('hidden')>=0&&ds[i].querySelector('.katex'))n++}return n})()")
[ "$HIDDEN_MATH" = "10" ] && ok "as 10 fórmulas ocultas têm gêmea hidden print:block (tinta garantida no papel)" || bad "gêmeas de impressão: $HIDDEN_MATH (esperava 10)"
# screenshots do modo recitação (desktop)
agent-browser screenshot scripts/qa119-folha-recitacao-desktop.png >/dev/null 2>&1 && ok "screenshot desktop recitação (qa119-folha-recitacao-desktop.png)" || bad "screenshot falhou"

# ---------- [D] A PROMESSA CUMRE: run real substitui o slot ----------
echo "=== [D] tentativa da Av1 injetada → foco real entra, slot sai (sem reload) ==="
R=$(inject_run 't119-foco' '2026-09-28T22:30:00.000Z' 3 1 3 3)
echo "  inject: $R"
[ "$(has 'Foco do simulado ·')" = "1" ] && ok "bloco de foco real apareceu" || bad "foco não apareceu após run"
[ "$(has '50%')" = "1" ] && ok "pior tópico = Lógica 50% (3/6) no chip" || bad "conta do pior tópico errada"
[ "$(has '3 de 6 resolvidas')" = "1" ] && ok "conta exata no corpo: 3 de 6 resolvidas" || bad "corpo do foco sem a conta"
SLOT=$(has 'chega em 29/09')
[ "$SLOT" = "0" ] && ok "slot saiu de cena — a promessa virou recibo" || bad "slot e foco simultâneos"
clean_all_runs >/dev/null 2>&1
[ "$(has '3 de 6 resolvidas')" = "0" ] && ok "foco sumiu após limpar runs (só-leitura, sem persistência)" || bad "foco sobreviveu à limpeza"

# ---------- [E] MOBILE 390 ----------
echo "=== [E] mobile 390: folha com slot + toggle sem overflow ==="
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
IW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
SW=$(agent-browser eval "window.innerWidth" 2>/dev/null | tr -d '"')
[ "${IW:-0}" -le "${SW:-390}" ] 2>/dev/null && ok "mobile 390 sem overflow (iw=$IW sw=$SW)" || bad "overflow no mobile (iw=$IW sw=$SW)"
agent-browser eval "(function(){var h=document.querySelector('h1');if(h){h.scrollIntoView({block:'start'});return 'ok'}return 'NAO'})()" >/dev/null 2>&1
sleep 1
agent-browser screenshot scripts/qa119-folha-mobile390.png >/dev/null 2>&1 && ok "screenshot mobile (qa119-folha-mobile390.png)" || bad "screenshot falhou"
agent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2

# ---------- [F] HIGIENE + CONSOLE ----------
echo "=== [F] higiene + console ==="
agent-browser eval "location.reload()" >/dev/null 2>&1; sleep 4
H=$(clean_all_runs)
RUNS=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke||0)+' realGrades='+Object.keys(p.realGrades||{}).length})()" 2>/dev/null | tr -d '"')
echo "  $RUNS"
[ "$RUNS" = "runs=0 poke=0 realGrades=0" ] && ok "storage limpo (runs/poke/realGrades)" || bad "resíduo no storage: $RUNS"
CONSOLE=$(agent-browser console 2>/dev/null | grep -ci "error" || true)
[ "$CONSOLE" = "0" ] && ok "console: 0 erros" || bad "console com $CONSOLE erros"

echo ""
if [ "$FAIL" = "0" ]; then
  echo "ALL GREEN — t119 a folha cumpre as promessas (recitação + slot da promessa)"
else
  echo "FAIL — ver [FAIL] acima"
  exit 1
fi
