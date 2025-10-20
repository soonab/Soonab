// src/app/auth/email/EmailAuthClient.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function EmailAuthClient() {
  const params = useSearchParams();
  const token = params.get("token");        // the magic link token
  const redirectTo = params.get("to") || "/";

  useEffect(() => {
    if (!token) return;

    // Full navigation so the API route can set httpOnly cookie correctly
    const url =
      `/api/auth/callback?token=${encodeURIComponent(token)}` +
      (redirectTo ? `&to=${encodeURIComponent(redirectTo)}` : "");
    window.location.replace(url);
  }, [token, redirectTo]);

  if (!token) return <div style={{ padding: 16 }}>Missing token.</div>;
  return <div style={{ padding: 16 }}>Signing you in…</div>;
}
