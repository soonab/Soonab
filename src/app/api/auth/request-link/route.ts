// src/app/api/auth/request-link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createMagicLink } from '@/lib/magic';
import { assertSameOrigin, requireJson } from '@/lib/security'; // ← correct
import { limitRequest as limit } from '@/lib/ratelimit';          // ← correct

const RL = Number(process.env.RL_AUTH_REQUESTS_PER_MIN || 5);

// GET /api/auth/request-link?email=you@example.com
export async function GET(req: NextRequest) {
  assertSameOrigin(req);

  const origin = req.nextUrl.origin;
  const email = (req.nextUrl.searchParams.get('email') || '')
    .trim()
    .toLowerCase();

  if (!email) {
    return NextResponse.json(
      { ok: false, usage: 'GET ?email=you@example.com or POST JSON {email}' },
      { status: 400 }
    );
  }

  // throttle requests
  const hit = limit(req, 'auth:request-link', RL, 60);
  if (!hit.ok) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const token = await createMagicLink(email);
  const link = `${origin}/api/auth/callback?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ ok: true, link });
}

// POST /api/auth/request-link  { "email": "you@example.com" }
export async function POST(req: NextRequest) {
  assertSameOrigin(req);

  // throttle requests
  const hit = limit(req, 'auth:request-link', RL, 60);
  if (!hit.ok) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const body = await requireJson<{ email: string }>(req);
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
  }

  const link = `${req.nextUrl.origin}/api/auth/callback?token=${encodeURIComponent(
    await createMagicLink(email)
  )}`;

  return NextResponse.json({ ok: true, link });
}
