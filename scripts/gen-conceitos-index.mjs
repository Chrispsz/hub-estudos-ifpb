#!/usr/bin/env node
/**
 * gen-conceitos-index.mjs — gera src/data/conceitos-index.json a partir dos
 * resumos IA (public/data/ai-summaries/*.summary.json).
 *
 * Por quê (174): a paleta buscava TÍTULOS de materiais, nunca o CONTEÚDO dos
 * resumos — "onde eu li isso?" na véspera não tinha resposta. A camada de
 * CONCEITOS (conceito + explicação + exemplo) é a de maior valor por byte:
 * 290 conceitos em 54 resumos ≈ 90KB de índice, carregado por dynamic import
 * SÓ quando a paleta abre (a página nunca paga por ele).
 *
 * O índice carrega summaryFile como CHAVE DE JUNÇÃO com course-data.materials
 * (fonte única): a paleta só mostra conceito com material par — arquivo órfão
 * cala (material-first: sem a porta, a entrada não existe).
 *
 * Uso:  node scripts/gen-conceitos-index.mjs
 * Rode de novo sempre que um resumo IA for criado/atualizado.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public/data/ai-summaries');
const OUT = join(ROOT, 'src/data/conceitos-index.json');

const MAX_EXPLICACAO = 240;
const MAX_EXEMPLO = 160;

/** Corta em palavra inteira (a mesma régua do trimPreview da paleta). */
function trimWord(text, max) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.summary.json'));
const entries = [];
let skippedNoConcept = 0;

for (const file of files) {
  const raw = readFileSync(join(SRC, file), 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error(`  [AVISO] JSON inválido, pulando: ${file}`);
    continue;
  }
  const conceitos = json.conceitos_chave ?? json.conceitosChave ?? [];
  if (!Array.isArray(conceitos) || conceitos.length === 0) {
    skippedNoConcept += 1;
    continue;
  }
  for (const c of conceitos) {
    const conceito = String(c.conceito ?? '').trim();
    const explicacao = String(c.explicacao ?? '').trim();
    if (!conceito || !explicacao) continue; // conceito sem explicação é lixo
    entries.push({
      conceito,
      explicacao: trimWord(explicacao, MAX_EXPLICACAO),
      exemplo: c.exemplo ? trimWord(c.exemplo, MAX_EXEMPLO) : undefined,
      summaryFile: file, // chave de junção com course-data.materials
      titulo: String(json.titulo ?? '').trim(),
    });
  }
}

// Determinismo: agrupado por resumo (ordem de arquivo), conceito na ordem do
// resumo — a mesma entrada regenerada produz o MESMO arquivo (diff limpo).
writeFileSync(OUT, `${JSON.stringify(entries, null, 1)}\n`);

const kb = Math.round(statSync(OUT).size / 1024);
console.log(`OK: ${entries.length} conceitos de ${files.length} resumos → src/data/conceitos-index.json (${kb}KB)`);
console.log(`  resumos sem conceitos: ${skippedNoConcept}`);
