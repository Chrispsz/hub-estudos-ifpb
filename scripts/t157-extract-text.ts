// t157 QA: extrai o texto REAL que o pdf.js vê em cada página da Lista de Lógica
import { join } from 'node:path';

const ROOT = '/home/z/my-project';
const pdfjs = await import('pdfjs-dist');
pdfjs.GlobalWorkerOptions.workerSrc = join(ROOT, 'public/pdf.worker.min.mjs');
// bun: worker precisa de path absoluto de arquivo
const task = pdfjs.getDocument({ url: 'file://' + join(ROOT, 'public/pdfs/mat-logica-lista.pdf') });
const doc = await task.promise;
console.log('páginas:', doc.numPages);
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  const text = tc.items.map((i) => (((i as any).str ?? '')) + ((i as any).hasEOL ? ' ' : '')).join('').replace(/\s+/g, ' ');
  console.log(`--- pág ${n} (${text.length} chars) ---`);
  console.log(text.slice(0, 700));
}

// Verificação da cura: importa pdfPageText e busca como a UI faz
const { pdfPageText, searchPdfPages } = await import(join(ROOT, 'src/lib/pdf-search.ts'));
const cured: string[] = [];
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  cured.push(pdfPageText(tc.items));
}
console.log('\n--- curado pág 1 (primeiros 500) ---');
console.log(cured[0].slice(0, 500));
for (const q of ['proposicoes', 'logico', 'logica', 'cintia', 'paraiba', 'tres', 'franco', 'escritorio', 'numero']) {
  const hits = searchPdfPages(cured, q);
  console.log(`"${q}": ${hits.length} hit(s) — págs ${hits.map(h => h.page).join(',') || '-'} | 1º: ${hits[0]?.segments.map(s => s.text).join('').slice(0, 60) || '-'}`);
}
