'use client';

/**
 * CADERNO DE ERROS (aba Progresso) — diagnóstico único dos pontos fracos.
 *
 * Agrega: questões erradas/puladas de simulados (com detalhe por questão),
 * exercícios tentados e não resolvidos e flashcards já errados ainda frágeis.
 * Cada linha tem chip IA individual ("reensina este ponto") e o rodapé manda
 * o caderno INTEIRO para análise de padrões + priorização para a Av1.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  BookX,
  Check,
  CircleDashed,
  ClipboardList,
  Copy,
  Dumbbell,
  RotateCcw,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDisciplineByCode } from '@/data/course-data';
import { openSimulado, openTutor } from '@/lib/hub-events';
import {
  buildItemQuestion,
  buildNotebookQuestion,
  collectMistakes,
  groupByDiscipline,
  notebookStats,
  pendingMistakes,
  type MistakeItem,
  type MistakeKind,
} from '@/lib/mistake-notebook';
import { getColorClasses } from '@/lib/discipline-colors';
import { useStudyProgress } from '@/lib/study-progress';
import { cn } from '@/lib/utils';

// ----- Metadados por tipo de erro (ícone + cor da paleta semântica) -----
const KIND_META: Record<MistakeKind, { icon: LucideIcon; dot: string; label: string }> = {
  simulado_missed: { icon: Target, dot: 'bg-rose-500', label: 'Simulado' },
  simulado_skipped: { icon: CircleDashed, dot: 'bg-zinc-400', label: 'Simulado' },
  exercicio: { icon: Dumbbell, dot: 'bg-amber-500', label: 'Exercício' },
  flashcard: { icon: Copy, dot: 'bg-teal-500', label: 'Cartão' },
};

// Classes de dificuldade — mesmas do practice-view (consistência visual).
const difficultyColor: Record<NonNullable<MistakeItem['difficulty']>, string> = {
  facil: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400',
  medio: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400',
  dificil: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400',
};
const difficultyLabel = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' } as const;

function fmtWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

/** Erro das últimas 48h — marca "fresco": o que a memória ainda está tragando. */
function isFresh(iso?: string): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 48 * 3600 * 1000;
}

export function MistakeNotebook() {
  const sp = useStudyProgress();
  const items = React.useMemo(() => collectMistakes(sp.progress), [sp.progress]);
  const stats = React.useMemo(() => notebookStats(items), [items]);
  const revisedMap = sp.progress.notebookRevised ?? {};
  const pendentes = React.useMemo(
    () => pendingMistakes(items, revisedMap),
    [items, revisedMap],
  );
  // Grupos por disciplina — dentro de cada grupo, pendentes primeiro (recência),
  // revisados afundam no fim (resolvidos não disputam atenção na véspera).
  const groups = React.useMemo(
    () =>
      groupByDiscipline(items).map(({ disciplineCode, items: list }) => ({
        disciplineCode,
        items: [...list].sort((a, b) => {
          const ra = revisedMap[a.key] ? 1 : 0;
          const rb = revisedMap[b.key] ? 1 : 0;
          if (ra !== rb) return ra - rb;
          const ta = a.when ? new Date(a.when).getTime() : 0;
          const tb = b.when ? new Date(b.when).getTime() : 0;
          return tb - ta;
        }),
      })),
    [items, revisedMap],
  );
  const revisedCount = items.length - pendentes.length;
  const donePct = items.length === 0 ? 0 : Math.round((revisedCount / items.length) * 100);

  if (items.length === 0) {
    return (
      <Card className="rounded-xl bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <ClipboardList className="size-4.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Caderno de Erros</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nada aqui por agora — e é bom sinal. Questões erradas de simulados, exercícios não
              resolvidos e cartões que você errou aparecem neste caderno automaticamente, para
              virarem acerto na prova.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => openSimulado()}
              aria-label="Fazer um simulado para começar o caderno de erros"
            >
              <Target className="size-3.5" aria-hidden /> Fazer um simulado
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const notebookQuestion = buildNotebookQuestion(items, revisedMap);

  return (
    <Card className="overflow-hidden rounded-xl bg-card shadow-sm">
      {/* Cabeçalho — tom diagnóstico (rose), distinto dos cards de histórico */}
      <div className="border-b border-rose-200/60 bg-gradient-to-r from-rose-500/[0.06] to-transparent px-5 py-4 dark:border-rose-500/20">
        <div className="flex flex-wrap items-center gap-2">
          <BookX className="size-4 text-rose-500" aria-hidden />
          <h2 className="text-sm font-semibold">Caderno de Erros</h2>
          <Badge
            variant="outline"
            className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {stats.total} {stats.total === 1 ? 'item' : 'itens'}
          </Badge>
          {/* Legenda dos 3 tipos — mesma gramática da legenda do histórico */}
          <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-rose-500" aria-hidden /> simulado
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> exercício
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-teal-500" aria-hidden /> cartão
            </span>
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tudo que você errou ou ainda não consolidou, num só lugar — o mais recente primeiro.
        </p>
        {/* Barra do ciclo: pendentes → revisados (o caderno que você resolve) */}
        <div className="mt-3 max-w-md">
          <div className="flex items-center justify-between text-[11px]">
            <span
              className={cn(
                'flex items-center gap-1 font-medium',
                pendentes.length === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
              )}
            >
              <Check className="size-3" aria-hidden />
              {revisedCount} de {stats.total} revisados
              {pendentes.length === 0 ? ' — caderno em dia!' : ''}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {pendentes.length} {pendentes.length === 1 ? 'pendente' : 'pendentes'}
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={stats.total}
            aria-valuenow={revisedCount}
            aria-label="Progresso de revisão do caderno de erros"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${donePct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Grupos por disciplina (borda na cor da disciplina, como na Biblioteca) */}
      <div className="divide-y divide-border">
        {groups.map(({ disciplineCode, items: list }, gi) => {
          const disc = getDisciplineByCode(disciplineCode);
          const color = getColorClasses(disc?.color ?? 'slate');
          const pendNoGrupo = list.filter((x) => !revisedMap[x.key]).length;
          return (
            <div key={disciplineCode} className={cn('border-l-2 pl-4 pr-5 py-4', color.border)}>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.05, duration: 0.25 }}
              >
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className={cn('size-2 rounded-full', color.dot)} aria-hidden />
                  {disc?.name ?? disciplineCode}
                  <span className="tabular-nums font-normal normal-case">
                    {pendNoGrupo === list.length
                      ? `· ${list.length}`
                      : `· ${pendNoGrupo}/${list.length} pendentes`}
                  </span>
                </h3>
                <ul className="mt-2 space-y-2.5">
                  {list.map((it) => {
                    const meta = KIND_META[it.kind];
                    const Icon = meta.icon;
                    const when = fmtWhen(it.when);
                    const revisedAt = revisedMap[it.key];
                    return (
                      <li
                        key={it.key}
                        className={cn(
                          'group rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/40',
                          revisedAt && 'opacity-65 hover:opacity-100 transition-opacity',
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn('mt-1 flex shrink-0', color.textStrong)}
                            title={meta.label}
                          >
                            <Icon className="size-3.5" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-start gap-1.5 text-sm leading-snug">
                              {!revisedAt && isFresh(it.when) ? (
                                <span
                                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-500 ring-3 ring-rose-500/20"
                                  title="Erro recente — fresco na memória"
                                  aria-label="Erro recente"
                                />
                              ) : null}
                              <span className={cn(revisedAt && 'line-through decoration-emerald-600/60')}>
                                {it.title}
                              </span>
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              {revisedAt ? (
                                <span className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400">
                                  <Check className="size-3" aria-hidden /> Revisado {fmtWhen(revisedAt)}
                                </span>
                              ) : null}
                              {it.topic ? (
                                <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5">
                                  {it.topic}
                                </span>
                              ) : null}
                              {it.difficulty ? (
                                <span
                                  className={cn(
                                    'rounded border px-1.5 py-0.5',
                                    difficultyColor[it.difficulty],
                                  )}
                                >
                                  {difficultyLabel[it.difficulty]}
                                </span>
                              ) : null}
                              {it.note ? <span>{it.note}</span> : null}
                              {when ? <span className="tabular-nums">· {when}</span> : null}
                            </div>
                          </div>
                          <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                            {/* Chip IA individual — padrão emerald dos chips 42/43 */}
                            <button
                              type="button"
                              onClick={() =>
                                openTutor({ disciplineCode: it.disciplineCode, question: buildItemQuestion(it) })
                              }
                              title="Perguntar à IA para reensinar exatamente este erro"
                              aria-label={`Perguntar à IA sobre o erro: ${it.title.slice(0, 60)}`}
                              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-50 text-emerald-600 transition-all hover:bg-emerald-100 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-1 active:scale-95 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                            >
                              <BookX className="size-3.5" aria-hidden />
                            </button>
                            {revisedAt ? (
                              <button
                                type="button"
                                onClick={() => sp.unmarkNotebookRevised(it.key)}
                                title="Reabrir erro — voltou a acontecer ou marcou sem querer"
                                aria-label={`Reabrir o erro: ${it.title.slice(0, 60)}`}
                                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-1 active:scale-95 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                              >
                                <RotateCcw className="size-3.5" aria-hidden />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => sp.markNotebookRevised(it.key)}
                                title="Marcar como revisado — sai da lista de pendentes"
                                aria-label={`Marcar como revisado: ${it.title.slice(0, 60)}`}
                                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500 text-white shadow-sm transition-all hover:bg-emerald-600 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-1 active:scale-95"
                              >
                                <Check className="size-3.5" aria-hidden />
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Análise completa — botão âmbar (mesma família dos debriefings) */}
      {notebookQuestion ? (
        <div className="border-t border-border bg-muted/30 px-5 py-4">
          <Button
            className="w-full border-amber-300 bg-amber-50 text-amber-800 transition-transform hover:bg-amber-100 active:scale-[0.99] dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
            variant="outline"
            onClick={() =>
              openTutor({ disciplineCode: stats.topDisciplineCode, question: notebookQuestion })
            }
            aria-label="Enviar o caderno de erros completo para a IA analisar padrões e priorizar"
          >
            <ClipboardList className="size-3.5" aria-hidden />
            {pendentes.length === 0
              ? `Conferir o caderno zerado com IA (${revisedCount} revisados)`
              : `Analisar o caderno completo com IA (${pendentes.length} pendentes)`}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {pendentes.length === 0
              ? 'Tudo revisado — a IA confirma se é seguro deixar de lado e sugere um mini-drill relâmpago de prova.'
              : 'A IA procura o padrão por trás dos erros e sugere o que revisar primeiro — e o que não vale a pena antes da prova.'}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
