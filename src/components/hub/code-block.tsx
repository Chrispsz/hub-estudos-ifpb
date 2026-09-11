'use client';

// CodeBlock — bloco de código rico do Tutor IA (usado pelo tutor-markdown).
//
// Cabeçalho com linguagem + botão copiar, numeração de linhas e destaque de
// sintaxe próprio (src/lib/code-highlight.ts, zero dependências) para C,
// Portugol e HTML — as linguagens do curso. O fundo é sempre escuro, então
// as cores do destaque são iguais nos temas claro e escuro.

import * as React from 'react';
import { Check, Copy, FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  langLabel,
  normalizeLang,
  tokensToLines,
  tokenizeCode,
  type CodeToken,
  type CodeTokenType,
} from '@/lib/code-highlight';

interface CodeBlockProps {
  code: string;
  /** Linguagem declarada no fence markdown (ex.: "c", "portugol"). Vazia = sem destaque. */
  language?: string;
  className?: string;
}

const TOKEN_CLASS: Record<CodeTokenType, string> = {
  keyword: 'text-violet-400',
  type: 'text-amber-300',
  preproc: 'text-rose-400',
  string: 'text-emerald-300',
  char: 'text-emerald-300',
  number: 'text-teal-300',
  comment: 'italic text-zinc-500',
  func: 'text-orange-300',
  tag: 'text-amber-300',
  attr: 'text-orange-300',
  entity: 'text-teal-300',
  punct: 'text-zinc-400',
  plain: '',
};

function TokenSpan({ token }: { token: CodeToken }) {
  return <span className={TOKEN_CLASS[token.type]}>{token.value}</span>;
}

function CodeBlockImpl({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const lang = normalizeLang(language);

  // Tokenização memoizada: re-render do chat não re-parseia o código antigo.
  const lines = React.useMemo<CodeToken[][]>(() => {
    const clean = code.replace(/\n$/, '');
    if (lang) return tokensToLines(tokenizeCode(clean, lang));
    return clean.split('\n').map((l) => (l ? [{ type: 'plain' as const, value: l }] : []));
  }, [code, lang]);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (permissão/http) — silencioso, botão volta ao normal
    }
  }, [code]);

  const label = lang ? langLabel(lang) : 'código';

  return (
    <div
      className={cn(
        'mb-2 overflow-hidden rounded-lg border border-border bg-black/60 text-zinc-200 last:mb-0',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-white/[0.03] py-1 pl-3 pr-1.5 sm:pr-2">
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          <FileCode2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Código copiado' : 'Copiar código'}
          className={cn(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400',
            'hover:bg-white/10 active:bg-white/15 sm:h-7 sm:w-7',
            copied ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto [scrollbar-width:thin]">
        <div className="flex">
          {lines.length > 1 && (
            <div
              aria-hidden="true"
              className="select-none border-r border-border/40 py-3 pl-3 pr-2 text-right font-mono text-xs leading-relaxed text-zinc-600"
            >
              {lines.map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
          )}
          <div className="min-w-0 flex-1 overflow-x-auto py-3 [scrollbar-width:thin]">
            <pre className="px-3 font-mono text-xs leading-relaxed">
              {lines.map((line, li) => (
                <div key={li} className="whitespace-pre">
                  {line.length ? line.map((tk, ti) => <TokenSpan key={ti} token={tk} />) : '\u00A0'}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoizado: no chat, cada digitação re-renderiza o painel — blocks antigos
 * não precisam re-tokenizar (props são primitivas, comparação barata).
 */
export const CodeBlock = React.memo(CodeBlockImpl);
