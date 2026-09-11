// Mapeia a cor nominal de cada disciplina para classes Tailwind completas.
// As classes são escritas literalmente (não interpoladas) para garantir que
// o Tailwind as detecte no scan de conteúdo.

export type DisciplineColor =
  | 'emerald'
  | 'orange'
  | 'rose'
  | 'violet'
  | 'amber'
  | 'teal'
  | 'cyan'
  | 'slate';

export interface ColorClass {
  border: string; // ex: border-l-emerald-500
  borderAll: string; // border-emerald-200
  bgSoft: string; // bg-emerald-50
  bgSolid: string; // bg-emerald-500
  bgSolidHover: string; // hover:bg-emerald-600
  text: string; // text-emerald-700
  textStrong: string; // text-emerald-600
  ring: string; // ring-emerald-500/30
  badge: string; // bg-emerald-100 text-emerald-700 border-emerald-200
  dot: string; // bg-emerald-500
  gradientFrom: string; // from-emerald-500
  hex: string; // cor hex para SVG/Chart
}

const map: Record<DisciplineColor, ColorClass> = {
  emerald: {
    border: 'border-l-emerald-500',
    borderAll: 'border-emerald-200',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-500/10',
    bgSolid: 'bg-emerald-500',
    bgSolidHover: 'hover:bg-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    textStrong: 'text-emerald-600',
    ring: 'ring-emerald-500/30',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
    gradientFrom: 'from-emerald-500',
    hex: '#10b981',
  },
  orange: {
    border: 'border-l-orange-500',
    borderAll: 'border-orange-200',
    bgSoft: 'bg-orange-50 dark:bg-orange-500/10',
    bgSolid: 'bg-orange-500',
    bgSolidHover: 'hover:bg-orange-600',
    text: 'text-orange-700 dark:text-orange-300',
    textStrong: 'text-orange-600',
    ring: 'ring-orange-500/30',
    badge: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
    dot: 'bg-orange-500',
    gradientFrom: 'from-orange-500',
    hex: '#f97316',
  },
  rose: {
    border: 'border-l-rose-500',
    borderAll: 'border-rose-200',
    bgSoft: 'bg-rose-50 dark:bg-rose-500/10',
    bgSolid: 'bg-rose-500',
    bgSolidHover: 'hover:bg-rose-600',
    text: 'text-rose-700 dark:text-rose-300',
    textStrong: 'text-rose-600',
    ring: 'ring-rose-500/30',
    badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    dot: 'bg-rose-500',
    gradientFrom: 'from-rose-500',
    hex: '#f43f5e',
  },
  violet: {
    border: 'border-l-violet-500',
    borderAll: 'border-violet-200',
    bgSoft: 'bg-violet-50 dark:bg-violet-500/10',
    bgSolid: 'bg-violet-500',
    bgSolidHover: 'hover:bg-violet-600',
    text: 'text-violet-700 dark:text-violet-300',
    textStrong: 'text-violet-600',
    ring: 'ring-violet-500/30',
    badge: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
    dot: 'bg-violet-500',
    gradientFrom: 'from-violet-500',
    hex: '#8b5cf6',
  },
  amber: {
    border: 'border-l-amber-500',
    borderAll: 'border-amber-200',
    bgSoft: 'bg-amber-50 dark:bg-amber-500/10',
    bgSolid: 'bg-amber-500',
    bgSolidHover: 'hover:bg-amber-600',
    text: 'text-amber-700 dark:text-amber-300',
    textStrong: 'text-amber-600',
    ring: 'ring-amber-500/30',
    badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    dot: 'bg-amber-500',
    gradientFrom: 'from-amber-500',
    hex: '#f59e0b',
  },
  teal: {
    border: 'border-l-teal-500',
    borderAll: 'border-teal-200',
    bgSoft: 'bg-teal-50 dark:bg-teal-500/10',
    bgSolid: 'bg-teal-500',
    bgSolidHover: 'hover:bg-teal-600',
    text: 'text-teal-700 dark:text-teal-300',
    textStrong: 'text-teal-600',
    ring: 'ring-teal-500/30',
    badge: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
    dot: 'bg-teal-500',
    gradientFrom: 'from-teal-500',
    hex: '#14b8a6',
  },
  cyan: {
    border: 'border-l-cyan-500',
    borderAll: 'border-cyan-200',
    bgSoft: 'bg-cyan-50 dark:bg-cyan-500/10',
    bgSolid: 'bg-cyan-500',
    bgSolidHover: 'hover:bg-cyan-600',
    text: 'text-cyan-700 dark:text-cyan-300',
    textStrong: 'text-cyan-600',
    ring: 'ring-cyan-500/30',
    badge: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
    dot: 'bg-cyan-500',
    gradientFrom: 'from-cyan-500',
    hex: '#06b6d4',
  },
  slate: {
    border: 'border-l-slate-500',
    borderAll: 'border-slate-200',
    bgSoft: 'bg-slate-50 dark:bg-slate-500/10',
    bgSolid: 'bg-slate-500',
    bgSolidHover: 'hover:bg-slate-600',
    text: 'text-slate-700 dark:text-slate-300',
    textStrong: 'text-slate-600',
    ring: 'ring-slate-500/30',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
    dot: 'bg-slate-500',
    gradientFrom: 'from-slate-500',
    hex: '#64748b',
  },
};

export function getColorClasses(color: string): ColorClass {
  return (map as Record<string, ColorClass>)[color] ?? map.slate;
}

export const priorityClasses: Record<
  'alta' | 'media' | 'baixa',
  string
> = {
  alta: 'bg-rose-100 text-rose-700 border-rose-200',
  media: 'bg-amber-100 text-amber-800 border-amber-200',
  baixa: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const categoryClasses: Record<string, string> = {
  exata: 'bg-rose-50 text-rose-700 border-rose-200',
  tecnica: 'bg-violet-50 text-violet-700 border-violet-200',
  humanas: 'bg-amber-50 text-amber-700 border-amber-200',
  linguagens: 'bg-teal-50 text-teal-700 border-teal-200',
};

export const categoryLabel: Record<string, string> = {
  exata: 'Exatas',
  tecnica: 'Técnica',
  humanas: 'Humanas',
  linguagens: 'Linguagens',
};
