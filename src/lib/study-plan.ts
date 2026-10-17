// study-plan.ts — O CRONOGRAMA QUE SE MONTA SOZINHO (frente 13, pedido do
// dono 12/10/2026: "priorizar os documentos mais recentes que estão sendo
// vistos em aula mas também revisar os antigos com prática e técnica de
// memorização de dias pra sempre ter o que estudar").
//
// CURADORIA CASO A CASO (dono, 12/10/2026): "quero focar nos conteúdos mais
// recentes que batem com a semana real da faculdade — priorizar os com
// questões práticas/material real; leitura fica complementar; o que foi
// gerado pra prova nem precisa mais". Desde então a fila lê a curadoria de
// material-curation.ts: apoio/arquivo saem da fila inteira; o acervo-esparso
// (muro de 43p, pasta do Drive, slides gerais) vira AQUECIMENTO no fim;
// "próximo" entrega a prática mais recente da aula primeiro, uma por
// disciplina, e explica o papel de cada sugestão no porquê.
//
// A fila do dia nasce do que o uso diário já registra — nada é lançado à mão:
//   1. CONTINUAR — o material recente que ainda não virou conhecimento;
//   2. REVISÃO — o ciclo espaçado 1·3·7·14·30 semeado ao concluir (o antigo
//      volta ao dia quando a memória dele começa a desbotar);
//   3. PRÁTICA — cartões vencidos (recall ativo, o teste que fixa);
//   3b. CICLO DO ERRO (pauta nº 1) — o erro registrado no Code Review vira
//      tarefa de revisão no tópico que o gerou ("a prova nasce dos seus
//      erros"): depois dos cartões FSRS vencidos, antes dos materiais novos;
//      com prova D-7/D-3 o erro sobe (a régua de prova manda aqui também);
//      o item sai sozinho quando o Code Review o domina (2 acertos de cabeça).
//   4. ATRASADO — material da disciplina que você anda seguindo, sem concluir;
//   5. PRÓXIMO — a prática/leitura mais recente de cada disciplina na régua
//      da curadoria (o acervo-esparso aquece no fim — a fila nunca fica vazia).
// A checklist de cada PDF pesa no PORQUÊ ("faltam 3 de 5 no checklist") —
// o cronograma e as caixinhas são o mesmo sistema, não duas prateleiras.
//
// Lib PURA (lição do today-focus.ts): sem React, sem localStorage — recebe
// StudyProgress + now e devolve blocos honestos com o porquê de cada um.
// A página de retomada REAL chega injetada (opts.pageOf — mesma doutrina da
// frente 9: a lib não lê storage, o chamador entrega o valor pronto).

import { disciplines, materials, type Material } from '@/data/course-data';
import {
  flashcardsDueFor,
  MATERIAL_REVIEW_DAYS,
  type StudyProgress,
} from './study-progress';
import {
  applyLadder,
  curateMaterial,
  inStudyQueue,
  studyRank,
} from './material-curation';
import { examPressureFor, examPressureWhy } from './exam-radar';
import { disciplineSignalsOf } from './learning-signals';

export type PlanKind =
  | 'continuar'
  | 'revisao'
  | 'pratica'
  | 'erro'
  | 'reforco'
  | 'atrasado'
  | 'proximo';

/**
 * CICLO DO ERRO (pauta nº 1, Task 213-b) — um erro do Code Review (núcleo v2)
 * pronto para virar tarefa da fila. O CHAMADOR entrega a lista honesta (o hook
 * da casa lê o núcleo e já devolve dedupe por unidade — o erro reincidente
 * ATUALIZA a tarefa em vez de criar outra — e sem os dominados). Esta lib
 * continua pura: não conhece IndexedDB, só o resultado.
 */
export interface ErrorReviewTask {
  /** Identidade do erro (o attempt que o registrou — trace/dedupe). */
  attemptId: string;
  /** A unidade de prática que o gerou (o destino do re-teste). */
  unitId: string;
  /** Código da disciplina que o gerou — a régua de prova vale aqui também. */
  disciplineCode: string;
  /** O tópico que o gerou (rótulo do PPC), quando o núcleo conhece. */
  topicName?: string;
  /** O porquê real — 1 frase gravada no ato do erro. */
  reason: string;
  /** conceito | deslize | tempo — a categoria honesta do ato. */
  category: string;
  /** Quando o erro foi registrado (epoch ms) — a recência desempata. */
  at: number;
}

export interface PlanBlock {
  /** Estável por construção — o dashboard usa como key e data-t de teste. */
  id: string;
  kind: PlanKind;
  materialId?: string;
  disciplineCode?: string;
  title: string;
  /** O porquê em uma linha — o plano decide, mas explica. */
  why: string;
  /** Estimativa honesta de tempo (minutos). */
  minutes: number;
  /** A prova que pesou neste bloco (D-N para o selo da fila — Task 27). */
  exam?: { name: string; daysLeft: number };
  /** CICLO DO ERRO — a unidade de prática do Code Review que gerou o bloco
   *  (o clique abre o re-teste da questão exata no Praticar). */
  errorUnitId?: string;
}

export interface DayPlan {
  blocks: PlanBlock[];
  totalMinutes: number;
}

const DAY = 86_400_000;

/** Caps de atrasados/próximos por disciplina — o FOCO DO DIA (Task 224) tem
 *  fila mais longa: até 4 blocos da matéria focada contra 2 das demais. */
function queueCapFor(code: string, focusDiscipline?: string): number {
  return focusDiscipline && code === focusDiscipline ? 4 : 2;
}

function daysAgo(iso: string, nowMs: number): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return -1;
  return Math.floor((nowMs - t) / DAY);
}

export function buildDayPlan(
  sp: StudyProgress,
  now: Date,
  opts?: {
    pageOf?: (materialId: string) => number | null;
    maxBlocks?: number;
    /** CICLO DO ERRO — os erros abertos do Code Review, prontos pelo hook da casa. */
    errorReviews?: ErrorReviewTask[];
    /** FOCO DO DIA (Task 224): a matéria que o dono escolheu concentrar hoje —
     *  os blocos dela sobem (a véspera de prova ≤3d e a manutenção curta
     *  continuam na frente) e o porquê confessa o foco. */
    focusDiscipline?: string;
  },
): DayPlan {
  const maxBlocks = opts?.maxBlocks ?? 6;
  const nowMs = now.getTime();

  // REVISÃO SOB COMANDO (Task 27 — pedido do dono: "poder ativar se quer
  // estudar/revisar assuntos antigos ou não"): undefined = ligada (padrão).
  const includeReviews = sp.preferences?.includeReviews !== false;

  // RADAR DE PROVAS (Task 27): a pressão real por disciplina — D-21 acende,
  // D-7 pesa, D-3 manda. Só data oficial (anti-estimativa); prova feita
  // não pressiona (a Av1 de Matemática saiu da fila sozinha).
  const pressureOf = (code: string) => examPressureFor(code, now);
  const boostOf = (code: string): number => {
    const p = pressureOf(code);
    if (!p) return 0;
    if (p.daysLeft <= 3) return 3;
    if (p.daysLeft <= 7) return 2;
    if (p.daysLeft <= 21) return 1;
    return 0;
  };
  const completed = new Set(sp.completedMaterials ?? []);
  const matOf = (id: string): Material | null =>
    materials.find((m) => m.id === id) ?? null;

  const blocks: PlanBlock[] = [];
  const usedIds = new Set<string>();
  const usedMaterials = new Set<string>();

  const push = (b: Omit<PlanBlock, 'id'>) => {
    if (blocks.length >= maxBlocks) return false;
    const id = `${b.kind}:${b.materialId ?? b.errorUnitId ?? 'geral'}`;
    if (usedIds.has(id)) return false;
    if (b.materialId && usedMaterials.has(b.materialId)) return false;
    usedIds.add(id);
    if (b.materialId) usedMaterials.add(b.materialId);
    blocks.push({ ...b, id });
    return true;
  };

  // ----- CICLO DO ERRO (pauta nº 1, Task 213-b — "a prova nasce dos seus
  //    erros"): o erro registrado no Code Review vira tarefa de revisão NO
  //    TÓPICO QUE O GEROU, com o porquê citando o erro real ("seu erro em
  //    …: \"…\""). DEDUPE estrutural: o id do bloco É a unidade do erro — o
  //    mesmo erro nunca entra 2x, e o reincidente chega do hook já atualizado
  //    (o registro mais recente vence). CICLO FECHA: quando o Code Review
  //    domina o erro (2 acertos de cabeça), ele nem chega aqui — a fila o
  //    esquece sozinha. A RÉGUA DE PROVA VALE (Task 27): prova D-7/D-3 sobe o
  //    erro para ANTES da prática; D-21 só acende (selo + porquê). Teto
  //    honesto: 2 erros/dia, compartilhado pelas duas injeções.
  const errorTasks = [...(opts?.errorReviews ?? [])].sort((a, b) => {
    const ba = boostOf(a.disciplineCode);
    const bb = boostOf(b.disciplineCode);
    if (ba !== bb) return bb - ba;
    return b.at - a.at;
  });
  const discShort = (code: string): string =>
    disciplines.find((d) => d.code === code)?.shortName ?? code;
  const errorBlockOf = (t: ErrorReviewTask): Omit<PlanBlock, 'id'> => {
    const press = pressureOf(t.disciplineCode);
    const examWhy = examPressureWhy(t.disciplineCode, now);
    // o rótulo do PPC vem com prefixo "Unidade N:" — o porquê fala humano
    const where =
      t.topicName?.replace(/^Unidade\s*\d+\s*:\s*/, '') || discShort(t.disciplineCode);
    return {
      kind: 'erro',
      errorUnitId: t.unitId,
      disciplineCode: t.disciplineCode,
      title: t.topicName ?? `Erro de ${discShort(t.disciplineCode)}`,
      why: [`seu erro em ${where}: “${t.reason}”`, examWhy].filter(Boolean).join(' · '),
      minutes: 15,
      exam: press && press.daysLeft <= 7 ? press : undefined,
    };
  };
  let errorsAdded = 0;
  const tryAddErrors = (onlyWithExamPressure: boolean): void => {
    for (const t of errorTasks) {
      if (errorsAdded >= 2 || blocks.length >= maxBlocks) return;
      if (onlyWithExamPressure && boostOf(t.disciplineCode) < 2) continue;
      if (push(errorBlockOf(t))) errorsAdded += 1;
    }
  };

  const focusMin = Math.max(15, sp.preferences?.pomodoroConfig?.focus ?? 25);

  // ----- a checklist de cada PDF pesa no porquê (a fila e as caixinhas são
  // o MESMO sistema: o cronograma lê o que falta e diz) -----
  const checklistWhy = (id: string): string | null => {
    const items = sp.materialChecklists?.[id]?.items ?? [];
    if (items.length === 0) return null;
    const remaining = items.filter((it) => !it.done).length;
    if (remaining === 0)
      return `checklist completo (${items.length}/${items.length}) — vale marcar como concluído`;
    return `faltam ${remaining} de ${items.length} no checklist`;
  };

  // 1) CONTINUAR — o mais recente que ainda não virou conhecimento. O momentum
  //    mora no retomar: 1 clique devolve ao ponto exato (página e foco).
  {
    const last = (sp.recentMaterials ?? []).find((r) => {
      const m = matOf(r.id);
      return m && inStudyQueue(m) && !completed.has(r.id);
    });
    if (last) {
      const m = matOf(last.id)!;
      const page = opts?.pageOf ? opts.pageOf(last.id) : null;
      const opened = last.accessedAt ? daysAgo(last.accessedAt, nowMs) : -1;
      const whys: string[] = [];
      if (page && page > 1) whys.push(`parou na pág. ${page}`);
      else if (opened >= 0)
        whys.push(
          opened === 0
            ? 'aberto hoje, sem terminar'
            : `aberto há ${opened === 1 ? '1 dia' : `${opened} dias`}, sem terminar`,
        );
      const ck = checklistWhy(last.id);
      if (ck) whys.push(ck);
      const examWhy = m.disciplineCode ? examPressureWhy(m.disciplineCode, now) : null;
      if (examWhy) whys.push(examWhy);
      const press = m.disciplineCode ? pressureOf(m.disciplineCode) : null;
      push({
        kind: 'continuar',
        materialId: last.id,
        disciplineCode: m.disciplineCode,
        title: m.title,
        why: whys.join(' · ') || 'onde o estudo parou',
        minutes: focusMin,
        exam: press && press.daysLeft <= 7 ? press : undefined,
      });
    }
  }

  // 2) REVISÕES ESPAÇADAS VENCIDAS — o antigo não apodrece: o ciclo o traz de
  //    volta. Material CONCLUÍDO revisa de propósito (o marcador de concluído
  //    não isenta da revisão — é ela que mantém o conteúdo vivo).
  //    DESLIGÁVEL (Task 27): com revisão desligada, os slots livres caem para
  //    os atrasados/próximos — a casa respeita o comando sem perder fila.
  if (includeReviews) {
    const due = Object.entries(sp.materialReviews ?? {})
      .filter(([id, st]) => {
        const m = matOf(id);
        // material de prova passada (arquivo) não reaparece nem na revisão —
        // "não vou perder tempo com assuntos antigos" (dono, curadoria 12/10)
        if (!m || !inStudyQueue(m)) return false;
        const t = new Date(st.dueAt).getTime();
        return !Number.isNaN(t) && t <= nowMs;
      })
      // A PRESSÃO MANDA NA REVISÃO TAMBÉM (pauta #3, dono 13/10/2026): a
      // revisão da matéria com prova à frente sobe na fila — D-21 acende,
      // D-7 pesa, D-3 manda; dentro do mesmo nível, a mais vencida primeiro.
      .sort((a, b) => {
        const ma = matOf(a[0]);
        const mb = matOf(b[0]);
        const ba = ma ? boostOf(ma.disciplineCode) : 0;
        const bb = mb ? boostOf(mb.disciplineCode) : 0;
        if (ba !== bb) return bb - ba;
        return new Date(a[1].dueAt).getTime() - new Date(b[1].dueAt).getTime();
      });
    for (const [id, st] of due) {
      if (blocks.length >= maxBlocks) break;
      const m = matOf(id)!;
      const interval = MATERIAL_REVIEW_DAYS[Math.min(st.stage, MATERIAL_REVIEW_DAYS.length - 1)];
      const overdue = Math.floor((nowMs - new Date(st.dueAt).getTime()) / DAY);
      const press = pressureOf(m.disciplineCode);
      const examWhy = press && press.daysLeft <= 7 ? examPressureWhy(m.disciplineCode, now) : null;
      // TASK 220 — a volta antecipada confessa o motivo: a cadência natural
      // cairia depois da prova; a prova puxou a revisão para antes dela.
      const cadencia = overdue > 0
        ? `revisão espaçada vencida há ${overdue === 1 ? '1 dia' : `${overdue} dias`} — a volta de ${interval}d que fixa`
        : `revisão espaçada do dia — a volta de ${interval}d que fixa`;
      const why = st.pulledForExam
        ? `antecipada pela prova (a volta de ${interval}d cairia depois dela) — revisitar antes de ser avaliado`
        : cadencia;
      push({
        kind: 'revisao',
        materialId: id,
        disciplineCode: m.disciplineCode,
        title: m.title,
        why: [why, examWhy].filter(Boolean).join(' · '),
        minutes: 15,
        exam: press && press.daysLeft <= 7 ? press : undefined,
      });
    }
  }

  // CICLO DO ERRO — 1ª injeção (prova pesando, D-7/D-3): o erro do tópico
  //    cobrado sobe para a frente — depois das revisões, antes até dos
  //    cartões vencidos ("D-7 pesa, D-3 manda").
  tryAddErrors(true);

  // 3) PRÁTICA — recall ativo dos cartões vencidos (o mesmo princípio da
  //    recomendação única: dez minutos de teste valem mais que uma hora lendo).
  {
    const dueCards = flashcardsDueFor(
      Array.isArray(sp.flashcards) ? sp.flashcards : [],
      nowMs,
    ).length;
    if (dueCards > 0) {
      push({
        kind: 'pratica',
        title:
          dueCards === 1 ? 'Revisar 1 cartão vencido' : `Revisar ${dueCards} cartões vencidos`,
        why: 'recall ativo — testar de cabeça fixa mais que reler',
        minutes: 10,
      });
    }
  }

  // CICLO DO ERRO — 2ª injeção (posição padrão, sem prova pesando): depois
  //    dos cartões FSRS vencidos, antes dos materiais novos. Os pressurizados
  //    já entraram (o push dedupe pelo id da unidade — nada se repete); este
  //    é o resto da fila de erros do dia.
  tryAddErrors(false);

  // ----- as disciplinas que você anda seguindo (recentes + foco dos últimos
  //      14 dias) — a MESMA ordem serve para atrasados e para os próximos -----
  const discOrder: string[] = [];
  for (const r of sp.recentMaterials ?? []) {
    const m = matOf(r.id);
    if (m && !discOrder.includes(m.disciplineCode)) discOrder.push(m.disciplineCode);
  }
  for (const s of sp.pomodoroSessions ?? []) {
    if (!s.date || !s.disciplineId || discOrder.includes(s.disciplineId)) continue;
    const d = new Date(`${s.date}T00:00:00`).getTime();
    if (!Number.isNaN(d) && nowMs - d <= 14 * DAY) discOrder.push(s.disciplineId);
  }

  // 3c. REFORÇO DE BASE (Task 226 — O ALGORITMO QUE APRENDE): quando o
  //    registro REAL das questões diz que uma matéria que você anda seguindo
  //    está 'puxada' (tempo alto / dependente de ajuda), a fila NÃO avança
  //    degrau — ela traz a PRÁTICA do degrau atual para agora (o efeito
  //    escadinha respeita a dificuldade medida, não só a ordem da grade).
  //    1 reforço/dia (a fila não vira punição); só matérias seguidas
  //    recentemente (discOrder) entram — silêncio não vira julgamento.
  {
    const puxadas = disciplineSignalsOf(sp)
      .filter((s) => s.level === 'puxada' && discOrder.includes(s.code));
    for (const s of puxadas) {
      if (blocks.length >= maxBlocks) break;
      const rankedDisc = materials
        .filter(
          (m) =>
            m.disciplineCode === s.code &&
            inStudyQueue(m) &&
            !completed.has(m.id) &&
            !usedMaterials.has(m.id),
        )
        .sort((a, b) => {
          // prática do degrau atual primeiro — reforço é FAZER, não reler
          const pa = curateMaterial(a).role === 'pratica' ? 0 : 1;
          const pb = curateMaterial(b).role === 'pratica' ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return studyRank(a) - studyRank(b);
        });
      const mat = rankedDisc[0];
      if (!mat) continue;
      const press = pressureOf(s.code);
      const examWhy = examPressureWhy(s.code, now);
      const ok = push({
        kind: 'reforco',
        materialId: mat.id,
        disciplineCode: s.code,
        title: mat.title,
        why: [
          `dificuldade real nas questões (${s.solvedNoHelp} de ${s.tried} de cabeça${s.medianTimeSec ? `, ~${Math.round(s.medianTimeSec / 60)}min por questão` : ''}) — reforço antes de avançar a escada`,
          examWhy,
        ]
          .filter(Boolean)
          .join(' · '),
        minutes: focusMin,
        exam: press && press.daysLeft <= 7 ? press : undefined,
      });
      if (ok) break; // 1 reforço/dia — a fila não vira punição
    }
  }

  // 4) ATRASADOS — material da disciplina que você anda seguindo, ainda sem
  //    concluir, na régua da curadoria (a evidência da aula, não o array cru).
  //    A ordem das disciplinas agora RESPEITA A PROVA (Task 27): quem tem
  //    prova à frente (D-21/D-7/D-3) vem antes das demais no mesmo nível.
  {
    const orderedDiscs = [...discOrder].sort((a, b) => boostOf(b) - boostOf(a));
    let added = 0;
    for (const code of orderedDiscs) {
      if (added >= queueCapFor(code, opts?.focusDiscipline) || blocks.length >= maxBlocks) break;
      const rankedRaw = materials
        .filter((m) => m.disciplineCode === code && inStudyQueue(m) && !completed.has(m.id))
        .sort((a, b) => studyRank(a) - studyRank(b));
      // A escadinha também aqui: atrasado não pula degrau pendente.
      const { queue: ranked } = applyLadder(rankedRaw, new Set(rankedRaw.map((m) => m.id)));
      for (const m of ranked) {
        if (added >= queueCapFor(code, opts?.focusDiscipline) || blocks.length >= maxBlocks) break;
        const ck = checklistWhy(m.id);
        const examWhy = examPressureWhy(m.disciplineCode, now);
        const press = pressureOf(m.disciplineCode);
        // O retorno de push É o contrato: material que já entrou no plano
        // (continuar/revisão) não consome slot de atrasado — o mesmo PDF
        // nunca aparece duas vezes com etiquetas diferentes.
        const ok = push({
          kind: 'atrasado',
          materialId: m.id,
          disciplineCode: m.disciplineCode,
          title: m.title,
          why: [ck ?? 'ainda sem concluir — o conteúdo que ficou para trás', examWhy]
            .filter(Boolean)
            .join(' · '),
          minutes: focusMin,
          exam: press && press.daysLeft <= 7 ? press : undefined,
        });
        if (ok) added += 1;
      }
    }
  }

  // 5) PRÓXIMOS — a prática mais recente da aula primeiro (uma por disciplina
  //    que você anda seguindo), depois a leitura do assunto em curso; o
  //    acervo-esparso aquece no fim. "Sempre ter o que estudar" — sem que o
  //    plano invente conteúdo que a aula não deu nem ofereça prova velha.
  //    A ESCADINHA (dono 13/10) vem antes da escolha: um degrau nunca é
  //    oferecido antes da base pendente — a S5 entra no lugar da S6, a teoria
  //    de determinantes no lugar da lista, e o porquê explica o degrau.
  {
    const rankedRaw = materials
      .filter((m) => inStudyQueue(m) && !completed.has(m.id))
      .sort((a, b) => studyRank(a) - studyRank(b));
    const { queue: ranked, whyOverride: ladderWhys } = applyLadder(
      rankedRaw,
      new Set(rankedRaw.map((m) => m.id)),
    );

    const picked = new Set<string>();
    const candidates: Material[] = [];
    // 1ª passada: o melhor candidato de cada disciplina que você anda seguindo
    // — com a prova pesando (Task 27): quem tem prova mais próxima oferece
    // o candidato primeiro, mesmo sem ser a disciplina mais recente
    for (const code of [...discOrder].sort((a, b) => boostOf(b) - boostOf(a))) {
      const best = ranked.find((m) => m.disciplineCode === code);
      if (best) {
        candidates.push(best);
        picked.add(best.id);
      }
    }
    // 2ª passada: completa com a fila inteira na régua da curadoria —
    // a pressão de prova também reordena o resto (prova próxima sobe)
    for (const m of ranked) {
      if (picked.has(m.id)) continue;
      picked.add(m.id);
      candidates.push(m);
    }

    let added = 0;
    for (const m of candidates) {
      if (added >= queueCapFor(m.disciplineCode, opts?.focusDiscipline) || blocks.length >= maxBlocks) break;
      const short =
        disciplines.find((d) => d.code === m.disciplineCode)?.shortName ?? m.disciplineCode;
      const cur = curateMaterial(m);
      const examWhy = examPressureWhy(m.disciplineCode, now);
      const press = pressureOf(m.disciplineCode);
      const baseWhy = ladderWhys.get(m.id)
        ?? (cur.warmup
          ? `aquecimento de ${short} — o acervo já dado mantém a mente afiada`
          : cur.role === 'pratica'
            ? `próximo da fila de ${short} — a prática mais recente da aula`
            : `próximo da fila de ${short} — a leitura do assunto em curso`);
      const why = [baseWhy, examWhy].filter(Boolean).join(' · ');
      const ok = push({
        kind: 'proximo',
        materialId: m.id,
        disciplineCode: m.disciplineCode,
        title: m.title,
        why,
        minutes: focusMin,
        exam: press && press.daysLeft <= 7 ? press : undefined,
      });
      if (ok) added += 1;
    }
  }

  return {
    blocks: applyDayFocus(blocks, opts?.focusDiscipline),
    totalMinutes: blocks.reduce((acc, b) => acc + b.minutes, 0),
  };
}

/**
 * FOCO DO DIA (Task 224) — a reordenação honesta da fila pronta: os blocos da
 * matéria focada sobem para logo depois da MANUTENÇÃO INEGOCIÁVEL (véspera de
 * prova ≤3d, cartões vencidos, erro com prova pesando — 10–15min que mantêm o
 * sistema vivo); o grosso do tempo vai para onde o dono apontou. O porquê
 * ganha "foco do dia" — a casa explica a decisão em vez de fingir que não
 * aconteceu. Pura: devolve NOVA lista, não muta a original.
 */
function applyDayFocus(blocks: PlanBlock[], focusDiscipline?: string): PlanBlock[] {
  if (!focusDiscipline || blocks.length === 0) return blocks;
  const isUrgent = (b: PlanBlock): boolean =>
    (b.exam?.daysLeft ?? 99) <= 3 || b.kind === 'pratica' || b.kind === 'erro';
  const focused: PlanBlock[] = [];
  const urgent: PlanBlock[] = [];
  const rest: PlanBlock[] = [];
  for (const b of blocks) {
    if (isUrgent(b)) urgent.push(b);
    else if (b.disciplineCode === focusDiscipline) {
      focused.push({ ...b, why: b.why.includes('foco do dia') ? b.why : `${b.why} · foco do dia` });
    } else rest.push(b);
  }
  if (focused.length === 0) return blocks; // sem bloco da focada — a fila segue como está
  return [...urgent, ...focused, ...rest];
}

/** Rótulo curto do tipo de bloco (o dashboard desenha a mini-etiqueta). */
export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  continuar: 'Continuar',
  revisao: 'Revisão',
  pratica: 'Prática',
  erro: 'Reestudar',
  reforco: 'Reforço',
  atrasado: 'Atrasado',
  proximo: 'Próximo',
};
