#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
KEY="${ADMIN_KEY:-dev}"

need() { command -v "$1" >/dev/null || { echo "Missing dependency: $1"; exit 1; }; }
need curl
need jq

A_COOKIES="${TMPDIR:-/tmp}/alinkah-a.cookies"
rm -f "$A_COOKIES"

echo "=== Step-8 E2E: OAuth + Magic-link + Cookies ==="

# 1) Health
echo "- Checking /api/health"
curl -fsS "$BASE/api/health" | jq -e '.ok==true' >/dev/null || { echo "❌ /api/health not OK"; exit 1; }
echo "  ✅ Health OK"

# 2) Google start redirect (no need to follow to Google; just verify Location)
echo "- Checking /api/auth/google redirect"
HEADERS=$(curl -s -D - -o /dev/null "$BASE/api/auth/google")
STATUS=$(echo "$HEADERS" | awk 'toupper($1$2)=="HTTP/1.1"||toupper($1$2)=="HTTP/2" {print $2}')
LOC=$(echo "$HEADERS" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r')
[[ "$STATUS" == "302" || "$STATUS" == "307" ]] || { echo "❌ Unexpected status: $STATUS"; exit 1; }
case "$LOC" in
  https://accounts.google.com/*) echo "  ✅ Google start Location OK";;
  *) echo "  ⚠️  Location unexpected: $LOC (check GOOGLE_CLIENT_ID/SECRET)";;
esac

# 3) Magic-link sign-in (creates user+profile immediately)
echo "- Magic link sign-in for A"
LINK_A=$(curl -fsS "$BASE/api/auth/request-link?email=e2e-a@example.com" | jq -r '.link')
[[ "$LINK_A" != "null" && -n "$LINK_A" ]] || { echo "❌ request-link failed"; exit 1; }
curl -fsSL -c "$A_COOKIES" -b "$A_COOKIES" "$LINK_A" >/dev/null

# Confirm authed user + profile mapping
WHO=$(curl -fsS -b "$A_COOKIES" "$BASE/api/debug/whoami")
UID=$(echo "$WHO" | jq -r '.uid // ""')
PID=$(echo "$WHO" | jq -r '.pid // ""')
[[ -n "$UID" && -n "$PID" ]] || { echo "❌ whoami missing uid/pid"; echo "$WHO" | jq; exit 1; }
echo "  ✅ Signed in as uid=$UID pid=$PID"

# 4) Create post as A
echo "- Creating post as A"
POST_ID=$(curl -fsS -X POST "$BASE/api/posts" \
  -H 'Content-Type: application/json' \
  -d '{"body":"step8 e2e post"}' \
  -b "$A_COOKIES" | jq -r '.post.id')
[[ -n "$POST_ID" && "$POST_ID" != "null" ]] || { echo "❌ post create failed"; exit 1; }
echo "  ✅ Post id: $POST_ID"

# 5) Sign out and confirm
echo "- Signing out"
curl -fsS -X POST "$BASE/api/auth/signout" -b "$A_COOKIES" >/dev/null
UID2=$(curl -fsS -b "$A_COOKIES" "$BASE/api/debug/whoami" | jq -r '.uid // ""')
[[ -z "$UID2" ]] && echo "  ✅ Signed out cleanly" || { echo "❌ signout failed"; exit 1; }

echo "🎉 All Step-8 checks passed."
