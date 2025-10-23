import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

const Create = z.object({
  body: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const space = await prisma.space.findUnique({ where: { slug: params.slug } });
  if (!space) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const member = await prisma.spaceMembership.findUnique({
    where: { spaceId_profileId: { spaceId: space.id, profileId } },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: 'forbidden_not_member' }, { status: 403 });
  }

  const { body } = await requireJson(req, Create);

  const post = await prisma.post.create({
    data: { body, authorId: profileId, spaceId: space.id },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, id: post.id, createdAt: post.createdAt });
}
