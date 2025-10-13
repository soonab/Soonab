#!/usr/bin/env bash
set -euo pipefail

# Base URL (override with: BASE=http://127.0.0.1:3000 bash scripts/e2e_step5.sh)
BASE="${BASE:-http://localhost:3000}"

# Separate cookie jars = separate users
A_JAR="${A_JAR:-/tmp/soonab_A.cookies}"
B_JAR="${B_JAR:-/tmp/soonab_B.cookies}"

need() { command -v "$1" >/dev/null || { echo "Missing dependency: $1"; exit 1; }; }
need curl
need jq

# Clean old cookies
rm -f "$A_JAR" "$B_JAR"

say() { printf "\n— %s\n" "$1"; }

say "1) Health"
curl -s "$BASE/api/health" | jq

say "2) Sign in A (magic link)"
LINK_A=$(curl -s "$BASE/api/auth/request-link?email=e2e-a@example.com" | jq -r '.link')
# Follow the link to set cookies for A
curl -s -L "$LINK_A" -c "$A_JAR" -b "$A_JAR" >/dev/null
# Find A's profile URL after redirect
A_URL=$(curl -s -L -o /dev/null -w "%{url_effective}" "$BASE/me" -b "$A_JAR" -c "$A_JAR")
A_HANDLE="${A_URL##*/}"
echo "   A handle: @$A_HANDLE"

say "3) Sign in B (magic link)"
LINK_B=$(curl -s "$BASE/api/auth/request-link?email=e2e-b@example.com" | jq -r '.link')
curl -s -L "$LINK_B" -c "$B_JAR" -b "$B_JAR" >/dev/null
B_URL=$(curl -s -L -o /dev/null -w "%{url_effective}" "$BASE/me" -b "$B_JAR" -c "$B_JAR")
B_HANDLE="${B_URL##*/}"
echo "   B handle: @$B_HANDLE"

say "4) A creates a post"
curl -s -X POST "$BASE/api/posts" \
  -H 'Content-Type: application/json' \
  -d '{"body":"e2e post from A #e2e"}' \
  -c "$A_JAR" -b "$A_JAR" | jq '.ok,.post.id'

# Fetch latest post id from the public feed (reverse-chrono)
POST_ID=$(curl -s "$BASE/api/posts" | jq -r '.posts[0].id')
echo "   POST_ID=$POST_ID"

say "5) B replies to A (satisfies interaction requirement)"
curl -s -X POST "$BASE/api/posts/$POST_ID/replies" \
  -H 'Content-Type: application/json' \
  -d '{"body":"e2e reply from B"}' \
  -c "$B_JAR" -b "$B_JAR" | jq

say "6) B rates A (5★)"
curl -s -X POST "$BASE/api/reputation/rate" \
  -H 'Content-Type: application/json' \
  -d "{\"targetHandle\":\"$A_HANDLE\",\"value\":5}" \
  -c "$B_JAR" -b "$B_JAR" | jq

say "7) Get A's public score"
curl -s "$BASE/api/reputation/$A_HANDLE" | jq

echo -e "\n✅ E2E finished. A=@$A_HANDLE  B=@$B_HANDLE"
