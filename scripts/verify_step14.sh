#!/usr/bin/env bash
set -euo pipefail

echo "== Step-14: static audit =="
pnpx tsx scripts/step14_audit.ts

echo "== TypeScript =="
pnpm typecheck

echo "== Build =="
pnpm build

echo "== Summary =="
echo "✔ Static audit passed"
echo "✔ Typecheck passed"
echo "✔ Build passed"
