import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const m = await db.tutorMessage.findFirst({ orderBy: { createdAt: 'desc' } });
console.log(m?.discipline, m?.role, '|', m?.content.slice(0, 80).replace(/\n/g, ' '));
await db.$disconnect();
