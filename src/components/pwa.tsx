'use client';

// PWA — registra o service worker e expõe o prompt de instalação nativo.
// O evento beforeinstallprompt é capturado uma única vez e guardado num
// evento global (`hub:pwa-install-available`) para a UI em Configurações.

import * as React from 'react';

export function PwaRegister() {
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Captura o prompt de instalação o mais cedo possível
    function onPrompt(e: Event) {
      e.preventDefault();
      (window as any).__hubInstallPrompt = e;
      window.dispatchEvent(new Event('hub:pwa-install-available'));
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => {
      (window as any).__hubInstallPrompt = null;
      window.dispatchEvent(new Event('hub:pwa-installed'));
    });

    // Registro tolerante: se falhar (ex.: dev instável), não derruba o app
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* silencioso — PWA é progressive enhancement */
    });

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  return null;
}

/** Retorna [podeInstalar, instalar]. Instalar resolve true se o usuário aceitou. */
export function usePwaInstall(): [boolean, () => Promise<boolean>] {
  const [available, setAvailable] = React.useState(false);

  React.useEffect(() => {
    const check = () =>
      setAvailable(!!(window as any).__hubInstallPrompt);
    check();
    window.addEventListener('hub:pwa-install-available', check);
    window.addEventListener('hub:pwa-installed', () => setAvailable(false));
    return () => {
      window.removeEventListener('hub:pwa-install-available', check);
    };
  }, []);

  const install = React.useCallback(async () => {
    const prompt = (window as any).__hubInstallPrompt;
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      (window as any).__hubInstallPrompt = null;
      setAvailable(false);
      return true;
    }
    return false;
  }, []);

  return [available, install];
}
