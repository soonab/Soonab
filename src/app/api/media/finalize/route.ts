// src/app/api/media/finalize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import { sanitizeAndVariants } from '@/lib/images';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, getS3Client, getBucketName } from '@/lib/s3';

const bodySchema = z.object({
  mediaId: z.string().min(1),
  key: z.string().min(3),
});

async function streamToBuffer(stream: AsyncIterable<Uint8Array> | null | undefined) {
  if (!stream) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

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

  const { mediaId, key } = parsed.data;
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.ownerProfileId !== profileId) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  if (media.status !== 'UPLOADING') {
    return NextResponse.json({ ok: false, error: 'Bad state' }, { status: 409 });
  }

  const bucket = getBucketName();
  const s3 = getS3Client();

  const incoming = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })).catch(() => null);
  if (!incoming || !incoming.Body) {
    return NextResponse.json({ ok: false, error: 'Upload missing' }, { status: 404 });
  }

  const buf = await streamToBuffer(incoming.Body as AsyncIterable<Uint8Array>);
  if (!buf.length) {
    return NextResponse.json({ ok: false, error: 'Empty upload' }, { status: 400 });
  }

  const variants = await sanitizeAndVariants(buf);

  const baseKey = `public/${profileId}/${mediaId}`;
  const putVariant = async (name: string, data: { buf: Buffer; ct: string }) => {
    const variantKey = `${baseKey}/${name}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: variantKey,
        Body: data.buf,
        ContentType: data.ct,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable',
        ContentDisposition: 'inline',
      })
    );
    return variantKey;
  };

  const originalKey = await putVariant('original', variants.original);
  const largeKey = await putVariant('large', variants.large);
  const thumbKey = await putVariant('thumb', variants.thumb);

  await prisma.$transaction(async (tx) => {
    await tx.media.update({
      where: { id: mediaId },
      data: {
        status: 'READY',
        width: variants.original.w,
        height: variants.original.h,
      },
    });

    await tx.mediaVariant.createMany({
      data: [
        {
          mediaId,
          role: 'ORIGINAL',
          key: originalKey,
          width: variants.original.w,
          height: variants.original.h,
          sizeBytes: variants.original.buf.length,
          contentType: variants.original.ct,
        },
        {
          mediaId,
          role: 'LARGE',
          key: largeKey,
          width: variants.large.w,
          height: variants.large.h,
          sizeBytes: variants.large.buf.length,
          contentType: variants.large.ct,
        },
        {
          mediaId,
          role: 'THUMB',
          key: thumbKey,
          width: variants.thumb.w,
          height: variants.thumb.h,
          sizeBytes: variants.thumb.buf.length,
          contentType: variants.thumb.ct,
        },
      ],
    });
  });

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);

  const publicBase = process.env.S3_PUBLIC_BASE_URL;
  if (!publicBase) {
    return NextResponse.json({ ok: false, error: 'S3 public base URL missing' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mediaId,
    urlLarge: `${publicBase}/${largeKey}`,
    urlThumb: `${publicBase}/${thumbKey}`,
  });
}
