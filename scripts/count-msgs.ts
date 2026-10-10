import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const g = await db.tutorMessage.groupBy({ by: ['discipline'], _count: { id: true } });
console.log(JSON.stringify(g));
await db.$disconnect();
