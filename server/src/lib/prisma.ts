import { PrismaClient } from '@prisma/client';

// Standard singleton pattern — without this, `tsx watch`'s hot-reload in
// dev creates a new PrismaClient (and new DB connection pool) on every
// file save, eventually exhausting Postgres's max_connections.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
