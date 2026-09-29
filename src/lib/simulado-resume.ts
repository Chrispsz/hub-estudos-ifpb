/**
 * RETOMADA DE SIMULADO — persiste a tentativa EM ANDAMENTO no localStorage
 * para que nenhum acidente destrua a prova: F5, queda de aba, fechamento
 * acidental do diálogo (X) ou travamento do navegador.
 *
 * Material-first e honesto:
 *  - Só questões do acervo estático são persistidas (por id) — o estado
 *    reconstrói a partir das MESMAS questões, sem inventar nada;
 *  - A tentativa só existe enquanto `running`; `finish()` (Encerrar ou tempo
 *    esgotado) GRAVA no histórico e limpa o rascunho — nunca duplica;
 *  - Um run inválido (acervo mudou, JSON corrompido) se autodestrói em vez
 *    de oferecer uma retomada quebrada.
 *
 * Semântica de PAUSA REAL: o cronômetro congelar quando o diálogo fecha —
 * a retomada continua do segundo exato em que parou (ver simulado-view).
 */

import { exercises, type Exercise } from './exercise-extractor';

/** Espelho estrutural de SimuladoConfig (definida no componente cliente). */
export interface SavedSimuladoConfig {
  discipline: string;
  difficulty: string;
  quantity: number;
  durationMin: number; // 0 = sem tempo
  aligned: boolean;
  topics?: string[];
}

/**
 * Natureza da tentativa — o rótulo HONESTO que atravessa todas as superfícies
 * (toast de pausa, banner de retomada, badge da tela de prova, resultado).
 * 'prova' = simulado montado no setup · 'treino' = drill do Caderno de Erros
 * · 'topico' = prova curta de 1 tópico (replay do pior tópico, preset externo).
 */
export type AttemptMode = 'prova' | 'treino' | 'topico';

/** Tentaivas antigas (antes do modo) não têm o campo — prova é o default. */
export function normalizeMode(m: unknown): AttemptMode {
  return m === 'treino' || m === 'topico' ? m : 'prova';
}

export interface InProgressRun {
  v: 1;
  /** ISO — quando o último estado foi gravado. */
  savedAt: string;
  /** Natureza da tentativa (opcional p/ compat com saves anteriores). */
  mode?: AttemptMode;
  config: SavedSimuladoConfig;
  /** ids das questões do acervo, na ordem da prova. */
  qids: string[];
  results: { solved: boolean | null }[];
  /** índice da questão em que o aluno parou. */
  idx: number;
  /** segundos restantes (durationMin > 0) — congelados na pausa. */
  remaining: number;
  /** segundos decorridos até a pausa. */
  elapsed: number;
  /**
   * Tempo por questão (segundos, na ordem da prova) — o "onde o tempo foi"
   * da retomada (t192). Opcional: saves anteriores não têm o campo, e a
   * retomada de um save antigo simplesmente recomeça a contagem do zero.
   */
  timeByQ?: number[];
}

const KEY = 'hub-estudos-ifpb:simulado-inprogress';

/** Grava (ou sobrescreve) a tentativa em andamento. Tolerante a quota/JSON. */
export function saveInProgress(
  run: Omit<InProgressRun, 'v' | 'savedAt'> & { v?: 1; savedAt?: string },
): boolean {
  try {
    const full: InProgressRun = {
      v: 1,
      savedAt: new Date().toISOString(),
      ...run,
    } as InProgressRun;
    window.localStorage.setItem(KEY, JSON.stringify(full));
    return true;
  } catch {
    return false; // quota cheia / storage bloqueado — a prova segue normal
  }
}

/** Lê a tentativa salva (null se ausente/corrompida). */
export function loadInProgress(): InProgressRun | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InProgressRun;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.qids)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Descarta a tentativa pausada (após Encerrar, Nova prova ou Descartar). */
export function clearInProgress(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // storage bloqueado — nada a fazer
  }
}

/**
 * Reconstrói as questões da prova a partir dos ids no acervo estático.
 * Ordem preservada; ids que não existirem mais são pulados (o acervo é
 * estático, mas o método sobrevive a qualquer re-extração).
 */
export function rebuildQuestions(qids: string[]): Exercise[] {
  if (qids.length === 0) return [];
  const byId = new Map<string, Exercise>(exercises.map((e) => [e.id, e]));
  return qids
    .map((id) => byId.get(id))
    .filter((e): e is Exercise => Boolean(e));
}

/**
 * Validação defensiva antes de oferecer a retomada: todas as questões
 * resolvem no acervo, results alinhado com qids e idx dentro do range.
 * Se algo não bate, a save é inválida e deve ser descartada.
 */
export function validateSaved(run: InProgressRun): boolean {
  if (!run || run.v !== 1) return false;
  if (!Array.isArray(run.qids) || run.qids.length === 0) return false;
  if (!Array.isArray(run.results) || run.results.length !== run.qids.length) return false;
  if (!run.config || typeof run.config !== 'object') return false;
  if (typeof run.idx !== 'number' || run.idx < 0 || run.idx >= run.qids.length) return false;
  if (typeof run.elapsed !== 'number' || run.elapsed < 0) return false;
  if (typeof run.remaining !== 'number' || run.remaining < 0) return false;
  const rebuilt = rebuildQuestions(run.qids);
  return rebuilt.length === run.qids.length;
}
