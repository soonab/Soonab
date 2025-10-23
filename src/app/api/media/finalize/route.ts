// src/app/api/media/finalize/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { assertSameOrigin } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import { publicUrlForKey } from '@/lib/s3';

/**
 * Finalize an upload:
 *  - Upsert ORIGINAL variant for the given S3 key
 *  - Mark media READY
 * For now we do NOT generate THUMB/LARGE here; the UI falls back to ORIGINAL.
 */
export async function POST(req: NextRequest) {
  try { assertSameOrigin(req); }
  catch { return NextResponse.json({ ok: false, error: 'CSRF validation failed' }, { status: 403 }); }

  const profileId = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { mediaId, key, contentType, sizeBytes } = body ?? {};
  if (!mediaId || !key) {
    return NextResponse.json({ ok: false, error: 'Missing mediaId/key' }, { status: 400 });
  }

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.ownerProfileId !== profileId) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  // Upsert ORIGINAL variant by unique key (width/height unknown at this stage)
  await prisma.mediaVariant.upsert({
    where: { key },
    create: {
      mediaId,
      role: 'ORIGINAL',
      key,
      width: 0,
      height: 0,
      sizeBytes: typeof sizeBytes === 'number' ? Math.trunc(sizeBytes) : media.sizeBytes,
      contentType: contentType || media.contentType,
    },
    update: {
      sizeBytes: typeof sizeBytes === 'number' ? Math.trunc(sizeBytes) : undefined,
      contentType: contentType || undefined,
    },
  });

  await prisma.media.update({ where: { id: mediaId }, data: { status: 'READY' } });

  const url = publicUrlForKey(key);
  // For now we return ORIGINAL for both; the UI will show ORIGINAL if LARGE is absent.
  return NextResponse.json({ ok: true, urlLarge: url, urlThumb: url });
}
