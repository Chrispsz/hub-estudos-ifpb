/**
 * Eventos globais do Hub (padrão CustomEvent — evita prop drilling entre
 * componentes distantes, igual ao OPEN_PALETTE_EVENT do command-palette).
 */

export const OPEN_METHOD_EVENT = 'hub:open-method';

export interface OpenMethodDetail {
  /** Código da disciplina para pré-selecionar na sessão guiada. */
  disciplineCode?: string;
  /** id do material (course-data) para abrir na sessão. */
  materialId?: string;
  /** Tema inicial da sessão (pré-preenche o campo "Tema"). */
  topic?: string;
}

/** Dispara a abertura da aba Método com a sessão pré-configurada. */
export function openMethod(detail: OpenMethodDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenMethodDetail>(OPEN_METHOD_EVENT, { detail }));
}

export const OPEN_SIMULADO_EVENT = 'hub:open-simulado';

export interface OpenSimuladoDetail {
  /** Código da disciplina para pré-selecionar. */
  disciplineCode?: string;
  /** Presets especiais (ex.: 'math_exam' = prova de Matemática 01/10). */
  preset?: 'math_exam';
  /**
   * Escopo de UM tópico (ex.: replay do pior tópico da tendência no Histórico).
   * Abre o Simulado Pro com só esse tópico ativo — prova curta (5 questões,
   * 15 min), no ritmo da turma.
   */
  topicScope?: string;
}

/** Dispara a troca para a aba Praticar com o Simulado Pro já configurado. */
export function openSimulado(detail: OpenSimuladoDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenSimuladoDetail>(OPEN_SIMULADO_EVENT, { detail }));
}

export const OPEN_PRACTICE_EVENT = 'hub:open-practice';

export interface OpenPracticeDetail {
  /** Disciplina para pré-filtrar a lista de exercícios. */
  disciplineCode?: string;
  /** Tópico para pré-filtrar além da disciplina (ex.: foco pós-simulado). */
  topic?: string;
  /** Material para pré-filtrar o CONJUNTO EXATO de questões ligadas a ele
   *  (padrão material-first: a folha da S3 → as 8 questões que saíram dela).
   *  O Praticar mostra um chip do conjunto com X para limpar. */
  linkedMaterial?: string;
  /** IDs EXATOS de exercícios do plano (ex.: apoio do dia → mat-ex07 + mat-ex08).
   *  O Praticar mostra o chip 'Apoio' com contagem ao vivo e X para limpar —
   *  o filtro nunca prende (a mesma gramática do conjunto da 94). */
  exerciseIds?: string[];
  /** Aba inicial do Praticar (ex.: kit da véspera abre direto nos flashcards). */
  mode?: 'exercicios' | 'flashcards';
}

/** Dispara a troca para a aba Praticar com o filtro de disciplina aplicado. */
export function openPractice(detail: OpenPracticeDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenPracticeDetail>(OPEN_PRACTICE_EVENT, { detail }));
}

export const OPEN_PROGRESS_EVENT = 'hub:open-progress';

/** Dispara a troca para a aba Progresso (ex.: Caderno de Erros no card da prova). */
export function openProgress(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_PROGRESS_EVENT));
}

export const OPEN_TUTOR_EVENT = 'hub:open-tutor';

export interface OpenTutorDetail {
  /** Pergunta pronta — pré-preenche o campo do tutor (o aluno revisa e envia). */
  question?: string;
  /** Disciplina para selecionar no tutor (troca também a memória da conversa). */
  disciplineCode?: string;
  /** Material para abrir junto — o tutor lê o conteúdo real (resumo + trechos). */
  materialId?: string;
  /**
   * Imagem pré-anexada (data URL JPEG) — o canal do PRINT DE PÁGINA do visualizador
   * de PDF (139): a captura de página inteira a 2× entra DIRETO no chatImage, sem
   * o aluno tocar em arquivo algum. Vive só na memória do chat — enviado o turno,
   * o anexo some (a mesma vida do print colado com Ctrl+V; nada toca o disco).
   */
  image?: string;
  /**
   * Procedência do print (t163): o chip do composer diz ONDE ele nasceu —
   * "página 3 · Lista de Matrizes", "print do resumo", "print da questão"…
   * Sem o rótulo, o chip usa o genérico "print do material". Só memória —
   * morre junto com o anexo no envio.
   */
  imageLabel?: string;
  /**
   * t178 — O SILÊNCIO QUE RESPEITA A LEITURA: pedido com silent=true anexa
   * pergunta/imagem no composer do chat SEM ABRIR o Sheet POR CIMA do que o
   * aluno está lendo (o caso real: o instantâneo da barra do PDF em modo
   * cheio — o chat abrindo sozinho escondia a página que o dono estava
   * lendo). O anexo fica no composer esperando; o chip na BARRA do leitor
   * confessa o destino e o "abrir" é um clique do dono, não uma decisão do
   * app. Se o chat já estiver aberto, o flag é irrelevante (abrir um chat
   * aberto é barulho sem efeito — a fiação trata os dois casos iguais).
   */
  silent?: boolean;
}

/** Dispara a troca para a aba Estudar com o tutor recebendo a pergunta pronta. */
export function openTutor(detail: OpenTutorDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenTutorDetail>(OPEN_TUTOR_EVENT, { detail }));
}
