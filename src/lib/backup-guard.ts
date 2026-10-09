/**
 * O SEGURO DO PROGRESSO (172) — o estado do aluno vive SÓ no localStorage
 * (sessões de foco, materiais concluídos, flashcards, notas, corridas de
 * simulado). Um "limpar dados do navegador" apaga TUDO, e a semana da prova é
 * exatamente a pior hora para isso. O export manual já existia nas
 * Configurações — o que faltava era o HÁBITO ter um medidor: quando foi o
 * último backup? Este módulo responde com uma régua honesta de tons
 * (cor = significado, a gramática da casa):
 *
 *   ok     — backup fresco (≤ 7 dias, ou hoje): o seguro está em dia
 *   warn   — 8–29 dias: dá uma semana sem seguro
 *   danger — ≥ 30 dias: o seguro está vencido
 *   never  — nunca exportou (e há algo a perder)
 *
 * A função de julgamento é PURA (sem DOM, sem storage, sem fetch) — o selo de
 * "quando" mora numa chave própria do localStorage escrita pelo SettingsView
 * (via useLocalStorage, a mesma régua de sempre: valor default no primeiro
 * render, leitura pós-mount). O selo NÃO vive dentro do progresso de
 * propósito: importar um backup antigo não pode fingir que o backup é novo.
 */

/** Janela considerada "em dia" — um hábito semanal cabe nela com folga. */
export const BACKUP_OK_DAYS = 7;
/** A partir daqui o seguro está vencido (um mês sem cópia). */
export const BACKUP_DANGER_DAYS = 30;

export type BackupTone = 'ok' | 'warn' | 'danger' | 'never';

export interface BackupStatus {
  tone: BackupTone;
  /** Frase para o aluno — honesta, sem alarmismo. */
  label: string;
  /** Dias desde o último backup (null quando nunca exportou). */
  days: number | null;
}

export const BACKUP_STAMP_KEY = 'hub:backup:last-export-at';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Julga a frescura do último backup. `lastIso` null = nunca exportou.
 * Datas inválidas/caóticas tratadas como "nunca" (o medidor não mente).
 */
export function backupStatus(lastIso: string | null, now: Date = new Date()): BackupStatus {
  if (!lastIso) {
    return { tone: 'never', label: 'Nunca exportou um backup', days: null };
  }
  const last = new Date(lastIso);
  if (Number.isNaN(last.getTime())) {
    return { tone: 'never', label: 'Nunca exportou um backup', days: null };
  }
  const days = Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(last).getTime()) / 86_400_000));
  if (days <= BACKUP_OK_DAYS) {
    return {
      tone: 'ok',
      label: days === 0 ? 'Backup feito hoje — em dia' : `Último backup há ${days} ${days === 1 ? 'dia' : 'dias'} — em dia`,
      days,
    };
  }
  if (days < BACKUP_DANGER_DAYS) {
    return {
      tone: 'warn',
      label: `Último backup há ${days} dias — já dá uma semana sem seguro`,
      days,
    };
  }
  return {
    tone: 'danger',
    label: `Último backup há ${days} dias — o seguro está vencido`,
    days,
  };
}

/**
 * O que HÁ a perder (para o aviso de importação dizer a verdade em números):
 * contagens vivas do progresso atual. Zero em tudo = nada a perder, e a
 * importação deixa de pedir confirmação (não há o que destruir).
 */
export interface ProgressWorth {
  sessions: number;
  materials: number;
  flashcards: number;
  runs: number;
  total: number;
}

export function progressWorthOf(progress: {
  pomodoroSessions: unknown[];
  completedMaterials: unknown[];
  flashcards: unknown[];
  simuladoRuns: unknown[];
}): ProgressWorth {
  const sessions = progress.pomodoroSessions?.length ?? 0;
  const materials = progress.completedMaterials?.length ?? 0;
  const flashcards = progress.flashcards?.length ?? 0;
  const runs = progress.simuladoRuns?.length ?? 0;
  return { sessions, materials, flashcards, runs, total: sessions + materials + flashcards + runs };
}
