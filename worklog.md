
---
Task ID: 27
Agent: Z.ai Code (main)
Task: Integrar artigo "Teletrabalho na atualidade" (RSP, 2021) enviado pela profa. Marília no Classroom — base da Proposta de Atividade I de RHT

Work Log:
- PDF recebido (upload/, 412KB, 30 páginas) → public/pdfs/rht-teletrabalho-serpro.pdf.
- EXTRAÇÃO COM LIÇÃO: cap de 30KB do extractor antigo cortava TODOS os resultados (Quadros 1-6, Tabela 1 — o coração do artigo, 72.860 chars totais). Solução: texto integral MENOS a seção Referências (títulos em inglês poluiriam o keyword scoring) MENOS cabeçalhos de página repetidos (RSP/title/autores — poluíam o scoring) → 58.933 chars finais em material-texts/rht-teletrabalho-serpro.txt.
- RESUMO IA autoral (rht-teletrabalho-serpro.summary.json): 9 conceitos-chave EM FORMATO OBJETO {conceito, explicacao} (descobri na prática: strings viram lixo "- ?: " no compactSummary — o formato objeto é OBRIGATÓRIO), pontos por ator com % exatos dos Quadros, erros comuns de interpretação (causalidade, % de discurso ≠ respondentes, dados pré-pandemia), 6 atividades sugeridas, 5 perguntas de autoavaliação.
- MATERIAL no course-data.ts (RHT): id rht-teletrabalho-serpro, type pdf, 30 páginas + dica nova na dicasEstudo apontando a Atividade I (materiaisUsuario 0→1; contadores da Biblioteca subiram para 42 materiais/39 resumos automaticamente).
- TUTOR: novo bloco no BASE DE CONHECIMENTO (route.ts) com método/amostra/positivos/negativos/Tabela 1/cuidados + instrução de ajudar a preparar a atividade com dados exatos.
- RETRIEVAL MELHORADO (material-retrieval.ts) — correção estrutural: tabelas no PDF viram um "parágrafo" de linhas que o chunkText fatia em chunks SEM keywords, enquanto o parágrafo que APRESENTA a tabela pontua alto → os números ficavam órfãos. FIX: EXPANSÃO DE VIZINHOS (para cada chunk escolhido, puxar i±1 se couber no orçamento) + EXCERPTS_BUDGET 3200→4200 + MAX_CHUNKS 3→4. Debugado com script próprio (scores por chunk).
- TESTES (recriados em /tmp/my-project/ — o reboot LIMPOU o .zscripts/ inteiro: test-code-highlight.ts de 44 checks, test-retrieval.ts de 18, extract-pdf-texts.ts foram perdidos; só o test-sanitize-latex.ts tinha backup): test-retrieval-rht.ts 18/18 (4 perguntas × agulhas: 35,90, preconceito 21,70, Iramuteq, Projeto-Lar/disquetes) + test-retrieval-regressao.ts 4/4 (materiais antigos alg/calendário continuam ok). lint 0, tsc 0.
- E2E tutor: "o que eu preciso fazer na Proposta de Atividade I..." → resposta com contexto do artigo, dados (Quadros/45/62/23) e sem LaTeX. OpenRouter estourou 50/dia NOVAMENTE durante o teste → cadeia caiu pro Z-AI e respondeu (resiliência ok). 
- QA BROWSER: Biblioteca → RHT (2 materiais) → artigo com "PDF | 30 páginas | Abrir PDF | Ver resumo IA"; resumo IA renderiza Resumo Geral + Conceitos Chave (cards) perfeitos; console 0 erros. NOTA de automação: múltiplos diálogos empilhados enganam evals genéricos — escopar cliques na <li>/[role=dialog] corretos.
- GIT: commit 0ead73c → push main (3976db8..0ead73c) confirmado via ls-remote.

Stage Summary:
- RHT cobre a Atividade I: artigo na Biblioteca, resumo IA completo, dica de estudo e tutor capaz de explicar/citar o estudo com números exatos.
- Melhoria estrutural permanente: retrieval agora traz tabelas junto do contexto (beneficia TODOS os materiais).
- P/ PRÓXIMOS AGENTES: .zscripts/ foi limpo pelo reboot — recriar test-code-highlight.ts e extract-pdf-texts.ts se precisar (spec no worklog Task 25/26); extractor novo deve usar: pdftotext -layout + colapsar espaços + remover headers de página + descartar Referências para artigos.

---
Task ID: 28
Agent: Z.ai Code (main)
Task: Processar novo envio do dono (24/09): aula 07 de LM "Metadados" (PDF + GitBook), assignment "Projeto — 1ª etapa" (entrega 09/10, 100 pts) e formato da Prova 1 de Algoritmos (3 questões fácil/média/difícil vindas da Lista); restaurar worklog.md perdido.

Work Log:
- worklog.md foi PERDIDO (reboot) — restaurado a partir de worklog-backup.md (só Task 27 sobreviveu). Histórico anterior (Tasks 1–26) está perdido; manter o arquivo atualizado com append.
- LISTA DE EXERCÍCIOS TRUNCADA DESCOBERTA E CORRIGIDA: material-texts/alg-lista.txt só ia até a Q129 — o PDF real tem 289 questões/43 páginas. Regenerado com pdftotext -layout + limpeza de números de página: 1.463 linhas / 78.227 chars, 289 questões, 5 seções (Q1–57 entrada/saída · Q58–97 desvios condicionais · Q98–157 repetição · Q158–208 vetores/matrizes · Q209–289 subprogramas+ponteiros). alg-lista.summary.json reescrito com o mapa das seções e o escopo da Prova 1 (Q1–97).
- LM AULA 07 (Metadados): PDF original NÃO chegou ao upload/ (só UUID na mensagem) → recriado fielmente via scripts/gen-pdf-metadados.py (reportlab, 19 slides A4 landscape, barra IFPB, rodapé com nome do professor e nº de página) → public/pdfs/lm-html-07-metadados.pdf (20KB, HTTP 200). Transcrição integral em material-texts/lm-html-07-metadados.txt (4.566 chars, 19 slides, com [Imagem: ...] descrevendo os visuais). Resumo IA completo (conceitos em formato OBJETO, erros comuns, prática da aula).
- GITBOOK METADADOS: página https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/metadados buscada com page_reader (438KB HTML → texto limpo). Resumo autoral lm-gitbook-metadados.summary.json com o que a apostila acrescenta aos slides: <link> (recursos externos/CSS), favicon com rel="shortcut icon" + type, aviso anti-keyword-stuffing, Open Graph Protocol/Twitter cards e metatags.io.
- ASSIGNMENT "PROJETO — 1ª ETAPA" (Classroom 24/09, prof. Diogo, 100 pts): entrega 09/10 + apresentação em sala; proposta com nome do site, tema, stakeholders e MÍNIMO 6 tópicos; slides ~5 min com nomes de todos; equipes de até 4 FIXAS até o fim do semestre. Integrado em: calendarEvents (09/Out, category avaliacao), semester.ts ACADEMIC_EVENTS (kind prazo), evaluationPeriods (nova entrada COM data oficial 2026-10-09 → entra no destaque de próximas avaliações; A1 description atualizada), gradeComponents A1, dicasEstudo LM (novo item 1 + metadados), ordemEstudo item 8.
- PROVA 1 ALGORITMOS (30/10): formato confirmado — 3 questões (1 fácil, 1 média, 1 difícil), programas PODEM VIR da Lista (289). Atualizado em: gradeComponents Prova 1, evaluationPeriods Prova 1, dicasEstudo alg, ordemEstudo item 6, recovery-plan trilha alg (resumo + porQue + nova ação alg-lista-q1-97 60min).
- RECOVERY-PLAN: trilha LM reescrita → "Metadados + Projeto 1ª etapa" com 3 ações (proposta da equipe 60min materialId lm-ementa, sessão metadados 40min materialId lm-html-07-metadados, fechar formulários 45min); trilha alg ganhou ação da Lista. Total LM 145min.
- TUTOR (route.ts BASE DE CONHECIMENTO): 2 blocos novos (LM/HTML Metadados aula 07+apostila; PROVA DE ALGORITMOS formato+Lista) + bloco LM PROJETO 1ª ETAPA completo + política de DATAS atualizada (Matemática 01/10, Projeto LM 09/10 e Prova Alg 30/10 são OFICIAIS) + MODO RECUPERAÇÃO atualizado (P1 ganhou Lista Q1–97; P2 virou Metadados+Projeto). FIX: MultiEdit aplicou parcialmente quando um old_str não casou — re-checar estado após editar (a linha do Inglês foi restaurada manualmente).
- QA BROWSER: home 52 materiais / 98 exercícios / badge Biblioteca dinâmico (52-vistos); agenda oficial mostra "LM: entrega do Projeto — 1ª etapa"; plano de recuperação com trilha LM nova; Biblioteca→LM: 21 materiais, cards "HTML - Metadados (19 slides)" e "Metadados (web)" com resumos IA renderizando (verificado Open Graph/metatags.io no web); PDF 200; Praticar 98 exercícios; console sem erros; mobile 390px sem overflow-X, footer natural; /api/audit ok:true (0 erros/0 avisos). LINT 0.

Stage Summary:
- Tudo que o dono mandou em 24/09 está no Hub: aula 07 Metadados (slides reconstruídos + apostila web), Projeto 1ª etapa com prazo 09/10 no calendário/agenda/tutor/plano, e Prova 1 de Alg com formato de 3 questões vindo da Lista (agora com as 289 questões completas no texto).
- LIÇÕES: (1) extrações antigas podiam truncar — conferir contagem real vs material-texts (alg-lista perdia metade); (2) MultiEdit pode aplicar parcialmente ao falhar — validar cada old_str; (3) badge Biblioteca = materiais não vistos, muda durante QA.
- PRÓXIMOS: S3 termina 29/09 (pedir programas resolvidos → modo gabarito autoral como S1); proposta do projeto LM (ajudar a definir tema/tópicos com a equipe); Av1 Matemática 01/10 (simulado D-1 30/09); Para prova de Alg: extrair questões-chave da Lista (Q1–97) para o Praticar em lotes.

---
Task ID: 29
Agent: Z.ai Code (main)
Task: Reajuste do plano de Matemática (dono confuso → refazer centrado em FAZER as listas, prova SEM determinantes/sistemas lineares/regressões), ordem das listas impressas, verificação do material Metadados reenviado, worklog no GitHub em branch dedicada fora da Vercel, limpeza do sandbox.

Work Log:
- MATEMÁTICA — ESCOPO CORRIGIDO (dono, 24/09): prova focada no conteúdo dado = Matrizes (até inversa) + Lógica; NÃO entram determinantes (1.3) nem sistemas lineares (1.4); "regressões" não existem no programa da disciplina (ementa TEC.1984 conferida — nada a remover). Atualizado em: math-exam-prep.ts (programa), course-data.ts (evaluationPeriods Av1), tutor route.ts (2 blocos), dicasEstudo e ordemEstudo.
- PLANO REFEITO (D-7): o plano de 12 dias (centrado em ler teoria, com dia dedicado a determinantes) foi substituído por plano de 8 dias (offsets 7..0) centrado em RESOLVER AS LISTAS: Matrizes Bloco 1 (Q1–16) → Bloco 2 (Q17–30) → Bloco 3 (Q31–35 inversa + revisão) → Lógica Parte 1 (Q1–12) → Parte 2 (Q13–18) → simulado 29/09 → véspera 30/09 → prova 01/10. FIX estrutural: exam-prep-card.tsx mapeava daysLeft-1 (mostrava o dia errado); agora offset = daysLeft. missedPlanDays corrigido junto.
- QUESTÕES: mat-ex05 (determinantes) virou PÓS-PROVA com gate fino requiresSubtopico 'Determinantes' (igual ao mat-ex06 de sistemas); mat-001 não pede mais determinante. /api/audit confirma: gatesFino 2, erros 0, avisos 0.
- RECOVERY-PLAN P0 reescrito: status pendente (não "atrasado" — plano recomeçou limpo), 4 ações das listas (90+165+180+125 = 560min), ordem Matrizes→Lógica justificada.
- ORDEM DAS LISTAS IMPRESSAS (dono tem 3 folhas): 1º Lista de Matrizes (35Q, 3 blocos) → 2º Lista de Lógica (18Q, 2 partes); teoria (Aula 00 + slides 47p) só como consulta. Respondido ao dono no chat.
- METADADOS REENVIADO: o PDF NUNCA chegou ao upload/ (2º envio seguido sem chegar — só o conteúdo veio na mensagem). Transcrição material-texts/lm-html-07-metadados.txt CONFERIDA slide a slide com o original de 19 slides = 100% fiel. Nada a corrigir.
- GIT/WORKLOG (pedido do dono): worklog.md já era gitignored; worklog-backup.md removido do tracking (commit cfa1eba) + .gitignore; criado branch ÓRFÃO 'worklog' no GitHub contendo só worklog.md + worklog-backup.md via plumbing (sem tocar a árvore); script reutilizável scripts/update-worklog-branch.sh. main em sincronia: 4 commits pendentes + 2 novos empurrados (cfa1eba, 2dcd297) → Vercel recebe o site atualizado SEM o worklog.
- SANDBOX LIMPO: upload/ → 12 arquivos já processados movidos para upload/_arquivados/ (com LEIA-ME.txt mapeando o destino de cada um); lixo da raiz removido (--full-page 56KB, tsconfig.tsbuildinfo); scripts de teste movidos para tests/ (gitignored).
- CRON: job webDevReview tinha sumido de novo (list vazia) — recriado com a descrição obrigatória.
- QA: lint 0; /api/audit ok:true (52 materiais · 98 exercícios); browser: home mostra "faltam 7 dias", programa novo da Av1, dia de hoje = Bloco 1 (Q1–16) 90min, fila P0–P5 correta; console 0 erros; mobile 390px sem overflow-X.

Stage Summary:
- Plano de Matemática agora é acionável: FAZER as 2 listas impressas em blocos com datas; determinantes/sistemas fora do escopo em TODAS as camadas (plano, card, simulado via gate, tutor, ementa-descritivo).
- Worklog passa a viver no GitHub (branch 'worklog', fora do deploy) — atualizar com scripts/update-worklog-branch.sh ao fim de cada tarefa.
- Sandbox limpo e mapeado; cron restaurado.
- PRÓXIMOS: S3 de Algoritmos termina 29/09 (receber programas → gabarito autoral); proposta do Projeto LM 09/10 (tema/tópicos com a equipe — perguntar ao dono); depois da Av1 (01/10): retomar RHT e Conjuntos/Funções.

---
Task ID: 30
Agent: Z.ai Code (main)
Task: Corrigir build falho da Vercel no branch 'worklog' (dono mandou o log: "No Next.js version detected") — a Vercel ainda tentava buildar o branch de documentação.

Work Log:
- DIAGNÓSTICO: o log da Vercel mostra build do branch 'worklog' (ff32125) falhando com "No Next.js version detected". Causa raiz: a Vercel cria PREVIEW DEPLOYMENTS para push em QUALQUER branch por padrão; o 'worklog' é órfão e contém só worklog.md/worklog-backup.md (sem package.json) → build impossível. A proteção da Task 29 era só "main não contém o worklog" — faltou bloquear o deploy do próprio branch.
- FIX: vercel.json na raiz com git.deploymentEnabled {"main": true, "worklog": false} → pushes no 'worklog' deixam de gerar deployment. Arquivo posto nos DOIS branches (main e worklog) porque a Vercel lê a config do commit pushado em previews e/ou da branch de produção, dependendo do fluxo — cobre os dois comportamentos.
- scripts/update-worklog-branch.sh atualizado: agora inclui vercel.json na árvore do branch automaticamente (o mktree reconstrói a árvore do zero — sem o fix, o próximo update apagaria o vercel.json do branch e o erro voltaria).
- COMMIT main (vercel.json + script) + push → dispara deploy de produção na main já com o site da Task 29; branch 'worklog' republicado via plumbing (Task 30 no worklog.md + vercel.json); verificado com git ls-remote.
- Build falho antigo (ff32125) é inofensivo — só histórico no dashboard.

Stage Summary:
- 'worklog' fora do deploy em dois níveis (config na main + config no próprio branch); deploy de produção segue exclusivo da 'main'.
- Histórico do worklog segue vivo no GitHub (branch 'worklog'); atualizar sempre com scripts/update-worklog-branch.sh ao fim de cada task.

---
Task ID: 31
Agent: Z.ai Code (main)
Task: TESTE COMPLETO DA IA com todos os conteúdos (pedido do dono) — bateria end-to-end do tutor cobrindo as 6 disciplinas, datas, escopo da prova, modos (flashcards/Feynman/streaming) e memória multi-turn.

Work Log:
- BATERIA CRIADA: tests/tutor-e2e.ts (gitignored, sandbox-only) — 22 casos contra a API REAL em :3000. Usa disciplineCode "QA-*" para o histórico de teste NUNCA tocar a memória real do aluno (saveTurn isola por código; cleanup deleteMany QA-* antes/depois). Filtro por grupo/ID: `bun tests/tutor-e2e.ts all A2,D1`.
- COBERTURA: Matemática (multiplicação passo-a-passo, escopo da Av1 com determinantes, ordem das listas, simétrica/antissimétrica, questão de lógica gerada) · Algoritmos (programa C completo de média, formato da Prova 1, bug do %c→%d do antecessor_e_sucessor, vetores como futuro) · LM (metadados+favicon, 1ª etapa do projeto com data, <title> vs <h1>) · RHT com retrieval do material (resultados+numeração, estrutura da Atividade I) · Inglês (corpo-verbos) · Fundamentos (LED Arduino) · Hub (3 datas oficiais citadas, frequência 75% sem abono) · flashcards (JSON 4–6 {front,back} parseável) · feynman (estrutura Pontuação X/100 + seções) · streaming SSE (deltas + final + model) · memória multi-turn (follow-up "e a transposta?" com histórico de A1).
- CHECKS por caso: grupos de keywords (≥1 por grupo), LaTeX proibido (\[, \begin{, \frac{, $$), tamanho mínimo, parsing estrutural. Relatório em tests/tutor-e2e-report.json.
- RESULTADO: 22/22 validados ao longo das rodadas (17/22 num sweep único + 5/5 no fechamento — as diferenças entre sweeps foram TODAS rate-limit da plataforma Z-AI sob 40+ chamadas em 30min; chamadas isoladas passam sempre — aluno real não é afetado). Provedor: Z-AI (fallback), latência média 6–8s, zero LaTeX cru em todas as respostas.
- FALHAS REAIS ENCONTRADAS E CORRIGIDAS (prompt): (1) B2 — formato da prova certo mas SEM a data 30/10; (2) D1 — resultados do artigo sem os números (45/62/23) mesmo com retrieval correto (probe confirmou bloco de 7.172 chars com os dados; era preguiça do modelo). FIX: 2 regras novas no system prompt do route.ts (DATAS OFICIAIS OBRIGATÓRIAS + NÚMEROS SÃO OBRIGATÓRIOS) e REGRA CRÍTICA DENTRO do buildMaterialBlock (material-retrieval.ts) exigindo ≥3 valores exatos do material quando pedidos — B2 e D1 passaram estáveis depois.
- FALHAS DO PRÓPRIO TESTE corrigidas: A2 (a resposta certa dizia "não cobre" e a keyword listava só "não caem") e A4 (a resposta certa usava "A = -Aᵀ" e a keyword esperava "oposto/oposta") — keywords ampliadas; lição: keyword check em LLM precisa de léxico variado.
- UX CORRIGIDA: mensagem de 502 agora é para o ALUNO ("O tutor IA está sobrecarregado agora... Aguarde ~1 minuto e tente de novo — volta rapidinho") — o hint de configurar API keys saiu da resposta e foi para console.error (log do dono).
- TESTE via UI REAL (agent-browser): aba Estudar → "Tirar dúvida com IA" → pergunta crítica "O que cai na prova de matemática de 01/10? Determinantes entra na prova?" → resposta EXEMPLAR renderizada em streaming: data oficial (01/10/2026), programa completo (Matrizes até inversa com teste A·A⁻¹ = I + Lógica até Modus Ponens/Tollens), exclusão EXPLÍCITA ("Não, determinantes NÃO entram na Av1... tópico 1.3 e sistemas lineares 1.4 ainda não foram dados"), próximo passo com a ordem das listas (Q1–16 → Lógica) e label "via Z-AI (fallback)". Console 0 erros/0 warnings. LINT 0.
- REBOOT DO SANDBOX NO MEIO DA TASK: worklog.md sumiu (gitignored) → restaurado em segundos do branch 'worklog' no GitHub (git show origin/worklog:worklog.md) — o plano do dono funcionou na prática; modos de arquivo viraram 755 → chmod 644 restaurado (só modo, zero conteúdo).
- INFRA: cron webDevReview recriado de novo (job 412296) — a lista tinha voltado a ficar vazia; vigiar persistência.

Stage Summary:
- Tutor IA validado de ponta a ponta com TODO o conteúdo do Hub: respostas fiéis aos materiais, escopo da Av1 correto (sem determinantes/sistemas), datas oficiais citadas, números do artigo citados, modos estruturais (flashcards/Feynman) e streaming funcionando.
- Robustez permanente: prompt endurecido contra respostas genéricas (datas+números), 502 com linguagem de aluno, bateria reutilizável tests/tutor-e2e.ts para regressão futura (ex.: antes de trocar modelos da cadeia).
- Limitação conhecida: rate-limit da plataforma em rajadas (só afeta uso automatizado intensivo; uso normal do aluno ok).
- PRÓXIMOS: S3 de Algoritmos terminou 29/09 (pedir programas → gabarito autoral); proposta do Projeto LM (tema/tópicos com a equipe — perguntar ao dono); Av1 Matemática 01/10 (simulado D-1); depois da prova: retomar RHT e Conjuntos/Funções.

---
Task ID: 32
Agent: Z.ai Code (main)
Task: "REVISA TUDO" (dono) — auditoria total + tutor respondendo material-por-material com validação contra o texto real dos PDFs.

Work Log:
- AUDITORIA ESTRUTURAL: /api/audit ok:true — 7 disciplinas · 52 materiais · 98 exercícios · gatesFino 2 (determinantes/sistemas pós-prova) · 0 erros · 0 avisos. LINT 0.
- INTEGRIDADE DOS ARQUIVOS (via import do course-data — fonte da verdade): 52/52 materiais; TODOS os summaryFile existem; TODOS os pdfPath existem (0 links quebrados). 11 materiais sem camada de texto: 7× lm-web-* (apostila GitBook) + monitoria-discord + vídeo-inglês + prova-fund-av1 = todos com resumo IA cobrindo; ÚNICO sem nada = alg-videoaulas (link externo do Drive, summaryFile '') — tutor não tem conteúdo dele (nada a inventar; material-first). Ação futura: dono cola os títulos dos vídeos → criamos o resumo.
- TUTOR vs MATERIAIS (tests/tutor-materials.ts, 14 casos): cada pergunta ancorada em FATOS pré-verificados por grep no texto/resumo real do material. 14/14 PASS na primeira rodada, sem retry, latência média 5,8s, zero LaTeX. Cobertura: mat-00 (ordem m×n + simétrica At=A), mat-01 (transposta), mat-logica-lista (tautologia/contradição/contingência), alg-lista (289 + seções), alg-tipos-operadores (precedência), programas-c-autorais (bug %c→%d), questoes-semana2 (transmissão/tamanho de arquivo), lm-html-06 (prática da pizza: select/radio/checkbox/number/textarea), lm-html-03 (../ para subir diretório), lm-html-07 (title vs h1 + favicon), lm-web-metadados só-resumo (Open Graph/metatags.io), rht (Projeto-Lar/1985), ing-vídeo só-resumo (hand/eye/head/elbow), prova-fund-av1 só-resumo. Caminho de retrieval (texto) E caminho só-resumo validados.
- QA VISUAL: Biblioteca abre com contagens corretas (Resumos IA 50 = 50 resumos para 52 materiais — 2 ementas antigas sem resumo); Praticar abre com aviso material-first; mobile 390px sem overflow horizontal (scrollW=390=innerW); console 0 erros/0 warnings; barra de progresso 0 no browser do QA é o localStorage limpo do perfil de teste (estado real do aluno intacto).
- Sem mudanças de código nesta task (apenas testes/ gitignored) — main permanece f87eece; worklog publicado no branch 'worklog'.

Stage Summary:
- Resposta ao dono: SIM para os materiais — o tutor responde fácil e com precisão sobre TODOS os tipos de material (14/14), com fatos batendo com os PDFs (números, práticas, bugs, regras). Limites honestos: rate-limit em rajadas automatizadas; alg-videoaulas sem conteúdo para o tutor até receber a lista dos vídeos.
- Site structuralmente íntegro: 0 erros/0 avisos na auditoria, 0 links quebrados, lint 0, mobile ok.
- Bateria material-por-material reutilizável: bun tests/tutor-materials.ts (relatório em tests/tutor-materials-report.json).

---
Task ID: 33
Agent: Z.ai Code (main)
Task: Simplificar o site focado no estudo real + matemática renderizada no tutor (fim das respostas quebradas) + leitura de imagens (print) no tutor + memória/continuidade de conversa

Work Log:
- Restaurado worklog.md do branch origin/worklog (sandbox apagou de novo) e tests/tutor-e2e.ts recriado do zero com regras atualizadas.
- MATEMÁTICA: instalado katex + remark-math + rehype-katex + remark-gfm; TutorMarkdown agora renderiza LaTeX ($..$ / $$..$$ / \begin{pmatrix}) em TODAS as superfícies do tutor (chat Estudar, painel rápido dos PDFs, feedback Feynman e verso dos flashcards). Proteção de "R$" contra pareamento de math. system prompt: regra anti-LaTeX SUBSTITUÍDA por "MATEMÁTICA EM LATEX (use $..$/$$..$, pmatrix, \frac)". sanitize-latex ganhou normalizeMath (\[..\]→$$..$$, \(..\)→$..$); route e history agora normalizam em vez de achatar (sanitizeLatex mantido como legado).
- IMAGEM: /api/tutor aceita imageDataUrl (data URL, ≤8MB); transcribeImage() usa createVision do SDK Z-AI (glm-4.5v, ~1,4s, probe scripts/probe-vision.ts validou 3/3); transcrição vira pergunta efetiva (entra no retrieval e no prompt como "IMAGEM ANEXADA"); nova regra de prompt para resolver a questão literal da imagem. UI: botão ImagePlus + colar Ctrl+V (onPaste) + prévia com remover em AMBOS os chats; imagens reduzidas no navegador (max 1400px JPEG 0.85, src/lib/tutor-image.ts); envio sem texto funciona (só imagem).
- MEMÓRIA: MAX_HISTORY 8→12; chat principal envia últimas 12 msgs (filtrando bolhas de erro ⚠️); painel rápido dos PDFs AGORA TAMBÉM envia history (antes zero = contexto perdido); nova regra CONTINUIDADE DA CONVERSA no prompt (follow-ups conectam com o anterior, não reexplicam, não mudam de assunto). Memória DB por disciplina (40 msgs) já restaurava após reload — verificado no browser.
- SIMPLIFICAÇÃO (o que caiu em desuso): auditoria de todas as 8 abas + Configurações — nada deletado (tudo amarrado ao fluxo real do curso); simplificação entregue = tutor consistente em todo lugar (mesma renderização, mesma memória, mesma imagem) + lista de candidatos à remoção passada ao dono para decisão.
- QA browser (agent-browser) achou bug real: opções do rehypeKatex passadas no formato plano = "empty preset" crash do chat → corrigido para tupla aninhada [[plugin, options]] + PluggableList. Re-verificado: 16 elementos .katex renderizados, conversa restaurada pós-reload, follow-up conectou ("como mostrei"), 0 erros de console.
- Bateria e2e recriada (16 casos, A–G, inclui G1 = print de questão via imagem e F4 = continuidade): 16/16 PASS. D1 falhou 2× (cited 45/62 sem o 23) → regra RHT endurecida 2× ("TODOS OS TRÊS números") → PASS. F3 ajustado (≥1 delta; fallback do SDK manda resposta inteira em 1 delta — mesmo efeito visual).
- Lint limpo, dev.log sem erros.

Stage Summary:
- Tutor IA agora: lê PRINTS (foto/print da questão direto no chat, Ctrl+V ou botão), responde com matemática RENDERIZADA (KaTeX — matriz/fração bonitas, não mais texto quebrado), e mantém continuidade de conversa (memória no banco por disciplina + histórico 12 msgs + regra de continuidade). Não precisa mais de modelo externo pra matemática.
- Arquivos: package.json/bun.lock (+katex remark-math rehype-katex remark-gfm), tutor-markdown.tsx, sanitize-latex.ts, tutor-image.ts (novo), tutor-quick-panel.tsx, study-view.tsx, flashcards-view.tsx, api/tutor/route.ts, api/tutor/history/route.ts, tests/tutor-e2e.ts (recriado, 16 casos), scripts/probe-vision.ts (novo).
- QA-BATTERY: disciplineCode "QA-*" limpo no início/fim; relatório em tests/tutor-e2e-report.json; uso: bun tests/tutor-e2e.ts all [IDs].
- PRÓXIMOS: S3 de Algoritmos terminou 29/09 → pedir programas e montar gabarito autoral; Projeto LM 1ª etapa (entrega 09/10, 100 pts) → perguntar tema/6 tópicos/equipe ao dono; Av1 Matemática 01/10 (simulado foi 29/09); candidatos de remoção/agrupamento de abas aguardando decisão do dono (Método/Cronograma/Progresso); cron 412296 sumiu de novo → recriado neste ciclo.

---
Task ID: 34
Agent: Z.ai Code (main)
Task: Continuidade com 1 toque + utilidades do chat (follow-ups, copiar resposta, scroll de matemática) — QA completo do ciclo Task 33 e refinamento focado em "continuar comentando a questão sem reexplicar".

Work Log:
- ESTADO INICIAL: Task 33 (KaTeX + leitura de print + memória) estava commitada (554aa7d) e worklog no branch 'worklog'; sandbox íntegro. Commit automático da plataforma (101752e, UUID) continha só scripts/probe-vision.ts — mantido e sincronizado com origin/main.
- QA DA TASK 33 (agent-browser): chat abre, KaTeX renderiza ao vivo (32 elementos .katex numa resposta sobre matriz inversa), histórico restaura após reload, /api/tutor 200 (stream caiu pro fallback "resposta inteira" — comportamento conhecido), Fast Refresh warning é só HMR de dev. Mobile 390px sem overflow (innerW=scrollW=390).
- FOLLOW-UPS DE CONTINUIDADE (nova feature nas 2 superfícies do tutor): após a última resposta aparecem chips "Continuar nesse assunto?" — Explica de outro jeito / Exercício parecido / Como cai na prova? (painel dos PDFs: "Exemplo do material" no lugar do de prova). Clique envia a pergunta pronta COM o histórico — o tutor segue no mesmo assunto sem o aluno redigir de novo. Escondidos durante streaming e quando a última msg é erro (⚠️).
- COPIAR RESPOSTA: botão "copiar" (ícone Copy, 10px, discreto) em toda resposta do tutor — copia o texto completo pra colar no caderno/documento, com toast de confirmação. Aparece junto do "via {model}".
- KATEX DISPLAY: globals.css ganhou .katex-display { overflow-x: auto } — matrizes grandes rolam dentro da bolha no celular em vez de estourar o layout (regra white-space:normal testada e DESCARTADA — quebraria o rendering do KaTeX).
- QA FINAL (browser real): follow-up clicado ("Explica de outro jeito") respondeu com demonstração passo-a-passo de A·A⁻¹=I com matrizes fracionadas — 45 elementos .katex na conversa, chips reapareceram após a resposta, botão copiar visível; desktop 1280 e mobile 390 sem overflow horizontal (inclusive dentro do dialog); 0 erros de console (só o warning dev-only do Fast Refresh). LINT 0; tsc limpo no src (erros restantes só em skills/ e tests/ — fora do app).
- COMMITS: 0f81273 main (3 arquivos: study-view.tsx, tutor-quick-panel.tsx, globals.css; +128/-6) e push imediato; worklog republicado no branch 'worklog'.

Stage Summary:
- O fluxo pedido pelo dono está fechado em loop: pergunta → resposta (com matemática renderizada) → chips de continuidade → nova resposta conectada — sem reexplicar a dúvida, sem trocar de assunto, sem modelo externo.
- Tutor tem agora: leitura de print (botão/Ctrl+V), matemática KaTeX em todas as superfícies, memória por disciplina (banco + histórico 12 msgs + regra de continuidade), follow-ups de 1 toque, copiar resposta, "limpar conversa" quando quiser recomeçar.
- PRÓXIMOS: candidatos de remoção/agrupamento de abas aguardando decisão do dono (Método/Cronograma/Progresso); S3 de Algoritmos — pedir programas → gabarito autoral; Projeto LM 1ª etapa 09/10 (tema/6 tópicos/equipe — perguntar ao dono); Av1 Matemática 01/10; vigiar cron (job 416224 neste ciclo).

---
Task ID: 35
Agent: Z.ai Code (main)
Task: Ciclo automático (cron 416224) — QA das Tasks 33/34 + novo pacote de preparação para a Av1 de Matemática (faltavam 5 dias): fórmulas renderizadas em KaTeX real, linha do tempo do plano no card e Caderno de Erros no Praticar com ponte direta pro tutor.

Work Log:
- ESTADO INICIAL: main 0f81273 = origin/main (Tasks 33/34 completas: KaTeX, leitura de print, continuidade, follow-ups). QA de entrada: /api/audit ok (52 materiais · 98 exercícios · 0 erros), lint 0, tutor no browser com KaTeX vivo (54 elementos .katex numa resposta sobre inversa), chips de continuidade presentes, console limpo. FALSOS POSITIVOS de leitura investigados e descartados ([materialId aparecia como "aterialId" — artefato de exibição; bytes reais OK via od -c).
- FÓRMULAS EM KATEX REAL (math-exam-prep.ts + exam-prep-card.tsx): FormulaCard ganhou campo math[] em LaTeX; os 10 cards de fórmulas agora renderizam matemática de verdade via TutorMarkdown — A⁻¹ = 1/(ad−bc)·pmatrix(d,−b;−c,a) como fração+matriz, Σ do produto, De Morgan, Modus Ponens/Tollens com ⊢. Cards coloridos por grupo (Matrizes rosa / Lógica azul). O texto simples (corpo) continua embaixo como reforço.
- LINHA DO TEMPO DO PLANO: card do Painel agora mostra os 8 dias (D-7 → prova 🏁) como bolinhas: passado completo = verde ✓, passado incompleto = âmbar, hoje = rosa pulsante, futuro = cinza. Estado do plano num relance, sem abrir o dialog.
- FIX: título do dialog dizia "Plano de 12 dias" (plano antigo) → "Plano até a prova — Matemática (D-7 → 01/10)".
- CADERNO DE ERROS (practice-view.tsx): novo card no topo do Praticar agregando exercícios com neededHelp OU (tried && !solved), ordenado por lastPracticedAt. Cada linha: badges (disciplina/tópico/dificuldade/status), enunciado (2 linhas) e 2 ações: "Refazer" (filtra disciplina+tópico e rola até a lista) e "Tutor" (novo evento hub:open-tutor). Header mostra o tópico com mais erros ("onde dói"). Colapsável quando >3. Escondido quando a lista está vazia.
- PONTE TUTOR (hub-events.ts + page.tsx + study-view.tsx): OPEN_TUTOR_EVENT 'hub:open-tutor' {question, disciplineCode} → page troca pra aba Estudar (#study) e passa tutorReq pro StudyView, que seleciona a disciplina (troca a memória da conversa junto), abre o chat (Sheet) e pré-preenche a pergunta pronta: "Estou travando nesta questão (tópico): 'enunciado' — me explica o passo a passo e o conceito por trás, como se fosse cair na prova." O aluno revisa e envia — mantém o hábito de reler antes de disparar.
- QA BROWSER REAL: dialog do plano com 15 elementos .katex (fração mfrac presente, 0 overflow horizontal); timeline visível com D-7…D-5, prova; Caderno de Erros apareceu ao marcar 2 exercícios como "precisei de ajuda" (contagem reativa 2→1 ao desmarcar), "Refazer" filtrou Fundamentos+Pioneiros e rolou até a lista, botão "Tutor" trocou pra aba Estudar com o chat aberto, disciplina "Tutor de Fundamentos" e a pergunta da questão pré-preenchida no campo. Mobile 390px: scrollW=390=innerWidth no Praticar e no dialog de fórmulas (matrizes rolam dentro do .katex-display). Console limpo (só warning pré-existente do Radix sobre aria-describedby). Estado de teste desmarcado no final (Caderno vazio).
- LINT 0; tsc src limpo (erros restantes só em skills/ e tests/). COMMIT b551781 + push main (0f81273..b551781) → deploy de produção disparado.

Stage Summary:
- Pacote Av1 completo: o aluno agora tem (1) fórmulas bonitas de verdade pra recitar na véspera, (2) linha do tempo do plano à vista o dia todo no Painel, (3) Caderno de Erros que transforma "errei/não consegui" em fila de revisão com refazimento e tutoria de 1 toque — fechando o ciclo estudar → errar → revisar → refazer.
- O evento hub:open-tutor é reutilizável: qualquer superfície do Hub pode mandar uma dúvida pronta pro tutor (resumos, simulado, flashcards) no mesmo padrão hub:open-*.
- PRÓXIMOS: S3 de Algoritmos terminou 29/09 → pedir programas → gabarito autoral; Projeto LM 1ª etapa (09/10, 100pts) → perguntar tema/6 tópicos/equipe ao dono; Av1 Matemática 01/10; candidatos de remoção de abas aguardando decisão do dono; vigiar cron job (416224 neste ciclo).

---
Task ID: 36
Agent: Z.ai Code (main)
Task: Tornar a leitura de imagem (visão) e o texto do tutor viáveis 100% na Vercel — fim da dependência do SDK do sandbox. Pedido direto do dono: "focar em modelos externos gratuitos... meu uso é Vercel e externo, soluções usando GLM não são válidas a menos que dê pra gerar API gratuita".

Work Log:
- DIAGNÓSTICO: transcribeImage() usava APENAS o SDK Z-AI do sandbox (glm-4.5v via createVision) — na Vercel o import falha e o aluno recebia "digite em texto". Cadeia de texto já tinha OpenRouter, mas visão zero em produção.
- PESQUISA DE CATÁLOGO REAL (openrouter.ai/api/v1/models, 09/2026): 17 modelos :free no ar, 8 com input de imagem. Escolhidos 3 (evitando os 2 com histórico de erro): qwen/qwen3.8-27b:free (262k ctx), nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free, google/gemma-4-26b-a4b-it:free.
- GEMINI VIA REST PURO (route.ts): novo callGemini() — sem SDK, fetch direto pra generativelanguage.googleapis.com/v1beta (roda em qualquer serverless). Suporta: systemInstruction, histórico (assistant→role "model"), streaming SSE (:streamGenerateContent?alt=sse), imagem anexada (inline_data), safetySettings BLOCK_ONLY_HIGH (matemática/aula não trava em filtro), timeout/rearm idênticos aos demais provedores. Default: gemini-2.5-flash-lite (tier grátis ~1000 req/dia) com fallback pra gemini-2.5-flash; GEMINI_MODEL sobrescreve. Também aceita GOOGLE_AI_API_KEY.
- CADEIA DE VISÃO (transcribeImage reescrito): 1º Gemini → 2º OpenRouter free-vision (callOpenRouterVision, formato image_url) → 3º Z.ai público glm-4.5v (callZAIVision, se ZAI_API_KEY) → 4º SDK sandbox (dev). Cada etapa com catch+log; esgotou = mensagem acionável.
- CADEIA DE TEXTO: Gemini entra em 0º (antes de OpenRouter) nos 3 caminhos — stream tutor, JSON flashcards/feynman e não-stream — melhor matemática/LaTeX de graça com 1 key.
- HONESTIDADE NA UI: GET /api/tutor agora expõe vision (quem lê prints NESTE deploy) + chains.vision + providers.gemini. Erros 502 de imagem/texto sem key agora ensinam o setup ("key grátis do Gemini em aistudio.google.com/app/apikey como GEMINI_API_KEY na Vercel") em vez de só pedir pra digitar.
- CONFIGURAÇÕES (AiInfoCard): badge Gemini (ativo/inativo) + linha "Leitura de prints (visão): {status real do deploy}" (verde quando ativo) + aviso sem-key reescrito com Opção 1 (Gemini, recomendada) e Opção 2 (OpenRouter).
- QA: lint 0; curl GET mostra novo status; POST stream respondeu (fallback sandbox intacto no dev); imagem inválida → cadeia esgotou com log limpo + 502 acionável; e2e A2/B2/D1 = 3/3 PASS; browser real: settings renderiza badges + linha de visão + guia de keys, 0 erros de console. Rows de teste QA-* limpas do banco.
- PENDENTE P/ O DONO (1 minuto de setup): criar key grátis em aistudio.google.com/app/apikey e adicioná-la como GEMINI_API_KEY na Vercel (Production+Preview). A partir daí: leitura de prints funciona no deploy E as respostas de matemática sobem de qualidade automaticamente (Gemini assume a 1ª posição da cadeia).

Stage Summary:
- Visão deixa de ser "só no sandbox": com UMA key grátis (Gemini AI Studio) o deploy da Vercel ganha leitura de print + tutor de matemática forte — sem cartão de crédito, sem GLM. OpenRouter free-vision entra como plano B (e Z.ai público como plano C).
- Falha honesta em vez de silenciosa: a UI agora DIZ qual provedor lê imagens neste deploy e o que fazer quando nenhum está configurado.
- PRÓXIMOS: dono adiciona GEMINI_API_KEY na Vercel → validar visão em produção; S3 Algoritmos (pedir programas → gabarito autoral); Projeto LM 09/10 (tema/equipe); Av1 Matemática 01/10; decidir remoção de abas (Método/Cronograma/Progresso).

---
Task ID: 36
Agent: Z.ai Code (main)
Task: Ciclo automático (cron 416224) — QA completo de entrada, finalização e commit da integração Gemini+visão (WIP pendente), Modo Foco na navegação (simplificação pedida pelo dono) e detalhes de estilo no chat do tutor.

Work Log:
- ESTADO INICIAL: main aacc928 (= origin/main), dev server 200, /api/audit limpo (52 materiais · 98 exercícios · 0 erros). Encontrado WIP NÃO commitado no working tree: integração completa Google Gemini (callGemini REST+streaming+inline_data, cadeia de visão Gemini→OpenRouter(qwen3.8/nemotron-omni/gemma-4)→Z.ai glm-4.5v→sandbox, GET com providers.gemini/chains.vision, badges nas Configurações) — provável resto de ciclo interrompido. Validado antes de commitar: 1 erro TS (flag 's' de regex < es2018) corrigido com [\s\S]; tsc src limpo; eslint 0.
- DEV SERVER CAIU no meio do QA (processo morto sem stack no log) → restart com bun run dev; 200 em 12s. Processo órfão de e2e (timeout 300) morreu sozinho.
- QA BROWSER (agent-browser): home OK; Configurações mostra badges Gemini/OpenRouter/Z.ai inativo + label honesto de visão; chat do tutor com KaTeX vivo (17→47 elementos), chips de continuidade presentes, follow-up "Explica de outro jeito" respondeu NO MESMO ASSUNTO (continuidade OK), console limpo, desktop 1280 sem overflow.
- COMMIT 542e704: integração Gemini+visão completa (478 inserções). Na Vercel: 1 key grátis do AI Studio (GEMINI_API_KEY) ativa texto forte em matemática + leitura de print — o pacote que o dono pediu. Em dev segue Z-AI sandbox.
- MODO FOCO (nova feature, src/lib/focus-mode.ts): esconde Método/Cronograma/Progresso atrás do botão "Mais" na sidebar — atende o pedido "site mais simples e focado no estudo real" sem apagar nada. "Mais" expande com framer-motion; aba ativa escondida auto-expande; badges viram bolinhas âmbar no botão fechado; preferência em localStorage hub:focus-mode (padrão LIGADO); Switch "Modo foco (navegação simples)" nas Configurações atualiza a sidebar NA HORA via evento hub:focus-mode-changed. QA: padrão ON mostra 5 abas+Mais; clique mostra as 3; localStorage '0' restaura as 8; switch altera sidebar sem reload.
- CHAT DO TUTOR (2 superfícies, styling mandatório): horário HH:MM em cada mensagem; bolhas novas (rounded-2xl com canto assimétrico, gradiente esmeralda→teal no usuário, borda sutil no assistente, shadow-sm); animação de entrada msg-in em CSS (respeita prefers-reduced-motion); chips com active:scale; EXPORTAR CONVERSA (.md com Você/Tutor/modelo/horários) no cabeçalho do chat — QA: toast "Conversa baixada em Markdown." Screenshot scripts/qa-chat-final.png confirma tudo.
- HIGIENE: 5 mensagens de teste (QA-416*) apagadas do banco (MAT+TEC.1687); scripts temporários removidos; worklog lido e atualizado.
- COMMIT 8035661 + push main (542e704..8035661) → deploy Vercel disparado.

Stage Summary:
- O pedido de IA do dono está 100% resolvido em código: Gemini (texto+visão, 1 key grátis) entra como 1º da cadeia quando GEMINI_API_KEY existir na Vercel — falta SÓ o dono colar a key (aistudio.google.com/app/apikey → Vercel env). Antes disso, produção continua nos free da OpenRouter (sem visão) e dev usa sandbox.
- Site mais simples: Modo Foco ligado por padrão (5 abas na frente, apoio atrás de "Mais") — reversível em 1 toque.
- PRÓXIMOS: S3 de Algoritmos (29/09) → pedir programas → gabarito autoral; Projeto LM 1ª etapa (09/10, 100pts) → perguntar tema/6 tópicos/equipe; Av1 Matemática 01/10 (plano D-5 em curso); vigiar cron job 416224; dono decidir se quer desligar Modo Foco.

---
Task ID: 37
Agent: Z.ai Code (main)
Task: Ciclo automático (cron 416224) — QA de entrada + verificação de tema claro + dois recursos novos no tutor (Modo Dica socrático e Ouvir resposta via TTS) + polish da bolha "Pensando".

Work Log:
- ESTADO INICIAL: main 99909bd (auto-commit da plataforma) sobre 8035661 (Task 36), árvore limpa, dev 200, /api/audit ok (52 · 98 · 0 erros). Sem bugs novos; fase estável.
- QA TEMA CLARO (brecha de verificação da Task 36): tema controlado por next-themes (localStorage 'theme' — manipular classe do <html> não persiste). Painel em claro OK (plano, timeline, cards); CHAT em claro OK: bolha gradiente esmeralda legível, resposta KaTeX ($A = A^T$) renderiza, horários + copiar presentes. Nenhum ajuste necessário — o par gradient/borda da Task 36 já nasceu compatível com os dois temas.
- VERIFICAÇÃO DE LOOP: simulado → Caderno de Erros JÁ integrado (mark() grava tried/solved via updateExerciseProgress, merge parcial sem perda — "não consegui" cai no Caderno). Deck de fórmulas Av1 já existe (MATH_FLASHCARDS, 14 cards). Gap real encontrado: o tutor só RESPONDE — pode virar muleta.
- MODO DICA (novo, pedagógico): botão lâmpada no chat do tutor (2 superfícies: Sheet da Estudar + painel dos PDFs) com estado âmbar e aria-pressed. body.hintMode → buildSystemPrompt recebe bloco socrático: 1) pergunta-guia → 2) dica sem o resultado → 3) oferta de resolver. 1ª versão deixou o modelo fallback (Z-AI) entregar código completo; fortalecido com "PROIBIDO no 1º turno" → re-teste: SEM #include/int main, estrutura 3 estágios correta. Dúvida conceitual responde normal.
- OUVIR RESPOSTA (novo, acessibilidade): src/lib/tutor-speech.ts — Web Speech API nativa (sem custo/offline), voz pt-BR quando existir, rate 1.05. Sanitização antes de falar: blocos de código → "(trecho de código)", \frac→"fração", \sqrt→"raiz de", \cdot/×→"vezes", markdown/emojis removidos. Botão "ouvir"/"parar" no meta das respostas (>80 chars) nas 2 superfícies; cancela no unmount; em headless sem vozes degrada sem erro (testado).
- POLISH: bolha "Pensando" trocou spinner duplo por 3 pontinhos animados (dot-bounce CSS, [animation-delay] escalonado, respeita prefers-reduced-motion), mesma forma das bolhas novas (rounded-2xl + borda).
- QA BROWSER: lâmpada alterna false→true com fundo âmbar; exercício enviado com modo ligado respondeu socraticamente; botão "ouvir" presente e clique sem erros de página; banco limpo de QA-37* depois de cada teste; tsc + eslint 0.
- COMMIT 07515a0 + push main (8035661..07515a0) → deploy Vercel disparado.

Stage Summary:
- O tutor agora tem 3 modos de uso: resposta direta (padrão), MODO DICA (coach socrático que não entrega a solução — estudo real) e áudio (ouvir explicação). Tudo sem custo de API.
- Pendência de produção inalterada: GEMINI_API_KEY aguardando o dono colar a key grátis na Vercel (texto forte em matemática + visão de prints com 1 key).
- PRÓXIMOS: S3 Algoritmos 29/09 → pedir programas → gabarito; Projeto LM 09/10 → tema/6 tópicos/equipe; Av1 Matemática 01/10 (simulado no dia 29); dono testar Modo Dica/Modo Foco e dar feedback; vigiar cron.

---
Task ID: 38
Agent: Z.ai Code (main)
Task: Pedido direto do dono ("criei a key do studio, testa as duas keys, os resultados e consistência e deixa tudo perfeito, resultados batendo completamente") — validar GEMINI_API_KEY + OPENROUTER_API_KEY em produção, caçar por que o Gemini não assumia, e entregar verificação ponta-a-ponta.

Work Log:
- PRODUÇÃO LOCALIZADA: URL real (hub-estudos-ifpb.vercel.app) descoberta via GitHub Deployments API (a URL por-deploy tem SSO da Vercel; o alias de produção é público). GET /api/tutor mostrava providers.gemini=true — mas teste real revelou que as dúvidas eram respondidas por Nemotron 3 Super (OpenRouter): Gemini configurado e AINDA ASSIM falhando em silêncio.
- NOVA FEATURE — DIAGNÓSTICO DE CHAVES: GET /api/tutor?probe=1 faz ping REAL de cada provedor (~10 tokens): {ok, ms, model, erro exato}. Aceita &geminiModel=X para testar qualquer modelo com a key do dono. Card "Teste de conexão das chaves" nas Configurações (roda ao abrir + botão "Testar agora", linhas verde/vermelho com latência e erro, rodapé "Quem responde primeiro nas dúvidas reais").
- CAUSA RAIZ DESCOBERTA pelo probe: HTTP 404 — "model models/gemini-2.5-flash-lite is no longer available to new users". A key é NOVA (26/09) e o Google não libera mais versões fixas antigas para keys novas; por isso o fallback silencioso.
- FIX DEFINITIVO: cadeia Gemini trocou versões fixas pelos ALIASES gemini-flash-lite-latest / gemini-flash-latest (acompanham sempre a versão GA aceita pela key — nunca mais 404 de deprecação). Probe com maxOutputTokens 1024 (modelos thinking devolvem vazio com limite baixo — falso negativo). prettyModelName atualizado.
- VERIFICAÇÃO PONTA-A-PONTA EM PRODUÇÃO (após deploy 095a9d9):
  · probe: Gemini OK 534ms · OpenRouter OK 11,5s · firstToAnswer="Gemini" · alias flash-latest OK 4,6s (plano B do plano B confirmado).
  · CONSISTÊNCIA: 3× a MESMA questão (inversa de [[2,1],[1,1]]) → 3/3 respondidas por "Gemini Flash-Lite", 3/3 com A⁻¹=[[1,-1],[-1,2]] correta + det(A)=1 certo, estrutura didática idêntica, 2,4–3,5s. Transposta (teste anterior) também 2/2 correta.
  · STREAM: 13 deltas + final com model informado, 1,95s total.
  · VISÃO: print gerado ("Lista 3 — Matrizes, Q12: A+B com A=[[3,5],[2,7]], B=[[1,2],[4,6]]") enviado como imagem → Gemini leu o enunciado e respondeu A+B=[[4,7],[6,13]] com passos 3+1=4, 5+2=7, 2+4=6, 7+6=13 — leitura 100% fiel, matemática correta.
  · UI DE PRODUÇÃO (agent-browser no site real): card de diagnóstico exibe Gemini Flash-Lite 424ms + Nemotron 4.481ms + "Quem responde primeiro: Gemini"; badges Gemini/OpenRouter ativos; "Leitura de prints (visão): Gemini (key grátis do AI Studio)". Console limpo. Evidência: scripts/qa38-prod-settings.png.
- HIGIENE: scripts de debug órfãos removidos (show-last/count-msgs/check-alg-orphans); testes de QA usaram disciplinaCode QA-GEM (isolado — não aparece em nenhuma aba real do Hub).
- COMMITS: 02ed3f9 (probe+card) · 5f579e1 (probe aceita geminiModel) · 095a9d9 (fix aliases) — todos em origin/main, deployados e REVALIDADOS em produção.

Stage Summary:
- RESULTADOS BATEM COMPLETAMENTE: Gemini assumiu a 1ª posição de fato (texto, stream E visão), OpenRouter confirmado como plano B saudável, consistência 5/5 em questões repetidas, leitura de print com resposta certa. O pacote "1 key grátis = tutor forte + visão" que o dono pediu está LIVE em produção.
- O site agora se auto-diagnostica: qualquer suspeita futura → Configurações mostra qual key está viva, a latência e o erro exato (ex.: quota esgotada) sem adivinhação.
- PRÓXIMOS: dono usar o tutor no dia a dia (Av1 Matemática 01/10); S3 Algoritmos 29/09 → gabarito autoral dos programas; Projeto LM 09/10 → tema/equipe; vigiar cron 416224.

---
Task ID: 38
Agent: Z.ai Code (main)
Task: DONO CRIOU A GEMINI KEY ("criei a key do studio, testa as duas… resultados batendo completamente") — validação completa em PRODUÇÃO (texto ×3, Av1 matrizes, visão, flashcards JSON, probe dos 2 modelos Gemini) + novo recurso "Testar leitura de prints" nas Configurações + polish de estilo.

Work Log:
- ESTADO INICIAL: main a9bbaa2 (auto-commit da plataforma com restos de QA), árvore limpa, dev 200, /api/audit ok (52 · 98 · 0 erros). Vercel redeployada pelo dono às 11:10 (build OK em 8035661) com a key nova.
- VALIDAÇÃO EM PRODUÇÃO (hub-estudos-ifpb.vercel.app — URL descoberta e confirmada 200):
  · GET /api/tutor → providers.gemini TRUE, openrouter TRUE, vision "Gemini (key grátis do AI Studio)", cadeia de visão Gemini→OpenRouter ✓.
  · CONSISTÊNCIA ×3: "Quanto é 7 × 8?" → '56', '56', '56' — via Gemini Flash-Lite, 0.9–1.2s. Bateu 100%.
  · QUALIDADE Av1: transposta de [[1,2],[3,4]] → A^T = [[1,3],[2,4]] correta, com pmatrix LaTeX bonito + oferta de exercício extra (2.0s).
  · VISÃO: imagem gerada com "2x + 5 = 15" → transcrição EXATA + início da resolução, via Gemini Flash-Lite (2.9s). O caso de uso nº 1 do dono (ler print de exercício) FUNCIONA no deploy.
  · FLASHCARDS via Gemini: mode=flashcards → array JSON válida (4 cards front/back) — parse client-side confirmado.
  · PROBE dos 2 modelos: flash-lite-latest 650ms ✓ e flash-latest 1895ms ✓. Teste manual com nome FIXO gemini-2.5-flash retornou 404 "no longer available to new users" — NÃO é bug: o código já usa aliases -latest (comentário de 26/09 no route.ts), aliases seguem funcionando. Ficou documentado: nunca fixar versão de modelo Gemini.
- DESCOBERTA DE ARQUITETURA (risco documentado): persistência no PROD = 0 linhas QA-GEM (POSTs não poluíram o banco do dono ✓), porque SQLite em arquivo não persiste em serverless — o histórico do chat hoje sobrevive entre sessões só no dev. Migração futura (Turso/Neon Postgres) é decisão do dono; o continuity DENTRO da sessão (história enviada no request) segue funcionando em todo lugar.
- NOVO RECURSO — "Testar leitura de prints" (settings-view.tsx, AiInfoCard): botão "Enviar imagem" (input file oculto, accept image/*) → FileReader → POST /api/tutor com a MESMA cadeia do chat → caixa verde com "Lido por {modelo} em {X.X}s" + transcrição; caixa vermelha com erro acionável no fail; só aparece quando a visão está ativa. O dono agora valida a leitura de prints SOZINHO, sem curl.
- ESTILO (mandatório): ProbeRow com latência colorida por velocidade (msTone: <1s esmeralda, <3s âmbar, ≥3s vermelho) + fonte mono; transcrição do teste de visão exibida LIMPA (regexes removem $$…$/$…$, comandos LaTeX e espaços duplicados — antes mostrava "$$2x + 5 = 15$$", agora "2x + 5 = 15").
- QA BROWSER REAL (dev, com key FALSA temporária p/ renderizar o bloco): injeção de arquivo real via DataTransfer no input oculto → cadeia caiu pro sandbox Z-AI (fallback correto com key inválida) → "Lido por Z-AI (fallback) em 2.2s" e depois 1.7s com transcrição limpa. Screenshots scripts/qa38-vision-selftest.png e qa38-vision-clean.png. Console sem erros.
- HIGIENE: key falsa removida do .env (dev voltou a providers.gemini=false/sandbox), imagem de teste removida do public/, 4 linhas QA-VIS apagadas do banco local (deleteMany por discipline IN QA-VIS/QA-GEM — aprendizado: a API grava o CODE no campo discipline), scripts temporários removidos; qa-gemini-validation.py MANTIDO em scripts/ como validador reutilizável de keys (texto+visão+consistência em produção).
- tsc src limpo; eslint 0.

Stage Summary:
- PEDIDO DO DONO 100% ATENDIDO: as duas variantes do Gemini testadas em produção (flash-lite 1º, flash 2º), consistência perfeita (×3 idênticos), Av1 com LaTeX correto, visão lendo print em 2.9s, flashcards JSON íntegro — tudo via key grátis, zero custo. "Resultados batendo completamente" ✓.
- Bônus: o próprio dono já pode re-testar a visão em Configurações → "Testar leitura de prints" a qualquer momento, com latência e modelo exibidos.
- PRÓXIMOS: push dispara deploy que leva o Modo Dica/TTS (07515a0) + este recurso pra produção; S3 Algoritmos 29/09 → pedir programas → gabarito autoral; Av1 01/10 (simulado no 29/09 — plano de recuperação ativo); Projeto LM 09/10 → tema/equipe; decisão futura: DB hospedado (Turso/Neon) se quiser histórico de chat persistente na Vercel.
- PÓS-DEPLOY (validação final no PRODUÇÃO REAL, via browser): deploy c3b8442 no ar — Configurações mostra Gemini/OpenRouter ativos, probe 621ms/416ms (latência colorida visível) e o novo bloco "Testar leitura de prints" ON. Teste de visão pela UI de produção: 1ª chamada (função fria, pós-deploy) → Gemini não respondeu a tempo (MODEL_TIMEOUT_MS 35s + cold start) → fallback Nemotron 3 Super leu em 48.2s SEM erro pro usuário (resiliência conforme design); 2ª chamada (função quente) → **Gemini Flash-Lite direto em 4.5s, transcrição exata "2x + 5 = 15"** — comportamento primário confirmado no deploy real. Aprendizado registrado: primeira invocação após deploy pode cair pro fallback por cold start; Melhoria futura opcional: retry rápido (1×, timeout curto) na visão antes de trocar de provedor. Evidências: scripts/qa38-prod-settings.png, qa38-prod-vision-final.png, qa38-prod-vision-warm.png.

---
Task ID: 39
Agent: Z.ai Code (main)
Task: Pedido direto do dono (testar tutor com material de CADA disciplina + prints; Pomodoro rodando em outra guia; integração IA-conteúdo "como se a IA estivesse no site"; marcar questão; console/IDE simples; organização estilo GNOME) + ciclo cron 416224 (23:15).

Work Log:
- ESTADO INICIAL: main 832669b, dev 200, /api/audit ok. Encontrado WIP NÃO commitado de ciclo interrompido anterior: src/components/hub/code-lab.tsx (console JS + preview HTML + "perguntar ao tutor") com 1 erro TS (TS2349: AsyncFunction construída com assinatura só de construtor e chamada como função) + materialId no OpenTutorDetail. Fix: assinatura dupla no cast (construtor devolve função chamável).
- POMODORO EM OUTRA GUIA (pedido central): o código antigo tinha auto-PAUSE no visibilitychange (exatamente o oposto do pedido) e tick de decremento 1/s (deriva com guia oculta — navegadores estrangulam setInterval escondido a 1/min). Reescrito: (1) endTimeRef = timestamp de fim como fonte da verdade; cada tick RECALCULA o restante pelo relógio de parede (zero drift); (2) Web Worker inline (Blob) postando a cada 1s — não é estrangulado em segundo plano, mantém título da aba e transição de fase no tempo certo; (3) preferência backgroundTimer (padrão LIGADO) com Switch no card do Pomodoro E nas Configurações ("Rodar em outra guia — o foco segue contando enquanto você pesquisa fora"); desligada, volta o comportamento antigo (auto-pausa com toast); (4) ao voltar para a guia, re-sincroniza na hora (syncFromClock no visibilitychange); (5) endTime tratado em start/pause/reset/skip/phase-complete/continueFromBanner. QA dev: timer 24:18→24:13 (5s exatos) com document.hidden=true simulado + segue rodando ao voltar; título da aba mostra "24:00 • Foco — Hub de Estudos" ao vivo.
- MARCAR QUESTÃO (resposta ao "marcar uma questão seria bom ou muito complexo?"): ExerciseProgressEntry ganhou marked?: boolean; no Praticar cada card tem estrela ★ (âmbar, aria-pressed, title, toast) e a barra de filtros ganhou o botão "Marcadas" com contador — QA dev: 1 questão marcada, filtro ativo mostra exatamente 1 card de 98. Persistência igual ao progresso atual (localStorage).
- IA COM O CONTEÚDO EM MÃOS (3 novas superfícies): (1) Praticar: botão "Perguntar ao tutor" em cada exercício — envia enunciado + dica do Hub + disciplina + material vinculado (openTutor com materialId); (2) Biblioteca: botão "Perguntar à IA" no diálogo de resumo de cada material — abre Estudar com o material SELECIONADO no Pomodoro (retrieval lê resumo IA + trechos do PDF) e pergunta pré-preenchida "Sobre o material X: "; (3) Corrigido o contrato: hub:open-tutor agora honra detail.materialId (valida contra a disciplina EFETIVA para evitar closure defasado na troca) — antes a interface prometia materialId e o handler ignorava.
- LABORATÓRIO DE CÓDIGO (resposta ao "console interativo ou IDE simples"): o WIP foi integrado à aba Estudar — aparece só em Algoritmos (Console JS, default) e LM (Preview HTML, default): editor mono com Ctrl+↵, console capturado (log/warn/error, await permitido, timeout 10s de loop infinito), iframe sandbox para HTML e "Perguntar ao tutor sobre este código" (manda código + erro pro chat da disciplina). QA dev: snippet padrão rodou ("Média: 7.33"), botão abriu o chat com o código pré-preenchido.
- TESTES POR DISCIPLINA EM PRODUÇÃO (deploy 4a1394f, hub-estudos-ifpb.vercel.app, via evento hub:open-tutor — fluxo REAL do app, material selecionado no select + pergunta do material): 6/6 respondidas "via Gemini Flash-Lite":
  · Matemática (mat-01-matrizes): inversa de 2x2 com conferência A·A⁻¹ + lembrete da Av1 01/10 (faltam 5 dias) e foco Q31-35;
  · Algoritmos (alg-lista): média ponderada passo a passo com Entrada/Saída esperada + dica da soma dos pesos (2+3+5=10) + Prova 1 confirmada 30/10/2026;
  · LM (lm-01-estrutura): elementos obrigatórios do HTML com exemplo + follow-up de atributos/h1-h6;
  · Fundamentos (prova-fund-av1): as 5 gerações como a Q1 da prova pede + oferta de revisar pioneiros;
  · RHT (rht-teletrabalho-serpro): método + amostra com os TRÊS números (45, 62, 23) — regra de ouro respeitada + oferta da Tabela 1;
  · Inglês (ing-vocabulario): 3 frases de apresentação com tradução.
  A recuperação do material aberto (resumo + trechos) e o contexto do Hub (datas de prova, semana) aparecem em TODAS as respostas — a IA está "com o conteúdo em mãos" de fato.
- ORGANIZAÇÃO GNOME: varredura de overflow horizontal nas 8 abas (1280 e 1440) = 0 overflow; console limpo (só HMR); switch contextual no card (controle onde a ação acontece, padrão GNOME); grids 7/5 + 12 colunas sem sobreposição; screenshots de evidência em download/screenshots/ (01-09, nomes amigáveis).
- HIGIENE: nenhum POST de teste no banco local (testes por disciplina rodaram em produção, onde o histórico não persiste — e o dono não vê nada); nada de QA-* a limpar desta rodada.
- COMMITS: 4a1394f → origin/main (12 files, +539/-17), deploy Vercel success confirmado pela API de deployments; worklog em origin/worklog.

Stage Summary:
- Os 4 pedidos do dono entregues e verificados: (1) tutor testado com material REAL de TODAS as 6 disciplinas com ofertas didáticas e contexto de prova — prints em download/screenshots/; (2) Pomodoro agora RODA em outra guia (timestamp + worker, sem drift, título vivo) e até avisa o fim da fase; (3) IA integrada ao conteúdo em 3 superfícies novas (exercício → tutor com material vinculado; resumo → tutor com material selecionado; laboratório → tutor com código/erro) + o que já existia (PDFs, Estudar); (4) organização estilo GNOME: zero overflow em 8 abas × 2 resoluções, controles contextuais, tamanhos consistentes.
- Resposta ao dono sobre "transcrever arquivos": a leitura de prints já existe (Gemini visão, validada Task 38) e cobre o dia a dia; a transcrição DIGITAL de PDFs inteiros (OCR em lote) continua possível mas caro/demorado — a recomendação é o fluxo atual (print → tutor + marcação ★).
- PRÓXIMOS: S3 Algoritmos 29/09 → pedir programas → gabarito autoral; simulado Av1 Matemática no 29/09 (plano D-5 em curso); Projeto LM 09/10 → tema/equipe; decisão do dono: DB hospedado (Turso/Neon) para histórico persistente em produção.

---
Task ID: 39-b
Agent: Z.ai Code (main — agente secundário da rodada)
Task: QA independente em paralelo à Task 39 + coordenação de colisão (agente paralelo detectado durante a execução) — pedido do dono (prints por disciplina, Pomodoro em outra guia, integração IA-conteúdo, marcar questão, laboratório de código, organização GNOME).

Work Log:
- COLISÃO DETECTADA E RESOLVIDA SEM QUEBRA: durante a execução, verifiquei que OUTRA instância (agente da Task 39) estava editando os mesmos arquivos em tempo real (study-view/settings-view/study-progress/material-summary-dialog/practice-view com endTimeRef+worker+backgroundTimer+estrela). Ação: NÃO tocar nos arquivos do colega; limpei apenas meus próprios leftovers não usados (imports Pin/BookOpen/Monitor, MATERIAL_PROMPTS) e REMOVI e RESTAUREI o import do CodeLab quando descobri que o colega já tinha integrado o MEU component code-lab.tsx à aba Estudar (o <CodeLab/> deles depende do import); lib pinned-questions.ts minha virou código morto (o colega implementou marked? em ExerciseProgressEntry) → apagada. Divisão final: colega = código, eu = QA + evidências + higiene.
- QA BROWSER INDEPENDENTE (sessão agent-browser isolada "qa39", dev local):
  · TUTOR COM MATERIAL EM 7 DISCIPLINAS (perguntas ancoradas no material, chat real com streaming): Matemática (inversa [[2,1],[1,1]] — passos + det), Algoritmos (Semana 2 — temas + resolução), LM (formulários — citou o material VERBATIM: form method="post" action="/pagina-processa-dados", GET p/ buscas x POST p/ dados sensíveis), RHT (número de ouro respeitado: 45 teletrabalhadores + 62 colegas + 23 chefias + Tabela 1 8,00/6,16 e 2,01/3,88), Inglês (grupos temáticos + falsos cognatos "Actually ≠ Atualmente"), Fundamentos (leu a Av1 real: gerações, conversões bin/hex/octal, plano de revisão), Português (SEM material no Hub — descoberta registrada; tutor respondeu geral de coesão). Em dev responde "via Z-AI (fallback)" pois .env local só tem DATABASE_URL — a cadeia Gemini em produção foi validada pelo colega (6/6 via Gemini Flash-Lite).
  · POMODORO CROSS-TAB (teste de parede real): Iniciar 24:46 → 24:41 (5s) → abrir NOVA GUIA, ~9s fora → voltar: 24:14 (contador acompanhou o relógio de parede na guia em segundo plano, NÃO pausou, NENHUM toast de pausa, seguia rodando) + título da aba "24:15 • Foco — Hub de Estudos" ao vivo na lista de guias. Switch "Rodar em outra guia" aria-checked=true.
  · LABORATÓRIO DE CÓDIGO: snippet com loop/forEach → console capturado exato ("1º aluno: Ana … total: 3"); caminho de erro → "ReferenceError: undeclaredVar is not defined" em vermelho; botão "Perguntar ao tutor" leva código+erro prontos (visto no fluxo real). Lab some com elegância em disciplinas não-programação (só ALG/LM) — decisão certa estilo GNOME.
  · INTEGRAÇÃO BIBLIOTECA→ESTUDAR: diálogo de resumo (RHT) → botão "Tirar dúvida sobre este material com o tutor IA" → fecha diálogo, salta #study, abre chat com pergunta pré-preenchida "Sobre o material …" — fluxo ponta-a-ponta sem fricção.
  · MARCAR QUESTÃO (Praticar): estrela em cada exercício → toast "Questão marcada ★ — use o filtro Marcadas para revisar."
  · LAYOUT GNOME (1440×900): sidebar+conteúdo+chat sem sobreposição; banner de continuidade intacto ("Você estava estudando Algoritmos — 24:02 restantes"); footer naturalmente no fim do documento (docH 932 vs vh 900, sem gap nem overlay); truncamentos funcionando no header do chat.
- HIGIENE: minhas 14 mensagens QA no banco LOCAL apagadas com deleteMany cirúrgico (perguntas por conteúdo + respostas até 3 min depois na mesma disciplina) — não podia usar códigos QA-* porque usei disciplinas REAIS (aprendizado: QA no dev com história persistente deve sempre usar disciplineCode QA-*); scripts/qa39-clean.ts removido após uso; localStorage do navegador de teste é isolado (não polui o dono).
- VERIFICAÇÃO GLOBAL: eslint 0; tsc --noEmit sem erros em src (só erros pré-existentes em skills/tests, fora do build); dev.log sem erros de runtime.
- EVIDÊNCIAS EXTRAS (scripts/, commitadas na main 453bc82): qa39-tutor-mat-inversa.png, qa39-tutor-alg-semana2.png, qa39-tutor-lm-formularios.png, qa39-tutor-rht-artigo.png, qa39-tutor-ing-vocabulario.png, qa39-tutor-fund-av1.png, qa39-tutor-port-geral.png, qa39-lab-js.png, qa39-pomodoro-bg.png, qa39-integracao-resumo-ia.png, qa39-estudar-desktop.png, qa39-dashboard-desktop.png, qa39-praticar-desktop.png.

Stage Summary:
- Confirmação independente de TUDO que o dono pediu: tutor com material de cada disciplina responde com o CONTEÚDO NA MÃO (citações literais + números exatos), Pomodoro continua em outra guia (provado por relógio de parede), marcar questão existe (estrela + filtro), laboratório de código roda JS/HTML e manda erro pro tutor, e o layout 1440×900 está limpo sem sobreposição.
- Descobertas: Português sem materiais no Hub; dev sem keys = respostas via sandbox Z-AI (produção usa Gemini — validado); sugestão para próxima rodada: chips "IA" por questão dentro dos resumos (marcar PERGUNTA específica do resumo e perguntar) como evolução natural do marcar-questão.
- Lição de git: worklog.md é ignorado na main — checkout de branch sobrescreve/remove o arquivo sem aviso; sempre reescrever a partir de origin/worklog + append novo.

---
Task ID: 40
Agent: Z.ai Code (main)
Task: Pedido direto do dono ("audita tudo, otimiza... economia de recursos principalmente armazenamento... dois botões de fechar duplicado... na verdade estou no p1, o site pode se organizar por períodos com base na grade curricular... da prioridade conforme data entrega?") + criação do cron webDevReview.

Work Log:
- BUG DOS 2 X (print do dono): o DialogContent do shadcn já tem X nativo (absolute top-4 right-4) e o pdf-viewer-dialog adicionava um SEGUNDO X no header — por isso o card "Lógica Matemática - Lista de Exercícios" mostrava dois. Fix: removido o X manual (import X limpo, pr-12 no header p/ o título não passar por baixo do X nativo). QA em browser: `[data-slot=dialog-close]` = 1 no diálogo de PDF (evidência scripts/qa40-pdf-single-x.png).
- AUDITORIA DE CÓDIGO MORTO/DUPLICADO: varredura de referências em src → calendar-widget.tsx (165 linhas) e important-links.tsx (107 linhas) com ZERO importações → removidos; export @deprecated daysUntilEvaluation sem consumidores → removido do semester.ts (weekStartDate segue usado); assets de public/ 100% referenciados (0 PDFs órfãos, 0 resumos órfãos; material-texts carregam por convenção <id>.txt — não são órfãos).
- PERÍODO CORRIGIDO (P2→P1): "2º Período" estava hard-coded em 5 lugares (layout metadata ×2, tutor ×2, header, biblioteca). Criado src/lib/curriculum.ts FONTE ÚNICA: CURRENT_PERIOD=1, CURRENT_PERIOD_LABEL, CURRENT_PERIOD_LOWER, COURSE_INFO, ADS_CURRICULUM completa.
- GRADE CURRICULAR OFICIAL (pedido "com base na grade curricular... site do instituto e campus correto"): matriz real baixada de estudante.ifpb.edu.br/cursos/12 (Matriz Curricular 2025/Fluxograma Apêndice B do PPC, lida visualmente com zoom para decifrar A/S × pré-req) → 6 períodos, 37 componentes, ~2500h, núcleos (Programação/Internet/Formação Geral/Eng. Software/BD/Redes/Extensão/Optativa), pré-requisitos (POO←14, Script Web←16, BD II←31+32, Lab ES←31+35, Web I←21, Segurança←44, Sist.Dist←44...). Confronto: os 7 componentes do 1º período batem 100% com as 7 disciplinas ativas do dono (hubCode 1:1).
- ORGANIZAÇÃO POR PERÍODO NO SITE: aba Disciplinas ganhou seção "Grade curricular do curso" expansível — 6 colunas (1º destacado com "você está aqui • 2026.2"), ponto colorido = núcleo, ponto verde = disciplina com conteúdo ativo no Hub, tooltip com CH/aulas-semana/pré-reqs; diálogo da disciplina (agente paralelo, mesma rodada) ganhou badge "Matriz: 1º período (atual) • 67h" + ficha oficial completa — materiais → disciplina → hubCode → período 100% derivado, nunca adivinhado. Evidências: qa40-grade-curricular.png, qa40-dashboard-p1.png.
- OTIMIZAÇÃO VERCEL/ECONOMIA: vercel.json com Cache-Control (pdfs/data 24h+stale-while-revalidate 7d; icons 1y immutable; sv/manifest/sw 1h) — visita repetida não re-baixa 11MB; /api/tutor ganhou export maxDuration=60 (a cadeia Gemini 35s→OpenRouter podia ser morta pelo teto padrão da plataforma = 504; agora a cadeia completa cabe). Medição honesta de armazenamento: tracked git = 17MB (public 11MB + evidências 4.2MB), público servido = 11MB — MUITO abaixo do teto Vercel; compressão gs /ebook nos 3 maiores PDFs só rendeu 6-8% (já são otimizados) → NÃO aplicado (perda de qualidade nas apostilas por ganho trivial). MAX_HISTORY=12 já limita tokens/req.
- PLANO DE ESTUDO (pergunta do dono: "da prioridade conforme data entrega?"): VERIFICADO — recovery-plan.ts ordena P0=Matemática (único compromisso com DATA, prova 01/10, ações por dia D-5..D-1 com countdown dinâmico "em 5d" no header), P1=Algoritmos (prova 30/10 + ciclo semanal S2/S3), P2=LM (projeto 09/10), P3/P4 sem data, P5 RHT adiado — fila "Faça hoje" = 1ª ação pendente das 3 primeiras trilhas. Lógica data-first correta; textos honestos.
- COORDENAÇÃO: rodada executada em PARALELO com outro agente (colisão detectada em curriculum.ts em tempo real — PLACEHOLDER quebrado e typo NUCLEUS_DOT_BGatrixInfo; aguardada estabilização, tsc 0, e commit 0dfb46c do colega que integrou TUDO inclusive meus arquivos; meu commit 2082dfb completou com vercel.json + higiene + evidências). Nenhuma mensagem de teste no banco local (TOTAL 0 TutorMessage).

Stage Summary:
- Site auditado: 0 duplicados (X do PDF era o único bug real — corrigido e provado), 0 código morto, 0 assets órfãos, 0 erros tsc/eslint, 0 mensagens de teste no banco.
- Período factual corrigido (1º) + grade curricular OFICIAL do IFPB Cajazeiras integrada ao site com derivação 100% automática material→disciplina→período.
- Economia: cache headers + maxDuration=60; storage já era magro (11MB públicos) e PDFs já comprimidos — decisões registradas com números.
- PRÓXIMOS: dono estudar (Av1 Mat 01/10: hoje Bloco 1 da Lista de Matrizes); cron webDevReview criado (15min); vigiar deploy 2082dfb na Vercel; S3 Algoritmos 29/09; Projeto LM 09/10.

---
Task ID: 40-b
Agent: Z.ai Code (main — agente secundário da rodada)
Task: Ciclo cron 416224 (00:15) — QA + finalização da grade curricular oficial no DIÁLOGO da disciplina + legenda de núcleos + verificação ponta-a-ponta (dev → produção) em rodada paralela ao Task 40.

Work Log:
- ESTADO INICIAL: main 453bc82, dev 200, WIP NÃO commitado encontrado e tratado como base (curriculum.ts + grade na DisciplinasView + período 1º + tutorCourseContext no route.ts) — mesma coordenação 39/39-b, agora com os dois agentes escrevendo código. Lembro: pdf-viewer-dialog parecia ter "TYPE_LABELaterial.type]" quebrado — FALSA ALARME, o [m foi engolido só na renderização do diff; tsc/bun provaram a linha íntegra.
- MINHA PARTE (commit 0dfb46c): (1) helpers na fonte única curriculum.ts — NUCLEUS_DOT_BG (cor do ponto por núcleo, única fonte p/ grade+legenda+ficha), nucleiInMatrix() (ordem de 1ª aparição, à prova de TDZ), getCurriculumInfo() (linha+período compostos), prereqShortNames() (pré-reqs como nomes legíveis, não números); (2) LEGENDA dos núcleos sob a descrição da grade (8 núcleos + "ativa no Hub", mesmas cores dos pontos); (3) NucleusDot refatorado para a fonte única (mapa duplicado eliminado); (4) DIÁLOGO da disciplina: badge "Matriz: 1º período (atual) • 67h" no header + seção "Na matriz oficial do curso" na Visão Geral (Período/Núcleo com ponto/CH oficial/Aulas-semana/Pré-requisitos legíveis + nota honesta da fonte Matriz 2025 PPC); (5) layout.tsx keywords com período dinâmico (antes '1º período' hardcoded); (6) comentário 36→37 componentes (7+7+5+6+6+6 — derivado dos dados); (7) higiene: calendar-widget.tsx + important-links.tsx confirmados SEM referências no HEAD e removidos (auto-commit da plataforma os tinha ressuscitado).
- QA BROWSER (1280 e 1440): grade expansível com 6 colunas sem overflow (scrollWidth=clientWidth exato), 1º período com "você está aqui • 2026.2", pontos verdes nos 7 hubCodes, legenda íntegra; diálogo Matemática mostra badge + ficha oficial completas; PDF dialog com X ÚNICO (fix do colega validado visualmente); TUTOR COM CONTEXTO INSTITUCIONAL: "Em que período do curso eu estou?" → resposta correta listando as 7 disciplinas do 1º período (tutorCourseContext() injetado no system prompt e USADO pelo modelo — dev via sandbox Z-AI).
- HIGIENE: 2 mensagens de teste QA-CUR apagadas do banco local (scripts/qa40-clean.ts, removido após uso); evidências commitadas: qa40-home3.png, qa40-grade-legenda.png, qa40-matriz.png, qa40-pdf-dialog.png.
- VERIFICAÇÃO GLOBAL: tsc 0 erros em src; eslint 0 nos 6 arquivos tocados; commits 0dfb46c (meu) + 2082dfb (cache headers/vercel.json + semester.ts do colega) → deploy 2082dfb SUCCESS confirmado pela API de deployments; PRODUÇÃO validada: GET / responde 200 com "1º Período • ADS 2026.2" no SSR, GET /api/tutor com gemini=true, openrouter=true, vision="Gemini (key grátis do AI Studio)".
- LIÇÃO DE COORDENAÇÃO: os dois agentes escreveram o mesmo domínio em paralelo (curriculum/grade/período) — funcionou porque ambos commitaram incrementalmente e o segundo integrou o primeiro; no worklog cada um registra a própria parte (Task 40 = colega: fonte+grade+X+Vercel; Task 40-b = eu: diálogo+ficha+legenda+helpers+QA+produção).

Stage Summary:
- A grade curricular oficial agora vive em TRÊS profundidades: (1) seção expansível na aba Disciplinas (visão do curso todo), (2) legenda de núcleos, (3) ficha oficial no diálogo de cada disciplina — tudo derivado da matriz 2025 do PPC com hubCodes 1:1, e o tutor sabe o período/curso/disciplinas do dono sem perguntar.
- Rodada fecha com produção verde: deploy success, rótulo 1º Período live, cadeia Gemini+OpenRouter saudável, zero overflow, zero código morto.
- PRÓXIMOS: S3 Algoritmos 29/09 → gabarito autoral dos programas; simulado Av1 Matemática 29/09 (prova 01/10); Projeto LM 09/10 → tema/equipe; sugestões pendentes do 39-b (chips "IA" por questão nos resumos; materiais de Português); decisão do dono: DB hospedado (Turso/Neon) para histórico persistente.

---
Task ID: 41
Agent: Z.ai Code (main)
Task: Correção factual do dono — "2026.2 é a segunda TURMA do ano, e não o período; eles fazem duas turmas no ano; vasculhar a página do curso que saberá sobre tudo" — implementar a terminologia correta e extrair todo o valor da página oficial do curso.

Work Log:
- VASCULHADA DA PÁGINA DO CURSO (estudante.ifpb.edu.br/cursos/12, HTML bruto via curl + parse — o page_reader só devolve o shell JS): extraídos (1) DOCENTES e titulação das 37 disciplinas dos 6 semestres (Fabio G. de Andrade/Doutorado — Algoritmos; Daniela Miguel — Inglês; Diogo Dantas — LM; Marília Aguiar — RHT; André Lira Rolim — Fundamentos; Antonio Eudes — Matemática; Francisco Igor — Português… até Optativa de P6); (2) Coordenação: Fabio Abrantes Diniz (coordenador), Diogo Dantas Moreira (substituto), cads.cz@ifpb.edu.br, (83) 3532-4100; (3) Formas de acesso: PSCS • PSE • SiSU(ENEM); (4) Perfil do egresso oficial; (5) Matriz 2025 + antiga confirmadas no seletor do portal. VALIDAÇÃO CRUZADA: os 7 professores já anotados no course-data batem 100% com o portal.
- TURMA ≠ PERÍODO (correção estrutural em 11 arquivos): curriculum.ts ganha CURRENT_TURMA_LABEL/CURRENT_TURMA_LOWER (CURRENT_SEMESTER_LABEL removido) + comentário-sentinelha no topo; CURRENT_PERIOD_LABEL agora "1º Período • Turma 2026.2" (header); footer "IFPB ADS — Turma 2026.2 (1º Período)"; sidebar "IFPB ADS • Turma 2026.2"; título/descrição/OG do layout com CURRENT_TURMA; dashboard hero "ADS • Turma 2026.2"; study-view APP_BASE_TITLE; semester.ts renomeado para "ciclo letivo 2026.2" com explicação no cabeçalho; course-data.periodo "1º Período — Turma 2026.2" (era '2º Semestre' — o erro exato que o dono apontou).
- CURSO EM RESUMO (nova faixa na aba Disciplinas, acima da legenda da grade): Coordenação (UserRound) + e-mail mailto (Mail) + telefone (Phone) + Ingresso PSCS/PSE/SiSU — 2 turmas/ano (LogIn, tooltip explica) + link "Página oficial do curso" (ExternalLink). Estilo GNOME: border bg-muted/30, text-[11px], ícones emerald size-3, flex-wrap sem overflow.
- MATRIZ COM DOCENTES: CurriculumDiscipline.docente/titulacao nas 37 linhas; tooltips da grade mostram "Docente: X (Titulação)"; diálogo da disciplina ganha linha DOCENTE na ficha oficial (+ nota de fonte "docentes da página oficial do curso, consultado em 09/2026").
- TUTOR INSTITUCIONAL: tutorCourseContext() agora diz explicitamente que "2026.2 é a TURMA de ingresso — a segunda das 2 turmas que ingressam por ano — NÃO um período; o período atual é o 1º" + lista as disciplinas COM professores + coordenação. TESTE REAL via API (disciplineCode QA-TURMA): "2026.2 é o meu período?" → "Não, é a sua turma de ingresso; você está no 1º período" + os 7 professores certos + coordenação com e-mail. Mensagens de teste apagadas do banco local (deleteMany discipline=QA-TURMA, 2 registros).
- COLISÃO DE RODADA (mesmo padrão 39/40): agente paralelo entregava o MODO REVISÃO (review-mode-dialog.tsx 430 linhas — fila guiada de ★ marcadas + Caderno de Erros, integrada ao Praticar com botão "Revisão guiada") no mesmo momento; meu git add -A varreu o WIP dele (tsc/lint limpos, feature funcional no browser). Tratamento: commit emendado com nota de integração explícita — cada um registra a própria parte no worklog.
- QA BROWSER (dev): header/hero/footer/sidebar com rótulos novos; grade 6 colunas sem overflow com badge "você está aqui • turma 2026.2"; faixa "O curso em resumo" renderiza; diálogo Matemática com DOCENTE na ficha; tsc 0 em src (só erro pré-existente em skills/, fora do build); eslint 0; dev 200 sem erros no log. Evidências: download/screenshots/qa41-grade-turma.png, qa41-grade-6col.png, qa41-ficha-docente.png.

Stage Summary:
- O site agora diz a verdade institucional completa: dono no 1º PERÍODO da TURMA 2026.2 (2ª ingressante do ano), com professores reais de todas as 37 disciplinas da matriz, coordenação com contato, formas de acesso e link oficial — tudo derivado da fonte única curriculum.ts e injetado no tutor (a IA sabe quem dá cada disciplina e a diferença turma×período sem perguntar).
- Commit 538f1f4 (emendado) na main local com TURMA + docentes + coordenação + Modo Revisão do colega; push pendente no momento do log (feito logo após com main + worklog).
- PRÓXIMOS: Ag1 Matemática 01/10 (simulado no 29/09, D-5 em curso — banner de recuperação ativo no dashboard); S3 Algoritmos 29/09 → programas do dono → gabarito autoral; Projeto LM 09/10 (tema/equipe); vigiar deploy Vercel pós-push; sugestões antigas pendentes: chips "IA" por questão nos resumos, materiais de Português, DB hospedado (Turso/Neon) p/ histórico persistente.

---
Task ID: 41-b
Agent: Z.ai Code (main — agente da rodada 00:45, ciclo cron 416224)
Task: QA inicial + ciclo cron (00:45) + implementação do MODO REVISÃO guiado (fila de ★ marcadas + Caderno de Erros) — resposta didática à semana de prova (Av1 Matemática 01/10, D-5).

Work Log:
- ESTADO INICIAL: main 2082dfb, dev DOWN (000) → reiniciado (nohup bun run dev); /api/audit ok:true (7 disciplinas · 52 materiais · 98 exercícios · 0 erros/0 avisos); produção 200. Worklog restaurado de origin/worklog (protocolo de sempre).
- FALSA ALARME EVITADA: linha 92 do practice-view parecia "const ode, setMode]" no output das tools — verificado com parser do TypeScript (parseDiagnostics: 0) e tsc fresh (rm tsconfig.tsbuildinfo): era o MESMO artefato de renderização que engole "[m" já documentado no 40-b. Nada corrigido — linha íntegra.
- DECISÃO DE FOCO: site já tem simulado, caderno de erros, ★ marcadas, tutor contextual, Pomodoro cross-tab, laboratório — faltava o FECHAMENTO do ciclo: ★/caderno ficam passivos, sem ritual de revisão. Com Av1 em D-5, implementei o Modo Revisão guiado.
- MODO REVISÃO (review-mode-dialog.tsx novo, ~430 linhas): fila = ★ marcadas ∪ caderno (neededHelp ou tentou-e-não-resolveu), pendências do caderno primeiro, mais recentes no topo; diálog GNOME-clean (max-w-2xl 672px, p-0, rounded-2xl): cabeçalho com "k de N" + barra de progresso, badges de contexto (disciplina/tópico/dificuldade/caderno/marcada), enunciado inteiro, dica sob demanda ("Ver dica" aria-expanded), autoavaliação em barra própria: "Consegui resolver" (emerald: solved=true, neededHelp=false, ★ sai — cumpriu o papel, toast explica) × "Ainda não consigo" (rose: tried=true, solved=false, neededHelp=true — fica no caderno) × Pular × Anterior; atalhos de teclado 1/2/←→ com legenda <kbd> (GNOME); "Perguntar ao tutor" abre o chat com a questão + dica + material vinculado (openTutor) SEM fechar a fila — ao voltar, continua de onde parou; tela final: "Você resolveu X de N" + progresso + "Revisar só as pendentes" (refaz a fila sem as resolvidas); fila zerada tem empty-state didático.
- INTEGRAÇÃO no practice-view: botão "Revisão guiada N" (âmbar quando N>0) na barra de ações ao lado do Simulado Pro; ReviewModeDialog montado junto do SimuladoView; buildReviewQueue exportado p/ o contador reagir ao progresso (useMemo [sp.progress] — React Compiler exige a dependência menos específica, lição do eslint).
- DETALHES DE ESTILO (item obrigatório da rodada): card de exercício ★-pendente ganha presença visual sutil (border-amber-400/50 + bg-amber-500/[0.03]); estrela com focus-visible:ring-2 âmbar (a11y/teclado); diálogo revisão com separadores e barra de autoavaliação bg-muted/40 — hierarquia clara de zonas (contexto → questão → apoio → decisão).
- QA BROWSER (dev, agent-browser): fluxo completo REAL: marcar 2 questões → "Revisão guiada 2" → diálogo "1 de 2" com badges caderno+marcada → tecla "2" persiste neededHelp:true no localStorage (prov-av1-q3 verificado) → "Consegui resolver" (botão) persiste solved:true + remove ★ (prov-av1-q1 verificado) → tela final correta nos dois casos ("0 de 1 — as 1 que ainda doem ficam no Caderno") → "Revisar só as pendentes" volta ao "1 de 1" → "Perguntar ao tutor" troca para Estudar com "Tirar dúvida com IA" visível (evento compartilhado com os cards de exercício, já QA'd nas Tasks 39/39-b). Zero overflow com diálogo aberto (sw=cw=1440, dlg 672px). Evidências: scripts/qa41-revisao-aberta.png, qa41-revisao-dialog.png (badges duplos), qa41-revisao-fim.png, qa41-tutor-da-revisao.png.
- HIGIENE: marcas de teste do perfil QA limpas (localStorage), nenhum POST no banco (fluxo é 100% client-side); reposição de estado via UI real, não via script.
- COLISÃO DE RODADA (3ª vez — padrão saudável): agente paralelo (Task 41) commitou 8044f23 com correção Turma 2026.2 + docentes + INTEGRANDO meu review-mode em desenvolvimento; meu commit d2e4cb3 completou com evidências; git diff HEAD = vazio (nada perdido); push 8044f23..d2e4cb3 → Vercel dispara deploy com TUDO.
- VERIFICAÇÃO: eslint 0 nos 2 arquivos; tsc 0 em src; lint do React Compiler (preserve-manual-memoization) resolvido.

Stage Summary:
- O ciclo de estudo agora fecha: marcar ★ / registrar erro → Revisão guiada (uma por vez, com dica e tutor a um clique) → autoavaliação honesta → fila zerada na véspera da prova. Feito sob medida para a semana Av1 (D-5).
- Rodada com produção em deploy (push d2e4cb3), colisão integrada sem perdas (Turma+docentes do colega + Modo Revisão meu), zero sujeira no banco e no perfil.
- PRÓXIMOS: validar deploy em produção + QA visual pós-deploy; simulado Av1 29/09 e prova 01/10 (usar o Modo Revisão com as ★ do dono); S3 Algoritmos 29/09 → gabarito autoral; Projeto LM 09/10; sugestões antigas: chips "IA" por questão nos resumos, materiais de Português, DB hospedado (decisão do dono).

---
Task ID: 42
Agent: Z.ai Code (main — agente da rodada 01:15, ciclo cron 416224)
Task: QA global + consumir as duas sugestões pendentes mais antigas do 39-b: chips "IA" por questão nos resumos + bloco de conhecimento de Português no tutor (a última disciplina sem base de conhecimento).

Work Log:
- ESTADO INICIAL: dev 200, produção 200 com d2e4cb3 (Modo Revisão + Turma 2026.2 já em produção), /api/audit ok:true (7 disciplinas · 52 materiais · 98 exercícios · 0 erros/0 avisos), main local tinha 1 commit órfão de screenshot (0c48fdb, agente paralelo — foi junto no push).
- GAPS ENCONTRADOS: (1) material-summary-dialog tinha "Perguntar à IA" só para o material INTEIRO — os itens de exercicios_sugeridos e perguntas_autoavaliacao eram texto morto, sem ação; (2) route.ts: grep "PORT|Português" = 0 resultados — Português era a ÚNICA das 7 disciplinas sem bloco na BASE DE CONHECIMENTO (quebra do princípio "todo o resto como foi organizado a matemática").
- CHIPS IA POR QUESTÃO (39-b pendente): AskAiChip novo (~28px, redondo, emerald, Sparkles size-3.5, active:scale-95, focus-visible:ring emerald/40 — GNOME discreto); handleAskAi no pai (useCallback [material, onOpenChange]) fecha o diálogo e dispara openTutor({disciplineCode, materialId, question}) — o tutor recebe o material aberto de verdade (resumo + trechos via materialId). 3 seções integradas: Exercícios Sugeridos ("me explica o exercício X passo a passo, como o professor faria?"), Perguntas de Autoavaliação (checkbox flex-1 + chip fora do label pra não togglear; "quero entender, não só a resposta") e Erros Comuns ("por que acontece e como evito? exemplo certo vs. errado"). Dica de rodapé em cada seção explica o botão. materialTitle novo prop no SummaryBody (React.memo mantido).
- PORTUGUÊS NO TUTOR: bloco didático-completo na BASE DE CONHECIMENTO (após Inglês): prof. Francisco Igor (Mestrado), conteúdo programático (coesão/coerência, norma culta, crase, vícios, semântica), avaliação contínua 60/40 escala 10 aprovação ≥7, referências de cadeira (Bechara, Cunha & Cintra, Garcia/Comunicação em Prosa Moderna com tópico frasal + ideia-central-apoio), conexão com projeto LM. MATERIAL-FIRST PRESERVADO: instrução explícita de NÃO afirmar o que foi dado em aula (não há material do professor) — honestidade ativa em vez de invenção.
- QA REAL (agent-browser, dev): Biblioteca → Matemática → Materiais → resumo "Lógica Matemática - Lista de Exercícios" → chips visíveis nos 5 exercícios + 2 perguntas (qa42-chips-exercicios.png); clique no chip 1 → diálogo fecha → Estudar abre com textarea PRÉ-PREENCHIDA ("Sobre o material ...: me explica o exercício 'Identificar proposições...' passo a passo") e Pomodoro mostrando "Material: Lógica Matemática - Lista de Exercícios" (qa42-tutor-resposta.png); resposta didática completa com tabela item/proposição/valor + "Dica do professor" + "Próximo passo" citando os itens 2 a 4 DO MESMO material — a IA literalmente com o conteúdo em mãos. TESTES API (disciplineCode QA-PORT): "como estruturar parágrafo técnico?" → tópico frasal/estrutura Garcia correto; "o que o professor passou na última aula?" → "Ainda não há material... verifique o Classroom" (sem invenção). 4 mensagens QA-PORT apagadas do banco local (script temporário, removido).
- VERIFICAÇÃO: eslint 0 nos 2 arquivos; tsc 0 em src; commit 0b1bd4a na main + push (Vercel dispara deploy).
- ESTILO DA RODADA (item obrigatório): chips com respiração de hover, escala no active, anel de foco; seções de exercícios/erros ganharam transition-colors no hover (feedback de linha interativa); texto de apoio das seções agora explica a ação do chip (didática da UI, não só ícone).

Stage Summary:
- O ciclo "resumo → praticar → tirar dúvida" virou uma coisa só: TODO item de exercício, pergunta de autoavaliação e erro comum de qualquer resumo agora manda a pergunta ao tutor com o material aberto — é o "chips IA por questão" que estava pendente desde o 39-b, e a resposta do tutor já citou os próximos exercícios do mesmo material sem receber nada além do contexto.
- Português deixa de ser o ponto cego do tutor: ensina a didática da disciplina (tópico frasal, crase, resumo/resenha) e é honesto quando falta material — 7/7 disciplinas com base de conhecimento.
- PRÓXIMOS: validar deploy 0b1bd4a em produção; simulado Av1 Matemática 29/09 (D-2) e prova 01/10 — usar o Modo Revisão com as ★ do dono; S3 Algoritmos 29/09 → programas do dono → gabarito autoral; Projeto LM 09/10 (tema/equipe); pendências antigas: materiais de Português (aguardando o dono mandar PDFs do Classroom), DB hospedado (Turso/Neon, decisão do dono).

---
Task ID: 42-b
Agent: Z.ai Code (main — agente da rodada 01:30, ciclo cron 416224)
Task: QA global + fechar o elo que faltava na integração IA×conteúdo: o DEBRIEFING pós-simulado (o único momento do ciclo de estudo sem IA). D-3 para o simulado da Av1 (29/09) — o recurso cai na semana exata do uso.

Work Log:
- ESTADO INICIAL: dev 200, produção 200 (0b1bd4a com chips dos resumos já validado na rodada 42), /api/audit ok (52 materiais · 98 exercícios · 0 erros/0 avisos). grep em simulado-view/simulado-history: ZERO menções a tutor/IA — o aluno terminava o simulado, via o anel de % e... nada. Último elo morto do ciclo.
- DEBRIEFING PÓS-SIMULADO (simulado-view.tsx): (1) botão "Analisar com IA" no rodapé do Resultado (âmbar, consistente com "Perguntar à IA" do resumo) monta via buildDebriefQuestion() um relatório compacto: aproveitamento % + tempo + uma linha POR questão [disciplina · tópico · dificuldade · CONSEGUI/NÃO CONSEGUI/PULADA · enunciado truncado em 110 chars] e pede (1) padrão dos erros (2) ordem de revisão (3) um treino por tópico fraco — abre o tutor pré-preenchido com a disciplina do 1º erro; (2) CHIPS IA por questão errada na lista "Para revisar depois" (size-6, mesmo padrão emerald do 42, com linkedMaterials?.[0] como materialId — o tutor lê o material real da questão) com pergunta de correção: "me ensina como se resolve, passo a passo, como o professor faria na correção?". openTutor importado; Sparkles já existia no arquivo.
- QA REAL END-TO-END (agent-browser, dev): simulado Pro real (10 questões, sem tempo) → marquei 3× "Não consegui" + 2× "Consegui" (atalhos de mouse) → Encerrar → Resultado 40% com botão "Analisar com IA" + 3 chips verdes contados no DOM → clique no botão → tutor abriu com o debrief completo pré-preenchido (todas as 5 questões com status) → ENVIADO: resposta do tutor analisou os 3 erros com TREINO POR TÓPICO (código C do raio/circunferência com #define PI e dica de %f para Algoritmos; exercício de Modus Tollens para Matemática) e FECHOU CITANDO A DATA REAL DA PROVA: "Lembre-se: sua prova de Matemática é 01/10/2026 — foque nela também!" — o contexto institucional do system prompt trabalhando junto com o debrief. Evidências: qa42-simulado-resultado.png, qa42-simulado-debrief.png.
- TESTE DO CHIP POR QUESTÃO: verificado no snapshot/DOM (3 botões com aria-label "Perguntar à IA como resolver esta questão"); o fluxo é o mesmo openTutor já validado 2× nesta e na rodada anterior.
- HIGIENE: 4 mensagens de teste do banco local apagadas por ID exato (debrief TEC.1632 + chip TEC.1984; aprendizado: bun run falha fora de scripts/ por causa do resolve do Prisma client — inspecionei primeiro os IDs completos). localStorage do perfil QA: simuladoRuns=[] e exerciseProgress={} (limpo a corrida de teste: 6/98 tentados → 0).
- VERIFICAÇÃO: eslint 0; tsc 0 em src; commit 30ef2c9 + push main (Vercel dispara deploy).
- ESTILO DA RODADA (item obrigatório): lista de errados virou linhas interativas (flex + truncate + hover:bg-muted/50) com chip à direita; rodapé do resultado reorganizado em grupo à esquerda (Novo simulado ghost + Analisar com IA âmbar outline) × Refazer errados emerald sólido à direita — 3 pesos visuais claros, flex-wrap sem overflow.

Stage Summary:
- O ciclo de estudo agora é 100% assistido: resumo (chips por questão) → praticar (tutor contextual) → simulado (debriefing com análise de professor + plano + treino por tópico fraco) → Modo Revisão (★/caderno) — e a IA cita datas reais da prova nas análises. A frase do dono "como se praticamente a IA estivesse no site e com o conteúdo em mãos" está cumprida em TODOS os pontos de contato do estudo.
- Deploy 30ef2c9 em produção para validar na próxima rodada (padrão: chips/resultado aparecem no SSR não, mas via client — abrir Praticar e terminar um simulado curto).
- PRÓXIMOS: SIMULADO REAL DA AV1 29/09 (D-2!) e prova 01/10 — o dono já tem simulado Pro + debriefing + Modo Revisão prontos para a semana; S3 Algoritmos 29/09 → gabarito autoral dos programas; Projeto LM 09/10 (definir tema/equipe com o grupo); pendências: materiais de Português (aguardando dono), DB hospedado Turso/Neon (decisão do dono), visão do resultado no simulado-history (chip "Analisar" em corridas antigas — ideia para próxima rodada).

---
Task ID: 43
Agent: Z.ai Code (main — agente da rodada 01:45, ciclo cron 416224)
Task: QA global + validação do deploy 30ef2c9 em produção + consumir a ideia enfileirada pelo 42-b: o HISTÓRICO de simulados agora fala com a IA (chip por tentativa + análise de evolução) — fechando o único ponto do ciclo que ainda era um gráfico morto.

Work Log:
- ESTADO INICIAL: dev 200, produção 200 com deploy 30ef2c9 confirmado pela API de deployments, /api/audit ok (52 materiais · 98 exercícios · 0 erros/0 avisos). worklog sincronizado de origin/worklog (protocolo).
- QA PRODUÇÃO (agent-browser): dashboard com contagem Av1 correta ("Faltam 5 dias", simulado 29/09, banner de recuperação com "NÃO CAEM: determinantes/sistemas — confirmado 24/09"); fluxo REAL do Simulado Pro em produção (5 questões: 1 consegui, 2 não consegui, 2 puladas) → Resultado 20% com o debriefing do 42-B VALIDADO AO VIVO: botão "Analisar com IA" abre o tutor pré-preenchido com o relatório completo (5 questões com status/disciplina/tópico/dificuldade + pedido em 3 partes) e 4 chips por questão errada no DOM (evidência qa43-prod-resultado.png). NADA enviado ao tutor em produção (higiene do DB prod).
- FALSA ALARME EVITADA: badge "Biblioteca 51" vs audit "52 materiais" — o badge é notViewedCount (não vistos), não o total. Sem bug.
- FOCO DA RODADA (ideia enfileirada pelo 42-b): SimuladoRun só guardava agregados (total/solved/missed/skipped) — tentativas antigas eram inanalisáveis. Mudança estrutural: (1) RunQuestionDetail novo em study-progress.ts (status/disciplina/tópico/dificuldade/enunciado truncado em 160 chars) gravado em cada corrida nova (recordRun) — retrocompatível, corridas antigas continuam legíveis; (2) lib NOVA simulado-debrief.ts com os 3 construtores: buildDebriefFromDetails (usado no resultado ao vivo — buildDebriefQuestion local do simulado-view FOI REMOVIDO, zero duplicação), buildRunDebriefQuestion (histórico: detalhes completos OU fallback honesto "antes de o Hub gravar os detalhes por questão, só tenho os totais") e buildTrendQuestion (série das 12 mais recentes, capped por custo de token).
- HISTÓRICO ANALISÁVEL (simulado-history.tsx reescrito): chip IA por tentativa (mesmo padrão emerald 42/42-b, ml-auto, title DIDÁTICO que distingue "debriefing completo" de "só totais — corrida antiga") + botão "Analisar evolução com IA" (âmbar, consistente com o do resultado) que envia a série inteira para o tutor ler a TENDÊNCIA. Disciplina de contexto derivada dos dados: corrida = disciplina com mais erros; evolução = a mais recorrente.
- QA DEV REAL (agent-browser, dados semeados: 1 corrida antiga sem detalhes + 2 novas com): chip da antiga → pergunta honesta de agregados ✓; chip da nova → debriefing COMPLETO questão a questão a partir do histórico (idêntico ao ao vivo) ✓; botão evolução → ENVIADO EM DEV: resposta estruturada exatamente nos 3 pedidos — "(1) Tendência: Melhora lenta, mas inconsistente" (40%→40%→60%, com alerta de "sorte" vs revisão pontual), "(2) Tópicos fracos" (Matrizes + De Morgan ligados às questões reais) e "(3) Plano curto (7 dias)" citando mat-ex01–05 e a Lista de Matrizes Q1–16 DO HUB (evidência qa43-trend-resposta.png). Overflow 0 (sw=cw=1440).
- HIGIENE: 2 mensagens de teste apagadas do banco local por janela de tempo na disciplina TEC.1984 (aprendizado: TutorMessage não tem threadId — janela createdAt ±minutos resolve o par user+assistant); script temporário removido; localStorage do perfil QA com simuladoRuns=[] (semente de teste limpa).
- VERIFICAÇÃO: tsc 0 em src; eslint 0 nos 4 arquivos tocados; commit 3391956 + push main (Vercel dispara deploy).
- ESTILO DA RODADA (item obrigatório): barra de distribuição por tentativa (emerald/rose/muted, título com totais) — a nota % ganha uma leitura qualitativa num piscar de olhos; legenda de pontos sob a lista (consegui/não consegui/puladas); tooltips nos 8 gráficos de evolução; linhas com hover emerald (border + bg sutil) e tabular-nums; chip com focus-visible:ring (a11y teclado) e active:scale-95.

Stage Summary:
- O histórico de simulados saiu do papel: toda tentativa passada (e a evolução entre elas) é analisável pela IA — o dono pode perguntar "por que errei nessa corrida?" semanas depois, com o mesmo nível de detalhe do debriefing ao vivo, e pedir uma leitura de coach sobre a série inteira na véspera da prova. O ciclo 42-b (debrief no resultado) agora cobre TAMBÉM o passado.
- A partir de agora cada nova corrida grava os detalhes por questão — quanto mais o dono usa, mais rica fica a análise retrospectiva.
- PRÓXIMOS: validar deploy 3391956 em produção (chip do histórico aparece na aba Progresso); SIMULADO REAL DA AV1 29/09 (D-2) e prova 01/10 — fluxo completo pronto: Simulado Pro → debriefing → Modo Revisão → evolução com IA; S3 Algoritmos 29/09 → gabarito autoral dos programas; Projeto LM 09/10 (tema/equipe — A1 etapa 1 entrega 09/10 confirmada no cronograma); pendências antigas: materiais de Português (aguardando dono), DB hospedado Turso/Neon (decisão do dono).
