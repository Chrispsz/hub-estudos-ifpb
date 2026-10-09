'use client';

// Modo Foco — navegação simples do Hub.
// Esconde as abas de apoio (Método/Cronograma/Progresso) atrás do botão "Mais",
// deixando na frente só o que serve ao estudo do dia a dia (Visão Geral, Estudar,
// Biblioteca, Praticar, Configurações). NADA é removido: um toque em "Mais" (ou
// no Switch das Configurações) traz tudo de volta. Preferência vive no localStorage.

import * as React from 'react';

const KEY = 'hub:focus-mode';

/** Evento custom para a sidebar reagir na hora em que o Switch muda. */
export const FOCUS_MODE_EVENT = 'hub:focus-mode-changed';

/** Lê a preferência salva. Sem preferência = ligado (site mais simples por padrão). */
export function getFocusMode(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

/** Salva a preferência e avisa a sidebar via evento custom (mesma aba). */
export function setFocusMode(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // localStorage bloqueado — segue sem persistir (modo fica só na sessão)
  }
  window.dispatchEvent(new CustomEvent(FOCUS_MODE_EVENT, { detail: on }));
}

/** Hook reativo: [modoFoco, setModoFoco]. Sincroniza sidebar ↔ Configurações. */
export function useFocusMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = React.useState(true);

  React.useEffect(() => {
    setOn(getFocusMode());
    const sync = (e: Event) => setOn((e as CustomEvent<boolean>).detail);
    window.addEventListener(FOCUS_MODE_EVENT, sync);
    window.addEventListener('storage', (e) => {
      if (e.key === KEY && e.newValue !== null) setOn(e.newValue === '1');
    });
    return () => window.removeEventListener(FOCUS_MODE_EVENT, sync);
  }, []);

  const update = React.useCallback((v: boolean) => {
    setOn(v);
    setFocusMode(v);
  }, []);

  return [on, update];
}
