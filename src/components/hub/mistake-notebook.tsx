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
  CalendarCheck,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Copy,
  Dumbbell,
  FileQuestion,
  GraduationCap,
  Printer,
  Repeat2,
  RotateCcw,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDisciplineByCode } from '@/data/course-data';
import {
  buildItemQuestion,
  buildNotebookQuestion,
  collectMistakes,
  filterByWindow,
  groupByDiscipline,
  isRecorrenteMistake,
  MISTAKE_WINDOWS,
  notebookStats,
  paperNotebookFor,
  pendingMistakes,
  windowCounts,
  type MistakeItem,
  type MistakeKind,
  type MistakeWindow,
} from '@/lib/mistake-notebook';
import {
  MATH_EXAM,
  findMathSimuladoRunOficial,
  notebookExamBriefFor,
  type NotebookExamBrief,
} from '@/lib/math-exam-prep';
import { getColorClasses } from '@/lib/discipline-colors';
import { useStudyProgress } from '@/lib/study-progress';
import { openSimulado, openTutor } from '@/lib/hub-events';
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

// ----- Faixa da semana da Av1 — a MESMA gramática de cor dos Flashcards (90):
// sólido + pulso nos "é hoje" (âmbar simulado, rose prova), emerald no registro
// (o REGISTRO vence o relógio), tinta translúcida na espera (véspera). -----
const NOTEBOOK_EXAM_VISUAL: Record<
  NotebookExamBrief['kind'],
  {
    shell: string;
    text: string;
    sub: string;
    iconBox: string;
    icon: React.ReactNode;
    btn: string;
  }
> = {
  'simulado-hoje': {
    shell:
      'border-amber-500 bg-amber-500 shadow-md shadow-amber-500/30 dark:border-amber-400 dark:bg-amber-400',
    text: 'text-white dark:text-zinc-900',
    sub: 'text-white/90 dark:text-zinc-900/80',
    iconBox: 'bg-white/20 dark:bg-zinc-900/15',
    icon: <CalendarCheck className="size-4 animate-pulse" aria-hidden />,
    btn: 'bg-white text-amber-600 hover:bg-amber-50 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-zinc-800',
  },
  'simulado-feito': {
    shell: 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500',
    text: 'text-white dark:text-zinc-900',
    sub: 'text-white/90 dark:text-zinc-900/80',
    iconBox: 'bg-white/20 dark:bg-zinc-900/15',
    icon: <CheckCircle2 className="size-4" aria-hidden />,
    btn: 'bg-white text-emerald-600 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-zinc-800',
  },
  vespera: {
    shell:
      'border-amber-500/40 bg-amber-500/[0.07] dark:border-amber-400/40 dark:bg-amber-400/[0.06]',
    text: 'text-amber-600 dark:text-amber-300',
    sub: 'text-amber-700/80 dark:text-amber-300/75',
    iconBox: 'bg-amber-500/15 dark:bg-amber-400/15',
    icon: <Zap className="size-4" aria-hidden />,
    btn: 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-400 dark:text-zinc-900 dark:hover:bg-amber-300',
  },
  'prova-hoje': {
    shell:
      'border-rose-500 bg-rose-500 shadow-md shadow-rose-500/30 dark:border-rose-400 dark:bg-rose-400',
    text: 'text-white dark:text-zinc-900',
    sub: 'text-white/90 dark:text-zinc-900/80',
    iconBox: 'bg-white/20 dark:bg-zinc-900/15',
    icon: <GraduationCap className="size-4 animate-pulse" aria-hidden />,
    btn: 'bg-white text-rose-600 hover:bg-rose-50 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-zinc-800',
  },
};

/**
 * Faixa da semana da Av1 no topo do Caderno de Erros — o caderno aprende o
 * próprio papel na reta final: no dia do simulado ele anuncia o que vai virar
 * (ou flipa "feito ✓" com o run); na véspera ele É a lista do papel; no dia
 * da prova ele manda descansar. CTA opcional (brief.cta null = sem botão).
 */
function NotebookExamStrip({
  brief,
  ctaLabel,
  onCta,
}: {
  brief: NotebookExamBrief;
  /** Rótulo final do CTA (o pai acrescenta contagem, ex.: "Ver as frescas (4)"). */
  ctaLabel: string | null;
  onCta?: () => void;
}) {
  const v = NOTEBOOK_EXAM_VISUAL[brief.kind];
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        v.shell,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
            v.iconBox,
          )}
        >
          {v.icon}
        </span>
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold leading-tight', v.text)}>{brief.titulo}</p>
          <p className={cn('mt-1 text-xs leading-snug', v.sub)}>{brief.chamada}</p>
        </div>
      </div>
      {ctaLabel && onCta ? (
        <Button
          size="sm"
          onClick={onCta}
          className={cn('shrink-0 gap-1.5 font-semibold', v.btn)}
          aria-label={ctaLabel}
        >
          <Target className="size-3.5" aria-hidden />
          <span className="tabular-nums">{ctaLabel}</span>
        </Button>
      ) : null}
    </div>
  );
}

export function MistakeNotebook() {
  const sp = useStudyProgress();
  const items = React.useMemo(() => collectMistakes(sp.progress), [sp.progress]);
  const [win, setWin] = React.useState<MistakeWindow>('all');
  // Contagens por janela alimentam os chips — janela sem erro desabilita (honesto).
  const counts = React.useMemo(() => windowCounts(items), [items]);
  // Tudo que a tela mostra deriva da janela visível: stats, grupos, pendentes e IA.
  const visible = React.useMemo(() => filterByWindow(items, win), [items, win]);
  const stats = React.useMemo(() => notebookStats(visible), [visible]);
  const revisedMap = sp.progress.notebookRevised ?? {};
  const pendentes = React.useMemo(
    () => pendingMistakes(visible, revisedMap),
    [visible, revisedMap],
  );
  const windowMeta = MISTAKE_WINDOWS.find((w) => w.id === win);
  const filtered = win !== 'all';
  // "Erros de sempre" na janela visível — recaída (exercício), falha crônica
  // (cartão errou 2×+) ou crônico entre corridas (perdido em 2+ simulados) —
  // o pior tipo de erro na véspera: parece aprendido e não está (ou nunca esteve).
  const recorrentes = React.useMemo(
    () => visible.filter((it) => !revisedMap[it.key] && isRecorrenteMistake(it)),
    [visible, revisedMap],
  );
  // Grupos por disciplina — dentro de cada grupo: pendentes primeiro,
  // RECORRENTES no topo do grupo (recaídas disputam a atenção antes),
  // revisados afundam no fim (resolvidos não disputam atenção na véspera).
  const groups = React.useMemo(
    () =>
      groupByDiscipline(visible).map(({ disciplineCode, items: list }) => ({
        disciplineCode,
        items: [...list].sort((a, b) => {
          const ra = revisedMap[a.key] ? 1 : 0;
          const rb = revisedMap[b.key] ? 1 : 0;
          if (ra !== rb) return ra - rb;
          const la = isRecorrenteMistake(a) ? 0 : 1;
          const lb = isRecorrenteMistake(b) ? 0 : 1;
          if (la !== lb) return la - lb;
          const ta = a.when ? new Date(a.when).getTime() : 0;
          const tb = b.when ? new Date(b.when).getTime() : 0;
          return tb - ta;
        }),
      })),
    [visible, revisedMap],
  );
  const revisedCount = visible.length - pendentes.length;
  const donePct = visible.length === 0 ? 0 : Math.round((revisedCount / visible.length) * 100);

  // Semana da Av1 no caderno — RENDER-TIME (lição 79): calculado no corpo,
  // reage a mock de relógio no próximo render, sem estado nem interval. O run
  // oficial vem da FONTE ÚNICA findMathSimuladoRunOficial (85/86/88/89/90) e
  // as pendências de Matemática contam o caderno INTEIRO (não a janela
  // visível) — o número da faixa não mente quando o aluno filtra por período.
  const simuladoRunOficial = findMathSimuladoRunOficial(sp.progress.simuladoRuns);
  const mathPendentes = items.filter(
    (it) => it.disciplineCode === MATH_EXAM.disciplineCode && !revisedMap[it.key],
  ).length;
  const examBrief = notebookExamBriefFor(
    new Date(),
    mathPendentes,
    simuladoRunOficial
      ? { solved: simuladoRunOficial.solved, total: simuladoRunOficial.total }
      : null,
  );
  // O PAPEL DO CADERNO (125): o caderno INTEIRO (não a janela) — a folha é a
  // missão completa da véspera, no mesmo espírito do mathPendentes acima.
  // A MESMA fonte paperNotebookFor que a rota /caderno-papel re-lê (zero
  // segunda derivação): só pendências com enunciado completo no acervo.
  const paper = React.useMemo(
    () => paperNotebookFor(items, revisedMap),
    [items, revisedMap],
  );
  const paperCount = paper.printable.length;
  const openPaper = React.useCallback(
    () => window.open('/caderno-papel', '_blank', 'noopener'),
    [],
  );
  // CTA por estado: "Abrir o simulado" (mesma entrada pré-configurada do card
  // da prova) no D-2 sem run; "Ver as frescas (N)" no D-2 com run — só quando
  // a janela de 48h TEM erros (run perfeito = nada fresco = botão cala).
  // VÉSPERA (125): o dia do papel ganha a ferramenta do papel — o brief diz
  // "refaça no papel" e o CTA FAZ: abre a folha com as N pendências impressas
  // (só quando existe papel a fazer; sem pendência imprimível o dia fala
  // por si, cta null como sempre foi).
  const examCtaLabel =
    examBrief?.kind === 'vespera' && paperCount > 0
      ? `Imprimir as ${paperCount} questões para o papel`
      : examBrief?.cta == null
        ? null
        : examBrief.kind === 'simulado-feito'
          ? counts['48h'] > 0
            ? `${examBrief.cta} (${counts['48h']})`
            : null
          : examBrief.cta;
  const examOnCta =
    examBrief?.kind === 'simulado-hoje'
      ? () => openSimulado({ preset: 'math_exam' })
      : examBrief?.kind === 'simulado-feito'
        ? () => setWin('48h')
        : examBrief?.kind === 'vespera' && paperCount > 0
          ? openPaper
          : undefined;

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

  const notebookQuestion = buildNotebookQuestion(
    visible,
    revisedMap,
    filtered ? windowMeta?.scopeLabel : undefined,
  );

  return (
    <Card className="overflow-hidden rounded-xl bg-card shadow-sm">
      {/* Cabeçalho — tom diagnóstico (rose), distinto dos cards de histórico */}
      <div className="border-b border-rose-200/60 bg-gradient-to-r from-rose-500/[0.06] to-transparent px-5 py-4 dark:border-rose-500/20">
        <div className="flex flex-wrap items-center gap-2">
          <BookX className="size-4 text-rose-500" aria-hidden />
          <h2 className="text-sm font-semibold">Caderno de Erros</h2>
          <Badge
            variant="outline"
            className={
              pendentes.length === 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
            }
          >
            {filtered ? `${stats.total} de ${items.length}` : stats.total}{' '}
            {stats.total === 1 ? 'item' : 'itens'}
          </Badge>
          {/* "Erros de sempre": o chip que diz o que NÃO pode falhar de novo */}
          {recorrentes.length > 0 && (
            <Badge
              variant="outline"
              title={
                recorrentes.length === 1
                  ? 'Erro de sempre: recaiu depois de resolver ou foi perdido em mais de um simulado — prioridade máxima na véspera.'
                  : `Erros de sempre: ${recorrentes.length} itens que insistem — recaída depois de resolver ou perda em mais de um simulado. Prioridade máxima na véspera.`
              }
              className="border-rose-400/60 bg-rose-500/10 text-rose-700 shadow-sm dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300"
            >
              <Repeat2 className="mr-0.5 size-2.5" aria-hidden />
              {recorrentes.length} recorrente{recorrentes.length > 1 ? 's' : ''}
            </Badge>
          )}
          {/* O PAPEL DO CADERNO (125): a véspera manda refazer no papel e o
              botão FAZ — abre a folha (rota /caderno-papel) com as pendências
              de enunciado completo, numeradas, prontas para a impressora.
              Conta o caderno INTEIRO (não a janela) e CALA quando não há
              papel a fazer (regra do silêncio honesto da 88). */}
          {paperCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 rounded-full border-zinc-300 px-2.5 text-[11px] text-zinc-700 shadow-sm hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={openPaper}
              aria-label={`Abrir a folha do papel com ${paperCount} questões pendentes do caderno`}
              title="Abre a folha para imprimir: as pendências com enunciado completo, numeradas e com espaço de trabalho — a véspera é o dia do papel."
            >
              <Printer className="size-3" aria-hidden />
              Levar <span className="tabular-nums">{paperCount}</span> ao papel
            </Button>
          )}
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
          {filtered
            ? `Mostrando só o que você errou ${windowMeta?.scopeLabel} — o resto continua salvo no caderno.`
            : 'Tudo que você errou ou ainda não consolidou, num só lugar — o mais recente primeiro.'}
        </p>
        {/* Filtro temporal — a janela da véspera: o que errou há pouco é o que
            ainda está fresco na memória (e na prova). Chip sem erro desabilita:
            não existe lista vazia enganosa aqui. */}
        <div
          className="mt-3 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filtrar erros por período"
        >
          <span className="text-[11px] font-medium text-muted-foreground">Período:</span>
          {MISTAKE_WINDOWS.map((w) => {
            const ativo = win === w.id;
            const n = counts[w.id];
            const vazio = w.ms !== null && n === 0;
            return (
              <button
                key={w.id}
                type="button"
                aria-pressed={ativo}
                aria-disabled={vazio || undefined}
                title={
                  vazio
                    ? `Nenhum erro ${w.scopeLabel}`
                    : w.id === 'all'
                      ? 'Caderno inteiro'
                      : `Só erros ${w.scopeLabel}`
                }
                onClick={() => {
                  if (!vazio) setWin(w.id);
                }}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                  ativo
                    ? 'border-rose-400/70 bg-rose-500/10 text-rose-700 shadow-sm dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300'
                    : vazio
                      ? 'cursor-not-allowed border-border/60 bg-transparent text-muted-foreground/50'
                      : 'border-border bg-card text-muted-foreground hover:border-rose-300 hover:text-foreground dark:hover:border-rose-500/40',
                )}
              >
                {w.id === '48h' && n > 0 ? (
                  <span
                    className="size-1.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20"
                    aria-hidden
                  />
                ) : null}
                {w.label}
                <span className="tabular-nums text-[10px] opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
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

      {/* Semana da Av1 no caderno — silêncio honesto fora da janela (regra da
          fila da 88). Render-time: aparece/desaparece no mesmo frame do mock
          de relógio, entre o diagnóstico e a lista — a missão do dia primeiro. */}
      {examBrief ? (
        <div className="border-b border-border px-5 py-4">
          <NotebookExamStrip brief={examBrief} ctaLabel={examCtaLabel} onCta={examOnCta} />
        </div>
      ) : null}

      {/* Grupos por disciplina (borda na cor da disciplina, como na Biblioteca).
          key={win}: trocar a janela remonta e reanima a cascata — feedback visível. */}
      <div key={win} className="divide-y divide-border">
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
                  {/* Grupo zerado: o "em dia" emerald — cor = significado no
                      cabeçalho de cada disciplina (a mesma gramática da barra
                      do ciclo: rose pendência, emerald resolved). */}
                  {pendNoGrupo === 0 && list.length > 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
                      title="Todo o grupo revisado — este canto do caderno está em dia"
                    >
                      <Check className="size-2.5" aria-hidden /> em dia
                    </span>
                  ) : null}
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
                          // "Erro de sempre" em destaque escaneável: filete rose à esquerda
                          // (sombra inset — não briga com o border do hover) + tint sutil.
                          !revisedAt &&
                            isRecorrenteMistake(it) &&
                            'shadow-[inset_2px_0_0_0] shadow-rose-400/60 bg-rose-500/[0.04]',
                          // Corrida antiga sem enunciado: hierarquia honesta de VAGUEZA —
                          // borda tracejada + título apagado dizem a 1 metro que esta
                          // linha é um registro parcial (nunca compete com um erro
                          // nomeável), sem sumir do caderno.
                          it.noStatement &&
                            !revisedAt &&
                            'border-dashed border-border/60 opacity-75 hover:opacity-100',
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
                              <span
                                className={cn(
                                  revisedAt && 'line-through decoration-emerald-600/60',
                                  !revisedAt && isRecorrenteMistake(it) && 'font-medium',
                                  it.noStatement && !revisedAt && 'text-muted-foreground',
                                )}
                              >
                                {it.title}
                              </span>
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              {revisedAt ? (
                                <span className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400">
                                  <Check className="size-3" aria-hidden /> Revisado {fmtWhen(revisedAt)}
                                </span>
                              ) : null}
                              {/* Erro de sempre: recaída (exercício), falha crônica (cartão)
                                  ou crônico entre corridas (≥ 2 simulados). O texto declara
                                  QUAL dos sinais deu a recorrência — sem prometer o que não
                                  aconteceu (nunca resolvido não "voltou a errar"). */}
                              {!revisedAt && isRecorrenteMistake(it) ? (
                                <span
                                  className="flex items-center gap-0.5 rounded border border-rose-400/60 bg-rose-500/10 px-1.5 py-0.5 font-semibold text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300"
                                  title={
                                    it.kind === 'flashcard'
                                      ? 'Cartão recorrente: você errou 2× ou mais e ainda não consolidou — prioridade máxima na véspera.'
                                      : (it.lapses ?? 0) > 0
                                        ? 'Erro de sempre: você já tinha resolvido este item e voltou a errar — na véspera, é prioridade máxima.'
                                        : `Erro de sempre: esta questão foi perdida em ${it.mergedSimulado?.count} simulados diferentes e continua pendente — na véspera, é prioridade máxima.`
                                  }
                                >
                                  <Repeat2 className="size-3" aria-hidden />
                                  {it.kind === 'flashcard'
                                    ? 'sempre errada'
                                    : (it.lapses ?? 0) > 0
                                      ? `voltou ${it.lapses}×`
                                      : `${it.mergedSimulado?.count}× no simulado`}
                                </span>
                              ) : null}
                              {/* Linha fundida: a mesma questão também apareceu
                                  errada/pulada em simulado(s) — o dedupe anuncia
                                  a fusão em vez de esconder o histórico. Em
                                  linhas de exercício o badge diz "também no
                                  simulado"; em linhas de simulado (N corridas)
                                  diz "N× no simulado". Quando a recorrência JÁ
                                  veio da contagem de corridas (badge forte acima,
                                  mesmo count, sem lapses), o badge suave CALA —
                                  não pode renderizar de novo o mesmo número. */}
                              {(() => {
                                if (!it.mergedSimulado) return null;
                                const cronicamenteFundida =
                                  isRecorrenteMistake(it) && (it.lapses ?? 0) <= 0;
                                if (cronicamenteFundida) return null;
                                if (it.mergedSimulado.count > 1) {
                                  return (
                                    <span
                                      className="flex items-center gap-0.5 rounded border border-rose-300/60 bg-rose-500/[0.07] px-1.5 py-0.5 font-medium text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                                      title={
                                        it.kind === 'exercicio'
                                          ? `Esta questão também foi ${it.mergedSimulado.missed ? 'errada' : 'pulada'} em ${it.mergedSimulado.count} simulados (a mais recente em ${fmtWhen(it.mergedSimulado.lastDate)}) — a linha une os registros num só.`
                                          : `Esta questão foi ${it.mergedSimulado.missed ? 'errada' : 'pulada'} em ${it.mergedSimulado.count} simulados (a mais recente em ${fmtWhen(it.mergedSimulado.lastDate)}) — as corridas viram uma linha só.`
                                      }
                                    >
                                      <Target className="size-3" aria-hidden />
                                      {it.kind === 'exercicio'
                                        ? `também em ${it.mergedSimulado.count} simulados`
                                        : `${it.mergedSimulado.count}× no simulado`}
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    className="flex items-center gap-0.5 rounded border border-rose-300/60 bg-rose-500/[0.07] px-1.5 py-0.5 font-medium text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                                    title={`Esta questão também foi ${it.mergedSimulado.missed ? 'errada' : 'pulada'} no simulado de ${fmtWhen(it.mergedSimulado.lastDate)} — a linha une os dois registros num só.`}
                                  >
                                    <Target className="size-3" aria-hidden />
                                    também no simulado
                                  </span>
                                );
                              })()}
                              {it.noStatement ? (
                                <span
                                  className="flex items-center gap-0.5 rounded border border-dashed border-border bg-muted/30 px-1.5 py-0.5 text-muted-foreground"
                                  title="A corrida antiga não gravou o enunciado: a linha não pode ser mesclada com outras (sem como provar que é a mesma questão) nem reensinada ao pé da letra — a IA ensina o tópico do zero."
                                >
                                  <FileQuestion className="size-3" aria-hidden />
                                  corrida antiga
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
                            {/* Chip IA individual — padrão emerald dos chips 42/43.
                                Sem enunciado gravado, a pergunta muda de natureza
                                (ensinar o tópico, não reensinar a questão) — o
                                title declara a mudança em vez de prometer o que
                                a IA não tem como fazer. */}
                            <button
                              type="button"
                              onClick={() =>
                                openTutor({ disciplineCode: it.disciplineCode, question: buildItemQuestion(it) })
                              }
                              title={
                                it.noStatement
                                  ? 'Perguntar à IA para ensinar o tópico deste registro antigo (o enunciado não foi gravado)'
                                  : 'Perguntar à IA para reensinar exatamente este erro'
                              }
                              aria-label={
                                it.noStatement
                                  ? 'Perguntar à IA sobre o tópico do registro antigo (sem enunciado gravado)'
                                  : `Perguntar à IA sobre o erro: ${it.title.slice(0, 60)}`
                              }
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
            className="w-full whitespace-normal border-amber-300 bg-amber-50 text-amber-800 transition-transform hover:bg-amber-100 active:scale-[0.99] dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
            variant="outline"
            onClick={() =>
              openTutor({ disciplineCode: stats.topDisciplineCode, question: notebookQuestion })
            }
            aria-label={
              filtered
                ? `Enviar os erros ${windowMeta?.scopeLabel} para a IA analisar padrões e priorizar`
                : 'Enviar o caderno de erros completo para a IA analisar padrões e priorizar'
            }
          >
            <ClipboardList className="size-3.5" aria-hidden />
            {pendentes.length === 0
              ? filtered
                ? `Conferir os ${stats.total} erros ${windowMeta?.scopeLabel} com IA`
                : `Conferir o caderno zerado com IA (${revisedCount} revisados)`
              : filtered
                ? `Analisar os ${stats.total} erros ${windowMeta?.scopeLabel} com IA (${pendentes.length} pendentes)`
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
