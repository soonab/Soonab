// src/app/api/dm/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { conversationSummaryInclude, findConversationForParticipant } from '@/lib/dm';
import { rateLimit } from '@/lib/ratelimit';
import { z } from 'zod';

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
});

const messageInclude = {
  sender: { select: { id: true, handle: true, displayName: true } },
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const conversation = await findConversationForParticipant(id, profileId);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 });
  }

  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 50));
  const cursor = req.nextUrl.searchParams.get('cursor') || undefined;

  let messages;
  try {
    messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      include: messageInclude,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid cursor' }, { status: 400 });
  }

  const nextCursor = messages.length === limit ? messages[messages.length - 1]!.id : null;

  return NextResponse.json({ ok: true, conversation, messages, nextCursor });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'CSRF validation failed' }, { status: 403 });
  }

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const hit = rateLimit('dm:send', profileId, 15, 60);
  if (!hit.ok) {
    const res = NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    if (hit.retryAfter !== undefined) {
      res.headers.set('Retry-After', String(hit.retryAfter));
    }
    return res;
  }

  const { id } = await ctx.params;
  const conversation = await findConversationForParticipant(id, profileId);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 });
  }

  if (conversation.status !== 'ACTIVE') {
    return NextResponse.json({ ok: false, error: 'Conversation not active' }, { status: 403 });
  }

  const blocked = await prisma.dMBlock.findFirst({
    where: { conversationId: id, blockedId: profileId },
  });
  if (blocked) {
    return NextResponse.json({ ok: false, error: 'You are blocked in this conversation' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await requireJson(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Body is required' }, { status: 400 });
  }

  const raw = parsed.data.body;
  const body = raw.trim();
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Body is required' }, { status: 400 });
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(body)) {
    return NextResponse.json({ ok: false, error: 'Plain text only' }, { status: 400 });
  }

  const now = new Date();

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { conversationId: id, senderId: profileId, body },
      include: messageInclude,
    });

    await tx.conversation.update({
      where: { id },
      data: { lastMessageAt: now },
    });

    return created;
  });

  const updatedConversation = await prisma.conversation.findUnique({
    where: { id },
    include: conversationSummaryInclude,
  });

  return NextResponse.json({
    ok: true,
    message,
    conversation: updatedConversation ?? conversation,
  });
}
