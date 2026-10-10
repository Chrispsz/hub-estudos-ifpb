'use client';

// CaptureTidyBanner — O AVISO DE ARRUMAÇÃO (t181).
//
// O dono viu o overlay da própria captura dentro do print (t152 → 181): o
// seletor do navegador morre DEPOIS que o stream começa, e a régua antiga
// podia congelar o frame no meio de um fade quase imperceptível. A casa
// agora GARANTE o tempo: entre o dono escolher a superfície e a régua v3
// começar, ESTE aviso fica de pé ~2s — o seletor morre com folga, o dono
// fecha o que não deve sair na foto, e o banner MESMO entra e sai da
// superfície (nenhum frame congela antes de mudança provada).
//
// A moradia certa: FIXED e pointer-events-none — ele nunca bloqueia clique
// (a captura acontece sozinha; nada aqui espera gesto). O timing não mora
// aqui: `active`/`seconds` vêm do useScreenCapture (screen-capture.ts), e
// os NÚMEROS são decisão da lib PURA capture-clean.ts.

import { Loader2 } from 'lucide-react';
import { TIDY_BANNER_LABEL } from '@/lib/capture-clean';
import { cn } from '@/lib/utils';

interface Props {
  /** A fase 'tidy' está de pé (o banner sobe; no 'settle' ele JÁ saiu). */
  active: boolean;
  /** Segundos restantes — o chip tabular honesto (contagem de verdade). */
  seconds: number | null;
}

export function CaptureTidyBanner({ active, seconds }: Props) {
  if (!active) return null;
  return (
    <div
      data-testid="capture-tidy-banner"
      role="status"
      aria-live="polite"
      aria-atomic
      className={cn(
        'pointer-events-none fixed left-1/2 top-3 z-[70] -translate-x-1/2',
        'flex items-center gap-2 rounded-full border border-emerald-500/40',
        'bg-background/90 py-1.5 pl-3 pr-2 shadow-lg backdrop-blur',
        'animate-in fade-in slide-in-from-top-2 duration-300',
      )}
    >
      <Loader2 className="size-3.5 shrink-0 animate-spin text-emerald-500" aria-hidden />
      <span className="whitespace-nowrap text-xs font-medium text-emerald-600 dark:text-emerald-400">
        {TIDY_BANNER_LABEL}
      </span>
      {seconds !== null && (
        <span
          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
          aria-label={`A captura começa em cerca de ${seconds} segundo${seconds === 1 ? '' : 's'}`}
        >
          {seconds}s
        </span>
      )}
    </div>
  );
}
