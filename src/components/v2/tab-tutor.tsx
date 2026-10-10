'use client';

// ABA TUTOR — o tutor IA do Hub, INTEGRADO ao núcleo v2.
// Paridade com a casa antiga: streaming SSE com freio do aluno, anexo de print
// com rótulo de procedência, modo socrático (dica antes da solução) e markdown
// rico com KaTeX. Evolução v2: o tutor lê o PLANO AO VIVO do núcleo (Ritmo/
// Fundação, tópico em foco da sessão viva, últimos erros do Code Review, prova
// mais próxima, fila FSRS) e manda junto em cada pergunta — acompanhamento quase
// automático: ele sempre sabe onde o aluno está, sem o aluno precisar explicar.
// Geração de flashcards cai DIRETO no baralho v2 (Dexie) — nada de escrita legada.
//
// Run #4 unificada (T5/T6/T7/T9/T11/T12/T14/T16) — o tutor ≥ legado, a base do
// estudo: captura de tela com recorte (useScreenCapture + CaptureCropDialog +
// banner de arrumação), colagem de imagem/PDF rasgado (tutor-image +
// paste-cleanup), lightbox do anexo (pendente e dos turnos), "continuar de
// onde parou" pós-interrupção, rascunho do composer que sobrevive ao dock,
// histórico rico (separadores de dia, HH:MM, busca no fio, export .md/copiar),
// quiz "me testa" estruturado, FRENTE:/VERSO → cartão no baralho v2
// (tutor-card-save), TUTOR_CARD_SUFFIX no "por que errei?" e modo Feynman.
//
// DADOS PESSOAIS FORA DO SERVIDOR (diretriz do dono, 10/10/2026): a thread vive
// no Dexie (IndexedDB) e cada chamada leva persist:false — o servidor não grava
// NADA do chat. A camada institucional (IFPB, turma, professores, grade, calendário
// ao vivo) é do SERVIDOR (tutor-course-base — computada por chamada, o que passou
// some); daqui só viaja o estado pessoal do dia (ritmo, consistência), que o
// servidor usa na resposta e descarta.

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
  ScreenShare,
  Search,
  Send,
  Speech,
  TriangleAlert,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { TutorMarkdown } from '@/components/hub/tutor-markdown';
import { CaptureCropDialog } from '@/components/hub/capture-crop-dialog';
import { CaptureTidyBanner } from '@/components/hub/capture-tidy-banner';
import { PrintLightboxDialog } from '@/components/hub/print-lightbox-dialog';
import {
  streamTutorAnswer,
  TUTOR_QUESTION_SAFE_MAX,
  TUTOR_STOP_MESSAGE,
  capQuestion,
} from '@/lib/tutor-stream';
import { screenCaptureSupported, useScreenCapture } from '@/lib/screen-capture';
import { downscaleImageFile, imageFromClipboard } from '@/lib/tutor-image';
import { looksFragmentedPaste, normalizePdfPaste } from '@/lib/paste-cleanup';
import { canContinueFromInterrupt, TUTOR_CONTINUE_QUESTION } from '@/lib/tutor-continue';
import {
  clearComposerDraft,
  composerDraftKey,
  loadComposerDraft,
  saveComposerDraft,
} from '@/lib/composer-draft';
import {
  chatDayGroups,
  hhmmOf,
  searchFoldLoose,
  searchNavStep,
  searchSnippetSegments,
} from '@/lib/tutor-history-view';
import { buildChatMarkdown, downloadTextFile, type ExportableTurn } from '@/lib/tutor-chat-export';
import { buildQuizPrompt } from '@/lib/tutor-quiz';
import { TUTOR_CARD_SUFFIX } from '@/lib/tutor-cards';
import { nid } from '@/lib/v2/repo';
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
import { TutorCardSaveBar, makeDeckCard } from './tutor-card-save';
import type { TutorMaterialContext } from './tab-materiais';

/** Espelho do contrato do API (route.ts) — mensagens de contexto do chat. */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Linhas de erro do sistema (role 'system'/isError) NUNCA viram histórico de
 * chat — o API recebe só turnos reais de pergunta/resposta.
 */
function isChatTurn(m: TutorMessage): m is TutorMessage & { role: 'user' | 'assistant' } {
  return m.role === 'user' || m.role === 'assistant';
}

// ---------- helpers ----------

const THREAD_KEEP = 120; // pod: a thread vive no núcleo, mas não cresce sem fim
const HISTORY_SEND = 12; // o API usa 12 de contexto (MAX_HISTORY)

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Nota "X/100" quando a resposta traz a avaliação Feynman estruturada. */
function feynScoreOf(content: string): string | null {
  const m = /Pontuação\s*:\s*(\d{1,3})\s*\/\s*100/i.exec(content);
  return m ? `${m[1]}/100` : null;
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
      `Modo: RECUPERAÇÃO ativa (${rec.ritmoDebt} matéria(s) há ≥7d sem toque — recuperar com calma, um bloco por vez · fundação ${rec.fundacaoProgress}% estável)`,
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

export function TabTutor({
  material,
  onClearMaterial,
  onClose,
}: {
  /** Material em foco (aberto pela prateleira) — o servidor lê o PDF REAL dele. */
  material?: TutorMaterialContext | null;
  onClearMaterial?: () => void;
  onClose?: () => void;
} = {}) {
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

  // T14 — o rascunho que sobrevive: o dock desmonta a cada fechamento; o que
  // estava digitado (texto + anexo) volta na reabertura, por material. Memória
  // de SESSÃO (a mesma lib do legado) — recarregou a página, recomeça.
  const draftKey = composerDraftKey('panel', material?.materialId ?? 'geral');
  const initialDraft = loadComposerDraft(draftKey); // leitura pura de Map de sessão

  const [input, setInput] = React.useState(initialDraft?.input ?? '');
  const [pending, setPending] = React.useState<Pending>(
    initialDraft?.image ? { image: initialDraft.image, imageLabel: initialDraft.imageLabel } : {},
  );
  const [draftRestored, setDraftRestored] = React.useState(
    Boolean(initialDraft?.input.trim() || initialDraft?.image),
  );
  const [hintMode, setHintMode] = React.useState(false);
  const [feynman, setFeynman] = React.useState(false); // T16 — modo Feynman (por composição)
  const [streaming, setStreaming] = React.useState(false);
  const [streamText, setStreamText] = React.useState('');
  const [showPlan, setShowPlan] = React.useState(false);
  // status honesto da IA (uma consulta só — as keys vivem no deploy, nunca no cliente)
  const [aiStatus, setAiStatus] = React.useState<'checking' | 'ready' | 'nokey'>('checking');
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const stickRef = React.useRef(true);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  // T5 — captura de tela com recorte: o frame bruto vive só até o diálogo fechar.
  const [screenOk, setScreenOk] = React.useState(true);
  React.useEffect(() => setScreenOk(screenCaptureSupported()), []);
  const [captureCanvas, setCaptureCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const { capturing, tidying, tidySeconds, startCapture } = useScreenCapture(
    React.useCallback((canvas: HTMLCanvasElement) => {
      setCaptureCanvas(canvas);
      setCaptureOpen(true);
    }, []),
  );

  // T11 — lightbox do anexo: o MESMO data URL que já existe no estado/thread
  // (nada novo é salvo, nada é enviado — só visão).
  const [lightbox, setLightbox] = React.useState<{ src: string; label: string | null } | null>(null);

  // T12 — a busca que caminha no fio: agulha fofa (acento/caixa/pontuação),
  // lista de casamentos com snippet e navegação Enter/Shift+Enter.
  const [searchQ, setSearchQ] = React.useState('');
  const [searchFocus, setSearchFocus] = React.useState<number | null>(null);
  const searchActive = searchQ.trim().length > 0;

  const now = Date.now();
  const todayKey = dateKeyOf();

  // material aberto pela prateleira → o composer já nasce com a pergunta boa
  // (o aluno só aperta enviar — minimizar passos até começar)
  React.useEffect(() => {
    if (!material) return;
    setInput((cur) =>
      cur.trim()
        ? cur
        : `Estou lendo o material "${material.title}". Explica os pontos essenciais dele — o que costuma cair em prova e os erros comuns de interpretação.`,
    );
  }, [material]);

  // o rascunho vivo acompanha o composer a cada gesto (envio zera → a lib
  // apaga sozinha: rascunho vazio é esquecimento honesto, não memória)
  React.useEffect(() => {
    saveComposerDraft(draftKey, { input, image: pending.image, imageLabel: pending.imageLabel });
  }, [input, pending, draftKey]);

  // status do tutor no DEPLOY (GET /api/tutor): gemini/openrouter/zai com key?
  // Honestidade de casa — o chip diz a verdade sem expor nenhuma key.
  React.useEffect(() => {
    let alive = true;
    fetch('/api/tutor')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const p = (d?.providers ?? {}) as { gemini?: boolean; openrouter?: boolean; zaiPublic?: boolean };
        setAiStatus(p.gemini || p.openrouter || p.zaiPublic ? 'ready' : 'nokey');
      })
      .catch(() => {
        if (alive) setAiStatus('nokey');
      });
    return () => {
      alive = false;
    };
  }, []);

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

  // T11 — separadores de dia ("Hoje" · "Ontem" · dd/mm): o fio com calendário.
  // Índice 0 é "Hoje" no topo — separador ali é ruído, não informação; e durante
  // a busca eles saem (a lista de casamentos é o mapa agora).
  const daySeps = React.useMemo(() => {
    const groups = chatDayGroups(msgs.map((m) => new Date(m.at).toISOString()));
    return new Map(groups.filter((g) => g.index > 0).map((g) => [g.index, g.label]));
  }, [msgs]);

  const chatTurns = React.useMemo(() => msgs.filter(isChatTurn), [msgs]);

  // T9 — a palavra de volta: a bolha interrompida, enquanto for a ÚLTIMA do fio,
  // oferece o continuar (o parcial já vai no history — o servidor costura).
  const continueTargetId = React.useMemo(() => {
    const turns = chatTurns.map((m) => ({
      role: m.role,
      content: m.content,
      error: m.isError,
      interrupted: m.interrupted,
    }));
    if (!canContinueFromInterrupt(turns, turns.length - 1)) return null;
    return chatTurns[chatTurns.length - 1].id;
  }, [chatTurns]);

  // T12 — resultados da busca (turnos reais de chat; erro não é conversa)
  const searchResults = React.useMemo(() => {
    const needle = searchFoldLoose(searchQ);
    if (!needle) return [];
    return msgs.filter((m) => isChatTurn(m) && searchFoldLoose(m.content).includes(needle));
  }, [msgs, searchQ]);
  const focusedMsgId = searchFocus !== null ? (searchResults[searchFocus]?.id ?? null) : null;

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

  function jumpToResult(pos: number | null) {
    setSearchFocus(pos);
    if (pos === null) return;
    const hit = searchResults[pos];
    if (!hit) return;
    const idx = msgs.findIndex((m) => m.id === hit.id);
    if (idx < 0) return;
    document.getElementById(`tutor-bubble-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function send(
    rawQuestion: string,
    opts?: { retryImage?: string; retryLabel?: string; histBeforeAt?: number },
  ) {
    const q = rawQuestion.trim();
    // modo Feynman avalia SÓ a explicação escrita — sem texto não há o que avaliar
    if (feynman && !q) return;
    if (!q && !opts?.retryImage && !pending.image) return;
    if (streaming) return;
    if (!ctx) {
      toast.error('O núcleo ainda está abrindo — tente de novo em um instante.');
      return;
    }

    // T16 — no Feynman a explicação do aluno é a prova: nada de imagem,
    // contexto ou histórico — o servidor devolve a avaliação estruturada.
    const feynmanActive = feynman;
    const image = feynmanActive ? undefined : (opts?.retryImage ?? pending.image);
    const imageLabel = feynmanActive ? undefined : (opts?.retryLabel ?? pending.imageLabel);
    const question = capQuestion(q, TUTOR_QUESTION_SAFE_MAX);

    // 1) contexto ao vivo (o tutor sempre sabe onde o aluno está) — exceto no
    //    Feynman, onde a avaliação é sobre a explicação pura
    const contextBlock = feynmanActive ? '' : buildContextBlock(ctx, { focusTopic, lastErrors });
    const effectiveQuestion = contextBlock
      ? `${contextBlock}\n\nPERGUNTA DO ALUNO:\n${question || 'Resolva e explique passo a passo a questão da imagem anexada.'}`
      : question || 'Resolva e explique passo a passo a questão da imagem anexada.';

    // 2) mensagem do usuário entra no núcleo ANTES do envio (nunca se perde)
    //    o dataUrl do anexo vai junto — o retry do turno recoloca o print
    await saveMessage({
      id: nid('tm'),
      role: 'user',
      content: q,
      at: Date.now(),
      imageLabel: image ? (imageLabel || 'Print anexado') : undefined,
      imageDataUrl: image,
      topicId: focusTopic?.id,
    });

    // 3) histórico recente (o API usa 12 — conteúdo cru, sem o bloco de contexto;
    //    linhas de erro do sistema ficam de fora — erro não é conversa)
    const hist: ChatMessage[] = msgs
      .filter(isChatTurn)
      .filter((m) => (opts?.histBeforeAt === undefined ? true : m.at < opts.histBeforeAt))
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

    // contexto do aluno — SÓ o estado pessoal/ao vivo, por chamada (o servidor
    // usa e descarta; nada é gravado — persist:false abaixo). A camada
    // institucional (instituição, professores, grade, calendário ao vivo) o
    // SERVIDOR já conhece via tutor-course-base; duplicar aqui era ruído.
    const key30 = dateKeyOf(new Date(now - 30 * 86_400_000));
    const days30 = new Set(
      sessions.filter((s) => s.dateKey >= key30).map((s) => s.dateKey),
    ).size;
    const subjFocus = focusTopic
      ? subjects.find((s) => s.id === focusTopic.subjectId)
      : undefined;
    const liveParts = [
      `ritmo: ${weekMinutes} min de foco nesta semana`,
      `consistência: ${days30} dos últimos 30 dias com estudo registrado`,
      ...(focusTopic && subjFocus
        ? [`sessão atual: ${subjFocus.shortName} — ${focusTopic.name}`]
        : []),
    ];
    const studentContext = `Estado ao vivo do app do aluno (nada disto fica no servidor) — ${liveParts.join(' · ')}.`;

    setStreaming(true);
    setStreamText('');
    stickRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamTutorAnswer(
        feynmanActive
          ? {
              // JSON-only no servidor (sem SSE): o cliente cai no caminho JSON
              // sozinho — a resposta volta completa para o TutorMarkdown.
              mode: 'feynman',
              question,
              discipline: focusTopic
                ? subjects.find((s) => s.id === focusTopic.subjectId)?.name
                : undefined,
              topic: focusTopic?.name ?? material?.title,
              persist: false, // a avaliação também nunca grava no servidor
              stream: false,
            }
          : {
              question: effectiveQuestion,
              discipline: focusTopic
                ? subjects.find((s) => s.id === focusTopic.subjectId)?.name
                : undefined,
              topic: focusTopic?.name,
              materialId: material?.materialId,
              hintMode,
              history: hist,
              hubContext,
              studentContext,
              imageDataUrl: image,
              persist: false, // a thread vive no Dexie do dispositivo — servidor não grava nada
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
      // o freio do aluno (parar a geração) não é falha — não suja a thread
      const stopped = err instanceof Error && err.message === TUTOR_STOP_MESSAGE;
      if (!stopped) {
        // o erro honesto VIVE NA THREAD (Dexie) — não morre com o toast de ~4s;
        // nunca vai ao servidor (persist:false) nem volta como history do chat
        try {
          await saveMessage({
            id: nid('tm'),
            role: 'system',
            content: msg,
            at: Date.now(),
            isError: true,
            topicId: focusTopic?.id,
          });
        } catch {
          // sem IndexedDB não há onde registrar — o toast carrega a verdade
        }
      }
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
    // reenvia com o anexo ORIGINAL do turno (o print não vira retry só-texto)
    // e corta o turno descartado do history (histBeforeAt)
    await send(lastUser.content, {
      retryImage: lastUser.imageDataUrl,
      retryLabel: lastUser.imageLabel,
      histBeforeAt: lastUser.at,
    });
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
      // (o servidor injeta a base do curso curta; o estado pessoal do aluno nem
      // é preciso aqui — e o modo flashcards nunca persiste nada no servidor)
      const result = await streamTutorAnswer({
        mode: 'flashcards',
        question: `Gere flashcards sobre o tema "${topicName}".`,
        discipline: subjects.find((s) => s.id === subjectId)?.name,
        topic: topicName,
        persist: false,
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
        // fábrica única (tutor-card-save): id determinístico = nunca duplica
        const card = makeDeckCard(subjectId, c.front as string, c.back as string);
        if (existing.has(card.id)) continue;
        newCards.push(card);
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

  // ---------- T12 — exportação: o material de estudo sai do dispositivo ----------
  function exportableTurns(): ExportableTurn[] {
    return msgs
      .filter(isChatTurn)
      .map((m) => ({
        role: m.role,
        content: m.content,
        model: m.model,
        time: hhmmOf(new Date(m.at).toISOString()),
        error: m.isError, // bolha de erro fica de fora do material (a lib filtra)
        interrupted: m.interrupted, // o .md confessa o freio
        imageLabel: m.imageLabel, // a assinatura do print viaja; a imagem não
      }));
  }

  function exportMarkdown() {
    const turns = exportableTurns();
    if (!turns.length) {
      toast.info('A conversa está vazia — nada para exportar ainda.');
      return;
    }
    const md = buildChatMarkdown(`Tutor — ${material?.title ?? focusTopic?.name ?? 'conversa livre'}`, turns);
    downloadTextFile(`conversa-tutor-${todayKey}.md`, md);
    toast.success('.md baixado — o arquivo é seu, nada foi ao servidor.');
  }

  async function copyConversation() {
    const turns = exportableTurns();
    if (!turns.length) {
      toast.info('A conversa está vazia — nada para copiar ainda.');
      return;
    }
    try {
      await navigator.clipboard.writeText(
        buildChatMarkdown(`Tutor — ${material?.title ?? focusTopic?.name ?? 'conversa livre'}`, turns),
      );
      toast.success('Conversa copiada como markdown.');
    } catch {
      toast.error('O navegador bloqueou a cópia — use o exportar .md.');
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
        desc="O tutor lê o estado do núcleo em tempo real (plano, foco, erros, provas) — você pergunta, ele já sabe onde você está. Print, recorte de tela e colagem são lidos com visão."
        right={
          <>
            {material && (
              <Chip tone="violet" className="max-w-[220px]">
                <BookOpenCheck className="size-3 shrink-0" />
                <span className="truncate">material: {material.title}</span>
                {onClearMaterial && (
                  <button type="button" onClick={onClearMaterial} aria-label="limpar material em foco" className="shrink-0 text-violet-300/70 hover:text-violet-200">
                    <X className="size-3" />
                  </button>
                )}
              </Chip>
            )}
            {rec?.active && <Chip tone="amber">modo recuperação</Chip>}
            <Chip tone={dueCount ? 'violet' : 'zinc'}>fila hoje {dueCount}</Chip>
            <Chip tone="zinc">{msgs.length} msg</Chip>
            <span
              title={
                aiStatus === 'ready'
                  ? 'Tutor com provedor de IA ativo neste deploy (Gemini → OpenRouter → Z.ai)'
                  : aiStatus === 'nokey'
                    ? 'Nenhuma chave de IA neste deploy — configure GEMINI_API_KEY/OPENROUTER_API_KEY/ZAI_API_KEY nas variáveis de ambiente'
                    : 'Consultando o deploy…'
              }
            >
              <Chip tone={aiStatus === 'ready' ? 'emerald' : aiStatus === 'nokey' ? 'amber' : 'zinc'}>
                {aiStatus === 'ready' ? 'IA pronta' : aiStatus === 'nokey' ? 'IA sem chave' : 'IA…'}
              </Chip>
            </span>
          </>
        }
      />

      <Panel className="flex flex-col gap-3 p-3 sm:p-4">
        {onClose && (
          <div className="flex justify-end sm:hidden">
            <Btn variant="ghost" className="min-h-0 px-2 py-1 text-[10px]" onClick={onClose}>
              <X className="size-3" /> fechar
            </Btn>
          </div>
        )}
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
                dica: anexe o print da questão (botão de câmera, Ctrl+V ou captura de tela) que ele lê direto da imagem.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {msgs.flatMap((m, i) => {
                const nodes: React.ReactNode[] = [];
                const sep = searchActive ? undefined : daySeps.get(i);
                if (sep) {
                  nodes.push(
                    <li key={`sep-${i}`} aria-hidden className="flex items-center gap-2 pt-1">
                      <span className="h-px flex-1 bg-zinc-800" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">{sep}</span>
                      <span className="h-px flex-1 bg-zinc-800" />
                    </li>,
                  );
                }
                if (m.role === 'system') {
                  // erro honesto NA THREAD — discreto, neutro/âmbar suave, sem pânico vermelho
                  nodes.push(
                    <li key={m.id} className="flex justify-start">
                      <div className="w-full rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-1.5">
                        <p className="flex items-start gap-1.5 font-mono text-[10px] leading-relaxed text-amber-200/80">
                          <TriangleAlert className="mt-0.5 size-3 shrink-0 text-amber-300/70" />
                          <span className="min-w-0 break-words">{m.content}</span>
                        </p>
                      </div>
                    </li>,
                  );
                } else {
                  const at = hhmmOf(new Date(m.at).toISOString());
                  nodes.push(
                    <li
                      key={m.id}
                      id={`tutor-bubble-${i}`}
                      className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    >
                      <div
                        className={`max-w-[92%] rounded-lg border px-3 py-2 sm:max-w-[85%] ${
                          m.role === 'user'
                            ? 'border-emerald-500/30 bg-emerald-500/10'
                            : 'border-zinc-800 bg-zinc-900/80'
                        } ${m.id === focusedMsgId ? 'ring-1 ring-emerald-500/50' : ''}`}
                      >
                        {m.imageLabel && (
                          <p className="mb-1 flex items-center gap-1 font-mono text-[10px] text-emerald-200/80">
                            <Camera className="size-3" /> {m.imageLabel}
                          </p>
                        )}
                        {m.role === 'user' && m.imageDataUrl && (
                          // o anexo segue visível no turno — inclusive no reenvio
                          // (retry preserva o print) — e o lightbox o lê de novo
                          <button
                            type="button"
                            onClick={() => setLightbox({ src: m.imageDataUrl ?? '', label: m.imageLabel ?? null })}
                            title="ver o anexo em tamanho grande"
                            className="mb-1.5 block"
                          >
                            <img
                              src={m.imageDataUrl}
                              alt={m.imageLabel ?? 'Print anexado'}
                              className="max-h-40 w-auto cursor-zoom-in rounded-md border border-emerald-500/20"
                            />
                          </button>
                        )}
                        {m.role === 'assistant' ? (
                          <>
                            <TutorMarkdown content={m.content} />
                            {/* T7 — FRENTE:/VERSO detectado → 1 clique arquiva no baralho v2 */}
                            {!m.cardIds?.length && (
                              <TutorCardSaveBar
                                message={m}
                                subjectId={m.topicId ? topics.find((t) => t.id === m.topicId)?.subjectId : undefined}
                              />
                            )}
                            <p className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-600">
                              {feynScoreOf(m.content) && <Chip tone="violet">{feynScoreOf(m.content)}</Chip>}
                              {m.interrupted && <span className="text-amber-500/80">parcial — você parou a geração</span>}
                              {m.id === continueTargetId && (
                                <button
                                  type="button"
                                  onClick={() => void send(TUTOR_CONTINUE_QUESTION)}
                                  disabled={streaming}
                                  className="underline decoration-dotted decoration-violet-500/40 hover:text-violet-300 disabled:opacity-40"
                                >
                                  continuar de onde parou
                                </button>
                              )}
                              {at && <span>{at}</span>}
                              {m.model && <span>{m.model}</span>}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-emerald-100">{m.content}</p>
                            {at && <p className="mt-1 text-right font-mono text-[10px] text-emerald-200/40">{at}</p>}
                          </>
                        )}
                      </div>
                    </li>,
                  );
                }
                return nodes;
              })}
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
          {material && (
            <QuickBtn icon={<BookOpenCheck className="size-3" />} label="explicar este material" onClick={() => void send(`Estou lendo o material "${material.title}". Explica os pontos essenciais dele — o que costuma cair em prova e os erros comuns de interpretação.`)} disabled={streaming} />
          )}
          <QuickBtn icon={<Brain className="size-3" />} label="explicar tópico em foco" onClick={() => void send('Explica o tópico em foco do jeito que cai em prova, com um exemplo prático e uma pegadinha comum.')} disabled={streaming} />
          {/* T5 — captura de tela → recorte → anexo. Sem getDisplayMedia (navegador
              sem suporte), o botão desabilita com a saída honesta. */}
          <QuickBtn
            icon={<ScreenShare className="size-3" />}
            label="capturar tela"
            onClick={() => void startCapture()}
            disabled={!screenOk}
            title={
              !screenOk
                ? 'Este navegador não suporta captura de tela — anexe o print com Ctrl+V ou pelo botão de câmera.'
                : capturing
                  ? 'capturando — clique de novo para desistir desta tentativa'
                  : 'capturar a tela e recortar só a questão para o tutor'
            }
          />
          {/* T6 — "me testa" estruturado: uma questão por vez, dica mínima, nota 0-10 */}
          <QuickBtn
            icon={<ListChecks className="size-3" />}
            label="me testa · 5 questões"
            onClick={() =>
              void send(
                buildQuizPrompt({
                  disciplineName: focusTopic
                    ? subjects.find((s) => s.id === focusTopic.subjectId)?.name
                    : subjects[0]?.name,
                  materialTitle: material?.title,
                  count: 5,
                }),
              )
            }
            disabled={streaming}
          />
          {/* T9-cards — o sufixo pede o cartão: a resposta termina com FRENTE:/VERSO
              e a bolha ganha a barra "salvar no baralho" (tutor-card-save) */}
          <QuickBtn
            icon={<CornerUpLeft className="size-3" />}
            label="por que errei?"
            onClick={() =>
              void send(
                (lastErrors.length
                  ? `Analise meu erro mais recente: marquei "${truncate(lastErrors[0].reason, 200)}" (categoria ${lastErrors[0].category}). Explique o conceito por trás e como não repetir.`
                  : 'Ainda não há erros registrados no Code Review — bora prevenir: qual o erro mais comum no tópico em foco?') +
                TUTOR_CARD_SUFFIX,
              )
            }
            disabled={streaming}
          />
          <QuickBtn icon={<BookOpenCheck className="size-3" />} label="gerar flashcards" onClick={() => void generateFlashcards()} disabled={streaming} />
        </div>

        {/* T12 — a busca que caminha no fio */}
        {msgs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-zinc-600" aria-hidden />
                <input
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setSearchFocus(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    jumpToResult(searchNavStep(searchFocus, searchResults.length, e.shiftKey ? -1 : 1));
                  }}
                  placeholder="buscar na conversa… (Enter avança · Shift+Enter volta)"
                  aria-label="buscar na conversa do tutor"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 py-1.5 pl-7 pr-7 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                />
                {searchQ && (
                  <button
                    type="button"
                    aria-label="limpar a busca"
                    onClick={() => {
                      setSearchQ('');
                      setSearchFocus(null);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              {searchQ && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
                  {searchResults.length
                    ? `${searchFocus !== null ? searchFocus + 1 : '·'}/${searchResults.length}`
                    : 'sem casamentos'}
                </span>
              )}
            </div>
            {searchActive && searchResults.length > 0 && (
              <ul className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin]">
                {searchResults.map((r, pos) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => jumpToResult(pos)}
                      className={`w-full rounded-md border px-2 py-1 text-left transition-colors ${
                        searchFocus === pos
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-zinc-800 bg-zinc-900/60 hover:border-emerald-500/40'
                      }`}
                    >
                      <p className="font-mono text-[10px] text-zinc-500">
                        {r.role === 'user' ? 'você' : 'tutor'} · {hhmmOf(new Date(r.at).toISOString())}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-300">
                        {searchSnippetSegments(r.content, searchQ).map((seg, k) =>
                          seg.hit ? (
                            <mark key={k} className="rounded-[2px] bg-emerald-500/25 px-0.5 text-emerald-100">
                              {seg.text}
                            </mark>
                          ) : (
                            <span key={k}>{seg.text}</span>
                          ),
                        )}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* anexo pendente */}
        {pending.image && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
            {/* T11 — o anexo pendente também se lê de novo antes de enviar */}
            <button
              type="button"
              onClick={() => setLightbox({ src: pending.image ?? '', label: pending.imageLabel ?? null })}
              title="ver o anexo em tamanho grande"
              className="shrink-0"
            >
              <img
                src={pending.image}
                alt={pending.imageLabel ?? 'Anexo pendente'}
                className="max-h-10 w-auto cursor-zoom-in rounded border border-emerald-500/30"
              />
            </button>
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

        {/* T14 — a pill honesta do rascunho que voltou */}
        {draftRestored && (
          <div className="flex items-center gap-2 rounded-md border border-violet-500/25 bg-violet-500/5 px-2.5 py-1.5">
            <p className="min-w-0 flex-1 font-mono text-[10px] text-violet-200/80">
              rascunho restaurado — o texto e o anexo sobreviveram ao fechamento do dock
            </p>
            <button
              type="button"
              aria-label="descartar o rascunho restaurado"
              onClick={() => {
                setDraftRestored(false);
                clearComposerDraft(draftKey);
                setInput('');
                setPending({});
              }}
              className="text-violet-300/70 hover:text-violet-200"
            >
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
                // a mesma régua da casa (JPEG ≤1400px) — captura, arquivo e
                // colagem chegam à IA com qualidade idêntica
                const dataUrl = await downscaleImageFile(f);
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
            onPaste={(e) => {
              // imagem do clipboard: o Ctrl+V de print entra direto como anexo
              const f = imageFromClipboard(e);
              if (f) {
                e.preventDefault();
                void downscaleImageFile(f)
                  .then((dataUrl) => setPending({ image: dataUrl, imageLabel: 'print colado' }))
                  .catch(() => toast.error('não consegui ler a imagem colada'));
                return;
              }
              // colagem de PDF rasgada: remonta ANTES de entrar no campo (a
              // colagem normal do aluno passa intocada, byte a byte)
              const t = e.clipboardData.getData('text/plain');
              if (t && looksFragmentedPaste(t)) {
                e.preventDefault();
                const ta = e.currentTarget;
                const pos = ta.selectionStart ?? input.length;
                const end = ta.selectionEnd ?? pos;
                setInput(input.slice(0, pos) + normalizePdfPaste(t) + input.slice(end));
                toast.info('Colagem de PDF organizada — as linhas quebradas foram unidas para a IA ler melhor.');
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
                disabled={!input.trim() && (!pending.image || feynman)}
              >
                <Send className="size-3.5" /> enviar
              </Btn>
            )}
            <Btn variant="ghost" className="min-h-0 px-2 py-1 text-[10px]" onClick={() => setHintMode((v) => !v)} title="modo socrático: pistas antes da solução">
              <GraduationCap className={`size-3 ${hintMode ? 'text-violet-300' : ''}`} /> dica {hintMode ? 'ON' : 'off'}
            </Btn>
            {/* T16 — modo Feynman: você explica, o tutor avalia com nota 0-100 */}
            <Btn
              variant="ghost"
              className="min-h-0 px-2 py-1 text-[10px]"
              onClick={() => setFeynman((v) => !v)}
              title="modo Feynman: escreva a explicação do tema com suas palavras e receba uma avaliação estruturada (nota 0-100)"
            >
              <Speech className={`size-3 ${feynman ? 'text-violet-300' : ''}`} /> Feynman {feynman ? 'ON' : 'off'}
            </Btn>
          </div>
        </div>

        {feynman && (
          <p className="font-mono text-[10px] leading-relaxed text-violet-300/70">
            modo Feynman: só a sua explicação viaja — sem contexto do plano, sem anexo e sem histórico. O tutor responde com nota 0-100 e o próximo passo.
          </p>
        )}

        {/* rodapé da aba: retry + exportação + atalho para fila */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-2 text-[10px] text-zinc-600">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void retryLast()} disabled={streaming || !msgs.some((m) => m.role === 'user')} className="underline decoration-dotted hover:text-zinc-400 disabled:opacity-40">
              reenviar última pergunta
            </button>
            <button type="button" onClick={exportMarkdown} disabled={!msgs.length} className="underline decoration-dotted hover:text-zinc-400 disabled:opacity-40">
              exportar .md
            </button>
            <button type="button" onClick={() => void copyConversation()} disabled={!msgs.length} className="underline decoration-dotted hover:text-zinc-400 disabled:opacity-40">
              copiar conversa
            </button>
          </div>
          <p>
            a thread vive no núcleo (IndexedDB) · cartões gerados caem no baralho da{' '}
            <span className="text-zinc-400">aba Revisão</span>
          </p>
        </div>
      </Panel>

      {/* T11 — o print que se lê de novo: pendente e turnos, o MESMO data URL */}
      <PrintLightboxDialog
        src={lightbox?.src ?? null}
        label={lightbox?.label ?? null}
        onOpenChange={(o) => {
          if (!o) setLightbox(null);
        }}
      />

      {/* T5 — o aviso de arrumação: entre escolher a superfície e a régua começar,
          o aviso fica de pé ~2s (janela garantida da capture-clean) */}
      <CaptureTidyBanner active={tidying} seconds={tidySeconds} />

      {/* T5 — recorte da captura: anexa no MESMO pending dos prints */}
      <CaptureCropDialog
        canvas={captureCanvas}
        open={captureOpen}
        onOpenChange={(v) => {
          setCaptureOpen(v);
          if (!v) setCaptureCanvas(null); // auto-apagar: o frame bruto some com o diálogo
        }}
        onAttach={(image) => setPending({ image, imageLabel: 'recorte de tela' })}
        onRetry={() => {
          setCaptureOpen(false);
          setCaptureCanvas(null);
          void startCapture();
        }}
      />
    </div>
  );
}

function QuickBtn({
  icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 font-mono text-[11px] text-zinc-300 transition-colors hover:border-violet-500/40 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}
