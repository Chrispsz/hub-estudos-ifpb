'use client';

// TRILHA — a escadinha do PPC: tópicos em ordem com domínio real por tópico,
// pré-req implícito na ordem, "próximo degrau" da Fundação em destaque.
// Tocar num tópico abre as unidades (com acurácia e fila FSRS) para praticar.

import * as React from 'react';
import { ChevronDown, Flag } from 'lucide-react';
import type { PracticeUnit, Subject, Topic } from '@/lib/v2/domain';
import {
  pickFundacao,
  topicStatsOf,
  type PlannerCtx,
  type TopicStats,
} from '@/lib/v2/planner';
import type { Suggestion } from '@/lib/v2/planner';
import { useAttempts, useSubjects, useTopics, useUnits } from '@/lib/v2/use-v2';
import { Btn, Chip, DomainBar, Empty, PageHead, Why } from './ui';
import { UnitPractice } from './unit-practice';

export function TabTrilha() {
  const subjects = useSubjects();
  const topics = useTopics();
  const units = useUnits();
  const attempts = useAttempts();

  const [openTopic, setOpenTopic] = React.useState<string | null>(null);
  const [practicing, setPracticing] = React.useState<PracticeUnit | null>(null);

  const ctx: PlannerCtx | null = React.useMemo(
    () => ({
      now: Date.now(),
      dateKey: new Date().toISOString().slice(0, 10),
      subjects,
      topics,
      units,
      attempts,
      cards: [],
      exams: [],
      backlog: [],
      template: { id: 'normal-weekday', label: '', blocks: [] },
    }),
    [subjects, topics, units, attempts],
  );

  const degraus = React.useMemo(() => (ctx ? pickFundacao(ctx, 2) : []), [ctx]);

  const statsOf = React.useCallback(
    (t: Topic): TopicStats =>
      topicStatsOf(
        t,
        units.filter((u) => u.topicId === t.id),
        attempts,
      ),
    [units, attempts],
  );

  const unitByTopic = React.useMemo(() => {
    const m = new Map<string, PracticeUnit[]>();
    for (const u of units) {
      if (!u.topicId) continue;
      const arr = m.get(u.topicId) ?? [];
      arr.push(u);
      m.set(u.topicId, arr);
    }
    return m;
  }, [units]);

  if (subjects.length === 0) return <Empty>carregando a trilha…</Empty>;

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Trilha"
        title="A escadinha do PPC"
        desc="Matéria → tópico → unidade. O degrau só vale se o anterior estiver estável — a Fundação anda um passo honesto por vez."
      />

      {degraus.length > 0 && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-violet-300">
            <Flag className="size-3.5" /> próximos degraus (Fundação)
          </p>
          <div className="space-y-2">
            {degraus.map((d) => (
              <div key={d.key}>
                <p className="font-mono text-xs font-medium text-zinc-100">{d.title}</p>
                <Why>{d.why}</Why>
              </div>
            ))}
          </div>
        </div>
      )}

      {subjects.map((subject) => {
        const chain = topics
          .filter((t) => t.subjectId === subject.id)
          .sort((a, b) => a.order - b.order);
        if (chain.length === 0) return null;
        const nextStep = degraus.find((d) => d.subjectId === subject.id);
        return (
          <div key={subject.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/70 px-4 py-2.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: subjectColor(subject.color) }}
              />
              <p className="font-mono text-[13px] font-semibold text-zinc-100">{subject.name}</p>
              <Chip tone="zinc">{subject.chWeekly}h/sem</Chip>
              <Chip tone={subject.priority === 'alta' ? 'amber' : 'zinc'}>prioridade {subject.priority}</Chip>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {chain.map((t, i) => {
                const st = statsOf(t);
                const isNext = nextStep?.topicId === t.id;
                const open = openTopic === t.id;
                const topicUnits = unitByTopic.get(t.id) ?? [];
                return (
                  <div key={t.id} className={isNext ? 'bg-violet-500/5' : ''}>
                    <button
                      type="button"
                      onClick={() => setOpenTopic(open ? null : t.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                    >
                      <span className="w-6 shrink-0 text-center font-mono text-[11px] tabular-nums text-zinc-600">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-zinc-100">{t.name}</p>
                        <div className="mt-1 max-w-xs">
                          <DomainBar value={st.domain} seeded={st.seededOnly} />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isNext && <Chip tone="violet">próximo degrau</Chip>}
                        {st.stable && <Chip tone="emerald">estável</Chip>}
                        {st.dueCount > 0 && <Chip tone="amber">{st.dueCount} na fila</Chip>}
                        {st.domain === 0 && !st.seededOnly && <Chip tone="zinc">novo</Chip>}
                        <ChevronDown
                          className={`size-3.5 text-zinc-600 transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>
                    {open && (
                      <div className="space-y-2 px-4 pb-3 sm:pl-13">
                        {t.subtopics.length > 0 && (
                          <p className="text-[11px] text-zinc-500">{t.subtopics.join(' · ')}</p>
                        )}
                        {topicUnits.length === 0 ? (
                          <p className="font-mono text-[11px] text-zinc-600">
                            sem unidades ainda — converta material do Backlog para este tópico
                          </p>
                        ) : (
                          topicUnits.map((u) => {
                            const s = st.units.find((x) => x.unitId === u.id);
                            return (
                              <div
                                key={u.id}
                                className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                              >
                                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">
                                  {u.prompt.slice(0, 90)}
                                  {u.prompt.length > 90 ? '…' : ''}
                                </span>
                                <Chip tone={s?.dueAt && s.dueAt <= Date.now() ? 'amber' : 'zinc'}>
                                  {s?.domain !== null && s?.domain !== undefined ? `${s.domain}%` : 'novo'}
                                </Chip>
                                <Btn variant="outline" onClick={() => setPracticing(u)}>
                                  praticar
                                </Btn>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {practicing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4" onClick={(e) => e.target === e.currentTarget && setPracticing(null)}>
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-violet-400">prática solta</p>
            <UnitPractice unit={practicing} onAnswered={() => setPracticing(null)} />
            <Btn variant="ghost" className="mt-3 w-full" onClick={() => setPracticing(null)}>
              fechar
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cores legadas do acervo — mantidas em tom escuro (sem azul/indigo). */
function subjectColor(color: string): string {
  const map: Record<string, string> = {
    emerald: '#10b981',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    rose: '#f43f5e',
    teal: '#14b8a6',
    orange: '#f97316',
    lime: '#84cc16',
    slate: '#64748b',
    red: '#ef4444',
    purple: '#a855f7',
    green: '#22c55e',
    pink: '#ec4899',
  };
  return map[color] ?? '#71717a';
}
