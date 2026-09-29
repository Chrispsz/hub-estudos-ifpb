/**
 * Task 174 — A BUSCA QUE LÊ OS RESUMOS (+ branch de testes publicado).
 *
 * Contrato (`bun tests/test-t174-conceitos-index.ts`):
 *  A. GERADOR + ÍNDICE: gen-conceitos-index.mjs regenera o JSON determinístico
 *     e o índice tem forma honesta (conceito+explicação sempre, resumo
 *     sem conceito não inventa linha, cortes em palavra inteira).
 *  B. LIB PURA (execução real com o índice REAL): entradas com chave
 *     summaryFile::conceito (homônimos coexistem), value carrega conceito +
 *     explicação + exemplo, e o filtro palavra-AND acha "transposta" no
 *     CONTEÚDO do resumo — a pergunta da véspera com resposta.
 *  C. Fiação da paleta: grupo "Conceitos nos resumos", dynamic import SÓ no
 *     abrir (a página nunca paga), porta = MaterialSummaryDialog por
 *     summaryFile, defesa sem material, placeholder confessa conceitos.
 *  D. Doutrina + infra da rodada: lib sem DOM/storage/fetch; o script de
 *     testes branch consertado (interpolava %s e executava .ts como comando;
 *     mktree não aceita barra) com guarda append-only intata.
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

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
// A. GERADOR + ÍNDICE
// ---------------------------------------------------------------------------
console.log('A. gerador + índice');
execSync('node scripts/gen-conceitos-index.mjs', { cwd: ROOT, stdio: 'pipe' });
const idxPath = join(ROOT, 'src/data/conceitos-index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8')) as import('../src/lib/palette-search').ConceitoIndexEntry[];
ok(Array.isArray(idx) && idx.length >= 250, `índice regenerado com ${idx.length} conceitos (≥250)`);
ok(statSync(idxPath).size < 160 * 1024, `índice enxuto (${Math.round(statSync(idxPath).size / 1024)}KB < 160KB — dynamic import barato)`);
ok(idx.every((e) => e.conceito?.trim() && e.explicacao?.trim()), 'toda entrada tem conceito E explicação (par obrigatório)');
ok(idx.every((e) => e.summaryFile.endsWith('.summary.json')), 'chave de junção sempre um summaryFile real');
ok(idx.every((e) => e.explicacao.length <= 241), 'explicação cortada ≤240 (+ reticência)');
const comExemplo = idx.filter((e) => e.exemplo);
ok(comExemplo.length > 50, `${comExemplo.length} conceitos trazem exemplo (o concreto da casa)`);
// determinismo: rodar de novo produz o MESMO arquivo (diff limpo)
const before = readFileSync(idxPath, 'utf8');
execSync('node scripts/gen-conceitos-index.mjs', { cwd: ROOT, stdio: 'pipe' });
ok(readFileSync(idxPath, 'utf8') === before, 'regeneração é determinística (mesmo arquivo)');

// ---------------------------------------------------------------------------
// B. LIB PURA — execução real
// ---------------------------------------------------------------------------
console.log('B. palette-search (execução real)');
const ps = (await import(join(ROOT, 'src/lib/palette-search.ts'))) as typeof import('../src/lib/palette-search');
const entries = ps.conceitoPaletteEntries(idx);
ok(entries.length === idx.length, '1 entrada de paleta por conceito do índice');

const homonimos = new Map<string, number>();
for (const e of entries) homonimos.set(e.key, (homonimos.get(e.key) ?? 0) + 1);
ok([...homonimos.values()].every((v) => v === 1), 'chave summaryFile::conceito única (homônimos coexistem)');

const transposta = entries.filter((e) => ps.paletteWordFilter(e.value, 'transposta') === 1);
ok(
  transposta.length >= 1 && transposta.every((e) => /transposta/i.test(e.value)),
  `"transposta" acha o CONTEÚDO do resumo (${transposta.length} conceito(s), e só eles)`,
);
ok(
  transposta.some((e) => /matriz transposta/i.test(e.conceito)),
  'o conceito "Matriz transposta" é um dos achados — a pergunta da véspera',
);
ok(transposta.every((e) => e.materialTitle.length > 0 && e.summaryFile.length > 0), 'achados carregam o resumo de origem (a porta existe)');

ok(entries.every((e) => e.explicacaoPreview.length <= ps.CONCEITO_PREVIEW_MAX + 1), 'preview da explicação dentro da régua (120)');
const semExemplo = entries.find((e) => !e.exemploPreview);
ok(semExemplo ? semExemplo.exemploPreview === null : true, 'sem exemplo: null (não string vazia)');

// o filtro segue honesto para conceitos: palavra ausente zera
ok(entries.filter((e) => ps.paletteWordFilter(e.value, 'favicon') === 1).every((e) => /favicon/i.test(e.value)), 'busca estrutural: "favicon" só nos conceitos que o citam');

// ---------------------------------------------------------------------------
// C. FIAÇÃO DA PALETA
// ---------------------------------------------------------------------------
console.log('C. command-palette (fiação)');
const pal = src('src/components/hub/command-palette.tsx');
ok(/Conceitos nos resumos/.test(pal), 'grupo "Conceitos nos resumos" existe');
ok(/import\('@\/data\/conceitos-index\.json'\)/.test(pal), 'índice entra por dynamic import (a página não paga)');
ok(/if \(!open \|\| conceitosIdx\) return;/.test(pal), 'import dispara SÓ com a paleta aberta e índice ausente');
ok(/\.catch\(\(\) => \{\}\)/.test(pal) || /catch.*cala/.test(pal), 'falha de carregamento cala o grupo (nada inventado)');
ok(/materialBySummaryFile/.test(pal) && /setSelectedMaterial\(material\)/.test(pal) && /setMaterialOpen\(true\)/.test(pal), 'porta = o MESMO resumo dialog do grupo Materiais');
ok(/if \(!material\) return;/.test(pal), 'defesa: sem material, sem gesto');
ok(/materialBySummaryFile\.has\(e\.summaryFile\)/.test(pal), 'filtro de junção na entrada (conceito órfão cala)');
ok(pal.includes('placeholder="Buscar páginas, disciplinas, materiais, questões, conceitos e ações..."'), 'placeholder confessa os conceitos');
ok(/Sparkles className="size-3\.5"/.test(pal), 'cabeçalho com o tom IA da casa (Sparkles)');
ok(pal.includes('{conceitoEntries.length}'), 'contagem tabular-nums no cabeçalho');
ok(/text-violet-500/.test(pal), 'linha no violeta da IA (cor = significado)');

// ---------------------------------------------------------------------------
// D. DOUTRINA + INFRA DA RODADA
// ---------------------------------------------------------------------------
console.log('D. doutrina + infra');
const lib = src('src/lib/palette-search.ts');
ok(!/document\./.test(lib), 'lib sem document (pura)');
ok(!/localStorage|sessionStorage/.test(lib), 'lib sem storage');
ok(!/\bfetch\s*\(/.test(lib), 'lib sem fetch');
ok(!/window\./.test(lib), 'lib sem window');

const tbranch = src('scripts/update-tests-branch.sh');
ok(!/%s\\n" "\$\{f\}/.test(tbranch) && /\$\{f\}/.test(tbranch), 'interpolação direta consertada (não executa .ts como comando)');
ok(/read-tree --empty/.test(tbranch) && /write-tree/.test(tbranch), 'árvore via índice temporário (mktree não aceita barra)');
ok(/remote_count/.test(tbranch) && /local_count.*-lt.*remote_count/.test(tbranch), 'guarda append-only intata (contagem)');
ok(/sumiram do disco/.test(tbranch), 'guarda por NOME intata (renomear sem repor recusa)');

// regressões
ok(pal.includes('openPractice({ disciplineCode: e.disciplineCode, exerciseIds: [e.id] })'), 't173: deep-link code+ids segue junto');
ok(pal.includes('commandFilter={paletteWordFilter}'), 't173: filtro pluggable segue ligado');
ok(src('src/components/hub/settings-view.tsx').includes('backup-status'), 't172: medidor do backup segue no lugar');

console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
