// src/app/page.tsx
export const dynamic = 'force-dynamic'; // respect cookies on each request

import { prisma } from '@/lib/db';
import Composer from '@/components/Composer';
import ReplyComposer from '@/components/ReplyComposer';
import ReportButton from '@/components/ReportButton';
import BodyText from '@/components/BodyText';
import ScoreBadge from '@/components/ScoreBadge';
import StarRater from '@/components/StarRater';
import LoginCtaCard from '@/components/LoginCtaCard';
import { AttachmentGrid } from '@/components/media/AttachmentGrid';
import { getAuthedUserId } from '@/lib/auth';
import { SITE } from '@/lib/site';
import { serializeAttachments } from '@/lib/media';

/**
 * Home = Public feed (chronological).
 * - PUBLIC only, newest-first
 * - Hide non-ACTIVE content (moderation)
 * - Replies PUBLIC-only for now
 *
 * Guardrails: see ARCHITECTURE.md + ADRs.
 * Chronological only (no ranking), private reactions, one public metric for quotas.
 */
export default async function Home() {
  // Determine signed-in state (used for CTA visibility)
  const uid = await getAuthedUserId();

  const posts = await prisma.post.findMany({
    where: { visibility: 'PUBLIC', state: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }, // strictly chronological
    take: 50,
    include: {
      replies: {
        where: { visibility: 'PUBLIC', state: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      },
      media: {
        include: {
          media: {
            include: { variants: true },
          },
        },
      },
    },
  });

  // Pseudonymous profiles + reputation scores for feed authors (legacy sessions path)
  const sids = Array.from(
    new Set(
      posts
        .flatMap((p) => [p.sessionId, ...p.replies.map((r) => r.sessionId)])
        .filter(Boolean) as string[]
    )
  );

  const profiles = sids.length
    ? await prisma.sessionProfile.findMany({ where: { sessionId: { in: sids } } })
    : [];
  const scores = sids.length
    ? await prisma.reputationScore.findMany({ where: { sessionId: { in: sids } } })
    : [];

  const bySid = new Map(profiles.map((p) => [p.sessionId, p]));
  const scoreBySid = new Map(scores.map((s) => [s.sessionId, s]));

  return (
    <div className="space-y-6">
     {/* Intro card */}
<div className="card">
  <div className="mb-2 flex items-center gap-3">
    <h1 className="text-2xl md:text-[28px] font-extrabold leading-tight tracking-tight text-[color:var(--brand-teal)]">
      {SITE.name}
    </h1>
    {SITE.stage && (
      <span className="badge select-none">{SITE.stage}</span>
    )}
  </div>

  <p className="text-[15px] text-[color:var(--ink-700)] mb-4">
    Real people. Real connection.
  </p>

  {/* Show sign-in CTA when signed out */}
  {!uid && (
    <div className="mb-4">
      <LoginCtaCard />
    </div>
  )}

  {/* Composer stays visible; moderation/quotas enforce posting rights */}
  <Composer />
</div>


      {/* Public feed (chronological) */}
      <ul className="space-y-6">
        {posts.map((p) => {
          const prof = p.sessionId ? bySid.get(p.sessionId) : null;
          const sc = p.sessionId ? scoreBySid.get(p.sessionId) : null;
          const handle = prof?.handle ?? 'anon';

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
            })),
          );

          return (
            <li key={p.id} className="feed-card">
              {/* Post header */}
              <div className="mb-1 flex items-center gap-2 text-xs">
                <a className="underline" href={`/s/${handle}`}>
                  @{handle}
                </a>
                <ScoreBadge bm={sc?.bayesianMean} count={sc?.count} />
                <StarRater targetHandle={handle} />
              </div>

              {/* Post body */}
              <BodyText text={p.body} />

              <AttachmentGrid attachments={attachments} />

              {/* Post meta */}
              <div className="mt-2 text-xs text-gray-500">
                {new Date(p.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
              </div>

              <div className="mt-2">
                <ReportButton targetType="POST" targetId={p.id} />
              </div>

              {/* Replies (PUBLIC-only for now) */}
              {p.replies.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {p.replies.map((r) => {
                    const rp = r.sessionId ? bySid.get(r.sessionId) : null;
                    const rs = r.sessionId ? scoreBySid.get(r.sessionId) : null;
                    const rhandle = rp?.handle ?? 'anon';

                    return (
                      <li key={r.id} className="card">
                        <div className="mb-1 flex items-center gap-2 text-[11px]">
                          <a className="underline" href={`/s/${rhandle}`}>
                            @{rhandle}
                          </a>
                          <ScoreBadge bm={rs?.bayesianMean} count={rs?.count} />
                          <StarRater targetHandle={rhandle} />
                        </div>

                        <BodyText text={r.body} />

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

              {/* Reply composer */}
              <ReplyComposer postId={p.id} />
            </li>
          );
        })}

        {posts.length === 0 && <li className="text-sm text-gray-500">No posts yet.</li>}
      </ul>
    </div>
  );
}
