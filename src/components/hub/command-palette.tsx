'use client';

import * as React from 'react';
import {
  BookOpen,
  BookX,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Dumbbell,
  FileQuestion,
  FileText,
  Layers,
  LayoutDashboard,
  ListChecks,
  Lock,
  Moon,
  Printer,
  Search,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  Zap,
  Download,
  Target,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import type { TabKey } from './sidebar-nav';
import {
  disciplines,
  materials,
  type Discipline,
  type Material,
} from '@/data/course-data';
import { getColorClasses } from '@/lib/discipline-colors';
import { DisciplineIcon } from '@/lib/discipline-icons';
import { DisciplineDetailDialog } from './discipline-detail-dialog';
import { MaterialSummaryDialog } from './material-summary-dialog';
import { DownloadsDialog } from './downloads-dialog';
import { cn } from '@/lib/utils';
import {
  MATH_EXAM,
  findMathSimuladoRunOficial,
  paletteExamBriefFor,
  type PaletteExamAction,
} from '@/lib/math-exam-prep';
import { daysUntilDate } from '@/lib/semester';
import { openProgress, openPractice, openSimulado, openTutor } from '@/lib/hub-events';
import {
  exercisePaletteEntries,
  flashcardPaletteEntries,
  paletteWordFilter,
} from '@/lib/palette-search';
import { exercises } from '@/lib/exercise-extractor';
import { buildRunDebriefQuestion } from '@/lib/simulado-debrief';
import { useStudyProgress } from '@/lib/study-progress';
import {
  collectMistakes,
  paperNotebookFor,
  pendingMistakes,
} from '@/lib/mistake-notebook';

interface Props {
  onNavigate: (k: TabKey) => void;
}

/** Nome do evento global disparado pelo botão de busca do Header. */
export const OPEN_PALETTE_EVENT = 'hub:open-command-palette';

/**
 * A gramatura da dificuldade (173) — as MESMAS classes do Praticar
 * (practice-view.tsx): cor = significado, a mesma de uma ponta à outra.
 * Duplicar a STRING (não importar do componente) mantém a paleta livre de
 * dependência de tela — e o contrato t173 compara as duas fontes.
 */
const QUEST_DIFFICULTY_BADGE: Record<
  'facil' | 'medio' | 'dificil',
  string
> = {
  facil:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400',
  medio:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400',
  dificil:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400',
};

const PAGES: {
  value: TabKey;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}[] = [
  { value: 'dashboard', label: 'Visão Geral', icon: <LayoutDashboard />, shortcut: '1' },
  { value: 'study', label: 'Estudar (Pomodoro + IA)', icon: <Zap />, shortcut: '2' },
  { value: 'library', label: 'Biblioteca', icon: <BookOpen />, shortcut: '3' },
  { value: 'practice', label: 'Praticar', icon: <Dumbbell />, shortcut: '4' },
  { value: 'method', label: 'Método (Sessão Guiada)', icon: <Target />, shortcut: '7' },
  { value: 'schedule', label: 'Cronograma', icon: <CalendarDays />, shortcut: '5' },
  { value: 'progress', label: 'Progresso', icon: <TrendingUp />, shortcut: '6' },
  { value: 'settings', label: 'Configurações', icon: <Settings />, shortcut: '8' },
];

export function CommandPalette({ onNavigate }: Props) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // A semana da Av1 na paleta — o relógio é lido NO render (lição 79/100:
  // abrir a paleta re-renderiza → data fresca) e o run vem do hook (storage
  // event → re-render → o grupo flipa 'ensaio' → 'correção' ao vivo).
  const sp = useStudyProgress();
  const examRun = findMathSimuladoRunOficial(sp.progress.simuladoRuns);
  const examBrief = paletteExamBriefFor(daysUntilDate(MATH_EXAM.date), Boolean(examRun));

  // O ATALHO DO CADERNO (132): o caderno é o recibo do método inteiro — erros
  // de simulado, exercício e cartão caem aqui sozinhos — mas a paleta, a
  // navegação universal do app, não tinha NENHUM caminho até ele (Ctrl+K +
  // 'caderno' = 'Nada encontrado'; a 131 entregou o recibo no resultado do
  // simulado, a paleta é o outro lado da MESMA lição: anunciar é metade,
  // levar é a outra — 127). Os números vêm da MESMA fonte do caderno
  // (collectMistakes + paperNotebookFor — zero segunda derivação, a
  // gramática da 125) e a porta é a MESMA do card da prova e do recibo do
  // simulado (openProgress, a door da 118/131). O botão do papel segue a
  // regra 88: só existe quando há enunciado confirmado pelo acervo — papel
  // vazio é promessa disfarçada.
  const notebookItems = React.useMemo(() => collectMistakes(sp.progress), [sp.progress]);
  const notebookPendentes = React.useMemo(
    () => pendingMistakes(notebookItems, sp.progress.notebookRevised).length,
    [notebookItems, sp.progress.notebookRevised],
  );
  const notebookPaper = React.useMemo(
    () => paperNotebookFor(notebookItems, sp.progress.notebookRevised),
    [notebookItems, sp.progress.notebookRevised],
  );
  const cadernoHint: React.ReactNode =
    notebookPendentes > 0 ? (
      <>
        <span className="tabular-nums">{notebookPendentes}</span>{' '}
        {notebookPendentes === 1 ? 'pendente' : 'pendentes'} — errados de simulados,
        exercícios e cartões
      </>
    ) : notebookItems.length > 0 ? (
      <>tudo revisado — errar de novo reabre o item sozinho</>
    ) : (
      <>os erros dos simulados e exercícios caem aqui sozinhos</>
    );
  const paperCount = notebookPaper.printable.length;

  // A BUSCA QUE ACHA A QUESTÃO (173): o acervo INTEIRO entra na paleta —
  // enunciado confirmado, tópico, dificuldade e fonte viram linha de
  // resultado; o Enter abre o Praticar filtrado AO SÓ o achado (o MESMO
  // mecanismo do apoio do dia, exerciseIds — chip com X, filtro que não
  // prende). Os cartões do aluno entram junto: o baralho que ELE criou é
  // conteúdo de busca de primeira classe (grupo só existe com cartão —
  // gaveta vazia não é anunciada).
  const exerciseEntries = React.useMemo(() => exercisePaletteEntries(exercises), []);
  const flashEntries = React.useMemo(
    () => flashcardPaletteEntries(sp.progress.flashcards ?? [], Date.now()),
    [sp.progress.flashcards],
  );

  /** Ação da semana — cada kind tem a porta que JÁ existe no app. */
  function runExamAction(a: PaletteExamAction) {
    switch (a.kind) {
      case 'simulado':
        run(() => openSimulado({ preset: 'math_exam' }));
        break;
      case 'correcao':
        if (!examRun) return; // a ação só existe quando o run existe (brief)
        run(() =>
          openTutor({
            question: buildRunDebriefQuestion(examRun),
            disciplineCode: MATH_EXAM.disciplineCode,
          }),
        );
        break;
      case 'kit':
      case 'plano':
        go('dashboard');
        break;
      case 'folha':
        run(() => window.open('/folha-revisao', '_blank', 'noopener,noreferrer'));
        break;
    }
  }

  // Dialogs gerenciados pela paleta
  const [selectedDiscipline, setSelectedDiscipline] = React.useState<Discipline | null>(null);
  const [disciplineOpen, setDisciplineOpen] = React.useState(false);
  const [selectedMaterial, setSelectedMaterial] = React.useState<Material | null>(null);
  const [materialOpen, setMaterialOpen] = React.useState(false);
  const [downloadsOpen, setDownloadsOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Ctrl+K / Cmd+K abre a paleta; atalhos 1–8 trocam de aba fora de inputs
  React.useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Atalhos numéricos só quando a paleta está fechada e o foco não está em input
      if (open || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const idx = Number(e.key);
      if (idx >= 1 && idx <= PAGES.length) {
        const page = PAGES[idx - 1];
        if (page) onNavigate(page.value);
      }
    }

    function onOpenPalette() {
      setOpen(true);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenPalette);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenPalette);
    };
  }, [open, onNavigate]);

  function run(action: () => void) {
    setOpen(false);
    // pequeno delay para fechar o dialog da paleta antes de abrir outro
    setTimeout(action, 80);
  }

  function go(k: TabKey) {
    run(() => onNavigate(k));
  }

  function toggleTheme() {
    run(() => setTheme(theme === 'dark' ? 'light' : 'dark'));
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        commandFilter={paletteWordFilter}
        className="[_[cmdk-group-heading]]:text-emerald-600 dark:[_[cmdk-group-heading]]:text-emerald-400"
      >
        <CommandInput placeholder="Buscar páginas, disciplinas, materiais, questões e ações..." />
        <CommandList className="max-h-[min(60vh,420px)] [scrollbar-width:thin]">
          <CommandEmpty>
            <span className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <Search className="size-5 opacity-60" aria-hidden="true" />
              Nada encontrado. Tente outro termo.
            </span>
          </CommandEmpty>

          {/* SEMANA DA AV1 — primeiro grupo na reta final (janela D-7→D-0,
              regra da 88): a paleta se reordena para o momento. Tons = a
              gramática da semana: âmbar nos dias de semana/ensaio (pulso só
              no é-hoje, 93), emerald quando o run chegou, indigo no kit e
              rose reservado ao dia da prova. */}
          {examBrief && (
            <>
              <CommandGroup
                heading={
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 font-semibold',
                      examBrief.kind === 'prova'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    <CalendarClock
                      className={cn(
                        'size-3.5',
                        examBrief.kind === 'simulado' || examBrief.kind === 'prova'
                          ? 'animate-pulse'
                          : '',
                      )}
                      aria-hidden="true"
                    />
                    {examBrief.heading}
                    <span className="ml-1 rounded border border-current/30 px-1 font-mono text-[10px] tabular-nums opacity-80">
                      D-{examBrief.daysLeft}
                    </span>
                  </span>
                }
              >
                {examBrief.actions.map((a) => {
                  const icon = {
                    simulado: (
                      <CalendarClock
                        className={cn('size-4', a.pulsar && 'animate-pulse')}
                        aria-hidden="true"
                      />
                    ),
                    correcao: <CircleCheck className="size-4" aria-hidden="true" />,
                    kit: <Moon className="size-4" aria-hidden="true" />,
                    folha: <Printer className="size-4" aria-hidden="true" />,
                    plano: <ListChecks className="size-4" aria-hidden="true" />,
                  }[a.kind];
                  const tone = {
                    simulado: 'text-amber-500',
                    correcao: 'text-emerald-500',
                    kit: 'text-indigo-500',
                    folha: 'text-zinc-500',
                    plano: 'text-rose-500',
                  }[a.kind];
                  return (
                    <CommandItem
                      key={a.kind}
                      value={`av1 semana da prova ${a.kind} ${a.label}`}
                      onSelect={() => runExamAction(a)}
                      className="gap-2.5"
                    >
                      <span className={cn('shrink-0 [&_svg]:size-4', tone)}>{icon}</span>
                      <span className="min-w-0">
                        <span className="block truncate">{a.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {a.hint}
                        </span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Ir para">
            {PAGES.map((p) => (
              <CommandItem
                key={p.value}
                value={`pagina ${p.label}`}
                onSelect={() => go(p.value)}
                className="gap-2.5"
              >
                <span className="text-emerald-600 dark:text-emerald-400 [&_svg]:size-4">
                  {p.icon}
                </span>
                <span>{p.label}</span>
                <CommandShortcut>{p.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {/* O TUTOR NA NAVEGAÇÃO UNIVERSAL (142): o recurso CENTRO do site era
              o único inalcançável pela busca — 'tutor' devolvia 'Nada
              encontrado'. Cada disciplina vira uma porta direta do chat (o
              MESMO openTutor da Biblioteca/Praticar/Agenda — a disciplina já
              chega selecionada e a memória da conversa é a certa). Atalho
              fiscaliza a regra da casa: integração real é a que a busca acha. */}
          <CommandGroup heading="Tutor IA — tirar dúvida">
            <CommandItem
              value="tutor ia duvida perguntar chat inteligencia artificial abrir estudar"
              onSelect={() => run(() => openTutor())}
              className="gap-2.5"
            >
              <span className="shrink-0 text-amber-500 [&_svg]:size-4">
                <Sparkles aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate">Abrir o tutor IA</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  chat da disciplina atual — lê materiais, datas e seu progresso
                </span>
              </span>
            </CommandItem>
            {disciplines.map((d) => {
              const color = getColorClasses(d.color);
              return (
                <CommandItem
                  key={d.code}
                  value={`tutor ia duvida ${d.name} ${d.shortName} ${d.professor} perguntar chat`}
                  onSelect={() =>
                    run(() => openTutor({ disciplineCode: d.code }))
                  }
                  className="gap-2.5"
                >
                  <span className={cn('shrink-0 [&_svg]:size-4', color.text)}>
                    <DisciplineIcon name={d.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">Tutor de {d.shortName}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      dúvidas de {d.name} com o contexto do Hub
                    </span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          {/* O ATALHO DO CADERNO (132): grupo próprio, logo depois do tutor
              — a revisão é a terceira fase do método e merece endereço na
              navegação universal, não um enterro no submenu Mais → Progresso. */}
          <CommandGroup heading="Caderno de erros">
            <CommandItem
              value="caderno de erros pendentes revisao abrir progresso"
              onSelect={() => run(() => openProgress())}
              className="gap-2.5"
            >
              <span className="shrink-0 text-amber-500 [&_svg]:size-4">
                <BookX aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate">Abrir o Caderno de Erros</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {cadernoHint}
                </span>
              </span>
            </CommandItem>
            {paperCount > 0 && (
              <CommandItem
                value="caderno papel imprimir folha pendencias levar questoes"
                onSelect={() =>
                  run(() => window.open('/caderno-papel', '_blank', 'noopener,noreferrer'))
                }
                className="gap-2.5"
              >
                <span className="shrink-0 text-zinc-500 [&_svg]:size-4">
                  <Printer aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">Levar as pendências ao papel</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{paperCount}</span>{' '}
                    {paperCount === 1 ? 'questão' : 'questões'} com enunciado completo —
                    refaça no papel, marque no caderno
                  </span>
                </span>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Disciplinas">
            {disciplines.map((d) => {
              const color = getColorClasses(d.color);
              return (
                <CommandItem
                  key={d.code}
                  value={`disciplina ${d.name} ${d.shortName} ${d.professor}`}
                  onSelect={() =>
                    run(() => {
                      setSelectedDiscipline(d);
                      setDisciplineOpen(true);
                    })
                  }
                  className="gap-2.5"
                >
                  <span className={cn('shrink-0 [&_svg]:size-4', color.text)}>
                    <DisciplineIcon name={d.icon} />
                  </span>
                  <span className="truncate">{d.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {d.chTotal}h
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Materiais e resumos">
            {materials.map((m) => (
              <CommandItem
                key={m.id}
                value={`material ${m.title} ${m.type}`}
                onSelect={() =>
                  run(() => {
                    setSelectedMaterial(m);
                    setMaterialOpen(true);
                  })
                }
                className="gap-2.5"
              >
                {m.summaryFile ? (
                  <Sparkles className="shrink-0 text-violet-500" />
                ) : (
                  <FileText className="shrink-0 text-teal-500" />
                )}
                <span className="truncate">{m.title}</span>
                {m.pdfPath && (
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    PDF
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {/* A BUSCA QUE ACHA A QUESTÃO (173): o acervo como conteúdo de
              busca de primeira classe — o mesmo direito dos materiais. A
              dificuldade usa a MESMA gramatura de cor do Praticar (emerald/
              amber/rose — cor = significado, não enfeite); prova real leva
              selo próprio e gate fechado leva o cadeado (a paleta não
              esconde o que o Praticar mostra — e não surpreende quem chega). */}
          <CommandGroup
            heading={
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <FileQuestion className="size-3.5" aria-hidden="true" />
                Questões do acervo
                <span className="ml-1 rounded border border-current/30 px-1 font-mono text-[10px] tabular-nums opacity-80">
                  {exerciseEntries.length}
                </span>
              </span>
            }
          >
            {exerciseEntries.map((e) => {
              const disc = disciplines.find((d) => d.code === e.disciplineCode);
              const color = getColorClasses(disc?.color ?? 'slate');
              return (
                <CommandItem
                  key={e.id}
                  value={e.value}
                  onSelect={() =>
                    run(() =>
                      // A MESMA fiação do apoio do dia (exam-prep-card): a
                      // disciplina VAI JUNTO — sem ela o Praticar ignora o
                      // exerciseIds (o efeito do pre-filtro exige code).
                      openPractice({ disciplineCode: e.disciplineCode, exerciseIds: [e.id] }),
                    )
                  }
                  className="gap-2.5"
                >
                  <span className={cn('shrink-0 [&_svg]:size-4', color.text)}>
                    <DisciplineIcon name={disc?.icon ?? 'book'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{e.preview}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {e.disciplineShort} · {e.topic}
                    </span>
                  </span>
                  {e.isProvaReal && (
                    <span className="shrink-0 rounded border border-zinc-300 px-1 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                      prova real
                    </span>
                  )}
                  {e.gated && (
                    <span
                      className="shrink-0 text-zinc-400 dark:text-zinc-500"
                      title="aguarda a aula — o Praticar explica o gate"
                    >
                      <Lock className="size-3.5" aria-label="gate fechado" />
                    </span>
                  )}
                  <span
                    className={cn(
                      'shrink-0 rounded border px-1 text-[10px] tabular-nums',
                      QUEST_DIFFICULTY_BADGE[e.difficulty],
                    )}
                  >
                    {e.difficultyLabel}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          {/* O BARALHO NA BUSCA (173): os cartões do ALUNO (não os do acervo)
              com a caixa e o prazo na linha — a véspera digita o assunto e o
              cartão vem; o Enter abre o Praticar já no modo flashcards. Grupo
              condicionado a EXISTIR cartão: a paleta não anuncia gaveta vazia
              (a honestidade do estado vazio que a casa já pratica). */}
          {flashEntries.length > 0 && (
            <>
              <CommandGroup
                heading={
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Layers className="size-3.5" aria-hidden="true" />
                    Seus cartões
                    <span className="ml-1 rounded border border-current/30 px-1 font-mono text-[10px] tabular-nums opacity-80">
                      {flashEntries.length}
                    </span>
                  </span>
                }
              >
                {flashEntries.map((f) => {
                  const disc = disciplines.find((d) => d.code === f.disciplineCode);
                  const color = getColorClasses(disc?.color ?? 'slate');
                  return (
                    <CommandItem
                      key={f.id}
                      value={f.value}
                      onSelect={() => run(() => openPractice({ mode: 'flashcards' }))}
                      className="gap-2.5"
                    >
                      <span className={cn('shrink-0 [&_svg]:size-4', color.text)}>
                        <DisciplineIcon name={disc?.icon ?? 'book'} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{f.front}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {f.backPreview}
                        </span>
                      </span>
                      {f.overdue && (
                        <span className="shrink-0 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          vencido
                        </span>
                      )}
                      {f.lapses > 0 && (
                        <span className="shrink-0 text-[10px] tabular-nums text-rose-600 dark:text-rose-400">
                          {f.lapsesLabel}
                        </span>
                      )}
                      <span className="shrink-0 rounded border border-border px-1 text-[10px] tabular-nums text-muted-foreground">
                        caixa {f.box}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Ações">
            <CommandItem
              value="acao iniciar sessao de estudo pomodoro"
              onSelect={() => go('study')}
              className="gap-2.5"
            >
              <Zap className="shrink-0 text-emerald-500" />
              <span>Iniciar sessão de estudo</span>
              <CommandShortcut>↵ Estudar</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="acao downloads zip pdf resumos materiais"
              onSelect={() =>
                run(() => {
                  setDownloadsOpen(true);
                })
              }
              className="gap-2.5"
            >
              <Download className="shrink-0 text-amber-500" />
              <span>Downloads de materiais (ZIP)</span>
            </CommandItem>
            {mounted && (
              <CommandItem
                value="acao alternar tema claro escuro"
                onSelect={toggleTheme}
                className="gap-2.5"
              >
                {theme === 'dark' ? (
                  <Sun className="shrink-0 text-amber-400" />
                ) : (
                  <Moon className="shrink-0 text-violet-400" />
                )}
                <span>Alternar para tema {theme === 'dark' ? 'claro' : 'escuro'}</span>
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>

        {/* Rodapé com dicas de atalho */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">↑↓</kbd>
            navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">↵</kbd>
            abrir
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">1–8</kbd>
            trocar de aba
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">Esc</kbd>
            fechar
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Search className="size-3" /> Ctrl+K
          </span>
        </div>
      </CommandDialog>

      {/* Dialogs reutilizados (mesmos da Dashboard/Library) */}
      <DisciplineDetailDialog
        discipline={selectedDiscipline}
        open={disciplineOpen}
        onOpenChange={setDisciplineOpen}
      />
      <MaterialSummaryDialog
        material={selectedMaterial}
        open={materialOpen}
        onOpenChange={setMaterialOpen}
      />
      <DownloadsDialog open={downloadsOpen} onOpenChange={setDownloadsOpen} />
    </>
  );
}

/** Botão compacto de busca usado no Header. */
export function PaletteTriggerButton() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isMac =
    mounted && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      type="button"
      aria-label="Busca rápida (Ctrl+K)"
      title="Busca rápida (Ctrl+K)"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
      className={cn(
        'group inline-flex h-11 sm:h-8 items-center gap-2 rounded-full border border-border bg-muted/40',
        'px-2.5 text-xs text-muted-foreground transition-colors',
        'hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
      )}
    >
      <Search className="size-3.5" />
      <span className="hidden sm:inline">Buscar...</span>
      <kbd className="hidden rounded border border-border bg-background px-1 font-mono text-[10px] sm:inline">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
