import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
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

export async function getCurrentUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get('uid')?.value ?? null;
}

export async function getCurrentProfileId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get('pid')?.value ?? null;
}

export async function setAuthCookies(uid: string, pid: string) {
  const jar = await cookies();
  jar.set('uid', uid, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 });
  jar.set('pid', pid, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.set('uid', '', { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 0 });
  jar.set('pid', '', { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 0 });
}
