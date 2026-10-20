// run-all.ts — O ORQUESTRADOR DO QUEBRA-CABEÇA
// ============================================================
// Roda as 6 peças EM CADEIA. Cada peça grava um artefato em
// test-suite/.chain/ e a peça seguinte só roda se a anterior
// encaixou (exceto com --continue). No fim, monta o relatório:
// test-suite/report.md
//
// Uso:
//   bun test-suite/run-all.ts              # cadeia completa (para na 1ª falha)
//   bun test-suite/run-all.ts --continue   # roda tudo mesmo com falha
//   bun test-suite/run-all.ts --only=0,1   # só peças específicas
//   bun test-suite/run-all.ts --skip-e2e   # pula a jornada de browser

import {
  resetChain, saveArtifact, loadArtifact, summarize, REPORT_PATH,
  type Piece, type StageResult,
} from './lib/chain';
import * as s0 from './stages/s0-env';
import * as s1 from './stages/s1-static';
import * as s2 from './stages/s2-unit';
import * as s3 from './stages/s3-api';
import * as s4 from './stages/s4-e2e';
import * as s5 from './stages/s5-visual';
import * as s6 from './stages/s6-prod';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const CONTINUE = args.includes('--continue');
const SKIP_E2E = args.includes('--skip-e2e');
const onlyIdx = args.findIndex((a) => a.startsWith('--only='));
const ONLY: number[] | null = onlyIdx >= 0
  ? args[onlyIdx].split('=')[1].split(',').map((n) => Number(n.trim())).filter(Number.isFinite)
  : null;

const PIECES: Piece[] = [
  { piece: 0, name: 'Ambiente', description: 'Runtime, deps, banco e dev server de pé', run: s0.run },
  { piece: 1, name: 'Qualidade do código', description: 'ESLint + tsc + leis da casa (fetch relativo, SDK só no backend)', run: s1.run },
  { piece: 2, name: 'Núcleo puro', description: '198 testes bun:test do compilador, algoritmos, acervo e ciclo do erro', run: s2.run },
  { piece: 3, name: 'API HTTP', description: 'Contratos dos endpoints, validação e ausência de 5xx', run: s3.run },
  { piece: 4, name: 'Jornada E2E', description: 'A pessoa abre, navega as 6 abas, roda o Lab, a paleta e o tema — e o check-in sobrevive ao reload', run: s4.run },
  { piece: 5, name: 'Visual & responsivo', description: 'AMOLED, zero overflow, rodapé colado, mobile 390px + screenshots', run: s5.run },
  { piece: 6, name: 'Produção (Vercel)', description: 'O link original no ar: home, /api, PWA e estáticos em produção', run: s6.run },
];

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function buildReport(results: StageResult[], totalMs: number, abortedAt: number | null): string {
  const now = new Date();
  const totalChecks = results.reduce((a, r) => a + r.checks.length, 0);
  const totalErrors = results.reduce((a, r) => a + r.checks.filter((c) => !c.ok && c.severity === 'error').length, 0);
  const totalWarns = results.reduce((a, r) => a + r.checks.filter((c) => !c.ok && c.severity === 'warning').length, 0);
  const allOk = results.every((r) => r.ok);

  const lines: string[] = [];
  lines.push('# 🧩 Quebra-Cabeça do Hub de Estudos — Relatório da Cadeia');
  lines.push('');
  lines.push(`- **Quando**: ${now.toLocaleString('pt-BR')}`);
  lines.push(`- **Duração total**: ${fmtMs(totalMs)}`);
  lines.push(`- **Peças montadas**: ${results.length}/${PIECES.length}${abortedAt !== null ? ` (cadeia interrompida na peça ${abortedAt})` : ''}`);
  lines.push(`- **Checks executados**: ${totalChecks} · **Erros**: ${totalErrors} · **Avisos**: ${totalWarns}`);
  lines.push(`- **Veredito**: ${allOk ? '✅ O QUEBRA-CABEÇA COMPLETOU O QUADRO' : '❌ HÁ PEÇA QUE NÃO ENCAIXA'}`);
  lines.push('');
  lines.push('## O quadro montado');
  lines.push('');
  lines.push('| # | Peça | Tempo | Checks | Estado |');
  lines.push('|---|------|-------|--------|--------|');
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    lines.push(`| ${r.piece} | ${r.name} | ${fmtMs(r.ms)} | ${r.checks.length} | ${icon} |`);
  }
  if (abortedAt !== null) {
    const next = PIECES.find((p) => p.piece === abortedAt + 1);
    lines.push(`| — | ${next?.name ?? '(restante)'} | — | — | ⛔ não rodou |`);
  }
  lines.push('');

  for (const r of results) {
    lines.push(`## Peça ${r.piece} · ${r.name}`);
    lines.push('');
    for (const c of r.checks) {
      const icon = c.ok ? '✅' : c.severity === 'warning' ? '⚠️' : '❌';
      lines.push(`- ${icon} **${c.name}**${c.ms !== undefined ? ` (${fmtMs(c.ms)})` : ''}${c.detail ? ` — ${c.detail.replace(/\n/g, ' ↵ ').slice(0, 500)}` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Artefatos da cadeia');
  lines.push('');
  lines.push('- `test-suite/.chain/piece-*.json` — estado detalhado de cada peça');
  lines.push('- `test-suite/.chain/shots/desktop-1440.png` — desktop 1440×900');
  lines.push('- `test-suite/.chain/shots/mobile-390.png` — mobile 390×844');
  lines.push('- `test-suite/.chain/shots/e2e-final.png` — fim da jornada E2E');
  lines.push('');
  lines.push('## Como rodar de novo');
  lines.push('');
  lines.push('```bash');
  lines.push('bun test-suite/run-all.ts              # cadeia completa');
  lines.push('bun test-suite/run-all.ts --continue   # roda tudo, mesmo com falha');
  lines.push('bun test-suite/run-all.ts --skip-e2e   # só até a API (rápido)');
  lines.push('bun test test-suite/unit/              # só os unitários');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  resetChain();
  const started = Date.now();
  const results: StageResult[] = [];
  let abortedAt: number | null = null;

  console.log('\n🧩 QUEBRA-CABEÇA DO HUB — cadeia completa iniciando\n');
  for (const piece of PIECES) {
    if (SKIP_E2E && (piece.piece === 4 || piece.piece === 5)) {
      console.log(`⏭️  PEÇA ${piece.piece} (${piece.name}) pulada (--skip-e2e)`);
      continue;
    }
    if (ONLY && !ONLY.includes(piece.piece)) {
      console.log(`⏭️  PEÇA ${piece.piece} (${piece.name}) fora de --only`);
      continue;
    }
    console.log(`▶ PEÇA ${piece.piece} · ${piece.name} — ${piece.description}`);
    let result: StageResult;
    try {
      result = await piece.run();
    } catch (err) {
      result = {
        piece: piece.piece,
        name: piece.name,
        ok: false,
        ms: 0,
        checks: [{ name: 'peça inteira', ok: false, severity: 'error', detail: String(err) }],
      };
    }
    saveArtifact(result);
    results.push(result);
    console.log(`   ${summarize(result)}\n`);

    if (!result.ok && !CONTINUE) {
      abortedAt = piece.piece;
      console.log(`⛔ A peça ${piece.piece} não encaixou — a cadeia para aqui. Use --continue para inspecionar tudo.\n`);
      break;
    }
  }

  const totalMs = Date.now() - started;
  const report = buildReport(results, totalMs, abortedAt);
  writeFileSync(REPORT_PATH, report, 'utf8');

  const totalErrors = results.reduce((a, r) => a + r.checks.filter((c) => !c.ok && c.severity === 'error').length, 0);
  const allOk = abortedAt === null && totalErrors === 0;

  console.log('──────────────────────────────────────────────');
  console.log(`🧩 ${results.length} peça(s) em ${fmtMs(totalMs)} · relatório completo em test-suite/report.md`);
  console.log(allOk ? '✅ O quadro completou: todas as peças encaixam.' : '❌ O quadro está incompleto — veja os ❌ acima.');
  console.log('──────────────────────────────────────────────\n');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('💥 O orquestrador caiu:', err);
  process.exit(1);
});
