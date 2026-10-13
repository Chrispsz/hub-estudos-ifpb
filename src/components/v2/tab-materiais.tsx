'use client';

// MATERIAIS — os PDFs dos professores DENTRO do app novo (Edição Definitiva).
//
// A fusão que faltava: o app antigo tinha a melhor experiência de leitura da
// casa (viewer com tutor em tela dividida, busca no PDF, captura de página,
// resumo IA) e o app novo não dava acesso a nada disso — só link cru. Aqui os
// 56 materiais do curso viram a prateleira do app novo, reusando os componentes
// prontos da casa (PdfViewerDialog, MaterialSummaryDialog) e alimentando o
// Tutor com o materialId (o servidor lê o texto REAL do PDF — retrieval).
//
// O botão "da semana" é o boost cirúrgico do plano: 1 toque marca o material
// que o professor está dando AGORA — o Hoje passa a puxar esse conteúdo.

import * as React from 'react';
import { BookOpen, FileText, PlayCircle, Sparkles, Star, ExternalLink } from 'lucide-react';
import { materials as allMaterials, type Material } from '@/data/course-data';
import { PdfViewerDialog } from '@/components/hub/pdf-viewer-dialog';
import { MaterialSummaryDialog } from '@/components/hub/material-summary-dialog';
import { VideoPlayerDialog } from '@/components/hub/video-player-dialog';
import { isFocusAlive } from '@/lib/v2/planner';
import { toggleFocusMark } from '@/lib/v2/repo';
import { useBacklog, useFocusMarks, useSubjects, useUnits } from '@/lib/v2/use-v2';
import { dateKeyOf } from '@/lib/v2/planner';
import { Btn, Chip, Empty, PageHead, Select } from './ui';

const TYPE_LABEL: Record<Material['type'], string> = {
  slides: 'Slides',
  lista_exercicios: 'Lista de exercícios',
  web_page: 'Página web',
  introducao: 'Introdução',
  ementa: 'Ementa',
  video: 'Vídeo',
  pdf: 'PDF',
  image: 'Imagem',
  calendar: 'Calendário',
  exemplo: 'Exemplo de código',
};

export interface TutorMaterialContext {
  materialId: string;
  title: string;
  subjectId?: string;
}

interface Row {
  m: Material;
  shortName: string;
  backlogOpen: boolean;
  converted: boolean;
  unitCount: number;
  focus: boolean;
}

export function TabMateriais({ onOpenTutor }: { onOpenTutor: (ctx: TutorMaterialContext) => void }) {
  const subjects = useSubjects();
  const backlog = useBacklog();
  const units = useUnits();
  const focus = useFocusMarks();
  const todayKey = dateKeyOf();

  const [disc, setDisc] = React.useState('all');
  const [scope, setScope] = React.useState<'todos' | 'semana' | 'abertos'>('todos');
  const [viewer, setViewer] = React.useState<Material | null>(null);
  const [summary, setSummary] = React.useState<Material | null>(null);
  const [video, setVideo] = React.useState<Material | null>(null);
  const [busyMark, setBusyMark] = React.useState<string | null>(null);

  const rows: Row[] = React.useMemo(() => {
    return allMaterials
      .map((m) => {
        const subj = subjects.find((s) => s.id === m.disciplineCode);
        const bk = backlog.find((b) => b.sourceRef.materialId === m.id);
        return {
          m,
          shortName: subj?.shortName ?? m.disciplineCode,
          backlogOpen: bk?.status === 'open',
          converted: bk?.status === 'converted',
          unitCount: units.filter((u) => u.linkedMaterials.includes(m.id)).length,
          focus: isFocusAlive(focus.materials[m.id], todayKey),
        };
      })
      .sort((a, b) => {
        if (a.focus !== b.focus) return a.focus ? -1 : 1;
        if (a.backlogOpen !== b.backlogOpen) return a.backlogOpen ? -1 : 1;
        return a.m.title.localeCompare(b.m.title, 'pt-BR');
      });
  }, [subjects, backlog, units, focus, todayKey]);

  const visible = rows.filter((r) => {
    if (disc !== 'all' && r.m.disciplineCode !== disc) return false;
    if (scope === 'semana') return r.focus;
    if (scope === 'abertos') return r.backlogOpen;
    return true;
  });

  const pdfCount = allMaterials.filter((m) => !!m.pdfPath).length;
  const focusCount = rows.filter((r) => r.focus).length;

  async function mark(id: string) {
    setBusyMark(id);
    try {
      await toggleFocusMark('material', id, todayKey);
    } finally {
      setBusyMark(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHead
        kicker="estudar · materiais"
        title="PDFs dos professores"
        desc="A prateleira completa do curso. Ler com tutor ao lado, resumo IA, busca no PDF — e o toque de estrela puxa o material para o plano de hoje."
        right={
          <>
            <Chip tone="zinc">{allMaterials.length} materiais</Chip>
            <Chip tone="emerald">{pdfCount} PDFs</Chip>
            {focusCount > 0 && <Chip tone="violet">{focusCount} da semana</Chip>}
          </>
        }
      />

      {/* filtros — 1 linha, sem poluição */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={disc} onChange={(e) => setDisc(e.target.value)} aria-label="Filtrar por matéria">
          <option value="all">todas as matérias</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.shortName}
            </option>
          ))}
        </Select>
        <div className="flex gap-1">
          {(
            [
              ['todos', 'todos'],
              ['semana', 'da semana'],
              ['abertos', 'não trabalhados'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              aria-pressed={scope === id}
              className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                scope === id
                  ? 'bg-emerald-500/15 font-semibold text-emerald-300'
                  : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty>
          {scope === 'semana'
            ? 'nenhum material marcado ainda — toque na estrela do material que o professor está dando agora'
            : scope === 'abertos'
              ? 'nada esperando conversão aqui — a fila está limpa'
              : 'nada com esse filtro'}
        </Empty>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <div
              key={r.m.id}
              className={`rounded-lg border p-3 sm:p-4 ${
                r.focus ? 'border-violet-500/40 bg-violet-500/5' : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <button
                  type="button"
                  onClick={() => void mark(r.m.id)}
                  disabled={busyMark === r.m.id}
                  aria-label={r.focus ? 'desmarcar conteúdo da semana' : 'marcar como conteúdo da semana'}
                  title={
                    r.focus
                      ? 'conteúdo da semana — o plano de hoje já puxou este material'
                      : 'marcar: é o que o professor está dando agora (vale 9 dias)'
                  }
                  className={`rounded-md p-1 transition-colors ${
                    r.focus ? 'text-amber-300' : 'text-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  <Star className={`size-4 ${r.focus ? 'fill-amber-300' : ''}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] font-medium text-zinc-100">{r.m.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                    <span>{r.shortName}</span>·<span>{TYPE_LABEL[r.m.type]}</span>
                    {r.m.pages ? <>·<span>{r.m.pages} pág</span></> : null}
                    {r.unitCount > 0 ? <>·<span>{r.unitCount} unidade(s) ligada(s)</span></> : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.focus && <Chip tone="violet">da semana</Chip>}
                  {r.backlogOpen && <Chip tone="amber">não trabalhado</Chip>}
                  {r.converted && <Chip tone="zinc">trabalhado</Chip>}
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.m.pdfPath ? (
                  <Btn variant="emerald" onClick={() => setViewer(r.m)}>
                    <BookOpen className="size-3.5" /> ler
                  </Btn>
                ) : r.m.type === 'video' && r.m.externalUrl ? (
                  <Btn variant="emerald" onClick={() => setVideo(r.m)}>
                    <PlayCircle className="size-3.5" /> assistir
                  </Btn>
                ) : r.m.externalUrl ? (
                  <a href={r.m.externalUrl} target="_blank" rel="noreferrer">
                    <Btn variant="outline">
                      <ExternalLink className="size-3.5" /> abrir
                    </Btn>
                  </a>
                ) : null}
                {r.m.summaryFile && (
                  <Btn variant="outline" onClick={() => setSummary(r.m)}>
                    <FileText className="size-3.5" /> resumo IA
                  </Btn>
                )}
                <Btn variant="violet" onClick={() => onOpenTutor({ materialId: r.m.id, title: r.m.title, subjectId: r.m.disciplineCode })}>
                  <Sparkles className="size-3.5" /> tutor lê comigo
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* os leitores prontos da casa antiga — mesma experiência, casa nova.
          tutorPersist=false: doutrina do contexto — ler PDF no app novo NÃO
          deixa conversa no servidor (a thread vive no IndexedDB do dispositivo).
          keepLegacyRecent=false: isolamento do estado do dono (QA 3-c) — abrir
          material no app novo NÃO grava recentMaterials na MEGACHAVE legado
          (o material recente do v2 já vive no núcleo; o legado omite a prop e
          se comporta exatamente como sempre). */}
      <PdfViewerDialog
        material={viewer}
        open={!!viewer}
        onOpenChange={(o) => !o && setViewer(null)}
        onOpenMaterial={(m) => setViewer(m)}
        tutorPersist={false}
        keepLegacyRecent={false}
      />
      <MaterialSummaryDialog material={summary} open={!!summary} onOpenChange={(o) => !o && setSummary(null)} />
      {/* videoaulas embutidas — o MESMO player da casa (YouTube/Drive/Vimeo),
          zero cópia (E4). */}
      <VideoPlayerDialog material={video} open={!!video} onOpenChange={(o) => !o && setVideo(null)} />
    </div>
  );
}
