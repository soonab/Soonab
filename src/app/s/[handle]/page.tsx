// src/app/s/[handle]/page.tsx
import { prisma } from '@/lib/db'
import { getCurrentProfileId } from '@/lib/auth'
import BodyText from '@/components/BodyText'
import ReplyComposer from '@/components/ReplyComposer'
import ReportButton from '@/components/ReportButton'
import VisibilityBadge from '@/components/VisibilityBadge'
import RelationshipButtons from '@/components/RelationshipButtons'
import type { Visibility } from '@prisma/client'

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  // ✅ Next 15: params must be awaited
  const { handle } = await params
  const h = decodeURIComponent(handle).toLowerCase()
  const viewerPid = await getCurrentProfileId()

  // Prefer Profile (Step-5), fall back to legacy SessionProfile
  const profile = await prisma.profile.findUnique({ where: { handle: h } })
  if (profile) {
    // Determine allowed visibilities for the viewer
    let allowed: Visibility[] = ['PUBLIC']
    const isOwner = viewerPid === profile.id

    // Compute three relationships (when viewing someone else and signed in)
    const [youFollowThem, youTrustThem, theyTrustYou] =
      viewerPid && !isOwner
        ? await Promise.all([
            prisma.follow.findUnique({
              where: {
                followerProfileId_followingProfileId: {
                  followerProfileId: viewerPid!,
                  followingProfileId: profile.id,
                },
              },
              select: { followerProfileId: true },
            }).then(Boolean),
            prisma.trust.findUnique({
              where: {
                trusterProfileId_trusteeProfileId: {
                  trusterProfileId: viewerPid!,
                  trusteeProfileId: profile.id,
                },
              },
              select: { trusterProfileId: true },
            }).then(Boolean),
            prisma.trust.findUnique({
              where: {
                trusterProfileId_trusteeProfileId: {
                  trusterProfileId: profile.id,
                  trusteeProfileId: viewerPid!,
                },
              },
              select: { trusterProfileId: true },
            }).then(Boolean),
          ])
        : [false, false, false]

    if (isOwner) {
      allowed = ['PUBLIC', 'FOLLOWERS', 'TRUSTED']
    } else {
      if (youFollowThem) allowed.push('FOLLOWERS')
      if (theyTrustYou)  allowed.push('TRUSTED') // only author can grant you access to TRUSTED
    }

    const posts = await prisma.post.findMany({
      where: { profileId: profile.id, visibility: { in: allowed } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        // Keep replies simple for now: public-only
        replies: {
          where: { visibility: 'PUBLIC' },
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    })

    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">@{profile.handle}</h1>
          <RelationshipButtons
            handle={profile.handle}
            initialFollowing={youFollowThem}
            initialYouTrustThem={youTrustThem}
            theyTrustYou={theyTrustYou}
            isOwner={isOwner}
          />
        </div>

        <ul className="mt-6 space-y-6">
          {posts.map((p) => (
            <li key={p.id} className="rounded border p-3">
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="opacity-70">
                  {new Date(p.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
                </span>
                <VisibilityBadge v={p.visibility} />
              </div>
              <BodyText text={p.body} />
              <div className="mt-2">
                <ReportButton targetType="POST" targetId={p.id} />
              </div>

              {p.replies.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {p.replies.map((r) => (
                    <li key={r.id} className="rounded border p-2">
                      <BodyText text={r.body} />
                    </li>
                  ))}
                </ul>
              )}

              <ReplyComposer postId={p.id} />
            </li>
          ))}
          {posts.length === 0 && <li className="text-sm text-gray-500">No posts yet.</li>}
        </ul>
      </main>
    )
  }

  // Legacy: pseudonymous session handle → public-only
  const session = await prisma.sessionProfile.findFirst({ where: { handle: h } })
  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-semibold">@{h}</h1>
        <p className="mt-6 text-sm text-gray-500">Profile not found.</p>
      </main>
    )
  }

  const posts = await prisma.post.findMany({
    where: { sessionId: session.sessionId, visibility: 'PUBLIC' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      replies: {
        where: { visibility: 'PUBLIC' },
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
    },
  })

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold">@{session.handle}</h1>
      <ul className="mt-6 space-y-6">
        {posts.map((p) => (
          <li key={p.id} className="rounded border p-3">
            <BodyText text={p.body} />
            {p.replies.length > 0 && (
              <ul className="mt-3 space-y-2">
                {p.replies.map((r) => (
                  <li key={r.id} className="rounded border p-2">
                    <BodyText text={r.body} />
                  </li>
                ))}
              </ul>
            )}
            <ReplyComposer postId={p.id} />
          </li>
        ))}
        {posts.length === 0 && <li className="text-sm text-gray-500">No posts yet.</li>}
      </ul>
    </main>
  )
}
