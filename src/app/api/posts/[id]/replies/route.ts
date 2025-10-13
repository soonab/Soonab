import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { Visibility } from '@prisma/client';
import { canCreateReply } from '@/lib/limits';
import { ensureSessionProfile } from '@/lib/identity';
import { getCurrentProfileId } from '@/lib/auth';
import { hasActivePostingPenalty } from '@/lib/moderation';

const REPLY_MAX = 500;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // ✅ Next 15
) {
  const { id: postId } = await ctx.params;

  const parent = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, state: true },
  });
  if (!parent) return NextResponse.json({ ok: false, error: 'Post not found' }, { status: 404 });
  if (parent.state !== 'ACTIVE') {
    return NextResponse.json({ ok: false, error: 'Cannot reply to a non-active post' }, { status: 400 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const body = (payload?.body ?? '').toString().trim();
  if (!body) return NextResponse.json({ ok: false, error: 'Body is required' }, { status: 400 });
  if (body.length > REPLY_MAX) return NextResponse.json({ ok: false, error: `Too long (max ${REPLY_MAX})` }, { status: 400 });

  const jar = await cookies();
  let sid = jar.get('sid')?.value;
  let setCookie = false;
  if (!sid) { sid = randomUUID(); setCookie = true; }

  await ensureSessionProfile(sid);
  const profileId = await getCurrentProfileId(); // may be null

  // Quota gate
  const gate = await canCreateReply(sid, profileId, postId);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 429 });

  // Moderation gate: block if profile has an active posting penalty
  if (await hasActivePostingPenalty(profileId)) {
    return NextResponse.json({ ok: false, error: 'Posting disabled by moderation' }, { status: 403 });
  }

  // Replies are PUBLIC-only for now
  const created = await prisma.reply.create({
    data: { postId, sessionId: sid, profileId, body, visibility: Visibility.PUBLIC },
  });

  const res = NextResponse.json({ ok: true, reply: created, quota: gate.quota ?? null });
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
