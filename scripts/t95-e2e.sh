#!/bin/bash
# Task 95 — E2E do KIT CUMPRE A PROMESSA DO PLANO (VesperaKit lê o veredito do
# run oficial: badge com meta, linha do bloco fraco com drill, fórmula reordenada).
# Padrões provados (t88–t94): textContent SEM aspas, poke __poke = re-render com
# relógio mockado sem navegação, mock via class extends Date com eco na página,
# browser sandbox em UTC (seeds com data absoluta dentro da janela).
set -u
cd /home/z/my-project

FAIL=0
ok()   { echo "  [OK] $1"; }
bad()  { echo "  [FAIL] $1"; FAIL=1; }

if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
  echo "(boot dev server...)"
  (bun run dev > /tmp/dev-t95.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -s -o /dev/null --max-time 3 http://localhost:3000 && break
    sleep 2
  done
fi
curl -s -o /dev/null -w 'server: %{http_code}\n' --max-time 10 http://localhost:3000

agent-browser close 2>/dev/null || true
sleep 1

STORE='hub-estudos-ifpb:v2'

has() {
  agent-browser eval "(function(){var t=document.body.textContent.replace(/\s+/g,' ');return (t.indexOf('$1')>=0?1:0)})()" 2>/dev/null | tr -d '"'
}
click_btn() { # $1=trecho · $2=índice (0 = primeiro)
  agent-browser eval "(function(){var els=document.querySelectorAll('button');var n=0;for(var i=0;i<els.length;i++){if(els[i].textContent.indexOf('$1')>=0){if(n===$2){els[i].click();return 'ok'}n++}}return 'NAO'})()" 2>/dev/null | tr -d '"'
}
badge_tone() { # $1=trecho do texto do badge · $2=classe esperada
  agent-browser eval "(function(){var els=document.querySelectorAll('span');for(var i=0;i<els.length;i++){var c=els[i].className;if(typeof c==='string'&&c.indexOf('$2')>=0&&els[i].textContent.indexOf('$1')>=0&&els[i].textContent.length<140)return 1}return 0})()" 2>/dev/null | tr -d '"'
}
mock_date() { # padrão provado (class extends Date) + eco DENTRO da página
  agent-browser eval "(function(){var M=new Date('$1').getTime();class FD extends Date{constructor(...args){args.length===0?super(M):super(...args)}static now(){return M}}window.Date=FD;var d=new Date();return 'mock='+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()})()" 2>/dev/null | tr -d '"'
}
poke() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.__poke=((p.__poke||0)+1);var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'poked='+p.__poke})()" >/dev/null 2>&1
  sleep 1
}
# Run oficial do dia 29 (prova, TEC.1984) com TÓPICOS:
#   qa95-a: Matrizes 5/5 + Lógica 2/5 → 7/10 = 70% (meta batida), worst Lógica 40%
#   qa95-b: Matrizes 5/5 + Lógica 0/5 → 5/10 = 50% (abaixo da meta), worst Lógica 0%
seed_run() { # $1=id · $2=matrizes solved · $3=logica solved · $4=logica missed
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=p.simuladoRuns||[];var qs=[];for(var i=0;i<$2;i++)qs.push({disciplineCode:'TEC.1984',topic:'Álgebra Matricial',status:'solved'});for(var j=0;j<$3;j++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'solved'});for(var m=0;m<$4;m++)qs.push({disciplineCode:'TEC.1984',topic:'Lógica Matemática',status:'missed'});p.simuladoRuns.push({id:'$1',date:'2026-09-29T15:30:00',mode:'prova',total:qs.length,solved:$2+$3,missed:$4,skipped:0,durationSec:2400,filters:{discipline:'TEC.1984'},questions:qs});var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'ok n='+qs.length})()" 2>/dev/null | tr -d '"'
}
clean_runs() {
  agent-browser eval "(function(){var k='$STORE';var p=JSON.parse(localStorage.getItem(k)||'{}');p.simuladoRuns=(p.simuladoRuns||[]).filter(function(r){return r.id.indexOf('qa95')!==0});if(p.simuladoRuns.length===0)delete p.simuladoRuns;delete p.__poke;var s=JSON.stringify(p);localStorage.setItem(k,s);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:s}));return 'runs='+((p.simuladoRuns||[]).length)})()" 2>/dev/null | tr -d '"'
  sleep 1
}
goto_home() { # o rótulo REAL do nav da home é 'Visão Geral' (lição 94.2) —
  # 'Estudar' não existe como botão; voltar do Simulado precisa do tab certo
  local try=""
  for i in 1 2 3; do
    try=$(agent-browser eval "(function(){var els=document.querySelectorAll('button,a');for(var i=0;i<els.length;i++){var t=(els[i].textContent||'').trim();if(t==='Visão Geral'||t==='Estudar'){els[i].click();return 'ok'}}return 'NAO'})()" 2>/dev/null | tr -d '"')
    sleep 2
    [ "$(has 'Kit da véspera')" = "1" ] && return 0
  done
  return 1
}

echo "=== [A] MOCK 27/09 (D-4): kit fora da janela (Lição 128 — data-rot) ==="
# Lição 128/129: a janela do kit é 0≤D≤3 (isVesperaWindow) — a voz D-3 ('O
# ensaio de amanhã mede o que já está no seu preparo') entrou na 128. O teste
# herdava o relógio da entrega (D-4): agora PLANTA o dia (open → mock+poke —
# o kit é reativo ao poke, provado na [B] da entrega).
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 6
agent-browser set viewport 1440 900 >/dev/null 2>&1
sleep 2
echo "  $(mock_date '2026-09-27T15:00:00')"
poke
sleep 1
KIT=$(has 'Kit da véspera')
[ "$KIT" = "0" ] && ok "D-4 plantado: kit ausente (janela 0≤D≤3)" || bad "D-4 plantado: kit presente fora da janela"

echo "=== [B] MOCK 29/09 (D-2) SEM run: espera honesta ==="
echo "  $(mock_date '2026-09-29T15:00:00')"; poke
KIT=$(has 'Kit da véspera'); ESP=$(has 'comece por aqui')
ROW=$(has 'Lógica: a revisão de amanhã')
[ "$KIT" = "1" ] && ok "D-2: kit visível" || bad "D-2: kit ausente"
[ "$ESP" = "1" ] && ok "badge de espera: 'depois do simulado de hoje — comece por aqui'" || bad "badge de espera ausente"
[ "$ROW" = "0" ] && ok "sem run → linha do bloco fraco AUSENTE (não inventa)" || bad "linha do bloco fraco sem run (invenção!)"
echo "=== [C] RUN 70% (Matrizes 5/5 · Lógica 2/5): meta batida, bloco fraco com números ==="
seed_run 'qa95-a' 5 2 3
poke
META=$(has '≥ meta, véspera leve'); MTONE=$(badge_tone '≥ meta' 'border-emerald-500/40')
ROW=$(has 'Lógica: a revisão de amanhã')
SUB=$(has 'No simulado: Matrizes 5/5 · Lógica 2/5')
BB=$(has '40% no bloco'); BTONE=$(badge_tone '40% no bloco' 'border-amber-500/50')
FORM=$(has 'Lógica primeiro (2/5 no simulado), Matrizes depois')
[ "$META" = "1" ] && ok "badge: 'simulado feito — 70% ≥ meta, véspera leve'" || bad "badge da meta ausente"
[ "$MTONE" = "1" ] && ok "badge em emerald (meta batida = calma)" || bad "badge sem emerald na meta"
[ "$ROW" = "1" ] && ok "linha: 'Lógica: a revisão de amanhã'" || bad "linha do bloco fraco ausente"
[ "$SUB" = "1" ] && ok "sub com o placar por tópico: 'Matrizes 5/5 · Lógica 2/5'" || bad "placar por tópico ausente"
[ "$BB" = "1" ] && ok "badge do bloco: '40% no bloco'" || bad "badge do bloco ausente"
[ "$BTONE" = "1" ] && ok "badge do bloco em amber (40% < 70)" || bad "badge do bloco sem amber"
[ "$FORM" = "1" ] && ok "fórmulas reordenadas: 'Lógica primeiro, Matrizes depois'" || bad "fórmulas na ordem estática"

echo "=== [D] CTA 'Treinar Lógica' abre o Simulado Pro escopado ==="
CTA=$(click_btn 'Treinar Lógica' 0); sleep 2
SIM=$(has 'Simulado Pro'); TOP=$(has 'Lógica Matemática')
[ "$CTA" = "ok" ] && [ "$SIM" = "1" ] && [ "$TOP" = "1" ] && ok "Simulado Pro aberto com o escopo 'Lógica Matemática'" || bad "drill não abriu escopado (cta=$CTA sim=$SIM top=$TOP)"
if goto_home; then ok "de volta à home (kit visível)"; else bad "não voltei à home — abortar fases E–G"; FAIL=1; fi
poke; sleep 1

echo "=== [E] RUN 50% (Lógica 0/5): abaixo da meta = amber ==="
clean_runs >/dev/null 2>&1
seed_run 'qa95-b' 5 0 5
poke
AB=$(has 'abaixo da meta'); ATONE=$(badge_tone 'abaixo da meta' 'border-amber-500/50')
Z=$(has 'Lógica 0/5')
[ "$AB" = "1" ] && ok "badge: 'simulado feito — 50%: abaixo da meta'" || bad "badge abaixo-da-meta ausente"
[ "$ATONE" = "1" ] && ok "badge em amber (atenção com número real)" || bad "badge sem amber abaixo da meta"
[ "$Z" = "1" ] && ok "placar honesto: 'Lógica 0/5'" || bad "placar 0/5 ausente"

echo "=== [F] MOCK 30/09 (D-1): 'começa a revisão de hoje' ==="
echo "  $(mock_date '2026-09-30T15:00:00')"; poke
HOJE=$(has 'começa a revisão de hoje')
BF=$(has 'bloco fraco primeiro'); ATONE=$(badge_tone 'bloco fraco' 'border-amber-500/50')
[ "$HOJE" = "1" ] && ok "linha D-1: 'Lógica: começa a revisão de hoje'" || bad "linha D-1 ausente"
[ "$BF" = "1" ] && ok "badge D-1 (run 50%): 'véspera — 50% no simulado: bloco fraco primeiro'" || bad "badge D-1 abaixo da meta ausente"
[ "$ATONE" = "1" ] && ok "badge D-1 em amber (run abaixo da meta)" || bad "badge D-1 sem amber"
# troca para o run 70%: a véspera da META BATIDA dá calma (emerald)
clean_runs >/dev/null 2>&1
seed_run 'qa95-a' 5 2 3
poke
MP=$(has 'manter o plano'); MTONE=$(badge_tone 'manter o plano' 'border-emerald-500/40')
[ "$MP" = "1" ] && ok "badge D-1 (run 70%): 'véspera — 70% no simulado, manter o plano'" || bad "badge D-1 meta batida ausente"
[ "$MTONE" = "1" ] && ok "badge D-1 em emerald (meta batida = calma)" || bad "badge D-1 sem emerald"

echo "=== [G] MOCK 01/10 (D-0): prova não treina — linha some, calma ==="
echo "  $(mock_date '2026-10-01T08:00:00')"; poke
GONE=$(has 'Treinar Lógica')
CALMA=$(has 'hoje é o dia — só reler e respirar')
[ "$GONE" = "0" ] && ok "linha de treino AUSENTE no dia da prova" || bad "CTA de treino no D-0!"
[ "$CALMA" = "1" ] && ok "badge D-0: 'hoje é o dia — só reler e respirar'" || bad "badge D-0 ausente"

echo "=== [H] MOBILE 390 (D-2 + run 70%): sem overflow ==="
echo "  $(mock_date '2026-09-29T15:00:00')"; poke
clean_runs >/dev/null 2>&1
seed_run 'qa95-a' 5 2 3
poke
agent-browser set viewport 390 844 >/dev/null 2>&1; sleep 2
OVF=$(agent-browser eval "(function(){var d=document.documentElement;return 'ovf='+(d.scrollWidth>d.clientWidth?1:0)})()" 2>/dev/null | tr -d '"')
echo "  $OVF"
case "$OVF" in *ovf=0*) ok "mobile 390: sem overflow horizontal";; *) bad "mobile 390 com overflow";; esac
agent-browser screenshot scripts/qa95-kit-mobile390.png >/dev/null 2>&1

echo "=== [I] HIGIENE: zero resíduo, data real, console limpo ==="
agent-browser set viewport 1440 900 >/dev/null 2>&1
H=$(clean_runs)
echo "  storage: $H"
case "$H" in *runs=0*) ok "runs qa95 removidos";; *) bad "resíduo de runs: $H";; esac
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 5
# Lição 129 — asserção DINÂMICA (não herda o dia da entrega): o kit respeita
# a janela 0≤D≤3 com o D REAL do relógio; se o mock de 27/09 tivesse
# sobrevivido ao reload, o D mockado (4) contradiria o D real e o teste pega.
DREAL=$(( ( $(date -u -d 2026-10-01 +%s) - $(date -u -d "$(date -u +%F)" +%s) ) / 86400 ))
KIT=$(has 'Kit da véspera')
if [ "$DREAL" -ge 0 ] && [ "$DREAL" -le 3 ]; then
  [ "$KIT" = "1" ] && ok "data real (D-$DREAL): kit na janela 0≤D≤3 (voz certa do dia)" || bad "data real D-$DREAL: kit ausente na janela!"
else
  [ "$KIT" = "0" ] && ok "data real (D-$DREAL): kit fora da janela (silêncio)" || bad "data real D-$DREAL: kit presente fora da janela!"
fi
RG=$(agent-browser eval "(function(){var p=JSON.parse(localStorage.getItem('$STORE')||'{}');return 'realGrades='+(p.realGrades?Object.keys(p.realGrades).length:0)+' runs='+((p.simuladoRuns||[]).length)+' poke='+(p.__poke===undefined?0:1)})()" 2>/dev/null | tr -d '"')
echo "  $RG"
case "$RG" in *runs=0*poke=0*) ok "storage limpo (runs 0, poke 0)";; *) bad "storage sujo: $RG";; esac
ERRS=$(agent-browser console 2>&1 | grep -ci error)
[ "$ERRS" = "0" ] && ok "console: 0 erros" || bad "console com $ERRS erros"

if [ "$FAIL" = "0" ]; then echo ""; echo "ALL GREEN — t95"; else echo ""; echo "FAILURES — t95"; exit 1; fi
