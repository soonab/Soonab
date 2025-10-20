#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Config & helpers
# -----------------------------
BASE_DEFAULT="${BASE:-http://localhost:3000}"
KEY="${ADMIN_KEY:-dev}"
TMPDIR="${TMPDIR:-/tmp}"
COOKIES="${TMPDIR}/alinkah.cookies"
UA="alinkah-e2e/step11"
EMAIL="e2e+$(date +%s)@example.com"
BODY="hello world #alinkah #testing"
TAG="alinkah"
JQ="${JQ:-jq}"

need() { command -v "$1" >/dev/null || { echo "Missing dependency: $1"; exit 1; }; }
need curl
need "$JQ"

rm -f "$COOKIES"

# Probe 3000 then 3001 so dev server port mismatches don’t trip us up.
probe_base() {
  local b1="$BASE_DEFAULT"
  local b2="http://localhost:3001"
  if curl -fsS "$b1/api/health" >/dev/null 2>&1; then echo "$b1"; return; fi
  if curl -fsS "$b2/api/health" >/dev/null 2>&1; then echo "$b2"; return; fi
  echo "❌ Neither $b1 nor $b2 reachable" >&2
  exit 1
}
BASE="$(probe_base)"

log() { printf "%s\n" "$*"; }
pass() { printf "  ✅ %s\n" "$*"; }
fail() { printf "  ❌ %s\n" "$*" >&2; exit 1; }

# curl wrapper: keep cookies, set UA, surface non-2xx as failures, optional retries
req() {
  local method="$1"; shift
  local url="$1"; shift
  local retries="${RETRIES:-3}"
  local delay=0.5

  for ((i=1; i<=retries; i++)); do
    if out=$(curl -sS -X "$method" "$url" \
      -b "$COOKIES" -c "$COOKIES" \
      -H "User-Agent: $UA" \
      "$@" \
      --write-out "\n%{http_code}" ); then
      code="${out##*$'\n'}"
      body="${out%$'\n'*}"
      if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
        echo "$body"
        return 0
      fi
      # Allow 307/302 for redirects when we explicitly check Location elsewhere
      if [[ "$code" =~ ^30[27]$ ]]; then
        echo "$body"
        return 0
      fi
    fi
    # brief backoff
    sleep "$delay"
  done
  fail "HTTP $method $url failed after ${retries} attempts"
}

getj() { req GET "$1" "$@" | $JQ -c '.'; }
postj() { req POST "$1" "$@" | $JQ -c '.'; }

# Fetch CSRF token; cookie jar is updated by curl -c/-b
csrf() {
  getj "$BASE/api/csrf" | $JQ -r '.token' | { read -r t; [[ -n "$t" && "$t" != "null" ]] || fail "CSRF token missing"; echo "$t"; }
}

# Assert presence/contents of security headers on a GET /
check_security_headers() {
  hdrs=$(curl -sD - -o /dev/null "$BASE/")
  echo "$hdrs" | grep -qi '^x-frame-options: *DENY' || fail "X-Frame-Options missing/incorrect"
  echo "$hdrs" | grep -qi '^x-content-type-options: *nosniff' || fail "X-Content-Type-Options missing"
  echo "$hdrs" | grep -qi '^referrer-policy: *strict-origin-when-cross-origin' || fail "Referrer-Policy missing"
  echo "$hdrs" | grep -qi '^content-security-policy' || echo "$hdrs" | grep -qi '^content-security-policy-report-only' || fail "CSP header missing"
}

# -----------------------------
# Suite
# -----------------------------
log "=== Step-11 E2E: Auth + Posts + Replies + Tags + Search + Security (BASE=$BASE) ==="

# 0) Health
log "- Checking /api/health"
getj "$BASE/api/health" | $JQ -e '.ok==true' >/dev/null && pass "Health OK"

# 0.1) Security headers
log "- Checking security headers on /"
check_security_headers && pass "Security headers present"

# 1) OAuth start redirect smoke
log "- Checking /api/auth/google redirect"
HEADERS=$(curl -s -D - -o /dev/null "$BASE/api/auth/google")
STATUS=$(echo "$HEADERS" | awk '/HTTP/{print $2}' | tail -1)
LOC=$(echo "$HEADERS" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r')
[[ "$STATUS" == "302" || "$STATUS" == "307" ]] || fail "Unexpected status: $STATUS"
case "$LOC" in
  https://accounts.google.com/*) pass "Google start Location OK";;
  *) log "  ⚠ Location unexpected: $LOC";;
esac

# 2) Magic link sign-in
log "- Magic link sign-in (supports GET or POST+CSRF)"
LINK=""

# Try modern POST flow
TOK=$(csrf)
POST_LINK=$(postj "$BASE/api/auth/request-link" \
  -H "content-type: application/json" \
  -H "x-csrf-token: $TOK" \
  --data "{\"email\":\"$EMAIL\"}" | $JQ -r '.link // empty' || true )

if [[ -n "${POST_LINK:-}" ]]; then
  LINK="$POST_LINK"
else
  # Fallback to legacy GET flow (some older scripts expect it)
  LINK=$(getj "$BASE/api/auth/request-link?email=$EMAIL" | $JQ -r '.link // empty' || true)
fi

[[ -n "$LINK" ]] || fail "request-link did not return a link (tried POST and GET)."

# Follow magic link → set session cookie
curl -fsSL -c "$COOKIES" -b "$COOKIES" "$LINK" >/dev/null

WHO=$(getj "$BASE/api/debug/whoami" || echo '{}')
USER_ID=$(echo "$WHO" | $JQ -r '.uid // empty')
PROFILE_ID=$(echo "$WHO" | $JQ -r '.pid // empty')
[[ -n "$USER_ID" && -n "$PROFILE_ID" ]] || { echo "$WHO" | $JQ; fail "whoami missing uid/pid"; }
pass "Signed in as uid=$USER_ID pid=$PROFILE_ID"

# 3) Create post with hashtags (CSRF)
log "- Creating post with hashtags"
TOK=$(csrf)
POST_JSON=$(postj "$BASE/api/posts" \
  -H 'content-type: application/json' \
  -H "x-csrf-token: $TOK" \
  --data "{\"body\":\"$BODY\"}")
POST_ID=$(echo "$POST_JSON" | $JQ -r '.post.id // empty')
[[ -n "$POST_ID" ]] || { echo "$POST_JSON" | $JQ; fail "post create failed"; }
pass "Post id: $POST_ID"

# 4) List posts (pagination, newest-first)
log "- Listing posts (paginated, newest-first)"
LIST=$(getj "$BASE/api/posts?limit=3")
echo "$LIST" | $JQ -e '.items|type=="array"' >/dev/null || fail "items missing/invalid"
# check our post appears in the first page (chrono newest-first)
echo "$LIST" | $JQ -e --arg id "$POST_ID" '[.items[].id] | index($id) != null' >/dev/null || fail "new post not present in first page"
pass "Pagination OK & new post visible"

# 5) Create reply (CSRF)
log "- Creating reply"
TOK=$(csrf)
REPLY_JSON=$(postj "$BASE/api/posts/${POST_ID}/replies" \
  -H 'content-type: application/json' \
  -H "x-csrf-token: $TOK" \
  --data '{"body":"first reply from e2e"}')
REPLY_ID=$(echo "$REPLY_JSON" | $JQ -r '.reply.id // empty')
[[ -n "$REPLY_ID" ]] || { echo "$REPLY_JSON" | $JQ; fail "reply create failed"; }
pass "Reply id: $REPLY_ID"

# 6) Tag API (public-only, chrono)
log "- /api/tags/$TAG returns our post"
TAG_JSON=$(getj "$BASE/api/tags/$TAG")
echo "$TAG_JSON" | $JQ -e '.ok==true' >/dev/null || fail "tag timeline not ok"
echo "$TAG_JSON" | $JQ -e --arg id "$POST_ID" '[.items[].id] | index($id) != null' >/dev/null || fail "tag timeline missing our post"
pass "Tag timeline OK"

# 7) Search API (tag + substring)
log "- Search #$TAG"
SEARCH1=$(getj "$BASE/api/search?q=%23$TAG")
echo "$SEARCH1" | $JQ -e '.ok==true' >/dev/null || fail "tag search not ok"
echo "$SEARCH1" | $JQ -e --arg id "$POST_ID" '[.items[].id] | index($id) != null' >/dev/null || fail "tag search missing new post"
pass "Tag search OK"

log "- Search substring 'hello'"
SEARCH2=$(getj "$BASE/api/search?q=hello")
echo "$SEARCH2" | $JQ -e '.ok==true' >/dev/null || fail "substring search not ok"
echo "$SEARCH2" | $JQ -e --arg id "$POST_ID" '[.items[].id] | index($id) != null' >/dev/null || fail "substring search missing new post"
pass "Substring search OK"

# 8) Moderation report (CSRF)
log "- Submit report"
TOK=$(csrf)
postj "$BASE/api/report" \
  -H 'content-type: application/json' \
  -H "x-csrf-token: $TOK" \
  --data "{\"targetType\":\"POST\",\"targetId\":\"$POST_ID\",\"reason\":\"test\"}" >/dev/null
pass "Report OK"

# 9) Admin moderation (HIDE)
log "- Admin hide action"
postj "$BASE/api/admin/moderation/action?key=$KEY" \
  -H 'content-type: application/json' \
  --data "{\"action\":\"HIDE\",\"targetType\":\"POST\",\"targetId\":\"$POST_ID\"}" >/dev/null
pass "Admin moderation OK"

# 10) Sign out
log "- Sign out"
req POST "$BASE/api/auth/signout" >/dev/null
WHO2=$(getj "$BASE/api/debug/whoami" || echo '{}')
[[ "$(echo "$WHO2" | $JQ -r '.uid // empty')" == "" ]] && pass "Signed out cleanly" || fail "signout failed"

echo "🎉 All Step-1→11 checks passed."
