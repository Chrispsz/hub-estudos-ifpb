/**
 * O SEGURO NA PORTA (173) — o medidor do backup (172) morava SÓ nas
 * Configurações; a semana da prova é quando o aluno mais produz (sessões,
 * corridas de simulado, cartões) e o card da prova é a superfície que ele
 * olha todo dia. Este módulo é a CASA COMUM do gesto de backup: o card da
 * prova e as Configurações compartilham A MESMA chave de selo
 * (hub:backup:last-export-at — o selo nunca vive dentro do progresso: um
 * import antigo não pode fingir que o backup é novo) e A MESMA gramática:
 *
 *   serializa → baixa o JSON → grava o selo (o gesto inteiro, não a intenção)
 *
 * O toast (a voz) fica no componente — a lib é a mecânica. downloadTextFile
 * é o ÚNICO toque de DOM daqui (guardado para SSR); em bun/testes ele é
 * no-op e o resto roda puro, executável de ponta a ponta.
 */

import { exportProgressJSON, type StudyProgress } from '@/lib/study-progress';
import { BACKUP_STAMP_KEY } from '@/lib/backup-guard';
import { writeLocalStorage } from '@/lib/use-local-storage';

/** O nome honesto do arquivo — a data do DIA em que o seguro foi feito. */
export function backupFilenameFor(now: Date = new Date()): string {
  return `hub-estudos-backup-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Grava o selo do último backup na CHAVE PRÓPRIA e devolve o ISO gravado.
 * Via writeLocalStorage (não setItem cru): as instâncias do useLocalStorage
 * na mesma aba (o medidor das Configurações, o nudge do card) sincronizam
 * pelo storage event manual — quem estiver montado vira o tom na hora.
 */
export function stampBackupExport(now: Date = new Date()): string {
  const iso = now.toISOString();
  writeLocalStorage(BACKUP_STAMP_KEY, iso);
  return iso;
}

/** A cola de DOM do download — guardada para SSR, no-op fora do browser. */
export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * O GESTO INTEIRO do backup: serializa o progresso → baixa o JSON → grava
 * o selo. Devolve o ISO do selo para o componente confirmar/toastar.
 */
export function exportProgressBackup(progress: StudyProgress): string {
  const json = exportProgressJSON(progress);
  downloadTextFile(backupFilenameFor(), json);
  return stampBackupExport();
}
