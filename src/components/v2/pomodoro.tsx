'use client';

// POMODORO DA CASA — "terminar o pensamento" (Edição Definitiva).
//
// A ciência (P14 da pesquisa): o flow leva 15–30min para se formar e cortar
// no meio de uma questão destrói o raciocínio recém-feito. Então aqui a
// pausa NUNCA nasce sozinha: quando o ciclo fecha, o app PERGUNTA —
// "estou no fluxo?" estende 10min, "pausa" abre a pausa de verdade
// (sem celular: levantar, água, olhar longe). A decisão é sempre do aluno.
//
// Estado vivo no localStorage por sessão — sobrevive a reload, como tudo na casa.

import * as React from 'react';
import { Coffee, Play } from 'lucide-react';
import { Btn } from './ui';

const FOCUS_MIN = 25;
const BREAK_MIN = 5;
const LONG_BREAK_MIN = 15;
const EXTEND_MIN = 10;
const LONG_EVERY = 4; // 4 ciclos → pausa longa

interface PomoState {
  cycles: number; // ciclos fechados
  phase: 'foco' | 'decisao' | 'pausa';
  budgetMin: number; // duração do ciclo atual (25 → 35 com "+10min")
  focoStartAt: number;
  pausaEndsAt?: number;
  pausaLong?: boolean; // rótulo honesto da pausa em curso
  extended: boolean; // "+10min" já usado neste ciclo
}

function load(sessionId: string): PomoState {
  try {
    const raw = localStorage.getItem(`hub:v2:pomo:${sessionId}`);
    if (raw) return JSON.parse(raw) as PomoState;
  } catch {
    /* storage indisponível — estado novo */
  }
  return { cycles: 0, phase: 'foco', budgetMin: FOCUS_MIN, focoStartAt: Date.now(), extended: false };
}

function save(sessionId: string, s: PomoState) {
  try {
    localStorage.setItem(`hub:v2:pomo:${sessionId}`, JSON.stringify(s));
  } catch {
    /* sem storage — o estado vive só na sessão */
  }
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function PomodoroBar({ sessionId }: { sessionId: string }) {
  const [st, setSt] = React.useState<PomoState>(() => load(sessionId));
  const [, force] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    const t = window.setInterval(force, 1000);
    return () => window.clearInterval(t);
  }, []);

  function patch(next: Partial<PomoState>) {
    setSt((prev) => {
      const merged = { ...prev, ...next };
      save(sessionId, merged);
      return merged;
    });
  }

  const now = Date.now();
  const focoElapsed = now - st.focoStartAt;
  const focoTotal = st.budgetMin * 60_000;
  const focoLeft = focoTotal - focoElapsed;
  const decisao = st.phase === 'foco' && focoLeft <= 0;

  // ciclo fechou → a decisão é do aluno (a pausa nunca corta o pensamento)
  React.useEffect(() => {
    if (st.phase === 'foco' && focoLeft <= 0) patch({ phase: 'decisao' });
    // pausa acabou → foco volta sozinho, sem cobrança
    if (st.phase === 'pausa' && st.pausaEndsAt && now >= st.pausaEndsAt) {
      patch({ phase: 'foco', focoStartAt: Date.now(), budgetMin: FOCUS_MIN, extended: false });
    }
  });

  const nextCycle = st.cycles + 1;
  const isLongDue = nextCycle % LONG_EVERY === 0;

  return (
    <div className="w-full">
      {st.phase !== 'pausa' ? (
        <div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${decisao ? 'bg-violet-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.max(2, Math.min(100, (100 * focoElapsed) / focoTotal))}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
              {decisao ? `${st.budgetMin}:00` : mmss(focoLeft)} · ciclo {nextCycle}
            </span>
          </div>

          {decisao && (
            <div className="mt-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-2.5">
              <p className="font-mono text-[11px] text-violet-300">ciclo fechou — você no ritmo?</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Btn
                  variant="violet"
                  disabled={st.extended}
                  onClick={() =>
                    patch({
                      phase: 'foco',
                      budgetMin: st.budgetMin + EXTEND_MIN,
                      extended: true,
                    })
                  }
                >
                  <Play className="size-3.5" /> terminar o pensamento (+{EXTEND_MIN}min)
                </Btn>
                <Btn
                  variant="outline"
                  onClick={() =>
                    patch({
                      phase: 'pausa',
                      cycles: nextCycle,
                      pausaEndsAt: Date.now() + (isLongDue ? LONG_BREAK_MIN : BREAK_MIN) * 60_000,
                      pausaLong: isLongDue,
                      budgetMin: FOCUS_MIN,
                      extended: false,
                    })
                  }
                >
                  <Coffee className="size-3.5" /> {isLongDue ? `pausa longa ${LONG_BREAK_MIN}min` : `pausa ${BREAK_MIN}min`}
                </Btn>
              </div>
              {st.extended && (
                <p className="mt-1.5 font-mono text-[10px] text-zinc-500">
                  o +10min já foi usado neste ciclo — a pausa é a próxima boa decisão
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-zinc-700 bg-zinc-900/70 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Coffee className="size-3.5 text-amber-300" />
            <span className="font-mono text-[11px] text-amber-300">
              pausa {st.pausaLong ? 'longa' : ''} — {st.pausaEndsAt ? mmss(st.pausaEndsAt - now) : BREAK_MIN + ':00'}
            </span>
            <span className="font-mono text-[10px] text-zinc-500">levanta, bebe água, olha longe — o celular espera</span>
            <Btn
              variant="outline"
              className="ml-auto"
              onClick={() => patch({ phase: 'foco', focoStartAt: Date.now(), budgetMin: FOCUS_MIN, extended: false })}
            >
              voltar ao foco
            </Btn>
          </div>
          <p className="mt-1 font-mono text-[10px] text-zinc-600">
            a pausa termina sozinha e o foco volta — sem cobrança se você demorar
          </p>
        </div>
      )}
    </div>
  );
}
