'use client';

// pomodoro-engine.tsx — O MOTOR DO FOCO ELEVADO A CASA (mandato do dono,
// 10/10/2026: "abrir os materiais na IA, integração total, sem pomodoro solto,
// fluxo perfeito — pensar como um humano usaria a ferramenta").
//
// Por que existe: o Pomodoro vivia DENTRO da aba Estudar — trocar de aba PAUSAVA
// o foco (unmount pausava e salvava), o leitor aberto da Biblioteca não tinha
// timer nenhum, e estudar exigia configurar selects antes de qualquer gesto.
// O motor agora vive ACIMA das abas (provider no page.tsx): o foco atravessa a
// casa — começa no leitor, sobrevive à troca de aba, registra a sessão sozinho
// ao completar. O Pomodoro deixa de ser um lugar e vira uma condição do estudo.
//
// Contratos preservados EXATAMENTE (o estado do dono é precioso):
//   • PomodoroState persistido via updatePomodoroState (mesma forma, mesmos
//     campos, endsAt como fonte da verdade quando rodando);
//   • addPomodoroSession ao completar um foco (+ no retorno que completou fora);
//   • banner de continuidade (<24h) com desconto de tempo corrido;
//   • tick por relógio de parede + Web Worker anti-throttle + persist 5s;
//   • "Rodar em outra guia" (visibilitychange) e título da aba;
//   • beep duplo + notificação nativa ao virar a fase.
// Única mudança de comportamento, e ela é O PONTO: NADA pausa mais quando a
// aba Estudar desmonta — trocar de aba não interrompe quem está estudando.

import * as React from 'react';
import { toast } from 'sonner';
import { disciplines } from '@/data/course-data';
import { type PomodoroState, type StudyProgressHook } from '@/lib/study-progress';
import { getDisciplineTopics } from '@/lib/study-topics';

// ---------- Tipos públicos do motor ----------

export type Phase = PomodoroState['phase'];
export type SessionSummary = NonNullable<PomodoroState['lastSessionSummary']>;
export type PomodoroConfig = {
  focus: number;
  shortBreak: number;
  longBreak: number;
  cyclesBeforeLong: number;
};

export interface LiveTimer {
  phase: Phase;
  secondsLeft: number;
  running: boolean;
  cycleCount: number; // nº de focos completados
  /** Epoch (ms) do fim da fase — o relógio REAL. Definido ao rodar: a contagem
   *  deriva dele, então fica correta mesmo com a aba em segundo plano. */
  endsAt?: number;
  runningSince?: string;
}

export interface BannerSnapshot {
  saved: PomodoroState;
  agoMin: number;
}

// ---------- Constantes / helpers (módulo) ----------

export const PHASE_META: Record<
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

export const APP_BASE_TITLE = 'Hub de Estudos • IFPB ADS — Turma 2026.2';

/** Segundos restantes reais a partir do epoch do fim da fase. */
export function remainingFromEndsAt(endsAt: number): number {
  return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
}

export function fmtSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

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

// ---------- O motor ----------

export interface StudyFocusValue {
  /** Par disciplina/material amarrado ao foco (registro da sessão + markAccessed). */
  sel: { disciplineCode: string; materialId: string };
  live: LiveTimer;
  cfg: PomodoroConfig;
  durations: Record<Phase, number>;
  summary: SessionSummary | null;
  banner: BannerSnapshot | null;
  /** A aba Estudar sincroniza a seleção da UI com o registro do foco. */
  bind: (disciplineCode: string, materialId: string) => void;
  /** Troca de disciplina na UI: reinicia o foco e persiste sob o novo código. */
  changeDiscipline: (code: string) => void;
  /** O gesto do FLUXO (chip do leitor): amarra o material e põe o foco a rodar.
   *  Foco parado no meio → retoma de onde parou; pausa em curso → troca para
   *  foco cheio (o ciclo preservado). Rodando → não faz nada (o chip mostra o tempo). */
  focusMaterial: (disciplineCode: string, materialId: string) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  skipPhase: () => void;
  dismissSummary: () => void;
  continueFromBanner: () => void;
  discardBanner: () => void;
}

const StudyFocusContext = React.createContext<StudyFocusValue | null>(null);

/** Consumidor seguro: null fora do provider (superfícies sem casa de foco funcionam iguais). */
export function useStudyFocus(): StudyFocusValue | null {
  return React.useContext(StudyFocusContext);
}

export function StudyFocusProvider({
  sp,
  children,
}: {
  sp: StudyProgressHook;
  children: React.ReactNode;
}) {
  // ----- O par amarrado ao foco (registro da sessão) -----
  const [sel, setSelState] = React.useState<{ disciplineCode: string; materialId: string }>({
    disciplineCode: disciplines[0].code,
    materialId: '',
  });
  const selRef = React.useRef(sel);
  const setSel = React.useCallback((next: { disciplineCode: string; materialId: string }) => {
    setSelState((prev) =>
      prev.disciplineCode === next.disciplineCode && prev.materialId === next.materialId
        ? prev
        : next,
    );
    selRef.current = next;
  }, []);

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

  // Tópicos da disciplina amarrada (entram no resumo da sessão — mesma fonte da casa)
  const topicsSummary = React.useMemo(
    () => getDisciplineTopics(sel.disciplineCode, sp.progress.topicProgress),
    [sel.disciplineCode, sp.progress.topicProgress],
  );

  // ----- Refs -----
  const liveRef = React.useRef(live);
  const silentModeRef = React.useRef(!sp.progress.preferences.silentMode);
  /** "Rodar em outra guia" — espelho em ref para uso dentro de listeners. */
  const backgroundTimerRef = React.useRef(sp.progress.preferences.backgroundTimer !== false);
  React.useEffect(() => {
    silentModeRef.current = !sp.progress.preferences.silentMode;
    backgroundTimerRef.current = sp.progress.preferences.backgroundTimer !== false;
  });
  const ctxRef = React.useRef({ sp, cfg, durations, summary, topicsSummary });
  const interactedRef = React.useRef(false); // só persiste depois da 1ª interação
  const focusStartedAtRef = React.useRef<string | null>(null);
  // Fim da fase como timestamp (Date.now) — fonte da verdade quando rodando.
  const endTimeRef = React.useRef<number | null>(null);
  const bannerInitRef = React.useRef(false);

  // Sincroniza refs a cada render (para uso em intervals/listeners/cleanup)
  React.useEffect(() => {
    liveRef.current = live;
  });
  React.useEffect(() => {
    ctxRef.current = { sp, cfg, durations, summary, topicsSummary };
  });

  // Alinha a duração com a config real (frente 10 — a duração mudou no fluxo):
  //   • ocioso sentado no CHEIO da config anterior → segue a nova duração
  //     (mudar para 50min tem que mostar 50:00, não 25:00 velho);
  //   • ocioso no meio de uma fase (pausado) → o resto preservado é o gesto
  //     honesto — a fase em curso termina como está (a nota do menu confessa);
  //   • rodando → nada toca (o endsAt é a fonte da verdade).
  const lastDurationsRef = React.useRef(durations);
  React.useEffect(() => {
    const prevD = lastDurationsRef.current;
    lastDurationsRef.current = durations;
    setLive((prev) => {
      if (prev.running) return prev;
      const full = durations[prev.phase];
      if (prev.secondsLeft === full) return prev;
      const oldFull = prevD[prev.phase];
      if (prev.secondsLeft === oldFull) return { ...prev, secondsLeft: full };
      return prev;
    });
  }, [durations]);

  // Banner de continuidade: lê o pomodoroState persistido uma única vez por load
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
      // O par salvo volta a ser o par do motor — o registro segue o retorno.
      setSel({ disciplineCode: saved.disciplineCode, materialId: saved.materialId ?? '' });
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
        disciplineCode: selRef.current.disciplineCode,
        materialId: selRef.current.materialId || undefined,
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
        disciplines.find((d) => d.code === selRef.current.disciplineCode)?.shortName ?? 'estudos',
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
        disciplineId: selRef.current.disciplineCode,
        materialId: selRef.current.materialId || undefined,
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

  // NOTA (o coração do fluxo): NÃO há mais efeito de unmount — trocar de aba
  // NÃO pausa o foco. O motor vive acima das abas; quem estuda atravessa a casa.

  // ----- Ações do timer (botões) -----
  const startTimer = React.useCallback(() => {
    const l = liveRef.current;
    interactedRef.current = true;
    setBanner(null);
    const nowIso = new Date().toISOString();
    if (l.phase === 'focus') {
      if (!focusStartedAtRef.current) focusStartedAtRef.current = nowIso;
      if (selRef.current.materialId) sp.markAccessed(selRef.current.materialId);
    }
    const next: LiveTimer = { ...l, running: true, runningSince: nowIso };
    endTimeRef.current = Date.now() + next.secondsLeft * 1000;
    setLive(next);
    persistNow(next);
  }, [sp, persistNow]);

  const pauseTimer = React.useCallback(() => {
    const l = liveRef.current;
    if (!l.running) return;
    interactedRef.current = true;
    endTimeRef.current = null;
    const next: LiveTimer = { ...l, running: false, runningSince: undefined };
    setLive(next);
    persistNow(next);
  }, [persistNow]);

  const resetTimer = React.useCallback(() => {
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
  }, [durations.focus, persistNow]);

  const skipPhase = React.useCallback(() => {
    interactedRef.current = true;
    focusStartedAtRef.current = null;
    endTimeRef.current = null;
    const nextPhase: Phase = liveRef.current.phase === 'focus' ? 'shortBreak' : 'focus';
    const next: LiveTimer = {
      phase: nextPhase,
      secondsLeft: durations[nextPhase],
      running: false,
      cycleCount: liveRef.current.cycleCount,
      runningSince: undefined,
    };
    setLive(next);
    persistNow(next);
  }, [durations, persistNow]);

  /** Troca de disciplina na UI: reinicia o foco e persiste sob o novo código
   *  (a mesma forma de sempre — sem materialId no estado salvo). */
  const changeDiscipline = React.useCallback(
    (code: string) => {
      focusStartedAtRef.current = null;
      endTimeRef.current = null;
      setBanner(null);
      const next: LiveTimer = {
        phase: 'focus',
        secondsLeft: durations.focus,
        running: false,
        cycleCount: 0,
        runningSince: undefined,
      };
      setLive(next);
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
      setSel({ disciplineCode: code, materialId: '' });
    },
    [durations.focus, sp, summary],
  );

  /** O gesto do FLUXO: amarra o material e põe o foco a rodar (chip do leitor). */
  const focusMaterial = React.useCallback(
    (code: string, mid: string) => {
      const l = liveRef.current;
      if (l.running) return; // o chip só chama parado — guard honesto
      interactedRef.current = true;
      setBanner(null);
      setSel({ disciplineCode: code, materialId: mid });
      const nowIso = new Date().toISOString();
      let next: LiveTimer;
      if (l.phase === 'focus') {
        // Foco parado no meio? Retomar de onde parou é o gesto honesto.
        next = { ...l, running: true, runningSince: nowIso };
        if (!focusStartedAtRef.current) focusStartedAtRef.current = nowIso;
      } else {
        // Pausa em curso? A leitura pediu foco — troca para foco cheio (ciclo preservado).
        next = {
          phase: 'focus',
          secondsLeft: durations.focus,
          running: true,
          cycleCount: l.cycleCount,
          runningSince: nowIso,
        };
        focusStartedAtRef.current = nowIso;
      }
      if (mid) sp.markAccessed(mid);
      endTimeRef.current = Date.now() + next.secondsLeft * 1000;
      setLive(next);
      persistNow(next);
    },
    [durations.focus, sp, persistNow],
  );

  // ----- Banner de continuidade -----
  const continueFromBanner = React.useCallback(() => {
    const b = banner;
    if (!b) return;
    const saved = b.saved;
    interactedRef.current = true;
    focusStartedAtRef.current = null;

    setSel({
      disciplineCode: saved.disciplineCode,
      materialId: saved.materialId ?? '',
    });

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
  }, [banner, cfg.focus, cfg.cyclesBeforeLong, durations, sp, topicsSummary, persistNow]);

  const discardBanner = React.useCallback(() => {
    setBanner(null);
    sp.updatePomodoroState(null);
  }, [sp]);

  const dismissSummary = React.useCallback(() => {
    setSummary(null);
    if (banner) {
      // Remove só o resumo do estado salvo, preservando a sessão do banner.
      sp.updatePomodoroState({ ...banner.saved, lastSessionSummary: undefined });
    } else if (interactedRef.current) {
      persistNow(liveRef.current, null);
    }
  }, [banner, sp, persistNow]);

  /** A aba Estudar sincroniza a seleção da UI com o registro do foco. */
  const bind = React.useCallback(
    (code: string, mid: string) => {
      setSel({ disciplineCode: code, materialId: mid });
    },
    [setSel],
  );

  const value = React.useMemo<StudyFocusValue>(
    () => ({
      sel,
      live,
      cfg,
      durations,
      summary,
      banner,
      bind,
      changeDiscipline,
      focusMaterial,
      startTimer,
      pauseTimer,
      resetTimer,
      skipPhase,
      dismissSummary,
      continueFromBanner,
      discardBanner,
    }),
    [
      sel,
      live,
      cfg,
      durations,
      summary,
      banner,
      bind,
      changeDiscipline,
      focusMaterial,
      startTimer,
      pauseTimer,
      resetTimer,
      skipPhase,
      dismissSummary,
      continueFromBanner,
      discardBanner,
      setSel,
    ],
  );

  return <StudyFocusContext.Provider value={value}>{children}</StudyFocusContext.Provider>;
}
