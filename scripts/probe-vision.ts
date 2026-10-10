// probe-vision — valida o createVision do SDK Z-AI do sandbox: qual modelo
// entende uma imagem data-URL e transcreve o texto. Gera um PNG de teste com
// sharp (SVG → PNG) simulando um print de questão de matemática.
// Uso: bun scripts/probe-vision.ts

import sharp from 'sharp';

async function main() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420">
    <rect width="100%" height="100%" fill="white"/>
    <text x="40" y="110" font-size="34" fill="black">Calcule o produto A x B onde:</text>
    <text x="40" y="200" font-size="34" fill="black">A = [[2, 1], [1, 1]] e B = [[3, 0], [1, 2]]</text>
    <text x="40" y="310" font-size="34" fill="black">Questao 4 - Lista de Matrizes</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  console.log('imagem de teste:', (dataUrl.length / 1024).toFixed(1), 'KB');

  const dynamicImport = new Function("return import('z-ai-web-dev-sdk')") as () => Promise<any>;
  const mod = await dynamicImport();
  const ZAI = mod.default;
  const zai = await ZAI.create();

  const candidates = ['glm-4.5v', 'glm-4v-plus', undefined];
  for (const model of candidates) {
    const t0 = Date.now();
    try {
      const res = await zai.chat.completions.createVision({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcreva TODO o texto da imagem, em português, mantendo os números exatamente como estão.',
              },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      } as any);
      const content = res?.choices?.[0]?.message?.content ?? JSON.stringify(res).slice(0, 200);
      console.log(`\n=== model=${model} OK (${Date.now() - t0}ms) ===`);
      console.log(String(content).slice(0, 500));
    } catch (err) {
      console.log(`\n=== model=${model} FALHOU (${Date.now() - t0}ms):`, (err as Error).message);
    }
  }
}

main().catch((e) => {
  console.error('probe erro:', e);
  process.exit(1);
});
