// math-exam-prep.ts — FOCO: Prova de Matemática, 01/10/2026 (Av1)
//
// Tudo aqui é extraído dos MATERIAIS REAIS estudados em aula:
//   - mat-00-matrizes (teoria Aula 00) · mat-01-matrizes (LISTA — 35 questões)
//   - mat-logica-slides (47p) · mat-logica-lista (LISTA — 18 questões)
// PLANO REFEITO (24/09, D-7, pedido do dono): o plano antigo (12 dias,
// centrado em ler teoria) ficou confuso e incluía DETERMINANTES — que NÃO
// caem. Agora é simples: FAZER AS LISTAS impressas que o dono tem, bloco a
// bloco (Matrizes em 3 blocos → Lógica em 2 partes → simulado D-2 → véspera),
// com a teoria só como apoio. Determinantes (1.3) e Sistemas Lineares (1.4)
// ficam PÓS-PROVA — o professor ainda não deu (confirmado pelo dono em 24/09).

export const MATH_EXAM = {
  disciplineCode: 'TEC.1984',
  disciplineName: 'Matemática Aplicada à Computação',
  evaluationName: 'Av1',
  date: '2026-10-01', // confirmado pelo dono — fonte da verdade em course-data
  // ESCOPO REAL confirmado pelo dono (24/09): a prova é focada no CONTEÚDO
  // dado em sala = Matrizes (até inversa — Q31–35 da lista) + Lógica.
  // NÃO ENTRAM: determinantes e sistemas lineares (ainda não dados).
  programa:
    'NÚCLEO: Matrizes — operações (soma, escalar, produto), transposta, simétrica/antissimétrica e matriz inversa (Q31–35 da lista) + Lógica — proposições, conectivos, tabelas-verdade, tautologias, equivalências e argumentos. NÃO CAEM: determinantes e sistemas lineares (ainda não dados — confirmado 24/09).',
  notaPeso: 'Av1 = 33,3% da média final (escala 0-100, aprovação ≥ 70)',
  simuladoFilter: { discipline: 'TEC.1984', onlyMaterialFirst: true },

  // Tópicos do escopo REAL da Av1 (os mesmos do preset do Simulado da Av1) —
  // o "foco da prova" no card usa a tendência real das tentativas RECORTADA
  // por estes tópicos para apontar onde revisar (pior primeiro).
  topicosEscopo: ['Álgebra Matricial', 'Lógica Matemática'],
} as const;

/**
 * META DA AV1 — nota de aprovação (≥ 70 na escala 0-100). Fonte única do
 * número: notaPeso acima. Aparece no veredito do resultado do simulado,
 * nas linhas de meta dos gráficos do Histórico e no score de prontidão —
 * um número só, para nunca divergir entre telas.
 */
export const MATH_META = 70;

/**
 * DATA DO SIMULADO OFICIAL — o dia offset 2 do plano (29/09), derivado da
 * data da prova para nunca divergir: mudou a prova, muda o simulado junto.
 * O marco "é hoje" do card da prova usa esta data (render-time — sem
 * interval nem estado, reage a mock de relógio no mesmo frame).
 */
export const MATH_SIMULADO_DATE = (() => {
  const d = new Date(`${MATH_EXAM.date}T12:00:00`);
  d.setDate(d.getDate() - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
})();

/** 'yyyy-mm-dd' LOCAL de um Date (mesmo formato das constantes acima). */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * DATA DA VÉSPERA — D-1 da prova (30/09), derivada da data da prova para
 * nunca divergir (mesma regra do simulado acima): mudou a prova, muda a
 * véspera junto.
 */
export const MATH_VESPERA_DATE = (() => {
  const d = new Date(`${MATH_EXAM.date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
})();

// ---------- Marcos da semana da Av1 (agenda) ----------

/**
 * MARCO DA SEMANA DA AV1 — a Agenda (Cronograma inteligente) é a única
 * superfície de planejamento semanal e era CEGA à semana da prova: os cards
 * dos dias mostravam só blocos de estudo, sem o simulado (29/09), sem a
 * véspera (30/09) e sem a prova (01/10). Esta função é a FONTE ÚNICA do
 * marco de um dia — as datas derivam de MATH_EXAM.date (simulado = D-2,
 * véspera = D-1) para nunca divergir do card/hero/fila.
 *
 * A entrega da S3 de Algoritmos é NO MESMO DIA do simulado (29/09 — fonte:
 * dono, consistente com o chip D-1 do hero da rodada 85).
 */
export interface ExamWeekMilestone {
  kind: 'simulado' | 'vespera' | 'prova';
  date: string; // 'yyyy-mm-dd'
  /** Nome curto do marco — ex.: 'Simulado da Av1 — Matemática'. */
  titulo: string;
  /** Linha secundária opcional — ex.: '+ entrega da S3 de Algoritmos'. */
  subtitulo?: string;
  /** O que fazer no dia (dica honesta, 1 linha). */
  detalhe: string;
}

export function examWeekMilestoneFor(date: Date): ExamWeekMilestone | null {
  const key = localDateKey(date);
  if (key === MATH_SIMULADO_DATE) {
    return {
      kind: 'simulado',
      date: MATH_SIMULADO_DATE,
      // Titulo CURTO: o strip mora num card de ~150px na grade de 7 colunas —
      // '— Matemática' não cabe (a família âmbar + o detalhe já dizem de quem é).
      titulo: 'Simulado da Av1',
      subtitulo: '+ S3 de Algoritmos',
      detalhe: 'prova completa no Praticar — o ensaio real da Av1',
    };
  }
  if (key === MATH_VESPERA_DATE) {
    return {
      kind: 'vespera',
      date: MATH_VESPERA_DATE,
      titulo: 'Véspera da prova',
      detalhe: 'montar o kit, imprimir a folha de revisão e refazer só as travadas',
    };
  }
  if (key === MATH_EXAM.date) {
    return {
      kind: 'prova',
      date: MATH_EXAM.date,
      titulo: 'Prova da Av1',
      detalhe: 'levar o kit e chegar cedo — boa prova!',
    };
  }
  return null;
}

/**
 * O RUN DO SIMULADO OFICIAL (29/09) — FONTE ÚNICA da verdade "feito no dia".
 * Card da prova (marcos) e hero do dashboard leem da MESMA função: estado
 * derivado de registro não pode ter duas verdades (lição das rodadas 83/84).
 * Genérico preserva o tipo concreto do chamador (SimuladoRun no card e no
 * hero) sem importar study-progress aqui — este módulo é puro.
 */
type SimuladoRunLike = {
  mode?: string;
  date: string;
  filters?: { discipline?: string };
  questions?: { disciplineCode?: string }[];
};

export function findMathSimuladoRunOficial<T extends SimuladoRunLike>(
  runs: T[] | undefined | null,
): T | undefined {
  return (runs ?? []).find((r) => {
    if (r.mode !== 'prova') return false;
    // T12 no parse: 'yyyy-mm-dd' puro viria como UTC meia-noite e cairia no
    // dia anterior em fuso negativo — meio-dia local é o dia inteiro.
    if (
      new Date(r.date).toDateString() !==
      new Date(`${MATH_SIMULADO_DATE}T12:00:00`).toDateString()
    )
      return false;
    // Só prova de MATEMÁTICA conta: pelo filtro do preset OU pelas questões.
    if (r.filters?.discipline) return r.filters.discipline === MATH_EXAM.disciplineCode;
    return r.questions?.length
      ? r.questions.every((q) => q.disciplineCode === MATH_EXAM.disciplineCode)
      : false;
  });
}

// ---------- O dia comum cede a vez (card 'O que estudar hoje') ----------

/**
 * BRIEF do dia-marco para o card 'O que estudar hoje' (TodayStudyCard):
 * o cronograma rotativo é a voz padrão do dia, mas nos TRÊS dias da reta
 * final (simulado, véspera, prova) o cronograma cede a vez ao plano da Av1
 * — o ExamPrepCard mora logo acima. Fora desses 3 dias: null (silêncio
 * honesto — regra da 88: nenhuma superfície grita fora da janela).
 *
 * FONTE ÚNICA: examWeekMilestoneFor dá o marco (mesma voz da Agenda) e
 * findMathSimuladoRunOficial diz se o simulado JÁ foi — registro vence
 * relógio (lição 85/86): na noite do 29 o strip flipa 'feito ✓' ao vivo
 * (storage event → re-render, lição 79). O % do chip vem do veredito da
 * 95 — zero segunda fonte.
 */
export interface TodayStudyExamBrief {
  kind: 'simulado' | 'vespera' | 'prova';
  /** Título do marco — a mesma voz do strip da Agenda. */
  titulo: string;
  /** A linha que refrata o dia (defere ao plano / informa o registro). */
  linha: string;
  /** Simulado oficial já realizado (só faz sentido no kind 'simulado'). */
  feito: boolean;
  /** % do veredito quando feito — null fora disso (nada inventado). */
  pct: number | null;
}

export function todayStudyExamBriefFor(
  date: Date,
  runs?: (SimuladoRunLike & VerdictRunLike)[] | null,
): TodayStudyExamBrief | null {
  const m = examWeekMilestoneFor(date);
  if (!m) return null;
  if (m.kind === 'simulado') {
    const run = findMathSimuladoRunOficial(runs);
    const feito = Boolean(run);
    const pct = feito ? simuladoVerdictFor(run)?.pct ?? null : null;
    return {
      kind: 'simulado',
      titulo: `É hoje: ${m.titulo}`,
      feito,
      pct,
      linha: feito
        ? 'feito ✓ — o kit da véspera já lê seu resultado (card acima)'
        : 'o dia é do ensaio real (+ S3 de Algoritmos) — depois do run, o kit lê o resultado',
    };
  }
  if (m.kind === 'vespera') {
    return {
      kind: 'vespera',
      titulo: m.titulo,
      feito: false,
      pct: null,
      linha: 'revisão leve: o plano manda — folha, fórmulas e só as travadas (card acima)',
    };
  }
  return {
    kind: 'prova',
    titulo: `É hoje: ${m.titulo}`,
    feito: false,
    pct: null,
    linha: 'boa prova! O dia é do exame — chegue cedo e leve o kit',
  };
}

// ---------- O relatório semanal sabe a semana ----------

export interface WeeklyReportExamBrief {
  kind: 'simulado' | 'vespera' | 'prova';
  /** Título do marco — a MESMA voz do strip do cronograma (99). */
  titulo: string;
  /** Linha honesta que SUBSTITUI a mensagem de ritmo do relatório. */
  linha: string;
  /** Simulado oficial já realizado (só faz sentido no kind 'simulado'). */
  feito: boolean;
  /** % do veredito quando feito — null fora disso (nada inventado). */
  pct: number | null;
  /** Veredito contra a meta quando feito — null sem registro. */
  metaBatida: boolean | null;
}

/**
 * BRIEF do relatório semanal (aba Progresso): a superfície de ANALÍTICA era a
 * última ainda falando a língua da produtividade nos dias críticos — a mensagem
 * comparativa mandava 'agende um bloco no cronograma' no DIA DA PROVA e
 * 'adicione mais uma sessão' na véspera, a mesma pressão que a 99 matou no
 * cronograma. MESMA janela honesta de 3 dias da 99 (simulado/véspera/prova —
 * regra da 88: fora dela o relatório segue sendo relatório, silêncio honesto;
 * pós-prova a nota mora na calculadora, não aqui). `daysLeft` entra como
 * PARÂMETRO (daysUntilDate do chamador contra MATH_EXAM.date — mesma divisão
 * da 98/100/101/102) e o flip do D-2 vem do registro REAL
 * (findMathSimuladoRunOficial + veredito — registro vence relógio, lição 85/86).
 */
export function weeklyReportExamBriefFor(
  daysLeft: number,
  runs?: (SimuladoRunLike & VerdictRunLike)[] | null,
): WeeklyReportExamBrief | null {
  if (daysLeft === MATH_SIMULADO_OFFSET) {
    const run = findMathSimuladoRunOficial(runs);
    const feito = Boolean(run);
    const verdict = feito ? simuladoVerdictFor(run) : null;
    return {
      kind: 'simulado',
      titulo: 'É hoje: Simulado da Av1',
      feito,
      pct: verdict?.pct ?? null,
      metaBatida: verdict ? verdict.metaBatida : null,
      linha: feito
        ? 'feito ✓ — o número que importa hoje é este; o kit da véspera já lê o resultado'
        : 'o dia é do ensaio real — o número que importa hoje é o % do simulado, não o dos gráficos',
    };
  }
  if (daysLeft === 1) {
    return {
      kind: 'vespera',
      titulo: 'Véspera da prova',
      feito: false,
      pct: null,
      metaBatida: null,
      linha: 'revisão leve: o kit da véspera manda no dia — nenhum recorde de foco importa hoje',
    };
  }
  if (daysLeft === 0) {
    return {
      kind: 'prova',
      titulo: 'É hoje: Prova da Av1',
      feito: false,
      pct: null,
      metaBatida: null,
      linha: 'o dia é do exame — os gráficos esperam; chegue cedo e leve o kit',
    };
  }
  return null;
}

// ---------- O veredito do simulado oficial ----------

/**
 * RÓTULO CURTO do tópico do escopo — o kit fala a língua do aluno ('Matrizes',
 * não 'Álgebra Matricial'). Tópico fora do mapa volta inteiro (honesto).
 */
export const MATH_TOPICO_CURTO: Record<string, string> = {
  'Álgebra Matricial': 'Matrizes',
  'Lógica Matemática': 'Lógica',
};

export interface SimuladoTopicScore {
  topic: string;
  solved: number;
  total: number;
  /** null = só questões puladas no tópico — sem taxa honesta. */
  pct: number | null;
  /** Questões SEM marca no tópico (avançou sem responder / tempo esgotado).
   *  Pulada não é erro nem acerto — é o sinal mais alto de "não vi esse bloco". */
  skipped: number;
}

export interface SimuladoVerdict {
  /** Acerto geral do run (0–100), na mesma régua do histórico. */
  pct: number;
  /** MATH_META — a régua vem da fonte única, nunca hardcoded. */
  meta: number;
  metaBatida: boolean;
  /** Tópicos do ESCOPO da Av1 presentes no run, na ordem de topicosEscopo. */
  porTopico: SimuladoTopicScore[];
  /** Menor taxa entre tópicos com taxa — o "bloco com mais erros" do plano. */
  worst: SimuladoTopicScore | null;
  /** O bloco INTEIRO sem tentativa (todas puladas — pior sinal que existe:
   *  nem errar o aluno conseguiu). Primeiro tópico do escopo nessa condição;
   *  null quando todo tópico teve ao menos uma resposta. A CAMADA QUE DECIDE
   *  o foco usa pulouTudo ?? worst — pular tudo é diagnóstico mais grave do
   *  que a menor taxa (nunca houve taxa para comparar). worst segue com o
   *  contrato documentado (menor taxa entre com taxa) para as superfícies
   *  que só olham número. */
  pulouTudo: SimuladoTopicScore | null;
}

type VerdictRunLike = {
  total: number;
  solved: number;
  questions?: { status?: 'solved' | 'missed' | 'skipped'; topic?: string }[];
};

/**
 * O VEREDITO DO SIMULADO OFICIAL — o plano promete (offset 2, tarefa 2):
 * "o bloco com mais erros vira a revisão de amanhã". A promessa era só
 * TEXTO: o run guarda questões com tópico e status, mas o kit da véspera
 * não lia. Esta função transforma o run oficial em números por tópico do
 * escopo (MATH_EXAM.topicosEscopo) — fonte única para o badge do kit, a
 * linha do bloco fraco e a ordem da recitação. Puladas contam no total mas
 * não na taxa (aluno que pulou não acertou — e não errou no papel: sem
 * taxa inventada). Run antigo sem detalhes → porTopico vazio, worst null —
 * o badge do % geral ainda fala, a linha do bloco não inventa. Módulo
 * permanece puro (sem React, sem storage — padrão da casa).
 */
export function simuladoVerdictFor(run?: VerdictRunLike | null): SimuladoVerdict | null {
  if (!run || run.total <= 0) return null;
  const pct = Math.round((run.solved / run.total) * 100);
  const porTopico = (MATH_EXAM.topicosEscopo as readonly string[])
    .map((topic) => {
      const qs = (run.questions ?? []).filter((q) => q.topic === topic);
      const solved = qs.filter((q) => q.status === 'solved').length;
      const skipped = qs.filter((q) => q.status === 'skipped').length;
      const answered = qs.filter((q) => q.status !== 'skipped').length;
      return {
        topic,
        solved,
        total: qs.length,
        pct: answered > 0 ? Math.round((solved / answered) * 100) : null,
        skipped,
      };
    })
    .filter((t) => t.total > 0);
  const comTaxa = porTopico.filter((t): t is SimuladoTopicScore & { pct: number } => t.pct !== null);
  const worst = comTaxa.length
    ? comTaxa.reduce((a, b) => (b.pct < a.pct ? b : a))
    : null;
  // O BLOCO INTEIRO SEM TENTATIVA: na ordem do escopo, o primeiro tópico cujo
  // total é todo pulado. O tempo acabou nele (ou o aluno passou reto) — a
  // revisão de amanhã começa por onde o aluno NEM CHEGOU.
  const pulouTudo = porTopico.find((t) => t.skipped === t.total) ?? null;
  return { pct, meta: MATH_META, metaBatida: pct >= MATH_META, porTopico, worst, pulouTudo };
}

// ---------- O drill responde (a revisão cumpriu?) ----------

/** Forma mínima do run de drill — mode 'topico' + questões com tópico/status. */
export type DrillRunLike = {
  mode?: string;
  date: string; // ISO
  filters?: { discipline?: string };
  questions?: {
    disciplineCode?: string;
    status?: 'solved' | 'missed' | 'skipped';
    topic?: string;
  }[];
};

export interface DrillFeedback {
  solved: number;
  total: number;
  /** Taxa sobre RESPONDIDOS — a MESMA regra honesta do veredito (pulada não
   *  conta taxa nem inventa). null = o treino inteiro sem tentativa. */
  pct: number | null;
  dateISO: string;
  /** true = a taxa do treino ficou acima da taxa do bloco no SIMULADO (a
   *  revisão cumpriu); false = não subiu (honesto: o número fala); null =
   *  sem comparação possível (bloco todo pulado no simulado, ou treino todo
   *  pulado — não há taxa dos dois lados). */
  melhorou: boolean | null;
}

/**
 * O FEEDBACK DO DRILL — o kit promete ("Matrizes: a revisão de amanhã") e o
 * CTA abre o drill daquele tópico, mas o kit nunca soube se o treino
 * ACONTECEU: a linha ficava igual, o badge seguia no % do simulado e a
 * promessa não tinha recibo. O drill do kit é um run com mode 'topico'
 * (o evento topicScope configura AttemptMode 'topico' — distinto do run
 * oficial 'prova', então este leitor nunca colide com
 * findMathSimuladoRunOficial). Esta função acha o drill MAIS RECENTE
 * daquele tópico (sort por date desc — runs antigos no fim do array não
 * são "mais recentes" por sorteio de ordem) e devolve os números com a
 * mesma honestidade do veredito: taxa sobre respondidos, comparação só
 * quando os dois lados têm taxa. Módulo permanece puro.
 *
 * A ORDEM DO TEMPO MANDA (107): oficialDateISO quando passado restringe o
 * recibo aos drills DEPOIS do run oficial — a promessa do plano é "o bloco
 * com mais erros vira a revisão de AMANHÃ": treino ANTES do diagnóstico é
 * preparo, não revisão cumprida, e um 'subiu de X% para Y%' com o treino
 * antes do simulado mentiria a ordem dos fatos (o 80% teria VINDO antes do
 * 40%). Sem oficial (ou sem data), vale o comportamento antigo — nenhum
 * recibo inventa uma sequência que não aconteceu.
 */
export function mathDrillFeedbackFor(
  runs: DrillRunLike[] | undefined | null,
  topic: string,
  focoPct?: number | null,
  oficialDateISO?: string | null,
): DrillFeedback | null {
  const oficialMs = oficialDateISO ? new Date(oficialDateISO).getTime() : null;
  const candidates = (runs ?? [])
    .filter((r) => {
      if (r.mode !== 'topico') return false;
      const qs = r.questions ?? [];
      if (qs.length === 0) return false;
      // A revisão vem DEPOIS do diagnóstico (lição da 107).
      if (oficialMs !== null && new Date(r.date).getTime() <= oficialMs) return false;
      // Só prova de MATEMÁTICA: pelo filtro do preset OU pelas questões
      // (o mesmo critério do leitor do run oficial).
      if (r.filters?.discipline) {
        if (r.filters.discipline !== MATH_EXAM.disciplineCode) return false;
      } else if (
        qs.some((q) => q.disciplineCode && q.disciplineCode !== MATH_EXAM.disciplineCode)
      ) {
        return false;
      }
      // Drill de 1 tópico: TODAS as questões do tópico pedido (o preset do
      // drill manda topics:[topic] — um run misto não é drill daquele bloco).
      return qs.every((q) => q.topic === topic);
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const run = candidates[0];
  if (!run) return null;
  const qs = run.questions ?? [];
  const solved = qs.filter((q) => q.status === 'solved').length;
  const answered = qs.filter((q) => q.status !== 'skipped').length;
  const pct = answered > 0 ? Math.round((solved / answered) * 100) : null;
  return {
    solved,
    total: qs.length,
    pct,
    dateISO: run.date,
    melhorou: pct === null || focoPct == null ? null : pct > focoPct,
  };
}

/**
 * O TÓPICO DE UM DRILL (badge do histórico): os questions de um run
 * 'topico' carregam o tópico — quando TODOS apontam o mesmo, é ele;
 * run antigo sem detalhes (ou misto) devolve null (o badge fica sem nome
 * em vez de adivinhar). Puro, sem React.
 */
export function drillTopicOf(
  run?: { questions?: { topic?: string }[] } | null,
): string | null {
  const qs = run?.questions ?? [];
  if (qs.length === 0) return null;
  const first = qs[0].topic;
  if (first == null) return null;
  return qs.every((q) => q.topic === first) ? first : null;
}

// ---------- Flashcards na semana da Av1 ----------

/**
 * O BRIEF DA SEMANA DA AV1 PARA OS FLASHCARDS — a última ferramenta cega à
 * reta final: o modo cram já existia (o title até dizia "ideal antes de
 * provas") mas era genérico — revisa TODOS os baralhos e não sabia que a Av1
 * existe. Esta função diz ao Flashcard o que ele faz em cada dia da semana:
 *   - simulado (D-2): é hoje (sólido com pulso) — e com o run registrado
 *     vira "feito ✓" (o REGISTRO vence o relógio, lição 85/86);
 *   - véspera (D-1): o dia DELE — crame só os cartões de Matemática;
 *   - prova (D-0): revisão leve para aquecer, sem aprender nada novo.
 * Fora da janela retorna null — silêncio honesto, sem inventar urgência
 * (a mesma regra da fila da 88: sem registro, não inventa resultado).
 * Datas derivadas de MATH_SIMULADO_DATE / MATH_VESPERA_DATE / MATH_EXAM.date
 * — fonte única, para nunca divergir do hero, do card e da agenda.
 */
export interface FlashcardExamBrief {
  kind: 'simulado-hoje' | 'simulado-feito' | 'vespera' | 'prova-hoje';
  titulo: string;
  /** Uma linha — o PORQUÊ da ação (honesto, sem alarme). */
  chamada: string;
  /** Rótulo do botão que abre o cram escopado de Matemática. */
  cta: string;
}

export function flashcardExamBriefFor(
  date: Date,
  mathCards: number,
  simuladoRun?: { solved: number; total: number } | null,
): FlashcardExamBrief | null {
  const key = localDateKey(date);
  const cta = mathCards > 0 ? `Cram de Matemática (${mathCards})` : 'Cram de Matemática';
  const pct =
    simuladoRun && simuladoRun.total > 0
      ? Math.round((simuladoRun.solved / simuladoRun.total) * 100)
      : null;

  if (key === MATH_SIMULADO_DATE) {
    if (simuladoRun) {
      return {
        kind: 'simulado-feito',
        titulo: `Simulado da Av1 feito ✓${pct !== null ? ` — ${pct}%` : ''}`,
        chamada:
          'transforme o erro de hoje em cartão antes da véspera — o que travou no simulado é exatamente o que vale revisar agora',
        cta,
      };
    }
    return {
      kind: 'simulado-hoje',
      titulo: 'É hoje: Simulado da Av1',
      chamada:
        'depois do run, os erros de hoje viram cartões — o baralho de fórmulas fica pronto para a véspera',
      cta,
    };
  }
  if (key === MATH_VESPERA_DATE) {
    return {
      kind: 'vespera',
      titulo: 'Véspera da Av1 — dia do cram',
      chamada:
        'só os cartões de Matemática, ignorando o agendamento — fórmulas frescas para amanhã, 15 min bastam',
      cta,
    };
  }
  if (key === MATH_EXAM.date) {
    return {
      kind: 'prova-hoje',
      titulo: 'É hoje: Prova da Av1',
      chamada:
        'revisão leve só para aquecer — sem aprender nada novo hoje; boa prova!',
      cta: mathCards > 0 ? `Revisar fórmulas (${mathCards})` : 'Revisar fórmulas',
    };
  }
  return null;
}

// ---------- Caderno de Erros na semana da Av1 ----------

/**
 * O BRIEF DA SEMANA DA AV1 PARA O CADERNO DE ERROS — o caderno é a FERRAMENTA
 * DA VÉSPERA (é onde moram as questões erradas e puladas do simulado, que o
 * plano manda refazer no papel) e era cego ao calendário: não sabia dizer
 * "o simulado de hoje é o seu material de amanhã", nem "hoje é o SEU dia".
 * Esta função diz ao caderno o que ele é em cada dia da semana:
 *   - simulado (D-2): sem run, anuncia o papel dele ("os erros de hoje caem
 *     aqui automaticamente"); com o run registrado flipa "feito ✓" (o
 *     REGISTRO vence o relógio, lição 85/86) — e o CTA abre as frescas;
 *   - véspera (D-1): o DIA DELE — refazer no papel as pendências de Matemática;
 *   - prova (D-0): calma — revisão leve, nada novo, boa prova.
 * Fora da janela retorna null — silêncio honesto (regra da fila da 88):
 * caderno sem semana da Av1 na frente não inventa urgência.
 * Datas derivadas de MATH_SIMULADO_DATE / MATH_VESPERA_DATE / MATH_EXAM.date
 * — fonte única, para nunca divergir do hero/card/fila/agenda/flashcards.
 */
export interface NotebookExamBrief {
  kind: 'simulado-hoje' | 'simulado-feito' | 'vespera' | 'prova-hoje';
  titulo: string;
  /** Uma linha — o PORQUÊ (honesto, sem alarme). */
  chamada: string;
  /** Rótulo do CTA. null = faixa sem botão: o dia do papel e o dia da prova
   * falam por si (a ação é offline / é não-fazer). */
  cta: string | null;
}

export function notebookExamBriefFor(
  date: Date,
  mathPendentes: number,
  simuladoRun?: { solved: number; total: number } | null,
): NotebookExamBrief | null {
  const key = localDateKey(date);
  const pct =
    simuladoRun && simuladoRun.total > 0
      ? Math.round((simuladoRun.solved / simuladoRun.total) * 100)
      : null;

  if (key === MATH_SIMULADO_DATE) {
    if (simuladoRun) {
      return {
        kind: 'simulado-feito',
        titulo: `Simulado da Av1 feito ✓${pct !== null ? ` — ${pct}%` : ''}`,
        chamada:
          'as questões erradas e puladas de hoje já estão neste caderno — é o material da véspera: refaça cada uma no papel antes de marcar como revisada',
        cta: 'Ver as frescas',
      };
    }
    return {
      kind: 'simulado-hoje',
      titulo: 'É hoje: Simulado da Av1',
      chamada:
        'quando o run for registrado, as questões erradas e puladas caem automaticamente aqui — o resultado de hoje vira o material da véspera',
      cta: 'Abrir o simulado',
    };
  }
  if (key === MATH_VESPERA_DATE) {
    return {
      kind: 'vespera',
      titulo: 'Véspera da Av1 — o dia do papel',
      chamada:
        mathPendentes > 0
          ? `refaça no papel as ${mathPendentes} questões de Matemática pendentes neste caderno — erro que vira acerto hoje é ponto amanhã`
          : 'caderno de Matemática em dia — confira o kit da véspera no card da prova e confie no preparo',
      cta: null,
    };
  }
  if (key === MATH_EXAM.date) {
    return {
      kind: 'prova-hoje',
      titulo: 'É hoje: Prova da Av1',
      chamada:
        'revisão leve: só releia o que já está com ✓ — nada novo hoje, nem caderno; boa prova!',
      cta: null,
    };
  }
  return null;
}

export type PlanKind = 'estudo' | 'pratica' | 'simulado' | 'revisao' | 'prova';

// ---------- Praticar (aba Exercícios) na semana da Av1 ----------

/**
 * O BRIEF DA SEMANA DA AV1 PARA O PRATICAR — a aba Exercícios é o PALCO onde
 * o simulado acontece e era a única superfície de ação cega ao calendário:
 * o setup do Simulado Pro sabe o dia (82), o caderno no pé da aba fala (91),
 * mas o TOPO da aba — onde moram os botões "Simulado Pro" e "Revisão guiada"
 * — mostrava o banner estático "No ritmo da turma" até na manhã do simulado.
 * Pior: com o caderno vazio (a manhã de 29/09, ANTES do run) o early-return
 * do caderno esconde a faixa da 91 — a aba inteira silenciava no dia dela.
 * Esta função diz ao topo da aba o que ele faz em cada dia:
 *   - simulado (D-2): sem run, anuncia o palco ("escopo real, 10 questões,
 *     60 min; a S3 também é hoje") e o CTA abre o Simulado já configurado;
 *     com o run registrado flipa "feito ✓" (o REGISTRO vence o relógio,
 *     lição 85/86) e aponta a fila guiada desta mesma aba;
 *   - véspera (D-1): o dia da REVISÃO LEVE do plano (offset 1, kind
 *     'revisao') — a fila guiada percorre ★ e erros; papel/kit ficam offline;
 *   - prova (D-0): calma — nada de simulado novo, boa prova, sem CTA.
 * Fora da janela retorna null — silêncio honesto (regra da fila da 88).
 * Datas derivadas de MATH_SIMULADO_DATE / MATH_VESPERA_DATE / MATH_EXAM.date
 * — fonte única, para nunca divergir do hero/card/fila/agenda/flashcards/
 * caderno. `reviewCount` = tamanho da fila guiada (buildReviewQueue) — o CTA
 * só existe com fila real (fila vazia = botão cala, mesmo padrão do caderno).
 */
export interface PracticeExamBrief {
  kind: 'simulado-hoje' | 'simulado-feito' | 'vespera' | 'prova-hoje';
  titulo: string;
  /** Uma linha — o PORQUÊ (honesto, sem alarme). */
  chamada: string;
  /** Rótulo do CTA. null = faixa sem botão (o feito com fila vazia, a prova). */
  cta: string | null;
}

export function practiceExamBriefFor(
  date: Date,
  reviewCount: number,
  simuladoRun?: { solved: number; total: number } | null,
): PracticeExamBrief | null {
  const key = localDateKey(date);
  const pct =
    simuladoRun && simuladoRun.total > 0
      ? Math.round((simuladoRun.solved / simuladoRun.total) * 100)
      : null;

  if (key === MATH_SIMULADO_DATE) {
    if (simuladoRun) {
      return {
        kind: 'simulado-feito',
        titulo: `Simulado da Av1 feito ✓${pct !== null ? ` — ${pct}%` : ''}`,
        chamada:
          'os erros de hoje já estão no caderno abaixo — a fila guiada desta aba percorre eles e as ★ numa passada só',
        cta: 'Revisão guiada',
      };
    }
    return {
      kind: 'simulado-hoje',
      titulo: 'É hoje: Simulado da Av1',
      chamada:
        'escopo real da prova — 10 questões de Matrizes e Lógica, 60 min; a entrega da S3 de Algoritmos também é hoje',
      cta: 'Abrir o Simulado',
    };
  }
  if (key === MATH_VESPERA_DATE) {
    return {
      kind: 'vespera',
      titulo: 'Véspera da Av1 — revisão leve',
      chamada:
        'a fila guiada percorre suas ★ e os erros do caderno, uma por vez — 20 min bastam; o papel e o kit ficam offline',
      cta: 'Revisão guiada',
    };
  }
  if (key === MATH_EXAM.date) {
    return {
      kind: 'prova-hoje',
      titulo: 'É hoje: Prova da Av1',
      chamada:
        'nada de simulado novo hoje — só leveza, kit em mãos e confiança; boa prova!',
      cta: null,
    };
  }
  return null;
}

// ---------- Biblioteca fala a semana da Av1 ----------

/**
 * OS MATERIAIS DO ESCOPO DA AV1 — a Biblioteca é a asa TEÓRICA da semana
 * (os chips 'material' do plano abrem aqui) e era a única superfície cega ao
 * calendário: 52 materiais sem um sinal de quais 4 são a prova. Esta lista é
 * a FONTE ÚNICA do escopo teórico — os mesmos 4 do cabeçalho do módulo e do
 * plano (as listas impressas têm gêmeas digitais aqui). Ordem = ordem do
 * plano (Matrizes primeiro, Lógica depois — 85/86: uma ordem só).
 */
export const MATH_SCOPE_MATERIALS: {
  id: string;
  /** Rótulo curto do chip — o título completo mora no dialog do material. */
  short: string;
  kind: 'teoria' | 'lista';
  topico: 'Álgebra Matricial' | 'Lógica Matemática';
}[] = [
  { id: 'mat-00-matrizes', short: 'Matrizes — teoria da Aula 00', kind: 'teoria', topico: 'Álgebra Matricial' },
  { id: 'mat-01-matrizes', short: 'Matrizes — lista (Q1–35)', kind: 'lista', topico: 'Álgebra Matricial' },
  { id: 'mat-logica-slides', short: 'Lógica — slides (47p)', kind: 'teoria', topico: 'Lógica Matemática' },
  { id: 'mat-logica-lista', short: 'Lógica — lista (Q1–18)', kind: 'lista', topico: 'Lógica Matemática' },
];

export interface LibraryExamBrief {
  /** 'semana' = dias de lista (D-7..D-3); os outros = marcos do calendário. */
  kind: 'semana' | 'simulado-hoje' | 'vespera' | 'prova-hoje';
  daysLeft: number;
  /** Título curto — ex.: 'Semana da Av1 · faltam 4 dias'. */
  titulo: string;
  /** Uma linha honesta — o QUE a teoria faz neste dia (sem pânico, sem inventar). */
  linha: string;
  /** Quantos materiais do escopo já foram lidos (completedMaterials real). */
  lidos: number;
  total: number;
}

/**
 * O BRIEF DA SEMANA DA AV1 PARA A BIBLIOTECA — espelho dos briefs do
 * Praticar (practiceExamBriefFor) e do caderno (notebookExamBriefFor), na
 * MESMA gramática: janela honesta (silêncio fora do D-7..D-0), linguagem de
 * calma no D-0 e NENHUMA invenção de estado (lidos vem do progresso real).
 * `daysLeft` entra como PARÂMETRO (daysUntilDate do chamador) — este módulo
 * segue puro, sem importar o calendário (a mesma divisão do kit/veredito).
 */
export function libraryExamBriefFor(
  daysLeft: number,
  completedIds: readonly string[] | undefined | null,
): LibraryExamBrief | null {
  // Janela = a do PLANO (D-7 → D-0): antes dela a Biblioteca não tem nada a
  // dizer (o semestre manda); depois da prova, silêncio (regra da fila da 88).
  if (daysLeft < 0 || daysLeft > 7) return null;

  const done = new Set(completedIds ?? []);
  const lidos = MATH_SCOPE_MATERIALS.filter((m) => done.has(m.id)).length;
  const total = MATH_SCOPE_MATERIALS.length;

  if (daysLeft === 0) {
    return {
      kind: 'prova-hoje',
      daysLeft,
      titulo: 'É hoje: Prova da Av1',
      linha: 'hoje é o dia — só reler e respirar; nada novo entra agora',
      lidos,
      total,
    };
  }
  if (daysLeft === 1) {
    return {
      kind: 'vespera',
      daysLeft,
      titulo: 'Véspera da prova',
      linha: 'a folha e o kit mandam hoje — a teoria fica aqui só para consulta',
      lidos,
      total,
    };
  }
  if (daysLeft === MATH_SIMULADO_OFFSET) {
    return {
      kind: 'simulado-hoje',
      daysLeft,
      titulo: 'É hoje: Simulado da Av1',
      linha: 'a teoria abre só para conferir o que travou — o ensaio é no Praticar',
      lidos,
      total,
    };
  }
  const planoHoje = planDayFor(daysLeft);
  return {
    kind: 'semana',
    daysLeft,
    titulo: `Semana da Av1 · faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`,
    linha: planoHoje
      ? `o plano de hoje é "${planoHoje.titulo}" — a teoria do escopo fica a 1 clique`
      : 'a teoria do escopo da Av1 fica a 1 clique',
    lidos,
    total,
  };
}

// ---------- A disciplina fala a semana da Av1 (card + dialog) ----------

/**
 * BRIEF DA DISCIPLINA — a camada DISCIPLINA da Biblioteca (card na grade e
 * dialog de detalhes, aba Avaliação) era a última superfície grande cega à
 * reta final: a Av1 aparecia como uma linha estática de data (fonte honesta
 * de course-data, mas sem dias restantes, sem marco e sem ponte para o
 * plano). Este brief é a FONTE ÚNICA da voz da semana na disciplina.
 *
 * Janela HONESTA (regra da 88): D-7 → D-0; fora dela e pós-prova = null
 * (silêncio — a nota de 02/10 mora na calculadora, não aqui). `daysLeft`
 * entra como PARÂMETRO (daysUntilDate do chamador, mesma divisão da 98) —
 * o módulo segue PURO, sem ler relógio nem storage.
 *
 * Marcos derivados de MATH_EXAM.date: D-2 = dia do simulado oficial,
 * D-1 = véspera, D-0 = prova. Gramática de cor decidida pelo chamador
 * (kind): amber nos dias de semana/ensaio, rose só no dia da prova.
 */
export interface DisciplineExamBrief {
  kind: 'semana' | 'simulado' | 'vespera' | 'prova';
  daysLeft: number;
  /** Chip curto do card — ex.: 'Av1 · faltam 4 dias' / 'Av1 · é hoje'. */
  chip: string;
  /** Linha honesta do dialog (1 frase, sem duplicar o plano do Painel). */
  linha: string;
}

export function disciplineExamBriefFor(daysLeft: number): DisciplineExamBrief | null {
  if (daysLeft < 0 || daysLeft > 7) return null;
  if (daysLeft === 0) {
    return {
      kind: 'prova',
      daysLeft,
      chip: 'Av1 · é hoje',
      linha: 'a prova é hoje — levar o kit, chegar cedo e respirar',
    };
  }
  const dias = daysLeft === 1 ? '1 dia' : `${daysLeft} dias`;
  if (daysLeft === MATH_SIMULADO_OFFSET) {
    return {
      kind: 'simulado',
      daysLeft,
      chip: `Av1 · faltam ${dias}`,
      linha: 'hoje é o dia do simulado oficial (ensaio real no Praticar) — o run alimenta o kit da véspera',
    };
  }
  if (daysLeft === 1) {
    return {
      kind: 'vespera',
      daysLeft,
      chip: `Av1 · falta ${dias}`,
      linha: 'véspera — revisão leve: o kit da véspera tem o roteiro (folha, fórmulas e só as travadas)',
    };
  }
  return {
    kind: 'semana',
    daysLeft,
    chip: `Av1 · faltam ${dias}`,
    linha: 'a semana da Av1 vive no Painel — plano do dia, apoio e teoria a 1 clique',
  };
}

// ---------- A paleta de comandos sabe a semana (Ctrl+K) ----------

/**
 * Uma ação REAL da semana da Av1 dentro da paleta de comandos. A paleta é o
 * lançador power-user (Ctrl+K, botão do header, atalhos 1–8) e nos dias
 * críticos o primeiro grupo deve ser o da prova — quem digita 'av1' ou
 * 'simulado' acha a porta certa sem navegar.
 */
export interface PaletteExamAction {
  kind: 'simulado' | 'correcao' | 'kit' | 'folha' | 'plano';
  /** Rótulo curto do item. */
  label: string;
  /** Linha honesta — o que a ação faz AGORA (sem inventar estado). */
  hint: string;
  /** Marco é HOJE e ainda não aconteceu → pulso (gramática da 93). */
  pulsar?: boolean;
}

export interface PaletteExamBrief {
  kind: 'semana' | 'simulado' | 'vespera' | 'prova';
  daysLeft: number;
  /** Título do grupo — a MESMA voz da semana (regra da 88, gramática da 93). */
  heading: string;
  actions: PaletteExamAction[];
}

/**
 * BRIEF da paleta de comandos para a semana da Av1: a MESMA janela honesta
 * D-7→D-0 da disciplina (100) e da Biblioteca (98) — fora dela e pós-prova
 * = null (a nota de 02/10 mora na calculadora; a paleta não grita fora da
 * semana). `daysLeft` entra como PARÂMETRO (daysUntilDate do chamador —
 * mesma divisão da 98/100) e `hasRun` vem de findMathSimuladoRunOficial
 * (registro vence relógio, lição 85/86): com o run feito, a ação 'simulado'
 * dá vez à 'correção' — a paleta nunca oferece o ensaio que já aconteceu.
 *
 * As ações são as portas que JÁ existem: simulado = openSimulado(math_exam)
 * (o mesmo do hero), correção = openTutor(debrief) (o mesmo do hero feito ✓),
 * kit/plano = o Painel (onde moram o card e o kit), folha = a rota impressa.
 */
export function paletteExamBriefFor(
  daysLeft: number,
  hasRun: boolean,
): PaletteExamBrief | null {
  if (daysLeft < 0 || daysLeft > 7) return null;
  if (daysLeft === 0) {
    return {
      kind: 'prova',
      daysLeft,
      heading: 'É hoje: Prova da Av1',
      actions: [
        {
          kind: 'kit',
          label: 'Reler o Kit da Véspera (Painel)',
          hint: 'só reler e respirar — nada novo hoje',
        },
        {
          kind: 'folha',
          label: 'Folha de revisão para levar',
          hint: 'imprimir a folha — as travadas já estão listadas nela',
        },
      ],
    };
  }
  if (daysLeft === MATH_SIMULADO_OFFSET) {
    return {
      kind: 'simulado',
      daysLeft,
      heading: 'É hoje: Simulado da Av1',
      actions: [
        hasRun
          ? {
              kind: 'correcao',
              label: 'Pedir correção do simulado (IA)',
              hint: 'o tutor lê seu placar por tópico e comenta — o mesmo debrief do resultado',
            }
          : {
              kind: 'simulado',
              label: 'Iniciar o Simulado da Av1',
              hint: 'o ensaio real no Praticar — depois o run alimenta o kit da véspera',
              pulsar: true,
            },
        {
          kind: 'kit',
          label: 'Kit da véspera (Painel)',
          hint: 'o roteiro calmo já está montado — o bloco fraco aparece depois do run',
        },
      ],
    };
  }
  if (daysLeft === 1) {
    return {
      kind: 'vespera',
      daysLeft,
      heading: 'Véspera da prova',
      actions: [
        {
          kind: 'kit',
          label: 'Abrir o Kit da Véspera (Painel)',
          hint: 'folha, fórmulas e só as travadas — o roteiro da véspera',
        },
        {
          kind: 'folha',
          label: 'Folha de revisão para imprimir',
          hint: 'espelho do papel — revisar com calma longe da tela',
        },
        ...(hasRun
          ? [
              {
                kind: 'correcao' as const,
                label: 'Pedir correção do simulado (IA)',
                hint: 'o placar de ontem comentado — o bloco fraco primeiro',
              },
            ]
          : []),
      ],
    };
  }
  const dias = daysLeft === 1 ? '1 dia' : `${daysLeft} dias`;
  return {
    kind: 'semana',
    daysLeft,
    heading: `Semana da Av1 · faltam ${dias}`,
    actions: [
      {
        kind: 'simulado',
        label: 'Simulado da Av1 — ensaio real',
        hint: 'prova completa no Praticar com o escopo real da prova',
      },
      {
        kind: 'plano',
        label: 'Plano da semana (Painel)',
        hint: 'o dia de hoje tem teoria, apoio e revisão a 1 clique',
      },
    ],
  };
}

// ---------- O método sabe a semana (Sessão Guiada) ----------

/**
 * BRIEF da semana da Av1 para o Método (Sessão Guiada): a última superfície
 * grande de fluxo natural que ainda não falava a semana. A MESMA janela
 * honesta D-7→D-0 da Biblioteca (98) e da disciplina (100) — fora dela e
 * pós-prova = null (regra da 88). `daysLeft` entra como PARÂMETRO
 * (daysUntilDate do chamador — mesma divisão da 98/100/101).
 *
 * A SUGESTÃO é o fechamento do loop material-first: em dias de estudo
 * (D-7→D-3, todos 'pratica' no plano), o tema do plano de hoje (o título do
 * dia — ex.: 'Lista de Lógica — Parte 1 (Q1–12)') vira a sessão guiada a
 * 1 clique — planejar/recuperar/explicar EXATAMENTE a lista que cai. Nos
 * dias em que o método NÃO é a ferramenta certa, a sugestão CALA (honesto):
 * D-2 o dia é do ensaio real no Praticar, D-1 é do kit da véspera, D-0 é
 * de chegar cedo e respirar.
 */
export interface MethodExamBrief {
  kind: 'semana' | 'simulado' | 'vespera' | 'prova';
  daysLeft: number;
  /** Título da faixa — a MESMA voz da semana (gramática da 93). */
  heading: string;
  /** Linha honesta — o que o método é (ou não é) HOJE. */
  linha: string;
  /** Tema do plano de hoje — presente só nos dias de estudo (D-7→D-3). */
  sugestao?: { tema: string; disciplinaCode: string };
}

export function methodExamBriefFor(daysLeft: number): MethodExamBrief | null {
  if (daysLeft < 0 || daysLeft > 7) return null;
  if (daysLeft === 0) {
    return {
      kind: 'prova',
      daysLeft,
      heading: 'É hoje: Prova da Av1',
      linha: 'hoje não é dia de sessão — levar o kit, chegar cedo e respirar',
    };
  }
  if (daysLeft === MATH_SIMULADO_OFFSET) {
    return {
      kind: 'simulado',
      daysLeft,
      heading: 'É hoje: Simulado da Av1',
      linha: 'hoje o dia é do ensaio real no Praticar — o método espera',
    };
  }
  if (daysLeft === 1) {
    return {
      kind: 'vespera',
      daysLeft,
      heading: 'Véspera da prova',
      linha: 'a véspera é do kit da véspera — folha, fórmulas e só as travadas',
    };
  }
  const dias = `${daysLeft} dias`;
  const plano = planDayFor(daysLeft);
  return {
    kind: 'semana',
    daysLeft,
    heading: `Semana da Av1 · faltam ${dias}`,
    linha: 'a sessão guiada rende mais com o tema do plano — planeje, recupere e explique a lista que cai',
    sugestao: plano
      ? { tema: plano.titulo, disciplinaCode: MATH_EXAM.disciplineCode }
      : undefined,
  };
}

export interface PlanTask {
  texto: string;
  materialId?: string; // abre na Biblioteca (openMethod)
  exercisePool?: string[]; // ids no Praticar
}

export interface PlanDay {
  offset: number; // dias antes da prova (0 = dia da prova)
  kind: PlanKind;
  titulo: string;
  minutos: number;
  tarefas: PlanTask[];
}

/**
 * Plano D-7 (24/09 → 01/10) — UM DIA POR OFFSET, centrado em RESOLVER AS LISTAS.
 * offset = dias antes da prova (7 = hoje 24/09, 0 = dia da prova).
 * Ordem recomendada das listas impressas (as 3 folhas que o dono tem):
 *   1º Lista de Matrizes (35Q, em 3 blocos) → 2º Lista de Lógica (18Q, em 2 partes).
 * Determinantes e sistemas lineares NÃO caem — nada aqui depende deles.
 */
export const MATH_EXAM_PLAN: PlanDay[] = [
  {
    offset: 7, // 24/09 — HOJE
    kind: 'pratica',
    titulo: 'Lista de Matrizes — Bloco 1 (Q1–16)',
    minutos: 90,
    tarefas: [
      { texto: 'No papel impresso: Q1–8 (construir matrizes pela lei de formação e igualdade) — a teoria da Aula 00 fica ao lado SÓ para consultar', materialId: 'mat-01-matrizes' },
      { texto: 'Q9–16: soma, diferença, escalar e equações matriciais simples (ex.: X + A = B − C)', materialId: 'mat-01-matrizes' },
      { texto: 'Marcar com caneta as que travaram — viram prioridade no Bloco 3 (D-5)', },
    ],
  },
  {
    offset: 6, // 25/09
    kind: 'pratica',
    titulo: 'Lista de Matrizes — Bloco 2 (Q17–30)',
    minutos: 90,
    tarefas: [
      { texto: 'Q17–22: produtos (linha × coluna) e potências A², A³, Aⁿ — a ideia da Q19/Q20 vale ouro', materialId: 'mat-01-matrizes' },
      { texto: 'Q23–30: matrizes que comutam, transposta e simétrica/antissimétrica', materialId: 'mat-01-matrizes' },
      { texto: 'Apoio no Praticar: mat-ex03 (AB ≠ BA) e mat-ex04 (transposta + antissimétrica)', exercisePool: ['mat-ex03', 'mat-ex04'] },
    ],
  },
  {
    offset: 5, // 26/09
    kind: 'pratica',
    titulo: 'Lista de Matrizes — Bloco 3 (Q31–35: inversa) + revisão',
    minutos: 75,
    tarefas: [
      { texto: 'Q31–35: inversa — depois de inverter, SEMPRE confira A·A⁻¹ = I (a verificação pega quase todo erro)', materialId: 'mat-01-matrizes' },
      { texto: 'Refazer as marcadas no Bloco 1: tentar primeiro, consultar a teoria depois', materialId: 'mat-00-matrizes' },
      { texto: 'Determinantes como TÓPICO não caem — se usar a fórmula da inversa 2×2 (det = ad − bc por dentro), ela está nos cards abaixo', },
    ],
  },
  {
    offset: 4, // 27/09
    kind: 'pratica',
    titulo: 'Lista de Lógica — Parte 1 (Q1–12)',
    minutos: 90,
    tarefas: [
      { texto: 'Q1–7: proposições (V/F), tradução português ↔ símbolos e valores lógicos', materialId: 'mat-logica-lista' },
      { texto: 'Q8–10: tabelas-verdade e tautologia/contradição/contingência — monte TODAS as linhas', materialId: 'mat-logica-lista' },
      { texto: 'Q11–12: equivalências, negações e quantificadores (a Q12 usa ∀ e ∃ — negue com cuidado)', materialId: 'mat-logica-lista' },
      { texto: 'Apoio no Praticar: mat-ex07 (proposições) e mat-ex08 (negações)', exercisePool: ['mat-ex07', 'mat-ex08'] },
    ],
  },
  {
    offset: 3, // 28/09
    kind: 'pratica',
    titulo: 'Lista de Lógica — Parte 2 (Q13–18: argumentos)',
    minutos: 90,
    tarefas: [
      { texto: 'Q13–15: encadeamentos estilo múltipla escolha — exatamente o formato de prova', materialId: 'mat-logica-lista' },
      { texto: 'Q16–18: ilha dos cavalheiros/velhacos, OBMEP dos tamanduás e o caso do crime — raciocínio puro, com calma', materialId: 'mat-logica-lista' },
      { texto: 'Apoio no Praticar: mat-ex11 (De Morgan) e mat-ex12 (validade de argumento)', exercisePool: ['mat-ex11', 'mat-ex12'] },
    ],
  },
  {
    offset: 2, // 29/09
    kind: 'simulado',
    titulo: 'SIMULADO — prova completa',
    minutos: 75,
    tarefas: [
      { texto: 'Simulado Pro: 10 questões de Matemática, 60 min, sem consultar nada antes de responder', },
      { texto: 'Meta: ≥ 70% (nota de aprovação). Abaixo disso → o bloco com mais erros vira a revisão de amanhã', },
      { texto: 'Refazer no papel as que erraram, com o card de fórmulas fechado ao lado', },
    ],
  },
  {
    offset: 1, // 30/09
    kind: 'revisao',
    titulo: 'Véspera — revisão leve e erros',
    minutos: 50,
    tarefas: [
      { texto: 'Recitar os cards de fórmulas de memória (abaixo) — Matrizes primeiro, Lógica depois', },
      { texto: 'Refazer SOMENTE as questões que travaram nas duas listas — o Hub guarda as travadas marcadas (na folha impressa elas vêm listadas)', },
      { texto: 'Perguntas de autoavaliação dos resumos IA dos 4 materiais de Matemática (leve, antes de dormir)', materialId: 'mat-01-matrizes' },
    ],
  },
  {
    offset: 0, // 01/10
    kind: 'prova',
    titulo: 'DIA DA PROVA — 01/10',
    minutos: 20,
    tarefas: [
      { texto: 'Manhã: reler só os cards de fórmulas e a tabela da implicação (15 min, sem exercício novo)', },
      { texto: 'Levar: caneta, lápis, borracha, calculadora (se permitido) e água', },
      { texto: 'Na prova: ler o enunciado 2×, começar pelas fáceis e conferir inversa com A·A⁻¹ = I', },
    ],
  },
];

export interface FormulaCard {
  grupo: 'Matrizes' | 'Lógica';
  titulo: string;
  corpo: string; // suporta \n
  /** Linhas em LaTeX (KaTeX) — renderizadas como matemática de verdade no card. */
  math?: string[];
  fonte: string; // material de origem
}

/** Fórmulas-regras extraídas dos resumos IA dos materiais (formulas_regras).
 *  math[] em LaTeX (KaTeX) — o card renderiza como matemática de verdade. */
export const MATH_FORMULAS: FormulaCard[] = [
  {
    grupo: 'Matrizes', titulo: 'Ordem e elemento geral',
    corpo: 'A com m linhas × n colunas → ordem m×n.\nElemento aij = linha i, coluna j.',
    math: ['A_{m \\times n},\\quad a_{ij} = \\text{linha } i,\\ \\text{coluna } j'],
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'Soma e escalar',
    corpo: 'A + B: somar elemento a elemento (mesma ordem).\nkA: multiplicar TODOS os aij por k.',
    math: ['(A+B)_{ij} = a_{ij} + b_{ij},\\quad (kA)_{ij} = k \\cdot a_{ij}'],
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'Multiplicação',
    corpo: 'Só existe se colunas de A = linhas de B — linha i de A × coluna j de B.\nAB ≠ BA (não é comutativa!).',
    math: ['A_{m \\times n} \\cdot B_{n \\times p} = C_{m \\times p}', 'c_{ij} = \\sum_{k=1}^{n} a_{ik} \\cdot b_{kj},\\quad AB \\neq BA'],
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'Transposta e simetria',
    corpo: 'Aᵀ: linhas viram colunas.\nAntissimétrica: diagonal toda zero.',
    math: ['(A^T)_{ij} = a_{ji}', 'A = A^T \\;\\text{(simétrica)},\\quad A^T = -A \\;\\text{(antissimétrica)}'],
    fonte: 'mat-01-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'Inversa 2×2 (com det por dentro)',
    corpo: 'Determinantes como TÓPICO não caem — a fórmula abaixo é a única ferramenta necessária.\ndet(A) = 0 ⇒ NÃO existe inversa. SEMPRE confira A·A⁻¹ = I.',
    math: ['A^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix},\\quad A \\cdot A^{-1} = I'],
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Matrizes', titulo: 'PÓS-PROVA: determinantes e sistemas',
    corpo: 'Determinantes (3×3/Sarrus) e Sistemas Lineares (AX = B) são os tópicos 1.3 e 1.4 — o professor ainda NÃO deu (confirmado 24/09): não caem na Av1.',
    fonte: 'mat-00-matrizes',
  },
  {
    grupo: 'Lógica', titulo: 'Conectivos',
    corpo: 'não · e · ou · se…então · se e só se.',
    math: ['\\neg p,\\quad p \\land q,\\quad p \\lor q,\\quad p \\rightarrow q,\\quad p \\leftrightarrow q'],
    fonte: 'mat-logica-slides',
  },
  {
    grupo: 'Lógica', titulo: 'Tabela da implicação',
    corpo: '(V,V)=V · (V,F)=F · (F,V)=V · (F,F)=V',
    math: ['p \\rightarrow q \\;\\text{é F APENAS quando } V \\rightarrow F'],
    fonte: 'mat-logica-slides',
  },
  {
    grupo: 'Lógica', titulo: 'Tautologia × Contradição',
    corpo: 'Tautologia: sempre V. Contradição: sempre F. Contingência: depende dos valores.',
    math: ['p \\lor \\neg p \\;\\text{(tautologia)},\\quad p \\land \\neg p \\;\\text{(contradição)}'],
    fonte: 'mat-logica-lista',
  },
  {
    grupo: 'Lógica', titulo: 'De Morgan',
    corpo: 'Negou o E vira OU de negações!',
    math: ['\\neg(p \\land q) \\equiv \\neg p \\lor \\neg q', '\\neg(p \\lor q) \\equiv \\neg p \\land \\neg q'],
    fonte: 'mat-logica-slides',
  },
  {
    grupo: 'Lógica', titulo: 'Regras de argumento',
    corpo: 'As três regras que validam argumentos — caem no formato "premissas → conclusão".',
    math: ['\\text{Ponens: } p \\rightarrow q,\\ p \\vdash q', '\\text{Tollens: } p \\rightarrow q,\\ \\neg q \\vdash \\neg p', '\\text{Silogismo: } p \\rightarrow q,\\ q \\rightarrow r \\vdash p \\rightarrow r'],
    fonte: 'mat-logica-lista',
  },
];

/** Checklist de domínio — marcado pelo aluno no card da prova. */
export const MATH_CHECKLIST: { grupo: string; itens: string[] }[] = [
  {
    grupo: 'Matrizes (núcleo da Av1)',
    itens: [
      'Identificar ordem e elementos aij',
      'Somar matrizes e multiplicar por escalar',
      'Multiplicar matrizes sabendo quando é possível (AB ≠ BA)',
      'Montar a transposta e testar simetria/antissimetria',
      'Inverter matriz e verificar com A·A⁻¹ = I',
      'Resolver equações matriciais simples (X + A = B − C)',
    ],
  },
  {
    grupo: 'Pós-prova — NÃO cai na Av1',
    itens: [
      'Determinantes como tópico (2×2 aparece só por dentro da inversa)',
      'Sistemas lineares via AX = B (professor ainda não deu — confirmado 24/09)',
    ],
  },
  {
    grupo: 'Lógica (revisão contínua)',
    itens: [
      'Reconhecer proposições e valores lógicos',
      'Negar proposições simples e compostas',
      'Montar tabela-verdade de proposição composta',
      'Classificar tautologia/contradição/contingência',
      'Aplicar De Morgan',
      'Validar argumento com Modus Ponens/Tollens',
    ],
  },
];

/**
 * Janela do KIT DA VÉSPERA: o bloco calmo do card da prova só existe quando
 * falta pouco — do DIA DO SIMULADO (D-2, 29/09: à noite o dono já começa a
 * transição) até o DIA DA PROVA (D-0). Antes disso o plano das listas manda;
 * mostrar o kit cedo seria ruído, não calma.
 */
export function isVesperaWindow(daysLeft: number): boolean {
  return daysLeft >= 0 && daysLeft <= 2;
}

/** Dia do plano para "faltam N dias" (N = daysUntilDate da prova). */
export function planDayFor(daysLeft: number): PlanDay | undefined {
  return MATH_EXAM_PLAN.find((d) => d.offset === daysLeft);
}

/**
 * Offset do dia do SIMULADO no plano — fonte única derivada do PRÓPRIO plano
 * (mesma filosofia do MATH_SIMULADO_DATE): mudou o plano, muda o offset junto.
 */
export const MATH_SIMULADO_OFFSET =
  MATH_EXAM_PLAN.find((d) => d.kind === 'simulado')?.offset ?? 2;

/**
 * Um dia do plano está FEITO quando todas as suas tarefas estão marcadas.
 * (A mesma conta que a linha do tempo usa — extraída para o banner e o
 * diálogo do plano completo não divergirem da timeline.)
 */
export function planDayChecked(
  d: PlanDay,
  checked: Record<string, boolean>,
): boolean {
  return d.tarefas.every((_, i) => checked[`${d.offset}-${i}`] === true);
}

/**
 * Dias do plano que ficaram PARA TRÁS — só os PENDENTES de verdade.
 * O antigo missedPlanDays contava TODO dia passado: com o plano em curso,
 * o card acusava dias cumpridos ("SIMULADO — prova completa ficou para
 * trás" na véspera, mesmo com a prova feita no Hub). Um dia passado deixa
 * de ser pendente quando: (a) todas as tarefas estão marcadas, OU (b) é o
 * dia do simulado e a prova de Matemática do dia oficial já existe no
 * histórico — o run é o registro verdadeiro; as checkboxes são opcional.
 */
export function planDaysBehind(
  daysLeft: number,
  checked: Record<string, boolean>,
  simuladoFeitoNoDiaOficial: boolean,
): PlanDay[] {
  if (daysLeft >= MATH_EXAM_PLAN.length) return [];
  return MATH_EXAM_PLAN.filter(
    (d) =>
      d.offset > daysLeft &&
      d.offset > 0 &&
      !planDayChecked(d, checked) &&
      !(d.kind === 'simulado' && simuladoFeitoNoDiaOficial),
  );
}

// ---------- Baralho da Av1 (flashcards Leitner) ----------

/**
 * Baralho pronto da Av1 — 1 toque adiciona ao sistema Leitner do Praticar
 * (aba Flashcards). Frente = pergunta curta; verso = fórmula em LaTeX
 * (renderizada com KaTeX pelo verso do cartão) + regra em português.
 * Conteúdo 1:1 com MATH_FORMULAS e os materiais reais da disciplina.
 */
export const MATH_FLASHCARDS: { front: string; back: string }[] = [
  {
    front: 'Como se lê a ordem de uma matriz e o que é o elemento aij?',
    back: 'Ordem **m × n** = linhas × colunas.\n$A_{m \\times n}$ — o elemento $a_{ij}$ está na **linha $i$, coluna $j$**.',
  },
  {
    front: 'Como somar matrizes e multiplicar por escalar?',
    back: 'Soma: elemento a elemento, **só existe se as ordens forem iguais**.\n$(A+B)_{ij} = a_{ij} + b_{ij}$\nEscalar: multiplica TODOS os elementos: $(kA)_{ij} = k \\cdot a_{ij}$.',
  },
  {
    front: 'Quando o produto A·B existe e como calculo cada elemento?',
    back: 'Só existe se **colunas de A = linhas de B**: $A_{m \\times n} \\cdot B_{n \\times p} = C_{m \\times p}$\n$c_{ij} = \\sum_{k=1}^{n} a_{ik} \\cdot b_{kj}$ (linha $i$ de $A$ × coluna $j$ de $B$).\n**AB ≠ BA** — produto de matrizes NÃO é comutativo!',
  },
  {
    front: 'Como montar a transposta de A?',
    back: 'Linhas viram colunas: $(A^T)_{ij} = a_{ji}$\nA 1ª linha de $A$ vira a 1ª coluna de $A^T$.',
  },
  {
    front: 'O que é matriz simétrica? E antissimétrica?',
    back: 'Simétrica: $A = A^T$ (espelho na diagonal).\nAntissimétrica: $A^T = -A$ ⇒ a **diagonal é toda zero**.',
  },
  {
    front: 'Fórmula da inversa de uma matriz 2×2?',
    back: '$A^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$\ntrocando $a \\leftrightarrow d$ e invertendo o sinal de $b$ e $c$.',
  },
  {
    front: 'Quando uma matriz NÃO tem inversa? Como conferir a inversa?',
    back: 'Se $ad - bc = 0$ ⇒ **não existe** inversa.\nSEMPRE confira: $A \\cdot A^{-1} = I$ (multiplicar tem que dar identidade).',
  },
  {
    front: 'O que é proposição? Quais frases NÃO são proposições?',
    back: 'Frase declarativa com valor lógico único: só **V ou F**.\nNão são: sentenças abertas ($x + 3 = 5$), imperativas ("Estude!"), interrogativas e paradoxos ("esta frase é falsa").',
  },
  {
    front: 'Tabela da implicação p → q — quando é falsa?',
    back: '$p \\rightarrow q$ é **F APENAS quando V → F**.\n$(V,V)=V \\; (V,F)=F \\; (F,V)=V \\; (F,F)=V$',
  },
  {
    front: 'Quantas linhas tem a tabela-verdade de uma proposição com n variáveis?',
    back: '$2^n$ linhas.\n2 variáveis → 4 linhas; 3 variáveis → 8 linhas.',
  },
  {
    front: 'Tautologia, contradição e contingência — definição e exemplo?',
    back: 'Tautologia: sempre V — $p \\lor \\neg p$.\nContradição: sempre F — $p \\land \\neg p$.\nContingência: depende dos valores — $p \\rightarrow q$.',
  },
  {
    front: 'Quais são as equivalências de De Morgan?',
    back: '$\\neg(p \\land q) \\equiv \\neg p \\lor \\neg q$\n$\\neg(p \\lor q) \\equiv \\neg p \\land \\neg q$\nNegou o E vira OU de negações (e vice-versa)!',
  },
  {
    front: 'Modus Ponens, Modus Tollens e Silogismo — os esquemas?',
    back: 'Ponens: $p \\rightarrow q,\\; p \\vdash q$\nTollens: $p \\rightarrow q,\\; \\neg q \\vdash \\neg p$\nSilogismo: $p \\rightarrow q,\\; q \\rightarrow r \\vdash p \\rightarrow r$',
  },
  {
    front: 'O que NÃO cai na Av1 de Matemática (01/10)?',
    back: 'Determinantes como TÓPICO (1.3) e Sistemas Lineares (1.4) — o professor ainda não deu (confirmado 24/09).\nO $ad - bc$ aparece só por dentro da fórmula da inversa 2×2.',
  },
];

/** Chave no localStorage que marca que o baralho da Av1 já foi adicionado. */
export const MATH_DECK_FLAG = 'hub:math-exam:v1:deck-added';

/**
 * KIT DO DIA DA PROVA — o que levar. Fonte única usada pelo Kit da Véspera
 * (card do Painel) e pela Folha de Revisão (/folha-revisao): um lugar só,
 * para nunca divergirem.
 */
export const MATH_EXAM_KIT: { emoji: string; label: string }[] = [
  { emoji: '✒️', label: 'caneta' },
  { emoji: '✏️', label: 'lápis' },
  { emoji: '🧽', label: 'borracha' },
  { emoji: '🧮', label: 'calculadora (se permitida)' },
  { emoji: '💧', label: 'água' },
];

// ---------- Travadas das listas impressas ----------

/**
 * As DUAS listas impressas que o dono resolve no papel (ordem definida no
 * plano de 24/09: 1º Matrizes em 3 blocos, 2º Lógica em 2 partes). O Hub
 * mantém o ESPELHO DIGITAL das marcas de caneta: o aluno marca aqui as
 * questões que travaram, e a véspera (Kit da Véspera + Folha de Revisão)
 * usa o registro para dizer EXATAMENTE o que refazer — sem "marquei a
 * caneta e perdi a folha".
 */
export const MATH_LISTAS: {
  id: 'matrizes' | 'logica';
  nome: string;
  total: number;
  fonte: string; // materialId da lista na Biblioteca
  resumo: string;
}[] = [
  {
    id: 'matrizes',
    nome: 'Lista de Matrizes',
    total: 35,
    fonte: 'mat-01-matrizes',
    resumo: '35 questões · blocos Q1–16, Q17–30 e Q31–35 no plano',
  },
  {
    id: 'logica',
    nome: 'Lista de Lógica',
    total: 18,
    fonte: 'mat-logica-lista',
    resumo: '18 questões · partes Q1–12 e Q13–18 no plano',
  },
];

/** Chave do espelho no localStorage: {"matrizes-7": true, "logica-4": true, ...}. */
export const MATH_TRAVADAS_KEY = 'hub:math-exam:v1:travadas';

/**
 * Chave das marcações do plano (tarefas/checklist feitas) — FONTE ÚNICA: o
 * card da prova e o contexto do tutor (buildHubContext) leem a MESMA chave,
 * para o estado "feito" nunca divergir entre superfícies (lição 85/86).
 */
export const MATH_PLAN_KEY = 'hub:math-exam:v1:plan';

/** Defesa de leitura: lixo/corrompido/parcial volta como objeto limpo. */
export function normalizeTravadas(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true) out[k] = true;
  }
  return out;
}

/** Total de travadas (soma das duas listas). */
export function countTravadas(travadas: Record<string, boolean>): number {
  return Object.values(travadas).filter(Boolean).length;
}

/**
 * "Matrizes Q7, Q12 · Lógica Q4" — formato ÚNICO usado pelo Kit da Véspera
 * e pela Folha de Revisão, para as duas superfícies nunca divergirem.
 * Sem travadas → string vazia (a superfície decide o estado vazio honesto).
 */
export function formatTravadas(travadas: Record<string, boolean>): string {
  return MATH_LISTAS.map((lista) => {
    const qs: number[] = [];
    for (let q = 1; q <= lista.total; q++) {
      if (travadas[`${lista.id}-${q}`]) qs.push(q);
    }
    if (qs.length === 0) return null;
    const nomeCurto = lista.nome.replace('Lista de ', '');
    return `${nomeCurto} Q${qs.join(', Q')}`;
  })
    .filter((p): p is string => p !== null)
    .join(' · ');
}

// ---------------------------------------------------------------------------
// O ENSAIO NÃO É A NOTA (rodada 108) — a Calculadora é o destino do pós-prova
// (CTA do card pós-prova, rodada 77) e a fila lê realGrades['TEC.1984-Av1']
// como FONTE ÚNICA da nota real (findNotaRealAv1). Mas a seção "Minhas notas
// reais" convida a "registrar as notas reais das avaliações que você JÁ FEZ"
// e, na noite do simulado (29/09, meta 70%), o % do ensaio é exatamente o
// número que pede para ser digitado na linha Av1. Registro ANTES do evento
// não é nota real (ordem do tempo, lição 107): apagava a prova do radar
// ("Próxima prova" da própria calculadora) e, depois da prova, viraria
// "nota 70 registrada ✓ acima da meta" fabricada pelo ensaio.
// ---------------------------------------------------------------------------

/** Forma mínima de um registro de nota real (study-progress realGrades). */
export interface RealGradeRecordLike {
  grade?: number;
  doneAt?: string;
}

/** Chave do registro da nota real da Av1 — a MESMA gramática da Calculadora. */
export const MATH_NOTA_REAL_KEY = `${MATH_EXAM.disciplineCode}-${MATH_EXAM.evaluationName}`;

/** Data da prova em 'dd/mm' — a voz da calculadora cita o dia sem hardcode. */
export const MATH_EXAM_DATE_SHORT = `${MATH_EXAM.date.slice(8, 10)}/${MATH_EXAM.date.slice(5, 7)}`;

/** Dias até a prova a partir de now (âncora local 00:00, mesma regra do daysUntilDate). */
function daysToExamFrom(now: Date): number {
  const exam = new Date(`${MATH_EXAM.date}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((exam.getTime() - today.getTime()) / 86400000);
}

/**
 * A ordem do tempo manda (lição 107): nota REAL da Av1 só existe DEPOIS do
 * dia da prova. Um registro lançado antes (ex.: o % do simulado de 29/09
 * digitado na mesma noite) não vira nota — a fila não comemora, a média real
 * não o herda, o radar da calculadora não perde a prova. Registros sem
 * timestamp pós-prova valem (benefício da dúvida: dados antigos não provam a
 * ordem, e o leitor não inventa uma culpa que não sabe que existe).
 */
export function notaRealAv1Valida(
  registro?: RealGradeRecordLike | null,
  now: Date = new Date(),
): boolean {
  if (registro == null || typeof registro.grade !== 'number') return false;
  if (daysToExamFrom(now) >= 0) return false; // a prova ainda não aconteceu
  if (!registro.doneAt) return true;
  return new Date(registro.doneAt).getTime() >= new Date(`${MATH_EXAM.date}T00:00:00`).getTime();
}

export interface GradeTableExamStrip {
  tone: 'amber' | 'rose' | 'emerald';
  /** Chip tabular ('D-2' | 'D-1' | 'hoje') — pós-prova fala pelo título, sem chip. */
  chip: string;
  title: string;
  text: string;
}

export interface GradeTableExamBrief {
  daysLeft: number;
  examHasHappened: boolean;
  /** Existe registro com nota numérica na linha Av1. */
  typed: boolean;
  /** Registro existe mas não vale como nota real (ordem do tempo) — a linha mostra 'confira'. */
  suspectEnsaio: boolean;
  /** Voz da semana da seção (janela honesta: simulado/vespera/prova + pós-prova sem nota). */
  strip: GradeTableExamStrip | null;
}

/**
 * FONTE ÚNICA da voz da semana na Calculadora (seção "Minhas notas reais").
 * Regras: dentro da janela (D-2 simulado → D-0 prova) a faixa SEMPRE fala —
 * a prevenção é mais necessária exatamente quando um registro suspeito
 * aparece (a linha mostra o 'confira', a faixa mostra a semana). Pós-prova
 * sem nota → convite honesto (a promessa do CTA da 77). Pós-prova com
 * registro válido → silêncio (a linha celebra). Registro suspeito pós-prova
 * → faixa âmbar apontando a linha. Fora da janela → silêncio (regra da 88:
 * calculadora é ferramenta, quem fala da semana são o kit e o cronograma).
 */
export function gradeTableExamBriefFor(
  registro?: RealGradeRecordLike | null,
  now: Date = new Date(),
): GradeTableExamBrief {
  const daysLeft = daysToExamFrom(now);
  const examHasHappened = daysLeft < 0;
  const typed = registro != null && typeof registro.grade === 'number';
  const suspectEnsaio = typed && !notaRealAv1Valida(registro, now);
  let strip: GradeTableExamStrip | null = null;
  if (!examHasHappened && daysLeft === 2) {
    strip = {
      tone: 'amber',
      chip: 'D-2',
      title: 'Hoje é o simulado — nada para lançar aqui',
      text: `o % do ensaio mora no histórico e no kit da véspera — a nota real da Av1 entra nesta tabela só depois da prova de ${MATH_EXAM_DATE_SHORT}`,
    };
  } else if (!examHasHappened && daysLeft === 1) {
    strip = {
      tone: 'amber',
      chip: 'D-1',
      title: 'Av1 amanhã — a tabela espera a nota real',
      text: 'nenhum % de ensaio vira nota aqui; hoje o kit da véspera leva o que importa — quando a Av1 sair, o lugar dela é nesta tabela',
    };
  } else if (!examHasHappened && daysLeft === 0) {
    strip = {
      tone: 'rose',
      chip: 'hoje',
      title: 'Prova hoje — a tabela fica em silêncio',
      text: `quando a nota sair, lance no componente Av1 abaixo: a situação real, a média e a fila acordam na hora (a prova é de ${MATH_EXAM_DATE_SHORT})`,
    };
  } else if (examHasHappened && typed && suspectEnsaio) {
    strip = {
      tone: 'amber',
      chip: '',
      title: 'A nota lançada é anterior à prova',
      text: `o registro da Av1 foi feito antes do dia da prova (${MATH_EXAM_DATE_SHORT}) — se é o % do simulado, apague: ensaio mora no histórico; a nota real entra quando sair`,
    };
  } else if (examHasHappened && !typed) {
    strip = {
      tone: 'emerald',
      chip: '',
      title: 'A Av1 aconteceu — a nota mora aqui',
      text: `a prova de ${MATH_EXAM_DATE_SHORT} ficou para trás — quando o resultado sair, lance a nota no componente Av1 e a fila larga o "anotar a nota" na hora`,
    };
  }
  return { daysLeft, examHasHappened, typed, suspectEnsaio, strip };
}
