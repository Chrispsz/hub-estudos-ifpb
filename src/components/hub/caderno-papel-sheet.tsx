'use client';

/**
 * FOLHA DO CADERNO — as pendências do Caderno de Erros no papel (rota
 * /caderno-papel).
 *
 * A véspera manda "refaça no papel as N questões pendentes" (brief da 91) —
 * mas o papel não existia: o aluno teria que copiar enunciado à mão da tela.
 * Esta folha é a última milha do caderno, no MESMO padrão da folha de
 * revisão (rota /folha-revisao): papel WYSIWYG (fundo branco, tinta escura,
 * claro ou escuro o tema do app), barra de ações só na tela, selo de
 * impressão só no papel, break-inside:avoid por questão.
 *
 * O QUE VAI AO PAPEL (fonte única paperNotebookFor — a MESMA função que o
 * caderno na tela usa para o botão): só pendências com enunciado COMPLETO
 * confirmado no acervo agora (linhas `ex:`/`sim:` — o title da linha é
 * truncado na coleta, o papel não publica truncamento). Cartões não vão (o
 * verso é parte da prática) e registros sem par no acervo não vão (enunciado
 * truncado não é contrato) — a folha DIZ o que ficou de fora, na honestidade
 * da casa. SELO (lição 108 no papel): "Impresso em dd/mm" + o marco da
 * semana da Av1 quando a impressão cai num dia dele — a MESMA fonte do
 * mapa/kit/agenda/folha (examWeekMilestoneFor, âncora no meio-dia local).
 */

import * as React from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyProgress } from '@/lib/study-progress';
import {
  collectMistakes,
  fullStatementFor,
  groupByDiscipline,
  isRecorrenteMistake,
  paperNotebookFor,
  type MistakeItem,
} from '@/lib/mistake-notebook';
import { getDisciplineByCode } from '@/data/course-data';
import { examWeekMilestoneFor } from '@/lib/math-exam-prep';

const difficultyLabel = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' } as const;

function fmtDayBR(iso: string): string {
  // FUSO (lição 108 no papel): date-only ('yyyy-mm-dd') é meia-noite UTC no
  // parser — no fuso do aluno (BRT, negativo) isso vira o dia ANTERIOR à
  // noite. Datas só-de-dia são ancoradas no meio-dia LOCAL; timestamps
  // completos formatam no fuso do navegador, correto.
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
    new Date(safe),
  );
}

/** Chave do dia de HOJE no fuso do ALUNO (getters locais). Vazia até o
 * mount: mesmo contrato honesto da folha de revisão (o servidor não sabe a
 * hora do aluno — zero mismatch de hidratação). */
function todayKeyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Uma questão no papel: enunciado completo + contexto + espaço de trabalho. */
function PaperQuestion({ it, n }: { it: MistakeItem; n: number }) {
  const statement = fullStatementFor(it) ?? '';
  const recorrente = isRecorrenteMistake(it);
  return (
    <li className="break-inside-avoid">
      <div className="flex items-start gap-2">
        <span className="mt-px shrink-0 text-[12px] font-bold tabular-nums text-zinc-900">
          Q{n}.
        </span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-900">
            {statement}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {it.topic ? <span>{it.topic}</span> : null}
            {it.difficulty ? (
              <span>
                {it.topic ? ' · ' : ''}dificuldade {difficultyLabel[it.difficulty].toLowerCase()}
              </span>
            ) : null}
            {it.note ? <span>{it.topic || it.difficulty ? ' · ' : ''}{it.note}</span> : null}
          </p>
          {recorrente ? (
            <p
              className="mt-1 inline-block rounded border border-zinc-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700"
            >
              erro de sempre — prioridade máxima
            </p>
          ) : null}
        </div>
      </div>
      {/* Espaço de trabalho — 3 pautas pontilhadas (tinta econômica) */}
      <div className="mt-2 ml-6 space-y-3" aria-hidden="true">
        <div className="border-b border-dotted border-zinc-300" />
        <div className="border-b border-dotted border-zinc-300" />
        <div className="border-b border-dotted border-zinc-300" />
      </div>
    </li>
  );
}

export function CadernoPapelSheet() {
  const sp = useStudyProgress();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  // Hoje no fuso do aluno, só no cliente (mesmo contrato da folha de revisão).
  const [todayKey, setTodayKey] = React.useState('');
  React.useEffect(() => {
    setTodayKey(todayKeyLocal());
  }, []);

  // A MESMA fonte do caderno na tela: collect → pendências → papel
  // (paperNotebookFor confirma o enunciado completo no acervo AGORA).
  const items = React.useMemo(() => collectMistakes(sp.progress), [sp.progress]);
  const paper = React.useMemo(
    () => paperNotebookFor(items, sp.progress.notebookRevised),
    [items, sp.progress.notebookRevised],
  );
  const groups = React.useMemo(
    () => (mounted ? groupByDiscipline(paper.printable) : []),
    [mounted, paper.printable],
  );

  // O SELO DO PAPEL (receita da folha de revisão): só no papel, só no
  // cliente, marco da semana pela FONTE ÚNICA com âncora no meio-dia local.
  const stampMilestone = React.useMemo(() => {
    if (!todayKey) return null;
    const [y, m, d] = todayKey.split('-').map(Number);
    return examWeekMilestoneFor(new Date(y, (m || 1) - 1, d || 1, 12));
  }, [todayKey]);

  const total = paper.printable.length;
  const ficamNaTela =
    paper.cartoes + paper.semAcervo > 0
      ? [
          paper.cartoes > 0
            ? `${paper.cartoes} cartão${paper.cartoes > 1 ? 'es' : ''} (o verso é parte da prática)`
            : null,
          paper.semAcervo > 0
            ? `${paper.semAcervo} registro${paper.semAcervo > 1 ? 's' : ''} sem enunciado completo no acervo`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <div className="min-h-dvh bg-zinc-200/60 print:bg-white">
      {/* Barra de ações — só na tela (some na impressão) */}
      <div className="sticky top-0 z-10 border-b border-zinc-300/70 bg-zinc-100/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[840px] flex-wrap items-center gap-2 px-4 py-2.5">
          <a
            href="/"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Voltar ao Hub
          </a>
          <p className="hidden text-[11px] text-zinc-500 sm:block">
            {mounted
              ? total > 0
                ? `${total} pendência${total > 1 ? 's' : ''} no papel · Impressão: A4 · margens padrão`
                : 'Nada pendente para o papel'
              : 'Carregando o caderno…'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => window.print()}
              disabled={mounted && total === 0}
              className="gap-1.5 bg-zinc-900 text-white hover:bg-zinc-700"
              aria-label="Imprimir a folha do caderno de erros"
            >
              <Printer className="size-3.5" aria-hidden /> Imprimir
            </Button>
          </div>
        </div>
      </div>

      {/* A folha — papel WYSIWYG */}
      <main className="mx-auto max-w-[840px] px-3 py-5 print:max-w-none print:px-0 print:py-0">
        <article
          className="rounded-lg bg-white px-8 py-7 text-zinc-900 shadow-xl ring-1 ring-zinc-300/60 print:rounded-none print:px-0 print:py-0 print:shadow-none print:ring-0"
          aria-label="Folha do caderno de erros — pendências no papel"
        >
          <header className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Hub de Estudos · IFPB ADS — Caderno de Erros
              </p>
              <h1 className="mt-1 text-xl font-bold leading-tight print:text-lg">
                As pendências no papel
              </h1>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Refaça cada questão no papel, sem consultar — depois marque como revisada no
                caderno (Progresso): o registro é o que vence.
              </p>
              {todayKey && (
                <p
                  data-testid="caderno-papel-print-stamp"
                  className="mt-0.5 hidden text-[10px] text-zinc-500 print:block"
                >
                  Impresso em <span className="tabular-nums">{fmtDayBR(todayKey)}</span>
                  {stampMilestone ? <> · {stampMilestone.titulo}</> : null}
                </p>
              )}
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-zinc-900 text-[11px] font-bold leading-tight text-white">
              Q
              <span className="tabular-nums">{total}</span>
            </span>
          </header>

          {total === 0 ? (
            <section className="mt-6" aria-label="Caderno sem pendências para o papel">
              <p className="text-[12px] leading-relaxed text-zinc-700">
                {mounted
                  ? 'Nada pendente com enunciado completo — o caderno está em dia (ou o que falta não vai ao papel: cartões ficam na tela, que tem o verso à distância de um clique).'
                  : 'Carregando o caderno…'}
              </p>
            </section>
          ) : (
            groups.map(({ disciplineCode, items: list }, gi) => {
              const disc = getDisciplineByCode(disciplineCode);
              // Numeração GLOBAL (Q1…Qn) — citar "refaça as Q1–Q4" tem que valer
              // na folha inteira, não dentro de um grupo.
              const offset = groups.slice(0, gi).reduce((acc, g) => acc + g.items.length, 0);
              return (
                <section
                  key={disciplineCode}
                  className={gi > 0 ? 'mt-6 border-t border-zinc-200 pt-4' : 'mt-5'}
                  aria-label={disc?.name ?? disciplineCode}
                >
                  <h2 className="flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                    {disc?.name ?? disciplineCode}
                    <span className="tabular-nums font-medium normal-case tracking-normal text-zinc-400">
                      {list.length} quest{list.length > 1 ? 'ões' : 'ão'}
                    </span>
                  </h2>
                  <ul className="mt-3 space-y-5">
                    {list.map((it, i) => (
                      <PaperQuestion key={it.key} it={it} n={offset + i + 1} />
                    ))}
                  </ul>
                </section>
              );
            })
          )}

          {/* O que ficou de fora — a honestidade do papel (regra da 88: nada
              prometido sem registro; aqui, nada impresso sem enunciado). */}
          {ficamNaTela && total > 0 ? (
            <p className="mt-6 border-t border-zinc-200 pt-3 text-[10px] leading-relaxed text-zinc-500">
              Ficam na tela do caderno: {ficamNaTela}.
            </p>
          ) : null}
        </article>
      </main>
    </div>
  );
}
