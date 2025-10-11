import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { ReportTarget } from '@prisma/client';

export async function POST(req: NextRequest) {
  let payload: any;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const targetType = (payload?.targetType ?? '').toString().toUpperCase();
  const targetId = (payload?.targetId ?? '').toString();
  const reason = (payload?.reason ?? '').toString().slice(0, 500) || null;

  if (!['POST', 'REPLY'].includes(targetType) || !targetId) {
    return NextResponse.json({ ok: false, error: 'targetType (POST|REPLY) and targetId are required' }, { status: 400 });
  }

  if (targetType === 'POST') {
    const ok = await prisma.post.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!ok) return NextResponse.json({ ok: false, error: 'Post not found' }, { status: 404 });
  } else {
    const ok = await prisma.reply.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!ok) return NextResponse.json({ ok: false, error: 'Reply not found' }, { status: 404 });
  }

  const jar = cookies();
  let sid = jar.get('sid')?.value;
  if (!sid) sid = randomUUID();

  const created = await prisma.moderationReport.create({
    data: { sessionId: sid, targetType: targetType as ReportTarget, targetId, reason },
  });

  const res = NextResponse.json({ ok: true, report: { id: created.id } });
  res.cookies.set('sid', sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
