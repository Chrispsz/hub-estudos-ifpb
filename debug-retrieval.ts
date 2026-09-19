import { keywordsOf, keywordsOf as _k } from '/home/z/my-project/src/lib/material-retrieval';
import { promises as fs } from 'fs';

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function chunkText(text: string): string[] {
  const ps = text.split(/\n\n+/); const chunks: string[] = []; let cur = '';
  for (const p of ps) {
    if (p.length > 1400) { if (cur) { chunks.push(cur.trim()); cur=''; }
      for (let i=0;i<p.length;i+=1400) chunks.push(p.slice(i,i+1400)); continue; }
    if (cur.length + p.length + 2 > 1400) { chunks.push(cur.trim()); cur = p; }
    else cur += (cur ? '\n\n' : '') + p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}
function score(chunk: string, kws: string[], cn: string): number {
  let score=0, found=0;
  for (const kw of kws) { let idx=cn.indexOf(kw); if(idx===-1) continue; found++;
    let hits=0; while(idx!==-1&&hits<4){hits++; idx=cn.indexOf(kw, idx+kw.length);}
    score += hits*Math.min(kw.length,10); }
  score += (found/kws.length)*40;
  return score;
}
const text = await fs.readFile('public/data/material-texts/rht-teletrabalho-serpro.txt','utf8');
for (const q of ['quais os pontos negativos do teletrabalho segundo as chefias?', 'qual o método de pesquisa do artigo?']) {
  const kws = keywordsOf(q);
  const chunks = chunkText(text);
  const scored = chunks.map((c,i)=>({i, s: score(c,kws,normalize(c)), c})).sort((a,b)=>b.s-a.s);
  console.log(`\n### ${q}\nkw: ${kws.join(', ')}`);
  for (const {i,s,c} of scored.slice(0,4)) console.log(`  [${i}] score=${s.toFixed(1)} | ${c.slice(0,90).replace(/\n/g,' ')}`);
  // onde estão as agulhas?
  for (const n of (q.includes('chefias') ? ['35,90'] : ['Iramuteq'])) {
    const ci = chunks.findIndex(c=>c.includes(n));
    const cs = scored.find(x=>x.i===ci);
    console.log(`  agulha "${n}" no chunk ${ci}, score=${cs?.s.toFixed(1)} (pos ${scored.findIndex(x=>x.i===ci)+1}º)`);
  }
}
