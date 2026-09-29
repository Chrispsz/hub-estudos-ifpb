'use client';

import * as React from 'react';
import {
  Camera,
  PlayCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  BookMarked,
  Image as ImageIcon,
  LayoutList,
  Library,
  Lightbulb,
  ListChecks,
  Loader2,
  Scale,
  Sparkles,
  SquareCode,
} from 'lucide-react';
import { daysUntilDate } from '@/lib/semester';
import {
  disciplineExamBriefFor,
  MATH_EXAM,
} from '@/lib/math-exam-prep';
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
import { Button } from '@/components/ui/button';
import type { Discipline, Material } from '@/data/course-data';
import { getMaterialsByDiscipline, evaluationPeriods } from '@/data/course-data';
import {
  NUCLEUS_DOT_BG,
  CURRENT_PERIOD,
  getCurriculumInfo,
  prereqShortNames,
} from '@/lib/curriculum';
import { DisciplineIcon } from '@/lib/discipline-icons';
import {
  getColorClasses,
  priorityClasses,
  categoryClasses,
  categoryLabel,
} from '@/lib/discipline-colors';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { openTutor } from '@/lib/hub-events';
import { captureElementToDataUrl } from '@/lib/dom-capture';
import { recallPdfPage } from '@/lib/pdf-position';
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
  image: 'Imagem',
  calendar: 'Calendário',
  exemplo: 'Exemplo de código',
};

/** Botões de ação: alvo de toque ≥44px no mobile, compacto no desktop. */
const touchBtn = 'h-11 sm:h-8';

// Complementos dark-mode para badges com fundo claro (priority/categoryClasses
// só definem as variantes light — o mapa vive aqui, junto do ponto de uso).
const priorityDarkClasses: Record<string, string> = {
  alta: 'dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60',
  media: 'dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60',
  baixa: 'dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800',
};

const categoryDarkClasses: Record<string, string> = {
  exata: 'dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60',
  tecnica: 'dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900/60',
  humanas: 'dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60',
  linguagens: 'dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900/60',
};

/**
 * t162 — A LEITURA CHAMA DE VOLTA: a memória de retomada do cartão. Só
 * materiais com memória digna (recallPdfPage ≥ 2) ganham o botão "continuar"
 * — a memória só EXISTE para quem já saltou, então aqui não há gate de tipo:
 * web_page/imagem/html nunca tiveram salto e o recall devolve null.
 */
function resumePageOf(m: Material): number | null {
  return m.pdfPath ? recallPdfPage(m.id, m.pages) : null;
}

export function DisciplineDetailDialog({ discipline, open, onOpenChange, initialTab }: Props) {
  const [summaryFor, setSummaryFor] = React.useState<Material | null>(null);
  const [pdfFor, setPdfFor] = React.useState<Material | null>(null);
  /** t162 — a página pedida pelo botão "continuar" do cartão (o convite
   * aceito lá fora). Morre ao fechar do visualizador, como o material. */
  const [pdfResumePage, setPdfResumePage] = React.useState<number | undefined>(undefined);
  const [videoFor, setVideoFor] = React.useState<Material | null>(null);
  const [tab, setTab] = React.useState(initialTab ?? 'overview');

  // Drill-down: enquanto um sub-diálogo (resumo IA / PDF / vídeo) está aberto,
  // este diálogo se OCULTA em vez de ficar empilhado por baixo — evita telas
  // sobrepostas. Ao fechar o sub-diálogo, esta tela volta intacta (mesma aba,
  // mesmo scroll), porque o estado do pai (discipline/open) não é alterado.
  const subOpen = !!summaryFor || !!pdfFor || !!videoFor;

  React.useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  // Derivações memoizadas — ANTES do early-return para manter a ordem de
  // hooks estável entre renders com discipline null/não-null.
  const mats = React.useMemo(
    () => (discipline ? getMaterialsByDiscipline(discipline.code) : []),
    [discipline],
  );
  const evals = React.useMemo(
    () =>
      discipline
        ? evaluationPeriods.filter((e) => e.disciplineCode === discipline.code)
        : [],
    [discipline],
  );
  // Próxima avaliação datada (genérica, qualquer disciplina): 1ª com data
  // real no futuro — condicionais fora (política anti-estimativa do course-
  // data: sem data = sem destaque de prazo em lugar nenhum). SEM useMemo de
  // propósito: o relógio entra no cálculo e NÃO é dependência declarável —
  // memoizado, o valor ficava velho quando o relógio cruzava a data entre
  // aberturas do dialog (lição 79: ler o relógio NO render, sem cache).
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  const nextEvalIdx = discipline
    ? evals.findIndex((e) => e.date && e.date >= todayIso && !e.conditional)
    : -1;
  // Ficha oficial da matriz curricular (curriculum.ts — fonte única do curso).
  const matrixInfo = React.useMemo(
    () => (discipline ? getCurriculumInfo(discipline.code) : undefined),
    [discipline],
  );

  // PRINT DOS ASSUNTOS (140 — a terceira via da captura): o corpo do diálogo
  // (a aba ativa — assuntos, avaliação, dicas) vira imagem e entra DIRETO no
  // chat do tutor via openTutor({image}) — o canal aberto pela 139. O aluno
  // pergunta "o que cai na unidade 2?" SEM tirar print do sistema: nada toca
  // o disco, o anexo morre com o envio (a mesma vida dos prints colados).
  // Hooks ANTES do early return null (Rules of Hooks — o diálogo alterna
  // null↔disciplina ao abrir/fechar; hook depois do return = crash de render).
  const [capturing, setCapturing] = React.useState(false);
  const captureBodyRef = React.useRef<HTMLDivElement>(null);
  const captureAssuntos = async (disc: { code: string } | null | undefined) => {
    const el = captureBodyRef.current;
    if (!el || capturing || !disc) return;
    setCapturing(true);
    try {
      const image = await captureElementToDataUrl(el);
      openTutor({ image, disciplineCode: disc.code });
      toast.success('Print da tela anexado ao tutor — nada foi salvo no seu computador.');
    } catch {
      toast.error('Não consegui capturar esta tela. Tente de novo.');
    } finally {
      setCapturing(false);
    }
  };

  if (!discipline) return null;

  const color = getColorClasses(discipline.color);

  // Voz da semana na disciplina (fonte única: disciplineExamBriefFor no
  // módulo puro) — só a disciplina da prova fala; o relógio é lido AQUI no
  // render (mesma divisão da 98: daysLeft entra como parâmetro no módulo).
  const examBrief =
    discipline.code === MATH_EXAM.disciplineCode
      ? disciplineExamBriefFor(daysUntilDate(MATH_EXAM.date))
      : null;

  return (
    <>
      <Dialog open={open && !subOpen} onOpenChange={onOpenChange}>
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
                  <DisciplineIcon name={discipline.icon} className="size-6" aria-hidden />
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
                <button
                  type="button"
                  onClick={() => void captureAssuntos(discipline)}
                  disabled={capturing}
                  aria-label="Print da tela para o tutor"
                  title="Print desta tela — anexa ao tutor para perguntar sobre os assuntos (nada é salvo no seu computador)"
                  className="ml-auto shrink-0 self-start rounded-full bg-card/80 p-2 text-emerald-600 shadow-sm ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/10 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  {capturing ? (
                    <Loader2 className="size-4.5 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="size-4.5" aria-hidden />
                  )}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {/* max-w-full + wrap: sem isso, "Fabio Gomes de Andrade · Doutor…"
                    (260px, nowrap do Badge base) levanta o min-content do header
                    e estoura o diálogo em telas de 390px. */}
                <Badge
                  variant="outline"
                  className={cn('max-w-full !whitespace-normal', priorityClasses[discipline.prioridade], priorityDarkClasses[discipline.prioridade])}
                >
                  Prioridade {discipline.prioridade}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(categoryClasses[discipline.category], categoryDarkClasses[discipline.category])}
                >
                  {categoryLabel[discipline.category]}
                </Badge>
                <Badge variant="outline" className="max-w-full !whitespace-normal border-border text-muted-foreground">
                  <GraduationCap className="size-3 shrink-0" /> {discipline.professor}
                  {discipline.professorTitle ? ` · ${discipline.professorTitle}` : ''}
                </Badge>
                {matrixInfo && (
                  <Badge
                    variant="outline"
                    className="max-w-full !whitespace-normal gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    <GraduationCap className="size-3 shrink-0" aria-hidden />
                    Matriz: {matrixInfo.period.label}
                    {matrixInfo.period.period === CURRENT_PERIOD ? ' (atual)' : ''} •{' '}
                    {matrixInfo.row.ch}h
                  </Badge>
                )}
              </div>
            </DialogHeader>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="border-b bg-muted/30 px-4">
              {/* flex-wrap + h-auto: 5 abas nowrap = min-content 389px, que
                  estourava o diálogo em 390px. Quebrando em 2 linhas no mobile,
                  uma linha no desktop (h-9). */}
              <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-1.5 sm:h-9">
                <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
                <TabsTrigger value="content" className="text-xs">Conteúdo</TabsTrigger>
                <TabsTrigger value="evaluation" className="text-xs">Avaliação</TabsTrigger>
                <TabsTrigger value="materials" className="text-xs">Materiais</TabsTrigger>
                <TabsTrigger value="tips" className="text-xs">Dicas</TabsTrigger>
              </TabsList>
            </div>

            {/* Corpo com scroll nativo em vez de ScrollArea — o viewport do
                Radix usa display:table, cujo shrink-to-fit por max-content
                estourava o diálogo no mobile (grid-cols-2 da ementa → 421px
                num viewport de 390). Div com overflow-y mantém o wrap normal. */}
            <div ref={captureBodyRef} className="max-h-[60vh] min-w-0 overflow-y-auto">
              <div className="p-5 sm:p-6">
                <TabsContent value="overview" className="mt-0 space-y-5 outline-none">
                  {matrixInfo && (
                    <Section
                      icon={<LayoutList className="size-4" />}
                      title="Na matriz oficial do curso"
                      color={color.text}
                    >
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Período
                          </dt>
                          <dd className="mt-0.5 font-medium">
                            {matrixInfo.period.label}
                            {matrixInfo.period.period === CURRENT_PERIOD ? (
                              <span className="ml-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                • atual
                              </span>
                            ) : null}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Núcleo
                          </dt>
                          <dd className="mt-0.5 inline-flex items-center gap-1.5 font-medium">
                            <span
                              aria-hidden
                              className={cn(
                                'size-2 rounded-full',
                                NUCLEUS_DOT_BG[matrixInfo.row.nucleus],
                              )}
                            />
                            {matrixInfo.row.nucleus}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            CH oficial
                          </dt>
                          <dd className="mt-0.5 font-medium tabular-nums">
                            {matrixInfo.row.ch}h
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Aulas/semana
                          </dt>
                          <dd className="mt-0.5 font-medium tabular-nums">
                            {matrixInfo.row.aulasSemanais}
                          </dd>
                        </div>
                        {matrixInfo.row.docente ? (
                          <div className="col-span-2 sm:col-span-1">
                            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Docente
                            </dt>
                            <dd className="mt-0.5 font-medium">
                              {matrixInfo.row.docente}
                              {matrixInfo.row.titulacao ? (
                                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                  · {matrixInfo.row.titulacao}
                                </span>
                              ) : null}
                            </dd>
                          </div>
                        ) : null}
                        <div className="col-span-2 sm:col-span-2">
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Pré-requisitos na matriz
                          </dt>
                          <dd className="mt-0.5 font-medium">
                            {prereqShortNames(matrixInfo.row).length
                              ? prereqShortNames(matrixInfo.row).join(' + ')
                              : 'Nenhum'}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                        Dados da Matriz Curricular 2025 (PPC do curso); docentes da
                        página oficial do curso (portal do estudante IFPB, consultado
                        em 09/2026). A coluna &ldquo;CH oficial&rdquo; vem do fluxograma
                        e pode diferir da CH de aulas registrada no Hub.
                      </p>
                    </Section>
                  )}

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
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
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
                        {evals.map((e, i) => {
                          const isExamEval =
                            !!examBrief &&
                            e.date === MATH_EXAM.date &&
                            e.evaluationName === MATH_EXAM.evaluationName;
                          const isProva = isExamEval && examBrief!.kind === 'prova';
                          const isNext = !isExamEval && i === nextEvalIdx;
                          return (
                            <li
                              key={i}
                              className={cn(
                                'flex flex-col gap-1.5 rounded-md border px-2.5 py-2 text-sm transition-colors',
                                isExamEval
                                  ? isProva
                                    ? 'border-rose-500/50 bg-rose-500/[0.07] dark:border-rose-500/40 dark:bg-rose-500/[0.08]'
                                    : 'border-amber-500/50 bg-amber-500/[0.07] dark:border-amber-500/40 dark:bg-amber-500/[0.08]'
                                  : isNext
                                    ? 'border-border bg-muted/40'
                                    : 'border-transparent',
                              )}
                            >
                              <div className="flex items-start gap-2 text-foreground/85">
                                <Badge variant="outline" className={cn('shrink-0 border text-[11px]', color.badge)}>
                                  {e.date
                                    ? new Date(`${e.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                                    : 'A definir'}
                                </Badge>
                                <span className="min-w-0">
                                  <span className="font-medium">{e.evaluationName}</span>
                                  {' — '}
                                  {e.description}
                                </span>
                                {isExamEval && (
                                  <span
                                    className={cn(
                                      'ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                                      isProva
                                        ? 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                                        : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                                    )}
                                  >
                                    {isProva && (
                                      <span aria-hidden className="relative flex size-1.5 shrink-0">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                                        <span className="relative inline-flex size-1.5 rounded-full bg-rose-500" />
                                      </span>
                                    )}
                                    {examBrief!.chip}
                                  </span>
                                )}
                                {isNext && (
                                  <span className="ml-auto inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    próxima
                                  </span>
                                )}
                              </div>
                              {isExamEval && (
                                <p
                                  className={cn(
                                    'flex items-start gap-1.5 text-xs font-medium',
                                    isProva
                                      ? 'text-rose-700 dark:text-rose-400'
                                      : 'text-amber-700 dark:text-amber-400',
                                  )}
                                >
                                  <CalendarDays aria-hidden className="mt-0.5 size-3 shrink-0" />
                                  {examBrief!.linha}
                                </p>
                              )}
                            </li>
                          );
                        })}
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
                      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
                        <FileText className="size-6 text-muted-foreground" aria-hidden />
                        <p className="text-sm text-muted-foreground">
                          Sem materiais cadastrados para esta disciplina.
                        </p>
                      </div>
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
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              {m.externalUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn(touchBtn, 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400')}
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
                                  className={touchBtn}
                                  onClick={() => setPdfFor(m)}
                                >
                                  {m.type === 'image' ? (
                                    <>
                                      <ImageIcon className="size-3.5" /> Ver
                                    </>
                                  ) : m.pdfPath?.endsWith('.html') ? (
                                    <>
                                      <SquareCode className="size-3.5" /> Abrir exemplo
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="size-3.5" /> Abrir PDF
                                    </>
                                  )}
                                </Button>
                              )}
                              {m.pdfPath && resumePageOf(m) !== null && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={cn(
                                    touchBtn,
                                    'text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300',
                                  )}
                                  onClick={() => {
                                    setPdfResumePage(resumePageOf(m)!);
                                    setPdfFor(m);
                                  }}
                                  title={`Continuar da página ${resumePageOf(m)} — onde o Hub vi o seu último salto neste material`}
                                >
                                  <BookMarked className="size-3.5" /> Continuar pág. {resumePageOf(m)}
                                </Button>
                              )}
                              {m.summaryFile && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className={cn(touchBtn, 'border', color.bgSoft, color.text, color.borderAll)}
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
            </div>
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
        onOpenChange={(o) => {
          if (!o) {
            setPdfFor(null);
            setPdfResumePage(undefined); // o convite morre com a abertura (t162)
          }
        }}
        initialPage={pdfResumePage}
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
