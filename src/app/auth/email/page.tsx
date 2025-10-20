// server-only placeholder so build can prerender safely
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function EmailAuthPage() {
  return null; // real verification happens via /api/auth/callback
}
