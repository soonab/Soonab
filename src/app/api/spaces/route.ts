import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

const db = prisma as any;

const SpaceSummary = {
  id: true,
  slug: true,
  name: true,
  description: true,
  createdAt: true,
} as const;

const CreateSpace = z.object({
  name: z.string().min(3).max(60),
  description: z.string().max(280).optional(),
});

function slugify(input: string) {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.length ? s.slice(0, 48) : `space-${Date.now().toString(36)}`;
}

// GET /api/spaces → mine=1 lists joined spaces; otherwise recent public spaces
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get('mine') === '1';
  const profileId = await getCurrentProfileId();

  if (mine && profileId) {
    const memberships = await db.spaceMembership.findMany({
      where: { profileId },
      include: { space: { select: SpaceSummary } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const spaces = memberships.map((m: { space: unknown }) => m.space);
    return NextResponse.json({ spaces });
  }

  const spaces = await db.space.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: SpaceSummary,
  });

  return NextResponse.json({ spaces });
}

// POST /api/spaces → create space + owner membership
export async function POST(req: NextRequest) {
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const input = await requireJson(req, CreateSpace);

  const base = slugify(input.name);
  let slug = base;
  for (let i = 1; await db.space.findUnique({ where: { slug } }); i += 1) {
    slug = `${base}-${i}`;
  }

  const space = await db.space.create({
    data: {
      name: input.name,
      description: input.description,
      slug,
      createdById: profileId,
      members: { create: { profileId, role: 'OWNER' } },
    },
    select: SpaceSummary,
  });

  return NextResponse.json({ space });
}
