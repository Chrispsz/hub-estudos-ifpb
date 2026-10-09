'use client';

// PERFIL — rank (XP + acerto real), streak (piso 60min), Modo Recuperação,
// backup/restauração (o bundle completo do dono) e a porta para a casa antiga.

import * as React from 'react';
import { ArrowUpRight, Database, Download, GitBranch, Upload } from 'lucide-react';
import type { Attempt, StudySession } from '@/lib/v2/domain';
import { dateKeyOf } from '@/lib/v2/planner';
import { buildBackup, downloadBackup, restoreBackup } from '@/lib/v2/backup';
import { runMigration } from '@/lib/v2/migrate';
import { accuracyOf, RANKS, rankFor, streakOf, totalXp } from '@/lib/v2/xp';
import { recoveryStatus, type PlannerCtx } from '@/lib/v2/planner';
import {
  useAttempts,
  useBacklog,
  useCards,
  useCounts,
  useExams,
  useSessions,
  useSubjects,
  useTopics,
  useUnits,
} from '@/lib/v2/use-v2';
import { Btn, Chip, DomainBar, PageHead, Stat } from './ui';

export function TabPerfil() {
  const subjects = useSubjects();
  const topics = useTopics();
  const units = useUnits();
  const cards = useCards();
  const attempts = useAttempts();
  const sessions = useSessions();
  const backlog = useBacklog();
  const exams = useExams();
  const counts = useCounts();

  const [msg, setMsg] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const todayKey = dateKeyOf();
  const xp = totalXp(sessions, attempts);
  const { acc, correct, tried } = accuracyOf(attempts);
  const rank = rankFor(xp, attempts);
  const streak = streakOf(sessions as StudySession[], todayKey);

  const recovery = React.useMemo(() => {
    const ctx: PlannerCtx = {
      now: Date.now(),
      dateKey: todayKey,
      subjects,
      topics,
      units,
      attempts,
      cards,
      exams,
      backlog,
      template: { id: 'normal-weekday', label: '', blocks: [] },
    };
    return recoveryStatus(ctx);
     
  }, [subjects, topics, units, attempts, cards, exams, backlog, todayKey]);

  async function onBackup() {
    setBusy(true);
    try {
      const b = await buildBackup();
      downloadBackup(b);
      setMsg('backup baixado — guarde fora da máquina');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'falha no backup');
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(file: File) {
    if (!window.confirm('Restaurar substitui o núcleo E as chaves do Hub pelo conteúdo do arquivo. Continuar?')) return;
    setBusy(true);
    try {
      const r = await restoreBackup(await file.text());
      setMsg(`restaurado: ${r.rows} linhas · ${r.legacyKeys} chaves legadas`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'falha ao restaurar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Perfil"
        title="O dono do projeto"
        desc="Rank por XP + taxa de acerto REAL. XP nasce só de trabalho: sessão ≥15min, unidade respondida, revisão do dia, conversão."
      />

      {/* rank */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">rank atual</p>
            <p className="font-mono text-2xl font-bold text-zinc-50">{rank.rank.name}</p>
            <p className="text-[11px] text-zinc-500">{rank.rank.desc}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">acerto real</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
              {tried ? `${Math.round(acc * 100)}%` : '—'}
            </p>
            <p className="text-[11px] text-zinc-500">{correct}/{tried} tentativas</p>
          </div>
        </div>
        {rank.next ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
              <span>
                → {rank.next.name}: faltam {rank.xpToNext} XP · {rank.accToNext > 0 ? `${rank.accToNext} p.p. de acerto` : 'acerto ok'}
              </span>
              <span className="tabular-nums">{rank.progress}%</span>
            </div>
            <DomainBar value={rank.progress} />
          </div>
        ) : (
          <p className="mt-3 font-mono text-[11px] text-emerald-400">rank máximo — a casa reconhece</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {RANKS.map((r) => (
            <Chip key={r.id} tone={xp >= r.minXp && acc >= r.minAcc ? 'emerald' : 'zinc'}>
              {r.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="XP total" value={xp} hint="só trabalho real" />
        <Stat
          label="streak"
          value={`${streak.count}d`}
          hint={streak.floorOk ? 'piso de 60min pago hoje' : 'faltam ' + Math.max(0, 60 - streak.todayMinutes) + 'min hoje'}
        />
        <Stat label="minutos hoje" value={streak.todayMinutes} hint="vagabond não conta" />
        <Stat label="unidades tocadas" value={attempts.filter((a) => a.result !== 'skipped').length} hint="tentativas reais" />
      </div>

      {/* modo recuperação */}
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
        <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-violet-300">
          <GitBranch className="size-3.5" /> modo recuperação
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="dívida do ritmo"
            value={recovery.ritmoDebt}
            hint={recovery.ritmoDebt === 0 ? 'todas as matérias com toque recente' : 'matérias sem toque ≥7d'}
          />
          <Stat label="fundação" value={`${recovery.fundacaoProgress}%`} hint="tópicos estáveis na escadinha" />
        </div>
        <p className={`mt-2 font-mono text-[11px] ${recovery.exitReady ? 'text-emerald-400' : 'text-zinc-400'}`}>
          {recovery.exitReady
            ? 'condições de saída alcançadas: ritmo sem dívida + fundação sólida — modo pode ser desligado'
            : 'saída do modo: ritmo sem dívida + fundação alcançando o semestre anterior'}
        </p>
      </div>

      {/* backup */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          <Database className="size-3.5" /> núcleo & backup
        </p>
        <p className="mb-3 text-[11px] text-zinc-400">
          Bundle completo: todas as tabelas do IndexedDB + chaves do Hub no navegador. Migração idempotente: rodar de novo nunca duplica.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn variant="emerald" disabled={busy} onClick={() => void onBackup()}>
            <Download className="size-3.5" /> baixar backup (JSON)
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onRestore(f);
              e.target.value = '';
            }}
          />
          <Btn variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> restaurar backup
          </Btn>
          <Btn variant="outline" disabled={busy} onClick={() => void runMigration().then(() => setMsg('migração re-executada (idempotente)'))}>
            re-executar migração
          </Btn>
        </div>
        {counts && (
          <p className="mt-2 font-mono text-[10px] text-zinc-600">
            {counts.subjects} matérias · {counts.topics} tópicos · {counts.units} unidades · {counts.attempts} tentativas · {counts.sessions} sessões · {counts.cards} cartões
          </p>
        )}
        {msg && <p className="mt-2 font-mono text-[11px] text-emerald-400">{msg}</p>}
      </div>

      <a
        href="/?legacy=1"
        className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition-colors hover:border-zinc-600"
      >
        <div>
          <p className="font-mono text-xs text-zinc-200">casa antiga (Hub legado)</p>
          <p className="text-[11px] text-zinc-500">tutor IA, PDFs do acervo e a biblioteca completa — tudo continua lá</p>
        </div>
        <ArrowUpRight className="size-4 text-zinc-500" />
      </a>
    </div>
  );
}
