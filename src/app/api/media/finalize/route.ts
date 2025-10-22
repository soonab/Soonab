import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { z } from '@/lib/zod';
import { $Enums } from '@prisma/client';

const Body = z.object({
  mediaId: z.string().min(1),
  key: z.string().min(3),                    // S3 object key (we don't store this on Media)
  contentType: z.string().min(3).optional(),
  sizeBytes: z.number().int().min(0).optional(),
});

function extFromKey(key: string): string {
  const match = key.toLowerCase().match(/\.(jpe?g|png|webp)$/);
  const e = match?.[1];
  // Normalize "jpg" to "jpeg" to match common pipelines
  return e === 'jpg' ? 'jpeg' : (e ?? 'bin');
}

function publicUrl(key: string) {
  const bucket =
    process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || process.env.BUCKET || '';
  const region = process.env.AWS_REGION || 'us-east-1';
  // Keep slashes in place; only escape unsafe chars
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
}

export async function POST(req: NextRequest) {
  const so = assertSameOrigin(req); if (so) return so;
  const cs = requireCsrf(req);      if (cs) return cs;

  const pid = await getCurrentProfileId();
  if (!pid) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const { mediaId, key, contentType, sizeBytes } = await requireJson(req, Body);

  // Update the Media row that /api/media/sign created.
  try {
    await db.media.update({
      where: { id: mediaId, ownerProfileId: pid },
      data: {
        status: $Enums.MediaStatus.READY,                 // <- your enum has READY
        ...(contentType ? { contentType } : {}),
        ...(typeof sizeBytes === 'number' ? { sizeBytes } : {}),
        ...(extFromKey(key) ? { ext: extFromKey(key) } : {}),
      },
      select: { id: true },
    });
  } catch {
    // Fallback for older shapes: update only the status
    try {
      await db.media.update({
        where: { id: mediaId, ownerProfileId: pid },
        data: { status: $Enums.MediaStatus.READY },
        select: { id: true },
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Media not found or not owned by you' },
        { status: 400 }
      );
    }
  }

  // We don’t transform in dev; use the same URL for thumb & large.
  const url = publicUrl(key);
  return NextResponse.json({
    ok: true,
    mediaId,
    urlThumb: url,
    urlLarge: url,
  });
}