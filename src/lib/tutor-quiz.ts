/**
 * Prompt do "Me testa" — modo interrogatório do tutor (recall ativo).
 *
 * O tutor responde bem, mas aprender dando resposta passiva tem retenção
 * pior do que ser testado (testing effect). Este prompt INVERTE o papel:
 * a IA faz as perguntas, o aluno responde, a IA corrige como professor.
 *
 * Usado em: chips do tutor (study-view + tutor-quick-panel) e no botão
 * "treino de véspera" do exam-prep-card (escopo = conteúdo real da prova).
 */

export interface QuizPromptOptions {
  /** Nome legível da disciplina (ex.: "Matemática"). */
  disciplineName?: string;
  /** Material aberto — o quiz fica 1:1 com o conteúdo real. */
  materialTitle?: string;
  /** Escopo explícito (ex.: programa da prova) — a IA NÃO sai dele. */
  scope?: string;
  /** Quantidade de questões da rodada (padrão 5). */
  count?: number;
}

export function buildQuizPrompt(opts: QuizPromptOptions = {}): string {
  const count = opts.count ?? 5;
  const alvo = opts.materialTitle
    ? `o material "${opts.materialTitle}"`
    : opts.disciplineName
      ? `${opts.disciplineName}`
      : 'o tópico atual da conversa';
  const escopo = opts.scope ? `\nESCOPO — só pergunte dentro disto: ${opts.scope}` : '';
  return [
    `Vamos treinar com RECALL ATIVO: me teste com ${count} questões sobre ${alvo}, UMA POR VEZ.${escopo}`,
    '',
    'Regras do treino:',
    '1. Mande SÓ a questão 1 agora e pare — espere a minha resposta antes de continuar.',
    '2. Quando eu responder, corrija com rigor de professor: diga o que está certo, o que faltou e qual é o erro conceitual (se houver).',
    '3. Se eu errar, dê a dica MÍNIMA e me deixe tentar de novo antes de revelar a solução completa.',
    '4. Questões no estilo que um professor real aplicaria, variando a dificuldade — comece pelas fáceis.',
    '5. Ao final das questões, dê minha NOTA (0-10), os pontos fracos e o que eu deveria revisar primeiro.',
    '',
    `Comece agora com a questão 1 de ${count}.`,
  ].join('\n');
}

/** Rótulo fixo do chip — a UI detecta por ele para enviar o prompt completo. */
export const ME_TESTA_LABEL = '🎯 Me testa — recall ativo';
