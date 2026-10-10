'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Dumbbell, Sparkles } from 'lucide-react';
import { Header } from '@/components/hub/header';
import { CommandPalette } from '@/components/hub/command-palette';
import { BackToTop } from '@/components/hub/back-to-top';
import { Footer } from '@/components/hub/footer';
import { SidebarNav, type TabKey, type NavItem } from '@/components/hub/sidebar-nav';
import { StudyView } from '@/components/hub/study-view';
import { LibraryView } from '@/components/hub/library-view';
import { PracticeView } from '@/components/hub/practice-view';
import { useStudyProgress } from '@/lib/study-progress';
import { StudyFocusProvider } from '@/lib/pomodoro-engine';
import { OPEN_SIMULADO_EVENT, OPEN_PRACTICE_EVENT, OPEN_PROGRESS_EVENT, type OpenPracticeDetail, type OpenSimuladoDetail } from '@/lib/hub-events';
import { OPEN_TUTOR_EVENT, type OpenTutorDetail } from '@/lib/hub-events';
import { materials } from '@/data/course-data';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// DECISÃO DO DONO (10/10/2026): a LEGACY volta a ser a casa em `/`. A evolução do
// produto passa a ser feita DENTRO dela (IA/tutor integrado a tudo, mais simples,
// com acompanhamento central) — "a legacy só que melhor e mais limpa".
// O experimento v2 permanece no repositório como referência, SEM porta de entrada;
// o console técnico da Fase 1 segue em /?v2.
const Phase1Panel = dynamic(() => import('@/components/v2/phase1-panel'), {
  ssr: false,
});
// A CALCULADORA DE NOTAS religada (GIT-1: cortada na mega-limpeza c902ad7;
// fontes íntegras no git — a fiação de gravação setRealGrade nunca morreu).
const GradeCalculator = dynamic(
  () => import('@/components/hub/grade-calculator').then((m) => m.GradeCalculator),
  { ssr: false },
);

const VALID_TABS: TabKey[] = ['library', 'study', 'practice'];

function tabFromHash(): TabKey | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.replace(/^#\/?/, '') as TabKey;
  return VALID_TABS.includes(h) ? h : null;
}

export default function Page() {
  const sp = useStudyProgress();

  // Estado inicial SEMPRE 'library' — o hash é restaurado logo após a
  // hidratação (abaixo). Ler o hash no useState causava hydration mismatch
  // quando o usuário recarrega com #aba na URL (SSR renderiza library).
  const [active, setActiveState] = React.useState<TabKey>('library');

  // Restaura a aba da URL (ex.: /#study) após a hidratação, sem mismatch.
  React.useEffect(() => {
    const k = tabFromHash();
    if (k) setActiveState(k);
  }, []);

  // Parâmetros para a aba "Tutor" (library → "abrir o tutor")
  const [studyDiscipline, setStudyDiscipline] = React.useState<string | undefined>(undefined);
  const [studyMaterial, setStudyMaterial] = React.useState<string | undefined>(undefined);

  // Pedido externo (evento hub:open-tutor) → abre o chat com a pergunta pronta.
  const [tutorReq, setTutorReq] = React.useState<
    { detail: OpenTutorDetail; nonce: number } | undefined
  >(undefined);
  const tutorNonce = React.useRef(0);
  React.useEffect(() => {
    function onOpenTutor(e: Event) {
      const detail = (e as CustomEvent<OpenTutorDetail>).detail ?? {};
      tutorNonce.current += 1;
      setTutorReq({ detail, nonce: tutorNonce.current });
      setActiveState('study');
      if (typeof window !== 'undefined') {
        const newUrl = `${window.location.pathname}${window.location.search}#study`;
        window.history.pushState({ tab: 'study' }, '', newUrl);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
    window.addEventListener(OPEN_TUTOR_EVENT, onOpenTutor);
    return () => window.removeEventListener(OPEN_TUTOR_EVENT, onOpenTutor);
  }, []);

  // Pedido externo (evento hub:open-simulado — Caderno de Erros) → abre o
  // Simulado Pro pré-configurado na aba Praticar.
  const [simuladoReq, setSimuladoReq] = React.useState<
    { detail: OpenSimuladoDetail; nonce: number } | undefined
  >(undefined);
  const simuladoNonce = React.useRef(0);
  React.useEffect(() => {
    function onOpenSimulado(e: Event) {
      const detail = (e as CustomEvent<OpenSimuladoDetail>).detail ?? {};
      simuladoNonce.current += 1;
      setSimuladoReq({ detail, nonce: simuladoNonce.current });
      setActiveState('practice');
      if (typeof window !== 'undefined') {
        const newUrl = `${window.location.pathname}${window.location.search}#practice`;
        window.history.pushState({ tab: 'practice' }, '', newUrl);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
    window.addEventListener(OPEN_SIMULADO_EVENT, onOpenSimulado);
    return () => window.removeEventListener(OPEN_SIMULADO_EVENT, onOpenSimulado);
  }, []);

  // Pedido externo (evento hub:open-practice — resumo IA → questões ligadas)
  // → abre a aba Praticar pré-filtrada.
  const [practiceReq, setPracticeReq] = React.useState<
    { detail: OpenPracticeDetail; nonce: number } | undefined
  >(undefined);
  const practiceNonce = React.useRef(0);
  React.useEffect(() => {
    function onOpenPractice(e: Event) {
      const detail = (e as CustomEvent<OpenPracticeDetail>).detail ?? {};
      practiceNonce.current += 1;
      setPracticeReq({ detail, nonce: practiceNonce.current });
      setActiveState('practice');
      if (typeof window !== 'undefined') {
        const newUrl = `${window.location.pathname}${window.location.search}#practice`;
        window.history.pushState({ tab: 'practice' }, '', newUrl);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
    window.addEventListener(OPEN_PRACTICE_EVENT, onOpenPractice);
    return () => window.removeEventListener(OPEN_PRACTICE_EVENT, onOpenPractice);
  }, []);

  // Pedido externo (evento hub:open-progress — Calculadora de Notas do
  // dashboard/da paleta) → abre o Dialog da calculadora (religada do git).
  const [progressReq, setProgressReq] = React.useState<{ nonce: number } | undefined>(
    undefined,
  );
  React.useEffect(() => {
    function onOpenProgress() {
      setProgressReq({ nonce: Date.now() });
    }
    window.addEventListener(OPEN_PROGRESS_EVENT, onOpenProgress);
    return () => window.removeEventListener(OPEN_PROGRESS_EVENT, onOpenProgress);
  }, []);

  const setActive = React.useCallback((k: TabKey) => {
    // 'dashboard' chega do command palette (atalhos kit/plano) — a casa é a library.
    const target = (k === 'dashboard' ? 'library' : k) as TabKey;
    setActiveState(target);
    // Hash na URL → botão voltar do browser volta para a aba anterior
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}${window.location.search}#${target}`;
      window.history.pushState({ tab: target }, '', newUrl);
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
      window.history.replaceState({ tab: 'library' }, '', '#library');
    }
  }, []);

  // Painel técnico da Fase 1 (/?v2) — o legado É o app padrão em `/`
  const [showV2, setShowV2] = React.useState(false);
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setShowV2(params.has('v2'));
    } catch {
      /* sem query string */
    }
  }, []);

  // Badge de conteúdos ainda não vistos
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
      value: 'library',
      label: 'Conteúdos',
      shortLabel: 'Conteúdos',
      icon: <BookOpen className="size-4" />,
      badge: notViewedCount,
      badgeColor:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      value: 'study',
      label: 'Tutor IA',
      shortLabel: 'Tutor',
      icon: <Sparkles className="size-4" />,
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
  ];

  function goStudy(disciplineCode?: string, materialId?: string) {
    setStudyDiscipline(disciplineCode);
    setStudyMaterial(materialId);
    setActive('study');
  }

  const activeContent = (() => {
    switch (active) {
      case 'library':
        return <LibraryView onStartStudy={goStudy} />;
      case 'study':
        return <StudyView initialDiscipline={studyDiscipline} initialMaterial={studyMaterial} tutorReq={tutorReq} sp={sp} />;
      case 'practice':
        return <PracticeView simuladoReq={simuladoReq} practiceReq={practiceReq} />;
      default:
        return null;
    }
  })();

  // ?v2 = console técnico · padrão = a casa (legacy) — decisão do dono, 10/10/2026
  if (showV2) return <Phase1Panel />;

  return (
    <StudyFocusProvider sp={sp}>
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

      {/* Calculadora de notas — religada do histórico (evento hub:open-progress) */}
      <Dialog open={!!progressReq} onOpenChange={(v) => { if (!v) setProgressReq(undefined); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Calculadora de notas</DialogTitle>
            <DialogDescription>
              Médias reais por disciplina — o que você salva aqui vira o registro oficial do
              seu semestre.
            </DialogDescription>
          </DialogHeader>
          <GradeCalculator />
        </DialogContent>
      </Dialog>
    </div>
    </StudyFocusProvider>
  );
}
