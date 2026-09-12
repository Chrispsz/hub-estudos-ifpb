'use client';

import * as React from 'react';
import {
  BotMessageSquare,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileText,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Material, Discipline } from '@/data/course-data';
import { getDisciplineByCode } from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { downloadPdf } from '@/lib/download-utils';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/lib/study-progress';
import { TutorQuickPanel } from './tutor-quick-panel';

interface Props {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Botões de ação: alvo de toque ≥44px no mobile, compacto no desktop. */
const touchBtn = 'h-11 sm:h-8';

export function PdfViewerDialog({ material, open, onOpenChange }: Props) {
  const sp = useStudyProgress();
  const [tutorOpen, setTutorOpen] = React.useState(false);

  // Ao trocar de material, o painel do tutor volta ao estado inicial.
  React.useEffect(() => {
    if (!open) setTutorOpen(false);
  }, [open]);
  const markAccessed = sp.markAccessed;
  const markCompleted = sp.markCompleted;
  const unmarkCompleted = sp.unmarkCompleted;
  const isCompleted = sp.progress.completedMaterials.includes(material?.id ?? '');
  const discipline: Discipline | undefined = material
    ? getDisciplineByCode(material.disciplineCode)
    : undefined;
  const color = getColorClasses(discipline?.color ?? 'slate');

  React.useEffect(() => {
    if (open && material) {
      markAccessed(material.id);
    }
  }, [open, material, markAccessed]);

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0 sm:max-w-4xl">
        <div
          className={cn(
            'flex items-center gap-3 border-b p-4',
            color.bgSoft,
            color.borderAll,
          )}
        >
          <div
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-md bg-card shadow-sm',
              color.text,
            )}
          >
            <FileText className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base leading-tight">
              {material.title}
            </DialogTitle>
            <DialogDescription className="mt-0.5 flex items-center gap-2 text-xs">
              <Badge variant="outline" className={cn('border', color.badge)}>
                {discipline?.shortName ?? material.disciplineCode}
              </Badge>
              {material.pages ? <span>{material.pages} páginas</span> : null}
              <span className="hidden sm:inline">{material.type}</span>
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar"
            className="ml-auto"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 border-b bg-muted/40 p-3">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className={touchBtn}
          >
            <a href={material.pdfPath} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" /> Abrir em nova aba
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={touchBtn}
            onClick={() => {
              if (!material.pdfPath) return;
              const filename = material.pdfPath.split('/').pop() ?? 'arquivo.pdf';
              downloadPdf(material.pdfPath, filename);
              toast.success('Download iniciado');
            }}
          >
            <Download className="size-3.5" /> Baixar PDF
          </Button>
          <Button
            size="sm"
            variant={tutorOpen ? 'default' : 'outline'}
            className={cn(touchBtn, tutorOpen && 'bg-emerald-600 text-white hover:bg-emerald-700')}
            aria-pressed={tutorOpen}
            onClick={() => setTutorOpen((v) => !v)}
          >
            <BotMessageSquare className="size-3.5" /> Tutor IA
          </Button>
          <Button
            size="sm"
            variant={isCompleted ? 'outline' : 'default'}
            className={cn(touchBtn, !isCompleted && 'bg-emerald-600 text-white hover:bg-emerald-700')}
            aria-pressed={isCompleted}
            onClick={() => {
              if (isCompleted) {
                unmarkCompleted(material.id, material.disciplineCode);
                toast.success('Marcado como não concluído');
              } else {
                markCompleted(material.id, material.disciplineCode);
                toast.success('Marcado como concluído!');
              }
            }}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden /> Concluído
              </>
            ) : (
              <>
                <Circle className="size-3.5" aria-hidden /> Marcar concluído
              </>
            )}
          </Button>
        </div>

        <div className="flex min-h-0 flex-col">
          <iframe
            src={material.pdfPath}
            title={material.title}
            className={cn(
              'w-full bg-muted transition-all duration-300',
              tutorOpen ? 'h-[52vh]' : 'h-[80vh]',
            )}
          />
          {tutorOpen && (
            <div className="flex h-[28vh] flex-col border-t bg-background">
              <TutorQuickPanel
                discipline={discipline?.name ?? material.disciplineCode}
                disciplineCode={material.disciplineCode}
                materialTitle={material.title}
                materialId={material.id}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
