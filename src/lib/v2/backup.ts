// Backup/restore JSON — Fase 1 (Alicerce). O export/import do stack alvo.
// Bundle completo: todas as tabelas do núcleo (IndexedDB) + todas as chaves
// legadas (localStorage). Restaurar = transação única (clear + bulkPut).

import { V2_TABLES, type V2TableName } from './domain';
import { DB_VERSION, getDb } from './store';
import { collectLegacyRaw } from './migrate';

export interface HubBackup {
  app: 'hub-projeto-principal';
  schema: number;
  createdAt: string;
  tables: Partial<Record<V2TableName, unknown[]>>;
  legacy: Record<string, string>;
}

/** Bundle completo (núcleo + legado). */
export async function buildBackup(): Promise<HubBackup> {
  const db = getDb();
  const tables: Partial<Record<V2TableName, unknown[]>> = {};
  for (const name of V2_TABLES) {
    tables[name] = await db.table(name).toArray();
  }
  return {
    app: 'hub-projeto-principal',
    schema: DB_VERSION,
    createdAt: new Date().toISOString(),
    tables,
    legacy: collectLegacyRaw().raw,
  };
}

export function backupBytes(b: HubBackup): number {
  return new Blob([JSON.stringify(b)]).size;
}

export function backupFilename(createdAt: string): string {
  return `hub-backup-${createdAt.slice(0, 16).replace(/[:T]/g, '')}.json`;
}

/** Dispara o download no navegador e devolve o nome do arquivo. */
export function downloadBackup(b: HubBackup): string {
  const json = JSON.stringify(b, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename(b.createdAt);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return a.download;
}

/** Restaura um backup: núcleo numa transação única + chaves legadas. */
export async function restoreBackup(
  json: string,
): Promise<{ tables: number; rows: number; legacyKeys: number }> {
  const parsed = JSON.parse(json) as HubBackup;
  if (parsed?.app !== 'hub-projeto-principal' || typeof parsed.schema !== 'number') {
    throw new Error('Arquivo não é um backup do Hub.');
  }
  const db = getDb();
  let rows = 0;
  await db.transaction('rw', db.tables, async () => {
    for (const name of V2_TABLES) {
      const data = parsed.tables?.[name];
      const table = db.table(name);
      await table.clear();
      if (Array.isArray(data) && data.length) {
        await table.bulkPut(data);
        rows += data.length;
      }
    }
  });
  let legacyKeys = 0;
  if (parsed.legacy && typeof parsed.legacy === 'object') {
    for (const [k, v] of Object.entries(parsed.legacy)) {
      window.localStorage.setItem(k, v);
      legacyKeys++;
    }
  }
  return { tables: V2_TABLES.length, rows, legacyKeys };
}
