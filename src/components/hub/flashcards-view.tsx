'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Layers,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  disciplines,
  getDisciplineByCode,
} from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import {
  flashcardBoxLabel,
  flashcardNextIntervalLabel,
  useStudyProgress,
  type Flashcard,
  type FlashcardGrade,
  type StudyProgressHook,
} from '@/lib/study-progress';

// ---------- Helpers ----------

/** Rótulo amigável do vencimento do cartão. */
function dueLabel(dueAt: string): { text: string; overdue: boolean } {
  const ms = new Date(dueAt).getTime();
  const diff = ms - Date.now();
  if (Number.isNaN(ms)) return { text: 'vencido', overdue: true };
  if (diff <= 0) {
    const lateMin = Math.floor(-diff / 60_000);
    if (lateMin < 60) return { text: `atrasado ${Math.max(1, lateMin)}min`, overdue: true };
    const lateD = Math.floor(lateMin / 1440);
    return { text: lateD >= 1 ? `atrasado ${lateD}d` : 'atrasado', overdue: true };
  }
  const min = Math.ceil(diff / 60_000);
  if (min < 60) return { text: `em ${min}min`, overdue: false };
  const hours = Math.floor(min / 60);
  if (hours < 24) return { text: `em ${hours}h`, overdue: false };
  const days = Math.floor(hours / 24);
  return { text: days === 1 ? 'em 1 dia' : `em ${days} dias`, overdue: false };
}

/** Badge colorido da caixa Leitner (sem azul — violet/amber/teal/emerald). */
function boxBadgeClasses(box: number): string {
  if (box <= 0) return 'border-violet-500/40 bg-violet-500/10 text-violet-400';
  if (box <= 1) return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
  if (box <= 3) return 'border-teal-500/40 bg-teal-500/10 text-teal-400';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
}

/** Tenta extrair um array JSON de flashcards de uma resposta da IA. */
function parseFlashcardsJSON(raw: string): Array<{ front: string; back: string }> | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const arr: unknown = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    const cards = arr
      .map((o) => ({
        front: String((o as Record<string, unknown>)?.front ?? '').trim(),
        back: String((o as Record<string, unknown>)?.back ?? '').trim(),
      }))
      .filter((c) => c.front.length > 0 && c.back.length > 0)
      .slice(0, 10);
    return cards.length > 0 ? cards : null;
  } catch {
    return null;
  }
}

function newCardFields(
  disciplineCode: string,
  front: string,
  back: string,
  source: 'manual' | 'ia',
): Omit<Flashcard, 'id'> {
  const nowIso = new Date().toISOString();
  return {
    disciplineCode,
    front,
    back,
    source,
    createdAt: nowIso,
    box: 0,
    dueAt: nowIso, // nova → disponível imediatamente para revisão
    reviews: 0,
    lapses: 0,
  };
}

// ---------- Baralhos compartilháveis (export/import JSON) ----------

interface DeckFile {
  app: 'hub-estudos-ifpb';
  kind: 'flashcards-deck';
  version: 1;
  exportedAt: string;
  cards: Array<{ disciplineCode: string; front: string; back: string; source: 'manual' | 'ia' }>;
}

function downloadDeck(allCards: Flashcard[]): void {
  const payload: DeckFile = {
    app: 'hub-estudos-ifpb',
    kind: 'flashcards-deck',
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: allCards.map((c) => ({
      disciplineCode: c.disciplineCode,
      front: c.front,
      back: c.back,
      source: c.source,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `baralho-flashcards-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Valida e normaliza um arquivo de baralho importado. */
function parseDeckFile(raw: string): DeckFile['cards'] | null {
  try {
    const data: unknown = JSON.parse(raw);
    const arr = Array.isArray(data)
      ? data
      : (data as DeckFile)?.kind === 'flashcards-deck'
        ? (data as DeckFile).cards
        : null;
    if (!Array.isArray(arr)) return null;
    const validCodes = new Set(disciplines.map((d) => d.code));
    const out = arr
      .map((o) => {
        const rec = o as Record<string, unknown>;
        const code = String(rec?.disciplineCode ?? '').trim();
        return {
          disciplineCode: validCodes.has(code) ? code : '',
          front: String(rec?.front ?? '').trim(),
          back: String(rec?.back ?? '').trim(),
          source: rec?.source === 'ia' ? ('ia' as const) : ('manual' as const),
        };
      })
      .filter((c) => c.front.length > 0 && c.back.length > 0 && c.disciplineCode !== '');
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

// ---------- View principal ----------

export function FlashcardsView() {
  const sp = useStudyProgress();
  const [mode, setMode] = React.useState<'list' | 'review' | 'cram'>('list');
  const [filterDiscipline, setFilterDiscipline] = React.useState<string>('all');
  const [addOpen, setAddOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const stats = sp.flashcardStats;
  const allCards = sp.allFlashcards;

  /** Exporta todos os cartões como baralho JSON compartilhável. */
  const handleExportDeck = React.useCallback(() => {
    if (allCards.length === 0) {
      toast.error('Nenhum cartão para exportar ainda.');
      return;
    }
    downloadDeck(allCards);
    toast.success(`Baralho exportado — ${allCards.length} cartão(ões).`);
  }, [allCards]);

  /** Importa um baralho JSON (dedupe por disciplina + frente). */
  const handleImportDeck = React.useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const raw = await file.text();
        const parsed = parseDeckFile(raw);
        if (!parsed) {
          toast.error('Arquivo inválido — esperado um baralho exportado por este app.');
          return;
        }
        const existing = new Set(
          sp.allFlashcards.map((c) => `${c.disciplineCode}::${c.front.trim().toLowerCase()}`),
        );
        const fresh = parsed
          .filter((c) => !existing.has(`${c.disciplineCode}::${c.front.toLowerCase()}`))
          .map((c) => newCardFields(c.disciplineCode, c.front, c.back, c.source));
        if (fresh.length === 0) {
          toast.info('Todos os cartões do arquivo já existem no seu baralho.');
          return;
        }
        sp.addFlashcards(fresh);
        const dupes = parsed.length - fresh.length;
        toast.success(
          `Importados ${fresh.length} cartão(ões)${dupes > 0 ? ` • ${dupes} duplicado(s) ignorado(s)` : ''}.`,
        );
      } catch {
        toast.error('Não foi possível ler o arquivo do baralho.');
      } finally {
        setImporting(false);
      }
    },
    [sp],
  );

  // Retenção histórica: 1 - lapses/reviews (sobre todos os cartões)
  const retention = React.useMemo(() => {
    const totalReviews = allCards.reduce((acc, c) => acc + c.reviews, 0);
    const totalLapses = allCards.reduce((acc, c) => acc + c.lapses, 0);
    if (totalReviews === 0) return null;
    return Math.round((1 - totalLapses / totalReviews) * 100);
  }, [allCards]);

  const filtered = React.useMemo(() => {
    const list = filterDiscipline === 'all' ? allCards : allCards.filter((c) => c.disciplineCode === filterDiscipline);
    return [...list].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [allCards, filterDiscipline]);

  if (mode === 'review' || mode === 'cram') {
    return (
      <ReviewSession
        cards={mode === 'cram' ? allCards : sp.flashcardsDue}
        cram={mode === 'cram'}
        sp={sp}
        onExit={() => setMode('list')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Layers className="size-5 text-emerald-500" /> Flashcards — revisão espaçada
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Memorize com o método Leitner: cartões errados voltam em 5min, acertos progridem até
            30 dias.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setMode('review')}
            disabled={mounted && stats.due === 0}
            className={cn(
              'bg-emerald-600 text-white hover:bg-emerald-700',
              mounted &&
                stats.due > 0 &&
                'shadow-[0_0_20px_-4px_rgba(16,185,129,0.6)] hover:shadow-[0_0_26px_-2px_rgba(16,185,129,0.75)]',
            )}
            aria-label="Iniciar sessão de revisão"
          >
            <Play className="size-3.5" /> Revisar agora
            {mounted && stats.due > 0 && (
              <Badge className="ml-1 border-0 bg-black/25 text-[10px] text-white">
                {stats.due}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMode('cram')}
            disabled={mounted && stats.total === 0}
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            aria-label="Modo cram: revisar todos os cartões ignorando o agendamento"
            title="Revisa TODOS os cartões, mesmo os que não estão vencidos — ideal antes de provas"
          >
            <Zap className="size-3.5" /> Cram
            {mounted && stats.total > 0 && (
              <Badge className="ml-1 border-0 bg-black/25 text-[10px] text-white">
                {stats.total}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGenerateOpen(true)}
            className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
            aria-label="Gerar flashcards com IA"
          >
            <Sparkles className="size-3.5" /> Gerar com IA
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} aria-label="Criar novo cartão">
            <Plus className="size-3.5" /> Novo cartão
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8 border-border/70 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-300"
            onClick={handleExportDeck}
            disabled={!mounted || stats.total === 0}
            aria-label="Exportar baralho como arquivo JSON"
            title="Exportar baralho (JSON compartilhável)"
          >
            <Download className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8 border-border/70 text-muted-foreground hover:bg-teal-500/10 hover:text-teal-300"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            aria-label="Importar baralho de um arquivo JSON"
            title="Importar baralho (JSON)"
          >
            {importing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportDeck(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard
          icon={<Layers className="size-4" />}
          label="Total de cartões"
          value={String(stats.total)}
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={<CalendarClock className="size-4" />}
          label="Para revisar"
          value={String(stats.due)}
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          icon={<BrainCircuit className="size-4" />}
          label="Aprendendo"
          value={String(stats.learning)}
          color="bg-rose-500/10 text-rose-600 dark:text-rose-400"
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Dominadas"
          value={String(stats.mastered)}
          color="bg-teal-500/10 text-teal-600 dark:text-teal-400"
        />
        <StatCard
          icon={<Target className="size-4" />}
          label="Retenção"
          value={retention === null ? '—' : `${retention}%`}
          color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* Filtro */}
      <Card className="rounded-xl p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium" htmlFor="fc-disc-filter">Disciplina</Label>
            <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
              <SelectTrigger id="fc-disc-filter" className="w-full sm:w-56" aria-label="Filtrar por disciplina">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {disciplines.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {filtered.length} cartão(es)
          </div>
        </div>
      </Card>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 rounded-xl bg-muted/30 p-8 text-center">
          <Layers className="size-8 text-muted-foreground/40" aria-hidden />
          <div>
            <p className="text-sm font-medium">Nenhum cartão por aqui ainda</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie cartões manuais ou peça ao tutor IA para gerar um baralho sobre um tema.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Criar cartão
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
              onClick={() => setGenerateOpen(true)}
            >
              <Sparkles className="size-3.5" /> Gerar com IA
            </Button>
          </div>
        </Card>
      ) : (
        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {filtered.map((card) => {
            const disc = getDisciplineByCode(card.disciplineCode);
            const color = getColorClasses(disc?.color ?? 'slate');
            const due = dueLabel(card.dueAt);
            return (
              <Card
                key={card.id}
                className={cn(
                  'group rounded-xl bg-card p-3.5 shadow-sm transition-colors duration-200 hover:border-emerald-500/30',
                  due.overdue && 'border-l-4 border-l-amber-500',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn('border text-[10px]', color.badge)}>
                    {disc?.shortName ?? card.disciplineCode}
                  </Badge>
                  <Badge variant="outline" className={cn('border text-[10px]', boxBadgeClasses(card.box))}>
                    {flashcardBoxLabel(card.box)}
                  </Badge>
                  {card.source === 'ia' && (
                    <Badge
                      variant="outline"
                      className="border-violet-500/40 bg-violet-500/10 text-[10px] text-violet-400"
                    >
                      <Sparkles className="size-2.5" /> IA
                    </Badge>
                  )}
                  <span
                    className={cn(
                      'ml-auto inline-flex items-center gap-1 text-[11px]',
                      due.overdue ? 'font-medium text-amber-500' : 'text-muted-foreground',
                    )}
                  >
                    <Clock className="size-3" aria-hidden /> {due.text}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground opacity-60 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                    onClick={() => {
                      sp.removeFlashcard(card.id);
                      toast.info('Cartão removido');
                    }}
                    aria-label={`Remover cartão: ${card.front.slice(0, 40)}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <p className="mt-2 text-sm font-medium leading-snug text-foreground/90">
                  {card.front}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {card.back}
                </p>
                <div className="mt-2 flex gap-3 border-t pt-2 text-[10px] text-muted-foreground/70">
                  <span>{card.reviews} revisões</span>
                  {card.lapses > 0 && <span className="text-rose-400/80">{card.lapses} erros</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Diálogos */}
      <AddCardDialog open={addOpen} onOpenChange={setAddOpen} sp={sp} />
      <GenerateCardsDialog open={generateOpen} onOpenChange={setGenerateOpen} sp={sp} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="rounded-xl bg-card p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className={cn('grid size-8 place-items-center rounded-lg', color)}>{icon}</span>
      </div>
      <p className="mt-3 text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium text-foreground/80">{label}</p>
    </Card>
  );
}

// ---------- Sessão de revisão ----------

function ReviewSession({
  cards,
  cram = false,
  sp,
  onExit,
}: {
  cards: Flashcard[];
  /** Modo cram: revisa TUDO ignorando o agendamento (véspera de prova). */
  cram?: boolean;
  sp: StudyProgressHook;
  onExit: () => void;
}) {
  const [queue, setQueue] = React.useState<Flashcard[]>(() => [...cards]);
  const [flipped, setFlipped] = React.useState(false);
  const [reviewed, setReviewed] = React.useState(0);
  const [againCount, setAgainCount] = React.useState(0);
  const totalPlanned = queue.length + reviewed;

  const current = queue[0];
  const finished = queue.length === 0 && reviewed > 0;

  const grade = (g: FlashcardGrade) => {
    if (!current) return;
    sp.gradeFlashcard(current.id, g);
    setReviewed((r) => r + 1);
    if (g === 'again') setAgainCount((a) => a + 1);
    setQueue((q) => {
      const [, ...rest] = q;
      return g === 'again' ? [...rest, current] : rest;
    });
    setFlipped(false);
  };

  // Atalhos de teclado: Espaço/Enter viram o cartão, 1-4 aplicam notas.
  // Usa fase de captura + stopPropagation para SUPRIMIR os atalhos globais
  // da Command Palette (1-8 trocam de aba) enquanto a sessão está ativa.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (finished) return;
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      // Espaço/Enter/1-8 são nossos durante a sessão — impede scroll e troca de aba
      if (e.code === 'Space' || e.key === 'Enter' || /^[1-8]$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (el instanceof HTMLButtonElement) el.blur();
      if (e.code === 'Space' || e.key === 'Enter') {
        setFlipped((f) => !f);
        return;
      }
      if (flipped && current) {
        if (e.key === '1') grade('again');
        else if (e.key === '2') grade('hard');
        else if (e.key === '3') grade('good');
        else if (e.key === '4') grade('easy');
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [flipped, finished, current?.id, grade]);

  if (finished) {
    const accuracy = reviewed - againCount;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="mx-auto max-w-md"
      >
        <Card className="flex flex-col items-center gap-4 rounded-2xl border-emerald-500/30 bg-card p-8 text-center shadow-[0_0_40px_-12px_rgba(16,185,129,0.4)]">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
          >
            <CheckCircle2 className="size-14 text-emerald-500" aria-hidden />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold">Sessão concluída! 🎉</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {reviewed} {reviewed === 1 ? 'revisão feita' : 'revisões feitas'}
              {againCount > 0 && ` • ${againCount} para refazer em 5min`}
            </p>
          </div>
          <div className="flex w-full items-center justify-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 px-4 py-2">
              <p className="text-lg font-bold text-emerald-500">
                {reviewed > 0 ? Math.round((accuracy / reviewed) * 100) : 0}%
              </p>
              <p className="text-[10px] text-muted-foreground">acerto</p>
            </div>
            <div className="rounded-lg bg-rose-500/10 px-4 py-2">
              <p className="text-lg font-bold text-rose-500">{againCount}</p>
              <p className="text-[10px] text-muted-foreground">erros</p>
            </div>
          </div>
          <Button onClick={onExit} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <RotateCcw className="size-4" /> Voltar à lista
          </Button>
        </Card>
      </motion.div>
    );
  }

  if (!current) {
    return (
      <Card className="flex flex-col items-center gap-3 rounded-xl bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">Nada para revisar neste momento.</p>
        <Button size="sm" variant="outline" onClick={onExit}>
          Voltar à lista
        </Button>
      </Card>
    );
  }

  const disc = getDisciplineByCode(current.disciplineCode);
  const color = getColorClasses(disc?.color ?? 'slate');
  const progressPct = totalPlanned > 0 ? (reviewed / totalPlanned) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Topo da sessão */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {cram && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-400"
            >
              <Zap className="size-3" /> Cram — tudo
            </Badge>
          )}
          <Badge variant="outline" className={cn('border text-[10px]', color.badge)}>
            {disc?.shortName ?? current.disciplineCode}
          </Badge>
          <Badge variant="outline" className={cn('border text-[10px]', boxBadgeClasses(current.box))}>
            {flashcardBoxLabel(current.box)}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onExit} aria-label="Encerrar sessão de revisão">
          <X className="size-4" /> Encerrar
        </Button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>
            {reviewed} de {totalPlanned} revisões
          </span>
          <span>{queue.length} na fila</span>
        </div>
        <Progress value={progressPct} className="h-1.5" aria-label="Progresso da sessão" />
      </div>

      {/* Cartão com flip 3D */}
      <div className="[perspective:1400px]">
        <motion.div
          className="relative min-h-[280px] [transform-style:preserve-3d]"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
        >
          {/* Frente */}
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="absolute inset-0 flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition-colors hover:border-emerald-500/40 [backface-visibility:hidden]"
            aria-label="Ver resposta do cartão"
          >
            <Badge variant="outline" className={cn('border text-[10px]', color.badge)}>
              {disc?.shortName ?? current.disciplineCode}
            </Badge>
            <p className="text-lg font-medium leading-relaxed text-foreground">
              {current.front}
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500">
              <Eye className="size-3.5" aria-hidden /> Mostrar resposta
            </span>
            <span className="absolute bottom-3 right-4 text-[10px] text-muted-foreground/50">
              Espaço para virar
            </span>
          </button>

          {/* Verso */}
          <div
            className="absolute inset-0 flex flex-col rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-[0_0_36px_-14px_rgba(16,185,129,0.5)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
            aria-hidden={!flipped}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resposta
            </p>
            <div className="mt-2 flex-1 overflow-y-auto [scrollbar-width:thin]">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {current.back}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Botões de nota */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <GradeButton label="Errei" hint={flashcardNextIntervalLabel(current.box, 'again')} hotkey="1" color="rose" onClick={() => grade('again')} />
            <GradeButton label="Difícil" hint={flashcardNextIntervalLabel(current.box, 'hard')} hotkey="2" color="amber" onClick={() => grade('hard')} />
            <GradeButton label="Bom" hint={flashcardNextIntervalLabel(current.box, 'good')} hotkey="3" color="emerald" onClick={() => grade('good')} />
            <GradeButton label="Fácil" hint={flashcardNextIntervalLabel(current.box, 'easy')} hotkey="4" color="teal" onClick={() => grade('easy')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const GRADE_STYLES: Record<string, string> = {
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20',
  teal: 'border-teal-500/40 bg-teal-500/10 text-teal-500 hover:bg-teal-500/20',
};

function GradeButton({
  label,
  hint,
  hotkey,
  color,
  onClick,
}: {
  label: string;
  hint: string;
  hotkey: string;
  color: keyof typeof GRADE_STYLES;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-95',
        GRADE_STYLES[color],
      )}
    >
      {label}
      <span className="text-[10px] font-normal opacity-75">{hint}</span>
      <kbd className="pointer-events-none rounded border border-current/30 px-1 text-[9px] opacity-60">
        {hotkey}
      </kbd>
    </button>
  );
}

// ---------- Diálogo: novo cartão manual ----------

function AddCardDialog({
  open,
  onOpenChange,
  sp,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sp: StudyProgressHook;
}) {
  const [disciplineCode, setDisciplineCode] = React.useState<string>(disciplines[0].code);
  const [front, setFront] = React.useState('');
  const [back, setBack] = React.useState('');

  function handleAdd() {
    if (!front.trim() || !back.trim()) {
      toast.error('Preencha a frente e o verso do cartão.');
      return;
    }
    sp.addFlashcards([newCardFields(disciplineCode, front.trim(), back.trim(), 'manual')]);
    toast.success('Cartão adicionado ao baralho!');
    setFront('');
    setBack('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-emerald-500" /> Novo cartão
          </DialogTitle>
          <DialogDescription>
            Frente = pergunta, verso = resposta. O cartão entra na fila de revisão imediatamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fc-add-disc">Disciplina</Label>
            <Select value={disciplineCode} onValueChange={setDisciplineCode}>
              <SelectTrigger id="fc-add-disc" aria-label="Disciplina do cartão">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {disciplines.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-add-front">Frente (pergunta)</Label>
            <Textarea
              id="fc-add-front"
              rows={2}
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Ex.: O que faz a função len() em Python?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-add-back">Verso (resposta)</Label>
            <Textarea
              id="fc-add-back"
              rows={3}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Ex.: Retorna o número de itens de uma sequência (lista, string, tupla...)."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="size-4" /> Cancelar
          </Button>
          <Button onClick={handleAdd} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Diálogo: gerar com IA ----------

function GenerateCardsDialog({
  open,
  onOpenChange,
  sp,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sp: StudyProgressHook;
}) {
  const [disciplineCode, setDisciplineCode] = React.useState<string>(disciplines[0].code);
  const [topic, setTopic] = React.useState('');
  const [count, setCount] = React.useState<string>('5');
  const [loading, setLoading] = React.useState(false);
  const [generated, setGenerated] = React.useState<Array<{ front: string; back: string }>>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setGenerated([]);
      setError(null);
      setTopic('');
    }
  }, [open]);

  const disc = getDisciplineByCode(disciplineCode);

  async function handleGenerate() {
    const theme = topic.trim();
    if (theme.length < 3) {
      toast.error('Descreva o tema (mín. 3 caracteres).');
      return;
    }
    setLoading(true);
    setError(null);
    setGenerated([]);
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'flashcards',
          discipline: disc?.name ?? disciplineCode,
          topic: theme,
          question: `Gere ${count} flashcards sobre: ${theme}`,
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) {
        throw new Error(data.error ?? 'Falha ao gerar cartões.');
      }
      const parsed = parseFlashcardsJSON(data.answer);
      if (!parsed) {
        throw new Error('A IA respondeu em um formato inesperado. Tente novamente.');
      }
      setGenerated(parsed);
      toast.success(`${parsed.length} cartões gerados — revise e importe.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleImport() {
    if (generated.length === 0) return;
    sp.addFlashcards(
      generated.map((c) => newCardFields(disciplineCode, c.front, c.back, 'ia')),
    );
    toast.success(`${generated.length} cartões importados para o baralho!`);
    setGenerated([]);
    onOpenChange(false);
  }

  function updateGenerated(i: number, patch: Partial<{ front: string; back: string }>) {
    setGenerated((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-400" /> Gerar flashcards com IA
          </DialogTitle>
          <DialogDescription>
            O tutor IA cria cartões no formato pergunta/resposta sobre o tema escolhido. Você
            revisa antes de importar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fc-ia-disc">Disciplina</Label>
              <Select value={disciplineCode} onValueChange={setDisciplineCode}>
                <SelectTrigger id="fc-ia-disc" aria-label="Disciplina para os cartões">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-ia-count">Quantidade</Label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger id="fc-ia-count" aria-label="Quantidade de cartões">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 cartões</SelectItem>
                  <SelectItem value="5">5 cartões</SelectItem>
                  <SelectItem value="6">6 cartões</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-ia-topic">Tema</Label>
            <Input
              id="fc-ia-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex.: Estruturas de repetição while e for"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading && generated.length === 0) handleGenerate();
              }}
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-violet-500/10 p-4 text-sm text-violet-300">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Gerando cartões com IA...
            </div>
          )}

          {error && !loading && (
            <p className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400">{error}</p>
          )}

          {generated.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Prévia editável — {generated.length} cartão(ões):
              </p>
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {generated.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-violet-400">
                        #{i + 1}
                      </span>
                      <Input
                        value={c.front}
                        onChange={(e) => updateGenerated(i, { front: e.target.value })}
                        className="h-8 border-none bg-transparent px-1.5 text-xs font-medium focus-visible:ring-1"
                        aria-label={`Frente do cartão ${i + 1}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0 text-muted-foreground hover:text-rose-400"
                        onClick={() => setGenerated((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remover cartão ${i + 1} da prévia`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <Textarea
                      value={c.back}
                      onChange={(e) => updateGenerated(i, { back: e.target.value })}
                      rows={2}
                      className="mt-1 border-none bg-transparent px-1.5 text-xs focus-visible:ring-1"
                      aria-label={`Verso do cartão ${i + 1}`}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="size-4" /> {generated.length > 0 ? 'Descartar' : 'Cancelar'}
          </Button>
          {generated.length === 0 ? (
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Gerar
            </Button>
          ) : (
            <Button onClick={handleImport} className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="size-4" /> Importar {generated.length} cartão(ões)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
