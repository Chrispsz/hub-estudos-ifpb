'use client';

// LibraryExamStrip — A BIBLIOTECA FALA A SEMANA DA AV1 (rodada 98).
//
// A Biblioteca é a asa TEÓRICA da semana da prova — os chips 'material' do
// plano (rodadas 94/96) abrem aqui — e era a única superfície cega ao
// calendário: 52 materiais sem um sinal de quais 4 são a Av1. Esta faixa
// fala a MESMA língua dos outros canais (fonte única libraryExamBriefFor):
//   - janela honesta: só existe no D-7 → D-0 (fora dela, silêncio);
//   - escopo a 1 clique: os 4 materiais da prova (2 teorias + 2 listas)
//     com o estado REAL de leitura (completedMaterials — nada inventado);
//   - linguagem de calma no D-0 (indigo, como o kit da véspera).
// Render-time puro (lição da 79): sem effect nem interval — o D-N e o
// progresso reagem a mock de relógio e a marcação de leitura no mesmo render.

import * as React from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  FileText,
  GraduationCap,
} from 'lucide-react';
import { materials, type Material } from '@/data/course-data';
import { daysUntilDate } from '@/lib/semester';
import {
  MATH_EXAM,
  MATH_SCOPE_MATERIALS,
  MATH_TOPICO_CURTO,
  libraryExamBriefFor,
} from '@/lib/math-exam-prep';
import { useStudyProgress } from '@/lib/study-progress';
import { MaterialSummaryDialog } from './material-summary-dialog';

const TOPIOS = ['Álgebra Matricial', 'Lógica Matemática'] as const;

export function LibraryExamStrip() {
  const sp = useStudyProgress();
  const [openFor, setOpenFor] = React.useState<Material | null>(null);

  const daysLeft = daysUntilDate(MATH_EXAM.date);
  const brief = libraryExamBriefFor(daysLeft, sp.progress.completedMaterials);
  if (!brief) return null;

  const calm = brief.kind === 'prova-hoje';
  const pct = brief.total > 0 ? Math.round((brief.lidos / brief.total) * 100) : 0;
  const completo = brief.lidos === brief.total;

  // Materiais do escopo resolvidos para objetos Material reais — um id que
  // sair do course-data simplesmente não renderiza chip (honesto, sem crash).
  const porTopico = TOPIOS.map((topico) => ({
    topico,
    items: MATH_SCOPE_MATERIALS.filter((m) => m.topico === topico)
      .map((m) => ({ ...m, material: materials.find((mm) => mm.id === m.id) }))
      .filter((m): m is (typeof m) & { material: Material } => !!m.material),
  })).filter((g) => g.items.length > 0);

  return (
    <section
      aria-label="Semana da Av1 na Biblioteca"
      className={`rounded-xl border p-4 ${
        calm
          ? 'border-indigo-500/30 bg-gradient-to-r from-indigo-500/[0.08] via-indigo-500/[0.04] to-transparent'
          : 'border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.04] to-transparent'
      }`}
    >
      {/* Cabeçalho: marco + contador honesto + progresso do escopo */}
      <div className="flex flex-wrap items-center gap-2">
        {calm ? (
          <GraduationCap className="size-4 shrink-0 text-indigo-500" aria-hidden />
        ) : (
          <CalendarCheck className="size-4 shrink-0 text-amber-500" aria-hidden />
        )}
        <h3 className="text-sm font-semibold">{brief.titulo}</h3>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
            calm
              ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
          }`}
          aria-label={`Faltam ${brief.daysLeft} dias para a prova`}
        >
          D-{brief.daysLeft}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={completo ? 'font-medium text-emerald-600 dark:text-emerald-400' : undefined}>
            escopo lido: <span className="tabular-nums">{brief.lidos}/{brief.total}</span>
            {completo ? ' ✓' : ''}
          </span>
          <span className="h-1 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span
              className={`block h-1 rounded-full transition-all duration-500 ${
                completo ? 'bg-emerald-500/80' : 'bg-amber-500/70'
              }`}
              style={{ width: `${pct}%` }}
            />
          </span>
        </span>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{brief.linha}</p>

      {/* Os 4 materiais do escopo, agrupados por tópico — 1 clique = resumo IA */}
      <div className="mt-3 flex flex-col gap-2.5">
        {porTopico.map(({ topico, items }) => (
          <div key={topico} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {MATH_TOPICO_CURTO[topico] ?? topico}
            </span>
            {items.map(({ id, short, kind, material }) => {
              const lido = sp.progress.completedMaterials.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOpenFor(material)}
                  title={`Abrir o resumo IA de "${material.title}"${lido ? ' — já lido' : ''}`}
                  aria-label={`Abrir o resumo IA de ${material.title}${lido ? ' (já lido)' : ''}`}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 ${
                    lido
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                      : 'border-border bg-card text-muted-foreground hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-foreground'
                  }`}
                >
                  {lido ? (
                    <CheckCircle2 className="size-3 shrink-0" aria-hidden />
                  ) : kind === 'teoria' ? (
                    <GraduationCap className="size-3 shrink-0 opacity-70" aria-hidden />
                  ) : (
                    <FileText className="size-3 shrink-0 opacity-70" aria-hidden />
                  )}
                  {short}
                  {!lido && <CircleDashed className="size-3 shrink-0 opacity-50" aria-hidden />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <MaterialSummaryDialog
        material={openFor}
        open={openFor != null}
        onOpenChange={(o) => {
          if (!o) setOpenFor(null);
        }}
      />
    </section>
  );
}
