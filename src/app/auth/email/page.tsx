// src/app/auth/email/page.tsx
import { Suspense } from "react";
import dynamic from "next/dynamic";

// This page must stay dynamic (no static export), and it should not be cached
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Load the client component only on the client (avoids the Suspense warning)
const EmailAuthClient = dynamic(() => import("./EmailAuthClient"), { ssr: false });

export default function EmailAuthPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <EmailAuthClient />
    </Suspense>
  );
}
