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

interface ClockWidgetProps {
  variant?: 'header' | 'card' | 'inline';
  className?: string;
  onTick?: (date: Date) => void;
}

/**
 * Relógio em tempo real, atualizado a cada segundo.
 * Variantes:
 * - header: pequeno e inline (no header)
 * - card: card maior com dia da semana em destaque
 * - inline: texto simples
 */
export function ClockWidget({
  variant = 'header',
  className = '',
  onTick,
}: ClockWidgetProps) {
  const [now, setNow] = React.useState<Date | null>(null);

  // onTick em ref: o callback mais recente é usado sem recriar o intervalo
  // a cada render do pai (que passaria uma função inline nova).
  const onTickRef = React.useRef(onTick);
  React.useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => {
      const d = new Date();
      setNow(d);
      onTickRef.current?.(d);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <span suppressHydrationWarning className={className}>—</span>;
  }

  const diaSemana = diasSemana[now.getDay()];
  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const ano = now.getFullYear();
  const hora = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const seg = now.getSeconds().toString().padStart(2, '0');

  if (variant === 'inline') {
    return (
      <span className={className} suppressHydrationWarning>
        {diaSemana}, {dia} {mes} {ano} • {hora}:{min}:{seg}
      </span>
    );
  }

  if (variant === 'card') {
    return (
      <div className={className} suppressHydrationWarning>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {diasSemanaFull[now.getDay()]}
        </p>
        <p className="font-mono text-3xl font-bold tabular-nums leading-none">
          {hora}:{min}
          <span className="text-xl text-muted-foreground">:{seg}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {dia} de {mes} de {ano}
        </p>
      </div>
    );
  }

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
