'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  Bot,
  BookOpen,
  CalendarCheck,
  Camera,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Clock3,
  Code2,
  Copy,
  Download,
  FileText,
  History,
  ImagePlus,
  Lightbulb,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Search,
  SearchX,
  Send,
  SkipForward,
  Sparkles,
  Target,
  Timer,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  CODE_LANG_LABEL,
  UserBubbleContent,
  detectCodeLang,
  type ChatCodeLang,
} from '@/components/hub/chat-code';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  disciplines,
  getDisciplineByCode,
  getMaterialsByDiscipline,
  type Material,
} from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { useStudyProgress, type PomodoroState } from '@/lib/study-progress';
import { isNearBottom } from '@/lib/tutor-follow';
import { getDisciplineTopics } from '@/lib/study-topics';
import { lastActivityLabel, unitActivityFor } from '@/lib/discipline-activity';
import { buildHubContext } from '@/lib/tutor-context';
import { buildChatMarkdown, downloadTextFile } from '@/lib/tutor-chat-export';
import {
  TUTOR_HISTORY_KEEP,
  chatDayGroups,
  hhmmOf,
  searchFoldLoose,
  searchMatchSegments,
  searchNavStep,
  searchSnippetSegments,
  type SearchSegment,
} from '@/lib/tutor-history-view';
import { buildQuizPrompt } from '@/lib/tutor-quiz';
import { resolveRetryTarget } from '@/lib/tutor-retry';
import { MATH_EXAM, MATH_EXAM_DATE_SHORT } from '@/lib/math-exam-prep';
import { daysUntilDate } from '@/lib/semester';
import { downscaleImageFile, imageFromClipboard } from '@/lib/tutor-image';
import { looksFragmentedPaste, normalizePdfPaste } from '@/lib/paste-cleanup';
import {
  screenCaptureSupported,
  useScreenCapture,
} from '@/lib/screen-capture';
import { CaptureCropDialog } from './capture-crop-dialog';
import { PrintLightboxDialog } from './print-lightbox-dialog';
import { streamTutorAnswer, TutorStreamError } from '@/lib/tutor-stream';
import { OPEN_TUTOR_EVENT, type OpenTutorDetail } from '@/lib/hub-events';
import { openTutor } from '@/lib/hub-events';
import { cn } from '@/lib/utils';
import { TutorMarkdown } from './tutor-markdown';
import { CodeLab } from './code-lab';

// ---------- Tipos locais ----------

type Phase = PomodoroState['phase'];
type SessionSummary = NonNullable<PomodoroState['lastSessionSummary']>;
type PomodoroConfig = { focus: number; shortBreak: number; longBreak: number; cyclesBeforeLong: number };

interface LiveTimer {
  phase: Phase;
  secondsLeft: number;
  running: boolean;
  cycleCount: number; // nº de focos completados
  /** Epoch (ms) do fim da fase — o relógio REAL. Definido ao rodar: a contagem
   *  deriva dele, então fica correta mesmo com a aba em segundo plano. */
  endsAt?: number;
  runningSince?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Modelo free que gerou a resposta (OpenRouter) — exibido discretamente. */
  model?: string;
  /** Miniatura do print anexado (só na conversa viva — não persiste no banco). */
  image?: string;
  /** Hora local (HH:MM) da mensagem — referência discreta de quando estudou. */
  time?: string;
  /** ISO do banco (t151) — alimenta os separadores de dia e o HH:MM das
   * restauradas; as mensagens vivas carimbam no envio. */
  savedAt?: string;
  /** true → mensagem de erro (falha do provedor/sem key) — estilo rosa + sem ações. */
  error?: boolean;
}

/** Hora local curta (HH:MM) para carimbar mensagens do chat. */
const hhmm = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Cabeça de dia no fio (t151): "Hoje" · "Ontem" · dd/mm entre fios de cabelo. */
function ChatDayChip({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 py-0.5"
      role="separator"
      aria-label={`Mensagens de ${label}`}
    >
      <span aria-hidden className="h-px flex-1 bg-border/60" />
      <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border/60" />
    </div>
  );
}

/** O recibo honesto da memória (t151): quantas mensagens vieram do banco —
 * o teto existe (TUTOR_HISTORY_KEEP) e agora está VISÍVEL, não escondido. */
function MemoryChip({ count }: { count: number }) {
  return (
    <div className="flex justify-center py-0.5">
      <span
        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/70"
        title={`A memória da disciplina guarda as últimas ${TUTOR_HISTORY_KEEP} mensagens — estas ${count} vieram do banco. Pra guardar tudo, baixe a conversa (botão de download).`}
      >
        <History className="size-3" aria-hidden />
        memória da disciplina · {count} {count === 1 ? 'mensagem' : 'mensagens'}
      </span>
    </div>
  );
}

interface BannerSnapshot {
  saved: PomodoroState;
  agoMin: number;
}

// ---------- Constantes / helpers (módulo) ----------

const PHASE_META: Record<
  Phase,
  { label: string; text: string; badge: string; dot: string; solid: string }
> = {
  focus: {
    label: 'Foco',
    text: 'text-emerald-400',
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    dot: 'bg-emerald-500',
    solid: 'bg-emerald-600 hover:bg-emerald-700',
  },
  shortBreak: {
    label: 'Pausa curta',
    text: 'text-amber-400',
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    dot: 'bg-amber-500',
    solid: 'bg-amber-600 hover:bg-amber-700',
  },
  longBreak: {
    label: 'Pausa longa',
    text: 'text-teal-400',
    badge: 'border-teal-500/40 bg-teal-500/10 text-teal-400',
    dot: 'bg-teal-500',
    solid: 'bg-teal-600 hover:bg-teal-700',
  },
};

const MATERIAL_TYPE_LABEL: Record<Material['type'], string> = {
  slides: 'Slides',
  lista_exercicios: 'Lista de exercícios',
  web_page: 'Página web',
  introducao: 'Introdução',
  ementa: 'Ementa',
  video: 'Vídeo',
  pdf: 'PDF',
  image: 'Imagem',
  calendar: 'Calendário',
  exemplo: 'Exemplo de código',
};

const CHAT_SUGGESTIONS = [
  'Explique o tópico atual',
  'Dê um exemplo prático',
  'Quando é a próxima prova?',
  'Como está meu progresso?',
];

/** Sugestões da SEMANA DE PROVA (148): os chips do chat sabem do momento —
 * na janela da Av1 de Matemática, o 1º gesto do aluno é o da prova (escopo,
 * plano, estado), não o genérico. Fora da janela (passou/não é a disciplina)
 * voltam os de sempre — depois da prova, é ruído (regra da casa). */
const EXAM_CHAT_SUGGESTIONS = [
  `O que cai na Av1 de ${MATH_EXAM_DATE_SHORT}?`,
  'Monta meu plano de revisão até a prova',
  'Como está meu progresso?',
];

/** Janela de prova viva (148): só Matemática, só ATÉ o dia — fonte única
 * para welcome + chips + escopo do "Me testa" (mesma conta da casa). */
function mathExamBriefFor(code: string): { daysLeft: number; dateShort: string } | null {
  if (code !== MATH_EXAM.disciplineCode) return null;
  const d = daysUntilDate(MATH_EXAM.date);
  return d >= 0 ? { daysLeft: d, dateShort: MATH_EXAM_DATE_SHORT } : null;
}
/** Segundos restantes reais a partir do epoch do fim da fase. */
function remainingFromEndsAt(endsAt: number): number {
  return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
}

/**
 * Follow-ups de continuidade: aparecem após cada resposta do tutor para o
 * aluno continuar falando DO MESMO assunto sem redigir tudo de novo — o
 * histórico vai junto, então a resposta conecta com a anterior.
 */
const FOLLOW_UPS = [
  { label: 'Explica de outro jeito', q: 'Explica de outro jeito, mais simples, com outro exemplo.' },
  { label: 'Exercício parecido', q: 'Me dá um exercício parecido com isso para eu treinar.' },
  { label: 'Como cai na prova?', q: 'Como esse conteúdo costuma cair na prova?' },
  { label: 'Me testa outra vez', q: 'Me testa outra vez com uma questão NOVA, no mesmo estilo da rodada anterior (uma por vez, esperando minha resposta).' },
];

/** Contexto real do app enviado ao tutor — implementação única em @/lib/tutor-context. */

const APP_BASE_TITLE = 'Hub de Estudos • IFPB ADS — Turma 2026.2';

/** Notificação nativa do SO ao concluir uma fase do Pomodoro (permissão já concedida). */
function notifyPhaseEnd(kind: 'focus' | 'break', focusMinutes: number, disciplineShort: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const title = kind === 'focus' ? 'Foco concluído! ☕' : 'Pausa finalizada 🎯';
  const body =
    kind === 'focus'
      ? `${focusMinutes} min de foco em ${disciplineShort}. Hora da pausa!`
      : 'De volta ao foco — bom estudo!';
  try {
    const n = new Notification(title, {
      body,
      tag: 'hub-pomodoro-fase',
      icon: '/logo-ifpb.svg',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // alguns navegadores lançam em contextos não ativos — ignora
  }
}

function fmtSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Beep duplo (880Hz, 0.15s x2) via WebAudio — silencioso em silentMode ou se indisponível. */
function playBeep(silent: boolean) {
  if (silent) return;
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.25].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const t0 = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    });
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // áudio indisponível — ignora
  }
}

function buildWelcome(
  shortName: string,
  examBrief?: { daysLeft: number; dateShort: string } | null,
): string {
  const base = `Olá! Sou o tutor IA de ${shortName}. 🤖\n\nConheço **seu progresso**, o **calendário do semestre** e os **materiais do Hub** — posso explicar o tópico atual, dar exemplos com código, lembrar as datas das provas ou responder o que você precisar. Toque em uma sugestão ou digite sua dúvida.`;
  // A semana de prova fala primeiro (148): o welcome carrega a data e o
  // escopo REAL — o aluno não precisa perguntar o que já é o momento dele.
  if (examBrief) {
    const quando =
      examBrief.daysLeft === 0
        ? 'É HOJE'
        : examBrief.daysLeft === 1
          ? 'é AMANHÃ'
          : `faltam ${examBrief.daysLeft} dias`;
    return `${base}\n\n🎯 Av1 de Matemática ${quando} (${examBrief.dateShort}) — escopo: **Matrizes + Lógica**. Posso montar seu plano de revisão ou te testar no escopo.`;
  }
  return base;
}

/** Indicador "Pensando" com cronômetro — modelos grátis podem levar até ~30s. */
function ThinkingBubble() {
  const [secs, setSecs] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10">
        <Bot className="size-4 text-emerald-400" />
      </div>
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-sm border border-border/60 bg-muted px-3 py-2.5 text-sm text-muted-foreground shadow-sm">
        <span className="flex items-center gap-1" aria-hidden>
          <span className="animate-dot size-1.5 rounded-full bg-emerald-400 [animation-delay:0ms]" />
          <span className="animate-dot size-1.5 rounded-full bg-emerald-400 [animation-delay:160ms]" />
          <span className="animate-dot size-1.5 rounded-full bg-emerald-400 [animation-delay:320ms]" />
        </span>
        Pensando
        <span className="tabular-nums text-xs opacity-70">{secs}s</span>
      </div>
    </div>
  );
}

// ---------- Componente ----------

export function StudyView({
  initialDiscipline,
  initialMaterial,
  tutorReq,
}: {
  initialDiscipline?: string;
  initialMaterial?: string;
  /** Pedido externo (evento hub:open-tutor — Caderno de Erros) → abre o chat
   *  com a pergunta pronta no campo e a disciplina certa selecionada. */
  tutorReq?: { detail: OpenTutorDetail; nonce: number };
}) {
  const sp = useStudyProgress();

  // ----- Seleção (estados derivados com lazy init) -----
  const [disciplineCode, setDisciplineCode] = React.useState<string>(
    () => initialDiscipline ?? disciplines[0].code,
  );
  const [materialId, setMaterialId] = React.useState<string>(() => {
    if (!initialMaterial) return '';
    const disc = initialDiscipline ?? disciplines[0].code;
    return getMaterialsByDiscipline(disc).some((m) => m.id === initialMaterial)
      ? initialMaterial
      : '';
  });

  const cfg = sp.progress.preferences.pomodoroConfig;

  const durations = React.useMemo<Record<Phase, number>>(
    () => ({
      focus: cfg.focus * 60,
      shortBreak: cfg.shortBreak * 60,
      longBreak: cfg.longBreak * 60,
    }),
    [cfg.focus, cfg.shortBreak, cfg.longBreak],
  );

  // ----- Timer vivo (espelho local do pomodoroState persistido) -----
  const [live, setLive] = React.useState<LiveTimer>(() => ({
    phase: 'focus',
    secondsLeft: cfg.focus * 60,
    running: false,
    cycleCount: 0,
    runningSince: undefined,
  }));

  // Resumo do último foco concluído (banner emerald, dismissível)
  const [summary, setSummary] = React.useState<SessionSummary | null>(null);
  // Snapshot do estado salvo para o banner de continuidade
  const [banner, setBanner] = React.useState<BannerSnapshot | null>(null);

  // ----- Chat IA -----
  const [chatOpen, setChatOpen] = React.useState(false);
  const [zenOpen, setZenOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => [
    {
      role: 'assistant',
      content: buildWelcome(
        getDisciplineByCode(disciplineCode)?.shortName ?? disciplines[0].shortName,
        mathExamBriefFor(disciplineCode),
      ),
    },
  ]);
  const [chatInput, setChatInput] = React.useState('');
  // Bloco de código SEPARADO da mensagem (pedido do dono) — vai para a IA formatado em ```lang
  const [chatCode, setChatCode] = React.useState('');
  const [codeOpen, setCodeOpen] = React.useState(false);
  const [codeLang, setCodeLang] = React.useState<ChatCodeLang>('c');
  const chatTaRef = React.useRef<HTMLTextAreaElement>(null);
  const [chatLoading, setChatLoading] = React.useState(false);
  /** Print/foto anexado à próxima mensagem (data URL reduzido no navegador). */
  const [chatImage, setChatImage] = React.useState<string | null>(null);
  /** Procedência do print pendente (t163): o chip diz ONDE ele nasceu —
   * "print de tela", "página 3 · Lista de Matrizes", "print do resumo"…
   * Só memória: morre no envio (ou no X do chip), nada toca o disco. */
  const [chatImageLabel, setChatImageLabel] = React.useState<string | null>(null);
  // t160: o print que se lê de novo — bolha e chip abrem o lightbox (só visão).
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);
  const chatFileRef = React.useRef<HTMLInputElement>(null);
  /** Ref do input de CÂMERA (fallback mobile da captura — ver camFileRef). */
  const camFileRef = React.useRef<HTMLInputElement>(null);
  // ----- Busca na conversa (t151) — filtrar o fio por texto, com contagem -----
  // t153: o casamento DOBRA ACENTOS — "logica" acha "Lógica". t154: o dobro
  // ganhou PONTUAÇÃO (searchFoldLoose) — "nao caem" acha "não, caem.",
  // "proposicao logica" acha "proposição lógica?" — e o TRECHO casado acende
  // (mark inline na bolha do aluno, chip de trecho sob a bolha do tutor); a
  // textura das bolhas segue sendo o texto de nascença (fold só na comparação).
  const [chatSearchOpen, setChatSearchOpen] = React.useState(false);
  const [chatSearch, setChatSearch] = React.useState('');
  const chatSearchActive = chatSearchOpen && chatSearch.trim().length >= 2;
  const chatSearchResults = React.useMemo(() => {
    const q = searchFoldLoose(chatSearch.trim());
    if (!chatSearchActive) return null;
    return messages
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => !m.error && searchFoldLoose(m.content).includes(q));
  }, [messages, chatSearch, chatSearchActive]);
  // t154: os pedaços com o <mark> — bolha do ALUNO acende o trecho no lugar
  // (só quando não há bloco de código: o CodeBlock não recebe marca).
  const chatSearchSegments = React.useMemo(() => {
    const map = new Map<number, SearchSegment[]>();
    if (!chatSearchActive) return map;
    const q = chatSearch.trim();
    for (const { m, i } of chatSearchResults ?? []) {
      if (!m.content.includes('```')) map.set(i, searchMatchSegments(m.content, q));
    }
    return map;
  }, [chatSearchActive, chatSearch, chatSearchResults]);
  // t154: o chip de TRECHO sob a bolha do TUTOR — janela curta em volta do
  // 1º casamento (o markdown da bolha segue intacto em cima).
  const chatSearchSnippets = React.useMemo(() => {
    const map = new Map<number, SearchSegment[]>();
    if (!chatSearchActive) return map;
    const q = chatSearch.trim();
    for (const { m, i } of chatSearchResults ?? []) {
      if (m.role === 'assistant') {
        const segs = searchSnippetSegments(m.content, q);
        if (segs.length) map.set(i, segs);
      }
    }
    return map;
  }, [chatSearchActive, chatSearch, chatSearchResults]);
  // O CALENDÁRIO do fio (t151): cabeça de dia por mensagem + o recibo da
  // memória restaurada. Derivado de messages — nunca diverge do que se vê.
  const restoredCount = React.useMemo(
    () => messages.filter((m) => m.savedAt).length,
    [messages],
  );
  const firstRestoredIndex = React.useMemo(
    () => messages.findIndex((m) => m.savedAt),
    [messages],
  );
  const daySeparators = React.useMemo(() => {
    if (chatSearchActive) return new Map<number, string>();
    const groups = chatDayGroups(messages.map((m) => m.savedAt));
    // índice 0 é o welcome (Hoje) — separador ali é ruído, não informação
    return new Map(groups.filter((g) => g.index > 0).map((g) => [g.index, g.label]));
  }, [messages, chatSearchActive]);
  /** getDisplayMedia existe neste navegador? (SSR renderiza true — o effect
   * corrige no mount; sem mismatch porque o 1º paint do cliente é igual.) */
  const [screenOk, setScreenOk] = React.useState(true);
  React.useEffect(() => setScreenOk(screenCaptureSupported()), []);
  /** Captura de tela em recorte — o frame bruto vive só até o diálogo fechar. */
  const [captureCanvas, setCaptureCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const { capturing, startCapture } = useScreenCapture(
    React.useCallback((canvas: HTMLCanvasElement) => {
      setCaptureCanvas(canvas);
      setCaptureOpen(true);
    }, []),
  );
  /** Texto da resposta em streaming (bubble viva). null = nada em transmissão. */
  const [streamText, setStreamText] = React.useState<string | null>(null);
  // t149: feedback visual do "copiar" — a resposta copiada vira ✓ copiado por 2s.
  const [copiedMsg, setCopiedMsg] = React.useState<number | null>(null);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );
  /** Modo dica: tutor socrático — pistas antes da solução completa (estudo real). */
  const [chatHints, setChatHints] = React.useState(false);

  // ----- Derivados -----
  const discipline = getDisciplineByCode(disciplineCode) ?? disciplines[0];
  const disciplineShortName = discipline.shortName;
  // A janela de prova viva do momento (148) — alimenta welcome, chips e o
  // escopo do "Me testa" numa fonte única (a mesma conta em todos).
  const examBrief = mathExamBriefFor(discipline.code);
  const materials = React.useMemo(
    () => getMaterialsByDiscipline(disciplineCode),
    [disciplineCode],
  );
  const selectedMaterial = materials.find((m) => m.id === materialId);
  const topicsSummary = React.useMemo(
    () => getDisciplineTopics(disciplineCode, sp.progress.topicProgress),
    [disciplineCode, sp.progress.topicProgress],
  );
  // ATIVIDADE REAL POR UNIDADE (118): o que o aluno JÁ FAZ — abrir material,
  // tentar questão — vira evidência visível no checklist. Fonte única:
  // discipline-activity (a mesma do painel; zero segunda fonte).
  const unitActivity = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof unitActivityFor>>();
    if (!topicsSummary) return map;
    for (const unit of topicsSummary.units) {
      map.set(
        unit.name,
        unitActivityFor(
          disciplineCode,
          unit.name,
          sp.progress,
          unit.topics.filter((t) => t.done).length,
          unit.topics.length,
        ),
      );
    }
    return map;
  }, [disciplineCode, topicsSummary, sp.progress]);
  // Resumo da atividade real da disciplina (a linha que devolve o ânimo:
  // 0 marcado ≠ 0 estudo — o Hub VIU as unidades que o aluno já tocou).
  const activitySummary = React.useMemo(() => {
    if (!topicsSummary) return null;
    const acts = topicsSummary.units
      .map((u) => unitActivity.get(u.name))
      .filter((a): a is NonNullable<typeof a> => !!a);
    const tocadas = acts.filter((a) => a.tocada).length;
    const last = acts.reduce<string | null>((acc, a) => {
      if (!a.lastActivityAt) return acc;
      return !acc || a.lastActivityAt > acc ? a.lastActivityAt : acc;
    }, null);
    return { tocadas, lastLabel: lastActivityLabel(last) };
  }, [topicsSummary, unitActivity]);
  const colors = getColorClasses(discipline.color);
  const chatTopic = topicsSummary?.nextTopic ?? 'geral';

  // A SEMANA DA AV1 NO CHAT — o mesmo examWeek que o tutor recebe (fonte
  // única: buildHubContext). O badge no header do chat torna o contexto
  // VISÍVEL: o aluno sabe que a IA sabe (plano de hoje, veredito do simulado
  // quando existir, travadas) — sem mágica silenciosa.
  const examWeek = React.useMemo(
    () => buildHubContext(disciplineCode, sp).examWeek,
    [disciplineCode, sp.progress],
  );

  const cycleTotal = Math.max(1, cfg.cyclesBeforeLong);
  const doneInCycle = live.cycleCount % cycleTotal;
  const cyclePosition = doneInCycle + 1;

  // ----- Modo Foco (Zen): Esc fecha + trava scroll do body -----
  React.useEffect(() => {
    if (!zenOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setZenOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [zenOpen]);

  // ----- Refs -----
  const liveRef = React.useRef(live);
  const silentModeRef = React.useRef(!sp.progress.preferences.silentMode);
  silentModeRef.current = !sp.progress.preferences.silentMode;
  /** "Rodar em outra guia" — espelho em ref para uso dentro de listeners. */
  const backgroundTimerRef = React.useRef(sp.progress.preferences.backgroundTimer !== false);
  backgroundTimerRef.current = sp.progress.preferences.backgroundTimer !== false;
  const ctxRef = React.useRef({
    sp,
    cfg,
    durations,
    disciplineCode,
    materialId,
    summary,
    topicsSummary,
  });
  const interactedRef = React.useRef(false); // só persiste depois da 1ª interação
  const focusStartedAtRef = React.useRef<string | null>(null);
  // Fim da fase como timestamp (Date.now) — fonte da verdade quando rodando.
  // O relógio de parede não sofre com o estrangulamento de timers de guia
  // oculta: cada tick recalcula o restante pelo timestamp, sem drift.
  const endTimeRef = React.useRef<number | null>(null);
  const bannerInitRef = React.useRef(false);
  const messagesRef = React.useRef<HTMLDivElement>(null);
  // t165 — A LEITURA NÃO É SEQUESTRADA: true = o leitor está no fim e o
  // auto-scroll segue o fio; false = ele subiu de propósito (reler uma
  // explicação) e a leitura fica PRESERVADA — o stream cresce em silêncio
  // e a pill oferece a volta. followLockRef protege o VOO programático da
  // pill (scroll suave) de se auto-desligar nos eventos intermediários.
  const [chatFollowing, setChatFollowing] = React.useState(true);
  const followLockRef = React.useRef(false);

  // Sincroniza refs a cada render (para uso em intervals/listeners/cleanup)
  React.useEffect(() => {
    liveRef.current = live;
  });
  React.useEffect(() => {
    ctxRef.current = { sp, cfg, durations, disciplineCode, materialId, summary, topicsSummary };
  });

  // Alinha a duração inicial com a config real assim que a hidratação chegar
  // (só enquanto o usuário não interagiu — nunca sobrescreve sessão restaurada).
  React.useEffect(() => {
    if (interactedRef.current) return;
    setLive((prev) => {
      if (prev.running) return prev;
      const full = durations[prev.phase];
      return prev.secondsLeft === full ? prev : { ...prev, secondsLeft: full };
    });
  }, [durations]);

  // Banner de continuidade: lê o pomodoroState persistido uma única vez por mount
  // (o hook hidrata o localStorage após a montagem, então observamos sp.progress).
  React.useEffect(() => {
    if (bannerInitRef.current || interactedRef.current) return;
    const saved = sp.progress.pomodoroState;
    if (!saved) return;
    bannerInitRef.current = true;
    const ts = new Date(saved.updatedAt).getTime();
    if (!Number.isFinite(ts)) return;
    const ageMin = Math.floor((Date.now() - ts) / 60_000);
    const isFresh = ageMin >= 0 && ageMin < 24 * 60; // menos de 24h
    if (isFresh && (saved.running || saved.secondsLeft > 0)) {
      setBanner({ saved, agoMin: Math.max(0, ageMin) });
    }
    if (saved.lastSessionSummary) {
      setSummary(saved.lastSessionSummary);
    }
  }, [sp.progress]);

  // ----- Persistência -----
  const persistNow = React.useCallback(
    (l: LiveTimer, summaryOverride?: SessionSummary | null) => {
      const ctx = ctxRef.current;
      // Rodando: grava o tempo REAL derivado do endsAt (snapshot sempre correto,
      // mesmo se o último tick foi atrasado pelo throttling da aba).
      const secondsLeft =
        l.running && typeof l.endsAt === 'number' ? remainingFromEndsAt(l.endsAt) : l.secondsLeft;
      const state: PomodoroState = {
        disciplineCode: ctx.disciplineCode,
        materialId: ctx.materialId || undefined,
        phase: l.phase,
        cycleCount: l.cycleCount,
        secondsLeft,
        running: l.running,
        endsAt: l.endsAt,
        runningSince: l.runningSince,
        updatedAt: new Date().toISOString(),
      };
      if (summaryOverride === undefined) {
        if (ctx.summary) state.lastSessionSummary = ctx.summary;
      } else if (summaryOverride !== null) {
        state.lastSessionSummary = summaryOverride;
      }
      ctx.sp.updatePomodoroState(state);
    },
    [],
  );

  const pauseCurrent = React.useCallback(() => {
    const l = liveRef.current;
    if (!l.running) return;
    endTimeRef.current = null;
    const paused: LiveTimer = { ...l, running: false, runningSince: undefined };
    setLive(paused);
    interactedRef.current = true;
    setBanner(null);
    persistNow(paused);
  }, [persistNow]);

  // Fim de fase: registra sessão (foco), avança fase, salva resumo e persiste.
  const handlePhaseComplete = React.useCallback(() => {
    const l = liveRef.current;
    const ctx = ctxRef.current;
    endTimeRef.current = null;
    playBeep(silentModeRef.current);
    if (ctx.sp.progress.preferences.notifyPhaseEnd) {
      notifyPhaseEnd(
        l.phase === 'focus' ? 'focus' : 'break',
        ctx.cfg.focus,
        getDisciplineByCode(ctx.disciplineCode)?.shortName ?? 'estudos',
      );
    }
    interactedRef.current = true;
    setBanner(null);

    if (l.phase === 'focus') {
      const completed = l.cycleCount + 1;
      const nextPhase: Phase =
        completed % ctx.cfg.cyclesBeforeLong === 0 ? 'longBreak' : 'shortBreak';
      const next: LiveTimer = {
        phase: nextPhase,
        secondsLeft: ctx.durations[nextPhase],
        running: false,
        cycleCount: completed,
        runningSince: undefined,
      };
      const newSummary: SessionSummary = {
        focusMinutes: ctx.cfg.focus,
        topicsDone: ctx.topicsSummary?.doneTopics ?? 0,
        topicsTotal: ctx.topicsSummary?.totalTopics ?? 0,
        nextPhase,
        completedAt: new Date().toISOString(),
      };
      ctx.sp.addPomodoroSession({
        startedAt:
          focusStartedAtRef.current ??
          new Date(Date.now() - ctx.cfg.focus * 60_000).toISOString(),
        disciplineId: ctx.disciplineCode,
        materialId: ctx.materialId || undefined,
        focusMinutes: ctx.cfg.focus,
        mode: 'estudo',
      });
      focusStartedAtRef.current = null;
      setSummary(newSummary);
      setLive(next);
      persistNow(next, newSummary);
    } else {
      const next: LiveTimer = {
        phase: 'focus',
        secondsLeft: ctx.durations.focus,
        running: false,
        cycleCount: l.cycleCount,
        runningSince: undefined,
      };
      setLive(next);
      persistNow(next);
    }
  }, [persistNow]);

  // Tick resiliente enquanto roda: o RELÓGIO DE PAREDE é a fonte da verdade.
  // Com a guia oculta o navegador estrangula o setInterval (chega a 1/min),
  // então em vez de decrementar 1 por tick recalculamos o restante pelo
  // timestamp de fim — zero drift. Um Web Worker reforça o ritmo em segundo
  // plano (o setInterval do worker não é estrangulado), mantendo o título da
  // aba e a transição de fase no tempo certo enquanto o dono pesquisa fora.
  const syncFromClock = React.useCallback(() => {
    if (!liveRef.current.running) return;
    const end = endTimeRef.current ?? Date.now() + liveRef.current.secondsLeft * 1000;
    endTimeRef.current = end;
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    setLive((prev) =>
      !prev.running || prev.secondsLeft === left ? prev : { ...prev, secondsLeft: left },
    );
  }, []);

  React.useEffect(() => {
    if (!live.running) return;
    syncFromClock();
    const id = window.setInterval(syncFromClock, 1000);
    // Worker de 1s: continua postando mesmo com a guia em segundo plano.
    let worker: Worker | null = null;
    try {
      const blob = new Blob(['setInterval(function(){postMessage(0)},1000);'], {
        type: 'text/javascript',
      });
      worker = new Worker(URL.createObjectURL(blob));
      worker.onmessage = () => syncFromClock();
    } catch {
      worker = null; // Sem worker (raro): o interval da guia cobre sozinho.
    }
    return () => {
      window.clearInterval(id);
      worker?.terminate();
    };
  }, [live.running, syncFromClock]);

  // Detecção de fim de fase (secondsLeft chegou a 0 rodando).
  React.useEffect(() => {
    if (live.running && live.secondsLeft <= 0) {
      handlePhaseComplete();
    }
  }, [live.running, live.secondsLeft, handlePhaseComplete]);

  // Timer no título da aba ("24:31 • Foco — Hub de Estudos") enquanto roda.
  const tabTitleTimer = sp.progress.preferences.tabTitleTimer;
  React.useEffect(() => {
    if (!tabTitleTimer || !live.running) return;
    const label = PHASE_META[live.phase].label;
    document.title = `${fmtSeconds(live.secondsLeft)} • ${label} — Hub de Estudos`;
  }, [live.running, live.secondsLeft, live.phase, tabTitleTimer]);

  // Restaura o título base quando o timer para ou a opção é desligada.
  React.useEffect(() => {
    if (!live.running || !tabTitleTimer) {
      document.title = APP_BASE_TITLE;
    }
  }, [live.running, tabTitleTimer]);

  // Persistência com throttle: a cada 5s enquanto roda.
  React.useEffect(() => {
    if (!live.running) return;
    const id = window.setInterval(() => {
      persistNow(liveRef.current);
    }, 5000);
    return () => window.clearInterval(id);
  }, [live.running, persistNow]);

  // Guia em segundo plano: com "Rodar em outra guia" LIGADO (padrão), o foco
  // segue contando pelo relógio e re-sincroniza na hora quando o dono volta;
  // a notificação de fim de fase chega normalmente. Desligado, volta a pausar
  // automaticamente (comportamento antigo).
  React.useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) {
        if (liveRef.current.running) syncFromClock();
        return;
      }
      if (!backgroundTimerRef.current && liveRef.current.running) {
        pauseCurrent();
        toast('Timer pausado', {
          description: 'A guia ficou em segundo plano — continue quando voltar.',
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pauseCurrent, syncFromClock]);

  // Ao desmontar (troca de aba), pausa e salva — o banner de continuidade cuida do retorno.
  React.useEffect(() => {
    return () => {
      const l = liveRef.current;
      if (!interactedRef.current || !l.running) return;
      persistNow({ ...l, running: false, runningSince: undefined });
    };
  }, [persistNow]);

  // ----- Ações do timer (botões) -----
  const startTimer = () => {
    const l = live;
    interactedRef.current = true;
    setBanner(null);
    const nowIso = new Date().toISOString();
    if (l.phase === 'focus') {
      if (!focusStartedAtRef.current) focusStartedAtRef.current = nowIso;
      if (materialId) sp.markAccessed(materialId);
    }
    const next: LiveTimer = { ...l, running: true, runningSince: nowIso };
    endTimeRef.current = Date.now() + next.secondsLeft * 1000;
    setLive(next);
    persistNow(next);
  };

  const pauseTimer = () => {
    if (!live.running) return;
    interactedRef.current = true;
    endTimeRef.current = null;
    const next: LiveTimer = { ...live, running: false, runningSince: undefined };
    setLive(next);
    persistNow(next);
  };

  const resetTimer = () => {
    interactedRef.current = true;
    focusStartedAtRef.current = null;
    endTimeRef.current = null;
    const next: LiveTimer = {
      phase: 'focus',
      secondsLeft: durations.focus,
      running: false,
      cycleCount: 0,
      runningSince: undefined,
    };
    setLive(next);
    persistNow(next);
  };

  const skipPhase = () => {
    interactedRef.current = true;
    focusStartedAtRef.current = null;
    endTimeRef.current = null;
    const nextPhase: Phase = live.phase === 'focus' ? 'shortBreak' : 'focus';
    const next: LiveTimer = {
      phase: nextPhase,
      secondsLeft: durations[nextPhase],
      running: false,
      cycleCount: live.cycleCount,
      runningSince: undefined,
    };
    setLive(next);
    persistNow(next);
  };

  const handleDisciplineChange = (code: string) => {
    if (code === disciplineCode) return;
    setDisciplineCode(code);
    setMaterialId('');
    focusStartedAtRef.current = null;
    setLive({
      phase: 'focus',
      secondsLeft: durations.focus,
      running: false,
      cycleCount: 0,
      runningSince: undefined,
    });
    setBanner(null);
    // Se já tínhamos uma sessão em andamento, persiste o reinício sob a nova disciplina.
    if (interactedRef.current) {
      sp.updatePomodoroState({
        disciplineCode: code,
        phase: 'focus',
        cycleCount: 0,
        secondsLeft: durations.focus,
        running: false,
        updatedAt: new Date().toISOString(),
        lastSessionSummary: summary ?? undefined,
      });
    }
  };

  // ----- Banner de continuidade -----
  const continueFromBanner = () => {
    if (!banner) return;
    const saved = banner.saved;
    interactedRef.current = true;
    focusStartedAtRef.current = null;

    if (getDisciplineByCode(saved.disciplineCode)) {
      setDisciplineCode(saved.disciplineCode);
    }
    const savedMaterials = getMaterialsByDiscipline(saved.disciplineCode);
    setMaterialId(
      saved.materialId && savedMaterials.some((m) => m.id === saved.materialId)
        ? saved.materialId
        : '',
    );

    // Desconta o tempo decorrido desde runningSince (clamp ≥ 0).
    let adjusted = saved.secondsLeft;
    if (saved.running && saved.runningSince) {
      const elapsedSec = Math.max(
        0,
        Math.floor((Date.now() - new Date(saved.runningSince).getTime()) / 1000),
      );
      adjusted = Math.max(0, saved.secondsLeft - elapsedSec);
    }
    const completedWhileRunning = saved.running && adjusted <= 0;

    let next: LiveTimer;
    if (adjusted <= 0) {
      if (saved.phase === 'focus') {
        if (completedWhileRunning) {
          // O foco realmente rodou até o fim — registra a sessão.
          sp.addPomodoroSession({
            startedAt: saved.runningSince ?? saved.updatedAt,
            disciplineId: saved.disciplineCode,
            materialId: saved.materialId,
            focusMinutes: cfg.focus,
            mode: 'estudo',
          });
        }
        const completed = saved.cycleCount + 1;
        const nextPhase: Phase =
          completed % cfg.cyclesBeforeLong === 0 ? 'longBreak' : 'shortBreak';
        next = {
          phase: nextPhase,
          secondsLeft: durations[nextPhase],
          running: false,
          cycleCount: completed,
          runningSince: undefined,
        };
        setSummary({
          focusMinutes: cfg.focus,
          topicsDone: topicsSummary?.doneTopics ?? 0,
          topicsTotal: topicsSummary?.totalTopics ?? 0,
          nextPhase,
          completedAt: new Date().toISOString(),
        });
      } else {
        next = {
          phase: 'focus',
          secondsLeft: durations.focus,
          running: false,
          cycleCount: saved.cycleCount,
          runningSince: undefined,
        };
      }
      toast(
        completedWhileRunning
          ? 'Fase concluída enquanto você estava fora — seguimos para a próxima.'
          : 'A fase anterior havia terminado — seguimos para a próxima.',
      );
    } else {
      next = {
        phase: saved.phase,
        secondsLeft: adjusted,
        running: saved.running,
        cycleCount: saved.cycleCount,
        runningSince: saved.running ? new Date().toISOString() : undefined,
      };
    }

    if (next.running) endTimeRef.current = Date.now() + next.secondsLeft * 1000;
    setLive(next);
    setBanner(null);
    persistNow(next);
  };

  const discardBanner = () => {
    setBanner(null);
    sp.updatePomodoroState(null);
  };

  const dismissSummary = () => {
    setSummary(null);
    if (banner) {
      // Remove só o resumo do estado salvo, preservando a sessão do banner.
      sp.updatePomodoroState({ ...banner.saved, lastSessionSummary: undefined });
    } else if (interactedRef.current) {
      persistNow(liveRef.current, null);
    }
  };

  const nextPhaseLabel = (p: SessionSummary['nextPhase']) =>
    p === 'shortBreak'
      ? `Pausa curta (${cfg.shortBreak} min)`
      : p === 'longBreak'
        ? `Pausa longa (${cfg.longBreak} min)`
        : `Foco (${cfg.focus} min)`;

  // ----- Chat IA -----
  // Nova conversa quando a disciplina muda (o contexto do tutor acompanha).
  React.useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: buildWelcome(disciplineShortName, mathExamBriefFor(discipline.code)),
      },
    ]);
    setChatLoading(false);
    setStreamText(null);
    setChatSearchOpen(false);
    setChatSearch('');
  }, [disciplineShortName]);

  // Pedido externo de tutor (hub:open-tutor): seleciona a disciplina, abre o
  // chat e pré-preenche a pergunta — o aluno revisa e envia.
  React.useEffect(() => {
    if (!tutorReq || tutorReq.nonce === 0) return;
    const code = tutorReq.detail.disciplineCode;
    if (code && getDisciplineByCode(code) && code !== disciplineCode) {
      setDisciplineCode(code);
    }
    // Material pedido junto (ex.: "perguntar sobre este material" na Biblioteca):
    // seleciona aqui para o retrieval ler o conteúdo REAL no envio. Valida contra
    // a disciplina EFETIVA (a lista do closure pode estar defasada na troca).
    const reqMaterial = tutorReq.detail.materialId;
    const effCode = code && getDisciplineByCode(code) ? code : disciplineCode;
    const effMaterials = getMaterialsByDiscipline(effCode);
    if (reqMaterial && effMaterials.some((m) => m.id === reqMaterial)) {
      setMaterialId(reqMaterial);
    } else if (code && code !== disciplineCode) {
      setMaterialId('');
    }
    if (tutorReq.detail.question) {
      setChatInput(tutorReq.detail.question);
    }
    // Imagem pré-anexada (print de página do visualizador de PDF, canal da 139):
    // entra no MESMO chatImage dos prints colados — vida efêmera, nada no disco.
    if (tutorReq.detail.image) {
      setChatImage(tutorReq.detail.image);
      setChatImageLabel(tutorReq.detail.imageLabel ?? 'print do material');
    }
    setChatOpen(true);
  }, [tutorReq?.nonce]);

  // Memória: restaura a conversa salva da disciplina ao abrir o chat.
  React.useEffect(() => {
    if (!chatOpen) return;
    // t165: cada abertura é um recomeço de leitura — o follow volta ligado
    // (o Sheet desmonta o fio; sem o reset, um "subiu" da sessão anterior
    // deixaria o aluno no topo com a resposta nova crescendo em silêncio).
    setChatFollowing(true);
    followLockRef.current = false;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/tutor/history?discipline=${encodeURIComponent(disciplineCode)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: {
            role: 'user' | 'assistant';
            content: string;
            model?: string;
            savedAt?: string;
          }[];
        };
        const restored = data.messages;
        if (alive && restored && restored.length > 0) {
          setMessages((prev) => {
            // já há conversa em andamento nesta disciplina → não duplica
            if (prev.some((m) => m.role === 'user')) return prev;
            return [
              {
                role: 'assistant' as const,
                content: buildWelcome(disciplineShortName, mathExamBriefFor(discipline.code)),
              },
              // t151: cada restaurada carrega QUANDO foi dita (savedAt ISO
              // → HH:MM) — o fio restaurado ganha o mesmo carimbo da viva.
              ...restored.map((m) => ({
                role: m.role,
                content: m.content,
                model: m.model,
                savedAt: m.savedAt,
                time: hhmmOf(m.savedAt),
              })),
            ];
          });
        }
      } catch {
        // sem histórico (offline/db) — segue só com o welcome
      }
    })();
    return () => {
      alive = false;
    };
  }, [chatOpen, disciplineCode]);

  // Auto-scroll do chat — t165: CONDICIONAL à intenção do leitor. Se ele
  // subiu (chatFollowing=false), o fio cresce em silêncio; a pill oferece a
  // volta. Quem pergunta quer a resposta: o envio devolve o follow
  // (setChatFollowing(true) no sendQuestion). O chatFollowing nos deps faz a
  // volta pela pill também pousar no fim (o clique já rola; o efeito é o
  // cinto e suspensa — idempotente no mesmo destino).
  React.useEffect(() => {
    const el = messagesRef.current;
    if (el && chatFollowing) el.scrollTop = el.scrollHeight;
  }, [messages, chatLoading, chatOpen, streamText, chatFollowing]);

  // t165 — o relogio da intenção: cada scroll REAL do leitor reavalia o
  // follow. O voo programático (pill) é ignorado até pousar no fim
  // (followLockRef), para os eventos intermediários do smooth não nascerem
  // a pill de novo. O salto do auto-follow é INSTANTE (pousa na distância 0
  // — o handler confirma o follow, sem churn).
  const onThreadScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (followLockRef.current) {
      if (isNearBottom(el.scrollTop, el.clientHeight, el.scrollHeight)) {
        followLockRef.current = false;
      }
      return;
    }
    setChatFollowing(isNearBottom(el.scrollTop, el.clientHeight, el.scrollHeight));
  }, []);

  // t165 — a volta pela pill: rola suave até o fim e religa o follow já
  // protegido pelo lock (os eventos do voo não desligam o que o clique ligou).
  const scrollThreadToBottom = React.useCallback((smooth: boolean) => {
    const el = messagesRef.current;
    if (!el) return;
    followLockRef.current = true;
    setChatFollowing(true);
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  }, []);

  // t155: A BUSCA QUE CAMINHA — achar não basta, é preciso CHEGAR. pos é a
  // posição na lista de resultados (null = parado), flash é a bolha acesa e
  // o timer a apaga. A aritmética da volta (Ctrl+F) é pura na lib
  // (searchNavStep) — aqui só rola até a bolha e reacende a luz. Vive depois
  // do messagesRef (a closure o lê — ordem limpa de declaração).
  const [chatSearchPos, setChatSearchPos] = React.useState<number | null>(null);
  const [chatFlashMsg, setChatFlashMsg] = React.useState<number | null>(null);
  const chatFlashTimer = React.useRef<number | null>(null);
  const goToMatch = React.useCallback(
    (pos: number | null) => {
      if (pos === null || !chatSearchResults?.length) return;
      setChatSearchPos(pos);
      setChatFlashMsg(null);
      // rAF separa os commits: a animação renasce mesmo voltando à MESMA
      // bolha (volta do fim ao começo num resultado único).
      requestAnimationFrame(() => {
        setChatFlashMsg(chatSearchResults[pos].i);
        const el = messagesRef.current?.querySelector<HTMLElement>(
          `[data-msg-index="${chatSearchResults[pos].i}"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      if (chatFlashTimer.current !== null) window.clearTimeout(chatFlashTimer.current);
      chatFlashTimer.current = window.setTimeout(() => setChatFlashMsg(null), 1600);
    },
    [chatSearchResults],
  );
  const stepMatch = React.useCallback(
    (delta: number) => {
      goToMatch(searchNavStep(chatSearchPos, chatSearchResults?.length ?? 0, delta));
    },
    [chatSearchPos, chatSearchResults, goToMatch],
  );
  // Texto novo ou busca fechada = resultados re-nascem: pos e flash zeram.
  React.useEffect(() => {
    setChatSearchPos(null);
    setChatFlashMsg(null);
  }, [chatSearch, chatSearchActive]);
  React.useEffect(
    () => () => {
      if (chatFlashTimer.current !== null) window.clearTimeout(chatFlashTimer.current);
    },
    [],
  );

  /** Anexa print/foto da questão — reduzido antes de virar data URL. */
  const attachChatImage = async (
    file: File | null | undefined,
    label = 'imagem do arquivo',
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Só dá para anexar imagem (print/foto).');
      return;
    }
    try {
      setChatImage(await downscaleImageFile(file));
      setChatImageLabel(label);
    } catch {
      toast.error('Não consegui processar a imagem. Tente outra.');
    }
  };

  /** CAPTURAR A TELA (28/09): frame → recorte → anexo → some. Os tracks da
   * transmissão param no ato (lib/screen-capture — o hook cuida do seletor
   * que não é cancelável: 2º clique solta a UI) e nada é salvo no disco —
   * a pasta de prints do aluno fica limpa. */

  // Auto-grow do textarea da mensagem (até ~7 linhas; Shift+Enter quebra a linha)
  React.useEffect(() => {
    const el = chatTaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [chatInput]);

  const sendQuestion = async (question: string, imageOverride?: string | null) => {
    // t164 — A SEGUNDA CHANCE: o "tentar de novo" da bolha de erro passa
    // imageOverride DEFINIDO (string ou null explícito) e reenvia o turno
    // ORIGINAL inteiro — sem colar o bloco de código do composer (a pergunta
    // original já o carrega, a bolha mostrou os dois blocos) e sem limpar o
    // que o aluno estiver digitando agora (o composer é do presente). Envio
    // normal: sem 2º argumento — comportamento idêntico ao de sempre.
    const isRetry = imageOverride !== undefined;
    const code = isRetry ? '' : chatCode.replace(/\s+$/, '');
    const q = [
      question.trim(),
      code ? '```' + codeLang + '\n' + code + '\n```' : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if ((!q && !chatImage) || chatLoading) return;
    // t165: quem pergunta quer a resposta — o envio devolve o follow mesmo
    // que o leitor estivesse relendo algo acima (e solta o lock do voo da
    // pill, se ele ainda estivesse em voo).
    setChatFollowing(true);
    followLockRef.current = false;
    const image = isRetry ? imageOverride : chatImage;
    // O TUTOR CONTA (123, o P2 que a 118 deixou pendente): a dúvida enviada com
    // material selecionado É estudo do material — o retrieval lê o conteúdo REAL
    // dele para responder, e o registro entra na MESMA fonte (markAccessed) da
    // abertura: "tiro dúvidas com a tutor" deixou de ser invisível para o
    // progresso (dono, 28/09). No ENVIO, não na abertura do chat: abrir e
    // cancelar não provou nada. Idempotente e barato: marcar de novo só
    // atualiza o lastAccessedAt.
    if (selectedMaterial) sp.markAccessed(selectedMaterial.id);
    // Memória da conversa: últimas 12 mensagens (sem bolhas de erro) — o tutor
    // usa isso para CONTINUAR o raciocínio em vez de recomeçar o assunto.
    // t164: o filtro agora olha a FLAG `error` (o farejo do ⚠️ era morto —
    // mensagens de erro reais nunca começaram com ⚠️; a falha vazava no
    // histórico e a IA lia o escombro como se fosse fala dela).
    const history = messages
      .filter((m) => !m.error && !m.content.startsWith('⚠️'))
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: q || '📷 print anexado',
        image: image ?? undefined,
        time: hhmm(),
        savedAt: new Date().toISOString(),
      },
    ]);
    if (!isRetry) {
      // O retry não mexe no composer: o chip pendente e o rascunho em
      // digitação sobrevivem — só o turno antigo é reenviado.
      setChatImage(null);
      setChatImageLabel(null);
      setChatInput('');
      setChatCode('');
    }
    setChatLoading(true);
    setStreamText(null);
    try {
      const result = await streamTutorAnswer(
        {
          question: q,
          imageDataUrl: image ?? undefined,
          discipline: discipline.name,
          disciplineCode,
          topic: chatTopic,
          material: selectedMaterial?.title,
          materialId: selectedMaterial?.id,
          history,
          hintMode: chatHints,
          hubContext: buildHubContext(disciplineCode, sp),
        },
        (_piece, full) => {
          setChatLoading(false); // 1º delta chegou — troca o "Pensando..." pela resposta viva
          setStreamText(full);
        },
      );
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer,
          model: result.model,
          time: hhmm(),
          savedAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      // stream caiu no meio? mantém o parcial que o aluno já viu
      const partial = err instanceof TutorStreamError ? err.partial : '';
      if (partial.trim()) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: partial, time: hhmm(), savedAt: new Date().toISOString() },
        ]);
      } else {
        // Sem resposta nenhuma (deploy sem key de IA, falha total): o motivo PRECISA
        // ficar visível no próprio chat — toast some em 4s e fica fora do diálogo.
        const msg = err instanceof Error ? err.message : 'Não foi possível consultar o tutor agora.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: msg,
            time: hhmm(),
            savedAt: new Date().toISOString(),
            error: true,
          },
        ]);
      }
      toast.error(err instanceof Error ? err.message : 'Não foi possível consultar o tutor agora.');
    } finally {
      setChatLoading(false);
      setStreamText(null);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: buildWelcome(disciplineShortName, mathExamBriefFor(discipline.code)),
      },
    ]);
    setChatInput('');
    // apaga também a memória salva da disciplina (falha silenciosa é ok)
    void fetch(`/api/tutor/history?discipline=${encodeURIComponent(disciplineCode)}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  /** Baixa a conversa em .md — o aluno arquiva no caderno/documento de estudos.
   * O formato é o mesmo do painel dividido (t149: uma só fonte da verdade). */
  const exportChat = () => {
    try {
      downloadTextFile(
        `tutor-${disciplineCode.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`,
        buildChatMarkdown(`Conversa com o Tutor — ${discipline.name}`, messages),
      );
      toast.success('Conversa baixada em Markdown.');
    } catch {
      toast.error('Não consegui baixar a conversa agora.');
    }
  };

  /** Copia a conversa INTEIRA (t149) — pra colar no caderno, no grupo de
   * estudos ou no documento, sem depender de arquivo. */
  const copyConversation = () => {
    navigator.clipboard
      .writeText(buildChatMarkdown(`Conversa com o Tutor — ${discipline.name}`, messages))
      .then(() => toast.success('Conversa copiada — cola no caderno, no grupo ou no documento.'))
      .catch(() => toast.error('Não consegui copiar agora.'));
  };

  /** Copia o texto completo de uma resposta do tutor (pra colar no caderno).
   * O botão responde na hora (✓ copiado, 2s) — o toast confirma sozinho. */
  const copyAnswer = (text: string, index: number) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedMsg(index);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedMsg(null), 2000);
        toast.success('Resposta copiada — cola no caderno ou no documento.');
      })
      .catch(() => toast.error('Não consegui copiar agora.'));
  };

  // ----- Render -----

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* ===== Coluna esquerda: Pomodoro + resumos ===== */}
      <div className="space-y-4 lg:col-span-7">
        <AnimatePresence>
          {banner && (
            <motion.div
              key="continuity-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <History className="size-5 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      Você estava estudando{' '}
                      <span className="font-semibold">
                        {getDisciplineByCode(banner.saved.disciplineCode)?.shortName ??
                          banner.saved.disciplineCode}
                      </span>{' '}
                      — fase {PHASE_META[banner.saved.phase].label.toLowerCase()},{' '}
                      <span className="font-semibold tabular-nums">
                        {fmtSeconds(banner.saved.secondsLeft)}
                      </span>{' '}
                      restantes.
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {banner.saved.running
                        ? 'Estava em execução quando você saiu'
                        : 'Pausada'}{' '}
                      ·{' '}
                      {banner.agoMin < 1
                        ? 'menos de 1 min atrás'
                        : `há ${banner.agoMin} min`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={continueFromBanner}
                    >
                      Continuar de onde parei
                    </Button>
                    <Button size="sm" variant="outline" onClick={discardBanner}>
                      Descartar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {summary && (
            <motion.div
              key="session-summary"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-emerald-500/40 bg-emerald-500/5">
                <CardContent className="flex items-start gap-3 p-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                  <p className="flex-1 text-sm">
                    Você completou{' '}
                    <span className="font-semibold">{summary.focusMinutes} min</span> de
                    foco. Tópicos marcados:{' '}
                    <span className="font-semibold">
                      {summary.topicsDone}/{summary.topicsTotal}
                    </span>
                    . Próximo:{' '}
                    <span className="font-semibold">{nextPhaseLabel(summary.nextPhase)}</span>.
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={dismissSummary}
                    aria-label="Dispensar resumo da sessão"
                  >
                    <X className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Timer className="size-4 text-emerald-400" />
                Pomodoro
              </CardTitle>
              <CardDescription>Registre sessões de foco e acompanhe sua meta</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setChatOpen(true)}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Sparkles className="size-4" />
                Tirar dúvida com IA
              </Button>
              <Button
                variant="outline"
                onClick={() => setZenOpen(true)}
                aria-label="Abrir modo foco (tela cheia)"
                title="Modo foco — tela cheia (Esc para sair)"
              >
                <Maximize2 className="size-4" />
                Modo foco
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Seleção de disciplina + material */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="study-discipline">Disciplina</Label>
                <Select value={disciplineCode} onValueChange={handleDisciplineChange}>
                  <SelectTrigger id="study-discipline" className="w-full">
                    <SelectValue placeholder="Escolha a disciplina" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {disciplines.map((d) => (
                      <SelectItem key={d.code} value={d.code}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="study-material">Material (opcional)</Label>
                <Select
                  value={materialId || 'none'}
                  onValueChange={(v) => setMaterialId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger id="study-material" className="w-full">
                    <SelectValue placeholder="Sem material específico" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">Sem material específico</SelectItem>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {MATERIAL_TYPE_LABEL[m.type]} · {m.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Relógio */}
            <div
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border bg-white/[0.02] px-4 py-8 transition-all duration-500',
                live.running
                  ? 'border-emerald-500/40 shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]'
                  : 'border-white/10',
              )}
            >
              <Badge variant="outline" className={PHASE_META[live.phase].badge}>
                {PHASE_META[live.phase].label}
              </Badge>
              <div
                className={cn(
                  'text-6xl font-bold tabular-nums',
                  PHASE_META[live.phase].text,
                )}
              >
                {fmtSeconds(live.secondsLeft)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Ciclo {cyclePosition} de {cycleTotal}
                </span>
                <span className="flex items-center gap-1.5" aria-hidden>
                  {Array.from({ length: cycleTotal }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'size-2 rounded-full transition-colors',
                        i < doneInCycle ? PHASE_META.focus.dot : 'bg-white/15',
                      )}
                    />
                  ))}
                </span>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {live.phase === 'focus'
                  ? selectedMaterial
                    ? `Material: ${selectedMaterial.title}`
                    : 'Sem material específico'
                  : `Recupere o fôlego — em seguida, mais foco em ${discipline.shortName}`}
              </p>
            </div>

            {/* Controles: só 3 botões */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={live.running ? pauseTimer : startTimer}
                className={cn('min-w-40 text-white', PHASE_META[live.phase].solid)}
              >
                {live.running ? (
                  <>
                    <Pause className="size-4" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Iniciar
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={resetTimer}>
                <RotateCcw className="size-4" />
                Resetar
              </Button>
              <Button variant="outline" onClick={skipPhase}>
                <SkipForward className="size-4" />
                Pular fase
              </Button>
            </div>

            {/* Continuidade (GNOME-like: controle contextual onde a ação acontece) */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={sp.progress.preferences.backgroundTimer !== false}
                onCheckedChange={(v) => sp.updatePreferences({ backgroundTimer: v })}
                aria-label="Continuar o Pomodoro quando o Hub estiver em outra guia"
              />
              <span>
                Rodar em outra guia — o foco segue contando enquanto você pesquisa fora
              </span>
            </div>

            <Separator />

            {/* Mini-stats */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 text-emerald-400" />
                Hoje: <span className="font-medium text-foreground">{sp.minutesToday} min</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Timer className="size-4 text-amber-400" />
                <span className="font-medium text-foreground">{sp.sessionsToday.length}</span>{' '}
                sessões
              </span>
              <span className="flex items-center gap-1.5">
                <Target className="size-4 text-teal-400" />
                meta <span className="font-medium text-foreground">{sp.dailyGoalProgress}%</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Coluna direita: checklist de tópicos ===== */}
      <div className="lg:col-span-5">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DisciplineIcon name={discipline.icon} className="size-4 text-emerald-400" />
              Tópicos de {discipline.shortName}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span className={cn('inline-block size-2 rounded-full', colors.dot)} />
              {discipline.name} · {discipline.chTotal}h · Prof. {discipline.professor}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topicsSummary ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {topicsSummary.doneTopics}
                      </span>
                      /{topicsSummary.totalTopics} tópicos
                    </span>
                    <span className="font-semibold text-emerald-400">
                      {topicsSummary.progress}%
                    </span>
                  </div>
                  <Progress value={topicsSummary.progress} className="h-2" />
                  {topicsSummary.nextTopic && !topicsSummary.isComplete && (
                    <p className="text-xs text-muted-foreground">
                      Próximo: <span className="text-foreground">{topicsSummary.nextTopic}</span>
                    </p>
                  )}
                  {/* A RESPOSTA À PERGUNTA DO DONO (118): "em que momento marco
                      esses tópicos?" — o critério didático fica visível, e a
                      linha de atividade prova que o fluxo real (abrir material,
                      resolver questão) já é registrado sozinho. */}
                  {activitySummary && activitySummary.tocadas > 0 ? (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400/90">
                      <Sparkles className="size-3 shrink-0" aria-hidden />
                      <span>
                        {activitySummary.tocadas}{' '}
                        {activitySummary.tocadas === 1 ? 'unidade' : 'unidades'} com atividade sua
                        {activitySummary.lastLabel && ` · última ${activitySummary.lastLabel}`}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Marque o tópico quando conseguir resolver sem olhar o material — materiais abertos e questões tentadas o Hub registra sozinho.
                    </p>
                  )}
                </div>

                {topicsSummary.isComplete && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-400">
                    <CheckCircle2 className="size-4 shrink-0" />
                    Todos os tópicos desta disciplina estão concluídos!
                  </div>
                )}

                <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {topicsSummary.units.map((unit) => {
                    const unitDone = unit.topics.filter((t) => t.done).length;
                    const act = unitActivity.get(unit.name);
                    const ultima = act ? lastActivityLabel(act.lastActivityAt) : null;
                    // O rodapé entra quando há MATERIAIS na unidade (0/N também
                    // — é o ponteiro didático do que abrir) ou questões já
                    // tentadas (a evidência). Unidade sem material nem esforço
                    // fica muda — nada a acusar.
                    const temEvidencia =
                      !!act &&
                      (act.materiaisTotal > 0 || act.questoesTentadas > 0);
                    return (
                      <div key={unit.name} className="rounded-xl border border-white/10 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h4 className="text-sm font-medium leading-snug">{unit.name}</h4>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {/* EVIDÊNCIA VISÍVEL (118): unidade com atividade real
                                ganha o selo 'em estudo' (a família da espera —
                                amber, sem pulso: não é prazo) — o aluno vê que o
                                site acompanhou o que ele já fez. */}
                            {act?.tocada && !unit.done && (
                              <Badge
                                variant="outline"
                                title="Você já abriu material ou tentou questões desta unidade — o Hub registrou sozinho."
                                className="border-amber-300/70 bg-amber-50 text-[9px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-300"
                              >
                                em estudo
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                unit.done && 'border-emerald-500/40 text-emerald-400',
                              )}
                            >
                              {unitDone}/{unit.topics.length}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {unit.topics.map((topic) => (
                            <label
                              key={topic.name}
                              className="flex cursor-pointer items-start gap-2.5"
                            >
                              <Checkbox
                                className="mt-0.5"
                                checked={topic.done}
                                onCheckedChange={() =>
                                  sp.toggleTopic(disciplineCode, topic.name)
                                }
                                aria-label={`Marcar "${topic.name}" como ${
                                  topic.done ? 'pendente' : 'concluído'
                                }`}
                              />
                              <span
                                className={cn(
                                  'text-sm leading-snug transition-opacity',
                                  topic.done && 'line-through opacity-50',
                                )}
                              >
                                {topic.name}
                              </span>
                            </label>
                          ))}
                        </div>
                        {/* A PROVA DO ACOMPANHAMENTO (118): a evidência da sua
                            própria atividade — materiais abertos, questões
                            tentadas, quando foi a última vez. Mudo quando a
                            unidade nunca foi dada nem tocada (nada a acusar). */}
                        {act && temEvidencia && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2.5 text-[11px] text-muted-foreground">
                            {act.materiaisTotal > 0 && (
                              <span
                                className="inline-flex items-center gap-1"
                                title="Materiais desta unidade que você já abriu"
                              >
                                <FileText className="size-3" aria-hidden />
                                {act.materiaisVistos}/{act.materiaisTotal} materiais
                              </span>
                            )}
                            {act.questoesTotal > 0 && (
                              <span
                                className="inline-flex items-center gap-1 tabular-nums"
                                title="Questões em sala desta unidade que você já tentou ou resolveu"
                              >
                                <PenLine className="size-3" aria-hidden />
                                {act.questoesTentadas}/{act.questoesTotal} questões
                              </span>
                            )}
                            {ultima && (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="size-3" aria-hidden />última {ultima}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Conteúdo programático não encontrado para esta disciplina.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Laboratório de código (só disciplinas de programação) =====
          Algoritmos: console JS para treinar lógica; LM: preview HTML ao vivo.
          "Perguntar ao tutor" envia código + erro direto pro chat da disciplina. */}
      {(disciplineCode === 'TEC.1687' || disciplineCode === 'TEC.1632') && (
        <div className="lg:col-span-12">
          <CodeLab
            disciplineShort={discipline.shortName}
            defaultTab={disciplineCode === 'TEC.1632' ? 'html' : 'js'}
            onAskTutor={(q) => openTutor({ disciplineCode, question: q })}
          />
        </div>
      )}

      {/* ===== Chat IA lateral ===== */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-lg lg:max-w-xl"
          onEscapeKeyDown={(e) => {
            // t153: com a busca aberta, o Esc é DA BUSCA (fecha e limpa o
            // campo — handler do input) e NÃO da conversa: o preventDefault
            // aqui é o contrato do Radix (DismissableLayer só demite sem
            // defaultPrevented). Sem busca, o Esc continua fechando o chat.
            if (chatSearchOpen) e.preventDefault();
          }}
        >
          <SheetHeader className="border-b border-white/10 pr-12">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-amber-400" />
                  Tirar dúvida com IA
                </SheetTitle>
                <SheetDescription className="truncate">
                  Tutor de {discipline.shortName} · tópico: {chatTopic}
                </SheetDescription>
                {examWeek && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-amber-600 dark:text-amber-400"
                      title="O tutor recebe o estado ao vivo da semana da Av1: plano de hoje, o veredito do simulado (quando feito) e as travadas marcadas"
                    >
                      <CalendarCheck className="size-3 shrink-0" aria-hidden />
                      contexto: semana da Av1 · D-{examWeek.provaDaysLeft}
                      {examWeek.simulado
                        ? ` · simulado ${examWeek.simulado.pct}%`
                        : ''}
                    </span>
                  </div>
                )}
                {/* O RECIBO HONESTO DA NOVIDADE (123): dúvidas com material
                    selecionado agora contam como estudo — o chip diz isso
                    ANTES de o aluno perguntar (emerald, a família do registro
                    que a casa já consagrou; o mesmo tom do chip da semana). */}
                {selectedMaterial && (
                  <div className="mt-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                      title={`Dúvidas enviadas aqui contam como estudo de "${selectedMaterial.title}" — o Hub registra sozinho, na mesma fonte da abertura do material`}
                    >
                      <BookOpen className="size-3 shrink-0" aria-hidden />
                      dúvidas contam como estudo
                    </span>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'size-8 shrink-0 transition-colors',
                  chatHints
                    ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 hover:text-amber-400'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setChatHints((v) => !v)}
                aria-pressed={chatHints}
                aria-label="Modo dica"
                title={
                  chatHints
                    ? 'Modo dica LIGADO — o tutor dá pistas antes da solução (clique p/ desligar)'
                    : 'Modo dica — tutor dá pistas antes de resolver (bom pra treinar)'
                }
              >
                <Lightbulb className="size-4" />
              </Button>
              {/* t151: buscar na conversa — a memória da disciplina só serve
                  se dá pra ACHAR o que o tutor explicou (ex.: a explicação
                  da inversa na semana da prova). */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'size-8 shrink-0 transition-colors',
                  chatSearchOpen
                    ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 hover:text-emerald-500 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  const next = !chatSearchOpen;
                  setChatSearchOpen(next);
                  if (!next) setChatSearch('');
                }}
                aria-pressed={chatSearchOpen}
                aria-label="Buscar na conversa"
                title={`Buscar nesta conversa (a memória guarda as últimas ${TUTOR_HISTORY_KEEP} mensagens da disciplina)`}
              >
                <Search className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={exportChat}
                disabled={messages.length <= 1}
                aria-label="Baixar conversa"
                title="Baixar conversa em Markdown (pra guardar no caderno)"
              >
                <Download className="size-4" />
              </Button>
              {/* t149: a análise da prova também cabe no grupo de estudos —
                  copiar a conversa inteira sem depender de arquivo. */}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={copyConversation}
                disabled={messages.length <= 1}
                aria-label="Copiar conversa"
                title="Copiar a conversa inteira (pra colar no caderno, no grupo ou no documento)"
              >
                <ClipboardList className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={clearChat}
                disabled={chatLoading}
                aria-label="Limpar conversa"
                title="Limpar conversa"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* t151: a barra da busca — abre sob o cabeçalho, some com Esc/X. */}
          {chatSearchOpen && (
            <div className="border-b border-border/60 px-3 py-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !e.nativeEvent.isComposing &&
                      chatSearchActive
                    ) {
                      // t155: Enter salta ao próximo casamento, Shift+Enter
                      // volta — a busca não recarrega nada, só CAMINHA pelo
                      // que já está na tela (parado, Enter entra no 1º;
                      // Shift+Enter entra pela cauda).
                      e.preventDefault();
                      stepMatch(e.shiftKey ? -1 : 1);
                      return;
                    }
                    if (e.key === 'Escape') {
                      // t153: fecha SÓ a busca — o fechamento do chat em si
                      // é travado no onEscapeKeyDown do SheetContent (o
                      // Radix escuta Escape em CAPTURE no document, antes
                      // de qualquer handler daqui: stopPropagation nunca
                      // chegaria lá).
                      setChatSearchOpen(false);
                      setChatSearch('');
                    }
                  }}
                  placeholder="Buscar nesta conversa…"
                  aria-label="Buscar na conversa"
                  title="A busca ignora acentos, maiúsculas e pontuação — 'logica' acha 'Lógica', 'nao caem' acha 'não caem.' Enter salta ao próximo trecho, Shift+Enter volta."
                  className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setChatSearchOpen(false);
                    setChatSearch('');
                  }}
                  aria-label="Fechar busca"
                  title="Fechar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          <div
            ref={messagesRef}
            onScroll={onThreadScroll}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin]"
          >
            {/* t151: o status da busca — contagem honesta OU vazio explicado. */}
            {chatSearchActive && (
              <p
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                role="status"
              >
                {chatSearchResults && chatSearchResults.length > 0 ? (
                  <>
                    <Search className="size-3 shrink-0" aria-hidden />
                    {/* t155: o contador que CAMINHA — anterior/próximo com
                    volta, posição honesta (1/6 quando andando, N parado). */}
                    <span
                      className="flex items-center rounded-md border border-amber-500/30 bg-amber-500/10"
                      data-testid="chat-search-nav"
                      role="group"
                      aria-label="Navegar entre os trechos encontrados"
                    >
                      <button
                        type="button"
                        data-testid="chat-search-prev"
                        onClick={() => stepMatch(-1)}
                        aria-label="Trecho anterior"
                        title="Trecho anterior (Shift+Enter)"
                        className="flex size-6 items-center justify-center rounded-l-md text-amber-700 transition-colors hover:bg-amber-500/15 focus-visible:outline-2 focus-visible:outline-amber-500 dark:text-amber-400"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <span
                        className="min-w-[2.75rem] text-center text-[11px] font-medium tabular-nums text-foreground"
                        title={
                          chatSearchPos === null
                            ? `${chatSearchResults.length} ${chatSearchResults.length === 1 ? 'mensagem encontrada' : 'mensagens encontradas'} — Enter salta ao primeiro`
                            : `Trecho ${chatSearchPos + 1} de ${chatSearchResults.length}`
                        }
                      >
                        {chatSearchPos === null
                          ? chatSearchResults.length
                          : `${chatSearchPos + 1}/${chatSearchResults.length}`}
                      </span>
                      <button
                        type="button"
                        data-testid="chat-search-next"
                        onClick={() => stepMatch(1)}
                        aria-label="Próximo trecho"
                        title="Próximo trecho (Enter)"
                        className="flex size-6 items-center justify-center rounded-r-md text-amber-700 transition-colors hover:bg-amber-500/15 focus-visible:outline-2 focus-visible:outline-amber-500 dark:text-amber-400"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </span>
                    <span className="min-w-0 truncate">
                      {chatSearchResults.length === 1 ? 'mensagem' : 'mensagens'} com “
                      {chatSearch.trim()}”
                    </span>
                  </>
                ) : (
                  <>
                    <SearchX className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                    Nada com “{chatSearch.trim()}” nesta conversa — a memória guarda as últimas{' '}
                    {TUTOR_HISTORY_KEEP} mensagens da disciplina.
                  </>
                )}
              </p>
            )}
            {(chatSearchResults ?? messages.map((m, i) => ({ m, i }))).map(({ m, i }) => (
              <React.Fragment key={i}>
                {!chatSearchActive && daySeparators.has(i) && (
                  <ChatDayChip label={daySeparators.get(i)!} />
                )}
                {!chatSearchActive && i === firstRestoredIndex && (
                  <MemoryChip count={restoredCount} />
                )}
                <div
                  data-msg-index={i}
                  className={cn(
                    'animate-msg-in flex gap-2',
                    m.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                {m.role === 'assistant' && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Bot className={cn('size-4', m.error ? 'text-rose-400' : 'text-emerald-400')} />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                    m.role === 'user'
                      ? 'whitespace-pre-wrap rounded-tr-sm bg-gradient-to-br from-emerald-600 to-teal-600 text-white'
                      : m.error
                        ? 'rounded-tl-sm border border-rose-500/30 bg-rose-500/5 text-foreground'
                        : 'rounded-tl-sm border border-border/60 bg-muted text-foreground',
                    // t155: a bolha encontrada PULSA âmbar quando a busca
                    // chega nela — e apaga sozinha (globals, msg-flash).
                    chatFlashMsg === i && 'animate-msg-flash',
                  )}
                >
                  {m.role === 'user' ? (
                    <>
                      {chatSearchSegments.has(i) ? (
                        // t154: o trecho casado ACENDE dentro da bolha do
                        // aluno — âmbar sobre o esmeralda, texto original.
                        <p className="whitespace-pre-wrap">
                          {chatSearchSegments.get(i)!.map((seg, k) =>
                            seg.hit ? (
                              <mark
                                key={k}
                                className="rounded-sm bg-amber-300 px-0.5 text-emerald-950"
                              >
                                {seg.text}
                              </mark>
                            ) : (
                              <React.Fragment key={k}>{seg.text}</React.Fragment>
                            ),
                          )}
                        </p>
                      ) : (
                        <UserBubbleContent content={m.content} />
                      )}
                      {m.image && (
                        <button
                          type="button"
                          onClick={() => {
                            if (m.image) setLightboxSrc(m.image);
                          }}
                          aria-label="Ver o print em tamanho grande"
                          title="Ver o print em tamanho grande — o clique na imagem alterna o zoom"
                          className="group mt-2 block w-fit cursor-zoom-in overflow-hidden rounded-lg ring-offset-0 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 hover:ring-2 hover:ring-emerald-500/40"
                        >
                          <img
                            src={m.image}
                            alt="Print anexado à dúvida"
                            className="max-h-44 rounded-lg border border-white/20 transition-transform duration-150 group-hover:scale-[1.02]"
                          />
                        </button>
                      )}
                      {m.time && (
                        <p className="mt-1 text-right text-[10px] text-white/70">{m.time}</p>
                      )}
                    </>
                  ) : (
                    <>
                      {m.error ? (
                        <div className="flex items-start gap-1.5">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      ) : (
                        <TutorMarkdown content={m.content} enableCards disciplineCode={discipline.code} />
                      )}
                      {chatSearchSnippets.has(i) && (
                        // t154: onde a agulha caiu — janela com o trecho aceso
                        // (âmbar translúcido sobre o muted), reticências
                        // honestas quando a resposta foi cortada.
                        <p
                          className="mt-1.5 flex items-start gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] leading-relaxed text-muted-foreground"
                          title="Trecho onde a busca casou"
                        >
                          <Search className="mt-0.5 size-3 shrink-0 text-amber-600/80 dark:text-amber-400/80" aria-hidden />
                          <span className="min-w-0">
                            {chatSearchSnippets.get(i)!.map((seg, k) =>
                              seg.hit ? (
                                <mark
                                  key={k}
                                  className="rounded-sm bg-amber-400/25 px-0.5 font-medium text-foreground"
                                >
                                  {seg.text}
                                </mark>
                              ) : (
                                <React.Fragment key={k}>{seg.text}</React.Fragment>
                              ),
                            )}
                          </span>
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        {m.error && resolveRetryTarget(messages, i) && (
                          // t164 — A SEGUNDA CHANCE: reenvia a pergunta do par
                          // falhado, com o print se ele ainda vive na conversa.
                          // Append-only: a tentativa falhada fica no fio — o
                          // log é honesto, a casa não reescreve o passado.
                          <button
                            type="button"
                            onClick={() => {
                              const target = resolveRetryTarget(messages, i);
                              if (target) void sendQuestion(target.content, target.image ?? null);
                            }}
                            disabled={chatLoading}
                            aria-label="Tentar de novo — reenvia a pergunta que falhou"
                            title="Reenvia a sua última pergunta (com o print, se ele ainda está na conversa) — nada é apagado, a tentativa falhada continua no fio"
                            className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 transition-colors hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            <RotateCcw className="size-3" />
                            tentar de novo
                          </button>
                        )}
                        {m.time && (
                          <span className="text-[10px] text-muted-foreground/60">{m.time}</span>
                        )}
                        {m.model && (
                          <span className="text-[10px] text-muted-foreground/60">via {m.model}</span>
                        )}
                        {m.content.length > 80 && !m.error && (
                          <button
                            type="button"
                            onClick={() => copyAnswer(m.content, i)}
                            aria-label="Copiar resposta"
                            title="Copiar resposta"
                            className={cn(
                              'flex items-center gap-1 text-[10px] transition-colors',
                              copiedMsg === i
                                ? 'text-emerald-500 dark:text-emerald-400'
                                : 'text-muted-foreground/60 hover:text-foreground',
                            )}
                          >
                            {copiedMsg === i ? (
                              <Check className="size-3" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            {copiedMsg === i ? 'copiado' : 'copiar'}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              </React.Fragment>
            ))}

            {chatLoading && <ThinkingBubble />}

            {streamText !== null && (
              <div className="flex justify-start gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Bot className="size-4 text-emerald-400" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border/60 bg-muted px-3 py-2 text-sm text-foreground shadow-sm">
                  <TutorMarkdown content={streamText} enableCards disciplineCode={discipline.code} />
                  <span
                    className="mt-1 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-emerald-400 align-middle"
                    aria-hidden="true"
                  />
                </div>
              </div>
            )}

            {!chatSearchActive && messages.length <= 1 && !chatLoading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {/* Chip de INVERSÃO DE PAPEL: o tutor passa a perguntar (recall ativo).
                    Na janela da Av1 (148) o teste nasce COM O ESCOPO REAL da prova —
                    o mesmo programa que o simulado usa (fonte única). */}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-violet-400/50 bg-violet-500/10 text-xs text-violet-600 transition-colors hover:bg-violet-500/20 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
                  onClick={() =>
                    sendQuestion(
                      examBrief
                        ? buildQuizPrompt({
                            disciplineName: discipline.shortName,
                            scope: MATH_EXAM.programa,
                            count: 5,
                          })
                        : buildQuizPrompt({ disciplineName: discipline.shortName }),
                    )
                  }
                >
                  <Target className="size-3.5 text-violet-500" />{' '}
                  {examBrief ? 'Me testa — escopo da Av1' : 'Me testa — recall ativo'}
                </Button>
                {(examBrief ? EXAM_CHAT_SUGGESTIONS : CHAT_SUGGESTIONS).map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => sendQuestion(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            )}

            {/* Continuidade: follow-ups após a última resposta — o aluno segue
                falando do mesmo assunto com 1 toque, sem reexplicar a dúvida. */}
            {!chatSearchActive && !chatLoading && streamText === null && messages.length > 1 &&
              messages[messages.length - 1]?.role === 'assistant' &&
              !messages[messages.length - 1]?.error && (
                // t164: depois de erro os chips CALAM — "continuar nesse
                // assunto" sobre uma falha é convite para lugar nenhum.
                <div className="pt-1">
                  <p className="mb-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <Sparkles className="size-3 text-emerald-400" />
                    Continuar nesse assunto?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {FOLLOW_UPS.map((f) => (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => sendQuestion(f.q)}
                        className="rounded-full border border-border bg-muted/60 px-2.5 py-1.5 text-xs transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-400"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* t165 — A PILL DA VOLTA: só nasce quando o leitor subiu de
                propósito (chatFollowing=false). Sticky no rodapé do fio, a
                voz esmeralda da casa, o rótulo confessa o estado: resposta
                viva ("ao vivo") quando o tutor ainda escreve, fim da conversa
                quando o fio está em repouso. position:sticky ocupa o próprio
                lugar no fluxo — quando o follow volta, ela some e o espaço
                volta a ser do fio. */}
            {!chatFollowing && (
              <div className="sticky bottom-2 z-10 flex justify-center pt-1">
                <button
                  type="button"
                  data-testid="chat-follow-pill"
                  onClick={() => scrollThreadToBottom(true)}
                  aria-label="Descer para o fim da conversa"
                  title="Você subiu para reler — a leitura sua ficou preservada. Clique para descer ao fim e voltar a seguir a conversa."
                  className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-background/90 px-3 py-1.5 text-xs font-medium text-emerald-600 shadow-lg backdrop-blur transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-400"
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                  {chatLoading || streamText !== null
                    ? 'Descer para a resposta ao vivo'
                    : 'Descer para o fim da conversa'}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            {chatImage && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 pr-2">
                <button
                  type="button"
                  onClick={() => setLightboxSrc(chatImage)}
                  aria-label="Ver o print em tamanho grande"
                  title="Conferir o print antes de enviar — o clique na imagem alterna o zoom"
                  className="cursor-zoom-in overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 hover:ring-2 hover:ring-emerald-500/40"
                >
                  <img
                    src={chatImage}
                    alt="Prévia do print anexado"
                    className="size-12 rounded-md object-cover"
                  />
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {chatImageLabel ?? 'print anexado'}
                  </span>{' '}
                  — o tutor lê a imagem antes de responder
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setChatImage(null);
                    setChatImageLabel(null);
                  }}
                  aria-label="Remover imagem anexada"
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <input
              ref={chatFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void attachChatImage(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {/* Câmera nativa — o fallback do botão de captura onde não há
                getDisplayMedia (celular): fotografar a questão/lista impressa
                entra no MESMO tubo (downscale → anexo → morre no envio). */}
            <input
              ref={camFileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void attachChatImage(e.target.files?.[0], 'foto da câmera');
                e.target.value = '';
              }}
            />
            {/* Bloco de código — separado da mensagem (pedido do dono): cola formatado,
                vai para a IA em ```lang e volta como bloco igual ao da resposta. */}
            {codeOpen && (
              <div className="mb-2 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950 shadow-inner">
                <div className="flex items-center gap-1.5 border-b border-slate-700/60 px-2.5 py-1.5">
                  <Code2 className="size-3.5 shrink-0 text-emerald-300" aria-hidden />
                  <span className="text-[11px] font-medium text-slate-300">Bloco de código</span>
                  <span className="text-[10px] text-slate-500">· Ctrl+V cola formatado</span>
                  <div className="ml-auto flex items-center gap-0.5">
                    {(Object.keys(CODE_LANG_LABEL) as ChatCodeLang[]).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setCodeLang(l)}
                        aria-pressed={codeLang === l}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                          codeLang === l
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'text-slate-500 hover:text-slate-300',
                        )}
                      >
                        {CODE_LANG_LABEL[l]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCodeOpen(false);
                        setChatCode('');
                      }}
                      aria-label="Fechar bloco de código"
                      title="Fechar bloco de código"
                      className="ml-1 rounded p-1 text-slate-500 transition-colors hover:text-slate-200"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={chatCode}
                  onChange={(e) => setChatCode(e.target.value)}
                  onPaste={(e) => {
                    const t = e.clipboardData.getData('text/plain');
                    if (t) {
                      const d = detectCodeLang(t);
                      if (d) setCodeLang(d);
                    }
                  }}
                  rows={6}
                  spellCheck={false}
                  placeholder={'Cole seu código aqui — vai formatado para a IA\n\n#include <stdio.h>\nint main() { ... }'}
                  aria-label="Bloco de código para o tutor"
                  className="block max-h-64 w-full resize-none overflow-y-auto bg-transparent px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-100 outline-none placeholder:text-slate-600"
                />
              </div>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendQuestion(chatInput);
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => chatFileRef.current?.click()}
                disabled={chatLoading}
                aria-label="Anexar print/foto da questão"
                title="Anexar print/foto — ou cole com Ctrl+V"
              >
                <ImagePlus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'shrink-0 transition-colors',
                  capturing
                    ? 'text-emerald-500'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  // Navegador com captura de tela → recorte ao vivo. Sem
                  // getDisplayMedia (celular) → CÂMERA NATIVA: fotografar a
                  // questão vale mais que um toast de erro toda vez.
                  if (screenOk) void startCapture();
                  else camFileRef.current?.click();
                }}
                disabled={chatLoading}
                aria-pressed={screenOk ? capturing : undefined}
                aria-label={
                  screenOk
                    ? 'Capturar a tela e recortar para o tutor'
                    : 'Tirar foto da questão com a câmera e anexar ao tutor'
                }
                title={
                  capturing
                    ? 'Escolhendo a tela… clique de novo para soltar'
                    : screenOk
                      ? 'Capturar a tela — recorte a questão e anexe (nada é salvo no seu computador)'
                      : 'Sem captura de tela neste navegador — abre a câmera para fotografar a questão (nada é salvo no seu computador)'
                }
              >
                <Camera className={cn('size-4', capturing && 'animate-pulse')} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'shrink-0 transition-colors',
                  codeOpen
                    ? 'bg-emerald-500/15 text-emerald-500 hover:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  setCodeOpen((v) => !v);
                  if (codeOpen) setChatCode('');
                }}
                disabled={chatLoading}
                aria-label={codeOpen ? 'Fechar bloco de código' : 'Anexar bloco de código'}
                title="Bloco de código — cola formatado e vai para a IA assim"
                aria-pressed={codeOpen}
              >
                <Code2 className="size-4" />
              </Button>
              <textarea
                ref={chatTaRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter envia · Shift+Enter quebra a linha (padrão de chat)
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendQuestion(chatInput);
                  }
                }}
                onPaste={(e) => {
                  const f = imageFromClipboard(e);
                  if (f) {
                    e.preventDefault();
                    void attachChatImage(f, 'print colado');
                    return;
                  }
                  // Colagem de PDF rasgada (a dor do dono: "copiar e colar
                  // vai todo quebrado e ela ainda pode errar na montagem") —
                  // se o texto tem perfil de rasgo, remonta ANTES de entrar
                  // no campo. Colagem normal do aluno passa intocada.
                  const t = e.clipboardData.getData('text/plain');
                  if (t && looksFragmentedPaste(t)) {
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const pos = ta.selectionStart ?? chatInput.length;
                    const end = ta.selectionEnd ?? pos;
                    setChatInput(
                      chatInput.slice(0, pos) + normalizePdfPaste(t) + chatInput.slice(end),
                    );
                    toast.info(
                      'Colagem de PDF organizada — as linhas quebradas foram unidas para a IA ler melhor.',
                    );
                  }
                }}
                rows={1}
                placeholder="Dúvida... (Enter envia · Shift+Enter quebra linha)"
                disabled={chatLoading}
                aria-label="Sua pergunta para o tutor"
                className="min-h-[36px] flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={chatLoading || (!chatInput.trim() && !chatImage && !chatCode.trim())}
                aria-label="Enviar mensagem"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* t160: o print que se lê de novo — o MESMO data URL, só visão. */}
      <PrintLightboxDialog src={lightboxSrc} onOpenChange={(o) => !o && setLightboxSrc(null)} />

      {/* Recorte da captura de tela do chat — anexa no MESMO chatImage dos prints. */}
      <CaptureCropDialog
        canvas={captureCanvas}
        open={captureOpen}
        onOpenChange={(v) => {
          setCaptureOpen(v);
          if (!v) setCaptureCanvas(null); // auto-apagar: o frame bruto some com o diálogo
        }}
        onAttach={(image) => {
          setChatImage(image);
          setChatImageLabel('print de tela');
        }}
        onRetry={() => void startCapture()}
      />

      {/* ===== Modo Foco (Zen) — overlay tela-cheia com o timer ===== */}
      <AnimatePresence>
        {zenOpen && (
          <motion.div
            key="zen-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label="Modo foco — timer em tela cheia"
          >
            {/* Barra superior */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <DisciplineIcon name={discipline.icon} className="size-4 shrink-0 text-emerald-400" />
                <span className="truncate">
                  {discipline.shortName}
                  {selectedMaterial ? ` · ${selectedMaterial.title}` : ''}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZenOpen(false)}
                aria-label="Sair do modo foco (Esc)"
                title="Sair (Esc)"
                className="shrink-0 rounded-full"
              >
                <Minimize2 className="size-4" />
              </Button>
            </div>

            {/* Timer central */}
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10">
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-5"
              >
                <Badge variant="outline" className={cn('px-3 py-1 text-xs', PHASE_META[live.phase].badge)}>
                  {PHASE_META[live.phase].label}
                </Badge>
                <div
                  className={cn(
                    'text-[22vw] font-bold leading-none tabular-nums sm:text-[150px]',
                    PHASE_META[live.phase].text,
                    live.running && 'drop-shadow-[0_0_45px_rgba(16,185,129,0.35)]',
                  )}
                >
                  {fmtSeconds(live.secondsLeft)}
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="text-sm">
                    Ciclo {cyclePosition} de {cycleTotal}
                  </span>
                  <span className="flex items-center gap-2" aria-hidden>
                    {Array.from({ length: cycleTotal }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'size-2.5 rounded-full transition-colors duration-300',
                          i < doneInCycle
                            ? PHASE_META.focus.dot
                            : live.running
                              ? 'bg-white/25 animate-pulse'
                              : 'bg-white/15',
                        )}
                      />
                    ))}
                  </span>
                </div>
              </motion.div>

              {/* Controles (mesmos handlers do card) */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  onClick={live.running ? pauseTimer : startTimer}
                  className={cn('h-12 min-w-44 text-white', PHASE_META[live.phase].solid)}
                >
                  {live.running ? (
                    <>
                      <Pause className="size-5" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="size-5" />
                      Iniciar
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="lg" onClick={resetTimer}>
                  <RotateCcw className="size-4" />
                  Resetar
                </Button>
                <Button variant="outline" size="lg" onClick={skipPhase}>
                  <SkipForward className="size-4" />
                  Pular fase
                </Button>
              </div>

              {/* Mini-stats */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4 text-emerald-400" />
                  Hoje: <span className="font-medium text-foreground">{sp.minutesToday} min</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Timer className="size-4 text-amber-400" />
                  <span className="font-medium text-foreground">{sp.sessionsToday.length}</span>{' '}
                  sessões
                </span>
                <span className="flex items-center gap-1.5">
                  <Target className="size-4 text-teal-400" />
                  meta <span className="font-medium text-foreground">{sp.dailyGoalProgress}%</span>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
