'use client';

// error-review-feed.ts — A PONTE DO CICLO DO ERRO (pauta nº 1, Task 213-b).
//
// O erro nasce no Code Review do NÚCLEO v2 (IndexedDB/Dexie — tentativas
// reais com 1 frase do porquê). A fila da casa (study-plan.ts) é lib pura e
// não lê storage — a doutrina "o chamador entrega o valor pronto". Este hook
// é o chamador: lê o núcleo VIVO (useLiveQuery — todo write do Code Review
// re-renderiza a fila) e entrega as tarefas prontas:
//   • dedupe por unidade (o erro reincidente ATUALIZA a tarefa, não duplica);
//   • dominados fora (2 acertos de cabeça fecham o ciclo — o item sai da fila
//     sozinho, sem botão e sem estado espelhado);
//   • `category` e `disciplineCode` chegam na forma da casa (string/código).
//
// A derivação de status/dedupe mora no núcleo (v2/error-review.ts) — o Code
// Review e a fila dividem o MESMO critério. Aqui só a leitura reativa.

import { useLiveQuery } from 'dexie-react-hooks';
import type { ErrorReviewTask } from './study-plan';
import { openErrorsByUnit } from './v2/error-review';
import { getDb } from './v2/store';

/**
 * Os erros abertos do Code Review, prontos para o plano do dia. Enquanto o
 * IndexedDB abre (1 frame), devolve [] — a fila re-fluxa quando chegam, sem
 * estado de carregamento (o plano nunca bloqueia pela ponte).
 */
export function useErrorReviewTasks(): ErrorReviewTask[] {
  return useLiveQuery(
    async () => {
      const db = getDb();
      const [attempts, units, topics] = await Promise.all([
        db.attempts.orderBy('at').reverse().limit(2000).toArray(),
        db.units.toArray(),
        db.topics.toArray(),
      ]);
      return openErrorsByUnit(attempts, units, topics).map(
        (e): ErrorReviewTask => ({
          attemptId: e.attemptId,
          unitId: e.unitId,
          disciplineCode: e.subjectId,
          topicName: e.topicName ?? undefined,
          reason: e.reason,
          category: e.category,
          at: e.at,
        }),
      );
    },
    [],
    [] as ErrorReviewTask[],
  );
}
