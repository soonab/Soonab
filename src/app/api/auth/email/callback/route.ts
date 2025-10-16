// src/app/api/auth/email/callback/route.ts
import { NextResponse } from 'next/server';
import { consumeMagicToken } from '@/lib/magic';
import { setAuthCookie } from '@/lib/auth';
import { ensureSidCookie, ensureUserAndProfile } from '@/lib/user';

function safePath(p?: string | null) {
  if (!p) return '/me';
  return p.startsWith('/') && !p.startsWith('//') ? p : '/me';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const redirect = safePath(url.searchParams.get('redirect'));

  const email = await consumeMagicToken(token);
  if (!email) {
    return NextResponse.redirect('/login?error=invalid_or_expired_magic_link');
  }

  // Ensure User + at least one Profile
  const user = await ensureUserAndProfile(email);

  // Keep anonymous sid continuity (if missing)
  await ensureSidCookie();

  // NEW: set signed JWT auth cookie (Step-8)
  await setAuthCookie(user.id);

  return NextResponse.redirect(redirect);
}
