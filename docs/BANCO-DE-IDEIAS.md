# BANCO DE IDEIAS — a casa que se adapta

> Criado 12/10/2026 (Task 204). Versão durável: este arquivo vive no git porque o
> worklog local já se perdeu 2× em resets da sandbox (o banco anterior, registrado
> na sessão de 11/10, sumiu com o reset — foi reconstruído daqui em diante a partir
> dos commits, do worklog arquivado e da memória da casa).

## A ideia-mãe (do dono, 11/10/2026)

> "com aquele tempo que a gente escolhe quando loga, tudo no site deve ficar
> adaptado para aquele tempo — cronograma, pomodoro e etc — funcionando em
> perfeita harmonia, direcionando ao melhor estudo, melhores resultados, melhor
> organização — pois como tem acesso aos materiais consegue fazer isso perfeitamente"

**Veredito: implementada e aprovada em E2E.** A SESSÃO SINTONIZADA (commit
`c7dd1f3`) faz do check-in de horas o regente da casa: fila inteligente cortada
no orçamento, pomodoro reencaixado com volta, FECHO garantido, modo micro,
re-flow instantâneo −30/+30.

## As 3 dimensões que esta linha de ideias serve

| Dimensão | O que significa aqui |
|---|---|
| **Produtividade** | Menos decisão, mais estudo: a casa corta, escolhe e fecha a conta por você. |
| **Inteligência** | Cada sugestão nasce dos SEUS dados (histórico real, materiais, provas) — nada de regra arbitrária. |
| **Integração** | Um cérebro só: a mesma fila (`buildDayPlan`), o mesmo progresso (`StudyProgress`), o mesmo relox — zero módulos rivais. |

## O banco (ordem de valor real, avaliado nas 3 dimensões)

### ✅ 1. Sessão Sintonizada — FEITA (c7dd1f3)
Orçamento do dia vira plano único + pomodoro sincronizado + fecho. **P: alta · I: alta · Int: alta.**

### ✅ 2. Lembrete PNAAT — FEITA (c3d744d)
Curso externo (FIT Tecnologia) lembrado na home com "Estudei hoje" persistente.
**P: média · I: média · Int: média** (a casa não replica o que vive fora dela).

### ▶ 3. Orçamento que aprende — **ESTA RODADA**
O check-in sugere o orçamento usando a MEDIANA dos seus últimos 14 dias logados
(snap nos chips da casa) + reforço honesto quando há prova ≤3 dias. Sem história
suficiente, a casa confessa "não sei ainda" e não sugere nada.
**P: alta (a pergunta "quanto tenho?" vira 1 toque) · I: alta (aprende com você,
não com tabela) · Int: alta (alimenta a Sessão, o pomodoro e o fecho de uma vez).**

### 4. Radar do Agora
Faixa viva na home: onde você está no dia ("agora: Bloco 2 · faltam ~40min ·
próximo: lanche"). Depende de grade de rotina na casa — hoje a casa tem a sessão,
a agenda oficial e o relógio, não a grade pessoal (doutrina "nada pessoal no
código" — a grade entra como dado do usuário).
**P: média · I: média · Int: alta · esforço: médio.**

### ▶ 5. Véspera Adaptativa — **FILA FEITA (Task 27)**
Prova ≤7 dias: a fila da sessão pesa os tópicos da prova ✓ (Task 27: a régua
agora é D-21 acende · D-7 pesa · D-3 manda, com selo D-N na fila e o radar
explicando na home). FALTA: o tutor ganha quick-action "escopo da prova", a
folha impressa sai em versão véspera. O calendário de provas JÁ existe
(`nextExam` + intel de materiais).
**P: alta · I: alta · Int: alta · esforço: médio.**

### ✅ 6. Fecho Interativo — FEITA (4879b63, Task 206)
O bloco FECHO virou painel de 3 gestos: erros → cartões (contagem ao vivo),
listas de hoje com o que falta, e o 1º passo de amanhã gravado de verdade —
a home do dia seguinte abre nele. O fecho agora existe TAMBÉM na sessão
cumprida (antes sumia quando o dia virava espelho) e a casa abre nele
sozinha. Descoberta E2E: apagar estado no mesmo clique que abre o leitor
corre a corrida do write completo entre instâncias do hook — abrir não
apaga; o passo expira sozinho.
**P: alta (o ritual final executa, não decora) · I: média (conta do dado real) · Int: alta (fecho → home do amanhã → fila).**

### ✅ 11. Revisão sob Comando — FEITA (Task 27, pedido do dono)
"Poder ativar se quer estudar/revisar assuntos antigos ou não — fica um
cronograma mais direcionado ao que o usuário quer." O toggle vive em 3 casas
(plano, sessão, configurações), escreve `preferences.includeReviews` e a fila
reflui no mesmo render: desligada, os slots da revisão caem para
atrasados/próximos — a fila nunca esvazia, ela reorienta.
**P: alta (o cronograma obedece ao dono, não a um ciclo fixo) · I: média (comando explícito vence heurística) · Int: alta (mesma preferência em plano + sessão + settings).**

### ✅ 12. Fila com Pressão de Prova — FEITA (Task 27, mesmo pedido)
"Só matemática fez prova, o restante vem ainda esse mês... dá pra priorizar
as que vão trabalhar com prova." A régua: D-21 acende, D-7 pesa, D-3 manda —
só DATA OFICIAL (anti-estimativa); prova feita sai da fila sozinha (a Av1 de
Matemática já saiu). O Radar de provas na home espelha o semestre (feitas /
agendadas D-N / a definir) e explica o porquê da fila.
**P: alta (a fila mira o que vale nota agora) · I: alta (pressão = dado real de evaluationPeriods) · Int: alta (radar + fila + sessão + porquês = um cérebro só).**

### ✅ 15. A Escadinha — FEITA (Task 210, 13/10/2026)
A ideia do dono, palavra por palavra: *"em algoritmos a depender do assunto
pode ser bom iniciar da base pois é uma escadinha né"*. A fila agora tem
DEGRAUS explícitos (`LADDER` em material-curation.ts): um material nunca é
oferecido antes da base pendente dele — a base toma o lugar na frente, o
porquê explica o degrau ("escadinha: é a base de …"), e concluiu a base? a
escada some sozinha e o material novo volta a ser o próximo natural. Os dois
primeiros degraus reais: **S6 (aninhamento) apoia-se na S5 (laço simples)** e
a **lista de determinantes apoia-se na teoria da mesma aula**. O badge
violeta "escadinha · base: …" no acervo mostra o apoio caso a caso.
**P: alta (começar da base evita a despenca que custa 1h de tentativa) · I: alta (o apoio é registrado caso a caso, não por regra cega de disciplina) · Int: alta (a fila, o acervo e o porquê contam a mesma história).**

### ▶ 15b. Escadinha Guiada — a fila FEITA, falta o gesto
O degrau já reordena a fila e o badge explica. O próximo gesto natural: no
LEITOR do material de degrau-alto (S6, det-lista), um lembrete com 1 clique —
"travei? desça um degrau: abrir a S5" (usa `ladderPrevMaterial`, já existe).
**P: média · I: alta (a escada reage ao TRAVAR, não só ao planejar) · Int: alta · esforço: baixo.**

### 13. Nota que Cobra
A calculadora já sabe a matemática da média; a fila ainda não. Disciplina
onde a nota pede "X pontos na próxima avaliação" ganha prioridade extra na
fila (o risco vira régua). Usa `realGrades` + `customEvaluations` que já
existem — falta costurar na fila.
**P: alta · I: alta (a nota real é o dado mais honesto que existe) · Int: alta · esforço: médio.**

### 14. Atividade que Vale Nota
O dono marcou: "RHT já fez atividade que vale como nota". Atividades sem
data oficial (o caso do RHT) hoje não pesam em lugar nenhum. Idéia: o dono
marca a atividade como "pendente/feita" e a fila a trata como prazo — o
 radar a exibe como linha própria. Doutrina: nada pessoal no código, o
marcação entra como dado do usuário.
**Avanço (Task 210): a atividade individual de LM (site pessoal em HTML puro,
VALE NOTA) entrou no acervo como PRÁTICA com nota de curadoria própria — a
fila já a oferece como a entrega real de LM. Falta o estado pendente/feita.**
**P: média · I: média · Int: alta · esforço: baixo-médio.**

### 7. Leitor com Meta
No leitor: "este material ≈ 35min — cabe na sua sessão (sobram 1h20)" + ponto de
parada sugerido por seção. Estimativa honesta por páginas lidas do histórico.
**P: média · I: média · Int: alta · esforço: médio.**

### 8. Pausa com Prova do 9
Na pausa do pomodoro, 1 cartão de recall de 2min (opt-out, nunca obrigatório).
**P: média · I: média · Int: média · esforço: baixo.**

### 9. Semana que Aprende
Relatório semanal que PROPÕE o orçamento padrão da próxima semana a partir da
média real (não da meta) — fecha o ciclo aprendizado → plano.
**P: média · I: alta · Int: média · esforço: médio.**

### 10. Tutor que herda a sessão
O tutor recebe o contexto da sessão viva automaticamente (bloco atual, material,
página onde parou) — a pergunta já nasce contextualizada. O `studentContext`
existe; falta costurar o ESTADO da sessão nele.
**P: alta · I: alta · Int: alta · esforço: médio.**

## Em fila histórica (do worklog, P2)
- Sincronizar a página do iframe com o tutor (precisa pdf.js contínuo).
- "Onde posso capturar?" unificado na paleta de comandos.

## Congelados (NUNCA desenvolver — doutrina do dono)
Simulado novo · teste de chaves IA · backup · instalar app.

## A resposta curta à pergunta do dono (12/10/2026)

*"Essas ideias vão aumentar a produtividade, inteligência e integração do site?"*

**Sim — e é medível.** Cada ideia do banco nasce do mesmo dado (o que você já
faz: horas logadas, focos, erros, provas), devolve a decisão em 1 toque e
alimenta o mesmo motor. A soma delas não é uma lista de recursos: é UMA casa
que aprende o seu ritmo e conduz o dia — o resultado que a ideia-mãe pediu.

## A Pauta de 20 (13/10/2026 — AGUARDANDO O OLHO DO DONO)

O dono pediu: *"pense em 20 ideias indispensáveis para o projeto e eu vou
revisar e ver o que passa — caso não tenha 20, seja realista falando que é
desnecessário tantas coisas"*.

**A resposta honesta da casa: o cérebro essencial já existe.** Fila conduzida
pela prova, escadinha, sessão sintonizada, fecho que executa, FSRS, tutor com
contexto — o motor gira. O que falta é o conteúdo virar RESULTADO de forma
fechada. Por isso a pauta tem 20 candidatos mas **3 camadas, e não preciso
fingir que as 20 são indispensáveis: as 10 primeiras sim; as 6 seguintes
são fortes; as 4 últimas são extras**. Sem todas, a casa continua de pé.

| # | Camada | Ideia | O que muda na casa (1 frase) | P · I · Int | Esforço |
|---|---|---|---|---|---|
| 1 | **A** | Ciclo do Erro | Todo erro registrado no Code Review vira tarefa de revisão na fila, no tópico que o gerou — a prova nasce dos seus erros. | alta · alta · alta | médio |
| 2 | **A** | Mapa de Domínio | Domínio% por tópico, calculado de sinais reais (materiais concluídos, erros, cartões FSRS, questões), vira mapa de calor na home e régua da fila (reestudar vs. subir o degrau). | média · alta · alta | médio |
| 3 | **A** | Revisão com Pressão de Prova | Quando a prova é D-7, os cartões FSRS dos tópicos dela sobem na fila da Revisão — hoje o FSRS e a prova vivem em abas separadas. | média · alta · alta | baixo |
| 4 | **A** | Nota que Cobra (banco #13) | A nota real (o que a média exige) vira régua extra na fila — o risco de reprovação pesa como prova. | alta · alta · alta | médio |
| 5 | **A** | Entrega Contada (fecha o #14) | Atividade que vale nota com estado pendente/feita, linha própria no radar e checklist de requisitos (LM: 4 páginas, HTML puro, W3C válido). | média · média · alta | baixo-médio |
| 6 | **A** | Kit de Véspera (fecha o #5) | Quick-action "escopo da prova" no tutor + folha de 1 página imprimível por prova: fórmulas, P1–P14, escopo, MEUS erros comuns. | alta · alta · alta | médio |
| 7 | **A** | Tutor que Herda a Sessão (banco #10) | A pergunta já nasce contextualizada: bloco atual, material aberto, página onde parou — `studentContext` existe, falta costurar o estado da sessão. | alta · alta · alta | médio |
| 8 | **A** | Escadinha Guiada (banco #15b) | No leitor de um degrau-alto (S6, det-lista): "travei? desce um degrau → abrir a S5" com 1 clique (`ladderPrevMaterial` já existe). | média · alta · alta | baixo |
| 9 | **A** | Prova Branca | Antes de cada prova: recall livre em página em branco ("escreva tudo que lembra"), autocorrigido contra os conceitos-chave do resumo IA — a prática de recuperação mais forte que existe. | alta · alta · média | médio |
| 10 | **A** | Semana que Aprende (banco #9) | Relatório semanal que PROPÕE o orçamento da próxima semana pela média REAL (não pela meta) — fecha o ciclo aprender → planejar. | média · alta · média | médio |
| 11 | B | Radar do Agora (banco #4) | Faixa viva na home: "agora: Bloco 2 · faltam ~40min · próximo: lanche" (a grade pessoal entra como dado do usuário — doutrina). | média · média · alta | médio |
| 12 | B | Leitor com Meta (banco #7) | No leitor: "este material ≈ 35min — cabem na sua sessão (sobram 1h20)" + ponto de parada sugerido. | média · média · alta | médio |
| 13 | B | Pausa com Prova do 9 (banco #8) | Na pausa do pomodoro, 1 cartão de recall de 2min (opt-out, nunca obrigatório). | média · média · média | baixo |
| 14 | B | Contrato Semanal | Meta da semana derivada da pressão de prova, assinada em 1 toque, com barra de progresso na home — compromisso visível. | média · média · alta | baixo |
| 15 | B | Retomada sem Culpa | Voltou depois de dias fora? A casa oferece re-plano em 1 toque e o que ficou para trás vai pro backlog com etiqueta honesta — recomeço sem peso. | alta · média · alta | médio |
| 16 | C | Idade do Material | Badge "visto há X dias / nunca visto" no acervo — a escolha de reestudar fica óbvia. | baixa · média · média | baixo |
| 17 | C | Cura da Rotina | A sessão avisa quando encosta no fim do bloco da grade (janta 19:15, dormir 22h) — usa a rotina que já mora na casa. | baixa · baixa · alta | baixo |
| 18 | C | Aviso PWA leve | Notificação D-3 de prova / sessão não iniciada (sem "instalar app" — respeito ao congelado). | média · média · baixa | médio |
| 19 | C | Fecho que Compara | No fecho: "planejado 3h · feito 2h40" + 1 pergunta opcional "por quê?" — alimenta a Semana que Aprende. | baixa · média · alta | baixo |
| 20 | C | Pergunta do Dia | 1 recall diário escolhido pelo tópico mais frágil da prova mais próxima (usa os cartões FSRS que já existem; NÃO é simulado — respeito ao congelado). | média · alta · alta | baixo |

**Veredito honesto, pedido pelo dono:** não são 20 indispensáveis — são
**10 indispensáveis + 6 fortes + 4 extras**. As camadas B e C poliriam a
experiência, mas a casa funciona sem elas. As 10 da camada A fecham o único
ciclo que ainda está aberto: **erro → domínio → fila → prova → resultado**.

**Ordem de execução proposta (se aprovado):** 3 → 8 → 13 (baratos que fecham
o cérebro) → 1 → 5 → 6 → 7 → 9 → 4 → 2 → 10, depois B e C conforme o apetite.

**STATUS: AGUARDANDO REVISÃO — ✅ REVISADO (13/10/2026, mesma sessão).**

## A Escolha do dono (13/10/2026) — o funil fechou

O dono respondeu: *"agora separa só os melhores e que valem entrar de verdade
sendo os mais valiosos"*. O funil: **20 → 6 + 1 bônus**. É a ESSENÇIA — o que
fecha o ciclo **erro → domínio → fila → prova → resultado** sem inflar a casa:

| # | Ideia | Estado |
|---|---|---|
| **3** | Revisão com Pressão de Prova | ✅ **FEITA (Task 212)** — nos DOIS mundos: a fila FSRS do núcleo (v2) sobe os tópicos da prova D-7 com etiqueta violeta "prova de …", e a casa REAL (`study-plan.ts`) agora ordena os blocos de revisão espaçada pela pressão de prova (mesma régua D-21/D-7/D-3) com o porquê na fila |
| **8** | Escadinha Guiada | ✅ **FEITA (Task 212)** — o leitor de um degrau-alto mostra a faixa violeta "travei? desça um degrau" com o porquê e o botão "abrir a base: …" (1 clique troca o material no próprio diálogo). Verificado E2E: det-lista → det-teoria. Wired em TODOS os leitores: home (dashboard), Tutor IA (study-view), Biblioteca, diálogo de disciplina e o acervo do v2 |
| **13** | Pausa com Prova do 9 | ✅ **FEITA (Task 212)** — na pausa REAL do motor de foco (correndo OU "em espera" — descoberta do E2E: "pular fase" deixa a pausa pausada), 1 cartão de recall de 2min, opt-out ("pular"), SEM write/XP (o avanço de verdade é na Revisão/Flashcards). A prova manda no aquecimento. Existe no companheiro da casa (hub) e no pomodoro do núcleo (v2) |
| **1** | Ciclo do Erro | ✅ **FEITA (Task 213-b)** — o erro registrado no Code Review vira o bloco "Reestudar" na fila do dia (plano E sessão), no tópico que o gerou e com o porquê citando o erro real ("seu erro em …: \"…\""); o clique abre o re-teste da questão exata no Praticar e o item sai sozinho quando o Code Review domina (2 acertos de cabeça) — o reincidente atualiza a tarefa, nunca duplica |
| **9** | Prova Branca | na fila — recall livre autocorrigido contra o resumo IA |
| **6** | Kit de Véspera | na fila — escopo da prova + folha de 1 página |
| **2** | Mapa de Domínio | na fila — o backbone de inteligência (domínio% por tópico) |

**Os outros 14 ficam de fora** (as camadas B e C inteiras + 4, 5, 7, 10):
realismo pedido pelo dono — a casa funciona melhor sem eles do que inflada com
eles. Se um dia um deles doer a falta, o dono chama pelo número.

**Achado da rodada (doutrina):** a casa é o HUB em `/` (decisão do dono
10/10/2026) — o núcleo v2 é console técnico em `/?v2` SEM porta de entrada.
Toda ideia nova nasce no hub primeiro; o v2 acompanha quando o mecanismo é do
núcleo (FSRS, pomodoro).

## O gás do dono + Plano Google AI Plus (13/10/2026)

O dono: *"Estou a fim de dar um gás e começar com tudo, e nada melhor do que
pegar essa promoção e extrair o máximo dela em nosso site"* — Google AI Plus,
**12 meses grátis** (depois R$24,99/mês): 400 GB, NotebookLM com Resumos em
Áudio/Vídeo e Testes (até 200 páginas), Gemini Flash com limites 2x, Nano
Banana, Flow, Gemini no Gmail.

**A pergunta do dono: "posso assinar e cancelar para não ter perigo de renovar
ou isso cancela o período gratuito?"** — **PODE cancelar.** Termos do Google
One: *"If you cancel your subscription during the Offer Period, your membership
will remain active until the end of the Offer Period."* A cobrança automática
só ocorre se NÃO cancelar antes do fim. Cuidado honesto: ao perder os 400 GB,
os arquivos existentes ficam, mas upload novo trava acima de 15 GB — os 400 GB
não são arquivo definitivo de nada crítico.

**Princípio (doutrina): a promoção mora FORA do código.** A casa não integra
chave nem dado pessoal; ela dá LAR e DESTINO ao que a promoção produz:

| Recurso da promoção | Uso de estudo real | Onde entra na casa |
|---|---|---|
| **NotebookLM** (200 págs · Áudio/Vídeo · Testes) | Dump de PDFs + caderno por matéria; Áudio Overview no ônibus (repasso do tempo morto); Testes = quiz do tópico | nº 9 Prova Branca (o quiz do NotebookLM é a matéria-prima) · nº 6 Kit de Véspera (confere com as fontes) |
| **Gemini Flash** (limites 2x) | Foto do caderno → explicação; modo voz para explicar em voz alta (Feynman); volume diário | O tutor da casa já entrega o contexto; os limites 2x são para as semanas D-21/D-7/D-3 |
| **400 GB** (Drive/Fotos) | Pipeline: foto do caderno no dia → pasta Drive da matéria → NotebookLM | nº 2 Mapa de Domínio (fonte real por tópico) |
| **Gemini no Gmail** | Aviso de professor / prazo resumido | Radar de provas: lançar a DATA OFICIAL |
| **Nano Banana** (imagens) | 1 diagrama por tópico difícil (memória visual) | Materiais: índice/link do diagrama |
| **Flow Music** | Jingle mnemônico para listas que não grudam (P1–P14, fórmulas de ED) | Fecho: "criou jingle? registra no tópico" |
| **Flow** (vídeo) | Baixo valor de estudo — ignorar por ora | — |

**Regra de ouro:** os limites 2x são para o VOLUME das semanas de prova — não
gastar com pergunta que o tutor da casa já responde.

**Execução da fila (com o gás):** nº 1 Ciclo do Erro — ✅ FEITA (Task
213-b, commit aa2e474) → nº 9 Prova Branca (sobe de valor: o NotebookLM Testes alimenta) →
nº 6 Kit de Véspera → nº 2 Mapa de Domínio.

## A chave perfeita (13/10/2026, Task 214) — a casa fala Gemini por chave

O dono: *"Eu quero a forma que vai ficar perfeita no site e que dê pra usar
através da key — vou precisar atualizá-la ao assinar o plano ou a key do Google
já terá acesso aos novos recursos?"*. Verdades verificadas (planos/suporte
Google, 13/10/2026):

- **Assinatura ≠ chave de API — mundos separados.** O Google AI Plus alimenta
  os APPS (Gemini app, NotebookLM, Gmail, Flow, 400 GB). A chave da API nasce
  no AI Studio (aistudio.google.com/app/apikey), tem tier GRÁTIS próprio, sem
  cartão, e NÃO depende do plano — assinar não atualiza nem amplia a chave,
  e a chave não precisa ser recriada depois de assinar.
- **A casa JÁ fala Gemini** (cadeia no /api/tutor: Gemini → OpenRouter → Z.ai →
  SDK local) — mas a chave só entrava por variável de ambiente (GEMINI_API_KEY).
- **A forma perfeita (o dono pediu, a casa executa):** a chave entra COMO DADO
  DO USUÁRIO, pela própria casa (Configurações → Inteligência da casa): mora no
  banco do servidor, NUNCA no código/git, volta mascarada (só o fim), testável
  ("Testar agora"), removível — e a cadeia lê: chave salva (DB) → env →
  próximos elos. Se a chave falhar ou estourar cota, a casa NÃO morre: cai pro
  elo seguinte e confessa qual cérebro respondeu (o campo `model` do
  TutorMessage já registra).
- **Doutrina evoluída:** o congelado "teste de chaves IA" passa a ser — *chave
  é dado do dono, entra via UI/DB; NADA de chave hard-coded, nada de chave no
  git, nada de painel público de chaves.* O espírito anti-vazamento fica mais
  forte, não mais fraco.
- TTS segue no elo atual (voz do Gemini por API é outra rota — fora do escopo).
- Modelos: a casa usa aliases vivos (`gemini-flash-latest`,
  `gemini-flash-lite-latest`) que sobrevivem à troca de versão do Google; o dono
  pode fixar outro modelo nas configurações se quiser.
- ✅ FEITA (Task 214-b, commit 9f15c03): card Inteligência da casa no hub, Setting no Prisma, cadeia lê DB → env, probe informa a fonte.
