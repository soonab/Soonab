// src/app/api/media/sign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import { allowedTypes, extFromType } from '@/lib/images';
import { signPutURL } from '@/lib/s3';
import { canUploadMedia } from '@/lib/limits';

const bodySchema = z.object({
  contentType: z.string(),
  size: z.number().int().positive(),
  scope: z.enum(['post', 'dm']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'CSRF validation failed' }, { status: 403 });
  }

  const payload = await requireJson(req).catch(() => null);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const { contentType, size } = parsed.data;
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ ok: false, error: 'Unsupported type' }, { status: 415 });
  }

  const maxBytes = Number(process.env.UPLOAD_MAX_MB ?? 8) * 1024 * 1024;
  if (size > maxBytes) {
    return NextResponse.json({ ok: false, error: 'Too large' }, { status: 413 });
  }

  const quota = await canUploadMedia(profileId, 1);
  if (!quota.ok) {
    return NextResponse.json({ ok: false, error: quota.error }, { status: 429 });
  }

  const ext = extFromType(contentType);
  const key = `incoming/${profileId}/${randomUUID()}.${ext}`;

  const media = await prisma.media.create({
    data: {
      ownerProfileId: profileId,
      kind: 'IMAGE',
      status: 'UPLOADING',
      ext,
      contentType,
      sizeBytes: size,
    },
    select: { id: true },
  });

  const url = await signPutURL(key, contentType, size);

  return NextResponse.json({
    ok: true,
    mediaId: media.id,
    key,
    url,
  });
}
