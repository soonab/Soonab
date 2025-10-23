// src/app/api/media/sign/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { assertSameOrigin } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import { getS3Client, getBucketName, getKeyPrefix } from '@/lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_MB = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB ?? process.env.UPLOAD_MAX_MB ?? 8);
const MAX_BYTES = MAX_MB * 1024 * 1024;

function inferExt(params: { contentType?: string; name?: string }): string | null {
  const { contentType, name } = params;
  const byType: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (contentType && byType[contentType]) return byType[contentType];
  const m = name?.toLowerCase().match(/\.(jpe?g|png|webp)$/);
  if (!m) return null;
  const e = m[1];
  return e === 'jpeg' ? 'jpg' : e;
}

export async function POST(req: NextRequest) {
  try { assertSameOrigin(req); }
  catch { return NextResponse.json({ ok: false, error: 'CSRF validation failed' }, { status: 403 }); }

  const profileId = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { contentType, size, scope, name } = body ?? {};
  if (!ALLOWED.has(contentType)) return NextResponse.json({ ok: false, error: 'Unsupported content type' }, { status: 415 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return NextResponse.json({ ok: false, error: `Too large; limit ${MAX_MB}MB` }, { status: 413 });
  if (scope !== 'post' && scope !== 'dm') return NextResponse.json({ ok: false, error: 'Invalid scope' }, { status: 400 });

  const ext = inferExt({ contentType, name });
  if (!ext) return NextResponse.json({ ok: false, error: 'Could not determine file extension' }, { status: 415 });

  // Prisma schema requires ext, contentType, sizeBytes
  const media = await prisma.media.create({
    data: {
      ownerProfileId: profileId,
      status: 'UPLOADING',
      kind: 'IMAGE',
      ext,
      contentType,
      sizeBytes: Math.trunc(size),
    },
    select: { id: true },
  });

  const bucket = getBucketName();
  const prefix = getKeyPrefix();             // "public" by default; can be "uploads" via env
  const key = `${prefix}/${profileId}/${media.id}/original.${ext}`;

  const s3 = getS3Client();
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });

  return NextResponse.json({ ok: true, url, key, mediaId: media.id });
}
