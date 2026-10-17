'use client';

// triage-card.tsx — FILA ESSENCIAL (Task 219, pedido do dono:
// "o algoritmo deve ser inteligente... guiar perfeitamente durante todo o curso;
// eu não quero plano de recuperação, eu quero algoritmo inteligente").
//
// O card mostra a TRIAGEM do motor (study-triage.ts) — os três baldes:
//   · FOCO    — onde a casa compromete os blocos do dia (máx. 3);
//   · MANTER  — manutenção leve (não zerar);
//   · EM ESPERA — estacionado com motivo, vigiado pelo radar (não apagado).
// Tudo derivado de dados reais: datas oficiais, tipo de avaliação, dívida de
// prática (perfil do curso × seu histórico), CH e prioridade. Hidratação
// segura (mesmo padrão do radar/grade: `now` só depois do mount).

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crosshair, CircleCheck, PauseCircle, Flame, Footprints, FilePenLine, ListChecks } from 'lucide-react';
import { useStudyProgress } from '@/lib/study-progress';
import { computeTriage, triageHeadlinePhrase, type TriageEntry } from '@/lib/study-triage';
import { facilityMapOf } from '@/lib/learning-signals';
import { escadaPosicao, oldMaterialAdvice } from '@/lib/content-strategy';
import { suggestPractice, superficieLabel, type PracticeSuggestion } from '@/lib/practice-methods';
import { degrauProvaAviso } from '@/lib/mastery';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { getDisciplineByCode } from '@/data/course-data';

function iconFor(code: string): string {
  return getDisciplineByCode(code)?.icon ?? 'book';
}

const BUCKET_META = {
  foco: {
    label: 'Foco',
    icon: <Flame className="size-3.5 text-orange-500" aria-hidden />,
    chip: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
    hint: 'os blocos do dia vão aqui — máximo 3 na cabeça',
  },
  manter: {
    label: 'Manter',
    icon: <CircleCheck className="size-3.5 text-emerald-500" aria-hidden />,
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    hint: 'toque leve para não zerar',
  },
  espera: {
    label: 'Em espera',
    icon: <PauseCircle className="size-3.5 text-muted-foreground" aria-hidden />,
    chip: 'border-muted bg-muted/40 text-muted-foreground',
    hint: 'sem prazo e em dia — o radar vigia e traz de volta quando a prova/nota chegar',
  },
} as const;

function ReasonChips({ e }: { e: TriageEntry }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {e.reasons.slice(0, 2).map((r) => (
        <span
          key={r}
          className="rounded-full border border-muted bg-muted/40 px-1.5 py-px text-[10px] text-muted-foreground"
        >
          {r}
        </span>
      ))}
      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-px text-[10px] text-violet-600 dark:text-violet-400">
        {e.perfilPratica === 'pratica'
          ? 'prática a cada 2d'
          : e.perfilPratica === 'mista'
            ? 'prática a cada 3d'
            : 'teoria — 1 toque/semana'}
      </span>
    </div>
  );
}

/**
 * Camada 2+3 do motor (Task 219 — "o que praticar hoje, como e por quê") +
 * a prova de aprendizagem (Task 220 — "como vou ter certeza de que aprendi?"):
 * para uma matéria do foco, devolve a posição na escada de conteúdo, o método
 * de prática com evidência, o veredito do material anterior e — quando o
 * degrau atual está marcado mas sem evidência — o alerta honesto.
 */
interface PracticePlan {
  fraseEscada: string | null;
  sugestao: PracticeSuggestion;
  materialAnterior: string | null;
  /** O degrau atual está 'só marcado' (check completo, zero prática registrada)? */
  degrauSemProva: string | null;
}

function practicePlanFor(
  e: TriageEntry,
  progress: ReturnType<typeof useStudyProgress>['progress'],
  nuncaPraticou: boolean,
): PracticePlan | null {
  const d = getDisciplineByCode(e.code);
  if (!d) return null;
  const topicProgress = progress.topicProgress[e.code] ?? {};
  const pos = escadaPosicao(d, topicProgress);
  const all = d.conteudoProgramatico.flatMap((u) => u.topicos);
  const feitos = all.filter((t) => topicProgress[t] === true).length;
  const sugestao = suggestPractice({
    d,
    evalKind: e.eval?.kind,
    evalDaysLeft: e.eval?.daysLeft,
    debtDays: e.debtDays,
    topicosFeitos: feitos,
    topicosTotal: all.length,
    nuncaPraticou,
  });
  const adv = oldMaterialAdvice(d, pos, topicProgress);
  // TASK 220 — a prova de aprendizagem mora na fila: a escada nunca aponta
  // para unidade toda marcada (quem marca tudo sobe), então o "só marquei"
  // aparece onde é REAL — degrau de trás fechado no check sem evidência, ou
  // degrau atual com checks parciais e zero prática. O helper acusa sozinho.
  const degrauSemProva = pos
    ? degrauProvaAviso(e.code, pos, progress, sugestao.method.nome)
    : null;
  return {
    fraseEscada: pos?.frase ?? null,
    sugestao,
    // Só aparece quando a casa tem um MANDATO ("volte e feche a lacuna") —
    // 'apoio' e 'nao' são o estado neutro e não merecem linha no card.
    materialAnterior: adv.verdict === 'sim' ? adv.motivo : null,
    degrauSemProva,
  };
}

/** Método + escada + mandato do material anterior + prova de aprendizagem. */
function PracticeDetail({ e, sp }: { e: TriageEntry; sp: ReturnType<typeof useStudyProgress>['progress'] }) {
  const plan = practicePlanFor(
    e,
    sp,
    !sp.disciplineProgress[e.code]?.lastStudiedAt,
  );
  if (!plan) return null;
  const m = plan.sugestao.method;
  return (
    <div className="mt-1.5 space-y-1 border-l-2 border-violet-500/30 pl-2" data-t="practice-detail">
      <p
        className="flex items-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-300"
        title={`${m.quando} · ${m.evidencia}`}
      >
        <Footprints className="size-3 shrink-0" aria-hidden />
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-px">
          {m.nome}
        </span>
        <span className="text-[10px] font-normal text-muted-foreground">{superficieLabel(m.superficie)}</span>
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground" title={m.passos.join('\n')}>
        {plan.sugestao.primeiroPasso}
      </p>
      {plan.fraseEscada && <p className="text-[10px] leading-snug text-muted-foreground">{plan.fraseEscada}</p>}
      {plan.degrauSemProva && (
        <p
          className="flex items-start gap-1 text-[10px] leading-snug text-amber-700 dark:text-amber-400"
          data-t="degrau-sem-prova"
          title="Marcar concluído é o seu aviso; a certeza de que aprendeu vem da evidência — resolver sem ajuda é a prova (mastery)."
        >
          <ListChecks className="mt-px size-3 shrink-0" aria-hidden />
          {plan.degrauSemProva}
        </p>
      )}
      {plan.materialAnterior && (
        <p className="flex items-start gap-1 text-[10px] leading-snug text-amber-700 dark:text-amber-400">
          <FilePenLine className="mt-px size-3 shrink-0" aria-hidden />
          {plan.materialAnterior}
        </p>
      )}
    </div>
  );
}

function TriageRow({ e, top, sp }: { e: TriageEntry; top: boolean; sp: ReturnType<typeof useStudyProgress>['progress'] }) {
  const meta = BUCKET_META[e.bucket];
  return (
    <li className={`flex items-start gap-2 ${top ? '' : 'opacity-90'}`}>
      <DisciplineIcon
        name={iconFor(e.code)}
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-1.5 text-xs font-medium leading-tight">
          {e.shortName}
          {top && (
            <span
              className={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${meta.chip}`}
            >
              manda agora
            </span>
          )}
        </p>
        <ReasonChips e={e} />
        {e.bucket === 'foco' && <PracticeDetail e={e} sp={sp} />}
      </div>
    </li>
  );
}

export function TriageCard() {
  const sp = useStudyProgress();
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
  }, []);

  // FACILIDADE REAL (Task 226): os sinais das questões entram na régua da
  // fila — puxada pesa mais, fluida respira (memo próprio, dep = progresso).
  const facility = React.useMemo(() => facilityMapOf(sp.progress), [sp.progress]);
  const triage = React.useMemo(
    () =>
      now
        ? computeTriage({
            topicProgress: sp.progress.topicProgress,
            disciplineProgress: sp.progress.disciplineProgress,
            customEvaluations: sp.progress.customEvaluations,
            facility,
            now,
          })
        : null,
    [now, sp.progress.topicProgress, sp.progress.disciplineProgress, sp.progress.customEvaluations, facility],
  );

  const headline = triage ? triageHeadlinePhrase(triage) : null;
  const showEspera = Boolean(triage && triage.espera.length > 0);

  return (
    <Card data-t="triagem-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crosshair className="size-4 text-violet-500" aria-hidden />
          Fila essencial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {headline && (
          <p className="text-xs leading-relaxed text-muted-foreground" data-t="triagem-headline">
            O motor decidiu: <b className="font-semibold text-foreground">{headline}</b> — os
            motivos abaixo derivam das datas oficiais, do tipo de avaliação, do perfil
            prático de cada matéria, do seu histórico e de como o conteúdo de cada matéria
            se constrói (escada, acúmulo, assunto novo, fluência). Recalculado todo dia, do
            1º ao 6º período.
          </p>
        )}

        {triage && (
          <>
            {(['foco', 'manter'] as const).map((bucket) => {
              const list = triage[bucket];
              if (list.length === 0) return null;
              const meta = BUCKET_META[bucket];
              return (
                <div key={bucket}>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                    {meta.icon}
                    {meta.label}
                    <span className="font-normal text-muted-foreground">· {meta.hint}</span>
                  </p>
                  <ul className="space-y-2" data-t={`triagem-${bucket}`}>
                    {list.map((e, i) => (
                      <TriageRow key={e.code} e={e} top={bucket === 'foco' && i === 0} sp={sp.progress} />
                    ))}
                  </ul>
                </div>
              );
            })}

            {showEspera && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                  {BUCKET_META.espera.icon}
                  Em espera
                  <span className="font-normal text-muted-foreground">
                    · {BUCKET_META.espera.hint}
                  </span>
                </p>
                <ul className="space-y-1.5" data-t="triagem-espera">
                  {triage.espera.map((e) => (
                    <li key={e.code} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DisciplineIcon name={iconFor(e.code)} className="size-3 shrink-0" />
                      <span className="font-medium text-foreground/70">{e.shortName}</span>
                      <span className="text-[10px]">estacionada — volta no D-21 da prova dela</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {!triage && <p className="text-xs text-muted-foreground">Calculando a fila…</p>}
      </CardContent>
    </Card>
  );
}
