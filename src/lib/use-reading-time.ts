'use client';

import * as React from 'react';

/**
 * useMaterialReadingTime — O HEARTBEAT DA LEITURA (Task 227, o canal material
 * da telemetria que o dono pediu: "rastrear a atividade com o material…
 * de forma suave e SEMI-AUTOMÁTICA").
 *
 * Como funciona: enquanto o leitor estiver aberto (active) e a ABA VISÍVEL,
 * um batimento a cada `stepSec` segundos banca o tempo real — o aluno não
 * marca NADA. A aba em segundo plano não conta (ler não é ter aberto); ao
 * voltar, a janela recomeça. Ao fechar o leitor, o rabo honesto: o restante
 * ≥15s desde o último batimento também entra (ler 40s registra os 40s que
 * deu, nunca menos que o fluxo provou).
 *
 * Consumers: pdf-viewer-dialog (PDF), video-player-dialog (vídeo) e
 * material-summary-dialog (resumo) — todos gravam via
 * sp.addMaterialReadingTime, que agrega por (dia, material) no readingLog.
 */
export function useMaterialReadingTime(
  active: boolean,
  materialId: string | undefined,
  onTick: (minutes: number) => void,
  stepSec = 30,
): void {
  // Refs sincronizadas EM EFEITO (react-hooks/refs — nada de ref em render):
  // os callbacks/ids vigentes são lidos pelos timers do efeito, fora do render.
  const onTickRef = React.useRef(onTick);
  const idRef = React.useRef(materialId);
  const lastBeatRef = React.useRef(0);

  React.useEffect(() => {
    onTickRef.current = onTick;
    idRef.current = materialId;
  }, [onTick, materialId]);

  React.useEffect(() => {
    if (!active || !materialId) return;
    lastBeatRef.current = Date.now();

    const beat = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const now = Date.now();
      const elapsed = (now - lastBeatRef.current) / 1000;
      // Batimento adiantado (throttle do navegador) não conta como tempo.
      if (elapsed < stepSec * 0.6) return;
      lastBeatRef.current = now;
      // Teto de 2 steps por batida — timers lentos não inventam tempo.
      onTickRef.current(Math.min(elapsed, stepSec * 2) / 60);
    };

    const timer = setInterval(beat, stepSec * 1000);
    // Volta de aba: a janela recomeça do agora (o tempo oculto não é leitura).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') lastBeatRef.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      // O RABO HONESTO: restante ≥15s desde o último batimento entra também —
      // só com a aba visível (fechar a aba por cima não prova leitura).
      const elapsed = (Date.now() - lastBeatRef.current) / 1000;
      const visible =
        typeof document === 'undefined' || document.visibilityState === 'visible';
      if (idRef.current && visible && elapsed >= 15) {
        onTickRef.current(Math.min(elapsed, stepSec * 2) / 60);
      }
    };
  }, [active, materialId, stepSec]);
}
