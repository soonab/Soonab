#!/usr/bin/env bash
set -euo pipefail

# --- Config ---------------------------------------------------------------
# You can override BASE like: BASE=http://127.0.0.1:3001 bash scripts/e2e_step5.sh
BASE="${BASE:-http://localhost:3000}"
A_JAR="${A_JAR:-/tmp/soonab_A.cookies}"
B_JAR="${B_JAR:-/tmp/soonab_B.cookies}"
BODY_TEXT="${BODY_TEXT:-e2e post from A #e2e}"

need() { command -v "$1" >/dev/null || { echo "Missing dependency: $1"; exit 1; }; }
need curl; need jq

say() { printf "\n— %s\n" "$1"; }
fail() { echo "❌ $1" >&2; exit 1; }

# --- Helper: pick port if 3000 is busy -----------------------------------
try_health() { curl -s "$1/api/health" | jq -r '.ok' 2>/dev/null || true; }

if [[ "$(try_health "$BASE")" != "true" ]]; then
  # common dev case: Next fell back to 3001
  if [[ "$BASE" == "http://localhost:3000" ]] && [[ "$(try_health "http://localhost:3001")" == "true" ]]; then
    BASE="http://localhost:3001"
    echo "ℹ️  Using fallback BASE=$BASE"
  else
    fail "Server not healthy at $BASE (try running: pnpm dev)"
  fi
fi

# --- Clean state ----------------------------------------------------------
rm -f "$A_JAR" "$B_JAR"

# --- 1) Health ------------------------------------------------------------
say "1) Health"
curl -s "$BASE/api/health" | jq .

# --- 2) Sign in A (magic link) -------------------------------------------
say "2) Sign in A (magic link)"
LINK_A=$(curl -s "$BASE/api/auth/request-link?email=e2e-a@example.com" | jq -r '.link')
[[ -n "$LINK_A" && "$LINK_A" != "null" ]] || fail "Could not get magic link for A"
curl -s -L "$LINK_A" -c "$A_JAR" -b "$A_JAR" >/dev/null
A_URL=$(curl -s -L -o /dev/null -w "%{url_effective}" "$BASE/me" -b "$A_JAR" -c "$A_JAR")
A_HANDLE="${A_URL##*/}"
[[ "$A_HANDLE" =~ ^nab- ]] || fail "Could not resolve A handle"
echo "   A handle: @$A_HANDLE"

# --- 3) Sign in B (magic link) -------------------------------------------
say "3) Sign in B (magic link)"
LINK_B=$(curl -s "$BASE/api/auth/request-link?email=e2e-b@example.com" | jq -r '.link')
[[ -n "$LINK_B" && "$LINK_B" != "null" ]] || fail "Could not get magic link for B"
curl -s -L "$LINK_B" -c "$B_JAR" -b "$B_JAR" >/dev/null
B_URL=$(curl -s -L -o /dev/null -w "%{url_effective}" "$BASE/me" -b "$B_JAR" -c "$B_JAR")
B_HANDLE="${B_URL##*/}"
[[ "$B_HANDLE" =~ ^nab- ]] || fail "Could not resolve B handle"
echo "   B handle: @$B_HANDLE"

# --- 4) A creates a post --------------------------------------------------
say "4) A creates a post"
CREATE_RES=$(curl -s -X POST "$BASE/api/posts" \
  -H 'Content-Type: application/json' \
  -d "{\"body\":\"$BODY_TEXT\"}" \
  -c "$A_JAR" -b "$A_JAR")
echo "$CREATE_RES" | jq '.ok,.post.id'
OK=$(echo "$CREATE_RES" | jq -r '.ok')
[[ "$OK" == "true" ]] || fail "Post create failed: $(echo "$CREATE_RES" | jq -c '.')"
POST_ID=$(echo "$CREATE_RES" | jq -r '.post.id')
[[ -n "$POST_ID" && "$POST_ID" != "null" ]] || fail "No POST_ID returned"

# --- 5) B replies to A (unlocks rating) -----------------------------------
say "5) B replies to A (satisfies interaction requirement)"
REPLY_RES=$(curl -s -X POST "$BASE/api/posts/$POST_ID/replies" \
  -H 'Content-Type: application/json' \
  -d '{"body":"e2e reply from B"}' \
  -c "$B_JAR" -b "$B_JAR")
echo "$REPLY_RES" | jq .
[[ "$(echo "$REPLY_RES" | jq -r '.ok')" == "true" ]] || fail "Reply failed: $(echo "$REPLY_RES" | jq -c '.')"

# --- small wait: let DB write settle for gates relying on recent activity --
sleep 0.5

# --- 6) B rates A (5★) ----------------------------------------------------
say "6) B rates A (5★)"
RATE_RES=$(curl -s -X POST "$BASE/api/reputation/rate" \
  -H 'Content-Type: application/json' \
  -d "{\"targetHandle\":\"$A_HANDLE\",\"value\":5}" \
  -c "$B_JAR" -b "$B_JAR")
echo "$RATE_RES" | jq .
if [[ "$(echo "$RATE_RES" | jq -r '.ok')" != "true" ]]; then
  ERR=$(echo "$RATE_RES" | jq -r '.error? // empty')
  [[ "$ERR" == "Interact (reply) before rating" ]] && fail "Gate still closed: server did not observe B's reply (check logs for /replies 200)"
  fail "Rating failed: $ERR"
fi

# --- 7) Get A's public score ---------------------------------------------
say "7) Get A's public score"
curl -s "$BASE/api/reputation/$A_HANDLE" | jq .

echo -e "\n✅ E2E finished. A=@$A_HANDLE  B=@$B_HANDLE"
