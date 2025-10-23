import type { Prisma, Visibility } from '@prisma/client'

import { prisma } from '@/lib/db'

/** Gate a field by visibility (PUBLIC, FOLLOWERS, TRUSTED). */
export async function canSeeField(
  required: Visibility,
  viewerPid: string | null,
  ownerPid: string
): Promise<boolean> {
  if (viewerPid === ownerPid) return true
  if (required === 'PUBLIC') return true
  if (!viewerPid) return false

  if (required === 'FOLLOWERS') {
    const follow = await prisma.follow.findFirst({
      where: { followerProfileId: viewerPid, followingProfileId: ownerPid },
      select: { followerProfileId: true },
    })
    return !!follow
  }

  if (required === 'TRUSTED') {
    const trust = await prisma.trust.findFirst({
      where: { trusterProfileId: ownerPid, trusteeProfileId: viewerPid },
      select: { trusterProfileId: true },
    })
    return !!trust
  }

  return false
}

export function audienceWhereForViewer(viewerPid: string | null): Prisma.PostWhereInput {
  const base: Prisma.PostWhereInput = { state: 'ACTIVE' }

  if (!viewerPid) {
    return { ...base, visibility: 'PUBLIC' }
  }

  return {
    ...base,
    OR: [
      { visibility: 'PUBLIC' },
      { profileId: viewerPid },
      {
        visibility: 'FOLLOWERS',
        profile: {
          followerConnections: {
            some: { followerProfileId: viewerPid },
          },
        },
      },
      {
        visibility: 'TRUSTED',
        profile: {
          trustGiven: {
            some: { trusteeProfileId: viewerPid },
          },
        },
      },
    ],
  }
}
