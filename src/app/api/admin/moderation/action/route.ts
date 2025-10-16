// src/app/api/admin/moderation/action/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { prisma } from '@/lib/db';

// Simple admin header guard (adjust if you use something else)
function requireAdminKey(req: NextRequest) {
  const given = req.headers.get('x-admin-key') || '';
  const expected = process.env.ADMIN_KEY || '';
  return given.length > 0 && expected.length > 0 && given === expected;
}

// POST /api/admin/moderation/action
// Apply a moderation action to a target entity (post/reply/profile).
export async function POST(req: NextRequest) {
  assertSameOrigin(req);

  if (!requireAdminKey(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Expected payload:
  // { "targetType": "POST"|"REPLY"|"PROFILE", "targetId": "<id>", "action": "HIDE"|"UNHIDE"|"SUSPEND"|"UNSUSPEND", "reason": "optional" }
  const payload = await requireJson<any>(req);
  const targetType = String(payload?.targetType || '').toUpperCase();
  const targetId = String(payload?.targetId || '').trim();
  const action = String(payload?.action || '').toUpperCase();
  // const reason = typeof payload?.reason === 'string' ? payload.reason : undefined; // reserved for future use

  if (!targetType || !targetId || !action) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  if (targetType === 'POST') {
    if (action === 'HIDE') {
      await prisma.post.update({ where: { id: targetId }, data: { state: 'HIDDEN' as any } });
    } else if (action === 'UNHIDE') {
      await prisma.post.update({ where: { id: targetId }, data: { state: 'ACTIVE' as any } });
    } else {
      return NextResponse.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
    }
  } else if (targetType === 'REPLY') {
    if (action === 'HIDE') {
      await prisma.reply.update({ where: { id: targetId }, data: { state: 'HIDDEN' as any } });
    } else if (action === 'UNHIDE') {
      await prisma.reply.update({ where: { id: targetId }, data: { state: 'ACTIVE' as any } });
    } else {
      return NextResponse.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
    }
  } else if (targetType === 'PROFILE') {
    // Schema-agnostic placeholder:
    // Your Profile model doesn’t expose fields like `state` or `suspensionReason`.
    // Until we wire this to your real moderation schema (e.g., ProfilePenalty table),
    // acknowledge the request without a DB write so builds are stable.
    return NextResponse.json({ ok: true, note: 'PROFILE actions acknowledged (no-op until schema wired)' });
  } else {
    return NextResponse.json({ ok: false, error: 'unsupported_target' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
