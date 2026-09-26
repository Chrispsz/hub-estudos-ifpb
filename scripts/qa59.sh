#!/bin/bash
# QA59 — Prontidão por tópico do escopo (simulado component upgrade)
# 1) seed 3 runs sintéticas (Álgebra 67→50→33 · Lógica 33→50→100)
# 2) diálogo Plano completo: caixa de domínio por tópico + score recomputado
# 3) prompt do tutor com bloco "Domínio ATUAL por tópico"
# 4) fallbacks: run sem questions (nota geral) e sem runs (sem dados)
# 5) overflow + console + higiene
AB="agent-browser"
P="PASS"; F="FAIL"
ck() { if [ "$2" = "1" ]; then echo "$P: $1"; else echo "$F: $1 -> $3"; fi }

# Abre o diálogo "Plano completo" com retry (hidratação pós-reload no dev).
open_dialog() {
  for i in 1 2 3 4; do
    $AB eval '(() => { const b=document.querySelector("button[aria-label=\"Abrir plano completo da prova\"]"); if(!b) return "NO_BTN"; b.click(); return "clicked"; })()' >/dev/null
    sleep 2
    OK=$($AB eval '(() => document.querySelector("button[aria-label=\"Pedir ao tutor um plano para chegar pronto na prova\"]") ? "yes" : "no")()' | tr -d '"')
    [ "$OK" = "yes" ] && return 0
  done
  return 1
}

$AB set viewport 1280 900 >/dev/null
$AB open http://localhost:3000 >/dev/null; sleep 3

# ---------- SEED (runs newest-first; r3 28/09 é a mais recente) ----------
SEED=$($AB eval '(() => {
  const KEY="hub-estudos-ifpb:v2";
  const raw=JSON.parse(localStorage.getItem(KEY)||"{}");
  const q=(topic,status)=>({status,disciplineCode:"TEC.1984",topic,difficulty:"medio",statement:"[QA59] questao sintetica"});
  const run=(id,date,qs)=>({id,date,total:qs.length,solved:qs.filter(x=>x.status==="solved").length,missed:qs.filter(x=>x.status==="missed").length,skipped:0,durationSec:900,filters:{discipline:"TEC.1984"},questions:qs});
  raw.simuladoRuns=[
    run("qa59-r3","2026-09-28T10:00:00.000Z",[q("Álgebra Matricial","missed"),q("Álgebra Matricial","solved"),q("Álgebra Matricial","missed"),q("Lógica Matemática","solved"),q("Lógica Matemática","solved"),q("Lógica Matemática","solved")]),
    run("qa59-r2","2026-09-27T10:00:00.000Z",[q("Álgebra Matricial","solved"),q("Álgebra Matricial","missed"),q("Lógica Matemática","solved"),q("Lógica Matemática","missed")]),
    run("qa59-r1","2026-09-26T10:00:00.000Z",[q("Álgebra Matricial","solved"),q("Álgebra Matricial","solved"),q("Álgebra Matricial","missed"),q("Lógica Matemática","solved"),q("Lógica Matemática","missed"),q("Lógica Matemática","missed")])
  ];
  localStorage.setItem(KEY,JSON.stringify(raw));
  return "seeded:"+raw.simuladoRuns.length;
})()')
ck "seed 3 runs" "$(echo "$SEED" | grep -c 'seeded:3')" "$SEED"

$AB reload >/dev/null; sleep 3

# ---------- abre o diálogo Plano completo ----------
open_dialog && echo "$P: diálogo aberto" || echo "$F: diálogo não abreu"

# ---------- caixa de domínio por tópico ----------
BOXRAW=$($AB eval '(() => {
  const box=document.querySelector("[aria-label=\"Domínio atual por tópico do escopo da prova\"]");
  if(!box) return "NO_BOX";
  const rows=[...box.querySelectorAll(":scope > div")].map(r=>({
    topic:r.querySelector("span.font-medium")?.textContent||"",
    pct:[...r.querySelectorAll("span.tabular-nums")].map(s=>s.textContent)[0]||"",
    cross:!!r.querySelector("[aria-label*=\"foco\"]"),
    bar:[...r.querySelectorAll("span.block")].map(s=>s.className).join("|")
  }));
  return JSON.stringify(rows);
})()')
BOX=$(echo "$BOXRAW" | sed 's/\\"/"/g')
echo "BOX=$BOX"
ck "caixa domínio: 2 linhas" "$( [ "$(echo "$BOX" | grep -o 'topic' | wc -l | tr -d ' ')" = "2" ] && echo 1)" "$BOX"
ck "Álgebra 33% + mira foco" "$(echo "$BOX" | grep -cF '"topic":"Álgebra Matricial","pct":"33%","cross":true')" "$BOX"
ck "Álgebra barra rose" "$(echo "$BOX" | grep -cF 'bg-rose-500')" "$BOX"
ck "Lógica 100% sem mira" "$(echo "$BOX" | grep -cF '"topic":"Lógica Matemática","pct":"100%","cross":false')" "$BOX"
ck "Lógica barra emerald" "$(echo "$BOX" | grep -cF 'bg-emerald-500')" "$BOX"

# ---------- linha do simulado: 67% (Math.round(66.5)) + detail ----------
SIMRAW=$($AB eval '(() => {
  const rows=[...document.querySelectorAll("section[aria-label=\"Score de prontidão da Av1\"] div.space-y-2\\.5 > div")];
  const sim=rows.find(r=>(r.querySelector("p.truncate")?.textContent||"")==="Simulado da prova");
  if(!sim) return "NO_SIM";
  return JSON.stringify({
    pct:sim.querySelector("span.tabular-nums")?.textContent,
    detail:sim.querySelector("p.text-\\[10px\\]")?.textContent||""
  });
})()')
SIM=$(echo "$SIMRAW" | sed 's/\\"/"/g')
echo "SIM=$SIM"
ck "simulado pct = 67% (média do domínio, round 66.5)" "$(echo "$SIM" | grep -c '"pct":"67%"' | grep -x 1)" "$SIM"
ck "detail: domínio por tópico + última geral 67%" "$(echo "$SIM" | grep -c 'domínio por tópico do escopo (6 tentativas c/ detalhe) · última geral: 67%' | grep -x 1)" "$SIM"

# ---------- score recomputado do DOM = gauge ----------
SCORERAW=$($AB eval '(() => {
  const W={"Simulado da prova":30,"Exercícios de apoio":20,"Checklist de domínio":20,"Baralho da Av1":15,"Plano D-7":15};
  const rows=[...document.querySelectorAll("section[aria-label=\"Score de prontidão da Av1\"] div.space-y-2\\.5 > div")];
  const comps=rows.map(r=>{ const label=r.querySelector("p.truncate")?.textContent||""; const t=r.querySelector("span.tabular-nums")?.textContent||""; return {label,pct:t.includes("%")?parseInt(t):null}; });
  const wd=comps.filter(c=>c.pct!==null&&W[c.label]);
  const ws=wd.reduce((a,c)=>a+W[c.label],0);
  const score=ws>0?Math.round(wd.reduce((a,c)=>a+c.pct*W[c.label],0)/ws):null;
  const gauge=document.querySelector("section[aria-label=\"Score de prontidão da Av1\"] p.text-center span.tabular-nums")?.textContent;
  const hint=[...document.querySelectorAll("section[aria-label=\"Score de prontidão da Av1\"] span")].map(s=>s.textContent).find(t=>t&&t.includes("sobe o score"));
  return JSON.stringify({comps,recomputed:score,gauge,hint});
})()')
SCORE=$(echo "$SCORERAW" | sed 's/\\"/"/g')
echo "SCORE=$SCORE"
GAUGE=$(echo "$SCORE" | grep -o '"gauge":"[0-9]*"' | grep -o '[0-9]*' | tail -1)
RECOMP=$(echo "$SCORE" | grep -o '"recomputed":[0-9]*' | grep -o '[0-9]*')
ck "gauge = média ponderada recomputada ($GAUGE)" "$( [ -n "$GAUGE" ] && [ "$GAUGE" = "$RECOMP" ] && echo 1)" "gauge=$GAUGE recomp=$RECOMP"
ck "hint dinâmico (derrubar o foco)" "$(echo "$SCORE" | grep -c 'derrubar o tópico em foco sobe o score ao vivo' | grep -x 1)" "$SCORE"

# ---------- screenshot da caixa (scroll no dialog) ----------
$AB eval '(() => {
  const t=document.querySelector("[aria-label=\"Domínio atual por tópico do escopo da prova\"]");
  if(!t) return "NO_BOX";
  let el=t, scroller=null;
  while(el){ const cs=getComputedStyle(el); if((cs.overflowY==="auto"||cs.overflowY==="scroll")&&el.scrollHeight>el.clientHeight+50){scroller=el;break;} el=el.parentElement; }
  if(!scroller) return "NO_SCROLLER";
  const target=t.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
  for(let i=0;i<14;i++){ scroller.scrollTop+=(target-160)*0.5; if(Math.abs((t.getBoundingClientRect().top-scroller.getBoundingClientRect().top)-160)<8) break; }
  return "scrolled:" + Math.round(scroller.scrollTop);
})()' >/dev/null
sleep 1
$AB screenshot /home/z/my-project/scripts/qa59-prontidao-topicos.png >/dev/null && echo "$P: screenshot dialog"

# ---------- prompt do tutor ----------
$AB eval '(() => { const b=document.querySelector("button[aria-label=\"Pedir ao tutor um plano para chegar pronto na prova\"]"); if(!b) return "NO_TUTOR_BTN"; b.click(); return "clicked"; })()' >/dev/null
sleep 3
TUTRAW=$($AB eval '(() => {
  const tas=[...document.querySelectorAll("textarea")];
  const t=tas.find(x=>x.value.includes("PRONTIDÃO"));
  if(!t) return "NOT_FOUND:"+tas.length;
  return JSON.stringify({len:t.value.length,hasBloco:t.value.includes("Domínio ATUAL por tópico do escopo da prova"),alg:t.value.includes("- Álgebra Matricial: 33% (Δ -34pp em 3 tentativas)"),log:t.value.includes("- Lógica Matemática: 100% (Δ +67pp em 3 tentativas)"),instr:t.value.includes("e o domínio por tópico do escopo")});
})()')
TUT=$(echo "$TUTRAW" | sed 's/\\"/"/g')
echo "TUT=$TUT"
ck "tutor: bloco domínio + séries exatas" "$(echo "$TUT" | grep -c '"hasBloco":true,"alg":true,"log":true,"instr":true' | grep -x 1)" "$TUT"
$AB screenshot /home/z/my-project/scripts/qa59-tutor-prompt-prontidao.png >/dev/null && echo "$P: screenshot tutor"

# ---------- higiene do tutor ----------
$AB eval '(() => { const t=[...document.querySelectorAll("textarea")].find(x=>x.value.includes("PRONTIDÃO")); if(!t) return "no-ta"; const st=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set; st.call(t,""); t.dispatchEvent(new Event("input",{bubbles:true})); return "cleared"; })()' >/dev/null

# ---------- FALLBACK B: run sem questions → nota geral, sem caixa ----------
$AB eval '(() => { const KEY="hub-estudos-ifpb:v2"; const raw=JSON.parse(localStorage.getItem(KEY)||"{}"); raw.simuladoRuns=[{id:"qa59-old",date:"2026-09-27T10:00:00.000Z",total:4,solved:2,missed:2,skipped:0,durationSec:800,filters:{discipline:"TEC.1984"}}]; localStorage.setItem(KEY,JSON.stringify(raw)); return "ok"; })()' >/dev/null
$AB open http://localhost:3000 >/dev/null; sleep 3
open_dialog && echo "$P: diálogo aberto (fallback B)" || echo "$F: diálogo não abreu (fallback B)"
FBRAW=$($AB eval '(() => {
  const box=document.querySelector("[aria-label=\"Domínio atual por tópico do escopo da prova\"]");
  const rows=[...document.querySelectorAll("section[aria-label=\"Score de prontidão da Av1\"] div.space-y-2\\.5 > div")];
  const sim=rows.find(r=>(r.querySelector("p.truncate")?.textContent||"")==="Simulado da prova");
  return JSON.stringify({box:!!box,pct:sim?.querySelector("span.tabular-nums")?.textContent,detail:sim?.querySelector("p.text-\\[10px\\]")?.textContent});
})()')
FB=$(echo "$FBRAW" | sed 's/\\"/"/g')
echo "FB=$FB"
ck "fallback sem questions: 50% última corrida, sem caixa" "$(echo "$FB" | grep -c '"box":false,"pct":"50%","detail":"última: 50% (27/09)"' | grep -x 1)" "$FB"
$AB press Escape >/dev/null

# ---------- FALLBACK A: sem runs → sem dados ----------
$AB eval '(() => { const KEY="hub-estudos-ifpb:v2"; const raw=JSON.parse(localStorage.getItem(KEY)||"{}"); delete raw.simuladoRuns; localStorage.setItem(KEY,JSON.stringify(raw)); return "ok"; })()' >/dev/null
$AB open http://localhost:3000 >/dev/null; sleep 3
open_dialog && echo "$P: diálogo aberto (fallback A)" || echo "$F: diálogo não abreu (fallback A)"
FBARAW=$($AB eval '(() => {
  const box=document.querySelector("[aria-label=\"Domínio atual por tópico do escopo da prova\"]");
  const rows=[...document.querySelectorAll("section[aria-label=\"Score de prontidão da Av1\"] div.space-y-2\\.5 > div")];
  const sim=rows.find(r=>(r.querySelector("p.truncate")?.textContent||"")==="Simulado da prova");
  return JSON.stringify({box:!!box,pct:sim?.querySelector("span.tabular-nums")?.textContent,detail:sim?.querySelector("p.text-\\[10px\\]")?.textContent});
})()')
FBA=$(echo "$FBARAW" | sed 's/\\"/"/g')
echo "FBA=$FBA"
ck "fallback sem runs: sem dados, sem caixa" "$(echo "$FBA" | grep -c '"box":false,"pct":"sem dados","detail":"sem dados — a evidência mais importante ainda não existe"' | grep -x 1)" "$FBA"
$AB press Escape >/dev/null

# ---------- overflow + console + higiene final ----------
OV=$($AB eval 'document.documentElement.scrollWidth+":"+document.documentElement.clientWidth' | tr -d '"')
ck "overflow 0 (sw=cw)" "$( [ "$(echo "$OV" | cut -d: -f1)" = "$(echo "$OV" | cut -d: -f2)" ] && echo 1)" "$OV"
$AB eval '(() => { const KEY="hub-estudos-ifpb:v2"; const raw=JSON.parse(localStorage.getItem(KEY)||"{}"); delete raw.simuladoRuns; localStorage.setItem(KEY,JSON.stringify(raw)); return localStorage.getItem(KEY).includes("qa59"); })()' >/dev/null
CONS=$($AB console 2>&1 | grep -i "error" | grep -v "Turbopack\|hydra" | head -3)
ck "console sem erros" "$( [ -z "$CONS" ] && echo 1)" "$CONS"
echo "QA59 DONE"
