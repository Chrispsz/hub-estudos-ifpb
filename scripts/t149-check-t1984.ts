import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const msgs = await db.tutorMessage.findMany({
  where: { discipline: 'TEC.1984' },
  orderBy: { createdAt: 'asc' },
  select: { id: true, role: true, createdAt: true, content: true },
});
for (const m of msgs) console.log(m.createdAt.toISOString(), '|', m.role, '|', m.content.slice(0, 45).replace(/\n/g, ' '));
await db.$disconnect();
