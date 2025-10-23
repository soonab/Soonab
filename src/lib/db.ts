// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

// Create a global holder to reuse the Prisma client in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// In development, reuse the same instance across hot reloads
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
