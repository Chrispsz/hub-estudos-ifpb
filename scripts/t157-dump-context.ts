// t157 QA: contexto de cada char mojibake (para derivar a cura certa)
import { join } from 'node:path';

const ROOT = '/home/z/my-project';
const pdfjs = await import('pdfjs-dist');
pdfjs.GlobalWorkerOptions.workerSrc = join(ROOT, 'public/pdf.worker.min.mjs');
const task = pdfjs.getDocument({ url: 'file://' + join(ROOT, 'public/pdfs/mat-logica-lista.pdf') });
const doc = await task.promise;
const TARGETS = ['È', '„', 'Á', 'ı', '·', 'Û', 'Ì', 'Í', '”', '“', '˙', '√', '«', 'é', 'ç', '¡', '¿', 'Ù', 'Õ', '‚', 'Â', '√'];
const seen = new Map<string, Set<string>>();
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  const text = tc.items.map((i) => (((i as any).str ?? ''))).join('');
  for (const ch of TARGETS) {
    let at = text.indexOf(ch);
    while (at >= 0) {
      const ctx = text.slice(Math.max(0, at - 18), at + 19).replace(/\s+/g, ' ');
      if (!seen.has(ch)) seen.set(ch, new Set());
      seen.get(ch)!.add(ctx);
      at = text.indexOf(ch, at + 1);
    }
  }
}
for (const [ch, ctxs] of seen) {
  console.log(`\n=== '${ch}' (${[...ctxs].length} contextos) ===`);
  for (const c of [...ctxs].slice(0, 6)) console.log('  …' + c + '…');
}
