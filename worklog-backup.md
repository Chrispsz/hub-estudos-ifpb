
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
