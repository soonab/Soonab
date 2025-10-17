# Test Pack

## Step-11

```bash
# Create posts (keep cookie jar for session reuse)
BASE_URL="http://localhost:3000"
COOKIE_JAR="/tmp/alinkah-cookies.txt"

curl -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d '{"body":"First public post #alinkah"}' \
  "$BASE_URL/api/posts"

curl -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d '{"body":"Second public update #alinkah"}' \
  "$BASE_URL/api/posts"

curl -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d '{"body":"Followers only #alinkah","visibility":"FOLLOWERS"}' \
  "$BASE_URL/api/posts"

# Verify public tag feed (only the two public posts, newest first)
curl "$BASE_URL/api/tags/alinkah"

# Tag search matches only the same public posts
curl "$BASE_URL/api/search?q=%23alinkah"

# Plain-text search respects visibility
curl "$BASE_URL/api/search?q=public"
```
