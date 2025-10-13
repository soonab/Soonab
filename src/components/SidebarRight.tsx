// src/components/SidebarRight.tsx
export default function SidebarRight() {
  return (
    <div className="space-y-3">
      <div className="card">
        <div className="text-sm font-semibold">Now</div>
        <p className="mt-2 text-sm text-muted">
          This panel can host trends, admin notes, or step‑by‑step onboarding.
        </p>
      </div>
      <div className="card">
        <div className="text-sm font-semibold">Trends</div>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="flex justify-between">
            <span>#soonab</span><span className="text-muted">1,204</span>
          </li>
          <li className="flex justify-between">
            <span>#glassUI</span><span className="text-muted">782</span>
          </li>
          <li className="flex justify-between">
            <span>#chronological</span><span className="text-muted">341</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
