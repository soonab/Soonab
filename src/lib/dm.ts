// src/lib/dm.ts
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export function normalizeMemberIds(a: string, b: string) {
  return a <= b
    ? { memberAId: a, memberBId: b }
    : { memberAId: b, memberBId: a };
}

export const conversationSummaryInclude: Prisma.ConversationInclude = {
  memberA: { select: { id: true, handle: true, displayName: true } },
  memberB: { select: { id: true, handle: true, displayName: true } },
  createdBy: { select: { id: true } },
  messages: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: {
      id: true,
      createdAt: true,
      body: true,
      senderId: true,
      sender: { select: { id: true, handle: true, displayName: true } },
    },
  },
  blocks: {
    select: { blockerId: true, blockedId: true },
  },
};

export async function findConversationForParticipant(id: string, profileId: string) {
  return prisma.conversation.findFirst({
    where: {
      id,
      OR: [{ memberAId: profileId }, { memberBId: profileId }],
    },
    include: {
      memberA: { select: { id: true, handle: true, displayName: true } },
      memberB: { select: { id: true, handle: true, displayName: true } },
      createdBy: { select: { id: true } },
      blocks: {
        select: { blockerId: true, blockedId: true },
      },
      messages: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          id: true,
          createdAt: true,
          body: true,
          senderId: true,
          sender: { select: { id: true, handle: true, displayName: true } },
        },
      },
    },
  });
}

export async function hasTrustOrFollowEdge(senderId: string, targetId: string) {
  const [follows, trusted] = await Promise.all([
    prisma.follow.findUnique({
      where: {
        followerProfileId_followingProfileId: {
          followerProfileId: senderId,
          followingProfileId: targetId,
        },
      },
      select: { followerProfileId: true },
    }),
    prisma.trust.findUnique({
      where: {
        trusterProfileId_trusteeProfileId: {
          trusterProfileId: targetId,
          trusteeProfileId: senderId,
        },
      },
      select: { trusterProfileId: true },
    }),
  ]);

  return Boolean(follows || trusted);
}
