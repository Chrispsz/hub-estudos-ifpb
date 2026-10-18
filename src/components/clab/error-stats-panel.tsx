'use client';

/**
 * Lab de Código — Painel "Onde você erra mais"
 * ---------------------------------------------
 * "Ficar ligado onde eu erro mais" (áudio do dono, 18/10/2026). Pequeno,
 * colapsável, no modo C, e SÓ aparece quando existe ≥ 1 erro registrado.
 * Barras horizontais por categoria (mesma régua do diagnóstico), a líder
 * com UMA frase de ajuda — zero julgamento — e o reforço positivo das
 * execuções limpas. Tudo lido do localStorage (ver lib/clab/error-stats.ts).
 */
import * as React from 'react';
import { BarChart3, ChevronDown, PartyPopper, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { totalClabErrors, type ClabErrorStats } from '@/lib/clab/error-stats';
import type { ErrCategory } from '@/lib/clab/diagnose';

/** Rótulo, cor da barra e frase de ajuda de cada categoria (cores da casa: sem azul/indigo). */
const CAT_META: { cat: ErrCategory; label: string; bar: string; help: string }[] = [
  {
    cat: 'sintaxe',
    label: 'Sintaxe',
    bar: 'bg-rose-500',
    help: 'Sintaxe é sua maior queda — antes de rodar, releia ponto-e-vírgula, chaves e parênteses.',
  },
  {
    cat: 'variavel',
    label: 'Variáveis',
    bar: 'bg-amber-500',
    help: 'Variáveis são sua maior queda — confira se cada nome foi declarado antes de usar e se está escrito exatamente igual.',
  },
  {
    cat: 'tipo',
    label: 'Tipos',
    bar: 'bg-teal-500',
    help: 'Tipos são sua maior queda — lembre: %d para inteiro, %f para decimal, e texto não faz conta direta.',
  },
  {
    cat: 'laco',
    label: 'Laços e repetição',
    bar: 'bg-fuchsia-500',
    help: 'Laços são sua maior queda — confira a condição de parada e se o contador muda dentro do laço.',
  },
  {
    cat: 'io',
    label: 'Entrada e saída',
    bar: 'bg-emerald-500',
    help: 'Entrada e saída são sua maior queda — conte os % do printf e confira o & no scanf.',
  },
  {
    cat: 'outro',
    label: 'Outros',
    bar: 'bg-zinc-400',
    help: 'Os outros erros lideram — leia a mensagem com calma: ela costuma apontar exatamente a linha.',
  },
];

export function ErrorStatsPanel({
  stats,
  onReset,
  defaultOpen = true,
}: {
  stats: ClabErrorStats;
  onReset: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  const total = totalClabErrors(stats);
  const rows = CAT_META.map((m) => ({ ...m, count: stats.cats[m.cat] ?? 0 })).filter((r) => r.count > 0);
  const max = Math.max(...rows.map((r) => r.count), 1);
  const leader = rows.reduce<(typeof rows)[number] | null>(
    (best, r) => (!best || r.count > best.count ? r : best),
    null,
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-dashed">
        <CardContent className="p-0">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-accent/50">
              <BarChart3 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span className="text-sm font-semibold">Onde você erra mais</span>
              <Badge variant="outline" className="text-[10px]">
                {total} {total === 1 ? 'erro registrado' : 'erros registrados'}
              </Badge>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {open ? 'ocultar' : 'mostrar'}
              </span>
              <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-2.5 border-t px-4 pb-3 pt-3">
              {rows.map((r) => (
                <div key={r.cat}>
                  <div className="mb-0.5 flex items-baseline gap-2 text-xs">
                    <span className={cn('font-medium', leader?.cat === r.cat && 'font-bold')}>{r.label}</span>
                    {leader?.cat === r.cat && (
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">
                        sua maior queda
                      </Badge>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{r.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div
                      className={cn('h-full rounded-full', r.bar)}
                      style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                      role="img"
                      aria-label={`${r.label}: ${r.count} ${r.count === 1 ? 'erro' : 'erros'}`}
                    />
                  </div>
                </div>
              ))}

              {leader && (
                <p className="rounded-md border-l-2 border-teal-500 bg-teal-50 p-2 text-xs leading-snug text-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
                  {leader.help}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <PartyPopper className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  execuções limpas: <strong className="font-semibold text-foreground">{stats.ok}</strong>
                </span>
                <span className="hidden sm:inline">· contagem fica só neste navegador</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={onReset}
                >
                  <RotateCcw className="size-3" aria-hidden /> zerar contagem
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
