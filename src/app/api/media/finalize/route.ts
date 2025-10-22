// src/app/api/media/finalize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { z } from '@/lib/zod';
import { $Enums } from '@prisma/client';

// Keep the schema simple so it works with our local zod wrapper.
// No union, no passthrough, no nonnegative().
const Body = z.object({
  mediaId: z.string().min(1),
  key: z.string().min(3),                 // S3 object key (we don't store the key on Media row)
  contentType: z.string().min(3).optional(),
  sizeBytes: z.number().int().min(0).optional(),
  scope: z.enum(['post', 'dm']).optional(),
});

function deriveExt(key: string): string {
  const m = key.toLowerCase().match(/\.(jpe?g|png|webp)$/);
  return m?.[1] ?? 'bin';
}

function publicUrl(key: string) {
  const bucket =
    process.env.AWS_S3_BUCKET ||
    process.env.S3_BUCKET ||
    process.env.BUCKET ||
    '';
  const region = process.env.AWS_REGION || 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(
    key
  )}`;
}

export async function POST(req: NextRequest) {
  // Security baseline (Step‑10)
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  // Must be signed-in
  const pid = await getCurrentProfileId();
  if (!pid)
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });

  // Validate
  const { mediaId, key, contentType, sizeBytes } = await requireJson(req, Body);

  // Best‑effort update of Media row. Some fields may not exist in older schemas,
  // so we try the superset first and then fall back to only status.
  const ext = deriveExt(key);
  try {
    await db.media.update({
      where: { id: mediaId, ownerProfileId: pid },
      data: {
        status: $Enums.MediaStatus.UPLOADED,
        ...(ext ? { ext } : {}),
        ...(contentType ? { contentType } : {}),
        ...(typeof sizeBytes === 'number' ? { sizeBytes } : {}),
      },
      select: { id: true },
    });
  } catch {
    // Fallback: only set status (for schemas without ext/contentType/sizeBytes)
    try {
      await db.media.update({
        where: { id: mediaId, ownerProfileId: pid },
        data: { status: $Enums.MediaStatus.UPLOADED },
        select: { id: true },
      });
    } catch {
      // If even this fails, return a clear error instead of 500
      return NextResponse.json(
        { ok: false, error: 'Could not finalize media' },
        { status: 400 }
      );
    }
  }

  // We don’t transform in dev — the same S3 object serves both sizes.
  const url = publicUrl(key);
  return NextResponse.json({
    ok: true,
    mediaId,
    urlThumb: url,
    urlLarge: url,
  });
}
