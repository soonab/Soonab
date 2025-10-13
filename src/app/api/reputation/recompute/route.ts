import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeScore } from '@/lib/reputation';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const targets = await prisma.sessionProfile.findMany({ select: { sessionId: true } });
  for (const t of targets) {
    await recomputeScore(t.sessionId);
  }
  return NextResponse.json({ ok: true, updated: targets.length });
}
