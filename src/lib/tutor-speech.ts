'use client';

// Ouvir resposta — DUAS ENGENHARIAS em cascata:
//  1. Web Speech API nativa (instantânea, offline, voz do sistema);
//  2. fallback SERVIDOR (/api/tts — voz IA) quando a nativa falha, é muda
//     ou não existe: o botão nunca deixa de funcionar sem explicação.
// O texto passa por limpeza: blocos de código e LaTeX viram fala aceitável
// em vez de símbolos lidos literalmente (\frac{1}{2} etc.).

import * as React from 'react';
import { toast } from 'sonner';

/** Converte a resposta (markdown + LaTeX + código) em texto falável. */
function toSpeakable(raw: string): string {
  let t = raw;
  // blocos de código → aviso falado (ler código em voz alta não ajuda ninguém)
  t = t.replace(/```[\s\S]*?```/g, ' (trecho de código) ');
  // LaTeX inline e display: remove comandos e chaves, mantém números/letras
  t = t.replace(/\$\$[\s\S]*?\$\$/g, (m) => cleanLatex(m));
  t = t.replace(/\$[^$\n]+\$/g, (m) => cleanLatex(m));
  function cleanLatex(m: string): string {
    return m
      .replace(/\\frac\s*/g, ' fração ')
      .replace(/\\sqrt\s*/g, ' raiz de ')
      .replace(/\\cdot|\\times/g, ' vezes ')
      .replace(/\\pm/g, ' mais ou menos ')
      .replace(/\\begin\{[a-z]*\}|\\end\{[a-z]*\}/g, ' ')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}$_^_&]/g, ' ')
      .replace(/\\\\/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // markdown: cabeçalhos, negrito/itálico, links, listas, citações
  t = t.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  t = t.replace(/^>\s?/gm, '');
  t = t.replace(/^[-*+]\s+/gm, '');
  // emojis/símbolos decorativos e restos
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
  t = t.replace(/`([^`]+)`/g, '$1');
  return t.replace(/\n{2,}/g, '. ').replace(/\s+/g, ' ').trim();
}

/** Escolhe a melhor voz pt-BR disponível (fallback: qualquer voz padrão). */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang?.toLowerCase() === 'pt-br') ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('pt')) ??
    null
  );
}

// ----- Engenharia 2: voz IA do servidor (/api/tts, um wav por chunk) -----

const SERVER_CHUNK_MAX = 900; // o API aceita 1024 por pedido — margem de segurança
const SERVER_CHUNKS_MAX = 3; // custo/latência limitados (≈2700 caracteres)

/** Divide o texto falável em pedaços por frase (≤ SERVER_CHUNK_MAX). */
function chunkSpeakable(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: string[] = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) {
      chunks.push(cur.trim());
      cur = '';
    }
  };
  for (const s0 of sentences) {
    let s = s0;
    while (s.length > SERVER_CHUNK_MAX) {
      push();
      chunks.push(s.slice(0, SERVER_CHUNK_MAX).trim());
      s = s.slice(SERVER_CHUNK_MAX);
    }
    if ((cur + s).length <= SERVER_CHUNK_MAX) cur += s;
    else {
      push();
      cur = s;
    }
  }
  push();
  return chunks.filter(Boolean);
}

export function useTutorSpeech() {
  const [speakingId, setSpeakingId] = React.useState<number | null>(null);
  const [preparingId, setPreparingId] = React.useState<number | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const abortRef = React.useRef(false);
  const activeIdRef = React.useRef<number | null>(null);

  const nativeSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  // O botão existe sempre: há SEMPRE uma engenharia disponível (nativa OU voz IA).
  const supported = true;

  // fecha a fala ao desmontar (trocar de aba/disciplina não deixa a voz rolando)
  React.useEffect(() => {
    return () => {
      abortRef.current = true;
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = React.useCallback(() => {
    abortRef.current = true;
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    activeIdRef.current = null;
    setSpeakingId(null);
    setPreparingId(null);
  }, []);

  /** Voz IA do servidor: gera e toca os chunks em fila (feedback visível). */
  const startServerSpeech = React.useCallback(async (id: number, text: string) => {
    const chunks = chunkSpeakable(text).slice(0, SERVER_CHUNKS_MAX);
    if (chunks.length === 0) return;
    setPreparingId(id);
    try {
      for (const chunk of chunks) {
        if (abortRef.current) return;
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `Falha ${res.status} ao gerar o áudio.`);
        }
        if (abortRef.current) return;
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        setPreparingId(null);
        setSpeakingId(id);
        try {
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error('O áudio foi interrompido.'));
          });
        } finally {
          URL.revokeObjectURL(url);
        }
        if (abortRef.current) return;
      }
      if (!abortRef.current) {
        activeIdRef.current = null;
        setSpeakingId(null);
      }
    } catch (e) {
      if (!abortRef.current) {
        toast.error(e instanceof Error ? e.message : 'Não consegui gerar o áudio agora.');
        activeIdRef.current = null;
        setSpeakingId(null);
        setPreparingId(null);
      }
    }
  }, []);

  /** Voz nativa: retorna false se nem conseguiu começar. Erro assíncrono
   *  (voz ausente etc.) dispara o fallback do servidor dentro do onerror. */
  const startNativeSpeech = React.useCallback(
    (id: number, text: string): boolean => {
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? 'pt-BR';
        u.rate = 1.05;
        u.pitch = 1;
        let finished = false;
        u.onend = () => {
          finished = true;
          if (activeIdRef.current === id) {
            activeIdRef.current = null;
            setSpeakingId(null);
          }
        };
        u.onerror = (ev) => {
          finished = true;
          if (activeIdRef.current === id) {
            activeIdRef.current = null;
            setSpeakingId(null);
          }
          const kind = (ev as SpeechSynthesisErrorEvent)?.error;
          // 'interrupted'/'canceled' vêm do nosso próprio cancel() — não é falha
          if (kind !== 'interrupted' && kind !== 'canceled' && !abortRef.current) {
            void startServerSpeech(id, text);
          }
        };
        activeIdRef.current = id;
        setSpeakingId(id);
        synth.speak(u);
        // Watchdog: alguns navegadores falham EM SILÊNCIO (nenhum onerror) —
        // se após 2,5s nada estiver tocando, cai para a voz do servidor.
        window.setTimeout(() => {
          if (
            !finished &&
            activeIdRef.current === id &&
            !abortRef.current &&
            !synth.speaking &&
            !synth.pending
          ) {
            activeIdRef.current = null;
            setSpeakingId(null);
            void startServerSpeech(id, text);
          }
        }, 2500);
        return true;
      } catch {
        return false;
      }
    },
    [startServerSpeech],
  );

  const toggle = React.useCallback(
    (id: number, rawText: string) => {
      if (speakingId === id || preparingId === id) {
        stop();
        return;
      }
      stop();
      abortRef.current = false;
      const text = toSpeakable(rawText);
      if (!text) return;
      if (nativeSupported && startNativeSpeech(id, text)) return;
      void startServerSpeech(id, text);
    },
    [speakingId, preparingId, stop, nativeSupported, startNativeSpeech, startServerSpeech],
  );

  return { speakingId, preparingId, toggle, supported };
}
