import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { canSeeField } from '@/lib/visibility';

export async function GET(_req: NextRequest, { params }: { params: { handle: string } }) {
  const viewerPid = await getCurrentProfileId();
  const handle = params.handle.toLowerCase();

  const owner = await prisma.profile.findUnique({
    where: { handle },
    select: {
      id: true,
      handle: true,
      bio: true,
      bioVisibility: true,
      location: true,
      locationVisibility: true,
      links: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, url: true, order: true, visibility: true },
      },
      orgVerifications: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!owner) return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });

  const out: any = { id: owner.id, handle: owner.handle, links: [] as any[] };
  if (await canSeeField(owner.bioVisibility, viewerPid, owner.id)) out.bio = owner.bio;
  if (await canSeeField(owner.locationVisibility, viewerPid, owner.id)) out.location = owner.location;

  for (const link of owner.links) {
    if (await canSeeField(link.visibility, viewerPid, owner.id)) out.links.push(link);
  }

  const ov = owner.orgVerifications?.[0];
  if (ov?.status === 'VERIFIED') out.orgVerified = { orgName: ov.orgName, domain: ov.domain };

  return NextResponse.json({ ok: true, profile: out });
}
