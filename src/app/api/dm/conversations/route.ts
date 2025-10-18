// src/app/api/dm/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { rateLimit } from '@/lib/ratelimit';
import { z } from 'zod';
import {
  conversationSummaryInclude,
  hasTrustOrFollowEdge,
  normalizeMemberIds,
} from '@/lib/dm';

const createSchema = z.object({
  targetHandle: z.string().max(64),
  targetId: z.string().max(200),
});

export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ memberAId: profileId }, { memberBId: profileId }] },
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    take: 100,
    include: conversationSummaryInclude,
  });

  return NextResponse.json({ ok: true, conversations });
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'CSRF validation failed' }, { status: 403 });
  }

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const hit = rateLimit('dm:create', profileId, 3, 600);
  if (!hit.ok) {
    const res = NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    if (hit.retryAfter !== undefined) {
      res.headers.set('Retry-After', String(hit.retryAfter));
    }
    return res;
  }

  let payload: unknown;
  try {
    payload = await requireJson(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse({
    targetHandle:
      typeof (payload as any)?.targetHandle === 'string'
        ? ((payload as any).targetHandle as string).trim().toLowerCase()
        : '',
    targetId:
      typeof (payload as any)?.targetId === 'string'
        ? ((payload as any).targetId as string).trim()
        : '',
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const { targetHandle, targetId } = parsed.data;
  if (!targetHandle && !targetId) {
    return NextResponse.json({ ok: false, error: 'target required' }, { status: 400 });
  }

  const targetProfile = targetId
    ? await prisma.profile.findUnique({ where: { id: targetId } })
    : await prisma.profile.findUnique({ where: { handle: targetHandle } });

  if (!targetProfile) {
    return NextResponse.json({ ok: false, error: 'Target not found' }, { status: 404 });
  }
  if (targetProfile.id === profileId) {
    return NextResponse.json({ ok: false, error: 'Cannot message yourself' }, { status: 400 });
  }

  const allowed = await hasTrustOrFollowEdge(profileId, targetProfile.id);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'DMs are limited to Trusted or Followers' }, { status: 403 });
  }

  const pair = normalizeMemberIds(profileId, targetProfile.id);

  const existing = await prisma.conversation.findUnique({
    where: { memberAId_memberBId: pair },
    include: conversationSummaryInclude,
  });
  if (existing) {
    return NextResponse.json({ ok: true, conversation: existing });
  }

  const created = await prisma.conversation.create({
    data: {
      ...pair,
      createdById: profileId,
      status: 'PENDING',
      lastMessageAt: new Date(),
    },
    include: conversationSummaryInclude,
  });

  return NextResponse.json({ ok: true, conversation: created });
}
