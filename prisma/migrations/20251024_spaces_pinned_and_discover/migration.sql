CREATE TABLE IF NOT EXISTS "SpacePinnedPost" (
  "spaceId"     TEXT NOT NULL REFERENCES "Space"("id") ON DELETE CASCADE,
  "postId"      TEXT NOT NULL REFERENCES "Post"("id")  ON DELETE CASCADE,
  "pinnedById"  TEXT NOT NULL REFERENCES "Profile"("id") ON DELETE RESTRICT,
  "position"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("spaceId","postId")
);
CREATE INDEX IF NOT EXISTS "SpacePinnedPost_space_position_idx"
  ON "SpacePinnedPost"("spaceId","position","createdAt" DESC);
