/**
 * Montagem das perguntas de debriefing do Simulado Pro para o tutor IA.
 *
 * Usado em DOIS lugares:
 *  - simulado-view: resultado fresco (dados ao vivo, pergunta montada na hora);
 *  - simulado-history: tentativas antigas gravadas no histórico (SimuladoRun).
 *
 * Assim o debriefing deixa de existir só no momento pós-prova: qualquer
 * tentativa do histórico (ou a evolução entre elas) pode ser analisada pela IA.
 */

import { getDisciplineByCode } from '@/data/course-data';
import type { RunQuestionDetail, SimuladoRun } from '@/lib/study-progress';

export function fmtClockSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

function difficultyLabel(d?: string): string {
  return d === 'facil' ? 'Fácil' : d === 'medio' ? 'Médio' : d === 'dificil' ? 'Difícil' : '—';
}

function discShort(code?: string): string {
  return (code && getDisciplineByCode(code)?.shortName) || code || '—';
}

/**
 * Debriefing detalhado a partir dos detalhes por questão (rodada ao vivo ou
 * tentativa do histórico que gravou `questions`). Compacta: status, disciplina,
 * tópico, dificuldade e enunciado truncado — e pede análise de professor.
 */
export function buildDebriefFromDetails(input: {
  pct: number;
  elapsedSec: number;
  details: RunQuestionDetail[];
}): string {
  const { pct, elapsedSec, details } = input;
  const lines = details.map((q, i) => {
    const status =
      q.status === 'solved' ? 'CONSEGUI' : q.status === 'missed' ? 'NÃO CONSEGUI' : 'PULADA';
    return `- Q${i + 1} [${discShort(q.disciplineCode)} · ${q.topic || '—'} · ${difficultyLabel(q.difficulty)}] ${status} — ${(q.statement || '').slice(0, 110)}`;
  });
  return [
    'Acabei de terminar um simulado no Hub. Analisa meu desempenho como um professor faria na correção e monta um plano de revisão CURTO e organizado.',
    `Aproveitamento: ${pct}% · tempo total: ${fmtClockSec(elapsedSec)}.`,
    'Resultado por questão:',
    ...lines,
    '',
    'Na resposta: (1) o padrão dos meus erros (tópicos recorrentes? dificuldade? descuido?), (2) a ordem certa de revisão e (3) um exercício de treino por tópico fraco.',
  ].join('\n');
}

/**
 * Debriefing de uma tentativa DO HISTÓRICO. Com detalhes por questão, é tão
 * completo quanto o debriefing ao vivo; sem (tentativas antigas, pré-detail),
 * trabalha com os agregados gravados — honesto sobre o que sabe.
 */
export function buildRunDebriefQuestion(run: SimuladoRun): string {
  if (run.questions && run.questions.length > 0) {
    return buildDebriefFromDetails({
      pct: run.total > 0 ? Math.round((run.solved / run.total) * 100) : 0,
      elapsedSec: run.durationSec,
      details: run.questions,
    });
  }
  const partes = [
    `aproveitamento ${run.total > 0 ? Math.round((run.solved / run.total) * 100) : 0}%`,
    `${run.solved}/${run.total} resolvidas`,
    `${run.missed} que não consegui`,
    `${run.skipped} puladas`,
    `tempo ${fmtClockSec(run.durationSec)}`,
  ];
  const filtros: string[] = [];
  if (run.filters?.discipline) filtros.push(discShort(run.filters.discipline));
  if (run.filters?.difficulty) filtros.push(run.filters.difficulty);
  return [
    `Este simulado foi feito em ${fmtDate(run.date)} (antes de o Hub gravar os detalhes por questão), então só tenho os totais: ${partes.join(' · ')}${filtros.length ? ` · filtros: ${filtros.join(', ')}` : ''}.`,
    '',
    'Como professor, me diz: o que esses números indicam sobre minhas dificuldades, e qual plano de revisão CURTO você sugere a partir daqui? Se precisar, me sugira um novo simulado focado no ponto fraco provável.',
  ].join('\n');
}

/**
 * Análise de EVOLUÇÃO: envia a série de tentativas (mais antigas → recentes)
 * para o tutor ler a tendência e apontar o foco da próxima semana — pensado
 * para a véspera de prova (Av1).
 */
export function buildTrendQuestion(runs: SimuladoRun[]): string {
  // Série completa cresce sem limite — para o prompt, as 12 mais recentes bastam.
  const serie = runs.slice(-12).map((r) => {
    const pct = r.total > 0 ? Math.round((r.solved / r.total) * 100) : 0;
    const disc = r.filters?.discipline
      ? discShort(r.filters.discipline)
      : (r.questions && [...new Set(r.questions.map((q) => discShort(q.disciplineCode)).filter((d) => d !== '—'))].slice(0, 2).join('+')) || 'geral';
    return `- ${fmtDate(r.date)}: ${pct}% (${r.solved}/${r.total}) · ${disc} · ${fmtClockSec(r.durationSec)}`;
  });
  return [
    `Essa é a minha série de simulados no Hub (${Math.min(runs.length, 12)} tentativas${runs.length > 12 ? ', das 12 mais recentes' : ''}, da mais antiga para a mais recente). Analisa minha EVOLUÇÃO como um coach de estudos:`,
    ...serie,
    '',
    'Na resposta: (1) a tendência (estou melhorando, estagnado ou piorando — e o que isso sugere?), (2) os tópicos/disciplinas que mais aparecem nas tentativas fracas e (3) um plano curto para os próximos dias priorizando o que mais me faria subir a nota. Seja direto e honesto, sem elogio vazio.',
  ].join('\n');
}
