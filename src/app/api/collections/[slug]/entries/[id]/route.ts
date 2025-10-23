import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const sameOrigin = assertSameOrigin(req);
  if (sameOrigin) return sameOrigin;

  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  await cookies();

  const ownerId = await getCurrentProfileId();
  if (!ownerId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const collection = await prisma.collection.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true },
  });
  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (collection.ownerId !== ownerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const entry = await prisma.collectionEntry.findUnique({
    where: { id: params.id },
    select: { id: true, collectionId: true },
  });
  if (!entry || entry.collectionId !== collection.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.collectionEntry.delete({ where: { id: entry.id } });

  return new NextResponse(null, { status: 204 });
}
