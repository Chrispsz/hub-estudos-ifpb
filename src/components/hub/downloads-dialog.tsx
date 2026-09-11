'use client';

import * as React from 'react';
import {
  Archive,
  DatabaseBackup,
  Download,
  FileJson,
  FileText,
  Loader2,
  Package,
  Sparkles,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  disciplines,
  materials,
  getDisciplineByCode,
  type Material,
} from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { getColorClasses } from '@/lib/discipline-colors';
import {
  downloadDisciplineZip,
  downloadAllZip,
  downloadSummariesZip,
  downloadPdf,
} from '@/lib/download-utils';
import { exportProgressJSON, importProgressJSON, useStudyProgress } from '@/lib/study-progress';
import { cn } from '@/lib/utils';

const typeLabel: Record<Material['type'], string> = {
  slides: 'Slides',
  lista_exercicios: 'Lista',
  web_page: 'Web',
  introducao: 'Intro',
  ementa: 'Plano',
  video: 'Vídeo',
  pdf: 'PDF',
  calendar: 'Calendário',
};

// Dados imutáveis — listas e contagens derivadas calculadas uma única vez.
const PDF_MATERIALS = materials.filter((m) => m.pdfPath);
const PDF_COUNT = PDF_MATERIALS.length;
const SUMMARY_COUNT = materials.filter((m) => m.summaryFile).length;
const PDF_COUNT_BY_DISCIPLINE = new Map(
  disciplines.map((d) => [
    d.code,
    materials.filter((m) => m.disciplineCode === d.code && m.pdfPath).length,
  ]),
);

interface DownloadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DownloadsDialog({ open, onOpenChange }: DownloadsDialogProps) {
  const sp = useStudyProgress();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function withProgress(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setProgress(0);
    try {
      await fn();
      toast.success('Download concluído!');
    } catch (e) {
      toast.error('Erro ao gerar download: ' + (e as Error).message);
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  function handleExport() {
    try {
      const json = exportProgressJSON(sp.progress);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hub-estudos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup exportado com sucesso!');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e as Error).message);
    }
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importProgressJSON(String(reader.result));
      if (!imported) {
        toast.error('Arquivo inválido — não parece um backup do Hub de Estudos.');
        return;
      }
      sp.replaceProgress(imported);
      toast.success('Progresso restaurado com sucesso!');
      onOpenChange(false);
    };
    reader.onerror = () => toast.error('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
            Downloads &amp; backup
          </DialogTitle>
          <DialogDescription>
            Baixe PDFs e resumos em ZIP (gerado no navegador) e exporte/importe seu progresso
            em JSON.
          </DialogDescription>
        </DialogHeader>

        {/* Backup do progresso */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <DatabaseBackup className="size-4 text-teal-500" /> Backup do progresso
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-11 justify-start sm:h-9"
              onClick={handleExport}
            >
              <FileJson className="size-4 text-emerald-600 dark:text-emerald-400" />
              Exportar progresso (JSON)
            </Button>
            <Button
              variant="outline"
              className="h-11 justify-start sm:h-9"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4 text-amber-600 dark:text-amber-400" />
              Importar progresso (JSON)
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Arquivo de backup JSON"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = '';
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Inclui sessões Pomodoro, tópicos concluídos, notas, preferências e cronograma.
            Importar substitui o estado atual.
          </p>
        </section>

        <Separator />

        {/* ZIPs rápidos */}
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border-l-4 border-l-emerald-500 border border-border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Package className="size-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold">ZIP completo do período</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {PDF_COUNT} PDFs em um único .zip
            </p>
            <Button
              size="sm"
              className="mt-2 w-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={busy === 'all'}
              onClick={() => withProgress('all', () => downloadAllZip(setProgress))}
            >
              {busy === 'all' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> {progress}%
                </>
              ) : (
                <>
                  <Download className="size-3.5" /> Baixar tudo
                </>
              )}
            </Button>
          </div>

          <div className="rounded-xl border-l-4 border-l-violet-500 border border-border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
              <p className="text-sm font-semibold">Resumos IA (JSON)</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {SUMMARY_COUNT} arquivos .summary.json
            </p>
            <Button
              size="sm"
              className="mt-2 w-full bg-violet-600 text-white hover:bg-violet-700"
              disabled={busy === 'summaries'}
              onClick={() => withProgress('summaries', () => downloadSummariesZip(setProgress))}
            >
              {busy === 'summaries' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> {progress}%
                </>
              ) : (
                <>
                  <Download className="size-3.5" /> Baixar resumos
                </>
              )}
            </Button>
          </div>
        </section>

        {/* PDFs por disciplina */}
        {busy && progress > 0 && progress < 100 && (
          <Progress value={progress} className="h-1.5" />
        )}

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Archive className="size-4 text-teal-500" /> ZIP por disciplina
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {disciplines.map((d) => {
              const pdfCount = PDF_COUNT_BY_DISCIPLINE.get(d.code) ?? 0;
              if (pdfCount === 0) return null;
              const color = getColorClasses(d.color);
              const key = `disc-${d.code}`;
              return (
                <div
                  key={d.code}
                  className={cn('rounded-lg border border-border bg-card p-2.5', color.border && 'border-l-2')}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-md',
                        color.bgSoft,
                        color.text,
                      )}
                    >
                      <DisciplineIcon name={d.icon} className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{d.shortName}</p>
                      <p className="text-[10px] text-muted-foreground">{pdfCount} PDFs</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-11 w-full text-xs sm:h-7"
                    disabled={busy === key}
                    onClick={() =>
                      withProgress(key, () =>
                        downloadDisciplineZip(d.code, d.shortName, setProgress),
                      )
                    }
                  >
                    {busy === key ? (
                      <>
                        <Loader2 className="size-3 animate-spin" /> {progress}%
                      </>
                    ) : (
                      <>
                        <Download className="size-3" /> ZIP
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* PDFs individuais (compacto) */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-rose-500" /> PDFs individuais
          </h3>
          <ul className="grid max-h-64 gap-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {PDF_MATERIALS.map((m) => {
              const disc = getDisciplineByCode(m.disciplineCode);
              const color = getColorClasses(disc?.color ?? 'slate');
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-sm"
                >
                  <span className={cn('size-2 shrink-0 rounded-full', color.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {disc?.shortName ?? m.disciplineCode} • {typeLabel[m.type]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-11 w-11 sm:h-6 sm:w-auto sm:px-1.5"
                    aria-label={`Baixar ${m.title}`}
                    onClick={() => {
                      if (!m.pdfPath) return;
                      const filename = m.pdfPath.split('/').pop() ?? `${m.id}.pdf`;
                      downloadPdf(m.pdfPath, filename);
                      toast.success('Download iniciado');
                    }}
                  >
                    <Download className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
