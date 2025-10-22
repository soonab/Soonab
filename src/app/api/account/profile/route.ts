import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

const V = z.enum(['PUBLIC', 'FOLLOWERS', 'TRUSTED']);
const LinkSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(30),
  url: z.string().trim().min(1).max(200).refine(isHttpUrl, 'Must be http(s) URL'),
  order: z.number().int().min(0).max(1000),
  visibility: V,
});
const BodySchema = z.object({
  bio: z.string().trim().max(200).nullable().optional(),
  bioVisibility: V,
  location: z.string().trim().max(80).nullable().optional(),
  locationVisibility: V,
  links: z.array(LinkSchema).max(5),
});

function isHttpUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET() {
  const viewerPid = await getCurrentProfileId();
  if (!viewerPid) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: viewerPid },
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

  return NextResponse.json({ ok: true, profile });
}

export async function PUT(req: NextRequest) {
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const viewerPid = await getCurrentProfileId();
  if (!viewerPid) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const body = await requireJson(req, BodySchema);
  const bio = body.bio ? body.bio.trim() : null;
  const location = body.location ? body.location.trim() : null;
  const links = body.links.map((link) => ({
    ...link,
    title: link.title.trim(),
    url: new URL(link.url).toString(),
  }));
  const ids = links.map((link) => link.id).filter(Boolean) as string[];

  let allowedIds = new Set<string>();
  if (ids.length) {
    const existing = await prisma.profileLink.findMany({
      where: { profileId: viewerPid, id: { in: ids } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((l) => l.id));
    for (const id of ids) {
      if (!existingIds.has(id)) {
        return NextResponse.json({ ok: false, error: 'Invalid link id' }, { status: 400 });
      }
    }
    allowedIds = existingIds;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { id: viewerPid },
      data: {
        bio,
        bioVisibility: body.bioVisibility,
        location,
        locationVisibility: body.locationVisibility,
      },
    });

    await tx.profileLink.deleteMany({
      where: {
        profileId: viewerPid,
        id: { notIn: ids.length ? ids : ['_none_'] },
      },
    });

    for (const link of links) {
      if (link.id) {
        if (!allowedIds.has(link.id)) continue;
        await tx.profileLink.update({
          where: { id: link.id },
          data: {
            title: link.title,
            url: link.url,
            order: link.order,
            visibility: link.visibility,
          },
        });
      } else {
        await tx.profileLink.create({
          data: {
            profileId: viewerPid,
            title: link.title,
            url: link.url,
            order: link.order,
            visibility: link.visibility,
          },
        });
      }
    }

    return tx.profile.findUnique({
      where: { id: viewerPid },
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
  });

  return NextResponse.json({ ok: true, profile: updated });
}
