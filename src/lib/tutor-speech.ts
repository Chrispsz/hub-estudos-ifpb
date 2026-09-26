'use client';

// Ouvir resposta — síntese de voz nativa do navegador (Web Speech API).
// Sem API, sem custo, funciona offline. Voz pt-BR quando disponível.
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
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // fecha a fala ao desmontar (trocar de aba/disciplina não deixa a voz rolando)
  React.useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = React.useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const toggle = React.useCallback(
    (id: number, rawText: string) => {
      if (!supported) return;
      if (speakingId === id) {
        stop();
        return;
      }
      window.speechSynthesis.cancel();
      const text = toSpeakable(rawText);
      if (!text) return;
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'pt-BR';
      u.rate = 1.05;
      u.pitch = 1;
      u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
      u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
      setSpeakingId(id);
      window.speechSynthesis.speak(u);
    },
    [speakingId, stop, supported],
  );

  return { speakingId, toggle, supported };
}
