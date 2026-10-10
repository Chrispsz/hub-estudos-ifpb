'use client';

// ESTUDAR — o workspace (Edição Definitiva). 5 superfícies de estudo num
// destino só, com controle segmentado (a filosofia COSMIC: menos destinos,
// mais coesão). Reaproveita as abas vivas do núcleo — nada foi reescrito.

import * as React from 'react';
import { TabTrilha } from './tab-trilha';
import { TabRevisao } from './tab-revisao';
import { TabBacklog } from './tab-backlog';
import { TabCodeReview } from './tab-code-review';
import { TabMateriais, type TutorMaterialContext } from './tab-materiais';

const SEGMENTS = [
  { id: 'materiais', label: 'Materiais' },
  { id: 'trilha', label: 'Trilha' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'erros', label: 'Erros' },
] as const;

export type EstudarSeg = (typeof SEGMENTS)[number]['id'];

export function isEstudarSeg(s: string): s is EstudarSeg {
  return SEGMENTS.some((x) => x.id === s);
}

export function TabEstudar({
  seg,
  onSeg,
  onOpenTutor,
  materialFilter,
  onClearMaterialFilter,
}: {
  seg: EstudarSeg;
  onSeg: (s: EstudarSeg) => void;
  onOpenTutor: (ctx: TutorMaterialContext) => void;
  /** Ponte hub:open-practice — conjunto ligado da Trilha (material em foco). */
  materialFilter?: string | null;
  onClearMaterialFilter?: () => void;
}) {
  return (
    <div className="space-y-3">
      <nav aria-label="Áreas de estudo" className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSeg(s.id)}
            aria-current={seg === s.id}
            className={`min-h-[36px] whitespace-nowrap rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
              seg === s.id
                ? 'bg-emerald-500/15 font-semibold text-emerald-300'
                : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {seg === 'materiais' && <TabMateriais onOpenTutor={onOpenTutor} />}
      {seg === 'trilha' && (
        <TabTrilha materialFilter={materialFilter} onClearMaterialFilter={onClearMaterialFilter} />
      )}
      {seg === 'revisao' && <TabRevisao />}
      {seg === 'backlog' && <TabBacklog />}
      {seg === 'erros' && <TabCodeReview />}
    </div>
  );
}
