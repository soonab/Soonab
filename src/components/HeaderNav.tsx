// src/components/HeaderNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Item = { href: string; label: string };

const ITEMS: Item[] = [
  { href: '/',         label: 'Home' },
  { href: '/explore',  label: 'Explore' },   // lights up later
  { href: '/dm',       label: 'Direct Messages' },
  { href: '/me',       label: 'My profile' },
  { href: '/settings', label: 'Settings' },  // security polish in Step‑10
];

export default function HeaderNav() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="relative flex items-center gap-2">
      {/* Desktop (md+) segmented group */}
      <nav aria-label="Primary" className="hidden md:flex items-center gap-2">
        <div className="inline-flex rounded-[10px] border border-[var(--outline)] bg-[var(--surface-0)] shadow-sm overflow-hidden">
          {ITEMS.map((it, idx) => {
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'h-9 px-3.5 text-[13px] font-semibold flex items-center',
                  // separators
                  idx !== ITEMS.length - 1 ? 'border-r border-[var(--outline)]' : '',
                  // base colors
                  active
                    ? 'bg-[var(--brand-teal)] !text-white'
                    : 'text-[color:var(--ink-700)] hover:bg-[var(--surface-2)] hover:text-[color:var(--ink-900)]',
                ].join(' ')}
              >
                {it.label}
              </Link>
            );
          })}
        </div>

        <Link
          href="/about"
          className="h-9 px-3.5 text-[13px] font-medium flex items-center rounded-[10px]
                     border border-[var(--outline)] bg-[var(--surface-0)]
                     text-[color:var(--ink-700)]
                     hover:bg-[var(--surface-2)] hover:text-[color:var(--ink-900)]"
        >
          About
        </Link>
      </nav>

      {/* Mobile (under md) */}
      <button
        type="button"
        aria-controls="mobile-menu"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen(v => !v)}
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-[10px]
                   border border-[var(--outline)] bg-[var(--surface-0)]
                   text-[color:var(--ink-700)]"
      >
        <span aria-hidden>☰</span>
        <span className="sr-only">Menu</span>
      </button>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Primary"
          className="md:hidden absolute right-0 top-11 z-50 w-[min(92vw,320px)]
                     rounded-[12px] border border-[var(--outline)]
                     bg-[var(--surface-0)] shadow-[var(--shadow-md)] p-2"
        >
          {ITEMS.map(it => {
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'block rounded-[10px] px-2.5 py-2 font-semibold text-[13px]',
                  active
                    ? 'bg-[var(--brand-teal)] !text-white'
                    : 'text-[color:var(--ink-700)] hover:bg-[var(--surface-2)] hover:text-[color:var(--ink-900)]',
                ].join(' ')}
              >
                {it.label}
              </Link>
            );
          })}
          <div className="my-1 h-px bg-[var(--outline)]" />
          <Link
            href="/about"
            className="block rounded-[10px] px-2.5 py-2 font-medium
                       text-[13px] text-[color:var(--ink-700)]
                       hover:bg-[var(--surface-2)] hover:text-[color:var(--ink-900)]"
          >
            About
          </Link>
        </nav>
      )}
    </div>
  );
}
