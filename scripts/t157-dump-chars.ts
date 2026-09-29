// t157 QA: dump dos chars não-ASCII extraídos (para a tabela de cura mojibake)
import { join } from 'node:path';

const ROOT = '/home/z/my-project';
const pdfjs = await import('pdfjs-dist');
pdfjs.GlobalWorkerOptions.workerSrc = join(ROOT, 'public/pdf.worker.min.mjs');
const task = pdfjs.getDocument({ url: 'file://' + join(ROOT, 'public/pdfs/mat-logica-lista.pdf') });
const doc = await task.promise;
const counts = new Map<string, number>();
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  const text = tc.items.map((i) => (((i as any).str ?? ''))).join('');
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp > 127) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
for (const [ch, c] of sorted) {
  console.log(`U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} '${ch}' ×${c}`);
}
