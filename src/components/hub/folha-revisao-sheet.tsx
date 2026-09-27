'use client';

/**
 * FOLHA DE REVISÃO — Av1 de Matemática (rota /folha-revisao).
 *
 * A "última milha" em PAPEL: o dono estuda e revisa com material impresso
 * (as listas são impressas, a ordem de estudo foi planejada para as 3 folhas).
 * Esta folha leva para o papel o que o Hub já organiza na tela:
 *   1. Cabeçalho — prova, data, meta e o escopo REAL da Av1
 *   2. Fórmulas essenciais (MATH_FORMULAS, KaTeX) — Matrizes primeiro
 *   3. Checklist de domínio (MATH_CHECKLIST) — sincronizado com o card da
 *      prova (mesma chave hub:math-exam:v1:checklist e mesmas keys)
 *   4. Kit do dia da prova (MATH_EXAM_KIT) + plano da véspera (D-1 do plano)
 *   + FOCO DO SIMULADO (useSimuladoFoco): o tópico mais fraco da tentativa
 *      de prova mais recente — a promessa "o bloco com mais erros vira a
 *      revisão de amanhã" impressa — e o bloco "refazer primeiro" das travadas.
 * QUEBRA DE PÁGINA DETERMINÍSTICA: página 1 = cabeçalho + fórmulas; página 2 =
 * checklist + kit + véspera (break-before-page na seção do checklist).
 * A folha é SEMPRE "papel" (fundo branco, tinta escura) — WYSIWYG: o que se
 * vê na tela é o que sai da impressora, claro ou escuro o tema do app.
 */

import * as React from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TutorMarkdown } from '@/components/hub/tutor-markdown';
import { useLocalStorage } from '@/lib/use-local-storage';
import { cn } from '@/lib/utils';
import {
  MATH_CHECKLIST,
  MATH_EXAM,
  MATH_EXAM_KIT,
  MATH_EXAM_PLAN,
  MATH_FORMULAS,
  MATH_META,
  MATH_TRAVADAS_KEY,
  countTravadas,
  formatTravadas,
  normalizeTravadas,
} from '@/lib/math-exam-prep';
import { STUDY_PROGRESS_KEY, type SimuladoRun } from '@/lib/study-progress';

type CheckedMap = Record<string, boolean>;
const LS_CHECK = 'hub:math-exam:v1:checklist';

/**
 * FOCO DO SIMULADO NA FOLHA — a promessa do plano D-2 ("o bloco com mais
 * erros vira a revisão de amanhã") hoje morre na tela: a folha impressa da
 * véspera não sabia o resultado. Aqui a tentativa de prova de Matemática
 * mais recente (mode 'prova' + escopo TEC.1984, com detalhes por questão)
 * vira UM bloco em papel: o tópico mais fraco, a conta exata e a instrução.
 * Leitura SÓ-LEITURA do storage v2 — NUNCA usar o useLocalStorage nesta
 * chave: o hook persistiria o valor derivado POR CIMA do objeto completo
 * (runs, flashcards, notas, caderno) e destruiria o progresso.
 */
function useSimuladoFoco(): {
  date: string;
  worst: { topic: string; solved: number; total: number; pct: number };
  topics: { topic: string; pct: number }[];
  allGood: boolean;
} | null {
  const [runs, setRuns] = React.useState<SimuladoRun[]>([]);
  React.useEffect(() => {
    function read() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_KEY) || 'null');
        const candidate = parsed?.progress ?? parsed;
        const arr = candidate?.simuladoRuns;
        setRuns(Array.isArray(arr) ? arr : []);
      } catch {
        setRuns([]); // storage corrompido → folha sem foco (honesto, sem invenção)
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STUDY_PROGRESS_KEY) read();
    }
    read();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return React.useMemo(() => {
    const run = runs.find((r) => {
      if (r.mode !== 'prova') return false;
      if (r.filters?.discipline) return r.filters.discipline === MATH_EXAM.disciplineCode;
      return r.questions?.length
        ? r.questions.every((q) => q.disciplineCode === MATH_EXAM.disciplineCode)
        : false;
    });
    if (!run?.questions?.length) return null; // run antiga sem detalhes → não dá para saber o bloco
    const m = new Map<string, { solved: number; total: number }>();
    for (const q of run.questions) {
      if (!q.topic || !(MATH_EXAM.topicosEscopo as readonly string[]).includes(q.topic)) continue;
      const rec = m.get(q.topic) ?? { solved: 0, total: 0 };
      rec.total += 1;
      if (q.status === 'solved') rec.solved += 1;
      m.set(q.topic, rec);
    }
    if (m.size === 0) return null;
    const topics = [...m.entries()].map(([topic, v]) => ({
      topic,
      solved: v.solved,
      total: v.total,
      pct: Math.round((v.solved / v.total) * 100),
    }));
    const worst = [...topics].sort((a, b) => a.pct - b.pct || b.total - a.total)[0];
    return {
      date: run.date,
      worst,
      topics: topics.map(({ topic, pct }) => ({ topic, pct })),
      allGood: topics.every((t) => t.pct >= 80),
    };
  }, [runs]);
}

function fmtDayBR(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso));
}

export function FolhaRevisaoSheet() {
  // MESMA chave e MESMAS keys do card da prova (checklist vive uma vez só):
  // marcar aqui marca lá, e o que já foi marcado aparece preenchido na folha.
  const [checklist, setChecklist] = useLocalStorage<CheckedMap>(LS_CHECK, {});
  // Travadas das listas: MESMA chave do card da prova (espelho do papel).
  // Na folha é SÓ LEITURA — marcação acontece no Hub; aqui o registro vira
  // a lista "refazer primeiro" da véspera impressa.
  const [travadas] = useLocalStorage<Record<string, boolean>>(
    MATH_TRAVADAS_KEY,
    {},
    normalizeTravadas,
  );
  const travadasCount = countTravadas(travadas);
  const travadasTexto = formatTravadas(travadas);
  const simuladoFoco = useSimuladoFoco();

  // Data de impressão só no cliente (evita mismatch de hidratação).
  const [printedAt, setPrintedAt] = React.useState('');
  React.useEffect(() => {
    setPrintedAt(
      new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
        new Date(),
      ),
    );
  }, []);

  function toggleCheck(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const vespera = MATH_EXAM_PLAN.find((d) => d.offset === 1);
  const matrizes = MATH_FORMULAS.filter((f) => f.grupo === 'Matrizes');
  const logica = MATH_FORMULAS.filter((f) => f.grupo === 'Lógica');

  return (
    <div className="min-h-dvh bg-zinc-200/60 print:bg-white">
      {/* Barra de ações — só na tela (some na impressão) */}
      <div className="sticky top-0 z-10 border-b border-zinc-300/70 bg-zinc-100/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[840px] flex-wrap items-center gap-2 px-4 py-2.5">
          <a
            href="/"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Voltar ao Hub
          </a>
          <p className="hidden text-[11px] text-zinc-500 sm:block">
            Impressão: A4 · margens padrão · sem cabeçalhos do navegador
          </p>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="ml-auto gap-1.5 bg-zinc-900 text-white hover:bg-zinc-700"
            aria-label="Imprimir a folha de revisão"
          >
            <Printer className="size-3.5" aria-hidden /> Imprimir
          </Button>
        </div>
      </div>

      {/* A folha — papel WYSIWYG */}
      <main className="mx-auto max-w-[840px] px-3 py-5 print:max-w-none print:px-0 print:py-0">
        <article
          className="rounded-lg bg-white px-8 py-7 text-zinc-900 shadow-xl ring-1 ring-zinc-300/60 print:rounded-none print:px-0 print:py-0 print:shadow-none print:ring-0"
          aria-label="Folha de revisão da Av1 de Matemática"
        >
          {/* 1. Cabeçalho */}
          <header className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Hub de Estudos · IFPB ADS — Folha de revisão
              </p>
              <h1 className="mt-1 text-xl font-bold leading-tight print:text-lg">
                Av1 · Matemática Aplicada à Computação
              </h1>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Prova <strong className="tabular-nums">01/10/2026</strong> · aprovação ≥{' '}
                <strong className="tabular-nums">{MATH_META}</strong> · vale{' '}
                <strong>33,3%</strong> da média final
              </p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-zinc-900 text-[13px] font-bold text-white">
              Av1
            </span>
          </header>

          {/* Escopo real — o contrato do que cai, do jeito que o professor confirmou */}
          <section aria-label="Escopo da prova" className="mt-3 border-b border-zinc-200 pb-3">
            <p className="text-[10.5px] leading-relaxed text-zinc-700">
              <span className="font-semibold uppercase tracking-wide text-[9.5px] text-zinc-500">
                O que cai:{' '}
              </span>
              {MATH_EXAM.programa}
            </p>
          </section>

          {/* 2. Fórmulas — página 1 (Matrizes | Lógica em duas colunas) */}
          <section aria-label="Fórmulas essenciais" className="mt-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900">
              Fórmulas essenciais <span className="font-medium normal-case tracking-normal text-zinc-500">— recite de memória, confira aqui</span>
            </h2>
            <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
              {matrizes.map((f, i) => (
                <FormulaBox key={f.titulo} n={i + 1} titulo={f.titulo} corpo={f.corpo} math={f.math} grupo={f.grupo} />
              ))}
              {logica.map((f, i) => (
                <FormulaBox
                  key={f.titulo}
                  n={matrizes.length + i + 1}
                  titulo={f.titulo}
                  corpo={f.corpo}
                  math={f.math}
                  grupo={f.grupo}
                />
              ))}
            </div>
          </section>

          {/* 3. Checklist — PÁGINA 2 determinística (não depende do burner da impressora) */}
          <section aria-label="Checklist de domínio" className="print:break-before-page mt-5 print:mt-0 print:pt-2">
            <h2 className="border-t-2 border-zinc-900 pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900 print:border-t-2">
              Checklist de domínio <span className="font-medium normal-case tracking-normal text-zinc-500">— só entre na prova com tudo marcado</span>
            </h2>
            <p className="mt-1 text-[10px] text-zinc-500">
              Na tela, o quadradinho é clicável (fica salvo no Hub). No papel, marque à caneta.
            </p>
            <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              {MATH_CHECKLIST.map((g) => (
                <div
                  key={g.grupo}
                  className="break-inside-avoid rounded-md border border-zinc-200 px-3 py-2.5"
                >
                  <p className="text-[10.5px] font-bold text-zinc-800">{g.grupo}</p>
                  <ul className="mt-1.5 space-y-1">
                    {g.itens.map((item, i) => {
                      const key = `${g.grupo}-${i}`; // MESMA key do card da prova
                      const done = !!checklist[key];
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => toggleCheck(key)}
                            aria-pressed={done}
                            aria-label={`${done ? 'Desmarcar' : 'Marcar'}: ${item}`}
                            className="flex w-full items-start gap-2 rounded text-left transition-colors hover:bg-zinc-100 print:hover:bg-white"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                'mt-[1px] grid size-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px] font-bold leading-none',
                                done
                                  ? 'border-zinc-900 bg-zinc-900 text-white'
                                  : 'border-zinc-400 bg-white text-transparent',
                              )}
                            >
                              ✓
                            </span>
                            <span
                              className={cn(
                                'text-[10.5px] leading-snug',
                                done ? 'text-zinc-400 line-through' : 'text-zinc-800',
                              )}
                            >
                              {item}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Véspera + kit do dia */}
          <section aria-label="Véspera e kit do dia da prova" className="mt-5 border-t border-zinc-200 pt-3">
            {/* Foco do simulado — o resultado da prova de ontem vira a ordem do
                dia (mesma promessa do plano D-2, agora no papel). Acima das
                travadas: o simulado aconteceu DEPOIS das listas, é o sinal mais
                fresco. Some quando não há tentativa com detalhes (economia de papel). */}
            {simuladoFoco && (
              <div className="mb-3 break-inside-avoid rounded-md border border-zinc-300 border-l-4 border-l-zinc-900 bg-zinc-100 px-3 py-2">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900">
                  Foco do simulado · {fmtDayBR(simuladoFoco.date)}
                  <span className="rounded-full bg-zinc-900 px-1.5 py-px text-[9px] font-bold tabular-nums text-white">
                    {simuladoFoco.worst.pct}%
                  </span>
                </p>
                {simuladoFoco.allGood ? (
                  <p className="mt-1 text-[11px] leading-snug text-zinc-800">
                    Escopo em dia — todos os tópicos ≥ 80% (
                    {simuladoFoco.topics.map((t) => `${t.topic} ${t.pct}%`).join(' · ')}). Manter o
                    ritmo com os flashcards e a revisão leve da véspera.
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] leading-snug text-zinc-800">
                    <strong>{simuladoFoco.worst.topic}</strong> — {simuladoFoco.worst.solved} de{' '}
                    {simuladoFoco.worst.total} resolvidas ({simuladoFoco.worst.pct}%). Comece a
                    véspera por ele: refaça no papel as que errou, com os cards de fórmulas
                    fechados.
                  </p>
                )}
              </div>
            )}
            {travadasCount > 0 && travadasTexto && (
              <div className="mb-3 break-inside-avoid rounded-md border border-zinc-300 border-l-4 border-l-zinc-400 bg-zinc-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900">
                  Refazer primeiro · travadas ({travadasCount})
                </p>
                <p className="mt-1 text-[11px] font-medium leading-snug text-zinc-800">{travadasTexto}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {vespera && (
                <div className="break-inside-avoid">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900">
                    Véspera · 30/09 <span className="font-medium normal-case tracking-normal text-zinc-500">— {vespera.minutos} min</span>
                  </h3>
                  <ol className="mt-1.5 space-y-1">
                    {vespera.tarefas.map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-zinc-700">
                        <span className="mt-[1px] font-bold tabular-nums text-zinc-400">{i + 1}.</span>
                        <span>{t.texto}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="break-inside-avoid">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900">
                  Kit do dia da prova
                </h3>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {MATH_EXAM_KIT.map((k) => (
                    <li
                      key={k.label}
                      className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-700"
                    >
                      {k.emoji} {k.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] leading-snug text-zinc-500">
                  Na prova: leia o enunciado 2×, comece pelas fáceis e confira a inversa com
                  A·A⁻¹ = I.
                </p>
              </div>
            </div>
          </section>

          {/* Rodapé da folha */}
          <footer className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-200 pt-2 text-[9px] text-zinc-400">
            <span>Gerado pelo Hub de Estudos — hub-estudios-ifpb.vercel.app</span>
            <span className="tabular-nums">{printedAt || '\u00A0'}</span>
          </footer>
        </article>
      </main>
    </div>
  );
}

/** Caixa de fórmula compacta — numeração contínua, acento por grupo. */
function FormulaBox({
  n,
  titulo,
  corpo,
  math,
  grupo,
}: {
  n: number;
  titulo: string;
  corpo: string;
  math?: string[];
  grupo: string;
}) {
  const isMat = grupo === 'Matrizes';
  return (
    <div
      className={cn(
        'break-inside-avoid rounded-md border-l-[3px] border border-zinc-200 py-2 pl-2.5 pr-3',
        isMat ? 'border-l-rose-400' : 'border-l-sky-400',
      )}
    >
      <p className="flex items-baseline gap-1.5">
        <span className="text-[9px] font-bold tabular-nums text-zinc-400">
          {String(n).padStart(2, '0')}
        </span>
        <span className="text-[10.5px] font-bold text-zinc-900">{titulo}</span>
      </p>
      {math && (
        <div className="mt-0.5 rounded bg-zinc-50 px-2 py-1 print:bg-zinc-50">
          {math.map((line, i) => (
            <TutorMarkdown
              key={i}
              content={`$$${line}$$`}
              className="text-[11px] [&_.katex-display]:my-0.5"
            />
          ))}
        </div>
      )}
      <p className="mt-1 whitespace-pre-line text-[9.5px] leading-snug text-zinc-600">{corpo}</p>
    </div>
  );
}
