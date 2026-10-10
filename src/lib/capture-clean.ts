// capture-clean — A CAPTURA QUE ARRUMA A CASA (t181).
//
// O dono relatou (t152 → 175): o print de TELA LIVRE ficava carregando o
// OVERLAY da própria captura — o seletor do navegador ("Escolher o que
// compartilhar") morre DEPOIS que o stream começa, e a régua antiga podia
// declarar a tela "parada" no meio de um fade quase imperceptível (um diálogo
// branco sumindo sobre conteúdo branco muda pouquíssimos pixels na amostra) —
// o frame congelava com o seletor ainda assado na imagem.
//
// A casa resolve em duas camadas, as duas DECIDIDAS AQUI (puro) e executadas
// lá (screen-capture.ts):
//  1. A JANELA DE ARRUMAÇÃO — depois que o dono escolhe a superfície, o Hub
//     mostra o aviso "arrumando a casa" por um tempo MÍNIMO GARANTIDO
//     (TIDY_TOTAL_MS ≈ 4× o mínimo antigo): o seletor tem tempo de morrer de
//     VERDADE, o dono pode fechar o que não deve sair na foto, e a superfície
//     PROVAVA mudança (o aviso entra e sai — nenhum frame congelado antes).
//  2. A RÉGUA v3 DO ASSENTAMENTO — depois do aviso, o frame só congela quando
//     TRÊS amostras seguidas são idênticas (eram 2), em comparação maior
//     (240px, eram 160): um fade residual não passa mais despercebido.
//
// Doutrina da casa: NADA de DOM, storage ou fetch aqui — só números e
// decisões, executáveis em contrato. O impuro (vídeo, canvas, banner) é
// fiação em screen-capture.ts e nos dois compositores.

// ===== A JANELA DE ARRUMAÇÃO =====

/**
 * Tempo GARANTIDO entre o dono escolher a superfície e a primeira amostra da
 * régua. O mínimo antigo era 440ms — o seletor do Chrome morre em ~0.5s em
 * máquinas rápidas, mas o dono viu overlay em print: o tempo não era
 * garantia, era corrida. 2s é o tempo de fechar o que precisava fechar sem
 * esperar o tédio (a régua continua DEPOIS disso — pressa nenhuma congela
 * sujeira).
 */
export const TIDY_TOTAL_MS = 2000;

/** O aviso conta 2… 1… — quantos segundos o dono vê no chip tabular. */
export const TIDY_SECONDS = Math.round(TIDY_TOTAL_MS / 1000);

/**
 * O rótulo do aviso de arrumação — a casa fala em voz alta o que acontece:
 * o dono sabe que NÃO precisa clicar nada; a captura é sozinha.
 */
export const TIDY_BANNER_LABEL = 'Arrumando a casa — a captura acontece sozinha';

/**
 * Segundos restantes do aviso para o chip do banner (teto honesto):
 * ceil((total - decorrido) / 1000), nunca abaixo de 0, nunca acima de
 * TIDY_SECONDS. elapsed fora de fase (negativo) conta como cheio.
 */
export function tidySecondsLeft(elapsedMs: number): number {
  const remaining = Math.ceil((TIDY_TOTAL_MS - Math.max(0, elapsedMs)) / 1000);
  return Math.min(TIDY_SECONDS, Math.max(0, remaining));
}

/** O aviso está de pé neste instante? (0 ≤ elapsed < total). */
export function tidyActive(elapsedMs: number): boolean {
  return elapsedMs >= 0 && elapsedMs < TIDY_TOTAL_MS;
}

// ===== A RÉGUA v3 DO ASSENTAMENTO =====

/** Espera MÍNIMA depois do aviso (a régua v2 começava aqui — agora é o piso). */
export const SETTLE_MIN_MS = 700;
/** Intervalo entre amostras (o passo da v2, intacto — 3 amostras ≈ 420ms). */
export const SETTLE_STEP_MS = 140;
/**
 * Amostras IGUAIS seguidas para declarar a superfície parada. A v2 exigia 2;
 * o dono viu overlay: o fade lento enganou a régua. 3 seguidas custam ~0.3s
 * a mais e exigem 280ms de silêncio VISUAL — fade residual morre antes.
 */
export const SETTLE_EQUAL_NEEDED = 3;
/** Teto de amostras (superfície viva — vídeo/animação — não prende a captura). */
export const SETTLE_MAX_SAMPLES = 12;
/** Largura da miniatura de comparação (era 160 — quanto maior, menor o delta
 * de um fade que ainda conta como "a tela está se movendo"). */
export const SETTLE_SAMPLE_PX = 240;

/**
 * O comprimento do TRILHO de igualdades: quantas amostras idênticas seguidas
 * existem AGORA. Primeira amostra não compara com nada → trilho 0 (o chamador
 * começa a contar da segunda). Amostra diferente ZERA o trilho — não desconta,
 * não média: silêncio visual é RACHA, não sorte.
 */
export function nextSettleStreak(equal: boolean, prevStreak: number): number {
  return equal ? prevStreak + 1 : 0;
}

/**
 * A superfície provou que parou? O trilho alcançou o exigido — e a amostra
 * que fecha o trilho não é a primeira (uma amostra só não prova nada).
 */
export function settleDone(streak: number): boolean {
  return streak >= SETTLE_EQUAL_NEEDED;
}

/**
 * A régua desistiu de esperar (superfície viva)? Colhe o último frame —
 * vídeo não congela nunca, e a captura é do AGORA, não do ideal.
 */
export function settleExhausted(samplesTaken: number): boolean {
  return samplesTaken >= SETTLE_MAX_SAMPLES;
}

/**
 * A pausa antes da PRÓXIMA amostra (ms): a primeira espera o piso da régua
 * (SETTLE_MIN_MS — o seletor morrendo tem o seu tempo EXTRA depois do aviso);
 * as seguintes seguem o passo. Função PURA para o loop impuro consultar.
 */
export function settleDelayMs(sampleIndex: number): number {
  return sampleIndex === 0 ? SETTLE_MIN_MS : SETTLE_STEP_MS;
}

// ===== AS FASES DA CAPTURA (o contrato entre a lib impura e a UI) =====

/**
 * picked — o dono escolheu a superfície e o stream está de pé: hora do aviso
 *           de arrumação (o banner sobe).
 * settle  — o aviso morreu: a régua v3 começa a amostrar (o banner JÁ saiu da
 *           superfície — o frame final não pode carregá-lo).
 * As duas fases existem para a UI saber O QUE mostrar sem conhecer timers:
 * a lib impura chama o callback, o composable pinta o banner.
 */
export type CapturePhase = 'tidy' | 'settle';
export const CAPTURE_PHASES = ['tidy', 'settle'] as const;
