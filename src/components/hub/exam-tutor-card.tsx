'use client';

// t177 — TUTOR DA PROVA: o centro da repaginação pedida pelo dono ("quero
// estudar o assunto da prova com o tutor para tirar qualquer dúvida minha e
// absorver tudo · o que mais gostei foi dos PDFs e da integração com o
// tutor/agente"). A home AGORA ABRE com o tutor:
//
//   1. Campo de pergunta → o chat principal (aba Estudar) recebe a dúvida com
//      o contexto da prova (o backend injeta o mapa espelhado da Av1);
//   2. Os 2 PDFs da prova abrem na experiência que o dono AMA: tela dividida
//      PDF + Tutor (mesma integração do diálogo de material);
//   3. Treino Espelhado e Fila de Recuperação continuam vivos — em DIÁLOGO,
//      a 1 toque, sem virar poluição na home (princípio da t176-fase2).

import * as React from 'react';
import {
  Bot,
  CalendarCheck,
  ChevronRight,
  FileText,
  GraduationCap,
  Layers,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { materials, type Material } from '@/data/course-data';
import { openTutor } from '@/lib/hub-events';
import { MATH_EXAM } from '@/lib/math-exam-prep';
import { daysUntilDate } from '@/lib/semester';
import { PdfViewerDialog } from './pdf-viewer-dialog';
import { ExamGuidedTraining } from './exam-guided-training';
import { ExamMirrorCard } from './exam-mirror-card';
import { RecoveryCard } from './recovery-card';

const MATH_CODE = 'TEC.1984';

/** Os 2 PDFs da prova na integração PDF+Tutor (tela dividida — t177). */
const PROVA_PDFS: { id: string; label: string; hint: string }[] = [
  { id: 'mat-01-matrizes', label: 'Lista de Matrizes', hint: '35 questões · núcleo da Av1' },
  { id: 'mat-logica-lista', label: 'Lista de Lógica', hint: '18 questões · tabelas e argumentos' },
];

/** Atalhos de estudo — 1 toque = pergunta pronta no chat principal. */
const QUICK_PROMPTS = [
  'Revisão relâmpago: o que MAIS cai de Matrizes na Av1, com um exemplo de cada tipo',
  'Me explique tautologia, contradição e contingência com tabela-verdade e exemplo',
  'Me ensine o método de isolar X com matriz inversa (questão 6 da prova)',
  'Me teste com 5 questões no formato da prova, uma de cada vez, corrigindo cada resposta',
];

export function ExamTutorCard() {
  const [question, setQuestion] = React.useState('');
  /** PDF da prova aberto na tela dividida (PDF | Tutor). */
  const [pdfMaterial, setPdfMaterial] = React.useState<Material | null>(null);
  const [mirrorOpen, setMirrorOpen] = React.useState(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  /** t178 — treino guiado: as questões do professor COM o tutor ao lado. */
  const [trainingOpen, setTrainingOpen] = React.useState(false);

  // Contagem viva (render-time, igual aos outros cards — reage à virada do dia).
  const daysLeft = daysUntilDate(MATH_EXAM.date);
  const dayLabel =
    daysLeft <= 0 ? 'é hoje' : daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`;

  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    openTutor({ disciplineCode: MATH_CODE, question: text });
    setQuestion('');
  };

  return (
    <Card
      data-t="exam-tutor-card"
      className="overflow-hidden rounded-2xl border-l-4 border-l-violet-500 bg-gradient-to-br from-violet-50 via-card to-teal-50 p-5 shadow-sm dark:from-violet-950/40 dark:via-card dark:to-teal-950/40 sm:p-6"
    >
      {/* Cabeçalho: identidade + contagem da prova */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Bot className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">Tutor da prova</h3>
            <p className="text-xs text-muted-foreground">
              Tire qualquer dúvida de Matrizes &amp; Lógica — e absorva tudo
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge
            className="gap-1 bg-violet-600 text-white shadow-sm shadow-violet-600/25"
            title={`Av1 de Matemática — ${MATH_EXAM.date}`}
          >
            <CalendarCheck className="size-3" aria-hidden />
            {dayLabel}
          </Badge>
          <Badge variant="outline" className="border-border text-[11px]">
            50 min · 6 questões
          </Badge>
        </div>
      </div>

      {/* Campo de pergunta — a dúvida abre no chat principal (contexto da prova injetado) */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pergunte qualquer coisa: matrizes, lógica, método…"
          aria-label="Pergunta para o Tutor da prova"
          className="h-11 flex-1 rounded-xl border-violet-500/30 bg-background focus-visible:ring-violet-500/40"
        />
        <Button
          type="submit"
          disabled={!question.trim()}
          aria-label="Enviar pergunta ao Tutor"
          className="h-11 shrink-0 rounded-xl bg-violet-600 px-4 text-white shadow-md shadow-violet-600/20 hover:bg-violet-700"
        >
          <Send className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:ml-1.5">Perguntar</span>
        </Button>
      </form>

      {/* Atalhos de estudo (1 toque = pergunta pronta) */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => ask(p)}
            className="rounded-full border border-violet-500/30 bg-violet-500/5 px-2.5 py-1 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-500/15 dark:text-violet-300"
          >
            {p}
          </button>
        ))}
      </div>

      {/* t178 — TREINO GUIADO: a resposta direta a "como faço as questões do
          professor com o tutor?" — 1 clique, questão por questão, tutor ao lado. */}
      <button
        type="button"
        onClick={() => setTrainingOpen(true)}
        data-t="guided-training-open"
        aria-label="Abrir treino guiado das questões do professor com o tutor ao lado"
        className="mt-4 flex w-full items-center gap-3 rounded-xl bg-violet-600 p-3.5 text-left text-white shadow-md shadow-violet-600/25 transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/15">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Treinar as questões do professor — com o tutor ao lado
          </span>
          <span className="block text-[11px] text-violet-100">
            Uma por vez: resolva no papel, confira o gabarito e tire a dúvida na hora · 6 questões
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 opacity-80" aria-hidden />
      </button>

      {/* PDF + TUTOR: a integração que o dono ama, 1 clique da home */}
      <div className="mt-4 border-t pt-3">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <FileText className="size-3" aria-hidden />
          Estudar com o PDF aberto — tela dividida com o tutor
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROVA_PDFS.map((p) => {
            const m = materials.find((x) => x.id === p.id);
            if (!m) return null;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPdfMaterial(m)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-violet-500/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                aria-label={`Abrir ${p.label} com o tutor ao lado`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <FileText className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {p.hint}
                  </span>
                </span>
                <Bot
                  className="size-4 shrink-0 text-violet-500 opacity-50 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Referências vivas — 1 toque, em diálogo (não poluem a home) */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <button
          type="button"
          onClick={() => setMirrorOpen(true)}
          className="inline-flex items-center gap-1 font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <Layers className="size-3.5" aria-hidden /> Treino espelhado do professor
        </button>
        <button
          type="button"
          onClick={() => setRecoveryOpen(true)}
          className="inline-flex items-center gap-1 font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <ShieldCheck className="size-3.5" aria-hidden /> Fila de recuperação
        </button>
      </div>

      {/* Diálogos (a profundidade mora aqui — home fica limpa) */}
      <PdfViewerDialog
        material={pdfMaterial}
        open={pdfMaterial !== null}
        onOpenChange={(v) => {
          if (!v) setPdfMaterial(null);
        }}
        initialMode="split"
      />

      <Dialog open={mirrorOpen} onOpenChange={setMirrorOpen}>
        <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto rounded-xl">
          <DialogTitle className="sr-only">Treino espelhado do professor</DialogTitle>
          <ExamMirrorCard />
        </DialogContent>
      </Dialog>

      {/* t178 — treino guiado (questão por questão + tutor embutido) */}
      <ExamGuidedTraining open={trainingOpen} onOpenChange={setTrainingOpen} />

      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto rounded-xl">
          <DialogTitle className="sr-only">Fila de recuperação</DialogTitle>
          <RecoveryCard />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
