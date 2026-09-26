// qa49-clean.ts — apaga as mensagens de teste do readiness (dev DB)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.tutorMessage.findMany({
    where: { discipline: 'TEC.1984' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('Últimas 10 em TEC.1984:');
  for (const m of msgs) {
    console.log('-', m.id, m.role, m.createdAt.toISOString(), JSON.stringify(m.content.slice(0, 70)));
  }
  const alvo = msgs.filter(
    (m) =>
      m.content.includes('SCORE DE PRONTIDÃO') ||
      m.content.includes('pesa contra a minha prontidão') ||
      m.content.includes('maior problema') ||
      m.content.includes('prontidão agora'),
  );
  if (alvo.length === 0) {
    console.log('Nada a apagar.');
    return;
  }
  const ids = alvo.map((m) => m.id);
  const res = await prisma.tutorMessage.deleteMany({ where: { id: { in: ids } } });
  console.log(`Apagadas: ${res.count} (${ids.join(', ')})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
