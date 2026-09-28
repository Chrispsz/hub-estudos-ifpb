import { buildMaterialBlock, findMaterial, questionNumberHint } from '@/lib/material-retrieval';
const mat = findMaterial('mat-01-matrizes')!;
console.log('hint q3:', questionNumberHint('Me ajuda com a questão 3 da lista'));
const block = await buildMaterialBlock(mat, 'Me ajuda com a questão 3 da lista de matrizes');
console.log('bloco:', block.length, 'chars | [[matriz]]?', block.includes('[[x+y, 2]'), '| página?', /\[página \d+\]|<!-- página/.test(block));
const i = block.indexOf('3-');
console.log(block.slice(Math.max(0, i - 60), i + 200));
