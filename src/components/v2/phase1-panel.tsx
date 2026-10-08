'use client';

// PAINEL DA FASE 1 — "O Projeto Principal" (Alicerce)
// Acessível SOMENTE em /?v2 — o Hub antigo segue 100% intocado.
// Ordem do contrato: 1) backup  2) migração idempotente (rodar 2×)  3) conferir contagens.

import * as React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  DownloadCloud,
  Play,
  RefreshCw,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildBackup, backupBytes, backupFilename, downloadBackup, restoreBackup, type HubBackup } from '@/lib/v2/backup';
import { runMigration, type MigrationResult } from '@/lib/v2/migrate';
import { DB_NAME, DB_VERSION, getDb, tableCounts } from '@/lib/v2/store';
import { V2_TABLES } from '@/lib/v2/domain';

function Chip({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
        ok === false
          ? 'border-red-500/30 bg-red-500/10 text-red-300'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      }`}
    >
      {children}
    </span>
  );
}

function Section({
  step,
  title,
  desc,
  children,
}: {
  step: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-widest text-violet-400">
          {step}
        </span>
        <h2 className="font-mono text-sm font-semibold text-zinc-100">{title}</h2>
      </div>
      <p className="mb-3 max-w-2xl text-xs leading-relaxed text-zinc-400">{desc}</p>
      {children}
    </section>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Phase1Panel() {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [backup, setBackup] = React.useState<{ name: string; bytes: number; rows: number } | null>(null);
  const [mig, setMig] = React.useState<MigrationResult | null>(null);
  const [prevMig, setPrevMig] = React.useState<MigrationResult | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number> | null>(null);
  const [restoreMsg, setRestoreMsg] = React.useState<string | null>(null);

  const refreshCounts = React.useCallback(async () => {
    try {
      setCounts(await tableCounts());
    } catch {
      /* IndexedDB indisponível — chips mostram o estado */
    }
  }, []);

  React.useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  async function onBackup() {
    setBusy('backup');
    setError(null);
    try {
      const b: HubBackup = await buildBackup();
      const name = downloadBackup(b);
      const rows = V2_TABLES.reduce((acc, t) => acc + (b.tables[t]?.length ?? 0), 0);
      setBackup({ name, bytes: backupBytes(b), rows });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no backup.');
    } finally {
      setBusy(null);
    }
  }

  async function onMigrate() {
    setBusy('migrate');
    setError(null);
    try {
      const result = await runMigration();
      setPrevMig(mig);
      setMig(result);
      await refreshCounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na migração.');
    } finally {
      setBusy(null);
    }
  }

  async function onRestore(file: File) {
    setBusy('restore');
    setError(null);
    setRestoreMsg(null);
    try {
      const ok = window.confirm(
        'Restaurar substitui o núcleo novo E as chaves do Hub no navegador pelo conteúdo do backup. Continuar?',
      );
      if (!ok) return;
      const text = await file.text();
      const r = await restoreBackup(text);
      setRestoreMsg(`Restaurado: ${r.rows} linhas em ${r.tables} tabelas · ${r.legacyKeys} chaves legadas.`);
      await refreshCounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao restaurar.');
    } finally {
      setBusy(null);
    }
  }

  const idempotent =
    prevMig && mig
      ? JSON.stringify(prevMig.counts) === JSON.stringify(mig.counts)
      : null;

  return (
    <div className="min-h-screen bg-[#0c0c0c] font-mono text-zinc-200">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Cabeçalho */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-violet-400">
              O Projeto Principal
            </p>
            <h1 className="mt-1 text-lg font-semibold text-zinc-50">
              Fase 1 — Alicerce <span className="text-zinc-500">· núcleo novo</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip ok>
              <Database className="size-3" /> {DB_NAME} v{DB_VERSION}
            </Chip>
            <Chip ok={typeof window !== 'undefined' && !!window.indexedDB}>
              <ShieldCheck className="size-3" /> IndexedDB
            </Chip>
            <Chip ok>
              <span className="text-[10px]">FSRS</span> ts-fsrs
            </Chip>
          </div>
        </header>

        <p className="mb-6 max-w-2xl text-xs leading-relaxed text-zinc-400">
          Aqui nasce o núcleo novo: <span className="text-emerald-300">matéria → tópico → unidade
          de prática</span>, com FSRS e sessões no IndexedDB — tudo offline. O Hub antigo
          (Conteúdos · Tutor · Praticar) segue intacto e alimentável; nada aqui escreve no app
          atual.{' '}
          <a href="/#library" className="text-violet-300 underline decoration-dotted">
            Voltar ao hub
          </a>
          .
        </p>

        <div className="space-y-4">
          {/* PASSO 1 — BACKUP */}
          <Section
            step="PASSO 1"
            title="Backup completo"
            desc="Exporta TODAS as tabelas do núcleo + TODAS as chaves do Hub no navegador (megachave v2, posições de PDF, simulado parcial) num único JSON. Guarde fora da máquina."
          >
            <Button
              onClick={onBackup}
              disabled={busy !== null}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {busy === 'backup' ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <DownloadCloud className="size-4" />
              )}
              Baixar backup completo (JSON)
            </Button>
            {backup && (
              <p className="mt-2 text-[11px] text-emerald-300">
                <CheckCircle2 className="mr-1 inline size-3" />
                {backup.name} · {fmtBytes(backup.bytes)} · {backup.rows} linhas do núcleo + legado
              </p>
            )}
          </Section>

          {/* PASSO 2 — MIGRAÇÃO */}
          <Section
            step="PASSO 2"
            title="Migração idempotente"
            desc="Snapshot do legado → semente do acervo (matérias, tópicos, 98 unidades, backlog, provas, rotina) → estado do usuário (cartões Leitner→FSRS, sessões, acertos como priorStats). Rode 2×: as contagens devem ser idênticas."
          >
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onMigrate}
                disabled={busy !== null}
                className="bg-violet-600 text-white hover:bg-violet-500"
              >
                {busy === 'migrate' ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                {mig ? 'Rodar migração de novo' : 'Executar migração'}
              </Button>
            </div>

            {mig && (
              <div className="mt-4 space-y-3">
                {idempotent !== null && (
                  <p
                    className={`text-[11px] ${idempotent ? 'text-emerald-300' : 'text-red-300'}`}
                  >
                    {idempotent ? (
                      <>
                        <CheckCircle2 className="mr-1 inline size-3" />
                        Idempotência provada: 2ª rodada produziu contagens idênticas.
                      </>
                    ) : (
                      <>
                        <Undo2 className="mr-1 inline size-3" />
                        Contagens divergiram entre rodadas — investigar antes de seguir.
                      </>
                    )}
                  </p>
                )}

                <div className="overflow-hidden rounded-md border border-zinc-800">
                  <table className="w-full text-[11px]">
                    <thead className="bg-zinc-900/80 text-zinc-400">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Tabela</th>
                        <th className="px-3 py-1.5 text-right font-medium">Linhas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {V2_TABLES.map((t) => (
                        <tr key={t}>
                          <td className="px-3 py-1 text-zinc-300">{t}</td>
                          <td className="px-3 py-1 text-right tabular-nums text-zinc-100">
                            {mig.counts[t] ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-1 text-[11px] text-zinc-400 sm:grid-cols-2">
                  <p>
                    Semente: <span className="text-zinc-200">{mig.seed.subjects} matérias</span> ·{' '}
                    {mig.seed.topics} tópicos · {mig.seed.units} unidades · {mig.seed.backlog}{' '}
                    backlog · {mig.seed.exams} provas
                  </p>
                  <p>
                    Estado: <span className="text-zinc-200">{mig.user.cards} cartões</span> ·{' '}
                    {mig.user.sessions} sessões · {mig.user.unitsSeeded} unidades semeadas ·{' '}
                    {mig.user.examsRegistered} notas
                  </p>
                  <p>
                    Snapshot legado: {fmtBytes(mig.snapshot.bytes)} em {mig.snapshot.keys} chaves
                    (zero perda)
                  </p>
                  <p>
                    Última rodada: {new Date(mig.ranAt).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
            )}
          </Section>

          {/* RESTAURAR */}
          <Section
            step="REDE DE SEGURANÇA"
            title="Restaurar backup"
            desc="Reverte o núcleo e as chaves do Hub ao estado do arquivo (transação única). Use só se algo sair do esperado."
          >
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-500">
              <Undo2 className="size-4" />
              Escolher arquivo de backup…
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onRestore(f);
                  e.target.value = '';
                }}
              />
            </label>
            {restoreMsg && <p className="mt-2 text-[11px] text-emerald-300">{restoreMsg}</p>}
          </Section>

          {/* Estado do núcleo agora */}
          {counts && (
            <Section
              step="NÚCLEO"
              title="Estado atual do IndexedDB"
              desc="Contagens ao vivo das tabelas — a fonte de verdade da Fase 2 (aba Hoje + FSRS) e das próximas."
            >
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                {V2_TABLES.map((t) => (
                  <span key={t}>
                    {t}: <span className="text-zinc-100 tabular-nums">{counts[t] ?? 0}</span>
                  </span>
                ))}
              </div>
              {counts.units > 0 && (
                <button
                  onClick={() => {
                    void getDb()
                      .units.orderBy('id')
                      .first()
                      .then((u) => alert(u ? `${u.id}\n\n${u.prompt.slice(0, 280)}` : 'sem unidade'));
                  }}
                  className="mt-3 text-[11px] text-violet-300 underline decoration-dotted hover:text-violet-200"
                >
                  espiar a primeira unidade de prática →
                </button>
              )}
            </Section>
          )}

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <footer className="mt-8 border-t border-zinc-800 pt-4 text-[11px] text-zinc-500">
          <p>
            Fase 1/5 · <a href="/#library" className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200">
              <ArrowLeft className="size-3" /> voltar ao Hub (a casa antiga segue a mesma)
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
