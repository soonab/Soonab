-- CreateEnum
CREATE TYPE "ContentState" AS ENUM ('ACTIVE', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('HIDE', 'UNHIDE', 'REMOVE', 'BLOCK_PROFILE', 'UNBLOCK_PROFILE');

-- CreateEnum
CREATE TYPE "ModerationTarget" AS ENUM ('POST', 'REPLY', 'PROFILE');

-- CreateEnum
CREATE TYPE "PenaltyKind" AS ENUM ('TEMP_POST_BAN', 'PERMA_BAN');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "state" "ContentState" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Reply" ADD COLUMN     "state" "ContentState" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "targetType" "ModerationTarget" NOT NULL,
    "targetId" TEXT,
    "profileId" TEXT,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilePenalty" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "PenaltyKind" NOT NULL,
    "until" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ProfilePenalty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationAction_createdAt_idx" ON "ModerationAction"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModerationAction_targetType_targetId_createdAt_idx" ON "ModerationAction"("targetType", "targetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProfilePenalty_profileId_createdAt_idx" ON "ProfilePenalty"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProfilePenalty_until_idx" ON "ProfilePenalty"("until");

-- CreateIndex
CREATE INDEX "Post_state_createdAt_idx" ON "Post"("state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Reply_state_createdAt_idx" ON "Reply"("state", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ProfilePenalty" ADD CONSTRAINT "ProfilePenalty_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
