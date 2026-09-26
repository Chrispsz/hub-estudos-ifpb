// Task 47 — higiene: apaga mensagens de teste do tutor (janela de tempo + disciplina).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const janela = {
    discipline: 'TEC.1984',
    createdAt: {
      gte: new Date('2026-09-26T18:50:00.000Z'),
      lte: new Date('2026-09-26T19:59:59.000Z'),
    },
  };
  const del = await prisma.tutorMessage.deleteMany({ where: janela });
  console.log(`Apagadas ${del.count} mensagens de teste (TEC.1984, janela 18:50–19:59Z).`);
  const rest = await prisma.tutorMessage.count();
  console.log(`Restantes no DB: ${rest}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
