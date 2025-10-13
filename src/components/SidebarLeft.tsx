// src/components/SidebarLeft.tsx
import Link from 'next/link'

export default function SidebarLeft() {
  return (
    <div className="space-y-3">
      <div className="card">
        <div className="text-sm font-semibold mb-2">Menu</div>
        <nav className="space-y-1">
          <Link className="btn-ghost w-full justify-start" href="/">Home</Link>
          <Link className="btn-ghost w-full justify-start" href="/top">Explore</Link>
          <Link className="btn-ghost w-full justify-start" href="/me">My profile</Link>
          <Link className="btn-ghost w-full justify-start" href="/settings">Settings</Link>
        </nav>
      </div>
      <div className="card">
        <div className="text-sm font-semibold">Shortcuts</div>
        <ul className="mt-2 text-sm text-muted space-y-1">
          <li>⌘/ — Quick search</li>
          <li>⌘K — Command menu</li>
        </ul>
      </div>
    </div>
  )
}
