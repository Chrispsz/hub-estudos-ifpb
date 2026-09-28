// reingest-vlm.mjs — RE-INGESTÃO dos PDFs de Matemática via visão computacional.
//
// O PROBLEMA (dono, 28/09): "a detecção dos materiais não parece boa, a IA está
// errando com frequência, pelo menos em matemática". Causa raiz encontrada: o
// extrator de texto (pdftotext) PERDE as variáveis matemáticas — o itálico
// Cambria Math dos PDFs não tem mapa Unicode, então "a_ij = 2i + j" vira
// "=2+ +" e as matrizes viram escombros ("𝐴 = ( )2×2 tal que =2+ +"). O
// retrieval alimenta o tutor com esse lixo e a IA erra; o aluno só conseguia
// resolver enviando print (a visão lê, o texto não).
//
// A CURA: rasterizar cada página com pdftoppm (poppler, resolução 150dpi) e
// transcrever página a página com o modelo de VISÃO — o mesmo caminho que
// funcionava nos prints, agora aplicado ao acervo inteiro. O resultado em
// markdown+LaTeX Sobrescreve o .txt NO MESMO CAMINHO
// (public/data/material-texts/<id>.txt) para o retrieval adotar sem nenhuma
// mudança de código; os originais quebrados ficam em <id>.txt.bak. Os resumos
// IA são regerados a partir do texto LIMPO (mesma forma de SummaryJson que
// material-retrieval.compactSummary consome).
//
// Uso:  bun scripts/reingest-vlm.mjs            (todos os alvos pendentes)
//       bun scripts/reingest-vlm.mjs mat-01-matrizes   (um material)
//       FORCE=1 bun scripts/reingest-vlm.mjs     (reprocessa mesmo com .bak)

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import ZAI from 'z-ai-web-dev-sdk';

const execFileAsync = promisify(execFile);

const PDFS_DIR = 'public/pdfs';
const TEXTS_DIR = 'public/data/material-texts';
const SUMMARIES_DIR = 'public/data/ai-summaries';
const TMP_DIR = '/tmp/reingest-vlm';
const DPI = 150;
// MODO GENTIL (lição da 138): 429 sustentado derruba o bun em silêncio e queima
// o rate limit do tier grátis — um worker só, backoff longo, respiro entre páginas.
const CONCURRENCY = 1;
const PAGE_RETRIES = 3;

// Os alvos: TODOS os PDFs de Matemática do acervo (a matéria que o dono apontou).
const TARGETS = [
  { id: 'mat-logica-slides', label: 'Noções de Lógica — Slides (47 páginas)' },
  { id: 'mat-logica-lista', label: 'Lógica Matemática — Lista de Exercícios' },
  { id: 'mat-00-matrizes', label: 'Matrizes — Aula 00 (Slides)' },
  { id: 'mat-01-matrizes', label: 'Matrizes — Aula 01 (Lista)' },
];

const PAGE_INSTRUCTION = [
  'Você é o transcritor oficial do Hub de Estudos (IFPB). Transcreva esta PÁGINA de material acadêmico com fidelidade TOTAL, em markdown:',
  '- Enunciados, questões, alternativas, números, tabelas e unidades EXATAMENTE como aparecem. NÃO invente, NÃO corrija, NÃO resolva.',
  '- MATEMÁTICA EM LATEX SEMPRE: inline $...$; blocos $$...$$; matrizes com \\begin{bmatrix}…\\end{bmatrix} (linhas separadas por \\\\); sistemas/parte-por-parte com \\begin{cases}; frações \\frac; somatório \\sum_{i=1}^{n}; lógica com \\rightarrow, \\leftrightarrow, \\land, \\lor, \\sim.',
  '- Mantenha a numeração ORIGINAL das questões e letras (1-, 2-, a), b)…).',
  '- Código C ou pseudocódigo → bloco ```c (ou texto).',
  '- Slides: preserve títulos e bullets; se houver diagrama/figura, descreva em 1 linha entre [Figura: …] — sem detalhar dezena de traços.',
  '- Comece direto na transcrição (sem preâmbulo, sem "Página X").',
].join('\n');

const SUMMARY_INSTRUCTION = (id, label) => [
  `Você cria o RESUMO ESTRUTURADO oficial do material "${label}" (id ${id}) do Hub de Estudos, disciplina Matemática Aplicada à Computação (IFPB/ADS, 2026.2).`,
  'Baseie-se EXCLUSIVAMENTE no texto íntegro abaixo (transcrição fiel do PDF). Nada de conteúdo externo.',
  'Responda APENAS com um JSON válido (sem markdown, sem cercas) com EXATAMENTE estas chaves:',
  '{"titulo": string, "conceitos_chave": [{"conceito": string, "explicacao": string, "exemplo": string}], "pontos_importantes": string[], "erros_comuns": string[], "formulas_regras": string[]}',
  'Regras: 5 a 9 conceitos_chave (explicação 1-2 frases, exemplo curto concreto, matemática em LaTeX $...$ quando couber); 3 a 6 pontos_importantes (o que costuma cair em prova); 2 a 4 erros_comuns de aluno; 3 a 6 formulas_regras (fórmulas e definições literais do material). Se o material for uma LISTA de exercícios, descreva nos pontos_importantes quais tipos de questão ela treina (quantas por tema).',
].join('\n');

/** Sanitiza escapes LaTeX dentro de JSON (\b, \f, \n do LLM não são escapes JSON). */
function fixJsonEscapes(raw) {
  return raw.replace(/^```(?:json)?/, '').replace(/```$/, '').trim().replace(/\\(?![\\/"bfnrtu])/g, '\\\\');
}

// SOBREVIVÊNCIA (lição da 138): o SDK às vezes rejeita FORA da nossa cadeia
// (dump de erro 429) — em node isso derruba o processo no meio do lote. Os
// handlers mantêm vivo; o RESUME por página faz qualquer morte custar pouco.
process.on('unhandledRejection', (r) => {
  console.log(`[unhandledRejection ignorado] ${String(r?.message ?? r).slice(0, 120)}`);
});
process.on('uncaughtException', (e) => {
  console.log(`[uncaughtException ignorado] ${e?.message?.slice(0, 120)}`);
});

async function main() {
  const only = process.argv[2];
  const force = process.env.FORCE === '1';
  const targets = only ? TARGETS.filter((t) => t.id === only) : TARGETS;
  if (targets.length === 0) {
    console.error(`alvo desconhecido: ${only}. Opções: ${TARGETS.map((t) => t.id).join(', ')}`);
    process.exit(1);
  }

  const zai = await ZAI.create();
  await fs.mkdir(TMP_DIR, { recursive: true });

  for (const target of targets) {
    const pdfPath = path.join(PDFS_DIR, `${target.id}.pdf`);
    const txtPath = path.join(TEXTS_DIR, `${target.id}.txt`);
    const bakPath = `${txtPath}.bak`;
    const sumPath = path.join(SUMMARIES_DIR, `${target.id}.summary.json`);
    const sumBakPath = `${sumPath}.bak`;

    console.log(`\n=== ${target.id} — ${target.label} ===`);

    // .bak uma única vez — o original quebrado fica de testemunha (e o FORCE
    // não o sobrescreve: reprocessar nunca apaga a prova do antes).
    for (const [file, bak] of [[txtPath, bakPath], [sumPath, sumBakPath]]) {
      try {
        await fs.access(bak);
        if (!force) console.log(`  .bak já existe (${path.basename(bak)}) — mantido`);
      } catch {
        try {
          await fs.copyFile(file, bak);
          console.log(`  backup: ${path.basename(bak)}`);
        } catch {
          /* sem original — segue */
        }
      }
    }

    // 1) rasteriza (execFile async — o execFileSync do bun morre sob nohup)
    const outPrefix = path.join(TMP_DIR, target.id);
    await execFileAsync('pdftoppm', ['-r', String(DPI), '-png', pdfPath, outPrefix]);
    const pages = (await fs.readdir(TMP_DIR))
      .filter((f) => f.startsWith(`${target.id}-`) && f.endsWith('.png'))
      .sort((a, b) => {
        const na = parseInt(a.match(/-(\d+)\.png$/)?.[1] ?? '0', 10);
        const nb = parseInt(b.match(/-(\d+)\.png$/)?.[1] ?? '0', 10);
        return na - nb;
      });
    console.log(`  páginas rasterizadas (${DPI}dpi): ${pages.length}`);

    // 2) transcreve página a página (com retries + RESUME por página: cada
    // transcrição pousa em arquivo na hora — crash no meio do lote não perde
    // o trabalho já feito, é só rodar o script de novo). Concorrência limitada.
    const transcriptions = new Array(pages.length).fill(null);
    let done = 0;
    const pageCachePath = (idx) => path.join(TMP_DIR, `${target.id}.p${idx + 1}.txt`);
    const worker = async (queue) => {
      while (queue.length) {
        const idx = queue.shift();
        const file = pages[idx];
        // RESUME: transcrição anterior desta página? usa direto.
        try {
          const cached = (await fs.readFile(pageCachePath(idx), 'utf8')).trim();
          if (cached.length > 40) {
            transcriptions[idx] = cached;
            done++;
            console.log(`  pág ${idx + 1}/${pages.length} do cache (${done} feitas)`);
            continue;
          }
        } catch {}
        const b64 = (await fs.readFile(path.join(TMP_DIR, file))).toString('base64');
        let text = null;
        for (let attempt = 0; attempt <= PAGE_RETRIES && !text; attempt++) {
          try {
            const res = await zai.chat.completions.createVision({
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: PAGE_INSTRUCTION },
                    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
                  ],
                },
              ],
            });
            const out = res.choices?.[0]?.message?.content?.trim() ?? '';
            if (out.length > 40) {
              text = out;
              await fs.writeFile(pageCachePath(idx), text, 'utf8'); // pousa NA HORA
            }
          } catch (err) {
            console.log(`  pág ${idx + 1} tentativa ${attempt + 1} falhou: ${err.message?.slice(0, 120)}`);
            await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
          }
        }
        transcriptions[idx] = text ?? '[página não transcrita — revisar manualmente]';
        done++;
        console.log(`  pág ${idx + 1}/${pages.length} ${text ? 'ok' : 'FALHOU'} (${done} feitas)`);
        // respiro anti-429: o rate limit do tier grátis agradece
        await new Promise((r) => setTimeout(r, 2500));
      }
    };
    const queue = pages.map((_, i) => i);
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages.length) }, () => worker(queue)));

    const fullText = transcriptions
      .map((t, i) => `<!-- página ${i + 1} -->\n${t}`)
      .join('\n\n');
    await fs.writeFile(txtPath, fullText, 'utf8');
    console.log(`  texto limpo: ${txtPath} (${fullText.length} chars)`);

    // 3) resumo regenerado a partir do texto LIMPO
    const corpus = fullText.replace(/<!-- página \d+ -->/g, '').slice(0, 14_000);
    try {
      const res = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'Você responde APENAS com JSON válido, sem markdown e sem cercas de código.' },
          { role: 'user', content: `${SUMMARY_INSTRUCTION(target.id, target.label)}\n\n=== TEXTO ÍNTEGRO DO MATERIAL ===\n${corpus}` },
        ],
      });
      const raw = res.choices?.[0]?.message?.content?.trim() ?? '';
      const json = JSON.parse(fixJsonEscapes(raw));
      await fs.writeFile(sumPath, JSON.stringify(json, null, 2), 'utf8');
      console.log(`  resumo regenerado: ${sumPath}`);
    } catch (err) {
      // Diagnóstico: o bruto do LLM vai para /tmp — reparo manual se precisar.
      try { await fs.writeFile(`/tmp/summary-debug-${target.id}.txt`, raw ?? '(vazio)', 'utf8'); } catch {}
      console.log(`  resumo FALHOU (mantido o anterior): ${err.message?.slice(0, 140)}`);
    }
  }

  console.log('\n✓ re-ingestão concluída — reinicie o dev server para limpar o cache do retrieval.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
