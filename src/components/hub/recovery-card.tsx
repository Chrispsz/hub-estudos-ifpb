'use client';

// RecoveryCard — Plano de Recuperação do Painel (22/09/2026).
// Responde ao momento real: Semana 1 de Algoritmos feita (comprovada pelo
// arquivo autoral), resto pendente e prova de Matemática em 01/10. Mostra a
// semana atual do ciclo de questões e a FILA DE PRIORIDADES com ações
// clicáveis. Progresso das ações persiste em localStorage.

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Calculator,
  ChevronDown,
  CircleCheck,
  Clock4,
  CornerDownRight,
  Dumbbell,
  ListRestart,
  Route,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/lib/use-local-storage';
import { useStudyProgress } from '@/lib/study-progress';
import { openMethod, openPractice, openProgress } from '@/lib/hub-events';
import {
  findNotaRealAv1,
  fmtDate,
  getClassWeekInfo,
  matTrackResumoFor,
  matTrackStatusFor,
  RECOVERY_TRACKS,
  todayRecoveryActions,
  TRACK_STATUS_LABEL,
  type TrackStatus,
} from '@/lib/recovery-plan';
import { MATH_EXAM, MATH_META, MATH_SIMULADO_DATE } from '@/lib/math-exam-prep';
import { daysUntilDate } from '@/lib/semester';

const STATUS_STYLE: Record<TrackStatus, string> = {
  feito: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  atrasado: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  parcial: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  pendente: 'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  adiado: 'border-zinc-400/40 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
};

const PRIORITY_LABEL = [
  'Prioridade máxima',
  '2ª prioridade',
  '3ª prioridade',
  'Leve',
  'Manutenção',
  'Adiado',
];

// Identidade visual por trilha no "Faça hoje" — cada número usa a família
// de cor que a trilha já tem no Hub (prova rose, prática violeta, revisão teal).
const TRACK_CHIP: Record<string, string> = {
  mat: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
  alg: 'bg-violet-500/20 text-violet-700 dark:text-violet-300',
  lm: 'bg-teal-500/20 text-teal-700 dark:text-teal-300',
};
const TRACK_CHIP_DEFAULT = 'bg-amber-500/20 text-amber-700 dark:text-amber-300';

type DoneMap = Record<string, boolean>;
const LS_KEY = 'hub:recovery:v1:done';

export function RecoveryCard() {
  const [done, setDone] = useLocalStorage<DoneMap>(LS_KEY, {});
  // A nota real vive no REGISTRO da Calculadora (realGrades) — a fila e o
  // badge precisam lê-la, senão pediriam 'Anotar a nota' para sempre
  // (dupla verdade, o vício que as 83/84 mataram no plano e na fila).
  const sp = useStudyProgress();
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const week = React.useMemo(() => getClassWeekInfo(), []);
  const daysToExam = daysUntilDate(MATH_EXAM.date);
  // TEC.1984 é escala 100 (course-data) — a nota bruta do registro compara
  // direto com MATH_META, mesma normalização do grade-calculator para esta
  // disciplina (scale===10 → grade*10; aqui scale=100 → grade puro).
  const notaReal = React.useMemo(
    () => findNotaRealAv1(sp.progress.realGrades),
    [sp.progress.realGrades],
  );
  const todayItems = React.useMemo(
    () => todayRecoveryActions(done, sp.progress.realGrades, sp.progress.simuladoRuns),
    [done, sp.progress.realGrades, sp.progress.simuladoRuns],
  );
  const allActions = React.useMemo(
    () => RECOVERY_TRACKS.flatMap((t) => t.acoes.map((a) => ({ track: t, action: a }))),
    [],
  );
  const doneCount = allActions.filter(({ action }) => done[action.id]).length;
  const pct = allActions.length ? Math.round((doneCount / allActions.length) * 100) : 0;

  function toggle(id: string) {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Semana do ciclo: "fecha hoje" na terça, senão mostra o intervalo.
  const weekText = week.isLastDayOfWeek
    ? `Semana ${week.questionsWeek} de questões FECHA hoje · Semana ${week.questionsWeek + 1} começa amanhã`
    : `Semana ${week.questionsWeek} de questões (${fmtDate(week.weekStart)}–${fmtDate(week.weekEnd)})`;

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card
        className={cn(
          'overflow-hidden rounded-2xl border shadow-sm',
          'border-amber-500/25 hover:border-amber-500/45',
        )}
        aria-labelledby="recovery-title"
      >
        {/* Cabeçalho: semana atual + prova */}
        <div className="flex flex-col gap-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
              <Route className="size-5.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p id="recovery-title" className="text-sm font-semibold sm:text-base">
                Plano de Recuperação
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {weekText} · semana {week.semesterWeek} de 19 do semestre
              </p>
            </div>
          </div>
          {/* O badge da prova agora distingue TRÊS pós-provas: falta a nota
              (rose = pendente), nota ≥ meta (emerald = a cor que o Hub já
              consagrou para done) e nota < meta (amber = informativo, não
              alarmante — Av2 e Av3 abrem caminho). Cor = significado. */}
          <Badge
            variant="outline"
            className={cn(
              'w-fit shrink-0 gap-1.5 px-2.5 py-1 text-xs font-semibold',
              daysToExam >= 0
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : notaReal !== null && notaReal >= MATH_META
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : notaReal !== null
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
            )}
          >
            <Clock4 className="size-3" aria-hidden />{' '}
            {daysToExam < 0 ? (
              notaReal !== null ? (
                <>
                  Realizada — nota <span className="font-bold tabular-nums">{notaReal}</span>
                  {notaReal >= MATH_META ? (
                    <> · meta {MATH_META} ✓</>
                  ) : (
                    <> · meta {MATH_META}</>
                  )}
                </>
              ) : (
                'Prova de Matemática realizada — falta a nota'
              )
            ) : daysToExam === 0 ? (
              'Prova de Matemática hoje — boa prova!'
            ) : daysToExam === 1 ? (
              'Prova de Matemática amanhã'
            ) : (
              `Prova de Matemática em ${daysToExam}d`
            )}
          </Badge>
        </div>

        {/* Faça hoje (ordem de prioridade) */}
        <div className="border-t px-4 py-3 sm:px-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ListRestart className="size-3.5" aria-hidden /> Faça hoje, nesta ordem
          </p>
          {todayItems.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CircleCheck className="size-4 shrink-0" aria-hidden /> Todas as prioridades de hoje
              concluídas — manter o ritmo com os flashcards e o Praticar.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {todayItems.map(({ track, action }, i) => {
                const isDone = !!done[action.id];
                const isPointer = action.checkable === false;
                // O SIMULADO OFICIAL TINTA A PLACA (cor = significado, a mesma
                // gramática da nota real): rosa = compromisso pendente,
                // emerald = meta batida, amber = informativo (abaixo da meta).
                const falaSimulado = isPointer && typeof action.pct === 'number';
                const metaBatida = falaSimulado && (action.pct as number) >= MATH_META;
                return (
                  <li
                    key={action.id}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border p-2.5 transition-colors',
                      isDone
                        ? 'border-emerald-500/25 bg-emerald-500/5'
                        : action.prazoHoje
                          ? 'border-amber-500/60 bg-amber-500/[0.08]'
                          : metaBatida
                            ? 'border-emerald-500/40 bg-emerald-500/[0.07]'
                            : falaSimulado
                              ? 'border-amber-500/40 bg-amber-500/[0.06]'
                              : isPointer
                                ? 'border-rose-500/25 bg-rose-500/[0.04]'
                                : 'border-border bg-muted/20',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : TRACK_CHIP[track.id] ?? TRACK_CHIP_DEFAULT,
                      )}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    {isPointer ? (
                      // Item-POINTER: o registro vive no card da prova — aqui é
                      // só a fila apontando (sem checkbox, sem dupla verdade).
                      // Com veredito do simulado, o ícone muda com a cor: ✓
                      // emerald (meta batida) ou alvo amber (abaixo — informativo).
                      falaSimulado ? (
                        metaBatida ? (
                          <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                        ) : (
                          <Target className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                        )
                      ) : (
                        <CornerDownRight className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden />
                      )
                    ) : (
                      <Checkbox
                        id={`rec-${action.id}`}
                        checked={isDone}
                        onCheckedChange={() => toggle(action.id)}
                        className="mt-0.5"
                        aria-label={`Marcar "${action.texto}" como feito`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {isPointer ? (
                        <p className="text-xs font-medium leading-relaxed text-foreground/90">
                          {action.texto}
                        </p>
                      ) : (
                        <label
                          htmlFor={`rec-${action.id}`}
                          className={cn(
                            'cursor-pointer text-xs font-medium leading-relaxed',
                            isDone && 'text-muted-foreground line-through',
                          )}
                        >
                          {action.texto}
                        </label>
                      )}
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        <span>{track.title}</span>
                        <span>· {action.minutos} min</span>
                        {/* Chip do PRAZO QUE VENCE HOJE — a família "é hoje" da
                            casa (amber, pulso no relógio, a mesma gramática dos
                            é-hoje do hero/agenda): a fila só inventa urgência
                            com DATA REAL atrás. Some quando entregue (marcado). */}
                        {action.prazoHoje && !isDone && (
                          <Badge className="gap-1 border border-amber-500/60 bg-amber-500/15 px-1.5 py-0 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                            <Clock4 className="size-2.5 animate-pulse" aria-hidden /> prazo hoje
                          </Badge>
                        )}
                        {/* Chip do veredito do simulado — MESMA gramática do
                            badge da nota real (87): emerald sólido-contorno
                            quando ≥ meta, amber informativo quando abaixo. */}
                        {typeof action.pct === 'number' && (
                          <Badge
                            className={cn(
                              'gap-1 border px-1.5 py-0 text-[9px] font-semibold',
                              action.pct >= MATH_META
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                            )}
                          >
                            simulado{' '}
                            <span className="tabular-nums font-bold">{action.pct}%</span> · meta{' '}
                            {MATH_META}
                            {action.pct >= MATH_META ? ' ✓' : ''}
                          </Badge>
                        )}
                        {action.materialId && (
                          <button
                            type="button"
                            onClick={() => openMethod({ materialId: action.materialId })}
                            className="inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                          >
                            <BookOpen className="size-2.5" aria-hidden /> material
                          </button>
                        )}
                        {action.tab === 'practice' && (
                          <button
                            type="button"
                            onClick={() =>
                              openPractice({
                                disciplineCode: track.disciplineCode,
                                linkedMaterial: action.linkedMaterial,
                              })
                            }
                            className="inline-flex items-center gap-0.5 rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 font-medium text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
                          >
                            <Dumbbell className="size-2.5" aria-hidden /> praticar
                          </button>
                        )}
                        {action.tab === 'progress' && (
                          <button
                            type="button"
                            onClick={() => openProgress()}
                            className="inline-flex items-center gap-0.5 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-700 transition-colors hover:bg-sky-500/20 dark:text-sky-300"
                          >
                            <Calculator className="size-2.5" aria-hidden /> calculadora
                          </button>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {/* O RECIBO DA ENTREGA (126) — a voz que fica quando o prazo cumpre.
              A entrega da S3 é trabalho REAL avaliado e o checkbox dela tira a
              linha da fila (o design manda: a trilha volta à primeira ação
              pendente) — mas 'marquei, e agora?' ficou no ar (lição 123: registro
              que o aluno não vê vira dúvida). NO DIA do prazo, com a entrega
              marcada, a fila diz o que o registro É e para onde o programa vai:
              emerald calmo (a cor do feito da casa), sem pulso. Fora do dia a
              fila não fala — a trilha já segue o próprio caminho. */}
          {done['alg-s3-entrega'] && daysUntilDate(MATH_SIMULADO_DATE) === 0 && (
            <p
              role="status"
              className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <CircleCheck className="size-4 shrink-0" aria-hidden />
              <span>
                Entrega da S3 registrada — os programas seguem no Classroom para a
                correção. A trilha de Algoritmos segue na próxima ação pendente.
              </span>
            </p>
          )}
        </div>

        {/* Fila de prioridades (trilhas) */}
        <div className="border-t px-4 py-3 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fila de prioridades — assuntos essenciais primeiro
          </p>
          <ul className="mt-2 space-y-1.5">
            {RECOVERY_TRACKS.map((track) => {
              const isOpen = expanded === track.id;
              const trackMinutes = track.acoes.reduce((a, x) => a + x.minutos, 0);
              const allTrackDone = track.acoes.every((a) => done[a.id]);
              // A trilha Matemática é VIVA: pós-prova vira 'feito' — a fila
              // não acusa o que já aconteceu (mesma honestidade da 83).
              const status: TrackStatus =
                track.id === 'mat' ? matTrackStatusFor(daysToExam) : track.status;
              const resumo =
                track.id === 'mat' ? matTrackResumoFor(daysToExam, notaReal) : track.resumo;
              return (
                <li key={track.id} className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : track.id)}
                    className="flex w-full items-center gap-2 p-2.5 text-left transition-colors hover:bg-muted/40"
                    aria-expanded={isOpen}
                  >
                    <span className="w-6 shrink-0 text-center text-[10px] font-bold tabular-nums text-muted-foreground">
                      P{track.prioridade}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-xs font-semibold',
                          track.status === 'adiado' && 'text-muted-foreground',
                        )}
                      >
                        {track.title}
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 border text-[9px]', STATUS_STYLE[status])}
                    >
                      {(allTrackDone || status === 'feito') && status !== 'adiado' ? (
                        <CircleCheck className="size-2.5" aria-hidden />
                      ) : null}
                      {(allTrackDone || status === 'feito') && status !== 'adiado'
                        ? 'Feito'
                        : TRACK_STATUS_LABEL[status]}
                    </Badge>
                    {trackMinutes > 0 && (
                      <span className="hidden shrink-0 text-[10px] tabular-nums text-muted-foreground sm:block">
                        {trackMinutes}min
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'size-3.5 shrink-0 text-muted-foreground transition-transform',
                        isOpen && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t px-3 py-2.5">
                      <p className="text-[11px] leading-relaxed text-foreground/80">{resumo}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-semibold">{PRIORITY_LABEL[track.prioridade]}:</span>{' '}
                        {track.porQue}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {track.acoes.map((action) => {
                          const isDone = !!done[action.id];
                          return (
                            <li key={action.id} className="flex items-start gap-2">
                              <Checkbox
                                id={`trk-${action.id}`}
                                checked={isDone}
                                onCheckedChange={() => toggle(action.id)}
                                className="mt-0.5"
                                aria-label={`Marcar "${action.texto}" como feito`}
                              />
                              <label
                                htmlFor={`trk-${action.id}`}
                                className={cn(
                                  'min-w-0 flex-1 cursor-pointer text-[11px] leading-relaxed',
                                  isDone && 'text-muted-foreground line-through',
                                )}
                              >
                                {action.texto}
                                {action.minutos > 0 && (
                                  <span className="ml-1 text-muted-foreground">({action.minutos} min)</span>
                                )}
                              </label>
                              {action.materialId && (
                                <button
                                  type="button"
                                  onClick={() => openMethod({ materialId: action.materialId })}
                                  className="mt-0 inline-flex shrink-0 items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                                >
                                  <BookOpen className="size-2.5" aria-hidden /> abrir
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Progresso da recuperação */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Recuperação completa</span>
              <span className="tabular-nums">
                {doneCount}/{allActions.length} ações
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </Card>
    </motion.section>
  );
}
