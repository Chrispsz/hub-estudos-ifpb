'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useStudyProgress } from './study-progress';
import { evaluationPeriods, getDisciplineByCode, disciplines } from '@/data/course-data';
import { daysUntilDate, currentWeekOfSemester, upcomingEvents } from './semester';

const STORAGE_KEY = 'hub-estudos-ifpb:cron-state';

interface CronState {
  lastDailyCheck: string;
  lastNotifiedEvals: string[];
  lastStaleNotified: string;
  /** Ids de eventos do calendário já notificados hoje (feriados, sábados letivos, provas, prazos). */
  lastNotifiedEvents: string[];
}

const defaultState: CronState = {
  lastDailyCheck: '',
  lastNotifiedEvals: [],
  lastStaleNotified: '',
  lastNotifiedEvents: [],
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/**
 * Hook de crons inteligentes — roda em background no cliente.
 *
 * 1. Check de avaliações próximas (≤7 dias) — 1x por dia
 * 2. Aviso de disciplina parada (≥5 dias sem estudar) — 1x por dia
 * 3. Interval de 60s — detecta virada de meia-noite
 * 4. Ao voltar para a aba (visibilitychange) — re-roda check
 *
 * Nota: o toast de boas-vindas foi removido (ruído sem valor — feedback do usuário).
 */
export function useSmartCrons() {
  const sp = useStudyProgress();
  const [state, setState] = React.useState<CronState>(defaultState);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CronState>;
        // Migração: estado antigo tinha "welcomed" — descartado silenciosamente
        setState({
          lastDailyCheck: parsed.lastDailyCheck ?? '',
          lastNotifiedEvals: Array.isArray(parsed.lastNotifiedEvals) ? parsed.lastNotifiedEvals : [],
          lastStaleNotified: parsed.lastStaleNotified ?? '',
          lastNotifiedEvents: Array.isArray(parsed.lastNotifiedEvents) ? parsed.lastNotifiedEvents : [],
        });
      }
    } catch {}
    setHydrated(true);
  }, []);

  const runDailyCheck = React.useCallback(() => {
    if (!hydrated) return;
    const today = todayISO();
    if (state.lastDailyCheck === today) return;

    const notified = [...state.lastNotifiedEvals];
    // Novo dia (ou 1º check do dia): notificações de eventos do calendário recomeçam.
    const notifiedEvents: string[] = [];

    // 1. Eventos do calendário oficial (hoje/amanhã/em 2 dias) — 1 toast por evento/dia
    const RELEVANT_KINDS = new Set(['feriado', 'letivo', 'provas', 'prazo']);
    for (const ev of upcomingEvents(new Date(), 10)) {
      if (!RELEVANT_KINDS.has(ev.kind)) continue;
      if (ev.daysLeft > 2) break; // upcomingEvents vem ordenado — pode parar
      const evId = `${ev.date}|${ev.title}`;
      if (notifiedEvents.includes(evId)) continue;
      const when =
        ev.daysLeft === 0 ? 'Hoje' : ev.daysLeft === 1 ? 'Amanhã' : `Em ${ev.daysLeft} dias`;
      const emoji =
        ev.kind === 'feriado' ? '🏖️' : ev.kind === 'provas' ? '📝' : ev.kind === 'prazo' ? '⏰' : '📚';
      toast.info(`${emoji} ${when}: ${ev.title}`, {
        description: ev.description ?? 'Calendário acadêmico oficial IFPB Cajazeiras.',
        duration: 9000,
      });
      notifiedEvents.push(evId);
    }

    // 2. Avaliações com DATA OFICIAL próximas (≤7 dias).
    // Política ANTI-ESTIMATIVA: sem `date` oficial não há alarme (reposição condicional
    // só avisa quando o professor publicar a data).
    for (const ev of evaluationPeriods) {
      if (ev.conditional || !ev.date) continue; // reposição só avisa se o aluno agendar; sem data = sem alarme
      const days = daysUntilDate(ev.date);
      if (days >= 0 && days <= 7) {
        const id = `${ev.disciplineCode}-${ev.evaluationName}`;
        if (!notified.includes(id)) {
          const disc = getDisciplineByCode(ev.disciplineCode);
          toast.warning(
            `Faltam ${days} ${days === 1 ? 'dia' : 'dias'} para ${ev.evaluationName} — ${disc?.shortName ?? ev.disciplineCode}`,
            {
              description: ev.description,
              duration: 8000,
            },
          );
          notified.push(id);
        }
      }
    }

    // 3. Disciplinas paradas (≥5 dias)
    const stale: string[] = [];
    for (const d of disciplines) {
      const dp = sp.progress.disciplineProgress[d.code];
      if (!dp?.lastStudiedAt) continue;
      const last = new Date(dp.lastStudiedAt);
      if (Number.isNaN(last.getTime())) continue; // data corrompida → ignora
      const diffDays = Math.floor((Date.now() - last.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays >= 5) stale.push(`${d.shortName} (${diffDays}d)`);
    }
    if (stale.length > 0 && state.lastStaleNotified !== today) {
      toast.info(`Disciplinas paradas: ${stale.join(', ')}`, {
        description: 'Que tal revisar um tópico hoje?',
        duration: 6000,
      });
    }

    setState((s) => ({
      ...s,
      lastDailyCheck: today,
      lastNotifiedEvals: notified,
      lastStaleNotified: stale.length > 0 ? today : s.lastStaleNotified,
      lastNotifiedEvents: notifiedEvents,
    }));
  }, [hydrated, state, sp.progress.disciplineProgress]);

  // Efeito 1: check diário ao montar (com delay 1.5s)
  React.useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(runDailyCheck, 1500);
    return () => clearTimeout(id);
  }, [hydrated, runDailyCheck]);

  // Efeito 2: interval de 60s — detecta meia-noite
  React.useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => {
      setState((s) => {
        if (s.lastDailyCheck !== todayISO()) {
          runDailyCheck();
        }
        return s;
      });
    }, 60000);
    return () => clearInterval(id);
  }, [hydrated, runDailyCheck]);

  // Efeito 3: ao voltar para a aba — re-roda check
  React.useEffect(() => {
    if (!hydrated) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        runDailyCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [hydrated, runDailyCheck]);

  return { runDailyCheck, currentWeek: currentWeekOfSemester() };
}
