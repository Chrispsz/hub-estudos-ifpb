#!/usr/bin/env python3
"""Restaura o worklog.md a partir do output persistido do Read tool
(formato: `<spaces><n>→<conteúdo>`), validando numeração monótonica."""
import re

SRC = '/home/z/my-project/tool-results/read_1790688614800_5cdffddc082f.txt'
DST = '/home/z/my-project/worklog.md'

pat = re.compile(r'^ *(\d+)→(.*)$')
out = []
expected = 1
with open(SRC, encoding='utf-8') as f:
    for raw in f.read().split('\n'):
        m = pat.match(raw)
        if not m:
            raise SystemExit(f'ERRO: linha sem prefixo esperado: {raw[:80]!r} (esperava {expected})')
        n = int(m.group(1))
        if n != expected:
            raise SystemExit(f'ERRO: numeração quebrou: vi {n}, esperava {expected}')
        out.append(m.group(2))
        expected += 1

content = '\n'.join(out)
with open(DST, 'w', encoding='utf-8') as f:
    f.write(content)

tasks = re.findall(r'^Task ID: (\S+)', content, flags=re.M)
print(f'OK: {len(out)} linhas restauradas, {len(tasks)} entradas Task ID')
print('últimas 4 entradas:', tasks[-4:])
print('bytes:', len(content.encode("utf-8")))
print('head:', content[:80].replace("\n", "\\n"))
print('tail:', content[-120:].replace("\n", "\\n"))
