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

### 5. Véspera Adaptativa
Prova ≤7 dias: a fila da sessão pesa os tópicos da prova, o tutor ganha
quick-action "escopo da prova", a folha impressa sai em versão véspera. O
calendário de provas JÁ existe (`nextExam` + intel de materiais).
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
