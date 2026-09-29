/**
 * O LEITOR LEMBRA (t161) — a leitura continua de onde parou.
 *
 * O leitor NATIVO (iframe) lê bem, mas mora num documento próprio: quando o
 * diálogo fecha, a posição morre com ele — reabrir a Lista de Lógica de 47
 * páginas é voltar à página 1 e folhear tudo de novo. O Hub JÁ lembra as
 * preferências do dono no localStorage (modo dividido e largura da régua,
 * t142/t144); a posição de leitura merece o mesmo tratamento.
 *
 * O que o Hub sabe HONESTAMENTE: o leitor nativo não reporta a página ao pai
 * enquanto o dono rola dentro do iframe. A posição guardada é a do ÚLTIMO
 * SALTO que o app despachou ("ir" na barra, "Ir" no mapa da busca, o convite
 * de retomada aceito) — é de lá que o convite fala, e o title dele confessa
 * de onde vem a memória. Nada de auto-salto escondido: a retomada é um
 * CONVITE explícito, nunca um comportamento que surpreende.
 *
 * Nada aqui toca em DOM ou React — funções puras sobre localStorage com
 * try/catch (storage indisponível = a memória só não sobrevive à sessão).
 */

import { clampPdfPage } from './pdf-search';

const PREFIX = 'hub:pdf-pos:';

/** Chave por material — o mesmo padrão das preferências do leitor (t142). */
export function pdfPositionKey(materialId: string): string {
  return `${PREFIX}${materialId}`;
}

/**
 * Guarda a página do último salto conhecido. Página inválida/abaixo de 1 é
 * ignorada; acima do teto é guardada CLAMPADA (o convite futuro respeita o
 * arquivo atual — o PDF pode ter sido substituído por uma versão menor).
 * Storage indisponível: silencioso, como o remember() do modo dividido.
 */
export function rememberPdfPage(
  materialId: string,
  page: number | null | undefined,
  maxPages?: number,
): void {
  if (!materialId) return;
  const p = clampPdfPage(page, maxPages);
  if (!p) return;
  try {
    localStorage.setItem(pdfPositionKey(materialId), String(p));
  } catch {
    /* storage indisponível — a memória só não sobrevive à sessão */
  }
}

/**
 * A página do último salto conhecido — ou null quando não há convite digno:
 * entrada ausente, lixo, página ≤ 1 (retomar o COMEÇO não é retomar) ou
 * material sem id. Página acima do teto atual vem clampada para ele (a
 * doutrina do salto da t157: "Este PDF tem N páginas — abrindo a N").
 */
export function recallPdfPage(materialId: string, maxPages?: number): number | null {
  if (!materialId) return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(pdfPositionKey(materialId));
  } catch {
    return null;
  }
  if (!raw) return null;
  const p = clampPdfPage(Number(raw), maxPages);
  return p && p > 1 ? p : null;
}
