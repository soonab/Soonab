// src/app/api/media/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { assertSameOrigin } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import { DeleteObjectCommand, ListObjectsV2Command, getS3Client, getBucketName } from '@/lib/s3';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'CSRF validation failed' }, { status: 403 });
  }

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const media = await prisma.media.findUnique({
    where: { id: params.id },
    include: { posts: true, messages: true },
  });

  if (!media || media.ownerProfileId !== profileId) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  if (media.posts.length || media.messages.length) {
    return NextResponse.json({ ok: false, error: 'Still referenced' }, { status: 409 });
  }

  const bucket = getBucketName();
  const s3 = getS3Client();
  const prefix = `public/${profileId}/${media.id}/`;
  const existing = await s3
    .send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
    .catch(() => ({ Contents: [] as { Key?: string }[] }));

  const contents: Array<{ Key?: string }> = existing.Contents ?? [];
  const deletable = contents.filter((entry): entry is { Key: string } => typeof entry.Key === 'string');
  if (deletable.length) {
    await Promise.all(
      deletable.map((obj: { Key: string }) =>
        s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key })).catch(() => undefined)
      )
    );
  }

  await prisma.media.update({
    where: { id: params.id },
    data: { status: 'DELETED', deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
