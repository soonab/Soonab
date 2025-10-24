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

export async function POST(req: NextRequest) {
  // Step-10 baseline security
  await assertSameOrigin(req);
  await requireCsrf(req);
  await cookies(); // Next 15: mark dynamic

  const profileId = await getCurrentProfileId();
  const { body, spaceId, parentId, mediaIds = [] } = CreatePostSchema.parse(await requireJson(req));

  // If replying via this endpoint, verify the parent exists.
  if (parentId) {
    const parent = await prisma.post.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: 'Parent post not found' }, { status: 404 });
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
