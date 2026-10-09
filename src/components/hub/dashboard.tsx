'use client';

// t180 — A CASA LIMPA (o pedido do dono: "eu só quero conseguir estudar").
//
// A home tem UMA função: colocar a pessoa para estudar no método único —
// LER com o tutor ao lado → RESOLVER as questões do professor no papel →
// ENSAIAR no simulado. Sem placares, sem prontidão, sem caixinhas para
// marcar, sem avisos empilhados: qualquer pessoa entende em 5 segundos.
//
// O que existia aqui (t195) e saiu de vez: ExamPrepCard (prontidão, plano
// completo, seguro de progresso), RecoveryCard (fila P0–P5), ExamTutorCard,
// TodayStudyCard (unidades com checkbox), KPIs de pomodoro/streak.
// As provas viram CONTEÚDO (a folha de questões é um material como outro
// qualquer) — não viram mais abas, cards ou modos especiais.

import * as React from 'react';
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  FileText,
  ListChecks,
  PenLine,
  Printer,
  Timer,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { disciplines, materials, type Material } from '@/data/course-data';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { getColorClasses } from '@/lib/discipline-colors';
import { openPractice, openProgress, openSimulado } from '@/lib/hub-events';
import { MATH_EXAM } from '@/lib/math-exam-prep';
import { daysUntilDate } from '@/lib/semester';
import { useStudyProgress } from '@/lib/study-progress';
import { PdfViewerDialog } from './pdf-viewer-dialog';

/** A folha da prova — as questões do professor como MATERIAL (t180). */
const FOLHA_DA_PROVA_ID = 'mat-av1-questoes-professor';

interface DashboardProps {
  /** Abre a aba Estudar (opcionalmente com disciplina/material selecionados). */
  onStartStudy: (disciplineCode?: string, materialId?: string) => void;
  /** Abre as Configurações (backup fica lá — nunca mais na cara da home). */
  onOpenSettings: () => void;
}

export function Dashboard({ onStartStudy, onOpenSettings }: DashboardProps) {
  const [folhaAberta, setFolhaAberta] = React.useState(false);
  const sp = useStudyProgress();

  const folha = materials.find((m) => m.id === FOLHA_DA_PROVA_ID) ?? null;

  // t198 — A DATA vira estado pós-mount: o servidor mora em UTC e o aluno em
  // Brasília — na virada do dia (21h–23h59 BRT) o daysLeft calculado no render
  // divergia entre SSR e navegador em 1 e o React estourava #418 (hidratação
  // de texto: "prova hoje" ≠ "prova amanhã"). SSR e 1º render do cliente
  // dividem o MESMO neutro (sem prova em foco); o efeito adapta em seguida e
  // reavalia a cada minuto — a home muda sozinha à meia-noite, sem F5.
  const [agora, setAgora] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setAgora(new Date());
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // A prova em uma linha — contente, sem medidor.
  const daysLeft = agora ? daysUntilDate(MATH_EXAM.date, agora) : 999;
  const provaPerto = daysLeft >= 0 && daysLeft <= 7;
  const provaLabel =
    daysLeft < 0
      ? undefined
      : daysLeft === 0
        ? 'prova hoje'
        : daysLeft === 1
          ? 'prova amanhã'
          : `prova em ${daysLeft} dias`;

  // O ÚLTIMO material aberto — a home não pode viver em modo prova: no dia a
  // dia, o passo 1 devolve a pessoa exatamente ao ponto onde ela parou.
  const ultimo = sp.progress.recentMaterials[0] ?? null;
  const ultimoMaterial = ultimo ? materials.find((m) => m.id === ultimo.id) ?? null : null;

  // Passo 1: com prova perto = ler a teoria; fora dela = continuar de onde parou.
  const step1 = provaPerto
    ? {
        icon: BookOpen,
        title: 'Leia com o tutor ao lado',
        body: 'Abra o PDF da aula em tela dividida: o texto de um lado, o tutor do outro. Pergunte qualquer coisa — ele lê o material com você.',
        action: 'Estudar',
        onClick: () => onStartStudy(),
      }
    : ultimoMaterial
      ? {
          icon: BookOpen,
          title: 'Continue de onde parou',
          body: ultimoMaterial.title,
          action: 'Continuar',
          onClick: () => onStartStudy(ultimoMaterial.disciplineCode, ultimoMaterial.id),
        }
      : {
          icon: BookOpen,
          title: 'Leia com o tutor ao lado',
          body: 'Abra o PDF da aula em tela dividida: o texto de um lado, o tutor do outro. Pergunte qualquer coisa — ele lê o material com você.',
          action: 'Estudar',
          onClick: () => onStartStudy(),
        };

  // Passo 2 e 3 mudam com a distância da prova — o método é sempre o mesmo.
  // (fora da semana da prova, os passos apontam para Praticar — genéricos)
  const step2 = provaPerto
    ? {
        icon: PenLine,
        title: 'Resolva as questões do professor',
        body: `As ${MATH_EXAM.evaluationName === 'Av1' ? '6 questões da prova' : 'questões'} em uma folha só, com método e gabarito. Resolva no papel, sem pressa.`,
        action: 'Abrir a folha',
        onClick: () => setFolhaAberta(true),
      }
    : {
        icon: PenLine,
        title: 'Resolva as questões da lista',
        body: 'Pegue as questões do material que você acabou de ler e faça no papel, uma por vez.',
        action: 'Ir para Praticar',
        onClick: () => openPractice({}),
      };

  const step3 = provaPerto
    ? {
        icon: Timer,
        title: 'Faça o ensaio',
        body: 'As mesmas questões do professor, com cronômetro real de 50 minutos. O ensaio mostra o que falta — sem cobrar nada.',
        action: 'Começar o ensaio',
        onClick: () => openSimulado({ disciplineCode: MATH_EXAM.disciplineCode, preset: 'math_exam_prof' }),
      }
    : {
        icon: Timer,
        title: 'Revise o que ficou',
        body: 'Passe pelos flashcards pendentes e confira os pontos que travaram na hora de resolver.',
        action: 'Revisar',
        onClick: () => openPractice({ mode: 'flashcards' }),
      };

  const steps = [
    step1,
    step2,
    step3,
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {/* A linha do dia — uma frase humana, nada de painel */}
      <section aria-labelledby="dia-titulo">
        <h1 id="dia-titulo" className="text-2xl font-semibold tracking-tight">
          {provaPerto ? 'Foco: prova de Matemática.' : 'Bom estudo.'}
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {provaPerto ? (
            <>
              {MATH_EXAM.date.slice(8, 10)}/{MATH_EXAM.date.slice(5, 7)} · 50 min · Matrizes e
              Lógica. Determinantes e sistemas não caem.
            </>
          ) : (
            <>
              Um método, três passos: leia com o tutor, resolva no papel, ensaie. É tudo o que o
              site pede de você.
            </>
          )}
        </p>
      </section>

      {/* O método — um caminho só, três passos, cada um abre o conteúdo certo */}
      <Card className="rounded-2xl p-5 sm:p-6" data-t="metodo-card">
        <h2 className="text-base font-semibold leading-tight">Como estudar hoje</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Três passos, sempre os mesmos — na ordem.
        </p>
        <ol className="mt-4">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className={`flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-start sm:gap-4 ${
                i > 0 ? 'border-t border-border/60' : ''
              }`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug">
                  <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
              <button
                type="button"
                onClick={s.onClick}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mt-0.5 sm:h-10 sm:w-auto sm:justify-start"
                aria-label={`${s.action} — ${s.title}`}
              >
                {s.action}
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      </Card>

      {/* Disciplinas — uma lista simples, cada linha abre os materiais */}
      <section aria-labelledby="disciplinas-titulo">
        <h2 id="disciplinas-titulo" className="text-base font-semibold leading-tight">
          Disciplinas
        </h2>
        <div className="mt-3 grid gap-2" data-t="disciplinas-lista">
          {disciplines.map((d) => {
            const count = materials.filter((m) => m.disciplineCode === d.code).length;
            const prova = provaPerto && d.code === MATH_EXAM.disciplineCode;
            return (
              <button
                key={d.code}
                type="button"
                onClick={() => onStartStudy(d.code)}
                className="group flex w-full min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-foreground/25 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Abrir materiais de ${d.name}`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${getColorClasses(d.color).bgSoft} ${getColorClasses(d.color).text}`}
                >
                  <DisciplineIcon name={d.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{d.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {count === 0 ? 'sem materiais ainda' : `${count} ${count === 1 ? 'material' : 'materiais'}`}
                  </span>
                </span>
                {prova && provaLabel && (
                  <Badge className="shrink-0 gap-1 bg-violet-600 text-white shadow-sm">
                    <CalendarCheck className="size-3" aria-hidden />
                    {provaLabel}
                  </Badge>
                )}
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* Links úteis — uma linha discreta, nada de blocos */}
      <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
        <a
          href="/folha-revisao"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <Printer className="size-3.5" aria-hidden /> Folha de revisão (imprimir)
        </a>
        <span aria-hidden>·</span>
        <a
          href="/#progress"
          onClick={(e) => {
            e.preventDefault();
            openProgress();
          }}
          className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <ListChecks className="size-3.5" aria-hidden /> Calculadora de notas
        </a>
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <FileText className="size-3.5" aria-hidden /> Backup do progresso
        </button>
      </p>

      {/* A folha da prova abre na integração que o dono ama: PDF + tutor */}
      <PdfViewerDialog
        material={folha as Material}
        open={folhaAberta && folha !== null}
        onOpenChange={(v) => {
          if (!v) setFolhaAberta(false);
        }}
        initialMode="split"
      />
    </div>
  );
}
