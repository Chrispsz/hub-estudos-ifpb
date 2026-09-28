'use client';

// chat-code — Blocos de código no chat do Tutor (pedido do dono, 27/09/2026):
// "quero quebra de linha e colar o código formatado para a IA — um bloco pra
// mensagem e outro pra código, e receber tudo organizado".
//
// Compartilhado entre o chat principal (study-view) e o painel rápido dos PDFs
// (tutor-quick-panel): a bolha do ALUNO renderiza ``` blocos com o MESMO
// CodeBlock rico das respostas da IA — mensagem e código sempre organizados.

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CodeBlock } from '@/components/hub/code-block';

/** Linguagens do bloco de código — as mesmas do CodeBlock (code-highlight). */
export type ChatCodeLang = 'c' | 'portugol' | 'html' | 'texto';

export const CODE_LANG_LABEL: Record<ChatCodeLang, string> = {
  c: 'C',
  portugol: 'Portugol',
  html: 'HTML',
  texto: 'Texto',
};

/** Detecta a linguagem pelo conteúdo colado (sinais fortes; sem chute fraco). */
export function detectCodeLang(code: string): ChatCodeLang | null {
  if (/#[ \t]*include|printf\s*\(|scanf\s*\(|void\s+main|int\s+main|#define\s/.test(code)) return 'c';
  if (/<\/?(html|head|body|div|section|ul|li|p|a)\b/i.test(code)) return 'html';
  if (/\balgoritmo\b|\bescreva\s*\(|\binicio\b|\bfimse\b|\bse\s+\S+\s+entao\b|\bfimenquanto\b/i.test(code))
    return 'portugol';
  return null;
}

/** Quebra a mensagem em segmentos: texto puro e blocos ```lang ... ```. */
export function splitCodeSegments(
  text: string,
): Array<{ type: 'text' | 'code'; lang?: string; body: string }> {
  const segments: Array<{ type: 'text' | 'code'; lang?: string; body: string }> = [];
  const re = /```([a-zA-Z]*)[ \t]*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', body: text.slice(last, m.index) });
    segments.push({ type: 'code', lang: m[1] || undefined, body: m[2].replace(/\n$/, '') });
    last = re.lastIndex;
  }
  if (last < text.length) segments.push({ type: 'text', body: text.slice(last) });
  return segments;
}

/**
 * Conteúdo da bolha do usuário: texto (pre-wrap, quebras preservadas) +
 * CodeBlock para cada bloco ``` — o mesmo visual das respostas da IA.
 */
export function UserBubbleContent({ content }: { content: string }) {
  const segments = React.useMemo(() => splitCodeSegments(content), [content]);
  if (!segments.some((s) => s.type === 'code')) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }
  return (
    <div className="space-y-2">
      {segments.map((s, i) =>
        s.type === 'text' ? (
          <p key={i} className="whitespace-pre-wrap">
            {s.body}
          </p>
        ) : (
          <CodeBlock key={i} code={s.body} language={s.lang} className={cn('text-left')} />
        ),
      )}
    </div>
  );
}
