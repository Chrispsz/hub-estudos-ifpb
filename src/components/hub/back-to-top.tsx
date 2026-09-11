'use client';

import * as React from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Rolagem (px) necessária para o botão aparecer. */
const SCROLL_THRESHOLD_PX = 400;

/**
 * Botão flutuante "voltar ao topo" — aparece após rolagem, com transição suave.
 * Escondido, também é removido da ordem de tabulação (tabIndex -1).
 */
export function BackToTop() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SCROLL_THRESHOLD_PX);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Button
      size="icon"
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      tabIndex={visible ? 0 : -1}
      className={cn(
        'fixed bottom-5 right-5 z-40 size-11 rounded-full border border-emerald-500/30 bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 transition-all duration-300 hover:bg-emerald-500 sm:size-9',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0',
      )}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUp className="size-4" />
    </Button>
  );
}
