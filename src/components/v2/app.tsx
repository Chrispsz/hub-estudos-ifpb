'use client';

// O PROJETO PRINCIPAL — Edição Definitiva (Fase 6).
//
// 10 abas viraram 3 destinos + 1 dock (a filosofia Ubuntu/COSMIC: menos
// destinos, mais coesão):
//   HOJE      — plano cirúrgico do dia + agenda (board) + registro + pomodoro
//   ESTUDAR   — Materiais (PDFs dos professores) · Trilha · Revisão · Backlog · Erros
//   PROGRESSO — Sprint Review · Missões · Rotina · Perfil
//   TUTOR     — dock fixo (canto), aberto de qualquer aba, com o material em foco
//
// Offline-first sobre IndexedDB. Onboarding honesto: backup ANTES da migração.

import * as React from 'react';
import { Download, GitBranch, GraduationCap, Play, ShieldCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buildBackup, downloadBackup } from '@/lib/v2/backup';
import { runMigration } from '@/lib/v2/migrate';
import { dateKeyOf } from '@/lib/v2/planner';
import { rankFor, streakOf, totalXp, daysStudiedOf } from '@/lib/v2/xp';
import { useActiveSession, useAttempts, useCounts, useSessions, useSubjects, useTopics, useUnits } from '@/lib/v2/use-v2';
import { Btn, Chip } from './ui';
import { TabHoje } from './tab-hoje';
import { TabEstudar, isEstudarSeg, type EstudarSeg } from './tab-estudar';
import { TabProgresso, isProgressoSeg, type ProgressoSeg } from './tab-progresso';
import { TabTutor } from './tab-tutor';
import type { TutorMaterialContext } from './tab-materiais';

const TABS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'estudar', label: 'Estudar' },
  { id: 'progresso', label: 'Progresso' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function stateFromHash(): { tab: TabId; seg: string | null } {
  const h = window.location.hash.replace('#', '');
  const [tab, seg] = h.split('/');
  const t = (TABS.find((x) => x.id === tab)?.id ?? 'hoje') as TabId;
  return { tab: t, seg: seg ?? null };
}

export function V2App() {
  const counts = useCounts();
  const [tab, setTab] = React.useState<TabId>('hoje');
  const [segEstudar, setSegEstudar] = React.useState<EstudarSeg>('materiais');
  const [segProgresso, setSegProgresso] = React.useState<ProgressoSeg>('sprint');

  // dock do tutor — acessível de qualquer aba, com o material em foco
  const [tutorOpen, setTutorOpen] = React.useState(false);
  const [tutorMaterial, setTutorMaterial] = React.useState<TutorMaterialContext | null>(null);

  React.useEffect(() => {
    function applyHash() {
      const { tab: t, seg } = stateFromHash();
      setTab(t);
      if (t === 'estudar' && seg && isEstudarSeg(seg)) setSegEstudar(seg);
      if (t === 'progresso' && seg && isProgressoSeg(seg)) setSegProgresso(seg);
    }
    applyHash();
    // popstate cobre voltar/avançar; hashchange cobre rotações manuais
    window.addEventListener('popstate', applyHash);
    window.addEventListener('hashchange', applyHash);
    return () => {
      window.removeEventListener('popstate', applyHash);
      window.removeEventListener('hashchange', applyHash);
    };
  }, []);

  function go(dest: string) {
    const [t, s] = dest.split('/');
    setTab(t as TabId);
    if (t === 'estudar' && s && isEstudarSeg(s)) setSegEstudar(s);
    if (t === 'progresso' && s && isProgressoSeg(s)) setSegProgresso(s);
    window.history.pushState(null, '', `#${dest}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openTutor(ctx: TutorMaterialContext) {
    setTutorMaterial(ctx);
    setTutorOpen(true);
  }

  // núcleo vazio → onboarding (backup antes de migrar — a ordem é inegociável)
  if (counts && counts.subjects === 0) {
    return <Onboarding />;
  }
  if (!counts || counts.subjects === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0c0c] font-mono text-sm text-zinc-500">
        abrindo o núcleo…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0c0c0c] font-mono text-zinc-200">
      <Header />
      <nav aria-label="Abas do projeto" className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0c0c0c]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id}
              className={`min-h-[36px] whitespace-nowrap rounded-md px-4 py-1.5 text-[13px] transition-colors ${
                tab === t.id
                  ? 'bg-emerald-500/15 font-semibold text-emerald-300'
                  : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-4 pb-20 sm:px-4 sm:py-6">
        {tab === 'hoje' && <TabHoje onNavigate={go} onOpenTutor={openTutor} />}
        {tab === 'estudar' && (
          <TabEstudar
            seg={segEstudar}
            onSeg={(s) => go(`estudar/${s}`)}
            onOpenTutor={openTutor}
          />
        )}
        {tab === 'progresso' && <TabProgresso seg={segProgresso} onSeg={(s) => go(`progresso/${s}`)} />}
      </main>

      {/* dock do tutor — um toque de qualquer aba; o GNOME tem dock, a casa também */}
      <button
        type="button"
        onClick={() => setTutorOpen(true)}
        title="Abrir o Tutor (de qualquer aba, com o material em foco)"
        aria-label="Abrir o Tutor"
        className="fixed bottom-5 right-4 z-40 flex size-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 transition-transform hover:scale-105 hover:bg-emerald-500 sm:right-6"
      >
        <GraduationCap className="size-5" />
      </button>

      <Sheet open={tutorOpen} onOpenChange={setTutorOpen}>
        <SheetContent className="w-full overflow-y-auto border-zinc-800 bg-[#0c0c0c] p-0 sm:max-w-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Tutor IA</SheetTitle>
          </SheetHeader>
          <div className="p-3 sm:p-4">
            <TabTutor
              material={tutorMaterial}
              onClearMaterial={() => setTutorMaterial(null)}
              onClose={() => setTutorOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Footer />
    </div>
  );
}

function Header() {
  const sessions = useSessions();
  const attempts = useAttempts();
  const xp = totalXp(sessions, attempts);
  const rank = rankFor(xp, attempts);
  const todayKey = dateKeyOf();
  const streak = streakOf(sessions, todayKey);
  const days30 = daysStudiedOf(sessions, todayKey, 30);
  const active = useActiveSession();

  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-violet-400">O Projeto Principal</p>
          <h1 className="font-mono text-sm font-semibold text-zinc-50">
            estudo = commit · erro = code review · prova = deploy
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="emerald">{rank.rank.name}</Chip>
          <Chip tone="violet">{xp} XP</Chip>
          {/* consistência em primeiro lugar (o hábito é soma, não sequência) */}
          <Chip tone={days30 > 0 ? 'emerald' : 'zinc'} title="dias estudados nos últimos 30 — faltar um dia não apaga nada">
            {days30} dias · 30d
          </Chip>
          <Chip tone="zinc" title="sequência com piso de 60min — só um detalhe, não a meta">
            streak {streak.count}d
          </Chip>
          {active && <Chip tone="amber">sessão viva</Chip>}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const units = useUnits();
  const attempts = useAttempts();
  const subjects = useSubjects();
  const topics = useTopics();
  const now = Date.now();
  const dueCount = units.filter((u) => u.fsrs && u.fsrs.due <= now && u.topicId).length;
  const today = dateKeyOf();
  const todayStart = new Date(`${today}T00:00:00`).getTime();
  const todayXp = attempts
    .filter((a) => a.at >= todayStart)
    .reduce((acc, a) => acc + (a.result === 'correct' ? 2 : a.result === 'wrong' ? 1 : 0), 0);
  return (
    <footer className="mt-auto border-t border-zinc-800 bg-[#0c0c0c]">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[10px] text-zinc-600 sm:px-4">
        <p>
          fila FSRS: <span className="text-zinc-400 tabular-nums">{dueCount}</span> · tentativas:{' '}
          <span className="text-zinc-400 tabular-nums">{attempts.length}</span> ·{' '}
          <span className="text-zinc-400 tabular-nums">
            {subjects.length} matérias · {topics.length} tópicos
          </span>
        </p>
        <p>
          XP de tentativas hoje: <span className="text-emerald-400 tabular-nums">{todayXp}</span>
        </p>
        <a href="/?legacy=1" className="text-zinc-600 underline decoration-dotted hover:text-zinc-400">
          casa antiga ↗
        </a>
      </div>
    </footer>
  );
}

/** Onboarding — backup PRIMEIRO, migração DEPOIS, entrada por contagem viva. */
function Onboarding() {
  const counts = useCounts();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [backed, setBacked] = React.useState(false);

  async function doBackup() {
    setBusy('backup');
    try {
      const b = await buildBackup();
      downloadBackup(b);
      setBacked(true);
      setMsg('backup baixado — guarde fora da máquina antes de migrar');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'falha no backup');
    } finally {
      setBusy(null);
    }
  }

  async function doMigrate() {
    if (!backed && !window.confirm('Migrar sem baixar o backup antes? A ordem recomendada é backup → migração.')) return;
    setBusy('migrate');
    try {
      const r = await runMigration();
      setMsg(
        `migrado: ${r.seed.subjects} matérias · ${r.seed.topics} tópicos · ${r.seed.units} unidades · ${r.seed.backlog} backlog · ${r.user.cards} cartões`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'falha na migração');
    } finally {
      setBusy(null);
    }
  }

  const ready = (counts?.subjects ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[#0c0c0c] font-mono text-zinc-200">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-violet-400">O Projeto Principal</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-50">Instalação do núcleo</h1>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          O app novo vive no IndexedDB, 100% offline. A ordem é inegociável:{' '}
          <span className="text-emerald-300">1) backup</span> →{' '}
          <span className="text-violet-300">2) migração idempotente</span> → <span className="text-zinc-100">3) entrar</span>.
        </p>

        <div className="mt-6 space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="font-mono text-xs font-semibold text-emerald-300">PASSO 1 — backup completo</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Exporta o núcleo + TODAS as chaves do Hub do navegador num JSON único.
            </p>
            <Btn variant="emerald" className="mt-3" disabled={busy !== null} onClick={() => void doBackup()}>
              <Download className="size-3.5" /> baixar backup
            </Btn>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="font-mono text-xs font-semibold text-violet-300">PASSO 2 — migração</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Snapshot do legado → matérias, tópicos, unidades, backlog, provas, rotina →
              seu estado (Leitner→FSRS semeado, sessões, notas). Rodar 2× não duplica nada.
            </p>
            <Btn variant="violet" className="mt-3" disabled={busy !== null} onClick={() => void doMigrate()}>
              <Play className="size-3.5" /> executar migração
            </Btn>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="font-mono text-xs font-semibold text-zinc-100">PASSO 3 — entrar</p>
            {ready ? (
              <div className="mt-2">
                <p className="text-[11px] text-emerald-300">
                  <ShieldCheck className="mr-1 inline size-3.5" /> núcleo populado — pode entrar
                </p>
                <Btn variant="emerald" className="mt-3" onClick={() => window.location.reload()}>
                  abrir o app →
                </Btn>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-500">o botão aparece quando a migração correr</p>
            )}
          </div>

          {msg && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
              {msg}
            </p>
          )}

          <p className="pt-2 text-center text-[10px] text-zinc-600">
            <GitBranch className="mr-1 inline size-3" />
            casa antiga preservada em{' '}
            <a href="/?legacy=1" className="underline decoration-dotted">
              /?legacy=1
            </a>{' '}
            — nada lá foi tocado
          </p>
        </div>
      </div>
    </div>
  );
}
