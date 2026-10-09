'use client';

// ABA TUTOR — o tutor IA do Hub, INTEGRADO ao núcleo v2.
// Paridade com a casa antiga: streaming SSE com freio do aluno, anexo de print
// com rótulo de procedência, modo socrático (dica antes da solução) e markdown
// rico com KaTeX. Evolução v2: o tutor lê o PLANO AO VIVO do núcleo (Ritmo/
// Fundação, tópico em foco da sessão viva, últimos erros do Code Review, prova
// mais próxima, fila FSRS) e manda junto em cada pergunta — acompanhamento quase
// automático: ele sempre sabe onde o aluno está, sem o aluno precisar explicar.
// Geração de flashcards cai DIRETO no baralho v2 (Dexie) — nada de escrita legada.

import * as React from 'react';
import {
  BookOpenCheck,
  Brain,
  Camera,
  CircleStop,
  CornerUpLeft,
  GraduationCap,
  ListChecks,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { TutorMarkdown } from '@/components/hub/tutor-markdown';
import { streamTutorAnswer, TUTOR_QUESTION_SAFE_MAX, capQuestion } from '@/lib/tutor-stream';
import { nid } from '@/lib/v2/repo';
import { fsrsNew } from '@/lib/v2/fsrs';
import {
  dateKeyOf,
  mondayKeyOf,
  examProximityOf,
  pickFundacao,
  pickRitmo,
  recoveryStatus,
  topicStatsOf,
  type PlannerCtx,
} from '@/lib/v2/planner';
import { getDb } from '@/lib/v2/store';
import type { DeckCard, Exam, Topic, TutorMessage } from '@/lib/v2/domain';
import {
  useActiveSession,
  useAttempts,
  useCards,
  useExams,
  useRoutine,
  useSessions,
  useSubjects,
  useTopics,
  useUnits,
} from '@/lib/v2/use-v2';
import { Btn, Chip, Empty, PageHead, Panel } from './ui';

/** Espelho do contrato do API (route.ts) — mensagens de contexto do chat. */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ---------- helpers ----------

const THREAD_KEEP = 120; // pod: a thread vive no núcleo, mas não cresce sem fim
const HISTORY_SEND = 12; // o API usa 12 de contexto (MAX_HISTORY)

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Print/foto → JPEG comprimido (máx 1280px) — o API aceita data:image/ ≤ 8 MB. */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('falha ao ler o arquivo'));
    fr.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('imagem inválida'));
      im.src = raw;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return raw; // não comprimiu? manda o original — o API valida o teto
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// ---------- bloco de contexto ao vivo (o acompanhamento quase automático) ----------

function buildContextBlock(
  ctx: PlannerCtx,
  opts: { focusTopic: Topic | null; lastErrors: { reason: string; category: string; unitPrompt: string }[] },
): string {
  const lines: string[] = [];
  const rec = recoveryStatus(ctx);
  const examProx = examProximityOf(ctx, 21);

  if (rec.active) {
    lines.push(
      `Modo: RECUPERAÇÃO ativa (dívida de ritmo: ${rec.ritmoDebt} matéria(s) ≥7d sem toque · fundação ${rec.fundacaoProgress}% estável)`,
    );
  } else {
    lines.push('Modo: plano equilibrado (recuperação concluída)');
  }

  const ritmo = pickRitmo(ctx, 2);
  const fundacao = pickFundacao(ctx, 1);
  if (ritmo.length || fundacao.length) {
    const parts: string[] = [];
    if (ritmo.length) parts.push(`RITMO → ${ritmo.map((s) => s.title).join(' · ')}`);
    if (fundacao.length) parts.push(`FUNDAÇÃO → ${fundacao.map((s) => s.title).join(' · ')}`);
    lines.push(`Plano de hoje: ${parts.join(' | ')}`);
  }

  if (opts.focusTopic) {
    const st = topicStatsOf(
      opts.focusTopic,
      ctx.units.filter((u) => u.topicId === opts.focusTopic?.id),
      ctx.attempts,
      ctx.now,
    );
    const subj = ctx.subjects.find((s) => s.id === opts.focusTopic?.subjectId);
    lines.push(
      `Tópico em foco (sessão viva): ${subj ? `${subj.shortName} · ` : ''}${opts.focusTopic.name} — domínio ${st.domain}%`,
    );
  }

  if (opts.lastErrors.length) {
    lines.push(
      `Últimos erros: ${opts.lastErrors
        .map((e) => `"${truncate(e.reason, 80)}" (${e.category} — em "${truncate(e.unitPrompt, 60)}")`)
        .join(' · ')}`,
    );
  }

  if (examProx.exam && examProx.daysUntil >= 0) {
    lines.push(
      `Prova mais próxima: ${examProx.exam.name} (${examProximityLabel(examProx.daysUntil)})${
        examProx.exam.scope ? ` — escopo: ${truncate(examProx.exam.scope, 100)}` : ''
      }`,
    );
  }

  const dueUnits = ctx.units.filter((u) => u.fsrs && u.fsrs.due <= ctx.now).length;
  const dueCards = ctx.cards.filter((c) => c.fsrs.due <= ctx.now).length;
  lines.push(`Fila de revisão hoje: ${dueUnits} unidade(s) + ${dueCards} cartão(ões)`);

  return lines.length ? `=== CONTEXTO AO VIVO DO APP (use como base, não responda a isto) ===\n${lines.join('\n')}\n=== FIM DO CONTEXTO ===` : '';
}

function examProximityLabel(days: number): string {
  if (days === 0) return 'HOJE';
  if (days === 1) return 'amanhã';
  return `em ${days} dias`;
}

// ---------- thread viva (Dexie reativo — cada escrita re-renderiza) ----------

function useThread(): TutorMessage[] | null {
  return useLiveQuery(
    async () => {
      const all = await getDb().tutorMessages.toArray();
      return all.sort((a, b) => a.at - b.at);
    },
    [],
    null,
  );
}

async function saveMessage(m: TutorMessage): Promise<void> {
  const db = getDb();
  await db.tutorMessages.put(m);
  const all = await db.tutorMessages.toArray();
  if (all.length > THREAD_KEEP) {
    const asc = all.sort((a, b) => a.at - b.at);
    const excess = asc.slice(0, all.length - THREAD_KEEP).map((x) => x.id);
    await db.tutorMessages.bulkDelete(excess);
  }
}

// ---------- componente ----------

interface Pending {
  image?: string; // data URL
  imageLabel?: string;
}

export function TabTutor() {
  const subjects = useSubjects();
  const topics = useTopics();
  const units = useUnits();
  const attempts = useAttempts();
  const cards = useCards();
  const exams = useExams();
  const routine = useRoutine();
  const sessions = useSessions();
  const active = useActiveSession();
  const thread = useThread();

  const [input, setInput] = React.useState('');
  const [hintMode, setHintMode] = React.useState(false);
  const [streaming, setStreaming] = React.useState(false);
  const [streamText, setStreamText] = React.useState('');
  const [pending, setPending] = React.useState<Pending>({});
  const [showPlan, setShowPlan] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const stickRef = React.useRef(true);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const now = Date.now();
  const todayKey = dateKeyOf();

  const ctx: PlannerCtx | null =
    routine && subjects.length
      ? {
          now,
          dateKey: todayKey,
          subjects,
          topics,
          units,
          attempts,
          cards,
          exams,
          backlog: [],
          template:
            routine.templates.find((t) => t.id === routine.weekMap[new Date().getDay()]) ??
            routine.templates[0],
        }
      : null;

  // tópico em foco: a sessão viva aponta os tópicos intercalados
  const focusTopic: Topic | null = React.useMemo(() => {
    if (!active?.topics?.length || !topics.length) return null;
    const last = active.topics[active.topics.length - 1];
    return topics.find((t) => t.id === last) ?? null;
  }, [active, topics]);

  // últimos 3 erros reais (Code Review vivo)
  const lastErrors = React.useMemo(() => {
    const withErr = attempts.filter((a) => a.result === 'wrong' && a.error).slice(0, 3);
    return withErr.map((a) => ({
      reason: a.error?.reason ?? '',
      category: a.error?.category ?? 'conceito',
      unitPrompt: units.find((u) => u.id === a.unitId)?.prompt ?? '',
    }));
  }, [attempts, units]);

  // mensagem enviada (não streaming) — mostra o "pensando" honesto
  const msgs = thread ?? [];

  // autoscroll colado no fundo quando o usuário está no fim
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [msgs.length, streamText, streaming]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  async function send(rawQuestion: string, opts?: { retryImage?: string; retryLabel?: string }) {
    const q = rawQuestion.trim();
    if (!q && !opts?.retryImage && !pending.image) return;
    if (streaming) return;
    if (!ctx) {
      toast.error('O núcleo ainda está abrindo — tente de novo em um instante.');
      return;
    }

    const image = opts?.retryImage ?? pending.image;
    const imageLabel = opts?.retryLabel ?? pending.imageLabel;
    const question = capQuestion(q, TUTOR_QUESTION_SAFE_MAX);

    // 1) contexto ao vivo (o tutor sempre sabe onde o aluno está)
    const contextBlock = buildContextBlock(ctx, { focusTopic, lastErrors });
    const effectiveQuestion = contextBlock
      ? `${contextBlock}\n\nPERGUNTA DO ALUNO:\n${question || 'Resolva e explique passo a passo a questão da imagem anexada.'}`
      : question || 'Resolva e explique passo a passo a questão da imagem anexada.';

    // 2) mensagem do usuário entra no núcleo ANTES do envio (nunca se perde)
    await saveMessage({
      id: nid('tm'),
      role: 'user',
      content: q,
      at: Date.now(),
      imageLabel: image ? (imageLabel || 'Print anexado') : undefined,
      topicId: focusTopic?.id,
    });

    // 3) histórico recente (o API usa 12 — conteúdo cru, sem o bloco de contexto)
    const hist: ChatMessage[] = msgs
      .slice(-HISTORY_SEND)
      .map((m) => ({ role: m.role, content: truncate(m.content, 2000) }));

    // 4) stats do núcleo → hubContext (o prompt do servidor já sabe ler)
    const answered = attempts.filter((a) => a.result !== 'skipped');
    const mondayKey = mondayKeyOf();
    const weekMinutes = sessions
      .filter((s) => s.dateKey >= mondayKey)
      .reduce((acc, s) => acc + s.focusMinutes, 0);
    const hubContext = {
      today: todayKey,
      studentStats: {
        materialsDone: 0,
        materialsTotal: 0,
        topicsDone: topics.filter((t) =>
          attempts.some((a) => units.find((u) => u.id === a.unitId)?.topicId === t.id),
        ).length,
        topicsTotal: topics.length,
        pomodoroMinutes: weekMinutes,
        flashcardsDue: cards.filter((c) => c.fsrs.due <= now).length,
        exercisesSolved: answered.filter((a) => a.result === 'correct').length,
        exercisesTotal: units.length,
      },
      nextEvaluations: exams
        .filter((e: Exam) => e.status === 'awaiting')
        .map((e: Exam) => {
          const days = Math.ceil((new Date(`${e.date}T12:00:00`).getTime() - now) / 86_400_000);
          return {
            name: e.name,
            discipline: subjects.find((s) => s.id === e.subjectId)?.name ?? '',
            date: e.date.slice(8, 10) + '/' + e.date.slice(5, 7),
            daysLeft: days,
            description: e.scope,
          };
        })
        .filter((x) => x.daysLeft >= 0 && x.daysLeft <= 45),
    };

    setStreaming(true);
    setStreamText('');
    stickRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamTutorAnswer(
        {
          question: effectiveQuestion,
          discipline: focusTopic ? subjects.find((s) => s.id === focusTopic.subjectId)?.name : undefined,
          topic: focusTopic?.name,
          hintMode,
          history: hist,
          hubContext,
          imageDataUrl: image,
        },
        (piece, full) => setStreamText(full),
        controller.signal,
      );

      await saveMessage({
        id: nid('tm'),
        role: 'assistant',
        content: result.answer,
        at: Date.now(),
        interrupted: result.interrupted,
        model: result.model,
        topicId: focusTopic?.id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'O tutor não respondeu.';
      toast.error(msg);
    } finally {
      setStreaming(false);
      setStreamText('');
      abortRef.current = null;
      setPending({});
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function retryLast() {
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    // corta a thread a partir da última pergunta (a resposta ruim sai do histórico)
    const db = getDb();
    const idx = msgs.findIndex((m) => m.id === lastUser.id);
    const toDrop = msgs.slice(idx);
    await db.tutorMessages.bulkDelete(toDrop.map((m) => m.id));
    await send(lastUser.content, { retryImage: undefined, retryLabel: undefined });
  }

  // ---------- flashcards direto para o baralho v2 ----------
  async function generateFlashcards() {
    if (streaming) return;
    const topicName = focusTopic?.name ?? subjects[0]?.name;
    if (!topicName) return;
    const subjectId = focusTopic?.subjectId ?? subjects[0]?.id;
    if (!subjectId) return;
    setStreaming(true);
    setStreamText('');
    try {
      // o API exige question != vazio mesmo no modo flashcards — o tema vai no topic
      const result = await streamTutorAnswer({
        mode: 'flashcards',
        question: `Gere flashcards sobre o tema "${topicName}".`,
        discipline: subjects.find((s) => s.id === subjectId)?.name,
        topic: topicName,
      });
      const cleaned = result.answer.replace(/```(?:json)?/g, '').trim();
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start === -1 || end === -1) throw new Error('a IA não devolveu JSON válido');
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { front?: string; back?: string }[];
      const valid = parsed.filter((c) => c.front && c.back).slice(0, 6);
      if (!valid.length) throw new Error('nenhum cartão válido veio da IA');

      const db = getDb();
      const existing = new Set((await db.cards.toArray()).map((c) => c.id));
      const newCards: DeckCard[] = [];
      for (const c of valid) {
        const id = `card:${hashStr(`${c.front}|${c.back}`)}`;
        if (existing.has(id)) continue; // id determinístico = nunca duplica
        newCards.push({
          id,
          subjectId,
          front: c.front as string,
          back: c.back as string,
          source: 'ia',
          fsrs: fsrsNew(),
          createdAt: Date.now(),
        });
      }
      if (newCards.length) await db.cards.bulkPut(newCards);
      await saveMessage({
        id: nid('tm'),
        role: 'assistant',
        content: `**${newCards.length} flashcard(s) gerado(s)** para *${topicName}* e salvos no baralho (aba Revisão):\n\n${(newCards.length ? newCards : valid).map((c) => `- **${c.front}** → ${c.back}`).join('\n')}`,
        at: Date.now(),
        cardIds: newCards.map((c) => c.id),
      });
      toast.success(newCards.length ? `${newCards.length} cartão(ões) no baralho — revisão espaçada agendada pelo FSRS` : 'Esses cartões já existiam no baralho');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'falha ao gerar flashcards');
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  }

  // ---------- render ----------

  const dueCount = cards.filter((c) => c.fsrs.due <= now).length + units.filter((u) => u.fsrs && u.fsrs.due <= now && u.topicId).length;
  const rec = ctx ? recoveryStatus(ctx) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        kicker="tutor · ia integrada ao plano"
        title="Tutor"
        desc="O tutor lê o estado do núcleo em tempo real (plano, foco, erros, provas) — você pergunta, ele já sabe onde você está. Print anexado é lido com visão."
        right={
          <>
            {rec?.active && <Chip tone="amber">modo recuperação</Chip>}
            <Chip tone={dueCount ? 'violet' : 'zinc'}>fila hoje {dueCount}</Chip>
            <Chip tone="zinc">{msgs.length} msg</Chip>
          </>
        }
      />

      <Panel className="flex flex-col gap-3 p-3 sm:p-4">
        {/* thread */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="max-h-[52vh] min-h-[280px] overflow-y-auto pr-1 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin]"
          aria-live="polite"
        >
          {msgs.length === 0 && !streaming ? (
            <div className="flex flex-col gap-2 py-8">
              <Empty>
                pergunte qualquer coisa — o tutor já recebe o plano, o foco e os erros por trás.
              </Empty>
              <p className="text-center text-[11px] text-zinc-600">
                dica: anexe o print da questão (botão de câmera) que ele lê direto da imagem.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {msgs.map((m) => (
                <li key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[92%] rounded-lg border px-3 py-2 sm:max-w-[85%] ${
                      m.role === 'user'
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-zinc-800 bg-zinc-900/80'
                    }`}
                  >
                    {m.imageLabel && (
                      <p className="mb-1 flex items-center gap-1 font-mono text-[10px] text-emerald-200/80">
                        <Camera className="size-3" /> {m.imageLabel}
                      </p>
                    )}
                    {m.role === 'assistant' ? (
                      <>
                        <TutorMarkdown content={m.content} />
                        <p className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-zinc-600">
                          {m.interrupted && <span className="text-amber-500/80">parcial — você parou a geração</span>}
                          {m.model && <span>{m.model}</span>}
                        </p>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-emerald-100">{m.content}</p>
                    )}
                  </div>
                </li>
              ))}
              {streaming && (
                <li className="flex justify-start">
                  <div className="max-w-[92%] rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 sm:max-w-[85%]">
                    {streamText ? (
                      <TutorMarkdown content={streamText} />
                    ) : (
                      <p className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                        <RefreshCw className="size-3 animate-spin" /> pensando no plano…
                      </p>
                    )}
                  </div>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* plano que o tutor está vendo — transparência total */}
        {ctx && (
          <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40">
            <button
              type="button"
              onClick={() => setShowPlan((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
              aria-expanded={showPlan}
            >
              <span>contexto que o tutor recebe em cada pergunta</span>
              <span>{showPlan ? '− esconder' : '+ ver'}</span>
            </button>
            {showPlan && (
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-zinc-800/80 px-3 py-2 font-mono text-[10px] leading-relaxed text-zinc-400">
                {buildContextBlock(ctx, { focusTopic, lastErrors })}
              </pre>
            )}
          </div>
        )}

        {/* quick actions */}
        <div className="flex flex-wrap gap-1.5">
          <QuickBtn icon={<Brain className="size-3" />} label="explicar tópico em foco" onClick={() => void send('Explica o tópico em foco do jeito que cai em prova, com um exemplo prático e uma pegadinha comum.')} disabled={streaming} />
          <QuickBtn icon={<ListChecks className="size-3" />} label="quiz · 3 questões" onClick={() => void send('Me dê um quiz de 3 questões sobre o tópico em foco (uma fácil, uma média, uma difícil). NÃO revele as respostas — eu tento primeiro.')} disabled={streaming} />
          <QuickBtn icon={<CornerUpLeft className="size-3" />} label="por que errei?" onClick={() => void send(lastErrors.length ? `Analise meu erro mais recente: marquei "${truncate(lastErrors[0].reason, 200)}" (categoria ${lastErrors[0].category}). Explique o conceito por trás e como não repetir.` : 'Ainda não há erros registrados no Code Review — bora prevenir: qual o erro mais comum no tópico em foco?')} disabled={streaming} />
          <QuickBtn icon={<BookOpenCheck className="size-3" />} label="gerar flashcards" onClick={() => void generateFlashcards()} disabled={streaming} />
        </div>

        {/* anexo pendente */}
        {pending.image && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
            <Camera className="size-3.5 text-emerald-300" />
            <input
              className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-emerald-100 placeholder:text-emerald-200/40 focus:outline-none"
              placeholder="rótulo do print (de onde veio — ex.: pág. 12 · Lista 3)"
              value={pending.imageLabel ?? ''}
              onChange={(e) => setPending((p) => ({ ...p, imageLabel: e.target.value }))}
            />
            <button type="button" onClick={() => setPending({})} aria-label="remover anexo" className="text-emerald-300/70 hover:text-emerald-200">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* composer */}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const dataUrl = await fileToCompressedDataUrl(f);
                setPending((p) => ({ ...p, image: dataUrl }));
              } catch {
                toast.error('não consegui ler a imagem');
              }
            }}
          />
          <Btn variant="ghost" className="size-9 min-h-0 shrink-0 p-0" title="anexar print/foto da questão" onClick={() => fileRef.current?.click()} disabled={streaming}>
            <Camera className="size-4" />
          </Btn>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const q = input;
                setInput('');
                void send(q);
              }
            }}
            rows={2}
            placeholder="sua pergunta para o tutor… (Enter envia · Shift+Enter quebra linha)"
            aria-label="pergunta ao tutor"
            className="min-h-[44px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
          <div className="flex shrink-0 flex-col gap-1">
            {streaming ? (
              <Btn variant="rose" onClick={stop} title="parar geração">
                <CircleStop className="size-3.5" /> parar
              </Btn>
            ) : (
              <Btn
                variant="emerald"
                onClick={() => {
                  const q = input;
                  setInput('');
                  void send(q);
                }}
                disabled={!input.trim() && !pending.image}
              >
                <Send className="size-3.5" /> enviar
              </Btn>
            )}
            <Btn variant="ghost" className="min-h-0 px-2 py-1 text-[10px]" onClick={() => setHintMode((v) => !v)} title="modo socrático: pistas antes da solução">
              <GraduationCap className={`size-3 ${hintMode ? 'text-violet-300' : ''}`} /> dica {hintMode ? 'ON' : 'off'}
            </Btn>
          </div>
        </div>

        {/* rodapé da aba: retry + atalho para fila */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-2 text-[10px] text-zinc-600">
          <button type="button" onClick={() => void retryLast()} disabled={streaming || !msgs.some((m) => m.role === 'user')} className="underline decoration-dotted hover:text-zinc-400 disabled:opacity-40">
            reenviar última pergunta
          </button>
          <p>
            a thread vive no núcleo (IndexedDB) · flashcards gerados caem no baralho da{' '}
            <span className="text-zinc-400">aba Revisão</span>
          </p>
        </div>
      </Panel>
    </div>
  );
}

function QuickBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 font-mono text-[11px] text-zinc-300 transition-colors hover:border-violet-500/40 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}
