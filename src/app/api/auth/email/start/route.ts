// src/app/api/auth/email/start/route.ts
import { NextResponse } from 'next/server';
import { createMagicLink } from '@/lib/magic';

function safePath(p?: string | null) {
  if (!p) return '/me';
  return p.startsWith('/') && !p.startsWith('//') ? p : '/me';
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email || '').toString().trim();
  const redirect = safePath(body.redirect);

  if (!email) {
    return NextResponse.json({ ok: false, error: 'missing_email' }, { status: 400 });
  }

  const token = await createMagicLink(email);

  // TODO: send email with link. For local testing you can log it:
  // e.g. http://localhost:3000/api/auth/email/callback?token=...&redirect=/me
  const link = new URL(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/email/callback`);
  link.searchParams.set('token', token);
  link.searchParams.set('redirect', redirect);

  // Replace this with your mailer
  if (process.env.NODE_ENV !== 'production') {
    console.log('Magic link:', link.toString());
  }

  return NextResponse.json({ ok: true });
}
