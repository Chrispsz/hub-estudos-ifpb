// tutor-course-base — A BASE DO CURSO que o servidor do tutor conhece.
//
// DOUTRINA DO CONTEXTO (diretriz do dono, 10/10/2026 — "quanto mais contexto melhor"):
//   · O servidor ABSORVE o curso: instituição, turma, disciplinas, professores,
//     cargas, pesos da grade, calendário oficial. Isto é conhecimento compartilhado
//     da casa — NÃO é dado pessoal. Quanto mais dele, melhor o tutor ensina.
//   · O servidor NUNCA guarda nada pessoal (nome, rotina, chat): o estado vivo do
//     aluno viaja POR CHAMADA (studentContext/hubContext do cliente) e o app v2
//     envia persist:false — a thread de chat dele vive no IndexedDB do dispositivo.
//   · NADA CONGELADO: a dor do dono era o prompt com data de prova que já passou
//     ("o vilão silencioso"). Aqui NADA é texto fixo envelhecendo — tudo é
//     COMPUTADO na hora da chamada: semana atual, dias restantes, avaliações à
//     frente, agenda oficial. O que passou, some sozinho.
//
// Fonte única de verdade: course-data.ts (plano docente/grade) + semester.ts
// (calendário acadêmico oficial). Este módulo é server-safe (dados puros, sem Dexie).

import { course, disciplines, evaluationPeriods } from '@/data/course-data';
import {
  FINAL_EXAM_END,
  FINAL_EXAM_START,
  SEMESTER_END,
  SEMESTER_PAUSE_END,
  SEMESTER_PAUSE_START,
  SEMESTER_START,
  TOTAL_TEACHING_WEEKS,
  currentWeekOfSemester,
  daysUntilDate,
  upcomingEvents,
} from '@/lib/semester';

/** 'YYYY-MM-DD' → 'dd/mm' (dd/mm é como o campus fala). */
function brDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * As próximas avaliações COM DATA OFICIAL dos planos docentes — computadas AGORA.
 * Avaliação com data passada some da lista sozinha; conditional (reposição) não
 * entra como prazo. Nada é estimado: sem data oficial, não aparece.
 */
function nextOfficialEvaluations(now: Date, limit = 5): string[] {
  return evaluationPeriods
    .filter(
      (e): e is typeof e & { date: string } =>
        !e.conditional && typeof e.date === 'string' && e.date.length === 10,
    )
    .map((e) => ({ e, days: daysUntilDate(e.date, now) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, limit)
    .map(({ e, days }) => {
      const disc = disciplines.find((d) => d.code === e.disciplineCode);
      const when = days === 0 ? 'HOJE' : `faltam ${days} dia(s)`;
      return `    • ${e.evaluationName} — ${disc?.shortName ?? e.disciplineCode} · ${brDate(e.date)} (${when}) · ${truncate(e.description, 130)}`;
    });
}

/**
 * A base do curso INTEIRA, pronta para o system prompt (~2.2k chars).
 * Chamada por requisição do /api/tutor — barata (arrays em memória).
 */
export function buildCourseBaseContext(now: Date = new Date()): string {
  const week = currentWeekOfSemester(now);
  const weekLine =
    week > 0
      ? `Semana letiva atual: ${week} de ${TOTAL_TEACHING_WEEKS} (computada agora).`
      : 'Fora do ciclo letivo 2026.2 neste momento (calendário abaixo é a referência).';

  const disciplinaLines = disciplines.map((d) => {
    const grade = d.gradeComponents
      .map((c) => `${c.name} ${Math.round(c.weight)}%`)
      .join(' + ');
    const title = d.professorTitle ? ` (${d.professorTitle})` : '';
    return `    • ${d.shortName} (${d.code}) — prof. ${d.professor}${title} · ${d.chTotal}h (${d.chWeekly}h/sem) · prioridade ${d.prioridade} · nota: ${grade} · escala ${d.scale} · aprovação ≥ ${d.approvalThreshold}`;
  });

  const evaluationLines = nextOfficialEvaluations(now);
  const agendaLines = upcomingEvents(now, 4).map(
    (ev) =>
      `    • ${ev.title} — ${brDate(ev.date)}${ev.endDate ? ` a ${brDate(ev.endDate)}` : ''} (${
        ev.ongoing ? 'em curso' : `faltam ${ev.daysLeft} dia(s)`
      })`,
  );

  const lines: string[] = [
    `Instituição: ${course.instituicao} — Campus ${course.campus}.`,
    `Curso: ${course.nome} (${course.nomeCurto}) — ${course.periodo} (o "2026.2" identifica a TURMA de ingresso — a 2ª do ano — NÃO um período).`,
    `Calendário oficial 2026.2: aulas ${brDate(isoOf(SEMESTER_START))} → ${brDate(isoOf(SEMESTER_END))} · pausa ${brDate(isoOf(SEMESTER_PAUSE_START))} → ${brDate(isoOf(SEMESTER_PAUSE_END))} · provas finais ${brDate(isoOf(FINAL_EXAM_START))}-${brDate(isoOf(FINAL_EXAM_END))}.`,
    weekLine,
    '',
    'Disciplinas do período (plano docente — professores, carga, peso da nota):',
    ...disciplinaLines,
    '',
    'Notas de método (verdades permanentes do dono — nada aqui envelhece):',
    '  • Português Instrumental: o material da aula é FÍSICO (apostila em papel). As imagens que o aluno anexar são as páginas dela — leia-as como material oficial da disciplina; o plano 0576 é a única âncora digital.',
    '  • PNAAT (Programa Nacional de Aprendizado Acelerado em Tecnologia): curso EXTERNO na plataforma FIT (fit-tecnologia.org.br), trilhas de IoT/Edge AI. NÃO é disciplina do IFPB — o hub só lembra de estudar (Ter/Qui) e registra o dia. Bolsas: Intensivo Maker R$1.800/mês · Residência em empresa até R$3.600/mês.',
  ];

  if (evaluationLines.length) {
    lines.push(
      '',
      'Próximas avaliações COM DATA OFICIAL (dos professores — computada agora; datas que já passaram NÃO aparecem):',
      ...evaluationLines,
    );
  }
  if (agendaLines.length) {
    lines.push('', 'Agenda acadêmica do campus (ao vivo):', ...agendaLines);
  }

  lines.push(
    '',
    'Fonte destes dados: planos docentes, Classroom e calendário acadêmico oficial — o app mantém tudo atualizado. Frequência mínima 75% para aprovação. Qualquer prazo/prova deve vir daqui ou do CONTEXTO do app; jamais estime datas que não estejam listadas.',
  );

  return lines.join('\n');
}

/** Date local → 'YYYY-MM-DD' (semester.ts exporta Dates, não ISO). */
function isoOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Versão CURTA (~450 chars) para prompts compactos (flashcards): identidade +
 * professor da disciplina não cabe aqui — só o essencial institucional.
 */
export function buildCourseBaseShort(now: Date = new Date()): string {
  const week = currentWeekOfSemester(now);
  const nextEval = evaluationPeriods
    .filter((e): e is typeof e & { date: string } => !e.conditional && !!e.date)
    .map((e) => ({ e, days: daysUntilDate(e.date, now) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];
  const disc = nextEval
    ? disciplines.find((d) => d.code === nextEval.e.disciplineCode)
    : undefined;
  return [
    `IFPB Campus ${course.campus} · ${course.nomeCurto} · ${course.periodo}.`,
    week > 0 ? `Semana ${week}/${TOTAL_TEACHING_WEEKS} do calendário 2026.2.` : '',
    nextEval
      ? `Próxima avaliação oficial: ${nextEval.e.evaluationName} (${disc?.shortName ?? ''}) em ${brDate(nextEval.e.date)}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}
