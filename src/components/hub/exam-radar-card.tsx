'use client';

import * as React from 'react';
import { CalendarX2, CheckCircle2, Radar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { examRadarFor, type ExamRadarEntry } from '@/lib/exam-radar';
import { cn } from '@/lib/utils';

// ExamRadarCard — O RADAR DE PROVAS na home (Task 27, pedido do dono:
// "só matemática fez prova, o restante vem ainda esse mês... dá pra
// priorizar as que vão trabalhar com prova").
//
// O espelho honesto do semestre: o que JÁ foi (Matemática Av1, LM Projeto),
// o que TEM data (Algoritmos Prova 1, 30/10) e o que está a definir —
// tudo de evaluationPeriods, a mesma fonte do calendário e da fila.
// A fila do plano lê daqui a pressão (exam-radar.ts): prova próxima sobe,
// prova feita sai — e este card EXPLICA o porquê em cima.
//
// Render-time puro (lição da faixa da Av1): sem effect de interval — o D-N
// e os estados reagem ao mesmo `agora` do dashboard (SSR e 1º render
// dividem o neutro; nada de hidratação briga).

function dayLabel(date?: string): string {
  if (!date) return '';
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function statusLine(e: ExamRadarEntry): string {
  if (e.status === 'agendada') {
    const quando =
      e.daysLeft === 0 ? 'hoje' : e.daysLeft === 1 ? 'amanhã' : dayLabel(e.date);
    return `${e.name} — ${quando}`;
  }
  if (e.status === 'feita') {
    const faz = -e.daysLeft;
    return `${e.name} — feita ${faz === 0 ? 'hoje' : faz === 1 ? 'ontem' : `há ${faz} dias`} ✓`;
  }
  return 'sem data oficial — a definir';
}

function urgencyClass(e: ExamRadarEntry): string {
  if (e.status !== 'agendada') return '';
  if (e.daysLeft <= 3) return 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300';
  if (e.daysLeft <= 7) return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'border-border bg-muted/50 text-muted-foreground';
}

export function ExamRadarCard() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);

  const radar = React.useMemo(() => (now ? examRadarFor(now) : null), [now]);
  if (!now || !radar) return null;

  // Silêncio honesto: nada datado no semestre (nem à frente, nem recente)
  // = o radar não tem nada a dizer (nunca ruído por ruído).
  const temHistoria = radar.some((e) => e.status !== 'sem-data');
  if (!temHistoria) return null;

  const agendadas = radar.filter((e) => e.status === 'agendada').length;

  return (
    <Card className="rounded-2xl p-5 sm:p-6" data-t="radar-provas">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
          <Radar className="size-4 text-amber-500" aria-hidden />
          Radar de provas
        </h2>
        <span className="text-xs text-muted-foreground" data-t="radar-resumo">
          {agendadas > 0
            ? agendadas === 1
              ? '1 avaliação com data oficial'
              : `${agendadas} avaliações com data oficial`
            : 'nenhuma data oficial à frente'}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        O ciclo real do semestre: prova feita sai da fila, prova marcada pesa nela — só data
        oficial, nada de estimativa.
      </p>
      <ul className="mt-3">
        {radar.map((e, i) => (
          <li
            key={e.disciplineCode}
            className={cn('flex items-center gap-3 py-2 text-sm', i > 0 && 'border-t border-border/60')}
            data-t={`radar-${e.status}`}
          >
            {e.status === 'agendada' ? (
              <CalendarX2
                className={cn('size-4 shrink-0', e.daysLeft <= 7 ? 'text-amber-500' : 'text-muted-foreground')}
                aria-hidden
              />
            ) : e.status === 'feita' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <span className="size-1.5 shrink-0 rounded-full bg-zinc-400" aria-hidden />
            )}
            <span className="min-w-0 flex-1 leading-snug">
              <span className="font-medium">{e.disciplineShort}</span>
              <span className="text-muted-foreground"> · {statusLine(e)}</span>
            </span>
            {e.status === 'agendada' && (
              <span
                className={cn(
                  'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                  urgencyClass(e),
                )}
                aria-label={`Faltam ${e.daysLeft} dias`}
              >
                D-{e.daysLeft}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
