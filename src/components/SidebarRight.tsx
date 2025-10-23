'use client';
import * as React from 'react';

export default function SidebarRight() {
  return (
    <div className="rail">
      {/* Explore Trends */}
      <div className="panel p-4">
        <h3 className="mb-2 font-semibold">Explore Trends</h3>
        <div className="trends-list">
          <div className="trend">#soonab</div><div className="count">1,680</div>
          <div className="trend">#glassUI</div><div className="count">892</div>
          <div className="trend">#chronological</div><div className="count">451</div>
        </div>
      </div>

      {/* Discover Spaces (glass style) */}
      <div className="glass p-4">
        <h3 className="mb-2 font-semibold">Discover Spaces</h3>

        <div className="mini-avatars mb-3">
          <img src="/icons/placeholder.png" alt="" />
          <img src="/icons/placeholder.png" alt="" />
          <img src="/icons/placeholder.png" alt="" />
        </div>

        <div className="text-sm text-[color:var(--ink-700)]">
          <div className="mb-2">
            <span className="font-medium">From "Design Inspiration" Feed</span>
            <span> — hosted by <a className="underline" href="/s/tech_lead">@tech_lead</a></span>
          </div>
          <button className="btn-ghost">View all</button>
        </div>
      </div>

      {/* Featured Spaces */}
      <div className="panel p-4">
        <h3 className="mb-2 font-semibold">Featured Spaces</h3>
        <div className="flex flex-wrap gap-8">
          <div className="flex flex-wrap gap-8">
            <a className="pill" href="/space/futuretech">#futuretech</a>
            <a className="pill" href="/space/design">#design</a>
            <a className="pill" href="/space/photography">#photography</a>
          </div>
        </div>
      </div>
    </div>
  );
}
