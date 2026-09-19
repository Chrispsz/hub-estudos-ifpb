// One-shot: retrieval do artigo de teletrabalho (RHT)
import { findMaterial, buildMaterialBlock } from '/home/z/my-project/src/lib/material-retrieval';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) pass++; else { fail++; console.log(`✗ ${name} ${extra}`); }
};

const mat = findMaterial('rht-teletrabalho-serpro');
ok('material encontrado por id', !!mat, JSON.stringify(mat?.title));
ok('título correto', mat?.title.includes('Teletrabalho no Serpro') ?? false);

const perguntas: [string, string[]][] = [
  ['quais os pontos negativos do teletrabalho segundo as chefias?', ['Dificuldades técnicas', '35,90', 'firewall']],
  ['o que o artigo diz sobre preconceito e desconfiança?', ['Preconceito', '21,70', 'verificar']],
  ['qual o método de pesquisa do artigo?', ['Iramuteq', 'estudo de caso', 'Mann-Whitney']],
  ['o que é o Projeto-Lar do Serpro?', ['Projeto-Lar', '1985', 'disquetes']],
];

for (const [q, needles] of perguntas) {
  const block = await buildMaterialBlock(mat!, q);
  for (const n of needles) {
    ok(`"${q.slice(0, 30)}…" contém "${n}"`, block.toLowerCase().includes(n.toLowerCase()), `(${block.length} chars)`);
  }
  ok(`bloco tamanho razoável (${block.length})`, block.length > 800 && block.length < 9000);
}

console.log(`\nResultado: ${pass} passou, ${fail} falhou`);
process.exit(fail ? 1 : 0);
