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
  /**
   * t167 — O FREIO DO ALUNO: true → o aluno PAROU a geração no meio; o que
   * chegou (parcial) é a resposta honesta. Parcial é conteúdo real (doutrina
   * t164) — a UI carimba a bolha, o histórico da IA segue lendo o que veio.
   */
  interrupted?: boolean;
}

/** A palavra do freio — usada no throw do abort SEM conteúdo e no toast. */
export const TUTOR_STOP_MESSAGE = 'Geração interrompida a pedido do aluno.';

/** O erro é de aborto? (fetch/read rejeitam com AbortError; o sinal é a verdade final) */
function isAbort(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Limite PRÁTICO do prompt do aluno (o API aceita até 6000 — aqui fica uma
 * margem de segurança). Os construtores de perguntas (debriefing, evolução,
 * caderno) usam capQuestion() para garantir o envio sem 400.
 */
export const TUTOR_QUESTION_SAFE_MAX = 5500;

/**
 * Corta o prompt em `max` caracteres REMOVENDO linhas de lista ("- ...") do
 * fim (os itens mais antigos) — nunca no meio de uma frase. Insere um aviso
 * honesto do que ficou de fora. Head e instruções finais são sempre mantidos.
 */
export function capQuestion(question: string, max = TUTOR_QUESTION_SAFE_MAX): string {
  if (question.length <= max) return question;
  const lines = question.split('\n');
  const listIdx: number[] = [];
  lines.forEach((l, i) => {
    if (/^\s*-\s/.test(l)) listIdx.push(i);
  });
  if (listIdx.length === 0) return `${question.slice(0, max - 1)}…`;
  const head = lines.slice(0, listIdx[0]);
  const tail = lines.slice(listIdx[listIdx.length - 1] + 1);
  const build = (n: number) => {
    const kept = listIdx.slice(0, n).map((i) => lines[i]);
    const omitted = listIdx.length - n;
    return [
      ...head,
      ...kept,
      ...(omitted > 0
        ? [`(+ ${omitted} ${omitted === 1 ? 'item omitido' : 'itens omitidos'} — os mais antigos — para caber no limite do tutor)`]
        : []),
      ...tail,
    ].join('\n');
  };
  let n = listIdx.length;
  while (n > 3 && build(n).length > max) n -= 1;
  return build(n);
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
  /** t167: o freio do aluno — abortar devolve o parcial (nunca perde tudo). */
  signal?: AbortSignal,
): Promise<TutorStreamResult> {
  let res: Response;
  try {
    res = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
  } catch (err) {
    if (isAbort(err, signal)) throw new TutorStreamError(TUTOR_STOP_MESSAGE, '');
    throw err;
  }

  const contentType = res.headers.get('content-type') ?? '';

  // ----- caminho JSON (erro HTTP ou servidor sem suporte a stream) -----
  if (!contentType.includes('text/event-stream')) {
    type TutorJsonPayload = { answer?: string; model?: string; error?: string };
    let data: TutorJsonPayload | null = null;
    try {
      data = (await res.json()) as TutorJsonPayload | null;
    } catch (err) {
      if (isAbort(err, signal)) throw new TutorStreamError(TUTOR_STOP_MESSAGE, '');
      throw new TutorStreamError(
        `Erro ${res.status} ao consultar o tutor`,
        '',
      );
    }
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

  try {
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
  } catch (err) {
    // t167 — O FREIO DO ALUNO: abortar no meio da leitura devolve o que já
    // chegou (o parcial é a resposta honesta); sem nada, a palavra do freio.
    if (isAbort(err, signal)) {
      if (full.trim()) return { answer: full, interrupted: true };
      throw new TutorStreamError(TUTOR_STOP_MESSAGE, '');
    }
    throw err;
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
