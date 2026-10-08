'use client';

import * as React from 'react';

/**
 * FONTE DE TEMPO VIVA do app — quem pergunta "agora", pergunta aqui.
 * Um intervalo só por consumidor, limpo no unmount; devolve null até o
 * mount (o servidor não sabe a hora do aluno — mesmo contrato honesto
 * que o relógio do header sempre teve). O tick reage a qualquer troca
 * de Date no mesmo frame (lição 79: mock de relógio vira render).
 */
export function useNow(stepMs = 1000): Date | null {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}
