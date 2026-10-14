'use client';

// CODE REVIEW — o error log VIVO. Erro registrado no ato (1 frase + categoria),
// status que evolui com as tentativas reais: aberto → re-testado → dominado
// (2 acertos de cabeça seguidos na mesma unidade). Nada é apagado — o histórico é honesto.

import * as React from 'react';
import { GitBranch, Repeat2 } from 'lucide-react';
import type { Attempt, ErrorCategory, PracticeUnit } from '@/lib/v2/domain';
import { errorStatusFor } from '@/lib/v2/error-review';
import { useAttempts, useSubjects, useTopics, useUnits } from '@/lib/v2/use-v2';
import { Btn, Chip, Empty, PageHead, Stat } from './ui';
import { UnitPractice } from './unit-practice';

type Filter = 'todos' | ErrorCategory;

const CAT_TONE = {
  conceito: 'violet',
  deslize: 'amber',
  tempo: 'rose',
} as const;

const CAT_LABEL: Record<ErrorCategory, string> = {
  conceito: 'conceito',
  deslize: 'deslize',
  tempo: 'tempo',
};

interface ErrorRow {
  attempt: Attempt;
  unit: PracticeUnit;
  status: 'aberto' | 're-testado' | 'dominado';
  subjectShort: string;
  topicName: string;
}

export function TabCodeReview() {
  const attempts = useAttempts();
  const units = useUnits();
  const subjects = useSubjects();
  const topics = useTopics();
  const [filter, setFilter] = React.useState<Filter>('todos');
  const [practicing, setPracticing] = React.useState<PracticeUnit | null>(null);

  const unitById = React.useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const rows = React.useMemo<ErrorRow[]>(() => {
    // o status honesto vem do derivador do núcleo (error-review.ts) — a MESMA
    // régua que a fila da casa usa no Ciclo do Erro (pauta nº 1): um critério
    // só, dois lugares (o log e a fila nunca discordam).
    const out: ErrorRow[] = [];
    for (const a of attempts) {
      if (a.result !== 'wrong' || !a.error) continue;
      const unit = unitById.get(a.unitId);
      if (!unit) continue;
      const subShort = subjects.find((s) => s.id === unit.subjectId)?.shortName ?? unit.subjectId;
      const topicName = topics.find((t) => t.id === unit.topicId)?.name ?? 'tópico solto';
      out.push({
        attempt: a,
        unit,
        status: errorStatusFor(a, attempts),
        subjectShort: subShort,
        topicName,
      });
    }
    return out.sort((x, y) => y.attempt.at - x.attempt.at);
  }, [attempts, unitById, subjects, topics]);

  const filtered = filter === 'todos' ? rows : rows.filter((r) => r.attempt.error!.category === filter);
  const open = rows.filter((r) => r.status === 'aberto').length;
  const dominated = rows.filter((r) => r.status === 'dominado').length;
  const byCat = (c: ErrorCategory) => rows.filter((r) => r.attempt.error!.category === c).length;

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Code Review"
        title="Log de erros vivo"
        desc="Erro não é vergonha — é commit reverso. Cada erro carrega 1 frase do porquê e vira re-teste agendado pelo FSRS."
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="abertos" value={open} hint="esperando re-teste" />
        <Stat label="dominados" value={dominated} hint="2 acertos de cabeça" />
        <Stat label="total" value={rows.length} hint="todo erro fica registrado" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['todos', 'conceito', 'deslize', 'tempo'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
              filter === f
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f}
            {f !== 'todos' && ` (${byCat(f)})`}
          </button>
        ))}
      </div>

      {practicing && (
        <div>
          <p className="mb-1.5 font-mono text-[11px] text-zinc-500">re-teste agora — de cabeça:</p>
          <UnitPractice unit={practicing} onAnswered={() => setPracticing(null)} />
        </div>
      )}

      {filtered.length === 0 ? (
        <Empty>nenhum erro nesta lente — o code review respira</Empty>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r.attempt.id}
              className={`rounded-md border p-3 ${
                r.status === 'aberto'
                  ? 'border-rose-500/25 bg-rose-500/5'
                  : r.status === 'dominado'
                    ? 'border-emerald-500/25 bg-emerald-500/5'
                    : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={CAT_TONE[r.attempt.error!.category]}>
                  {CAT_LABEL[r.attempt.error!.category]}
                </Chip>
                <Chip tone={r.status === 'aberto' ? 'rose' : r.status === 'dominado' ? 'emerald' : 'zinc'}>
                  {r.status}
                </Chip>
                <span className="font-mono text-[10px] text-zinc-500">
                  {r.subjectShort} · {new Date(r.attempt.at).toLocaleDateString('pt-BR')}
                </span>
                <Btn variant="outline" className="ml-auto" onClick={() => setPracticing(r.unit)}>
                  <Repeat2 className="size-3.5" /> re-testar
                </Btn>
              </div>
              <p className="mt-1.5 font-mono text-[12px] text-zinc-200">
                “{r.attempt.error!.reason}”
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500" title={r.unit.prompt.slice(0, 200)}>
                <GitBranch className="mr-1 inline size-3" />
                {r.topicName} — {r.unit.prompt.slice(0, 110)}
                {r.unit.prompt.length > 110 ? '…' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
