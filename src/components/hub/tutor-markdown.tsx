'use client';

// Renderizador de markdown compartilhado do Tutor IA — usado no chat da aba
// Estudar, no painel rápido dos PDFs e em qualquer nova superfície do tutor.
// Garante saída estruturada e consistente: negrito em destaque, blocos de código
// ricos (CodeBlock: sintaxe C/Portugol/HTML + copiar + linhas), listas legíveis,
// tabelas com scroll e MATEMÁTICA RENDERIZADA (KaTeX): $x^2$, $$\begin{pmatrix}…$$.

import * as React from 'react';
import { Check, CopyPlus, Layers } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { extractTutorCards, makeIaCard } from '@/lib/tutor-cards';
import { useStudyProgress } from '@/lib/study-progress';
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

// t198 — COSTURA DO LATEX DE IA: visto em produção, o modelo de turno às vezes
// solta uma matriz com \end{pmatrix} mas sem o \begin{pmatrix} correspondente
// (a abertura ficou fora do trecho que o parser enxergou) — o KaTeX estoura
// "Expected 'EOF', got '&'" e o aluno leva um span vermelho no meio da aula.
// Costura: para cada \end{env} sem \begin{env} pareado, se existir $$ ABERTO
// (nº ímpar de $$ antes dele), injeta \begin{env} logo depois dessa abertura.
// Construção manual por matchAll — o replace() só troca o trecho casado e
// NÃO deixaria editar o texto anterior ao match (a abertura $$ vem antes).
// Regra de segurança: sem $$ aberto, não inventa ponto ( LaTeX sã intocado).
const MATH_ENV_RE =
  /\\end\{(pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|matrix|cases|array|aligned|align)\}/g;

function repairOrphanMathEnds(src: string): string {
  const matches = [...src.matchAll(MATH_ENV_RE)];
  if (matches.length === 0) return src;
  let out = '';
  let cursor = 0;
  for (const m of matches) {
    const offset = m.index;
    if (offset === undefined || offset < cursor) continue;
    const env = m[1];
    const before = src.slice(0, offset);
    const opens = before.split(`\\begin{${env}}`).length - 1;
    const closes = before.split(`\\end{${env}}`).length - 1;
    if (opens > closes) continue; // pareado — nada a fazer
    const delimCount = before.split('$$').length - 1;
    if (delimCount % 2 !== 1) continue; // sem $$ aberto — não inventa ponto
    const injectAt = before.lastIndexOf('$$') + 2;
    out += src.slice(cursor, injectAt) + `\\begin{${env}} `;
    cursor = injectAt; // o corpo e o \end seguem no fluxo normal
  }
  return out + src.slice(cursor);
}

interface TutorMarkdownProps {
  content: string;
  /** Cor de destaque (tailwind text class). Padrão: esmeralda do tutor. */
  accent?: string;
  className?: string;
  /**
   * Opt-in: detecta cartões "FRENTE:/VERSO:" escritos pela IA e oferece
   * "salvar no baralho" com 1 clique (ciclo erro → reensino → cartão).
   * Ativo SÓ nas superfícies de conversa — nunca no verso do flashcard,
   * nas fórmulas do card da prova etc. (que renderizam conteúdo já salvo).
   */
  enableCards?: boolean;
  /** Disciplina que o cartão salvo herda (baralho é agrupado por disciplina). */
  disciplineCode?: string;
}

function TutorMarkdownImpl({
  content,
  accent = 'text-emerald-400',
  className,
  enableCards = false,
  disciplineCode,
}: TutorMarkdownProps) {
  // Protege o cifrão do "R$" do pareamento de math ($...$): vira escape markdown
  // (R\$) que o remark-math ignora e o CommonMark renderiza como "$" literal.
  // Depois, costura LaTeX de IA mal formado (t198) — matriz órfã sem \begin.
  const prepared = React.useMemo(
    () => repairOrphanMathEnds(content.replace(/R\$/g, 'R\\$')),
    [content],
  );

  const remarkPlugins = React.useMemo<PluggableList>(() => [remarkGfm, remarkMath], []);
  // Opções do plugin em TUPLA aninhada ([plugin, options]) — no formato plano o
  // react-markdown interpreta o objeto de opções como "preset" e quebra.
  const rehypePlugins = React.useMemo<PluggableList>(
    () => [[rehypeKatex, { throwOnError: false, errorColor: '#f87171', strict: false }]],
    [],
  );

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
      // Mensagens antigas podem trazer "---" decorativo — renderiza como
      // divisor quase invisível em vez de uma régua pesada no meio da conversa.
      hr: () => <hr className="my-2 border-border/30" />,
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
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {prepared}
      </ReactMarkdown>
      {enableCards ? <CardSaveBar content={content} disciplineCode={disciplineCode} /> : null}
    </div>
  );
}

// ---------- Salvar no baralho: a IA escreve o cartão, 1 clique arquiva ----------

function CardSaveBar({
  content,
  disciplineCode,
}: {
  content: string;
  disciplineCode?: string;
}) {
  const sp = useStudyProgress();
  const [saved, setSaved] = React.useState(false);
  const cards = React.useMemo(
    () => extractTutorCards(content),
    [content],
  );
  if (cards.length === 0) return null;

  const save = () => {
    if (!disciplineCode) return;
    sp.addFlashcards(cards.map((c) => makeIaCard(disciplineCode, c.front, c.back)));
    setSaved(true);
    toast.success(
      cards.length === 1
        ? 'Cartão salvo no baralho — revise na aba Praticar!'
        : `${cards.length} cartões salvos no baralho — revise na aba Praticar!`,
    );
  };

  return (
    <div
      data-no-export
      className={cn(
        'mt-2 rounded-lg border border-dashed p-2.5 transition-colors',
        saved
          ? 'border-emerald-400/60 bg-emerald-500/[0.07]'
          : 'border-teal-400/50 bg-teal-500/[0.06] hover:bg-teal-500/[0.09]',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md',
            saved
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
          )}
          aria-hidden
        >
          {saved ? <Check className="size-3.5" /> : <Layers className="size-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug">
            {saved
              ? cards.length === 1
                ? 'Cartão salvo no baralho'
                : `${cards.length} cartões salvos no baralho`
              : cards.length === 1
                ? 'O tutor preparou um cartão para o seu baralho'
                : `O tutor preparou ${cards.length} cartões para o seu baralho`}
          </p>
          {!saved && cards.length > 0 ? (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={cards[0].front}>
              {cards.length === 1 ? 'Frente: ' : '1ª frente: '}
              {cards[0].front}
            </p>
          ) : null}
        </div>
        {!saved && (
          <Button
            size="sm"
            variant="outline"
            disabled={!disciplineCode}
            onClick={save}
            title={
              disciplineCode
                ? 'Salvar no baralho de revisão espaçada (aba Praticar)'
                : 'Sem disciplina de contexto para arquivar o cartão'
            }
            className="h-7 shrink-0 gap-1 rounded-full border-teal-400/60 bg-transparent px-2.5 text-[11px] text-teal-700 transition-all hover:bg-teal-500/15 hover:scale-[1.03] focus-visible:ring-teal-500/50 active:scale-95 dark:border-teal-500/50 dark:text-teal-300 dark:hover:bg-teal-500/20 dark:hover:text-teal-200"
            aria-label={`Salvar ${cards.length === 1 ? 'o cartão' : `${cards.length} cartões`} no baralho de revisão espaçada`}
          >
            <CopyPlus className="size-3" aria-hidden />
            Salvar no baralho
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Export memoizado: no chat, digitar no input re-renderiza o painel inteiro —
 * memo evita re-parsear o markdown das mensagens anteriores
 * (content/accent/className são primitivos, comparação barata).
 */
export const TutorMarkdown = React.memo(TutorMarkdownImpl);
