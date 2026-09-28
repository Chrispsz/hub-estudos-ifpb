#!/usr/bin/env bash
# t88-e2e.sh — QA da rodada 18:15: a fila 'Faça hoje' lê o SIMULADO OFICIAL.
# Matriz: (A) D-4 real sem regressão; (B) mock 29/09 sem run = pointer rosa;
# (C) 29/09 + run 60% = 'feito hoje ✓' + placa amber + chip; (D) run 80% =
# emerald + ✓; (E) 30/09 = 'D-1 ... simulado de ontem feito'; (F) 01/10 =
# 'D-0 ... te preparou'; (G) higiene. Lição 85: textContent normalizado.
set -uo pipefail
KEY='hub-estudos-ifpb:v2'

step() { echo; echo "=== $1 ==="; }

# helper: estado da LI da Matemática na fila (texto normalizado + classes)
fila() {
  agent-browser eval "(() => {
    const lis=[...document.querySelectorAll('li')];
    const li=lis.find(l=>/Plano da prova|Simulado da Av1 feito hoje|Anotar a nota/.test(l.textContent||''));
    if(!li) return 'MAT-LI-AUSENTE';
    return JSON.stringify({t:(li.textContent||'').replace(/\\s+/g,' ').trim().slice(0,220), c:li.className});
  })()" 2>&1 | tail -1
}

mock() { # $1 = '2026-09-29T15:30:00'
  agent-browser eval "(() => {
    const M=new Date('$1').getTime();
    class FakeDate extends Date { constructor(...a){ a.length===0 ? super(M) : super(...a); } static now(){ return M; } }
    window.Date=FakeDate; return 'mock ok $1';
  })()" 2>&1 | tail -1
}

tick() { # re-render REAL: ida e volta de aba (SPA remonta a view; lição 80)
  agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Estudar'); if(b){b.click(); return 'estudar';} return 'no-btn'; })()" >/dev/null 2>&1
  sleep 1
  agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Visão Geral'); if(b){b.click(); return 'home';} return 'no-btn'; })()" >/dev/null 2>&1
  sleep 1
}

seed() { # $1 solved $2 total
  agent-browser eval "(() => {
    const data=JSON.parse(localStorage.getItem('$KEY')||'{}');
    data.simuladoRuns=[{id:'qa-seed-88',date:'2026-09-29T15:30:00',mode:'prova',total:$2,solved:$1,missed:($2-$1-1<0?0:$2-$1-1),skipped:1,durationSec:4200,filters:{discipline:'TEC.1984'}}];
    localStorage.setItem('$KEY',JSON.stringify(data));
    window.dispatchEvent(new StorageEvent('storage',{key:'$KEY',newValue:JSON.stringify(data)}));
    return 'seed '+$1+'/'+$2;
  })()" 2>&1 | tail -1
}

cleanup() {
  agent-browser eval "(() => {
    const data=JSON.parse(localStorage.getItem('$KEY')||'{}');
    data.simuladoRuns=(data.simuladoRuns||[]).filter(r=>r.id!=='qa-seed-88');
    localStorage.setItem('$KEY',JSON.stringify(data));
    window.dispatchEvent(new StorageEvent('storage',{key:'$KEY',newValue:JSON.stringify(data)}));
    return 'cleaned, runs='+(data.simuladoRuns||[]).length;
  })()" 2>&1 | tail -1
}

step "A) data real (27/09, D-4) — sem regressão: pointer D-4 rosa"
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
fila

step "B) mock 29/09 SEM run — pointer 'Plano da prova (D-2): SIMULADO' rosa (compromisso)"
mock '2026-09-29T15:30:00'
tick
fila

step "C) 29/09 + run 60% — 'feito hoje ✓' + placa amber + chip 'simulado 60% · meta 70'"
seed 6 10
sleep 2
fila

step "D) run atualizado 80% — chip '80% · meta 70 ✓' + placa emerald"
seed 8 10
sleep 2
fila

step "E) mock 30/09 (véspera) — 'D-1 ... simulado de ontem feito' + chip"
mock '2026-09-30T09:00:00'
tick
fila

step "F) mock 01/10 (prova) — 'D-0 ... o simulado te preparou' + chip"
mock '2026-10-01T08:00:00'
tick
fila

step "G) higiene — run removido, reload, data real volta"
cleanup
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 4
agent-browser eval "(() => { const d=JSON.parse(localStorage.getItem('$KEY')||'{}'); return 'runs='+(d.simuladoRuns||[]).length+' grades='+Object.keys(d.realGrades||{}).length; })()" 2>&1 | tail -1
fila
echo; echo "FIM T88"
