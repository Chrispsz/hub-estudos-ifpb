/**
 * t153 E2E seed — mesma doutrina da t147/t151: semeia conversa com PALAVRAS
 * ACENTUADAS numa disciplina SEM linhas reais (ING.001) para verificar ao
 * vivo a busca que dobra acentos ("logica" acha "Lógica"). ABORTA se a
 * disciplina já tiver linha; o varredor apaga tudo no fim.
 * Rodar: bun scripts/t153-e2e-seed.ts [--sweep]
 */
import { db } from '../src/lib/db';

const DISCIPLINE = 'ING.001';

async function main() {
  if (process.argv.includes('--sweep')) {
    const del = await db.tutorMessage.deleteMany({ where: { discipline: DISCIPLINE } });
    console.log(`VARRUDA: ${del.count} linha(s) apagada(s) de ${DISCIPLINE}.`);
    return;
  }
  const existing = await db.tutorMessage.count({ where: { discipline: DISCIPLINE } });
  if (existing !== 0) {
    console.log(`ABORT: ${DISCIPLINE} já tem ${existing} linha(s) — nada foi escrito.`);
    process.exit(1);
  }
  const rows = [
    { discipline: DISCIPLINE, role: 'user', content: 'QA t153 · o que é uma proposição lógica?' },
    { discipline: DISCIPLINE, role: 'assistant', content: 'QA t153 · Proposição é a frase que pode ser verdadeira ou falsa — é o átomo da Lógica.' },
    { discipline: DISCIPLINE, role: 'user', content: 'QA t153 · e a proporção entre lados?' },
    { discipline: DISCIPLINE, role: 'assistant', content: 'QA t153 · Proporção é a igualdade entre duas razões — a/b = c/d.' },
  ];
  for (const r of rows) {
    await db.tutorMessage.create({ data: r });
  }
  const total = await db.tutorMessage.count({ where: { discipline: DISCIPLINE } });
  console.log(`OK: ${total} linhas semeadas em ${DISCIPLINE} (proposição, Lógica, proporção).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERRO:', e);
    process.exit(1);
  });
