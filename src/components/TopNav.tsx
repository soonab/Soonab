// src/components/TopNav.tsx
import Link from 'next/link'

export default function TopNav() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-30 h-[var(--header-h)]"
      role="navigation"
      aria-label="Top"
    >
      <div className="mx-auto h-full w-full max-w-[1200px] px-4">
        <div
          className="glass flex h-full items-center justify-between px-4"
          style={{ backdropFilter: 'saturate(160%) blur(18px)' }}
        >
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-white/10" aria-hidden />
            <span className="text-sm font-semibold tracking-wide">Soonab — alpha</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/" className="btn-ghost text-xs">Home</Link>
            <Link href="/top" className="btn-ghost text-xs">Explore</Link>
            <Link href="/me" className="btn text-xs">My profile</Link>
            <Link href="/settings" className="btn-ghost text-xs">Settings</Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
