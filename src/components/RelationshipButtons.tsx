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
  const [error, setError] = useState<string | null>(null)

  // You don't follow/trust yourself
  if (isOwner) return null

  async function mutateRelationship(url: string, onSuccess: () => void) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      })
      const data: { ok?: boolean; error?: string } | null = await res
        .json()
        .catch(() => null)

      if (!res.ok || data?.ok === false) {
        setError(data?.error || 'Unable to update relationship. Please try again.')
        return
      }

      onSuccess()
    } catch (err) {
      console.error('Failed to update relationship', err)
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleFollow() {
    const url = following ? '/api/social/unfollow' : '/api/social/follow'
    await mutateRelationship(url, () => setFollowing(!following))
  }

  async function toggleYouTrustThem() {
    const url = youTrustThem ? '/api/social/untrust' : '/api/social/trust'
    await mutateRelationship(url, () => setYouTrustThem(!youTrustThem))
  }

  return (
    <div className="flex flex-col gap-2">
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

      {error && (
        <p className="text-xs text-red-500" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}
