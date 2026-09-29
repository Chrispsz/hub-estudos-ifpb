/**
 * TUTOR-FOLLOW — a aritmética do follow-bottom com intenção do leitor (t165).
 *
 * A LEITURA NÃO É SEQUESTRADA: o auto-scroll do chat do tutor era
 * incondicional — a cada tick do stream (e a cada mensagem nova) o leitor
 * era arrastado de volta ao fim, MESMO tendo subido de propósito para reler
 * uma explicação anterior. Na noite do debrief (conversas longas + respostas
 * vivas) isso é um sequestro da leitura.
 *
 * O contrato novo: o auto-scroll SÓ age quando o leitor já está no fim
 * (seguindo). Se ele sobe, a leitura dele fica PRESERVADA — o fio cresce em
 * silêncio e uma pill "descer para a resposta" oferece a volta. Quem pergunta
 * quer a resposta: ENVIAR sempre devolve o follow (o clique do envio é a
 * intenção declarada).
 *
 * Lib PURA: só aritmética, zero DOM/fetch/storage — o componente lê o
 * scrollEl e decide; aqui vive só a conta que os contratos provam.
 */

/** Tolerância para considerar "no fim": uma roda de mouse (~100px) já é
 * intenção de leitura; sub-pixel e arredondamento não são. 96 = a régua da
 * casa (as miniaturas do assentamento da t163 usam o mesmo número). */
export const FOLLOW_THRESHOLD_PX = 96;

/** Distância (px) entre a borda inferior do viewport e o fim do conteúdo.
 * Nunca negativa (overflow arredondado não inventa distância). Entradas
 * não-finitas → 0 (defensivo: sem medida, não há sequestro nem pill). */
export function distanceFromBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): number {
  if (
    !Number.isFinite(scrollTop) ||
    !Number.isFinite(clientHeight) ||
    !Number.isFinite(scrollHeight)
  ) {
    return 0;
  }
  return Math.max(0, scrollHeight - scrollTop - clientHeight);
}

/** O leitor está no fim (ou perto o bastante)? Contêiner vazio/sem medida
 * (scrollHeight ou clientHeight ≤ 0) → true: nada para ler, seguir é o
 * padrão honesto — a primeira resposta chega e o leitor a vê nascer. */
export function isNearBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold: number = FOLLOW_THRESHOLD_PX,
): boolean {
  if (scrollHeight <= 0 || clientHeight <= 0) return true;
  return distanceFromBottom(scrollTop, clientHeight, scrollHeight) <= threshold;
}
