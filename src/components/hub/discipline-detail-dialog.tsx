'use client';

import * as React from 'react';
import {
  PlayCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutList,
  Library,
  Lightbulb,
  ListChecks,
  Scale,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { Discipline, Material } from '@/data/course-data';
import { getMaterialsByDiscipline, evaluationPeriods } from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import {
  getColorClasses,
  priorityClasses,
  categoryClasses,
  categoryLabel,
} from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { MaterialSummaryDialog } from './material-summary-dialog';
import { PdfViewerDialog } from './pdf-viewer-dialog';
import { VideoPlayerDialog } from './video-player-dialog';

interface Props {
  discipline: Discipline | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
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

export function DisciplineDetailDialog({ discipline, open, onOpenChange, initialTab }: Props) {
  const [summaryFor, setSummaryFor] = React.useState<Material | null>(null);
  const [pdfFor, setPdfFor] = React.useState<Material | null>(null);
  const [videoFor, setVideoFor] = React.useState<Material | null>(null);
  const [tab, setTab] = React.useState(initialTab ?? 'overview');

  React.useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  if (!discipline) return null;

  const color = getColorClasses(discipline.color);
  const mats = getMaterialsByDiscipline(discipline.code);
  const evals = evaluationPeriods.filter(
    (e) => e.disciplineCode === discipline.code,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl gap-0 p-0 sm:max-w-4xl">
          <div
            className={cn(
              'flex flex-col gap-2 border-b p-5 sm:p-6',
              color.bgSoft,
              color.borderAll,
            )}
          >
            <DialogHeader className="text-left">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'grid size-11 shrink-0 place-items-center rounded-lg bg-card shadow-sm',
                    color.text,
                  )}
                >
                  <DisciplineIcon name={discipline.icon} className="size-6" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl leading-tight">
                    {discipline.name}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-muted-foreground">
                    {discipline.code} • {discipline.chTotal}h totais •{' '}
                    {discipline.chWeekly}h/semana
                  </DialogDescription>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" className={priorityClasses[discipline.prioridade]}>
                  Prioridade {discipline.prioridade}
                </Badge>
                <Badge variant="outline" className={categoryClasses[discipline.category]}>
                  {categoryLabel[discipline.category]}
                </Badge>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  <GraduationCap className="size-3" /> {discipline.professor}
                  {discipline.professorTitle ? ` · ${discipline.professorTitle}` : ''}
                </Badge>
              </div>
            </DialogHeader>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="border-b bg-muted/30 px-4">
              <TabsList className="h-auto gap-1 bg-transparent p-1.5">
                <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
                <TabsTrigger value="content" className="text-xs">Conteúdo</TabsTrigger>
                <TabsTrigger value="evaluation" className="text-xs">Avaliação</TabsTrigger>
                <TabsTrigger value="materials" className="text-xs">Materiais</TabsTrigger>
                <TabsTrigger value="tips" className="text-xs">Dicas</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="max-h-[60vh]">
              <div className="p-5 sm:p-6">
                <TabsContent value="overview" className="mt-0 space-y-5 outline-none">
                  <Section icon={<BookOpen className="size-4" />} title="Ementa" color={color.text}>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {discipline.ementa}
                    </p>
                  </Section>

                  <Section icon={<GraduationCap className="size-4" />} title="Professor" color={color.text}>
                    <p className="text-sm text-foreground/90">
                      {discipline.professor}
                      {discipline.professorTitle ? ` — ${discipline.professorTitle}` : ''}
                    </p>
                  </Section>

                  <Section icon={<Sparkles className="size-4" />} title="Objetivos" color={color.text}>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Geral
                        </p>
                        <p className="mt-0.5 text-sm text-foreground/90">
                          {discipline.objetivos.geral}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Específicos
                        </p>
                        <ul className="mt-0.5 grid gap-1">
                          {discipline.objetivos.especificos.map((e, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                              <CheckCircle2 className={cn('mt-0.5 size-4 shrink-0', color.text)} />
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Section>

                  {discipline.ordemEstudo && discipline.ordemEstudo.length > 0 && (
                    <Section icon={<LayoutList className="size-4" />} title="Ordem de estudo recomendada" color={color.text}>
                      <ol className="grid gap-1.5">
                        {discipline.ordemEstudo.map((o, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-sm text-foreground/90"
                          >
                            <span className={cn('font-semibold', color.text)}>{i + 1}.</span>
                            {o}
                          </li>
                        ))}
                      </ol>
                    </Section>
                  )}

                  {discipline.datasImportantes && discipline.datasImportantes.length > 0 && (
                    <Section icon={<CalendarDays className="size-4" />} title="Datas importantes" color={color.text}>
                      <ul className="grid gap-1.5">
                        {discipline.datasImportantes.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                            <Badge variant="outline" className={cn('shrink-0 border text-[11px]', color.badge)}>
                              {d.data}
                            </Badge>
                            <span>{d.descricao}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </TabsContent>

                <TabsContent value="content" className="mt-0 space-y-5 outline-none">
                  <Section icon={<ListChecks className="size-4" />} title="Conteúdo Programático" color={color.text}>
                    <Accordion type="multiple" className="w-full">
                      {discipline.conteudoProgramatico.map((u, i) => (
                        <AccordionItem key={i} value={`u-${i}`}>
                          <AccordionTrigger className="text-sm font-medium hover:no-underline">
                            {u.unidade}
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="grid gap-1.5 pl-1">
                              {u.topicos.map((t, j) => (
                                <li
                                  key={j}
                                  className="flex items-start gap-2 text-sm text-foreground/85"
                                >
                                  <span
                                    className={cn(
                                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                                      color.dot,
                                    )}
                                  />
                                  {t}
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </Section>
                </TabsContent>

                <TabsContent value="evaluation" className="mt-0 space-y-5 outline-none">
                  <Section icon={<Scale className="size-4" />} title="Método de avaliação" color={color.text}>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {discipline.avaliacao}
                    </p>
                    {discipline.criteriosAprovacao && (
                      <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                        <span className="font-medium">Critério de aprovação: </span>
                        <span className="text-muted-foreground">
                          {discipline.criteriosAprovacao}
                        </span>
                      </div>
                    )}
                    {discipline.finalExamFormula && (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <span className="font-medium">Fórmula final: </span>
                        <code className="font-mono text-xs">{discipline.finalExamFormula}</code>
                      </div>
                    )}
                  </Section>

                  <Section icon={<FileText className="size-4" />} title="Componentes da nota" color={color.text}>
                    <div className="overflow-hidden rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Componente</TableHead>
                            <TableHead className="w-16 text-right">Peso</TableHead>
                            <TableHead className="w-16 text-right">Escala</TableHead>
                            <TableHead>Descrição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {discipline.gradeComponents.map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className="text-right tabular-nums">{c.weight}%</TableCell>
                              <TableCell className="text-right tabular-nums">0-{c.scale}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{c.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Section>

                  {evals.length > 0 && (
                    <Section icon={<CalendarDays className="size-4" />} title="Períodos de avaliação" color={color.text}>
                      <ul className="grid gap-1.5">
                        {evals.map((e, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                            <Badge variant="outline" className={cn('shrink-0 border text-[11px]', color.badge)}>
                              {e.date
                                ? new Date(`${e.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                                : 'A definir'}
                            </Badge>
                            <span>
                              <span className="font-medium">{e.evaluationName}</span>
                              {' — '}
                              {e.description}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {evals.some((e) => !e.date) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          📅 Data não divulgada pelo professor — o app nunca mostra prazo estimado.
                        </p>
                      )}
                    </Section>
                  )}

                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <p className="text-foreground/90">
                      💡 Use a aba <span className="font-semibold">Calculadora de Médias</span> para
                      simular suas notas e ver a situação.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="materials" className="mt-0 space-y-3 outline-none">
                  <Section icon={<FileText className="size-4" />} title={`Materiais (${mats.length})`} color={color.text}>
                    {mats.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sem materiais cadastrados para esta disciplina.
                      </p>
                    ) : (
                      <ul className="grid gap-2">
                        {mats.map((m) => (
                          <li
                            key={m.id}
                            className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight">
                                {m.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Badge variant="outline" className="border-border text-muted-foreground">
                                  {typeLabel[m.type]}
                                </Badge>
                                {m.pages ? <span>{m.pages} páginas</span> : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {m.externalUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                                  onClick={() => setVideoFor(m)}
                                >
                                  {m.type === 'video' ? (
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
                              {m.pdfPath && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => setPdfFor(m)}
                                >
                                  <FileText className="size-3.5" /> Abrir PDF
                                </Button>
                              )}
                              {m.summaryFile && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className={cn('h-8 border', color.bgSoft, color.text, color.borderAll)}
                                  onClick={() => setSummaryFor(m)}
                                >
                                  <Sparkles className="size-3.5" /> Ver resumo IA
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </TabsContent>

                <TabsContent value="tips" className="mt-0 space-y-5 outline-none">
                  <Section icon={<Lightbulb className="size-4" />} title="Dicas de estudo" color={color.text}>
                    <ul className="grid gap-2">
                      {discipline.dicasEstudo.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-sm text-foreground/90">
                          <CheckCircle2 className={cn('mt-0.5 size-4 shrink-0', color.text)} />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  <Section icon={<Library className="size-4" />} title="Bibliografia" color={color.text}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Básica
                        </p>
                        <ul className="space-y-1.5">
                          {discipline.bibliografiaBasica.map((b, i) => (
                            <li key={i} className="text-xs leading-relaxed text-foreground/85">
                              <span className={cn('mr-1 font-medium', color.text)}>{i + 1}.</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Complementar
                        </p>
                        {discipline.bibliografiaComplementar.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Sem bibliografia complementar registrada.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {discipline.bibliografiaComplementar.map((b, i) => (
                              <li key={i} className="text-xs leading-relaxed text-foreground/85">
                                <span className={cn('mr-1 font-medium', color.text)}>{i + 1}.</span>
                                {b}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </Section>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      <MaterialSummaryDialog
        material={summaryFor}
        open={!!summaryFor}
        onOpenChange={(o) => !o && setSummaryFor(null)}
      />
      <PdfViewerDialog
        material={pdfFor}
        open={!!pdfFor}
        onOpenChange={(o) => !o && setPdfFor(null)}
      />
      <VideoPlayerDialog
        material={videoFor}
        open={!!videoFor}
        onOpenChange={(o) => !o && setVideoFor(null)}
      />
    </>
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
