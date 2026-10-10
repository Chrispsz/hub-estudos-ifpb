'use client';

// BACKLOG — material cru aguardando conversão. Cap 5/dia (o cap é a doutrina:
// conversão é lava de backlog, não maratona). Assistida: → unidade (questão/kata)
// ou → leitura (quest de recall de 3 frases) ou → "não vou converter" (honesto).

import * as React from 'react';
import { BookOpen, ListPlus, XCircle } from 'lucide-react';
import type { BacklogItem, Topic } from '@/lib/v2/domain';
import { dateKeyOf } from '@/lib/v2/planner';
import {
  adoptBacklogIntoTopic,
  BACKLOG_DAILY_CAP,
  convertBacklogItem,
  type ConvertPlan,
} from '@/lib/v2/repo';
import { useBacklog, useMetaValue, useSubjects, useTopics } from '@/lib/v2/use-v2';
import { Btn, Chip, Empty, PageHead, Select, Textarea } from './ui';

export function TabBacklog() {
  const backlog = useBacklog();
  const subjects = useSubjects();
  const topics = useTopics();
  const todayKey = dateKeyOf();
  const doneRaw = useMetaValue(`backlog:converted:${todayKey}`);
  const done = doneRaw ? Number(doneRaw) || 0 : 0;

  const [openItem, setOpenItem] = React.useState<BacklogItem | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const open = backlog.filter((b) => b.status === 'open');
  const bySubject = new Map<string, BacklogItem[]>();
  for (const b of open) {
    const arr = bySubject.get(b.subjectId) ?? [];
    arr.push(b);
    bySubject.set(b.subjectId, arr);
  }

  async function run(plan: ConvertPlan, subjectId: string) {
    if (!openItem) return;
    const r = await convertBacklogItem(openItem.id, plan, subjectId);
    setMsg(r.ok ? 'convertido — o backlog respira' : (r.reason ?? 'falhou'));
    setOpenItem(null);
  }

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Backlog"
        title="Material cru → unidades"
        desc="Todo material do acervo vive aqui até virar unidade de prática ou leitura com recall. Máx 5 conversões/dia."
        right={
          <Chip tone={done >= BACKLOG_DAILY_CAP ? 'rose' : 'emerald'}>
            hoje: {done}/{BACKLOG_DAILY_CAP}
          </Chip>
        }
      />

      {msg && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300">
          {msg}
        </p>
      )}

      {open.length === 0 ? (
        <Empty>backlog zerado — todo o acervo virou prática</Empty>
      ) : (
        [...bySubject.entries()].map(([subjectId, items]) => {
          const sub = subjects.find((s) => s.id === subjectId);
          return (
            <div key={subjectId}>
              <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                {sub?.shortName ?? subjectId} · {items.length}
              </p>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOpenItem(item)}
                    className="flex w-full items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-left transition-colors hover:border-zinc-600"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">
                      {item.title}
                    </span>
                    <Chip tone="zinc">{item.kind}</Chip>
                    <Chip tone={item.suggestedType === 'kata' ? 'violet' : 'emerald'}>
                      → {item.suggestedType === 'kata' ? 'kata' : 'questão'}
                    </Chip>
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}

      <details className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
        <summary className="cursor-pointer font-mono text-[11px] text-zinc-500">
          processados ({backlog.filter((b) => b.status !== 'open').length})
        </summary>
        <div className="mt-2 space-y-2">
          {backlog
            .filter((b) => b.status !== 'open')
            .map((b) => (
              <div key={b.id} className="space-y-1">
                <p className="truncate font-mono text-[11px] text-zinc-600">
                  <span className={b.status === 'converted' ? 'text-emerald-500' : 'text-zinc-600'}>
                    {b.status === 'converted' ? '✓' : '×'}
                  </span>{' '}
                  {b.title}
                </p>
                {/* beco Backlog→Trilha fechado (Run #4/R3): a conversão nasce
                    topicId:null — aqui ela é adotada por um tópico da matéria
                    (2 cliques) e aparece na escadinha na hora (queries live) */}
                {b.status === 'converted' && b.convertedUnitIds.length > 0 && (
                  <AdoptRow
                    item={b}
                    topics={topics
                      .filter((t) => t.subjectId === b.subjectId)
                      .sort((a, b2) => a.order - b2.order)}
                  />
                )}
              </div>
            ))}
        </div>
      </details>

      {openItem && (
        <ConvertDialog
          item={openItem}
          onClose={() => setOpenItem(null)}
          onRun={run}
        />
      )}
    </div>
  );
}

/** Linha de adoção (Run #4): conversão sem tópico ganha lugar na escadinha —
 *  select com os tópicos da matéria + botão adotar + feedback inline. */
function AdoptRow({ item, topics }: { item: BacklogItem; topics: Topic[] }) {
  const [topicId, setTopicId] = React.useState('');
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function adopt() {
    if (!topicId || busy) return;
    setBusy(true);
    try {
      const r = await adoptBacklogIntoTopic(item.id, topicId);
      if (r.ok) {
        const t = topics.find((x) => x.id === topicId);
        setMsg({
          ok: true,
          text:
            (r.moved ?? 0) > 0
              ? `adotado: ${r.moved} unidade(s) → ${t?.name ?? 'tópico'}`
              : 'já estava nesse tópico — nada mudou',
        });
      } else {
        setMsg({ ok: false, text: r.reason ?? 'falhou' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-4">
      <Select
        value={topicId}
        onChange={(e) => {
          setTopicId(e.target.value);
          setMsg(null);
        }}
        aria-label={`adotar "${item.title}" em um tópico`}
        className="max-w-[16rem] truncate"
      >
        <option value="">adotar em tópico…</option>
        {topics.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Btn variant="outline" disabled={!topicId || busy} onClick={() => void adopt()}>
        adotar
      </Btn>
      {msg && (
        <span
          role="status"
          className={`font-mono text-[10px] ${msg.ok ? 'text-emerald-400' : 'text-amber-300'}`}
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}

function ConvertDialog({
  item,
  onClose,
  onRun,
}: {
  item: BacklogItem;
  onClose: () => void;
  onRun: (plan: ConvertPlan, subjectId: string) => void;
}) {
  const [mode, setMode] = React.useState<'unit' | 'reading'>(
    item.suggestedType === 'kata' ? 'unit' : 'unit',
  );
  const [type, setType] = React.useState<'question' | 'kata'>(item.suggestedType === 'kata' ? 'kata' : 'question');
  const [prompt, setPrompt] = React.useState('');
  const [answer, setAnswer] = React.useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-zinc-700 bg-zinc-900 p-4 sm:rounded-lg">
        <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">converter backlog</p>
        <h3 className="mt-0.5 font-mono text-sm font-semibold text-zinc-100">{item.title}</h3>
        {item.sourceRef.pdfPath && (
          <a
            href={item.sourceRef.pdfPath}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block font-mono text-[11px] text-emerald-400 underline decoration-dotted"
          >
            abrir PDF original ↗
          </a>
        )}

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Btn variant={mode === 'unit' ? 'violet' : 'outline'} onClick={() => setMode('unit')}>
              <ListPlus className="size-3.5" /> unidade de prática
            </Btn>
            <Btn variant={mode === 'reading' ? 'violet' : 'outline'} onClick={() => setMode('reading')}>
              <BookOpen className="size-3.5" /> leitura (recall 3 frases)
            </Btn>
          </div>

          {mode === 'unit' ? (
            <>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  enunciado (cole do PDF)
                </label>
                <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  resposta/solução (opcional)
                </label>
                <Textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">tipo:</span>
                <Select value={type} onChange={(e) => setType(e.target.value as 'question' | 'kata')}>
                  <option value="question">questão</option>
                  <option value="kata">kata (código)</option>
                </Select>
              </div>
              <Btn
                variant="emerald"
                disabled={!prompt.trim()}
                onClick={() => onRun({ mode: 'unit', prompt: prompt.trim(), answer: answer.trim() || undefined, type }, item.subjectId)}
              >
                criar unidade (+3 XP do cap diário)
              </Btn>
            </>
          ) : (
            <Btn variant="emerald" onClick={() => onRun({ mode: 'reading', title: `Ler: ${item.title}`, materialId: item.sourceRef.materialId }, item.subjectId)}>
              criar leitura com recall (+3 XP do cap diário)
            </Btn>
          )}

          <Btn variant="ghost" onClick={() => onRun({ mode: 'wont' }, item.subjectId)}>
            <XCircle className="size-3.5" /> não vou converter este
          </Btn>
        </div>

        <div className="mt-4 border-t border-zinc-800 pt-3">
          <Btn variant="ghost" onClick={onClose} className="w-full">
            fechar sem converter
          </Btn>
        </div>
      </div>
    </div>
  );
}

