// recovery-plan.ts — PLANO DE RECUPERAÇÃO (a partir de 22/09/2026)
//
// Situação real informada pelo dono: até 22/09 só a Semana 1 de Algoritmos foi
// feita (COMPROVADA pelo arquivo "Programas C.7z" → material
// 'alg-programas-c-autorais'). O resto está pendente e a Prova de Matemática
// é 01/10. Este módulo calcula a semana atual e monta a FILA DE PRIORIDADES:
// assuntos curtos e essenciais primeiro; RHT e leveza ficam para depois da prova.
//
// Princípio (padrão do site): quando um material novo chega, a situação de cada
// trilha muda sozinha (topicosCobertos/material-first) — aqui a fonte é a
// conversa + arquivo autoral, então o estado é declarado explicitamente.

import {
  MATH_EXAM,
  MATH_EXAM_PLAN,
  MATH_META,
  MATH_SIMULADO_DATE,
  findMathSimuladoRunOficial,
  planDayFor,
} from './math-exam-prep';
import { daysUntilDate } from './semester';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Início do ciclo de "Questões da Semana" do prof. Fábio: quarta 09/09/2026. */
export const QUESTIONS_CYCLE_START = new Date(2026, 8, 9);

export interface ClassWeekInfo {
  /** Semana do semestre oficial (início 24/08/2026) — 1-based. */
  semesterWeek: number;
  /** Semana do ciclo de questões (S1 = 09/09) — roda de quarta a terça. */
  questionsWeek: number;
  /** Quarta que abre a semana atual do ciclo. */
  weekStart: Date;
  /** Terça que fecha a semana atual do ciclo. */
  weekEnd: Date;
  /** Quarta que abre a próxima semana. */
  nextWeekStart: Date;
  /** true se hoje é o último dia da semana do ciclo (terça). */
  isLastDayOfWeek: boolean;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Semana atual do curso: semestre oficial + ciclo de questões (quarta→terça). */
export function getClassWeekInfo(now: Date = new Date()): ClassWeekInfo {
  const today = startOfDay(now);
  const semesterStart = new Date(2026, 7, 24); // 24/08 — SEMESTER_START (semester.ts)

  const semesterWeek =
    Math.floor((today.getTime() - semesterStart.getTime()) / (7 * DAY_MS)) + 1;

  const daysIntoCycle = Math.floor(
    (today.getTime() - QUESTIONS_CYCLE_START.getTime()) / DAY_MS,
  );
  const questionsWeek = Math.floor(daysIntoCycle / 7) + 1;

  const weekStart = new Date(QUESTIONS_CYCLE_START.getTime() + (questionsWeek - 1) * 7 * DAY_MS);
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
  const nextWeekStart = new Date(weekStart.getTime() + 7 * DAY_MS);

  return {
    semesterWeek: Math.max(1, semesterWeek),
    questionsWeek,
    weekStart,
    weekEnd,
    nextWeekStart,
    isLastDayOfWeek: daysIntoCycle % 7 === 6,
  };
}

export function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

// ---------------------------------------------------------------------------
// TRILHAS DE RECUPERAÇÃO (ordenadas por prioridade)
// ---------------------------------------------------------------------------

export type TrackStatus = 'feito' | 'atrasado' | 'parcial' | 'pendente' | 'adiado';

export const TRACK_STATUS_LABEL: Record<TrackStatus, string> = {
  feito: 'Feito',
  atrasado: 'Atrasado',
  parcial: 'Parcial',
  pendente: 'Pendente',
  adiado: 'Adiado',
};

/** Ação concreta de recuperação (clicável quando tem materialId). */
export interface RecoveryAction {
  id: string;
  texto: string;
  minutos: number;
  /** Material da Biblioteca a abrir (openMethod). */
  materialId?: string;
  /** Conjunto material-first da ação: o chip 'praticar' abre o Praticar
   *  pré-filtrado no conjunto EXATO de questões ligadas ao material
   *  (ex.: a folha da S3 → as 8 questões que saíram dela). */
  linkedMaterial?: string;
  /** Aba para navegar (ex.: 'practice' | 'progress'). */
  tab?: 'practice' | 'progress';
  /** false = item-POINTER (sem checkbox): o registro vive em outro card
   *  (ex.: o plano D-N vive no card da prova — duplicar seria dupla verdade). */
  checkable?: boolean;
  /** Percentual do simulado oficial quando o TEXTO lê o registro (o chip da
   *  fila renderiza com COR = SIGNIFICADO: emerald ≥ meta, amber abaixo). */
  pct?: number;
  /** Ação de PRAZO QUE VENCE HOJE (ex.: entrega da S3 no dia do simulado).
   *  A fila tinta o item com a família "é hoje" (amber + pulso no chip) —
   *  a única urgência que a fila inventa é a que tem DATA REAL atrás. */
  prazoHoje?: boolean;
}

/**
 * A ENTREGA DA S3 FALA NA FILA NO DIA DELA — o prazo que a reta final quase
 * engole: a S3 vence NO MESMO DIA do simulado (29/09, fonte MATH_SIMULADO_DATE
 * — a data única da semana), e antes desta ação o aluno que abria a fila na
 * segunda via só o compromisso de Matemática; a entrega de Algoritmos (nota
 * real, Classroom) morava escondida na trilha P1 como ação genérica "na semana
 * dela". No dia, o item da trilha alg VIRA o prazo: resolver as 8 questões
 * if/else no Praticar e entregar os programas. É CHECKABLE de propósito — o
 * checkbox é o registro local da entrega (a fila é o lugar do "feito", padrão
 * da casa); marcado, a trilha volta à primeira ação pendente normal (S2).
 * Depois do dia, a ação some sozinha (prazo vencido não inventa culpa — a
 * ação genérica alg-s3 continua na trilha para quem ainda deve a S3).
 */
const S3_ENTREGA_HOJE: RecoveryAction = {
  id: 'alg-s3-entrega',
  texto:
    'PRAZO HOJE: entrega da S3 — as 8 questões if/else (bissexto, quadrantes, triângulo retângulo, regra do 0,7) estão no Praticar; resolva e envie os programas no Classroom',
  minutos: 100,
  tab: 'practice',
  materialId: 'alg-questoes-semana3',
  linkedMaterial: 'alg-questoes-semana3',
  prazoHoje: true,
};

/**
 * Veredito do SIMULADO OFICIAL para a fila — derivado do MESMO registro que
 * card, hero e histórico leem (findMathSimuladoRunOficial, fonte única).
 * Só existe na janela D-2..D-0 da prova: antes do dia, o simulado ainda é
 * compromisso (fila rosa); depois da prova, o veredito não muda mais o HOJE.
 */
export interface SimuladoOficialVerdict {
  /** Aproveitamento do run oficial (0–100). */
  pct: number;
  /** true quando hoje é o DIA do simulado (o texto diz "feito hoje"). */
  feitoHoje: boolean;
}

/** Runs mínimos para o veredito — genérico mantém o módulo puro. */
type SimuladoRunsLike =
  | {
      date: string;
      mode?: string;
      solved: number;
      total: number;
      filters?: { discipline?: string };
      questions?: { disciplineCode?: string }[];
    }[]
  | undefined
  | null;

function simuladoVerdictFor(
  daysToExam: number,
  runs: SimuladoRunsLike,
): SimuladoOficialVerdict | null {
  if (daysToExam < 0 || daysToExam > 2) return null;
  const run = findMathSimuladoRunOficial(runs);
  if (!run) return null;
  return {
    pct: Math.round((run.solved / Math.max(run.total, 1)) * 100),
    feitoHoje: daysToExam === 2,
  };
}

export interface RecoveryTrack {
  id: string;
  prioridade: number; // 0 = mais urgente
  title: string;
  disciplineCode?: string;
  status: TrackStatus;
  /** Situação honesta (1 linha). */
  resumo: string;
  /** Por que está nessa posição da fila. */
  porQue: string;
  acoes: RecoveryAction[];
}

export const RECOVERY_TRACKS: RecoveryTrack[] = [
  {
    id: 'mat',
    prioridade: 0,
    title: 'Matemática — Prova 01/10 (Av1)',
    disciplineCode: MATH_EXAM.disciplineCode,
    status: 'pendente',
    resumo:
      'Prova focada no conteúdo dado: as duas listas impressas cobrem tudo — Matrizes (Q1–35, 3 blocos) e Lógica (Q1–18, 2 partes) — e o dia a dia (D-N) vive no card da prova. Determinantes e sistemas lineares NÃO caem (confirmado 24/09).',
    porQue:
      'Único compromisso com DATA. A prova é focada no conteúdo dado: as duas listas cobrem tudo — determinantes e sistemas lineares NÃO caem (confirmado 24/09).',
    acoes: [
      {
        id: 'mat-lista-b1',
        texto: '24/09 — Lista de Matrizes, Bloco 1 (Q1–16): construir, igualdade, soma e equações — teoria Aula 00 ao lado só para consultar',
        minutos: 90,
        materialId: 'mat-01-matrizes',
      },
      {
        id: 'mat-lista-b2b3',
        texto: '25–26/09 — Blocos 2 e 3 da Lista (Q17–35): produtos, potências, simétricas e inversa (confira A·A⁻¹ = I)',
        minutos: 165,
        materialId: 'mat-01-matrizes',
      },
      {
        id: 'mat-logica-lista',
        texto: '27–28/09 — Lista de Lógica completa (Q1–12 e Q13–18): tabelas-verdade e argumentos estilo prova',
        minutos: 180,
        materialId: 'mat-logica-lista',
      },
      {
        id: 'mat-simulado-d2',
        texto: '29/09 — Simulado completo (10 questões, 60 min) + refazer os erros no dia 30',
        minutos: 125,
        tab: 'practice',
      },
    ],
  },
  {
    id: 'alg',
    prioridade: 1,
    title: 'Algoritmos — Semanas 2 e 3 + ritual semanal',
    disciplineCode: 'TEC.1687',
    status: 'parcial',
    resumo:
      'Semana 1: FEITA e comprovada (19 programas seus no Hub). Semana 2 (10 questões): pendente. Semana 3 (8 questões, 100% if/else) chegou 23/09 — começa a semana do ciclo. Formato da Prova 1 confirmado (24/09): 3 questões — 1 fácil, 1 média, 1 difícil — e os programas PODEM VIR DA LISTA (289 questões; escopo Q1–97).',
    porQue:
      'A Prova 1 (30/10) é entrada/saída + IF, a S3 é 100% desvios condicionais e as questões podem vir da Lista (Q1–97): treino EXATO. Feche a dívida da S2 e faça a S3 na semana dela.',
    acoes: [
      {
        id: 'alg-s2',
        texto: 'Fazer as 10 questões da Semana 2 no Praticar (mesma receita da S1: ler→calcular→imprimir)',
        minutos: 120,
        tab: 'practice',
      },
      {
        id: 'alg-s3',
        texto: 'Fazer as 8 questões da Semana 3 no Praticar (if/else puro: bissexto, quadrantes, triângulo retângulo, regra do 0,7) — treino direto da Prova 1',
        minutos: 100,
        tab: 'practice',
        materialId: 'alg-questoes-semana3',
        linkedMaterial: 'alg-questoes-semana3',
      },
      {
        id: 'alg-lista-q1-97',
        texto: 'Treinar a Lista de Exercícios no ritmo (Q1–57 entrada/saída + Q58–97 if/else): é a fonte possível das 3 questões da prova',
        minutos: 60,
        tab: 'practice',
      },
      {
        id: 'alg-bug',
        texto: 'Resolver o desafio do bug do seu antecessor_e_sucessor.c (%c vs %d) no Praticar — 3 exercícios novos extraídos do SEU arquivo',
        minutos: 20,
        tab: 'practice',
      },
    ],
  },
  {
    id: 'lm',
    prioridade: 2,
    title: 'Linguagem de Marcação — Metadados + Projeto 1ª etapa',
    disciplineCode: 'TEC.1632',
    status: 'pendente',
    resumo:
      'Aula 07 (24/09): metadados — charset, title vs h1, author/description/keywords e favicon. E o Projeto 1ª etapa entrega 09/10: proposta em slides (~5 min, nomes de todos) com nome, tema, stakeholders e 6+ tópicos.',
    porQue:
      'Prazo REAL em 15 dias (09/10) e assunto novo curto. A proposta ainda não exige código — o custo é alinhar tema e tópicos com a equipe (até 4 pessoas, fixas até o fim do semestre).',
    acoes: [
      {
        id: 'lm-proj-proposta',
        texto: 'PROJETO 1ª etapa: com a equipe, escolham tema + nome do site e definam os 6+ tópicos (vira página) → montem os slides COM os nomes de todos',
        minutos: 60,
        materialId: 'lm-ementa',
      },
      {
        id: 'lm-meta',
        texto: 'Sessão de metadados: slides da aula 07 + capítulo do GitBook — depois complete o <head> do site do projeto (charset, title, description, favicon)',
        minutos: 40,
        materialId: 'lm-html-07-metadados',
      },
      {
        id: 'lm-form',
        texto: 'Fechar a aula 06 (formulários) se ainda não fez: slides + tutorial GitBook (form, input, label, select)',
        minutos: 45,
        materialId: 'lm-html-06-formularios',
      },
    ],
  },
  {
    id: 'ing',
    prioridade: 3,
    title: 'Inglês — vídeo Corpo + Verbos',
    disciplineCode: 'ING.001',
    status: 'pendente',
    resumo: 'Vídeo postado no Classroom (16/09). Leve — cabe em qualquer folga ou fim de semana.',
    porQue: 'Conteúdo mínimo e de baixa dificuldade; não atrasa o semestre se cair 1 semana.',
    acoes: [
      {
        id: 'ing-video',
        texto: 'Assistir o vídeo (corpo humano + verbos) e anotar 10 palavras novas',
        minutos: 30,
        materialId: 'ing-video-corpo-verbos',
      },
    ],
  },
  {
    id: 'fund',
    prioridade: 4,
    title: 'Fundamentos — manter leve',
    disciplineCode: '53647',
    status: 'pendente',
    resumo: 'Sem avaliação com data. Manter ritmo com 1 questão da prova real do Prof. André por semana.',
    porQue: 'Prova real já está no acervo — 1 questão/semana mantém afiado sem roubar tempo das prioridades.',
    acoes: [
      {
        id: 'fund-q',
        texto: 'Resolver 1 questão da Prova Real Av1 (Fundamentos) no Praticar, no ritmo da semana',
        minutos: 20,
        tab: 'practice',
      },
    ],
  },
  {
    id: 'rht',
    prioridade: 5,
    title: 'RHT — ADIAR até depois da prova',
    disciplineCode: 'TEC.0953',
    status: 'adiado',
    resumo:
      'Até 01/10: só acompanhar as aulas. Retomar estudos ativos a partir de 02/10 (teletrabalho/SERPRO e ementa já resumidos no Hub).',
    porQue:
      'Sem prova marcada e com material já resumido no site: adiar NÃO custa nada agora e libera ~2h/semana para Matemática.',
    acoes: [
      {
        id: 'rht-voltar',
        texto: 'A partir de 02/10: retomar com a ementa + material de teletrabalho (agendado automaticamente no card)',
        minutos: 0,
        materialId: 'rht-ementa',
      },
    ],
  },
];

/** Total de minutos das ações pendentes (sem a trilha adiada). */
export function recoveryTotalMinutes(): number {
  return RECOVERY_TRACKS.filter((t) => t.status !== 'adiado').reduce(
    (acc, t) => acc + t.acoes.reduce((a, x) => a + x.minutos, 0),
    0,
  );
}

// ---------------------------------------------------------------------------
// TRILHA MAT — ESTADO VIVO (a prova fala o dia; a fila não diverge do card)
// ---------------------------------------------------------------------------

/** Status da trilha Matemática: pós-prova ela vira 'feito' (a fila não acusa). */
export function matTrackStatusFor(daysToExam: number): TrackStatus {
  return daysToExam < 0 ? 'feito' : 'pendente';
}

// ---------------------------------------------------------------------------
// A NOTA REGISTRADA FALA — o registro da Calculadora é a FONTE ÚNICA da nota
// real da Av1 (grade-calculator grava realGrades['TEC.1984-Av1']). Antes, a
// fila pedia 'Anotar a nota' PARA SEMPRE — mesmo com a nota já registrada —
// e o resumo dizia 'falta a nota' com a nota anotada (dupla verdade, o mesmo
// vício que as rodadas 83/84 mataram no plano e na fila).
// ---------------------------------------------------------------------------

/** Forma mínima de uma nota real — genérico evita importar study-progress (módulo puro). */
type RealGradeLike = { grade?: number };

/**
 * A NOTA REAL da Av1, se o aluno já a registrou na Calculadora de Médias.
 * Mesma derivação de chave do grade-calculator: `${disciplineCode}-${evaluationName}`.
 * Retorna o valor na ESCALA NATURAL da disciplina (0–10 ou 0–100) — normalizar
 * para comparação com a meta é responsabilidade de quem exibe.
 */
export function findNotaRealAv1<T extends Record<string, RealGradeLike>>(
  realGrades: T | undefined | null,
): number | null {
  const entry = realGrades?.[`${MATH_EXAM.disciplineCode}-Av1`];
  return typeof entry?.grade === 'number' ? entry.grade : null;
}

/** Resumo da trilha Matemática: o 'Faltam 7 dias' congelado mentia — agora fala o dia real. */
export function matTrackResumoFor(daysToExam: number, notaReal: number | null = null): string {
  if (daysToExam < 0) {
    if (notaReal !== null) {
      return notaReal >= MATH_META
        ? `Prova de Matemática realizada — nota ${notaReal} registrada ✓ acima da meta de aprovação (≥ ${MATH_META}). Av2 e Av3 seguem o plano; a fila agora é do Projeto LM (09/10) e da Prova de Algoritmos (30/10).`
        : `Prova de Matemática realizada — nota ${notaReal} registrada, abaixo da meta de aprovação (≥ ${MATH_META}). Av2 e Av3 ainda abrem caminho: o plano segue — revise com o caderno de erros e o simulado.`;
    }
    return 'Prova de Matemática realizada — falta a nota. Confira a média na Calculadora (aba Progresso) e siga a fila: Projeto LM 09/10 e Prova de Algoritmos 30/10.';
  }
  return `Prova focada no conteúdo dado: as duas listas impressas cobrem tudo — Matrizes (Q1–35) e Lógica (Q1–18) — e faltam ${daysToExam} dia(s). O dia a dia (D-${daysToExam}) vive no card da prova; determinantes e sistemas lineares NÃO caem (confirmado 24/09).`;
}

/**
 * Ação de HOJE da trilha Matemática — VIVA, derivada do PLANO DA PROVA
 * (fonte única: MATH_EXAM_PLAN, a mesma verdade do card da prova):
 * pré-prova = pointer para o dia D-N do plano (sem checkbox — o registro
 * das tarefas vive lá, duplicar seria dupla verdade); pós-prova = anotar
 * a nota na Calculadora. Sem dia de plano (D-9+) → null (a fila segue
 * com as outras trilhas, honesta).
 */
export function matTodayActionFor(
  daysToExam: number,
  notaReal: number | null = null,
  simulado: SimuladoOficialVerdict | null = null,
): RecoveryAction | null {
  if (daysToExam < 0) {
    // Nota JÁ REGISTRADA na Calculadora → a fila larga o 'Anotar a nota':
    // o registro vence o checkbox (a verdade do registro, padrão da 83/84).
    if (notaReal !== null) return null;
    return {
      id: 'mat-pos-prova-nota',
      texto: 'Anotar a nota da Av1 na Calculadora de Médias e conferir quanto falta para a média final',
      minutos: 10,
      tab: 'progress',
    };
  }
  const day = planDayFor(Math.min(Math.max(daysToExam, 0), MATH_EXAM_PLAN.length - 1));
  if (!day) return null;
  // O SIMULADO OFICIAL FALA NA FILA (padrão da nota real, rodada 87): o run
  // é o registro — quando existe, o pointer D-2/D-1/D-0 deixa de tratar o
  // simulado como compromisso futuro e lê o que aconteceu. Sem run, a fila
  // fica como era (honesta — sem inventar resultado).
  if (daysToExam === 2 && simulado) {
    return {
      id: `mat-plano-d${day.offset}`,
      texto:
        'Simulado da Av1 feito hoje ✓ — agora é refazer no papel as que erraram; as tarefas do dia seguem no card da prova, acima',
      minutos: day.minutos,
      pct: simulado.pct,
      checkable: false,
    };
  }
  if (daysToExam === 1 && simulado) {
    return {
      id: `mat-plano-d${day.offset}`,
      texto:
        'Plano da prova (D-1): Véspera — simulado de ontem feito: foque o dia nas travadas e no que errou (a folha impressa já traz o foco)',
      minutos: day.minutos,
      pct: simulado.pct,
      checkable: false,
    };
  }
  if (daysToExam === 0 && simulado) {
    return {
      id: `mat-plano-d${day.offset}`,
      texto:
        'Plano da prova (D-0): DIA DA PROVA — o simulado te preparou: reler os cards de fórmulas, levar o kit e confiar',
      minutos: day.minutos,
      pct: simulado.pct,
      checkable: false,
    };
  }
  return {
    id: `mat-plano-d${day.offset}`,
    texto: `Plano da prova (D-${day.offset}): ${day.titulo} — o passo a passo com as tarefas está no card da prova, acima`,
    minutos: day.minutos,
    materialId: day.tarefas.find((t) => t.materialId)?.materialId,
    checkable: false,
  };
}

/**
 * Ações "faça hoje": 1ª ação PENDENTE das 3 primeiras trilhas (ordem de
 * prioridade) — antes pegava sempre a acoes[0], mesmo feita; e a trilha
 * Matemática agora entra com o item VIVO (plano do dia / Calculadora).
 */
export function todayRecoveryActions(
  done: Record<string, boolean> = {},
  realGrades?: Record<string, { grade?: number }> | null,
  simuladoRuns?: SimuladoRunsLike,
): { track: RecoveryTrack; action: RecoveryAction }[] {
  const out: { track: RecoveryTrack; action: RecoveryAction }[] = [];
  const daysToExam = daysUntilDate(MATH_EXAM.date);
  // A nota REAL lida do REGISTRO (fonte única — a Calculadora fala e a fila obedece).
  const notaReal = findNotaRealAv1(realGrades);
  // O simulado oficial também fala: mesmo registro de card, hero e histórico.
  const simulado = simuladoVerdictFor(daysToExam, simuladoRuns);
  for (const track of RECOVERY_TRACKS.filter((t) => t.status !== 'adiado').slice(0, 3)) {
    if (track.id === 'mat') {
      // Pós-prova com a nota registrada OU marcada como feita → a trilha sai da lista.
      if (daysToExam < 0 && (done['mat-pos-prova-nota'] || notaReal !== null)) continue;
      const action = matTodayActionFor(daysToExam, notaReal, simulado);
      if (action) out.push({ track, action });
      continue;
    }
    // O PRAZO DA S3 NO DIA DELA (29/09): a entrega vence junto com o simulado
    // e o aluno não pode descobrir isso pelo strip do Praticar só. Enquanto a
    // entrega não está marcada, o item da trilha alg É o prazo; entregue (ou
    // passado o dia), a trilha volta à primeira ação pendente de sempre.
    if (track.id === 'alg' && daysUntilDate(MATH_SIMULADO_DATE) === 0 && !done[S3_ENTREGA_HOJE.id]) {
      out.push({ track, action: S3_ENTREGA_HOJE });
      continue;
    }
    const action = track.acoes.find((a) => !done[a.id]);
    if (action) out.push({ track, action });
  }
  return out;
}
