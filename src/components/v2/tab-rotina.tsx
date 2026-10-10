'use client';

// ROTINA — a grade semanal fixa. O app NUNCA viola: blocos protegidos trancados,
// teto de dias de jogo 3×/semana, véspera de prova bloqueia jogo.
// Editor da semana: template por dia da semana (escreve na tabela routine).

import * as React from 'react';
import { Flame, Lock, Trophy } from 'lucide-react';
import {
  blockIdOf,
  blockStatus,
  dateKeyOf,
  examProximityOf,
  mondayKeyOf,
  type PlannerCtx,
} from '@/lib/v2/planner';
import { registerGameDay, setTemplateOverride, setMeta } from '@/lib/v2/repo';
import { useExams, useMetaValue, useRoutine, useSubjects, useTopics, useUnits, useAttempts, useBacklog, useCards } from '@/lib/v2/use-v2';
import { Btn, Chip, Empty, PageHead, Select } from './ui';
import type { DayTemplateId, RoutineConfig, RoutineTemplate } from '@/lib/v2/domain';
import { getDb } from '@/lib/v2/store';
import { buildRoutine } from '@/lib/v2/content-seed';

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const STUDY_KINDS = new Set(['estudo-pesado', 'estudo-revisao', 'pnaat', 'flashcards', 'projeto']);

function minutesOfHhmm(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Total de minutos de estudo do template (blocos de prática real). */
function studyMinutesOf(tpl: RoutineTemplate): number {
  return tpl.blocks
    .filter((bl) => STUDY_KINDS.has(bl.kind))
    .reduce((acc, bl) => acc + (minutesOfHhmm(bl.end) - minutesOfHhmm(bl.start)), 0);
}

function fmtStudy(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

const KIND_STYLE: Record<string, string> = {
  'estudo-pesado': 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  'estudo-revisao': 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  pnaat: 'border-teal-500/40 bg-teal-500/10 text-teal-300',
  flashcards: 'border-lime-500/40 bg-lime-500/10 text-lime-300',
  'descanso-protegido': 'border-violet-500/30 bg-violet-500/5 text-violet-300',
  jogo: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  projeto: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  'sprint-review': 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  refeicao: 'border-zinc-700 text-zinc-400',
  pessoal: 'border-zinc-700 text-zinc-500',
  livre: 'border-zinc-700 text-zinc-500',
  soneca: 'border-violet-500/30 text-violet-300',
  ocupado: 'border-zinc-700 text-zinc-600',
};

export function TabRotina() {
  const routine = useRoutine();
  const exams = useExams();
  const subjects = useSubjects();
  const topics = useTopics();
  const units = useUnits();
  const attempts = useAttempts();
  const backlog = useBacklog();
  const cards = useCards();

  const now = new Date();
  const todayKey = dateKeyOf(now);
  const weekKey = mondayKeyOf(now);
  const gameDaysRaw = useMetaValue(`rotina:gamedays:${weekKey}`);
  const gameDays = gameDaysRaw ? Object.keys(JSON.parse(gameDaysRaw) as Record<string, true>) : [];

  const examProx = React.useMemo(() => {
    if (!routine) return null;
    const ctx: PlannerCtx = {
      now: now.getTime(),
      dateKey: todayKey,
      subjects,
      topics,
      units,
      attempts,
      cards,
      exams,
      backlog,
      template: { id: 'normal-weekday', label: '', blocks: [] },
    };
    return examProximityOf(ctx, routine.preExamLockDays ?? 1);
     
  }, [routine, exams, subjects, topics, units, attempts, backlog, cards, todayKey]);

  if (!routine) return <Empty>carregando a rotina…</Empty>;

  const dow = now.getDay();
  const todayTplId = routine.weekMap[dow];
  const todayTpl = routine.templates.find((t) => t.id === todayTplId);

  async function setWeekDay(d: number, tplId: string) {
    if (!routine) return;
    const weekMap = { ...routine.weekMap, [d]: tplId as DayTemplateId };
    const next: RoutineConfig = { ...routine, weekMap, updatedAt: Date.now() };
    await getDb().routine.put(next);
    // o dono curtiu a grade dele — a semente não sobrescreve em re-migrações
    await setMeta('routine:userEdited', new Date().toISOString());
  }

  async function gameToday() {
    const used = await registerGameDay(weekKey, todayKey);
    await setTemplateOverride(todayKey, 'game-day');
    if (used > routine!.gameDaysMaxPerWeek) {
      window.alert(`dia de jogo nº ${used} — o teto da casa é 3×/semana`);
    }
  }

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Rotina"
        title="A grade que o app nunca viola"
        desc="Blocos protegidos são intocáveis — nem o agendador, nem a prova, nem o jogo passam por cima. ~4h de estudo/dia útil · lanche 16:30 · janta 19:15 · dormir 22h."
        right={
          <>
            <Chip tone={gameDays.length >= routine.gameDaysMaxPerWeek ? 'rose' : 'zinc'}>
              <Flame className="size-3" /> jogo {gameDays.length}/{routine.gameDaysMaxPerWeek}
            </Chip>
            {examProx && examProx.exam && examProx.daysUntil >= 0 && examProx.daysUntil <= 21 && (
              <Chip tone={examProx.eve ? 'rose' : 'amber'}>
                <Trophy className="size-3" /> {examProx.daysUntil}d p/ prova
              </Chip>
            )}
          </>
        }
      />

      {examProx?.eve && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-300">
          véspera de prova ({examProx.exam!.name}) — dia de jogo bloqueado pela rotina
        </div>
      )}

      {/* hoje */}
      {todayTpl && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/70 px-4 py-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              hoje — {todayTpl.label}
            </p>
            <Chip tone="emerald">estudo do dia {fmtStudy(studyMinutesOf(todayTpl))}</Chip>
          </div>
          <div className="space-y-1 p-2 sm:p-3">
            {todayTpl.blocks.map((b) => {
              const st = blockStatus(b, now);
              return (
                <div
                  key={blockIdOf(b) + b.label}
                  className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 ${KIND_STYLE[b.kind] ?? 'border-zinc-800 text-zinc-400'} ${
                    st === 'agora' ? 'ring-1 ring-emerald-400/60' : ''
                  }`}
                >
                  <span className="font-mono text-[11px] tabular-nums">
                    {b.start}–{b.end}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{b.label}</span>
                  {b.protected && <Lock className="size-3 shrink-0" />}
                  {st === 'agora' && <Chip tone="emerald">agora</Chip>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="outline" disabled={!!examProx?.eve} onClick={() => void gameToday()}>
          <Flame className="size-3.5" /> hoje é dia de jogo
        </Btn>
        <span className="font-mono text-[10px] text-zinc-500">
          liga o template de jogo, conta no teto da semana (21h15–24h)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Btn
          variant="outline"
          onClick={() => {
            if (window.confirm('Voltar à grade padrão (a grade readesenhada do app)? Edições da semana são substituídas.')) {
              void (async () => {
                await getDb().routine.put(buildRoutine());
                await getDb().meta.delete('routine:userEdited');
              })();
            }
          }}
        >
          voltar à grade padrão
        </Btn>
        <span className="font-mono text-[10px] text-zinc-500">
          a grade é editável por aqui — “a gente vai adaptando”
        </span>
      </div>

      {/* editor da grade semanal */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          grade da semana
        </p>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="flex items-center gap-3">
              <span className="w-8 font-mono text-xs text-zinc-400">{DOW[d]}</span>
              <Select
                value={routine.weekMap[d] ?? 'normal-weekday'}
                onChange={(e) => void setWeekDay(d, e.target.value)}
              >
                {routine.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center font-mono text-[10px] text-zinc-600">
        acordar 05:00 · descanso protegido 13:30 · estudo 15:00 · lanche 16:30 · janta 19:15 · dormir 22:00 — a espinha dorsal não se negocia
      </p>
    </div>
  );
}
