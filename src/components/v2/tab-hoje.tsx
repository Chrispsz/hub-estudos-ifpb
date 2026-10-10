'use client';

// HOJE — o cockpit do hábito (Edição Definitiva).
//
// 1. PLANO DE HOJE: o app decide (2–4 itens, um porquê por linha, dose em
//    pomodoros, começo mínimo de 1 clique). Conteúdo da semana tem boost —
//    a resposta à dor "não ficar para trás do que o professor está dando".
// 2. REGISTRO DO DIA: check-in de 1 toque (bateria) + check-out de 10s.
//    Registro, não avaliação — alimenta o Sprint Review.
// 3. BOARD DOS BLOCOS: a rotina fixa do dia, intocável — o app nunca viola.
// 4. SESSÃO VIVA com pomodoro "terminar o pensamento" (a pausa nunca corta
//    um raciocínio no meio — a decisão é sempre do aluno).
//
// Modo Dia Leve: 15 minutos e o dia já conta (o piso do hábito).

import * as React from 'react';
import { Ban, BookOpen, Clock, Flame, Lock, Play, Square, Trophy } from 'lucide-react';
import type { PracticeUnit, RoutineBlock } from '@/lib/v2/domain';
import {
  blockIdOf,
  blockStatus,
  dateKeyOf,
  examProximityOf,
  flashcardsDue,
  mondayKeyOf,
  suggestForBlock,
  type PlannerCtx,
  type Suggestion,
} from '@/lib/v2/planner';
import { buildDayPlan, type DayPlan, type PlanItem } from '@/lib/v2/plano';
import { checkIn, checkOut, setLightDay, ENERGY_LABEL, MOOD_LABEL, type Energy, type DayMood } from '@/lib/v2/diario';
import { abandonSession, endSession, registerGameDay, setTemplateOverride, startSession } from '@/lib/v2/repo';
import {
  useActiveSession,
  useAttempts,
  useBacklog,
  useCards,
  useExams,
  useFocusMarks,
  useMetaValue,
  useRoutine,
  useSessions,
  useSubjects,
  useTopics,
  useUnits,
} from '@/lib/v2/use-v2';
import { Btn, Chip, Empty, PageHead, Panel, Textarea, Why } from './ui';
import { PomodoroBar } from './pomodoro';
import { UnitPractice } from './unit-practice';
import { CardPractice } from './card-practice';
import type { TutorMaterialContext } from './tab-materiais';

const STUDY_KINDS = new Set(['estudo-pesado', 'estudo-revisao', 'pnaat', 'flashcards', 'projeto', 'sprint-review']);

const KIND_LABEL: Record<string, string> = {
  'estudo-pesado': 'Ritmo + Fundação',
  'estudo-revisao': 'Revisão FSRS',
  pnaat: 'PNAAT',
  flashcards: 'Flashcards',
  projeto: 'Projeto',
  'sprint-review': 'Sprint Review',
};

const PLAN_KIND_LABEL: Record<PlanItem['kind'], string> = {
  ritmo: 'conteúdo',
  fundacao: 'degrau',
  revisao: 'revisão',
  flashcards: 'cartões',
};

function Elapsed({ from }: { from: number }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const t = window.setInterval(force, 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((Date.now() - from) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return (
    <span className="font-mono text-xl font-semibold tabular-nums text-emerald-400">
      {mm}:{ss}
    </span>
  );
}

export function TabHoje({
  onNavigate,
  onOpenTutor,
}: {
  onNavigate: (tab: string) => void;
  onOpenTutor?: (ctx: TutorMaterialContext) => void;
}) {
  const subjects = useSubjects();
  const topics = useTopics();
  const units = useUnits();
  const attempts = useAttempts();
  const cards = useCards();
  const exams = useExams();
  const backlog = useBacklog();
  const routine = useRoutine();
  const activeSession = useActiveSession();
  const sessions = useSessions();
  const focus = useFocusMarks();

  const now = new Date();
  const todayKey = dateKeyOf(now);
  const weekKey = mondayKeyOf(now);
  const override = useMetaValue(`rotina:override:${todayKey}`);
  const gameDaysRaw = useMetaValue(`rotina:gamedays:${weekKey}`);
  const gameDaysUsed = gameDaysRaw ? Object.keys(JSON.parse(gameDaysRaw) as Record<string, true>).length : 0;
  const lightRaw = useMetaValue(`plano:leve:${todayKey}`);
  const checkInRaw = useMetaValue(`diario:in:${todayKey}`);
  const checkOutRaw = useMetaValue(`diario:out:${todayKey}`);

  const [openBlock, setOpenBlock] = React.useState<string | null>(null);
  const [sug, setSug] = React.useState<{ blockId: string; s: Suggestion; idx: number } | null>(null);
  const [cardIdx, setCardIdx] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [mood, setMood] = React.useState<DayMood | null>(null);
  const [note, setNote] = React.useState('');

  const unitById = new Map(units.map((u) => [u.id, u] as const));

  const ctx: PlannerCtx | null = routine
    ? {
        now: now.getTime(),
        dateKey: todayKey,
        subjects,
        topics,
        units,
        attempts,
        cards,
        exams,
        backlog,
        template:
          routine.templates.find(
            (t) =>
              t.id ===
              ((override as string | null) ?? routine.weekMap[now.getDay()] ?? 'normal-weekday'),
          ) ?? routine.templates[0],
      }
    : null;

  const checkInData = React.useMemo(() => {
    try {
      return checkInRaw ? (JSON.parse(checkInRaw) as { energy: Energy }) : null;
    } catch {
      return null;
    }
  }, [checkInRaw]);
  const checkOutData = React.useMemo(() => {
    try {
      return checkOutRaw ? (JSON.parse(checkOutRaw) as { mood: DayMood; note?: string }) : null;
    } catch {
      return null;
    }
  }, [checkOutRaw]);

  // bateria baixa → o plano encolhe sozinho (o dia leve é automático, não cobrança)
  const examProx = ctx ? examProximityOf(ctx, routine?.preExamLockDays ?? 1) : null;
  const plan: DayPlan | null = ctx
    ? buildDayPlan(ctx, focus, { lightDay: lightRaw === '1' || checkInData?.energy === 'baixa' })
    : null;

  const todayMinutes = sessions
    .filter((s) => s.dateKey === todayKey && !s.vagabond)
    .reduce((acc, s) => acc + s.focusMinutes, 0);
  const todayActivity = todayMinutes > 0 || attempts.some((a) => a.at >= new Date(`${todayKey}T00:00:00`).getTime());

  async function chooseTemplate(tplId: string) {
    await setTemplateOverride(todayKey, tplId === 'auto' ? null : tplId);
    if (tplId === 'game-day') {
      const used = await registerGameDay(weekKey, todayKey);
      if (used > (routine?.gameDaysMaxPerWeek ?? 3)) {
        setMsg(`dia de jogo nº ${used} nesta semana — o teto é 3×/semana`);
      }
    }
  }

  async function begin(block: RoutineBlock, s?: Suggestion) {
    const kind = block.kind === 'pnaat' ? 'pnaat' : block.kind === 'projeto' ? 'projeto' : 'bloco';
    const id = await startSession({
      kind,
      blockId: blockIdOf(block),
      topics: s?.topicId ? [s.topicId] : undefined,
      disciplineId: s?.subjectId ?? '',
    });
    // guarda o id na sessão ativa via re-query do Dexie (useActiveSession pinta)
    window.sessionStorage.setItem('hub:v2:lastSession', id);
    if (s) setSug({ blockId: blockIdOf(block), s, idx: 0 });
  }

  /** O começo mínimo do plano → abre o bloco alvo, fixa o lote e liga a sessão. */
  async function startItem(item: PlanItem) {
    const studyOk = (b: RoutineBlock) =>
      b.kind === 'estudo-pesado' || b.kind === 'estudo-revisao' || b.kind === 'pnaat';
    const target =
      tpl.blocks.find((b) => b.kind === item.blockKind && blockStatus(b, now) === 'agora') ??
      tpl.blocks.find((b) => b.kind === item.blockKind && blockStatus(b, now) === 'futuro') ??
      tpl.blocks.find((b) => b.kind === item.blockKind) ??
      tpl.blocks.find((b) => studyOk(b) && blockStatus(b, now) === 'agora') ??
      tpl.blocks.find((b) => studyOk(b) && blockStatus(b, now) === 'futuro') ??
      tpl.blocks.find((b) => studyOk(b));
    if (!target) {
      setMsg(
        'a grade de hoje é de projeto/descanso — o conteúdo da matéria entra amanhã. Se quiser adiantar, a prateleira de Materiais e os flashcards das 20:45 estão abertos.',
      );
      return;
    }
    const bid = blockIdOf(target);
    setOpenBlock(bid);
    await begin(target, item.sug);
    window.setTimeout(() => {
      document.getElementById(`bloco-${bid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  async function closeSession(discard: boolean) {
    if (!activeSession) return;
    if (discard) await abandonSession(activeSession.id);
    else {
      const closed = await endSession(activeSession.id);
      if (closed) {
        setMsg(
          closed.vagabond
            ? 'vagabond fechado — 0 XP por doutrina, a cabeça agradece'
            : closed.xpAwarded > 0
              ? `sessão fechada: ${closed.focusMinutes} min · +${closed.xpAwarded} XP`
              : `sessão de ${closed.focusMinutes} min — a partir de 15 min ela vira XP`,
        );
      }
    }
  }

  if (!ctx || !routine || !plan) {
    return <Empty>carregando o núcleo…</Empty>;
  }

  const tpl = ctx.template;
  const estudandoNoutroBloco = !!activeSession && openBlock !== activeSession.blockId;

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Hoje"
        title={now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        desc="O app decide o quê, você decide quando. Sessão = commit; bloco = issue aberta pela rotina."
        right={
          <>
            <Chip tone="zinc">
              <Clock className="size-3" /> {tpl.label}
            </Chip>
            {examProx && examProx.exam && examProx.daysUntil >= 0 && (
              <Chip tone={examProx.eve ? 'rose' : 'amber'}>
                <Trophy className="size-3" /> {examProx.exam.name} · {examProx.daysUntil}d
              </Chip>
            )}
            <Chip tone={gameDaysUsed >= (routine.gameDaysMaxPerWeek ?? 3) ? 'rose' : 'zinc'}>
              <Flame className="size-3" /> jogo {gameDaysUsed}/{routine.gameDaysMaxPerWeek}
            </Chip>
          </>
        }
      />

      {examProx?.eve && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-300">
          véspera de prova — dia de jogo bloqueado pela rotina; o foco de hoje é a prova.
        </div>
      )}

      {/* registro de entrada — 1 toque, sem julgamento */}
      {!checkInData ? (
        <Panel className="py-3">
          <p className="font-mono text-[11px] text-zinc-400">bom te ver. como está a bateria hoje?</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['baixa', 'media', 'alta'] as Energy[]).map((e) => (
              <Btn key={e} variant="outline" onClick={() => void checkIn(todayKey, e)}>
                {ENERGY_LABEL[e]}
              </Btn>
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-zinc-600">
            bateria baixa? toque nela e o plano encolhe sozinho — 15 minutos já contam.
          </p>
        </Panel>
      ) : (
        <p className="font-mono text-[10px] text-zinc-600">bateria de hoje: {ENERGY_LABEL[checkInData.energy]}</p>
      )}

      {/* tipo de dia */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">tipo de dia:</span>
        <select
          value={(override as string | null) ?? 'auto'}
          onChange={(e) => void chooseTemplate(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
        >
          <option value="auto">auto (segue a grade da semana)</option>
          {routine.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {msg && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300">
          {msg}
        </p>
      )}

      {/* PLANO DE HOJE — o algoritmo cirúrgico, sempre com o porquê */}
      <Panel className={plan.lightDay ? 'border-amber-500/40 bg-amber-500/5' : ''}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs font-semibold text-zinc-100">plano de hoje</p>
          <button
            type="button"
            onClick={() => void setLightDay(todayKey, !plan.lightDay)}
            aria-pressed={plan.lightDay}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
              plan.lightDay
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            modo dia leve {plan.lightDay ? 'ON' : 'off'}
          </button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-300">{plan.narrative}</p>

        {plan.items.length === 0 ? (
          <Empty className="mt-3">nada vencido e fila zerada — aproveite livre, sem culpa</Empty>
        ) : (
          <div className="mt-3 space-y-2">
            {plan.items.map((item) => (
              <div
                key={item.key}
                className={`rounded-md border p-3 ${
                  item.startHere ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/40'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={item.kind === 'fundacao' ? 'violet' : item.kind === 'revisao' ? 'amber' : 'emerald'}>
                    {PLAN_KIND_LABEL[item.kind]}
                  </Chip>
                  <p className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-zinc-100">{item.title}</p>
                  <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                    ~{item.estMin}min · {item.pomodoros} ciclo(s)
                  </span>
                </div>
                <Why>{item.why}</Why>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Btn
                    variant={item.startHere ? 'emerald' : 'outline'}
                    disabled={!!activeSession}
                    onClick={() => void startItem(item)}
                  >
                    <Play className="size-3.5" /> {item.startHere ? 'começar agora' : 'abrir no bloco'}
                  </Btn>
                  {item.materialIds.map((mid) => {
                    const mat = backlog.find((b) => b.sourceRef.materialId === mid);
                    const title = mat?.title ?? mid;
                    return (
                      <button
                        key={mid}
                        type="button"
                        onClick={() =>
                          onOpenTutor?.({ materialId: mid, title, subjectId: item.sug.subjectId })
                        }
                        title="abrir o tutor com este material — ele lê o PDF real"
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-0.5 font-mono text-[10px] text-zinc-400 transition-colors hover:border-violet-500/40 hover:text-violet-200"
                      >
                        <BookOpen className="size-3" />
                        <span className="max-w-[180px] truncate">{title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="font-mono text-[10px] text-zinc-600">
              dose de hoje: {plan.totalMin}min · fila: {plan.dueUnits} unidade(s) + {plan.dueCards} cartão(ões)
            </p>
          </div>
        )}
      </Panel>

      {/* sessão viva */}
      {activeSession && (
        <Panel className="border-emerald-500/40 bg-emerald-500/5">
          <div className="flex flex-wrap items-center gap-3">
            <Elapsed from={activeSession.startedAt} />
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-zinc-200">
                sessão viva · bloco {activeSession.blockId ?? '—'}
                {activeSession.vagabond && ' · vagabond (0 XP)'}
              </p>
              {activeSession.topics && activeSession.topics.length > 0 && (
                <p className="truncate text-[10px] text-zinc-500">
                  tópicos: {activeSession.topics.map((t) => topics.find((x) => x.id === t)?.name ?? t).join(' · ')}
                </p>
              )}
            </div>
            <div className="ml-auto flex gap-2">
              <Btn variant="emerald" onClick={() => void closeSession(false)}>
                <Square className="size-3.5" /> encerrar
              </Btn>
              <Btn variant="ghost" onClick={() => void closeSession(true)}>
                <Ban className="size-3.5" /> descartar
              </Btn>
            </div>
          </div>
          <div className="mt-3">
            <PomodoroBar sessionId={activeSession.id} />
          </div>
        </Panel>
      )}

      {/* board */}
      <div className="space-y-2">
        {tpl.blocks.map((block) => {
          const bid = blockIdOf(block);
          const st = blockStatus(block, now);
          const isStudy = STUDY_KINDS.has(block.kind);
          const open = openBlock === bid;
          const suggestions = isStudy && open ? suggestForBlock(block, ctx, focus) : [];
          const mySession = activeSession && activeSession.blockId === bid;
          return (
            <div
              key={`${bid}-${block.label}`}
              id={`bloco-${bid}`}
              className={`rounded-lg border ${
                st === 'agora' && isStudy
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenBlock(open ? null : bid)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left sm:px-4"
              >
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {block.start}–{block.end}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-100">
                  {block.label}
                </span>
                {block.protected && <Lock className="size-3.5 shrink-0 text-violet-400" aria-label="bloco protegido" />}
                {isStudy && (
                  <Chip tone={st === 'agora' ? 'emerald' : st === 'passado' ? 'zinc' : 'violet'}>
                    {st === 'agora' ? 'agora' : st}
                  </Chip>
                )}
              </button>

              {open && isStudy && (
                <div className="space-y-3 border-t border-zinc-800/70 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="violet">{KIND_LABEL[block.kind] ?? block.kind}</Chip>
                    {mySession ? (
                      <Chip tone="emerald">sessão rolando</Chip>
                    ) : activeSession ? (
                      <Chip tone="zinc">outra sessão viva</Chip>
                    ) : (
                      <Btn variant="outline" onClick={() => void begin(block)}>
                        <Play className="size-3.5" /> iniciar sessão
                      </Btn>
                    )}
                  </div>

                  {block.kind === 'flashcards' ? (
                    <FlashQueue ctx={ctx} idx={cardIdx} setIdx={setCardIdx} />
                  ) : block.kind === 'sprint-review' ? (
                    <div>
                      <Why>domingo 20:30 — a semana vira relatório e o plano se reorganiza</Why>
                      <Btn variant="violet" className="mt-2" onClick={() => onNavigate('progresso/sprint')}>
                        abrir Sprint Review →
                      </Btn>
                    </div>
                  ) : block.kind === 'projeto' ? (
                    <div>
                      <Why>o slot de projeto mora nas Missões — issues grandes merecem espaço</Why>
                      <Btn variant="violet" className="mt-2" onClick={() => onNavigate('progresso/quests')}>
                        abrir Missões →
                      </Btn>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <Empty>nada vencido aqui — aproveite o bloco livre sem culpa</Empty>
                  ) : (
                    <div className="space-y-3">
                      {/* LOTE ATIVO fixado — o planner rotaciona matérias a cada resposta
                          (interleaving), mas o lote em andamento NÃO some da tela */}
                      {sug && sug.blockId === bid && <LotCard sug={sug} unitById={unitById} sessionId={activeSession?.id} onAdvance={setSug} />}
                      {suggestions.map((s) => {
                        const isPinned = sug?.s.key === s.key;
                        return (
                          <div
                            key={s.key}
                            className={`rounded-md border p-3 ${
                              s.kind === 'fundacao'
                                ? 'border-violet-500/30 bg-violet-500/5'
                                : 'border-zinc-800 bg-zinc-950/40'
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip tone={s.kind === 'fundacao' ? 'violet' : s.kind === 'ritmo' ? 'emerald' : 'zinc'}>
                                {s.kind}
                              </Chip>
                              <p className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-zinc-100">
                                {s.title}
                              </p>
                              <span className="font-mono text-[10px] text-zinc-500">~{s.estMin}min</span>
                            </div>
                            <Why>{s.why}</Why>
                            <Btn
                              variant={isPinned ? 'emerald' : 'outline'}
                              className="mt-2"
                              disabled={estudandoNoutroBloco}
                              onClick={() => setSug({ blockId: bid, s, idx: isPinned && sug ? sug.idx : 0 })}
                            >
                              {isPinned ? 'continuar o lote' : 'praticar este tópico'}
                            </Btn>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="pb-2 text-center font-mono text-[10px] text-zinc-600">
        blocos com <Lock className="inline size-3" /> são protegidos — o app nunca agenda nada neles
      </p>

      {/* registro de saída — 10 segundos, a voz do aluno no Sprint Review */}
      {!checkOutData && todayActivity && (
        <Panel>
          <p className="font-mono text-xs font-semibold text-zinc-100">como foi hoje?</p>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
            10 segundos — o registro aparece no Sprint Review da semana. Sem nota, sem julgamento.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['tranquilo', 'puxado', 'cansado', 'otimo'] as DayMood[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                aria-pressed={mood === m}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  mood === m
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {MOOD_LABEL[m]}
              </button>
            ))}
          </div>
          <Textarea
            className="mt-2"
            rows={2}
            placeholder="quer anotar 1 linha? (opcional — o que travou, o que fluiu)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="nota do dia (opcional)"
          />
          <Btn
            variant="emerald"
            className="mt-2"
            disabled={!mood}
            onClick={async () => {
              if (!mood) return;
              await checkOut(todayKey, mood, note);
              setNote('');
              setMsg('registro salvo — a semana inteira aparece no Sprint Review');
            }}
          >
            registrar o dia
          </Btn>
        </Panel>
      )}
      {checkOutData && (
        <p className="font-mono text-[10px] text-zinc-600">
          registro de hoje: {MOOD_LABEL[checkOutData.mood]}
          {checkOutData.note ? ` — "${checkOutData.note}"` : ''}
        </p>
      )}
    </div>
  );
}

/** Lote ativo fixado no bloco — sobrevive à rotação do interleaving. */
function LotCard({
  sug,
  unitById,
  sessionId,
  onAdvance,
}: {
  sug: { blockId: string; s: Suggestion; idx: number };
  unitById: Map<string, PracticeUnit>;
  sessionId?: string;
  onAdvance: (next: { blockId: string; s: Suggestion; idx: number } | null) => void;
}) {
  const queueUnits = sug.s.unitIds
    .map((id) => unitById.get(id))
    .filter((u): u is PracticeUnit => !!u);
  const cur = queueUnits[sug.idx];
  if (!cur) {
    return (
      <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3">
        <p className="font-mono text-[11px] text-violet-300">lote ativo: {sug.s.title}</p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">
          nenhuma unidade extraída deste tópico ainda — converta material no Backlog
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Chip tone="emerald">lote ativo</Chip>
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">{sug.s.title}</p>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">
          {sug.idx + 1}/{queueUnits.length}
        </span>
      </div>
      <UnitPractice
        key={cur.id}
        unit={cur}
        sessionId={sessionId}
        onAnswered={() => {
          onAdvance(
            sug.idx + 1 < queueUnits.length
              ? { ...sug, idx: sug.idx + 1 }
              : null,
          );
        }}
      />
      {sug.idx + 1 >= queueUnits.length && (
        <p className="mt-2 font-mono text-[11px] text-emerald-400">
          lote concluído — intercale para o próximo tópico (a ciência manda)
        </p>
      )}
    </div>
  );
}

function FlashQueue({
  ctx,
  idx,
  setIdx,
}: {
  ctx: PlannerCtx;
  idx: number;
  setIdx: (n: number) => void;
}) {
  const due = flashcardsDue(ctx);
  if (due.length === 0) {
    return <Empty>fila de flashcards zerada — o FSRS respira</Empty>;
  }
  const card = due[Math.min(idx, due.length - 1)];
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] text-zinc-500">
        fila de hoje: {due.length} cartão(ões) · cartão {Math.min(idx, due.length - 1) + 1}
      </p>
      <CardPractice card={card} onDone={() => setIdx(idx + 1)} />
    </div>
  );
}
