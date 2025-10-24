// File: src/app/page.tsx
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import Composer from '@/components/Composer';
import ReplyComposer from '@/components/ReplyComposer';
import ReportButton from '@/components/ReportButton';
import BodyText from '@/components/BodyText';
import ScoreBadge from '@/components/ScoreBadge';
import RateTarget from '@/components/reputation/RateTarget';
import RateReplyStars from '@/components/reputation/RateReplyStars';
import LoginCtaCard from '@/components/LoginCtaCard';
import { AttachmentGrid } from '@/components/media/AttachmentGrid';
import AddToCollection from '@/components/collections/AddToCollection';
import { getAuthedUserId } from '@/lib/auth';
import { SITE } from '@/lib/site';
import { serializeAttachments } from '@/lib/media';
import { cookies } from 'next/headers';

/** Convert Bayesian mean (0..5) to percent (0..100) with one decimal. */
function meanToPercent(bm?: number | null): number | null {
  if (typeof bm !== 'number' || Number.isNaN(bm)) return null;
  const clamped = Math.max(0, Math.min(5, bm));
  return Math.round(((clamped / 5) * 100) * 10) / 10;
}

export default async function Home() {
  const uid = await getAuthedUserId();

  const posts = await prisma.post.findMany({
    where: { visibility: 'PUBLIC', state: 'ACTIVE' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
    include: {
      replies: {
        where: { visibility: 'PUBLIC', state: 'ACTIVE' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          media: { include: { media: { include: { variants: true } } } }, // <- reply images
        },
      },
      media: { include: { media: { include: { variants: true } } } },     // <- post images
    },
  });

  // Collect sessionIds to map handles + reputation
  const sids = Array.from(
    new Set(posts.flatMap((p) => [p.sessionId, ...p.replies.map((r) => r.sessionId)]).filter(Boolean) as string[])
  );

  const [profiles, scores] = await Promise.all([
    sids.length
      ? prisma.sessionProfile.findMany({ where: { sessionId: { in: sids } } })
      : Promise.resolve([] as any[]),
    sids.length
      ? prisma.reputationScore.findMany({ where: { sessionId: { in: sids } } })
      : Promise.resolve([] as any[]),
  ]);

  const bySid = new Map(profiles.map((p: any) => [p.sessionId, p]));
  const scoreBySid = new Map(scores.map((s: any) => [s.sessionId, s]));

  // Viewer session to pre-lock ratings on replies
  const jar = await cookies();
  const viewerSid = jar.get('sid')?.value ?? null;

  const replyIds = posts.flatMap((p) => p.replies.map((r) => r.id));
  const ratedRepliesSet = new Set<string>(
    viewerSid && replyIds.length
      ? (await prisma.replyRating.findMany({
          where: { raterSessionId: viewerSid, replyId: { in: replyIds } },
          select: { replyId: true },
        })).map((x) => x.replyId)
      : []
  );

  return (
    <section className="space-y-6">
      {/* Intro panel */}
      <div className="panel p-6">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl md:text-[28px] font-extrabold leading-tight tracking-tight text-[color:var(--brand-teal)]">
            {SITE.name}
          </h1>
          {SITE.stage && <span className="badge select-none">{SITE.stage}</span>}
        </div>

        <p className="text-[15px] text-[color:var(--ink-700)] mb-4">
          Real people. Real connection.
        </p>

        {!uid && (
          <div className="mb-4">
            <LoginCtaCard />
          </div>
        )}

        <div className="composer">
          <Composer />
        </div>
      </div>

      {/* Chronological feed */}
      <ul className="space-y-6">
        {posts.map((p) => {
          const prof = p.sessionId ? bySid.get(p.sessionId) : null;
          const sc = p.sessionId ? scoreBySid.get(p.sessionId) : null;
          const handle: string = prof?.handle ?? 'anon';
          const targetProfileId: string | null = prof?.id ?? null;

          const initialMean = sc?.bayesianMean ?? null;
          const initialPercent = meanToPercent(initialMean);

          const attachments = serializeAttachments(
            p.media.map((link) => ({
              id: link.mediaId,
              variants: link.media.variants.map((v) => ({
                role: v.role,
                key: v.key,
                width: v.width,
                height: v.height,
                contentType: v.contentType,
              })),
            }))
          );

          return (
            <li key={p.id} className="feed-card">
              <div className="mb-1 flex items-center gap-2 text-xs">
                <a className="underline" href={`/s/${handle}`}>@{handle}</a>
                <ScoreBadge bm={sc?.bayesianMean} count={sc?.count} />
                <RateTarget
                  targetHandle={handle}
                  targetProfileId={targetProfileId}
                  initialPercent={initialPercent}
                  initialMean={initialMean}
                />
              </div>

              <BodyText text={p.body} />
              <AttachmentGrid attachments={attachments} />

              <div className="mt-2 text-xs text-gray-500">
                {new Date(p.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <ReportButton targetType="POST" targetId={p.id} />
                <AddToCollection postId={p.id} />
              </div>

              {p.replies.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {p.replies.map((r) => {
                    const rp = r.sessionId ? bySid.get(r.sessionId) : null;
                    const rs = r.sessionId ? scoreBySid.get(r.sessionId) : null;
                    const rhandle: string = rp?.handle ?? 'anon';
                    const rIsOwn = Boolean(viewerSid && r.sessionId && viewerSid === r.sessionId);
                    const rInitialLocked = ratedRepliesSet.has(r.id) || rIsOwn;

                    const rAttachments = serializeAttachments(
                      r.media.map((link) => ({
                        id: link.mediaId,
                        variants: link.media.variants.map((v) => ({
                          role: v.role,
                          key: v.key,
                          width: v.width,
                          height: v.height,
                          contentType: v.contentType,
                        })),
                      }))
                    );

                    return (
                      <li key={r.id} className="card">
                        <div className="mb-1 flex items-center gap-2 text-[11px]">
                          <a className="underline" href={`/s/${rhandle}`}>@{rhandle}</a>
                          <ScoreBadge bm={rs?.bayesianMean} count={rs?.count} />
                          {/* ⭐ Rate the reply */}
                          <RateReplyStars replyId={r.id} initialLocked={rInitialLocked} disabled={rIsOwn} />
                        </div>

                        <BodyText text={r.body} />
                        <AttachmentGrid attachments={rAttachments} />

                        <div className="mt-1 text-[11px] text-gray-500">
                          {new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
                        </div>
                        <div className="mt-1">
                          <ReportButton targetType="REPLY" targetId={r.id} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <ReplyComposer postId={p.id} />
            </li>
          );
        })}

        {posts.length === 0 && <li className="text-sm text-gray-500">No posts yet.</li>}
      </ul>
    </section>
  );
}
