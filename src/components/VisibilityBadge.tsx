// src/components/VisibilityBadge.tsx
import type { Visibility } from '@prisma/client'

export default function VisibilityBadge({ v }: { v: Visibility }) {
  if (v === 'PUBLIC') return null
  return (
    <span className="ml-2 inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
      {v === 'FOLLOWERS' ? 'Followers' : 'Trusted'}
    </span>
  )
}
