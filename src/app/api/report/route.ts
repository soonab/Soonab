// src/app/api/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { limitRequest } from '@/lib/ratelimit';

const RL_REPORTS = Number(process.env.RL_REPORTS_PER_MIN || 10);

export async function POST(req: NextRequest) {
  assertSameOrigin(req);
  const hit = limitRequest(req, 'report:create', RL_REPORTS, 60);
  if (!hit.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const payload = await requireJson<{ targetType: 'POST'|'REPLY'; targetId: string; reason?: string }>(req);

  const targetType = String(payload?.targetType || '');
  const targetId = String(payload?.targetId || '');
  const reason = payload?.reason ? String(payload.reason) : null;

  if (!['POST','REPLY'].includes(targetType) || !targetId) {
    return NextResponse.json({ ok:false, error:'Bad request' }, { status:400 });
  }

  const jar = await cookies();
  let sid = jar.get('sid')?.value as string | undefined;
  let setCookie = false;
  if (!sid) { sid = randomUUID(); setCookie = true; }

  await prisma.moderationReport.create({
    data: { sessionId: sid, targetType: targetType as 'POST'|'REPLY', targetId, reason },
  });

  const res = NextResponse.json({ ok:true });
  if (setCookie) {
    res.cookies.set('sid', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
