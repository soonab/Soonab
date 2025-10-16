// src/app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import HeaderNav from '@/components/HeaderNav';
import HeaderAuthButton from '@/components/HeaderAuthButton';
import { SITE } from '@/lib/site';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

// ---------------------------
// Viewport (browser theme colour)
// ---------------------------
export const viewport: Viewport = {
  themeColor: '#2F7A7B',
};

// ---------------------------
// Metadata (SEO + OpenGraph + Icons)
// ---------------------------
export const metadata: Metadata = {
  title: SITE.name,
  description: SITE.tagline,
  applicationName: SITE.name,
  manifest: '/manifest.json',
  openGraph: {
    title: SITE.name,
    description: SITE.tagline,
    siteName: SITE.name,
  },
  icons: {
    // favicon + browser tab
    icon: [
      { url: '/brand/alinkah-icon-teal.svg', type: 'image/svg+xml' },
      { url: '/brand/alinkah-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/alinkah-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // Apple touch icons
    apple: [
      { url: '/brand/alinkah-icon-512.png', sizes: '512x512' },
      { url: '/brand/alinkah-icon-192.png', sizes: '192x192' },
    ],
    // Light/Dark variants (optional)
    other: [
      { rel: 'mask-icon', url: '/brand/alinkah-icon-white.svg', color: '#2F7A7B' },
    ],
  },
};

// ---------------------------
// Root Layout
// ---------------------------
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        style={{
          fontFamily:
            'var(--font-sans), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {/* --------------------- */}
        {/* Header / Brand Bar */}
        {/* --------------------- */}
        <header className="brandbar">
          <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center gap-4">
            {/* Wordmark logo */}
            <a href="/" className="brand" aria-label={`${SITE.name} home`}>
              <img
  src="/brand/alinkah-wordmark.svg"
  alt="Alinkah"
  className="h-[48px] md:h-[60px] w-auto block select-none"
/>

            </a>

            {/* Primary nav */}
            <div className="ml-2">
              <HeaderNav />
            </div>

            {/* Auth button on the far right */}
            <div className="ml-auto">
              <HeaderAuthButton />
            </div>
          </div>
        </header>

        {/* --------------------- */}
        {/* Main app grid layout */}
        {/* --------------------- */}
        <div className="mx-auto w-full max-w-[1200px] px-4 mt-header">
          <div className="app-grid">
            <aside className="sidebar hidden lg:block">
              <SidebarLeft />
            </aside>

            <main className="feed-col">{children}</main>

            <aside className="sidebar hidden xl:block">
              <SidebarRight />
            </aside>
          </div>
        </div>
      </body>
    </html>
  );
}
