// minimal example of the new visual shell; keep your existing props/JSX and
// just apply the classes shown here to match the mockup look.
export function FeedCardShell({ children }: { children: React.ReactNode }) {
  return (
    <article className="panel p-0 overflow-hidden">
      {/* header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* avatar, name/handle, rating chip live here */}
      </div>

      {/* body (text + media) */}
      <div className="px-4 pb-3">{children}</div>

      {/* actions */}
      <div className="flex items-center gap-8 px-4 py-3 border-t border-[var(--line)]">
        <button className="iconbtn" aria-label="Reply">↩︎</button>
        <button className="iconbtn" aria-label="Share">⤴︎</button>
        <button className="iconbtn" aria-label="More">⋯</button>
      </div>
    </article>
  );
}
