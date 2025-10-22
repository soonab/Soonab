/**
 * Step-14 static audit for Alinkah
 * - Verifies required files exist and export expected symbols
 * - Guards common pitfalls (wrong imports/paths)
 * - Creates minimal stubs if truly missing so the build can proceed (safe, additive)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const mustExist: Array<{file: string; why: string; template?: string}> = [
  {
    file: "src/lib/visibility.ts",
    why: "Field gating helper used by API and layout",
    template: `import type { Visibility } from '@prisma/client';
import { prisma } from '@/lib/db';
export async function canSeeField(required: Visibility, viewerPid: string | null, ownerPid: string): Promise<boolean> {
  if (viewerPid === ownerPid) return true;
  if (required === 'PUBLIC') return true;
  if (!viewerPid) return false;
  if (required === 'FOLLOWERS') {
    const follow = await prisma.follow.findFirst({ where: { followerProfileId: viewerPid, followeeProfileId: ownerPid }, select: { id: true } });
    return !!follow;
  }
  if (required === 'TRUSTED') {
    const trust = await prisma.trust.findFirst({ where: { trusterProfileId: ownerPid, trusteeProfileId: viewerPid }, select: { id: true } });
    return !!trust;
  }
  return false;
}
`
  },
  {
    file: "src/app/api/account/profile/route.ts",
    why: "Owner profile GET/PUT"
  },
  {
    file: "src/app/api/profile/[handle]/route.ts",
    why: "Public profile view (gated)"
  },
  {
    file: "src/app/api/account/verify/org/route.ts",
    why: "Org verification endpoint"
  },
  {
    file: "src/components/profile/VisibilitySelect.tsx",
    why: "UI shared select"
  },
  {
    file: "src/components/profile/ProfileEditor.tsx",
    why: "Settings editor UI"
  },
  {
    file: "src/components/profile/ProfilePanel.tsx",
    why: "Public panel UI"
  },
  {
    file: "src/app/s/[handle]/layout.tsx",
    why: "Injects profile panel above timeline"
  },
  {
    file: "prisma/schema.prisma",
    why: "Contains ProfileLink, OrgVerification, and profile columns"
  }
];

// Ensure file exists; if missing and template provided, create it
for (const item of mustExist) {
  const p = path.join(ROOT, item.file);
  if (!fs.existsSync(p)) {
    if (item.template) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, item.template);
      console.log(`➕ Created missing file: ${item.file}`);
    } else {
      console.error(`✖ Missing required file: ${item.file} (${item.why})`);
      process.exit(1);
    }
  } else {
    console.log(`✔ Found: ${item.file}`);
  }
}

// Quick content checks
const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
const needSnippets = [
  "model ProfileLink",
  "model OrgVerification",
  "enum OrgVerifyStatus",
  "enum OrgVerifyMethod",
  "bioVisibility",
  "locationVisibility"
];
for (const s of needSnippets) {
  if (!schema.includes(s)) {
    console.error(`✖ prisma/schema.prisma appears to be missing: ${s}`);
    process.exit(1);
  }
}
console.log("✔ Prisma schema looks like Step-14 ready");

// Verify common imports/exports
function mustContain(fp: string, substrings: string[]) {
  const full = path.join(ROOT, fp);
  const src = fs.readFileSync(full, "utf8");
  for (const sub of substrings) {
    if (!src.includes(sub)) {
      console.error(`✖ ${fp} missing required snippet: ${sub}`);
      process.exit(1);
    }
  }
  console.log(`✔ ${fp} content OK`);
}

mustContain("src/app/api/account/profile/route.ts", [
  "getCurrentProfileId",
  "requireCsrf",
  "requireJson",
  "z.object",
  "links: z.array"
]);

mustContain("src/app/api/profile/[handle]/route.ts", [
  "canSeeField",
  "orgVerifications"
]);

mustContain("src/components/profile/ProfileEditor.tsx", [
  "VisibilitySelect",
  "apiFetch",
  "OrgVerifyWidget"
]);

// Ensure db singleton (prevents dev connection storms)
const dbPath = "src/lib/db.ts";
const dbFull = path.join(ROOT, dbPath);
if (!fs.existsSync(dbFull)) {
  fs.mkdirSync(path.dirname(dbFull), { recursive: true });
  fs.writeFileSync(
    dbFull,
    `import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
`
  );
  console.log(`➕ Created ${dbPath} (prisma singleton)`);
}

// Ensure csrf client exists (used by ProfileEditor)
const csrfClientPath = "src/lib/csrf-client.ts";
const csrfClientFull = path.join(ROOT, csrfClientPath);
if (!fs.existsSync(csrfClientFull)) {
  fs.mkdirSync(path.dirname(csrfClientFull), { recursive: true });
  fs.writeFileSync(
    csrfClientFull,
    `export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  // Accept server-provided CSRF header if your middleware sets one; fallback to meta tag if present
  const token = (typeof document !== 'undefined')
    ? (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content
    : undefined;
  if (token && !headers.has('x-csrf')) headers.set('x-csrf', token);
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}
`
  );
  console.log(`➕ Created ${csrfClientPath}`);
}

// Gentle reminder about env
const envExample = path.join(ROOT, ".env.example");
if (fs.existsSync(envExample)) {
  const env = fs.readFileSync(envExample, "utf8");
  const hints = ["DATABASE_URL", "NEXT_PUBLIC_SITE_URL"];
  for (const h of hints) {
    if (!env.includes(h)) {
      console.warn(`! .env.example is missing ${h}`);
    }
  }
}

console.log("✓ Static checks complete");
