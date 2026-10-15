// practice-methods.ts — CAMADA 3 DO MOTOR DE PRIORIDADE (Task 219, dono
// 15/10/2026: "quero sair de alguém que trava na lógica e na escrita para
// alguém que raciocina rápido e bem e programa bem e rápido no PC e no
// caderno — mas não fique na velocidade, sim na QUALIDADE; pesquise bons
// métodos que combinem com o site").
//
// O catálogo usa métodos com evidência em educação de computação:
//   · PRIMM (Sentance & Waite 2019) — ler/previr código ANTES de escrever;
//   · Parson's problems (Ericson et al., revisão 2020) — reordenar linhas é
//     mais eficiente para iniciantes que escrever do zero;
//   · Tracing/dry-run de mesa — o treino da prova ESCRITA (Algoritmos: 3
//     questões no papel) e do raciocínio passo a passo;
//   · Retrieval practice "página em branco" (Agarwal et al.) — produzir sem
//     olhar fixa mais que reler; a QUALIDADE vem antes da velocidade, e a
//     velocidade chega como efeito colateral da repetição espaçada.
//
// A ESCADA DE FLUÊNCIA (a resposta direta ao "travo na escrita"):
//   código pronto (PRIMM) → reordenar (Parson's) → completar → página em
//   branco (retrieval) — o motor avança o degrau conforme o progresso REAL
//   da matéria. Lib PURA: nada lê storage; chamadores injetam estado.

import type { Discipline } from '@/data/course-data';

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export type MethodId =
  | 'primm'
  | 'parsons'
  | 'tracing'
  | 'retrieval'
  | 'lista'
  | 'projeto'
  | 'producao'
  | 'revisao';

export interface PracticeMethod {
  id: MethodId;
  nome: string;
  /** O que é, em uma linha. */
  curto: string;
  /** Passos concretos — o "como" do bloco de hoje. */
  passos: string[];
  /** Onde acontece: caderno, PC ou os dois (a dupla do dono). */
  superficie: 'caderno' | 'pc' | 'ambos';
  /** Evidência/método de referência — o motor cita a fonte. */
  evidencia: string;
  /** Quando o motor escolhe este método (tooltip do chip). */
  quando: string;
}

export const PRACTICE_METHODS: Record<MethodId, PracticeMethod> = {
  primm: {
    id: 'primm',
    nome: 'PRIMM — código pronto antes do seu',
    curto: 'Prever → Rodar → Investigar → Modificar → Criar, começando por código que JÁ existe.',
    passos: [
      'PREVER: antes de rodar, escreva no caderno o que o código vai imprimir',
      'RODAR: execute no PC e compare com a previsão — erros de previsão são OURO',
      'INVESTIGAR: mude um valor, anote o que muda',
      'MODIFICAR: altere o código para um objetivo pequeno dado por você',
      'CRIAR: só depois disso, escreva um programa seu na mesma família',
    ],
    superficie: 'ambos',
    evidencia: 'PRIMM (Sentance & Waite, 2019) — leitura antes da escrita reduz o travamento',
    quando: 'matéria prática com pouca ou nenhuma prática ainda — começa pelo código dos outros',
  },
  parsons: {
    id: 'parsons',
    nome: "Parson's — reordene antes de escrever",
    curto: 'Pegar a solução embaralhada (linhas cortadas) e montar a ordem certa no caderno.',
    passos: [
      'Pegue um programa RESOLVIDO da Lista/gabarito autoral e copie as linhas fora de ordem',
      'Monte a ordem correta no caderno SEM colar — pense na lógica de cada linha',
      'Só depois transcreva no PC, compile e teste',
      'Repita com uma variação: troque a condição, o acumulador, o limite',
    ],
    superficie: 'ambos',
    evidencia: "Parson's problems (Ericson et al., 2020) — mais eficiente que escrever do zero na entrada",
    quando: 'já viu o conteúdo mas trava na hora de escrever — a ponte entre ler e criar',
  },
  tracing: {
    id: 'tracing',
    nome: 'Tracing de mesa — treino de prova escrita',
    curto: 'Executar o programa À MÃO, tabelando variáveis linha a linha, como na prova.',
    passos: [
      'Escolha um programa da lista (ou do gabarito autoral) com if/laço',
      'No caderno, faça a tabela de variáveis: coluna para cada variável, linha para cada volta do laço',
      'Traçe SEM executar — a mão é o computador',
      'Só ao final rode no PC e confira a tabela (erros de traço viram lista de dúvidas)',
    ],
    superficie: 'caderno',
    evidencia: 'Code tracing é a habilidade cobrada por provas escritas e a base do raciocínio passo a passo',
    quando: 'prova escrita chegando (≤7d) em matéria prática — treina o JEITO que será cobrado',
  },
  retrieval: {
    id: 'retrieval',
    nome: 'Página em branco — produzir sem olhar',
    curto: 'Escrever o programa/resposta do zero, sem consulta, e SÓ DEPOIS conferir.',
    passos: [
      'Leia o enunciado e feche tudo (sem lista, sem exemplos, sem IA)',
      'Escreva a solução inteira no caderno ou no PC a partir do vazio',
      'Confira contra o gabarito/solução — marquee o que faltou (não o que errou)',
      'O que faltou vira flashcard/no caderno de erros para a próxima rodada',
    ],
    superficie: 'ambos',
    evidencia: 'Retrieval practice (Agarwal et al.) — produzir sem olhar fixa mais que reler; velocidade vem de graça',
    quando: 'fluência subindo (≥40% do conteúdo em dia) — treina raciocínio completo com qualidade',
  },
  lista: {
    id: 'lista',
    nome: 'Lista com exemplo resolvido primeiro',
    curto: 'Exemplo resolvido ao lado → refazer sem olhar → próximo bloco da lista.',
    passos: [
      'Abra UM exemplo resolvido da unidade e entenda cada linha',
      'Feche o exemplo e resolva a questão da lista correspondente do zero',
      'Compare com a resolução — anote a diferença de abordagem, não só o erro',
      'Intercale: uma questão antiga (revisão) + uma nova (avanço) por sessão',
    ],
    superficie: 'caderno',
    evidencia: 'Worked examples + fading (Sweller) e intercalação — menos sobrecarga, mais fixação',
    quando: 'matéria mista (teoria + lista) — Matemática, Fundamentos, Inglês',
  },
  projeto: {
    id: 'projeto',
    nome: 'Projeto em passos pequenos',
    curto: 'Avançar o trabalho/entrega em fatias que rodam, nunca na véspera.',
    passos: [
      'Escolha a menor fatia que deixa algo VISÍVEL funcionando (uma seção, uma função)',
      'Faça essa fatia inteira (escreve, testa, salva)',
      'Commits/salvas frequentes — o progresso é acumulável',
      'Anote o próximo passo ANTES de parar (reabrir sem pensar é metade do trabalho)',
    ],
    superficie: 'pc',
    evidencia: 'Trabalho é maratona: fatias pequenas + progresso visível batem a véspera em qualquer estudo',
    quando: 'trabalho/entrega no radar — projeto evolui por blocos, não por pânico',
  },
  producao: {
    id: 'producao',
    nome: 'Feynman + produção escrita',
    curto: 'Explicar em voz alta como se ensinasse, depois produzir o texto/resumo do zero.',
    passos: [
      'Explique o conceito em voz alta SEM olhar o material (grave se quiser)',
      'Onde travou a explicação = a lacuna — volte SÓ ali no material',
      'Produza o texto/resumo/resposta no caderno do zero, citando exemplos seus',
      'Compare com o material e ajuste — a comparação final é a aula',
    ],
    superficie: 'caderno',
    evidencia: 'Técnica Feynman + geração — explicar e gerar batem reler em retenção e argumentação',
    quando: 'matéria de teoria (leitura/escrita/apresentação) — RHT, Português',
  },
  revisao: {
    id: 'revisao',
    nome: 'Revisão leve espaçada',
    curto: 'Toque curto no que já viu: flashcards, glossário, reler resumo — não é a sessão principal.',
    passos: [
      'Passe pelos flashcards vencidos do hub (FSRS já ordenou)',
      'Releia o glossário/resumo mais recente em 5–10 min',
      'Pare — revisão leve não substitui a prática do dia',
    ],
    superficie: 'ambos',
    evidencia: 'Repetição espaçada — manutenção barata do que já foi aprendido',
    quando: 'manutenção de matéria em dia — mantém sem gastar o bloco principal',
  },
};

// ---------------------------------------------------------------------------
// Motor de sugestão — o método do bloco de hoje
// ---------------------------------------------------------------------------

export interface SuggestPracticeInput {
  /** Matéria em questão. */
  d: Discipline;
  /** Tipo/prazo da avaliação mais próxima (da triagem). */
  evalKind?: 'prova' | 'trabalho' | 'atividade';
  evalDaysLeft?: number;
  /** Dívida de prática em dias (da triagem). */
  debtDays: number;
  /** Progresso REAL: tópicos fechados / total da matéria. */
  topicosFeitos: number;
  topicosTotal: number;
  /** Nunca praticou? (sem registro no semestre). */
  nuncaPraticou?: boolean;
}

export interface PracticeSuggestion {
  method: PracticeMethod;
  /** Por que ESTE método hoje (motivo humano, citando o dado que decidiu). */
  porque: string;
  /** O primeiro passo concreto — elimina a página em branco da própria prática. */
  primeiroPasso: string;
  /** Escada de fluência: posição 0..3 (pronto → reordenar → completar → vazio). */
  degrauFluencia: number;
}

/**
 * A escada de fluência em código: quão pronto o aluno está para produzir do
 * zero nesta matéria. 0 = nunca praticou (começa por código pronto), 1 = já
 * viu e ainda trava (reordena), 2 = avançando (completa/varia), 3 = fluente
 * (página em branco). A QUALIDADE vem do degrau certo — não do relógio.
 */
export function fluencyStepOf(topicosFeitos: number, topicosTotal: number, nuncaPraticou?: boolean): number {
  if (nuncaPraticou || topicosTotal === 0) return 0;
  const pct = topicosFeitos / topicosTotal;
  if (pct < 0.25) return 1;
  if (pct < 0.55) return 2;
  return 3;
}

/**
 * O método do bloco de hoje. Ordem de decisão (a primeira regra que bate ganha):
 *   1. prova escrita ≤7d em matéria prática  → tracing de mesa (treina o jeito cobrado);
 *   2. trabalho ≤7d ou em aberto             → projeto em fatias;
 *   3. atividade ≤7d em matéria de teoria    → produção (Feynman);
 *   4. matéria prática                       → escada de fluência pelo progresso real
 *      (PRIMM → Parson's → variação/completar → página em branco);
 *   5. matéria mista                         → lista com exemplo resolvido;
 *   6. matéria de teoria                     → Feynman + produção;
 *   7. em dia e sem prazo                    → revisão leve.
 */
export function suggestPractice(input: SuggestPracticeInput): PracticeSuggestion {
  const { d, evalKind, evalDaysLeft, debtDays, topicosFeitos, topicosTotal, nuncaPraticou } = input;

  // 1. Prova escrita perto + matéria prática → o treino imita a prova.
  if (evalKind === 'prova' && evalDaysLeft !== undefined && evalDaysLeft <= 7 && d.perfilPratica === 'pratica') {
    const m = PRACTICE_METHODS.tracing;
    return {
      method: m,
      porque: `prova em ${evalDaysLeft}d é ESCRITA — trace à mão o jeito que será cobrado`,
      primeiroPasso: m.passos[0],
      degrauFluencia: 3,
    };
  }
  // 1b. Prova perto em matéria mista → lista com retrieval (exemplo resolvido + refazer).
  if (evalKind === 'prova' && evalDaysLeft !== undefined && evalDaysLeft <= 7 && d.perfilPratica === 'mista') {
    const m = PRACTICE_METHODS.lista;
    return {
      method: m,
      porque: `prova em ${evalDaysLeft}d — exemplo resolvido primeiro, refazer sem olhar`,
      primeiroPasso: m.passos[0],
      degrauFluencia: 2,
    };
  }
  // 2. Trabalho (prazo ou em aberto) → projeto em fatias.
  if (evalKind === 'trabalho') {
    const m = PRACTICE_METHODS.projeto;
    const quando = evalDaysLeft !== undefined ? `entrega em ${evalDaysLeft}d` : 'entrega sem data oficial ainda';
    return {
      method: m,
      porque: `${quando} — avance uma fatia que roda hoje`,
      primeiroPasso: m.passos[0],
      degrauFluencia: 3,
    };
  }
  // 3. Atividade perto em matéria de teoria → produção.
  if (evalKind === 'atividade' && evalDaysLeft !== undefined && evalDaysLeft <= 7 && d.perfilPratica === 'teoria') {
    const m = PRACTICE_METHODS.producao;
    return {
      method: m,
      porque: `atividade em ${evalDaysLeft}d — explique sem olhar e produza do zero`,
      primeiroPasso: m.passos[0],
      degrauFluencia: 3,
    };
  }

  const degrau = fluencyStepOf(topicosFeitos, topicosTotal, nuncaPraticou);

  // 4. Matéria prática → escada de fluência.
  if (d.perfilPratica === 'pratica') {
    if (degrau === 0) {
      const m = PRACTICE_METHODS.primm;
      return {
        method: m,
        porque: nuncaPraticou
          ? 'nunca praticou nesta matéria — comece por código PRONTO (prever e rodar), não pelo seu próprio'
          : 'conteúdo ainda no começo — leia e preveja código pronto antes de escrever o seu',
        primeiroPasso: m.passos[0],
        degrauFluencia: degrau,
      };
    }
    if (degrau === 1) {
      const m = PRACTICE_METHODS.parsons;
      return {
        method: m,
        porque: 'você já viu o conteúdo mas a escrita ainda trava — reordene soluções prontas antes de escrever do zero',
        primeiroPasso: m.passos[0],
        degrauFluencia: degrau,
      };
    }
    if (degrau === 2) {
      const m = PRACTICE_METHODS.parsons;
      return {
        method: m,
        porque: 'avançando — reordene e VARIE (troque a condição, o acumulador) para virar o jogo',
        primeiroPasso: m.passos[3] ?? m.passos[0],
        degrauFluencia: degrau,
      };
    }
    const m = PRACTICE_METHODS.retrieval;
    return {
      method: m,
      porque: 'fluência boa — produza do zero sem olhar (a velocidade vem de graça daqui)',
      primeiroPasso: m.passos[0],
      degrauFluencia: degrau,
    };
  }

  // 5. Mista → lista com exemplo resolvido.
  if (d.perfilPratica === 'mista') {
    const m = PRACTICE_METHODS.lista;
    return {
      method: m,
      porque: debtDays > 0 ? `matéria mista com ${debtDays}d de dívida — exemplo resolvido + refazer sem olhar` : 'matéria mista — exemplo resolvido primeiro, depois do zero',
      primeiroPasso: m.passos[0],
      degrauFluencia: degrau,
    };
  }

  // 6. Teoria → Feynman + produção.
  const m = PRACTICE_METHODS.producao;
  return {
    method: m,
    porque: 'matéria de teoria — explique em voz alta e produza o texto do zero',
    primeiroPasso: m.passos[0],
    degrauFluencia: degrau,
  };
}

/** Rótulo curto da superfície para o chip do card. */
export function superficieLabel(s: PracticeMethod['superficie']): string {
  if (s === 'caderno') return 'no caderno';
  if (s === 'pc') return 'no PC';
  return 'caderno + PC';
}
