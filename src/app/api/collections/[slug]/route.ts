import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { audienceWhereForViewer } from '@/lib/visibility';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  await cookies();

  const viewerId = await getCurrentProfileId();

  const collection = await prisma.collection.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      slug: true,
      title: true,
      visibility: true,
      ownerId: true,
      createdAt: true,
      owner: { select: { id: true, handle: true, displayName: true } },
    },
  });

  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isOwner = viewerId === collection.ownerId;
  const visibility = collection.visibility as unknown as 'PUBLIC' | 'PRIVATE';
  if (visibility === 'PRIVATE' && !isOwner) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const postWhere = audienceWhereForViewer(viewerId);

  const entries = await prisma.collectionEntry.findMany({
    where: {
      collectionId: collection.id,
      post: postWhere,
    },
    orderBy: { addedAt: 'desc' },
    select: {
      id: true,
      addedAt: true,
      post: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          profileId: true,
          visibility: true,
          state: true,
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
      counts: {
        total: totalCount,
        visible: entries.length,
        hidden: hiddenCount,
      },
    },
  });
}
