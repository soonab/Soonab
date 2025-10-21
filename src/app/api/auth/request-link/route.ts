// src/app/api/auth/request-link/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createMagicLink } from '@/lib/magic';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { limitRequest as limit } from '@/lib/ratelimit';
import { z } from '@/lib/zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RL = Number(process.env.RL_AUTH_REQUESTS_PER_MIN || 5);
const isProd = process.env.NODE_ENV === 'production';
const isBrowser = (req: NextRequest) => !!req.headers.get('origin');

/** GET ?email=you@example.com -> { ok, link } */
export async function GET(req: NextRequest) {
  // Browsers must be same‑origin; origin‑less (Node) allowed.
  if (isBrowser(req)) {
    const so = assertSameOrigin(req); if (so) return so;
  }

  const origin = req.nextUrl.origin;
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, usage: 'GET ?email=you@example.com or POST JSON {email}' },
      { status: 400 }
    );
  }

  const hit = limit(req, 'auth:request-link', RL, 60);
  if (!hit.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const token = await createMagicLink(email);
  return NextResponse.json({ ok: true, link: `${origin}/api/auth/callback?token=${encodeURIComponent(token)}` });
}

/** POST { email } -> { ok, link } */
export async function POST(req: NextRequest) {
  // Browsers: same‑origin + CSRF. Prod: CSRF even for origin‑less.
  if (isBrowser(req)) {
    const so = assertSameOrigin(req); if (so) return so;
    const cs = requireCsrf(req);      if (cs) return cs;
  } else if (isProd) {
    const cs = requireCsrf(req);      if (cs) return cs;
  }

  const hit = limit(req, 'auth:request-link', RL, 60);
  if (!hit.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const body = await requireJson<{ email: string }>(
    req,
    z.object({ email: z.string().min(3).max(254) })
  );
  const email = body.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const link = `${req.nextUrl.origin}/api/auth/callback?token=${encodeURIComponent(
    await createMagicLink(email)
  )}`;
  return NextResponse.json({ ok: true, link });
}
