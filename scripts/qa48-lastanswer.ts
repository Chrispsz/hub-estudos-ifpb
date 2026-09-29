// Task 48 — mostra a resposta completa do coach semanal (qualidade da IA).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.tutorMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1,
    where: { role: 'assistant' },
  });
  const m = msgs[0];
  if (!m) return console.log('nada');
  console.log(`[${m.discipline}] ${m.model ?? ''}\n---\n${m.content.slice(0, 1400)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
