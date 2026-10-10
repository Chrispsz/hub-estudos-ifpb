'use client';

// Meu acompanhamento — o espelho completo por trás da linha do retrato (frente C,
// diretriz do dono 10/10/2026: "acompanhamento de mim mesmo quase que automático").
//
// Nada aqui é lançado à mão: cada número nasce do uso diário (pomodoro, questões,
// flashcards, materiais abertos). A casa continua limpa — a linha do retrato é o
// resumo; este painel só aparece quando o dono pede. Sem placar, sem medalha,
// sem cobrança (lição da t180): um espelho honesto + as filas em aberto com
// atalho direto — "sem se perder": todo número pendente leva ao lugar que o
// resolve.

import * as React from 'react';
import { Flame, ListChecks, PenLine } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { TodaySnapshot, TrackingDetail } from '@/lib/today-focus';
import { openPractice, openProgress } from '@/lib/hub-events';
import { getColorClasses } from '@/lib/discipline-colors';

interface TrackingPanelProps {
  /** Aberto/fechado — o estado vive no dashboard (a linha do retrato é o gatilho). */
  open: boolean;
  detail: TrackingDetail;
  snap: TodaySnapshot;
}

/** 75 → "1h15" · 40 → "40min" · 0 → "0min". */
function fmtMin(m: number): string {
  if (m <= 0) return '0min';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${m}min`;
  return rest === 0 ? `${h}h` : `${h}h${rest}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export function TrackingPanel({ open, detail, snap }: TrackingPanelProps) {
  const maxWeek = Math.max(...detail.week.map((d) => d.minutes), 1);

  // ----- Hoje: itens quietos, só o que o uso já registrou -----
  const hojeItems: string[] = [];
  {
    const t = detail.today;
    if (t.minutes > 0) hojeItems.push(`${fmtMin(t.minutes)} de foco`);
    if (t.questionsTried > 0)
      hojeItems.push(
        t.questionsSolved === t.questionsTried
          ? `${t.questionsTried} ${t.questionsTried === 1 ? 'questão resolvida' : 'questões resolvidas'}`
          : `${t.questionsSolved}/${t.questionsTried} questões certas`,
      );
    if (t.cardsReviewed > 0)
      hojeItems.push(
        `${t.cardsReviewed} ${t.cardsReviewed === 1 ? 'flashcard revisado' : 'flashcards revisados'}`,
      );
    if (t.cardsCreated > 0)
      hojeItems.push(`${t.cardsCreated} ${t.cardsCreated === 1 ? 'cartão criado' : 'cartões criados'}`);
    if (t.materialsOpened > 0)
      hojeItems.push(
        `${t.materialsOpened} ${t.materialsOpened === 1 ? 'material aberto' : 'materiais abertos'}`,
      );
  }

  // ----- Em aberto: cada fila com o atalho que a resolve -----
  const queues: { icon: React.ElementType; label: string; onClick: () => void }[] = [];
  if (snap.cardsDue > 0)
    queues.push({
      icon: ListChecks,
      label: `${snap.cardsDue} ${snap.cardsDue === 1 ? 'cartão vencido' : 'cartões vencidos'}`,
      onClick: () => openPractice({ mode: 'flashcards' }),
    });
  if (snap.openMistakes > 0)
    queues.push({
      icon: PenLine,
      label: `${snap.openMistakes} ${snap.openMistakes === 1 ? 'erro em aberto' : 'erros em aberto'}`,
      onClick: () => openProgress(),
    });

  return (
    <div
      id="painel-acompanhamento"
      className="grid transition-[grid-template-rows] duration-300 ease-out"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      aria-hidden={!open}
      inert={open ? undefined : true}
    >
      <div className="min-h-0 overflow-hidden">
        <Card className="mt-3 rounded-2xl p-5 sm:p-6" data-t="tracking-panel">
          <div className="grid gap-5">
            {/* HOJE — o que já aconteceu desde a virada do dia */}
            <section aria-label="Hoje">
              <SectionTitle>Hoje</SectionTitle>
              <p className="mt-1.5 text-sm leading-relaxed" data-t="hoje-linha">
                {hojeItems.length > 0
                  ? hojeItems.join(' · ')
                  : 'nada registrado ainda hoje — o primeiro foco aparece aqui.'}
              </p>
            </section>

            {/* ÚLTIMOS 7 DIAS — o hábito à vista, sem julgamento */}
            <section aria-label="Últimos 7 dias" className="border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <SectionTitle>Últimos 7 dias</SectionTitle>
                <p className="text-xs text-muted-foreground" data-t="semana-resumo">
                  {detail.weekMinutes > 0
                    ? `${fmtMin(detail.weekMinutes)} no total · ${detail.weekActiveDays} ${detail.weekActiveDays === 1 ? 'dia ativo' : 'dias ativos'}`
                    : 'sem foco registrado'}
                </p>
              </div>
              <div className="mt-3 flex h-16 items-end gap-1.5" data-t="semana-bars" role="img" aria-label="Minutos de foco por dia nos últimos 7 dias">
                {detail.week.map((d) => (
                  <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-12 w-full items-end">
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          d.minutes > 0 ? (d.isToday ? 'bg-primary' : 'bg-primary/30') : 'bg-border'
                        }`}
                        style={{ height: d.minutes > 0 ? `${Math.max((d.minutes / maxWeek) * 100, 8)}%` : '2px' }}
                        title={`${d.label}: ${fmtMin(d.minutes)}`}
                      />
                    </div>
                    <span
                      className={`text-[10px] leading-none ${d.isToday ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                    >
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ONDE FOI O TEMPO — o retrato por disciplina */}
            <section aria-label="Onde foi o tempo" className="border-t border-border/60 pt-4">
              <SectionTitle>Onde foi o tempo · 7 dias</SectionTitle>
              {detail.perDiscipline.length > 0 ? (
                <ul className="mt-3 space-y-2.5" data-t="tempo-disciplinas">
                  {detail.perDiscipline.map((d) => (
                    <li key={d.code} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate sm:w-44" title={d.name}>
                        {d.name}
                      </span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={`block h-full rounded-full ${getColorClasses(d.color).bgSolid}`}
                          style={{ width: `${Math.max(d.pct, 4)}%` }}
                        />
                      </span>
                      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {fmtMin(d.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  nenhum foco cronometrado nos últimos 7 dias.
                </p>
              )}
            </section>

            {/* EM ABERTO + HÁBITO — o que pede ação agora e a caminhada */}
            <section aria-label="Em aberto" className="border-t border-border/60 pt-4">
              <SectionTitle>Em aberto</SectionTitle>
              {queues.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2" data-t="em-aberto">
                  {queues.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={q.onClick}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium transition-colors hover:border-foreground/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${q.label} — abrir agora`}
                    >
                      <q.icon className="size-3.5 text-primary" aria-hidden />
                      {q.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">nada pendente — fila limpa.</p>
              )}
              <p
                className="mt-3.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground"
                data-t="habito-linha"
              >
                <Flame className="size-3.5 shrink-0" aria-hidden />
                <span>
                  {snap.streakDays > 0
                    ? `${snap.streakDays} ${snap.streakDays === 1 ? 'dia seguido' : 'dias seguidos'} de foco`
                    : 'sem sequência ativa ainda'}
                  {' · '}
                  {snap.activeDays30}/30 dias com foco
                  {snap.accuracyPct !== null ? ` · acerto ${snap.accuracyPct}%` : ''}
                </span>
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}
