// src/components/RelationshipButtons.tsx
'use client'
import { useState } from 'react'

export default function RelationshipButtons({
  handle,
  initialFollowing,
  initialYouTrustThem,
  theyTrustYou,
  isOwner,
}: {
  handle: string
  initialFollowing: boolean
  initialYouTrustThem: boolean
  theyTrustYou: boolean
  isOwner: boolean
}) {
  const [following, setFollowing] = useState(initialFollowing)
  const [youTrustThem, setYouTrustThem] = useState(initialYouTrustThem)
  const [busy, setBusy] = useState(false)

  // You don't follow/trust yourself
  if (isOwner) return null

  async function toggleFollow() {
    if (busy) return
    setBusy(true)
    const url = following ? '/api/social/unfollow' : '/api/social/follow'
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    })
    setBusy(false)
    if (r.ok) setFollowing(!following)
  }

  async function toggleYouTrustThem() {
    if (busy) return
    setBusy(true)
    const url = youTrustThem ? '/api/social/untrust' : '/api/social/trust'
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    })
    setBusy(false)
    if (r.ok) setYouTrustThem(!youTrustThem)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleFollow}
        disabled={busy}
        className="rounded border px-2 py-1 text-xs disabled:opacity-50"
      >
        {following ? 'Following ✓' : 'Follow'}
      </button>

      <button
        onClick={toggleYouTrustThem}
        disabled={busy}
        className="rounded border px-2 py-1 text-xs disabled:opacity-50"
        title="Trust lets this profile see your TRUSTED posts"
      >
        {youTrustThem ? 'You trust ✓' : 'Trust'}
      </button>

      {theyTrustYou && (
        <span
          className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
          title="They have trusted you, so you can see their TRUSTED posts"
        >
          Trusted by @{handle}
        </span>
      )}
    </div>
  )
}
