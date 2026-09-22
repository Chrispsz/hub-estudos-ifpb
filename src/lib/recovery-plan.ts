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

import { MATH_EXAM } from './math-exam-prep';

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
  /** Aba para navegar (ex.: 'practice'). */
  tab?: 'practice';
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
    status: 'atrasado',
    resumo:
      'Plano de 12 dias começou 19/09 e 3 dias ficaram para trás — a prova está a 9 dias e é o único compromisso com DATA.',
    porQue: 'Prova com data + maior volume de conteúdo novo (matrizes). Nada passa na frente disso.',
    acoes: [
      {
        id: 'mat-catchup',
        texto: 'HOJE — catch-up condensado dos dias 1-3 do plano: conceituação + operações + transposta (1 sessão única)',
        minutos: 90,
        materialId: 'mat-00-matrizes',
      },
      {
        id: 'mat-hoje',
        texto: 'Depois — voltar ao plano normal (dia de hoje aparece no card da prova)',
        minutos: 50,
        materialId: 'mat-01-matrizes',
      },
    ],
  },
  {
    id: 'alg',
    prioridade: 1,
    title: 'Algoritmos — Semana 2 + ritual semanal',
    disciplineCode: 'TEC.1687',
    status: 'parcial',
    resumo:
      'Semana 1: FEITA e comprovada (19 programas seus já estão no Hub como gabarito autoral). Semana 2 (10 questões): pendente.',
    porQue:
      'Prova 1 em 30/10 e o ritual semanal é o treino oficial — suas soluções da S1 provam que dá para fazer S2 em ~2h.',
    acoes: [
      {
        id: 'alg-s2',
        texto: 'Fazer as 10 questões da Semana 2 no Praticar (mesma receita da S1: ler→calcular→imprimir)',
        minutos: 120,
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
    title: 'Linguagem de Marcação — Formulários (aula 06)',
    disciplineCode: 'TEC.1632',
    status: 'pendente',
    resumo:
      'Último assunto dado (19/09): formulários HTML. Conteúdo curto — 1 sessão fecha com o GitBook + slides.',
    porQue: 'Assunto curto e recente: estudar agora custa pouco e evita dívida acumulando antes da próxima aula.',
    acoes: [
      {
        id: 'lm-form',
        texto: 'Sessão única de formulários: slides da aula 06 + tutorial GitBook (form, input, label, select)',
        minutos: 45,
        materialId: 'lm-html-06-formularios',
      },
    ],
  },
  {
    id: 'ing',
    prioridade: 3,
    title: 'Inglês — vídeo Corpo + Verbos',
    disciplineCode: 'TEC.1681',
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
    disciplineCode: 'TEC.1685',
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

/** Ações "faça hoje": 1ª ação pendente das 3 primeiras trilhas (ordem de prioridade). */
export function todayRecoveryActions(): { track: RecoveryTrack; action: RecoveryAction }[] {
  const out: { track: RecoveryTrack; action: RecoveryAction }[] = [];
  for (const track of RECOVERY_TRACKS.filter((t) => t.status !== 'adiado').slice(0, 3)) {
    const action = track.acoes[0];
    if (action) out.push({ track, action });
  }
  return out;
}
