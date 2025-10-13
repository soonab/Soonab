import { NextRequest, NextResponse } from 'next/server';
import { createMagicLink } from '@/lib/auth';

// GET /api/auth/request-link?email=you@example.com
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  const origin = req.nextUrl.origin;

  if (!email) {
    return NextResponse.json({
      ok: false,
      usage: 'POST JSON { "email": "you@example.com" } or GET ?email=you@example.com',
      example: `${origin}/api/auth/request-link?email=you@example.com`,
    });
  }

  const token = await createMagicLink(email);
  const link = `${origin}/api/auth/callback?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ ok: true, link });
}

// POST /api/auth/request-link  { "email": "you@example.com" }
export async function POST(req: NextRequest) {
  let email = '';
  try {
    const body = await req.json();
    email = String(body.email || '').trim().toLowerCase();
  } catch {
    // fall through
  }
  if (!email) {
    return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
  }
  const token = await createMagicLink(email);
  const link = `${req.nextUrl.origin}/api/auth/callback?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ ok: true, link });
}
