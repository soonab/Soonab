-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('POST', 'REPLY');

-- CreateTable
CREATE TABLE "Reply" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "sessionId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',

    CONSTRAINT "Reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReport" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionProfile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationRating" (
    "id" TEXT NOT NULL,
    "targetSessionId" TEXT NOT NULL,
    "raterSessionId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReputationRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationScore" (
    "sessionId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "sum" INTEGER NOT NULL DEFAULT 0,
    "mean" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bayesianMean" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReputationScore_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE INDEX "Reply_postId_createdAt_idx" ON "Reply"("postId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ModerationReport_createdAt_idx" ON "ModerationReport"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SessionProfile_sessionId_key" ON "SessionProfile"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProfile_handle_key" ON "SessionProfile"("handle");

-- CreateIndex
CREATE INDEX "ReputationRating_targetSessionId_createdAt_idx" ON "ReputationRating"("targetSessionId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ReputationRating_targetSessionId_raterSessionId_key" ON "ReputationRating"("targetSessionId", "raterSessionId");

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationRating" ADD CONSTRAINT "ReputationRating_targetSessionId_fkey" FOREIGN KEY ("targetSessionId") REFERENCES "SessionProfile"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationRating" ADD CONSTRAINT "ReputationRating_raterSessionId_fkey" FOREIGN KEY ("raterSessionId") REFERENCES "SessionProfile"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
