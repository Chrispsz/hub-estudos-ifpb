# EDIÇÃO DEFINITIVA — Auditoria, comparação e o caminho tomado

> Data: 10/10/2025 · Task 205 · Responde à pergunta do dono: **"houve evolução?
> ele já serve para estudar perfeitamente? o que frustra? qual o caminho definitivo?"**

---

## 1. Veredito da auditoria (honesto)

| Pergunta | Resposta curta |
|---|---|
| Houve evolução do antigo para o novo? | **Sim, em 5 frentes** (planejamento explicável, FSRS real, XP honesto, erro→code review, offline total) — mas o novo **não estudava PDFs**: o ativo mais valioso da casa (56 materiais dos professores, 45 PDFs, 54 resumos IA) só era acessível no legado. |
| Ele já servia para estudar perfeitamente? | **Não servia.** Faltava a experiência de leitura (viewer/busca/captura/resumo), o plano do dia não olhava o conteúdo da semana, o pomodoro não existia no v2, e havia fricções de linguagem ("dívida", "virgem"). |
| O que frustra? | No legado: a paleta de comandos prometia 8 destinos e 5 eram becos sem saída (main em branco) — promessa quebrada frustra mais do que falta de função. No novo: palavras duras, streak como destaque, pausa inexistente. Nenhum sistema punitivo grave foi encontrado (a casa sempre evitou), mas o *destaque* dado a streak/dívida empurrava na direção errada. |
| Fusão das duas ferramentas? | **Feita agora (Task 205).** Os leitores prontos do legado rodam dentro do app novo; o tutor recebe `materialId` e lê o PDF real; a prateleira de materiais é a prateleira do app novo. |

## 2. O que a pesquisa diz (e o que virou código)

20 princípios extraídos de ~18 buscas (retrieval practice/Dunlosky, tiny habits/Fogg,
habit formation ~66d, attention residue/Leroy, brain drain/Ward, pomodoro & flow,
ADHD-friendly design, streak anxiety/Mogavi, self-efficacy/Bandura, GNOME HIG).
Os que mudaram o produto **hoje**:

1. **Plano pronto (implementation intention, P8)** → "plano de hoje" com 2–4 itens, porquê e dose; o app decide, o aluno confirma com 1 clique.
2. **Começo mínimo (tiny habits, P6/P7)** → `startHere` + **Modo Dia Leve** (15 min e o dia conta); bateria baixa no check-in ativa o dia leve sozinho.
3. **Conteúdo da semana (a dor nº 1)** → estrela em material/tópico = boost ×1.8 no plano por 9 dias; marcar o material também impulsiona o tópico cujas unidades vêm dele.
4. **Pausa que não corta raciocínio (P14)** → pomodoro com decisão do aluno: ciclo fecha → "terminar o pensamento (+10min)" ou pausa; a pausa nunca nasce sozinha no meio de uma questão.
5. **Pausa sem celular (P1/P15)** → a tela da pausa sugere levantar/água/olhar longe e segura o retorno sem cobrança.
6. **Consistência > sequência (P7/P19)** → métrica primária = "dias estudados · 30d"; streak virou detalhe discreto; faltar um dia não apaga nada.
7. **Linguagem que alivia (P9/P20)** → "dívida do ritmo" virou "matérias aguardando toque"; "virgem" virou "novo"; erro mudo virou convite ("anote rápido, seu eu do futuro agradece"); sessão curta vira informação ("a partir de 15 min ela vira XP").
8. **1 tela = 1 pergunta (P16/P17, GNOME/COSMIC)** → **10 abas viraram 3 destinos + 1 dock**: Hoje · Estudar (Materiais/Trilha/Revisão/Backlog/Erros) · Progresso (Sprint/Missões/Rotina/Perfil) · Tutor no dock.

## 3. Palavras-chave do produto

**PT-BR:** produtividade calma · foco sem culpa · começo mínimo · plano do dia pronto ·
conteúdo da semana · dose em ciclos · pausa de verdade · revisar antes de aprender novo ·
testar-se em vez de reler · dias estudados (não sequência) · erro = informação ·
tela limpa, uma ação por vez.

**EN (docs):** calm productivity · retrieval practice · spaced repetition (FSRS) · tiny habits ·
implementation intentions · interleaving gradual · pomodoro "finish the thought" ·
attention residue · streak anxiety · feature fatigue · self-efficacy · ADHD-friendly ·
calm design (GNOME HIG) · micro-wins.

## 4. Arquitetura da fusão (o que foi construído)

```
src/lib/v2/plano.ts        NOVO  — buildDayPlan: score cirúrgico (semana > prova > atraso),
                                   dose em pomodoros, startHere, dia leve, narrativa
src/lib/v2/planner.ts      EVOLU — FocusMarks (marca 9 dias), pickRitmo com boost da semana,
                                   copy gentil; suggestForBlock aceita foco
src/lib/v2/diario.ts       NOVO  — check-in (bateria), check-out (como foi), dia leve, semana p/ Sprint
src/lib/v2/xp.ts           EVOLU — daysStudiedOf (consistência frouxa, a métrica primária)
src/lib/v2/repo.ts         EVOLU — toggleFocusMark (estrela), copy do erro gentil
src/components/v2/app.tsx        — shell 3 abas + dock do Tutor (Sheet) + header com dias·30d
src/components/v2/tab-hoje.tsx   — plano de hoje + registro do dia + pomodoro na sessão viva
src/components/v2/tab-estudar.tsx    — Materiais · Trilha · Revisão · Backlog · Erros
src/components/v2/tab-materiais.tsx  — prateleira dos 56 materiais: ler (viewer + busca + captura),
                                       resumo IA, tutor lê comigo (materialId → retrieval), estrela
src/components/v2/tab-progresso.tsx  — Sprint Review · Missões · Rotina · Perfil
src/components/v2/pomodoro.tsx       — ciclos 25/5, "+10min terminar o pensamento", pausa longa 4º ciclo
src/components/hub/command-palette.tsx — paleta do legado sem becos sem saída (3 destinos vivos)
```

Reusados do legado sem reescrever (a fusão que economiza meses): `PdfViewerDialog`
(split com tutor, busca pdf.js, captura de página, print), `MaterialSummaryDialog`
(54 resumos IA), `/api/tutor` com `materialId` (retrieval do texto real do PDF).

## 5. Como o algoritmo decide ("cirúrgico")

Score do Ritmo por matéria = prioridade × (prova na janela ×2/×3) × (atraso ≥7d ×1.25)
× (**conteúdo da semana ×1.8**) — e o porquê de cada fator aparece na linha de baixo.
Fundação = primeiro tópico não-estável com pré-reqs estáveis × dependentes × defasagem.
Revisão = fila FSRS, a mais antiga primeiro, ~3min cada. Interleaving gradual: mistura
**entre matérias**, nunca dentro do primeiro contato (iniciante precisa de bloco).

## 6. Estado de paridade após a fusão

| Recurso | Antes | Agora |
|---|---|---|
| Ler PDF do professor no app novo | ❌ link cru | ✅ viewer completo + busca + captura + resumo IA |
| Tutor lendo o material aberto | só legado | ✅ v2 manda `materialId` |
| Plano do dia com foco na semana | ❌ | ✅ estrela → boost → porquê |
| Pomodoro no app novo | ❌ | ✅ com finish-the-thought |
| Registro diário | ❌ | ✅ check-in/check-out no meta |
| Consistência 30d | ❌ | ✅ header + Perfil |
| Paleta do legado sem becos | ❌ (5 mortos) | ✅ |
| Simulado Pro no app novo | ❌ | ⏳ única lacuna grande — permanece no legado (`/?legacy=1`) até portagem |

## 7. Próximos passos sugeridos

1. **Simulado no v2** — portar `simulado-view` lendo `attempts`/`exams` do núcleo (maior lacuna restante).
2. **Diário no Sprint Review** — renderizar `weekDiary()` (já existe a leitura) na semana.
3. **Marcar tópico da semana na Trilha** (hoje só material tem estrela na UI).
4. Offline: garantir SW cache do viewer (já cobre `/pdfs/`).
5. Cutover: push das branches (main = app novo; legacy/v1 = casa antiga).
