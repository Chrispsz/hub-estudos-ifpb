// Exercise extractor (V3)
// Gera exercícios práticos a partir de:
//  1. Prova real Av1 do André (5 questões)
//  2. Lista de Exercícios de Algoritmos (curados por tópico)
//  3. Exercícios sugeridos das disciplinas (gerados a partir de tópicos do PPC)

export interface Exercise {
  id: string;
  disciplineCode: string;
  topic: string; // ex: "Comandos de entrada e saída"
  statement: string; // enunciado
  difficulty: 'facil' | 'medio' | 'dificil';
  source: 'lista_algoritmos' | 'prova_real' | 'gerado_topico' | 'ia_sugerido';
  hint?: string;
}

/**
 * Lista estática curada de exercícios.
 * Cobertura: 5 questões da prova real + ~35 questões da Lista de Algoritmos + exercícios gerados para outras disciplinas.
 */
export const exercises: Exercise[] = [
  // ===== Prova Real Av1 - Fundamentos (Prof. André) =====
  {
    id: 'prov-av1-q1',
    disciplineCode: '53647',
    topic: 'Histórico e Evolução',
    statement:
      'Q1 (2,0): Descreva as 5 gerações de computadores, citando para cada uma: 1 característica principal, 1 problema e 1 dispositivo marcante.',
    difficulty: 'medio',
    source: 'prova_real',
    hint: '1ª (válvulas), 2ª (transistores), 3ª (CI), 4ª (microprocessadores), 5ª (IA/quantum)',
  },
  {
    id: 'prov-av1-q2',
    disciplineCode: '53647',
    topic: 'Pioneiros da Computação',
    statement:
      'Q2 (2,0): Escreva 1 parágrafo sobre cada pioneiro: Charles Babbage, Ada Lovelace, Alan Turing e John von Neumann. Cite a contribuição principal de cada um.',
    difficulty: 'medio',
    source: 'prova_real',
    hint: 'Babbage (máquina analítica), Ada (1ª programadora), Turing (máquina de Turing), Von Neumann (arquitetura)',
  },
  {
    id: 'prov-av1-q3',
    disciplineCode: '53647',
    topic: 'Conversão de Bases',
    statement:
      'Q3 (2,0): Converta 14(hex) para decimal e binário. Converta 10100(bin) para decimal e hexadecimal. Mostre os cálculos.',
    difficulty: 'medio',
    source: 'prova_real',
    hint: 'Hex: dígito × 16^posição. Bin: dígito × 2^posição. Comece da direita (posição 0).',
  },
  {
    id: 'prov-av1-q4',
    disciplineCode: '53647',
    topic: 'Operações com Bases Mistas',
    statement:
      'Q4 (2,0): Resolva 1710(base 8) ÷ (1111001(base 2) + 2(base 10)). Converta tudo para decimal, faça a operação e devolva o resultado em hexadecimal.',
    difficulty: 'dificil',
    source: 'prova_real',
    hint: 'Converta tudo para decimal primeiro, depois faça a operação, depois converta o resultado para hex.',
  },
  {
    id: 'prov-av1-q5',
    disciplineCode: '53647',
    topic: 'Aritmética Binária',
    statement:
      'Q5 (1,5): Calcule 174 × 13 em binário. Converta os números, faça a multiplicação e apresente o resultado em binário e decimal.',
    difficulty: 'medio',
    source: 'prova_real',
    hint: '174 em binário = 10101110, 13 em binário = 1101. Multiplique como decimais binários.',
  },

  // ===== Lista de Exercícios de Algoritmos — Comandos de entrada e saída =====
  {
    id: 'alg-001',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia três números inteiros e calcule a sua média aritmética.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-002',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia três números e seus respectivos pesos e calcule a sua média ponderada.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-003',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia o valor do lado de um quadrado e calcule a sua área e o seu perímetro.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-004',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia um número inteiro positivo e calcule o seu dobro, triplo, quadrado, cubo e raiz quadrada.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-005',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia o valor do raio de uma circunferência e calcule a sua área e o seu comprimento.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-008',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia o valor de uma temperatura em Celsius e calcule o seu valor correspondente em Fahrenheit e em Kelvin.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-010',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia o valor dos dois catetos de um triângulo retângulo e calcule o valor da hipotenusa.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    hint: 'Teorema de Pitágoras: hipotenusa² = cateto1² + cateto2²',
  },

  // ===== Lista de Exercícios de Algoritmos — Desvios condicionais =====
  {
    id: 'alg-058',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement: 'Escreva um programa que leia um número inteiro e verifique se ele é par ou ímpar.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    hint: 'Use o operador % (módulo). Se n % 2 == 0, é par.',
  },
  {
    id: 'alg-059',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia dois números e determine se o segundo número é menor, igual ou maior que o primeiro.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-061',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia um número inteiro e determine o seu valor absoluto (sem usar funções prontas).',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-064',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia um número inteiro e verifique se ele é positivo, negativo ou neutro (zero).',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-065',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia a idade de uma pessoa e classifique: criança (0-12), adolescente (13-17), adulta (18-59) ou idosa (60+).',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-067',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia o valor de um ano e verifique se ele é ou não bissexto. Bissexto: divisível por 400 OU (divisível por 4 e não por 100).',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },

  // ===== Lista de Exercícios de Algoritmos — Comandos de repetição =====
  {
    id: 'alg-098',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Escreva um programa que imprima todos os números inteiros entre 1 e 100 em ordem ascendente.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    hint: 'Use for com i de 1 a 100.',
  },
  {
    id: 'alg-099',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Escreva um programa que imprima todos os números inteiros entre 1 e 100 em ordem descendente.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-100',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement:
      'Escreva um programa que leia um número inteiro positivo N e imprima os N primeiros números pares positivos.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-103',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Escreva um programa que leia um número inteiro N e verifique se ele é um número primo.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    hint: 'Primo: divisível apenas por 1 e por ele mesmo. Teste divisores de 2 até sqrt(N).',
  },
  {
    id: 'alg-104',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement:
      'Escreva um programa que leia um número inteiro N e verifique se ele é um número perfeito (soma dos divisores exceto ele mesmo). Ex: 6 = 1+2+3.',
    difficulty: 'dificil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-105',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement:
      'Escreva um programa que leia dois números inteiros M e N e calcule a soma de todos os números do intervalo [M, N].',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },

  // ===== Lista de Exercícios de Algoritmos — Vetores e matrizes =====
  {
    id: 'alg-158',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia dez números inteiros e, após finalizar a leitura, imprima todos os números lidos na mesma ordem.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-159',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia dez números inteiros e imprima todos na ordem inversa em que foram digitados.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-161',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia um vetor de 10 inteiros e um número N e imprima todos os elementos maiores que N.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-163',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia um vetor de 10 inteiros e imprima todos os elementos maiores que a média aritmética de todos os elementos.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-167',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia um número inteiro entre 0 e 255 e calcule o seu valor correspondente em binário (armazenando os bits em um vetor).',
    difficulty: 'dificil',
    source: 'lista_algoritmos',
    hint: 'Use divisões sucessivas por 2 e armazene os restos no vetor.',
  },

  // ===== Lista de Exercícios de Algoritmos — Subprogramas (funções/procedimentos) =====
  {
    id: 'alg-200',
    disciplineCode: 'TEC.1687',
    topic: 'Modularização de programas',
    statement:
      'Escreva uma função que receba dois números inteiros e retorne o maior deles. No main, leia 3 pares de números e use a função para imprimir o maior de cada par.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-201',
    disciplineCode: 'TEC.1687',
    topic: 'Modularização de programas',
    statement:
      'Escreva uma função que receba um número inteiro e retorne 1 se for primo, 0 caso contrário. Use-a para imprimir todos os primos entre 1 e 100.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },
  {
    id: 'alg-202',
    disciplineCode: 'TEC.1687',
    topic: 'Modularização de programas',
    statement:
      'Escreva um procedimento que receba um vetor de 10 inteiros e imprima-o em ordem inversa.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },

  // ===== Lista de Exercícios de Algoritmos — Recursividade =====
  {
    id: 'alg-300',
    disciplineCode: 'TEC.1687',
    topic: 'Recursividade',
    statement:
      'Escreva uma função recursiva que calcule o fatorial de um número N (N >= 0). Caso base: 0! = 1.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    hint: 'N! = N * (N-1)!, com 0! = 1.',
  },
  {
    id: 'alg-301',
    disciplineCode: 'TEC.1687',
    topic: 'Recursividade',
    statement:
      'Escreva uma função recursiva que calcule o N-ésimo termo da sequência de Fibonacci (0, 1, 1, 2, 3, 5, ...).',
    difficulty: 'dificil',
    source: 'lista_algoritmos',
    hint: 'Fib(0)=0, Fib(1)=1, Fib(n)=Fib(n-1)+Fib(n-2).',
  },
  {
    id: 'alg-302',
    disciplineCode: 'TEC.1687',
    topic: 'Recursividade',
    statement:
      'Escreva uma função recursiva que receba um número inteiro N e imprima todos os números de N até 1 em ordem decrescente.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
  },

  // ===== Matemática Aplicada — exercícios gerados do PPC =====
  {
    id: 'mat-001',
    disciplineCode: 'TEC.1984',
    topic: 'Álgebra Matricial',
    statement:
      'Dadas as matrizes A = [[1,2],[3,4]] e B = [[5,6],[7,8]], calcule A + B, A × B e o determinante de A.',
    difficulty: 'medio',
    source: 'gerado_topico',
  },
  {
    id: 'mat-002',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Construa a tabela verdade da proposição composta p ∧ (q → r). Quantas linhas têm? Identifique se é tautologia, contradição ou contingência.',
    difficulty: 'medio',
    source: 'gerado_topico',
  },
  {
    id: 'mat-003',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Verifique se os argumentos a seguir são válidos: "Todos os programadores são lógicos. Ana é programadora. Logo, Ana é lógica." Use regras de inferência.',
    difficulty: 'medio',
    source: 'gerado_topico',
  },
  {
    id: 'mat-004',
    disciplineCode: 'TEC.1984',
    topic: 'Conjuntos',
    statement:
      'Sejam A = {1, 2, 3, 4, 5} e B = {3, 4, 5, 6, 7}. Calcule A ∪ B, A ∩ B, A - B e B - A. Represente em diagrama de Venn.',
    difficulty: 'facil',
    source: 'gerado_topico',
  },
  {
    id: 'mat-005',
    disciplineCode: 'TEC.1984',
    topic: 'Funções',
    statement:
      'Dada a função f(x) = 2x + 3, determine: f(0), f(1), f(5), e o valor de x tal que f(x) = 11. Classifique como crescente ou decrescente.',
    difficulty: 'facil',
    source: 'gerado_topico',
  },
  {
    id: 'mat-006',
    disciplineCode: 'TEC.1984',
    topic: 'Funções',
    statement:
      'Determine as raízes da função quadrática f(x) = x² - 5x + 6. Identifique as coordenadas do vértice e diga se tem máximo ou mínimo.',
    difficulty: 'medio',
    source: 'gerado_topico',
    hint: 'Bhaskara: x = (-b ± √(b²-4ac)) / 2a. Vértice: x = -b/2a.',
  },

  // ===== Linguagem de Marcação — exercícios práticos do PPC =====
  {
    id: 'lm-001',
    disciplineCode: 'TEC.1632',
    topic: 'HTML — Estrutura básica',
    statement:
      'Crie um arquivo HTML5 completo com DOCTYPE, html, head (com charset, title) e body contendo um h1 com seu nome e um parágrafo de boas-vindas.',
    difficulty: 'facil',
    source: 'gerado_topico',
  },
  {
    id: 'lm-002',
    disciplineCode: 'TEC.1632',
    topic: 'HTML — Listas',
    statement:
      'Crie uma página HTML que liste (em listas ordenadas) os 5 materiais que você precisa estudar esta semana. Use uma lista não-ordenada para as metas de longo prazo.',
    difficulty: 'facil',
    source: 'gerado_topico',
  },
  {
    id: 'lm-003',
    disciplineCode: 'TEC.1632',
    topic: 'HTML — Formulários',
    statement:
      'Crie um formulário HTML com: campo nome (text), email (email), senha (password), idade (number) e um botão submit. Adicione labels adequadas para acessibilidade.',
    difficulty: 'medio',
    source: 'gerado_topico',
  },
  {
    id: 'lm-004',
    disciplineCode: 'TEC.1632',
    topic: 'CSS — Box Model',
    statement:
      'Crie 3 divs e aplique: padding 20px, margin 15px, border 2px solid. Mostre visualmente como o box model se comporta (width/height inclui ou não padding?).',
    difficulty: 'medio',
    source: 'gerado_topico',
  },
  {
    id: 'lm-005',
    disciplineCode: 'TEC.1632',
    topic: 'CSS — Flexbox',
    statement:
      'Crie um header com: logo na esquerda, menu centralizado, e botão "Entrar" na direita — tudo usando Flexbox. Deve ser responsivo.',
    difficulty: 'dificil',
    source: 'gerado_topico',
  },
  {
    id: 'lm-006',
    disciplineCode: 'TEC.1632',
    topic: 'CSS — Grid',
    statement:
      'Crie um layout de galeria com 12 fotos em grid CSS: 4 colunas no desktop, 2 no tablet, 1 no mobile. Use gap de 10px e media queries.',
    difficulty: 'dificil',
    source: 'gerado_topico',
  },
  {
    id: 'lm-007',
    disciplineCode: 'TEC.1632',
    topic: 'Acessibilidade',
    statement:
      'Adicione atributos ARIA em um formulário de login (aria-label, aria-required, aria-describedby para mensagens de erro). Valide no W3C Validator.',
    difficulty: 'medio',
    source: 'gerado_topico',
  },

  // ===== RHT — estudos de caso do PPC =====
  {
    id: 'rht-001',
    disciplineCode: 'TEC.0953',
    topic: 'Introdução às RHT',
    statement:
      'Estudo de caso: uma equipe de TI tem 2 líderes que se desentendem constantemente. Como você aplicaria comunicação interpessoal e liderança para resolver?',
    difficulty: 'medio',
    source: 'gerado_topico',
  },
  {
    id: 'rht-002',
    disciplineCode: 'TEC.0953',
    topic: 'Ética no trabalho',
    statement:
      'Debate: Você descobre que um colega de trabalho está usando a empresa para promover sua própria empresa paralela durante o expediente. Discuta eticamente.',
    difficulty: 'medio',
    source: 'gerado_topico',
  },
  {
    id: 'rht-003',
    disciplineCode: 'TEC.0953',
    topic: 'Modalidades flexíveis de trabalho',
    statement:
      'Pesquise e liste 3 modalidades de trabalho flexível (home office, híbrido, freelancer) e analise vantagens/desvantagens de cada uma para o trabalhador.',
    difficulty: 'facil',
    source: 'gerado_topico',
  },

  // ===== Inglês Instrumental — leitura e estratégias =====
  {
    id: 'ing-001',
    disciplineCode: 'ING.001',
    topic: 'Estratégias de leitura',
    statement:
      'Skimming: leia um artigo de tecnologia em inglês (500 palavras) e escreva em 1 frase qual é a ideia central. Não use dicionário — foque no gist.',
    difficulty: 'facil',
    source: 'gerado_topico',
  },
  {
    id: 'ing-002',
    disciplineCode: 'ING.001',
    topic: 'Cognatos e falsos cognatos',
    statement:
      'Lista de 10 palavras: actual, intend, pretend, parents, library, expert, lecture, dinner, realize, cancel. Identifique quais são falsos cognatos e dê o significado correto.',
    difficulty: 'medio',
    source: 'gerado_topico',
    hint: 'actual ≠ atual, intend ≠ pretende, pretend ≠ pretender, parents ≠ parentes, expert ≠ espera.',
  },
  {
    id: 'ing-003',
    disciplineCode: 'ING.001',
    topic: 'Glossário técnico',
    statement:
      'Monte um glossário pessoal com 15 termos técnicos de TI em inglês que você usaria no dia-a-dia (ex: deploy, commit, branch, merge). Traduza cada um.',
    difficulty: 'facil',
    source: 'gerado_topico',
  },

  // ===== Português Instrumental — produção textual =====
  {
    id: 'port-001',
    disciplineCode: 'PORT.001',
    topic: 'Coesão e coerência',
    statement:
      'Reescreva o parágrafo: "O João foi ao mercado. O João esqueceu o dinheiro. O João voltou para casa." Use conectivos para tornar o texto coeso (mínimo 2 conectivos).',
    difficulty: 'facil',
    source: 'gerado_topico',
  },
  {
    id: 'port-002',
    disciplineCode: 'PORT.001',
    topic: 'Concordância verbal',
    statement:
      'Identifique e corrija os erros de concordância: "Fazem dois anos que estudo aqui. Haviam muitas pessoas na aula. Os alunos vai fazer a prova."',
    difficulty: 'medio',
    source: 'gerado_topico',
  },
];

/**
 * Retorna exercícios por disciplina.
 */
export function getExercisesByDiscipline(code: string): Exercise[] {
  return exercises.filter((e) => e.disciplineCode === code);
}

/**
 * Retorna exercícios por tópico.
 */
export function getExercisesByTopic(topic: string): Exercise[] {
  return exercises.filter((e) => e.topic === topic);
}

/**
 * Lista de tópicos únicos (todos os exercícios).
 */
export function listAllTopics(): string[] {
  return Array.from(new Set(exercises.map((e) => e.topic)));
}

/**
 * Sorteia N exercícios aleatórios (para o "modo simulado").
 * Usa seed simples baseado no dia para não repetir no mesmo dia.
 */
export function pickRandomExercises(n: number, seed: number = Date.now()): Exercise[] {
  if (n <= 0) return []; // entrada inválida → nada a sortear (evita slice negativo)
  // Shuffle deterministic com seed
  const arr = [...exercises];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}

/** Estatística agregada do acervo de exercícios. */
export interface ExerciseStats {
  total: number;
  bySource: Record<Exercise['source'], number>;
  byDifficulty: Record<Exercise['difficulty'], number>;
}

/**
 * Estatística básica dos exercícios — contagem única (sem filtrar o array 7x).
 */
export function getExerciseStats(): ExerciseStats {
  const bySource: Record<Exercise['source'], number> = {
    lista_algoritmos: 0,
    prova_real: 0,
    gerado_topico: 0,
    ia_sugerido: 0,
  };
  const byDifficulty: Record<Exercise['difficulty'], number> = {
    facil: 0,
    medio: 0,
    dificil: 0,
  };
  for (const e of exercises) {
    bySource[e.source] += 1;
    byDifficulty[e.difficulty] += 1;
  }
  return { total: exercises.length, bySource, byDifficulty };
}
