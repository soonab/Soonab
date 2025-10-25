# Base config
BASE_URL="http://localhost:3000"
CJ="/tmp/alinkah.jar"

# If you need to seed the cookie jar, hit your login route via UI or a test helper.
# All curls below reuse (-b) and write (-c) the same jar.

# Helper: extract CSRF from cookie jar (supports common names)
csrf () {
  local tok
  tok=$(awk '$6 ~ /^(csrf|csrfToken|XSRF-TOKEN)$/{print $7}' "$CJ" 2>/dev/null | tail -n 1)
  printf "%s" "$tok"
}

*# Create two public posts
curl -s -c "$CJ" -b "$CJ" -H 'Content-Type: application/json' \
  -X POST "$BASE_URL/api/posts" \
  -d '{"body":"First public post #alinkah"}'

curl -s -c "$CJ" -b "$CJ" -H 'Content-Type: application/json' \
  -X POST "$BASE_URL/api/posts" \
  -d '{"body":"Second public update #alinkah"}'

# Followers-only (if supported in your build)
curl -s -c "$CJ" -b "$CJ" -H 'Content-Type: application/json' \
  -X POST "$BASE_URL/api/posts" \
  -d '{"body":"Followers only #alinkah","visibility":"FOLLOWERS"}'

# Verify tag feed is public-only, newest-first
curl -s "$BASE_URL/api/tags/alinkah" | jq .

# Search respects visibility

SPACE_SLUG="<SPACE_SLUG>"             # e.g. "nic-space"
TOK="$(csrf)"

# Read config
curl -s "$BASE_URL/api/spaces/$SPACE_SLUG/config" | jq .

# Update theme + layout (owner/mod only)
curl -s -c "$CJ" -b "$CJ" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
  -X PUT "$BASE_URL/api/spaces/$SPACE_SLUG/config" \
  -d '{"theme":{"accent":"#2F7A7B"},"layout":["about","links","pinned","members"],"links":[{"label":"Website","url":"https://example.com"}],"visibility":"PUBLIC"}' \
  | jq .

TOK="$(csrf)"

# Create invite (owner/mod)
CREATE=$(curl -s -c "$CJ" -b "$CJ" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
  -X POST "$BASE_URL/api/spaces/$SPACE_SLUG/invites" \
  -d '{"uses":2,"expiresInDays":7}')
echo "$CREATE" | jq .

# Extract token from the link for API accept
TOKEN=$(echo "$CREATE" | jq -r '.link' | awk -F'/space/invite/' '{print $2}')
echo "TOKEN=$TOKEN"

# Accept invite (as another account/session; switch cookie jar if you want)
TOK="$(csrf)"
curl -s -c "$CJ" -b "$CJ" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
  -X POST "$BASE_URL/api/spaces/invites/accept" \
  -d "{\"token\":\"$TOKEN\"}" | jq .

*TOK="$(csrf)"

# Status (returns isMember, role, visibility, spaceId)
curl -s "$BASE_URL/api/spaces/$SPACE_SLUG/membership" | jq .

# Join PUBLIC spaces (should fail with 403 if INVITE)
curl -s -c "$CJ" -b "$CJ" -H "X-CSRF-Token: $TOK" \
  -X POST "$BASE_URL/api/spaces/$SPACE_SLUG/join" | jq .

# Leave
curl -s -c "$CJ" -b "$CJ" -H "X-CSRF-Token: $TOK" \
  -X POST "$BASE_URL/api/spaces/$SPACE_SLUG/leave" | jq .

# List members (owner/mod only)
curl -s -c "$CJ" -b "$CJ" "$BASE_URL/api/spaces/$SPACE_SLUG/members" | jq .

# Remove a member (owner/mod or inviter). Replace <PROFILE_ID>.
PROFILE_ID="<PROFILE_ID>"
curl -s -c "$CJ" -b "$CJ" -H "X-CSRF-Token: $TOK" \
  -X DELETE "$BASE_URL/api/spaces/$SPACE_SLUG/members/$PROFILE_ID" | jq .
**
TOK="$(csrf)"

# Set a low daily public limit for quick testing (env-based in your app, or assume default 5)
# Create N public posts to exhaust the quota
for i in 1 2 3 4 5 6; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$CJ" -b "$CJ" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
    -X POST "$BASE_URL/api/posts" \
    -d "{\"body\":\"public test $i\"}")
  echo "$i -> $CODE"
done
# Expect the last one to be 429 once quota exceeded.

# Now post inside an INVITE space you joined (should be 200 even after quota)
SPACE_ID=$(curl -s "$BASE_URL/api/spaces/$SPACE_SLUG/config" | jq -r '.space.id')
curl -s -o /dev/null -w "%{http_code}\n" -c "$CJ" -b "$CJ" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
  -X POST "$BASE_URL/api/posts" \
  -d "{\"body\":\"inside invite space\",\"spaceId\":\"$SPACE_ID\"}"
# Expect 200

TOK="$(csrf)"

# Create a post in the space (ensure membership)
SPACE_ID=$(curl -s "$BASE_URL/api/spaces/$SPACE_SLUG/config" | jq -r '.space.id')
POST_ID=$(curl -s -c "$CJ" -b "$CJ" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
  -X POST "$BASE_URL/api/posts" \
  -d "{\"body\":\"pin me\",\"spaceId\":\"$SPACE_ID\"}" | jq -r '.post.id')
echo "POST_ID=$POST_ID"

# Pin (owner/mod)
curl -s -c "$CJ" -b "$CJ" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
  -X POST "$BASE_URL/api/spaces/$SPACE_SLUG/pinned" \
  -d "{\"postId\":\"$POST_ID\"}" | jq .

# List
curl -s "$BASE_URL/api/spaces/$SPACE_SLUG/pinned" | jq .

# Unpin
curl -s -c "$CJ" -b "$CJ" -H "X-CSRF-Token: $TOK" \
  -X DELETE "$BASE_URL/api/spaces/$SPACE_SLUG/pinned/$POST_ID" | jq .

# Right-rail/API source
curl -s "$BASE_URL/api/spaces/suggested?limit=5" | jq .

# Optional: SSR page sanity (should render)
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/discover/spaces"

TOK="$(csrf)"

# Sign
RESP=$(curl -s -c "$CJ" -b "$CJ" -X POST "$BASE_URL/api/media/sign" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
  -d '{"contentType":"image/png","size":1024,"scope":"post"}')
echo "$RESP" | jq .
MEDIA_ID=$(echo "$RESP" | jq -r '.mediaId')
KEY=$(echo "$RESP" | jq -r '.key')
URL=$(echo "$RESP" | jq -r '.url')

# (Do the PUT to $URL outside this script.)
# Finalize
curl -s -c "$CJ" -b "$CJ" -X POST "$BASE_URL/api/media/finalize" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOK" \
  -d "{\"mediaId\":\"$MEDIA_ID\",\"key\":\"$KEY\"}" | jq .

# Reuse A.txt/B.txt if you keep two sessions; otherwise stick to one for a smoke pass.

# Create conversation
curl -s -c "$CJ" -b "$CJ" -X POST "$BASE_URL/api/dm/conversations" \
  -H "Content-Type: application/json" \
  -d '{"targetHandle":"TARGET_HANDLE"}' | jq .

# Then accept/send/etc. as per your DM pack.


curl -s "$BASE_URL/api/search?q=%23alinkah" | jq .
curl -s "$BASE_URL/api/search?q=public" | jq .
**
