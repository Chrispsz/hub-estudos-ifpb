'use client';

import * as React from 'react';
import {
  BookMarked,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Code2,
  Cpu,
  ExternalLink,
  FileText,
  GraduationCap,
  ScrollText,
  Terminal,
  Video,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { importantLinks, type ImportantLink } from '@/data/course-data';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ReactNode> = {
  GraduationCap: <GraduationCap className="size-4" />,
  Building2: <Building2 className="size-4" />,
  FileText: <FileText className="size-4" />,
  CalendarDays: <CalendarDays className="size-4" />,
  ScrollText: <ScrollText className="size-4" />,
  BookOpen: <BookOpen className="size-4" />,
  Video: <Video className="size-4" />,
  Cpu: <Cpu className="size-4" />,
  Code2: <Code2 className="size-4" />,
  BookMarked: <BookMarked className="size-4" />,
  Terminal: <Terminal className="size-4" />,
};

const categoryColor: Record<ImportantLink['category'], string> = {
  curso: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  institucional: 'border-violet-200 bg-violet-50 text-violet-700',
  ferramenta: 'border-amber-200 bg-amber-50 text-amber-700',
  pnaat: 'border-rose-200 bg-rose-50 text-rose-700',
  material: 'border-teal-200 bg-teal-50 text-teal-700',
};

const categoryLabel: Record<ImportantLink['category'], string> = {
  curso: 'Curso',
  institucional: 'Institucional',
  ferramenta: 'Ferramenta',
  pnaat: 'PNAAT',
  material: 'Material',
};

export function ImportantLinks({ className }: { className?: string }) {
  return (
    <Card className={cn('rounded-xl p-4 shadow-sm sm:p-5', className)}>
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <ExternalLink className="size-4 text-teal-500" /> Links importantes
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {importantLinks.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/60 hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'grid size-8 place-items-center rounded-md border',
                  categoryColor[link.category],
                )}
              >
                {iconMap[link.icon ?? 'ExternalLink'] ?? <ExternalLink className="size-4" />}
              </span>
              <Badge
                variant="outline"
                className={cn('ml-auto border text-[10px]', categoryColor[link.category])}
              >
                {categoryLabel[link.category]}
              </Badge>
            </div>
            <p className="text-sm font-semibold leading-tight group-hover:underline">
              {link.title}
            </p>
            <p className="text-xs text-muted-foreground">{link.description}</p>
            <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="size-3" /> Abrir link
            </span>
          </a>
        ))}
      </div>
    </Card>
  );
}
