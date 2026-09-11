'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStudyProgress } from '@/lib/study-progress';
import type { Material } from '@/data/course-data';

type Provider = 'youtube' | 'drive-file' | 'drive-folder' | 'vimeo' | 'generic' | 'unsupported';

interface ParsedVideo {
  provider: Provider;
  embedUrl: string | null;
  canEmbed: boolean;
}

/**
 * Converte URLs de vídeo comuns em URLs de embed.
 * Suporta: YouTube (watch/youtu.be/shorts/embed), Google Drive (arquivo),
 * Vimeo e fallback genérico. Pastas do Drive NÃO podem ser embutidas.
 */
export function parseVideoUrl(rawUrl: string): ParsedVideo {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '');

    // YouTube
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      let id: string | null = null;
      if (host === 'youtu.be') {
        id = url.pathname.split('/')[1] ?? null;
      } else if (url.pathname.startsWith('/watch')) {
        id = url.searchParams.get('v');
      } else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
        id = url.pathname.split('/')[2] ?? null;
      }
      if (id) {
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${id}?rel=0`,
          canEmbed: true,
        };
      }
    }

    // Google Drive — arquivo
    if (host === 'drive.google.com') {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
      if (fileMatch) {
        return {
          provider: 'drive-file',
          embedUrl: `https://drive.google.com/file/d/${fileMatch[1]}/preview`,
          canEmbed: true,
        };
      }
      // Pasta (ou outros links do Drive) — não embutível
      return { provider: 'drive-folder', embedUrl: null, canEmbed: false };
    }

    // Vimeo
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return {
          provider: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${id}`,
          canEmbed: true,
        };
      }
    }

    // Genérico https — tenta iframe (alguns sites bloqueiam)
    if (url.protocol === 'https:') {
      return { provider: 'generic', embedUrl: rawUrl, canEmbed: true };
    }

    return { provider: 'unsupported', embedUrl: null, canEmbed: false };
  } catch {
    return { provider: 'unsupported', embedUrl: null, canEmbed: false };
  }
}

interface VideoPlayerDialogProps {
  material: (Pick<Material, 'id' | 'title' | 'externalUrl'> & Partial<Material>) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Player de videoaulas: embute YouTube / Drive (arquivo) / Vimeo no app.
 * Pastas do Drive ganham um card de fallback com link externo.
 * Ao abrir, marca o material como acessado; botão permite concluir.
 */
export function VideoPlayerDialog({ material, open, onOpenChange }: VideoPlayerDialogProps) {
  const sp = useStudyProgress();
  // parseVideoUrl é puro e barato — o React Compiler memoiza automaticamente.
  const parsed = material?.externalUrl ? parseVideoUrl(material.externalUrl) : null;

  // Marca como acessado ao abrir
  React.useEffect(() => {
    if (open && material?.id) sp.markAccessed(material.id);
  }, [open, material?.id]);

  if (!material) return null;
  const isCompleted = sp.progress.completedMaterials.includes(material.id);
  const discName = material.disciplineCode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <PlayCircle className="size-5 shrink-0 text-emerald-500" aria-hidden />
            <span className="truncate">{material.title}</span>
          </DialogTitle>
          <DialogDescription>
            {parsed?.provider === 'drive-folder'
              ? 'Pasta do Google Drive — abra em nova aba para assistir.'
              : parsed?.provider === 'generic'
                ? 'Se o vídeo não carregar no player, abra em nova aba.'
                : 'Videoaula embutida — assista sem sair do Hub.'}
            {discName ? ` • ${discName}` : ''}
          </DialogDescription>
        </DialogHeader>

        {parsed?.canEmbed && parsed.embedUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
            <iframe
              src={parsed.embedUrl}
              className="size-full"
              title={material.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <PlayCircle className="size-10 text-emerald-500" aria-hidden />
            <p className="text-sm font-medium">Este conteúdo abre no Google Drive</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Pastas de vídeo não podem ser exibidas aqui (limitação do Drive). Clique abaixo
              para assistir em uma nova aba — seu progresso continua salvo no Hub.
            </p>
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <a href={material.externalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Abrir videoaulas em nova aba
              </a>
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" asChild>
            <a href={material.externalUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" /> Nova aba
            </a>
          </Button>
          <Button
            size="sm"
            variant={isCompleted ? 'outline' : 'default'}
            className={
              isCompleted
                ? 'text-emerald-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }
            onClick={() => {
              if (!material.id) return;
              if (isCompleted && material.disciplineCode) {
                sp.unmarkCompleted(material.id, material.disciplineCode);
                toast('Marcado como não concluído');
              } else if (material.disciplineCode) {
                sp.markCompleted(material.id, material.disciplineCode);
                toast.success('Videoaula concluída! 🎉');
              }
            }}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="size-3.5" /> Concluída ✓
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" /> Marcar como concluída
              </>
            )}
          </Button>
        </div>

        {!parsed && (
          <p className="flex items-center gap-1.5 text-xs text-amber-500">
            <AlertCircle className="size-3.5" /> Link de vídeo inválido ou ausente.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
