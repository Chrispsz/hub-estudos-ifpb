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
 * DEDUPE: a mesma questão que aparece no simulado (errada/pulada) E como
 * exercício pendente rende UMA linha só (a do exercício vence, pois tem o
 * ciclo de lapses) — o contexto do simulado vai na nota e no badge
 * "também no simulado", em vez de duplicar a linha no caderno.
 *
 * ERROS DE SEMPRE (recorrência) em três sinais honestos:
 *  1. exercício recaído — lapses ≥ 1 (já tinha resolvido e voltou a errar);
 *  2. cartão crônico — lapses ≥ 2 e ainda em caixa frágil;
 *  3. crônico entre corridas — perdido em ≥ 2 simulados (com ou sem entrada
 *     de exercício): a questão volta e o aluno continua perdendo. O count
 *     vem do próprio mergedSimulado (nº de corridas fundidas na linha).
 *
 * SEM PAR NO ACERVO (corridas antigas): questão perdida cujo enunciado não
 * casa com o acervo (exercício removido/editado depois da corrida) vira
 * UMA linha por enunciado — mesclada entre corridas com badge "N× no
 * simulado" e recorrência pelo mesmo critério (≥ 2). Já a entrada SEM
 * enunciado gravado (corridas que não registravam o detalhe) NÃO se mescla:
 * sem a chave de identidade, fundir duas linhas seria inventar que são a
 * mesma questão — ficam uma por ocorrência, marcadas noStatement (honestas
 * e visualmente secundárias: não dão para reensinar o que não se tem).
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
  /**
   * "Erros de sempre": quantas vezes o item voltou ao caderno depois de já
   * ter sido resolvido (só existe para exercícios — a única fonte que
   * acompanha o ciclo completo errou → resolveu → recaiu). ≥1 = recorrente.
   * Recorrência também vem de OUTRO sinal: perdido em ≥ 2 simulados
   * (mergedSimulado.count) — crônico entre corridas, com ou sem exercício.
   */
  lapses?: number;
  /**
   * Linha fundida: a MESMA questão também foi errada/pulada em simulado(s)
   * e está pendente como exercício — um registro só, com os dois contextos
   * (nota e badge) em vez de duas linhas idênticas confundindo a leitura.
   */
  mergedSimulado?: { missed: boolean; count: number; lastDate: string };
  /**
   * Corrida antiga sem enunciado gravado — não dá para reensinar a questão
   * (a IA não tem o que ler) nem mesclar com outras (sem chave de
   * identidade). A linha fica honesta e visualmente secundária.
   */
  noStatement?: boolean;
}

/** Título de linha de corrida antiga que não gravou o enunciado — exportado para o UI marcar a linha como honestamente vaga. */
export const NO_STATEMENT_TITLE = 'Sem enunciado gravado (corrida antiga)';

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
 * "Erros de sempre" — o item falha CRONICAMENTE, por um de três sinais:
 *  - exercício recaído: já foi virado em acerto e reentrou no caderno
 *    (lapses ≥ 1 — o ciclo completo errou → resolveu → recaiu);
 *  - cartão crônico: errou 2× ou mais e ainda está em caixa frágil;
 *  - crônico entre corridas: perdido em ≥ 2 simulados (mergedSimulado.count),
 *    com ou sem entrada de exercício — a questão volta e o aluno continua
 *    perdendo, mesmo sem nunca ter resolvido no meio.
 * É o que sobe no caderno, abre a revisão dirigida e recebe a tag
 * [RECORRENTE] na IA.
 */
export function isRecorrenteMistake(it: MistakeItem): boolean {
  if (it.kind === 'flashcard') return (it.lapses ?? 0) >= 2;
  if (it.kind === 'exercicio') {
    return (it.lapses ?? 0) > 0 || (it.mergedSimulado?.count ?? 0) >= 2;
  }
  // simulado_missed / simulado_skipped (linha só-de-simulado, camada c):
  // a recorrência é a contagem de corridas em que a questão foi perdida.
  return (it.mergedSimulado?.count ?? 0) >= 2;
}

/** Índice enunciado(fatiado em 160) → id — chave única de casamento questão↔corrida. */
function statementIndex(): Map<string, string> {
  return new Map(exercises.map((e) => [e.statement.slice(0, 160), e.id]));
}

/**
 * Questões perdidas em corridas de simulado (erradas/puladas), por id de
 * exercício do acervo — casamento pelo enunciado (statement fatiado em 160,
 * mesma chave da revisão dirigida). QUESTÃO RESOLVIDA em qualquer lugar não
 * entra (estado presente decide — a corrida é história). Consumidores:
 * collectMistakes (dedupe das linhas) e o caderno compacto do Praticar
 * (badge "também no simulado", mesma gramática do caderno completo).
 */
export function simuladoMissedMap(
  progress: StudyProgress,
): Map<string, { missed: boolean; dates: string[] }> {
  const idByStatement = statementIndex();
  const map = new Map<string, { missed: boolean; dates: string[] }>();
  for (const run of progress.simuladoRuns ?? []) {
    if (!run.questions) continue;
    for (const q of run.questions) {
      if (q.status === 'solved') continue;
      const exId = q.statement ? idByStatement.get(q.statement) : undefined;
      if (!exId) continue; // enunciado sem par no acervo — nada a mesclar
      if (progress.exerciseProgress?.[exId]?.solved) continue; // já virou acerto
      const acc = map.get(exId) ?? { missed: false, dates: [] };
      acc.missed = acc.missed || q.status === 'missed';
      acc.dates.push(run.date);
      map.set(exId, acc);
    }
  }
  return map;
}

/**
 * Junta as 3 fontes de erro. Ordena do mais recente para o mais antigo
 * (o topo do caderno é o que está fresco na memória — e na prova).
 *
 * DEDUPE (3 camadas — o mesmo erro nunca vira duas linhas):
 *  a. QUESTÃO JÁ RESOLVIDA em qualquer lugar (exerciseProgress.solved) — a
 *     linha do simulado NÃO entra: o caderno mostra pendências atuais, a
 *     corrida fica como história (mesma regra da revisão dirigida);
 *  b. errada/pulada no simulado E pendente como exercício — funde na linha
 *     do exercício (que tem lapses), com o contexto do simulado na nota e
 *     no badge "também no simulado";
 *  c. perdida em N corridas sem entrada de exercício — UMA linha com
 *     "(e em mais N)" na nota e badge "N× no simulado".
 */
export function collectMistakes(progress: StudyProgress): MistakeItem[] {
  const items: MistakeItem[] = [];

  // 1) Exercícios PRIMEIRO: tentou e não resolveu (o acervo dá enunciado/tópico).
  //    lapses>0 = "erro de sempre" — já tinha resolvido e recaiu (o pior
  //    tipo de erro na véspera: parece aprendido e não está). A coleta em
  //    Map permite o dedupe da fonte 2 abaixo (a entrada de exercício VENCE:
  //    é a única que acompanha o ciclo errou → resolveu → recaiu).
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const exItems = new Map<string, MistakeItem>();
  for (const [id, entry] of Object.entries(progress.exerciseProgress ?? {})) {
    if (!entry.tried || entry.solved) continue;
    const ex = byId.get(id);
    if (!ex) continue; // id órfão (acervo mudou) — nada a exibir, sem inventar
    exItems.set(id, {
      key: `ex:${id}`,
      kind: 'exercicio',
      disciplineCode: ex.disciplineCode,
      title: truncate(ex.statement),
      topic: ex.topic,
      difficulty: ex.difficulty,
      when: entry.lastPracticedAt,
      lapses: entry.lapses,
      note: entry.neededHelp
        ? 'Tentou e precisou de ajuda'
        : entry.marked
          ? 'Marcado para revisar · ainda não resolveu'
          : 'Tentou e não resolveu',
    });
  }

  // 2) Simulados: só tentativas com detalhe por questão têm erros nomeáveis.
  //    simuladoMissedMap já aplica (a) estado presente e casa pelo enunciado;
  //    aqui só falta separar (b) pendente como exercício — que funde na linha
  //    dele — de (c) só simulado — que vira UMA linha por questão.
  const runMisses = simuladoMissedMap(progress);

  // Sem par no acervo (corrida antiga). DUAS honestidades diferentes:
  //  • COM enunciado (que não casa mais com o acervo — exercício editado ou
  //    removido): o enunciado É a chave de identidade — mescla as corridas
  //    em UMA linha com badge "N× no simulado" e recorrência (≥ 2), igual à
  //    camada (c). Chave estável `simx:` faz a marcação "revisado" sobreviver
  //    a novas corridas (antes, key = run.id → cada corrida recriava a linha
  //    e o "revisado" se perdia).
  //  • SEM enunciado gravado: fundir seria INVENTAR que duas ocorrências são
  //    a mesma questão — fica uma linha por corrida, marcada noStatement.
  const idByStatement = statementIndex();
  const noPairByStatement = new Map<
    string,
    {
      missed: boolean;
      dates: string[];
      first: { disciplineCode: string; topic?: string; difficulty?: string };
    }
  >();
  for (const run of progress.simuladoRuns ?? []) {
    if (!run.questions) continue;
    const when = fmtDate(run.date);
    run.questions.forEach((q, i) => {
      if (q.status === 'solved') return;
      const missed = q.status === 'missed';
      const exId = q.statement ? idByStatement.get(q.statement) : undefined;
      if (exId) return; // resolvível — tratado pelos merges (b)/(c) abaixo
      if (!q.statement) {
        // sem chave de identidade — NÃO mescla (honestidade acima)
        items.push({
          key: `${run.id}:${i}`,
          kind: missed ? 'simulado_missed' : 'simulado_skipped',
          disciplineCode: q.disciplineCode || run.filters?.discipline || '—',
          title: NO_STATEMENT_TITLE,
          topic: q.topic,
          difficulty: q.difficulty as MistakeItem['difficulty'],
          when: run.date,
          note: missed ? `Errei no simulado de ${when}` : `Pulei no simulado de ${when}`,
          noStatement: true,
        });
        return;
      }
      const k = q.statement.slice(0, 160);
      const acc = noPairByStatement.get(k);
      if (acc) {
        acc.missed = acc.missed || missed;
        acc.dates.push(run.date);
      } else {
        noPairByStatement.set(k, {
          missed,
          dates: [run.date],
          first: {
            disciplineCode: q.disciplineCode || run.filters?.discipline || '—',
            topic: q.topic,
            difficulty: q.difficulty,
          },
        });
      }
    });
  }
  for (const [k, acc] of noPairByStatement) {
    const lastRun = [...acc.dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    const multi = acc.dates.length > 1;
    items.push({
      key: `simx:${k}`,
      kind: acc.missed ? 'simulado_missed' : 'simulado_skipped',
      disciplineCode: acc.first.disciplineCode,
      title: truncate(k, 110),
      topic: acc.first.topic,
      difficulty: acc.first.difficulty as MistakeItem['difficulty'],
      when: lastRun,
      note: `${acc.missed ? 'Errei' : 'Pulei'} no simulado de ${fmtDate(lastRun)}${
        multi ? ` (e em mais ${acc.dates.length - 1} simulado${acc.dates.length > 2 ? 's' : ''})` : ''
      }`,
      mergedSimulado: multi
        ? { missed: acc.missed, count: acc.dates.length, lastDate: lastRun }
        : undefined,
    });
  }

  // (b) Exercícios entram com o contexto de simulado fundido (se houver).
  for (const [id, it] of exItems) {
    const m = runMisses.get(id);
    if (!m) {
      items.push(it);
      continue;
    }
    const lastRun = [...m.dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    const tEx = it.when ? new Date(it.when).getTime() : 0;
    const tRun = new Date(lastRun).getTime();
    const mostRecent = tRun > tEx ? lastRun : it.when;
    const plural = m.dates.length > 1 ? ` (e em mais ${m.dates.length - 1} simulado${m.dates.length > 2 ? 's' : ''})` : '';
    items.push({
      ...it,
      when: mostRecent,
      note: `${m.missed ? 'Errei' : 'Pulei'} no simulado de ${fmtDate(lastRun)}${plural} · ${it.note}`,
      mergedSimulado: { missed: m.missed, count: m.dates.length, lastDate: lastRun },
    });
  }

  // (c) Questões perdidas em N corridas sem entrada de exercício: UMA linha
  //     por questão, com dados do ACERVO (mais completos que o detail da
  //     corrida) e o histórico contado na nota e no badge "N× no simulado".
  for (const [exId, acc] of runMisses) {
    if (exItems.has(exId)) continue; // (b) já fundiu na linha do exercício
    const ex = byId.get(exId);
    if (!ex) continue; // defesa — runMisses só nasce de pares do acervo
    const lastRun = [...acc.dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    const multi = acc.dates.length > 1;
    items.push({
      key: `sim:${exId}`,
      kind: acc.missed ? 'simulado_missed' : 'simulado_skipped',
      disciplineCode: ex.disciplineCode,
      title: truncate(ex.statement, 110),
      topic: ex.topic,
      difficulty: ex.difficulty,
      when: lastRun,
      note: `${acc.missed ? 'Errei' : 'Pulei'} no simulado de ${fmtDate(lastRun)}${
        multi ? ` (e em mais ${acc.dates.length - 1} simulado${acc.dates.length > 2 ? 's' : ''})` : ''
      }`,
      mergedSimulado: multi
        ? { missed: acc.missed, count: acc.dates.length, lastDate: lastRun }
        : undefined,
    });
  }

  // 3) Flashcards: já erraram (lapses>0) e ainda estão em caixa frágil (≤1).
  //    lapses ≥ 2 = cartão RECORRENTE — o aluno erra de novo o que já errou.
  for (const card of progress.flashcards ?? []) {
    if (card.lapses <= 0 || card.box > 1) continue;
    items.push({
      key: `fc:${card.id}`,
      kind: 'flashcard',
      disciplineCode: card.disciplineCode,
      title: truncate(card.front, 110),
      when: card.lastReviewedAt || card.createdAt,
      lapses: card.lapses,
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
  const recorrente = isRecorrenteMistake(it)
    ? ` [RECORRENTE — ${
        it.kind === 'flashcard'
          ? `errei este cartão ${it.lapses === 2 ? '2×' : `${it.lapses}×`} e ainda não consolidei`
          : (it.lapses ?? 0) > 0
            ? `já tinha resolvido e voltei a errar ${it.lapses === 1 ? '1×' : `${it.lapses}×`}`
            : `perdi em ${it.mergedSimulado?.count} simulados diferentes sem conseguir resolver no meio`
      }; prioridade máxima]`
    : '';
  const tag = revisedAt
    ? ` [JÁ REVISADO em ${fmtDate(revisedAt)} — reestudei este ponto]`
    : ' [PENDENTE]';
  // Corrida antiga sem enunciado: a IA não tem o que reler — declarar a
  // lacuna evita que ela invente o conteúdo da questão ao analisar padrões.
  const body = it.noStatement
    ? `${NO_STATEMENT_TITLE} — só sei o registro do erro (a corrida antiga não gravou o enunciado; NÃO tente reconstruir a questão, use só o tópico como sinal)`
    : it.title;
  return `- [${parts.join(' · ')}] ${kindLabel(it.kind)}: ${body}${recorrente}${tag}`;
}

/** Chip de UM erro: reensino focado + treino imediato + cartão pronto p/ o baralho.
 *  Corrida antiga sem enunciado: a pergunta é REFORMULADA com honestidade —
 *  a IA não recebe enunciado nenhum (não existe), então ensina o TÓPICO do
 *  zero com uma questão análoga em vez de fingir que releu o erro. */
export function buildItemQuestion(it: MistakeItem): string {
  const label = kindLabel(it.kind);
  if (it.noStatement) {
    return [
      `No meu caderno de erros do Hub tem um registro antigo: eu ${label.toLowerCase()} no simulado, mas a corrida não gravou o enunciado — só sei que era de ${it.topic || 'um tópico da disciplina'}.`,
      '',
      'Não tenta adivinhar qual era a questão. No meu lugar: (1) lista os erros clássicos desse tópico, (2) me ensina o tópico do zero como o professor faria na correção e (3) me dá uma questão parecida com as da prova para eu tentar agora.',
      TUTOR_CARD_SUFFIX,
    ]
      .filter(Boolean)
      .join('\n');
  }
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

// ---------- O papel do caderno (a folha da véspera) ----------

/**
 * O ENUNCIADO COMPLETO do acervo para um item do caderno — a resolução que
 * a folha do papel (/caderno-papel) imprime e o botão do caderno conta.
 * Só as linhas que nasceram de um PAR do acervo (`ex:{id}` exercício pendente,
 * `sim:{id}` questão perdida em simulado casada com o acervo) têm enunciado
 * completo garantido: o `title` da linha é truncado na coleta (TITLE_MAX), o
 * papel não publica truncamento. `simx:` (sem par — corrida antiga ou questão
 * editada) e `fc:` (cartão — o VERSO é parte da prática, papel perde a
 * resposta) não resolvem: null honesto.
 */
export function fullStatementFor(it: MistakeItem): string | null {
  const id =
    it.key.startsWith('ex:') || it.key.startsWith('sim:') ? it.key.slice(3) : null;
  if (!id) return null;
  return exercises.find((e) => e.id === id)?.statement ?? null;
}

export interface PaperNotebook {
  /** Pendências com enunciado completo no acervo — a folha imprime. */
  printable: MistakeItem[];
  /** Cartões frágeis que ficam de fora (o verso é parte da prática). */
  cartoes: number;
  /** Registros sem par no acervo (corrida antiga / questão editada). */
  semAcervo: number;
}

/**
 * A FONTE ÚNICA do papel do caderno — consumida pelo caderno na tela (o botão
 * "Levar N ao papel" e o CTA da faixa da véspera) e pela folha (rota
 * /caderno-papel, que re-coleta e re-filtra com a MESMA função — zero segunda
 * derivação, a mesma gramática de collectMistakes/pendingMistakes). Um item
 * só vai ao papel quando o acervo CONFIRMA o enunciado completo agora (id
 * órfão não imprime enunciado que não existe mais).
 */
export function paperNotebookFor(
  items: MistakeItem[],
  revisedMap?: { [key: string]: string } | null,
): PaperNotebook {
  const pendentes = pendingMistakes(items, revisedMap);
  const printable: MistakeItem[] = [];
  let cartoes = 0;
  let semAcervo = 0;
  for (const it of pendentes) {
    if (it.kind === 'flashcard') {
      cartoes += 1;
      continue;
    }
    if (fullStatementFor(it) !== null) printable.push(it);
    else semAcervo += 1;
  }
  return { printable, cartoes, semAcervo };
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
  const recorrentes = items.filter((it) => isRecorrenteMistake(it)).length;
  const head = [
    scopeLabel
      ? `Meu caderno de erros do Hub tem ${items.length} ${items.length === 1 ? 'item' : 'itens'} ${scopeLabel} (janela filtrada por mim — o caderno completo tem mais erros antigos).`
      : `Meu caderno de erros do Hub tem ${items.length} ${items.length === 1 ? 'item' : 'itens'} até agora`,
    `(${stats.simulado} de simulados, ${stats.exercicio} de exercícios, ${stats.flashcard} de flashcards).`,
    recorrentes > 0
      ? `ATENÇÃO: ${recorrentes} ${recorrentes === 1 ? 'deles é RECORRENTE' : 'deles são RECORRENTES'} — já resolvi e recaí, ou perdi em mais de um simulado (os marcados com [RECORRENTE] abaixo); são a minha maior fragilidade.`
      : '',
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
