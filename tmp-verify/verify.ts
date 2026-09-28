// Verificação rápida: o retrieval serve o TEXTO LIMPO e acha a questão pedida.
import { buildMaterialBlock, findMaterial, questionNumberHint } from '../src/lib/material-retrieval';

const mat = findMaterial('mat-01-matrizes')!;
console.log('material:', mat.title);
console.log('hint questão 3:', questionNumberHint('Me ajuda com a questão 3 da lista'));
const block = await buildMaterialBlock(mat, 'Me ajuda com a questão 3 da lista de matrizes');
console.log('tamanho do bloco:', block.length);
console.log('tem LaTeX pmatrix?', block.includes('pmatrix'));
console.log('tem a_{ij}?', block.includes('a_{ij}') || block.includes('a_{ij'));
console.log('tem [página N]?', /\[página \d+\]/.test(block));
const i = block.indexOf('3-');
console.log('--- trecho da questão 3 ---');
console.log(block.slice(Math.max(0, i - 40), i + 260));
