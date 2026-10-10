'use client';

// CardSaveBar v2 — DO ERRO AO CARTÃO, agora no núcleo novo (T7).
//
// O TutorMarkdown legado tem um CardSaveBar que escreve no baralho LEGADO
// (useStudyProgress().addFlashcards) — proibido no v2. Este componente é o
// equivalente núcleo-novo: extrai os pares FRENTE:/VERSO (parser tolerante
// da lib tutor-cards, a MESMA que o legado usa) e grava DIRETO no Dexie
// (tabela cards), com ids determinísticos idênticos aos do gerador de
// flashcards da aba (`card:${hashStr(front|back)}`) — nunca duplica.
//
// A ligação com a mensagem fica no campo `cardIds` do TutorMessage (domain):
// uma bolha que já arquivou seus cartões não mostra a barra de novo.
//
// A fábrica de cartão (makeDeckCard) é EXPORTADA e reusada pelo
// generateFlashcards do tab-tutor — uma só gramática de id/shape no baralho v2.

import * as React from 'react';
import { CopyPlus, Layers } from 'lucide-react';
import { toast } from 'sonner';

import { extractTutorCards } from '@/lib/tutor-cards';
import { fsrsNew } from '@/lib/v2/fsrs';
import type { DeckCard, TutorMessage } from '@/lib/v2/domain';
import { getDb } from '@/lib/v2/store';

/** Hash determinístico do baralho v2 — a MESMA função que o gerador de
 * flashcards usa (extraída de tab-tutor para virar fonte única). */
export function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Cartão IA pronto para o baralho v2 — mesmo id determinístico de sempre:
 * `card:${hashStr(front|back)}` garante que re-salvar nunca duplica. */
export function makeDeckCard(subjectId: string, front: string, back: string, now = Date.now()): DeckCard {
  return {
    id: `card:${hashStr(`${front}|${back}`)}`,
    subjectId,
    front,
    back,
    source: 'ia',
    fsrs: fsrsNew(),
    createdAt: now,
  };
}

export function TutorCardSaveBar({ message, subjectId }: { message: TutorMessage; subjectId?: string }) {
  const cards = React.useMemo(() => extractTutorCards(message.content), [message.content]);
  const [busy, setBusy] = React.useState(false);

  // Sem cartão detectado, ou já arquivado (cardIds preenchido) → nada aqui.
  if (!cards.length || message.cardIds?.length) return null;

  async function save() {
    if (!subjectId || busy) return;
    setBusy(true);
    try {
      const db = getDb();
      const ids = cards.map((c) => `card:${hashStr(`${c.front}|${c.back}`)}`);
      const existing = await db.cards.bulkGet(ids);
      const fresh: DeckCard[] = [];
      for (let i = 0; i < cards.length; i++) {
        if (existing[i]) continue; // id determinístico = nunca duplica
        fresh.push(makeDeckCard(subjectId, cards[i].front, cards[i].back));
      }
      if (fresh.length) await db.cards.bulkPut(fresh);
      // a bolha fica marcada: os cartões dela já vivem no baralho
      const merged = Array.from(new Set([...(message.cardIds ?? []), ...ids]));
      await db.tutorMessages.update(message.id, { cardIds: merged });
      toast.success(
        fresh.length
          ? `${fresh.length} cartão(ões) no baralho — a fila FSRS da aba Revisão cuida do resto`
          : 'Esses cartões já estavam no baralho',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'não consegui salvar no baralho');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border border-dashed border-teal-500/40 bg-teal-500/[0.06] px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Layers className="size-3.5 shrink-0 text-teal-300/80" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] leading-snug text-zinc-200">
            {cards.length === 1
              ? 'o tutor preparou um cartão para o baralho'
              : `o tutor preparou ${cards.length} cartões para o baralho`}
          </p>
          <p className="truncate font-mono text-[10px] text-zinc-500" title={cards[0].front}>
            FRENTE: {cards[0].front}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!subjectId || busy}
          title={
            subjectId
              ? 'Salvar no baralho v2 (a revisão espaçada é da aba Revisão)'
              : 'Sem disciplina de contexto para arquivar o cartão'
          }
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-teal-500/50 px-2.5 py-1 font-mono text-[10px] text-teal-200 transition-colors hover:bg-teal-500/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CopyPlus className="size-3" aria-hidden />
          salvar no baralho
        </button>
      </div>
    </div>
  );
}
