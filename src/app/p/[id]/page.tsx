// File: src/app/p/[id]/page.tsx
export const dynamic = 'force-dynamic';

import BodyText from '@/components/BodyText';
import AddToCollection from '@/components/collections/AddToCollection';
import { AttachmentGrid } from '@/components/media/AttachmentGrid';
import RateTarget from '@/components/reputation/RateTarget';
import ReplyComposer from '@/components/ReplyComposer';
import ReportButton from '@/components/ReportButton';
import ScoreBadge from '@/components/ScoreBadge';
import ShareMenu from '@/components/share/ShareMenu';
import { prisma } from '@/lib/db';
import { serializeAttachments, type VariantRecord } from '@/lib/media';

function meanToPercent(bm?: number | null): number | null {
  if (typeof bm !== 'number' || Number.isNaN(bm)) return null;
  const clamped = Math.max(0, Math.min(5, bm));
  return Math.round(((clamped / 5) * 100) * 10) / 10;
}

export default async function PostPermalink({ params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      media: { include: { media: { include: { variants: true } } } },
      replies: {
        where: { visibility: 'PUBLIC', state: 'ACTIVE' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          media: { include: { media: { include: { variants: true } } } },
        },
      },
    },
  });

  if (!post || post.state !== 'ACTIVE' || post.visibility !== 'PUBLIC') {
    return (
      <section className="panel p-6">
        <h1 className="text-xl font-bold mb-2">Post not found</h1>
        <p className="text-[14px] text-[color:var(--ink-700)]">This post is not available.</p>
      </section>
    );
  }

  const sids = Array.from(
    new Set([post.sessionId, ...post.replies.map((reply) => reply.sessionId)].filter(Boolean) as string[])
  );

  const [profiles, scores] = await Promise.all([
    sids.length
      ? prisma.sessionProfile.findMany({ where: { sessionId: { in: sids } } })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.sessionProfile.findMany>>),
    sids.length
      ? prisma.reputationScore.findMany({ where: { sessionId: { in: sids } } })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.reputationScore.findMany>>),
  ]);

  const bySid = new Map(profiles.map((profile) => [profile.sessionId, profile] as const));
  const scoreBySid = new Map(scores.map((score) => [score.sessionId, score] as const));

  const author = post.sessionId ? bySid.get(post.sessionId) ?? null : null;
  const handle = author?.handle ?? 'anon';
  const sc = post.sessionId ? scoreBySid.get(post.sessionId) ?? null : null;
  const initialMean = sc?.bayesianMean ?? null;

  const mediaRecords: VariantRecord[] = post.media.map((link) => ({
    id: link.mediaId,
    variants: link.media.variants.map((variant) => ({
      role: variant.role,
      key: variant.key,
      width: variant.width,
      height: variant.height,
      contentType: variant.contentType,
    })),
  }));
  const attachments = serializeAttachments(mediaRecords);

  const firstVariant = mediaRecords[0]?.variants?.find((variant) => variant.role === 'ORIGINAL')
    ?? mediaRecords[0]?.variants?.[0];
  const base = process.env.S3_PUBLIC_BASE_URL ?? '';
  const downloadUrl = firstVariant ? (base ? `${base}/${firstVariant.key}` : firstVariant.key) : undefined;

  return (
    <section className="space-y-6">
      <article className="feed-card">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <a className="underline" href={`/s/${handle}`}>@{handle}</a>
          <ScoreBadge bm={sc?.bayesianMean} count={sc?.count} />
          <RateTarget
            targetHandle={handle}
            targetProfileId={author?.id ?? null}
            initialPercent={meanToPercent(initialMean)}
            initialMean={initialMean}
          />
          <div className="ml-auto">
            <ShareMenu path={`/p/${post.id}`} title={post.body?.slice(0, 120)} downloadUrl={downloadUrl} />
          </div>
        </div>

        <BodyText text={post.body} />
        <AttachmentGrid attachments={attachments} />

        <div className="mt-2 text-xs text-gray-500">
          {new Date(post.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <ReportButton targetType="POST" targetId={post.id} />
          <AddToCollection postId={post.id} />
        </div>

        {post.replies.length > 0 && (
          <ul className="mt-3 space-y-2">
            {post.replies.map((reply) => {
              const replyProfile = reply.sessionId ? bySid.get(reply.sessionId) ?? null : null;
              const replyScore = reply.sessionId ? scoreBySid.get(reply.sessionId) ?? null : null;
              const replyHandle = replyProfile?.handle ?? 'anon';

              const replyMedia: VariantRecord[] = reply.media.map((link) => ({
                id: link.mediaId,
                variants: link.media.variants.map((variant) => ({
                  role: variant.role,
                  key: variant.key,
                  width: variant.width,
                  height: variant.height,
                  contentType: variant.contentType,
                })),
              }));
              const replyAttachments = serializeAttachments(replyMedia);

              return (
                <li key={reply.id} className="card" id={`reply-${reply.id}`}>
                  <div className="mb-1 flex items-center gap-2 text-[11px]">
                    <a className="underline" href={`/s/${replyHandle}`}>@{replyHandle}</a>
                    <ScoreBadge bm={replyScore?.bayesianMean} count={replyScore?.count} />
                    <div className="ml-auto">
                      <ShareMenu path={`/p/${post.id}#reply-${reply.id}`} title={reply.body?.slice(0, 120)} compact />
                    </div>
                  </div>

                  <BodyText text={reply.body} />
                  {replyAttachments.length > 0 ? <AttachmentGrid attachments={replyAttachments} /> : null}

                  <div className="mt-1 text-[11px] text-gray-500">
                    {new Date(reply.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <ReplyComposer postId={post.id} />
      </article>
    </section>
  );
}
