// src/lib/auth.ts
import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/db';

const AUTH_COOKIE = 'auth';
const AUTH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev_secret');

function isProd() {
  return process.env.NODE_ENV === 'production';
}

/** Set signed auth cookie for the given user id */
export async function setAuthCookie(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TTL_SECONDS}s`)
    .sign(secret);

  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_TTL_SECONDS,
  });
}

/** Clear the auth cookie */
export async function clearAuthCookie() {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, '', {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/** Read current authed user id from JWT cookie */
export async function getAuthedUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return typeof payload.uid === 'string' ? payload.uid : null;
  } catch {
    return null;
  }
}

/** Map current user -> their first profile id (or null if signed out) */
export async function getCurrentProfileId(): Promise<string | null> {
  const uid = await getAuthedUserId();
  if (!uid) return null;
  const prof = await prisma.profile.findFirst({
    where: { userId: uid },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return prof?.id ?? null;
}

/** Convenience for logging (ASYNC: remember to `await getClientIpAndUA()`) */
export async function getClientIpAndUA() {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    null;
  const ua = h.get('user-agent') || null;
  return { ip: ip ?? undefined, ua: ua ?? undefined };
}

/* ========= Temporary compatibility shim (optional) =========
   If you still have code that imports the old names (uid/pid),
   these wrappers keep things compiling until you update routes. */

export async function getCurrentUserId(): Promise<string | null> {
  return getAuthedUserId();
}

// setAuthCookies(uid, pid) -> set JWT (ignores pid; profile id is derived on read)
export async function setAuthCookies(uid: string, _pid: string) {
  await setAuthCookie(uid);
}

// old name kept for compatibility
export async function clearAuthCookies() {
  await clearAuthCookie();
}
