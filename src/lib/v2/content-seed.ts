// Semente de conteúdo v2 — Fase 1 (Alicerce).
// Lê o acervo atual (course-data + exercise-extractor + math-exam-prep + calendário)
// e popula o núcleo novo com UPSERTS DETERMINÍSTICOS (ids naturais):
// rodar 2× produz exatamente as mesmas linhas — zero duplicação.
//
// Mapa (Fase 0, seção 4): disciplinas → Subject · unidades do PPC → Topic (grafo
// linear semente) · 98 exercícios → PracticeUnit('question') · 55 materiais →
// BacklogItem (listas já extraídas nascem 'converted') · provas/entregas → Exam ·
// ROTINA FIXA do dono → RoutineConfig (o app nunca viola).

import {
  calendarEvents,
  disciplines,
  materials,
  type Discipline,
} from '@/data/course-data';
import { exercises } from '@/lib/exercise-extractor';
import { MATH_EXAM } from '@/lib/math-exam-prep';
import {
  slug,
  type BacklogItem,
  type DayTemplateId,
  type Exam,
  type ExamKind,
  type PracticeUnit,
  type RoutineBlock,
  type RoutineConfig,
  type RoutineTemplate,
  type Subject,
  type Topic,
  type UnitType,
} from './domain';
import { getDb } from './store';

// ---------- helpers ----------

const DIFFICULTY_MAP: Record<string, 1 | 2 | 3> = {
  facil: 1,
  medio: 2,
  dificil: 3,
};

/** Chave tolerante de tópico: tira acentos, prefixo "Unidade N:" e números iniciais. */
function topicKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^unidade\s*\d+\s*:\s*/, '')
    .replace(/^\d+\s*[.º-]\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function suggestedTypeForMaterial(type: string): UnitType {
  if (type === 'lista_exercicios' || type === 'exemplo') return 'kata';
  return 'question'; // conceito → questão (regra do dono)
}

// ---------- builders ----------

export function buildSubjects(): Subject[] {
  return disciplines.map((d: Discipline) => ({
    id: d.code,
    name: d.name,
    shortName: d.shortName,
    chTotal: d.chTotal,
    chWeekly: d.chWeekly,
    professor: d.professor ?? '',
    category: d.category as Subject['category'],
    color: d.color ?? 'slate',
    priority: (d.prioridade ?? 'media') as Subject['priority'],
  }));
}

export function buildTopics(): Topic[] {
  const topics: Topic[] = [];
  for (const d of disciplines) {
    const units = d.conteudoProgramatico ?? [];
    const chain: string[] = [];
    units.forEach((u, i) => {
      const id = `${d.code}::${slug(u.unidade)}`;
      topics.push({
        id,
        subjectId: d.code,
        name: u.unidade,
        subtopics: [...(u.topicos ?? [])],
        // semente: cadeia linear do PPC (a unidade anterior é pré-requisito)
        prereqIds: chain.length ? [chain[chain.length - 1]] : [],
        order: i,
      });
      chain.push(id);
    });
  }
  return topics;
}

/** Tópicos automáticos p/ exercícios cujo `unit` não casa com o PPC (nada se perde). */
export function buildAutoTopics(topics: Topic[], units: PracticeUnit[]): Topic[] {
  const known = new Map<string, Topic>();
  for (const t of topics) known.set(topicKey(t.name), t);
  const auto: Topic[] = [];
  for (const u of units) {
    if (!u.topicId) continue;
    // topicId de unidade auto já veio como `${code}::x-${slug(unit)}`
    if (!u.topicId.includes('::x-')) continue;
    if (known.has(u.topicId)) continue;
    const name = u.topicId.split('::x-')[1] ?? u.topicId;
    auto.push({
      id: u.topicId,
      subjectId: u.subjectId,
      name: name.replace(/-/g, ' '),
      subtopics: [],
      prereqIds: [],
      order: 1000 + auto.length,
    });
    known.set(u.topicId, auto[auto.length - 1]);
  }
  return auto;
}

export function buildUnits(): PracticeUnit[] {
  const allTopics = buildTopics();
  const byKey = new Map<string, Topic>();
  for (const t of allTopics) byKey.set(topicKey(t.name), t);

  const now = Date.now();
  const units: PracticeUnit[] = exercises.map((ex) => {
    // resolução de tópico: chave exata ou continência (ambas as direções)
    let topicId: string | null = null;
    const exKey = ex.unit ? topicKey(ex.unit) : '';
    if (exKey) {
      for (const [key, t] of byKey) {
        if (key === exKey || key.includes(exKey) || exKey.includes(key)) {
          if (t.subjectId === ex.disciplineCode) {
            topicId = t.id;
            break;
          }
        }
      }
      if (!topicId) {
        topicId = `${ex.disciplineCode}::x-${slug(ex.unit as string)}`;
      }
    }
    return {
      id: `unit:${ex.id}`,
      subjectId: ex.disciplineCode,
      topicId: topicId ?? null,
      type: 'question',
      prompt: ex.statement,
      hint: ex.hint,
      difficulty: DIFFICULTY_MAP[ex.difficulty] ?? 2,
      source: ex.source,
      linkedMaterials: [...(ex.linkedMaterials ?? [])],
      createdAt: now,
    };
  });
  return units;
}

export function buildBacklog(): BacklogItem[] {
  const units = buildUnits();
  const now = Date.now();
  return materials.map((m) => {
    const converted = units
      .filter(
        (u) => u.id.startsWith('unit:') && m.id && u.linkedMaterials.includes(m.id),
      )
      .map((u) => u.id);
    return {
      id: `bk:${m.id}`,
      subjectId: m.disciplineCode,
      title: m.title,
      kind: m.type,
      sourceRef: {
        materialId: m.id,
        pdfPath: m.pdfPath,
        externalUrl: m.externalUrl,
        summaryFile: m.summaryFile || undefined,
      },
      suggestedType: suggestedTypeForMaterial(m.type),
      status: converted.length > 0 ? 'converted' : 'open',
      convertedUnitIds: converted,
      createdAt: now,
    };
  });
}

export function buildExams(): Exam[] {
  const exams: Exam[] = [
    {
      id: `exam:${MATH_EXAM.disciplineCode}:av1`,
      subjectId: MATH_EXAM.disciplineCode,
      name: `${MATH_EXAM.evaluationName} — ${MATH_EXAM.disciplineName}`,
      kind: 'prova',
      date: MATH_EXAM.date,
      weight: 33.3,
      scope: MATH_EXAM.programa,
      status: 'awaiting', // prova realizada — nota pendente (sem UI de cobrança)
    },
  ];
  const seen = new Set(exams.map((e) => e.id));
  for (const ev of calendarEvents) {
    const isExam = ev.category === 'avaliacao';
    const isDelivery =
      !!ev.relatedDiscipline && /entrega|apresenta/i.test(ev.title);
    if (!isExam && !isDelivery) continue;
    const subjectId = ev.relatedDiscipline ?? 'IFPB';
    const kind: ExamKind = isExam ? 'prova' : 'entrega';
    const id = `exam:${subjectId}:${slug(ev.title)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    exams.push({
      id,
      subjectId,
      name: ev.title,
      kind,
      date: ev.date,
      status: 'awaiting',
    });
  }
  return exams;
}

// ---------- rotina fixa (o app nunca viola) ----------

const b = (
  start: string,
  end: string,
  label: string,
  kind: RoutineBlock['kind'],
  protectedBlock = false,
): RoutineBlock => ({ start, end, label, kind, protected: protectedBlock });

// GRADE REDESENHADA (pedido do dono, out/2026): estudo começa 15:00, lanche da
// tarde EXPLÍCITO, janta/banho mesclados na agenda, 1h de hobby/leitura, dormir
// 22h. Estudo/dia útil = 4h00 (B1 90min + B2 75min + PNAAT 45min + flashcards 30min).
export function buildRoutine(): RoutineConfig {
  const templates: RoutineTemplate[] = [
    {
      id: 'normal-weekday',
      label: 'Dia útil',
      blocks: [
        b('05:00', '07:00', 'Manhã cedo — acordo', 'pessoal'),
        b('07:00', '08:00', 'Merenda fora', 'refeicao'),
        b('08:00', '12:30', 'Aula IFPB — manhã', 'ocupado'),
        b('12:30', '13:30', 'Almoço', 'refeicao'),
        b('13:30', '14:30', 'Descanso protegido — soneca + leitura', 'descanso-protegido', true),
        b('14:30', '15:00', 'Banho + lanche + preparar a mesa', 'pessoal'),
        b('15:00', '16:30', 'Bloco 1 · Ritmo — conteúdo atual, o mais pesado', 'estudo-pesado'),
        b('16:30', '17:00', 'Lanche da tarde + respiro', 'refeicao'),
        b('17:00', '18:15', 'Bloco 2 · Fundação — revisões FSRS intercaladas', 'estudo-revisao'),
        b('18:15', '19:15', 'Livre — hobby, movimento, leitura', 'livre'),
        b('19:15', '20:00', 'Janta + banho', 'refeicao'),
        b('20:00', '20:45', 'PNAAT — bloco fixo, progresso próprio', 'pnaat', true),
        b('20:45', '21:15', 'Flashcards do dia', 'flashcards'),
        b('21:15', '22:00', 'Encerramento — leitura leve, telas off · dormir 22h', 'pessoal'),
      ],
    },
    {
      id: 'game-day',
      label: 'Dia de jogo (máx 3×/semana)',
      blocks: [
        b('05:00', '07:00', 'Manhã cedo — acordo', 'pessoal'),
        b('07:00', '08:00', 'Merenda fora', 'refeicao'),
        b('08:00', '12:30', 'Aula IFPB — manhã', 'ocupado'),
        b('12:30', '13:30', 'Almoço', 'refeicao'),
        b('13:30', '14:30', 'Descanso protegido', 'descanso-protegido', true),
        b('14:30', '15:00', 'Banho + lanche + preparar a mesa', 'pessoal'),
        b('15:00', '16:30', 'Bloco 1 · Ritmo — conteúdo atual, o mais pesado', 'estudo-pesado'),
        b('16:30', '17:00', 'Lanche da tarde + respiro', 'refeicao'),
        b('17:00', '18:15', 'Bloco 2 · Fundação — revisões FSRS', 'estudo-revisao'),
        b('18:15', '19:15', 'Livre — hobby, movimento, leitura', 'livre'),
        b('19:15', '20:00', 'Janta + banho', 'refeicao'),
        b('20:00', '20:45', 'PNAAT — bloco fixo', 'pnaat', true),
        b('20:45', '21:15', 'Flashcards do dia', 'flashcards'),
        b('21:15', '23:59', 'JOGO — protegido como descanso (dormir desliza)', 'jogo'),
      ],
    },
    {
      id: 'next-after-game',
      label: 'Dia seguinte ao jogo',
      blocks: [
        b('05:00', '07:00', 'Manhã cedo — acordo', 'pessoal'),
        b('07:00', '08:00', 'Merenda fora', 'refeicao'),
        b('08:00', '12:30', 'Aula IFPB — manhã', 'ocupado'),
        b('12:30', '13:30', 'Almoço', 'refeicao'),
        b('13:30', '14:10', 'Soneca (40 min)', 'soneca', true),
        b('14:10', '14:30', 'Leitura leve', 'descanso-protegido', true),
        b('14:30', '15:00', 'Banho + lanche + preparar a mesa', 'pessoal'),
        b('15:00', '16:30', 'Bloco 1 · Ritmo — conteúdo atual, o mais pesado', 'estudo-pesado'),
        b('16:30', '17:00', 'Lanche da tarde + respiro', 'refeicao'),
        b('17:00', '18:15', 'Bloco 2 · Fundação — revisões FSRS', 'estudo-revisao'),
        b('18:15', '19:15', 'Livre — hobby, movimento, leitura', 'livre'),
        b('19:15', '20:00', 'Janta + banho', 'refeicao'),
        b('20:00', '20:45', 'Revisão leve — noite pós-jogo', 'estudo-revisao'),
        b('20:45', '21:15', 'Flashcards do dia', 'flashcards'),
        b('21:15', '22:00', 'Encerramento — dormir 22h', 'pessoal'),
      ],
    },
    {
      id: 'saturday',
      label: 'Sábado',
      blocks: [
        b('05:00', '08:00', 'Manhã cedo — acordo', 'pessoal'),
        b('08:00', '12:30', 'Manhã livre', 'livre'),
        b('12:30', '13:30', 'Almoço', 'refeicao'),
        b('13:30', '14:30', 'Descanso protegido', 'descanso-protegido', true),
        b('14:30', '15:00', 'Banho + lanche + preparar a mesa', 'pessoal'),
        b('15:00', '18:00', 'Slot de Projeto real', 'projeto'),
        b('18:00', '19:15', 'Livre — hobby, movimento', 'livre'),
        b('19:15', '20:00', 'Janta + banho', 'refeicao'),
        b('20:00', '20:45', 'PNAAT — bloco fixo', 'pnaat', true),
        b('20:45', '21:15', 'Flashcards do dia', 'flashcards'),
        b('21:15', '23:00', 'Noite livre — jogo possível', 'livre'),
      ],
    },
    {
      id: 'sunday',
      label: 'Domingo',
      blocks: [
        b('05:00', '08:30', 'Manhã cedo — acordo devagar', 'pessoal'),
        b('08:30', '12:30', 'Fundação — bloco longo', 'estudo-pesado'),
        b('12:30', '13:30', 'Almoço', 'refeicao'),
        b('13:30', '14:30', 'Descanso protegido', 'descanso-protegido', true),
        b('14:30', '15:00', 'Banho + lanche', 'pessoal'),
        b('15:00', '19:00', 'Tarde leve — hobby, leitura', 'livre'),
        b('19:15', '20:00', 'Janta + banho', 'refeicao'),
        b('20:00', '20:30', 'Fechamento da semana — flashcards soltos', 'flashcards'),
        b('20:30', '21:30', 'Sprint Review — a semana vira relatório', 'sprint-review'),
        b('21:30', '22:00', 'Encerramento — dormir 22h', 'pessoal'),
      ],
    },
  ];
  const weekMap: Record<number, DayTemplateId> = {
    0: 'sunday',
    1: 'normal-weekday',
    2: 'normal-weekday',
    3: 'normal-weekday',
    4: 'normal-weekday',
    5: 'normal-weekday',
    6: 'saturday',
  };
  return {
    id: 'default',
    templates,
    weekMap,
    gameDaysMaxPerWeek: 3,
    preExamLockDays: 1,
    updatedAt: Date.now(),
  };
}

// ---------- seed principal ----------

export interface SeedCounts {
  subjects: number;
  topics: number;
  units: number;
  backlog: number;
  exams: number;
  routine: number;
}

/** Upsert determinístico de todo o conteúdo. Idempotente por construção. */
export async function seedContent(): Promise<SeedCounts> {
  const db = getDb();
  const subjects = buildSubjects();
  const baseTopics = buildTopics();
  const units = buildUnits();
  const topics = [...baseTopics, ...buildAutoTopics(baseTopics, units)];
  const backlog = buildBacklog();
  const exams = buildExams();
  const routine = buildRoutine();

  await db.transaction(
    'rw',
    [db.subjects, db.topics, db.units, db.backlog, db.exams, db.routine, db.meta],
    async () => {
      await db.subjects.bulkPut(subjects);
      await db.topics.bulkPut(topics);
      await db.units.bulkPut(units);
      await db.backlog.bulkPut(backlog);
      await db.exams.bulkPut(exams);
      // ROTINA: a semente só sobrescreve a grade se o dono NUNCA editou a dele
      // (meta 'routine:userEdited'). Respeita adaptações — a casa não apaga
      // escolha humana por causa de re-migração.
      const editedRoutine = await db.meta.get('routine:userEdited');
      if (!editedRoutine) await db.routine.put(routine);
      await db.meta.put({ key: 'content:seedVersion', value: '2' });
    },
  );

  return {
    subjects: subjects.length,
    topics: topics.length,
    units: units.length,
    backlog: backlog.length,
    exams: exams.length,
    routine: 1,
  };
}
