import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

const Create = z.object({
  body: z.string().min(1).max(4000),
  mediaIds: z.array(z.string()).max(Number(process.env.UPLOAD_MAX_IMAGES_PER_ITEM ?? 4)).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try { assertSameOrigin(req); } catch { return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 }); }
  const csrf = requireCsrf(req); if (csrf) return csrf;

  const profileId = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { slug } = await context.params;

  const space = await prisma.space.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!space) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Must be a member to post
  const member = await prisma.spaceMembership.findFirst({
    where: { spaceId: space.id, profileId },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: 'forbidden_not_member' }, { status: 403 });

  const payload = await requireJson<any>(req);
  const parsed = Create.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const { body, mediaIds = [] } = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: { body, profileId, spaceId: space.id, state: 'ACTIVE', visibility: 'PUBLIC' },
      select: { id: true, createdAt: true },
    });

    if (mediaIds.length) {
      await tx.postMedia.createMany({
        data: mediaIds.map((mid) => ({ postId: post.id, mediaId: mid })),
        skipDuplicates: true,
      });
    }

    return post;
  });

  // (Optional) revalidate the Space page if you render server-side
  // try { revalidatePath(`/space/${slug}`); } catch {}

  return NextResponse.json({ ok: true, id: created.id, createdAt: created.createdAt });
}
