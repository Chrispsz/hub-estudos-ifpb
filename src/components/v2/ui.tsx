'use client';

// Primitivos visuais do app novo — dark IDE: mono, zinco, verde/violeta.
// (sem indigo/azul — regra da casa)

import * as React from 'react';

export function Panel({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

const TONES = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  zinc: 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
  orange: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
} as const;

export type Tone = keyof typeof TONES;

export function Chip({
  tone = 'zinc',
  className = '',
  title,
  children,
}: {
  tone?: Tone;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Barra de domínio 0–100 — verde quando firme, âmbar quando semeado. */
export function DomainBar({ value, seeded }: { value: number; seeded?: boolean }) {
  const color = seeded ? 'bg-amber-400/70' : value >= 80 ? 'bg-emerald-500' : 'bg-violet-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
      <span
        className={`w-9 shrink-0 text-right font-mono text-[11px] tabular-nums ${
          seeded ? 'text-amber-300' : 'text-zinc-300'
        }`}
        title={seeded ? 'semeado pelo legado — estimativa honesta' : 'acerto real ponderado'}
      >
        {value}%
      </span>
    </div>
  );
}

export function PageHead({
  kicker,
  title,
  desc,
  right,
}: {
  kicker: string;
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-violet-400">{kicker}</p>
        <h1 className="mt-0.5 font-mono text-lg font-semibold text-zinc-50">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">{desc}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}

export function Empty({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`rounded-md border border-dashed border-zinc-800 p-4 text-center font-mono text-xs text-zinc-500 ${className}`}>
      {children}
    </p>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="font-mono text-lg font-semibold tabular-nums text-zinc-100">{value}</p>
      {hint && <p className="text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Why({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-400">
      <span aria-hidden className="mt-[1px] text-violet-400">
        ▸
      </span>
      <span>{children}</span>
    </p>
  );
}

export function Btn({
  variant = 'default',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'emerald' | 'violet' | 'rose' | 'ghost' | 'outline';
}) {
  const styles = {
    default: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-500',
    violet: 'bg-violet-600 text-white hover:bg-violet-500',
    rose: 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
    ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
    outline: 'border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100',
  } as const;
  return (
    <button
      {...props}
      className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 ${props.className ?? ''}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none ${props.className ?? ''}`}
    />
  );
}
