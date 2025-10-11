-- CreateTable
CREATE TABLE "ReputationFlag" (
    "id" TEXT NOT NULL,
    "targetSessionId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReputationFlag_createdAt_idx" ON "ReputationFlag"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReputationFlag_targetSessionId_createdAt_idx" ON "ReputationFlag"("targetSessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_reputation_rater_updated" ON "ReputationRating"("raterSessionId", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_reputation_target_updated" ON "ReputationRating"("targetSessionId", "updatedAt");
