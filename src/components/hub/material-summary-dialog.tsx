'use client';

import * as React from 'react';
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Code2,
  ExternalLink,
  FileText,
  Flag,
  Lightbulb,
  ListOrdered,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Material, Discipline } from '@/data/course-data';
import { getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { useStudyProgress } from '@/lib/study-progress';
import { cn } from '@/lib/utils';
import { PdfViewerDialog } from './pdf-viewer-dialog';

interface AiSummary {
  titulo?: string;
  disciplina?: string;
  tipo?: string;
  tempo_estudo_minutos?: number;
  resumo_geral?: string;
  conceitos_chave?: {
    conceito: string;
    explicacao: string;
    exemplo?: string;
  }[];
  pontos_importantes?: string[];
  formulas_regras?: string[];
  erros_comuns?: string[];
  exercicios_sugeridos?: string[];
  proximos_passos?: string[];
  perguntas_autoavaliacao?: string[];
}

interface Props {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabel: Record<Material['type'], string> = {
  slides: 'Slides',
  lista_exercicios: 'Lista de Exercícios',
  web_page: 'Web (HTML)',
  introducao: 'Introdução',
  ementa: 'Plano de Disciplina',
  video: 'Vídeo',
  pdf: 'PDF',
  calendar: 'Calendário',
};

// Cache simples em memória (session) para evitar re-fetching
const summaryCache = new Map<string, AiSummary>();

/** Botões de ação: alvo de toque ≥44px no mobile, compacto no desktop. */
const touchBtn = 'h-11 sm:h-8';

export function MaterialSummaryDialog({ material, open, onOpenChange }: Props) {
  const sp = useStudyProgress();
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<AiSummary | null>(null);
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [message, setMessage] = React.useState<string>('');
  const [pdfOpen, setPdfOpen] = React.useState(false);

  const discipline: Discipline | undefined = material
    ? getDisciplineByCode(material.disciplineCode)
    : undefined;
  const color = getColorClasses(discipline?.color ?? 'slate');

  const markAccessed = sp.markAccessed;

  const loadSummary = React.useCallback(
    async (mat: Material, showToasts = false) => {
      if (!mat.summaryFile) {
        setAvailable(false);
        setMessage('Este material não possui resumo IA.');
        setSummary(null);
        return;
      }
      // Marca como acessado (uma vez, sem causar loop)
      markAccessed(mat.id);

      // Cache hit?
      if (summaryCache.has(mat.summaryFile)) {
        setAvailable(true);
        setSummary(summaryCache.get(mat.summaryFile) ?? null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setAvailable(null);
      try {
        const res = await fetch(`/data/ai-summaries/${mat.summaryFile}`);
        if (!res.ok) {
          setAvailable(false);
          setMessage('Resumo indisponível. Tente novamente mais tarde.');
          setSummary(null);
          return;
        }
        const data = (await res.json()) as AiSummary;
        summaryCache.set(mat.summaryFile, data);
        setAvailable(true);
        setSummary(data);
        if (showToasts) toast.success('Resumo recarregado.');
      } catch {
        setAvailable(false);
        setMessage('Falha ao carregar o resumo. Verifique sua conexão.');
        if (showToasts) toast.error('Falha ao carregar.');
      } finally {
        setLoading(false);
      }
    },
    [markAccessed],
  );

  React.useEffect(() => {
    if (!open || !material) {
      setSummary(null);
      setAvailable(null);
      setMessage('');
      return;
    }
    loadSummary(material);
  }, [open, material, loadSummary]);

  const completed = material
    ? sp.progress.completedMaterials.includes(material.id)
    : false;

  // Derivações memoizadas: evitam recriar o mapa de checks e recontar a cada render.
  const autoavaliacaoChecks = sp.progress.autoavaliacaoChecks;
  const materialId = material?.id ?? '';
  const checksForMaterial = React.useMemo(
    () => (materialId ? autoavaliacaoChecks[materialId] ?? {} : {}),
    [autoavaliacaoChecks, materialId],
  );
  const totalQuestions = summary?.perguntas_autoavaliacao?.length ?? 0;
  const answeredCount = React.useMemo(
    () => Object.values(checksForMaterial).filter(Boolean).length,
    [checksForMaterial],
  );

  // Handlers estáveis passados ao SummaryBody (React.memo) — evitam re-render
  // de todo o resumo a cada troca de estado do pai.
  const handleToggleCheck = React.useCallback(
    (i: number) => {
      if (material) sp.toggleAutoavaliacao(material.id, i);
    },
    [material, sp.toggleAutoavaliacao],
  );
  const handleReload = React.useCallback(() => {
    if (material) loadSummary(material, true);
  }, [material, loadSummary]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0 sm:max-w-3xl">
        <div className={cn('border-b p-5 sm:p-6', color.bgSoft, color.borderAll)}>
          <DialogHeader className="text-left">
            <div className="flex flex-wrap items-center gap-2">
              {material && (
                <Badge variant="outline" className={cn('border', color.badge)}>
                  {typeLabel[material.type]}
                </Badge>
              )}
              {material && (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {discipline?.shortName ?? material.disciplineCode}
                </Badge>
              )}
              {material?.pages ? (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {material.pages} páginas
                </Badge>
              ) : null}
              {completed && (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  <CheckCircle2 className="size-3" aria-hidden /> Concluído
                </Badge>
              )}
            </div>
            <DialogTitle className="mt-2 text-xl leading-tight">
              {material?.title ?? 'Resumo IA'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Resumo gerado por IA com conceitos, pontos importantes, erros comuns,
              exercícios e perguntas de autoavaliação.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-5 sm:p-6">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Loader2 className={cn('size-8 animate-spin', color.text)} />
                <p className="text-sm text-muted-foreground">
                  Carregando resumo…
                </p>
              </div>
            ) : available === false ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className={cn('grid size-12 place-items-center rounded-full', color.bgSoft, color.text)}>
                  <BookOpenText className="size-6" />
                </div>
                <p className="text-sm text-foreground">
                  {message || 'Resumo em geração, tente novamente em alguns minutos.'}
                </p>
                {material && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadSummary(material, true)}
                  >
                    <RefreshCw className="size-4" /> Tentar novamente
                  </Button>
                )}
              </div>
            ) : summary ? (
              <SummaryBody
                summary={summary}
                color={color}
                materialId={material?.id ?? ''}
                checks={checksForMaterial}
                onToggle={handleToggleCheck}
                onReload={handleReload}
                answeredCount={answeredCount}
                totalQuestions={totalQuestions}
              />
            ) : null}
          </div>
        </ScrollArea>

        {/* Ações no rodapé do modal */}
        {material && (
          <div className="flex flex-wrap gap-2 border-t bg-muted/40 p-3">
            {material.pdfPath && (
              <Button
                size="sm"
                variant="secondary"
                className={touchBtn}
                onClick={() => setPdfOpen(true)}
              >
                <ExternalLink className="size-3.5" aria-hidden /> Abrir PDF
              </Button>
            )}
            <Button
              size="sm"
              variant={completed ? 'outline' : 'default'}
              className={cn(
                touchBtn,
                !completed && 'bg-emerald-600 text-white hover:bg-emerald-700',
              )}
              aria-pressed={completed}
              onClick={() => {
                if (completed) {
                  sp.unmarkCompleted(material.id, material.disciplineCode);
                  toast.success('Removido de concluídos.');
                } else {
                  sp.markCompleted(material.id, material.disciplineCode);
                  toast.success('Marcado como concluído!');
                }
              }}
            >
              {completed ? (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-600" /> Concluído
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" /> Marcar concluído
                </>
              )}
            </Button>
            {material.externalUrl && (
              <Button asChild size="sm" variant="outline" className={touchBtn}>
                <a href={material.externalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" aria-hidden /> Link externo
                </a>
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      {material && (
        <PdfViewerDialog
          material={material}
          open={pdfOpen}
          onOpenChange={setPdfOpen}
        />
      )}
    </Dialog>
  );
}

function Section({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className={cn('flex items-center gap-2 text-sm font-semibold', color)}>
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

const SummaryBody = React.memo(function SummaryBody({
  summary,
  color,
  materialId,
  checks,
  onToggle,
  onReload,
  answeredCount,
  totalQuestions,
}: {
  summary: AiSummary;
  color: ReturnType<typeof getColorClasses>;
  materialId: string;
  checks: { [k: number]: boolean };
  onToggle: (i: number) => void;
  onReload: () => void;
  answeredCount: number;
  totalQuestions: number;
}) {
  const conceitos = summary.conceitos_chave ?? [];
  const pontos = summary.pontos_importantes ?? [];
  const formulas = summary.formulas_regras ?? [];
  const erros = summary.erros_comuns ?? [];
  const exercicios = summary.exercicios_sugeridos ?? [];
  const proximos = summary.proximos_passos ?? [];
  const perguntas = summary.perguntas_autoavaliacao ?? [];

  return (
    <div className="space-y-6">
      {summary.resumo_geral && (
        <Section icon={<BookOpenText className="size-4" />} title="Resumo Geral" color={color.text}>
          <p className="text-sm leading-relaxed text-foreground/90">
            {summary.resumo_geral}
          </p>
          {typeof summary.tempo_estudo_minutos === 'number' && (
            <Badge variant="outline" className="mt-2 border-border text-muted-foreground">
              <PlayCircle className="size-3" /> ~{summary.tempo_estudo_minutos} min de estudo
            </Badge>
          )}
        </Section>
      )}

      {conceitos.length > 0 && (
        <Section icon={<Lightbulb className="size-4" />} title="Conceitos Chave" color={color.text}>
          <div className="grid gap-2 sm:grid-cols-2">
            {conceitos.map((c, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/30 p-3">
                <p className={cn('text-sm font-semibold', color.text)}>{c.conceito}</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                  {c.explicacao}
                </p>
                {c.exemplo && (
                  <p className="mt-2 rounded bg-card p-2 text-xs italic text-muted-foreground">
                    <span className="font-medium not-italic">Ex.: </span>
                    {c.exemplo}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {pontos.length > 0 && (
        <Section icon={<CheckCircle2 className="size-4" />} title="Pontos Importantes" color={color.text}>
          <ul className="grid gap-1.5">
            {pontos.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                <CheckCircle2 className={cn('mt-0.5 size-4 shrink-0', color.text)} />
                {p}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {formulas.length > 0 && (
        <Section icon={<Code2 className="size-4" />} title="Fórmulas e Regras" color={color.text}>
          <div className="overflow-hidden rounded-md border border-border bg-muted/40">
            {formulas.map((f, i) => (
              <div key={i} className="border-b border-border p-2.5 last:border-b-0">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                  {f}
                </pre>
              </div>
            ))}
          </div>
        </Section>
      )}

      {erros.length > 0 && (
        <Section icon={<AlertTriangle className="size-4" aria-hidden />} title="Erros Comuns" color="text-amber-700 dark:text-amber-400">
          <ul className="grid gap-1.5">
            {erros.map((e, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {e}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {exercicios.length > 0 && (
        <Section icon={<ListOrdered className="size-4" />} title="Exercícios Sugeridos" color={color.text}>
          <ol className="grid gap-1.5">
            {exercicios.map((ex, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-sm text-foreground/85"
              >
                <span className={cn('font-semibold', color.text)}>{i + 1}.</span>
                {ex}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {proximos.length > 0 && (
        <Section icon={<Flag className="size-4" />} title="Próximos Passos" color={color.text}>
          <ul className="grid gap-1.5">
            {proximos.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                <Plus className={cn('mt-0.5 size-4 shrink-0', color.text)} />
                {p}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {perguntas.length > 0 && (
        <Section icon={<CircleHelp className="size-4" />} title="Perguntas de Autoavaliação" color={color.text}>
          <p className="mb-2 text-xs text-muted-foreground">
            Marque quando souber responder com confiança. Suas respostas ficam salvas.
          </p>
          <ul className="grid gap-1.5">
            {perguntas.map((p, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm hover:bg-muted/50 sm:p-2.5">
                  <Checkbox
                    checked={!!checks[i]}
                    onCheckedChange={() => onToggle(i)}
                    className="mt-0.5"
                  />
                  <span
                    className={cn(
                      'text-foreground/85',
                      checks[i] && 'text-muted-foreground line-through',
                    )}
                  >
                    {p}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Separator />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ClipboardList className="size-3.5" />
          {answeredCount} / {totalQuestions} perguntas respondidas
        </span>
        <Button size="sm" variant="ghost" onClick={onReload} className="h-11 text-xs sm:h-7">
          <RefreshCw className="size-3" aria-hidden /> Recarregar
        </Button>
      </div>
    </div>
  );
});
