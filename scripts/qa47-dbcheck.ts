// Lista mensagens recentes do tutor no DB local (QA Task 47 — verificação + higiene).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.tutorMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  console.log(`Total (últimas ${msgs.length}):`);
  for (const m of msgs) {
    console.log(
      `[${m.createdAt.toISOString()}] [${m.role}] [${m.discipline}] ${m.content.slice(0, 70).replace(/\n/g, ' ')}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
