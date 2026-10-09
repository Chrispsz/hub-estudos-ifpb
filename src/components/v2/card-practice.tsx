'use client';

// FLASHCARD — frente → verso → nota FSRS (Errei=Again · Acertei=Good · Fácil=Easy).

import * as React from 'react';
import { Eye, X } from 'lucide-react';
import type { DeckCard } from '@/lib/v2/domain';
import { answerCard } from '@/lib/v2/repo';
import { Btn } from './ui';

export function CardPractice({
  card,
  onDone,
}: {
  card: DeckCard;
  onDone?: (grade: 1 | 3 | 4 | null) => void;
}) {
  const [revealed, setRevealed] = React.useState(false);

  async function grade(g: 1 | 3 | 4 | null) {
    await answerCard(card, g);
    onDone?.(g);
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-100">{card.front}</p>
      {revealed ? (
        <div className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-200">{card.back}</p>
          {card.fromMistake && (
            <p className="mt-2 text-[11px] text-amber-300/80">nasceu de um erro: {card.fromMistake}</p>
          )}
        </div>
      ) : (
        <Btn variant="outline" className="mt-3" onClick={() => setRevealed(true)}>
          <Eye className="size-3.5" /> revelar
        </Btn>
      )}
      {revealed && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="rose" onClick={() => grade(1)}>
            <X className="size-4" /> Errei
          </Btn>
          <Btn variant="emerald" onClick={() => grade(3)}>
            Acertei
          </Btn>
          <Btn variant="outline" onClick={() => grade(4)}>
            Acertei fácil
          </Btn>
          <Btn variant="ghost" onClick={() => grade(null)}>
            Não tentei
          </Btn>
        </div>
      )}
    </div>
  );
}
