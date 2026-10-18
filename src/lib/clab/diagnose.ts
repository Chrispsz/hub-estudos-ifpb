/**
 * Lab de Código — Diagnóstico didático de erros
 * ----------------------------------------------
 * O dono pediu (áudio 18/10/2026): "além de só executar e ter uma falha na
 * cara", um acompanhamento que mostre o que aconteceu e ONDE ele erra mais.
 *
 * Estas funções são PURAS: recebem a mensagem original do parser/interpretador
 * (que já é pedagógica, em pt-BR) e devolvem:
 *   1. `diagnoseClabError`  → UMA dica curta de causa provável;
 *   2. `categorizeClabError` → a categoria do erro para o painel
 *      "Onde você erra mais" (ver error-stats.ts).
 *
 * A tabela de regras é compartilhada: dica e categoria nascem do mesmo casamento
 * de padrão, então o card e o painel nunca discordam. Ordem importa — padrões
 * mais específicos (scanf/printf) vêm antes dos genéricos (texto, &).
 */

export type ErrCategory = 'sintaxe' | 'variavel' | 'tipo' | 'laco' | 'io' | 'outro';

interface DiagnoseRule {
  re: RegExp;
  cat: ErrCategory;
  hint: string;
}

const RULES: DiagnoseRule[] = [
  // ── laços e repetição (a "parte lógica" que o dono quer desenvolver)
  {
    re: /laço infinito|passou de \d+ passos/i,
    cat: 'laco',
    hint: 'O laço nunca chega ao fim: confira se a condição de parada pode virar falsa e se o contador muda DENTRO do laço (ex.: i++).',
  },
  {
    re: /recursão muito profunda|caso base/i,
    cat: 'laco',
    hint: 'A função chama a si mesma sem parar: falta o caso base — a condição que encerra a recursão.',
  },
  {
    re: /break só funciona|continue só funciona/i,
    cat: 'laco',
    hint: 'break e continue só agem dentro de um laço (for, while, do) ou switch — confira em que bloco essa linha está.',
  },
  // ── entrada e saída (antes dos padrões genéricos de texto e &, que colidem)
  {
    re: /scanf(:| %| espera| precisa)|entrada para o scanf/i,
    cat: 'io',
    hint: 'No scanf, cada %d/%f/%c leva & antes da variável (ex.: scanf("%d", &x);) e %s recebe o vetor direto. Preencha também o painel Entrada.',
  },
  {
    re: /printf(:| precisa)/i,
    cat: 'io',
    hint: 'No printf, conte os pares: cada %d/%f/%c/%s do texto precisa de um valor na mesma ordem — e o texto vai entre aspas.',
  },
  {
    re: /& só faz sentido|& só é usado|sem & aqui|faltou o &/i,
    cat: 'io',
    hint: 'O & é o endereço da variável: no Lab ele aparece no scanf (ex.: &x). Fora dele, passe o valor direto.',
  },
  // ── armadilhas de runtime clássicas
  {
    re: /divisão por zero|módulo.*por zero|por zero/i,
    cat: 'outro',
    hint: 'O denominador chegou em 0: de onde vem esse valor? Confira a entrada ou a conta feita antes da divisão.',
  },
  {
    re: /fora do vetor|estouro de vetor|índice/i,
    cat: 'outro',
    hint: 'Posição inexistente no vetor: em C os índices vão de 0 até tamanho − 1. Confira os limites do laço que percorre o vetor.',
  },
  {
    re: /não cabe em|aumente o (?:vetor|tamanho)/i,
    cat: 'outro',
    hint: 'O texto não coube no vetor: declare-o com espaço para as letras + 1 (o \\0 final) — ex.: char nome[30];',
  },
  // ── variáveis (nomes, declaração, atribuição)
  {
    re: /função '.*' (?:não existe|não é suportada)/i,
    cat: 'variavel',
    hint: 'O nome da função não bate com o declarado (C diferencia maiúsculas de minúsculas). Nativas do Lab: printf, scanf, strlen, strcpy, strcmp, strcat, sqrt, pow, fabs, abs, floor, ceil, round, rand, toupper, tolower.',
  },
  {
    re: /não existe — declare antes|declarada duas vezes|já existe|repetido/i,
    cat: 'variavel',
    hint: 'Nome e declaração não combinam: confira a grafia (maiúscula/minúscula) e declare a variável antes de usar (ex.: int x;).',
  },
  {
    re: /do lado esquerdo do =|precisa de uma variável/i,
    cat: 'variavel',
    hint: 'Atribuição precisa de uma variável à esquerda do = (ex.: x = 5; ou v[0] = 5;) — não dá para guardar valor num número.',
  },
  {
    re: /esperava um nome/i,
    cat: 'variavel',
    hint: 'Faltou o nome de uma variável ou função nesse ponto — nomes começam com letra ou _ e não têm espaço.',
  },
  // ── tipos
  {
    re: /aspas/i,
    cat: 'sintaxe',
    hint: 'Aspas: texto usa aspas duplas "assim" e um único char usa aspas simples \'a\'.',
  },
  {
    re: /texto|char\[\]|guardar texto/i,
    cat: 'tipo',
    hint: 'Texto em C é um char[] e não faz conta direta: copie com strcpy, compare com strcmp e junte com strcat.',
  },
  {
    re: /é void|promete retornar|return não devolve texto|não é um (?:char|número|int)/i,
    cat: 'tipo',
    hint: 'C é rigoroso com tipos: função int devolve número, void não devolve nada — confira o que essa função/variável promete.',
  },
  {
    re: /% \(resto\)|só funciona com inteiros/i,
    cat: 'tipo',
    hint: 'O % (resto) só opera com inteiros — para decimais repense a conta ou trabalhe com int aqui.',
  },
  {
    re: /esperava um tipo|não é um vetor|sozinho não é um valor/i,
    cat: 'tipo',
    hint: 'Confira o tipo do que está na linha: vetor se usa com posição (v[0]), escalar se usa direto.',
  },
  // ── sintaxe (escrita)
  {
    re: /esperava ';'/i,
    cat: 'sintaxe',
    hint: 'Quase sempre é um ; que faltou no final da linha de cima — releia o fim de cada comando antes do ponto apontado.',
  },
  {
    re: /fechar o bloco|precisa do 'while|encontrei o fim do código/i,
    cat: 'sintaxe',
    hint: 'Chave aberta sem par: cada { precisa do seu } — indentar o código ajuda a enxergar qual bloco ficou aberto.',
  },
  {
    re: /não encontrei a função main/i,
    cat: 'sintaxe',
    hint: 'Todo programa precisa de int main() { ... } — é por onde a execução começa.',
  },
  {
    re: /ponteiros/i,
    cat: 'sintaxe',
    hint: 'O Lab ainda não roda ponteiros — por agora use vetores e & apenas no scanf (o curso chega lá mais adiante).',
  },
  {
    re: /não entendi|esperava um valor, variável ou expressão/i,
    cat: 'sintaxe',
    hint: 'Alguma peça não encaixa nessa linha: confira operadores, vírgulas e parênteses — e a linha de cima, que pode ser quem quebrou.',
  },
];

const FALLBACK_HINT =
  'Não casei com nenhuma causa conhecida: releia a linha destacada com calma (nomes, ;, () e {}) — se ela parecer certa, o problema pode estar na linha de cima.';

/** Dica curta de causa provável, derivada da mensagem original (pura). */
export function diagnoseClabError(msg: string): string {
  const m = msg ?? '';
  for (const r of RULES) if (r.re.test(m)) return r.hint;
  return FALLBACK_HINT;
}

/** Categoria do erro para o painel "Onde você erra mais" (pura). */
export function categorizeClabError(msg: string): ErrCategory {
  const m = msg ?? '';
  for (const r of RULES) if (r.re.test(m)) return r.cat;
  return 'outro';
}
