// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import TopNav from '@/components/TopNav'
import SidebarLeft from '@/components/SidebarLeft'
import SidebarRight from '@/components/SidebarRight'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Soonab — alpha',
  description: 'Chronological, audience‑aware social.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-base text-foreground antialiased">
        {/* Atmospherics */}
        <div className="pointer-events-none fixed inset-0 -z-20 bg-gradient-to-b from-[rgba(255,255,255,0.06)] to-[rgba(0,0,0,0.4)]" />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_80%_-10%,rgba(255,255,255,0.08),transparent)]" />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(800px_400px_at_10%_0%,rgba(24,119,255,0.06),transparent)]" />

        {/* Fixed header */}
        <TopNav />

        {/* App grid (3 columns on large screens) */}
        <div className="mx-auto w-full max-w-[1200px] px-4 mt-header">
          <div className="app-grid">
            <aside className="sidebar hidden lg:block">
              <SidebarLeft />
            </aside>

            {/* Center feed column (your pages render here) */}
            <main className="feed-col">
              {children}
            </main>

            <aside className="sidebar hidden xl:block">
              <SidebarRight />
            </aside>
          </div>
        </div>
      </body>
    </html>
  )
}
