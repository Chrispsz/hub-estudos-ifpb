import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const msgs = await db.tutorMessage.findMany({ where: { discipline: 'ALG' }, orderBy: { createdAt: 'desc' }, take: 4, select: { role: true, content: true } });
for (const m of msgs) console.log(m.role, '|', m.content.slice(0, 55).replace(/\n/g, ' '));
await db.$disconnect();
