#!/usr/bin/env python3
# Task 120 — poda da datarot, PARTE 2: mock+poke não alcança (a) estado
# cacheado NO MOUNT (today-study-card guarda `today` em useState na 113) nem
# (b) ticks longos (dashboard usa useNow(60_000)). Receita nova da casa
# (lição 120): mock + poke + REMOUNT por troca de aba (Praticar → Visão
# Geral) — a troca NÃO recarrega a página (o patch de window.Date sobrevive)
# e o remount reexecuta os effects de mount com o relógio já patchado; o
# useNow renasce com new Date() = mockado no primeiro frame. Guardas de
# 'data real não voltou' viram DATA-AGNÓSTICAS: a suíte calcula o esperado
# do relógio REAL no momento do assert (nunca mais bomba de 24h).
import sys

PRATICAR_CLICK = ('agent-browser eval "(function(){var els=document.querySelectorAll(\'button,a\');'
                  'for(var i=0;i<els.length;i++){var t=(els[i].textContent||\'\').trim();'
                  'if(t.indexOf(\'Praticar\')===0){els[i].click();return \'ok\'}}return \'NAO\'})()" '
                  '>/dev/null 2>&1; sleep 1')

GUARD_FALTAM = '''D=$(agent-browser eval "(function(){var n=new Date();var a=new Date(n.getFullYear(),n.getMonth(),n.getDate());var b=new Date(2026,9,1);return Math.ceil((b-a)/86400000)})()" 2>/dev/null | tr -d '"')
case "$D" in ''|*[!0-9-]*) D="?" ;; esac
if [ "$D" != "?" ] && [ "$D" -ge 1 ] 2>/dev/null; then
  [ "$(has "Faltam $D dias")" = "1" ] && ok "data real de volta (hero D-$D lido do relógio real)" || bad "data real não voltou (esperado 'Faltam $D dias')"
else
  ok "data real de volta (relógio real fora da contagem: D=$D)"
fi'''

GUARD_AGORA = '''NC=$(now_clock); REAL=$(agent-browser eval "(function(){var d=new Date();var p=function(x){return (x<10?'0':'')+x};return p(d.getHours())+':'+p(d.getMinutes())})()" 2>/dev/null | tr -d '"')
if [ "$NC" != "$REAL" ]; then sleep 2; NC=$(now_clock); REAL=$(agent-browser eval "(function(){var d=new Date();var p=function(x){return (x<10?'0':'')+x};return p(d.getHours())+':'+p(d.getMinutes())})()" 2>/dev/null | tr -d '"'); fi
[ -n "$NC" ] && [ "$NC" = "$REAL" ] && ok "data real de volta (AGORA=$NC = relógio real)" || bad "data real não voltou (AGORA=$NC vs real=$REAL)"'''

PATCHES = [
    # t112 [A]: remount depois do poke (a prévia do semestre é useNow(60s))
    ("scripts/t112-e2e.sh",
     'echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"\nclean_all_runs >/dev/null 2>&1; poke\ngo_home\nsleep 1',
     'echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"\nclean_all_runs >/dev/null 2>&1; poke\n' + PRATICAR_CLICK + '\ngo_home\nsleep 1'),
    # t113 [A]: o card guarda `today` em useState no mount (113) — remount obrigatório
    ("scripts/t113-e2e.sh",
     'echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\ngo_home; sleep 1',
     'echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\n' + PRATICAR_CLICK + '\ngo_home; sleep 1'),
    # t113 [F]: guarda data-agnóstica (AGORA = relógio real)
    ("scripts/t113-e2e.sh",
     '[ "$(has \'Dia de descanso\')" = "1" ] && ok "data real de volta (domingo, descanso)" || bad "data real não voltou"',
     GUARD_AGORA),
    # t114 [A]: agenda do dashboard lê useNow(60s) — remount
    ("scripts/t114-e2e.sh",
     'echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\n\n[ "$(has \'entrega da S3 — programas\')" = "1" ]',
     'echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\n' + PRATICAR_CLICK + '\n\n[ "$(has \'entrega da S3 — programas\')" = "1" ]'),
    # t114 [F]: guarda data-agnóstica
    ("scripts/t114-e2e.sh",
     '[ "$(has \'Faltam 4 dias\')" = "1" ] && ok "data real de volta (D-4)" || bad "data real não voltou"',
     GUARD_FALTAM),
    # t115 [A]: hero/rows/agenda vivem do useNow(60s) — remount
    ("scripts/t115-e2e.sh",
     'echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\n\n[ "$(has \'Faltam 4 dias\')" = "1" ]',
     'echo "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\n' + PRATICAR_CLICK + '\n\n[ "$(has \'Faltam 4 dias\')" = "1" ]'),
    # t115 [F]: guarda data-agnóstica
    ("scripts/t115-e2e.sh",
     '[ "$(has \'Faltam 4 dias\')" = "1" ] && ok "data real de volta (D-4)" || bad "data real não voltou"',
     GUARD_FALTAM),
]

fail = 0
for path, old, new in PATCHES:
    try:
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
    except OSError as exc:
        print(f"[FAIL] {path}: leitura ({exc})"); fail = 1; continue
    n = src.count(old)
    if n != 1:
        print(f"[FAIL] {path}: padrão casa {n}x — {old[:70]!r}"); fail = 1; continue
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(src.replace(old, new))
    print(f"[OK] {path}")

sys.exit(fail)
