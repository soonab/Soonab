// File: src/app/api/collections/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { audienceWhereForViewer } from '@/lib/visibility';
import { decodeCursor, encodeCursor } from '@/lib/pagination';
import { serializeAttachments } from '@/lib/media';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  await cookies(); // Next 15 dynamic
  const { slug } = params;

  const limit = Math.max(
    1,
    Math.min(Number(req.nextUrl.searchParams.get('limit')) || 24, 60)
  );
  const cursor = decodeCursor(req.nextUrl.searchParams.get('cursor'));

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
      title: true,
      visibility: true,
      ownerId: true,
      createdAt: true,
    },
  });
  if (!collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  const isOwner = viewerId !== null && viewerId === collection.ownerId;
  if (collection.visibility === 'PRIVATE' && !isOwner) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  const postWhere = audienceWhereForViewer(viewerId);

  const cursorWhere = cursor
    ? {
        OR: [
          { addedAt: { lt: new Date(cursor.createdAt) } },
          {
            AND: [
              { addedAt: new Date(cursor.createdAt) },
              { id: { lt: cursor.id } },
            ],
          },
        ],
      }
    : null;

  const entriesWhere = cursorWhere
    ? {
        AND: [
          { collectionId: collection.id, post: postWhere },
          cursorWhere,
        ],
      }
    : { collectionId: collection.id, post: postWhere };

  const rows = await prisma.collectionEntry.findMany({
    where: entriesWhere,
    orderBy: [
      { addedAt: 'desc' },
      { id: 'desc' },
    ],
    take: limit,
    select: {
      id: true,
      addedAt: true,
      post: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          visibility: true,
          state: true,
          profileId: true,
          media: {
            include: {
              media: {
                include: { variants: true },
              },
            },
          },
        },
      },
    },
  });

  const items = rows.map((row) => {
    const post = row.post;
    const hidden = post.state !== 'ACTIVE';

    const attachments = hidden
      ? []
      : serializeAttachments(
          post.media.map((link) => ({
            id: link.mediaId,
            variants: link.media.variants.map((variant) => ({
              role: variant.role,
              key: variant.key,
              width: variant.width,
              height: variant.height,
              contentType: variant.contentType,
            })),
          }))
        );

    return {
      id: row.id,
      addedAt: row.addedAt.toISOString(),
      postId: post.id,
      createdAt: post.createdAt.toISOString(),
      hidden,
      body: hidden ? '' : post.body,
      attachments,
    };
  });

  const lastRow = rows.at(-1);
  const nextCursor =
    rows.length === limit && lastRow
      ? encodeCursor({
          createdAt: lastRow.addedAt.toISOString(),
          id: lastRow.id,
        })
      : null;

  return NextResponse.json({
    collection: {
      slug,
      title: collection.title,
      visibility: collection.visibility,
      createdAt: collection.createdAt.toISOString(),
    },
    items,
    nextCursor,
  });
}
