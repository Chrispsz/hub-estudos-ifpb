// prof-audio-map.ts — t173: MAPA ESPELHADO da Av1 de Matemática (01/10)
//
// Fonte da verdade DUPLA:
//   1. Áudio do professor (10 min, 30/09, WhatsApp) — transcrito e interpretado
//      no t172 (upload/prova-audio/transcricao_completa.txt). Ele descreve as
//      6 questões da prova UMA POR UMA e cita os espelhos na lista.
//   2. As listas REAIS em PDF: mat-01-matrizes.pdf (35 questões) e
//      mat-logica-lista.pdf (18 questões) — enunciados abaixo extraídos 1:1.
//
// Mapeamento confirmado lendo os PDFs:
//   Prova Q1 (lógica: valores → conclusão)      ≈ Lógica Q7 + Q13
//   Prova Q2 (composta → formalizar + tabela)   ≈ Lógica Q3 (CITADO) + Q8 + Q10
//   Prova Q3 (matriz por lei de formação)       ≈ Matrizes Q1 (CITADO)
//   Prova Q4 (situação-problema = PRODUTO)      ≈ Matrizes Q2 + Q17 + Q18
//   Prova Q5 (figura → transformação; potência) ≈ Matrizes Q19 + Q20 (ele
//       citou "vinte e seis" — a Q26 é da família da transposta; o item de
//       potenciação/adição/multiplicação com "letra e" é a Q19/Q20)
//   Prova Q6 (inversa: isolar X + definição)    ≈ Matrizes Q34 + Q35 (CITADOS)
//
// Orçamento de tempo: 50 min ÷ 6 questões (o professor avisou: "a gente tem
// pouco tempo, vai fazer o que precisa de uma vez").

export type MirrorRole = 'espelho' | 'irmao';

export interface MirrorQuestion {
  /** Qual lista real o espelho vive. */
  list: 'Lista de Lógica' | 'Lista de Matrizes';
  /** Referência na lista (ex.: 'Q7'). */
  qRef: string;
  /** espelho = o tipo EXATO que a prova pede · irmao = mesmo músculo, variação. */
  role: MirrorRole;
  /** Enunciado REAL, extraído do PDF da lista. */
  statement: string;
  /** Gabarito relâmpago — resposta curta para conferir na hora (D-1). */
  key?: string;
}

export interface ExamBlueprintQ {
  n: number;
  title: string;
  /** Minutos recomendados dentro dos 50 da prova. */
  minutes: number;
  /** O que o professor disse no áudio (limpo do ruído da transcrição). */
  profQuote: string;
  /** Exercício da estrutura no acervo (prof-av1-qN) — usado no Simulado do Professor. */
  profExerciseId: string;
  mirrors: MirrorQuestion[];
  /** Receita de prova — passos mecânicos para não travar no tempo. */
  recipe: string[];
  // --- t174: ESTRATÉGIA DE NOTA MÁXIMA ---
  /** Pontuação: Q1–Q5 = 20 cada (100) · Q6 = bônus de segurança (+20, a nota trava). */
  points: number;
  /** true só na Q6 — bônus que fecha 100 se alguma outra escapar. */
  bonus?: boolean;
  /** Posição na ORDEM PERFEITA de resposta (1º = fazer primeiro). */
  orderPosition: number;
  /** Por que essa posição (a lógica da estratégia). */
  orderWhy: string;
  /** Prompt pronto para o Tutor ensinar o MÉTODO mais limpo do tipo (fórmula padrão + memorização). */
  tutorPrompt: string;
  /** Material real que sustenta o prompt no Tutor (contexto material-first). */
  tutorMaterialId: string;
}

export const PROVA_BLUEPRINT: ExamBlueprintQ[] = [
  {
    n: 1,
    title: 'Lógica — valores lógicos → conclusão do argumento',
    minutes: 6,
    profQuote:
      'Vai ter uma questão de lógica matemática: umas proposições lógicas, você diz os valores lógicos dessas proposições e, a partir das premissas, tem que chegar a uma conclusão — bem de boa, já chegamos em alguns parecidos com os exemplos de aula.',
    profExerciseId: 'prof-av1-q1',
    points: 20,
    orderPosition: 2,
    orderWhy:
      '2º — com as 4 regras decoradas (∧, ∨, →, ↔) é piloto automático: mais 20 pts quentes em ~6 min, sem conta longa.',
    tutorPrompt:
      'Treino para a Av1 de amanhã (lógica): me ensine o MÉTODO mais limpo para a questão de valores lógicos → conclusão de argumento. Quero: (1) as 4 regras de valor lógico (∧, ∨, →, ↔) numa tabelinha memorizável; (2) as regras de inferência (modus ponens, modus tollens, silogismo, disjunção) com um exemplo curtinho cada; (3) os 2 erros clássicos que derrubam esse tipo de questão. Fórmula padrão primeiro, direto ao ponto.',
    tutorMaterialId: 'mat-logica-lista',
    mirrors: [
      {
        list: 'Lista de Lógica',
        qRef: 'Q7',
        role: 'espelho',
        statement:
          'Considere as proposições: $p$: $3 + 2 = 6$ · $q$: $\\pi > 3$ · $r$: Cajazeiras é a capital da Paraíba. Determine o valor lógico (V ou F) das expressões: a) $p \\to q$ · b) $\\neg(p \\lor r) \\land q$ · c) $\\neg(q \\to p) \\land p$ · d) $(r \\leftrightarrow p) \\lor \\neg q$',
        key: '$p$ = F, $q$ = V, $r$ = F → a) V · b) V · c) F · d) V. ($\\to$ só é F quando V$\\to$F; $\\leftrightarrow$ é V quando os lados são iguais.)',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q13',
        role: 'espelho',
        statement:
          'Se Carlos é executivo público, então Cláudio é eletricista e André médico. Se Márcia é enfermeira ou Carolina é nutricionista, então André não é médico. Constata-se que Márcia é enfermeira ou que Ana é advogada. Sabe-se, ainda, que Carlos é executivo público. Logo, é verdade que: A) Ana é advogada · B) André não é médico · C) Márcia é enfermeira · D) Cláudio não é eletricista · E) Carolina é nutricionista',
        key: 'A. Cadeia: Carlos V ⇒ André médico (V) e Cláudio eletricista; a 2ª condicional força "Márcia ou Carolina" = F; da disjunção com Márcia=F sobra Ana advogada (V).',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q5',
        role: 'irmao',
        statement:
          'Admitindo que $p$ e $q$ são verdadeiras e $r$ é falsa, determine o valor lógico (V ou F) de cada proposição: a) $p \\to r$ · b) $p \\leftrightarrow q$ · c) $r \\to p$ · d) $(p \\lor r) \\leftrightarrow q$ · e) $p \\to (q \\to r)$ · f) $p \\to (q \\lor r)$ · g) $\\neg p \\leftrightarrow \\neg q$ · h) $\\neg p \\leftrightarrow r$',
        key: 'a) F · b) V · c) V · d) V · e) F · f) V · g) V · h) V',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q6',
        role: 'irmao',
        statement:
          'Sendo a proposição $p \\to (r \\lor s)$ falsa e a proposição $(q \\land \\neg s) \\leftrightarrow p$ verdadeira, classifique em verdadeira ou falsa as afirmações $p$, $q$, $r$ e $s$.',
        key: '$p \\to (r \\lor s)$ falsa $\\Rightarrow p$ = V e $r \\lor s$ = F $\\Rightarrow r$ = F, $s$ = F. Depois $(q \\land \\neg s) \\leftrightarrow p$ com $p$ = V $\\Rightarrow q \\land \\neg s$ = V $\\Rightarrow q$ = V. Final: $p$ = V, $q$ = V, $r$ = F, $s$ = F.',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q14',
        role: 'irmao',
        statement:
          'São verdadeiras as afirmações de Tiago: "Trabalho ou estudo" · "Vou ao escritório ou não trabalho" · "Vou ao curso ou não estudo". Certo dia, Tiago não foi ao curso. É correto concluir que, nesse dia, Tiago: A) estudou e trabalhou · B) não estudou e não trabalhou · C) trabalhou e não foi ao escritório · D) foi ao escritório e trabalhou · E) não estudou e não foi ao escritório',
        key: 'D. "Vou ao curso ou não estudo" com curso=F ⇒ estudou=F; "trabalho ou estudo" com estudo=F ⇒ trabalhou=V; "escritório ou não trabalho" com trabalho=V ⇒ foi ao escritório.',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q15',
        role: 'irmao',
        statement:
          'p1: ou Rafaela pega um táxi ou Cíntia não vai ao cinema de carro; p2: Rafaela compra pipoca se e somente se Cíntia também comprar; p3: Cíntia vai ao cinema de carro se e somente se tiver dinheiro para a gasolina; p4: ou Cíntia tem dinheiro para a gasolina ou compra pipoca. Sabendo-se que Cíntia não tem dinheiro para a gasolina, conclui-se que: A) Cíntia e Rafaela vão ao cinema de carro · B) Cíntia não pega um táxi, mas vai ao cinema de carro · C) Cíntia não vai ao cinema de carro, nem compra pipoca · D) Nem Rafaela pega um táxi, nem Cíntia vai ao cinema de carro',
        key: 'D. Sem gasolina ⇒ (p3) não vai de carro; (p4) ou dinheiro ou pipoca ⇒ compra pipoca; (p2) Rafaela também compra; (p1, "ou…ou" exclusivo) com "não vai"=V ⇒ Rafaela não pega táxi.',
      },
    ],
    recipe: [
      'Valorize primeiro cada proposição simples (números: calcule! "Cajazeiras é a capital da Paraíba" é F — capital é João Pessoa).',
      'Regras de ouro: $\\land$ = V só se os dois V · $\\lor$ = F só se os dois F · $\\to$ só é F quando V$\\to$F · $\\leftrightarrow$ = V quando os lados são iguais.',
      'Encadeie as premissas: modus ponens $(p \\to q,\\ p \\vdash q)$ · modus tollens $(p \\to q,\\ \\neg q \\vdash \\neg p)$ · silogismo $(p \\to q,\\ q \\to r \\vdash p \\to r)$ · disjunção $(p \\lor q,\\ \\neg p \\vdash q)$.',
      'Conclusão = a única alternativa que NÃO contraria a cadeia. Teste as outras até quebrar.',
    ],
  },
  {
    n: 2,
    title: 'Lógica — proposição composta → formalizar + tabela-verdade + classificar',
    minutes: 10,
    profQuote:
      'Na segunda vou colocar uma proposição composta. Na letra A: identificar quem são as proposições simples e traduzir a sentença para a linguagem formal. Depois: construir a tabela-verdade correta e classificar — tautologia, contradição ou contingência. É parecida com a questão 3 da lista de lógica.',
    profExerciseId: 'prof-av1-q2',
    points: 20,
    orderPosition: 4,
    orderWhy:
      '4º — é fórmula pura, mas a tabela-verdade come tempo: faça DEPOIS que os 60 pts mecânicos (Q3+Q1+Q4) já estiverem no bolso.',
    tutorPrompt:
      'Treino para a Av1 (lógica): proposição composta → identificar as simples, formalizar, construir tabela-verdade e classificar (tautologia/contradição/contingência). Me dê o passo a passo padrão exatamente como escrever no rascunho: traduções de e/mas/ou/se…então/se e somente se/não, como montar as 2ⁿ linhas sem pular nenhuma, e o atalho para classificar só olhando a coluna final.',
    tutorMaterialId: 'mat-logica-lista',
    mirrors: [
      {
        list: 'Lista de Lógica',
        qRef: 'Q3',
        role: 'espelho',
        statement:
          'Sejam as proposições $p$: Luciana é rica e $q$: Luciana é feliz. Traduzir para a linguagem simbólica: a) Luciana é pobre, mas é feliz · b) Luciana é rica ou infeliz · c) Luciana é pobre e infeliz · d) Luciana é pobre ou rica, mas é infeliz',
        key: 'a) $\\neg p \\land q$ (o "mas" é $\\land$ e "pobre" é $\\neg p$) · b) $p \\lor \\neg q$ · c) $\\neg p \\land \\neg q$ · d) $(\\neg p \\lor p) \\land \\neg q = \\neg q$ (pois $\\neg p \\lor p$ é tautologia!).',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q8',
        role: 'irmao',
        statement:
          'Construir as tabelas-verdade das proposições: a) $\\neg(p \\lor \\neg q)$ · b) $p \\land q \\to p \\lor q$ · c) $q \\leftrightarrow \\neg q \\land p$ · d) $\\neg p \\land r \\to q \\lor \\neg r$',
        key: 'a) contingência (coluna F,F,V,F) · b) TAUTOLOGIA · c) contingência (V só em p=F, q=F) · d) contingência (F só em p=F, r=V, q=F).',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q10',
        role: 'irmao',
        statement:
          'Classifique as proposições em tautologia, contradição ou contingência: a) $\\neg p \\lor q \\to (p \\to q)$ · b) $p \\lor \\neg q \\to (p \\to \\neg q)$ · c) $\\neg p \\land (p \\land \\neg q)$',
        key: 'a) tautologia (os dois lados são equivalentes a $p \\to q$) · b) contingência (F quando $p$ = V, $q$ = V) · c) contradição (tem $\\neg p \\land p$ = F).',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q4',
        role: 'irmao',
        statement:
          'Determine o valor lógico (V ou F): a) $3 + 2 = 7$ e $5 + 5 = 10$ · b) Roma é a capital da França ou tg 45° = 1 · c) Se $0 < 1$, então $\\sqrt{2}$ é irracional · d) $3 + 4 = 7$ se, e somente se, $5^3 = 125$',
        key: 'a) $F \\land V$ = F · b) $F \\lor V$ = V · c) $V \\to V$ = V · d) $F \\leftrightarrow V$ = F',
      },
      {
        list: 'Lista de Lógica',
        qRef: 'Q11',
        role: 'irmao',
        statement:
          'Mostre que: a) $p \\land (p \\lor q) \\Leftrightarrow p$ · b) $q \\Rightarrow p \\land q \\leftrightarrow p$',
        key: 'Monte as duas colunas lado a lado: a) se $p$ = V, $p \\lor q$ = V $\\Rightarrow p \\land V = p$; se $p$ = F, tudo F. b) quando $q$ = V, $p \\land q \\leftrightarrow p$ é sempre V.',
      },
    ],
    recipe: [
      'Sublinhe as proposições simples e nomeie ($p$, $q$). Traduza o vocabulário: "e/mas" = $\\land$ · "ou" = $\\lor$ · "se…então" = $\\to$ · "se e somente se" = $\\leftrightarrow$ · "não/pobre/infeliz" = $\\neg$.',
      '$n$ variáveis $\\to 2^n$ linhas (2 vars = 4 linhas, 3 vars = 8). Construa as colunas DE DENTRO PARA FORA (primeiro os parênteses/$\\neg$ internos).',
      'Classifique pela coluna final: toda V = tautologia · toda F = contradição · mista = contingência.',
      'Atalho de prova: se achar "$\\neg p \\land p$" em qualquer lugar = F garantido (contradição parcial). Se a proposição é $X \\to X$, é tautologia.',
    ],
  },
  {
    n: 3,
    title: 'Matrizes — matriz quadrada por lei de formação (igualdade, simétrica)',
    minutes: 6,
    profQuote:
      'A terceira é para vocês: uma matriz quadrada de formação… algo parecido, talvez, com a primeira questão da lista de matrizes.',
    profExerciseId: 'prof-av1-q3',
    points: 20,
    orderPosition: 1,
    orderWhy:
      '1º — a mais mecânica de todas: aplica a lei casa a casa e garante 20 pts aquecendo a mão em ~6 min. Começar por ela tira o branco.',
    tutorPrompt:
      'Treino para a Av1 (matrizes): matriz construída por lei de formação (aᵢⱼ = fórmula ou condição). Me ensine o método casa a casa (diagonal principal é i=j, secundária é i+j=n+1), como aplicar condições por partes (se i>j, se i=j, se i<j) sem errar casa, e a conferência final de simétrica (Aᵗ=A) e antissimétrica (diagonal zero). Método padrão para escrever de memória no rascunho.',
    tutorMaterialId: 'mat-01-matrizes',
    mirrors: [
      {
        list: 'Lista de Matrizes',
        qRef: 'Q1',
        role: 'espelho',
        statement:
          'Construa as seguintes matrizes: a) $A = (a_{ij})_{2 \\times 2}$ tal que $a_{ij} = 2 + i + j$ · b) $A = (a_{ij})_{3 \\times 3}$ tal que $a_{ij} = \\{1,\\ \\text{se } i = j;\\ 0,\\ \\text{se } i \\neq j\\}$ · c) $B = (b_{ij})_{3 \\times 3}$ tal que $b_{ij} = \\{1,\\ \\text{se } i + j = 4;\\ 0,\\ \\text{se } i + j \\neq 4\\}$ · d) $B = (b_{ij})_{4 \\times 3}$ tal que $b_{ij} = \\{2i - j,\\ \\text{se } i > j;\\ \\pi,\\ \\text{se } i = j;\\ ij - 3,\\ \\text{se } i < j\\}$',
        key: 'a) [[4,5],[5,6]] · b) é a identidade $I_3$ · c) 1 na diagonal SECUNDÁRIA: [[0,0,1],[0,1,0],[1,0,0]] · d) aplique a regra certa em cada casa (abaixo da diagonal, na diagonal, acima).',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q3',
        role: 'irmao',
        statement:
          'Determine $x$, $y$ e $z$ reais que satisfaçam [[x + y, 2],[4, x − y]] = [[7, z],[z², 1]].',
        key: 'Igualdade é casa a casa: $2 = z \\Rightarrow z = 2$ (confere $z^2 = 4$ ✓); $x + y = 7$ e $x - y = 1 \\Rightarrow x = 4$, $y = 3$.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q7',
        role: 'irmao',
        statement:
          'Calcule a soma $C = (c_{ij})_{3 \\times 3}$ das matrizes $A = (a_{ij})_{3 \\times 3}$ e $B = (b_{ij})_{3 \\times 3}$ tais que $a_{ij} = i^2 + j^2$ e $b_{ij} = 2ij$.',
        key: '$c_{ij} = i^2 + j^2 + 2ij = (i + j)^2$ — a casa $(2,3)$ vale $(2+3)^2 = 25$.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q28',
        role: 'irmao',
        statement:
          'Determine $x$, $y$, $z$ para que a matriz $A = $ [[1, x, 5],[2, 7, −4],[y, z, −3]] seja simétrica.',
        key: 'Simétrica: $a_{ij} = a_{ji} \\Rightarrow x = 2$, $y = 5$, $z = -4$.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q29',
        role: 'irmao',
        statement:
          'Determine $x$, $y$, $z$ para que a matriz $A = $ [[0, −4, 2],[x, 0, 1 − z],[y, 2z, 0]] seja antissimétrica.',
        key: 'Antissimétrica: $a_{ij} = -a_{ji}$ (diagonal toda ZERO) $\\Rightarrow x = 4$, $y = -2$, $z = -1$.',
      },
    ],
    recipe: [
      'Leia a lei casa a casa: $i$ = linha, $j$ = coluna. Condição "$i = j$" = diagonal principal · "$i + j = n + 1$" = diagonal secundária.',
      'Monte LINHA por LINHA, aplicando a regra certa em cada casa (nas de partes, teste $i > j$, $i = j$, $i < j$ separadamente).',
      'Simétrica: $A^t = A$ (espelho na diagonal principal). Antissimétrica: $A^t = -A \\Rightarrow$ a diagonal é TODA ZERO.',
      'Igualdade de matrizes = casa a casa igual — vira sistema simples (some/subtraia as equações).',
    ],
  },
  {
    n: 4,
    title: 'Matrizes — situação-problema: é PRODUTO (o professor avisou: NÃO é sistema!)',
    minutes: 8,
    profQuote:
      'A quarta é boa, a quarta é bonita. Vai ter uma situação-problema… queijo, frango, biscoito… Vai representar os sistemas lineares? NÃO! É o produto de matrizes: quantidades de um lado, preços do outro.',
    profExerciseId: 'prof-av1-q4',
    points: 20,
    orderPosition: 3,
    orderWhy:
      '3º — montou Q e P, é linha × coluna automático: 20 pts de lei de formação + produto antes da parte longa da prova.',
    tutorPrompt:
      'Treino para a Av1 (matrizes): situação-problema resolvida por PRODUTO de matrizes (quantidades × preços — o professor avisou que NÃO é sistema linear). Me dê o padrão rígido: como montar Q (quantidades) e P (preços) lendo o enunciado, o teste de ordem (m×n)·(n×1)=(m×1), a mecânica linha × coluna sem se perder e como interpretar o resultado (faturamento por dia).',
    tutorMaterialId: 'mat-01-matrizes',
    mirrors: [
      {
        list: 'Lista de Matrizes',
        qRef: 'Q2',
        role: 'espelho',
        statement:
          'A matriz $D$ representa as distâncias (em km) entre as cidades X, Y e Z: $D = $ [[0, 15, 27],[15, 0, 46],[27, 46, 0]]. Cada elemento $a_{ij}$ fornece a distância entre as cidades $i$ e $j$. a) determine as distâncias entre X e Y, entre Z e X, e Y e Z · b) qual é a transposta da matriz $D$?',
        key: 'a) $d(X,Y) = a_{12} = 15$ · $d(Z,X) = a_{31} = 27$ · $d(Y,Z) = a_{23} = 46$ · b) $D^t = D$ (a matriz é simétrica — distâncias não mudam de direção).',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q17',
        role: 'espelho',
        statement:
          'Calcule os seguintes produtos: a) [[0,1],[1,0]] · [[4,7],[2,3]] · b) coluna $[1\\ 2\\ 3]$ × linha $[3\\ 1\\ 1\\ 2]$ · c) [[−2,1],[0,3]] · [[−2,3,2,−1],[−1,0,0,−4]] · d) [[0,1,2],[1,1,3],[−3,−2,−7]] · [[4,−1,1],[0,3,−2],[2,1,3]]',
        key: 'Mecânica linha × coluna: a) [[2,3],[7,4]] (a matriz da letra a TROCA as linhas — é a permutação!) · b) produto externo $3 \\times 4$ · c) ordem $2 \\times 4$ · d) ordem $3 \\times 3$. Confira SEMPRE: colunas da 1ª = linhas da 2ª.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q18',
        role: 'irmao',
        statement:
          'Considere as matrizes $A = (a_{ij})_{4 \\times 7}$ definida por $a_{ij} = i - j$, $B = (b_{ij})_{7 \\times 9}$ definida por $b_{ij} = i$ e $C = AB$. Determine o elemento $c_{23}$.',
        key: '$c_{23} = \\sum_{k=1}^{7} (a_{2k} \\cdot b_{k3}) = \\sum (2 - k) \\cdot 3 = 3 \\cdot (2 \\cdot 7 - 28) = -42$. Só a linha 2 de $A$ e a coluna 3 de $B$ participam!',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q22',
        role: 'irmao',
        statement:
          'Sabe-se que $A = $ [[x, 1, 2],[3, y, 5],[2, 3, z]], $B$ é uma matriz diagonal ($b_{ij} = 0$ se $i \\neq j$) e $AB = $ [[2, 3, 10],[6, 12, 25],[4, 9, 20]]. Determine $x$, $y$ e $z$.',
        key: 'Colunas de $AB$ = colunas de $A$ escaladas pelos da diagonal de $B$: 1ª coluna $\\times d_1$: $x \\cdot d_1 = 2$ com $3 \\cdot d_1 = 6 \\Rightarrow d_1 = 2 \\Rightarrow x = 1$; $y \\cdot d_2 = 12$ com $3 \\cdot d_2 = 9 \\Rightarrow d_2 = 3 \\Rightarrow y = 4$; $z \\cdot d_3 = 20$ com $2 \\cdot d_3 = 4 \\Rightarrow d_3 = 2 \\Rightarrow z = 10$.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q9',
        role: 'irmao',
        statement:
          'Dadas $A = $ [[1, 5, 7],[3, 9, 11]], $B = $ [[2, 4, 6],[8, 10, 12]] e $C = $ [[0, −1, −5],[1, 4, 7]], calcule: a) $A + B + C$ · b) $A - B + C$ · c) $A - B - C$ · d) $-A + B - C$',
        key: 'Casa a casa, com sinal. Ex.: a) [[3, 8, 8],[12, 23, 30]]. Faça as outras na mesma pegada.',
      },
    ],
    recipe: [
      'Monte as matrizes do enunciado: QUANTIDADES = $Q$ (linhas = dias/lojas, colunas = produtos) e PREÇOS = $P$ (matriz coluna).',
      'Teste a ordem: $Q(m \\times n) \\cdot P(n \\times 1) \\to (m \\times 1)$. O produto SÓ existe se colunas da 1ª = linhas da 2ª.',
      '$c_{ik}$ = soma de (linha $i$ de $Q$) × (coluna $k$ de $P$), elemento a elemento.',
      'Interprete a resposta: cada linha do resultado = faturamento daquele dia/loja. (O professor avisou: é produto, NÃO sistema linear — não se perca!)',
    ],
  },
  {
    n: 5,
    title: 'Matrizes — figura no plano cartesiano: transformação = produto · + potência/adição (letra e)',
    minutes: 10,
    profQuote:
      'Vai ter uma figurinha formada no plano cartesiano — figura poligonal formada por vértices. A questão fala das transformações geométricas que podem ser representadas por uma operação matricial — e essa operação é a MULTIPLICAÇÃO de matrizes. Fazendo a multiplicação você encontra os novos vértices. E tem letra de operação: potenciação, adição, multiplicação — achei parecida com a vinte e seis da lista.',
    profExerciseId: 'prof-av1-q5',
    points: 20,
    orderPosition: 5,
    orderWhy:
      '5º — multiplicações maiores (vértice por vértice + A²): com a nota já encaminhada, faz com calma e confere cada vértice.',
    tutorPrompt:
      'Treino para a Av1 (matrizes): transformação geométrica no plano cartesiano (vértice vira matriz coluna [x;y]; novo vértice = M·[x;y]) + operações com potência (A² = A·A), soma e escalar (combo tipo A² + 2A − kI). Me ensine o método limpo para não se embolar nas multiplicações, o checklist para conferir cada vértice novo e o jeito de escrever A² passo a passo no rascunho.',
    tutorMaterialId: 'mat-01-matrizes',
    mirrors: [
      {
        list: 'Lista de Matrizes',
        qRef: 'Q19',
        role: 'espelho',
        statement:
          'Se $n \\in \\mathbb{N}^*$ e $A$ é matriz quadrada, definimos $A^n = A \\cdot A \\cdot A \\cdots A$ ($n$ fatores). Sendo $A = $ [[1, 1],[0, 1]], determine: a) $A^2$ · b) $A^3$ · c) $A^4$ · d) $A^{25}$ · e) $A^n$',
        key: '$A^2 = $ [[1,2],[0,1]] · $A^3 = $ [[1,3],[0,1]] · $A^4 = $ [[1,4],[0,1]] · $A^{25} = $ [[1,25],[0,1]] · $A^n = $ [[1,n],[0,1]] — o 1 da diagonal sempre volta; só o canto cresce (tem letra E, exatamente como o professor avisou!).',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q20',
        role: 'espelho',
        statement:
          'Se $A = $ [[1, 2],[4, −3]], determine $A^2 + 2A - 11 \\cdot I$, em que $I$ é a identidade $2 \\times 2$.',
        key: '$A^2 = $ [[9,−4],[−8,17]]; $2A = $ [[2,4],[8,−6]]; somando e subtraindo $11I$ elemento a elemento dá a MATRIZ NULA [[0,0],[0,0]] — se não deu zero, refaça a multiplicação.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q26',
        role: 'irmao',
        statement:
          'Determine, em cada caso, a matriz $X$: a) $X = $ [[1, 2, 5],[−1, 7, 2]]$^t$ · b) $X + $ [[1, 2],[5, 1]] $= $ [[0, 0],[2, 3]]$^t$ · c) $3X^t = $ [[1, 1],[2, 7]] $-$ [[1, 4],[7, 2]]',
        key: 'a) [[1,−1],[2,7],[5,2]] · b) transpõe o lado direito e isola: $X = $ [[−1,0],[−5,2]] · c) $X^t = \\frac{1}{3}$ [[0,−3],[−5,5]] $\\Rightarrow X = $ [[0,−5/3],[−1,5/3]].',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q17d',
        role: 'irmao',
        statement:
          'Calcule o produto [[0, 1, 2],[1, 1, 3],[−3, −2, −7]] · [[4, −1, 1],[0, 3, −2],[2, 1, 3]] — a mecânica exata do vértice novo (linha × coluna) que a transformação geométrica pede.',
        key: 'Faça casa a casa: $c_{11} = 0 \\cdot 4 + 1 \\cdot 0 + 2 \\cdot 2 = 4$; $c_{12} = 0 \\cdot (-1) + 1 \\cdot 3 + 2 \\cdot 1 = 5$; siga assim até fechar o $3 \\times 3$.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q12',
        role: 'irmao',
        statement:
          'Calcule as matrizes $2A$, $\\frac{1}{3}B$, $\\frac{1}{2}(A + B)$ e $-\\frac{3}{5}\\left(2A - \\frac{4}{3}B\\right)$, sendo dadas $A = $ [[1, 1],[5, 7]] e $B = $ [[0, 6],[9, 3]].',
        key: 'Escalar multiplica TODOS os elementos; $\\frac{1}{2}(A+B)$ soma antes, divide depois; faça a operação de dentro para fora.',
      },
    ],
    recipe: [
      'Cada vértice $(x, y)$ vira matriz coluna $[x;\\ y]$. O novo vértice é $M \\cdot [x;\\ y]$ — linha de $M$ × coluna do vértice (uma multiplicação por vértice).',
      'Identifique o que $M$ faz: [[0,−1],[1,0]] = rotação 90° · [[1,0],[0,−1]] = espelho no eixo $x$ · [[k,0],[0,k]] = escala $k$.',
      'Potência: $A^2 = A \\cdot A$ (multiplique de novo o resultado). Não confunda com elevar cada elemento!',
      'Combo tipo Q20: primeiro $A^2$, depois $kA$ e $I$, SOMENTE ENTÃO some/subtraia elemento a elemento.',
    ],
  },
  {
    n: 6,
    title: 'Matrizes — inversa: isolar X com propriedades (letra A) + usar a DEFINIÇÃO (letra B)',
    minutes: 10,
    profQuote:
      'A sexta vai ter uma definição. Se vocês compreenderem a definição, vai pedir para usar — e usar é muito mais fácil do que fazer se vocês souberem fazer o que eu propus na questão trinta e cinco, por exemplo, na questão trinta e quatro: é só isolar a matriz X, lembrando das propriedades da matriz inversa e da matriz transposta. E a letra B usa a definição do que é uma matriz tal coisa.',
    profExerciseId: 'prof-av1-q6',
    points: 20,
    bonus: true,
    orderPosition: 6,
    orderWhy:
      'POR ÚLTIMO — é a mais difícil E vale só como bônus: garanta as 100 primeiro. Lá dentro, comece pelas letras-fórmula (isolar X) e deixe a verificação pela definição (AB = BA = I) para o fim — bônus vale mesmo parcial.',
    tutorPrompt:
      'Treino para a Av1 (matrizes — a questão mais difícil, que vale bônus): isolar a matriz X usando propriedades de inversa e transposta, e usar a DEFINIÇÃO de matriz inversa (AB = BA = I). Me dê o roteiro padrão de isolamento (multiplicar por qual lado primeiro, (AB)⁻¹ = B⁻¹A⁻¹, (Aᵗ)⁻¹ = (A⁻¹)ᵗ, começar por (A+X)ᵗ = B tirando a transposta) e como provar pela definição. Quero as fórmulas padrão para escrever de memória no rascunho e um mini-exemplo numérico.',
    tutorMaterialId: 'mat-01-matrizes',
    mirrors: [
      {
        list: 'Lista de Matrizes',
        qRef: 'Q34',
        role: 'espelho',
        statement:
          'Sendo $A$ e $B$ matrizes inversíveis de ordem $n$, isole $X$ a partir de cada equação: a) $AXB = I_n$ · b) $(AX)^{-1} = B$ · c) $BAX = A$ · d) $(AX)^t = B$ · e) $(A + X)^t = B$',
        key: 'a) $X = A^{-1} \\cdot B^{-1}$ · b) $AX = B^{-1} \\Rightarrow X = A^{-1} \\cdot B^{-1}$ · c) $X = A^{-1} \\cdot B^{-1} \\cdot A$ · d) $AX = B^t \\Rightarrow X = A^{-1} \\cdot B^t$ · e) $A + X = B^t \\Rightarrow X = B^t - A$. (Inversa "desfaz" na ordem contrária: $(AB)^{-1} = B^{-1}A^{-1}$.)',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q35',
        role: 'espelho',
        statement:
          'Dadas as matrizes $A = $ [[3, 4],[−2, 1]] e $B = $ [[5, −2],[0, 3]], determine a matriz $X$, tal que $(XA)^{-1} = B$.',
        key: '$(XA)^{-1} = B \\Rightarrow XA = B^{-1} \\Rightarrow X = B^{-1} \\cdot A^{-1}$. Com $\\det(A) = 11$ e $\\det(B) = 15$: $X = \\frac{1}{15}$ [[3,2],[0,5]] $\\cdot \\frac{1}{11}$ [[1,−4],[2,3]] $= \\frac{1}{165}$ [[7, −6],[10, 15]].',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q31',
        role: 'irmao',
        statement:
          'Determine a inversa de cada matriz abaixo: a) $A = $ [[5, 6],[4, 5]] · b) $B = $ [[2, 5],[1, 3]] · c) $C = $ [[1, 1, 0],[1, 0, 1],[0, 1, 1]] · d) $D = $ [[1, 9, 5],[3, 1, 2],[6, 4, 4]]',
        key: '$2 \\times 2$: $\\det \\cdot A^{-1} = $ [[d,−b],[−c,a]] $\\Rightarrow$ a) $A^{-1} = $ [[5,−6],[−4,5]] ($\\det = 1$) · b) $B^{-1} = $ [[3,−5],[−1,2]] ($\\det = 1$) · c) e d): escalonamento $[A \\mid I]$ — confira multiplicando $A \\cdot A^{-1} = I$.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q32',
        role: 'irmao',
        statement:
          'Sejam $A = $ [[1, 2],[1, 4]] e $B = $ [[2, −1],[x, y]] duas matrizes. Se $B$ é a inversa de $A$, calcule o valor de $x + y$.',
        key: '$A^{-1} = \\frac{1}{2}$ [[4,−2],[−1,1]] $= $ [[2,−1],[−1/2,1/2]] $\\Rightarrow x = -\\frac{1}{2}$, $y = \\frac{1}{2}$ $\\Rightarrow x + y = 0$.',
      },
      {
        list: 'Lista de Matrizes',
        qRef: 'Q33',
        role: 'irmao',
        statement:
          'Resolva a equação matricial: [[1, 2],[1, 3]] $\\cdot X = $ [[13],[18]].',
        key: '$X = A^{-1} \\cdot B$ com $A^{-1} = $ [[3,−2],[−1,1]] ($\\det = 1$) $\\Rightarrow X = $ [[39−36],[−13+18]] $= $ [[3],[5]].',
      },
    ],
    recipe: [
      'DEFINIÇÃO (a letra B cobra na linha): $M$ é a inversa de $A \\Leftrightarrow A \\cdot M = M \\cdot A = I_n$. Para "verificar pela definição", multiplique e mostre que dá a identidade.',
      'Para isolar $X$: multiplique pelos DOIS lados pela inversa na ordem certa — quem está do lado ESQUERDO é o primeiro a ser desfeito. Ex.: $BAX = A \\to AX = B^{-1}A \\to X = A^{-1}B^{-1}A$.',
      'Propriedades que caem: $(AB)^{-1} = B^{-1}A^{-1}$ · $(A^{-1})^{-1} = A$ · $(A^t)^{-1} = (A^{-1})^t$ · $(A + X)^t = B$ começa tirando a transposta ($A + X = B^t$).',
      'Ordem NÃO comuta: $A^{-1}B^{-1} \\neq B^{-1}A^{-1}$ em geral. Escreva os passos no papel — a nota mora nos detalhes.',
    ],
  },
];

/** Total de minutos distribuídos (deve fechar em 50 = duração da prova). */
export const TOTAL_MINUTES = PROVA_BLUEPRINT.reduce((acc, q) => acc + q.minutes, 0);

/** Contagem de espelhos exatos vs irmãos (para o resumo do header). */
export function mirrorStats(): { espelhos: number; irmaos: number; total: number } {
  let espelhos = 0;
  let irmaos = 0;
  for (const q of PROVA_BLUEPRINT) {
    for (const m of q.mirrors) {
      if (m.role === 'espelho') espelhos += 1;
      else irmaos += 1;
    }
  }
  return { espelhos, irmaos, total: espelhos + irmaos };
}

// --- t174: ESTRATÉGIA DE NOTA MÁXIMA ---
// Inteligência do dono (30/09): cada questão vale 20 pts (sistema até 100);
// a Q6 é EXTRA — a nota não passa (não vira 120), mas fecha os 100 caso
// alguma outra escape. Como ela também é a MAIS DIFÍCIL, a doutrina é:
// Q6 = seguro, faz por último, e as 100 vêm primeiro.
export const EXAM_STRATEGY = {
  scoring: 'Q1–Q5 = 20 pts cada → 100 · Q6 = +20 de bônus (a nota trava em 100 — serve para fechar se alguma escapar)',
  /** A ordem perfeita e menos confusa: pontos mecânicos primeiro, bônus por último. */
  orderRationale:
    'A ordem é simples: primeiro o que é AUTOMÁTICO (garante pontos sem desgaste), depois o que é FÓRMULA mas demora, e o bônus difícil fica por último — sem embolar e sem depender da Q6 para nada.',
  rascunho: [
    'Numere o rascunho por questão (Q1…Q6) — pular entre questões não vira bagunça.',
    'Antes de calcular, escreva a FÓRMULA PADRÃO de memória (ex.: $c_{ik} = \\sum a_{ij} \\cdot b_{jk}$; $(AB)^{-1} = B^{-1}A^{-1}$; $\\to$ só é F quando V$\\to$F). Fórmula certa no papel = metade da nota ganha.',
    'Resolva, confira (ordem da multiplicação, sinais, o que o enunciado pediu) e SÓ DEPOIS passe a limpo — nunca passe direto.',
  ],
  q6Doctrine:
    'Q6 é SEGURO, não pré-requisito: deixe para o fim e trate como seguro da nota. Se o tempo apertar, faça só as letras-fórmula do isolar X (cada passo isolado vale pontos) e a verificação pela definição $AB = BA = I$ — bônus vale mesmo parcial.',
} as const;

// --- t177: INTEL DA PROVA PARA O TUTOR ---
// O dono pediu para estudar o assunto da prova COM o tutor ("tirar qualquer
// dúvida minha e absorver tudo"). Este bloco compacto é injetado no system
// prompt do POST /api/tutor quando a conversa é da disciplina da prova
// (TEC.1984) — gerado DO MESMO mapa espelhado que o card usa (fonte única,
// nunca diverge). O tutor passa a conhecer a estrutura ditada pelo professor,
// os espelhos e a estratégia de nota sem duplicar texto na rota.
export function examIntelForTutor(): string {
  const qs = PROVA_BLUEPRINT.map((q) => {
    const espelhos = q.mirrors
      .filter((m) => m.role === 'espelho')
      .map((m) => `${m.list} ${m.qRef}`)
      .join(', ');
    const irmaos = q.mirrors
      .filter((m) => m.role === 'irmao')
      .map((m) => `${m.list} ${m.qRef}`)
      .slice(0, 4)
      .join(', ');
    const bonus = q.bonus ? ' · BÔNUS (nota trava em 100 — fecha a prova se outra escapar)' : '';
    const head = `- Q${q.n} (${q.minutes} min, ${q.points} pts${bonus}): ${q.title}.`;
    const refs = [
      espelhos ? `Espelhos EXATOS: ${espelhos}.` : '',
      irmaos ? `Irmãos (mesmo músculo): ${irmaos}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return refs ? `${head} ${refs}` : head;
  }).join('\n');

  const ordem = [...PROVA_BLUEPRINT]
    .sort((a, b) => a.orderPosition - b.orderPosition)
    .map((q) => `${q.orderPosition}º Q${q.n}`)
    .join(' → ');

  return [
    '=== INTEL DA PROVA — Av1 de Matemática 01/10, 50 min (FONTE: áudio do professor transcrito no Hub; espelhos conferidos nas listas reais) ===',
    'Estrutura CONFIRMADA das 6 questões (20 pts cada, cap 100):',
    qs,
    `ORDEM DE RESOLUÇÃO recomendada: ${ordem}. ${EXAM_STRATEGY.orderRationale}`,
    `PONTUAÇÃO: ${EXAM_STRATEGY.scoring}.`,
    `RASCUNHO (ensine este protocolo quando treinar): ${EXAM_STRATEGY.rascunho.join(' ')}`,
    `DOCTRINA Q6: ${EXAM_STRATEGY.q6Doctrine}`,
    'NÃO CAEM: determinantes (1.3) e sistemas lineares (1.4) — professor ainda não deu; se pedirem, explique que é pós-prova.',
    'AO TREINAR: prefira os ESPELHOS exatos (é o tipo real da prova); ensine o MÉTODO de cada tipo (fórmula padrão primeiro); se o aluno pedir, crie variações NO MESMO FORMATO do espelho e corrija com o gabarito oficial do Hub.',
    '=== FIM DA INTEL DA PROVA ===',
  ].join('\n');
}
