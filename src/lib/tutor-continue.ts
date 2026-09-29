/**
 * A PALAVRA DE VOLTA (t168) — o "continuar de onde parou" do freio.
 *
 * O freio da t167 deu ao aluno o poder de CORTAR a resposta viva — mas era
 * uma porta de mão única: quem parou para reler o parcial com calma e quis
 * o resto tinha de digitar o pedido de continuação à mão, no meio da noite
 * do debrief. O continuar completa o gesto: um clique ao lado do carimbo
 * envia o turno "Continue a resposta de onde parou." e a IA — que lê o
 * parcial no histórico (ele é conteúdo real, doutrina t164/t167) — segue do
 * exato ponto em que foi cortada.
 *
 * APPEND-ONLY como tudo na casa: o parcial interrompido continua no fio
 * com o seu carimbo ("interrompida a seu pedido — o que chegou, ficou"),
 * o turno novo nasce AO LADO — nada é reescrito, nada é apagado, o log é
 * honesto. O botão também não mexe no PRESENTE: o rascunho em digitação e
 * o print pendente do agora sobrevivem (a mesma régua do retry, t164).
 *
 * A oferta é EFÊMERA por doutrina: só vive enquanto a bolha interrompida é
 * a ÚLTIMA do fio. O aluno mandou outra coisa? A conversa seguiu — costurar
 * uma resposta velha no meio do fio novo seria falsidade. Sem toast, sem
 * modal: o botão simplesmente deixa de existir.
 *
 * Lib PURA: nada de fetch, storage ou DOM — a decisão de enviar é do clique
 * do aluno; aqui vive só a régua que diz SE o clique existe.
 */

/** O turno que o "continuar de onde parou" envia — explícito para a IA
 *  (ela tem o parcial no histórico e o comando é curto de propósito). */
export const TUTOR_CONTINUE_QUESTION = 'Continue a resposta de onde parou.';

/** Forma mínima de um turno do chat para a régua do continuar. */
export interface ContinueableTurn {
  role: 'user' | 'assistant';
  content: string;
  /** true → bolha de erro (falha do provedor) — erro não tem continuação. */
  error?: boolean;
  /** true → resposta cortada pelo freio da t167 (o parcial ficou). */
  interrupted?: boolean;
}

/**
 * A bolha em `index` pode ser continuada? A régua inteira:
 * (1) índice válido dentro do fio; (2) é fala do tutor; (3) carrega a flag
 * `interrupted` da t167 — resposta NORMAL não tem o botão (ela terminou
 * sozinha); (4) não é erro (falha tem o "tentar de novo" da t164, caminho
 * próprio); (5) o parcial é real (conteúdo não-vazio — abort vira erro na
 * t167, então interrompida SEM texto não deve existir, mas a lib não
 * confia); (6) é a ÚLTIMA bolha do fio — qualquer turno depois dela mata a
 * oferta. Quem chama recebe true/false e omite o gesto quando false.
 */
export function canContinueFromInterrupt(
  messages: ContinueableTurn[],
  index: number,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= messages.length) {
    return false;
  }
  if (index !== messages.length - 1) {
    return false;
  }
  const m = messages[index];
  return Boolean(
    m &&
      m.role === 'assistant' &&
      m.interrupted === true &&
      !m.error &&
      typeof m.content === 'string' &&
      m.content.trim().length > 0,
  );
}
