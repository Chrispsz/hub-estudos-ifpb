/**
 * Formato compartilhado das conversas do tutor exportadas (t149).
 * Usado pelo chat principal (study-view) e pelo painel dividido
 * (tutor-quick-panel) — uma só fonte da verdade para o .md e para
 * o "copiar conversa", para que a análise da IA tenha a mesma cara
 * em qualquer superfície de onde o aluno a levar.
 */

/** Turno mínimo que o exportador entende — as duas superfícies satisfazem. */
export interface ExportableTurn {
  role: 'user' | 'assistant';
  content: string;
  /** Modelo que respondeu (vira sufixo "(model)" no turno do tutor). */
  model?: string;
  /** Hora local HH:MM carimbada na mensagem. */
  time?: string;
  /** t164: bolha de erro (flag da conversa viva) — fica de fora do material. */
  error?: boolean;
  /** t167: resposta interrompida a pedido do aluno — o .md confessa o freio. */
  interrupted?: boolean;
  /** t170: procedência do print anexado ("recorte da página 3 · Lista") —
   * a imagem não entra no .md (data URL não viaja em texto de estudo), mas
   * a ASSINATURA dela sim: o material exportado diz o que estava na dúvida. */
  imageLabel?: string;
}

/**
 * Monta o markdown da conversa: cabeçalho com título + data de exportação
 * e turnos separados por `---`. Mensagens de erro ficam de fora — o arquivo
 * é material de estudo, não log de falhas. t164: o filtro olha a FLAG
 * `error` (o farejo do ⚠️ era morto — erros reais nunca começaram com ⚠️
 * e vazavam para o .md); o farejo segue como cinto e suspensa, na mesma
 * forma do tutor-thread-cache.
 */
export function buildChatMarkdown(
  title: string,
  messages: ExportableTurn[],
  exportedAt: Date = new Date(),
): string {
  const lines = messages
    .filter((m) => !m.error && !m.content.startsWith('⚠️'))
    .map((m) => {
      const who = m.role === 'user' ? '**Você**' : `**Tutor**${m.model ? ` (${m.model})` : ''}`;
      const when = m.time ? ` — ${m.time}` : '';
      // t167: o freio é parte da história honesta da conversa — o .md diz onde
      // a resposta acabou porque o aluno cortou (o parcial é material de estudo).
      const stop = m.interrupted ? '\n\n*(interrompida a seu pedido — o que chegou, ficou)*' : '';
      // t170: a assinatura do print — a imagem não entra no .md, mas DE ONDE
      // ela veio entra (a linha fica junto da pergunta, como legenda).
      const print = m.imageLabel ? `\n\n*(print anexado: ${m.imageLabel})*` : '';
      return `${who}${when}\n\n${m.content}${print}${stop}\n`;
    });
  const header = `# ${title}\n\nExportado do Hub de Estudos em ${exportedAt.toLocaleDateString('pt-BR')}\n\n---\n\n`;
  return header + lines.join('\n---\n\n');
}

/**
 * Dispara o download de um arquivo de texto no navegador (Blob → URL → <a>).
 * revokeObjectURL imediato: o download já foi enfileirado no click.
 */
export function downloadTextFile(
  filename: string,
  text: string,
  mime = 'text/markdown;charset=utf-8',
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
