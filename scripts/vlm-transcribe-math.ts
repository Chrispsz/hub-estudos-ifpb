/**
 * transcribe-math-vlm — reconstrói os textos de MATEMÁTICA com fidelidade TOTAL
 * usando o modelo de visão (glm-4.5v, o mesmo caminho dos prints do dono que
 * FUNCIONAM) em vez do pdftotext, que rasga matrizes em linhas soltas.
 *
 * Por que: o texto extraído do PDF ("[0 4 ] é matriz 2 × 3. b) [ 1 ]…") perde a
 * geometria da matriz — o tutor lê números órfãos e erra a montagem. O dono
 * contorna enviando PRINTS (visão) — isso funciona. Então a correção estrutural
 * é: transcrever as páginas COM visão e pedir notação linear SEM ambiguidade
 * (matriz em linhas [[a,b],[c,d]]) — texto que a IA lê sem errar e que o dono
 * copia sem quebrar.
 *
 * Uso:
 *   bun scripts/vlm-transcribe-math.ts probe <pdf> <page>   # testa 1 página
 *   bun scripts/vlm-transcribe-math.ts run                  # converte os 4 PDFs
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/home/z/my-project';
const TMP = '/tmp/mathpages';

/** Os alvos da conversão. AUDITORIA prévia (dono: "pelo menos em matemática"):
 *  - mat-00 e mat-01 (matrizes): QUEBRADOS pelo pdftotext — a geometria 2D das
 *    matrizes vira números órfãos espalhados ("[0 4 ] é matriz 2 × 3").
 *  - mat-logica-lista e mat-logica-slides: os símbolos da lógica (∧ ∨ → ↔ ∼)
 *    são glifos únicos e SOBREVIVEM ao pdftotext — conferido, textos lineares e
 *    íntegros → ficam como estão (converter 47 páginas íntegras seria custo sem
 *    cura). Se um dia ganhar matemática 2D, basta adicionar aqui. */
const TARGETS: { pdf: string; out: string; titulo: string }[] = [
  {
    pdf: 'public/pdfs/mat-00-matrizes.pdf',
    out: 'public/data/material-texts/mat-00-matrizes.txt',
    titulo: 'Matrizes — teoria e exemplos',
  },
  {
    pdf: 'public/pdfs/mat-01-matrizes.pdf',
    out: 'public/data/material-texts/mat-01-matrizes.txt',
    titulo: 'Matrizes — lista de exercícios',
  },
];

const DPI = 200; // legibilidade de sobra para símbolos (√, frações, índices)

function pdfPageCount(pdfPath: string): number {
  const out = execSync(`pdfinfo "${pdfPath}"`).toString();
  const m = out.match(/Pages:\s+(\d+)/);
  if (!m) throw new Error(`pdfinfo sem páginas: ${pdfPath}`);
  return Number(m[1]);
}

function renderPages(pdfPath: string): string[] {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  execSync(`pdftoppm -r ${DPI} -png "${pdfPath}" "${TMP}/pg"`);
  return execSync(`ls "${TMP}" | sort -V`)
    .toString()
    .trim()
    .split('\n')
    .filter((f) => f.endsWith('.png'))
    .map((f) => path.join(TMP, f));
}

/** Prompt de transcrição: FIDELIDADE máxima + notação linear inequívoca.
 *  Diferença chave do TRANSCRIBER_SYSTEM do tutor (LaTeX): aqui NÃO usamos
 *  LaTeX — o retrieval entrega texto puro ao tutor de texto, e LaTeX cru no
 *  material era um dos ruídos antigos. Pedimos a mesma notação que o professor
 *  escreve no chat: matrizes em linhas entre colchetes. */
export const TRANSCRIBE_PROMPT = `Você transcreve uma página de material de matemática (curso ADS/IFPB) para texto puro em português brasileiro, com fidelidade TOTAL — para uma IA ler e estudar depois.

REGRAS DE OURO:
1. Transcreva TUDO o que aparece: títulos, enunciados, definições, exemplos, alternativas, observações. NÃO invente, NÃO corrija, NÃO resolva, NÃO comente.
2. NOTAÇÃO LINEAR SEM AMBIGUIDADE (o texto será lido por IA SEM o desenho original):
   - Matriz/vetor: linhas entre colchetes duplos — M = [[3, 5, -1], [0, 4, 7]] é uma matriz 2×3. Escreva TODOS os elementos na ordem real linha por linha; NUNCA espalhe números soltos.
   - Vetor coluna: [[5], [1], [-3]] (3×1). Identidade 2×2: [[1, 0], [0, 1]].
   - Fração: a/b. Raiz: √2, √(x+1). Potência: a^n, x². Índice: a_ij, a_11, a_23.
   - Multiplicação: · ou ×. Aproximação: ≈. Pertence: ∈. Setas: →, ⇒.
   - Sistema de equações: uma equação por linha, precedido de "sistema:".
3. Se houver tabela, reproduza como linhas "célula | célula | célula".
4. Estruture a página na MESMA ordem visual; uma linha em branco entre blocos distintos.
5. NÃO use LaTeX (nada de \\frac, \\begin{pmatrix}, $...$). NÃO use markdown de cabeçalho (#). Prefixos de seção (ex.: "1. NOÇÃO DE MATRIZ") ficam como texto simples.
6. Comece direto na transcrição, sem preâmbulo, sem "Aqui está".

Transcreva a página inteira agora.`;

async function transcribePage(zai: any, pngPath: string): Promise<string> {
  const b64 = readFileSync(pngPath).toString('base64');
  const dataUrl = `data:image/png;base64,${b64}`;
  const completion = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: TRANSCRIBE_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  const text = (completion?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('resposta vazia da visão');
  return text;
}

async function main() {
  const mode = process.argv[2] ?? 'run';
  const dynamicImport = new Function("return import('z-ai-web-dev-sdk')") as () => Promise<any>;
  const ZAI = (await dynamicImport()).default;
  const zai = await ZAI.create();

  if (mode === 'probe') {
    const pdf = path.join(ROOT, process.argv[3]);
    const page = Number(process.argv[4] ?? 1);
    const pages = renderPages(pdf);
    console.log(`[probe] ${pages.length} páginas · transcrevendo p.${page}…`);
    const t0 = Date.now();
    const text = await transcribePage(zai, pages[page - 1]);
    console.log(`[probe] ok em ${((Date.now() - t0) / 1000).toFixed(1)}s · ${text.length} chars\n`);
    console.log(text.slice(0, 2600));
    return;
  }

  // run — os 4 materiais, página por página, com retentativa por página
  for (const t of TARGETS) {
    const pdfPath = path.join(ROOT, t.pdf);
    const pages = renderPages(pdfPath);
    console.log(`\n=== ${t.titulo} — ${pages.length} páginas ===`);
    const parts: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      let text = '';
      for (let tent = 1; tent <= 3 && !text; tent++) {
        try {
          text = await transcribePage(zai, pages[i]);
        } catch (err) {
          console.warn(
            `  p.${i + 1} tentativa ${tent} falhou: ${err instanceof Error ? err.message : err}`,
          );
          if (tent === 3) throw new Error(`página ${i + 1} esgotou retentativas`);
          await new Promise((r) => setTimeout(r, 1500 * tent));
        }
      }
      parts.push(`[página ${i + 1}]\n${text}`);
      console.log(`  p.${i + 1}/${pages.length} ok · ${text.length} chars`);
    }
    const outPath = path.join(ROOT, t.out);
    if (!existsSync(outPath)) throw new Error(`destino sumiu: ${outPath}`);
    const final = parts.join('\n\n');
    writeFileSync(outPath, final + '\n');
    console.log(`→ ${t.out} · ${final.length} chars`);
  }
  console.log('\nCONCLUÍDO — 4 textos de matemática reescritos por visão.');
}

main().catch((err) => {
  console.error('FALHOU:', err);
  process.exit(1);
});
