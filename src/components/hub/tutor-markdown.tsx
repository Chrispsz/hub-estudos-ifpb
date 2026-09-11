'use client';

// Renderizador de markdown compartilhado do Tutor IA — usado no chat da aba
// Estudar, no painel rápido dos PDFs e em qualquer nova superfície do tutor.
// Garante saída estruturada e consistente: negrito em destaque, blocos de código
// ricos (CodeBlock: sintaxe C/Portugol/HTML + copiar + linhas), listas legíveis
// e tabelas com scroll.

import * as React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import { CodeBlock } from '@/components/hub/code-block';

/** Concatena o texto bruto de nós React (o conteúdo do <code> é string puro). */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (React.isValidElement(node)) {
    return nodeText((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

interface TutorMarkdownProps {
  content: string;
  /** Cor de destaque (tailwind text class). Padrão: esmeralda do tutor. */
  accent?: string;
  className?: string;
}

function TutorMarkdownImpl({
  content,
  accent = 'text-emerald-400',
  className,
}: TutorMarkdownProps) {
  // Mapa de componentes memoizado: sem isso ele é recriado a cada render,
  // forçando o ReactMarkdown a re-renderizar toda a árvore de nós.
  const components = React.useMemo<Components>(
    () => ({
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
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      ),
      code: ({ children }) => (
        // blocos cercados (```) são capturados pelo `pre` abaixo e nunca chegam aqui
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
          {children}
        </code>
      ),
      pre: ({ children }) => {
        // o filho do <pre> é o elemento <code> com a classe language-*
        const el = React.Children.toArray(children).find(
          React.isValidElement,
        ) as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;
        if (!el) return <div className="mb-2 last:mb-0">{children}</div>;
        const cls: string = el.props.className ?? '';
        const lang = /language-([\w#+-]+)/.exec(cls)?.[1];
        const raw = nodeText(el.props.children).replace(/\n$/, '');
        return <CodeBlock code={raw} language={lang} />;
      },
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
    }),
    [accent],
  );

  return (
    <div className={cn('text-sm', className)}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * Export memoizado: no chat, digitar no input re-renderiza o painel inteiro —
 * memo evita re-parsear o markdown das mensagens anteriores
 * (content/accent/className são primitivos, comparação barata).
 */
export const TutorMarkdown = React.memo(TutorMarkdownImpl);
