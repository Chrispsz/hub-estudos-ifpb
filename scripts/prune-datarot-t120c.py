#!/usr/bin/env python3
# Task 120 — poda da datarot, PARTE 3 (t115): dois consertos de origem
# diversa. (1) row_badge_class/row_badge_pulse procuravam os selos do
# vocabulário ANTIGO ('em dia'/'atrasada') — a 118 trocou o vocabulário do
# painel ('em estudo'/'sem registro'; a palavra 'atrasada' saiu) e o helper
# da 115 ficou cego (NOCARD) — regressão latente da 118, não da poda.
# (2) o badge nextEval do HEADER não remonta (o header é global) e lê o
# useNow(60s) próprio — sob mock ele continua no relógio REAL: a asserção
# vira data-agnóstica (calcula o esperado do relógio real no assert).
import sys

OLD_SELO = "(t.indexOf('em dia')>=0||t.indexOf('atrasada')>=0)"
NEW_SELO = "(t.indexOf('em dia')>=0||t.indexOf('atrasada')>=0||t.indexOf('em estudo')>=0||t.indexOf('sem registro')>=0)"

OLD_HEADER = ('[ "$(has \'em 2d\')" = "1" ] && [ "$(has \'4d → Av1 (Matemática)\')" = "1" ] && '
              'ok "header: simulado \'em 2d\' + nextEval \'4d → Av1\' (o badge lê o useNow)" || bad "header badges errados"')

NEW_HEADER = ('HD=$(agent-browser eval "(function(){var n=new Date();var a=new Date(n.getFullYear(),n.getMonth(),n.getDate());var b=new Date(2026,9,1);return Math.ceil((b-a)/86400000)})()" 2>/dev/null | tr -d \'"\')\n'
              '[ "$(has \'em 2d\')" = "1" ] && [ "$(has "${HD}d → Av1 (Matemática)")" = "1" ] && '
              'ok "header: simulado \'em 2d\' (mock) + nextEval \'${HD}d → Av1\' (o badge segue o relógio REAL — o header não remonta)" || bad "header badges errados (HD=$HD)"')

PATCHES = [
    ("scripts/t115-e2e.sh", OLD_SELO, NEW_SELO),
    ("scripts/t115-e2e.sh", OLD_SELO, NEW_SELO),  # row_badge_class + row_badge_pulse (2 ocorrências idênticas)
    ("scripts/t115-e2e.sh", OLD_HEADER, NEW_HEADER),
]

fail = 0
for path, old, new in PATCHES:
    try:
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
    except OSError as exc:
        print(f"[FAIL] {path}: leitura ({exc})"); fail = 1; continue
    n = src.count(old)
    if n < 1:
        print(f"[FAIL] {path}: padrão não casa — {old[:70]!r}"); fail = 1; continue
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(src.replace(old, new, 1))  # uma ocorrência por passada
    print(f"[OK] {path} ({n} ocorrência(s) restantes)")

sys.exit(fail)
