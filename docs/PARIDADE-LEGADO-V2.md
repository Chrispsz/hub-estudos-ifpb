# PARIDADE LEGADO ↔ V2 — matriz completa (Task 1-a, Explore)

> Auditoria READ-ONLY de 10/10/2026. Base: leitura integral de `src/components/v2/*` (19 arquivos),
> `src/lib/v2/*` (13), `src/app/page.tsx`, `src/app/api/tutor/route.ts` (1.559 linhas) +
> `api/tutor/history`, cabeçalhos/exports das ~30 superfícies de `src/components/hub/*` e de todas as
> libs de suporte (`src/lib/*`). Objetivo: nada do site antigo pode se perder no cutover.
> Status: **OK** = existe equivalente no v2 · **PARCIAL** = existe, com recorte menor · **FALTA** = só no legado.

---

## 1. Inventário do LEGADO (`/?legacy=1`)

Entrada: `src/app/page.tsx` (261 linhas) — 3 abas (library/study/practice) + Header + CommandPalette
+ eventos `hub:open-tutor|open-simulado|open-practice`. Estado único: `src/lib/study-progress.ts`
(1.467 linhas — megachave `hub-estudos-ifpb:v2` + satélites `hub:*`: flashcards Leitner, runs de
simulado, notas reais, pomodoro, sessões de foco, preferências, kaizen, exerciseProgress).

### 1.1 Abas e superfícies

| Componente (linhas) | Entrega real |
|---|---|
| `dashboard.tsx` (295) | Casa limpa t180: método único (LER com tutor → RESOLVER no papel → ENSAIAR no simulado), provas viram conteúdo, links p/ folha de revisão e kit. **Bug: link `/folha-revisao` não tem rota em src/app (dashboard.tsx:256 → 404).** |
| `disciplines-view.tsx` (309) | Grade do curso, professores, contato, logins, curriculum ADS. |
| `library-view.tsx` (316) / `materials-list.tsx` (580) | Acervo por matéria/tipo, badges de concluído/histórico, abrir material, resumo IA. |
| `discipline-detail-dialog.tsx` (841) / `discipline-card.tsx` (136) | Detalhe da matéria: conteúdo programático, materiais, provas, captura DOM p/ tutor. |
| `study-view.tsx` (3.450) | Aba Tutor: chat SSE com freio (stop), histórico do servidor com separadores de dia + busca + recibo, export `.md`/copiar, "Me testa" (quiz), gerador de cards FRENTE:/VERSO, modo dica, retry de turno, continuar pós-interrupção, follow-scroll inteligente, captura de tela com recorte, captura de página de PDF, paste-cleanup, lightbox do print, Pomodoro S3, portas do material. |
| `tutor-quick-panel.tsx` (1.244) | Painel do tutor em tela dividida dentro do PDF (mesmos poderes do chat principal; thread cacheada por material; **não manda `persist:false`**). |
| `pdf-viewer-dialog.tsx` (1.047) | Leitor + tutor split (desktop colunas arrastáveis / mobile abas), lembra modo/largura, monta PdfSearchDialog + PdfPageCaptureDialog. |
| `pdf-search-dialog.tsx` (456) + `pdf-search.ts` (242) | Busca dentro do PDF (pdf.js), fold de acentos/pontuação, trechos com origem, "ir" salta `#page=N`, "printar" manda p/ captura. |
| `pdf-page-capture-dialog.tsx` (589) + `pdf-print.ts` (96) | Renderiza a página EXATA em 2× via pdf.js → anexo direto no tutor; print de página com 1 clique. |
| `capture-crop-dialog.tsx` (275) + `screen-capture.ts` (308) + `capture-clean.ts` (125) + `capture-tidy-banner.tsx` | Captura de tela (getDisplayMedia → 1 frame → recorte nativo → data URL), overlay arrumado com timing garantido. |
| `dom-capture.ts` (27) | Superfícies DOM do Hub (resumo IA, ementa) viram imagem p/ tutor. |
| `print-lightbox-dialog.tsx` (251) + `print-lightbox.ts` (135) | O print que se lê de novo: zoom explícito (−/%/+/Ajustar), navegação. |
| `paste-cleanup.ts` (103) | Colagem de PDF quebrada remontada (hífens, wrap geométrico). |
| `practice-view.tsx` (1.212) | Banco de exercícios material-first (mostrar futuros), marcar ★, "precisei de ajuda"/"tentei e não resolveu" → caderno, Modo Revisão guiado, perguntar ao tutor, folhas de papel. |
| `mistake-notebook.tsx` (842) + `mistake-notebook.ts` (711) | Caderno de Erros: agrega erradas/puladas de simulados + exercícios frágeis + cartões fracos; chip IA por linha ("reensina") e envio do caderno INTEIRO p/ análise de padrões. |
| `simulado-view.tsx` (2.570) | Simulado Pro: cronômetro, navegação por questão, bandeiras, pausa, retomada (F5-safe), resultado com anel, meta, por tópico. |
| `simulado-history.tsx` (846) + `simulado-resume.ts` (142) + `simulado-debrief.ts` (401) | Histórico de runs, gráfico de evolução, tendência por tópico, debriefing IA por corrida e da série. |
| `flashcards-view.tsx` (1.566) | Baralho Leitner (caixas 0–5), sessão de revisão, gerar IA, criar/editar, cartões de erro, **import/export JSON**, fila por vencimento. |
| `code-lab.tsx` (302) + `code-highlight.ts` (304) + `code-block.tsx`/`chat-code.tsx` | Console JS + preview HTML ao vivo (iframe sandbox), erro → tutor com 1 clique; tokenizer C/Portugol/HTML usado no markdown do tutor. |
| `video-player-dialog.tsx` (232) | Player embutido YouTube/Drive(arquivo e pasta)/Vimeo/genérico. |
| `settings-view.tsx` (1.067) | Tema, meta diária, Pomodoro (durações, som, notificações de fase, timer no título, background), PWA instalar, backup export/import com selo, reset, diagnóstico das keys de IA (probe por provedor com latência). |
| `command-palette.tsx` (874) + `palette-search.ts` (290) | Ctrl+K universal: navegação + busca no acervo de exercícios e materiais. |
| `folha-revisao-sheet.tsx` (754) | Folha de revisão impressa (Av1): fórmulas KaTeX, checklist sincronizado. |
| `caderno-papel-sheet.tsx` (263) + `src/app/caderno-papel/page.tsx` | Pendências do Caderno de Erros no papel (WYSIWYG, selo). |
| `review-mode-dialog.tsx` (433) | Fila guiada de revisão (★ + caderno), 1 questão por vez, dica oculta, tutor a 1 clique. |
| `material-summary-dialog.tsx` (857) | Resumo IA do material: pontos-chave, autoavaliação, questões ligadas (evento open-practice), captura. |
| `downloads-dialog.tsx` (262) + `download-utils.ts` (132) | Download offline: PDFs por matéria, tudo, resumos (ZIP). |
| `dashboard`/`exam-readiness.ts` (361) | Score de prontidão (0–100) com 5 evidências reais (saiu da home t180, lib viva). |
| `use-smart-crons.ts` (186) | Crons client-side: avaliações ≤7d, disciplina parada ≥5d, virada de meia-noite, visibilitychange. |
| `prof-audio-map.ts` (538) | Mapa espelhado da Av1 (áudio do prof. × simulado) — artefato pontual da Av1. |
| `formula-recite.ts` (246) | Recitação de fórmulas no kit da véspera (sabe qual travou). |
| `tutor-context.ts` (267) | `buildHubContext()` — professor, datas oficiais à frente, progresso, semana da prova, enviado por chamada. |
| `tutor-cards.ts` (180) | Sufixo de prompt + parser FRENTE:/VERSO → cartão Leitner com 1 clique. |
| `tutor-quiz.ts` (46) | Prompt do interrogatório "Me testa" (testing effect). |
| `tutor-stream.ts` (196) | Cliente SSE com fallback JSON, parcial preservado, cap 5500 com omissão honesta de itens. |
| `tutor-retry.ts` / `tutor-continue.ts` / `tutor-follow.ts` / `tutor-thread-cache.ts` / `tutor-history-view.ts` (236) / `tutor-chat-export.ts` (73) / `tutor-image.ts` (93) / `ephemeral-registry.ts` / `composer-draft.ts` | A engenharia fina do chat: retry, palavra de volta, follow com intenção, cache de fio por material, calendário da conversa + busca (teto 80/disc), export compartilhado, compressão de imagem, rascunho que sobrevive. |
| `semester.ts` (250) | Calendário oficial 2026.2 (fonte única, computa semana/dias). |
| `math-exam-prep.ts` (2.095) / `exercise-extractor.ts` (1.312) | 98 exercícios material-first + kit Av1. |
| `curriculum.ts` / `curriculum-state.ts` / `discipline-activity.ts` | Grade oficial + "o que a turma já viu" (oculta futuros). |
| `backup-export.ts` (60) / `backup-guard.ts` (101) | O seguro do progresso (export com selo na porta). |
| PWA: `pwa.tsx` + `public/sw.js` + `manifest.webmanifest` | SW global (shell SWR, PDFs/data cache-first, /api sempre rede), instalável. |

---

## 2. Inventário do V2 (`/` — Edição Definitiva)

| Arquivo | Entrega real |
|---|---|
| `v2/app.tsx` (337) | 3 destinos (HOJE/ESTUDAR/PROGRESSO) + dock do tutor; Header com rank/XP/dias30/streak; Footer com fila FSRS; **Onboarding: backup → migração → entrar (sem restaurar backup!)**. |
| `tab-hoje.tsx` (677) | Check-in 1 toque (bateria; baixa = dia leve automático), tipo de dia (override + teto de jogo 3/sem + véspera bloqueia), **plano de hoje** (2–4 itens com porquê, dose em pomodoros, começo mínimo, materiais ligados → tutor), sessão viva (timer + PomodoroBar + vagabond 0 XP), board dos blocos com sugestões (Ritmo/Fundação/Fila/Flashcards), lote ativo fixado, check-out de 10s (mood + nota). |
| `tab-estudar.tsx` (64) | Segmented: Materiais/Trilha/Revisão/Backlog/Erros. |
| `tab-materiais.tsx` (237) | Prateleira dos 56 materiais; estrela "da semana" (boost ×1.8 por 9d, propaga a tópicos via unidades); **reusa PdfViewerDialog + MaterialSummaryDialog do legado** (leitor split, busca, captura de página); "tutor lê comigo" (materialId → retrieval). |
| `tab-trilha.tsx` (217) | Escadinha do PPC por matéria → tópico → unidade; domínio real (recência 0.7), pré-req na ordem, próximos degraus da Fundação, prática solta. |
| `tab-revisao.tsx` (115) | Fila FSRS do dia (vencidas primeiro, dias de atraso), "+5 XP revisão do dia" 1×/dia. |
| `tab-backlog.tsx` (217) | Material cru → conversão assistida (unidade questão/kata ou leitura-recall ou "não vou"), cap 5/dia (+3 XP). **Conversão nasce `topicId:null` e não há UI para adotar em tópico.** |
| `tab-code-review.tsx` (164) | Log de erros vivo: 1 frase + categoria (conceito/deslize/tempo), status aberto → re-testado → dominado (2 acertos de cabeça), re-teste inline, filtros. |
| `tab-progresso.tsx` (54) | Segmented: Sprint/Missões/Rotina/Perfil. |
| `tab-sprint.tsx` (123) + `v2/sprint.ts` (151) | Semana seg→dom: minutos/dia, acerto real, erros abertos, conversões, issues fechadas, próxima prova, XP da semana. |
| `tab-quests.tsx` (329) | Issues (diária/semanal/única), Modo Quadro (foto comprimida), leitura com recall 3 frases, slot de Projeto único, Modo Vagabond (0 XP). Quest completa não dá XP (doutrina). |
| `tab-rotina.tsx` (234) | Grade semanal fixa (templates neutros semeados, editáveis), minutos de estudo do dia, dia de jogo, voltar à grade padrão (respeita `routine:userEdited`). |
| `tab-perfil.tsx` (225) | Rank (XP+acerto real, progresso pelo pior eixo), dias30, streak piso 60min, Modo Recuperação, **backup/restore do bundle completo + re-migração idempotente**, porta `/?legacy=1`. |
| `tab-tutor.tsx` (788) | Tutor integrado ao núcleo: contexto ao vivo por pergunta (modo recuperação, plano Ritmo/Fundação, tópico da sessão viva, últimos 3 erros, prova próxima, fila), stream + stop, modo dica, anexo de print com rótulo (compressão 1280px), quick actions (explicar material/tópico, quiz 3 questões, por que errei), **gera flashcards → baralho v2 (ids determinísticos)**, retry (perde imagem), thread no Dexie (120), persist:false, chip honesto de provedor, transparência do contexto enviado. |
| `pomodoro.tsx` (171) | Finish-the-thought: ao fechar ciclo, pergunta "+10min" ou pausa (5/15 a cada 4); estado por sessão no localStorage; sem config. |
| `unit-practice.tsx` (173) | Registro <10s: Acertei/Errei (exige 1 frase + categoria)/Não tentei + "de cabeça"; XP + FSRS via repo. |
| `card-practice.tsx` (59) | Flashcard FSRS: Errei=Again/Acertei=Good/Fácil=Easy. |
| `phase1-panel.tsx` (364) | Console `/?v2`: backup (bytes/linhas), migração com prova de idempotência, restaurar, contagens vivas. |
| `v2/domain.ts` (312) | 13 tabelas, ids naturais, priorStats (semeia, nunca falsifica), Vagabond, TutorMessage. |
| `v2/store.ts` (79) + `v2/use-v2.ts` (108) | Dexie `hub-projeto-principal` v2 + hooks live (attempts limit 2000, meta, focus marks). |
| `v2/repo.ts` (315) | Única porta de escrita: answerUnit/answerCard (FSRS), sessões (XP guard-rail ≥15min), revisão-do-dia 1×/dia, cap backlog 5/dia, quests, overrides de rotina, gamedays, toggleFocusMark. |
| `v2/planner.ts` (540) | Domínio honesto (acerto real ponderado recência, semente priorStats), estável (80% nas últimas 5 OU FSRS ≥10d), Ritmo (interleaving entre matérias, prova ×2/×3, semana ×1.8, atraso ×1.25), Fundação (pré-req estáveis, dependentes, defasagem), fila FSRS, flashcards vencidos, recoveryStatus (saída honesta). |
| `v2/plano.ts` (190) | Plano do dia: 2–4 itens, dia leve (15min conta), narrativa gentil, quick win = fila pequena, merge material→tópico. |
| `v2/diario.ts` (97) | Check-in/check-out no meta, semana p/ Sprint, modo leve. |
| `v2/xp.ts` (155) | XP só de trabalho real (regras fixas), ranks com gate de acerto, streak piso 60min (hoje sem piso → começa ontem, não mente), **dias30 = métrica primária anti-streak-punitivo**. |
| `v2/fsrs.ts` (164) | ts-fsrs wrapper: semeadura Leitner (caixa→estabilidade, dueAt real) e priorStats, avanço real. |
| `v2/migrate.ts` (263) | Snapshot do legado ANTES de tudo; import idempotente (cartões Leitner→FSRS, pomodoro/foco→sessões, exerciseProgress→priorStats, notas→exams). |
| `v2/backup.ts` (85) | Bundle núcleo+legado JSON; restore transacional + chaves legadas. |
| `v2/content-seed.ts` (402) | Semente: matérias/tópicos (cadeia PPC)/98 unidades/backlog/provas/rotina (grade redesenhada, neutra, respeita edição humana). |
| `v2/sprint.ts` (151) | Agregação da semana (conversões da semente não contam como da semana). |

---

## 3. MATRIZ DE PARIDADE

### Tutor IA
| # | Feature | Legado | V2 | Status |
|---|---|---|---|---|
| T1 | Chat com streaming SSE + freio (parar) | `study-view.tsx` + `tutor-stream.ts` | `tab-tutor.tsx` (stop/abort) | **OK** |
| T2 | Modo socrático (dica antes da solução) | `study-view.tsx` (hintMode) | `tab-tutor.tsx` (dica ON/off) | **OK** |
| T3 | Leitura de imagem/print (visão + transcrição no servidor) | `tutor-image.ts`, `screen-capture`, etc. | `tab-tutor.tsx` (upload arquivo→JPEG 1280) | **OK** (ver T5) |
| T4 | Contexto do app por chamada (hubContext/studentContext) | `tutor-context.ts` (buildHubContext) | `tab-tutor.tsx` (hubContext + studentContext + CONTEXTO AO VIVO do núcleo — novo) | **OK** (v2 supera) |
| T5 | Capturas: tela+recorte · página do PDF · DOM · paste-cleanup · lightbox | `capture-*`, `pdf-print`, `dom-capture`, `paste-cleanup`, `print-lightbox*` | só upload de arquivo; capturas continuam acessíveis **via PdfViewerDialog** aberto da prateleira, mas não no dock do tutor | **PARCIAL** |
| T6 | Quiz "Me testa" estruturado (interrogatório) | `tutor-quiz.ts` | quick action "quiz · 3 questões" = prompt de texto | **PARCIAL** |
| T7 | Gerador de flashcards | `tutor-cards.ts` (FRENTE:/VERSO no chat, 1 clique p/ Leitner) + modo flashcards | `tab-tutor.tsx` (modo flashcards → baralho v2, ids determinísticos) | **OK** (sem o caminho "do erro ao cartão" no chat — PARCIAL nesse recorte) |
| T8 | Retry do turno | `tutor-retry.ts` (com print) | `tab-tutor.tsx` retryLast — **descarta a imagem** | **PARCIAL** |
| T9 | Continuar pós-interrupção ("palavra de volta") | `tutor-continue.ts` | inexistente (só stop) | **FALTA** |
| T10 | Follow-scroll com intenção do leitor | `tutor-follow.ts` | autoscroll com stick de 48px | **OK** (simplificado) |
| T11 | Histórico com calendário (dia/hora) + busca + recibo de memória | `tutor-history-view.ts` + servidor (80/disc) | thread Dexie plana (120), sem separadores/busca | **FALTA** |
| T12 | Export da conversa (.md/copiar) | `tutor-chat-export.ts` | inexistente | **FALTA** |
| T13 | Thread cache por material (sobrevive ao fechar) | `tutor-thread-cache.ts` | thread única Dexie + material em foco no composer | **OK** (modelo diferente, sem perda) |
| T14 | Rascunho que sobrevive à navegação | `composer-draft.ts` | input do Sheet desmonta (Sheet do dock) | **PARCIAL/FALTA** |
| T15 | Retrieval do material real (resumo IA + trechos do PDF) | via materialId | **OK** (mesma API server-side, `materialId` enviado) | **OK** |
| T16 | Modo Feynman (avaliação estruturada) | API suporta (`mode:'feynman'`) — UI legada usa? (avaliador disponível) | não usado | **FALTA** |
| T17 | Doutrina: nada pessoal no servidor | legado persiste (por design) | `persist:false` no chat v2 **mas** painel do PDF (quick-panel) aberto do v2 persiste | **PARCIAL** (vazar doutrina — ver §5) |
| T18 | Chip honesto de provedor/IA sem key + probe | `settings-view.tsx` (probe por provedor) | chip IA pronta/sem chave no dock (sem probe na UI) | **OK** (probe ficou só no legado) |

### Estudo/prática
| # | Feature | Legado | V2 | Status |
|---|---|---|---|---|
| E1 | Acervo/biblioteca com filtros e badges | `library-view`, `materials-list` | `tab-materiais.tsx` | **OK** |
| E2 | Leitor PDF + tutor split + busca + captura de página | `pdf-viewer-dialog` (+dialogs) | **reusado integralmente** via "ler" | **OK** |
| E3 | Resumo IA do material + questões ligadas | `material-summary-dialog` | **reusado** (evento open-practice não tem destino v2 → questões ligadas caem no legado) | **PARCIAL** |
| E4 | Player de vídeo (YouTube/Drive/Vimeo) | `video-player-dialog` | materiais vídeo abrem URL externa | **FALTA** |
| E5 | Banco de exercícios + filtros + "mostrar futuros" + ★ | `practice-view` + `exercise-extractor` + `curriculum-state` | unidades FSRS + Trilha (sem ★, sem ocultar futuros — cadeia da Fundação cobre parcialmente) | **PARCIAL** |
| E6 | Modo Revisão guiado (★ + caderno, 1 por vez) | `review-mode-dialog` | TabRevisão (fila FSRS) | **PARCIAL** (sem ★ e sem itens do caderno na mesma fila) |
| E7 | Caderno de erros (agregado + IA por linha + envio integral) | `mistake-notebook*` | `tab-code-review.tsx` (erros de tentativas; **sem erradas de simulado**, sem chips IA, sem envio do caderno ao tutor) | **PARCIAL** |
| E8 | Simulado Pro (timer, navegação, retomada, resultado) | `simulado-view`, `simulado-resume` | inexistente | **FALTA** |
| E9 | Histórico de simulados + tendência + debrief IA | `simulado-history`, `simulado-debrief` | inexistente | **FALTA** |
| E10 | Flashcards Leitner + sessão + IA + import/export | `flashcards-view` | deck FSRS v2 + geração IA (sem import/export, sem editar, sem cartões de erro manuais) | **PARCIAL** |
| E11 | Code Lab (console JS + preview HTML + erro→tutor) | `code-lab.tsx` | kata = questão de texto, sem execução | **FALTA** |
| E12 | Code highlight C/Portugol/HTML no markdown | `code-highlight` + `CodeBlock` | **reusado** (TutorMarkdown é o componente do legado) | **OK** |
| E13 | Pomodoro com continuidade + configs (durações, som, notificação, título da aba) | `study-view` S3 + `settings-view` | `pomodoro.tsx` finish-the-thought (sem config, sem notificação) | **PARCIAL** |
| E14 | Cronograma inteligente (crons: avaliações ≤7d, disciplina parada) | `use-smart-crons` + dashboard | chips de prova no plano/rotina (sem crons/notificações) | **PARCIAL** |
| E15 | Plano do dia com porquê + conteúdo da semana + recuperação | plano fixo da véspera (`math-exam-prep`) | `v2/planner.ts` + `v2/plano.ts` — **v2 supera** (algoritmo vivo) | **OK** (novo) |
| E16 | Rotina fixa que o app não viola (templates, jogo 3/sem, véspera) | blocos de estudo custom + preferências | `tab-rotina` + `content-seed` + guard-rails na repo | **OK** |
| E17 | Diário do dia (check-in/check-out) | inexistente | `v2/diario` — **novo** | **OK** (novo) |
| E18 | Gamificação honesta (XP, ranks, streak anti-punitivo) | KPIs removidos da casa limpa | `v2/xp` + header/perfil (dias30 primário) | **OK** (novo, doutrinado) |
| E19 | Quests/issues/quadro/vagabond | inexistente | `tab-quests` — **novo** | **OK** (novo) |

### Dados/offline/infra
| # | Feature | Legado | V2 | Status |
|---|---|---|---|---|
| D1 | Backup/export/import do progresso | `backup-export`, `backup-guard`, `settings-view` | onboarding (só backup+migração) e Perfil (backup/restore) | **OK** (restore ausente no onboarding — ver R1) |
| D2 | Migração idempotente legado→núcleo | — | `v2/migrate` + `phase1-panel` (prova de idempotência) | **OK** (novo) |
| D3 | Downloads offline (ZIPs) | `downloads-dialog` | SW cache-first de /pdfs/ e /data/ cobre leitura offline; ZIP manual não existe | **PARCIAL** (SW cobre o essencial) |
| D4 | PWA instalável + SW | `pwa.tsx` (global) | mesmo SW global | **OK** (instalar-card visível só no legado) |
| D5 | Command palette (Ctrl+K, busca no acervo) | `command-palette` + `palette-search` | inexistente | **FALTA** |
| D6 | Folhas de papel (folha de revisão / caderno de papel) | `folha-revisao-sheet`, `caderno-papel-sheet` (+rota) | inexistente (e a rota `/folha-revisao` do dashboard legado está **quebrada**) | **FALTA** |
| D7 | Notas reais/avaliações com nota | `study-progress` realGrades | exams no núcleo (semeado), sem UI de lançamento de nota | **PARCIAL** |
| D8 | Kaizen/retro semanal | `study-progress` kaizen | Sprint Review (números) + check-out (voz) | **OK** (novo formato) |
| D9 | Tema claro/escuro | `settings-view`/next-themes | só dark (#0c0c0c) — decisão de design | **PARCIAL** (deliberado) |
| D10 | Score de prontidão de prova | `exam-readiness` | prova próxima + escopo no plano/tutor | **PARCIAL** (abordagem diferente, sem número) |

**Resumo quantitativo**: ~45 linhas auditadas — 20 OK · 14 PARCIAL · 9 FALTA (T9, T11, T12, T16, E4, E8, E9, E11, D5, D6).

---

## 4. Auditoria do servidor de IA (`/api/tutor` + `/api/tutor/history`)

### 4.1 Doutrina — o que está CONFIRMADO
- **Base institucional por chamada**: `buildCourseBaseContext()` é invocada a cada POST (`route.ts:1264`) e montada de `course-data.ts` + `semester.ts` (`tutor-course-base.ts:67-117`): semana letiva, avaliações com data oficial **à frente** (passadas somem), agenda do campus ao vivo. ✔
- **persist:false no v2**: `shouldPersist = body.persist !== false` (`route.ts:1193-1196`); os dois caminhos de gravação (stream `route.ts:1454-1461`, JSON `route.ts:1544-1551`) são gated; v2 (`tab-tutor.tsx`) manda `persist:false` e a thread vive no Dexie (`tutorMessages`, cap 120). ✔
- **Zero dado pessoal lido do servidor**: nada do aluno é buscado no server; `studentContext` (cap 1600) e `hubContext` chegam por chamada e são descartados. ✔
- **Cadeia de chaves**: `GEMINI_API_KEY|GOOGLE_AI_API_KEY` → `OPENROUTER_API_KEY` → `ZAI_API_KEY`, 100% REST (sem SDK), timeout 35s, deadline 55s, `maxDuration 60`. Erro honesto sem key (502 com instrução do dono). ✔
- **História do servidor**: só o legado usa — `saveTurn` (cap 4000/msg, poda TUTOR_HISTORY_KEEP=80 por disciplina) e `api/tutor/history` GET/DELETE (+`after` cirúrgico para E2E). ✔

### 4.2 VIOLAÇÕES / RESSALVAS de doutrina (com arquivo:linha)
1. **Texto institucional CONGELADO no system prompt** — `route.ts:468` "Determinantes e sistemas lineares AINDA NÃO foram dados" é estado do semestre gravado em pedra: envelhece igual ao "vilão silencioso" das datas de prova. O mesmo bloco estático carrega: `route.ts:470` (Questões da Semana 1/2 — conteúdo fechado), `route.ts:471` (monitoria seg/qua 19–21, monitor Everton, link discord.gg/XyTmDhE5Dt), `route.ts:472` ("enviado pelo próprio aluno em 19/09"), `route.ts:473-474` ("aula 06", "aula 07, 24/09"), `route.ts:475` (projeto A1 "peso 45%", equipes fixas), `route.ts:478` ("a 1ª prova cobre as Unidades 1 e 2 → seções Q1–97" — escopo de prova congelado). O t206 removeu as DATAS de provas, mas este bloco "BASE DE CONHECIMENTO DO CONTEÚDO" continua estático e vencerá. Recomendação: mover para fonte computada (`curriculum-state.ts` + course-data) ou para o material real via retrieval.
2. **Vazamento de persist pelo painel do PDF**: `tutor-quick-panel.tsx:495-510` não envia `persist`; como o v2 monta esse painel (`tab-materiais.tsx:233` → `pdf-viewer-dialog.tsx:988`), conversas feitas lendo PDF no app NOVO são gravadas no banco do servidor — contraria "v2 usa persist:false".
3. **Tom**: `route.ts:1426,1531,1535` usam 💪 em mensagens de erro — o próprio prompt (`route.ts:442`) proíbe emojis ("ZERO EMOJIS"); inconsistência menor de casa.
4. **Bug legado conexo**: `dashboard.tsx:256` aponta `/folha-revisao`, rota que não existe em `src/app/` (404) — a folha só é alcançável por outros caminhos, se houver.
- Nota: "Cajazeiras"/"2026.2" aparecem apenas em `tutor-course-base.ts:92-93`, computados de `course-data`/`semester` (fonte única, durável) — **não** é violação.

### 4.3 Env vars / secrets (NOMES apenas — nenhum valor)
| Nome | Papel |
|---|---|
| `GEMINI_API_KEY` | 1º da cadeia (texto + visão nativa) |
| `GOOGLE_AI_API_KEY` | alias aceito para o Gemini |
| `GEMINI_MODEL` | (opcional) fixa o modelo Gemini; default `gemini-flash-lite-latest` → `gemini-flash-latest` |
| `OPENROUTER_API_KEY` | 2º da cadeia (texto + visão em modelos free) |
| `ZAI_API_KEY` | 3º da cadeia (api.z.ai público) |
| `ZAI_BASE_URL` | (opcional) default `https://api.z.ai/api/paas/v4` |
| `ZAI_MODEL` | (opcional) default `glm-4.5-flash` |
| `ZAI_VISION_MODEL` | (opcional) default `glm-4.5v` |
| `DATABASE_URL` | Prisma/SQLite — memória de servidor do tutor (só legado usa) |

### 4.4 Contrato da API usado pelo v2 (`tab-tutor.tsx` → `streamTutorAnswer`)
| Campo | Uso no v2 | Cap no servidor |
|---|---|---|
| `question` | pergunta + bloco "CONTEXTO AO VIVO DO APP" | ≤6000 (cliente usa 5500 + `capQuestion`) |
| `stream:true` | SSE delta/final/error | deadline 55s |
| `discipline` / `topic` | matéria/tópico em foco | — |
| `materialId` | retrieval do PDF/resumo real (+ fallback por pergunta) | — |
| `hintMode` | modo dica | — |
| `history` | últimas 12 do Dexie (corte 2000 no cliente) | 12 msgs × 1500 |
| `hubContext` | `today`, `studentStats` (tópicos, min/semana, fila, exercícios), `nextEvaluations` ≤45d | — |
| `studentContext` | ritmo/semana + consistência/30d + sessão atual | ≤1600 |
| `imageDataUrl` | print/foto (data URL) | `data:image/` ≤8MB; transcrição ≤4000 |
| `persist:false` | nada grava no servidor | — |
| `mode:'flashcards'` | gerador → baralho v2 | 4–6 cartões JSON |
| `mode:'feynman'` | **não usado pelo v2** | avaliação estruturada |

---

## 5. Riscos UX anti-motivacionais no v2

| # | Risco | Evidência | Severidade | Mitigação sugerida |
|---|---|---|---|---|
| R1 | **Onboarding sem restaurar backup** — em máquina nova só existe "migração"; o restore vive escondido no Perfil (dentro do app) | `v2/app.tsx:232-337` vs `tab-perfil.tsx:79-90` | **P0** | Botão "restaurar backup" no PASSO 1 do onboarding |
| R2 | Onboarding em dev-speak ("núcleo", "idempotente", "IndexedDB", "snapshot do legado") para quem nunca migrou nada | `v2/app.tsx:270-333` | P1 | Copy humana: "salvar uma cópia → trazer seus dados → entrar"; detectar legado vazio e oferecer "começar do zero" |
| R3 | **Beco da Trilha**: "converta material do Backlog" → conversão nasce `topicId:null` e NÃO HÁ como adotar em tópico — o ciclo não fecha | `tab-trilha.tsx:151`, `v2/repo.ts:204` | **P1** | Ação "adotar em tópico" na conversão (ou na Trilha) |
| R4 | Leitura com recall abre `/?legacy=1#library` — salta de casa no meio do fluxo | `tab-quests.tsx:281` | P1 | Apontar para a prateleira v2 (material em foco) |
| R5 | Retry do tutor perde o print anexado (erro com imagem vira retry só texto) | `tab-tutor.tsx` (`retryImage: undefined`) | P1 | Guardar o data URL no turno e reenviar |
| R6 | `window.alert`/`window.confirm` (teto de jogo, restaurar, grade padrão) quebram o tom calmo | `tab-rotina.tsx:115,190`, `tab-perfil.tsx:80` | P2 | Toast/inline confirm |
| R7 | Sessão <15min = 0 XP ("a partir de 15 min ela vira XP") — honesto, mas pode doer em dia ruim; o Dia Leve mitiga | `v2/xp.ts:27-30`, `tab-hoje.tsx` msg | P2 | Reconhecer o minuto registrado ("10 min contam para os dias30") |
| R8 | Quest completa não dá XP **nem feedback** — checkbox silencioso (doutrina, mas falta reconhecimento) | `tab-quests.tsx` | P2 | Flash de confirmação/contagem no Sprint (sem XP) |
| R9 | Chip "não trabalhado" âmbar acumula na prateleira (fila de culpa visual) | `tab-materiais.tsx:201` | P2 | Agrupar/limitar ou refrase ("aguardando primeiro toque") |
| R10 | Thread do tutor poda silenciosamente nas 120 mensagens (perda sem aviso) | `tab-tutor.tsx` THREAD_KEEP | P2 | Aviso/honestidade no recibo |
| R11 | Sem notificações (fim de pomodoro, avaliações ≤7d) — o app não fala fora da aba | ausência de `use-smart-crons`/Notification no v2 | P2 | Crons do legado portados com moderação (doutrina anti-ruído) |
| R12 | Rank com gate de acerto pode humilhar iniciante com acerto <60% travado no Trainee | `v2/xp.ts:42-48` | P2 | Copy já é gentil; considerar meta de progresso por esforço também visível |

**O que já está certo (anti-frustração)**: dia leve automático com bateria baixa; "falta um dia não apaga nada" (dias30 primário, streak secundário); fila zerada = "aproveite livre, sem culpa"; pomodoro nunca corta raciocínio; vagabond 0 XP sem cobrança; erros viram re-teste (não punição); chip honesto de IA; cadência 2–4 itens com começo mínimo.

---

## 6. TOP 12 LACUNAS DE PARIDADE (priorizadas)

| # | Prioridade | Lacuna | Origem legado → destino v2 |
|---|---|---|---|
| 1 | **P0** | Simulado Pro completo: prova cronometrada, retomada (F5-safe), resultado/anel, **histórico + tendência + debrief IA** | `simulado-view/simulado-history/simulado-resume/simulado-debrief.ts` → nova superfície v2 (Feed: fila FSRS cobre treino, não prova) |
| 2 | **P0** | Tutor v2: **continuar pós-interrupção** + **retry preservando o print** (o par completo do freio) | `tutor-continue.ts`, `tutor-retry.ts` → `tab-tutor.tsx` |
| 3 | **P0** | Tutor v2: histórico rico — separadores de dia/hora, **busca no fio**, export `.md`/copiar, recibo honesto de memória | `tutor-history-view.ts`, `tutor-chat-export.ts` → `tab-tutor.tsx` |
| 4 | **P0** | **Restaurar backup no onboarding** (dispositivo novo não pode depender do Perfil interno) | `backup.ts restoreBackup` → `v2/app.tsx Onboarding` |
| 5 | **P1** | Quiz "Me testa" estruturado + cards FRENTE:/VERSO detectados no chat (do erro ao cartão) | `tutor-quiz.ts`, `tutor-cards.ts` → `tab-tutor.tsx` |
| 6 | **P1** | Família de capturas no dock do tutor: página do PDF (1 clique), tela+recorte, DOM, lightbox, paste-cleanup | `pdf-print/pdf-page-capture/screen-capture/capture-crop/dom-capture/paste-cleanup/print-lightbox` → `tab-tutor.tsx` |
| 7 | **P1** | Doutrina: dessorear a "BASE DE CONHECIMENTO" estática do `route.ts` (mover p/ fonte computada) + `persist:false` no painel do PDF aberto do v2 | `route.ts:468-478`, `tutor-quick-panel.tsx:495-510` |
| 8 | **P1** | Command palette (Ctrl+K) com busca universal no acervo de exercícios/materiais | `command-palette.tsx`, `palette-search.ts` → v2 app |
| 9 | **P1** | Code Lab: console JS + preview HTML + "erro → tutor" para as unidades kata | `code-lab.tsx` → v2 (kata executável) |
| 10 | **P1** | Trilha adota unidades convertidas (fechar o beco Backlog→Trilha, `topicId:null`) | `v2/repo.ts convertBacklogItem` + `tab-trilha.tsx` |
| 11 | **P2** | Folhas de papel no v2: folha de revisão (**corrigir rota quebrada `/folha-revisao` do legado**) e caderno de papel | `folha-revisao-sheet`, `caderno-papel-sheet` → v2 |
| 12 | **P2** | Crons inteligentes + notificações moderadas (fim de pomodoro, avaliações ≤7d) + config mínima de pomodoro + card "instalar app" no v2 | `use-smart-crons.ts`, `settings-view` → v2 |

---
*Gerado pela Task 1-a (Explore, read-only). Nenhuma linha de código foi modificada. Fontes: leitura direta dos arquivos citados; checagem sintática via `tsc` (18 erros, todos fora de `src/` — pasta `skills/` do sandbox).*

---

## 7. RECALIBRAÇÃO DE CRITÉRIO (diretriz do dono, 10/10/2026 — vale a partir da Run #3)

> "Algumas coisas do outro não precisa trazer de volta, lembre que essa versão deve ser o melhor dos dois mundos, e não dois mundos cheios e poluídos, tudo que quero tão bom quanto é **IA e os conteúdos**, pois são a base do estudo."

Paridade ≠ soma dos dois mundos. As linhas da matriz acima passam a ser classificadas:

### ESSENCIAL-IA (o tutor precisa ser ≥ legado — a base do estudo)
| Item | Origem | Destino v2 |
|---|---|---|
| Capturas no tutor: página do PDF (1 clique), tela+recorte, DOM, paste-cleanup, lightbox | `pdf-page-capture-dialog`, `screen-capture`, `capture-crop`, `dom-capture`, `paste-cleanup`, `print-lightbox` | dock/tab-tutor (T5) |
| Continue pós-interrupção ("palavra de volta") + retry PRESERVANDO o print | `tutor-continue.ts`, `tutor-retry.ts` | `tab-tutor.tsx` (T8/T9, R5) |
| Histórico rico: separadores de dia, busca no fio, export .md/copiar, recibo de memória | `tutor-history-view.ts`, `tutor-chat-export.ts` | `tab-tutor.tsx` (T11/T12) |
| Quiz "Me testa" estruturado + cards FRENTE:/VERSO detectados no chat (do erro ao cartão) | `tutor-quiz.ts`, `tutor-cards.ts` | `tab-tutor.tsx` (T6/T7 recorte) |
| Modo Feynman (avaliação estruturada — API já suporta `mode:'feynman'`) | API | UI mínima v2 (T16) |
| Erro honesto persiste na thread (não só toast efêmero); rascunho do composer sobrevive | — | `tab-tutor.tsx` (T14 + pauta Run#1 item 4) |

### ESSENCIAL-Conteúdos (o material dos professores é a base)
| Item | Origem | Destino v2 |
|---|---|---|
| Resumo IA + questões ligadas com DESTINO no v2 (hoje `open-practice` cai no legado) | `material-summary-dialog` | `tab-materiais.tsx` (E3) |
| Fechar o beco Backlog→Trilha (conversão `topicId:null` sem adoção) | — | `v2/repo.ts` + `tab-trilha.tsx` (#10) |
| Simulado Pro COM RECORTE v2: prova cronometrada sobre conteúdos reais, retomada, resultado, debrief IA — sem herdar 2.570 linhas de UI | `simulado-view/resume/debrief` | nova superfície enxuta (E8/E9, #1) |
| Flashcards: editar cartão, import/export JSON, cartão do erro | `flashcards-view` | deck FSRS v2 (E10 recorte) |
| Player de vídeo dos materiais (YouTube/Drive/Vimeo) ENXUTO | `video-player-dialog` | `tab-materiais.tsx` (E4) |

### BASE-infra (habilita IA+Conteúdos em qualquer dispositivo)
| Item | Destino |
|---|---|
| Restaurar backup NO onboarding (R1) | `v2/app.tsx` |
| Card "instalar app" (PWA) no v2 (D4) | Perfil/onboarding |

### VALOR (só se não poluir — nada aqui é a base)
E5/E6 recortes (★ e fila guiada) · D7 lançamento de nota · E13 config mínima de pomodoro · D10 prontidão com número · E14 crons em versão silenciosa · D5 command palette · E11 Code Lab · D6 folhas de papel · D3 ZIP.

### DESCARTE CONSCIENTE (NÃO voltar — poluição ou conteúdo congelado)
- `prof-audio-map.ts` (538 linhas): mapa de áudio da Av1 **que já passou** — exatamente o tipo de artefato que envelhece ("vilão silencioso").
- Superfícies inteiras duplicadas: o v2 REUSA `PdfViewerDialog`, `MaterialSummaryDialog`, `TutorMarkdown/CodeBlock` — padrão correto; nunca copiar o componente, reusar.
- KPIs removidos da casa limpa t180, notificações ruidosas, config de Pomodoro completa (a filosofia finish-the-thought é deliberada).

**Regra prática de port**: antes de trazer algo do legado perguntar — "isso serve para o tutor ler/ensinar melhor o conteúdo do professor, ou para o aluno dominar o material?" Se não, é VALOR (só com recorte e sem inflar os 3 destinos + dock) ou DESCARTE.
