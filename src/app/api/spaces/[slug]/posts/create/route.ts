// src/app/api/spaces/[slug]/posts/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

const Body = z.object({
  body: z.string().trim().min(1).max(4000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const space = await prisma.space.findUnique({
    where: { slug: params.slug },
    select: { id: true, createdById: true },
  });
  if (!space) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (space.createdById !== profileId) {
    const membership = await prisma.spaceMembership.findUnique({
      where: {
        spaceId_profileId: {
          spaceId: space.id,
          profileId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ ok: false, error: 'not_member' }, { status: 403 });
    }
  }

  const { body } = await requireJson(req, Body);

  const post = await prisma.post.create({
    data: {
      body,
      profileId,
      spaceId: space.id,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, id: post.id, createdAt: post.createdAt });
}
