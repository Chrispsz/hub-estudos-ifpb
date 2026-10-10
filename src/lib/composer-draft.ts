/**
 * O RASCUNHO QUE SOBREVIVE (t176).
 *
 * A dor (fila P2 desde a t171): o rascunho do composer morria na navegação.
 * O Hub é uma página só, mas só a aba ativa renderiza — navegar do Estudar
 * para a Biblioteca desmonta o StudyView e o chat principal PERDIA o texto
 * digitado (às vezes uma pergunta longa da véspera, com contexto que não se
 * redige duas vezes). No painel dividido era igual: fechar o diálogo do PDF
 * desmonta o painel — o fio da conversa sobrevive (t144, thread-cache), mas
 * o que estava DIGITADO morria.
 *
 * O fix: um cache em MEMÓRIA de sessão, chaveado por composer — o chat
 * principal guarda um rascunho por DISCIPLINA, o painel um por MATERIAL.
 * Voltar para a aba reidrata o texto, o anexo pendente e o bloco de código;
 * trocar de disciplina troca o rascunho junto (a pergunta de Matemática não
 * vaza para o chat de RHT — o composer acompanha a memória da conversa).
 *
 * Doutrina: memória de SESSÃO (a mesma do thread-cache) — recarregou a
 * página, recomeça. Nada de localStorage, nada de banco: rascunho é gesto
 * vivo de digitação, não dado do aluno. As helpers são PURAS sobre o Map
 * (sem DOM/storage/fetch) — executáveis em teste.
 */

/** O conteúdo de um composer: texto, bloco de código e anexo pendente. */
export interface ComposerDraft {
  /** O texto da pergunta (o composer do chat principal e do painel). */
  input: string;
  /** Bloco de código separado (só o chat principal tem — vai em ```lang). */
  code?: string;
  /** Anexo pendente (data URL JPEG efêmero — print de página/recorte/colado). */
  image?: string;
  /** Procedência do anexo (t163): "página 3 · Lista de Matrizes"… */
  imageLabel?: string;
}

/** Formato interno: com carimbo de quando o rascunho foi tocado (LRU). */
interface StoredDraft extends ComposerDraft {
  savedAt: number;
}

/** Teto do cache — materiais do acervo são ~52; sem teto, data URLs de
 * prints esquecidos poderiam acumular. 16 rascunhos cobre as 7 disciplinas
 * + os materiais abertos de verdade numa sessão; o mais velho sai por trás. */
export const MAX_COMPOSER_DRAFTS = 16;

const drafts = new Map<string, StoredDraft>();

/**
 * Chave estável de um composer: escopo "main" (chat principal, um por
 * disciplina) ou "panel" (painel dividido, um por thread de material).
 */
export function composerDraftKey(scope: 'main' | 'panel', id: string): string {
  return `${scope}:${id}`;
}

/** Um rascunho vale a pena se tem ALGUM gesto dentro — texto, código ou anexo. */
function isEmpty(d: ComposerDraft): boolean {
  return !d.input.trim() && !d.code?.trim() && !d.image;
}

/**
 * Guarda o rascunho. Vazio → APAGA (composer zerado não é memória, é
 * esquecimento honesto — o envio e o descarte limpam por aqui sem saber).
 * No teto, o rascunho mais antigo sai por trás (LRU por RECENTEZA: o Map
 * preserva ordem de inserção, então tocar num rascunho o rejuvenesce —
 * delete + set o move para o fim; o primeiro da ordem é sempre o mais
 * velho, sem depender da resolução do relógio).
 */
export function saveComposerDraft(key: string, draft: ComposerDraft): void {
  if (isEmpty(draft)) {
    drafts.delete(key);
    return;
  }
  if (!drafts.has(key) && drafts.size >= MAX_COMPOSER_DRAFTS) {
    const oldest = drafts.keys().next().value;
    if (oldest !== undefined) drafts.delete(oldest);
  }
  drafts.delete(key); // o touch move para o fim (Map.set não reordena)
  drafts.set(key, { ...draft, savedAt: Date.now() });
}

/** Lê o rascunho (cópia defensiva — quem carrega não edita o cache). */
export function loadComposerDraft(key: string): ComposerDraft | null {
  const stored = drafts.get(key);
  if (!stored) return null;
  return { input: stored.input, code: stored.code, image: stored.image, imageLabel: stored.imageLabel };
}

/** Há rascunho vivo nesta chave? (decide a pill de restauração) */
export function hasComposerDraft(key: string): boolean {
  return drafts.has(key);
}

/** Apaga UM rascunho (o X da pill "rascunho restaurado"). */
export function clearComposerDraft(key: string): void {
  drafts.delete(key);
}

/** Diagnóstico/limpeza total (testes e QA). */
export function clearAllComposerDrafts(): void {
  drafts.clear();
}

/** Quantos rascunhos vivos agora (QA/telemetria honesta). */
export function composerDraftCount(): number {
  return drafts.size;
}
