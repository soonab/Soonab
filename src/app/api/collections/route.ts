import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import type { Visibility as PostVisibility } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

export const dynamic = 'force-dynamic';

type CollectionVisibilityValue = 'PUBLIC' | 'PRIVATE';

const CreateCollectionSchema = z.object({
  title: z.string().min(1).max(128),
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
    .optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

function slugify(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);

  if (base) {
    return base;
  }

  return `collection-${Date.now().toString(36)}`;
}

export async function GET(req: NextRequest) {
  await cookies();
  const ownerParam = req.nextUrl.searchParams.get('owner');

  if (ownerParam !== 'me') {
    return NextResponse.json({ error: 'Only owner=me is supported' }, { status: 400 });
  }

  const ownerId = await getCurrentProfileId();
  if (!ownerId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const collections = await prisma.collection.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { entries: true } } },
  });

  return NextResponse.json({ collections });
}

export async function POST(req: NextRequest) {
  const so = assertSameOrigin(req);
  if (so) return so;

  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  await cookies();

  const ownerId = await getCurrentProfileId();
  if (!ownerId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const payload = await requireJson(req, CreateCollectionSchema);

  const requestedSlug = payload.slug ?? payload.title;
  const slug = slugify(requestedSlug);
  const visibility: CollectionVisibilityValue =
    payload.visibility === 'private' ? 'PRIVATE' : 'PUBLIC';

  try {
    const collection = await prisma.collection.create({
      data: {
        slug,
        title: payload.title,
        visibility: visibility as unknown as PostVisibility,
        ownerId,
      },
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Unable to create collection' }, { status: 500 });
  }
}
