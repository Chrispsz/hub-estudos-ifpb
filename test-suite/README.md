# 🧩 Suíte Quebra-Cabeça do Hub de Estudos

Teste completo **em cadeia**: seis peças que encaixam uma na outra. Cada peça
grava um artefato em `.chain/` e a peça seguinte consome o estado anterior.
Se uma peça não encaixa, a cadeia para exatamente ali — você sabe QUAL peça,
QUAL check e POR QUÊ.

```
PEÇA 0 ─▶ PEÇA 1 ─▶ PEÇA 2 ─▶ PEÇA 3 ─▶ PEÇA 4 ─▶ PEÇA 5 ─▶ PEÇA 6 ─▶ report.md
ambiente   código     núcleo     API HTTP    jornada     visual      produção
           estático   puro                   E2E         + mobile    (Vercel)
```

## Como rodar

```bash
bun test-suite/run-all.ts              # cadeia completa (para na 1ª peça que falhar)
bun test-suite/run-all.ts --continue   # roda tudo, mesmo com falha (diagnóstico)
bun test-suite/run-all.ts --skip-e2e   # peças 0–3 apenas (rápido, sem browser)
bun test-suite/run-all.ts --only=2     # só uma peça
bun test test-suite/unit/              # só os 132 testes unitários (bun:test)
```

O resultado final sempre vira **`test-suite/report.md`**.

## O que cada peça cobre

| # | Peça | Cobre |
|---|------|-------|
| 0 | **Ambiente** | bun, node_modules, prisma/schema+client, db local, dev server 200, HTML servido, tokens do tema |
| 1 | **Qualidade do código** | `eslint .` zerado · `tsc --noEmit` do app E da suíte zerado · **leis da casa**: fetch 100% relativo (nada de `http://localhost`/porta na URL), `z-ai-web-dev-sdk` confinado ao backend (`src/app/api`), higiene de `console.log` e `@ts-ignore`, pontos de entrada essenciais |
| 2 | **Núcleo puro** | **198 testes `bun:test` em 16 arquivos**: **compilador clab em cadeia** (lexer → parser → VM passo-a-passo → snapshots/fork → fluxograma), acervo oficial de exemplos, diagnóstico didático, **cronograma inteligente** (mediana aprendida, clamp 50–240, detecção automática manhã/tarde/noite, desconto do estudo real), **sessão sintonizada** (fitPomodoro, estados sem-sessao/micro/pronta/em-andamento/cumprida, sugestão de orçamento com reforço de véspera), **dia pronto** (filas ordenadas, conclusão pelo uso, encaixe do Pomodoro), radar de provas (pressão D-3/D-7/D-21), calculadora de médias, maestria (marcado é aviso, questões sem ajuda são prova), sinais de aprendizagem (puxada pesa, fluida respira), retrato do dia, **calendário oficial vivo** (semana do semestre com pausa de dezembro congelada, régua D-N, eventos), **integridade do acervo** (matérias→grade, exercícios→unidades, avaliações→datas, pesos somando 100%, arquivos sempre locais), **fila do dia** (buildDayPlan: blocos íntegros, cap, foco do dia, Ciclo do Erro com destino de re-teste), **ciclo do erro** (aberto→re-testado→dominado com 2 acertos de cabeça, dedupe por unidade, nada de fantasma), **caderno de erros** (recorrência, janelas 48h/7d, agrupamento) e **segurança de conteúdo** (LaTeX→KaTeX, tokenização de código, aviso honesto de backup) |
| 3 | **API HTTP** | `/api`, `/api/audit`, `/api/tutor/signals`, `/api/settings/ai`, `/api/tutor/history` (com e sem `?discipline`) respondem conforme contrato · POST com lixo **nunca** 5xx · rota inexistente é 404/405 |
| 4 | **Jornada E2E** | (agent-browser, como uma pessoa real) abre a home → zero erros uncaught → navega as **6 abas** e verifica a aba ativa por `aria-current` (Cronograma via menu "Mais" do Modo Foco) → **Lab de Código roda o programa** → **paleta de comandos abre com Ctrl+K** → **alternar tema persiste no localStorage e sobrevive ao reload** → **check-in "Estudar 2h agora" grava no localStorage e sobrevive ao reload** (o teste devolve o estado original no fim) → rodapé presente → screenshot |
| 5 | **Visual & responsivo** | desktop 1440×900 e mobile 390×844 **sem overflow horizontal** · tema escuro AMOLED (fundo ~preto) · rodapé colado no fim · hambúrguer mobile · screenshots em `.chain/shots/` |
| 6 | **Produção (Vercel)** | o **link original** `hub-estudos-ifpb.vercel.app` no ar a cada rodada: home 200 com o título da casa + `server: Vercel`, `/api` 200, PWA (manifest + sw.js), páginas de apoio, estáticos e cache do acervo |

## Os leis da casa que a suíte defiende

1. **Fetch sempre relativo** — o gateway roteia por `XTransformPort`; URL absoluta com porta quebra o preview.
2. **SDK de IA só no backend** — nada de `z-ai-web-dev-sdk` fora de `src/app/api`.
3. **Rodapé sempre colado no fundo** (sticky footer com `min-h-screen flex flex-col`).
4. **AMOLED escuro + acento teal** — a identidade visual não pode derreter.
5. **O check-in sobrevive ao reload** — a memória da casa é sagrada.
6. **A casa nunca inventa dado** — sem registro = neutro/null (mediana sem 3 dias = 120min confessado, radar sem data = `sem-data`).

## Achados da 1ª rodada (histórico)

- 🐛 **BUG REAL corrigido**: no `ClabEngine` (Lab de Código), o snapshot do passo
  "for: passo (i++)" era tirado **depois** do incremento mas **antes** de trocar
  a fase da VM para `'cond'`. Um fork daquele passo re-aplicava o incremento e o
  replay do "E se...?" divergia da linha do tempo (soma 15 virava 11).
  Fix: `top.phase = 'cond'` movido **antes** do `snap()` em `interpreter.ts`.
  Agora o teste `forkFrom + runToEnd` prova bit-a-bit que o replay chega na
  mesma saída.

## Como adicionar um teste novo

- **Lógica pura?** → crie `test-suite/unit/<modulo>.test.ts` com `bun:test`
  (importe de `@/lib/...` — o bun resolve os paths do tsconfig).
- **Página/fluxo novo?** → acrescente um `timedCheck` em `stages/s4-e2e.ts`
  (jornada) ou `stages/s5-visual.ts` (layout).
- **Conteúdo novo no acervo?** → os invariantes de `unit/data-integrity.test.ts`
  pegam sozinhos (código de disciplina novo fora da lista conhecida falha —
  adicione-o à lista `EXTRAS_CONHECIDOS` se for intencional).
- **Lei nova da casa?** → acrescente um check em `stages/s1-static.ts`.

## O que a suíte ainda NÃO cobre (honestidade acima de tudo)

- **Render de componentes React** (sem React Testing Library/DOM) — a UI é
  coberta por E2E, não por testes de componente.
- **Fluxos de IA de ponta a ponta** (tutor respondendo, resumo de material) —
  dependem de chave/quota; os contratos HTTP e a validação estão cobertos.
- **Lighthouse/performance orçamentada** e **auditoria a11y automatizada** —
  os checks de a11y são estruturais (aria-current, aria-label, hambúrguer).
- **Pomodoro-engine** (React provider com timers) — coberto via E2E indireto.

## Estrutura

```
test-suite/
├── run-all.ts        # orquestrador da cadeia
├── README.md         # este arquivo
├── lib/
│   ├── chain.ts      # contexto, artefatos, relatório
│   └── proc.ts       # execução de comandos (spawn)
├── unit/             # 198 testes bun:test (16 arquivos)
├── stages/           # peças 0–6 da cadeia
└── .chain/           # artefatos da última rodada + screenshots
```
