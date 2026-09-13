import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaBootstrap?: Promise<void>
}

/**
 * Schema da memória do tutor, criado de forma idempotente na 1ª conexão.
 * Faz o histórico funcionar em QUALQUER SQLite sem migração manual:
 * clone local novo, volume persistente ou /tmp efêmero da Vercel —
 * basta apontar DATABASE_URL. (Espelha prisma/schema.prisma.)
 */
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS "TutorMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "discipline" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "model" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TutorMessage_discipline_createdAt_idx"
  ON "TutorMessage"("discipline", "createdAt");
`;

/** Construção + bootstrap acontecem na 1ª query real (preguiçoso). */
function ensureClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = new PrismaClient({ log: ['query'] });
    globalForPrisma.prisma = client;
    if (!globalForPrisma.prismaBootstrap) {
      // fire-and-forget: cria as tabelas se faltarem; erros são silenciosos
      // porque cada rota já degrada com try/catch (memória = melhor esforço)
      globalForPrisma.prismaBootstrap = client
        .$executeRawUnsafe(BOOTSTRAP_SQL)
        .then(() => undefined)
        .catch(() => undefined);
    }
  }
  return globalForPrisma.prisma;
}

/**
 * Cliente Prisma PREGUIÇOSO.
 *
 * `new PrismaClient()` valida DATABASE_URL e LANÇA na construção — se isso
 * acontecesse no import (padrão antigo), um ambiente sem env de banco
 * (ex.: deploy Vercel sem DATABASE_URL) derrubaria TODAS as rotas que
 * importam `db` na coleta de páginas, incluindo o tutor inteiro. Com o
 * Proxy, o tutor segue respondendo e a memória degrada com elegância.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = ensureClient();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
