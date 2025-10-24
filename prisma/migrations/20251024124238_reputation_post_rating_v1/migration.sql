-- CreateTable
CREATE TABLE "PostRating" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "raterSessionId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "weightedValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostRating_postId_idx" ON "PostRating"("postId");

-- CreateIndex
CREATE INDEX "PostRating_raterSessionId_idx" ON "PostRating"("raterSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PostRating_postId_raterSessionId_key" ON "PostRating"("postId", "raterSessionId");

-- AddForeignKey
ALTER TABLE "PostRating" ADD CONSTRAINT "PostRating_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
