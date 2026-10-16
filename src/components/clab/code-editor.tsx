'use client';

/**
 * Lab de Código — Editor com realce de sintaxe de C
 * --------------------------------------------------
 * Textarea transparente sobre uma camada de realce (técnica clássica de
 * editor leve). Tem gutter com números de linha, linha atual destacada
 * (sincronizada com o passo da execução) e linha de erro marcada.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

const C_KEYWORDS = new Set([
  'if', 'else', 'while', 'do', 'for', 'return', 'break', 'continue',
  'switch', 'case', 'default', 'true', 'false', 'sizeof', 'goto',
]);
const C_TYPES = new Set([
  'int', 'float', 'double', 'char', 'void', 'bool', 'const',
  'unsigned', 'long', 'short', 'signed', 'struct', 'typedef',
]);

interface HlTok { text: string; cls: string }

/** Realçador minimalista de C (comentários, strings, números, palavras-chave). */
function highlightC(code: string): HlTok[] {
  const out: HlTok[] = [];
  const push = (text: string, cls: string) => { if (text) out.push({ text, cls }); };
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') {
      let j = code.indexOf('\n', i);
      if (j < 0) j = n;
      push(code.slice(i, j), 'comment');
      i = j;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const j = code.indexOf('*/', i + 2);
      const end = j < 0 ? n : j + 2;
      push(code.slice(i, end), 'comment');
      i = end;
      continue;
    }
    if (c === '#') {
      let j = code.indexOf('\n', i);
      if (j < 0) j = n;
      push(code.slice(i, j), 'pp');
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && code[j] !== c && code[j] !== '\n') {
        if (code[j] === '\\') j++;
        j++;
      }
      push(code.slice(i, Math.min(j + 1, n)), 'string');
      i = Math.min(j + 1, n);
      continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < n && ((code[j] >= '0' && code[j] <= '9') || code[j] === '.')) j++;
      if (code[j] === 'f') j++;
      push(code.slice(i, j), 'number');
      i = j;
      continue;
    }
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i;
      while (j < n && /\w/.test(code[j])) j++;
      const w = code.slice(i, j);
      let cls = '';
      if (C_TYPES.has(w)) cls = 'type';
      else if (C_KEYWORDS.has(w)) cls = 'kw';
      else {
        let k = j;
        while (k < n && code[k] === ' ') k++;
        if (code[k] === '(') cls = 'fn';
      }
      push(w, cls);
      i = j;
      continue;
    }
    push(c, '');
    i++;
  }
  return out;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CLS: Record<string, string> = {
  comment: 'text-zinc-400 dark:text-zinc-500 italic',
  string: 'text-amber-700 dark:text-amber-300',
  pp: 'text-rose-600 dark:text-rose-400',
  number: 'text-orange-700 dark:text-orange-300',
  kw: 'text-fuchsia-700 dark:text-fuchsia-300 font-medium',
  type: 'text-emerald-700 dark:text-emerald-300 font-medium',
  fn: 'text-teal-700 dark:text-teal-300',
};

const LINE_H = 20; // leading-5
const PAD_Y = 12;  // py-3

interface CodeEditorProps {
  code: string;
  onChange: (v: string) => void;
  currentLine?: number;
  errorLine?: number;
  onRun?: () => void;
  heightClass?: string;
  readOnly?: boolean;
}

export function CodeEditor({
  code,
  onChange,
  currentLine,
  errorLine,
  onRun,
  heightClass = 'h-[380px] 2xl:h-[520px]',
  readOnly = false,
}: CodeEditorProps) {
  const [scroll, setScroll] = React.useState({ top: 0, left: 0 });
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  const lines = React.useMemo(() => code.split('\n'), [code]);
  const tokens = React.useMemo(() => highlightC(code), [code]);

  const handleScroll = React.useCallback(() => {
    const ta = taRef.current;
    if (ta) setScroll({ top: ta.scrollTop, left: ta.scrollLeft });
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onRun?.();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const { selectionStart: s, selectionEnd: en } = ta;
        const next = code.slice(0, s) + '    ' + code.slice(en);
        onChange(next);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = s + 4;
        });
      }
    },
    [code, onChange, onRun],
  );

  const html = React.useMemo(
    () =>
      tokens
        .map((t) => (t.cls ? `<span class="${CLS[t.cls]}">${esc(t.text)}</span>` : esc(t.text)))
        .join(''),
    [tokens],
  );

  return (
    <div className={cn('relative flex overflow-hidden rounded-lg border bg-zinc-50 dark:bg-zinc-950', heightClass)}>
      {/* gutter com números */}
      <div className="w-11 shrink-0 select-none overflow-hidden border-r bg-zinc-100/80 dark:bg-zinc-900/70">
        <div style={{ transform: `translateY(${-scroll.top}px)` }} className="py-3 text-right font-mono text-[13px] leading-5">
          {lines.map((_, i) => {
            const ln = i + 1;
            return (
              <div
                key={i}
                className={cn(
                  'pr-2 text-zinc-400 dark:text-zinc-600',
                  ln === currentLine && 'font-bold text-amber-700 dark:text-amber-300',
                  ln === errorLine && 'font-bold text-rose-600 dark:text-rose-400',
                )}
              >
                {ln}
              </div>
            );
          })}
        </div>
      </div>

      {/* área do código */}
      <div className="relative min-w-0 flex-1">
        {/* camada de realce + marcações (não interativa) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden py-3 pl-3 pr-3">
          <div style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }} className="relative w-max min-w-full">
            {typeof currentLine === 'number' && currentLine > 0 && (
              <div
                className="absolute right-0 left-0 rounded-sm bg-amber-200/60 dark:bg-amber-500/15"
                style={{ top: PAD_Y + (currentLine - 1) * LINE_H - PAD_Y, height: LINE_H }}
              />
            )}
            {typeof errorLine === 'number' && errorLine > 0 && (
              <div
                className="absolute right-0 left-0 rounded-sm bg-rose-500/15"
                style={{ top: (errorLine - 1) * LINE_H, height: LINE_H }}
              />
            )}
            <pre
              aria-hidden
              className="relative w-max font-mono text-[13px] leading-5 text-zinc-800 dark:text-zinc-200"
              dangerouslySetInnerHTML={{ __html: html + '\n' }}
            />
          </div>
        </div>

        {/* textarea transparente por cima */}
        <textarea
          ref={taRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Editor de código C"
          className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent py-3 pl-3 pr-3 font-mono text-[13px] leading-5 text-transparent caret-zinc-900 outline-none selection:bg-amber-300/50 focus-visible:outline-none dark:caret-zinc-100 dark:selection:bg-amber-500/30"
        />
      </div>
    </div>
  );
}
