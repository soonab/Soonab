// File: src/app/api/collections/[slug]/entries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const AddSchema = z.object({
  postId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  await cookies();

  const { slug } = await ctx.params;
  const ownerId = await getCurrentProfileId();
  const { postId } = AddSchema.parse(await requireJson(req));

  const collection = await prisma.collection.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!collection) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (collection.ownerId !== ownerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  try {
    const entry = await prisma.collectionEntry.create({
      data: { collectionId: collection.id, postId: post.id },
      select: { id: true, collectionId: true, postId: true, addedAt: true },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e: any) {
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
      return NextResponse.json({ error: 'Already in collection' }, { status: 409 });
    }
    throw e;
  }
}
