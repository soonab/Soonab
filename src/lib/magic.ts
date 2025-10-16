// src/lib/magic.ts
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';

function tokenString(len = 32) {
  return randomBytes(len).toString('hex');
}

export async function createMagicLink(email: string) {
  const token = tokenString(16);
  const expiresAt = new Date(Date.now() + 15 * 60_000); // 15 minutes
  await prisma.magicLinkToken.create({ data: { email: email.toLowerCase(), token, expiresAt } });
  return token;
}

export async function consumeMagicToken(token: string) {
  const rec = await prisma.magicLinkToken.findUnique({ where: { token } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return null;
  await prisma.magicLinkToken.update({ where: { token }, data: { usedAt: new Date() } });
  return rec.email.toLowerCase();
}
