'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Cpu,
  ExternalLink,
  ArrowUpRight,
  FileText,
  Flame,
  Lightbulb,
  Sparkles,
  ChevronRight,
  CalendarCheck,
  CalendarClock,
  CircleCheck,
  Layers,
  Sun,
  Target,
  Sprout,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  course,
  disciplines,
  materials,
  evaluationPeriods,
  getDisciplineByCode,
} from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { flashcardsDueFor, useStudyProgress } from '@/lib/study-progress';
import { countTotalTopicsDone } from '@/lib/study-topics';
import {
  activityBadgeFor,
  disciplineActivityFor,
} from '@/lib/discipline-activity';
import { DisciplineDetailDialog } from './discipline-detail-dialog';
import { MaterialSummaryDialog } from './material-summary-dialog';
import type { Discipline, Material } from '@/data/course-data';
import { studyStrategy } from '@/data/course-data';
import { TodayStudyCard } from './today-study-card';
import { useNow } from './clock-widget';
import { ExamPrepCard } from './exam-prep-card';
import { RecoveryCard } from './recovery-card';
import { SemesterProjection } from './semester-projection';
import {
  daysUntilDate,
  currentWeekOfSemester,
  semesterProgressPct,
  upcomingEvents,
  getNextEvaluation as getNextEvaluationShared,
} from '@/lib/semester';
import {
  MATH_EXAM,
  MATH_SIMULADO_DATE,
  findMathSimuladoRunOficial,
} from '@/lib/math-exam-prep';
import { openSimulado, openTutor } from '@/lib/hub-events';
import { buildRunDebriefQuestion } from '@/lib/simulado-debrief';

interface Props {
  onStartStudy?: (disciplineCode?: string, materialId?: string) => void;
  onOpenSchedule?: () => void;
  onOpenLibrary?: () => void;
  onOpenPractice?: () => void;
}

export function Dashboard({ onStartStudy, onOpenSchedule, onOpenLibrary, onOpenPractice }: Props) {
  const sp = useStudyProgress();
  const [selected, setSelected] = React.useState<Discipline | null>(null);
  const [open, setOpen] = React.useState(false);
  const [recentMaterial, setRecentMaterial] = React.useState<Material | null>(null);
  const [recentOpen, setRecentOpen] = React.useState(false);

  // Próximas 3 avaliações (só no cliente — APENAS datas oficiais; sem estimativas).
  // VIVA (115): recalcula a cada tick do useNow — a tab aberta na virada do
  // dia não dorme no relógio (antes: mount-once, o '3d' virava mentira à
  // meia-noite até um reload).
  const nowMin = useNow(60_000);
  const upcoming = React.useMemo(() => {
    if (!nowMin) return [] as typeof evaluationPeriods;
    return [...evaluationPeriods]
      .filter((e) => !e.conditional && e.date)
      .filter((e) => daysUntilDate(e.date as string, nowMin) >= 0)
      .sort((a, b) => daysUntilDate(a.date as string, nowMin) - daysUntilDate(b.date as string, nowMin))
      .slice(0, 3);
  }, [nowMin]);

  // Próxima avaliação em destaque (só no cliente) — o TICK ÚNICO (113):
  // o useNow alimenta o hero; o setInterval próprio do dashboard saiu
  // (a árvore inteira já re-renderizava a cada 60s — agora com UMA fonte).
  const nextEval = React.useMemo(
    () => (nowMin ? getNextEvaluationShared(nowMin) : null),
    [nowMin],
  );

  // O LEITNER TAMBÉM NÃO DORME (116): a chamada de revisão espaçada lê o
  // seletor PURO com o agora do tick de 60s — a linha aparece sozinha quando
  // um cartão vence com a tab aberta (antes: memo do hook cacheava o relógio,
  // o 'cartões esperando' só nascia num reload ou noutra mutação).
  const flashDue = nowMin
    ? flashcardsDueFor(sp.allFlashcards, nowMin.getTime()).length
    : 0;

  // O run do simulado oficial (29/09) — mesma fonte única do card da prova
  // (85): se o dia do simulado já aconteceu com prova registrada, o chip do
  // hero vira "feito ✓" em vez de convidar de novo. Render-time via memo:
  // reage a runs novas no mesmo re-render (storage event).
  const simuladoRunOficial = React.useMemo(
    () => findMathSimuladoRunOficial(sp.progress.simuladoRuns),
    [sp.progress.simuladoRuns],
  );

  // Recentes (enriquecidos com accessedAt — evita find() dentro do render)
  const recentMaterials = React.useMemo(() => {
    return sp.progress.recentMaterials
      .slice(0, 3)
      .map((r) => {
        const material = materials.find((m) => m.id === r.id);
        return material ? { material, accessedAt: r.accessedAt } : null;
      })
      .filter((x): x is { material: Material; accessedAt: string } => x !== null);
  }, [sp.progress.recentMaterials]);

  // Dica do dia rotativa (baseada no dia do mês - determinística por dia)
  const dailyTip = React.useMemo(() => {
    const all = disciplines.flatMap((d) =>
      d.dicasEstudo.map((t) => ({ disc: d, tip: t })),
    );
    const idx = new Date().getDate() % all.length;
    return all[idx];
  }, []);

  function openDiscipline(d: Discipline) {
    setSelected(d);
    setOpen(true);
  }

  // KPIs V3 adicionais
  const totalTopicsDone = countTotalTopicsDone(sp.progress.topicProgress);
  // O FLUXO REAL CONTA (118): disciplinas com atividade nos últimos 7 dias —
  // derivado da MESMA fonte dos cards de avaliação (discipline-activity).
  // Antes: 'Disciplinas em dia' media checkboxes manuais e ficava em 0 para
  // o aluno que aprende abrindo material — ruído que ele aprendeu a ignorar.
  const activeDisciplines = React.useMemo(
    () =>
      disciplines.filter((d) => disciplineActivityFor(d.code, sp.progress)?.emEstudo).length,
    [sp.progress],
  );

  // Linhas derivadas das próximas avaliações (memoizado) — o nowMin entra
  // como chave: virou o dia, a linha recalcula no mesmo frame (lição 79).
  // O PROGRESSO QUE SE REGISTRA SOZINHO (118): a barra e o selo leem a
  // ATIVIDADE REAL (materiais abertos + questões tentadas, fonte única
  // discipline-activity) — não os checkboxes manuais que ninguém marca.
  // Selo honesto: 'em dia' acompanhou o dado · 'em estudo' tem atividade ·
  // 'sem registro' NÃO acusa (o registro é que não existe ainda) — a palavra
  // 'atrasada' saiu do vocabulário do painel.
  const upcomingRows = React.useMemo(() => {
    if (!nowMin) return [];
    const now = nowMin;
    return upcoming.map((e) => {
      const disc = getDisciplineByCode(e.disciplineCode);
      const color = getColorClasses(disc?.color ?? 'slate');
      const daysLeft = e.date ? daysUntilDate(e.date, now) : -1;
      const act = disciplineActivityFor(e.disciplineCode, sp.progress);
      const badge = act ? activityBadgeFor(act) : null;
      const dateLabel = e.date
        ? new Date(`${e.date}T12:00:00`).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          })
        : 'A definir';
      return { e, disc, color, daysLeft, pct: act?.pctAcompanha ?? null, badge, dateLabel };
    });
  }, [upcoming, nowMin, sp.progress]);

  return (
    <div className="space-y-6">
      {/* Hero card com saudação + progresso do semestre + próxima avaliação */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden rounded-2xl border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-card to-teal-50 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/40 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Olá! Bons estudos
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">
                {course.nomeCurto} • Turma {course.semestreAtual}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {course.instituicao} — Campus {course.campus}
              </p>
              {nextEval && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* PROVA (Av1, 01/10) — o chip primário, família âmbar (76) */}
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                      nextEval.daysLeft === 0
                        ? 'border-amber-500 bg-amber-500 shadow-md shadow-amber-500/30 dark:border-amber-400 dark:bg-amber-400'
                        : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/60',
                    )}
                  >
                    <CalendarCheck
                      className={cn(
                        'size-4',
                        nextEval.daysLeft === 0
                          ? 'animate-pulse text-white dark:text-zinc-900'
                          : 'text-amber-600 dark:text-amber-400',
                      )}
                    />
                    <span
                      className={cn(
                        nextEval.daysLeft === 0
                          ? 'font-medium text-white dark:text-zinc-900'
                          : 'text-amber-900 dark:text-amber-200',
                      )}
                    >
                      {nextEval.daysLeft === 0 ? (
                        <>
                          <span className="font-bold">É hoje:</span> {nextEval.name} —{' '}
                          {nextEval.disciplineShort}. Boa prova!
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">
                            {nextEval.daysLeft === 1
                              ? 'Falta 1 dia'
                              : `Faltam ${nextEval.daysLeft} dias`}
                          </span>{' '}
                          para {nextEval.name} — {nextEval.disciplineShort}
                        </>
                      )}
                    </span>
                  </div>

                  {/* SIMULADO (29/09) — o hero conta para o marco MAIS PRÓXIMO
                      também (85): até hoje o topo dizia só "Faltam N dias para
                      a Av1" enquanto o compromisso real da semana era o simulado.
                      Estados honestos: feito ✓ (emerald, correção a 1 clique) /
                      é hoje (sólido, pulso — mesmo tratamento do banner D-0 da
                      76) / amanhã / em N dias. Render-time (lição da 79). */}
                  {(() => {
                    const simuladoDaysLeft = daysUntilDate(MATH_SIMULADO_DATE);
                    // Janela do sprint: o chip nasce a 7 dias do simulado e
                    // sai no dia seguinte — fora dela o hero fica só com a prova.
                    if (simuladoDaysLeft < 0 || simuladoDaysLeft > 7) return null;
                    const simuladoFeito =
                      simuladoDaysLeft === 0 && !!simuladoRunOficial;
                    const marcoData = new Date(
                      `${MATH_SIMULADO_DATE}T12:00:00`,
                    ).toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    });
                    if (simuladoFeito) {
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            simuladoRunOficial &&
                            openTutor({
                              question: buildRunDebriefQuestion(simuladoRunOficial),
                              disciplineCode: MATH_EXAM.disciplineCode,
                            })
                          }
                          className="group inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-sm text-white shadow-md shadow-emerald-600/30 transition-colors hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                          aria-label="Simulado da Av1 de hoje já foi feito — pedir a correção comentada ao tutor"
                        >
                          <CircleCheck className="size-4 shrink-0" aria-hidden />
                          <span className="whitespace-normal text-left leading-snug">
                            Simulado da Av1 <span className="font-bold">feito ✓</span> —
                            pedir a correção
                          </span>
                          <ArrowUpRight
                            className="size-3.5 shrink-0 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => openSimulado({ preset: 'math_exam' })}
                        className={cn(
                          'group inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
                          simuladoDaysLeft === 0
                            ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30 hover:bg-amber-600 dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-900 dark:hover:bg-amber-300'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400',
                        )}
                        aria-label={
                          simuladoDaysLeft === 0
                            ? 'Hoje é o dia do Simulado da Av1 e da entrega S3 de Algoritmos — abrir o simulado'
                            : simuladoDaysLeft === 1
                              ? 'Amanhã é o dia do Simulado da Av1 — abrir o simulado para ensaiar'
                              : `Simulado da Av1 em ${simuladoDaysLeft} dias — abrir o Simulado com o escopo real da prova`
                        }
                      >
                        <CalendarClock
                          className={cn(
                            'size-4 shrink-0',
                            simuladoDaysLeft === 0 && 'animate-pulse',
                          )}
                          aria-hidden
                        />
                        <span className="whitespace-normal text-left leading-snug">
                          {simuladoDaysLeft === 0 ? (
                            <>
                              <span className="font-bold">É hoje:</span> Simulado da Av1 +
                              entrega S3 de Algoritmos
                            </>
                          ) : simuladoDaysLeft === 1 ? (
                            <>
                              Amanhã: <span className="font-semibold">Simulado da Av1</span>{' '}
                              + entrega S3 de Algoritmos
                            </>
                          ) : (
                            <>
                              Simulado da Av1 em {simuladoDaysLeft} dias —{' '}
                              <span className="font-semibold">{marcoData}</span>
                            </>
                          )}
                        </span>
                        <ArrowUpRight
                          className="size-3.5 shrink-0 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>
            <SemesterMiniStats />
          </div>
        </Card>
      </motion.section>

      {/* FOCO: Prova de Matemática (Av1, 01/10) — plano 12 dias material-first */}
      <ExamPrepCard />

      {/* PLANO DE RECUPERAÇÃO — semana atual + fila de prioridades (sem S1 feita, resto pendente) */}
      <RecoveryCard />

      {/* "O que estudar hoje" (card central V3) — inclui o CTA do Protocolo HUB */}
      <TodayStudyCard
        onStartStudy={onStartStudy}
        onOpenSettings={onOpenSchedule}
      />

      {/* Chamada de revisão espaçada — só aparece quando há flashcards vencidos.
          VIVA (116): flashDue lê o relógio do tick — a linha nasce sozinha. */}
      {flashDue > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card className="flex flex-row flex-wrap items-center gap-3 rounded-xl border-l-4 border-l-teal-500 bg-card p-4 shadow-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Layers className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Revisão espaçada — {flashDue}{' '}
                {flashDue === 1 ? 'cartão esperando' : 'cartões esperando'}
              </p>
              <p className="text-xs text-muted-foreground">
                Revisar hoje fixa o conteúdo na memória de longa duração.
              </p>
            </div>
            <Button
              size="sm"
              onClick={onOpenPractice}
              className="bg-teal-600 text-white hover:bg-teal-700"
              aria-label={`Abrir revisão de ${flashDue} flashcards`}
            >
              Revisar agora <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </Card>
        </motion.section>
      )}

      {/* KPIs (4 + 2 novos) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-7">
        <KpiCard
          label="Disciplinas"
          value={disciplines.length}
          icon={<BookOpen className="size-4" />}
          color="emerald"
        />
        <KpiCard
          label="Materiais"
          value={materials.length}
          icon={<FileText className="size-4" />}
          color="orange"
        />
        <KpiCard
          label="Pomodoros hoje"
          value={sp.sessionsToday.length}
          icon={<Flame className="size-4" />}
          color="rose"
          hint={`Meta: ${sp.progress.preferences.dailyGoal}`}
        />
        <KpiCard
          label="Minutos hoje"
          value={sp.minutesToday}
          icon={<Clock3 className="size-4" />}
          color="violet"
        />
        <KpiCard
          label="Tópicos concluídos"
          value={totalTopicsDone}
          icon={<CheckCircle2 className="size-4" />}
          color="teal"
          hint="marcados por você na aba Estudo"
        />
        <KpiCard
          label="Disciplinas ativas"
          value={activeDisciplines}
          icon={<Layers className="size-4" />}
          color="amber"
          hint="atividade nos últimos 7 dias"
        />
        <KpiCard
          label="Streak"
          value={sp.studyStreak}
          pulse={sp.studyStreak > 0}
          icon={<Zap className="size-4" />}
          color="amber"
          hint={sp.studyStreak > 0 ? (sp.studyStreak === 1 ? 'dia seguido' : 'dias seguidos 🔥') : 'estude hoje!'}
        />
      </section>

      {/* Próximas 3 avaliações (com countdown real + status) */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4 text-amber-500" /> Próximas avaliações (datas oficiais)
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {upcoming.length === 0 ? (
            <Card className="flex items-center gap-2.5 rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground sm:col-span-3">
              <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Nenhuma data oficial à frente. As avaliações entram aqui assim que os professores divulgarem.
              </span>
            </Card>
          ) : (
            upcomingRows.map(({ e, disc, color, daysLeft, pct, badge, dateLabel }) => {
              return (
                <Card
                  key={`${e.disciplineCode}-${e.evaluationName}-${e.date ?? 'adefinir'}`}
                  data-eval-row={`${e.disciplineCode}-${e.evaluationName}`}
                  className={cn(
                    'rounded-xl border-l-4 bg-card p-3 shadow-sm',
                    color.border,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-md',
                        color.bgSoft,
                        color.text,
                      )}
                    >
                      <DisciplineIcon name={disc?.icon ?? 'BookOpen'} className="size-3.5" />
                    </span>
                    {/* A MESMA RAMPA da agenda acadêmica (114): prova HOJE =
                        sólido amber + pulso (o 'É hoje' do header), a ≤2d = o
                        tom do 'amanhã', longe = a identidade da disciplina —
                        a fileira de avaliações e a agenda falam a mesma língua. */}
                    {(() => {
                      const urgHoje = daysLeft === 0;
                      const urgPerto = daysLeft > 0 && daysLeft <= 2;
                      return (
                        <Badge
                          variant="outline"
                          className={cn(
                            'ml-auto border text-[11px] tabular-nums',
                            urgHoje
                              ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30 dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-900'
                              : urgPerto
                                ? 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-300'
                                : color.badge,
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex',
                              urgHoje && 'animate-pulse',
                            )}
                          >
                            <CalendarCheck className="size-3" aria-hidden />
                          </span>
                          {urgHoje ? 'hoje' : `${daysLeft}d`}
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className={cn('mt-2 text-[11px] font-medium uppercase tracking-wide', color.text)}>
                    {disc?.shortName} • {dateLabel}
                  </p>
                  <p className="text-sm font-semibold leading-tight">{e.evaluationName}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {e.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {/* A barra mede ACOMPANHAMENTO DO DADO (118): do conteúdo dado
                        em aula, o quanto já foi tocado pela atividade real.
                        Só some quando NADA foi dado (régua inexistente) — com
                        conteúdo dado e zero atividade, 0% + 'sem registro' é
                        honesto e aponta o caminho sem acusar. */}
                    {pct !== null && (
                      <div
                        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={`Acompanha ${pct}% do conteúdo dado em aula`}
                      >
                        <div
                          className={cn('h-full rounded-full', color.bgSolid)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {/* Selo honesto (118): em dia = acompanhou o dado (emerald);
                        em estudo = tem atividade sua (a família da espera, amber,
                        sem pulso — não é prazo); sem registro = neutro, SEM
                        acusação — a palavra 'atrasada' saiu do painel. */}
                    {badge && (
                      <Badge
                        variant="outline"
                        title={badge.title}
                        className={cn(
                          'shrink-0 border text-[9px]',
                          badge.tone === 'dia' &&
                            'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
                          badge.tone === 'estudo' &&
                            'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-300',
                          badge.tone === 'registro' &&
                            'border-white/10 bg-muted text-muted-foreground',
                        )}
                      >
                        {badge.label}
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Prévia do semestre (V3) */}
      <SemesterProjection />

      {/* Acesso rápido às disciplinas (scroll horizontal) */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <BookOpen className="size-4 text-emerald-500" /> Acesso rápido
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {disciplines.map((d) => {
            const color = getColorClasses(d.color);
            return (
              <button
                key={d.code}
                onClick={() => openDiscipline(d)}
                className="min-w-[200px] shrink-0 text-left"
              >
                <Card
                  className={cn(
                    'flex-row items-center gap-3 rounded-lg border-l-4 bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
                    color.border,
                  )}
                >
                  <div
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-md',
                      color.bgSoft,
                      color.text,
                    )}
                  >
                    <DisciplineIcon name={d.icon} className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.shortName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.chTotal}h • {d.professor.split(' ')[0]}
                    </p>
                  </div>
                  <ChevronRight className={cn('size-4 shrink-0', color.text)} />
                </Card>
              </button>
            );
          })}
        </div>
      </section>

      {/* Lembrete PNAAT (FIT Tecnologia) — apenas o lembrete/link de estudo;
          o progresso das trilhas NÃO é acompanhado aqui (plataforma oficial é a FIT). */}
      <Card className="flex flex-col gap-3 rounded-xl border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50 via-card to-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:from-rose-950/40 dark:via-card dark:to-amber-950/30">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <Cpu className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Lembrete: trilhas PNAAT (IoT &amp; Edge AI)
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              O progresso é acompanhado na plataforma oficial FIT — aqui você só recebe o
              lembrete de estudar lá. Quer aviso na sua agenda? Adicione um bloco
              &quot;PNAAT&quot; no Cronograma.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            className="h-11 bg-rose-600 text-white hover:bg-rose-700 sm:h-8"
          >
            <a
              href="https://fit-tecnologia.org.br/ava/local/customcourses/index.php"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" /> Abrir plataforma
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-11 sm:h-8">
            <a href="/pdfs/PNAAT-Meus-cursos.pdf" target="_blank" rel="noreferrer">
              <FileText className="size-3.5" /> Ver PDF
            </a>
          </Button>
        </div>
      </Card>

      {/* Recentes + dica do dia — min-w-0 evita que textos nowrap (truncate)
          das linhas da agenda forcem o track do grid a estourar no mobile */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="min-w-0 space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <CalendarCheck className="size-4 text-teal-500" /> Agenda acadêmica oficial
          </h3>
          <AcademicAgenda />
        </section>

        <section className="min-w-0 space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-teal-500" /> Recentes
          </h3>
          {recentMaterials.length === 0 ? (
            <Card className="flex items-center gap-2.5 rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
              <FileText className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Nenhum material acessado ainda. Explore a aba &quot;Resumos IA&quot; ou &quot;Disciplinas&quot;.
              </span>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentMaterials.map(({ material: m, accessedAt }) => {
                const disc = getDisciplineByCode(m.disciplineCode);
                const color = getColorClasses(disc?.color ?? 'slate');
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setRecentMaterial(m);
                      setRecentOpen(true);
                    }}
                    className="block w-full text-left"
                  >
                    <Card
                      className={cn(
                        'rounded-lg border-l-4 bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
                        color.border,
                      )}
                    >
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      {/* tabular-nums: a gramática de números da casa — o
                          timestamp é dado, não texto corrido (a mesma régua
                          dos badges de data da fila de avaliações). */}
                      <p className={cn('mt-0.5 text-[11px] tabular-nums', color.text)}>
                        {disc?.shortName} • {new Date(accessedAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </p>
                    </Card>
                  </button>
                );
              })}
              {/* O RECIBO QUE EXPLICA (127): o dono (28/09) não entendia 'em que
                  momento marco ou como o site acompanha meu progresso' — a 118
                  fez o fluxo registrar sozinho, mas a lista dos acessos não dizia
                  O QUE eles fazem. Uma linha didática na própria lista fecha o
                  loop: a entrada é a prova, a linha é a lição. */}
              <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                Abrir um material registra o estudo da disciplina — o painel e o
                progresso por disciplina acompanham sozinhos.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Target className="size-4 text-emerald-500" /> Estratégia de estudo
          </h3>
          <Card className="rounded-xl border-l-4 border-l-emerald-500 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{studyStrategy.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{studyStrategy.description}</p>
              </div>
              <Badge variant="outline" className="shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                80/20
              </Badge>
            </div>
            <ul className="mt-3 grid gap-1.5 text-xs text-foreground/80 sm:grid-cols-2">
              {studyStrategy.rules.slice(0, 6).map((rule, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" aria-hidden />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {studyStrategy.rules.length - 6} regras completas na aba Estudar e no material do curso.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Lightbulb className="size-4 text-amber-500" /> Dica do dia
          </h3>
          {dailyTip && (
            <Card className="rounded-xl border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 via-card to-orange-50 p-4 shadow-sm dark:from-amber-950/40 dark:via-card dark:to-orange-950/30">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                  )}
                >
                  <Lightbulb className="size-4" />
                </div>
                <div>
                  <p className={cn('text-xs font-semibold text-amber-700 dark:text-amber-300')}>
                    {dailyTip.disc.shortName}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground/85">{dailyTip.tip}</p>
                </div>
              </div>
            </Card>
          )}
        </section>
      </div>

      <DisciplineDetailDialog
        discipline={selected}
        open={open}
        onOpenChange={setOpen}
      />
      <MaterialSummaryDialog
        material={recentMaterial}
        open={recentOpen}
        onOpenChange={setRecentOpen}
      />
    </div>
  );
}

/** Mini-stats do semestre no hero — substitui o relógio duplicado. */
function SemesterMiniStats() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const week = mounted ? currentWeekOfSemester() : 0;
  const pct = mounted ? semesterProgressPct() : 0;

  return (
    <div className="w-full shrink-0 rounded-xl border border-border bg-card/80 p-4 sm:w-56">
      <p className="text-xs font-medium text-muted-foreground">
        Calendário oficial 2026.2
      </p>
      <p className="mt-1 text-2xl font-bold leading-none tabular-nums">
        {week > 0 ? `Semana ${week}` : '—'}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {mounted
          ? `24/08/2026 → 30/01/2027 • ~${pct}% concluído`
          : '24/08/2026 → 30/01/2027'}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const EVENT_STYLES: Record<
  string,
  { badge: string; icon: React.ReactNode }
> = {
  feriado: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300',
    icon: <Sun className="size-3.5" />,
  },
  letivo: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
    icon: <CheckCircle2 className="size-3.5" />,
  },
  prazo: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
    icon: <Target className="size-3.5" />,
  },
  evento: {
    badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300',
    icon: <Sparkles className="size-3.5" />,
  },
  pausa: {
    badge: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300',
    icon: <CalendarCheck className="size-3.5" />,
  },
  provas: {
    badge: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300',
    icon: <CalendarCheck className="size-3.5" />,
  },
};

/** Agenda acadêmica real (fonte: calendário oficial IFPB Cajazeiras 2026). */
function AcademicAgenda() {
  // VIVA (115): o useNow alimenta a lista — a tab aberta na virada do dia
  // flipa 'em 2d' → 'em 1d' → 'hoje' sem reload (antes: mount-once, o badge
  // mentia até o próximo refresh da página).
  const nowTick = useNow(60_000);
  const events = React.useMemo(
    () => (nowTick ? upcomingEvents(nowTick, 4) : []),
    [nowTick],
  );

  if (events.length === 0) {
    return (
      <Card className="flex items-center gap-2.5 rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
        <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
        <span>Nenhum evento acadêmico próximo. Confira o calendário oficial do campus.</span>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((ev) => {
        const style = EVENT_STYLES[ev.kind] ?? EVENT_STYLES.evento;
        const d = new Date(`${ev.date}T12:00:00`);
        const dayLabel = d.getDate().toString().padStart(2, '0');
        const monthLabel = d
          .toLocaleDateString('pt-BR', { month: 'short' })
          .replace('.', '')
          .toUpperCase();
        // A casa nomeia o dia da semana em toda superfície de calendário
        // (Agenda 'Seg', mapa 'Dom', strip) — a caixa de data da agenda não
        // podia ser a exceção: TER em cima do número.
        const weekdayLabel = d
          .toLocaleDateString('pt-BR', { weekday: 'short' })
          .replace('.', '')
          .toUpperCase();
        // Rampa de urgência SÓ para prazos (feriado 'hoje' não é urgência):
        // mesma família do badge do header — hoje = sólido amber + pulso,
        // a ≤2d = o tom do 'amanhã' do header, longe = a identidade do kind.
        // NO DIA do prazo o upcomingEvents marca ongoing=true (hoje ∈
        // [start,end]) — mas prazo de UM dia 'em andamento' É o 'hoje' da
        // casa: o sólido amber vence o 'agora' genérico (a janela em curso
        // de vários dias, tipo matrícula, continua no tom do kind).
        const singleDayPrazo =
          ev.kind === 'prazo' && (!ev.endDate || ev.endDate === ev.date);
        const urgHoje = singleDayPrazo && ev.daysLeft === 0;
        const urgPerto =
          ev.kind === 'prazo' && !ev.ongoing && ev.daysLeft > 0 && ev.daysLeft <= 2;
        const badgeCls = urgHoje
          ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30 dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-900'
          : urgPerto
            ? 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-300'
            : style.badge;
        return (
          <Card
            key={`${ev.date}-${ev.title}`}
            className={cn(
              'flex-row items-center gap-3 rounded-xl border p-3 shadow-sm',
              // O anel do dia segue a família do marco (amber), não o 'agora'
              // genérico — mesma gramática dos dias-marco da Agenda (96).
              urgHoje && 'ring-2 ring-amber-500/40',
              ev.ongoing && !urgHoje && 'ring-2 ring-emerald-500/40',
            )}
          >
            <div
              className={cn(
                'grid w-12 shrink-0 place-items-center rounded-lg py-1.5',
                urgHoje ? 'bg-amber-500/15' : ev.ongoing ? 'bg-emerald-500/15' : 'bg-muted/60',
              )}
            >
              <span className="text-[9px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
                {weekdayLabel}
              </span>
              <span className="mt-0.5 text-sm font-bold leading-none tabular-nums">{dayLabel}</span>
              <span className="mt-0.5 text-[10px] uppercase leading-none text-muted-foreground">
                {monthLabel}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ev.title}</p>
              {ev.description && (
                <p className="truncate text-[11px] text-muted-foreground">{ev.description}</p>
              )}
            </div>
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 gap-1 border tabular-nums text-[10px]',
                badgeCls,
                urgHoje && 'font-semibold',
              )}
            >
              <span className={cn('inline-flex', urgHoje && 'animate-pulse')}>{style.icon}</span>
              {urgHoje
                ? 'hoje'
                : ev.ongoing
                  ? 'agora'
                  : ev.daysLeft === 0
                    ? 'hoje'
                    : `em ${ev.daysLeft}d`}
            </Badge>
          </Card>
        );
      })}
      <p className="px-1 text-[11px] text-muted-foreground">
        Fonte: Calendário Acadêmico IFPB Cajazeiras 2026 — inclui feriados, sábados letivos e a pausa 18/12 → 18/01.
      </p>
    </div>
  );
}

/** Paleta dos KPIs — constante de módulo (não recriada a cada render). */
const KPI_COLORS = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-950', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
} as const;

function KpiCard({
  label,
  value,
  icon,
  color,
  hint,
  pulse = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: keyof typeof KPI_COLORS;
  hint?: string;
  pulse?: boolean;
}) {
  const c = KPI_COLORS[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="rounded-xl bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/5">
        <div className="flex items-center justify-between">
          <span className={cn('grid size-8 place-items-center rounded-lg', c.bg, c.text)}>
            {icon}
          </span>
          <span className={cn('size-2 rounded-full', c.dot, pulse && 'animate-pulse')} />
        </div>
        <p className="mt-3 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs font-medium text-foreground/80">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </Card>
    </motion.div>
  );
}
