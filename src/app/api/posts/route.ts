// File: src/app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { extractTags } from '@/lib/hashtags';
import { z } from '@/lib/zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/posts
 * Minimal stub so dev runs clean; replace with your real list implementation if you have one.
 */
export async function GET(_req: NextRequest, _ctx: { params: Promise<{}> }) {
  await cookies(); // Next 15: mark dynamic
  return NextResponse.json({ ok: true, items: [], nextCursor: null });
}

/**
 * POST /api/posts
 * Create a top-level post (or a child if parentId supplied), with optional media + hashtags.
 */
const CreatePostSchema = z.object({
  body: z.string().min(1).max(10000),
  spaceId: z.string().optional(),          // Step-15 Spaces (optional)
  parentId: z.string().optional(),         // If you allow replies via this endpoint
  mediaIds: z.array(z.string().min(1)).max(4).optional(), // UI shows 1/1; server accepts up to 4
});

const PUBLIC_POSTS_PER_DAY = Number(process.env.PUBLIC_POSTS_PER_DAY ?? 5);

type SpaceVisibilityRow = {
  id: string;
  visibility: 'PUBLIC' | 'INVITE';
};

type ExistsRow = {
  exists: number;
};

type CountRow = {
  count: number;
};

async function shouldBypassPublicQuota(profileId: string, spaceId: string | null | undefined): Promise<boolean> {
  if (!spaceId) return false;
  const spaces = await prisma.$queryRaw<SpaceVisibilityRow[]>`
    SELECT id, visibility FROM "Space" WHERE id=${spaceId} LIMIT 1`;
  const space = spaces[0];
  if (!space || space.visibility !== 'INVITE') return false;
  const memberships = await prisma.$queryRaw<ExistsRow[]>`
    SELECT 1 AS exists FROM "SpaceMembership" WHERE "spaceId"=${space.id} AND "profileId"=${profileId} LIMIT 1`;
  return memberships.length > 0;
}

async function enforcePublicPostQuotaOrThrow(profileId: string): Promise<void> {
  const since = new Date(Date.now() - 86_400_000);
  const counts = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS count
    FROM "Post" p
    LEFT JOIN "Space" s ON p."spaceId" = s.id
    WHERE p."profileId"=${profileId}
      AND p."createdAt" >= ${since}
      AND (p."spaceId" IS NULL OR s.visibility='PUBLIC')`;
  const count = counts[0]?.count ?? 0;
  if (count >= PUBLIC_POSTS_PER_DAY) {
    throw new Error('PUBLIC_QUOTA_EXCEEDED');
  }
}

export async function POST(req: NextRequest) {
  // Step-10 baseline security
  await assertSameOrigin(req);
  await requireCsrf(req);
  await cookies(); // Next 15: mark dynamic

  const profileId = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { body, spaceId, parentId, mediaIds = [] } = CreatePostSchema.parse(await requireJson(req));

  // If replying via this endpoint, verify the parent exists.
  if (parentId) {
    const parent = await prisma.post.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: 'Parent post not found' }, { status: 404 });
  }

  if (spaceId) {
    const memberships = await prisma.$queryRaw<ExistsRow[]>`
      SELECT 1 AS exists FROM "SpaceMembership" WHERE "spaceId"=${spaceId} AND "profileId"=${profileId} LIMIT 1`;
    if (memberships.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const bypass = await shouldBypassPublicQuota(profileId, spaceId ?? null);
  try {
    if (!bypass) {
      await enforcePublicPostQuotaOrThrow(profileId);
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'PUBLIC_QUOTA_EXCEEDED') {
      return NextResponse.json({ error: 'Public post limit reached for today' }, { status: 429 });
    }
    throw error;
  }

  const hashtags = extractTags(body);

  // Create post, then attach hashtags and media atomically
  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        body,
        profileId,                         // <-- your schema uses profileId (not authorId)
        ...(spaceId ? { spaceId } : {}),
        ...(parentId ? { parentId } : {}), // If your column is replyToId, rename the key here
      },
      select: { id: true, createdAt: true },
    });

    if (hashtags.length) {
      const tagRecords = await Promise.all(
        hashtags.map((name) =>
          tx.tag.upsert({ where: { name }, update: {}, create: { name } })
        )
      );

      await tx.postTag.createMany({
        data: tagRecords.map((tag) => ({ postId: post.id, tagId: tag.id })),
        skipDuplicates: true,
      });
    }

    if (mediaIds.length) {
      await tx.postMedia.createMany({
        data: mediaIds.map((mid) => ({ postId: post.id, mediaId: mid })),
        skipDuplicates: true,
      });
    }

    return post;
  });

  return NextResponse.json({ post: created }, { status: 201 });
}
