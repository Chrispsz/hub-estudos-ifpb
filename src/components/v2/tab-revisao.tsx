'use client';

// REVISÃO — a fila FSRS do dia (unidades vencidas, mais atrasadas primeiro).
// Fila zerada = botão de "revisão do dia completa" (XP 1×/dia, guard-rail).

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PracticeUnit } from '@/lib/v2/domain';
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
  const due = React.useMemo(
    () =>
      units
        .filter((u) => u.fsrs && u.fsrs.due <= now && u.topicId)
        .sort((a, b) => (a.fsrs!.due ?? 0) - (b.fsrs!.due ?? 0)),
    [units, now],
  );

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
  const overdueDays = unit.fsrs ? Math.floor((now - unit.fsrs.due) / 86_400_000) : 0;

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Revisão"
        title="Fila FSRS"
        desc="Errei encurta o intervalo, acertei alonga. O algoritmo decide — você só responde."
        right={
          <>
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
        </p>
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
