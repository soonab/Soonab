import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

export async function POST(req: NextRequest) {
  assertSameOrigin(req);
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
