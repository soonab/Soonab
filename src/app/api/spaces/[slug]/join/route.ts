import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf } from '@/lib/security';

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  // Security baseline (Step‑10): same‑origin + CSRF
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const space = await prisma.space.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!space) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Upsert requires @@unique([spaceId, profileId]) on SpaceMembership (Step‑15.1).
  await prisma.spaceMembership.upsert({
    where: { spaceId_profileId: { spaceId: space.id, profileId } },
    update: {},
    create: { spaceId: space.id, profileId, role: 'member' },
  });

  return NextResponse.json({ ok: true });
}