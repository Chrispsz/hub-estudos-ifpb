/**
 * t151 E2E seed — semeia um histórico BACKDATED numa disciplina SEM linhas
 * reais (ING.001), para ver o calendário do fio ao vivo. Regra da casa
 * (t147): a memória do aluno é sagrada — o script ABORTA se a disciplina
 * já tiver qualquer linha, e o varredor apaga tudo no fim.
 * Rodar: bun scripts/t151-e2e-seed.ts
 */
import { db } from '../src/lib/db';

const DISCIPLINE = 'ING.001';

async function main() {
  const existing = await db.tutorMessage.count({ where: { discipline: DISCIPLINE } });
  if (existing !== 0) {
    console.log(`ABORT: ${DISCIPLINE} já tem ${existing} linha(s) — nada foi escrito.`);
    process.exit(1);
  }
  const now = Date.now();
  const at = (daysAgo: number, h: number, min: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, min, 0, 0);
    return d;
  };
  const rows = [
    // 5 dias atrás — a conversa mais antiga (vira chip dd/mm)
    { discipline: DISCIPLINE, role: 'user', content: 'QA t151 · como se diz bug em inglês?', createdAt: at(5, 10, 30) },
    { discipline: DISCIPLINE, role: 'assistant', content: 'QA t151 · "bug" também é bug — e "defeito" é flaw. O antivírus detecta o vírus (detecta).', createdAt: at(5, 10, 31) },
    // ontem — vira chip "Ontem"
    { discipline: DISCIPLINE, role: 'user', content: 'QA t151 · qual a diferença entre browser e search engine?', createdAt: at(1, 15, 0) },
    { discipline: DISCIPLINE, role: 'assistant', content: 'QA t151 · browser é o programa (Chrome); search engine é o serviço (Google). Ontem isso caiu em aula.', createdAt: at(1, 15, 1) },
    // hoje — vira chip "Hoje" no meio do fio restaurado
    { discipline: DISCIPLINE, role: 'user', content: 'QA t151 · traduz "eu configurei o ambiente"?', createdAt: at(0, 9, 0) },
    { discipline: DISCIPLINE, role: 'assistant', content: 'QA t151 · "I set up the environment" — setup é o substantivo, set up é o verbo.', createdAt: at(0, 9, 1) },
  ];
  for (const r of rows) {
    await db.tutorMessage.create({ data: r });
  }
  const total = await db.tutorMessage.count({ where: { discipline: DISCIPLINE } });
  console.log(`OK: ${total} linhas semeadas em ${DISCIPLINE} (5d · 1d · hoje).`);
}

main()
  .catch((e) => {
    console.error('ERRO:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
