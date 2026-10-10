'use client';

// O CHECKLIST DO PDF (frente 13 — pedido direto do dono: "adiciona check
// list nos PDF pra marcar como concluído se não tiver").
//
// Um material de aula raramente é "ler uma vez": são 20 páginas, três
// tópicos, uma lista de exercícios. A checklist transforma o PDF em fila de
// passos — e a fila alimenta o PLANO DO DIA (lib/study-plan), que diz no
// porquê de cada bloco o que ainda falta ("faltam 3 de 5 no checklist").
//
// Nasce vazio por uma razão: caixinha imposta é ruído. Dois geradores de um
// toque criam a fila quando ela não existe — os TÓPICOS DA AULA (a unidade
// que o material comprova ter sido dada) ou a DIVISÃO POR PÁGINAS (chunks de
// leitura). E o gesto final fecha o ciclo: checklist completa com o material
// ainda aberto oferece "marcar como concluído" — que semeia a revisão
// espaçada (1·3·7·14·30) e devolve este material ao plano amanhã.

import * as React from 'react';
import { BookOpen, ListChecks, Plus, Wand2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import type { Material } from '@/data/course-data';
import type { StudyProgressHook } from '@/lib/study-progress';
import { cn } from '@/lib/utils';

interface Props {
  material: Material;
  /** A MESMA instância do diálogo (o write sincroniza via storage event —
   *  o plano da home reage na hora, mesma aba). */
  sp: StudyProgressHook;
}

/** Chunks de leitura: 10 páginas por passo (o PDF de 53 páginas não vira 53 caixinhas). */
const PAGE_CHUNK = 10;

export function MaterialChecklistPopover({ material, sp }: Props) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  const items = sp.progress.materialChecklists?.[material.id]?.items ?? [];
  const done = items.filter((it) => it.done).length;
  const remaining = items.length - done;
  const allDone = items.length > 0 && remaining === 0;
  const isCompleted = sp.progress.completedMaterials.includes(material.id);

  const topics = material.topicosCobertos ?? [];
  const pages = material.pages ?? 0;

  const add = () => {
    if (!draft.trim()) return;
    sp.addChecklistItem(material.id, draft);
    setDraft('');
  };

  const suggestTopics = () => {
    if (topics.length === 0) return;
    sp.setChecklist(material.id, topics);
    toast.success(
      `Checklist criada com ${topics.length} ${topics.length === 1 ? 'tópico' : 'tópicos'} da aula`,
    );
  };

  const suggestPages = () => {
    if (pages < 2) return;
    const texts: string[] = [];
    for (let p = 1; p <= pages; p += PAGE_CHUNK) {
      const end = Math.min(p + PAGE_CHUNK - 1, pages);
      texts.push(end > p ? `Ler páginas ${p}–${end}` : `Ler a página ${p}`);
    }
    sp.setChecklist(material.id, texts);
    toast.success(
      `Checklist criada em ${texts.length} ${texts.length === 1 ? 'passo' : 'passos'} de leitura`,
    );
  };

  const completeMaterial = () => {
    sp.markCompleted(material.id, material.disciplineCode);
    toast.success('Material concluído — a 1ª revisão fica para amanhã (1·3·7·14·30)');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn('h-11 sm:h-8', items.length > 0 && remaining > 0 && 'border-amber-500/40 text-amber-700 dark:text-amber-400')}
          aria-label={
            items.length > 0
              ? `Checklist do material — ${done} de ${items.length} passos feitos`
              : 'Checklist do material — dividir em passos'
          }
          title={
            items.length > 0
              ? `Checklist: ${done}/${items.length} passos — o plano do dia lê o que falta`
              : 'Divida o material em passos (tópicos da aula ou páginas) — o plano do dia usa a checklist'
          }
          data-testid="checklist-trigger"
        >
          <ListChecks className="size-3.5" aria-hidden />
          Checklist
          {items.length > 0 && (
            <span className="tabular-nums">
              {' '}
              {done}/{items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4" data-testid="checklist-popover">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium leading-tight">Checklist do material</p>
          {items.length > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {done}/{items.length}
            </span>
          )}
        </div>

        {items.length > 0 && (
          <Progress value={(done / items.length) * 100} className="mt-2 h-1.5" aria-hidden />
        )}

        {/* A fila de passos — o acervo de caixinhas do material em questão */}
        {items.length > 0 ? (
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto" data-testid="checklist-items">
            {items.map((it) => (
              <li key={it.id} className="group flex items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted/60">
                <Checkbox
                  checked={it.done}
                  onCheckedChange={() => sp.toggleChecklistItem(material.id, it.id)}
                  aria-label={`Marcar "${it.text}" como feito`}
                  className="mt-0.5"
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 text-[13px] leading-snug',
                    it.done && 'text-muted-foreground line-through',
                  )}
                >
                  {it.text}
                </span>
                <button
                  type="button"
                  onClick={() => sp.removeChecklistItem(material.id, it.id)}
                  aria-label={`Remover "${it.text}" da checklist`}
                  className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  data-testid={`checklist-remove-${it.id}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            Divida o material em passos — o plano do dia lê a checklist e diz o que falta.
          </p>
        )}

        {/* Geradores — a fila nasce de um toque quando ela não existe */}
        {items.length === 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {topics.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                onClick={suggestTopics}
                data-testid="checklist-gen-topics"
              >
                <Wand2 className="size-3.5" aria-hidden />
                Usar tópicos da aula ({topics.length})
              </Button>
            )}
            {pages >= 2 && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                onClick={suggestPages}
                data-testid="checklist-gen-pages"
              >
                <BookOpen className="size-3.5" aria-hidden />
                Dividir por páginas ({pages})
              </Button>
            )}
          </div>
        )}

        {/* Adicionar passo — sempre disponível (o acervo do dono cresce à mão) */}
        <div className="mt-2.5 flex items-center gap-1.5" role="group" aria-label="Adicionar passo">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Adicionar passo…"
            aria-label="Novo passo da checklist"
            data-testid="checklist-input"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-[13px] outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 shrink-0 p-0"
            onClick={add}
            disabled={!draft.trim()}
            aria-label="Adicionar passo à checklist"
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>

        {/* O ciclo fecha: passos todos feitos + material ainda aberto = o
            gesto de concluir a um toque (que semeia a revisão espaçada). */}
        {allDone && !isCompleted && (
          <Button
            size="sm"
            className="mt-3 h-9 w-full bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={completeMaterial}
            data-testid="checklist-complete-material"
          >
            Tudo lido — marcar material como concluído
          </Button>
        )}
        {allDone && isCompleted && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Concluído ✓ — a revisão espaçada o traz de volta sozinho (1·3·7·14·30 dias)
          </p>
        )}

        {items.length > 0 && remaining > 0 && (
          <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground/80">
            Faltam {remaining} {remaining === 1 ? 'passo' : 'passos'} — o bloco deste material no
            plano de hoje confessa o que falta.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
