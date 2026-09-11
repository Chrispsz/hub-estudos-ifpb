'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  Dumbbell,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Header } from '@/components/hub/header';
import { CommandPalette } from '@/components/hub/command-palette';
import { BackToTop } from '@/components/hub/back-to-top';
import { Footer } from '@/components/hub/footer';
import { SidebarNav, type TabKey, type NavItem } from '@/components/hub/sidebar-nav';
import { Dashboard } from '@/components/hub/dashboard';
import { StudyView } from '@/components/hub/study-view';
import { LibraryView } from '@/components/hub/library-view';
import { PracticeView } from '@/components/hub/practice-view';
import { ScheduleView } from '@/components/hub/schedule-view';
import { ProgressView } from '@/components/hub/progress-view';
import { PnaatView } from '@/components/hub/pnaat-view';
import { SettingsView } from '@/components/hub/settings-view';
import { useStudyProgress } from '@/lib/study-progress';
import { useSmartCrons } from '@/lib/use-smart-crons';
import { materials } from '@/data/course-data';

const VALID_TABS: TabKey[] = [
  'dashboard',
  'study',
  'library',
  'practice',
  'schedule',
  'progress',
  'pnaat',
  'settings',
];

function tabFromHash(): TabKey | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.replace(/^#\/?/, '') as TabKey;
  return VALID_TABS.includes(h) ? h : null;
}

export default function Page() {
  const sp = useStudyProgress();
  useSmartCrons();

  // Estado inicial SEMPRE 'dashboard' — o hash é restaurado logo após a
  // hidratação (abaixo). Ler o hash no useState causava hydration mismatch
  // quando o usuário recarrega com #aba na URL (SSR renderiza dashboard).
  const [active, setActiveState] = React.useState<TabKey>('dashboard');

  // Restaura a aba da URL (ex.: /#study) após a hidratação, sem mismatch.
  React.useEffect(() => {
    const k = tabFromHash();
    if (k) setActiveState(k);
  }, []);

  // Parâmetros para a aba "Estudar" (dashboard → "iniciar estudo de hoje")
  const [studyDiscipline, setStudyDiscipline] = React.useState<string | undefined>(undefined);
  const [studyMaterial, setStudyMaterial] = React.useState<string | undefined>(undefined);

  const setActive = React.useCallback((k: TabKey) => {
    setActiveState(k);
    // Hash na URL → botão voltar do browser volta para a aba anterior
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}${window.location.search}#${k}`;
      window.history.pushState({ tab: k }, '', newUrl);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  // Voltar/avançar do browser → troca de aba conforme o hash
  React.useEffect(() => {
    function onPopState() {
      const k = tabFromHash();
      if (k) {
        setActiveState(k);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Garante hash na primeira carga
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.hash) {
      window.history.replaceState({ tab: 'dashboard' }, '', '#dashboard');
    }
  }, []);

  // Badges dinâmicos
  const notViewedCount = React.useMemo(
    () =>
      materials.filter(
        (m) =>
          !sp.progress.recentMaterials.some((r) => r.id === m.id) &&
          !sp.progress.completedMaterials.includes(m.id),
      ).length,
    [sp.progress.recentMaterials, sp.progress.completedMaterials],
  );

  const totalCompleted = sp.progress.completedMaterials.length;
  const totalMaterials = materials.length;
  const overallProgress =
    totalMaterials > 0 ? Math.round((totalCompleted / totalMaterials) * 100) : 0;

  const items: NavItem[] = [
    {
      value: 'dashboard',
      label: 'Visão Geral',
      shortLabel: 'Visão',
      icon: <LayoutDashboard className="size-4" />,
    },
    { value: 'study', label: 'Estudar', shortLabel: 'Estudar', icon: <Zap className="size-4" /> },
    {
      value: 'library',
      label: 'Biblioteca',
      shortLabel: 'Biblioteca',
      icon: <BookOpen className="size-4" />,
      badge: notViewedCount,
      badgeColor: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      value: 'practice',
      label: 'Praticar',
      shortLabel: 'Praticar',
      icon: <Dumbbell className="size-4" />,
      badge: sp.flashcardStats.due,
      badgeColor:
        'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300',
    },
    {
      value: 'schedule',
      label: 'Cronograma',
      shortLabel: 'Cronograma',
      icon: <CalendarDays className="size-4" />,
    },
    {
      value: 'progress',
      label: 'Progresso',
      shortLabel: 'Progresso',
      icon: <TrendingUp className="size-4" />,
    },
    { value: 'pnaat', label: 'PNAAT', shortLabel: 'PNAAT', icon: <BookOpen className="size-4" /> },
    {
      value: 'settings',
      label: 'Configurações',
      shortLabel: 'Config.',
      icon: <Settings className="size-4" />,
    },
  ];

  function goStudy(disciplineCode?: string, materialId?: string) {
    setStudyDiscipline(disciplineCode);
    setStudyMaterial(materialId);
    setActive('study');
  }

  const activeContent = (() => {
    switch (active) {
      case 'dashboard':
        return (
          <Dashboard
            onStartStudy={goStudy}
            onOpenSchedule={() => setActive('schedule')}
            onOpenLibrary={() => setActive('library')}
            onOpenPractice={() => setActive('practice')}
          />
        );
      case 'study':
        return <StudyView initialDiscipline={studyDiscipline} initialMaterial={studyMaterial} />;
      case 'library':
        return <LibraryView />;
      case 'practice':
        return <PracticeView />;
      case 'schedule':
        return <ScheduleView />;
      case 'progress':
        return <ProgressView />;
      case 'pnaat':
        return <PnaatView />;
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  })();

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <SidebarNav
        active={active}
        onChange={setActive}
        items={items}
        overallProgress={overallProgress}
        totalCompleted={totalCompleted}
        totalMaterials={totalMaterials}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {activeContent}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
      <BackToTop />
      <CommandPalette onNavigate={setActive} />
    </div>
  );
}
