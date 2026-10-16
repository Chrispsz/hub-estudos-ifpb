/**
 * Lab de Código — Biblioteca de exemplos do material
 * ---------------------------------------------------
 * Programas curtos alinhados às unidades de Algoritmos (TEC.1687) e extras
 * que o curso cobra. Cada exemplo mostra o "o quê" e "por que" — o dono
 * roda, avança passo a passo e observa variáveis/memória/saída.
 */

export interface ClabExample {
  id: string;
  titulo: string;
  grupo: 'Unidade 1' | 'Unidade 2' | 'Funções & extras';
  descricao: string;
  code: string;
  stdin?: string;
}

export const CLAB_EXAMPLES: ClabExample[] = [
  {
    id: 'ola',
    titulo: 'Olá, C!',
    grupo: 'Unidade 1',
    descricao: 'O primeiro programa: printf e o \\n que pula linha.',
    code: `#include <stdio.h>

// O primeiro programa de todo programador :)
int main() {
    printf("Ola, C!\\n");
    printf("Bem-vindo ao Lab de Codigo.\\n");
    return 0;
}
`,
  },
  {
    id: 'variaveis',
    titulo: 'Variáveis e tipos',
    grupo: 'Unidade 1',
    descricao: 'int, float, double, char — veja cada valor e endereço na memória.',
    code: `#include <stdio.h>

// Variaveis e tipos: acompanhe cada valor na memoria, passo a passo
int main() {
    int idade = 19;
    float altura = 1.75;
    double pi = 3.14159;
    char inicial = 'M';

    int anos = idade + 5;        // soma de inteiros
    altura = altura + 0.05;      // atualiza o float

    printf("Idade: %d\\n", idade);
    printf("Altura: %.2f\\n", altura);
    printf("Inicial: %c\\n", inicial);
    printf("Pi vale %g\\n", pi);
    return 0;
}
`,
  },
  {
    id: 'scanf-soma',
    titulo: 'Entrada com scanf',
    grupo: 'Unidade 1',
    descricao: 'Ler dois números e somar. Preencha o painel Entrada (ex.: 7 e 5).',
    stdin: '7 5',
    code: `#include <stdio.h>

// Leia dois numeros e mostre a soma
// Preencha o painel "Entrada" com: 7 5   (ou um por linha)
int main() {
    int a, b, soma;

    printf("Digite dois numeros: ");
    scanf("%d", &a);
    scanf("%d", &b);

    soma = a + b;
    printf("%d + %d = %d\\n", a, b, soma);
    return 0;
}
`,
  },
  {
    id: 'condicoes',
    titulo: 'Condições: aprovação',
    grupo: 'Unidade 1',
    descricao: 'if / else if / else com a média da disciplina (corte em 6).',
    code: `#include <stdio.h>

// if / else if / else: media da disciplina
int main() {
    float media = 7.3;

    if (media >= 6.0) {
        printf("Aprovado com %.1f\\n", media);
    } else if (media >= 4.0) {
        printf("Recuperacao com %.1f\\n", media);
    } else {
        printf("Reprovado com %.1f\\n", media);
    }
    return 0;
}
`,
  },
  {
    id: 'operadores',
    titulo: 'Divisão inteira vs. real',
    grupo: 'Unidade 1',
    descricao: '5/2 dá 2 em int, mas 5.0/2 dá 2.5 — a pegadinha clássica da prova.',
    code: `#include <stdio.h>

// A pegadinha da prova: divisao inteira vs. real
int main() {
    int a = 5, b = 2;
    float r1 = a / b;          // int / int  -> trunca!
    float r2 = 5.0 / 2;        // tem float -> divide de verdade
    float r3 = (float) a / b;  // cast resolve
    int resto = a % b;         // resto da divisao

    printf("a / b      = %.1f  (inteira!)\\n", r1);
    printf("5.0 / 2    = %.1f\\n", r2);
    printf("(float)a/b = %.1f\\n", r3);
    printf("5 %% 2      = %d\\n", resto);
    return 0;
}
`,
  },
  {
    id: 'tabuada',
    titulo: 'Laço for: tabuada',
    grupo: 'Unidade 2',
    descricao: 'O for clássico: init, condição, corpo e passo — tudo visível.',
    code: `#include <stdio.h>

// laco for: a tabuada do 7
int main() {
    int n = 7;
    int i;

    for (i = 1; i <= 10; i++) {
        printf("%d x %2d = %2d\\n", n, i, n * i);
    }
    return 0;
}
`,
  },
  {
    id: 'while-soma',
    titulo: 'Laço while: soma até 0',
    grupo: 'Unidade 2',
    descricao: 'while com sentinela: soma números até o usuário digitar 0.',
    stdin: '5 10 3 0',
    code: `#include <stdio.h>

// laco while: soma numeros ate digitar 0 (sentinela)
int main() {
    int n, soma = 0;

    printf("Digite valores (0 para parar):\\n");
    scanf("%d", &n);

    while (n != 0) {
        soma = soma + n;
        scanf("%d", &n);
    }

    printf("Soma total: %d\\n", soma);
    return 0;
}
`,
  },
  {
    id: 'vetor-media',
    titulo: 'Vetor: média da turma',
    grupo: 'Unidade 2',
    descricao: 'Percorrer um vetor com for e acumular — veja as células mudando.',
    code: `#include <stdio.h>

// vetores: media das notas da turma
int main() {
    float notas[5] = {7.5, 8.0, 6.25, 9.0, 5.5};
    float soma = 0.0;
    int i;

    for (i = 0; i < 5; i++) {
        soma = soma + notas[i];
    }

    printf("Media da turma: %.2f\\n", soma / 5);
    return 0;
}
`,
  },
  {
    id: 'bubble',
    titulo: 'Bubble sort',
    grupo: 'Funções & extras',
    descricao: 'Ordenação por trocas: veja o vetor se reorganizar passo a passo.',
    code: `#include <stdio.h>

// bubble sort: veja o vetor sendo trocado passo a passo
int main() {
    int v[5] = {64, 25, 12, 90, 8};
    int i, j, aux;

    for (i = 0; i < 4; i++) {
        for (j = 0; j < 4 - i; j++) {
            if (v[j] > v[j + 1]) {
                aux = v[j];
                v[j] = v[j + 1];
                v[j + 1] = aux;
            }
        }
    }

    for (i = 0; i < 5; i++) {
        printf("%d ", v[i]);
    }
    printf("\\n");
    return 0;
}
`,
  },
  {
    id: 'funcao-area',
    titulo: 'Função com retorno',
    grupo: 'Funções & extras',
    descricao: 'Parâmetros e return: entre na função e veja a pilha de escopos.',
    code: `#include <stdio.h>

// funcao com parametros e retorno
float areaRetangulo(float base, float altura) {
    float area = base * altura;
    return area;
}

int main() {
    float a = areaRetangulo(3.5, 2.0);  // chamada: entre nela!
    printf("Area: %.2f\\n", a);
    return 0;
}
`,
  },
  {
    id: 'recursao',
    titulo: 'Recursão: fatorial',
    grupo: 'Funções & extras',
    descricao: 'A pilha de chamadas cresce e volta — veja main → fatorial(5) → ... → fatorial(1).',
    code: `#include <stdio.h>

// recursao: o empilhamento de chamadas aparece na pilha!
int fatorial(int n) {
    int resultado;

    if (n <= 1) {
        return 1;
    }

    resultado = fatorial(n - 1);  // chamada como instrucao: passo a passo
    return resultado * n;
}

int main() {
    int f = fatorial(5);
    printf("5! = %d\\n", f);
    return 0;
}
`,
  },
  {
    id: 'strings-vogais',
    titulo: 'String: contar vogais',
    grupo: 'Funções & extras',
    descricao: 'char[] com o \\0 no fim: percorra letra por letra.',
    code: `#include <stdio.h>

// strings: contar vogais de um texto
int main() {
    char texto[] = "algoritmos";
    int i, vogais = 0;

    for (i = 0; texto[i] != '\\0'; i++) {
        if (texto[i]=='a' || texto[i]=='e' || texto[i]=='i' || texto[i]=='o' || texto[i]=='u') {
            vogais = vogais + 1;
        }
    }

    printf("%s tem %d vogais\\n", texto, vogais);
    return 0;
}
`,
  },
  {
    id: 'strings-senha',
    titulo: 'strlen e strcmp',
    grupo: 'Funções & extras',
    descricao: 'Comparar texto NUNCA é == — é strcmp. Teste digitando a senha no painel Entrada.',
    stdin: 'aberto',
    code: `#include <stdio.h>
#include <string.h>

// funcoes de string: strlen e strcmp
int main() {
    char senha[] = "aberto";
    char tentativa[20];

    printf("Digite a senha: ");
    scanf("%s", tentativa);

    if (strcmp(senha, tentativa) == 0) {
        printf("Acesso liberado (%d letras)\\n", strlen(senha));
    } else {
        printf("Senha errada\\n");
    }
    return 0;
}
`,
  },
  {
    id: 'matriz',
    titulo: 'Matriz 3x3: diagonal',
    grupo: 'Funções & extras',
    descricao: 'Vetor de vetores: a diagonal principal em m[i][i].',
    code: `#include <stdio.h>

// matriz 3x3: soma da diagonal principal
int main() {
    int m[3][3] = {
        {1, 2, 3},
        {4, 5, 6},
        {7, 8, 9}
    };
    int i, soma = 0;

    for (i = 0; i < 3; i++) {
        soma = soma + m[i][i];
    }

    printf("Diagonal: %d\\n", soma);
    return 0;
}
`,
  },
  {
    id: 'switch-menu',
    titulo: 'Switch: menu',
    grupo: 'Funções & extras',
    descricao: 'case, break e default — e o que acontece sem o break.',
    code: `#include <stdio.h>

// switch: menu de opcoes (troque a opcao e rode de novo!)
int main() {
    int opcao = 2;

    switch (opcao) {
        case 1:
            printf("Novo arquivo\\n");
            break;
        case 2:
            printf("Abrir arquivo\\n");
            break;
        case 3:
            printf("Salvar arquivo\\n");
            break;
        default:
            printf("Opcao invalida\\n");
    }
    return 0;
}
`,
  },
  {
    id: 'globais',
    titulo: 'Variável global',
    grupo: 'Funções & extras',
    descricao: 'Globais moram no escopo global e são vistas por todas as funções.',
    code: `#include <stdio.h>

// variavel global: vista por todas as funcoes
int contador = 0;

void somar(int n) {
    contador = contador + n;   // mexe na global
}

int main() {
    somar(5);
    somar(7);
    printf("Contador global: %d\\n", contador);
    return 0;
}
`,
  },
];
