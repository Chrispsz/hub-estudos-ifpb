'use client';

// O PROJETO PRINCIPAL — shell do app novo (9 abas). Offline-first sobre IndexedDB.
// Gate de onboarding honesto: núcleo vazio → backup ANTES da migração → migração
// idempotente → entra. O app antigo segue inteiro em /?legacy=1.

import * as React from 'react';
import { Download, GitBranch, Play, ShieldCheck } from 'lucide-react';
import { buildBackup, downloadBackup } from '@/lib/v2/backup';
import { runMigration } from '@/lib/v2/migrate';
import { dateKeyOf } from '@/lib/v2/planner';
import { accuracyOf, RANKS, rankFor, streakOf, totalXp } from '@/lib/v2/xp';
import { useActiveSession, useAttempts, useCounts, useSessions, useSubjects, useTopics, useUnits } from '@/lib/v2/use-v2';
import { Btn, Chip } from './ui';
import { TabHoje } from './tab-hoje';
import { TabBacklog } from './tab-backlog';
import { TabTrilha } from './tab-trilha';
import { TabRevisao } from './tab-revisao';
import { TabCodeReview } from './tab-code-review';
import { TabQuests } from './tab-quests';
import { TabSprint } from './tab-sprint';
import { TabRotina } from './tab-rotina';
import { TabPerfil } from './tab-perfil';

const TABS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'trilha', label: 'Trilha' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'code-review', label: 'Code Review' },
  { id: 'quests', label: 'Quests' },
  { id: 'sprint', label: 'Sprint Review' },
  { id: 'rotina', label: 'Rotina' },
  { id: 'perfil', label: 'Perfil' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function tabFromHash(): TabId {
  const h = window.location.hash.replace('#', '');
  return (TABS.find((t) => t.id === h)?.id ?? 'hoje') as TabId;
}

export function V2App() {
  const counts = useCounts();
  const [tab, setTab] = React.useState<TabId>('hoje');

  React.useEffect(() => {
    setTab(tabFromHash());
    // popstate cobre voltar/avançar; pushState do go() já seta a aba na hora
    const onNav = () => setTab(tabFromHash());
    window.addEventListener('popstate', onNav);
    window.addEventListener('hashchange', onNav);
    return () => {
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
    };
  }, []);

  function go(t: string) {
    setTab(t as TabId);
    window.history.pushState(null, '', `#${t}`);
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
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 py-1.5 sm:px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors ${
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-4 sm:py-6">
        {tab === 'hoje' && <TabHoje onNavigate={go} />}
        {tab === 'backlog' && <TabBacklog />}
        {tab === 'trilha' && <TabTrilha />}
        {tab === 'revisao' && <TabRevisao />}
        {tab === 'code-review' && <TabCodeReview />}
        {tab === 'quests' && <TabQuests />}
        {tab === 'sprint' && <TabSprint />}
        {tab === 'rotina' && <TabRotina />}
        {tab === 'perfil' && <TabPerfil />}
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  const sessions = useSessions();
  const attempts = useAttempts();
  const xp = totalXp(sessions, attempts);
  const rank = rankFor(xp, attempts);
  const streak = streakOf(sessions, dateKeyOf());
  const active = useActiveSession();

  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-violet-400">O Projeto Principal</p>
          <h1 className="font-mono text-sm font-semibold text-zinc-50">
            estudo = commit · erro = code review · prova = deploy
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="emerald">{rank.rank.name}</Chip>
          <Chip tone="violet">{xp} XP</Chip>
          <Chip tone={streak.floorOk ? 'emerald' : 'zinc'}>streak {streak.count}d</Chip>
          {active && <Chip tone="amber">sessão viva</Chip>}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const units = useUnits();
  const attempts = useAttempts();
  const now = Date.now();
  const dueCount = units.filter((u) => u.fsrs && u.fsrs.due <= now && u.topicId).length;
  const today = dateKeyOf();
  const todayStart = new Date(`${today}T00:00:00`).getTime();
  const todayXp = attempts
    .filter((a) => a.at >= todayStart)
    .reduce((acc, a) => acc + (a.result === 'correct' ? 2 : a.result === 'wrong' ? 1 : 0), 0);
  return (
    <footer className="mt-auto border-t border-zinc-800 bg-[#0c0c0c]">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[10px] text-zinc-600 sm:px-4">
        <p>
          fila FSRS: <span className="text-zinc-400 tabular-nums">{dueCount}</span> · tentativas:{' '}
          <span className="text-zinc-400 tabular-nums">{attempts.length}</span>
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
              Snapshot do legado → 7 matérias, 24 tópicos, 98 unidades, backlog, provas, rotina →
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
