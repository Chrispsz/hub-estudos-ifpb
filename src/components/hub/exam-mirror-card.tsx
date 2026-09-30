'use client';

// ExamMirrorCard — t173: TREINO ESPELHADO da Av1 (01/10).
// O professor ditou no áudio (30/09) a estrutura real das 6 questões e citou os
// espelhos na lista. Este card põe a mão na massa: cada questão da prova com o
// espelho EXATO da lista (enunciado real extraído dos PDFs), irmãos do mesmo
// músculo, gabarito relâmpago, receita de prova e orçamento de minutos (50').
// O progresso "dominada" persiste em localStorage (sobrevive a F5).

import * as React from 'react';
import {
  ChevronDown,
  CircleCheck,
  GraduationCap,
  KeyRound,
  Mic,
  PenLine,
  Quote,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { openSimulado, openTutor } from '@/lib/hub-events';
import { daysUntilDate } from '@/lib/semester';
import {
  EXAM_STRATEGY,
  mirrorStats,
  PROVA_BLUEPRINT,
  TOTAL_MINUTES,
  type MirrorQuestion,
} from '@/lib/prof-audio-map';
import { MathText } from './math-text';

const EXAM_DATE_ISO = '2026-10-01';
const STORAGE_KEY = 'hub:espelho:dominadas:v1';

/** Segmento do orçamento de minutos (barrinha proporcional do header). */
function MinuteBar() {
  return (
    <div
      className="flex h-6 overflow-hidden rounded-md bg-muted"
      role="img"
      aria-label={`Orçamento de tempo da prova: ${TOTAL_MINUTES} minutos divididos entre as 6 questões`}
    >
      {PROVA_BLUEPRINT.map((q, i) => (
        <div
          key={q.n}
          style={{ flexGrow: q.minutes }}
          className={`flex items-center justify-center gap-1 text-[9px] font-semibold text-white ${
            i % 2 === 0 ? 'bg-rose-500' : 'bg-rose-600'
          }`}
          title={`Q${q.n} · ${q.title} — ${q.minutes} min`}
        >
          <span>Q{q.n}</span>
          <span className="hidden tabular-nums opacity-90 sm:inline">{q.minutes}&apos;</span>
        </div>
      ))}
    </div>
  );
}

/** t174: faixa de estratégia — mapa de pontos, ordem perfeita e protocolo de rascunho. */
function StrategyStrip() {
  const [open, setOpen] = React.useState(false);
  const ordered = [...PROVA_BLUEPRINT].sort((a, b) => a.orderPosition - b.orderPosition);
  return (
    <div className="mt-3 rounded-lg border border-rose-200/70 bg-white/70 p-2.5 dark:border-rose-900/50 dark:bg-rose-950/20">
      <div className="flex items-start gap-1.5">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
        <p className="text-[11px] font-semibold leading-snug">
          <MathText text={EXAM_STRATEGY.scoring} />
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
          Ordem perfeita:
        </span>
        {ordered.map((q) => (
          <span
            key={q.n}
            title={q.orderWhy}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              q.bonus
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-rose-600/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
            }`}
          >
            {q.orderPosition}º Q{q.n}
            {q.bonus ? ' · bônus' : ''}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {open ? 'menos' : 'estratégia completa'}
          <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-1.5 border-t border-rose-200/60 pt-2 dark:border-rose-900/40">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <MathText text={EXAM_STRATEGY.orderRationale} />
          </p>
          <ul className="space-y-1">
            {EXAM_STRATEGY.rascunho.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-foreground/85">
                <PenLine className="mt-0.5 size-3 shrink-0 text-rose-500" />
                <MathText text={r} className="min-w-0 flex-1" />
              </li>
            ))}
          </ul>
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <MathText text={EXAM_STRATEGY.q6Doctrine} />
          </p>
        </div>
      )}
    </div>
  );
}

/** Um espelho/irmão da lista com gabarito relâmpago dobrável. */
function MirrorItem({ m }: { m: MirrorQuestion }) {
  const [showKey, setShowKey] = React.useState(false);
  const isEspelho = m.role === 'espelho';
  return (
    <li className="rounded-lg border bg-card p-2.5">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            isEspelho
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
          }`}
        >
          {isEspelho ? 'Espelho exato' : 'Irmão'}
        </span>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {m.list} · {m.qRef}
        </Badge>
      </div>
      <MathText text={m.statement} className="block text-xs leading-relaxed text-foreground/90" />
      {m.key && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-expanded={showKey}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            <KeyRound className="size-3" />
            {showKey ? 'esconder gabarito' : 'gabarito relâmpago'}
          </button>
          {showKey && (
            <p className="mt-1 rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] leading-relaxed text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <MathText text={m.key ?? ''} />
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function ExamMirrorCard() {
  // t176 CALMA: NENHUMA questão aberta por padrão — o card vira uma linha
  // calma na home; o detalhe (enunciado do prof., espelhos, receita) abre
  // quando você vai treinar aquela questão.
  const [open, setOpen] = React.useState<number | null>(null);
  const [done, setDone] = React.useState<number[]>([]);

  // Persistência leve (localStorage) — o vencedor do dia seguinte precisa achar o progresso.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setDone(parsed.filter((x): x is number => typeof x === 'number'));
      }
    } catch {
      /* localStorage indisponível — segue sem persistir */
    }
  }, []);

  const toggleDone = (n: number) => {
    setDone((prev) => {
      const next = prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* idem */
      }
      return next;
    });
  };

  const stats = mirrorStats();
  const daysLeft = daysUntilDate(EXAM_DATE_ISO);
  const pct = Math.round((done.length / PROVA_BLUEPRINT.length) * 100);

  return (
    <Card className="overflow-hidden rounded-xl border shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 px-4 py-3 dark:from-rose-950/40 dark:via-orange-950/25 dark:to-amber-950/20">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm shadow-rose-600/30">
            <Mic className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold tracking-tight">
              Treino Espelhado — a Av1 questão a questão
            </h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Áudio do professor (10 min · 30/09) × listas reais: {stats.espelhos} espelhos exatos +{' '}
              {stats.irmaos} irmãos, com gabarito e receita de prova
            </p>
          </div>
          {daysLeft >= 0 && (
            <Badge className="border-0 bg-rose-600 px-2 text-[10px] font-bold text-white shadow-sm">
              {daysLeft === 0 ? 'A prova é HOJE' : `faltam ${daysLeft}d`}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <MinuteBar />
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            orçamento de tempo: {TOTAL_MINUTES} min (o professor avisou: &quot;tem pouco tempo&quot;)
          </p>
          <StrategyStrip />
        </div>
      </div>

      {/* 6 questões — acordeão */}
      <div className="divide-y border-t">
        {PROVA_BLUEPRINT.map((q) => {
          const isOpen = open === q.n;
          const espelhoRefs = q.mirrors.filter((m) => m.role === 'espelho').map((m) => m.qRef);
          const isDone = done.includes(q.n);
          return (
            <div key={q.n}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : q.n)}
                aria-expanded={isOpen}
                aria-controls={`espelho-q${q.n}`}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                  isDone ? 'opacity-75' : ''
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}
                >
                  {isDone ? <CircleCheck className="size-4" /> : `Q${q.n}`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{q.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">espelhos:</span>
                    {espelhoRefs.map((r) => (
                      <span
                        key={r}
                        className="rounded bg-muted px-1 py-px text-[10px] font-medium text-muted-foreground"
                      >
                        {r}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  <Timer className="size-3" />
                  {q.minutes}&apos;
                </span>
                <span
                  title={q.bonus ? 'Bônus: +20 que fecha os 100 se algo escapar (a nota trava)' : 'Vale 20 pontos'}
                  className={`flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    q.bonus
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}
                >
                  {q.bonus ? '+20 bônus' : '20 pts'}
                </span>
                <span
                  title={q.orderWhy}
                  className="hidden shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground sm:flex"
                >
                  {q.orderPosition}º
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div id={`espelho-q${q.n}`} className="space-y-3 bg-muted/25 px-4 pb-4 pt-1">
                  {/* O que o professor disse */}
                  <figure className="rounded-lg border-l-2 border-rose-400 bg-card px-3 py-2">
                    <figcaption className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                      <Quote className="size-3" /> o que ele disse no áudio
                    </figcaption>
                    <blockquote className="text-xs italic leading-relaxed text-foreground/80">
                      {q.profQuote}
                    </blockquote>
                  </figure>

                  {/* Espelhos + irmãos (rolável) */}
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Treinar na lista (enunciados reais dos PDFs)
                    </p>
                    <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                      {q.mirrors.map((m) => (
                        <MirrorItem key={`${m.list}-${m.qRef}`} m={m} />
                      ))}
                    </ul>
                  </div>

                  {/* Receita de prova */}
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Receita de prova (faça nessa ordem)
                    </p>
                    <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-foreground/90">
                      {q.recipe.map((step, i) => (
                        <li key={i}>
                          <MathText text={step} />
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* t174: posição na ordem + método do Tutor */}
                  <div className="flex flex-col gap-2 rounded-lg border bg-card px-2.5 py-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                        {q.orderPosition}º na ordem perfeita{q.bonus ? ' · bônus da nota' : ''}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{q.orderWhy}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 gap-1.5"
                      onClick={() =>
                        openTutor({
                          question: q.tutorPrompt,
                          disciplineCode: 'TEC.1984',
                          materialId: q.tutorMaterialId,
                        })
                      }
                      title="Abre o Tutor com o pedido pronto: o método mais limpo deste tipo de questão — fórmula padrão, memorização e conferência de rascunho"
                    >
                      <GraduationCap className="size-3.5" /> Pedir método ao Tutor
                    </Button>
                  </div>

                  {/* Dominada */}
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Checkbox checked={isDone} onCheckedChange={() => toggleDone(q.n)} />
                    Questão dominada — treinei os espelhos e a receita fez sentido
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: progresso + ação */}
      <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Espelhos dominados</span>
            <span className="tabular-nums">
              {done.length}/{PROVA_BLUEPRINT.length} questões
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => openSimulado({ preset: 'math_exam_prof' })}
          className="group h-11 flex-1 gap-1.5 bg-rose-600 text-white shadow-md shadow-rose-600/25 hover:bg-rose-700 sm:h-8 sm:flex-none"
          title="As 6 questões na estrutura real que o professor ditou — mesma ordem, mesmos tipos, 50 minutos como a prova"
          aria-label="Abrir o Simulado do Professor — estrutura real da Av1"
        >
          <Mic className="size-3.5 transition-transform group-hover:scale-110" />
          Simulado do Professor · 6 questões · 50 min
        </Button>
      </div>
    </Card>
  );
}
