'use client';

/**
 * Lab de Código — Card de diagnóstico de erro
 * --------------------------------------------
 * "Além de só executar e ter uma falha na cara" (áudio do dono, 18/10/2026).
 * Toda falha do Lab ganha UM card com:
 *   - badge do tipo ("Erro de compilação" / "Erro em execução" / "Algo inesperado")
 *     + a linha do erro em destaque (font-mono);
 *   - a mensagem original do interpretador (já é pedagógica);
 *   - UMA dica curta de causa provável (pure function diagnoseClabError);
 *   - o próximo gesto: corrigir a linha destacada no editor e rodar de novo.
 *
 * O editor (code-editor.tsx) já pinta o fundo da linha do erro — este card
 * aponta para ela. Puro presente; a régua fica em lib/clab/diagnose.ts.
 */
import { Lightbulb, MousePointerClick } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { diagnoseClabError } from '@/lib/clab/diagnose';

export type ClabDiagnosticKind = 'parse' | 'runtime' | 'unexpected';

const BADGE: Record<ClabDiagnosticKind, string> = {
  parse: 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
  runtime: 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
  unexpected: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
};

const BADGE_TEXT: Record<ClabDiagnosticKind, string> = {
  parse: 'Erro de compilação',
  runtime: 'Erro em execução',
  unexpected: 'Algo inesperado',
};

export function DiagnosticCard({
  kind,
  message,
  line,
}: {
  kind: ClabDiagnosticKind;
  message: string;
  line?: number;
}) {
  const hint = kind === 'unexpected'
    ? 'Tente simplificar este trecho: comente metade do código, rode e vá descomentando por partes até achar a linha culpada.'
    : diagnoseClabError(message);

  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-900 dark:bg-rose-950/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={BADGE[kind]}>{BADGE_TEXT[kind]}</Badge>
        {typeof line === 'number' && line > 0 && (
          <span className="rounded border border-rose-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-rose-700 dark:border-rose-800 dark:bg-zinc-950 dark:text-rose-300">
            linha {line}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-sm font-medium leading-snug text-rose-900 dark:text-rose-200">
        {message}
      </p>

      <p className="mt-2 flex items-start gap-1.5 rounded-md border-l-2 border-teal-500 bg-teal-50 p-2 text-xs leading-snug text-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
        <span>
          <strong className="font-semibold">Dica:</strong> {hint}
        </span>
      </p>

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MousePointerClick className="size-3.5 shrink-0" aria-hidden />
        {kind === 'unexpected'
          ? 'Se persistir, abra o tutor e cole este trecho para analisar junto.'
          : 'Corrija a linha destacada no editor e rode de novo.'}
      </p>
    </div>
  );
}
