// src/app/auth/email/EmailAuthClient.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EmailAuthClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const token = params.get("token");      // adjust to your param name
  const redirectTo = params.get("to") || "/";

  useEffect(() => {
    async function run() {
      if (!token) { setState("error"); return; }
      setState("verifying");
      try {
        // hit your existing verify endpoint
        const res = await fetch("/api/auth/request-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, redirectTo }),
        });
        if (!res.ok) throw new Error();
        setState("done");
        router.replace(redirectTo);
      } catch {
        setState("error");
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state === "verifying") return <div style={{padding:16}}>Signing you in…</div>;
  if (state === "error") return <div style={{padding:16}}>Link invalid or expired.</div>;
  return <div style={{padding:16}}>Preparing…</div>;
}
