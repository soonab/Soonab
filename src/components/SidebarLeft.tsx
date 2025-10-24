'use client';
import * as React from 'react';

export default function SidebarLeft() {
  return (
    <div className="rail">
      {/* Menu */}
      <div className="panel p-4">
        <h3 className="mb-2 font-semibold">Menu</h3>
        <nav className="space-y-2 text-sm text-[color:var(--ink-700)]">
          <a className="underline block" href="/">Home</a>
          <a className="underline block" href="/explore">Explore</a>
          <a className="underline block" href="/profile">My profile</a>
          <a className="underline block" href="/collections">My collections</a>{/* ✅ new */}
          <a className="underline block" href="/settings">Settings</a>
        </nav>
      </div>

      {/* Shortcuts */}
      <div className="panel p-4">
        <h3 className="mb-2 font-semibold">Shortcuts</h3>
        <div className="flex flex-wrap gap-8">
          <div className="flex flex-col gap-2">
            <button className="pill">New post</button>
            <button className="pill">My posts</button>
            <button className="pill">Saved</button>
          </div>
          <div className="text-xs text-[color:var(--ink-500)] self-center">
            <div>⌘/ — Quick search</div>
            <div>⌘K — Command menu</div>
          </div>
        </div>
      </div>

      {/* My Communities */}
      <div className="panel p-4">
        <h3 className="mb-2 font-semibold">My Communities</h3>
        <ul className="space-y-2 text-sm text-[color:var(--ink-700)]">
          <li><a className="underline" href="/space/futuretech">#FutureTech</a></li>
          <li><a className="underline" href="/space/glassui">#GlassUI Design</a></li>
          <li><a className="underline" href="/space/local-hikers">Local Hikers</a></li>
        </ul>
      </div>
    </div>
  );
}
