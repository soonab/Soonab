// File: src/app/api/collections/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { audienceWhereForViewer } from '@/lib/visibility';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  await cookies(); // Next 15: mark dynamic
  const { slug } = await ctx.params;

  // viewer may be anonymous; guard auth probe
  let viewerId: string | null = null;
  try {
    viewerId = await getCurrentProfileId();
  } catch {
    viewerId = null;
  }

  const collection = await prisma.collection.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      visibility: true,
      ownerId: true,
      createdAt: true,
      owner: { select: { id: true, handle: true, displayName: true } }, // <-- displayName
    },
  });

  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isOwner = viewerId && collection.ownerId === viewerId;
  if (collection.visibility === 'PRIVATE' && !isOwner) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Audience gating: only include entries whose posts are visible to the viewer.
  const postWhere = audienceWhereForViewer(viewerId);

  const entries = await prisma.collectionEntry.findMany({
    where: { collectionId: collection.id, post: postWhere },
    orderBy: { addedAt: 'desc' },
    select: {
      id: true,
      addedAt: true,
      post: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          profileId: true, // <-- profileId instead of authorId
        },
      },
    },
  });

  const totalCount = await prisma.collectionEntry.count({
    where: { collectionId: collection.id },
  });

  const hiddenCount = totalCount - entries.length;

  return NextResponse.json({
    collection: {
      ...collection,
      entries,
      counts: { total: totalCount, visible: entries.length, hidden: hiddenCount },
    },
  });
}
