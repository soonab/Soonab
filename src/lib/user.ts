// src/lib/user.ts
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export async function ensureSidCookie() {
  const jar = await cookies();
  if (!jar.get('sid')) {
    const { randomUUID } = await import('crypto');
    jar.set('sid', randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
}

export async function ensureUserAndProfile(email: string) {
  const normalized = email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) user = await prisma.user.create({ data: { email: normalized } });

  const count = await prisma.profile.count({ where: { userId: user.id } });
  if (count === 0) {
    // derive a simple handle from email localpart (always a string)
    const at = normalized.indexOf('@');
    const local = at > 0 ? normalized.slice(0, at) : normalized;
    const base = local.toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 20) || 'user';

    let handle = base;
    let i = 1;
    while (await prisma.profile.findUnique({ where: { handle } })) {
      handle = `${base}${i++}`;
    }
    await prisma.profile.create({ data: { userId: user.id, handle } });
  }
  return user;
}
