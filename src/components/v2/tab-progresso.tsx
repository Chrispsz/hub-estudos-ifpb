'use client';

// PROGRESSO — o painel da longa estrada (Edição Definitiva). Sprint Review,
// Missões, Rotina e Perfil num destino só — o que se olha de vez em quando
// nunca compete com o que se usa todo dia.

import * as React from 'react';
import { TabSprint } from './tab-sprint';
import { TabQuests } from './tab-quests';
import { TabRotina } from './tab-rotina';
import { TabPerfil } from './tab-perfil';

const SEGMENTS = [
  { id: 'sprint', label: 'Sprint Review' },
  { id: 'quests', label: 'Missões' },
  { id: 'rotina', label: 'Rotina' },
  { id: 'perfil', label: 'Perfil' },
] as const;

export type ProgressoSeg = (typeof SEGMENTS)[number]['id'];

export function isProgressoSeg(s: string): s is ProgressoSeg {
  return SEGMENTS.some((x) => x.id === s);
}

export function TabProgresso({ seg, onSeg }: { seg: ProgressoSeg; onSeg: (s: ProgressoSeg) => void }) {
  return (
    <div className="space-y-3">
      <nav aria-label="Áreas de progresso" className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSeg(s.id)}
            aria-current={seg === s.id}
            className={`min-h-[36px] whitespace-nowrap rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
              seg === s.id
                ? 'bg-violet-500/15 font-semibold text-violet-300'
                : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {seg === 'sprint' && <TabSprint />}
      {seg === 'quests' && <TabQuests />}
      {seg === 'rotina' && <TabRotina />}
      {seg === 'perfil' && <TabPerfil />}
    </div>
  );
}
