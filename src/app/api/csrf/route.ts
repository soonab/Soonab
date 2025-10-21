// CSRF token issuer (double‑submit cookie pattern)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

export async function GET() {
  const token = crypto.randomBytes(32).toString('base64url');

  const res = NextResponse.json({ ok: true, token });
  // Cookie is httpOnly so JS can't read it; header must echo it back.
  res.cookies.set({
    name: 'csrf',
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });

  return res;
}
