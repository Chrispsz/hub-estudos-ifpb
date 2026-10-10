// qa50-clean.ts — apaga as mensagens de teste do "Do erro ao cartão" (dev DB)
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
    console.log('-', m.id, m.role, m.createdAt.toISOString(), JSON.stringify(m.content.slice(0, 60)));
  }
  // A pergunta do QA contém o pedido de cartão; a resposta termina com o cartão.
  const alvo = msgs.filter(
    (m) =>
      m.content.includes('CARTÃO DO BARALHO') ||
      m.content.includes('FRENTE:') ||
      m.content.includes('caderno de erros do Hub tem um ponto que eu errei no simulado'),
  );
  if (alvo.length === 0) {
    console.log('Nada a apagar.');
    return;
  }
  const ids = alvo.map((m) => m.id);
  const res = await prisma.tutorMessage.deleteMany({ where: { id: { in: ids } } });
  console.log(`Apagadas: ${res.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
