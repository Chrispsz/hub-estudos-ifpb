'use client';

// Laboratório de código — console JS + preview HTML ao vivo, DENTRO do Hub.
//
// Algoritmos: rodar lógica em JS (console capturado, await permitido) sem
// trocar de janela. Linguagens de Marcação: ver o HTML renderizado na hora
// (iframe sandbox="allow-scripts", sem acesso ao Hub). Erro no código?
// Um clique manda código + erro para o tutor IA — a integração fecha o ciclo
// "escrevi → quebrei → perguntei → corrigi" sem sair da aba Estudar.

import * as React from 'react';
import {
  Code2,
  Eraser,
  FileCode2,
  Play,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface OutputLine {
  kind: 'log' | 'warn' | 'error' | 'system';
  text: string;
}

const JS_STARTER = `// Teste sua lógica aqui — console.log aparece abaixo.
// await é permitido (roda como async).
const notas = [7.5, 8.0, 6.5];
const media = notas.reduce((a, n) => a + n, 0) / notas.length;
console.log('Média:', media.toFixed(2));
`;

const HTML_STARTER = `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="font-family: sans-serif">
    <h1>Minha página de teste</h1>
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
    </ul>
  </body>
</html>
`;

function formatValue(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === 'function' ? '[fn]' : val), 1)
      ?.replace(/\n\s*/g, ' ') ?? String(v);
  } catch {
    return String(v);
  }
}

export function CodeLab({
  disciplineShort,
  defaultTab = 'js',
  onAskTutor,
}: {
  disciplineShort: string;
  /** 'html' para Linguagens de Marcação; 'js' para o resto. */
  defaultTab?: 'js' | 'html';
  /** Envia código (+ erro) direto ao tutor da disciplina. */
  onAskTutor?: (question: string) => void;
}) {
  const [tab, setTab] = React.useState<'js' | 'html'>(defaultTab);
  const [jsCode, setJsCode] = React.useState(JS_STARTER);
  const [htmlCode, setHtmlCode] = React.useState(HTML_STARTER);
  const [lines, setLines] = React.useState<OutputLine[]>([]);
  const [running, setRunning] = React.useState(false);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = React.useState('');

  const pushLine = (kind: OutputLine['kind'], text: string) =>
    setLines((prev) => [...prev.slice(-120), { kind, text }]);

  const runJs = async () => {
    setRunning(true);
    setLastError(null);
    setLines([{ kind: 'system', text: '▶ executando…' }]);
    const captured: OutputLine[] = [];
    const fakeConsole = {
      log: (...a: unknown[]) => captured.push({ kind: 'log', text: a.map(formatValue).join(' ') }),
      info: (...a: unknown[]) => captured.push({ kind: 'log', text: a.map(formatValue).join(' ') }),
      warn: (...a: unknown[]) => captured.push({ kind: 'warn', text: a.map(formatValue).join(' ') }),
      error: (...a: unknown[]) => captured.push({ kind: 'error', text: a.map(formatValue).join(' ') }),
    };
    let err: string | null = null;
    try {
      // AsyncFunction: suporta await no nível principal do snippet.
      // Assinatura dupla: o construtor recebe o corpo e devolve uma FUNÇÃO
      // chamável (por isso o retorno é (...args) => Promise, não só void).
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor as new (
        ...args: string[]
      ) => (...args: unknown[]) => Promise<void>;
      const fn = new AsyncFn('console', '"use strict";\n' + jsCode);
      await Promise.race([
        fn(fakeConsole),
        new Promise((_, rej) => window.setTimeout(() => rej(new Error('Tempo esgotado (10s) — loop infinito?')), 10_000)),
      ]);
    } catch (e) {
      err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      captured.push({ kind: 'error', text: err });
    }
    setLines(captured.length ? captured : [{ kind: 'system', text: '(sem saída — use console.log)' }]);
    setLastError(err);
    setRunning(false);
  };

  const runHtml = () => setPreviewDoc(htmlCode);

  const askTutor = () => {
    if (!onAskTutor) return;
    if (tab === 'js') {
      const q = [
        `Fiz este código JavaScript no Laboratório do Hub (estou estudando ${disciplineShort}):`,
        '```js',
        jsCode,
        '```',
        lastError
          ? `Deu este erro: ${lastError}. Por que aconteceu e como corrigir?`
          : 'Revise o código: está correto? Como você escreveria de forma mais clara?',
      ].join('\n');
      onAskTutor(q);
    } else {
      const q = [
        `Escrevi este HTML no Laboratório do Hub (estou estudando ${disciplineShort}):`,
        '```html',
        htmlCode,
        '```',
        'Valide a estrutura (tags, atributos, semântica) e sugira melhorias conforme o material da disciplina.',
      ].join('\n');
      onAskTutor(q);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="size-4 text-emerald-400" />
            Laboratório de código
          </CardTitle>
          <CardDescription>
            Teste lógica em JS ou veja HTML renderizado — sem sair do Hub
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'js' | 'html')}>
          <TabsList className="h-9">
            <TabsTrigger value="js" className="gap-1.5 text-xs">
              <SquareTerminal className="size-3.5" /> Console JS
            </TabsTrigger>
            <TabsTrigger value="html" className="gap-1.5 text-xs">
              <FileCode2 className="size-3.5" /> Preview HTML
            </TabsTrigger>
          </TabsList>

          {/* ---------- Console JS ---------- */}
          <TabsContent value="js" className="space-y-3">
            <textarea
              value={jsCode}
              onChange={(e) => setJsCode(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void runJs();
                }
              }}
              spellCheck={false}
              rows={7}
              aria-label="Editor de código JavaScript"
              className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] p-3 font-mono text-xs leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-500/50"
              placeholder="console.log('olá')"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => void runJs()}
                disabled={running}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Play className="size-3.5" /> Rodar
                <kbd className="ml-1 hidden rounded bg-white/15 px-1 text-[10px] sm:inline">Ctrl+↵</kbd>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLines([]);
                  setLastError(null);
                }}
              >
                <Eraser className="size-3.5" /> Limpar console
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={askTutor}
                className="border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 dark:text-emerald-400"
              >
                <Sparkles className="size-3.5" /> Perguntar ao tutor sobre este código
              </Button>
            </div>
            <div
              className="max-h-40 min-h-16 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed [scrollbar-width:thin]"
              aria-live="polite"
              aria-label="Saída do console"
            >
              {lines.length === 0 ? (
                <p className="text-muted-foreground/60">console — a saída aparece aqui</p>
              ) : (
                lines.map((l, i) => (
                  <pre
                    key={i}
                    className={cn(
                      'whitespace-pre-wrap',
                      l.kind === 'error' && 'text-red-400',
                      l.kind === 'warn' && 'text-amber-400',
                      l.kind === 'system' && 'text-muted-foreground',
                      l.kind === 'log' && 'text-foreground/90',
                    )}
                  >
                    {l.kind === 'error' ? '✖ ' : l.kind === 'warn' ? '▲ ' : ''}
                    {l.text}
                  </pre>
                ))
              )}
            </div>
          </TabsContent>

          {/* ---------- Preview HTML ---------- */}
          <TabsContent value="html" className="space-y-3">
            <textarea
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  runHtml();
                }
              }}
              spellCheck={false}
              rows={7}
              aria-label="Editor de código HTML"
              className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] p-3 font-mono text-xs leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-500/50"
              placeholder="<h1>Olá</h1>"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={runHtml}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Play className="size-3.5" /> Renderizar
                <kbd className="ml-1 hidden rounded bg-white/15 px-1 text-[10px] sm:inline">Ctrl+↵</kbd>
              </Button>
              <Button size="sm" variant="outline" onClick={askTutor}
                className="border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 dark:text-emerald-400"
              >
                <Sparkles className="size-3.5" /> Validar com o tutor
              </Button>
            </div>
            {previewDoc ? (
              <iframe
                title="Prévia do HTML"
                sandbox="allow-scripts"
                srcDoc={previewDoc}
                className="h-56 w-full rounded-lg border border-white/10 bg-white"
              />
            ) : (
              <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-muted-foreground">
                Clique em Renderizar para ver a página
              </div>
            )}
          </TabsContent>
        </Tabs>

        {lastError && (
          <p className="flex items-center gap-1.5 text-xs text-amber-500">
            <TriangleAlert className="size-3.5 shrink-0" />
            Errou? "Perguntar ao tutor" já leva código + erro prontos.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
