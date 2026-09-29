/**
 * Task 172 — O SEGURO DO PROGRESSO.
 *
 * Contrato (`bun tests/test-t172-backup-guard.ts`):
 *  A. LIB PURA backup-guard: a régua de frescura (never/ok/warn/danger) com
 *     execução real — hoje, ontem, 8 dias, 30 dias, ISO inválido, fuso
 *     (startOfDay), e a contagem do que há a perder.
 *  B. SettingsView: selo em chave PRÓPRIA (não dentro do progresso), selo
 *     gravado no export bem-sucedido, medidor com cor = significado e
 *     contagem de registros, importação com diálogo quando há algo a perder
 *     e sem cerimônia quando o estado é vazio.
 *  C. Doutrina: lib sem DOM/storage/fetch; a chave do selo não é a do
 *     progresso (importar backup antigo não finge backup novo).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    pass += 1;
    console.log(`  [OK] ${label}`);
  } else {
    fail += 1;
    console.log(`  [FAIL] ${label}`);
  }
}

const HERE = (import.meta as { dir?: string }).dir ?? new URL('.', import.meta.url).pathname;
const ROOT = join(HERE, '..');
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ---------------------------------------------------------------------------
// A. LIB PURA — execução real da régua
// ---------------------------------------------------------------------------
console.log('A. backup-guard (execução real)');
const bg = (await import(join(ROOT, 'src/lib/backup-guard.ts')).then((m) => m)) as typeof import('../src/lib/backup-guard');

// nunca exportou
let s = bg.backupStatus(null, new Date(2026, 8, 29, 10, 0));
ok(s.tone === 'never' && s.days === null && /Nunca/.test(s.label), 'sem selo: never, sem alarmismo');

// hoje (mesmo dia): em dia
s = bg.backupStatus(new Date(2026, 8, 29, 7, 15).toISOString(), new Date(2026, 8, 29, 18, 0));
ok(s.tone === 'ok' && s.days === 0 && /hoje/.test(s.label), 'backup hoje: ok, "feito hoje"');

// ontem e dentro da janela: ok com dias
s = bg.backupStatus(new Date(2026, 8, 26, 9, 0).toISOString(), new Date(2026, 8, 29, 10, 0));
ok(s.tone === 'ok' && s.days === 3, '3 dias: ok, em dia');

// o limite exato da janela (7 dias): ainda ok
s = bg.backupStatus(new Date(2026, 8, 22, 9, 0).toISOString(), new Date(2026, 8, 29, 10, 0));
ok(s.tone === 'ok' && s.days === 7, '7 dias (limite): ainda ok');

// 8 dias: warn
s = bg.backupStatus(new Date(2026, 8, 21, 9, 0).toISOString(), new Date(2026, 8, 29, 10, 0));
ok(s.tone === 'warn' && s.days === 8, '8 dias: warn (janela vencida)');

// 29 dias: warn no teto
s = bg.backupStatus(new Date(2026, 7, 31, 9, 0).toISOString(), new Date(2026, 8, 29, 10, 0));
ok(s.tone === 'warn' && s.days === 29, '29 dias: warn');

// 30 dias: danger
s = bg.backupStatus(new Date(2026, 7, 30, 9, 0).toISOString(), new Date(2026, 8, 29, 10, 0));
ok(s.tone === 'danger' && s.days === 30, '30 dias: danger (seguro vencido)');

// ISO inválido: não mente, volta para never
s = bg.backupStatus('não-é-uma-data', new Date(2026, 8, 29, 10, 0));
ok(s.tone === 'never', 'ISO inválido: never (o medidor não inventa)');

// horário anterior no mesmo dia não vira 1 dia (startOfDay de ambos os lados)
s = bg.backupStatus(new Date(2026, 8, 29, 3, 0).toISOString(), new Date(2026, 8, 29, 10, 0));
ok(s.tone === 'ok' && s.days === 0, 'mesmo dia com horas diferentes: 0 dias (startOfDay)');

// progressWorthOf: contagem real e defensiva
const w = bg.progressWorthOf({
  pomodoroSessions: [1, 2, 3],
  completedMaterials: [1],
  flashcards: [],
  simuladoRuns: [1],
});
ok(w.sessions === 3 && w.materials === 1 && w.flashcards === 0 && w.runs === 1 && w.total === 5, 'progressWorthOf: soma os 4 registros');
const wEmpty = bg.progressWorthOf({} as never);
ok(wEmpty.total === 0, 'progressWorthOf: estado vazio = 0 (sem crash em campos ausentes)');

// constantes da régua
ok(bg.BACKUP_OK_DAYS === 7 && bg.BACKUP_DANGER_DAYS === 30, 'régua exportada: 7 dias ok · 30 danger');

// ---------------------------------------------------------------------------
// B. SettingsView — selo, medidor e confirmação
// ---------------------------------------------------------------------------
console.log('B. settings-view — o selo, o medidor e o diálogo');
const svSrc = src('src/components/hub/settings-view.tsx');

ok(svSrc.includes('BACKUP_STAMP_KEY') && svSrc.includes("useLocalStorage<string | null>(BACKUP_STAMP_KEY, null)"), 'selo em chave PRÓPRIA via useLocalStorage');
ok(!svSrc.includes("lastExport: ") || !svSrc.includes('mergeWithDefaults'), 'selo não entra no progresso (import antigo não finge backup novo)');
ok(svSrc.includes('setLastExport(new Date().toISOString())'), 'export bem-sucedido grava o selo (o gesto inteiro)');
ok(svSrc.includes('data-testid="backup-status"'), 'medidor com testid');
ok(
  svSrc.includes("backup.tone === 'ok' && 'border-emerald-500/40") &&
    svSrc.includes("backup.tone === 'warn' && 'border-amber-500/40") &&
    svSrc.includes("backup.tone === 'danger' && 'border-rose-500/40"),
  'medidor: cor = significado (esmeralda/âmbar/rosa — a gramática da casa)',
);
ok(svSrc.includes('registros`} no seguro'), 'medidor confessa quantos registros estão no seguro');
ok(
  svSrc.includes('if (worth.total === 0) {') && svSrc.includes('setPendingImport(String(reader.result))'),
  'importação: estado vazio importa direto · com dados vai ao diálogo',
);
ok(svSrc.includes('function confirmImport()'), 'confirmação importa de verdade (o diálogo leva ao ato)');
ok(
  svSrc.includes('Substituir o progresso atual pelo backup?') &&
    svSrc.includes('de Pomodoro') &&
    svSrc.includes('de simulado') &&
    svSrc.includes('de flashcards') &&
    svSrc.includes('concluídos'),
  'diálogo confessa O QUÊ em números (as 4 fontes do progresso)',
);
ok(svSrc.includes('exporte o atual antes, se precisar'), 'diálogo oferece a saída honesta (exportar antes)');
ok(
  svSrc.includes("className=\"bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/60\""),
  'ação destrutiva com a voz rosa da casa + foco visível',
);
ok(svSrc.includes('um hábito semanal cobre o semestre inteiro'), 'cópia ensina o hábito (régua dos 7 dias)');

// ---------------------------------------------------------------------------
// C. Doutrina
// ---------------------------------------------------------------------------
console.log('C. doutrina (lib pura, zero DOM/storage na régua)');
const libSrc = src('src/lib/backup-guard.ts');
const libNoComments = libSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!/localStorage\s*[.[]/.test(libNoComments) && !libNoComments.includes('fetch'), 'régua sem storage/fetch (pura — testável)');
ok(!libNoComments.includes('document.') && !libNoComments.includes('window.'), 'régua sem DOM');
ok(libSrc.includes('BACKUP_STAMP_KEY') && libSrc.includes("'hub:backup:last-export-at'"), 'chave do selo exportada e nomeada');
ok(!src('src/lib/study-progress.ts').includes('hub:backup'), 'a chave do selo não vazou para o study-progress');

console.log(`\n${pass} checks OK · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
