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
import { Brain, Coffee, Eye, Play } from 'lucide-react';
import { examBoostLevel, examPressureFor } from '@/lib/exam-radar';
import { useCards } from '@/lib/v2/use-v2';
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

  // A PAUSA COM PROVA DO 9 (pauta #13 — 1 cartão de recall de 2min na pausa,
  // opt-out, nunca obrigatório): o baralho FSRS do núcleo entra aqui como
  // AQUECIMENTO — sem write, sem XP, sem cobrança (o avanço de verdade
  // acontece na Revisão; a pausa só esperta a memória enquanto o café esfria).
  const cards = useCards();
  const [recallOff, setRecallOff] = React.useState<ReadonlySet<string>>(new Set());
  const [recallOpen, setRecallOpen] = React.useState(false);

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
  // A decisão vive no PRÓPRIO estado (phase 'decisao') — comparar foco/relógio
  // aqui fazia a caixa sumir: o efeito troca phase p/ 'decisao' e este cálculo
  // voltava a ser false (a caixa nunca aparecia; pausa/+10min ficavam mortos).
  const decisao = st.phase === 'decisao';

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

  // O cartão da pausa: vencidos, SEM os pulados desta pausa; a PROVA MANDA
  // no aquecimento (mesma régua da fila — matéria com prova D-7 primeiro);
  // sem pressão, o mais vencido (a memória que mais precisa). Pausa fora →
  // nada na tela (anti-ruído).
  const recallCard = React.useMemo(() => {
    if (st.phase !== 'pausa') return null;
    const nowMs = Date.now();
    const dueCards = cards.filter(
      (c) => c.fsrs?.due != null && c.fsrs.due <= nowMs && !recallOff.has(c.id),
    );
    if (dueCards.length === 0) return null;
    const boost = (subjectId: string) =>
      examBoostLevel(examPressureFor(subjectId, new Date(nowMs))?.daysLeft ?? null);
    return [...dueCards].sort((a, b) => {
      const db = boost(b.subjectId) - boost(a.subjectId);
      if (db !== 0) return db;
      return (a.fsrs?.due ?? 0) - (b.fsrs?.due ?? 0);
    })[0];
  }, [st.phase, cards, recallOff]);

  // Cartão troca → a resposta fecha de novo (o recall é DE CABEÇA, sempre).
  React.useEffect(() => {
    setRecallOpen(false);
  }, [recallCard?.id]);

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
                  onClick={() => {
                    // A pausa nasce limpa: o pulado da pausa anterior não
                    // contamina esta (e o recall fecha de novo).
                    setRecallOff(new Set());
                    setRecallOpen(false);
                    patch({
                      phase: 'pausa',
                      cycles: nextCycle,
                      pausaEndsAt: Date.now() + (isLongDue ? LONG_BREAK_MIN : BREAK_MIN) * 60_000,
                      pausaLong: isLongDue,
                      budgetMin: FOCUS_MIN,
                      extended: false,
                    });
                  }}
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

          {/* A PAUSA COM PROVA DO 9 (pauta #13): 1 cartão, 2min, opt-out —
              o recall DE CABEÇA fixa mais que reler, e a pausa é o momento
              honesto para ele. Pular é 1 toque e nunca cobra nada. */}
          {recallCard && (
            <div className="mt-2.5 rounded-md border border-violet-500/30 bg-violet-500/5 p-2.5">
              <div className="flex items-center gap-2">
                <Brain className="size-3.5 shrink-0 text-violet-300" aria-hidden />
                <span className="font-mono text-[11px] text-violet-300">
                  aquecimento de 2min — 1 cartão (opcional)
                </span>
                <button
                  type="button"
                  onClick={() => setRecallOff((prev) => new Set(prev).add(recallCard.id))}
                  className="ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
                >
                  pular
                </button>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-zinc-200">{recallCard.front}</p>
              {recallOpen ? (
                <div className="mt-2 space-y-1.5">
                  <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] leading-snug text-emerald-200">
                    {recallCard.back}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    lembrava? ótimo — aqui não conta nada: o avanço de verdade acontece na Revisão
                  </p>
                </div>
              ) : (
                <Btn variant="outline" className="mt-2" onClick={() => setRecallOpen(true)}>
                  <Eye className="size-3.5" /> lembrar de cabeça — ver resposta
                </Btn>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
