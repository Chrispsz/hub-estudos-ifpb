#!/usr/bin/env python3
# Task 120 — A PODA DA DATAROT COMPLETA: as 8 suítes que ainda liam a DATA
# REAL nas fases [A]/[PREP] viraram bombas-relógio de 24h quando o UTC
# virou 28/09 (lição 117, reescrita pela 118: 't107 segue com poda
# pendente'). Receita da casa (poda da 117): mock 27/09 20:00 (D-4, o
# domingo real em que as fases foram escritas) + poke, NUNCA reload — o
# patch de window.Date morre a cada open. As asserções NÃO mudam de valor:
# sob mock D-4 elas dizem exatamente o que diziam ('faltam 4 dias',
# 'em 2d', kit ausente, domingo de descanso) — só a FONTE do relógio muda.
import sys

PATCHES = [
    # (arquivo, old, new) — todos devem casar EXATAMENTE uma vez.
    ("scripts/t103-e2e.sh",
     'echo "=== [PREP] storage limpo + aba Progresso (data real dom 27/09, D-4) ==="',
     'echo "=== [PREP] storage limpo + aba Progresso (mock dom 27/09 20:00, D-4 — poda da 120) ==="'),
    ("scripts/t103-e2e.sh",
     'sleep 5\nif go_progress; then ok "aba Progresso aberta (h2 \'Relatório semanal\' visível)"; else bad "navegação para Progresso falhou"; fi',
     'sleep 5\necho "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\nif go_progress; then ok "aba Progresso aberta (h2 \'Relatório semanal\' visível)"; else bad "navegação para Progresso falhou"; fi'),
    ("scripts/t103-e2e.sh",
     'echo "=== [A] DATA REAL (D-4): relatório normal, faixa fora da janela (regra da 88) ==="',
     'echo "=== [A] MOCK 27/09 (D-4): relatório normal, faixa fora da janela (regra da 88) — poda da 120, lição 117 ==="'),
    ("scripts/t104-e2e.sh",
     'echo "=== [A] DATA REAL (D-4): dialog do material do ESCOPO — chip + ponte ==="\necho "  open: $(open_mat_dialog \'Matrizes — Aula 00\')"',
     'echo "=== [A] MOCK 27/09 (D-4): dialog do material do ESCOPO — chip + ponte — poda da 120, lição 117 ==="\necho "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\necho "  open: $(open_mat_dialog \'Matrizes — Aula 00\')"'),
    ("scripts/t106-e2e.sh",
     'echo "=== [A] DATA REAL (dom 27/09, D-4): sanity ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1\nsleep 2\nKIT=$(has \'Kit da véspera\')\n[ "$KIT" = "0" ] && ok "data real D-4: kit ausente" || bad "data real: kit presente fora da janela"',
     'echo "=== [A] MOCK 27/09 (D-4): sanity — poda da 120, lição 117 ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1\nsleep 1\necho "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\nKIT=$(has \'Kit da véspera\')\n[ "$KIT" = "0" ] && ok "mock D-4: kit ausente" || bad "kit presente fora da janela"'),
    ("scripts/t108-e2e.sh",
     'echo "=== [A] DATA REAL (dom 27/09, D-4): a calculadora é só calculadora ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1\nclean_all',
     'echo "=== [A] MOCK 27/09 (D-4): a calculadora é só calculadora — poda da 120, lição 117 ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1\necho "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke\nclean_all'),
    ("scripts/t112-e2e.sh",
     'echo "=== [A] DATA REAL (dom 27/09, D-4): a sugestão vira aliada da semana ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1\nclean_all_runs >/dev/null 2>&1; poke',
     'echo "=== [A] MOCK 27/09 (D-4): a sugestão vira aliada da semana — poda da 120, lição 117 ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1\necho "  mock D-4: $(mock_date 2026-09-27T20:00:00)"\nclean_all_runs >/dev/null 2>&1; poke'),
    ("scripts/t113-e2e.sh",
     'echo "=== [A] DATA REAL (dom 27/09, D-4, dia off): o AGORA no cabeçalho ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1\nsleep 2\ngo_home; sleep 1',
     'echo "=== [A] MOCK 27/09 (D-4, domingo/dia off): o AGORA no cabeçalho — poda da 120, lição 117 ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1\nsleep 1\necho "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\ngo_home; sleep 1'),
    ("scripts/t114-e2e.sh",
     'echo "=== [A] DATA REAL (dom 27/09, D-4): a S3 existe na agenda acadêmica ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2\n',
     'echo "=== [A] MOCK 27/09 (D-4): a S3 existe na agenda acadêmica — poda da 120, lição 117 ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 1\necho "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\n'),
    ("scripts/t115-e2e.sh",
     'echo "=== [A] DATA REAL (dom 27/09, D-4): o hero e as fileiras vivem do useNow ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 2\n',
     'echo "=== [A] MOCK 27/09 (D-4): o hero e as fileiras vivem do useNow — poda da 120, lição 117 ==="\nagent-browser open http://localhost:3000 >/dev/null 2>&1\nsleep 6\nagent-browser set viewport 1440 900 >/dev/null 2>&1; sleep 1\necho "  mock D-4: $(mock_date 2026-09-27T20:00:00)"; poke; sleep 1\n'),
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
        print(f"[FAIL] {path}: padrão casa {n}x (esperado 1) — {old[:60]!r}"); fail = 1; continue
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(src.replace(old, new))
    print(f"[OK] {path}")

sys.exit(fail)
