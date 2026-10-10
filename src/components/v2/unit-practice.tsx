'use client';

// UNIDADE DE PRÁTICA — o registro <10s: prompt → (ver solução) → Acertei/Errei/Não tentei.
// Errei EXIGE 1 frase do porquê + categoria (a casa não aceita erro mudo).

import * as React from 'react';
import { Check, Eye, X } from 'lucide-react';
import type { ErrorCategory, PracticeUnit } from '@/lib/v2/domain';
import { answerUnit } from '@/lib/v2/repo';
import { Btn, Select, Textarea } from './ui';

const CATEGORIES: { id: ErrorCategory; label: string; tone: string }[] = [
  { id: 'conceito', label: 'conceito — não sabia', tone: 'text-violet-300 border-violet-500/40' },
  { id: 'deslize', label: 'deslize — sabia, escorreguei', tone: 'text-amber-300 border-amber-500/40' },
  { id: 'tempo', label: 'tempo — não deu conta no relógio', tone: 'text-rose-300 border-rose-500/40' },
];

export function UnitPractice({
  unit,
  sessionId,
  onAnswered,
  compact = false,
}: {
  unit: PracticeUnit;
  sessionId?: string;
  onAnswered?: (info: { result: string; xp: number }) => void;
  compact?: boolean;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const [noLookup, setNoLookup] = React.useState(true);
  const [errOpen, setErrOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [category, setCategory] = React.useState<ErrorCategory>('conceito');
  const [busy, setBusy] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);

  async function commit(result: 'correct' | 'wrong' | 'skipped') {
    if (busy) return;
    if (result === 'wrong' && !reason.trim()) {
      setErrOpen(true);
      return;
    }
    setBusy(true);
    try {
      const { xp } = await answerUnit({
        unit,
        result,
        noLookup,
        sessionId,
        error: result === 'wrong' ? { reason: reason.trim(), category } : undefined,
      });
      setFlash(
        result === 'correct'
          ? `+${xp} XP · FSRS reagendou`
          : result === 'wrong'
            ? 'erro no Code Review · FSRS encurtou o intervalo'
            : 'pulada — volta pro fim da fila de hoje',
      );
      onAnswered?.({ result, xp });
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'falha ao registrar');
    } finally {
      setBusy(false);
      setErrOpen(false);
      setReason('');
    }
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
        <span className="rounded border border-zinc-700 px-1.5 py-0.5 uppercase tracking-wider">
          {unit.type === 'kata' ? 'kata' : unit.type === 'board' ? 'quadro' : 'questão'}
        </span>
        <span>diff {unit.difficulty}/3</span>
        <span>· {unit.source}</span>
      </div>

      <p className={`mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-100 ${compact ? 'line-clamp-6' : ''}`}>
        {unit.prompt}
      </p>

      {unit.hint && !revealed && (
        <p className="mt-2 text-[11px] text-zinc-500">
          dica: <span className="text-zinc-400">{unit.hint}</span>
        </p>
      )}

      {revealed ? (
        <div className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            solução
          </p>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-200">
            {unit.answer ?? '— sem solução registrada — corrija no tutor e registre o que decidiu'}
          </p>
        </div>
      ) : (
        unit.answer && (
          <Btn variant="outline" className="mt-3" onClick={() => setRevealed(true)}>
            <Eye className="size-3.5" /> ver solução
          </Btn>
        )
      )}

      {errOpen && (
        <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
          <p className="mb-2 font-mono text-[11px] text-rose-300">
            por que errou? 1 frase — o code review começa aqui
          </p>
          <Textarea
            rows={2}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex.: troquei a ordem do push/pop na pilha — confundi LIFO com FIFO"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
                  category === c.id
                    ? c.tone
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Btn variant="rose" disabled={!reason.trim() || busy} onClick={() => commit('wrong')}>
              <X className="size-3.5" /> registrar erro
            </Btn>
            <Btn variant="ghost" onClick={() => setErrOpen(false)}>
              cancelar
            </Btn>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!errOpen && (
          <>
            <Btn variant="emerald" disabled={busy} onClick={() => commit('correct')}>
              <Check className="size-4" /> Acertei
            </Btn>
            <Btn variant="rose" disabled={busy} onClick={() => setErrOpen(true)}>
              <X className="size-4" /> Errei
            </Btn>
            <Btn variant="outline" disabled={busy} onClick={() => commit('skipped')}>
              Não tentei
            </Btn>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-zinc-500">
              <input
                type="checkbox"
                checked={noLookup}
                onChange={(e) => setNoLookup(e.target.checked)}
                className="accent-emerald-500"
              />
              de cabeça (sem consulta)
            </label>
          </>
        )}
      </div>

      {flash && <p className="mt-2 font-mono text-[11px] text-emerald-400">{flash}</p>}
    </div>
  );
}
