/**
 * REGISTRO EFÊMERO DO CHAT (171) — a fonte da verdade sobre o anexo pendente
 * do tutor para quem está FORA do StudyView.
 *
 * POR QUE EXISTE: o anexo pendente (chatImage/chatImageLabel) vive no estado
 * interno do StudyView — a mesma vida do mount (só a aba ativa renderiza).
 * A raiz (page.tsx) precisa saber se há um anexo pendente NA HORA em que o
 * aluno sai da aba Estudar, para avisar com honestidade que ele foi
 * descartado (a navegação desmonta a view). Ler estado React de fora é
 * impossível; localStorage aqui é PROIBIDO pela doutrina efêmera (t163:
 * nada no disco, nada que sobreviva ao recarregar). Um módulo singleton em
 * memória tem exatamente a MESMA vida que o anexo quer ter: nasce com o
 * mount, morre com o recarregar da página.
 *
 * O registro NÃO é a verdade do anexo (quem manda é o estado do StudyView) —
 * é o ESPELHO só de leitura para o aviso de descarte. O StudyView escreve a
 * cada mudança do par (chatImage, chatImageLabel) e zera no unmount; a raiz
 * só lê no gesto de sair da aba. Nada aqui toca rede, disco ou storage.
 */

export interface EphemeralChatState {
  /** Há um print pendente no composer do tutor (chip vivo). */
  pendingImage: boolean;
  /** Procedência do print (o rótulo do chip — "página 2 · Lista", …). */
  pendingLabel: string | null;
}

const state: EphemeralChatState = { pendingImage: false, pendingLabel: null };

/** O StudyView espelha a verdade do chip a cada mudança (e zera no unmount). */
export function setEphemeralChatState(patch: Partial<EphemeralChatState>): void {
  Object.assign(state, patch);
}

/** Leitura só de leitura — a raiz usa no gesto de navegação. */
export function readEphemeralChatState(): EphemeralChatState {
  return { ...state };
}
