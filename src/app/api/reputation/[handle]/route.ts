import { NextResponse } from 'next/server';
import { getProfileByHandle } from '@/lib/identity';
import { getScore } from '@/lib/reputation';
import { quotasForScore } from '@/lib/reputation';

export async function GET(_: Request, { params }: { params: { handle: string }}) {
  const p = await getProfileByHandle(params.handle);
  if (!p) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  const s = await getScore(p.sessionId);
  const q = quotasForScore(s.bayesianMean || 0);
  return NextResponse.json({
    ok: true,
    profile: { handle: p.handle },
    score: { count: s.count, mean: s.mean, bayesianMean: s.bayesianMean, tier: q.tier }
  });
}
