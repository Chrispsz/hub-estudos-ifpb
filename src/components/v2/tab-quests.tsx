'use client';

// QUESTS — as issues do projeto. Sabores:
//   issue    — tarefa comum (daily/weekly/once)
//   quadro   — Modo Quadro: resolve no quadro/caderno e anexa FOTO (comprimida)
//   leitura  — leitura com recall ATIVO: 3 frases de memória, depois confere
//   projeto  — o slot de Projeto real (um por vez — foco é a doutrina)
//   vagabond — Modo Vagabond: estudar por prazer, 0 XP, não conta streak
// Guard-rail: quest completa NÃO dá XP — XP vem de sessão/unidade/revisão/conversão.

import * as React from 'react';
import { Check, Camera, Coffee, FolderKanban, Plus, Trash2, X } from 'lucide-react';
import type { Quest } from '@/lib/v2/domain';
import { completeQuest, deleteQuest, nid, startSession, upsertQuest } from '@/lib/v2/repo';
import { useQuests } from '@/lib/v2/use-v2';
import { Btn, Chip, Empty, Input, PageHead, Select, Textarea } from './ui';

export function TabQuests() {
  const quests = useQuests();
  const [msg, setMsg] = React.useState<string | null>(null);

  const open = quests.filter((q) => q.status === 'open');
  const issues = open.filter((q) => !q.flavor || q.flavor === 'issue');
  const quadro = open.filter((q) => q.flavor === 'quadro');
  const leitura = open.filter((q) => q.flavor === 'leitura');
  const projeto = open.find((q) => q.flavor === 'projeto');
  const doneCount = quests.filter((q) => q.status === 'done').length;

  async function addIssue(title: string, kind: Quest['kind']) {
    if (!title.trim()) return;
    await upsertQuest({
      id: nid('q'),
      title: title.trim(),
      kind,
      status: 'open',
      xp: 0,
      createdAt: Date.now(),
      flavor: 'issue',
    });
    setMsg('issue aberta — commit de estudo resolve');
  }

  async function addFlavor(flavor: Quest['flavor'], title: string, materialId?: string) {
    if (!title.trim()) return;
    await upsertQuest({
      id: nid('q'),
      title: title.trim(),
      kind: 'once',
      status: 'open',
      xp: 0,
      createdAt: Date.now(),
      flavor,
      materialId,
    });
    setMsg(flavor === 'projeto' ? 'projeto no slot — sábado é dele' : 'criada');
  }

  async function startVagabond() {
    await startSession({ kind: 'vagabond', vagabond: true });
    setMsg('vagabond vivo — 0 XP, 0 cobrança. Volte quando quiser.');
  }

  return (
    <div className="space-y-4">
      <PageHead
        kicker="Quests"
        title="Issues do projeto"
        desc="Tarefa = issue. Quest completa não dá XP (guard-rail) — o XP continua vindo do trabalho real."
        right={<Chip tone="zinc">{doneCount} concluídas</Chip>}
      />

      {msg && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300">
          {msg}
        </p>
      )}

      {/* Modo Vagabond */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <Coffee className="size-5 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-semibold text-amber-300">Modo Vagabond</p>
          <p className="text-[11px] text-zinc-400">
            estudar sem o crachá: 0 XP, não conta streak, não cobra frase de erro. Pra ler por ler.
          </p>
        </div>
        <Btn variant="outline" onClick={() => void startVagabond()}>
          abrir vagabond (0 XP)
        </Btn>
      </div>

      {/* Slot de Projeto */}
      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
        <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-orange-300">
          <FolderKanban className="size-3.5" /> slot de projeto — um por vez
        </p>
        {projeto ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-100">{projeto.title}</p>
            <Chip tone="orange">no forno</Chip>
            <Btn variant="emerald" onClick={() => void completeQuest(projeto.id)}>
              <Check className="size-3.5" /> entregue
            </Btn>
          </div>
        ) : (
          <NewInline
            placeholder="ex.: compilador minúsculo em C — parser de expressões"
            onAdd={(t) => void addFlavor('projeto', t)}
          />
        )}
      </div>

      {/* Modo Quadro */}
      <Section title="Modo Quadro — resolve à mão, anexa a foto">
        {quadro.length === 0 ? (
          <NewInline placeholder="ex.: derivada da questão 4 no quadro" onAdd={(t) => void addFlavor('quadro', t)} />
        ) : (
          <div className="space-y-2">
            {quadro.map((q) => (
              <QuadroRow key={q.id} quest={q} />
            ))}
          </div>
        )}
      </Section>

      {/* Leitura com recall */}
      <Section title="Leitura com recall — 3 frases de memória">
        {leitura.length === 0 ? (
          <NewInline placeholder="ex.: slides de Noções de Lógica" onAdd={(t) => void addFlavor('leitura', t)} />
        ) : (
          <div className="space-y-2">
            {leitura.map((q) => (
              <LeituraRow key={q.id} quest={q} />
            ))}
          </div>
        )}
      </Section>

      {/* Issues */}
      <Section title="Issues abertas">
        <NewInlineWithKind onAdd={addIssue} />
        {issues.length === 0 ? (
          <Empty>nenhuma issue aberta — o backlog do projeto está limpo</Empty>
        ) : (
          <div className="space-y-1.5">
            {issues.map((q) => (
              <div key={q.id} className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{q.title}</span>
                <Chip tone={q.kind === 'daily' ? 'emerald' : q.kind === 'weekly' ? 'violet' : 'zinc'}>
                  {q.kind}
                </Chip>
                <Btn variant="ghost" onClick={() => void completeQuest(q.id)} aria-label="concluir">
                  <Check className="size-3.5" />
                </Btn>
                <Btn variant="ghost" onClick={() => void deleteQuest(q.id)} aria-label="excluir">
                  <Trash2 className="size-3.5" />
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NewInline({ placeholder, onAdd }: { placeholder: string; onAdd: (t: string) => void }) {
  const [v, setV] = React.useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(v);
        setV('');
      }}
    >
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
      <Btn variant="violet" type="submit" disabled={!v.trim()}>
        <Plus className="size-3.5" /> abrir
      </Btn>
    </form>
  );
}

function NewInlineWithKind({ onAdd }: { onAdd: (t: string, k: Quest['kind']) => void }) {
  const [v, setV] = React.useState('');
  const [k, setK] = React.useState<Quest['kind']>('once');
  return (
    <form
      className="mb-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(v, k);
        setV('');
      }}
    >
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="nova issue…" className="min-w-[180px] flex-1" />
      <Select value={k} onChange={(e) => setK(e.target.value as Quest['kind'])}>
        <option value="daily">diária</option>
        <option value="weekly">semanal</option>
        <option value="once">única</option>
      </Select>
      <Btn variant="violet" type="submit" disabled={!v.trim()}>
        <Plus className="size-3.5" />
      </Btn>
    </form>
  );
}

/** Modo Quadro — foto comprimida (máx 1000px, JPEG 0.7) guardada na quest. */
function QuadroRow({ quest }: { quest: Quest }) {
  const [photo, setPhoto] = React.useState<string | null>(quest.photo ?? null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    const dataUrl = await compressImage(f, 1000);
    setPhoto(dataUrl);
    await upsertQuest({ ...quest, photo: dataUrl });
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="font-mono text-xs text-zinc-200">{quest.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
        <Btn variant="outline" onClick={() => fileRef.current?.click()}>
          <Camera className="size-3.5" /> {photo ? 'trocar foto' : 'anexar foto do quadro'}
        </Btn>
        {photo && (
          <a href={photo} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-emerald-400 underline decoration-dotted">
            ver em cheio ↗
          </a>
        )}
        <Btn variant="emerald" className="ml-auto" disabled={!photo} onClick={() => void completeQuest(quest.id)}>
          <Check className="size-3.5" /> resolví
        </Btn>
      </div>
      {photo && (
         
        <img src={photo} alt={`foto do quadro: ${quest.title}`} className="mt-2 max-h-48 rounded-md border border-zinc-800 object-contain" />
      )}
    </div>
  );
}

/** Leitura — recall de 3 frases DE MEMÓRIA antes de marcar como feita. */
function LeituraRow({ quest }: { quest: Quest }) {
  const [r1, setR1] = React.useState('');
  const [r2, setR2] = React.useState('');
  const [r3, setR3] = React.useState('');

  const all = [r1, r2, r3].every((x) => x.trim().length > 0);

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="font-mono text-xs text-zinc-200">{quest.title}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        leia o material, feche, e escreva 3 frases DE MEMÓRIA — o recall é o estudo, não a leitura.
        {quest.materialId && (
          <a href="/?legacy=1#library" target="_blank" rel="noreferrer" className="ml-1 text-emerald-400 underline decoration-dotted">
            abrir acervo ↗
          </a>
        )}
      </p>
      <div className="mt-2 space-y-1.5">
        {[setR1, setR2, setR3].map((set, i) => (
          <Textarea key={i} rows={1} value={[r1, r2, r3][i]} onChange={(e) => set(e.target.value)} placeholder={`frase ${i + 1} (de memória)`} />
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Btn variant="emerald" disabled={!all} onClick={() => void completeQuest(quest.id, { recall: [r1.trim(), r2.trim(), r3.trim()] })}>
          <Check className="size-3.5" /> recall feito
        </Btn>
        <Btn variant="ghost" onClick={() => void deleteQuest(quest.id)}>
          <X className="size-3.5" /> desistir
        </Btn>
      </div>
    </div>
  );
}

/** Downscale + JPEG — foto de quadro não precisa de 4MB. */
function compressImage(file: File, maxSide: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas indisponível'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagem ilegível'));
    };
    img.src = url;
  });
}
