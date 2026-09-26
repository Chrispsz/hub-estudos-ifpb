import { extractTutorCards } from '../src/lib/tutor-cards';

const cases: Array<[string, string, number, ((c: {front:string;back:string}[]) => boolean)?]> = [
  ['T1 padrão', 'CARTÃO DO BARALHO\nFRENTE: Quando uma matriz não tem inversa?\nVERSO: Quando det(A) = 0. Confira sempre A·A⁻¹ = I.', 1, (c)=>c[0].front.includes('inversa')],
  ['T2 negrito', '**CARTÃO 2**\n**FRENTE:** O que é tautologia?\n**VERSO:** Proposição sempre verdadeira em todas as valorações.', 1],
  ['T3/T7 prosa', 'Analise a frente: o jogo começou mal e o verso: da folha ficou confuso.', 0],
  ['T5 órfão', 'FRENTE: pergunta órfã sem nenhum verso por aqui', 0],
  ['T6 dois cartões', 'CARTÃO 1\nFRENTE: O que é matriz transposta?\nVERSO: Troca linhas por colunas.\nCARTÃO 2\nFRENTE: Quando det(A)=0 implica o quê?\nVERSO: A matriz não é inversível.', 2, (c)=>c[0].back.startsWith('Troca') && c[1].back.includes('inversível')],
  ['T8 verso multiline', 'FRENTE: Quais os casos de equivalência lógica?\nVERSO: De Morgan troca ∧ por ∨ negando cada parte.\nA dupla negação devolve a original.\n\nDepois do cartão: prosa livre que não é verso.', 1, (c)=>c[0].back.includes('Morgan') && !c[0].back.includes('prosa')],
  ['T9 JSON fallback', 'Segue:\n```json\n[{"front":"O que é matriz simétrica?","back":"A = Aᵗ."},{"front":"Defina implicação.","back":"P→Q só é falsa quando P verdadeira e Q falsa."}]\n```', 2],
  ['T10 trailing prosa colada', 'CARTÃO DO BARALHO\nFRENTE: Defina matriz inversa.\nVERSO: B tal que A·B = I.\n\nEspero que ajude! Qualquer coisa me chame de novo sobre matrizes.', 1, (c)=>!c[0].back.includes('chame')],
];

let pass = 0;
for (const [name, input, expected, check] of cases) {
  const got = extractTutorCards(input);
  const ok = got.length === expected && (!check || check(got));
  if (ok) pass += 1;
  console.log(`${name}: ${ok ? 'OK' : 'FAIL'} (${got.length}/${expected}) ${ok ? '' : JSON.stringify(got)}`);
}
console.log(`${pass}/${cases.length} passou`);
