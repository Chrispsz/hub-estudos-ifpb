# t186 — O CONSERTO DAS PERGUNTAS DE AUTOAVALIAÇÃO (dados reais do acervo)
#
# Dois bugs de conteúdo, um script:
#   A) Os 4 resumos de Matemática (mat-00-matrizes, mat-01-matrizes,
#      mat-logica-lista, mat-logica-slides) NÃO tinham pergunta de
#      autoavaliação NENHUMA — e a tarefa 3 da VÉSPERA do plano
#      (math-exam-prep.ts, offset 1) promete exatamente isso para a noite
#      de 30/09. Este script escreve 8 perguntas autorais por material,
#      cada uma fiel ao conteúdo REAL do resumo (conceitos_chave,
#      formulas_regras, erros_comuns).
#   B) 13 resumos guardavam as perguntas sob a chave "perguntas_autoavaliação"
#      (com acento) — o diálogo lê "perguntas_autoavaliacao" (sem acento):
#      60 perguntas escritas e INVISÍVEIS. Correção por substituição literal
#      no texto bruto (byte-safe, sem reformatar o JSON).
#
# Idempotente: rodar de novo não duplica nem reescreve o que já está certo.

import json
import sys
from pathlib import Path

BASE = Path('public/data/ai-summaries')
CANONICA = 'perguntas_autoavaliacao'
ACENTUADA = 'perguntas_autoavaliação'

# ---------------------------------------------------------------------------
# A) As 32 perguntas autorais — cada uma ancorada no conteúdo real do resumo.
# ---------------------------------------------------------------------------

PERGUNTAS = {
    'mat-00-matrizes': [
        'Numa matriz m × n, o que m e n significam? E no elemento a_{ij}, qual índice é a linha e qual é a coluna?',
        'Qual a diferença entre matriz diagonal e matriz identidade? A identidade é um caso particular de qual?',
        'Como se monta a transposta de A? O que acontece com a ordem (m × n) dela?',
        'Quando o produto A·B existe? O que tem que bater entre as duas ordens?',
        'Por que AB ≠ BA em geral? Que propriedade dos números reais a multiplicação de matrizes NÃO herda?',
        'Se AB = 0 (matriz nula), posso concluir que A = 0 ou B = 0? Justifique com um contraexemplo mental.',
        'O que a igualdade AA⁻¹ = A⁻¹A = I_n define? Que tipo de matriz é que pode ter inversa?',
        'Quanto vale (AB)^t? A ordem das matrizes na resposta é a mesma do produto original?',
    ],
    'mat-01-matrizes': [
        'Para somar A + B, o que as duas matrizes precisam ter em comum? Como calculo (A + B)_{ij}?',
        'O que acontece com cada elemento quando multiplico a matriz inteira por um escalar k?',
        'No produto AB, que conta produz o elemento da linha i, coluna j? (fale em linha de A e coluna de B)',
        'Quando uma matriz quadrada é simétrica? E antissimétrica — o que a diagonal principal tem de especial?',
        'Antes de calcular A² ou A⁻¹, o que preciso conferir na matriz A?',
        'Qual verificação entre A e A⁻¹ confirma que a inversa está certa? Escreva a igualdade de memória.',
        'Na equação matricial X + A = B, como isolo o X? (pense no que "somar −A" faz nos dois lados)',
        'Duas matrizes iguais exigem o quê? O que acontece se UMA posição divergir?',
    ],
    'mat-logica-lista': [
        '"Feche a porta!" e "Que horas são?" são proposições? O que falta nelas para serem?',
        'Quando p ∨ q é verdadeira? E p ∧ q — qual o único caso verdadeiro?',
        'Qual o ÚNICO caso em que p → q é falsa? (decore este — a prova cobra)',
        'Quando p ↔ q é verdadeira? E falsa?',
        'Como nego p ∨ q? E p ∧ q? (as duas leis de De Morgan, de memória)',
        'Quantas linhas tem a tabela-verdade com 3 proposições simples? E com 4?',
        'O que distingue tautologia de contradição na coluna final da tabela-verdade? Onde a contingência entra?',
        'Num argumento (Q13–15), o que torna a conclusão VÁLIDA — a veracidade das premissas ou a inferência?',
    ],
    'mat-logica-slides': [
        'Qual a ordem de precedência dos conectivos? O que resolve primeiro: ∧ ou ∨? E ∼?',
        'Enuncie de memória o princípio da Não Contradição e o do Terceiro Excluído.',
        'Se p é FALSA, quanto vale p → q? Por que a condicional só "quebra" num caso?',
        'O "ou" da lógica formal (∨) é inclusivo ou exclusivo? O que isso significa em V/F?',
        'Quantas linhas tem a tabela-verdade de uma proposição com n proposições simples? (a fórmula)',
        'Na tabela-verdade, como classifico a proposição composta pela coluna final (tautologia, contradição, contingência)?',
        'O que a negação ∼p faz com o valor lógico? Negação de V é...?',
        'Numa disjunção ∨ com uma proposição V e outra F, o valor lógico é V ou F? E na conjunção ∧?',
    ],
}

# Os 13 arquivos com a chave acentuada (contagem esperada de perguntas —
# o script confere para garantir que a troca não perdeu nada).
ACENTUADOS_ESPERADOS = {
    'alg-lista.summary.json': 5,
    'alg-monitoria-discord.summary.json': 2,
    'alg-programas-c-autorais.summary.json': 4,
    'alg-questoes-semana1.summary.json': 4,
    'alg-questoes-semana2.summary.json': 5,
    'alg-questoes-semana3.summary.json': 5,
    'ing-video-corpo-verbos.summary.json': 3,
    'lm-exemplo-formularios.summary.json': 3,
    'lm-gitbook-formularios.summary.json': 5,
    'lm-gitbook-metadados.summary.json': 6,
    'lm-html-06-formularios.summary.json': 6,
    'lm-html-07-metadados.summary.json': 7,
    'rht-teletrabalho-serpro.summary.json': 5,
}

falhas = 0

# --- A1) troca literal da chave acentuada → canônica (byte-safe) ------------
for name, esperado in ACENTUADOS_ESPERADOS.items():
    p = BASE / name
    raw = p.read_text(encoding='utf-8')
    n_ocorr = raw.count(f'"{ACENTUADA}"')
    if n_ocorr == 0:
        d = json.loads(raw)
        if CANONICA in d and len(d[CANONICA]) == esperado:
            print(f"  = {name}: canônica já viva com {esperado} perguntas (idempotente)")
            continue
        print(f"  ✗ {name}: chave acentuada AUSENTE e canônica não confere — abortando")
        falhas += 1
        continue
    if n_ocorr != 1:
        print(f"  ✗ {name}: {n_ocorr} ocorrências de \"{ACENTUADA}\" (esperava 1) — abortando")
        falhas += 1
        continue
    # confere a contagem ANTES de tocar
    d = json.loads(raw)
    if len(d.get(ACENTUADA, [])) != esperado:
        print(f"  ✗ {name}: {len(d.get(ACENTUADA, []))} perguntas (esperava {esperado}) — abortando")
        falhas += 1
        continue
    trocado = raw.replace(f'"{ACENTUADA}"', f'"{CANONICA}"')
    confere = json.loads(trocado)
    if len(confere.get(CANONICA, [])) != esperado:
        print(f"  ✗ {name}: pós-troca não confere — arquivo NÃO gravado")
        falhas += 1
        continue
    p.write_text(trocado, encoding='utf-8')
    print(f"  ✓ {name}: chave acentuada → canônica ({esperado} perguntas resgatadas)")

# --- A2) as 32 perguntas nos 4 resumos de Matemática ------------------------
for mid, perguntas in PERGUNTAS.items():
    p = BASE / f'{mid}.summary.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    if CANONICA in d:
        if d[CANONICA] == perguntas:
            print(f"  = {mid}: {len(perguntas)} perguntas já presentes (idempotente)")
            continue
        print(f"  ✗ {mid}: canônica existe com conteúdo DIFERENTE — abortando (revisão manual)")
        falhas += 1
        continue
    d[CANONICA] = perguntas
    p.write_text(
        json.dumps(d, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    print(f"  ✓ {mid}: {len(perguntas)} perguntas autorais escritas")

# --- veredicto ---------------------------------------------------------------
print()
if falhas:
    print(f"FALHAS: {falhas} — rever antes de prosseguir")
    sys.exit(1)

# varredura final: nenhum acento sobrevive no acervo; os 4 de Matemática têm 8
sobras = [p.name for p in BASE.glob('*.summary.json')
          if ACENTUADA in json.loads(p.read_text(encoding='utf-8'))]
for mid in PERGUNTAS:
    d = json.loads((BASE / f'{mid}.summary.json').read_text(encoding='utf-8'))
    n = len(d.get(CANONICA, []))
    estado = 'ok' if n == 8 else f'ERRO ({n})'
    print(f"  {mid}: {n} perguntas [{estado}]")
print(f"chaves acentuadas restantes no acervo: {len(sobras)} {sobras}")
print("CONSERTO COMPLETO" if not sobras else "AINDA HÁ SOBRAS")
sys.exit(0 if not sobras else 1)
