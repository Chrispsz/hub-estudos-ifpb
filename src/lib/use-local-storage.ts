'use client';

import * as React from 'react';

/**
 * Hook genérico de persistência em localStorage.
 * - SSR-safe: sempre renderiza com `initialValue` no primeiro render (evita
 *   hydration mismatch). O valor salvo só é lido após a montagem no cliente.
 * - Sincroniza mudanças no localStorage.
 * - Sincroniza TODAS as instâncias que usam a mesma chave:
 *   (a) entre abas/janelas (storage event nativo)
 *   (b) na MESMA aba (dispatch manual de StorageEvent ao escrever)
 *   com guard anti-loop (não reescreve nem re-aplica valor idêntico).
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = React.useState<T>(initialValue);
  const [hydrated, setHydrated] = React.useState(false);

  // Lê o valor salvo apenas no cliente, após hidratação.
  React.useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item != null) {
        setValue(JSON.parse(item) as T);
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, [key]);

  // Persiste mudanças (somente após hidratação para não sobrescrever valor salvo).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const serialized = JSON.stringify(value);
      const existing = window.localStorage.getItem(key);
      if (serialized === existing) return; // nada mudou — evita write/dispatch redundante
      window.localStorage.setItem(key, serialized);
      // dispara storage event manual para sincronizar outras instâncias na mesma aba
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue: serialized,
        }),
      );
    } catch {
      // ignore write errors (quota exceeded, etc.)
    }
  }, [key, value, hydrated]);

  // Sincroniza entre abas/janelas E entre instâncias na mesma aba.
  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== key || e.newValue == null) return;
      const incoming = e.newValue;
      setValue((prev) => {
        try {
          // Guard anti-loop: se já estamos com esse valor, mantém a referência
          // (evita re-render e re-write desnecessários).
          if (JSON.stringify(prev) === incoming) return prev;
          return JSON.parse(incoming) as T;
        } catch {
          return prev;
        }
      });
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const update = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) =>
        typeof next === 'function' ? (next as (prev: T) => T)(prev) : next,
      );
    },
    [],
  );

  return [value, update];
}

/**
 * Lê um valor do localStorage (ou retorna o default).
 * Útil em código não-componente.
 */
export function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Escreve um valor no localStorage e sincroniza instâncias na mesma aba.
 */
export function writeLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    // dispara storage event manual para sincronizar hooks na mesma aba
    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue: JSON.stringify(value),
      }),
    );
  } catch {
    // ignore
  }
}
