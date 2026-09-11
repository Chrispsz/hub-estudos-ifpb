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
import { cn } from '@/lib/utils';
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

    // Genérico https — NÃO tenta iframe: a maioria dos sites (gitbook, MDN etc.)
    // envia X-Frame-Options/CSP e viraria um frame quebrado. Cai no card de
    // fallback com botão "Abrir conteúdo em nova aba".
    if (url.protocol === 'https:') {
      return { provider: 'generic', embedUrl: null, canEmbed: false };
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

/** Botões de ação: alvo de toque ≥44px no mobile, compacto no desktop. */
const touchBtn = 'h-11 sm:h-8';

/**
 * Player de videoaulas: embute YouTube / Drive (arquivo) / Vimeo no app.
 * Pastas do Drive ganham um card de fallback com link externo.
 * Ao abrir, marca o material como acessado; botão permite concluir.
 */
export function VideoPlayerDialog({ material, open, onOpenChange }: VideoPlayerDialogProps) {
  const sp = useStudyProgress();
  const markAccessed = sp.markAccessed;

  // parseVideoUrl é puro; memoizado para não re-parsear a URL a cada render
  // (o React Compiler não está habilitado neste projeto).
  const externalUrl = material?.externalUrl;
  const parsed = React.useMemo(
    () => (externalUrl ? parseVideoUrl(externalUrl) : null),
    [externalUrl],
  );

  // Marca como acessado ao abrir
  React.useEffect(() => {
    if (open && material?.id) markAccessed(material.id);
  }, [open, material?.id, markAccessed]);

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
                ? 'Conteúdo web — abra em nova aba para ler.'
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
            <p className="text-sm font-medium">
              {parsed?.provider === 'drive-folder'
                ? 'Este conteúdo abre no Google Drive'
                : 'Este conteúdo abre em nova aba'}
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              {parsed?.provider === 'drive-folder'
                ? 'Pastas de vídeo não podem ser exibidas aqui (limitação do Drive). Clique abaixo para assistir em uma nova aba — seu progresso continua salvo no Hub.'
                : 'Esta página não pode ser exibida aqui. Clique abaixo para abrir em uma nova aba — seu progresso continua salvo no Hub.'}
            </p>
            <Button asChild className="h-11 bg-emerald-600 text-white hover:bg-emerald-700 sm:h-9">
              <a href={material.externalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />{' '}
                {parsed?.provider === 'drive-folder'
                  ? 'Abrir videoaulas em nova aba'
                  : 'Abrir conteúdo em nova aba'}
              </a>
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" asChild className={touchBtn}>
            <a href={material.externalUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" aria-hidden /> Nova aba
            </a>
          </Button>
          <Button
            size="sm"
            variant={isCompleted ? 'outline' : 'default'}
            className={cn(
              touchBtn,
              isCompleted
                ? 'text-emerald-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-700',
            )}
            aria-pressed={isCompleted}
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
                <CheckCircle2 className="size-3.5" aria-hidden /> Concluída ✓
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" aria-hidden /> Marcar como concluída
              </>
            )}
          </Button>
        </div>

        {!parsed && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-3.5" aria-hidden /> Link de vídeo inválido ou ausente.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
