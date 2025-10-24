import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';
import { randomUUID } from 'crypto';
import { getCurrentProfileId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ value: z.number().int().min(1).max(5) });

// --- Tunables from env with safe fallbacks
const PRIOR_MEAN   = Number(process.env.REP_PRIOR_MEAN ?? 3.4);
const PRIOR_WEIGHT = Number(process.env.REP_PRIOR_WEIGHT ?? 10);
const WEIGHT_MIN   = Number(process.env.REP_WEIGHT_MIN ?? 0.5);
const WEIGHT_MAX   = Number(process.env.REP_WEIGHT_MAX ?? 1.5);
const HALFLIFE_D   = Number(process.env.REP_RATING_HALFLIFE_DAYS ?? 0);
const REQ_INT_D    = Number(process.env.REP_REQUIRE_INTERACTION_DAYS ?? 0);
const GLOBAL_PER_H = Number(process.env.REP_RATING_GLOBAL_PER_HOUR ?? 8);
const PAIR_CD_H    = Number(process.env.REP_RATING_PAIR_COOLDOWN_HOURS ?? 24);
const BRIG_WIN_M   = Number(process.env.REP_BRIGADE_WINDOW_MIN ?? 60);
const BRIG_MIN     = Number(process.env.REP_BRIGADE_MIN_RATERS ?? 6);

function pctFromMean(mean: number) {
  const clamped = Math.max(0, Math.min(5, mean));
  return Math.round(((clamped / 5) * 100) * 10) / 10;
}
function decayFactor(createdAt: Date, halflifeDays: number) {
  if (!halflifeDays || halflifeDays <= 0) return 1;
  const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(2, -ageDays / halflifeDays);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  await cookies(); // next15 dynamic marker

  const { id: postId } = await ctx.params;
  const { value } = BodySchema.parse(await requireJson(req));

  // Ensure rater session
  const jar = await cookies();
  let sid = jar.get('sid')?.value as string | undefined;
  let setCookie = false;
  if (!sid) { sid = randomUUID(); setCookie = true; }

  // Optional signed-in profile (for stronger uniqueness)
  const raterProfileId = await getCurrentProfileId(); // string | null

  // Validate target post
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, sessionId: true, state: true, visibility: true },
  });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (post.state !== 'ACTIVE' || post.visibility !== 'PUBLIC') {
    return NextResponse.json({ error: 'Cannot rate this post' }, { status: 400 });
  }
  if (post.sessionId && post.sessionId === sid) {
    return NextResponse.json({ error: 'You cannot rate your own post' }, { status: 403 });
  }
  const authorSid = post.sessionId ?? null;

  // One-vote-only (same post) — DB uniqueness also enforces this
  const already = await prisma.postRating.findFirst({
    where: {
      postId,
      OR: [
        { raterSessionId: sid! },
        ...(raterProfileId ? [{ raterProfileId }] as const : []),
      ],
    },
    select: { id: true },
  });
  if (already) {
    // Return current author score for UI + locked=true
    const cur = authorSid
      ? await prisma.reputationScore.findUnique({ where: { sessionId: authorSid }, select: { bayesianMean: true } })
      : null;
    const bm = typeof cur?.bayesianMean === 'number' ? cur!.bayesianMean : PRIOR_MEAN;
    const pct = pctFromMean(bm);
    const res = NextResponse.json({ ok: true, scorePercent: pct, bayesianMean: bm, locked: true }, { status: 409 });
    if (setCookie) res.cookies.set('sid', sid!, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // Global per-hour rate limit
  if (GLOBAL_PER_H > 0) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.postRating.count({
      where: {
        raterSessionId: sid!,
        createdAt: { gte: hourAgo },
      },
    });
    if (recentCount >= GLOBAL_PER_H) {
      return NextResponse.json({ error: 'Rating limit reached, try later' }, { status: 429 });
    }
  }

  // Pair cooldown: same rater (sid/profile) hitting same author within window
  if (PAIR_CD_H > 0 && authorSid) {
    const since = new Date(Date.now() - PAIR_CD_H * 60 * 60 * 1000);
    const hitSameAuthor = await prisma.postRating.findFirst({
      where: {
        createdAt: { gte: since },
        OR: [
          { raterSessionId: sid! },
          ...(raterProfileId ? [{ raterProfileId }] as const : []),
        ],
        post: { sessionId: authorSid },
      },
      select: { id: true },
    });
    if (hitSameAuthor) {
      return NextResponse.json({ error: 'Cooldown before rating this author again' }, { status: 429 });
    }
  }

  // Require recent interaction? (replies in the last N days)
  if (REQ_INT_D > 0 && authorSid) {
    const since = new Date(Date.now() - REQ_INT_D * 24 * 60 * 60 * 1000);
    const interacted = await prisma.reply.findFirst({
      where: {
        createdAt: { gte: since },
        OR: [
          // Rater replied to author's post
          { sessionId: sid!, post: { sessionId: authorSid } },
          // Author replied to rater's post
          { sessionId: authorSid, post: { sessionId: sid! } },
        ],
      },
      select: { id: true },
    });
    if (!interacted) {
      return NextResponse.json({ error: 'Rating requires recent interaction' }, { status: 403 });
    }
  }

  // Determine rater weight from rater's own reputation (Nosedive mapping)
  const raterScore = await prisma.reputationScore.findUnique({
    where: { sessionId: sid! },
    select: { bayesianMean: true },
  });
  const raterMean = typeof raterScore?.bayesianMean === 'number' ? raterScore!.bayesianMean : PRIOR_MEAN;
  const weight = WEIGHT_MIN + (Math.max(0, Math.min(5, raterMean)) / 5) * (WEIGHT_MAX - WEIGHT_MIN);
  const weightedValue = weight * value;

  // Write rating + recompute author's reputation
  const out = await prisma.$transaction(async (tx) => {
    await tx.postRating.create({
      data: {
        postId,
        raterSessionId: sid!,
        raterProfileId: raterProfileId ?? null,
        value,
        weight,
        weightedValue,
      },
    });

    if (!authorSid) {
      return { bayesianMean: null as number | null, scorePercent: null as number | null };
    }

    // Gather all posts authored by this session
    const authoredIds = await tx.post.findMany({
      where: { sessionId: authorSid },
      select: { id: true },
    }).then((rows) => rows.map((r) => r.id));

    if (authoredIds.length === 0) {
      const bm = PRIOR_MEAN;
      const pct = pctFromMean(bm);
      await tx.reputationScore.upsert({
        where: { sessionId: authorSid },
        update: { bayesianMean: bm, count: 0, sum: 0, mean: 0 },
        create: { sessionId: authorSid, bayesianMean: bm, count: 0, sum: 0, mean: 0 },
      });
      return { bayesianMean: bm, scorePercent: pct };
    }

    let bm: number;
    if (HALFLIFE_D > 0) {
      // Time-decay path: fetch rows, compute decayed sums
      const rows = await tx.postRating.findMany({
        where: { postId: { in: authoredIds } },
        select: { weight: true, value: true, createdAt: true },
      });
      let sumWd = 0;
      let sumWVd = 0;
      for (const r of rows) {
        const d = decayFactor(r.createdAt, HALFLIFE_D);
        sumWd += r.weight * d;
        sumWVd += r.weight * r.value * d;
      }
      bm = (PRIOR_MEAN * PRIOR_WEIGHT + sumWVd) / (PRIOR_WEIGHT + sumWd);
    } else {
      // Fast aggregate
      const agg = await tx.postRating.aggregate({
        where: { postId: { in: authoredIds } },
        _sum: { weight: true, weightedValue: true },
      });
      const sumW = agg._sum.weight ?? 0;
      const sumWV = agg._sum.weightedValue ?? 0;
      bm = (PRIOR_MEAN * PRIOR_WEIGHT + sumWV) / (PRIOR_WEIGHT + sumW);
    }
    const pct = pctFromMean(bm);

    await tx.reputationScore.upsert({
      where: { sessionId: authorSid },
      update: { bayesianMean: bm },
      create: { sessionId: authorSid, bayesianMean: bm, count: 0, sum: 0, mean: 0 },
    });

    // Brigade detector (flag only)
    if (BRIG_WIN_M > 0 && BRIG_MIN > 0) {
      const since = new Date(Date.now() - BRIG_WIN_M * 60 * 1000);
      const distinctRaters = await tx.postRating.findMany({
        where: { createdAt: { gte: since }, post: { sessionId: authorSid } },
        select: { raterSessionId: true },
        distinct: ['raterSessionId'],
      });
      if (distinctRaters.length >= BRIG_MIN) {
        await tx.reputationFlag.create({
          data: {
            targetSessionId: authorSid,
            windowStart: since,
            windowEnd: new Date(),
            reason: `brigade_suspected_${distinctRaters.length}`,
            count: distinctRaters.length,
          },
        });
      }
    }

    return { bayesianMean: bm, scorePercent: pct };
  });

  const res = NextResponse.json({ ok: true, ...out, locked: true }, { status: 201 });
  if (setCookie) {
    res.cookies.set('sid', sid!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
