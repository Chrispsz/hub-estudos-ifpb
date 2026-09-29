/**
 * MEMÓRIA DE SESSÃO DO PAINEL DO TUTOR (t144).
 *
 * A dor: o painel do tutor em tela dividida vive dentro do diálogo do PDF —
 * fechar o diálogo desmonta o painel e a conversa morria. Reabrir o MESMO
 * material voltava com o painel vazio: a explicação que o tutor tinha dado
 * (às vezes longa, com LaTeX e exemplo resolvido) sumia no clique do X.
 *
 * O fio agora SOBREVIVE ao fechar do diálogo na mesma sessão: um cache
 * em memória (Map), chaveado pelo material — reabrir "Matrizes — Aula 00"
 * reidrata a conversa dela; abrir outro material vê SÓ a conversa dele.
 *
 * Fronteira honesta: memória de SESSÃO — recarregou a página, recomeça.
 * A memória longa continua sendo a do chat principal (Estudar), que manda
 * o histórico para a API. Aqui não há localStorage nem banco: data URLs de
 * prints não devem apodrecer em storage alheio.
 */

/** Mensagem mínima que o cache guarda (espelha a ChatMessage do painel). */
export interface CachedThreadMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  image?: string;
  /** t170: a assinatura do print — a imagem já sobrevive ao fechar aqui no
   * cache de sessão; a procedência dela viaja junto (o mesmo ciclo de vida). */
  imageLabel?: string;
  time?: string;
  /** true → bolha de erro (falha do provedor) — não sobrevive ao fechar. */
  error?: boolean;
}

/** Teto do fio guardado — conversa antiga sai por trás, o essencial fica. */
const THREAD_CAP = 40;

/** Cache por chave de thread (material ou disciplina). Módulo = sessão. */
const cache = new Map<string, CachedThreadMessage[]>();

/**
 * Chave estável de uma thread: material primeiro (a dúvida nasce do
 * material aberto), com fallback para a disciplina (painel sem material).
 */
export function threadKey(materialId?: string, disciplineCode?: string, discipline?: string): string {
  if (materialId) return `m:${materialId}`;
  if (disciplineCode) return `d:${disciplineCode}`;
  return `d:${discipline ?? 'geral'}`;
}

/**
 * Bolhas de ERRO não sobrevivem ao fechar: "provedor falhou" é aviso do
 * momento (o mesmo filtro do histórico enviado à API) — reabrir o fio traz
 * a conversa real, não o escombro de uma falha transitória.
 */
function persistable(messages: CachedThreadMessage[]): CachedThreadMessage[] {
  return messages
    .filter((m) => !m.error && !m.content.startsWith('⚠️'))
    .slice(-THREAD_CAP);
}

/** Lê o fio guardado (ou vazio — sempre um array novo, nunca o objeto vivo). */
export function loadThread(key: string): CachedThreadMessage[] {
  const stored = cache.get(key);
  return stored ? stored.map((m) => ({ ...m })) : [];
}

/** Guarda o fio da sessão (cópia defensiva — o estado do painel é dele). */
export function saveThread(key: string, messages: CachedThreadMessage[]): void {
  const clean = persistable(messages);
  if (clean.length === 0) {
    cache.delete(key);
    return;
  }
  cache.set(key, clean.map((m) => ({ ...m })));
}

/** Apaga UM fio (botão "Limpar conversa do painel"). */
export function clearThread(key: string): void {
  cache.delete(key);
}

/** Diagnóstico/limpeza total (testes e QA). */
export function clearAllThreads(): void {
  cache.clear();
}

/** Quantos fios vivos agora (QA/telemetria honesta). */
export function threadCount(): number {
  return cache.size;
}
