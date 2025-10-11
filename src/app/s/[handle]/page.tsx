import { prisma } from '@/lib/db';
import { getProfileByHandle } from '@/lib/identity';
import { getScore, quotasForScore } from '@/lib/reputation';
import BodyText from '@/components/BodyText';
import ReportButton from '@/components/ReportButton';
import ReplyComposer from '@/components/ReplyComposer';
import ScoreBadge from '@/components/ScoreBadge';

export default async function ProfilePage({ params }: { params: { handle: string } }) {
  const profile = await getProfileByHandle(params.handle);
  if (!profile) return <main className="p-6">Not found</main>;

  const s = await getScore(profile.sessionId);
  const q = quotasForScore(s.bayesianMean || 0);

  const posts = await prisma.post.findMany({
    where: { sessionId: profile.sessionId, visibility: 'PUBLIC' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { replies: { where: { visibility: 'PUBLIC' }, orderBy: { createdAt: 'asc' } } },
  });

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold flex items-center gap-3">
        @{profile.handle} <ScoreBadge bm={s.bayesianMean} count={s.count} />
      </h1>
      <p className="text-xs text-gray-600">Tier {q.tier}: {q.postsPerDay} posts/day, {q.repliesPerDay} replies/day.</p>
      <ul className="mt-4 space-y-6">
        {posts.map(p => (
          <li key={p.id} className="rounded border p-3">
            <BodyText text={p.body} />
            <div className="mt-2 text-xs text-gray-500">
              {new Date(p.createdAt).toISOString().replace('T',' ').slice(0,19)} UTC
            </div>
            <div className="mt-2"><ReportButton targetType="POST" targetId={p.id} /></div>
            {p.replies.length > 0 && (
              <ul className="mt-3 space-y-2">
                {p.replies.map(r => (
                  <li key={r.id} className="rounded border p-2 bg-black/5">
                    <BodyText text={r.body} />
                    <div className="mt-1 text-[11px] text-gray-500">
                      {new Date(r.createdAt).toISOString().replace('T',' ').slice(0,19)} UTC
                    </div>
                    <div className="mt-1"><ReportButton targetType="REPLY" targetId={r.id} /></div>
                  </li>
                ))}
              </ul>
            )}
            <ReplyComposer postId={p.id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
