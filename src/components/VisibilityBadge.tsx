// src/components/VisibilityBadge.tsx
import type { Visibility } from '@prisma/client'

export default function VisibilityBadge({ v }: { v: Visibility }) {
  if (v === 'PUBLIC') return null
  return <span className="badge">{v === 'FOLLOWERS' ? 'Followers' : 'Trusted'}</span>
}
