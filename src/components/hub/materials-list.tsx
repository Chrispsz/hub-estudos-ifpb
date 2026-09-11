'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  PlayCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  History,
  Sparkles,
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  materials,
  disciplines,
  getMaterialsByDiscipline,
  type Material,
} from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import {
  getColorClasses,
  categoryClasses,
  categoryLabel,
} from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { MaterialSummaryDialog } from './material-summary-dialog';
import { PdfViewerDialog } from './pdf-viewer-dialog';
import { VideoPlayerDialog } from './video-player-dialog';

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

type MaterialStatus = 'notViewed' | 'recent' | 'completed';

// Dados imutáveis — mapa de disciplinas calculado uma única vez (busca O(1)).
const DISCIPLINE_BY_CODE = new Map(disciplines.map((d) => [d.code, d]));

// Badges de status estáticos (ícones fixos) — criados uma única vez.
const STATUS_BADGES: Record<MaterialStatus, React.ReactNode> = {
  notViewed: (
    <Badge
      variant="outline"
      className="border-slate-200 bg-slate-50 text-slate-600 text-[10px] dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300"
    >
      Não visto
    </Badge>
  ),
  recent: (
    <Badge
      variant="outline"
      className="border-teal-200 bg-teal-50 text-teal-700 text-[10px] dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-300"
    >
      <History className="size-2.5" /> Acessado
    </Badge>
  ),
  completed: (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
    >
      <CheckCircle2 className="size-2.5" /> Concluído
    </Badge>
  ),
};

export function MaterialsList() {
  const [videoMaterial, setVideoMaterial] = React.useState<Material | null>(null);
  const sp = useStudyProgress();
  const [selected, setSelected] = React.useState<Material | null>(null);
  const [pdfFor, setPdfFor] = React.useState<Material | null>(null);

  // Conjuntos de IDs (busca O(1)) memoizados — só recalculam quando o progresso muda.
  const completedIds = React.useMemo(
    () => new Set(sp.progress.completedMaterials),
    [sp.progress.completedMaterials],
  );
  const recentIds = React.useMemo(
    () => new Set(sp.progress.recentMaterials.map((r) => r.id)),
    [sp.progress.recentMaterials],
  );

  // Recentes
  const recents = React.useMemo(() => {
    return sp.progress.recentMaterials
      .slice(0, 5)
      .map((r) => materials.find((m) => m.id === r.id))
      .filter((m): m is Material => !!m);
  }, [sp.progress.recentMaterials]);

  // Concluídos
  const completed = React.useMemo(
    () => materials.filter((m) => completedIds.has(m.id)),
    [completedIds],
  );

  // Agrupamento por disciplina (dados estáticos) calculado uma única vez.
  const byDiscipline = React.useMemo(
    () =>
      disciplines.map((d) => ({
        discipline: d,
        items: getMaterialsByDiscipline(d.code),
      })),
    [],
  );

  const notViewedCount = React.useMemo(
    () =>
      materials.filter((m) => !recentIds.has(m.id) && !completedIds.has(m.id)).length,
    [recentIds, completedIds],
  );

  // Handlers estáveis — permitem memoizar as linhas (React.memo no MaterialRow).
  const handleOpen = React.useCallback((m: Material) => setSelected(m), []);
  const handleOpenPdf = React.useCallback((m: Material) => setPdfFor(m), []);
  const handleWatch = React.useCallback((m: Material) => setVideoMaterial(m), []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Resumos IA</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {materials.length} materiais no total — {completed.length} concluídos,{' '}
          {recents.length} recentes, {notViewedCount} não vistos.
        </p>
      </div>

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="h-auto gap-1 rounded-xl bg-muted/50 p-1.5">
          <TabsTrigger value="recent" className="gap-1.5 rounded-lg text-xs">
            <History className="size-3.5" /> Recentes
            <Badge variant="outline" className="border-border text-[10px]">
              {recents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5 rounded-lg text-xs">
            <CheckCircle2 className="size-3.5" /> Concluídos
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              {completed.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5 rounded-lg text-xs">
            <Sparkles className="size-3.5" /> Todos
            <Badge variant="outline" className="border-border text-[10px]">
              {materials.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Recentes */}
        <TabsContent value="recent" className="space-y-3 outline-none">
          {recents.length === 0 ? (
            <EmptyState
              icon={<History className="size-8 text-muted-foreground/60" />}
              title="Nenhum material acessado ainda"
              description="Explore a aba 'Todos' ou 'Disciplinas' para começar a estudar."
            />
          ) : (
            <div className="grid gap-2">
              {recents.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  status="recent"
                  onOpen={handleOpen}
                  onOpenPdf={handleOpenPdf}
                  onWatch={handleWatch}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Concluídos */}
        <TabsContent value="completed" className="space-y-3 outline-none">
          {completed.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-8 text-muted-foreground/60" />}
              title="Nenhum material concluído ainda"
              description="Abra um resumo IA e use o botão 'Marcar como concluído'."
            />
          ) : (
            <div className="grid gap-2">
              {completed.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  status="completed"
                  onOpen={handleOpen}
                  onOpenPdf={handleOpenPdf}
                  onWatch={handleWatch}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Todos */}
        <TabsContent value="all" className="space-y-3 outline-none">
          <Accordion
            type="multiple"
            defaultValue={byDiscipline
              .filter((g) => g.items.length > 0)
              .map((g) => g.discipline.code)}
            className="w-full"
          >
            {byDiscipline.map(({ discipline, items }) => {
              const color = getColorClasses(discipline.color);
              return (
                <AccordionItem
                  key={discipline.code}
                  value={discipline.code}
                  className="rounded-xl border border-border bg-card px-4 shadow-sm first:rounded-t-xl last:rounded-b-xl [&:not(:last-child)]:border-b"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full items-center gap-3 pr-2 text-left">
                      <div
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-lg',
                          color.bgSoft,
                          color.text,
                        )}
                      >
                        <DisciplineIcon name={discipline.icon} className="size-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight">
                          {discipline.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {items.length} {items.length === 1 ? 'material' : 'materiais'} •{' '}
                          {categoryLabel[discipline.category]}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn('shrink-0 border', categoryClasses[discipline.category])}
                      >
                        {items.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {items.length === 0 ? (
                      <p className="py-4 text-sm text-muted-foreground">
                        Sem materiais cadastrados para esta disciplina.
                      </p>
                    ) : (
                      <ul className="grid gap-2 pb-2 pt-1">
                        {items.map((m) => {
                          const status: MaterialStatus = completedIds.has(m.id)
                            ? 'completed'
                            : recentIds.has(m.id)
                              ? 'recent'
                              : 'notViewed';
                          return (
                            <MaterialRow
                              key={m.id}
                              material={m}
                              status={status}
                              onOpen={handleOpen}
                              onOpenPdf={handleOpenPdf}
                              onWatch={handleWatch}
                            />
                          );
                        })}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </TabsContent>
      </Tabs>

      <MaterialSummaryDialog
        material={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
      <VideoPlayerDialog
        material={videoMaterial}
        open={videoMaterial != null}
        onOpenChange={(o) => {
          if (!o) setVideoMaterial(null);
        }}
      />
      <PdfViewerDialog
        material={pdfFor}
        open={!!pdfFor}
        onOpenChange={(o) => !o && setPdfFor(null)}
      />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 rounded-xl bg-muted/30 p-8 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </Card>
  );
}

/**
 * Linha de material — memoizada: handlers estáveis + material imutável fazem
 * a linha re-renderizar apenas quando o próprio status muda.
 */
const MaterialRow = React.memo(function MaterialRow({
  material,
  status,
  onOpen,
  onOpenPdf,
  onWatch,
}: {
  material: Material;
  status: MaterialStatus;
  onOpen: (m: Material) => void;
  onOpenPdf: (m: Material) => void;
  onWatch: (m: Material) => void;
}) {
  const discipline = DISCIPLINE_BY_CODE.get(material.disciplineCode);
  const color = getColorClasses(discipline?.color ?? 'slate');
  const statusBadge = STATUS_BADGES[status];

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium leading-tight">{material.title}</p>
          {statusBadge}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="border-border text-muted-foreground">
            {typeLabel[material.type]}
          </Badge>
          {material.pages ? <span>{material.pages} páginas</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {material.externalUrl && (
          <Button
            size="sm"
            variant="outline"
            className="h-11 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 sm:h-8 dark:text-emerald-400"
            onClick={() => onWatch(material)}
          >
            {material.type === 'video' ? (
              <>
                <PlayCircle className="size-3.5" /> Assistir
              </>
            ) : (
              <>
                <ExternalLink className="size-3.5" /> Abrir
              </>
            )}
          </Button>
        )}
        {material.pdfPath && (
          <Button
            size="sm"
            variant="outline"
            className="h-11 sm:h-8"
            onClick={() => onOpenPdf(material)}
          >
            <FileText className="size-3.5" /> PDF
          </Button>
        )}
        {material.summaryFile && (
          <Button
            size="sm"
            variant="secondary"
            className={cn('h-11 border sm:h-8', color.bgSoft, color.text, color.borderAll)}
            onClick={() => onOpen(material)}
          >
            <Sparkles className="size-3.5" /> Resumo IA
          </Button>
        )}
      </div>
    </motion.li>
  );
});
