'use client';

/**
 * Lab de Código — o laboratório interativo de C do hub
 * -----------------------------------------------------
 * Escreva (ou escolha um exemplo do material), rode e avance passo a passo
 * vendo variáveis, memória dos vetores, pilha de chamadas e a saída.
 *
 * "E se...?" — pause em qualquer passo, edite uma variável e o Lab recalcula
 * o futuro da execução a partir dali. É o método PRIMM dentro do site:
 * Preveja → Rode → Investigue → Modifique → Crie.
 *
 * 221-c — UM LAB SÓ: o antigo "Laboratório de código" (Console JS / Preview
 * HTML) que vivia dentro do Tutor IA entrou aqui como abas secundárias;
 * a aba padrão segue sendo o lab de C.
 *
 * 228-b — C É A CASA (áudio do dono, 18/10/2026): JS/HTML saem do TabsList de
 * mesmo nível e viram um seletor de Ambiente discreto, claramente secundário.
 * Toda falha ganha um CARD DE DIAGNÓSTICO (linha destacada + dica de causa +
 * próximo gesto) e cada rodada alimenta a telemetria local "onde você erra
 * mais" — nada de "só executar e ter uma falha na cara".
 */

import * as React from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, CircleHelp, Eraser, Eye, FileCode2, FlaskConical, Lightbulb,
  Pause, Pencil, Play, SkipBack, SkipForward, SquareTerminal, TerminalSquare,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CodeEditor } from '@/components/clab/code-editor';
import { DiagnosticCard } from '@/components/clab/diagnostic-card';
import { ErrorStatsPanel } from '@/components/clab/error-stats-panel';
import { CodeLab as HubCodeLab } from '@/components/hub/code-lab';
import { openTutor } from '@/lib/hub-events';
import { cn } from '@/lib/utils';
import { ClabEngine, CLAB_EXAMPLES, type ClabSnapshot, type ViewVar } from '@/lib/clab';
import {
  readClabErrorStats, recordClabError, recordClabSuccess, resetClabErrorStats,
  totalClabErrors, type ClabErrorStats,
} from '@/lib/clab/error-stats';

const STORAGE_KEY = 'clab-state-v1';

const PRIMM = [
  { p: 'Preveja', d: 'Antes de rodar, diga em voz alta o que o programa vai imprimir.' },
  { p: 'Rode', d: 'Execute e compare com a sua previsão. Errou? Melhor ainda — investigue por quê.' },
  { p: 'Investigue', d: 'Avance passo a passo e observe cada variável mudando na memória.' },
  { p: 'Modifique', d: 'Mude o código ou use o "E se...?" para editar uma variável no meio da execução.' },
  { p: 'Crie', d: 'Parta do exemplo e escreva sua própria versão resolvendo o exercício do material.' },
];

type LabStatus = 'idle' | 'running' | 'done' | 'error' | 'parse';

/** Abas do nível de página: lab de C (padrão) + o lab antigo em duas abas. */
type LabModo = 'c' | 'js' | 'html';

interface EditTarget { f: number; name: string; path: number[] | null }

export function CodeLab() {
  const [code, setCode] = React.useState(CLAB_EXAMPLES[0].code);
  const [stdin, setStdin] = React.useState('');
  const [exampleId, setExampleId] = React.useState<string>(CLAB_EXAMPLES[0].id);
  const [showInput, setShowInput] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const [modo, setModo] = React.useState<LabModo>('c');

  const engineRef = React.useRef<ClabEngine | null>(null);
  const [snaps, setSnaps] = React.useState<ClabSnapshot[]>([]);
  const [k, setK] = React.useState(0);
  const kRef = React.useRef(0);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  const [tab, setTab] = React.useState('vars');
  const [status, setStatus] = React.useState<LabStatus>('idle');
  const [parseErr, setParseErr] = React.useState<{ message: string; line: number } | null>(null);
  const [editing, setEditing] = React.useState<EditTarget | null>(null);
  const roteiroRef = React.useRef<HTMLDivElement>(null);

  // 228-b — telemetria local "onde você erra mais": lida do localStorage
  // (clab-error-stats-v1) e atualizada a cada rodada que falha ou termina limpa.
  const [stats, setStats] = React.useState<ClabErrorStats | null>(null);
  // 228-b — nenhum erro some sem explicação: catch genérico ganha card próprio.
  const [unexpected, setUnexpected] = React.useState<{ message: string } | null>(null);
  React.useEffect(() => setStats(readClabErrorStats()), []);

  // restaura o último estado do editor
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { code?: string; stdin?: string; exampleId?: string };
      if (s.code) setCode(s.code);
      if (typeof s.stdin === 'string') setStdin(s.stdin);
      if (s.exampleId) setExampleId(s.exampleId);
    } catch { /* localStorage indisponível */ }
  }, []);

  // persiste a cada mudança
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, stdin, exampleId }));
    } catch { /* sem espaço */ }
  }, [code, stdin, exampleId]);

  const setKBoth = React.useCallback((v: number) => {
    kRef.current = v;
    setK(v);
  }, []);

  const syncFromEngine = React.useCallback((eng: ClabEngine) => {
    const list = [...eng.snapshots];
    setSnaps(list);
    setKBoth(list.length - 1);
    const last = list[list.length - 1];
    if (last) setStatus(last.status === 'done' ? 'done' : last.status === 'error' ? 'error' : 'running');
  }, [setKBoth]);

  const run = React.useCallback(() => {
    setUnexpected(null);
    const r = ClabEngine.prepare(code, stdin);
    if (!r.ok) {
      setParseErr({ message: r.message, line: r.line });
      setStatus('parse');
      setSnaps([]);
      setKBoth(0);
      engineRef.current = null;
      setPlaying(false);
      setStats(recordClabError(r.message)); // telemetria: falha de compilação conta (228-b)
      return;
    }
    setParseErr(null);
    try {
      r.engine.runToEnd();
    } catch (err) {
      // erro NUNCA some sem explicação: catch genérico ganha card "Algo inesperado"
      setUnexpected({ message: err instanceof Error ? err.message : String(err) });
      setPlaying(false);
      return;
    }
    engineRef.current = r.engine;
    syncFromEngine(r.engine);
    setPlaying(false);
    setTab('vars');
    // telemetria semi-automática (228-b): cada Rodar é uma rodada —
    // limpo soma reforço positivo; falha é categorizada pela régua do diagnóstico.
    const last = r.engine.snapshots[r.engine.snapshots.length - 1];
    if (last?.status === 'error' && last.errorMsg) setStats(recordClabError(last.errorMsg));
    else if (last?.status === 'done') setStats(recordClabSuccess());
  }, [code, stdin, syncFromEngine, setKBoth]);

  /** Um passo; se a pessoa voltou na timeline, reescreve o futuro a partir dali. */
  const stepOnce = React.useCallback(() => {
    setUnexpected(null);
    let eng = engineRef.current;
    if (!eng || eng.status !== 'running') {
      const r = ClabEngine.prepare(code, stdin);
      if (!r.ok) {
        setParseErr({ message: r.message, line: r.line });
        setStatus('parse');
        setPlaying(false);
        setStats(recordClabError(r.message)); // telemetria (228-b)
        return;
      }
      setParseErr(null);
      eng = r.engine;
      engineRef.current = eng;
      setSnaps([...eng.snapshots]);
      setKBoth(0);
      setStatus('running');
    }
    const wasRunning = eng.status === 'running';
    if (kRef.current < eng.snapshots.length - 1) eng.forkFrom(kRef.current);
    try {
      eng.step();
    } catch (err) {
      setUnexpected({ message: err instanceof Error ? err.message : String(err) });
      setPlaying(false);
      return;
    }
    syncFromEngine(eng);
    // transição running→erro NESTA rodada de passos: registra uma vez só (228-b)
    if (wasRunning && eng.status === 'error') {
      const last = eng.snapshots[eng.snapshots.length - 1];
      if (last?.errorMsg) setStats(recordClabError(last.errorMsg));
    }
  }, [code, stdin, syncFromEngine, setKBoth]);

  const stepRef = React.useRef(stepOnce);
  React.useEffect(() => { stepRef.current = stepOnce; }, [stepOnce]);

  // reprodução automática — cada novo passo reagenda o próximo
  React.useEffect(() => {
    if (!playing) return;
    const last = snaps[snaps.length - 1];
    if (last && last.status !== 'running') { setPlaying(false); return; }
    const t = setTimeout(() => stepRef.current(), 900 / speed);
    return () => clearTimeout(t);
  }, [playing, k, speed, snaps]);

  const reset = React.useCallback(() => {
    engineRef.current = null;
    setSnaps([]);
    setKBoth(0);
    setStatus('idle');
    setParseErr(null);
    setUnexpected(null);
    setPlaying(false);
  }, [setKBoth]);

  const loadExample = React.useCallback((id: string) => {
    const ex = CLAB_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setExampleId(ex.id);
    setCode(ex.code);
    setStdin(ex.stdin ?? '');
    setShowInput(!!ex.stdin);
    reset();
  }, [reset]);

  const canEdit = snaps.length > 0 && snaps[k]?.status === 'running';

  /** "E se...?": restaura o passo k, aplica a edição e recalcula o resto. */
  const applyEdit = React.useCallback((t: EditTarget, raw: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    const forkAt = kRef.current;
    eng.forkFrom(forkAt);
    const res = eng.editVar(t.f, t.name, t.path, raw);
    if (!res.ok) {
      toast.error(res.error ?? 'Valor inválido');
      return;
    }
    eng.runToEnd();
    syncFromEngine(eng);
    // o "E se...?" também é uma execução: alimenta a mesma telemetria (228-b)
    const last = eng.snapshots[eng.snapshots.length - 1];
    if (last?.status === 'error' && last.errorMsg) setStats(recordClabError(last.errorMsg));
    else if (last?.status === 'done') setStats(recordClabSuccess());
    setEditing(null);
    toast.success(`Futuro recalculado a partir do passo ${forkAt + 1}`, {
      description: `"E se...?" — ${t.name} mudou e a execução seguiu outro caminho.`,
    });
  }, [syncFromEngine]);

  const seek = React.useCallback((v: number) => {
    setPlaying(false);
    setKBoth(v);
  }, [setKBoth]);

  const cur = snaps[k];

  // roteiro acompanha o passo atual
  React.useEffect(() => {
    const el = roteiroRef.current;
    if (el && tab === 'roteiro') {
      const active = el.querySelector('[data-active="true"]');
      active?.scrollIntoView({ block: 'nearest' });
    }
  }, [k, tab]);

  // o badge reflete o PASSO atual (ao navegar na timeline, o fim deixa de ser "terminou")
  const stepStatus: LabStatus = snaps.length && cur
    ? cur.status === 'done' ? 'done' : cur.status === 'error' ? 'error' : 'running'
    : status;
  const statusBadge = (() => {
    switch (stepStatus) {
      case 'idle': return <Badge variant="outline" className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">pronto para editar</Badge>;
      case 'running': return <Badge className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">pausado no passo {k + 1}</Badge>;
      case 'done': return <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">programa terminou</Badge>;
      case 'error': return <Badge className="border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">erro na execução</Badge>;
      case 'parse': return <Badge className="border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">erro de sintaxe</Badge>;
    }
  })();

  return (
    <div className="mx-auto w-full max-w-[1760px]">
      {/* C É A CASA (228-b): o lab de C é o título e o conteúdo padrão. O antigo
          "Laboratório de código" (Console JS / Preview HTML) SAI do TabsList de
          mesmo nível e vira um seletor de Ambiente discreto, ao lado do título —
          claramente secundário, sem competir com o C. Os chips PRIMM continuam
          exclusivos do modo C. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-start gap-2 text-lg font-bold tracking-tight sm:text-xl">
            <TerminalSquare className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="min-w-0">Lab de C — rode passo a passo, veja variáveis e memória</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Do material direto para a prática: escreva, rode, avance linha a linha — e quando algo falhar, o Lab aponta a linha, dá a dica e registra onde você mais erra.
          </p>
          {modo === 'c' && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Extras para experimentos: Console JS e Preview HTML — troque no seletor <strong className="font-medium">Ambiente</strong> ao lado; eles ficam longe do C de propósito.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">Ambiente</span>
          <Select value={modo} onValueChange={(v) => setModo(v as LabModo)}>
            <SelectTrigger size="sm" className="h-8 text-xs" aria-label="Ambiente do Lab — C é o padrão">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="c">
                <span className="flex items-center gap-1.5"><TerminalSquare className="size-3.5" aria-hidden /> C passo a passo (padrão)</span>
              </SelectItem>
              <SelectItem value="js">
                <span className="flex items-center gap-1.5"><SquareTerminal className="size-3.5" aria-hidden /> Console JS (extra)</span>
              </SelectItem>
              <SelectItem value="html">
                <span className="flex items-center gap-1.5"><FileCode2 className="size-3.5" aria-hidden /> Preview HTML (extra)</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={modo} onValueChange={(v) => setModo(v as LabModo)}>

        {/* ===== Modo padrão: lab de C (a casa) ===== */}
        <TabsContent value="c" className="mt-4 space-y-4">
          {/* chips PRIMM + ajuda — o método do Lab, só no modo C */}
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRIMM.map((s, i) => (
                <Tooltip key={s.p}>
                  <TooltipTrigger asChild>
                    <span className={cn(
                      'cursor-help rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      i === 0 && 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-300',
                      i === 1 && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
                      i === 2 && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
                      i === 3 && 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
                      i === 4 && 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300',
                    )}>
                      {i + 1}. {s.p}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56 text-xs">{s.d}</TooltipContent>
                </Tooltip>
              ))}
              <Button variant="ghost" size="icon" className="ml-auto size-7" onClick={() => setShowHelp((v) => !v)} aria-label="Como usar o Lab">
                <CircleHelp className="size-4" />
              </Button>
            </div>
          </TooltipProvider>

          {/* 228-b — painel "onde você erra mais": só existe quando há ≥ 1 erro registrado */}
          {stats && totalClabErrors(stats) > 0 && (
            <ErrorStatsPanel stats={stats} onReset={() => setStats(resetClabErrorStats())} />
          )}

          <Collapsible open={showHelp} onOpenChange={setShowHelp}>
            <CollapsibleContent>
              <Card className="border-dashed">
                <CardContent className="grid gap-3 p-4 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-semibold text-foreground">Como usar</p>
                    <ol className="list-decimal space-y-0.5 pl-4">
                      <li>Escolha um exemplo do material (à esquerda) ou escreva o seu na caixa de código.</li>
                      <li>Se o programa usa <code className="rounded bg-muted px-1 font-mono text-xs">scanf</code>, preencha o painel <strong>Entrada</strong>.</li>
                      <li><strong>Rodar</strong> executa tudo; <strong>Passo</strong> avança uma ação por vez (a nota âmbar explica o que aconteceu).</li>
                      <li>Na timeline, volte a qualquer passo e observe de novo.</li>
                    </ol>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold text-foreground">Truques do Lab</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      <li><strong>E se...?</strong> — com o programa pausado, clique no valor de uma variável e edite: o resto da execução é recalculado. Perfeito para entender laços e condições.</li>
                      <li><strong>Pilha de chamadas</strong> — funções aparecem como escopos; recursão empilha visivelmente.</li>
                      <li>Chamadas que são a instrução inteira (ou o lado direito do =/return) aparecem passo a passo; chamadas dentro de contas maiores rodam de uma vez.</li>
                      <li>Atalho: <kbd className="rounded border bg-muted px-1 font-mono text-xs">Ctrl</kbd>+<kbd className="rounded border bg-muted px-1 font-mono text-xs">Enter</kbd> roda o programa.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* grade principal — FHD em 3 colunas */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,540px)]">
            {/* ============ coluna 1 (FHD): exemplos do material ============ */}
            <Card className="order-3 flex flex-col self-start lg:col-span-2 2xl:order-1 2xl:col-span-1">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Lightbulb className="size-4 text-amber-500" aria-hidden />
                    Exemplos do material
                  </h3>
                  <Badge variant="outline" className="text-[10px]">Algoritmos · TEC.1687</Badge>
                </div>
                <div className="max-h-[320px] overflow-y-auto p-2 2xl:max-h-[640px] clab-scroll">
                  {['Unidade 1', 'Unidade 2', 'Funções & extras'].map((grupo) => (
                    <div key={grupo} className="mb-2">
                      <p className="px-2 pb-1 pt-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{grupo}</p>
                      <div className="space-y-1">
                        {CLAB_EXAMPLES.filter((e) => e.grupo === grupo).map((ex) => (
                          <button
                            key={ex.id}
                            onClick={() => loadExample(ex.id)}
                            className={cn(
                              'w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent',
                              exampleId === ex.id
                                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50'
                                : 'border-transparent bg-zinc-50 dark:bg-zinc-900/60',
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{ex.titulo}</span>
                              {ex.stdin && <Badge variant="outline" className="shrink-0 text-[9px]">usa entrada</Badge>}
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{ex.descricao}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ============ coluna 2 (FHD): editor ============ */}
            <Card className="order-1 flex flex-col 2xl:order-2">
              <CardContent className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">main.c</span>
                  {statusBadge}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button size="sm" onClick={run} className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600">
                      <Play className="size-3.5" aria-hidden /> Rodar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setPlaying(false); stepOnce(); }} className="h-8 gap-1.5">
                      <SkipForward className="size-3.5" aria-hidden /> Passo
                    </Button>
                    <Button size="sm" variant="ghost" onClick={reset} className="h-8 gap-1.5" aria-label="Limpar execução">
                      <Eraser className="size-3.5" aria-hidden /> Limpar
                    </Button>
                  </div>
                </div>

                {/* seletor rápido de exemplo (mobile/tablet) */}
                <div className="2xl:hidden">
                  <Select value={exampleId} onValueChange={loadExample}>
                    <SelectTrigger className="h-8 text-xs" aria-label="Escolher exemplo do material">
                      <SelectValue placeholder="Escolher exemplo do material" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Unidade 1', 'Unidade 2', 'Funções & extras'].map((g) => (
                        <SelectGroup key={g}>
                          <SelectLabel>{g}</SelectLabel>
                          {CLAB_EXAMPLES.filter((e) => e.grupo === g).map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.titulo}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <CodeEditor
                  code={code}
                  onChange={(v) => { setCode(v); setExampleId(''); if (status !== 'idle') reset(); }}
                  currentLine={cur?.line && status !== 'idle' ? cur.line : undefined}
                  errorLine={status === 'parse' ? parseErr?.line : cur?.status === 'error' ? cur.errorLine : undefined}
                  onRun={run}
                />

                {status === 'parse' && parseErr && (
                  <DiagnosticCard kind="parse" message={parseErr.message} line={parseErr.line} />
                )}
                {unexpected && <DiagnosticCard kind="unexpected" message={unexpected.message} />}

                {/* entrada do scanf */}
                <Collapsible open={showInput} onOpenChange={setShowInput}>
                  <div className="flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                        <Eye className="size-3.5" aria-hidden /> Entrada (scanf) {stdin.trim() ? `· ${stdin.trim().split(/\s+/).length} valor(es)` : '· vazia'}
                      </Button>
                    </CollapsibleTrigger>
                    <span className="min-w-0 text-[11px] text-muted-foreground sm:inline">valores na ordem, separados por espaço ou linha</span>
                  </div>
                  <CollapsibleContent>
                    <textarea
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      rows={3}
                      spellCheck={false}
                      aria-label="Entrada para o scanf"
                      placeholder={'7 5\nou um valor por linha...'}
                      className="mt-2 w-full resize-y rounded-md border bg-zinc-50 p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-zinc-950"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* ============ coluna 3 (FHD): execução / visualização ============ */}
            <Card className="order-2 flex flex-col self-start 2xl:order-3">
              <CardContent className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                {/* transporte */}
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="size-7" disabled={!snaps.length} onClick={() => seek(0)} aria-label="Primeiro passo">
                    <SkipBack className="size-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="size-7" disabled={!snaps.length || k === 0} onClick={() => seek(k - 1)} aria-label="Passo anterior">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={!snaps.length || (cur?.status !== 'running' && k >= snaps.length - 1)}
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? 'Pausar' : 'Reproduzir passos'}
                  >
                    {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </Button>
                  <Button variant="outline" size="icon" className="size-7" disabled={!snaps.length || k >= snaps.length - 1} onClick={() => { setPlaying(false); setKBoth(k + 1); }} aria-label="Próximo passo (só avança a visualização)">
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="size-7" disabled={!snaps.length} onClick={() => { setPlaying(false); setKBoth(snaps.length - 1); }} aria-label="Último passo">
                    <SkipForward className="size-3.5" />
                  </Button>
                  <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
                    <SelectTrigger className="h-7 w-[74px] text-xs" aria-label="Velocidade da reprodução">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">0.5×</SelectItem>
                      <SelectItem value="1">1×</SelectItem>
                      <SelectItem value="2">2×</SelectItem>
                      <SelectItem value="4">4×</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {snaps.length ? `passo ${k + 1}/${snaps.length}` : 'sem execução'}
                  </span>
                </div>

                <Slider
                  value={[k]}
                  max={Math.max(0, snaps.length - 1)}
                  step={1}
                  onValueChange={(v) => seek(v[0] ?? 0)}
                  disabled={!snaps.length}
                  aria-label="Linha do tempo da execução"
                  className="[&_[role=slider]]:size-3.5 [&_[role=slider]]:border-emerald-600 [&_[role=slider]]:bg-emerald-600 [&_[data-slot=slider-range]]:bg-emerald-500"
                />

                {/* nota do passo atual */}
                <div className="min-h-[52px] rounded-md border-l-4 border-amber-400 bg-amber-50 p-2.5 text-sm leading-snug text-amber-950 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100" aria-live="polite">
                  {cur ? (
                    <>
                      <span className="mr-1.5 inline-block rounded bg-amber-200/80 px-1 font-mono text-[10px] font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                        L{cur.line}
                      </span>
                      {cur.note}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Clique em <strong>Rodar</strong> para executar tudo, ou <strong>Passo</strong> para avançar ação por ação.
                    </span>
                  )}
                </div>

                {cur?.status === 'error' && cur.errorMsg && (
                  <DiagnosticCard kind="runtime" message={cur.errorMsg} line={cur.errorLine} />
                )}

                {/* painéis */}
                <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
                  <TabsList className="grid h-8 w-full grid-cols-3">
                    <TabsTrigger value="vars" className="gap-1 text-xs"><FlaskConical className="size-3.5" aria-hidden />Variáveis</TabsTrigger>
                    <TabsTrigger value="out" className="gap-1 text-xs"><TerminalSquare className="size-3.5" aria-hidden />Saída</TabsTrigger>
                    <TabsTrigger value="roteiro" className="gap-1 text-xs"><Eye className="size-3.5" aria-hidden />Roteiro</TabsTrigger>
                  </TabsList>

                  <TabsContent value="vars" className="mt-2 min-h-0 flex-1">
                    <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1 2xl:max-h-[460px] clab-scroll">
                      {cur ? (
                        cur.frames.map((f, fi) => (
                          <div key={fi} className="rounded-lg border bg-zinc-50/60 dark:bg-zinc-900/40">
                            <div className="flex items-center justify-between border-b px-3 py-1.5">
                              <span className="font-mono text-xs font-bold">
                                {f.isGlobal ? 'global · fora das funções' : `${f.fn}()`}
                              </span>
                              {!f.isGlobal && fi === cur.frames.length - 1 && (
                                <Badge variant="outline" className="text-[9px]">topo da pilha</Badge>
                              )}
                            </div>
                            <div className="space-y-1 p-2">
                              {f.vars.length === 0 && <p className="px-1 text-xs italic text-muted-foreground">sem variáveis neste escopo</p>}
                              {f.vars.map((v) => (
                                <VarRow
                                  key={v.name}
                                  v={v}
                                  frameIdx={fi}
                                  editable={canEdit}
                                  editing={editing}
                                  setEditing={setEditing}
                                  onCommit={applyEdit}
                                />
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                          Quando o programa rodar, cada variável aparece aqui com tipo, valor e endereço — e os vetores viram células de memória.
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                        <Pencil className="size-3" aria-hidden />
                        Programa pausado: clique num valor para editar e ver o futuro mudar (&quot;E se...?&quot;).
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="out" className="mt-2 min-h-0 flex-1">
                    <div className="max-h-[340px] min-h-[180px] overflow-y-auto rounded-md bg-zinc-900 p-3 font-mono text-[13px] leading-5 text-emerald-300 dark:bg-black/80 clab-scroll 2xl:max-h-[460px]">
                      {cur?.output ? (
                        <pre className="whitespace-pre-wrap">{cur.output}{cur.status === 'running' && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-emerald-400 align-middle" aria-hidden />}</pre>
                      ) : (
                        <p className="text-zinc-500">{cur ? '(o printf ainda não escreveu nada até este passo)' : '(rode o programa para ver a saída aqui)'}</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="roteiro" className="mt-2 min-h-0 flex-1">
                    <div ref={roteiroRef} className="max-h-[340px] space-y-0.5 overflow-y-auto pr-1 2xl:max-h-[460px] clab-scroll">
                      {snaps.slice(0, k + 1).map((s, i) => (
                        <button
                          key={i}
                          data-active={i === k}
                          onClick={() => seek(i)}
                          className={cn(
                            'flex w-full items-start gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent',
                            i === k && 'bg-amber-100/80 font-medium dark:bg-amber-950/50',
                          )}
                        >
                          <span className="mt-px w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                          <span className="mt-px w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">L{s.line}</span>
                          <span className="min-w-0 flex-1">{s.note}</span>
                        </button>
                      ))}
                      {!snaps.length && <p className="px-1 py-6 text-center text-sm text-muted-foreground">O roteiro da execução aparece aqui, passo a passo.</p>}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== Abas secundárias: o antigo laboratório do Hub. O tutor
            da disciplina não existe aqui dentro — "Perguntar ao tutor"
            dispara o tutor genérico (hub:open-tutor → chat da aba Estudar). */}
        <TabsContent value="js" className="mt-4">
          <HubCodeLab
            disciplineShort="programação"
            defaultTab="js"
            onAskTutor={(q) => openTutor({ question: q })}
          />
        </TabsContent>
        <TabsContent value="html" className="mt-4">
          <HubCodeLab
            disciplineShort="programação"
            defaultTab="html"
            onAskTutor={(q) => openTutor({ question: q })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
// ============================================================================
// Linha de variável (escalar editável / vetor em células)
// ============================================================================

function VarRow({
  v, frameIdx, editable, editing, setEditing, onCommit,
}: {
  v: ViewVar;
  frameIdx: number;
  editable: boolean;
  editing: EditTarget | null;
  setEditing: (t: EditTarget | null) => void;
  onCommit: (t: EditTarget, raw: string) => void;
}) {
  const [raw, setRaw] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isEditing = !!editing && editing.f === frameIdx && editing.name === v.name &&
    (editing.path === null) === (v.kind === 'scalar') &&
    (!editing.path || v.kind === 'array');

  React.useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  function startEdit(path: number[] | null, initial: string) {
    if (!editable) return;
    setRaw(initial);
    setEditing({ f: frameIdx, name: v.name, path });
  }

  function commit() {
    if (editing) onCommit(editing, raw);
  }

  const editableHint = editable ? 'cursor-pointer hover:ring-2 hover:ring-emerald-400/60' : '';

  return (
    <div className="px-1">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs font-bold">{v.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{v.type}</span>
        {v.alias && (
          <Badge variant="outline" className="px-1 py-0 text-[9px]" title={`Este vetor é o mesmo da função que chamou: ${v.alias}`}>
            ref → {v.alias}
          </Badge>
        )}
        <span className="ml-auto font-mono text-[10px] text-zinc-400 dark:text-zinc-600" title="Endereço didático — em C, cada variável mora num endereço de memória">{v.addr}</span>
      </div>

      {v.kind === 'scalar' ? (
        isEditing ? (
          <input
            ref={inputRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(null); }}
            onBlur={commit}
            className="mt-0.5 w-28 rounded border border-emerald-400 bg-white px-1.5 py-0.5 font-mono text-xs outline-none ring-2 ring-emerald-400/40 dark:bg-zinc-950"
            aria-label={`Novo valor para ${v.name}`}
          />
        ) : (
          <button
            onClick={() => startEdit(null, v.uninitialized ? '' : v.value ?? '')}
            disabled={!editable}
            className={cn('mt-0.5 rounded px-1 font-mono text-sm', editableHint, v.uninitialized ? 'text-rose-600 italic dark:text-rose-400' : 'text-emerald-800 dark:text-emerald-300')}
            title={editable ? 'Clique para editar e recalcular o futuro ("E se...?")' : 'Avance o programa e pause para editar'}
          >
            {v.uninitialized ? '? sem valor ainda' : v.value}
          </button>
        )
      ) : (
        <div className="mt-1 space-y-1">
          {v.strText !== undefined && (
            <p className="font-mono text-xs text-amber-700 dark:text-amber-300">
              texto: &quot;{v.strText}&quot; <span className="text-[10px] text-muted-foreground">(termina no \0)</span>
            </p>
          )}
          {v.rows ? (
            // matriz: linhas empilhadas
            v.rows.map((row, r) => (
              <div key={r} className="flex items-center gap-1">
                <span className="w-5 text-right font-mono text-[9px] text-muted-foreground">{r}</span>
                {row.map((cell, c) => (
                  <CellBox
                    key={c}
                    display={cell}
                    idx={[r, c]}
                    editable={editable && !v.alias}
                    active={isEditing && editing?.path && editing.path[0] === r && editing.path[1] === c}
                    onStart={() => startEdit([r, c], cell === '?' ? '' : cell)}
                    raw={raw}
                    setRaw={setRaw}
                    onCommit={commit}
                    onCancel={() => setEditing(null)}
                    isChar={v.base === 'char'}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {v.cells?.map((cell, i) => (
                <CellBox
                  key={i}
                  display={cell}
                  idx={[i]}
                  editable={editable && !v.alias}
                  active={isEditing && editing?.path?.[0] === i}
                  onStart={() => startEdit([i], cell === '?' ? '' : cell)}
                  raw={raw}
                  setRaw={setRaw}
                  onCommit={commit}
                  onCancel={() => setEditing(null)}
                  isChar={v.base === 'char'}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CellBox({
  display, editable, active, onStart, raw, setRaw, onCommit, onCancel, isChar,
}: {
  display: string;
  idx: number[];
  editable: boolean;
  active: boolean;
  onStart: () => void;
  raw: string;
  setRaw: (s: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  isChar: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (active) inputRef.current?.select(); }, [active]);
  const isNull = display === '\\0';
  const isHole = display === '?';
  return (
    <span className="inline-flex flex-col items-center">
      {active ? (
        <input
          ref={inputRef}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel(); }}
          onBlur={onCommit}
          className="h-7 w-9 rounded border border-emerald-400 bg-white text-center font-mono text-[11px] outline-none ring-2 ring-emerald-400/40 dark:bg-zinc-950"
          aria-label="Novo valor da célula"
        />
      ) : (
        <button
          onClick={onStart}
          disabled={!editable}
          className={cn(
            'grid h-7 w-9 place-items-center rounded border font-mono text-[11px] transition-colors',
            isNull && 'border-dashed bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600',
            isHole && 'border-rose-300 bg-rose-50 text-rose-500 dark:border-rose-900 dark:bg-rose-950/40',
            !isNull && !isHole && (isChar
              ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
              : 'border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200'),
            editable && !active && 'cursor-pointer hover:ring-2 hover:ring-emerald-400/60',
          )}
          title={editable ? `Editar ${display} — o resto da execução será recalculado` : display}
        >
          {display}
        </button>
      )}
      <span className="font-mono text-[8px] text-zinc-400 dark:text-zinc-600">{isNull ? 'term.' : ''}</span>
    </span>
  );
}
