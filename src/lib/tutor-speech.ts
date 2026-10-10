'use client';

// Ouvir resposta — Web Speech API nativa do navegador (voz pt-BR do sistema).
// Instantânea, offline e sem custo: cobre todos os navegadores reais.
// (O antigo fallback de voz IA via /api/tts foi REMOVIDO — não existia em
// produção e só poluía o console com 503.)
//
// O texto passa por limpeza: blocos de código e LaTeX viram fala aceitável
// em vez de símbolos lidos literalmente (\frac{1}{2} etc.).

import * as React from 'react';

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

export function useTutorSpeech() {
  const [speakingId, setSpeakingId] = React.useState<number | null>(null);
  // mantido na interface por compatibilidade (voz nativa é instantânea — sempre null)
  const preparingId: number | null = null;
  const abortRef = React.useRef(false);
  const activeIdRef = React.useRef<number | null>(null);

  const nativeSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const supported = nativeSupported;

  // fecha a fala ao desmontar (trocar de aba/disciplina não deixa a voz rolando)
  React.useEffect(() => {
    return () => {
      abortRef.current = true;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = React.useCallback(() => {
    abortRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    activeIdRef.current = null;
    setSpeakingId(null);
  }, []);

  /** Voz nativa do navegador. Erros assíncronos apenas resetam o estado —
   *  sem fallback de servidor (removido). */
  const toggle = React.useCallback(
    (id: number, rawText: string) => {
      if (speakingId === id) {
        stop();
        return;
      }
      stop();
      abortRef.current = false;
      const text = toSpeakable(rawText);
      if (!text || !nativeSupported) return;
      try {
        const synth = window.speechSynthesis;
        const hadOngoing = synth.speaking || synth.pending;
        if (hadOngoing) synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? 'pt-BR';
        u.rate = 1.05;
        u.pitch = 1;
        u.onend = () => {
          if (activeIdRef.current === id) {
            activeIdRef.current = null;
            setSpeakingId(null);
          }
        };
        u.onerror = (ev) => {
          if (activeIdRef.current === id) {
            activeIdRef.current = null;
            setSpeakingId(null);
          }
          // 'interrupted'/'canceled' vêm do nosso próprio cancel() — não é falha
          const kind = (ev as SpeechSynthesisErrorEvent)?.error;
          if (kind && kind !== 'interrupted' && kind !== 'canceled' && !abortRef.current) {
            // voz nativa falhou de verdade — segue sem áudio, silenciosamente
          }
        };
        const doSpeak = () => {
          activeIdRef.current = id;
          setSpeakingId(id);
          synth.speak(u);
        };
        // CUIDADO Chrome: speak() no MESMO tick de cancel() engole a fala —
        // só cancelamos se algo está tocando, e nesse caso falamos 150ms depois.
        if (hadOngoing) window.setTimeout(doSpeak, 150);
        else doSpeak();
      } catch {
        // navegador sem suporte real — botão apenas não fala
        activeIdRef.current = null;
        setSpeakingId(null);
      }
    },
    [speakingId, stop, nativeSupported],
  );

  return { speakingId, preparingId, toggle, supported };
}
