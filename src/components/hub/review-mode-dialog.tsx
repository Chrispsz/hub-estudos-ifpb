'use client';

import * as React from 'react';

/**
 * Modo Revisão — fechamento do ciclo de estudo do Praticar:
 * ★ marcadas + Caderno de Erros (precisei de ajuda / tentei e não resolveu)
 * viram uma fila guiada de revisão, uma questão por vez, com autoavaliação.
 *
 * Didática (material-first, estilo GNOME — um foco por tela):
 * 1. Lê a questão com calma (badges de contexto, enunciado inteiro).
 * 2. Tenta de cabeça; a dica fica escondida até pedir.
 * 3. Travou? "Perguntar ao tutor" abre o chat com a questão + dica prontas
 *    (o diálogo continua aberto — ao voltar, a fila está onde parou).
 * 4. Autoavalia com teclado (1/2) — "Consegui agora" limpa a fila;
 *    "Ainda não consigo" mantém no Caderno de Erros para a próxima rodada.
 */

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Keyboard,
  Lightbulb,
  MessageCircleQuestion,
  NotebookPen,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import type { Exercise } from '@/lib/exercise-extractor';
import { exercises } from '@/lib/exercise-extractor';
import { openTutor } from '@/lib/hub-events';
import { toast } from 'sonner';

const difficultyLabel = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' } as const;

interface ReviewItem {
  ex: Exercise;
  /** Por que está na fila: marcada com ★, erro (caderno) ou os dois. */
  marked: boolean;
  fromNotebook: boolean;
  lastPracticedAt: string;
}

/** Fila de revisão = ★ marcadas ∪ Caderno de Erros, pendentes primeiro. */
export function buildReviewQueue(
  progress: ReturnType<typeof useStudyProgress>['progress'],
): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const [id, v] of Object.entries(progress.exerciseProgress)) {
    const ex = exercises.find((e) => e.id === id);
    if (!ex) continue;
    const marked = !!v.marked;
    const fromNotebook = v.neededHelp || (!!v.tried && !v.solved);
    if (!marked && !fromNotebook) continue;
    items.push({ ex, marked, fromNotebook, lastPracticedAt: v.lastPracticedAt || '' });
  }
  // Pendências do Caderno primeiro (o que "dói"), depois ★ resolvidas;
  // dentro de cada grupo, a mais recente primeiro.
  const rank = (i: ReviewItem) => (i.fromNotebook ? 0 : 1);
  return items.sort(
    (a, b) => rank(a) - rank(b) || b.lastPracticedAt.localeCompare(a.lastPracticedAt),
  );
}

export function ReviewModeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const sp = useStudyProgress();

  // A fila é congelada quando o diálogo abre (não muda no meio da revisão).
  const [queue, setQueue] = React.useState<ReviewItem[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [showTip, setShowTip] = React.useState(false);
  const [nowSolved, setNowSolved] = React.useState<string[]>([]);
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setQueue(buildReviewQueue(sp.progress));
      setIdx(0);
      setShowTip(false);
      setNowSolved([]);
      setStarted(true);
    }
  }, [open]);

  const current = queue[idx] as ReviewItem | undefined;
  const finished = started && queue.length > 0 && idx >= queue.length;
  const total = queue.length;

  const assess = React.useCallback(
    (solved: boolean) => {
      if (!current) return;
      const { ex } = current;
      if (solved) {
        sp.updateExerciseProgress(ex.id, {
          tried: true,
          solved: true,
          neededHelp: false,
          lastPracticedAt: new Date().toISOString(),
          // Resolvida com confiança → sai da fila (a ★ cumpriu o papel).
          ...(current.marked ? { marked: false } : {}),
        });
        setNowSolved((s) => [...s, ex.id]);
        if (current.marked) toast.success('Resolvida — a ★ cumpriu o papel e foi removida.');
      } else {
        sp.updateExerciseProgress(ex.id, {
          tried: true,
          solved: false,
          neededHelp: true,
          lastPracticedAt: new Date().toISOString(),
        });
        toast.info('Fica no Caderno de Erros — a próxima rodada começa por ela.');
      }
      setShowTip(false);
      setIdx((i) => i + 1);
    },
    [current, sp],
  );

  // Atalhos de teclado (1 = consegui, 2 = ainda não, ←/→ = navegar).
  React.useEffect(() => {
    if (!open || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') assess(true);
      else if (e.key === '2') assess(false);
      else if (e.key === 'ArrowRight') {
        setShowTip(false);
        setIdx((i) => Math.min(i + 1, queue.length));
      } else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, current, assess, queue.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        {queue.length === 0 && started ? (
          <EmptyQueue onClose={() => onOpenChange(false)} />
        ) : finished ? (
          <FinishScreen
            total={total}
            nowSolved={nowSolved.length}
            remaining={queue.length - nowSolved.length}
            onRepeat={() => {
              setQueue((q) => q.filter((i) => !nowSolved.includes(i.ex.id)));
              setIdx(0);
              setNowSolved([]);
            }}
            onClose={() => onOpenChange(false)}
          />
        ) : current ? (
          <ReviewScreen
            item={current}
            index={idx}
            total={total}
            showTip={showTip}
            onToggleTip={() => setShowTip((v) => !v)}
            onAssess={assess}
            onSkip={() => {
              setShowTip(false);
              setIdx((i) => Math.min(i + 1, queue.length));
            }}
            onBack={() => setIdx((i) => Math.max(i - 1, 0))}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function KindBadges({ item }: { item: ReviewItem }) {
  return (
    <>
      {item.fromNotebook && (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
          <NotebookPen className="size-2.5" /> caderno
        </Badge>
      )}
      {item.marked && (
        <Badge variant="outline" className="border-yellow-500/40 bg-yellow-500/10 text-[10px] text-yellow-700 dark:text-yellow-400">
          <Star className="size-2.5 fill-current" /> marcada
        </Badge>
      )}
    </>
  );
}

function ReviewScreen({
  item,
  index,
  total,
  showTip,
  onToggleTip,
  onAssess,
  onSkip,
  onBack,
  onClose,
}: {
  item: ReviewItem;
  index: number;
  total: number;
  showTip: boolean;
  onToggleTip: () => void;
  onAssess: (solved: boolean) => void;
  onSkip: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { ex } = item;
  const disc = getDisciplineByCode(ex.disciplineCode);
  const color = getColorClasses(disc?.color ?? 'slate');

  return (
    <div>
      {/* Cabeçalho com progresso */}
      <DialogHeader className="space-y-1 border-b px-6 pb-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="size-4 text-emerald-600 dark:text-emerald-400" />
            Revisão guiada
          </DialogTitle>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {index + 1} de {total}
          </span>
        </div>
        <DialogDescription asChild>
          <Progress value={((index + 1) / total) * 100} className="mt-1 h-1.5" />
        </DialogDescription>
      </DialogHeader>

      {/* Questão */}
      <div className="px-6 py-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn('border text-[10px]', color.badge)}>
            {disc?.shortName ?? ex.disciplineCode}
          </Badge>
          <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
            {ex.topic}
          </Badge>
          <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
            {difficultyLabel[ex.difficulty]}
          </Badge>
          <KindBadges item={item} />
        </div>

        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
          {ex.statement}
        </p>

        {ex.hint && showTip && (
          <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/[0.07] p-3 text-sm leading-relaxed text-sky-800 dark:text-sky-200">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              <Lightbulb className="size-3" /> Dica do Hub
            </p>
            {ex.hint}
          </div>
        )}

        {/* Ações de apoio */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ex.hint && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={onToggleTip}
              aria-expanded={showTip}
            >
              <Lightbulb className="size-3" /> {showTip ? 'Esconder dica' : 'Ver dica'}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-emerald-500/40 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
            onClick={() =>
              openTutor({
                disciplineCode: ex.disciplineCode,
                materialId: ex.linkedMaterials?.[0],
                question: `Estou REVENDO esta questão de ${disc?.shortName ?? ex.disciplineCode} (${ex.topic}) e quero conferir meu raciocínio: "${ex.statement}" — me guie passo a passo, sem entregar a resposta final de uma vez.${ex.hint ? ` A dica do Hub é: "${ex.hint}".` : ''}`,
              })
            }
          >
            <MessageCircleQuestion className="size-3" /> Perguntar ao tutor
          </Button>
          <span className="ml-auto hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
            <Keyboard className="size-3" />
            <kbd className="rounded border bg-muted px-1">1</kbd> consegui ·{' '}
            <kbd className="rounded border bg-muted px-1">2</kbd> ainda não ·{' '}
            <kbd className="rounded border bg-muted px-1">←→</kbd> navegar
          </span>
        </div>
      </div>

      <Separator />

      {/* Autoavaliação */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-xs text-muted-foreground"
          onClick={onBack}
          disabled={index === 0}
        >
          <ArrowLeft className="size-3.5" /> Anterior
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-xs text-muted-foreground"
          onClick={onSkip}
        >
          Pular <ArrowRight className="size-3.5" />
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-rose-500/40 text-xs text-rose-700 hover:bg-rose-500/10 dark:text-rose-400"
            onClick={() => onAssess(false)}
          >
            <X className="size-3.5" /> Ainda não consigo
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-emerald-600 text-xs text-white shadow-sm transition-shadow hover:bg-emerald-600/90 hover:shadow-md"
            onClick={() => onAssess(true)}
          >
            <CheckCircle2 className="size-3.5" /> Consegui resolver
          </Button>
        </div>
      </div>
    </div>
  );
}

function FinishScreen({
  total,
  nowSolved,
  remaining,
  onRepeat,
  onClose,
}: {
  total: number;
  nowSolved: number;
  remaining: number;
  onRepeat: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Trophy className="size-7" />
      </span>
      <DialogHeader className="space-y-1.5">
        <DialogTitle className="text-lg">Revisão concluída</DialogTitle>
        <DialogDescription className="mx-auto max-w-sm text-sm leading-relaxed">
          Você resolveu <strong className="text-emerald-600 dark:text-emerald-400">{nowSolved}</strong> de{' '}
          {total} questão(ões) nesta rodada.
          {remaining > 0
            ? ` As ${remaining} que ainda doem ficam no Caderno de Erros — revise de novo antes da prova.`
            : ' Fila zerada: nenhuma pendência no momento.'}
        </DialogDescription>
      </DialogHeader>
      <Progress value={(nowSolved / total) * 100} className="mt-1 h-2 w-56" />
      <div className="mt-2 flex gap-2">
        {remaining > 0 && (
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" onClick={onRepeat}>
            <NotebookPen className="size-3.5" /> Revisar só as pendentes ({remaining})
          </Button>
        )}
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-600/90"
          onClick={onClose}
        >
          Fechar <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EmptyQueue({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-7" />
      </span>
      <DialogHeader className="space-y-1.5">
        <DialogTitle className="text-lg">Nada para revisar agora</DialogTitle>
        <DialogDescription className="mx-auto max-w-sm text-sm leading-relaxed">
          Marque questões com ★ ou registre &ldquo;precisei de ajuda&rdquo; nas difíceis —
          elas montam esta fila automaticamente para a véspera da prova.
        </DialogDescription>
      </DialogHeader>
      <Button size="sm" className="h-9 bg-emerald-600 text-xs text-white hover:bg-emerald-600/90" onClick={onClose}>
        Voltar aos exercícios
      </Button>
    </div>
  );
}
