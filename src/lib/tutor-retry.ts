/**
 * A SEGUNDA CHANCE DO TURNO (t164) — o alvo do "tentar de novo".
 *
 * Quando a resposta do tutor falha (rede caiu, provedor pisou, stream morreu),
 * a bolha de erro aparece — mas até hoje a única saída era REESCREVER a
 * pergunta inteira. No debrief da noite isso dói em dobro: os rascunhos das
 * portas carregam enunciados longos, e digitar de novo é castigo pelo
 * capricho. O retry reenvia a MESMA pergunta (com o print, se ele ainda
 * vive na conversa) sem apagar nada: a tentativa falhada continua no fio —
 * o log é honesto, a casa não reescreve o passado.
 *
 * Lib PURA: nada de fetch, storage ou DOM aqui — a decisão de reenviar é
 * do clique do aluno; esta lib só aponta PARA ONDE o clique aponta.
 */

/** Forma mínima de um turno do chat para resolver o alvo do retry. */
export interface RetryableTurn {
  role: 'user' | 'assistant';
  content: string;
  /** Print que entrou junto — se ainda vive na conversa, o retry o leva. */
  image?: string;
  error?: boolean;
}

/**
 * Resolve o turno que o "tentar de novo" reenvia: a mensagem do aluno MAIS
 * PRÓXIMA acima da bolha de erro (o par falhou junto — pergunta e erro são
 * vizinhos no fio). Salta respostas do tutor e/ou parciais que fiquem no
 * caminho; pergunta vazia não é alvo (nada de reenviar fumaça); sem alvo,
 * o botão nem aparece (quem chama recebe null e omite o gesto).
 */
export function resolveRetryTarget(
  messages: RetryableTurn[],
  errorIndex: number,
): RetryableTurn | null {
  for (let i = errorIndex - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user' && m.content.trim()) return m;
  }
  return null;
}
