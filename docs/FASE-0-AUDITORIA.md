# FASE 0 — AUDITORIA COMPLETA (somente leitura) · Hub Estudos IFPB → "O Projeto Principal"

> Data: rodada Task 198 · Nenhum arquivo de aplicação foi apagado, renomeado ou movido.
> Método: leitura de código, inventário read-only do SQLite (bun:sqlite), grep de chaves de estado,
> inventário por agente de leitura (Task 198-a, registrado em worklog.md), medição de volumes.

---

## 1. Stack atual

| Camada | O que é |
|---|---|
| Framework | Next.js 16.1.x (App Router) + React 19 + TypeScript 5, bun, Turbopack (dev :3000), build standalone (Vercel) |
| UI | Tailwind CSS 4 + shadcn/ui (New York, 48 componentes) + Lucide + framer-motion + recharts |
| Dados | Prisma 6 + SQLite (`db/custom.db`) — usado APENAS pela memória do tutor (`TutorMessage`, cap 80 msgs/disciplina). Banco hoje com **0 linhas** |
| Estado do aluno | **localStorage** — megachave `hub-estudos-ifpb:v2` (único escritor: `lib/study-progress.ts`, 1.454 l.) + 8 chaves satélites. **Zero IndexedDB** |
| PWA | Instalável (`manifest.webmanifest`, `sw.js`, ícones) — mas o SW é network-first só da shell (fallback offline de navegação). **Não é offline-first** |
| IA | `/api/tutor` — chat SSE com cadeia Gemini → OpenRouter → Z.ai SDK, modos tutor/flashcards/feynman, visão p/ prints, RAG leve dos materiais (`material-retrieval.ts`), persistência Prisma |
| Git | branch `main` @ `c902ad7` (t170) com **6 arquivos não commitados** (summaries/material-texts de fundamentos+algoritmos, favicon, use-now.ts) |

**Dependências-alvo ausentes hoje:** `ts-fsrs` (não instalado), `Dexie`/IndexedDB (não usado), cache offline de conteúdo no SW.

---

## 2. Inventário completo dos dados (formato · volume · estrutura)

### A. Conteúdo curricular hardcodado em código (fonte de verdade atual)
| Onde | O quê | Estrutura |
|---|---|---|
| `src/data/course-data.ts` (1.116 l.) | **7 disciplinas** (código IFPB, professor, CH, prioridade, cor, `gradeComponents` c/ pesos — ex. Av1 33,3%), **55 materiais** (tipo, pdfPath, summaryFile, tópicos cobertos), **15 calendarEvents** (2026), links, estratégias, períodos | arrays TS tipados |
| `src/lib/exercise-extractor.ts` (1.227 l.) | **98 exercícios com enunciado completo** + fonte + dificuldade + unidade + gates (59 Alg, 18 Mat, 8 LM, 5 Fund, 3 RHT, 3 Ing, 2 Port) | array TS |
| `src/lib/curriculum.ts` (269 l.) | Grade oficial ADS + `CURRENT_PERIOD=1` + turma 2026.2 | array TS |
| `src/lib/semester.ts` (250 l.) | Calendário 2026.2: 24/08/2026 → 04/02/2027, 19 semanas, pausa 18/12→18/01 | constantes |
| `src/lib/math-exam-prep.ts` (1.701 l.) | Campanha Av1 Matemática (TEC.1984, 01/10/2026, escopo Matrizes+Lógica, listas 35Q+18Q, simulado 29/09): plano D-7→D-0, **11 fórmulas LaTeX, 14 flashcards, kit, checklists, briefs** — **~15 exports hoje órfãos** (UI removida; consomem só `tutor-context.ts` e `/api/audit`) | constantes |

### B. Arquivos estáticos (`public/`)
| Pasta | Volume | Papel |
|---|---|---|
| `pdfs/` | **16 MB · 38 arquivos** (36 PDF, 2 JPG, 1 HTML) | materiais reais (slides, listas, ementas-impressas, regulamentos, PNAAT) |
| `data/material-texts/` | 44 txt · 516 KB | texto extraído p/ busca e RAG do tutor |
| `data/ai-summaries/` | 57 json · 332 KB | resumos IA por material (**4 arquivos `.bak` = sujeira**) |
| `data/ementas/` | 6 PDF · 308 KB | ementas oficiais |

### C. Estado do usuário (localStorage do navegador — não visível deste servidor)
| Chave | Dono | Conteúdo |
|---|---|---|
| `hub-estudos-ifpb:v2` | `study-progress.ts` (único escritor) | materialProgress, completedMaterials, recentMaterials, disciplineProgress, topicProgress, **exerciseProgress (tried/solved/lapses/★)**, **flashcards Leitner (caixas 0–5)**, simuladoRuns, pomodoroState+sessions, customStudyBlocks, scheduleDone, gradeNotes, **realGrades** (ex. `TEC.1984-Av1`), customEvaluations, notebookRevised, preferences |
| `hub-estudos-ifpb:simulado-inprogress` | `simulado-resume.ts` | simulado parcial (config, índice, respostas, tempo) |
| `hub:pdf-pos:<materialId>` | `pdf-position.ts` | última página lida |
| `hub:pdf-split` / `-pct` / `-hint` | `pdf-viewer-dialog.tsx` | modo split do leitor |
| `hub:praticar:soEmSala` | `practice-view.tsx` | filtro material-first |
| `hub:math-exam:v1:plan` / `:travadas` | **sem escritor** (órfãs) | resquícios da campanha Av1 |

### D. Banco SQLite (`db/custom.db`, 40 KB)
`User` 0 · `Post` 0 · `TutorMessage` 0 (User/Post são boilerplate do template — mortos).

---

## 3. Classificação de componentes (REAPROVEITAR / ADAPTAR / DESCARTAR)

### REAPROVEITAR (base sólida — entra como está ou quase)
- **Shell/navegação**: `page.tsx` (3 abas por hash), `sidebar-nav`, `header`, `command-palette` (Ctrl+K), `footer`, `back-to-top`, `theme-provider`, `pwa`
- **Biblioteca de PDFs** (o coração dos conteúdos): `pdf-viewer-dialog` (876 l., split c/ tutor), `pdf-search-dialog`, `pdf-page-capture-dialog`, `capture-crop-dialog`, `print-lightbox-dialog`, `downloads-dialog`, `video-player-dialog`, `materials-list`, `library-view`, `disciplines-view`, `discipline-card`, `discipline-detail-dialog`
- **Tutor**: `study-view` (núcleo do chat), `tutor-markdown` (KaTeX), `code-block`, `chat-code`, libs `tutor-stream/tutor-image/screen-capture/paste-cleanup/pdf-search/material-retrieval/db`
- **Utilidades**: `code-lab` (console JS), `code-highlight`, `hub-events`, `use-local-storage`, `utils`

### ADAPTAR (conceito certo, motor trocado)
- `practice-view` + `exercise-extractor` → **motor de unidades de prática** (questão)
- `flashcards-view` (Leitner 0–5) → **cartões FSRS** (`ts-fsrs`)
- `mistake-notebook` (+lib) → **Code Review / error log** (categoria + "por que errei" a pedir no 1º erro pós-migração)
- `simulado-view` → **Deploy/Boss** (prova c/ cronômetro, debrief)
- `material-summary-dialog` → **conversão assistida** do Backlog (resumo IA → unidade)
- `weekly-coach.ts` (órfã, 144 l.) → **Sprint Review**
- `caderno-papel` + `tutor-image` → **Modo Quadro** (resolver à mão, foto no tópico)
- Pomodoro (`study-view`) → **sessões = commits (XP c/ guard-rail ≥15 min)**
- `study-progress.ts` → reescrito como **store por domínio (Dexie/IndexedDB)**; megachave aposentada
- `semester.ts` + `calendarEvents` → calendário-base + **datas de deploy**
- `/api/tutor` → prompt reescrito: contexto vira "frentes Ritmo/Fundação + tópicos fracos" (fora o plano P0–P5 congelado)
- `tutor-quick-panel` → **fundir com `study-view`** (hoje duplica o chat — 1.095 l. de paralelo)

### DESCARTAR (com motivo)
| Item | Motivo |
|---|---|
| `lib/grade-calc.ts` (142 l.) | órfã, zero importers |
| `lib/smart-schedule.ts` (388 l.) | órfã; gerador do tipo de plano manual que envelhece mal (o "defasável" que você odiou) |
| Prompt do tutor l. 443: "MODO RECUPERAÇÃO (24/09)… P0→P5… RHT ADIADO até 02/10" | **dados de Setembro congelados dentro do prompt de hoje** — o algoritmo novo alimenta isso dinamicamente |
| Fóssil `discipline-detail-dialog.tsx:639`: "aba Calculadora de Médias" | a aba não existe mais |
| `realGrades`/`gradeNotes`/`customEvaluations` sem UI | estado sem superfície (a Calculadora foi removida) |
| Chaves `hub:math-exam:v1:*` | sem escritor |
| Models `User`/`Post` no schema | boilerplate do template |
| ~27 componentes shadcn sem uso + `hooks/use-toast`/`toaster` | app usa sonner; lixo de kit |
| 4 `.bak` em `ai-summaries/` | sujeira |
| ~30 scripts E2E antigos (t84–t138) + ~440 screenshots QA em `scripts/` | testam UI que não existe mais |
| Shortcuts do manifest (`/?tab=cronograma`) | apontam para tab inexistente |
| **~15 exports órfãos da campanha Av1** (plano D-7→D-0 como UI, CTAs de calculadora, briefs de superfícies mortas) | dados migram (fórmulas/flashcards/kit → unidades e cards); **a superfície de tracking morre** |

---

## 4. Mapeamento: cada dado atual → nova arquitetura (NENHUM material descartado)

| Dado atual | Destino na nova arquitetura |
|---|---|
| 7 disciplinas (course-data) | `Subject` (código, professor, CH, cor, importância p/ score da Fundação) |
| 24 unidades de conteúdo programático | `Topic` + arestas de **pré-requisito** (ordem do PPC semeia o grafo; curadoria na Fase 4) |
| 55 materiais (+ PDFs/textos/ementas em `public/`) | `Source` (arquivos ficam estáticos; metadados migram) + **1+ item do Backlog** c/ tipo sugerido (conceito→questão, exercício→kata/quadro) |
| 57 resumos IA | insumo da **conversão assistida** do Backlog |
| **98 exercícios estruturados** | **conversão automática em unidades de prática (questão)** — a dívida de conversão já nasce quase zerada p/ questões |
| Campanha Av1 (fórmulas, 14 flashcards, kit, listas 35Q+18Q) | unidades de prática + cards FSRS; **o plano D-7→D-0 e status "travadas" morrem** (sensação ≠ desempenho) |
| Flashcards Leitner (localStorage) | cartões FSRS (caixa → estabilidade inicial) |
| exerciseProgress (tried/solved/lapses) | tentativas semeadas: **acurária → domínio inicial 0–100** (sem timestamps → estado inicial, nunca histórico falso) |
| simuladoRuns | sessões tipo **deploy** (histórico de provas) |
| Caderno de erros | **error log** (erros antigos: "não classificado"; novos exigem 1 frase do porquê + categoria) |
| Pomodoro sessions | **sessões = commits** (XP só ≥15 min) |
| realGrades | resultado de deploy (Av1: "aguardando nota" — sem UI de cobrança) |
| 15 calendarEvents + semester.ts | calendário do semestre + **datas de deploy** (3 semanas antes o plano se reorganiza) |
| `TutorMessage` (SQLite) | fica no servidor — memória do tutor, fora do domínio de estudo |
| PDFs/textos/sumários/ementas | ficam estáticos em `public/` (cache offline entra no SW na Fase 5) |
| O que morre sem substituto: fila P0–P5, plano de recuperação manual, minutos estimados, contador 0/14 | substituídos pelo **algoritmo Ritmo/Fundação** (FSRS + score de degrau) e pelo **Backlog** |

---

## 5. Lacunas p/ o stack alvo
1. **IndexedDB**: nada hoje; localStorage é ponto único de perda e sem export fácil → Fase 1 entrega Dexie + export/import JSON.
2. **ts-fsrs**: não instalado → Fase 1 (núcleo) / Fase 2 (uso).
3. **Offline real**: SW atual só cacheia a shell → Fase 5: cache-first p/ `/pdfs/`, `/data/` (estudo offline com PDFs).
4. **Tema dark IDE** (mono, verde/roxo): hoje light/dark shadcn padrão → Fase 5 (ou antes, se você quiser).

## 6. Riscos
- **O único progresso real está no localStorage do SEU navegador** — o backup (Fase 1, primeiro ato) precisa de um clique seu (snippet de export) além do backup de arquivos do repo.
- Working tree sujo (6 arquivos) → commit na `main` antes de abrir `rebuild/v2`.
- Monolitos (study-view 2.941, simulado 2.197, study-progress 1.454) → split progressivo por fase, nunca big-bang.
- FSRS semeado sem timestamps → domínio inicial aproximado (honesto, marcado como "semeado").

## 7. Plano de refatoração em etapas curtas (checkpoint "posso seguir?" em cada uma)
- **Fase 1 — Alicerce (nada muda no que você usa)**: commit limpo + branch `rebuild/v2` · backup completo (JSON do estado + db + `public/data`) · núcleo novo (Subject/Topic/Unit/Attempt/Session/ErrorLog/BacklogItem/Routine/Quest) em Dexie + ts-fsrs · **script de migração idempotente** (upsert por chave natural — rodar 2x não duplica) · modo legacy (main continua em produção e alimentável; tudo novo atrás de toggle até o cutover). *Teste: backup baixado; migração roda 2x c/ contagens idênticas; app antigo 100%.*
- **Fase 2 — Hoje + FSRS**: aba Hoje dentro dos blocos fixos da rotina (05:00→22h, descanso protegido 13:30–14:30 intocável), toggle do tipo de dia, interleaving 2–3 tópicos/bloco, botões **Acertei/Errei/Não tentei**, timer, 1 frase de porquê por sugestão; FSRS sobre dados migrados. *Teste: um dia real de registro.*
- **Fase 3 — Backlog + Code Review**: backlog já populado pela migração (98 questões convertidas + cru), conversão assistida 5/dia, error log vivo.
- **Fase 4 — Trilha + Rotina**: grafo de prereqs, domínio 0–100 (≥80% nas últimas 5 ou FSRS estável = destravado), destravamentos comemorados, grade semanal editável, véspera de prova bloqueia jogo e reorganiza o plano 3 semanas antes.
- **Fase 5 — Quests + Ranks + Sprint Review + offline + cutover**: quests diárias/semanais, Modo Quadro (foto no tópico), leitura técnica c/ recall, slot de projeto real, Modo Vagabond (0 XP), ranks Trainee→Arquiteto c/ critério de domínio, relatório semanal (recharts), SW offline p/ PDFs, aposentar legacy.

## 8. Conformidade com a "casa limpa" (pedido anterior)
- A home **já está limpa**: 3 abas (Conteúdos · Tutor IA · Praticar) — o aparato de tracking (Plano de Recuperação, Fila de prioridades, cards do dia, 0/14) já saiu da UI em rodada anterior.
- Sujeiras restantes estão catalogadas na seção 3 (DESCARTAR) — **nada foi mexido agora** (Fase 0 = somente leitura).
