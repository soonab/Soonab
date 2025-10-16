-- CreateIndex
CREATE INDEX "idx_post_created_id_desc" ON "Post"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "idx_reply_post_created_id_asc" ON "Reply"("postId", "createdAt" ASC, "id" ASC);
