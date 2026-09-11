'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Send,
  SkipForward,
  Sparkles,
  Target,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Input } from '@/components/ui/input';
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
import { getDisciplineTopics } from '@/lib/study-topics';
import { buildHubContext } from '@/lib/tutor-context';
import { cn } from '@/lib/utils';
import { TutorMarkdown } from './tutor-markdown';

// ---------- Tipos locais ----------

type Phase = PomodoroState['phase'];
type SessionSummary = NonNullable<PomodoroState['lastSessionSummary']>;
type PomodoroConfig = { focus: number; shortBreak: number; longBreak: number; cyclesBeforeLong: number };

interface LiveTimer {
  phase: Phase;
  secondsLeft: number;
  running: boolean;
  cycleCount: number; // nº de focos completados
  runningSince?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Modelo free que gerou a resposta (OpenRouter) — exibido discretamente. */
  model?: string;
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
  calendar: 'Calendário',
};

const CHAT_SUGGESTIONS = [
  'Explique o tópico atual',
  'Dê um exemplo prático',
  'Quando é a próxima prova?',
  'Como está meu progresso?',
];

/** Contexto real do app enviado ao tutor — implementação única em @/lib/tutor-context. */

const APP_BASE_TITLE = 'Hub de Estudos • IFPB ADS 2026.2';

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

function buildWelcome(shortName: string): string {
  return `Olá! Sou o tutor IA de ${shortName}. 🤖\n\nConheço **seu progresso**, o **calendário do semestre** e os **materiais do Hub** — posso explicar o tópico atual, dar exemplos com código, lembrar as datas das provas ou responder o que você precisar. Toque em uma sugestão ou digite sua dúvida.`;
}

// ---------- Componente ----------

export function StudyView({
  initialDiscipline,
  initialMaterial,
}: {
  initialDiscipline?: string;
  initialMaterial?: string;
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
      ),
    },
  ]);
  const [chatInput, setChatInput] = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);

  // ----- Derivados -----
  const discipline = getDisciplineByCode(disciplineCode) ?? disciplines[0];
  const disciplineShortName = discipline.shortName;
  const materials = React.useMemo(
    () => getMaterialsByDiscipline(disciplineCode),
    [disciplineCode],
  );
  const selectedMaterial = materials.find((m) => m.id === materialId);
  const topicsSummary = React.useMemo(
    () => getDisciplineTopics(disciplineCode, sp.progress.topicProgress),
    [disciplineCode, sp.progress.topicProgress],
  );
  const colors = getColorClasses(discipline.color);
  const chatTopic = topicsSummary?.nextTopic ?? 'geral';

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
  const bannerInitRef = React.useRef(false);
  const messagesRef = React.useRef<HTMLDivElement>(null);

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
      const state: PomodoroState = {
        disciplineCode: ctx.disciplineCode,
        materialId: ctx.materialId || undefined,
        phase: l.phase,
        cycleCount: l.cycleCount,
        secondsLeft: l.secondsLeft,
        running: l.running,
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

  // Tick de 1s enquanto roda (nunca inicia no server — só em useEffect).
  React.useEffect(() => {
    if (!live.running) return;
    const id = window.setInterval(() => {
      setLive((prev) => {
        if (!prev.running) return prev;
        const next = prev.secondsLeft - 1;
        return next <= 0 ? { ...prev, secondsLeft: 0 } : { ...prev, secondsLeft: next };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [live.running]);

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

  // Auto-pausar quando a aba vai para segundo plano (o usuário não quer timer escondido).
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && liveRef.current.running) {
        pauseCurrent();
        toast('Timer pausado', {
          description: 'A aba ficou em segundo plano — continue quando voltar.',
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pauseCurrent]);

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
    setLive(next);
    persistNow(next);
  };

  const pauseTimer = () => {
    if (!live.running) return;
    interactedRef.current = true;
    const next: LiveTimer = { ...live, running: false, runningSince: undefined };
    setLive(next);
    persistNow(next);
  };

  const resetTimer = () => {
    interactedRef.current = true;
    focusStartedAtRef.current = null;
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
    setMessages([{ role: 'assistant', content: buildWelcome(disciplineShortName) }]);
    setChatLoading(false);
  }, [disciplineShortName]);

  // Auto-scroll do chat
  React.useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, chatLoading, chatOpen]);

  const sendQuestion = async (question: string) => {
    const q = question.trim();
    if (!q || chatLoading) return;
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          discipline: discipline.name,
          topic: chatTopic,
          material: selectedMaterial?.title,
          history,
          hubContext: buildHubContext(disciplineCode, sp),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        answer?: string;
        model?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || `Erro ${res.status} ao consultar o tutor`);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data?.answer ?? 'O tutor não retornou resposta.',
          model: data?.model,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível consultar o tutor agora.');
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: buildWelcome(disciplineShortName) }]);
    setChatInput('');
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
                    return (
                      <div key={unit.name} className="rounded-xl border border-white/10 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h4 className="text-sm font-medium leading-snug">{unit.name}</h4>
                          <Badge
                            variant="outline"
                            className={cn(
                              unit.done && 'border-emerald-500/40 text-emerald-400',
                            )}
                          >
                            {unitDone}/{unit.topics.length}
                          </Badge>
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

      {/* ===== Chat IA lateral ===== */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
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
              </div>
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

          <div
            ref={messagesRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin]"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2',
                  m.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {m.role === 'assistant' && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Bot className="size-4 text-emerald-400" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'whitespace-pre-wrap bg-emerald-600 text-white'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {m.role === 'user' ? m.content : <TutorMarkdown content={m.content} />}
                  {m.role === 'assistant' && m.model && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground/60">via {m.model}</p>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Loader2 className="size-4 animate-spin text-emerald-400" />
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Pensando...
                </div>
              </div>
            )}

            {messages.length <= 1 && !chatLoading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {CHAT_SUGGESTIONS.map((s) => (
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
          </div>

          <div className="border-t border-white/10 p-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendQuestion(chatInput);
              }}
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Digite sua dúvida..."
                disabled={chatLoading}
                aria-label="Sua pergunta para o tutor"
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={chatLoading || !chatInput.trim()}
                aria-label="Enviar mensagem"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

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
