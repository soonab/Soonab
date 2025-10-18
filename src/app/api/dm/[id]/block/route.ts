// src/app/api/dm/[id]/block/route.ts
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

  const otherParticipantId =
    conversation.memberA.id === profileId ? conversation.memberB.id : conversation.memberA.id;

  await prisma.$transaction(async (tx) => {
    await tx.dMBlock.upsert({
      where: {
        blockerId_blockedId_conversationId: {
          blockerId: profileId,
          blockedId: otherParticipantId,
          conversationId: id,
        },
      },
      update: {},
      create: {
        blockerId: profileId,
        blockedId: otherParticipantId,
        conversationId: id,
      },
    });

    await tx.conversation.update({
      where: { id },
      data: { status: 'BLOCKED' },
    });
  });

  const updated = await prisma.conversation.findUnique({
    where: { id },
    include: conversationSummaryInclude,
  });

  return NextResponse.json({ ok: true, conversation: updated ?? conversation });
}
