// tutor-stream — cliente do /api/tutor com suporte a streaming SSE.
//
// Protocolo à prova de qualquer circunstância:
//  - servidor responde text/event-stream → eventos {t:'delta'|'final'|'error'}
//  - servidor responde JSON (fallback/legado) → mesma Promise, mesmo contrato
//  - stream cortado sem 'final' → mantém o parcial recebido (nunca perde tudo)
//
// 'final' é a resposta AUTORITATIVA (sanitizada no servidor) e substitui o
// acumulado dos deltas — garante consistência entre o que o aluno viu e o
// que fica salvo no histórico.

export interface TutorStreamResult {
  answer: string;
  model?: string;
}

export class TutorStreamError extends Error {
  /** Texto parcial recebido antes da falha (pode ser ''). */
  partial: string;
  constructor(message: string, partial: string) {
    super(message);
    this.name = 'TutorStreamError';
    this.partial = partial;
  }
}

interface SSEEvent {
  t?: 'delta' | 'final' | 'error';
  v?: string;
  answer?: string;
  model?: string;
  message?: string;
}

export async function streamTutorAnswer(
  body: Record<string, unknown>,
  onDelta?: (piece: string, full: string) => void,
): Promise<TutorStreamResult> {
  const res = await fetch('/api/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
  });

  const contentType = res.headers.get('content-type') ?? '';

  // ----- caminho JSON (erro HTTP ou servidor sem suporte a stream) -----
  if (!contentType.includes('text/event-stream')) {
    const data = (await res.json().catch(() => null)) as {
      answer?: string;
      model?: string;
      error?: string;
    } | null;
    if (!res.ok || !data?.answer) {
      throw new TutorStreamError(
        data?.error || `Erro ${res.status} ao consultar o tutor`,
        '',
      );
    }
    onDelta?.(data.answer, data.answer);
    return { answer: data.answer, model: data.model };
  }

  // ----- caminho SSE -----
  if (!res.body) {
    throw new TutorStreamError('Stream indisponível neste navegador.', '');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  let finalAnswer: string | null = null;
  let finalModel: string | undefined;
  let errorMessage: string | null = null;

  const handleEvent = (ev: SSEEvent) => {
    if (ev.t === 'delta' && typeof ev.v === 'string') {
      full += ev.v;
      onDelta?.(ev.v, full);
    } else if (ev.t === 'final' && typeof ev.answer === 'string') {
      finalAnswer = ev.answer;
      finalModel = ev.model;
    } else if (ev.t === 'error') {
      errorMessage = ev.message ?? 'O tutor não conseguiu responder agora.';
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      try {
        handleEvent(JSON.parse(line.slice(5).trim()) as SSEEvent);
      } catch {
        // evento parcial entre chunks — ignora
      }
    }
  }

  if (finalAnswer !== null) {
    return { answer: finalAnswer, model: finalModel };
  }
  if (errorMessage) {
    throw new TutorStreamError(errorMessage, full);
  }
  if (full.trim()) {
    // stream caiu no meio, mas já temos conteúdo útil — devolve o parcial
    return { answer: full };
  }
  throw new TutorStreamError('O tutor não retornou resposta.', '');
}
