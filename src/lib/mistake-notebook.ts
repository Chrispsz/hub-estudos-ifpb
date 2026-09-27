/**
 * CADERNO DE ERROS — agregação de tudo que o aluno errou ou está fragilizado,
 * em uma única superfície de diagnóstico (aba Progresso).
 *
 * Fontes (todas locais, material-first — nada inventado):
 *  1. SimuladoRun.questions com status 'missed'/'skipped' (tentativas novas,
 *     que gravam o detalhe por questão — corridas antigas só têm agregados);
 *  2. Exercícios tentados e NÃO resolvidos (exerciseProgress.tried && !solved)
 *     — enunciado/tópico/dificuldade recuperados do acervo estático;
 *  3. Flashcards com lapsos (>0) ainda em caixa frágil (box ≤ 1) — o cartão
 *     que o aluno já errou e ainda não consolidou.
 *
 * Também monta as perguntas para a IA: um chip por erro (reensinar aquele
 * ponto) e a análise do caderno inteiro (padrões + priorização + ordem de
 * revisão) — mesma voz de coach usada no debriefing do simulado.
 */

import { getDisciplineByCode } from '@/data/course-data';
import { exercises } from './exercise-extractor';
import {
  flashcardBoxLabel,
  type StudyProgress,
} from './study-progress';
import { capQuestion } from './tutor-stream';
import { TUTOR_CARD_SUFFIX } from './tutor-cards';

// ---------- Tipos ----------

export type MistakeKind = 'simulado_missed' | 'simulado_skipped' | 'exercicio' | 'flashcard';

export interface MistakeItem {
  /** Chave estável para o React (fonte + id). */
  key: string;
  kind: MistakeKind;
  disciplineCode: string;
  /** Enunciado/frente do cartão, truncado na coleta. */
  title: string;
  topic?: string;
  difficulty?: 'facil' | 'medio' | 'dificil';
  /** ISO — quando o erro aconteceu (ou última prática). */
  when?: string;
  /** Contexto extra: "Simulado de 26/09", "fez com ajuda", "errou 2×". */
  note?: string;
}

export interface NotebookStats {
  total: number;
  simulado: number;
  exercicio: number;
  flashcard: number;
  /** Disciplina com mais erros — contexto padrão para a IA. */
  topDisciplineCode?: string;
}

// ---------- Coleta ----------

const TITLE_MAX = 120;

function truncate(s: string, max = TITLE_MAX): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

/**
 * Junta as 3 fontes de erro. Ordena do mais recente para o mais antigo
 * (o topo do caderno é o que está fresco na memória — e na prova).
 */
export function collectMistakes(progress: StudyProgress): MistakeItem[] {
  const items: MistakeItem[] = [];

  // 1) Simulados: só tentativas com detalhe por questão têm erros nomeáveis.
  for (const run of progress.simuladoRuns ?? []) {
    if (!run.questions) continue;
    const when = fmtDate(run.date);
    run.questions.forEach((q, i) => {
      if (q.status === 'solved') return;
      const missed = q.status === 'missed';
      items.push({
        key: `${run.id}:${i}`,
        kind: missed ? 'simulado_missed' : 'simulado_skipped',
        disciplineCode: q.disciplineCode || run.filters?.discipline || '—',
        title: q.statement ? truncate(q.statement, 110) : 'Questão sem enunciado gravado',
        topic: q.topic,
        difficulty: q.difficulty as MistakeItem['difficulty'],
        when: run.date,
        note: missed ? `Errei no simulado de ${when}` : `Pulei no simulado de ${when}`,
      });
    });
  }

  // 2) Exercícios: tentou e não resolveu (o acervo dá enunciado/tópico).
  const byId = new Map(exercises.map((e) => [e.id, e]));
  for (const [id, entry] of Object.entries(progress.exerciseProgress ?? {})) {
    if (!entry.tried || entry.solved) continue;
    const ex = byId.get(id);
    if (!ex) continue; // id órfão (acervo mudou) — nada a exibir, sem inventar
    items.push({
      key: `ex:${id}`,
      kind: 'exercicio',
      disciplineCode: ex.disciplineCode,
      title: truncate(ex.statement),
      topic: ex.topic,
      difficulty: ex.difficulty,
      when: entry.lastPracticedAt,
      note: entry.neededHelp
        ? 'Tentou e precisou de ajuda'
        : entry.marked
          ? 'Marcado para revisar · ainda não resolveu'
          : 'Tentou e não resolveu',
    });
  }

  // 3) Flashcards: já erraram (lapses>0) e ainda estão em caixa frágil (≤1).
  for (const card of progress.flashcards ?? []) {
    if (card.lapses <= 0 || card.box > 1) continue;
    items.push({
      key: `fc:${card.id}`,
      kind: 'flashcard',
      disciplineCode: card.disciplineCode,
      title: truncate(card.front, 110),
      when: card.lastReviewedAt || card.createdAt,
      note: `Cartão errado ${card.lapses === 1 ? '1×' : `${card.lapses}×`} · ${flashcardBoxLabel(card.box)}`,
    });
  }

  return items.sort((a, b) => {
    const ta = a.when ? new Date(a.when).getTime() : 0;
    const tb = b.when ? new Date(b.when).getTime() : 0;
    return tb - ta;
  });
}

/** Contagens resumidas + disciplina mais atingida (contexto da IA). */
export function notebookStats(items: MistakeItem[]): NotebookStats {
  const byDisc = new Map<string, number>();
  let simulado = 0;
  let exercicio = 0;
  let flashcard = 0;
  for (const it of items) {
    if (it.kind === 'exercicio') exercicio += 1;
    else if (it.kind === 'flashcard') flashcard += 1;
    else simulado += 1;
    if (it.disciplineCode && it.disciplineCode !== '—') {
      byDisc.set(it.disciplineCode, (byDisc.get(it.disciplineCode) ?? 0) + 1);
    }
  }
  const top = [...byDisc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { total: items.length, simulado, exercicio, flashcard, topDisciplineCode: top };
}

/** Agrupa por disciplina preservando a ordem de recência dentro do grupo. */
export function groupByDiscipline(
  items: MistakeItem[],
): { disciplineCode: string; items: MistakeItem[] }[] {
  const groups = new Map<string, MistakeItem[]>();
  for (const it of items) {
    const code = it.disciplineCode || '—';
    const arr = groups.get(code);
    if (arr) arr.push(it);
    else groups.set(code, [it]);
  }
  return [...groups.entries()].map(([disciplineCode, list]) => ({ disciplineCode, items: list }));
}

// ---------- Janela temporal (filtro do caderno) ----------

export type MistakeWindow = 'all' | '7d' | '48h';

export const MISTAKE_WINDOWS: {
  id: MistakeWindow;
  /** Rótulo curto do chip. */
  label: string;
  /** Texto de escopo honesto — vai para o subtítulo e para a pergunta da IA. */
  scopeLabel: string;
  /** Duração da janela em ms (null = o caderno inteiro). */
  ms: number | null;
}[] = [
  { id: 'all', label: 'Tudo', scopeLabel: 'do caderno inteiro', ms: null },
  { id: '7d', label: '7 dias', scopeLabel: 'dos últimos 7 dias', ms: 7 * 24 * 3600 * 1000 },
  { id: '48h', label: '48 h', scopeLabel: 'das últimas 48 horas', ms: 48 * 3600 * 1000 },
];

/**
 * Contagem de erros dentro de cada janela — alimenta os chips (honestos:
 * janela sem erro fica desabilitada em vez de mostrar lista vazia).
 * Data no futuro (relógio adiantado) não conta como fresca.
 */
export function windowCounts(items: MistakeItem[]): Record<MistakeWindow, number> {
  const counts: Record<MistakeWindow, number> = { all: items.length, '7d': 0, '48h': 0 };
  const now = Date.now();
  for (const it of items) {
    if (!it.when) continue;
    const t = new Date(it.when).getTime();
    if (Number.isNaN(t)) continue;
    const age = now - t;
    if (age < 0) continue;
    if (age < MISTAKE_WINDOWS[1].ms!) counts['7d'] += 1;
    if (age < MISTAKE_WINDOWS[2].ms!) counts['48h'] += 1;
  }
  return counts;
}

/** Itens dentro da janela escolhida ('all' devolve a lista inteira). */
export function filterByWindow(items: MistakeItem[], win: MistakeWindow): MistakeItem[] {
  if (win === 'all') return items;
  const meta = MISTAKE_WINDOWS.find((w) => w.id === win);
  if (!meta?.ms) return items;
  const now = Date.now();
  return items.filter((it) => {
    if (!it.when) return false;
    const t = new Date(it.when).getTime();
    if (Number.isNaN(t)) return false;
    const age = now - t;
    return age >= 0 && age < meta.ms!;
  });
}

// ---------- Perguntas para a IA ----------

function discShort(code: string): string {
  return getDisciplineByCode(code)?.shortName || code;
}

function kindLabel(kind: MistakeKind): string {
  switch (kind) {
    case 'simulado_missed':
      return 'ERREI no simulado';
    case 'simulado_skipped':
      return 'PULEI no simulado';
    case 'exercicio':
      return 'NÃO RESOLVI o exercício';
    case 'flashcard':
      return 'ERREI o cartão';
  }
}

function itemLine(it: MistakeItem, revisedMap?: { [key: string]: string } | null): string {
  const parts = [discShort(it.disciplineCode), it.topic || '—'];
  if (it.difficulty) {
    parts.push(it.difficulty === 'facil' ? 'Fácil' : it.difficulty === 'medio' ? 'Médio' : 'Difícil');
  }
  if (it.note) parts.push(it.note);
  const revisedAt = revisedMap?.[it.key];
  const tag = revisedAt
    ? ` [JÁ REVISADO em ${fmtDate(revisedAt)} — reestudei este ponto]`
    : ' [PENDENTE]';
  return `- [${parts.join(' · ')}] ${kindLabel(it.kind)}: ${it.title}${tag}`;
}

/** Chip de UM erro: reensino focado + treino imediato + cartão pronto p/ o baralho. */
export function buildItemQuestion(it: MistakeItem): string {
  const label = kindLabel(it.kind);
  return [
    `No meu caderno de erros do Hub tem um ponto que eu ${label.toLowerCase()}: "${it.title}"`,
    it.topic ? `(tópico: ${it.topic})` : '',
    '',
    'Me ajuda a virar isso em acerto? Na resposta: (1) explica o conceito por trás sem pressupor que eu sei, (2) mostra a resolução passo a passo do item que errei e (3) me dá uma variação parecida para eu tentar agora e provar que aprendi.',
    TUTOR_CARD_SUFFIX,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Itens ainda pendentes (não marcados como revisados no caderno). */
export function pendingMistakes(
  items: MistakeItem[],
  revisedMap?: { [key: string]: string } | null,
): MistakeItem[] {
  if (!revisedMap) return items;
  return items.filter((it) => !revisedMap[it.key]);
}

const NOTEBOOK_MAX = 40;

/**
 * Análise do caderno. Capped em 40 itens (custo de token, como a
 * análise de evolução capped em 12 corridas) — se estourar, prioriza os
 * mais recentes. Recebe o mapa de revisados para a IA saber o que já foi
 * reestudado (ciclo de resolução) e focar nos pendentes. Quando o aluno
 * está com um filtro temporal ativo, scopeLabel declara o recorte com
 * honestidade ("dos últimos 7 dias") — a IA analisa o que está na tela.
 */
export function buildNotebookQuestion(
  items: MistakeItem[],
  revisedMap?: { [key: string]: string } | null,
  scopeLabel?: string,
): string | null {
  if (items.length === 0) return null;
  const chosen = items.slice(0, NOTEBOOK_MAX);
  const extra = items.length - chosen.length;
  const stats = notebookStats(items);
  const pendentes = pendingMistakes(items, revisedMap).length;
  const revisados = items.length - pendentes;
  const head = [
    scopeLabel
      ? `Meu caderno de erros do Hub tem ${items.length} ${items.length === 1 ? 'item' : 'itens'} ${scopeLabel} (janela filtrada por mim — o caderno completo tem mais erros antigos).`
      : `Meu caderno de erros do Hub tem ${items.length} ${items.length === 1 ? 'item' : 'itens'} até agora`,
    `(${stats.simulado} de simulados, ${stats.exercicio} de exercícios, ${stats.flashcard} de flashcards).`,
    revisados > 0
      ? `Desse total, ${revisados} já marquei como revisados e ${pendentes} ${pendentes === 1 ? 'continua pendente' : 'continuam pendentes'}.`
      : '',
    extra > 0 ? `Listando os ${chosen.length} mais recentes.` : '',
    'Analisa como um professor que acompanha minha preparação — prova de Matemática em 01/10 e simulado em 29/09.',
    'Lista dos erros (do mais recente):',
    '',
  ]
    .filter(Boolean)
    .join(' ');
  const pendentesAll = pendentes === 0;
  return capQuestion(
    [
      head,
      ...chosen.map((it) => itemLine(it, revisedMap)),
      '',
      pendentesAll
        ? 'Na resposta: (1) confirme se é SEGURO deixar de lado os itens que já revisei (ou se algum merece uma última passada antes da prova), (2) um mini-drill relâmpago (2–3 perguntas rápidas) para eu provar que os erros viraram acerto, (3) o que eu deveria fazer HOJE com o tempo que sobrou até a prova.'
        : revisados > 0
          ? 'Na resposta: (1) os PADRÕES que conectam os erros PENDENTES (os [JÁ REVISADO] eu já reestudei — comente só se continuar crítico), (2) o que priorizar para a Av1 de Matemática — e o que NÃO vale a pena revisar agora, (3) uma ordem de revisão concreta citando materiais, listas ou simulados do próprio Hub.'
          : 'Na resposta: (1) os PADRÕES que conectam esses erros (tema recorrente? descuido? conteúdo que faltou de base?), (2) o que priorizar para a Av1 de Matemática — e o que NÃO vale a pena revisar agora, (3) uma ordem de revisão concreta citando materiais, listas ou simulados do próprio Hub.',
    ].join('\n'),
  );
}
