import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

export const dynamic = 'force-dynamic';

const AddEntrySchema = z.object({
  postId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const sameOrigin = assertSameOrigin(req);
  if (sameOrigin) return sameOrigin;

  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  await cookies();

  const ownerId = await getCurrentProfileId();
  if (!ownerId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await requireJson(req, AddEntrySchema);

  const collection = await prisma.collection.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true },
  });
  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (collection.ownerId !== ownerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const post = await prisma.post.findUnique({
    where: { id: body.postId },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  try {
    const entry = await prisma.collectionEntry.create({
      data: {
        collectionId: collection.id,
        postId: post.id,
      },
      select: { id: true, collectionId: true, postId: true, addedAt: true },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Already in collection' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Unable to add entry' }, { status: 500 });
  }
}
