// today-focus.ts — O ACOMPANHAMENTO AUTOMÁTICO DA CASA (diretriz do dono 10/10/2026)
//
// "Acompanhamento de mim mesmo quase que automático" — nada é lançado à mão:
// todos os números já nascem do uso diário (pomodoro, exercícios, simulados,
// flashcards, caderno de erros, materiais abertos) e do calendário oficial vivo
// (semester.ts — só data oficial à frente; nada de prova passada engessando).
//
// Lib PURA: sem React, sem localStorage — recebe StudyProgress + now e devolve
// um retrato honesto + UMA recomendação (o foco do dia). A casa decide por você,
// mas mostra o porquê — direto ao ponto, sem painel de KPIs (lição da t180).

import { disciplines, materials } from '@/data/course-data';
import { upcomingEvents } from '@/lib/semester';
import { flashcardStatsFor, type StudyProgress } from '@/lib/study-progress';
import { collectMistakes, pendingMistakes } from '@/lib/mistake-notebook';
import { EVAL_KIND_LABEL, evalsFor, type EvalKind } from '@/lib/study-triage';

/** O que o botão do foco abre (o dashboard mapeia para o evento/aba certo). */
export type FocusIntent = 'exam' | 'review' | 'mistake' | 'resume' | 'start';

export interface TodayFocus {
  kind: FocusIntent;
  /** Ação imperativa curta (é o que vira o passo 1 da casa). */
  title: string;
  /** O porquê em uma linha — o app decide, mas explica. */
  body: string;
  /** Texto do botão. */
  cta: string;
  disciplineCode?: string;
  materialId?: string;
  /** Só no foco 'exam': prova >7d abre PRÁTICA dirigida; na reta final, ensaio. */
  open?: 'simulado' | 'pratica';
  /** t241 — preset do ensaio (ex.: trio 1F/1M/1D de Algoritmos na reta final). */
  simuladoPreset?: 'math_exam' | 'math_exam_prof' | 'alg_prova1';
}

export interface TodaySnapshot {
  /** Minutos de foco registrados hoje (pomodoro). */
  minutesToday: number;
  /** Quantos dos últimos 30 dias tiveram foco registrado. */
  activeDays30: number;
  /** Dias consecutivos com foco (conta a partir de hoje; se hoje ainda não, de ontem). */
  streakDays: number;
  /** Acerto real dos exercícios (solved/tried) — null quando a base é pequena (<5). */
  accuracyPct: number | null;
  /** Cartões de revisão vencidos. */
  cardsDue: number;
  /** Itens em aberto no Caderno de Erros. */
  openMistakes: number;
  /**
   * Horas disponíveis lançadas no check-in de hoje (dono, 10/10/2026).
   * null = ainda não respondeu hoje — a casa pergunta com 1 toque, sem modal.
   */
  plannedHours: number | null;
  nextExam:
    | {
        name: string;
        daysLeft: number;
        disciplineShort: string;
        disciplineCode: string;
        kind: EvalKind;
        kindLabel: string;
      }
    | null;
  /** Próximo prazo acadêmico (entrega etc.) do calendário oficial. */
  nextDeadline: { title: string; daysLeft: number } | null;
  /**
   * A avaliação que ESTÁ dirigindo o foco (a que cumpriu a janela por tipo —
   * pode diferir da mais próxima: atividade D-5 não toma a casa de uma prova
   * D-14). null quando o foco do dia não é avaliação.
   */
  focusEval:
    | { name: string; kindLabel: string; daysLeft: number; disciplineShort: string; disciplineCode: string }
    | null;
  /** Onde o estudo parou: último material aberto, ainda não concluído. */
  resume: { materialId: string; title: string; disciplineCode?: string; page?: number } | null;
  /** A recomendação única do dia. */
  focus: TodayFocus;
}

/** Chave local yyyy-mm-dd (o pomodoro grava por dia LOCAL, não UTC). */
export function todayDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** Título curto do material (fallback honesto se o acervo mudou). */
function materialTitle(id: string): string | null {
  return materials.find((m) => m.id === id)?.title ?? null;
}

/**
 * O retrato + o foco do dia. Função pura — o dashboard chama pós-mount (agora)
 * para não divergir da hidratação.
 *
 * `pageOf` (opcional, injetado pelo dashboard): resolve a página de retomada
 * REAL de um material — a memória viva do leitor (hub:pdf-pos, t161). Antes da
 * frente 9 este retrato lia materialProgress.lastPage, campo que NINGUÉM
 * escreve mais (o leitor grava só no pdf-pos): o chip "(pág. N)", quando
 * aparecia, mentia por omissão — agora a verdade vem de onde a leitura mora,
 * e a lib continua pura (storage fica no chamador).
 */
export function buildTodaySnapshot(
  sp: StudyProgress,
  now: Date,
  opts?: { pageOf?: (materialId: string) => number | null },
): TodaySnapshot {
  // ----- tempo real (pomodoro é o registro canônico de foco) -----
  const todayKey = todayDateKey(now);
  const sessionsByDate = new Map<string, number>();
  for (const s of sp.pomodoroSessions ?? []) {
    sessionsByDate.set(s.date, (sessionsByDate.get(s.date) ?? 0) + (s.focusMinutes || 0));
  }
  const minutesToday = sessionsByDate.get(todayKey) ?? 0;

  let activeDays30 = 0;
  for (const [date] of sessionsByDate) {
    const d = new Date(`${date}T00:00:00`);
    if (!Number.isNaN(d.getTime()) && dayDiff(d, now) <= 29 && dayDiff(d, now) >= 0) activeDays30 += 1;
  }

  // Streak: caminhada para trás a partir de hoje (ou ontem, se hoje ainda não rolou)
  let streakDays = 0;
  {
    let cursor = new Date(now);
    if (!sessionsByDate.has(todayKey)) cursor = new Date(now.getTime() - 86_400_000);
    for (;;) {
      if (sessionsByDate.has(todayDateKey(cursor))) {
        streakDays += 1;
        cursor = new Date(cursor.getTime() - 86_400_000);
      } else break;
    }
  }

  // ----- acerto real (exercícios) — base pequena não vira número -----
  let tried = 0;
  let solved = 0;
  for (const e of Object.values(sp.exerciseProgress ?? {})) {
    if (e.tried) tried += 1;
    if (e.solved) solved += 1;
  }
  const accuracyPct = tried >= 5 ? Math.round((solved / tried) * 100) : null;

  // ----- fila de revisão + caderno de erros -----
  const cardsDue = flashcardStatsFor(sp.flashcards ?? [], now.getTime()).due;
  const openMistakes = pendingMistakes(collectMistakes(sp), sp.notebookRevised ?? {}).length;

  // ----- calendário vivo (só data oficial à frente) — agora POR TIPO -----
  // Todas as avaliações datadas à frente (oficiais + customizações do dono),
  // com o TIPO derivado do nome — a casa fala "Atividade em 5 dias", nunca
  // "Prova em 5 dias" para o que não é prova (Mensagem 7 do dono, 16/10/2026).
  const allEvals: {
    name: string;
    kind: EvalKind;
    daysLeft: number;
    disciplineShort: string;
    disciplineCode: string;
  }[] = [];
  for (const d of disciplines) {
    for (const e of evalsFor(d.code, sp.customEvaluations, now)) {
      if (e.daysLeft === undefined || e.daysLeft < 0 || e.daysLeft > 30) continue;
      allEvals.push({
        name: e.name,
        kind: e.kind,
        daysLeft: e.daysLeft,
        disciplineShort: d.shortName,
        disciplineCode: d.code,
      });
    }
  }
  allEvals.sort((a, b) => a.daysLeft - b.daysLeft);
  const nearest = allEvals[0] ?? null;
  const nextExam = nearest ? { ...nearest, kindLabel: EVAL_KIND_LABEL[nearest.kind] } : null;

  const deadlineRaw = upcomingEvents(now, 8).find(
    (e) => e.kind === 'prazo' && !e.ongoing && e.daysLeft >= 0 && e.daysLeft <= 14,
  );
  const nextDeadline = deadlineRaw ? { title: deadlineRaw.title, daysLeft: deadlineRaw.daysLeft } : null;

  // ----- onde parou -----
  let resume: TodaySnapshot['resume'] = null;
  {
    const last = sp.recentMaterials?.[0];
    if (last) {
      const title = materialTitle(last.id);
      const completed = sp.completedMaterials?.includes(last.id);
      const recent = last.accessedAt && now.getTime() - new Date(last.accessedAt).getTime() <= 7 * 86_400_000;
      if (title && !completed && recent) {
        const page = opts?.pageOf ? opts.pageOf(last.id) : undefined;
        const disc = materials.find((m) => m.id === last.id)?.disciplineCode;
        resume = {
          materialId: last.id,
          title,
          disciplineCode: disc,
          page: page && page > 1 ? page : undefined,
        };
      }
    }
  }

  // ----- O FOCO DO DIA: uma recomendação só, na ordem da inteligência -----
  // 1) avaliação oficial à frente COM DOSE POR TIPO (Mensagem 7 do dono —
  //    "lembra das matérias que mandei priorizar... RHT é atividade/discursiva"):
  //    prova = o ciclo real do semestre → foca até D-14 (prática dirigida cedo,
  //    ensaio na reta final D-7); atividade = véspera real (≤3d); trabalho
  //    datado = última semana (≤7d). Atividade de sala D-5 NÃO toma a casa —
  //    ela vive na fila (triagem), no radar e no cronograma;
  // 2) fila de revisão vencida (≥5 cartões) — recall ativo vale mais;
  // 3) caderno de erros pesando (≥3 em aberto) — re-teste, não punição;
  // 4) continuar de onde parou — o hábito mora no retomar;
  // 5) o método — ler com o tutor ao lado.
  const heroEval = allEvals.find((e) =>
    e.kind === 'prova'
      ? e.daysLeft <= 14
      : e.kind === 'atividade'
        ? e.daysLeft <= 3
        : e.daysLeft <= 7,
  );
  let focus: TodayFocus;
  if (heroEval) {
    const label = EVAL_KIND_LABEL[heroEval.kind].toLowerCase();
    if (heroEval.kind === 'prova' && heroEval.daysLeft > 7) {
      // Prova longe (D-8..D-14): PRÁTICA dirigida agora, ensaio depois —
      // a mesma escada do cronograma (prática dirigida → revisão na reta).
      focus = {
        kind: 'exam',
        title: `Comece a lista da prova de ${heroEval.disciplineShort}`,
        body: `A ${heroEval.name} é em ${heroEval.daysLeft} dias. Prática dirigida agora mostra o que falta antes da reta final — o ensaio com cronômetro entra a D-7.`,
        cta: 'Ir para Praticar',
        disciplineCode: heroEval.disciplineCode,
        open: 'pratica',
      };
    } else {
      focus = {
        kind: 'exam',
        title: `Ensaie a ${label} de ${heroEval.disciplineShort}`,
        body:
          heroEval.daysLeft === 0
            ? `A ${heroEval.name} é hoje. O ensaio com cronômetro acerta o pacing antes da hora real.`
            : `${EVAL_KIND_LABEL[heroEval.kind]} em ${heroEval.daysLeft} ${heroEval.daysLeft === 1 ? 'dia' : 'dias'} (${heroEval.name}). O ensaio com cronômetro mostra exatamente o que falta.`,
        cta: 'Começar o ensaio',
        disciplineCode: heroEval.disciplineCode,
        open: 'simulado',
        // t241 — na reta final da prova de Algoritmos, o ensaio é o trio real:
        // 1 fácil + 1 média + 1 difícil do pool das Semanas 1–7 (refaz semanal).
        ...(heroEval.disciplineCode === 'TEC.1687' && heroEval.kind === 'prova'
          ? { simuladoPreset: 'alg_prova1' as const }
          : {}),
      };
    }
  } else if (cardsDue >= 5) {
    focus = {
      kind: 'review',
      title: 'Zere a fila de revisão',
      body: `${cardsDue} cartões venceram. Dez minutos de recall ativo valem mais do que uma hora relendo — e limpa a fila antes que ela assuste.`,
      cta: 'Revisar agora',
    };
  } else if (openMistakes >= 3) {
    focus = {
      kind: 'mistake',
      title: 'Enfrente o Caderno de Erros',
      body: `${openMistakes} erros em aberto esperando re-teste. Errar uma vez é dado; resolver de cabeça é virada — e o caderno aponta quais são recorrentes.`,
      cta: 'Abrir o caderno',
    };
  } else if (resume) {
    focus = {
      kind: 'resume',
      title: 'Continue de onde parou',
      body: resume.page
        ? `${resume.title} — você parou na página ${resume.page}. O tutor abre do lado e lê com você.`
        : `${resume.title}. O tutor abre do lado e lê com você.`,
      cta: 'Continuar',
      materialId: resume.materialId,
      disciplineCode: resume.disciplineCode,
    };
  } else {
    focus = {
      kind: 'start',
      title: 'Leia com o tutor ao lado',
      body: 'Abra o PDF da aula em tela dividida: o texto de um lado, o tutor do outro. Pergunte qualquer coisa — ele lê o material com você.',
      cta: 'Estudar',
    };
  }

  return {
    minutesToday,
    activeDays30,
    streakDays,
    accuracyPct,
    cardsDue,
    openMistakes,
    plannedHours: sp.dailyHours?.[todayKey] ?? null,
    nextExam,
    nextDeadline,
    focusEval: heroEval
      ? {
          name: heroEval.name,
          kindLabel: EVAL_KIND_LABEL[heroEval.kind],
          daysLeft: heroEval.daysLeft,
          disciplineShort: heroEval.disciplineShort,
          disciplineCode: heroEval.disciplineCode,
        }
      : null,
    resume,
    focus,
  };
}

// ----------------------------------------------------------------------------
// DETALHE DO ACOMPANHAMENTO (frente C — o espelho por trás da linha do retrato)
// Mesmo princípio do snapshot: nada é lançado à mão; tudo nasce do uso diário.
// O painel expansível da home consome isto — sem placar, sem medalha (lição
// da t180): um espelho honesto de HOJE, da SEMANA e das filas em aberto.
// ----------------------------------------------------------------------------

export interface TrackingDetail {
  today: {
    minutes: number;
    questionsTried: number;
    questionsSolved: number;
    cardsReviewed: number;
    cardsCreated: number;
    materialsOpened: number;
  };
  /** Últimos 7 dias, do mais antigo ao hoje (pomodoro é a fonte do foco). */
  week: { key: string; label: string; minutes: number; isToday: boolean }[];
  weekMinutes: number;
  weekActiveDays: number;
  /** Onde o foco foi parar nos últimos 7 dias (top disciplinas por minutos). */
  perDiscipline: { code: string; name: string; minutes: number; pct: number; color: string }[];
}

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

export function buildTrackingDetail(sp: StudyProgress, now: Date): TrackingDetail {
  const todayKey = todayDateKey(now);

  // ----- a semana: minutos de foco por dia (pomodoro) -----
  const byDate = new Map<string, number>();
  for (const s of sp.pomodoroSessions ?? []) {
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + (s.focusMinutes || 0));
  }
  const week: TrackingDetail['week'] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = todayDateKey(d);
    week.push({
      key,
      label: WEEKDAY_SHORT[d.getDay()],
      minutes: byDate.get(key) ?? 0,
      isToday: i === 0,
    });
  }
  const weekMinutes = week.reduce((acc, d) => acc + d.minutes, 0);
  const weekActiveDays = week.filter((d) => d.minutes > 0).length;

  // ----- hoje: o que o uso já registrou até agora -----
  const isoIsToday = (iso?: string): boolean => {
    if (!iso) return false;
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && todayDateKey(d) === todayKey;
  };
  let questionsTried = 0;
  let questionsSolved = 0;
  for (const e of Object.values(sp.exerciseProgress ?? {})) {
    if (!isoIsToday(e.lastPracticedAt)) continue;
    questionsTried += 1;
    if (e.solved) questionsSolved += 1;
  }
  let cardsReviewed = 0;
  let cardsCreated = 0;
  for (const c of sp.flashcards ?? []) {
    if (isoIsToday(c.lastReviewedAt)) cardsReviewed += 1;
    if (isoIsToday(c.createdAt)) cardsCreated += 1;
  }
  const materialsOpened = new Set(
    (sp.recentMaterials ?? []).filter((m) => isoIsToday(m.accessedAt)).map((m) => m.id),
  ).size;

  // ----- onde foi o tempo: foco por disciplina nos últimos 7 dias -----
  const weekKeys = new Set(week.map((d) => d.key));
  const byDiscipline = new Map<string, number>();
  for (const s of sp.pomodoroSessions ?? []) {
    if (!weekKeys.has(s.date) || !(s.focusMinutes > 0)) continue;
    byDiscipline.set(s.disciplineId, (byDiscipline.get(s.disciplineId) ?? 0) + s.focusMinutes);
  }
  const perDiscipline = [...byDiscipline.entries()]
    .map(([code, minutes]) => {
      const disc = disciplines.find((d) => d.code === code);
      return {
        code,
        name: disc?.name ?? code,
        minutes,
        pct: weekMinutes > 0 ? Math.round((minutes / weekMinutes) * 100) : 0,
        color: disc?.color ?? 'slate',
      };
    })
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 4);

  return {
    today: {
      minutes: byDate.get(todayKey) ?? 0,
      questionsTried,
      questionsSolved,
      cardsReviewed,
      cardsCreated,
      materialsOpened,
    },
    week,
    weekMinutes,
    weekActiveDays,
    perDiscipline,
  };
}
