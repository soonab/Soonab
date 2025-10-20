// src/app/api/dm/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { conversationSummaryInclude, findConversationForParticipant } from '@/lib/dm';
import { rateLimit } from '@/lib/ratelimit';
import { z } from 'zod';
import { serializeAttachments, type VariantRecord } from '@/lib/media';

const MAX_IMAGES = Number(process.env.UPLOAD_MAX_IMAGES_PER_ITEM ?? 4);

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
  mediaIds: z.array(z.string().min(1)).max(MAX_IMAGES).optional(),
});

const messageInclude = {
  sender: { select: { id: true, handle: true, displayName: true } },
  media: {
    include: {
      media: {
        include: { variants: true },
      },
    },
  },
};

function joinToVariants(join: { mediaId: string; media: { variants: { role: string; key: string; width: number; height: number; contentType: string }[] } }[]): VariantRecord[] {
  return join.map((item) => ({
    id: item.mediaId,
    variants: item.media.variants.map((v) => ({
      role: v.role,
      key: v.key,
      width: v.width,
      height: v.height,
      contentType: v.contentType,
    })),
  }));
}

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

  const normalizedMessages = (messages as any[]).map((m) => {
    const attachments = serializeAttachments(joinToVariants(m.media ?? []));
    const { media: _join, ...rest } = m;
    return { ...rest, media: attachments };
  });

  const nextCursor = messages.length === limit ? messages[messages.length - 1]!.id : null;

  return NextResponse.json({ ok: true, conversation, messages: normalizedMessages, nextCursor });
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
  const mediaIds = parsed.data.mediaIds ?? [];
  const body = raw.trim();
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Body is required' }, { status: 400 });
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(body)) {
    return NextResponse.json({ ok: false, error: 'Plain text only' }, { status: 400 });
  }

  let mediaRecords: VariantRecord[] = [];
  if (mediaIds.length) {
    mediaRecords = await prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        ownerProfileId: profileId,
        status: 'READY',
      },
      include: { variants: true },
    });
    if (mediaRecords.length !== mediaIds.length) {
      return NextResponse.json({ ok: false, error: 'Invalid media selection' }, { status: 400 });
    }
  }

  const now = new Date();

  const messageRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { conversationId: id, senderId: profileId, body },
      include: messageInclude,
    });

    if (mediaIds.length) {
      await tx.dMMessageMedia.createMany({
        data: mediaIds.map((mid: string) => ({ messageId: created.id, mediaId: mid })),
      });
    }

    await tx.conversation.update({
      where: { id },
      data: { lastMessageAt: now },
    });

    return tx.message.findUnique({ where: { id: created.id }, include: messageInclude });
  });

  if (!messageRecord) {
    return NextResponse.json({ ok: false, error: 'Unable to send message' }, { status: 500 });
  }

  const attachments = mediaIds.length
    ? serializeAttachments(mediaRecords, mediaIds)
    : serializeAttachments(joinToVariants((messageRecord as any).media ?? []));
  const { media: _join, ...restMessage } = messageRecord as any;

  const updatedConversation = await prisma.conversation.findUnique({
    where: { id },
    include: conversationSummaryInclude,
  });

  return NextResponse.json({
    ok: true,
    message: { ...restMessage, media: attachments },
    conversation: updatedConversation ?? conversation,
  });
}
