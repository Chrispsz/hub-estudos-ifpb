'use client';

// Renderizador de markdown compartilhado do Tutor IA — usado no chat da aba
// Estudar, no painel rápido dos PDFs e em qualquer nova superfície do tutor.
// Garante saída estruturada e consistente: negrito em destaque, código Portugol
// em bloco escuro, listas legíveis e tabelas com scroll.

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface TutorMarkdownProps {
  content: string;
  /** Cor de destaque (tailwind text class). Padrão: esmeralda do tutor. */
  accent?: string;
  className?: string;
}

export function TutorMarkdown({ content, accent = 'text-emerald-400', className }: TutorMarkdownProps) {
  return (
    <div className={cn('text-sm', className)}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className={cn('font-semibold', accent)}>{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h3 className="mb-1 text-base font-bold">{children}</h3>,
          h2: ({ children }) => <h3 className="mb-1 text-base font-bold">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-1 text-sm font-bold">{children}</h4>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={cn('underline underline-offset-2', accent)}
            >
              {children}
            </a>
          ),
          code: ({ children, className: cls }) => {
            const isBlock = /language-/.test(cls ?? '');
            if (isBlock) {
              return (
                <code
                  className={cn(
                    'block overflow-x-auto rounded-lg border border-border bg-black/60 p-3 font-mono text-xs leading-relaxed text-emerald-300 [scrollbar-width:thin]',
                    cls,
                  )}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-emerald-500/50 pl-3 text-muted-foreground last:mb-0">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted/60 px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
