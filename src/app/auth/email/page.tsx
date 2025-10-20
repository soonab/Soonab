// src/app/auth/email/page.tsx
import { Suspense } from "react";
import { Card } from "@/components/ui/card"; // if you don't have this, remove Card wrapper

export const dynamic = "force-dynamic"; // keeps auth callback dynamic & safe to prerender

export default function EmailAuthPage() {
  return (
    <Suspense fallback={<div style={{padding:16}}>Loading…</div>}>
      <EmailAuthClient />
    </Suspense>
  );
}

// NOTE: we import the client component below
import EmailAuthClient from "./EmailAuthClient";
