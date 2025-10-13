// src/app/page.tsx
import { prisma } from '@/lib/db'
import Composer from '@/components/Composer'
import ReplyComposer from '@/components/ReplyComposer'
import ReportButton from '@/components/ReportButton'
import BodyText from '@/components/BodyText'
import ScoreBadge from '@/components/ScoreBadge'
import StarRater from '@/components/StarRater'

export default async function Home() {
  const posts = await prisma.post.findMany({
    where: { visibility: 'PUBLIC' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      replies: {
        where: { visibility: 'PUBLIC' },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Fetch pseudonymous profiles + reputation scores for all authors in feed
  const sids = Array.from(
    new Set(
      posts.flatMap((p) => [p.sessionId, ...p.replies.map((r) => r.sessionId)]).filter(Boolean) as string[]
    )
  )

  const profiles = await prisma.sessionProfile.findMany({ where: { sessionId: { in: sids } } })
  const scores   = await prisma.reputationScore.findMany({ where: { sessionId: { in: sids } } })

  const bySid = new Map(profiles.map((p) => [p.sessionId, p]))
  const scoreBySid = new Map(scores.map((s) => [s.sessionId, s]))

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-xl font-semibold mb-4">Soonab — alpha</h1>
        <Composer />
      </div>

      <ul className="space-y-6">
        {posts.map((p) => {
          const prof = p.sessionId ? bySid.get(p.sessionId) : null
          const sc   = p.sessionId ? scoreBySid.get(p.sessionId) : null
          const handle = prof?.handle ?? 'anon'

          return (
            <li key={p.id} className="feed-card">
              {/* Post header */}
              <div className="mb-1 flex items-center gap-2 text-xs">
                <a className="underline" href={`/s/${handle}`}>@{handle}</a>
                <ScoreBadge bm={sc?.bayesianMean} count={sc?.count} />
                <StarRater targetHandle={handle} />
              </div>

              {/* Post body */}
              <BodyText text={p.body} />

              {/* Post meta */}
              <div className="mt-2 text-xs text-gray-500">
                {new Date(p.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
              </div>

              <div className="mt-2">
                <ReportButton targetType="POST" targetId={p.id} />
              </div>

              {/* Replies */}
              {p.replies.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {p.replies.map((r) => {
                    const rp = r.sessionId ? bySid.get(r.sessionId) : null
                    const rs = r.sessionId ? scoreBySid.get(r.sessionId) : null
                    const rhandle = rp?.handle ?? 'anon'

                    return (
                      <li key={r.id} className="card">
                        <div className="mb-1 flex items-center gap-2 text-[11px]">
                          <a className="underline" href={`/s/${rhandle}`}>@{rhandle}</a>
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
                    )
                  })}
                </ul>
              )}

              {/* Reply composer */}
              <ReplyComposer postId={p.id} />
            </li>
          )
        })}

        {posts.length === 0 && <li className="text-sm text-gray-500">No nabs yet.</li>}
      </ul>
    </div>
  )
}
