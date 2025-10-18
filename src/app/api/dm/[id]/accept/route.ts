// src/app/api/dm/[id]/accept/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';
import { conversationSummaryInclude, findConversationForParticipant } from '@/lib/dm';

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

  const { id } = await ctx.params;

  const conversation = await findConversationForParticipant(id, profileId);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 });
  }

  if (conversation.createdBy.id === profileId) {
    return NextResponse.json({ ok: false, error: 'Creator cannot accept their own invite' }, { status: 400 });
  }

  if (conversation.status === 'BLOCKED') {
    return NextResponse.json({ ok: false, error: 'Conversation is blocked' }, { status: 403 });
  }

  if (conversation.status === 'ACTIVE') {
    return NextResponse.json({ ok: true, conversation });
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { status: 'ACTIVE', lastMessageAt: conversation.lastMessageAt ?? new Date() },
    include: conversationSummaryInclude,
  });

  return NextResponse.json({ ok: true, conversation: updated });
}
