// ai-summary-schema — O ESQUEMA DO RESUMO IA NA PORTA DE ENTRADA (t186).
//
// O achado da rodada: 13 dos 50 resumos do acervo guardavam as perguntas de
// autoavaliação sob a chave "perguntas_autoavaliação" (COM acento) — mas o
// tipo AiSummary e o diálogo leem "perguntas_autoavaliacao" (SEM acento):
// 60 perguntas escritas e NUNCA renderizadas. E os 4 resumos de Matemática —
// a tarefa 3 da VÉSPERA do plano ("Perguntas de autoavaliação dos resumos IA
// dos 4 materiais... leve, antes de dormir") — não tinham pergunta NENHUMA:
// o papel prometia e a tela não tinha a seção (guard length > 0) nem o
// contador (o rodapé confessava "0 / 0 perguntas respondidas").
//
// O papel desta lib: UMA fonte da verdade para a chave canônica e UMA
// normalização DEFENSIVA na porta de entrada (o fetch do cliente) — os dados
// do acervo já foram consertados na fonte (scripts/fix-186-perguntas.py), e a
// lib existe para que um resumo REGENERADO que volte a trazer o acento
// continue renderizando em vez de sumir de novo. PURA: zero DOM, storage ou
// fetch — recebe o JSON cru e devolve a forma que o diálogo lê.

/** A chave canônica — a que o tipo AiSummary e o diálogo de resumo leem. */
export const PERGUNTAS_AUTOAVALIACAO_KEY = 'perguntas_autoavaliacao';

/** A variante com acento que a extração IA já produziu 13 vezes no acervo. */
export const PERGUNTAS_AUTOAVALIACAO_KEY_ACENTUADA = 'perguntas_autoavaliação';

/** O JSON cru do resumo, como sai do fetch — só o que a normalização toca. */
export type RawAiSummary = Record<string, unknown>;

/**
 * Promove a variante acentuada à chave canônica, SEM apagar a original:
 *   - canônica viva (array) → o MESMO objeto, sem cópia (o caminho comum —
 *     zero custo quando o dado já está certo);
 *   - só a acentuada → cópia rasa com a canônica adicionada (a original
 *     permanece — normalizar não apaga dado, só abre a porta);
 *   - nenhuma das duas → o objeto intacto (o diálogo segue com o guard de
 *     length e ensina o que tem para ensinar);
 *   - não-objeto/null/undefined → {} (o fetch que falhar de forma estranha
 *     não derruba o diálogo — o guard de `available` cuida da mensagem).
 */
export function normalizeAiSummary(raw: RawAiSummary | null | undefined): RawAiSummary {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const canonica = raw[PERGUNTAS_AUTOAVALIACAO_KEY];
  if (Array.isArray(canonica)) return raw;
  const acentuada = raw[PERGUNTAS_AUTOAVALIACAO_KEY_ACENTUADA];
  if (!Array.isArray(acentuada)) return raw;
  return { ...raw, [PERGUNTAS_AUTOAVALIACAO_KEY]: acentuada };
}

/**
 * A contagem de perguntas da forma CRUA (antes de normalizar) — para o
 * contrato e para quem lê o JSON sem passar pela lib. Array da canônica ou
 * da acentuada → o comprimento; qualquer outra coisa → 0 (o rodapé honesto
 * do diálogo não existe quando M = 0: contador sem perguntas é ruído).
 */
export function perguntasCount(raw: RawAiSummary | null | undefined): number {
  if (raw == null || typeof raw !== 'object') return 0;
  const canonica = raw[PERGUNTAS_AUTOAVALIACAO_KEY];
  if (Array.isArray(canonica)) return canonica.length;
  const acentuada = raw[PERGUNTAS_AUTOAVALIACAO_KEY_ACENTUADA];
  if (Array.isArray(acentuada)) return acentuada.length;
  return 0;
}
