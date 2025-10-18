// src/app/api/dm/[id]/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { findConversationForParticipant } from '@/lib/dm';
import { z } from 'zod';

const reportSchema = z.object({
  reason: z.string().min(1).max(500),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'CSRF validation failed' }, { status: 403 });
  }

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const conversation = await findConversationForParticipant(id, profileId);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await requireJson(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Reason is required' }, { status: 400 });
  }

  const reason = parsed.data.reason.trim();
  if (!reason) {
    return NextResponse.json({ ok: false, error: 'Reason is required' }, { status: 400 });
  }

  await prisma.moderationAction.create({
    data: {
      actor: profileId,
      profileId,
      targetType: 'CONVERSATION',
      targetId: id,
      action: 'FLAG',
      reason,
    },
  });

  return NextResponse.json({ ok: true });
}
