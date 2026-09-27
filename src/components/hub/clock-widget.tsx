'use client';

import * as React from 'react';

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const diasSemanaFull = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
const meses = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

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

interface ClockWidgetProps {
  className?: string;
}

/**
 * Relógio em tempo real do header, atualizado a cada segundo — a única
 * variante que o app usa (as variantes card/inline morreram sem uso e
 * saíram; quem precisar de "agora" em outro lugar usa o useNow acima).
 */
export function ClockWidget({ className = '' }: ClockWidgetProps) {
  const now = useNow(1000);

  if (!now) {
    return <span suppressHydrationWarning className={className}>—</span>;
  }

  const diaSemana = diasSemana[now.getDay()];
  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const hora = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const seg = now.getSeconds().toString().padStart(2, '0');

  // header — versão compacta para evitar corte
  return (
    <div
      className={`hidden flex-col text-right leading-tight shrink-0 sm:flex ${className}`}
      suppressHydrationWarning
    >
      <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
        {diaSemana}, {dia} {mes}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums whitespace-nowrap">
        {hora}:{min}:{seg}
      </span>
    </div>
  );
}

export function todayDayOfWeek(): number {
  return new Date().getDay();
}

export function getDayLabel(d: number): string {
  return diasSemanaFull[d];
}
