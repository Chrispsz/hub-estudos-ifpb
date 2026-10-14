// ERROR REVIEW — a mecânica do CICLO DO ERRO (pauta nº 1 da escolha do dono,
// Task 213-b: "todo erro registrado no Code Review vira tarefa de revisão na
// fila, no tópico que o gerou — a prova nasce dos seus erros").
//
// Lib PURA do núcleo (a mesma doutrina de domain/planner): recebe os dados e
// devolve verdade — sem React, sem storage. Duas responsabilidades:
//
//  1. errorStatusFor — O estado honesto de um erro, derivado das tentativas
//     REAIS (o mesmo contrato do tab-code-review, agora em um só lugar):
//       aberto     — erro registrado, ainda sem acerto depois dele;
//       re-testado — 1 acerto depois do erro (o re-teste começou);
//       dominado   — 2 acertos DE CABEÇA seguidos na mesma unidade.
//     O 'dominado' é o ESTADO RESOLVIDO: é ele que fecha o ciclo e tira a
//     tarefa da fila — sem botão novo, sem estado duplicado.
//
//  2. openErrorsByUnit — a lista que alimenta a fila da casa, com o DEDUPE
//     pedido pelo dono: UMA tarefa por unidade (o erro reincidente ATUALIZA a
//     tarefa existente com o porquê mais recente, nunca cria segunda linha) e
//     os dominados fora (o ciclo fechou).

import type { Attempt, ErrorCategory, PracticeUnit, Topic } from './domain';

export type ErrorStatus = 'aberto' | 're-testado' | 'dominado';

/**
 * O status de UM erro à luz das tentativas reais da unidade — a mesma régua
 * do Code Review ("2 acertos de cabeça seguidos na mesma unidade"), extraída
 * aqui para a fila da casa e o log viverem do MESMO critério.
 */
export function errorStatusFor(errorAttempt: Attempt, allAttempts: Attempt[]): ErrorStatus {
  const after = allAttempts
    .filter(
      (x) => x.unitId === errorAttempt.unitId && x.at > errorAttempt.at && x.result !== 'skipped',
    )
    .sort((a, b) => a.at - b.at);
  const lastTwoCorrect =
    after.length >= 2 && after.slice(-2).every((x) => x.result === 'correct' && x.noLookup);
  const lastCorrect = after.at(-1)?.result === 'correct';
  return lastTwoCorrect ? 'dominado' : lastCorrect ? 're-testado' : 'aberto';
}

/** Um erro em aberto — a forma neutra que a fila da casa consome. */
export interface OpenError {
  /** Identidade do erro (o attempt que o registrou — dedupe/trace). */
  attemptId: string;
  /** A unidade de prática que o gerou (o destino do re-teste). */
  unitId: string;
  /** A matéria que o gerou (código da casa — a régua de prova lê daqui). */
  subjectId: string;
  /** O tópico que o gerou (rótulo do PPC), quando o núcleo conhece. */
  topicName: string | null;
  /** O porquê real gravado no ato ("1 frase — a casa não aceita erro mudo"). */
  reason: string;
  /** conceito | deslize | tempo — a categoria honesta do ato. */
  category: ErrorCategory;
  /** Quando o erro foi registrado (epoch ms) — a recência desempata a fila. */
  at: number;
}

/**
 * Os erros ABERTOS agregados por unidade — a matéria-prima da fila:
 *   • cada erro não-dominado entra por UMA unidade só (dedupe estrutural);
 *   • o erro reincidente (mesma unidade errada de novo) vira a MESMA tarefa
 *     atualizada — vence o registro mais recente (o porquê atual);
 *   • unidade dominada sai inteira (o ciclo fechou — nada de fantasma).
 * A recência da unidade (o `at` do erro vencedor) vem junto para a fila
 * ordenar sem re-derivar nada.
 */
export function openErrorsByUnit(
  attempts: Attempt[],
  units: PracticeUnit[],
  topics: Topic[],
): OpenError[] {
  const unitById = new Map(units.map((u) => [u.id, u]));
  const topicNameOf = new Map(topics.map((t) => [t.id, t.name]));

  // o erro mais recente de cada unidade é o ROSTO dela na fila (reincidente
  // atualiza a tarefa em vez de criar outra — pedido do dono, Task 213-b)
  const latestByUnit = new Map<string, Attempt>();
  for (const a of attempts) {
    if (a.result !== 'wrong' || !a.error) continue;
    if (!unitById.has(a.unitId)) continue; // unidade apagada = erro sem casa
    const current = latestByUnit.get(a.unitId);
    if (!current || a.at > current.at) latestByUnit.set(a.unitId, a);
  }

  const out: OpenError[] = [];
  for (const [unitId, attempt] of latestByUnit) {
    if (errorStatusFor(attempt, attempts) === 'dominado') continue; // ciclo fechado
    const unit = unitById.get(unitId)!;
    out.push({
      attemptId: attempt.id,
      unitId,
      subjectId: unit.subjectId,
      topicName: (unit.topicId && topicNameOf.get(unit.topicId)) || null,
      reason: attempt.error!.reason,
      category: attempt.error!.category,
      at: attempt.at,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}
