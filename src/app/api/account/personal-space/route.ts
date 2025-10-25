import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;
  const csrfError = requireCsrf(req);
  if (csrfError) return csrfError;

  const me = await getCurrentProfileId();
  if (!me) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.space.findFirst({
    where: { createdById: me, isPersonal: true },
    select: { slug: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, slug: existing.slug });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: me },
    select: { handle: true, displayName: true },
  });

  const base = profile?.handle ? profile.handle : profile?.displayName || 'personal-space';
  const slug = slugify(base) || 'personal-space';
  let candidate = slug;
  let suffix = 2;

  // Ensure slug uniqueness before creating the space.
  while (
    await prisma.space.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${slug}-${suffix++}`;
  }

  const created = await prisma.space.create({
    data: {
      slug: candidate,
      name: profile?.displayName ? `${profile.displayName} — Personal Space` : 'Personal Space',
      createdById: me,
      isPersonal: true,
    },
    select: { slug: true },
  });

  return NextResponse.json({ ok: true, slug: created.slug });
}
