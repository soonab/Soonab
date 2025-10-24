-- CreateTable
CREATE TABLE "ReplyRating" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "raterSessionId" TEXT NOT NULL,
    "raterProfileId" TEXT,
    "value" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "weightedValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplyRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReplyRating_replyId_idx" ON "ReplyRating"("replyId");

-- CreateIndex
CREATE INDEX "ReplyRating_raterSessionId_idx" ON "ReplyRating"("raterSessionId");

-- CreateIndex
CREATE INDEX "ReplyRating_raterProfileId_idx" ON "ReplyRating"("raterProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyRating_replyId_raterSessionId_key" ON "ReplyRating"("replyId", "raterSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyRating_replyId_raterProfileId_key" ON "ReplyRating"("replyId", "raterProfileId");

-- AddForeignKey
ALTER TABLE "ReplyRating" ADD CONSTRAINT "ReplyRating_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyRating" ADD CONSTRAINT "ReplyRating_raterProfileId_fkey" FOREIGN KEY ("raterProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
