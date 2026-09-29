// Limpeza QA Task 46 — restaura perfil do browser QA e apaga mensagens de teste do DB local.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Janela das mensagens de teste da Task 46 (rodada 02:30 +08 → 18:30Z, disciplina TEC.1984)
  const since = new Date('2026-09-26T18:30:00.000Z');
  const until = new Date('2026-09-26T19:10:00.000Z');
  const msgs = await prisma.tutorMessage.findMany({
    where: { discipline: 'TEC.1984', createdAt: { gte: since, lte: until } },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`TutorMessage TEC.1984 na janela: ${msgs.length}`);
  for (const m of msgs) {
    console.log(`  - [${m.role}] ${m.content.slice(0, 70).replace(/\n/g, ' ')}`);
  }
  if (msgs.length > 0) {
    const ids = msgs.map((m) => m.id);
    const del = await prisma.tutorMessage.deleteMany({ where: { id: { in: ids } } });
    console.log(`Apagadas: ${del.count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
