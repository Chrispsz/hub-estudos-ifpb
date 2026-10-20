'use client';

/**
 * FlowChartView — o fluxograma desenhado (SVG zero-dependência)
 * --------------------------------------------------------------
 * Recebe o FlowChart do src/lib/clab/flowchart.ts (gerado da AST) e desenha
 * os símbolos clássicos: oval de início/fim, retângulo de processo,
 * losango de decisão, paralelogramo de entrada/saída e as setas com
 * Sim/Não. Arestas tracejadas = volta de laço / continue.
 *
 * `activeLine` acende o nó/aresta da linha que está rodando na timeline do
 * Lab — o fluxograma vira o MAPA da execução: você vê o programa andando
 * nos desenhos que o professor faz no quadro.
 *
 * Botão PNG para colar no caderno (a prova é no papel — desenhar à mão
 * começa por olhar o desenho certo).
 */
import * as React from 'react';
import { ImageDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlowChart, FlowNode } from '@/lib/clab/flowchart';

interface FlowChartViewProps {
  chart: FlowChart;
  /** Linha do código em execução (timeline do Lab) — acende o nó. */
  activeLine?: number | null;
  className?: string;
}

const EDGE_CLASS =
  'stroke-zinc-400 dark:stroke-zinc-500';
const EDGE_ACTIVE_CLASS = 'stroke-emerald-500 dark:stroke-emerald-400';
const EDGE_DASH_CLASS = 'stroke-amber-500/80 dark:stroke-amber-400/70';

function edgeClass(dashed: boolean | undefined, active: boolean): string {
  if (active) return EDGE_ACTIVE_CLASS;
  return dashed ? EDGE_DASH_CLASS : EDGE_CLASS;
}

const NODE_SHAPE: Record<
  FlowNode['kind'],
  { shape: 'stadium' | 'rect' | 'diamond' | 'io' | 'circle'; cls: string; textCls: string }
> = {
  start: { shape: 'stadium', cls: 'fill-emerald-600 stroke-emerald-700', textCls: 'fill-white' },
  end: { shape: 'stadium', cls: 'fill-zinc-800 stroke-zinc-900 dark:fill-zinc-700 dark:stroke-zinc-600', textCls: 'fill-white' },
  process: { shape: 'rect', cls: 'fill-white stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-600', textCls: 'fill-zinc-700 dark:fill-zinc-200' },
  decision: { shape: 'diamond', cls: 'fill-amber-50 stroke-amber-400 dark:fill-amber-950/70 dark:stroke-amber-500/80', textCls: 'fill-amber-900 dark:fill-amber-100' },
  io: { shape: 'io', cls: 'fill-teal-50 stroke-teal-500/70 dark:fill-teal-950/60 dark:stroke-teal-500/70', textCls: 'fill-teal-900 dark:fill-teal-100' },
  return: { shape: 'rect', cls: 'fill-rose-50 stroke-rose-400 dark:fill-rose-950/50 dark:stroke-rose-500/70', textCls: 'fill-rose-900 dark:fill-rose-100' },
  merge: { shape: 'circle', cls: 'fill-zinc-300 stroke-zinc-400 dark:fill-zinc-600 dark:stroke-zinc-500', textCls: '' },
};

function NodeShape({ n, active }: { n: FlowNode; active: boolean }) {
  const spec = NODE_SHAPE[n.kind];
  const cls = cn(spec.cls, active && 'stroke-emerald-500 dark:stroke-emerald-400');
  const glow = active ? { filter: 'drop-shadow(0 0 6px rgb(16 185 129 / 0.55))' } : undefined;

  if (spec.shape === 'circle') {
    return <circle cx={n.x} cy={n.y} r={n.w / 2} className={cls} strokeWidth={1.5} style={glow} />;
  }
  if (spec.shape === 'diamond') {
    const pts = `${n.x},${n.y - n.h / 2} ${n.x + n.w / 2},${n.y} ${n.x},${n.y + n.h / 2} ${n.x - n.w / 2},${n.y}`;
    return <polygon points={pts} className={cls} strokeWidth={1.5} style={glow} />;
  }
  if (spec.shape === 'io') {
    const k = 12;
    const pts = `${n.x - n.w / 2 + k},${n.y - n.h / 2} ${n.x + n.w / 2},${n.y - n.h / 2} ${n.x + n.w / 2 - k},${n.y + n.h / 2} ${n.x - n.w / 2},${n.y + n.h / 2}`;
    return <polygon points={pts} className={cls} strokeWidth={1.5} style={glow} />;
  }
  const rx = spec.shape === 'stadium' ? n.h / 2 : 10;
  return <rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx={rx} className={cls} strokeWidth={1.5} style={glow} />;
}

export function FlowChartView({ chart, activeLine, className }: FlowChartViewProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = React.useState(false);

  if (chart.nodes.length === 0) {
    return (
      <div className={cn('flex min-h-40 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground', className)}>
        Este fluxo é grande demais para desenhar com clareza — estude-o por partes (função por função).
      </div>
    );
  }

  const exportPng = async () => {
    const el = wrapRef.current;
    if (!el || exporting) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, { pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `fluxograma-${chart.fn}.png`;
      a.click();
    } catch {
      // exportação é bônus — falha silenciosa não pode atrapalhar o estudo
    } finally {
      setExporting(false);
    }
  };

  const labelFontSize = 10.5;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={exportPng}
        disabled={exporting}
        aria-label="Baixar fluxograma como PNG"
        title="Baixar PNG (para o caderno)"
        className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-md border bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
      >
        <ImageDown className="size-3.5" aria-hidden="true" />
      </button>

      <div ref={wrapRef} className="overflow-x-auto rounded-lg border bg-zinc-50/60 [scrollbar-width:thin] dark:bg-black/40 clab-scroll">
        <svg
          role="img"
          aria-label={`Fluxograma da função ${chart.signature}`}
          width={chart.width}
          height={chart.height}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="block"
          style={{ minWidth: Math.min(chart.width, 640) }}
        >
          <defs>
            <marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" className="fill-zinc-400 dark:fill-zinc-500" />
            </marker>
            <marker id="fc-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" className="fill-emerald-500 dark:fill-emerald-400" />
            </marker>
            <marker id="fc-arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" className="fill-amber-500/80 dark:fill-amber-400/70" />
            </marker>
          </defs>

          {/* arestas primeiro (ficam sob os nós) */}
          {chart.edges.map((e) => {
            const active = activeLine != null && e.line === activeLine;
            const d = e.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const marker = active ? 'fc-arrow-active' : e.dashed ? 'fc-arrow-amber' : 'fc-arrow';
            let label: React.ReactNode = null;
            if (e.label) {
              const p0 = e.points[0];
              const p1 = e.points[1] ?? p0;
              const lx = (p0.x + p1.x) / 2 + (p0.x === p1.x ? 8 : 0);
              const ly = (p0.y + p1.y) / 2 - (p0.x === p1.x ? 0 : 7);
              label = (
                <text x={lx} y={ly} textAnchor="middle" fontSize={labelFontSize} className={cn('font-mono', active ? 'fill-emerald-600 dark:fill-emerald-400 font-semibold' : 'fill-zinc-500 dark:fill-zinc-400')}>
                  {e.label}
                </text>
              );
            }
            return (
              <g key={e.id}>
                <path
                  d={d}
                  fill="none"
                  strokeWidth={active ? 2 : 1.5}
                  strokeDasharray={e.dashed ? '5 4' : undefined}
                  markerEnd={`url(#${marker})`}
                  className={edgeClass(e.dashed, active)}
                />
                {label}
              </g>
            );
          })}

          {/* nós */}
          {chart.nodes.map((n) => {
            const active = activeLine != null && n.line === activeLine;
            const spec = NODE_SHAPE[n.kind];
            const lineH = 14;
            const startY = n.y - ((n.lines.length - 1) * lineH) / 2 + 3.5;
            return (
              <g key={n.id}>
                <NodeShape n={n} active={active} />
                {n.lines.map((ln, i) => (
                  <text
                    key={i}
                    x={n.x}
                    y={startY + i * lineH}
                    textAnchor="middle"
                    fontSize={labelFontSize}
                    className={cn('font-mono', spec.textCls)}
                  >
                    {ln}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
