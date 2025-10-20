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

## DM v1

```bash
# (after auth; reuse session cookie A.txt/B.txt from existing pack)

# Create a conversation (A → B by handle)
curl -i -s -X POST http://localhost:3000/api/dm/conversations \
  -H 'Content-Type: application/json' -d '{"targetHandle":"TARGET_HANDLE"}' -c A.txt -b A.txt | head -n 1

# Accept as B
CONV_ID="<paste from previous response or GET list>"
curl -i -s -X POST http://localhost:3000/api/dm/$CONV_ID/accept -c B.txt -b B.txt | head -n 1

# Send messages both ways
curl -i -s -X POST http://localhost:3000/api/dm/$CONV_ID/messages \
  -H 'Content-Type: application/json' -d '{"body":"hey there"}' -c A.txt -b A.txt | head -n 1
curl -i -s -X POST http://localhost:3000/api/dm/$CONV_ID/messages \
  -H 'Content-Type: application/json' -d '{"body":"hi!"}' -c B.txt -b B.txt | head -n 1

# Abuse path (expect 429 after bursts)
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/dm/$CONV_ID/messages \
    -H 'Content-Type: application/json' -d '{"body":"spam"}' -c A.txt -b A.txt
done | tail -n 1

# Block as B, then A's send should be forbidden
curl -i -s -X POST http://localhost:3000/api/dm/$CONV_ID/block -c B.txt -b B.txt | head -n 1
curl -i -s -X POST http://localhost:3000/api/dm/$CONV_ID/messages \
  -H 'Content-Type: application/json' -d '{"body":"still there?"}' -c A.txt -b A.txt | head -n 1
```

## Step-13 — Media uploads

```bash
# 1) Sign + upload + finalize (requires valid AWS/S3 environment)
TOK=$(csrf)
RESP=$(curl -s -X POST http://localhost:3000/api/media/sign \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOK" \
  -d '{"contentType":"image/png","size":1024,"scope":"post"}')
MEDIA_ID=$(echo "$RESP" | jq -r '.mediaId')
KEY=$(echo "$RESP" | jq -r '.key')
URL=$(echo "$RESP" | jq -r '.url')

# PUT the file to $URL, then finalize
curl -s -X POST http://localhost:3000/api/media/finalize \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOK" \
  -d "{\"mediaId\":\"$MEDIA_ID\",\"key\":\"$KEY\"}"

# 2) Create a post with 3 images
curl -s -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOK" \
  -d '{"body":"hello #first","visibility":"PUBLIC","mediaIds":["m1","m2","m3"]}'

# 3) Exceed limit → expect 429 after quota used
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOK" \
  -d '{"body":"too many","visibility":"PUBLIC","mediaIds":["mA","mB","mC","mD","mE"]}'

# 4) DM message with images
curl -s -X POST http://localhost:3000/api/dm/<cid>/messages \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOK" \
  -d '{"body":"pics","mediaIds":["mA","mB"]}'
```
