import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';
import { Prisma, CollectionVisibility } from '@prisma/client';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  title: z.string().min(1).max(128),
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
    .optional(),
  // NOTE: don't use .default() (not supported in your zod wrapper); default in code.
  visibility: z.enum(['public', 'private']).optional(),
});

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

/**
 * GET /api/collections?owner=me
 * Lists the current user's collections (requires login).
 */
export async function GET(req: NextRequest, _ctx: { params: Promise<{}> }) {
  await cookies(); // Next 15: mark dynamic

  const url = new URL(req.url);
  const owner = url.searchParams.get('owner');
  if (owner !== 'me') {
    return NextResponse.json({ error: 'Only owner=me is supported' }, { status: 400 });
  }

  const ownerId = await getCurrentProfileId();
  if (!ownerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collections = await prisma.collection.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { entries: true } } },
  });

  return NextResponse.json({ collections });
}

/**
 * POST /api/collections
 * Creates a collection for the current user (requires login).
 */
export async function POST(req: NextRequest, _ctx: { params: Promise<{}> }) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  await cookies(); // Next 15: mark dynamic

  const ownerId = await getCurrentProfileId();
  if (!ownerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = CreateSchema.parse(await requireJson(req));

  const slug = data.slug ?? slugify(data.title);
  const visibilityStr = data.visibility ?? 'public';
  const visibility: CollectionVisibility =
    visibilityStr === 'private' ? CollectionVisibility.PRIVATE : CollectionVisibility.PUBLIC;

  try {
    const collection = await prisma.collection.create({
      data: {
        slug,
        title: data.title,
        visibility,
        ownerId, // now guaranteed string
      },
    });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (e) {
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    throw e;
  }
}
