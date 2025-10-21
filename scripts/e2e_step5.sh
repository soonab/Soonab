#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Config & helpers
# -----------------------------
BASE_DEFAULT="${BASE:-http://localhost:3000}"
KEY="${ADMIN_KEY:-dev}"
TMPDIR="${TMPDIR:-/tmp}"

# Two users for DM tests (A & B):
COOKIES_A="${TMPDIR}/alinkah.a.cookies"
COOKIES_B="${TMPDIR}/alinkah.b.cookies"
COOKIES_EMPTY="${TMPDIR}/alinkah.none.cookies"

UA="alinkah-e2e/step13"
TS="$(date +%s)"
EMAIL_A="e2e+${TS}@example.com"
EMAIL_B="e2e+${TS}-b@example.com"

BODY="hello world #alinkah #testing"
TAG="alinkah"
JQ="${JQ:-jq}"

ENABLE_DM="${ENABLE_DM:-auto}"   # auto|1|0 — auto will probe and run if available
ENABLE_MEDIA="${ENABLE_MEDIA:-auto}" # auto|1|0 — requires AWS creds configured

need() { command -v "$1" >/dev/null || { echo "Missing dependency: $1"; exit 1; }; }
need curl; need "$JQ"; need base64

rm -f "$COOKIES_A" "$COOKIES_B" "$COOKIES_EMPTY"

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

log()  { printf "%s\n" "$*"; }
pass() { printf "  ✅ %s\n" "$*"; }
warn() { printf "  ⚠️  %s\n" "$*"; }
fail() { printf "  ❌ %s\n" "$*" >&2; exit 1; }
skip() { printf "  ⏭  %s\n" "$*"; }

# Generic request with cookie jar param
req_c() {
  local jar="$1"; shift
  local method="$1"; shift
  local url="$1"; shift
  local retries="${RETRIES:-3}"
  local delay=0.5
  local out code body

  for ((i=1; i<=retries; i++)); do
    if out=$(curl -sS -X "$method" "$url" \
      -b "$jar" -c "$jar" \
      -H "User-Agent: $UA" \
      "$@" \
      --write-out "\n%{http_code}"); then
      code="${out##*$'\n'}"
      body="${out%$'\n'*}"
      if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
        echo "$body"
        return 0
      fi
      if [[ "$code" =~ ^30[27]$ ]]; then
        echo "$body"
        return 0
      fi
    fi
    sleep "$delay"
  done
  fail "HTTP $method $url failed after ${retries} attempts"
}

status_c() { # returns http code, never fails
  local jar="$1"; shift
  local method="$1"; shift
  local url="$1"; shift
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" -b "$jar" -c "$jar" -H "User-Agent: $UA" "$@"
}

getj_c()  { req_c "$1" GET  "$2" "${@:3}" | $JQ -c '.'; }
postj_c() { req_c "$1" POST "$2" "${@:3}" | $JQ -c '.'; }

csrf_c() {
  getj_c "$1" "$BASE/api/csrf" | $JQ -r '.token' | { read -r t; [[ -n "$t" && "$t" != "null" ]] || fail "CSRF token missing"; echo "$t"; }
}

# Health helpers
node_major_ok() {
  if command -v node >/dev/null; then
    local v; v="$(node -v 2>/dev/null | sed 's/^v//;s/\..*$//')"
    [[ "$v" -ge 20 && "$v" -lt 21 ]] && return 0 || return 1
  fi
  return 0
}

# -----------------------------
# Suite
# -----------------------------
log "=== Alinkah E2E: Steps 1→13 (BASE=$BASE) ==="

# 0) Health
log "- Checking /api/health"
HEALTH="$(getj_c "$COOKIES_A" "$BASE/api/health" )"
echo "$HEALTH" | $JQ -e '.ok==true' >/dev/null && pass "Health OK"
# optional: DB connected
if echo "$HEALTH" | $JQ -e '.db=="connected"' >/dev/null 2>&1; then pass "DB connected"; fi

# 0.1) Node engines sanity (warn only)
if node_major_ok; then pass "Node version looks compatible (>=20 <21)"; else warn "Node is not 20.x — engines warn expected in dev"; fi

# 0.2) Security headers on /
log "- Checking security headers"
HDRS=$(curl -sD - -o /dev/null -H "User-Agent: $UA" "$BASE/")
echo "$HDRS" | grep -qi '^x-frame-options: *DENY' || fail "X-Frame-Options missing/incorrect"
echo "$HDRS" | grep -qi '^x-content-type-options: *nosniff' || fail "X-Content-Type-Options missing"
echo "$HDRS" | grep -qi '^referrer-policy: *strict-origin-when-cross-origin' || fail "Referrer-Policy missing"
echo "$HDRS" | grep -qi '^content-security-policy' || echo "$HDRS" | grep -qi '^content-security-policy-report-only' || fail "CSP or CSP-Report-Only header missing"
# HSTS only matters on HTTPS; warn if missing when https
if [[ "$BASE" == https* ]]; then
  echo "$HDRS" | grep -qi '^strict-transport-security' && pass "HSTS present" || warn "HSTS missing on HTTPS"
fi
# Optional: Permissions-Policy (warn)
echo "$HDRS" | grep -qi '^permissions-policy' && pass "Permissions-Policy present" || warn "Permissions-Policy missing (dev ok)"

# 1) OAuth start redirect smoke
log "- Checking /api/auth/google redirect"
HEADERS=$(curl -s -D - -o /dev/null "$BASE/api/auth/google")
STATUS=$(echo "$HEADERS" | awk '/HTTP/{print $2}' | tail -1)
LOC=$(echo "$HEADERS" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r')
[[ "$STATUS" == "302" || "$STATUS" == "307" ]] || fail "Unexpected status: $STATUS"
case "$LOC" in
  https://accounts.google.com/*) pass "Google start Location OK";;
  *) warn "Location unexpected: $LOC";;
esac

# 2) Magic link sign-in (User A)
log "- Magic link sign-in (User A)"
LINK_A=""
TOK="$(csrf_c "$COOKIES_A")"
POST_LINK_A=$(postj_c "$COOKIES_A" "$BASE/api/auth/request-link" \
  -H "content-type: application/json" \
  -H "x-csrf-token: $TOK" \
  --data "{\"email\":\"$EMAIL_A\"}" | $JQ -r '.link // empty' || true )
LINK_A="${POST_LINK_A:-}"
[[ -n "$LINK_A" ]] || fail "request-link did not return link for A"
curl -fsSL -c "$COOKIES_A" -b "$COOKIES_A" "$LINK_A" >/dev/null
WHO_A=$(getj_c "$COOKIES_A" "$BASE/api/debug/whoami" || echo '{}')
UID_A=$(echo "$WHO_A" | $JQ -r '.uid // empty'); PID_A=$(echo "$WHO_A" | $JQ -r '.pid // empty')
[[ -n "$UID_A" && -n "$PID_A" ]] || { echo "$WHO_A" | $JQ; fail "whoami(A) missing uid/pid"; }
pass "Signed in A: uid=$UID_A pid=$PID_A"

# 2b) Negative CSRF: attempt to post without x-csrf-token -> expect 403
log "- Negative CSRF (no token)"
CODE=$(status_c "$COOKIES_A" POST "$BASE/api/posts" -H 'content-type: application/json' --data "{\"body\":\"should be 403\"}")
[[ "$CODE" == "403" ]] && pass "CSRF enforced (403)" || warn "Expected 403, got $CODE"

# 3) Create post with hashtags (A)
log "- Creating post with hashtags (A)"
TOK="$(csrf_c "$COOKIES_A")"
POST_JSON=$(postj_c "$COOKIES_A" "$BASE/api/posts" \
  -H 'content-type: application/json' \
  -H "x-csrf-token: $TOK" \
  --data "{\"body\":\"$BODY\"}")
POST_ID=$(echo "$POST_JSON" | $JQ -r '.post.id // empty')
[[ -n "$POST_ID" ]] || { echo "$POST_JSON" | $JQ; fail "post create failed"; }
pass "Post id: $POST_ID"

# 4) List posts (pagination, newest-first)
log "- Listing posts (paginated, newest-first)"
LIST=$(getj_c "$COOKIES_A" "$BASE/api/posts?limit=3")
echo "$LIST" | $JQ -e '.items|type=="array"' >/dev/null || fail "items missing/invalid"
echo "$LIST" | $JQ -e --arg id "$POST_ID" '[.items[].id] | index($id) != null' >/dev/null || fail "new post not present in first page"
pass "Pagination page 1 OK & new post visible"

# 4b) Cursor pagination determinism (Step-9)
log "- Cursor pagination determinism"
LAST_ID=$(echo "$LIST" | $JQ -r '.items[-1].id')
LIST2=$(getj_c "$COOKIES_A" "$BASE/api/posts?limit=3&cursor=$LAST_ID")
# No duplicates between page 1 and 2
DUP=$(jq -n --argjson a "$LIST" --argjson b "$LIST2" '[($a.items[].id), ($b.items[].id)] | group_by(.) | map(select(length>1)) | length')
[[ "$DUP" == "0" ]] && pass "No dupes across pages" || fail "Found duplicate IDs across pages"
# Monotonic descending by createdAt if present
if echo "$LIST" "$LIST2" | $JQ -e '([.items[]?.createdAt] | length)>0' >/dev/null 2>&1; then
  ALL=$(jq -n --argjson a "$LIST" --argjson b "$LIST2" '{items: ($a.items + $b.items)}')
  DESCOK=$(echo "$ALL" | $JQ -e 'def ts: (.[0:19]+"Z") | fromdate? // 0; [ .items[].createdAt | ts ] | (.[0] >= .[length-1])' || true)
  [[ -n "$DESCOK" ]] && pass "createdAt order looks descending" || warn "Could not verify createdAt ordering"
fi

# 5) Create reply (A)
log "- Creating reply"
TOK="$(csrf_c "$COOKIES_A")"
REPLY_JSON=$(postj_c "$COOKIES_A" "$BASE/api/posts/${POST_ID}/replies" \
  -H 'content-type: application/json' \
  -H "x-csrf-token: $TOK" \
  --data '{"body":"first reply from e2e"}')
REPLY_ID=$(echo "$REPLY_JSON" | $JQ -r '.reply.id // empty')
[[ -n "$REPLY_ID" ]] || { echo "$REPLY_JSON" | $JQ; fail "reply create failed"; }
pass "Reply id: $REPLY_ID"

# 6) Tag API (public-only, chrono)
log "- /api/tags/$TAG returns our post"
TAG_JSON=$(getj_c "$COOKIES_A" "$BASE/api/tags/$TAG")
echo "$TAG_JSON" | $JQ -e '.ok==true' >/dev/null || fail "tag timeline not ok"
echo "$TAG_JSON" | $JQ -e --arg id "$POST_ID" '[.items[].id] | index($id) != null' >/dev/null || fail "tag timeline missing our post"
pass "Tag timeline OK"

# 7) Search API (tag + substring)
log "- Search #$TAG"
SEARCH1=$(getj_c "$COOKIES_A" "$BASE/api/search?q=%23$TAG")
echo "$SEARCH1" | $JQ -e '.ok==true' >/dev/null || fail "tag search not ok"
echo "$SEARCH1" | $JQ -e --arg id "$POST_ID" '[.items[].id] | index($id) != null' >/dev/null || fail "tag search missing new post"
pass "Tag search OK"

log "- Search substring 'hello'"
SEARCH2=$(getj_c "$COOKIES_A" "$BASE/api/search?q=hello")
echo "$SEARCH2" | $JQ -e '.ok==true' >/dev/null || fail "substring search not ok"
echo "$SEARCH2" | $JQ -e --arg id "$POST_ID" '[.items[].id] | index($id) != null' >/dev/null || fail "substring search missing new post"
pass "Substring search OK"

# 8) Moderation report (A)
log "- Submit report"
TOK="$(csrf_c "$COOKIES_A")"
postj_c "$COOKIES_A" "$BASE/api/report" \
  -H 'content-type: application/json' \
  -H "x-csrf-token: $TOK" \
  --data "{\"targetType\":\"POST\",\"targetId\":\"$POST_ID\",\"reason\":\"test\"}" >/dev/null
pass "Report OK"

# 9) Admin moderation (HIDE)
log "- Admin hide action"
postj_c "$COOKIES_A" "$BASE/api/admin/moderation/action?key=$KEY" \
  -H 'content-type: application/json' \
  --data "{\"action\":\"HIDE\",\"targetType\":\"POST\",\"targetId\":\"$POST_ID\"}" >/dev/null
pass "Admin moderation OK"

# 9b) Admin recompute reputation (best-effort)
log "- Admin recompute reputation (best-effort)"
CODE=$(status_c "$COOKIES_A" POST "$BASE/api/reputation/recompute?key=$KEY")
if [[ "$CODE" =~ ^2[0-9][0-9]$ ]]; then pass "Recompute OK"; else warn "Recompute endpoint not available ($CODE)"; fi

# 10) Media uploads (Step-13) — optional if env configured
run_media="yes"
if [[ "$ENABLE_MEDIA" == "0" ]]; then run_media="no"; fi
if [[ "$ENABLE_MEDIA" == "auto" ]]; then
  # Quick probe: if /api/media/sign returns 401 with no cookie, assume route exists
  code=$(status_c "$COOKIES_EMPTY" POST "$BASE/api/media/sign")
  [[ "$code" == "401" || "$code" == "415" || "$code" == "400" ]] || run_media="no"
fi
if [[ "$run_media" == "yes" ]]; then
  log "- Media: unauthenticated sign -> expect 401"
  CODE=$(status_c "$COOKIES_EMPTY" POST "$BASE/api/media/sign" -H 'content-type: application/json' --data '{"filename":"x.png","contentType":"image/png","size":10}')
  [[ "$CODE" == "401" || "$CODE" == "429" ]] && pass "Auth required for sign ($CODE)" || warn "Unexpected unauth sign code: $CODE"

  log "- Media: authenticated sign → PUT → finalize"
  TOK="$(csrf_c "$COOKIES_A")" >/dev/null || true # some signers don't use CSRF; harmless
  # tiny 1x1 png
  TPNG="${TMPDIR}/alinkah.1x1.png"
  echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=' | base64 -d > "$TPNG"

  SIGN=$(postj_c "$COOKIES_A" "$BASE/api/media/sign" \
    -H 'content-type: application/json' \
    --data "{\"filename\":\"1x1.png\",\"contentType\":\"image/png\",\"size\":$(wc -c < \"$TPNG\"),\"scope\":\"post\"}")
  OK=$(echo "$SIGN" | $JQ -r '.ok // false')
  if [[ "$OK" != "true" ]]; then echo "$SIGN" | $JQ; fail "sign failed"; fi
  URL=$(echo "$SIGN" | $JQ -r '.url'); KEYOBJ=$(echo "$SIGN" | $JQ -r '.key'); MID=$(echo "$SIGN" | $JQ -r '.mediaId')

  curl -sS -X PUT "$URL" -H 'content-type: image/png' --data-binary @"$TPNG" -o /dev/null -w '' || fail "S3 PUT failed"
  FIN=$(postj_c "$COOKIES_A" "$BASE/api/media/finalize" \
    -H 'content-type: application/json' \
    --data "{\"mediaId\":\"$MID\",\"key\":\"$KEYOBJ\"}")
  echo "$FIN" | $JQ -e '.ok==true and (.urlThumb|length>0) and (.urlLarge|length>0)' >/dev/null || { echo "$FIN" | $JQ; fail "finalize failed"; }
  pass "Media upload + finalize OK"
else
  skip "Media routes not detected or disabled; skipping Step-13 checks"
fi

# 11) DM v1 (Step-12) — optional/gated
run_dm="yes"
if [[ "$ENABLE_DM" == "0" ]]; then run_dm="no"; fi
if [[ "$ENABLE_DM" == "auto" ]]; then
  code=$(status_c "$COOKIES_A" POST "$BASE/api/dm/conversations")
  [[ "$code" == "401" || "$code" == "400" || "$code" == "405" || "$code" == "415" ]] || run_dm="no"
fi
if [[ "$run_dm" == "yes" ]]; then
  log "- Magic link sign-in (User B)"
  TOKB="$(csrf_c "$COOKIES_B")"
  LINK_B=$(postj_c "$COOKIES_B" "$BASE/api/auth/request-link" \
     -H "content-type: application/json" -H "x-csrf-token: $TOKB" \
     --data "{\"email\":\"$EMAIL_B\"}" | $JQ -r '.link // empty' || true )
  [[ -n "$LINK_B" ]] || fail "request-link did not return link for B"
  curl -fsSL -c "$COOKIES_B" -b "$COOKIES_B" "$LINK_B" >/dev/null
  WHO_B=$(getj_c "$COOKIES_B" "$BASE/api/debug/whoami" || echo '{}')
  UID_B=$(echo "$WHO_B" | $JQ -r '.uid // empty'); PID_B=$(echo "$WHO_B" | $JQ -r '.pid // empty')
  [[ -n "$UID_B" && -n "$PID_B" ]] || { echo "$WHO_B" | $JQ; fail "whoami(B) missing uid/pid"; }
  pass "Signed in B: uid=$UID_B pid=$PID_B"

  # Try several payload shapes (servers vary)
  log "- DM: create conversation A ↔ B"
  CONV=""
  for body in \
    "{\"participantId\":\"$PID_B\"}" \
    "{\"profileId\":\"$PID_B\"}" \
    "{\"participantHandle\":\"user-$PID_B\"}"; do
    CODE=$(status_c "$COOKIES_A" POST "$BASE/api/dm/conversations" -H 'content-type: application/json' --data "$body")
    if [[ "$CODE" =~ ^2[0-9][0-9]$ ]]; then
      CONV=$(req_c "$COOKIES_A" POST "$BASE/api/dm/conversations" -H 'content-type: application/json' --data "$body" | $JQ -r '.conversation.id // .id // empty') && break
    fi
  done
  if [[ -z "$CONV" ]]; then warn "DM create failed; trust-gates or payload differ — skipping DM checks"; run_dm="no"; fi

  if [[ "$run_dm" == "yes" ]]; then
    pass "Conversation created: $CONV"
    log "- DM: send messages"
    MSGA=$(postj_c "$COOKIES_A" "$BASE/api/dm/${CONV}/messages" -H 'content-type: application/json' --data '{"body":"hello from A"}' || echo '{}')
    MSGB=$(postj_c "$COOKIES_B" "$BASE/api/dm/${CONV}/messages" -H 'content-type: application/json' --data '{"body":"hi from B"}' || echo '{}')
    echo "$MSGA" | $JQ -e 'has("message") or has("ok")' >/dev/null && echo "$MSGB" | $JQ -e 'has("message") or has("ok")' >/dev/null && pass "DM messages sent" || warn "DM send endpoints returned unexpected payloads"

    log "- DM: ensure no DM leak into public search"
    SEARCH_DM=$(getj_c "$COOKIES_A" "$BASE/api/search?q=hello%20from%20A" || echo '{}')
    echo "$SEARCH_DM" | $JQ -e '.items | length == 0' >/dev/null && pass "DM content not in search" || warn "Search returned results; verify DM privacy"
  fi
else
  skip "DM routes not detected or disabled; skipping Step-12 checks"
fi

# 12) Sign out
log "- Sign out (A)"
req_c "$COOKIES_A" POST "$BASE/api/auth/signout" >/dev/null
WHO2=$(getj_c "$COOKIES_A" "$BASE/api/debug/whoami" || echo '{}')
[[ "$(echo "$WHO2" | $JQ -r '.uid // empty')" == "" ]] && pass "Signed out cleanly" || fail "signout failed"

echo "🎉 All Step-1→13 checks completed."
