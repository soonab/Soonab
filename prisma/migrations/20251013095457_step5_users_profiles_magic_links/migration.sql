/*
  Warnings:

  - A unique constraint covering the columns `[targetProfileId,raterProfileId]` on the table `ReputationRating` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[profileId]` on the table `ReputationScore` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."ReputationRating" DROP CONSTRAINT "ReputationRating_raterSessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReputationRating" DROP CONSTRAINT "ReputationRating_targetSessionId_fkey";

-- DropIndex
DROP INDEX "public"."ReputationRating_targetSessionId_createdAt_idx";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "Reply" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "ReputationRating" ADD COLUMN     "raterProfileId" TEXT,
ADD COLUMN     "targetProfileId" TEXT,
ALTER COLUMN "targetSessionId" DROP NOT NULL,
ALTER COLUMN "raterSessionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReputationScore" ADD COLUMN     "profileId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLinkToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_handle_key" ON "Profile"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLinkToken_token_key" ON "MagicLinkToken"("token");

-- CreateIndex
CREATE INDEX "MagicLinkToken_email_expiresAt_idx" ON "MagicLinkToken"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "Post_profileId_createdAt_idx" ON "Post"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Reply_profileId_createdAt_idx" ON "Reply"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_reputation_rater_profile_updated" ON "ReputationRating"("raterProfileId", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_reputation_target_profile_updated" ON "ReputationRating"("targetProfileId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationRating_targetProfileId_raterProfileId_key" ON "ReputationRating"("targetProfileId", "raterProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationScore_profileId_key" ON "ReputationScore"("profileId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationRating" ADD CONSTRAINT "ReputationRating_targetSessionId_fkey" FOREIGN KEY ("targetSessionId") REFERENCES "SessionProfile"("sessionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationRating" ADD CONSTRAINT "ReputationRating_raterSessionId_fkey" FOREIGN KEY ("raterSessionId") REFERENCES "SessionProfile"("sessionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationRating" ADD CONSTRAINT "ReputationRating_targetProfileId_fkey" FOREIGN KEY ("targetProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationRating" ADD CONSTRAINT "ReputationRating_raterProfileId_fkey" FOREIGN KEY ("raterProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationScore" ADD CONSTRAINT "ReputationScore_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
