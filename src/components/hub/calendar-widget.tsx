'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calendarEvents, type CalendarEvent } from '@/data/course-data';
import { cn } from '@/lib/utils';

const categoryStyle: Record<CalendarEvent['category'], string> = {
  feriado: 'bg-rose-500',
  avaliacao: 'bg-amber-500',
  aula: 'bg-emerald-500',
  recesso: 'bg-slate-400',
  outro: 'bg-violet-500',
};

const categoryBadge: Record<CalendarEvent['category'], string> = {
  feriado: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900',
  avaliacao: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  aula: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
  recesso: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:border-slate-800',
  outro: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900',
};

/** Compara uma data local com uma chave ISO yyyy-mm-dd (mesmo dia civil). */
function isSameDay(a: Date, b: string): boolean {
  const d = new Date(b + 'T00:00:00');
  return (
    a.getFullYear() === d.getFullYear() &&
    a.getMonth() === d.getMonth() &&
    a.getDate() === d.getDate()
  );
}

export function CalendarWidget({ className }: { className?: string }) {
  const [selected, setSelected] = React.useState<Date | undefined>(new Date());

  // Map de ISO date -> events
  const eventMap = React.useMemo(() => {
    const m = new Map<string, typeof calendarEvents>();
    for (const e of calendarEvents) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, []);

  // Eventos do dia selecionado
  const selectedEvents = React.useMemo(() => {
    if (!selected) return [];
    return calendarEvents.filter((e) => isSameDay(selected, e.date));
  }, [selected]);

  // Próximos eventos (após hoje, em ordem cronológica)
  const upcomingEvents = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return calendarEvents
      .filter((e) => new Date(e.date + 'T00:00:00') >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, []);

  return (
    <Card className={cn('rounded-xl p-4 shadow-sm', className)}>
      <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
        <div>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            modifiers={{
              eventDays: (date) => {
                const iso = date.toISOString().slice(0, 10);
                return eventMap.has(iso);
              },
            }}
            modifiersClassNames={{
              eventDays:
                'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-rose-500',
            }}
            className="rounded-md border border-border p-2"
            classNames={{
              day_selected:
                'bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white focus:bg-emerald-600 focus:text-white',
            }}
          />
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">
              Eventos do dia selecionado
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                Nenhum evento acadêmico cadastrado para este dia.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {selectedEvents.map((e) => (
                  <li
                    key={`${e.date}-${e.title}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs"
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        categoryStyle[e.category],
                      )}
                    />
                    <span className="font-medium">{e.title}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-auto border text-[10px] capitalize',
                        categoryBadge[e.category],
                      )}
                    >
                      {e.category}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Próximos eventos</h3>
            <ul className="mt-2 space-y-1.5">
              {upcomingEvents.length === 0 ? (
                <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                  Nenhum evento futuro cadastrado.
                </li>
              ) : (
                upcomingEvents.map((e) => (
                  <li
                    key={`${e.date}-${e.title}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs"
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        'w-20 shrink-0 justify-center border text-[11px]',
                        categoryBadge[e.category],
                      )}
                    >
                      {e.dateLabel}
                    </Badge>
                    <span className="text-foreground/85">{e.title}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
