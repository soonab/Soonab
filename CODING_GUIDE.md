# Codex Task Template — Alinkah Project

This document defines how to create reliable, self-contained Codex tasks for the **Alinkah** project (Next.js 15 + Prisma + Vercel).  
It ensures every addition or edit can be committed safely with minimal errors and consistent build results.

---

## 🎯 Purpose
To standardise how Codex receives and processes edits in the Alinkah repository — keeping the app stable, secure, and aligned with project guardrails.

---

## 🧩 Codex Task Template

Use this template in a **new Codex task** whenever you add or edit functionality.

```
Title: feat(<area>): <short, clear summary of what this does>
File: <full path from repo root, e.g. src/app/api/posts/route.ts>

<full code here — from imports through to closing brace>

Check:
  • pnpm typecheck && pnpm build
  • (optional) pnpm prisma generate
  • (optional) curl -s http://localhost:3000/api/health | jq .
  • (optional) run the relevant test from TEST_PACK.md

Why:
  • Keeps in line with Step-<N> goal in ROADMAP.md
  • Preserves Step-10 security baseline (CSRF, same-origin, validation)
  • No feed order or visibility leaks (ADR-0002, ADR-0005)
  • Compatible with Alinkah’s chronological, privacy-first architecture
```

---

## ✅ Example

```
Title: feat(api): profile GET/PUT with per-field visibility
File: src/app/api/account/profile/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

// …full code block…

Check:
  • pnpm typecheck && pnpm build
  • curl -s http://localhost:3000/api/account/profile | jq .

Why:
  • Step-14 in ROADMAP.md — richer identity without clout
  • Respects ADR-0005 audience gating
  • Keeps Step-10 CSRF + same-origin enforcement intact
```

---

## 🧠 Best Practices for Codex Tasks

### File & Task Setup
- Each **New Task** should contain one complete functional change (1–2 files max).
- Always include **Title** and **File** — Codex uses these for commits.
- Avoid over 500 lines or 200 KB per paste (split if needed).
- If modifying multiple files: use one `File:` section per file.

### Validation Checklist
1. Run `pnpm typecheck` — ensures TypeScript correctness.  
2. Run `pnpm build` — validates Next.js app structure.  
3. If database-related:  
   - Run `pnpx prisma generate`  
   - Run `pnpx prisma migrate dev -n "<migration_name>"` locally **only** (Codex can’t access DB).  
4. If deploying via Vercel, migrations apply automatically through:  
   ```json
   "build": "pnpm prisma migrate deploy && next build --turbopack"
   ```

### Security & Architecture Guardrails
- **CSRF & Origin checks** required on every mutating route (see Step‑10).
- **Chronological feeds only** — no sorting by engagement (ADR‑0002).
- **Visibility gating enforced** for every audience layer (ADR‑0005).
- **Private reactions remain private** (ADR‑0003).
- **Reputation and quotas unchanged** unless the roadmap step specifies otherwise.

### Recommended Workflow
1. Create a new branch before starting a multi-step feature (e.g. `step14-profile-fields`).
2. For each code section, paste the relevant task template into Codex.
3. After Codex finishes and `pnpm typecheck` passes → click **Push**.
4. When all sections are complete, run full local checks:
   ```bash
   pnpm typecheck
   pnpm build
   pnpx prisma format
   pnpx prisma generate
   pnpm dev
   ```
5. Validate `/api/health` returns `{ ok: true, db: "connected" }`.

---

## 🛠 Suggested Files to Keep in Project Root for Codex Stability

Add (or verify) these exist and are up to date:

| File | Purpose |
|------|----------|
| `CODING_GUIDE.md` | (this document) — defines Codex task format and expectations |
| `RUNBOOK.md` | step-by-step dev and admin instructions |
| `TEST_PACK.md` | CLI smoke tests for each major step |
| `CHECKLIST.md` | internal build checklist before commits |
| `ROADMAP.md` | high-level steps (1–30) and acceptance criteria |
| `SECURITY.md` | CSRF, rate limits, secure headers, and secret handling |
| `.env.example` | baseline environment variable definitions |
| `.nvmrc` | lock Node version (20.x for local builds) |
| `.gitignore` | ensure `/node_modules` and `.env` are excluded |

---

## 🧱 Final Notes

- Codex cannot access your database or Neon directly; always run migrations locally.
- Always push generated Prisma migration files before deploying to Vercel.
- Commit messages should follow:  
  `feat(area): <summary>` or `fix(area): <summary>`
- Keep ADRs up to date for any behaviour changes.

---

_Last updated: October 2025_