'use client';

// REVISÃO — a fila FSRS do dia (unidades vencidas, mais atrasadas primeiro),
// agora com PRESSÃO DE PROVA (pauta #3, dono 13/10/2026): quando a prova de
// uma matéria é D-7 ou menos, os cartões dos tópicos dela SOBEM na fila — o
// FSRS e o radar de provas deixam de viver em abas separadas. A régua é a da
// casa (só DATA OFICIAL conta; prova feita não pressiona): D-21 acende
// (etiqueta) · D-7 pesa (sobe na fila) · D-3 manda.
// Fila zerada = botão de "revisão do dia completa" (XP 1×/dia, guard-rail).

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PracticeUnit } from '@/lib/v2/domain';
import { examBoostLevel, examPressureFor, examWhenPhrase } from '@/lib/exam-radar';
import { dateKeyOf } from '@/lib/v2/planner';
import { markReviewDayComplete } from '@/lib/v2/repo';
import { useAttempts, useMetaValue, useSubjects, useTopics, useUnits } from '@/lib/v2/use-v2';
import { Btn, Chip, Empty, PageHead } from './ui';
import { UnitPractice } from './unit-practice';

export function TabRevisao() {
  const units = useUnits();
  const attempts = useAttempts();
  const subjects = useSubjects();
  const topics = useTopics();
  const todayKey = dateKeyOf();
  const reviewDone = useMetaValue(`xp:reviewday:${todayKey}`);

  const [idx, setIdx] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);

  const now = Date.now();
  const nowDate = React.useMemo(() => new Date(now), [now]);

  // O radar por matéria (pauta #3): só quem TEM prova oficial à frente entra
  // no mapa — anti-estimativa, a mesma fonte do plano (exam-radar.ts).
  const pressureBySubject = React.useMemo(() => {
    const map = new Map<
      string,
      { name: string; daysLeft: number; boost: number; short: string }
    >();
    for (const s of subjects) {
      const p = examPressureFor(s.id, nowDate);
      if (!p) continue;
      map.set(s.id, { ...p, boost: examBoostLevel(p.daysLeft), short: s.shortName });
    }
    return map;
  }, [subjects, nowDate]);

  const due = React.useMemo(
    () =>
      units
        .filter((u) => u.fsrs && u.fsrs.due <= now && u.topicId)
        .sort((a, b) => {
          // A PRESSÃO MANDA (pauta #3): prova D-7 ou menos e a unidade sobe
          // para a frente da fila; dentro do mesmo nível, o mais vencido
          // primeiro (o FSRS continua mandando dentro da mesma urgência).
          const la = (pressureBySubject.get(a.subjectId)?.boost ?? 0) >= 2 ? 1 : 0;
          const lb = (pressureBySubject.get(b.subjectId)?.boost ?? 0) >= 2 ? 1 : 0;
          if (la !== lb) return lb - la;
          return (a.fsrs!.due ?? 0) - (b.fsrs!.due ?? 0);
        }),
    [units, now, pressureBySubject],
  );

  const examOf = (u: PracticeUnit) => pressureBySubject.get(u.subjectId) ?? null;

  const label = React.useCallback(
    (u: PracticeUnit) => {
      const sub = subjects.find((s) => s.id === u.subjectId)?.shortName ?? u.subjectId;
      const top = topics.find((t) => t.id === u.topicId)?.name ?? '';
      return `${sub} · ${top}`;
    },
    [subjects, topics],
  );

  async function onAllDone() {
    const { awarded } = await markReviewDayComplete(todayKey);
    setMsg(awarded ? 'revisão do dia completa: +5 XP' : 'revisão do dia já estava contada — sem XP duplo');
  }

  if (due.length === 0) {
    return (
      <div className="space-y-4">
        <PageHead
          kicker="Revisão"
          title="Fila FSRS"
          desc="Repetição espaçada com ts-fsrs — nada de revisar o que a memória ainda segura sozinha."
        />
        <Empty>fila zerada — a estabilidade de hoje já foi colhida</Empty>
        {!reviewDone && (
          <div className="text-center">
            <Btn variant="emerald" onClick={() => void onAllDone()}>
              <CheckCircle2 className="size-4" /> marcar revisão do dia como completa (+5 XP)
            </Btn>
          </div>
        )}
        {msg && <p className="text-center font-mono text-[11px] text-emerald-400">{msg}</p>}
      </div>
    );
  }

  const unit = due[Math.min(idx, due.length - 1)];
  const unitExam = unit ? examOf(unit) : null;
  const leadExam = due.length > 0 ? examOf(due[0]) : null;
  const overdueDays = unit.fsrs ? Math.floor((now - unit.fsrs.due) / 86_400_000) : 0;

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Revisão"
        title="Fila FSRS"
        desc="Errei encurta o intervalo, acertei alonga. O algoritmo decide — e a prova próxima sobe a fila."
        right={
          <>
            {leadExam && leadExam.boost >= 2 && (
              <Chip tone="violet">
                prova de {leadExam.short} {examWhenPhrase(leadExam.daysLeft)}
              </Chip>
            )}
            <Chip tone="violet">fila: {Math.max(due.length - idx, 0)}</Chip>
            {reviewDone && <Chip tone="emerald">dia contado (+5 XP)</Chip>}
          </>
        }
      />

      {msg && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300">
          {msg}
        </p>
      )}

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${Math.round((100 * Math.min(idx, due.length)) / due.length)}%` }}
        />
      </div>

      <div>
        <p className="mb-1.5 font-mono text-[11px] text-zinc-500">
          {label(unit)}
          {overdueDays > 0 && <span className="text-amber-400"> · vence há {overdueDays}d</span>}
          {unitExam && unitExam.boost >= 1 && (
            <span className="text-violet-400">
              {' '}· prova de {unitExam.short} {examWhenPhrase(unitExam.daysLeft)}
            </span>
          )}
        </p>
        {unitExam && unitExam.boost >= 2 && (
          <p className="mb-2 font-mono text-[10px] leading-snug text-violet-400">
            subiu na fila — a prova de {unitExam.short} é {examWhenPhrase(unitExam.daysLeft)}
            {' '}({unitExam.name}): os tópicos dela vêm primeiro
          </p>
        )}
        <UnitPractice
          unit={unit}
          onAnswered={() => {
            if (idx + 1 >= due.length) void onAllDone();
            else setIdx(idx + 1);
          }}
        />
      </div>
    </div>
  );
}
