// Exercise extractor (V4 — PADRÃO MATERIAL-FIRST)
// Fontes do acervo, em ordem de confiança:
//  1. Provas reais e listas/questões do professor (source: prova_real, material_professor, lista_algoritmos)
//  2. Exercícios sugeridos extraídos dos RESUMOS IA dos materiais reais
//  3. Exercícios gerados a partir de tópicos do PPC (source: gerado_topico)
//
// Alinhamento com o estado atual da turma: src/lib/curriculum-state.ts
// (usa `unit` + material.topicosCobertos — novos materiais adaptam o site sozinhos).

export interface Exercise {
  id: string;
  disciplineCode: string;
  topic: string; // ex: "Comandos de entrada e saída"
  statement: string; // enunciado
  difficulty: 'facil' | 'medio' | 'dificil';
  source: 'lista_algoritmos' | 'prova_real' | 'gerado_topico' | 'ia_sugerido' | 'material_professor';
  hint?: string;
  // PADRÃO MATERIAL-FIRST: unidade do conteudoProgramatico (course-data)
  // a que o exercício pertence — base do alinhamento "em sala" × "adiantado".
  unit?: string;
  // Materiais reais que sustentam este exercício (ids de course-data.materials).
  linkedMaterials?: string[];
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
    unit: 'Hardware e Software',
    linkedMaterials: ['prova-fund-av1'],
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
    unit: 'Hardware e Software',
    linkedMaterials: ['prova-fund-av1'],
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
    unit: 'Representação de Dados',
    linkedMaterials: ['prova-fund-av1'],
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
    unit: 'Representação de Dados',
    linkedMaterials: ['prova-fund-av1'],
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
    unit: 'Representação de Dados',
    linkedMaterials: ['prova-fund-av1'],
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
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-002',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia três números e seus respectivos pesos e calcule a sua média ponderada.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-003',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia o valor do lado de um quadrado e calcule a sua área e o seu perímetro.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-004',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia um número inteiro positivo e calcule o seu dobro, triplo, quadrado, cubo e raiz quadrada.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-005',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia o valor do raio de uma circunferência e calcule a sua área e o seu comprimento.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-008',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia o valor de uma temperatura em Celsius e calcule o seu valor correspondente em Fahrenheit e em Kelvin.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-010',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement:
      'Escreva um programa que leia o valor dos dois catetos de um triângulo retângulo e calcule o valor da hipotenusa.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-lista'],
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
    unit: 'Unidade 2: Desvios condicionais',
    linkedMaterials: ['alg-lista'],
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
    unit: 'Unidade 2: Desvios condicionais',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-061',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia um número inteiro e determine o seu valor absoluto (sem usar funções prontas).',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 2: Desvios condicionais',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-064',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia um número inteiro e verifique se ele é positivo, negativo ou neutro (zero).',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 2: Desvios condicionais',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-065',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia a idade de uma pessoa e classifique: criança (0-12), adolescente (13-17), adulta (18-59) ou idosa (60+).',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 2: Desvios condicionais',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-067',
    disciplineCode: 'TEC.1687',
    topic: 'Desvios condicionais',
    statement:
      'Escreva um programa que leia o valor de um ano e verifique se ele é ou não bissexto. Bissexto: divisível por 400 OU (divisível por 4 e não por 100).',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 2: Desvios condicionais',
    linkedMaterials: ['alg-lista'],
  },

  // ===== Questões da Semana 1 (Classroom do Prof. Fábio — entrada/saída e aritmética em C) =====
  {
    id: 'alg-s1q1',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q1 (Semana 1): Escreva um programa que leia um número inteiro e informe o seu antecessor e o seu sucessor.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana1'],
    hint: 'Leia com scanf("%d", &n); antecessor = n - 1; sucessor = n + 1.',
  },
  {
    id: 'alg-s1q2',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q2 (Semana 1): Escreva um programa que leia o valor da base e da altura de um triângulo e calcule a sua área.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana1'],
    hint: 'Área = (base * altura) / 2. Use float/double e printf com %.2f.',
  },
  {
    id: 'alg-s1q3',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q3 (Semana 1): Escreva um programa que leia o valor de uma temperatura em Celsius e calcule o seu valor correspondente em Fahrenheit e em Kelvin.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana1'],
    hint: 'F = C * 9.0 / 5.0 + 32; K = C + 273.15. Cuidado com divisão inteira: use 9.0/5.0.',
  },
  {
    id: 'alg-s1q4',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q4 (Semana 1): Escreva um programa que leia o valor de uma distância percorrida em km e o tempo gasto em horas e calcule a velocidade média em m/s.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana1'],
    hint: 'v(m/s) = (km * 1000) / (horas * 3600). Converta as unidades antes de dividir.',
  },
  {
    id: 'alg-s1q5',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q5 (Semana 1): Escreva um programa que leia um valor em polegadas e o converta para centímetros, considerando que uma polegada equivale a 2.54 cm.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana1'],
    hint: 'cm = polegadas * 2.54.',
  },
  {
    id: 'alg-s1q6',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q6 (Semana 1): Escreva um programa que leia o valor do seno de um ângulo e calcule o valor absoluto do cosseno.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana1'],
    hint: 'sen²(x) + cos²(x) = 1 → cos = sqrt(1 - sen*sen). Use fabs() de math.h (compile com -lm).',
  },
  {
    id: 'alg-s1q7',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q7 (Semana 1): Em uma determinada cidade, cada m² de um terreno está avaliado em R$ 300,00. Escreva um programa que leia o comprimento e a largura de um terreno localizado nesta cidade e calcule o seu valor de mercado.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana1'],
    hint: 'valor = comprimento * largura * 300.0.',
  },
  {
    id: 'alg-s1q8',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Q8 (Semana 1): Escreva um programa que leia o termo inicial e a razão de uma progressão aritmética e imprima os 5 primeiros termos desta progressão.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-questoes-semana1'],
    hint: 'Termo n = a1 + (n-1)*r. Imprima com um for de n = 1 a 5 (ou vá somando a razão a cada passo).',
  },

  // ===== Questões da Semana 2 (Classroom do Prof. Fábio — 19/09) =====
  {
    id: 'alg-s2q1',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q1 (Semana 2): Escreva um programa que leia o valor total que um cliente consumiu em um restaurante e determine o valor final da sua conta, considerando que o restaurante cobra uma taxa de serviço de 10% e uma taxa de couvert artístico de R$ 10,00.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'conta = consumo * 1.10 + 10.00. A taxa ACRESCENTA (× 1.10), e o couvert é fixo. Use double e %.2f.',
  },
  {
    id: 'alg-s2q2',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Q2 (Semana 2): Escreva um programa que leia um número inteiro N e imprima os 10 primeiros elementos da sua tabuada. A saída deve seguir o formato "1 X 2 = 2", "2 X 2 = 4", etc.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'for (i = 1; i <= 10; i++) printf("%d X %d = %d\\n", i, n, i * n); — atenção ao formato exato da saída.',
  },
  {
    id: 'alg-s2q3',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q3 (Semana 2): Escreva um programa que leia o número total de questões existentes em uma prova e o número de questões que um candidato acertou e determine o seu percentual de acertos e o seu percentual de erros.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'perc = acertos * 100.0 / total. Erros = total - acertos. Cuidado com divisão inteira: force 100.0.',
  },
  {
    id: 'alg-s2q4',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q4 (Semana 2): Escreva um programa que leia os valores das coordenadas X e Y de dois pontos P e Q e determine a distância entre estes dois pontos, usando a distância euclidiana.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'd = sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2)); — inclua math.h e compile com -lm.',
  },
  {
    id: 'alg-s2q5',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q5 (Semana 2): Escreva um programa que leia o nome e a quantidade de votos recebidos por cada um dos três candidatos a prefeito de uma cidade e calcule o percentual de votos recebidos por cada candidato. Considere que não houve votos brancos nem nulos.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'Total = v1 + v2 + v3. Percentual de cada um = votos * 100.0 / total. Leia os nomes com scanf("%s") (sem espaços).',
  },
  {
    id: 'alg-s2q6',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q6 (Semana 2): Escreva um programa que leia o tamanho de um arquivo em MB e a taxa de transmissão da rede em KB/s e calcule o tempo aproximado necessário para a transmissão do arquivo, na forma "X horas, Y minutos e Z segundos". Considere 1 MB = 1024 KB e valores inteiros.',
    difficulty: 'dificil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 't (segundos) = MB * 1024 / taxa. Depois: h = t/3600; m = (t%3600)/60; s = t%60 — divisão inteira e módulo.',
  },
  {
    id: 'alg-s2q7',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q7 (Semana 2): Escreva um programa que leia a quantidade de horas trabalhadas por um funcionário durante um mês e o valor de cada hora trabalhada e determine o seu pagamento. A carga-horária mensal é de 160 horas e cada hora extra (acima de 160) corresponde ao valor da hora acrescido de uma taxa de 50%. Considere que a quantidade de horas nunca será inferior a 160.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'pagamento = 160 * valor + (horas - 160) * valor * 1.5. Só o que excede as 160h recebe os 50% extras.',
  },
  {
    id: 'alg-s2q8',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q8 (Semana 2): Escreva um programa que leia os dois últimos valores da leitura de um medidor de energia em KWh e calcule o valor da conta de energia, considerando: preço de 1 KWh é R$ 0,35, ICMS corresponde a 17% do valor do consumo e a taxa de iluminação pública é de R$ 15,00.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'consumo = leituraAtual - leituraAnterior; conta = consumo * 0.35 * 1.17 + 15.00 (ICMS incide sobre o consumo; iluminação é fixa).',
  },
  {
    id: 'alg-s2q9',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Q9 (Semana 2): Um banco financia qualquer valor em 5 prestações. A primeira prestação corresponde a 20% do valor do empréstimo e as demais correspondem ao valor da parcela anterior acrescido de uma taxa de juros de 7%. Escreva um programa que leia o valor a ser financiado e calcule: o valor de cada prestação, o valor total que o cliente vai pagar e o total de juros.',
    difficulty: 'dificil',
    source: 'lista_algoritmos',
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'parcela = valor * 0.20; para as demais: parcela = parcela * 1.07. Acumule o total num for de 5 iterações; juros = total - valor.',
  },
  {
    id: 'alg-s2q10',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de entrada e saída',
    statement: 'Q10 (Semana 2): Em um aeroporto há 5 guichês numerados de 1 a 5 para check-in, cada check-in leva exatamente 15 minutos e os guichês começam no instante em que Carlos entra na fila. Escreva um programa que leia a posição de Carlos na fila (inteiro positivo) e determine o número do guichê no qual ele será atendido e o tempo que ele vai esperar para ser atendido.',
    difficulty: 'dificil',
    source: 'lista_algoritmos',
    unit: 'Unidade 1: Noções de algoritmos e programação',
    linkedMaterials: ['alg-questoes-semana2'],
    hint: 'guiche = ((p - 1) % 5) + 1; espera = (p - 1) / 5 * 15 minutos. Teste: p=6 → guichê 1, espera 15 min.',
  },

  // ===== Lista de Exercícios de Algoritmos — Comandos de repetição =====
  {
    id: 'alg-098',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Escreva um programa que imprima todos os números inteiros entre 1 e 100 em ordem ascendente.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-lista'],
    hint: 'Use for com i de 1 a 100.',
  },
  {
    id: 'alg-099',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Escreva um programa que imprima todos os números inteiros entre 1 e 100 em ordem descendente.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-100',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement:
      'Escreva um programa que leia um número inteiro positivo N e imprima os N primeiros números pares positivos.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-103',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement: 'Escreva um programa que leia um número inteiro N e verifique se ele é um número primo.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-lista'],
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
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-105',
    disciplineCode: 'TEC.1687',
    topic: 'Comandos de repetição',
    statement:
      'Escreva um programa que leia dois números inteiros M e N e calcule a soma de todos os números do intervalo [M, N].',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 3: Comandos de repetição',
    linkedMaterials: ['alg-lista'],
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
    unit: 'Unidade 4: Vetores',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-159',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia dez números inteiros e imprima todos na ordem inversa em que foram digitados.',
    difficulty: 'facil',
    source: 'lista_algoritmos',
    unit: 'Unidade 4: Vetores',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-161',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia um vetor de 10 inteiros e um número N e imprima todos os elementos maiores que N.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 4: Vetores',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-163',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia um vetor de 10 inteiros e imprima todos os elementos maiores que a média aritmética de todos os elementos.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 4: Vetores',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-167',
    disciplineCode: 'TEC.1687',
    topic: 'Vetores e matrizes',
    statement:
      'Escreva um programa que leia um número inteiro entre 0 e 255 e calcule o seu valor correspondente em binário (armazenando os bits em um vetor).',
    difficulty: 'dificil',
    source: 'lista_algoritmos',
    unit: 'Unidade 4: Vetores',
    linkedMaterials: ['alg-lista'],
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
    unit: 'Unidade 5: Modularização de programas',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-201',
    disciplineCode: 'TEC.1687',
    topic: 'Modularização de programas',
    statement:
      'Escreva uma função que receba um número inteiro e retorne 1 se for primo, 0 caso contrário. Use-a para imprimir todos os primos entre 1 e 100.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 5: Modularização de programas',
    linkedMaterials: ['alg-lista'],
  },
  {
    id: 'alg-202',
    disciplineCode: 'TEC.1687',
    topic: 'Modularização de programas',
    statement:
      'Escreva um procedimento que receba um vetor de 10 inteiros e imprima-o em ordem inversa.',
    difficulty: 'medio',
    source: 'lista_algoritmos',
    unit: 'Unidade 5: Modularização de programas',
    linkedMaterials: ['alg-lista'],
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
    unit: 'Unidade 5: Modularização de programas',
    linkedMaterials: ['alg-lista'],
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
    unit: 'Unidade 5: Modularização de programas',
    linkedMaterials: ['alg-lista'],
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
    unit: 'Unidade 5: Modularização de programas',
    linkedMaterials: ['alg-lista'],
  },

  {
    id: 'lm-pratica-pizza',
    disciplineCode: 'TEC.1632',
    topic: 'HTML — Formulários',
    statement:
      'PRÁTICA DA AULA 06: construa um formulário para um usuário fazer o pedido de uma pizza. O formulário deve ter: sabor da pizza (em um select) e quantidade (input tipo number); tamanho da pizza (em um input tipo "radio"); adicionais (quantos quiser, em inputs tipo "checkbox"); bebida (em um select) e quantidade (input tipo number); endereço de entrega (em um textarea). Além disso, insira botões do tipo "reset" e "submit" para limpar e enviar o formulário.',
    difficulty: 'medio',
    source: 'material_professor',
    unit: 'HTML',
    linkedMaterials: ['lm-html-06-formularios', 'lm-exemplo-formularios'],
    hint: 'Radios do mesmo grupo compartilham o mesmo name; checkboxes têm names distintos. Cada campo em uma <div> com <label> associada (for + id) — igual ao exemplo index.html da Biblioteca.',
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
    unit: '1. Álgebra Matricial',
  },
  {
    id: 'mat-002',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Construa a tabela verdade da proposição composta p ∧ (q → r). Quantas linhas têm? Identifique se é tautologia, contradição ou contingência.',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: '2. Lógica Matemática',
  },
  {
    id: 'mat-003',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Verifique se os argumentos a seguir são válidos: "Todos os programadores são lógicos. Ana é programadora. Logo, Ana é lógica." Use regras de inferência.',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: '2. Lógica Matemática',
  },
  {
    id: 'mat-004',
    disciplineCode: 'TEC.1984',
    topic: 'Conjuntos',
    statement:
      'Sejam A = {1, 2, 3, 4, 5} e B = {3, 4, 5, 6, 7}. Calcule A ∪ B, A ∩ B, A - B e B - A. Represente em diagrama de Venn.',
    difficulty: 'facil',
    source: 'gerado_topico',
    unit: '3. Conjuntos',
  },
  {
    id: 'mat-005',
    disciplineCode: 'TEC.1984',
    topic: 'Funções',
    statement:
      'Dada a função f(x) = 2x + 3, determine: f(0), f(1), f(5), e o valor de x tal que f(x) = 11. Classifique como crescente ou decrescente.',
    difficulty: 'facil',
    source: 'gerado_topico',
    unit: '4. Funções',
  },
  {
    id: 'mat-006',
    disciplineCode: 'TEC.1984',
    topic: 'Funções',
    statement:
      'Determine as raízes da função quadrática f(x) = x² - 5x + 6. Identifique as coordenadas do vértice e diga se tem máximo ou mínimo.',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: '4. Funções',
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
    unit: 'HTML',
  },
  {
    id: 'lm-002',
    disciplineCode: 'TEC.1632',
    topic: 'HTML — Listas',
    statement:
      'Crie uma página HTML que liste (em listas ordenadas) os 5 materiais que você precisa estudar esta semana. Use uma lista não-ordenada para as metas de longo prazo.',
    difficulty: 'facil',
    source: 'gerado_topico',
    unit: 'HTML',
  },
  {
    id: 'lm-003',
    disciplineCode: 'TEC.1632',
    topic: 'HTML — Formulários',
    statement:
      'Crie um formulário HTML com: campo nome (text), email (email), senha (password), idade (number) e um botão submit. Adicione labels adequadas para acessibilidade.',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: 'HTML',
  },
  {
    id: 'lm-004',
    disciplineCode: 'TEC.1632',
    topic: 'CSS — Box Model',
    statement:
      'Crie 3 divs e aplique: padding 20px, margin 15px, border 2px solid. Mostre visualmente como o box model se comporta (width/height inclui ou não padding?).',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: 'CSS',
  },
  {
    id: 'lm-005',
    disciplineCode: 'TEC.1632',
    topic: 'CSS — Flexbox',
    statement:
      'Crie um header com: logo na esquerda, menu centralizado, e botão "Entrar" na direita — tudo usando Flexbox. Deve ser responsivo.',
    difficulty: 'dificil',
    source: 'gerado_topico',
    unit: 'CSS',
  },
  {
    id: 'lm-006',
    disciplineCode: 'TEC.1632',
    topic: 'CSS — Grid',
    statement:
      'Crie um layout de galeria com 12 fotos em grid CSS: 4 colunas no desktop, 2 no tablet, 1 no mobile. Use gap de 10px e media queries.',
    difficulty: 'dificil',
    source: 'gerado_topico',
    unit: 'CSS',
  },
  {
    id: 'lm-007',
    disciplineCode: 'TEC.1632',
    topic: 'Acessibilidade',
    statement:
      'Adicione atributos ARIA em um formulário de login (aria-label, aria-required, aria-describedby para mensagens de erro). Valide no W3C Validator.',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: 'HTML',
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
    unit: 'II. Trabalho humano no Brasil',
  },
  {
    id: 'rht-002',
    disciplineCode: 'TEC.0953',
    topic: 'Ética no trabalho',
    statement:
      'Debate: Você descobre que um colega de trabalho está usando a empresa para promover sua própria empresa paralela durante o expediente. Discuta eticamente.',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: 'III. Ética no trabalho',
  },
  {
    id: 'rht-003',
    disciplineCode: 'TEC.0953',
    topic: 'Modalidades flexíveis de trabalho',
    statement:
      'Pesquise e liste 3 modalidades de trabalho flexível (home office, híbrido, freelancer) e analise vantagens/desvantagens de cada uma para o trabalhador.',
    difficulty: 'facil',
    source: 'gerado_topico',
    unit: 'II. Trabalho humano no Brasil',
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
    unit: 'Leitura e estratégias',
  },
  {
    id: 'ing-002',
    disciplineCode: 'ING.001',
    topic: 'Cognatos e falsos cognatos',
    statement:
      'Lista de 10 palavras: actual, intend, pretend, parents, library, expert, lecture, dinner, realize, cancel. Identifique quais são falsos cognatos e dê o significado correto.',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: 'Leitura e estratégias',
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
    unit: 'Leitura e estratégias',
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
    unit: 'Compreensão e produção textual',
  },
  {
    id: 'port-002',
    disciplineCode: 'PORT.001',
    topic: 'Concordância verbal',
    statement:
      'Identifique e corrija os erros de concordância: "Fazem dois anos que estudo aqui. Haviam muitas pessoas na aula. Os alunos vai fazer a prova."',
    difficulty: 'medio',
    source: 'gerado_topico',
    unit: 'Norma culta',
  },

  // ===== PROVA DE MATEMÁTICA — Av1 (01/10) =====
  // Extraídos dos materiais REAIS: mat-00-matrizes (aula 00), mat-01-matrizes
  // (lista), mat-logica-slides (47p) e mat-logica-lista. Nada aqui foge do
  // que está nos PDFs — é o simulado da prova no ritmo exato da turma.
  {
    id: 'mat-ex01',
    disciplineCode: 'TEC.1984',
    topic: 'Álgebra Matricial',
    statement:
      'Considere a matriz A = [[3, -1, 2], [0, 4, 5]]. a) Qual é a ordem de A? b) Escreva a22 e a31. c) Monte B trocando as linhas de A e diga se B = A.',
    difficulty: 'facil',
    source: 'material_professor',
    hint: 'Ordem = linhas × colunas (2×3). aij: linha i, coluna j — a31 não existe em A.',
    unit: '1. Álgebra Matricial',
    linkedMaterials: ['mat-00-matrizes', 'mat-01-matrizes'],
  },
  {
    id: 'mat-ex02',
    disciplineCode: 'TEC.1984',
    topic: 'Álgebra Matricial',
    statement:
      'Sejam A = [[2, 1], [3, 4]] e B = [[0, 5], [1, 2]]. Calcule: a) A + B; b) 3A; c) A·B (confira antes se a multiplicação é possível).',
    difficulty: 'facil',
    source: 'material_professor',
    hint: 'Soma elemento a elemento. Escalar multiplica todos os aij. Produto: linhas de A (2) × colunas de B (2) → possível; calcule aij = Σ aik·bkj.',
    unit: '1. Álgebra Matricial',
    linkedMaterials: ['mat-00-matrizes'],
  },
  {
    id: 'mat-ex03',
    disciplineCode: 'TEC.1984',
    topic: 'Álgebra Matricial',
    statement:
      'Dadas A (2×3) e B (3×2), calcule AB e BA. Os resultados têm a mesma ordem? Existe algum caso em que AB = BA? Justifique.',
    difficulty: 'medio',
    source: 'material_professor',
    hint: 'AB é 2×2 e BA é 3×3 — ordens diferentes já mostram que produto de matrizes não é comutativo.',
    unit: '1. Álgebra Matricial',
    linkedMaterials: ['mat-00-matrizes', 'mat-01-matrizes'],
  },
  {
    id: 'mat-ex04',
    disciplineCode: 'TEC.1984',
    topic: 'Álgebra Matricial',
    statement:
      'Dada A = [[1, 2], [2, 5]], encontre Aᵀ e verifique se A é simétrica. Depois construa uma matriz 2×2 antissimétrica e observe sua diagonal.',
    difficulty: 'medio',
    source: 'material_professor',
    hint: 'Aᵀij = Aji. Simétrica: A = Aᵀ. Antissimétrica: Aᵀ = -A ⇒ a diagonal é toda zero.',
    unit: '1. Álgebra Matricial',
    linkedMaterials: ['mat-01-matrizes'],
  },
  {
    id: 'mat-ex05',
    disciplineCode: 'TEC.1984',
    topic: 'Álgebra Matricial',
    statement:
      'Para A = [[3, 1], [2, 1]]: a) calcule det(A); b) encontre A⁻¹ pela fórmula adj(A)/det(A); c) confirme multiplicando A·A⁻¹ = I.',
    difficulty: 'medio',
    source: 'material_professor',
    hint: 'det 2×2 = ad - bc = 3·1 - 1·2 = 1. A⁻¹ = (1/det)·[[d, -b], [-c, a]]. Se det = 0, a matriz NÃO tem inversa.',
    unit: '1. Álgebra Matricial',
    linkedMaterials: ['mat-00-matrizes'],
  },
  {
    id: 'mat-ex06',
    disciplineCode: 'TEC.1984',
    topic: 'Álgebra Matricial',
    statement:
      'Resolva o sistema { x + y = 5; 2x - y = 1 } escrevendo-o na forma matricial AX = B e aplicando X = A⁻¹B. Confira a solução no sistema original.',
    difficulty: 'dificil',
    source: 'material_professor',
    hint: 'A = [[1, 1], [2, -1]], det(A) = -3. X = A⁻¹B com B = [5, 1]. Solução esperada: x = 2, y = 3.',
    unit: '1. Álgebra Matricial',
    linkedMaterials: ['mat-01-matrizes'],
  },
  {
    id: 'mat-ex07',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Classifique como proposição ou não, e dê o valor lógico das que forem: "2 + 2 = 4"; "x + 3 = 5"; "Estude matemática!"; "O número 13 é primo"; "Esta frase é falsa".',
    difficulty: 'facil',
    source: 'material_professor',
    hint: 'Proposição = frase declarativa com valor V ou F bem definido. Sentença aberta (x+3=5), imperativa e paradoxo não são proposições.',
    unit: '2. Lógica Matemática',
    linkedMaterials: ['mat-logica-slides', 'mat-logica-lista'],
  },
  {
    id: 'mat-ex08',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Construa a negação das proposições: "5 > 3"; "10 é par"; "3 é divisor de 12". Em seguida, traduza para símbolos: "p e q" e "p ou q", atribuindo valores quando p = V e q = F.',
    difficulty: 'facil',
    source: 'material_professor',
    hint: '¬(5 > 3) é "5 ≤ 3" (F). Conjunção p ∧ q é F se algum for F; disjunção p ∨ q é V se algum for V.',
    unit: '2. Lógica Matemática',
    linkedMaterials: ['mat-logica-slides'],
  },
  {
    id: 'mat-ex09',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Construa a tabela-verdade completa de (p → q) ∧ (q → p). Quantas linhas tem? Em quais combinações a proposição é verdadeira?',
    difficulty: 'medio',
    source: 'material_professor',
    hint: '2 variáveis → 2² = 4 linhas. A bicondicional p ↔ q é equivalente a essa conjunção: V só quando p e q têm o mesmo valor.',
    unit: '2. Lógica Matemática',
    linkedMaterials: ['mat-logica-slides', 'mat-logica-lista'],
  },
  {
    id: 'mat-ex10',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Classifique como tautologia, contradição ou contingência: a) p ∨ ¬p; b) p ∧ ¬p; c) (p → q) ∧ p; d) (p ∧ q) → p.',
    difficulty: 'medio',
    source: 'material_professor',
    hint: 'Tautologia: sempre V (a). Contradição: sempre F (b). c é contingência e é o esquema do modus ponens; d é tautologia.',
    unit: '2. Lógica Matemática',
    linkedMaterials: ['mat-logica-lista'],
  },
  {
    id: 'mat-ex11',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Mostre por tabela-verdade que ¬(p ∧ q) ≡ ¬p ∨ ¬q (De Morgan). Depois use o resultado para negar: "o aluno estudou E passou".',
    difficulty: 'medio',
    source: 'material_professor',
    hint: 'Compare coluna a coluna: as duas proposições têm a mesma tabela em todas as 4 linhas ⇒ equivalentes.',
    unit: '2. Lógica Matemática',
    linkedMaterials: ['mat-logica-slides', 'mat-logica-lista'],
  },
  {
    id: 'mat-ex12',
    disciplineCode: 'TEC.1984',
    topic: 'Lógica Matemática',
    statement:
      'Verifique se o argumento é válido: premissas "Se chove, então a prova é adiada" e "Chove"; conclusão "A prova é adiada". Justifique com o esquema da regra usada.',
    difficulty: 'dificil',
    source: 'material_professor',
    hint: 'É o Modus Ponens: p → q, p ⊢ q. Válido sempre: com as duas premissas verdadeiras a conclusão não pode ser F.',
    unit: '2. Lógica Matemática',
    linkedMaterials: ['mat-logica-lista'],
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
    material_professor: 0,
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
