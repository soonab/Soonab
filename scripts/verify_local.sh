#!/usr/bin/env bash
set -euo pipefail

# =========================
# Config & helpers
# =========================
BASE_DEFAULT="${BASE:-http://localhost:3000}"
KEY="${ADMIN_KEY:-dev}"
TMPDIR="${TMPDIR:-/tmp}"

COOKIES_A="${TMPDIR}/alinkah.a.cookies"
COOKIES_B="${TMPDIR}/alinkah.b.cookies"
COOKIES_EMPTY="${TMPDIR}/alinkah.none.cookies"

UA="alinkah-e2e/local"
TS="$(date +%s)"
EMAIL_A="e2e+${TS}@example.com"
EMAIL_B="e2e+${TS}-b@example.com"

BODY="hello world #alinkah #testing"
TAG="alinkah"
JQ="${JQ:-jq}"

ENABLE_DM="${ENABLE_DM:-auto}"       # auto|1|0
ENABLE_MEDIA="${ENABLE_MEDIA:-auto}" # auto|1|0

need() { command -v "$1" >/dev/null || { echo "Missing dependency: $1"; exit 1; }; }
need curl; need "$JQ"; need base64

rm -f "$COOKIES_A" "$COOKIES_B" "$COOKIES_EMPTY"

probe_base() {
  local b1="$BASE_DEFAULT"
  local b2="http://localhost:3001"
  if curl -fsS "$b1/api/health" >/dev/null 2>&1; then echo "$b1"; return; fi
  if curl -fsS "$b2/api/health" >/dev/null 2>&1; then echo "$b2"; return; fi
  echo "❌ Neither $b1 nor $b2 reachable"; exit 1
}
BASE="$(probe_base)"

log()  { printf "%s\n" "$*"; }
pass() { printf "  ✅ %s\n" "$*"; }
warn() { printf "  ⚠️  %s\n" "$*"; }
fail() { printf "  ❌ %s\n" "$*" >&2; exit 1; }
skip() { printf "  ⏭  %s\n" "$*"; }

req_c() { # jar method url [curl-args...]
  local jar="$1"; shift
  local method="$1"; shift
  local url="$1"; shift
  local out code body
  out=$(curl -sS -X "$method" "$url" -b "$jar" -c "$jar" -H "User-Agent: $UA" "$@" --write-out "\n%{http_code}") || true
  code="${out##*$'\n'}"; body="${out%$'\n'*}"
  [[ "$code" =~ ^2[0-9][0-9]$ || "$code" =~ ^30[27]$ ]] || fail "HTTP $method $url -> $code"
  echo "$body"
}
status_c() { curl -s -o /dev/null -w "%{http_code}" -X "$2" "$3" -b "$1" -c "$1" -H "User-Agent: $UA" "${@:4}"; }
getj_c()  { req_c "$1" GET  "$2" "${@:3}" | $JQ -c '.'; }
postj_c() { req_c "$1" POST "$2" "${@:3}" | $JQ -c '.'; }

csrf_c() { getj_c "$1" "$BASE/api/csrf" | $JQ -r '.token' | { read -r t; [[ -n "$t" && "$t" != "null" ]] || fail "CSRF token missing"; echo "$t"; } }
hdr_csrf() { # prints -H pairs for both header names used in code
  local t="$1"; printf -- "-H" "x-csrf: %s" "$t"; printf " "; printf -- "-H" "x-csrf-token: %s" "$t"
}

# =========================
# Suite
# =========================
log "=== Alinkah E2E — Local sanity (BASE=$BASE) ==="

# 0) Health
H=$(getj_c "$COOKIES_A" "$BASE/api/health")
echo "$H" | $JQ -e '.ok==true' >/dev/null && pass "Health OK"; true

# 1) OAuth redirect smoke
HEADERS=$(curl -s -D - -o /dev/null "$BASE/api/auth/google")
STAT=$(echo "$HEADERS" | awk '/HTTP/{print $2}' | tail -1)
[[ "$STAT" == "302" || "$STAT" == "307" ]] && pass "Google start redirects" || warn "Google start status=$STAT"

# 2) Magic-link sign-in (A)
TOK="$(csrf_c "$COOKIES_A")"
LINK_A=$(postj_c "$COOKIES_A" "$BASE/api/auth/request-link" -H 'content-type: application/json' $(hdr_csrf "$TOK") --data "{\"email\":\"$EMAIL_A\"}" | $JQ -r '.link // empty')
[[ -n "$LINK_A" ]] || fail "request-link(A) gave no link"
curl -fsSL -c "$COOKIES_A" -b "$COOKIES_A" "$LINK_A" >/dev/null
WHO_A=$(getj_c "$COOKIES_A" "$BASE/api/debug/whoami" || echo '{}')
PID_A=$(echo "$WHO_A" | $JQ -r '.pid // empty'); [[ -n "$PID_A" ]] || fail "whoami(A) no pid"
pass "Signed in A (pid=$PID_A)"

# 3) Post create (A)
TOK="$(csrf_c "$COOKIES_A")"
PJSON=$(postj_c "$COOKIES_A" "$BASE/api/posts" -H 'content-type: application/json' $(hdr_csrf "$TOK") --data "{\"body\":\"$BODY\"}" || echo '{}')
POST_ID=$(echo "$PJSON" | $JQ -r '.post.id // empty' || true)
[[ -n "$POST_ID" ]] && pass "Created post ($POST_ID)" || warn "Post create blocked (quota?)"

# 4) Tags + search
LIST=$(getj_c "$COOKIES_A" "$BASE/api/tags/$TAG" || echo '{}'); echo "$LIST" | $JQ -e '.ok==true' >/dev/null && pass "Tag page OK" || warn "Tag page not ok"
getj_c "$COOKIES_A" "$BASE/api/search?q=%23$TAG" >/dev/null && pass "Search tag OK"

# 5) Media upload (Step-13)
run_media="yes"
if [[ "$ENABLE_MEDIA" == "auto" ]]; then
  code=$(status_c "$COOKIES_EMPTY" POST "$BASE/api/media/sign")
  [[ "$code" == "401" || "$code" == "400" || "$code" == "415" ]] || run_media="no"
fi
if [[ "$run_media" == "yes" ]]; then
  TPNG="${TMPDIR}/alinkah.1x1.png"
  echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=' | base64 -d > "$TPNG"
  SIZE=$(wc -c < "$TPNG" | tr -d ' ')
  TOK="$(csrf_c "$COOKIES_A")" >/dev/null || true
  SIGN=$(postj_c "$COOKIES_A" "$BASE/api/media/sign" -H 'content-type: application/json' $(hdr_csrf "$TOK") --data "{\"filename\":\"1x1.png\",\"contentType\":\"image/png\",\"size\":$SIZE,\"scope\":\"post\"}")
  echo "$SIGN" | $JQ -e '.ok==true' >/dev/null || { echo "$SIGN" | $JQ; fail "sign failed"; }
  URL=$(echo "$SIGN" | $JQ -r '.url'); KEYOBJ=$(echo "$SIGN" | $JQ -r '.key'); MID=$(echo "$SIGN" | $JQ -r '.mediaId')
  curl -sS -X PUT "$URL" -H 'content-type: image/png' --data-binary @"$TPNG" -o /dev/null || fail "S3 PUT failed"
  FIN=$(postj_c "$COOKIES_A" "$BASE/api/media/finalize" -H 'content-type: application/json' $(hdr_csrf "$TOK") --data "{\"mediaId\":\"$MID\",\"key\":\"$KEYOBJ\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZE,\"scope\":\"post\"}")
  echo "$FIN" | $JQ -e '.ok==true and (.urlThumb|length>0)' >/dev/null && pass "Media finalize OK" || { echo "$FIN" | $JQ; fail "finalize failed"; }
else
  skip "Media disabled/unavailable; skipping Step-13"
fi

# 6) Step-14 — Profile fields & verification
ACC=$(getj_c "$COOKIES_A" "$BASE/api/account/profile"); echo "$ACC" | $JQ -e '.ok==true' >/dev/null || fail "profile GET failed"
HANDLE=$(echo "$ACC" | $JQ -r '.profile.handle // empty')
TOK="$(csrf_c "$COOKIES_A")"
SAVE=$(postj_c "$COOKIES_A" "$BASE/api/account/profile" -X PUT -H 'content-type: application/json' $(hdr_csrf "$TOK") \
 --data '{"bio":"Hello from e2e","bioVisibility":"PUBLIC","location":"Test City","locationVisibility":"FOLLOWERS","links":[{"title":"Site","url":"https://example.com","order":0,"visibility":"PUBLIC"}]}' )
echo "$SAVE" | $JQ -e '.ok==true' >/dev/null && pass "Profile saved" || { echo "$SAVE" | $JQ; fail "profile save failed"; }

# public profile: anon (should NOT include FOLLOWERS-only fields)
PUB_ANON=$(getj_c "$COOKIES_EMPTY" "$BASE/api/profile/$HANDLE")
echo "$PUB_ANON" | $JQ -e '.profile.location | not' >/dev/null && pass "Anon gating OK" || warn "Anon sees location (unexpected)";

# public profile: owner (should include location)
PUB_ME=$(getj_c "$COOKIES_A" "$BASE/api/profile/$HANDLE")
echo "$PUB_ME" | $JQ -e '.profile.location == "Test City"' >/dev/null && pass "Owner sees location OK" || warn "Owner location missing";

# org verification
OV1=$(getj_c "$COOKIES_A" "$BASE/api/account/verify/org")
TOK="$(csrf_c "$COOKIES_A")"
OV2=$(postj_c "$COOKIES_A" "$BASE/api/account/verify/org" -H 'content-type: application/json' $(hdr_csrf "$TOK") --data '{"orgName":"Acme","domain":"example.com"}')
echo "$OV2" | $JQ -e '.ok==true' >/dev/null && pass "Org verify request OK" || { echo "$OV2" | $JQ; warn "Org verify failed"; }

# 7) Sign out
req_c "$COOKIES_A" POST "$BASE/api/auth/signout" >/dev/null
pass "Signed out"

echo "🎉 Verify local done."
